/**
 * V FOR X — Signed RFC / Governance Proposals (VFXRFC1)
 *
 * A lightweight governance layer for the distributed network: signed
 * Requests-For-Comment that are grounded in the Witness ledger. Anyone
 * can author a proposal, sign it with their identity, attach it to a
 * Witness statement (the "grounding evidence"), and circulate it as a
 * compact token. Recipients verify the signature offline and tally
 * endorsements independently — no server, no quorum-by-poll.
 *
 * Lifecycle: draft → open → closed (accepted/rejected/withdrawn).
 * Endorsements are signed statements of support; objections are signed
 * statements of opposition. Both are individually verifiable and
 * aggregate locally into a non-binding sense of the room.
 *
 * CANONICAL CONTENT (byte-exact — field order is canonical):
 *   JSON.stringify({ id, title, body, groundingHash, status, author, ts })
 *
 * Token format: VFXRFC1:base64url(JSON(SignedRFC))
 * Endorsement format: VFXRFC1-ENDORSE:base64url(JSON(SignedEndorsement))
 */

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

export const RFC_PREFIX = "VFXRFC1:";
export const ENDORSE_PREFIX = "VFXRFC1-ENDORSE:";
export const RFC_STORAGE_KEY = "vfx-rfcs";

export const MAX_RFC_TITLE = 140;
export const MAX_RFC_BODY = 4000;

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export type RFCStatus = "draft" | "open" | "accepted" | "rejected" | "withdrawn";

export interface RFC {
  /** Unique proposal id. */
  id: string;
  /** One-line title (≤ 140 chars). */
  title: string;
  /** Proposal body (≤ 4000 chars, markdown-ish). */
  body: string;
  /** Optional SHA-256 hex of the grounding Witness statement. */
  groundingHash?: string;
  /** Lifecycle status. */
  status: RFCStatus;
  /** Author handle / identity fingerprint. */
  author?: string;
  /** Epoch ms. */
  ts: number;
  /** SHA-256 hex of canonical content. */
  hash: string;
}

export interface SignedRFC extends RFC {
  /** Base64 SPKI ECDSA P-256 public key. */
  signerPublicKey?: string;
  /** Base64 ECDSA-SHA-256 signature. */
  signature?: string;
  /** SHA-256 hex of canonical content. */
  contentHash?: string;
}

export type EndorseStance = "endorse" | "object" | "abstain";

export interface Endorsement {
  /** RFC id this endorsement targets. */
  rfcId: string;
  /** The stance taken. */
  stance: EndorseStance;
  /** Optional comment. */
  comment?: string;
  /** Signer handle / fingerprint. */
  voter?: string;
  /** Epoch ms. */
  ts: number;
  /** SHA-256 hex of canonical endorsement content. */
  hash: string;
}

export interface SignedEndorsement extends Endorsement {
  signerPublicKey?: string;
  signature?: string;
  contentHash?: string;
}

export interface RFCVerifyResult {
  ok: boolean;
  reason?: string;
}

export interface RFCTally {
  endorsements: number;
  objections: number;
  abstentions: number;
  /** Net score (endorse − object). */
  net: number;
  /** Unique verified voters. */
  voters: number;
}

/** Signer injection point. */
export type RFCSignFn = (content: string) => Promise<{
  signature: string;
  publicKey: string;
}>;

/* ═══════════════════════════════════════════════════════════════
   Encoding helpers
   ═══════════════════════════════════════════════════════════════ */

function hexFromBuf(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
   RFC creation
   ═══════════════════════════════════════════════════════════════ */

/** Canonical, deterministic JSON of an RFC (byte-exact, fixed order). */
export function canonicalRFC(r: Omit<RFC, "hash">): string {
  return JSON.stringify({
    id: r.id,
    title: r.title.slice(0, MAX_RFC_TITLE),
    body: r.body.slice(0, MAX_RFC_BODY),
    groundingHash: r.groundingHash ?? "",
    status: r.status,
    author: r.author ?? "",
    ts: r.ts,
  });
}

export interface CreateRFCInput {
  title: string;
  body: string;
  groundingHash?: string;
  status?: RFCStatus;
  author?: string;
  ts?: number;
  id?: string;
}

/** Create and hash an RFC proposal. */
export async function createRFC(input: CreateRFCInput): Promise<RFC> {
  if (!input.title || !input.title.trim()) throw new Error("RFC requires a title");
  if (!input.body || !input.body.trim()) throw new Error("RFC requires a body");
  const id = input.id ?? crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const ts = input.ts ?? Date.now();
  const base: Omit<RFC, "hash"> = {
    id,
    title: input.title.trim(),
    body: input.body.trim(),
    groundingHash: input.groundingHash,
    status: input.status ?? "open",
    author: input.author,
    ts,
  };
  const hash = await sha256Hex(canonicalRFC(base));
  return { ...base, hash };
}

/* ═══════════════════════════════════════════════════════════════
   Signing + verification
   ═══════════════════════════════════════════════════════════════ */

/** Sign an RFC with a P-256 keypair. */
export async function signRFC(rfc: RFC, keyPair: CryptoKeyPair): Promise<SignedRFC> {
  if (!hasSubtle()) throw new Error("Web Crypto API unavailable");
  const base = stripHash(rfc);
  const content = new TextEncoder().encode(canonicalRFC(base));
  const pub = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const sigBuf = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keyPair.privateKey, content);
  return { ...rfc, signerPublicKey: bufToB64url(pub), signature: bufToB64url(sigBuf), contentHash: rfc.hash };
}

/** Sign an RFC with an injected signer (identity layer). */
export async function signRFCWith(rfc: RFC, sign: RFCSignFn): Promise<SignedRFC> {
  const base = stripHash(rfc);
  const { signature, publicKey } = await sign(canonicalRFC(base));
  return { ...rfc, signerPublicKey: publicKey, signature, contentHash: rfc.hash };
}

/** Verify an RFC's hash and optional signature. */
export async function verifyRFC(signed: SignedRFC): Promise<RFCVerifyResult> {
  if (!signed || !signed.hash) return { ok: false, reason: "missing_hash" };
  if (!hasSubtle()) return { ok: false, reason: "no_webcrypto" };
  const base = stripHash(signed);
  const recomputed = await sha256Hex(canonicalRFC(base));
  if (recomputed !== signed.hash) return { ok: false, reason: "hash_mismatch" };
  if (signed.signature || signed.signerPublicKey) {
    const sigRes = await verifySig(canonicalRFC(base), signed.signature, signed.signerPublicKey);
    if (!sigRes.ok) return sigRes;
  }
  return { ok: true };
}

async function verifySig(
  content: string,
  signature?: string,
  publicKey?: string,
): Promise<RFCVerifyResult> {
  if (!signature || !publicKey) return { ok: false, reason: "partial_signature" };
  try {
    const pubKey = await crypto.subtle.importKey(
      "spki",
      asBufferSource(b64urlToBytes(publicKey)),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pubKey,
      asBufferSource(b64urlToBytes(signature)),
      new TextEncoder().encode(content),
    );
    return ok ? { ok: true } : { ok: false, reason: "signature_invalid" };
  } catch {
    return { ok: false, reason: "signature_parse_error" };
  }
}

function stripHash<T extends { hash: string }>(obj: T): Omit<T, "hash"> {
  const { hash: _hash, ...rest } = obj;
  void _hash;
  return rest;
}

/* ═══════════════════════════════════════════════════════════════
   Endorsements
   ═══════════════════════════════════════════════════════════════ */

/** Canonical JSON of an endorsement (byte-exact). */
export function canonicalEndorsement(e: Omit<Endorsement, "hash">): string {
  return JSON.stringify({
    rfcId: e.rfcId,
    stance: e.stance,
    comment: (e.comment ?? "").slice(0, 280),
    voter: e.voter ?? "",
    ts: e.ts,
  });
}

export interface CreateEndorsementInput {
  rfcId: string;
  stance: EndorseStance;
  comment?: string;
  voter?: string;
  ts?: number;
}

/** Create and hash an endorsement. */
export async function createEndorsement(input: CreateEndorsementInput): Promise<Endorsement> {
  if (!input.rfcId) throw new Error("Endorsement requires an rfcId");
  const ts = input.ts ?? Date.now();
  const base: Omit<Endorsement, "hash"> = {
    rfcId: input.rfcId,
    stance: input.stance,
    comment: input.comment,
    voter: input.voter,
    ts,
  };
  const hash = await sha256Hex(canonicalEndorsement(base));
  return { ...base, hash };
}

/** Sign an endorsement with a P-256 keypair. */
export async function signEndorsement(
  e: Endorsement,
  keyPair: CryptoKeyPair,
): Promise<SignedEndorsement> {
  if (!hasSubtle()) throw new Error("Web Crypto API unavailable");
  const base = stripHash(e);
  const content = new TextEncoder().encode(canonicalEndorsement(base));
  const pub = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const sigBuf = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keyPair.privateKey, content);
  return { ...e, signerPublicKey: bufToB64url(pub), signature: bufToB64url(sigBuf), contentHash: e.hash };
}

/** Verify an endorsement. */
export async function verifyEndorsement(signed: SignedEndorsement): Promise<RFCVerifyResult> {
  if (!signed || !signed.hash) return { ok: false, reason: "missing_hash" };
  if (!hasSubtle()) return { ok: false, reason: "no_webcrypto" };
  const base = stripHash(signed);
  const recomputed = await sha256Hex(canonicalEndorsement(base));
  if (recomputed !== signed.hash) return { ok: false, reason: "hash_mismatch" };
  if (signed.signature || signed.signerPublicKey) {
    const sigRes = await verifySig(canonicalEndorsement(base), signed.signature, signed.signerPublicKey);
    if (!sigRes.ok) return sigRes;
  }
  return { ok: true };
}

/**
 * Tally endorsements for an RFC. Dedupes by signer (one vote per key).
 * Only verified endorsements count; rejects are dropped silently.
 */
export async function tallyEndorsements(
  endorsements: SignedEndorsement[],
): Promise<RFCTally> {
  let endorse = 0;
  let object = 0;
  let abstain = 0;
  const seenKeys = new Set<string>();
  const seenVoters = new Set<string>();

  for (const e of endorsements) {
    const res = await verifyEndorsement(e);
    if (!res.ok) continue;
    const dedupeKey = e.signerPublicKey ?? e.voter ?? e.hash;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);
    if (e.voter) seenVoters.add(e.voter);
    if (e.stance === "endorse") endorse++;
    else if (e.stance === "object") object++;
    else abstain++;
  }

  return {
    endorsements: endorse,
    objections: object,
    abstentions: abstain,
    net: endorse - object,
    voters: seenVoters.size || endorse + object + abstain,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Token encoding
   ═══════════════════════════════════════════════════════════════ */

export function encodeRFCToken(signed: SignedRFC): string {
  return RFC_PREFIX + bufToB64url(new TextEncoder().encode(JSON.stringify(signed)));
}

export function decodeRFCToken(token: string): SignedRFC {
  const raw = (token ?? "").trim();
  if (!raw.startsWith(RFC_PREFIX)) throw new Error(`Not an RFC token (expected ${RFC_PREFIX})`);
  let json: string;
  try {
    json = new TextDecoder().decode(b64urlToBytes(raw.slice(RFC_PREFIX.length)));
  } catch {
    throw new Error("Malformed RFC token (bad base64url)");
  }
  let signed: SignedRFC;
  try {
    signed = JSON.parse(json) as SignedRFC;
  } catch {
    throw new Error("Malformed RFC token (bad JSON)");
  }
  if (!signed || !signed.id || !signed.title || !signed.hash) {
    throw new Error("RFC token missing required fields");
  }
  return signed;
}

export function encodeEndorsementToken(signed: SignedEndorsement): string {
  return ENDORSE_PREFIX + bufToB64url(new TextEncoder().encode(JSON.stringify(signed)));
}

export function decodeEndorsementToken(token: string): SignedEndorsement {
  const raw = (token ?? "").trim();
  if (!raw.startsWith(ENDORSE_PREFIX)) {
    throw new Error(`Not an endorsement token (expected ${ENDORSE_PREFIX})`);
  }
  let json: string;
  try {
    json = new TextDecoder().decode(b64urlToBytes(raw.slice(ENDORSE_PREFIX.length)));
  } catch {
    throw new Error("Malformed endorsement token (bad base64url)");
  }
  let signed: SignedEndorsement;
  try {
    signed = JSON.parse(json) as SignedEndorsement;
  } catch {
    throw new Error("Malformed endorsement token (bad JSON)");
  }
  if (!signed || !signed.rfcId || !signed.hash) {
    throw new Error("Endorsement token missing required fields");
  }
  return signed;
}

export function isRFCToken(token: string): boolean {
  return typeof token === "string" && token.trim().startsWith(RFC_PREFIX);
}

export function isEndorsementToken(token: string): boolean {
  return typeof token === "string" && token.trim().startsWith(ENDORSE_PREFIX);
}

/* ═══════════════════════════════════════════════════════════════
   Local storage
   ═══════════════════════════════════════════════════════════════ */

export function loadLocalRFCs(): SignedRFC[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(RFC_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SignedRFC[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalRFCs(rfcs: SignedRFC[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(RFC_STORAGE_KEY, JSON.stringify(rfcs));
  } catch { /* ignore */ }
}

/** Add an RFC locally, deduped by id. */
export function addLocalRFC(signed: SignedRFC): SignedRFC[] {
  const all = loadLocalRFCs();
  if (!all.some((r) => r.id === signed.id)) all.push(signed);
  saveLocalRFCs(all);
  return all;
}

/* ═══════════════════════════════════════════════════════════════
   Display helpers
   ═══════════════════════════════════════════════════════════════ */

export function describeRFC(signed: SignedRFC): string {
  const sig = signed.signature ? " ✓" : "";
  return `[${signed.status.toUpperCase()}] ${signed.title}${sig}`;
}

export function summarizeTally(tally: RFCTally): string {
  return `+${tally.endorsements} / −${tally.objections} / ${tally.abstentions} abstain (net ${tally.net >= 0 ? "+" : ""}${tally.net})`;
}
