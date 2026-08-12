/**
 * V FOR X — Dossier Dispute Workflow (VFXDSP1)
 *
 * A community counter-check on published dossiers. When a dossier is
 * wrong, biased, or fabricated, a reviewer opens a *dispute*: a signed
 * record linking the target dossier to a counter-claim, evidence, and a
 * requested action. Disputes aggregate locally; when the count of
 * independently-verified disputes crosses a threshold, the dossier is
 * flagged for local unpublish (never globally deleted — each device
 * decides whether to trust).
 *
 * This is adversarial by design: a lone actor can't unpublish a dossier,
 * and a coordinated attack needs many distinct signatures to reach
 * threshold. Signatures dedupe by public key, so one identity = one
 * dispute per dossier.
 *
 * CANONICAL CONTENT (byte-exact — field order is canonical):
 *   JSON.stringify({ id, dossierId, reason, counterLink, evidenceHash,
 *                     action, severity, filer, ts })
 *
 * Token format: VFXDSP1:base64url(JSON(SignedDispute))
 */

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

export const DISPUTE_PREFIX = "VFXDSP1:";
export const DISPUTE_STORAGE_KEY = "vfx-disputes";

/** Default threshold of distinct signers to locally flag a dossier. */
export const DEFAULT_DISPUTE_THRESHOLD = 3;

export const MAX_DISPUTE_REASON = 500;

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export type DisputeAction = "flag" | "correct" | "unpublish";
export type DisputeSeverity = "minor" | "moderate" | "serious" | "fabrication";

export interface Dispute {
  /** Unique dispute id. */
  id: string;
  /** Target dossier id being disputed. */
  dossierId: string;
  /** Why the dossier is disputed (≤ 500 chars). */
  reason: string;
  /** Optional link/URL to the counter-claim or correction. */
  counterLink?: string;
  /** Optional SHA-256 hex of supporting evidence. */
  evidenceHash?: string;
  /** Requested action. */
  action: DisputeAction;
  /** How serious the filer rates the problem. */
  severity: DisputeSeverity;
  /** Handle / fingerprint of the filer. */
  filer?: string;
  /** Epoch ms. */
  ts: number;
  /** SHA-256 hex of canonical content. */
  hash: string;
}

export interface SignedDispute extends Dispute {
  signerPublicKey?: string;
  signature?: string;
  contentHash?: string;
}

export interface DisputeVerifyResult {
  ok: boolean;
  reason?: string;
}

export interface DisputeStatus {
  dossierId: string;
  /** Verified disputes. */
  disputes: SignedDispute[];
  /** Distinct signer count. */
  distinctSigners: number;
  /** Whether the threshold was reached. */
  overThreshold: boolean;
  /** Threshold used. */
  threshold: number;
  /** Recommended local action. */
  recommendedAction: DisputeAction | null;
  /** Highest severity among disputes. */
  maxSeverity: DisputeSeverity;
}

export type DisputeSignFn = (content: string) => Promise<{
  signature: string;
  publicKey: string;
}>;

const SEVERITY_RANK: Record<DisputeSeverity, number> = {
  minor: 1,
  moderate: 2,
  serious: 3,
  fabrication: 4,
};

/* ═══════════════════════════════════════════════════════════════
   Encoding helpers
   ═══════════════════════════════════════════════════════════════ */

function hexFromBuf(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bufToB64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    for (let j = 0; j < Math.min(chunk, bytes.length - i); j++) {
      binary += String.fromCharCode(bytes[i + j]);
    }
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function asBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

async function sha256Hex(input: string): Promise<string> {
  return hexFromBuf(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)));
}

function hasSubtle(): boolean {
  return typeof globalThis !== "undefined" && !!globalThis.crypto?.subtle;
}

/* ═══════════════════════════════════════════════════════════════
   Canonical content + creation
   ═══════════════════════════════════════════════════════════════ */

export function canonicalDispute(d: Omit<Dispute, "hash">): string {
  return JSON.stringify({
    id: d.id,
    dossierId: d.dossierId,
    reason: d.reason.slice(0, MAX_DISPUTE_REASON),
    counterLink: d.counterLink ?? "",
    evidenceHash: d.evidenceHash ?? "",
    action: d.action,
    severity: d.severity,
    filer: d.filer ?? "",
    ts: d.ts,
  });
}

export interface CreateDisputeInput {
  dossierId: string;
  reason: string;
  counterLink?: string;
  evidenceHash?: string;
  action?: DisputeAction;
  severity?: DisputeSeverity;
  filer?: string;
  ts?: number;
  id?: string;
}

export async function createDispute(input: CreateDisputeInput): Promise<Dispute> {
  if (!input.dossierId) throw new Error("Dispute requires a dossierId");
  if (!input.reason || !input.reason.trim()) throw new Error("Dispute requires a reason");
  const id = input.id ?? crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const ts = input.ts ?? Date.now();
  const base: Omit<Dispute, "hash"> = {
    id,
    dossierId: input.dossierId,
    reason: input.reason.trim(),
    counterLink: input.counterLink,
    evidenceHash: input.evidenceHash,
    action: input.action ?? "flag",
    severity: input.severity ?? "moderate",
    filer: input.filer,
    ts,
  };
  const hash = await sha256Hex(canonicalDispute(base));
  return { ...base, hash };
}

/* ═══════════════════════════════════════════════════════════════
   Signing + verification
   ═══════════════════════════════════════════════════════════════ */

export async function signDispute(d: Dispute, keyPair: CryptoKeyPair): Promise<SignedDispute> {
  if (!hasSubtle()) throw new Error("Web Crypto API unavailable");
  const base = stripHash(d);
  const content = new TextEncoder().encode(canonicalDispute(base));
  const pub = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const sigBuf = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keyPair.privateKey, content);
  return { ...d, signerPublicKey: bufToB64url(pub), signature: bufToB64url(sigBuf), contentHash: d.hash };
}

export async function signDisputeWith(d: Dispute, sign: DisputeSignFn): Promise<SignedDispute> {
  const base = stripHash(d);
  const { signature, publicKey } = await sign(canonicalDispute(base));
  return { ...d, signerPublicKey: publicKey, signature, contentHash: d.hash };
}

export async function verifyDispute(signed: SignedDispute): Promise<DisputeVerifyResult> {
  if (!signed || !signed.hash) return { ok: false, reason: "missing_hash" };
  if (!hasSubtle()) return { ok: false, reason: "no_webcrypto" };
  const base = stripHash(signed);
  const recomputed = await sha256Hex(canonicalDispute(base));
  if (recomputed !== signed.hash) return { ok: false, reason: "hash_mismatch" };
  if (signed.signature || signed.signerPublicKey) {
    if (!signed.signature || !signed.signerPublicKey) {
      return { ok: false, reason: "partial_signature" };
    }
    try {
      const pubKey = await crypto.subtle.importKey(
        "spki",
        asBufferSource(b64urlToBytes(signed.signerPublicKey)),
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"],
      );
      const ok = await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        pubKey,
        asBufferSource(b64urlToBytes(signed.signature)),
        new TextEncoder().encode(canonicalDispute(base)),
      );
      if (!ok) return { ok: false, reason: "signature_invalid" };
    } catch {
      return { ok: false, reason: "signature_parse_error" };
    }
  }
  return { ok: true };
}

function stripHash<T extends { hash: string }>(obj: T): Omit<T, "hash"> {
  const { hash: _hash, ...rest } = obj;
  void _hash;
  return rest;
}

/* ═══════════════════════════════════════════════════════════════
   Aggregation / threshold
   ═══════════════════════════════════════════════════════════════ */

/**
 * Evaluate the dispute status for a dossier: dedupe by signer, verify
 * each, and determine whether the threshold for local action is met.
 */
export async function evaluateDisputes(
  dossierId: string,
  disputes: SignedDispute[],
  threshold = DEFAULT_DISPUTE_THRESHOLD,
): Promise<DisputeStatus> {
  const seenKeys = new Set<string>();
  const verified: SignedDispute[] = [];
  let maxSeverity: DisputeSeverity = "minor";
  const actionVotes: Record<DisputeAction, number> = { flag: 0, correct: 0, unpublish: 0 };

  for (const d of disputes) {
    if (d.dossierId !== dossierId) continue;
    const res = await verifyDispute(d);
    if (!res.ok) continue;
    const key = d.signerPublicKey ?? d.filer ?? d.hash;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    verified.push(d);
    if (SEVERITY_RANK[d.severity] > SEVERITY_RANK[maxSeverity]) maxSeverity = d.severity;
    actionVotes[d.action]++;
  }

  const distinctSigners = seenKeys.size;
  const overThreshold = distinctSigners >= threshold;

  // Recommended action = the most-requested among verified disputes, but
  // only meaningful once over threshold.
  let recommendedAction: DisputeAction | null = null;
  if (overThreshold) {
    const entries = Object.entries(actionVotes) as [DisputeAction, number][];
    entries.sort((a, b) => b[1] - a[1]);
    recommendedAction = entries[0][1] > 0 ? entries[0][0] : null;
  }

  return {
    dossierId,
    disputes: verified,
    distinctSigners,
    overThreshold,
    threshold,
    recommendedAction,
    maxSeverity,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Token encoding
   ═══════════════════════════════════════════════════════════════ */

export function encodeDisputeToken(signed: SignedDispute): string {
  return DISPUTE_PREFIX + bufToB64url(new TextEncoder().encode(JSON.stringify(signed)));
}

export function decodeDisputeToken(token: string): SignedDispute {
  const raw = (token ?? "").trim();
  if (!raw.startsWith(DISPUTE_PREFIX)) {
    throw new Error(`Not a dispute token (expected ${DISPUTE_PREFIX})`);
  }
  let json: string;
  try {
    json = new TextDecoder().decode(b64urlToBytes(raw.slice(DISPUTE_PREFIX.length)));
  } catch {
    throw new Error("Malformed dispute token (bad base64url)");
  }
  let signed: SignedDispute;
  try {
    signed = JSON.parse(json) as SignedDispute;
  } catch {
    throw new Error("Malformed dispute token (bad JSON)");
  }
  if (!signed || !signed.id || !signed.dossierId || !signed.hash) {
    throw new Error("Dispute token missing required fields");
  }
  return signed;
}

export function isDisputeToken(token: string): boolean {
  return typeof token === "string" && token.trim().startsWith(DISPUTE_PREFIX);
}

/* ═══════════════════════════════════════════════════════════════
   Local storage
   ═══════════════════════════════════════════════════════════════ */

export function loadLocalDisputes(): SignedDispute[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(DISPUTE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SignedDispute[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalDisputes(disputes: SignedDispute[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(DISPUTE_STORAGE_KEY, JSON.stringify(disputes));
  } catch { /* ignore */ }
}

/** Group stored disputes by dossier id. */
export function disputesByDossier(disputes: SignedDispute[]): Record<string, SignedDispute[]> {
  const out: Record<string, SignedDispute[]> = {};
  for (const d of disputes) {
    (out[d.dossierId] ??= []).push(d);
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════
   Display helpers
   ═══════════════════════════════════════════════════════════════ */

export function describeDispute(signed: SignedDispute): string {
  const sig = signed.signature ? " ✓" : "";
  return `[${signed.severity.toUpperCase()} · ${signed.action}] ${signed.dossierId}${sig}`;
}

export function severityWeight(s: DisputeSeverity): number {
  return SEVERITY_RANK[s];
}
