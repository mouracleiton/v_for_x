/**
 * V FOR X — Mesh Store & Forward (The Web)
 *
 * A delay-tolerant mailbox for the P2P BBS. When a peer is offline, mail
 * is deposited into a local store; when peers meet (a data channel opens)
 * the mail rides the mesh — carried by whichever node happens to be
 * connected — until it reaches its destination or its TTL expires.
 *
 * Nothing is guaranteed: the mesh is best-effort by design. Messages are
 * capped at 5 hops to stop infinite relay loops, and a short "seen" ring
 * buffer (in localStorage) prevents the same packet from being forwarded
 * twice by the same device.
 *
 * Persistence: IndexedDB store "mesh_mailbox" (vfx-store v6). When
 * IndexedDB is unavailable (some webviews / sandboxed contexts) it falls
 * back to a localStorage mirror so the mailbox still works.
 */

import { getDB } from "@/lib/idb";

export const MESH_MAX_HOPS = 5;
export const MESH_SEEK_KEY = "vfx-mesh-seen";
export const MESH_FALLBACK_KEY = "vfx-mesh-mailbox";

export type MeshKind = "chat" | "alert" | "relay";

export interface MeshMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  kind: MeshKind;
  createdAt: number;
  ttlMs: number;
  hops: number;
  via: string[];
}

/** Deterministic peer identity: first 8 hex of SHA-256 of the handle. */
export async function peerHash(handle: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(handle));
  return Array.from(new Uint8Array(digest))
    .slice(0, 4)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function newMeshId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

function expiryOf(msg: MeshMessage, now: number): boolean {
  return now - msg.createdAt > msg.ttlMs;
}

/* ═══════════════════════════════════════════════════════════
   STORAGE
   ═══════════════════════════════════════════════════════════ */

async function loadAll(): Promise<MeshMessage[]> {
  try {
    const db = await getDB();
    return (await db.getAll("mesh_mailbox")) as MeshMessage[];
  } catch {
    return loadFallback();
  }
}

async function putAll(msgs: MeshMessage[]): Promise<void> {
  try {
    const db = await getDB();
    await db.clear("mesh_mailbox");
    for (const m of msgs) await db.add("mesh_mailbox", m);
  } catch {
    saveFallback(msgs);
  }
}

function loadFallback(): MeshMessage[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(MESH_FALLBACK_KEY);
    return raw ? (JSON.parse(raw) as MeshMessage[]) : [];
  } catch {
    return [];
  }
}

function saveFallback(msgs: MeshMessage[]) {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(MESH_FALLBACK_KEY, JSON.stringify(msgs));
  } catch {
    /* ignore */
  }
}

/* ═══════════════════════════════════════════════════════════
   MAILBOX OPERATIONS
   ═══════════════════════════════════════════════════════════ */

/** Deposit a message addressed to `msg.to`. Returns the stored record. */
export async function enqueue(msg: MeshMessage): Promise<MeshMessage> {
  const all = await loadAll();
  const existing = all.find((m) => m.id === msg.id);
  if (existing) return existing;
  const next = [...all, msg];
  await putAll(next);
  return msg;
}

/**
 * Claim (return + delete) all non-expired mail addressed to a peer.
 * Used when a data channel opens with that peer.
 */
export async function dequeueFor(peer: string, now = Date.now()): Promise<MeshMessage[]> {
  const all = await loadAll();
  const mine = all.filter((m) => m.to === peer && !expiryOf(m, now));
  const rest = all.filter((m) => !(m.to === peer && !expiryOf(m, now)));
  await putAll(rest);
  return mine;
}

/** Delete every expired message. Returns how many were removed. */
export async function expireAll(now = Date.now()): Promise<number> {
  const all = await loadAll();
  const alive = all.filter((m) => !expiryOf(m, now));
  if (alive.length !== all.length) await putAll(alive);
  return all.length - alive.length;
}

/** Non-destructive view of undelivered mail for a peer. */
export async function pendingFor(peer: string, now = Date.now()): Promise<MeshMessage[]> {
  const all = await loadAll();
  return all
    .filter((m) => m.to === peer && !expiryOf(m, now))
    .sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Clone a message for the next hop: hops+1, via appended. Returns null
 * when the hop cap is reached (the message dies in the mesh).
 */
export function forward(msg: MeshMessage, viaPeer: string): MeshMessage | null {
  if (msg.hops + 1 > MESH_MAX_HOPS) return null;
  return {
    ...msg,
    hops: msg.hops + 1,
    via: [...msg.via, viaPeer],
  };
}

/* ═══════════════════════════════════════════════════════════
   DEDUPE (recent-id ring buffer)
   ═══════════════════════════════════════════════════════════ */

export function seen(id: string): boolean {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return false;
  try {
    const list = (JSON.parse(localStorage.getItem(MESH_SEEK_KEY) ?? "[]") as string[]) ?? [];
    return list.includes(id);
  } catch {
    return false;
  }
}

export function markSeen(id: string, max = 200) {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    const list = (JSON.parse(localStorage.getItem(MESH_SEEK_KEY) ?? "[]") as string[]) ?? [];
    if (!list.includes(id)) {
      list.push(id);
      if (list.length > max) list.splice(0, list.length - max);
      localStorage.setItem(MESH_SEEK_KEY, JSON.stringify(list));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Import a batch of mesh messages (e.g. carried by a peer). Marks them
 * seen and deposits only the unknown, unexpired ones. Returns the count
 * of new deposits.
 */
export async function depositFromPeers(msgs: MeshMessage[], now = Date.now()): Promise<number> {
  let added = 0;
  for (const m of msgs) {
    if (expiryOf(m, now)) continue;
    if (seen(m.id)) continue;
    markSeen(m.id);
    await enqueue(m);
    added += 1;
  }
  return added;
}

/** Compact one-line summary for UI lists. */
export function formatMeshMail(m: MeshMessage): string {
  const age = Math.max(0, Math.round((Date.now() - m.createdAt) / 1000));
  return `[${m.kind.toUpperCase()}] → ${m.to.slice(0, 8)} · ${m.hops} hop${m.hops === 1 ? "" : "s"} · ${age}s`;
}
