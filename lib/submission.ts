/**
 * V FOR X — Anonymous Dossier Submission System
 *
 * Local-first evidence dossiers for war crimes, corruption, and human
 * rights violations. Each dossier is:
 *   • Signed with an ephemeral ECDSA P-256 keypair (authenticity w/o identity)
 *   • Optionally encrypted at rest (AES-GCM)
 *   • Stored only in IndexedDB — nothing leaves the device unless broadcast
 *
 * Uses the Web Crypto API (window.crypto.subtle). Every operation guards
 * for SSR / non-secure contexts so the module can be imported anywhere.
 */

import { getDB } from "@/lib/idb";

export interface Submission {
  id: string;
  ts: number;
  country: string;
  category: "war_crime" | "corruption" | "human_rights" | "environmental" | "other";
  title: string;
  description: string;
  evidence: { type: "text" | "image_hash" | "document_hash" | "url"; value: string }[];
  encrypted: boolean;
  signature?: string;
  status: "draft" | "queued" | "broadcast";
  riskLevel: "low" | "medium" | "high" | "critical";
}

/** ZK-style community attestation — vouch for a dossier's credibility. */
export interface Corroboration {
  id?: number;
  submissionId: string;
  handle: string;
  ts: number;
  proofType: "witness" | "documentary" | "expert";
}

/* ═══ encoding helpers (browser only — guarded at call sites) ═══ */

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

/* ═══ crypto ═══ */

/**
 * Generate an anonymous ECDSA P-256 keypair.
 * Returns SPKI (public) and PKCS8 (private) keys as base64 strings.
 */
export async function generateAnonymousKey(): Promise<{ publicKey: string; privateKey: string }> {
  if (!hasSubtle()) {
    throw new Error("Web Crypto API unavailable (requires a secure context)");
  }
  const keyPair = await window.crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const pub = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const priv = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  return { publicKey: bufToB64(pub), privateKey: bufToB64(priv) };
}

/** Canonical JSON of a submission (signature field excluded from the signed payload). */
function canonical(sub: Submission): string {
  const { signature, ...rest } = sub;
  return JSON.stringify(rest, Object.keys(rest).sort());
}

/** Sign a submission with the provided (PKCS8 base64) private key. Returns base64 signature. */
export async function signSubmission(sub: Submission, privateKey: string): Promise<string> {
  if (!hasSubtle()) {
    throw new Error("Web Crypto API unavailable");
  }
  const key = await window.crypto.subtle.importKey(
    "pkcs8",
    b64ToBuf(privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = await window.crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(canonical(sub)),
  );
  return bufToB64(sig);
}

/**
 * Encrypt a string with AES-GCM.
 * If `password` is supplied the key is derived via PBKDF2 (recoverable with
 * the password); otherwise a random key is used for one-way at-rest protection.
 * Returns a self-contained base64 envelope bundling { iv, ct, salt }.
 */
export async function encryptEvidence(data: string, password?: string): Promise<string> {
  if (!hasSubtle()) {
    throw new Error("Web Crypto API unavailable");
  }
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  let saltB64: string | null = null;
  let key: CryptoKey;
  if (password) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const km = await window.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    key = await window.crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
      km,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"],
    );
    saltB64 = bufToB64(salt);
  } else {
    key = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt"],
    );
  }
  const ct = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(data),
  );
  const envelope = JSON.stringify({
    v: 1,
    iv: bufToB64(iv),
    ct: bufToB64(ct),
    salt: saltB64,
  });
  return btoa(envelope);
}

/* ═══ persistence (IndexedDB) ═══ */

export async function saveSubmission(sub: Submission): Promise<void> {
  try {
    const db = await getDB();
    await db.put("submissions", sub);
  } catch {
    /* IndexedDB unavailable — silently ignore */
  }
}

export async function getSubmissions(): Promise<Submission[]> {
  try {
    const db = await getDB();
    const all = (await db.getAll("submissions")) as Submission[];
    return all.sort((a, b) => b.ts - a.ts);
  } catch {
    return [];
  }
}

export async function deleteSubmission(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete("submissions", id);
  } catch {
    /* ignore */
  }
}

/* ═══ broadcast token ═══
 * A compact, shareable token that lets others reference (and corroborate)
 * a dossier without exposing the full payload.
 */
export function generateBroadcastToken(sub: Submission): string {
  const payload = JSON.stringify({
    id: sub.id,
    c: sub.country,
    k: sub.category,
    t: sub.title.slice(0, 80),
    s: sub.ts,
    sig: sub.signature ? sub.signature.slice(0, 16) : null,
  });
  const b64 = typeof btoa === "function" ? btoa(payload) : payload;
  return "VFX-DOSSIER-" + b64;
}

/* ═══ community verification (corroboration) ═══ */

export async function addCorroboration(c: Corroboration): Promise<void> {
  try {
    const db = await getDB();
    await db.add("corroboration", c);
  } catch {
    /* ignore */
  }
}

export async function getCorroborations(submissionId: string): Promise<Corroboration[]> {
  try {
    const db = await getDB();
    const all = (await db.getAllFromIndex(
      "corroboration",
      "by-submission",
      submissionId,
    )) as Corroboration[];
    return all.sort((a, b) => a.ts - b.ts);
  } catch {
    return [];
  }
}
