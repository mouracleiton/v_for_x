/**
 * V FOR X — Community Action Network
 *
 * Three coordinated primitives, all local-first (IndexedDB "vfx-store"):
 *   • Action Circles — topic-based organising groups keyed by country/crisis
 *   • Pledges        — public commitment ledger (anonymous by default)
 *   • Dead Drops     — AES-GCM encrypted, self-destructing messages
 *
 * This is a *simulated* network for the static-export demo: data stays on the
 * user's device but the APIs mirror a real peer-to-peer mesh so the same
 * code could be wired to a gossip/sync transport later.
 */

import { getDB } from "@/lib/idb";

export interface ActionCircle {
  id: string;
  topic: string;
  countryCode: string;
  description: string;
  memberCount: number;
  createdAt: number;
}

export interface Pledge {
  id: string;
  iso3: string;
  action: string; // e.g. "share_dossier", "organize_march", "contact_representative"
  handle: string;
  ts: number;
  anonymous: boolean;
}

export interface DeadDrop {
  id: string;
  circleId: string;
  encryptedContent: string;
  iv: string; // initialization vector (base64)
  ts: number;
  expiresAt: number; // self-destruct timestamp
}

/* ═══ helpers ═══ */

function genId(): string {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

/** Generate a random anonymous handle: "VFX-XXXX". */
export function generateHandle(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return "VFX-" + seg(4);
}

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function hasSubtle(): boolean {
  return typeof window !== "undefined" && !!window.crypto?.subtle;
}

/**
 * Derive a deterministic AES-GCM key from a circle id.
 * Anyone who knows the circle id can read that circle's dead drops. In a
 * production mesh you would use ECDH key agreement between members; this
 * demo derives the key locally so decryption works in-session.
 */
async function deriveCircleKey(circleId: string): Promise<CryptoKey | null> {
  if (!hasSubtle()) return null;
  const km = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("vfx-circle:" + circleId),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("vfx-action-v1"),
      iterations: 50_000,
      hash: "SHA-256",
    },
    km,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/* ═══ action circles ═══ */

export async function createActionCircle(
  topic: string,
  countryCode: string,
  desc: string,
): Promise<ActionCircle> {
  const circle: ActionCircle = {
    id: genId(),
    topic: topic.trim(),
    countryCode,
    description: desc.trim(),
    memberCount: 1,
    createdAt: Date.now(),
  };
  try {
    const db = await getDB();
    await db.put("action_circles", circle);
  } catch {
    /* ignore */
  }
  return circle;
}

export async function joinCircle(circleId: string): Promise<void> {
  try {
    const db = await getDB();
    const circle = (await db.get("action_circles", circleId)) as ActionCircle | undefined;
    if (circle) {
      circle.memberCount += 1;
      await db.put("action_circles", circle);
    }
  } catch {
    /* ignore */
  }
}

export async function getCircles(): Promise<ActionCircle[]> {
  try {
    const db = await getDB();
    const all = (await db.getAll("action_circles")) as ActionCircle[];
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

/* ═══ pledges ═══ */

export async function makePledge(
  iso3: string,
  action: string,
  anonymous: boolean,
): Promise<Pledge> {
  const pledge: Pledge = {
    id: genId(),
    iso3,
    action: action.trim(),
    handle: anonymous ? "anonymous" : generateHandle(),
    ts: Date.now(),
    anonymous,
  };
  try {
    const db = await getDB();
    await db.put("pledges", pledge);
  } catch {
    /* ignore */
  }
  return pledge;
}

export async function getPledges(iso3?: string): Promise<Pledge[]> {
  try {
    const db = await getDB();
    const all = iso3
      ? ((await db.getAllFromIndex("pledges", "by-iso3", iso3)) as Pledge[])
      : ((await db.getAll("pledges")) as Pledge[]);
    return all.sort((a, b) => b.ts - a.ts);
  } catch {
    return [];
  }
}

/* ═══ dead drops (encrypted, self-destructing) ═══ */

export async function createDeadDrop(
  circleId: string,
  content: string,
  ttlHours: number,
): Promise<DeadDrop> {
  const now = Date.now();
  let encryptedContent = "";
  let iv = "";
  const key = await deriveCircleKey(circleId);
  if (key && hasSubtle()) {
    const ivBytes = window.crypto.getRandomValues(new Uint8Array(12));
    const ct = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: ivBytes },
      key,
      new TextEncoder().encode(content),
    );
    encryptedContent = bufToB64(ct);
    iv = bufToB64(ivBytes);
  } else {
    // Fallback (crypto unavailable): store base64-encoded plaintext.
    encryptedContent = bufToB64(new TextEncoder().encode(content));
  }
  const drop: DeadDrop = {
    id: genId(),
    circleId,
    encryptedContent,
    iv,
    ts: now,
    expiresAt: now + ttlHours * 3_600_000,
  };
  try {
    const db = await getDB();
    await db.put("dead_drops", drop);
  } catch {
    /* ignore */
  }
  return drop;
}

export async function getDeadDrops(circleId: string): Promise<DeadDrop[]> {
  try {
    const db = await getDB();
    const all = (await db.getAllFromIndex("dead_drops", "by-circle", circleId)) as DeadDrop[];
    const now = Date.now();
    // Purge expired drops (self-destruct)
    for (const d of all) {
      if (d.expiresAt <= now) {
        try {
          await db.delete("dead_drops", d.id);
        } catch {
          /* ignore */
        }
      }
    }
    return all.filter((d) => d.expiresAt > now).sort((a, b) => b.ts - a.ts);
  } catch {
    return [];
  }
}

/** Decrypt a dead drop's content for in-session display. */
export async function decryptDeadDrop(drop: DeadDrop): Promise<string> {
  if (!hasSubtle() || !drop.iv) {
    // Fallback plaintext-encoded payload
    try {
      return new TextDecoder().decode(b64ToBuf(drop.encryptedContent));
    } catch {
      return "[ENCRYPTED]";
    }
  }
  const key = await deriveCircleKey(drop.circleId);
  if (!key) return "[ENCRYPTED]";
  try {
    const iv = new Uint8Array(b64ToBuf(drop.iv));
    const pt = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      b64ToBuf(drop.encryptedContent),
    );
    return new TextDecoder().decode(pt);
  } catch {
    return "[DECRYPT FAILED]";
  }
}
