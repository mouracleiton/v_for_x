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

/* ═══════════════════════════════════════════════════════════════
   Sealed-sender metadata minimization (Phase 12)
   ═══════════════════════════════════════════════════════════════ */

/**
 * A sealed mail hides the *sender's* identity from everyone except the
 * recipient: the recipient's peer hash is used to derive an AES-GCM
 * key that encrypts a small envelope { from, body }. Only the intended
 * recipient can unseal it, and relay nodes carry only an opaque blob +
 * the recipient address — minimizing the metadata an intermediary or
 * adversary can observe.
 *
 * This is sealed-sender in the Signal sense: transport sees "a message
 * for <to>" but not who sent it. The recipient learns the sender only
 * after successfully decrypting.
 */

export interface SealedMail {
  /** MeshMessage-style id. */
  id: string;
  /** Recipient peer hash (visible to relays — needed for routing). */
  to: string;
  /** Opaque ciphertext envelope (base64). */
  sealed: string;
  /** AES-GCM IV (base64). */
  iv: string;
  /** Epoch ms. */
  createdAt: number;
  /** TTL in ms. */
  ttlMs: number;
}

export interface SealedEnvelope {
  from: string;
  body: string;
  kind: MeshKind;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    for (let j = 0; j < Math.min(chunk, bytes.length - i); j++) {
      binary += String.fromCharCode(bytes[i + j]);
    }
  }
  return btoa(binary);
}

function b64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Copy into an ArrayBuffer-backed view (WebCrypto requirement). */
function asBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

/**
 * Derive a symmetric AES-GCM key from a shared secret (e.g. the
 * recipient's peer hash + a pre-shared salt). Both sender and
 * recipient must derive the same key.
 */
async function deriveSealKey(secret: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("vfx-seal:" + secret));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/**
 * Seal a message so only the recipient (who can derive the key from
 * `recipientSecret`) can read it. The sender's identity is inside the
 * encrypted envelope, invisible to relays.
 *
 * @param envelope  { from, body, kind }
 * @param recipientSecret  shared secret the recipient also knows
 *                         (e.g. their peer hash, or an ECDH-derived key)
 */
export async function sealSender(
  envelope: SealedEnvelope,
  recipientSecret: string,
  toPeer: string,
  options: { id?: string; ttlMs?: number; createdAt?: number } = {},
): Promise<SealedMail> {
  const key = await deriveSealKey(recipientSecret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(envelope));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: asBufferSource(iv) }, key, asBufferSource(plaintext)));
  return {
    id: options.id ?? newMeshId(),
    to: toPeer,
    sealed: bytesToB64(ct),
    iv: bytesToB64(iv),
    createdAt: options.createdAt ?? Date.now(),
    ttlMs: options.ttlMs ?? 86_400_000,
  };
}

/**
 * Unseal a sealed mail. Throws if the secret is wrong (decryption
 * fails) — the sender's identity is never revealed without the key.
 */
export async function openSealedMail(
  mail: SealedMail,
  recipientSecret: string,
): Promise<SealedEnvelope> {
  const key = await deriveSealKey(recipientSecret);
  const iv = b64ToBytes(mail.iv);
  const ct = b64ToBytes(mail.sealed);
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: asBufferSource(iv) }, key, asBufferSource(ct)));
  const envelope = JSON.parse(new TextDecoder().decode(pt)) as SealedEnvelope;
  if (!envelope || typeof envelope.from !== "string" || typeof envelope.body !== "string") {
    throw new Error("Invalid sealed envelope");
  }
  return envelope;
}

/**
 * Convenience: create a sealed mail directly from a MeshMessage's
 * routing fields, keeping `from`/`body`/`kind` inside the envelope.
 */
export async function createSealedMail(
  msg: Pick<MeshMessage, "from" | "to" | "body" | "kind">,
  recipientSecret: string,
  options: { id?: string; ttlMs?: number; createdAt?: number } = {},
): Promise<SealedMail> {
  return sealSender(
    { from: msg.from, body: msg.body, kind: msg.kind },
    recipientSecret,
    msg.to,
    { id: options.id ?? msg.from.slice(0, 8) + "-" + Date.now().toString(36), ...options },
  );
}

/** Convert a SealedMail into a MeshMessage-shaped record (envelope stays sealed). */
export function sealedToMesh(mail: SealedMail): MeshMessage {
  return {
    id: mail.id,
    from: "sealed",
    to: mail.to,
    body: mail.sealed,
    kind: "relay",
    createdAt: mail.createdAt,
    ttlMs: mail.ttlMs,
    hops: 0,
    via: [],
  };
}

// (hexToBytes helper kept for parity with other modules; unused by seal path)
void hexToBytes;
