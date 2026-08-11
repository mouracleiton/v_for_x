/**
 * V FOR X — The Public Witness Ledger
 *
 * An append-only, hash-chained ledger of public witness statements.
 * Each statement binds an id, the text, an optional country (ISO3),
 * a timestamp, and a link to the previous statement's hash — so any
 * retroactive edit invalidates everything that followed it.
 *
 * CANONICAL CONTENT (byte-exact — field order is canonical):
 *   JSON.stringify({ id, text, iso3, ts, prevHash })
 *   - "iso3" serializes as "" when the statement has no country
 * A statement's `hash` is the SHA-256 hex of its canonical content.
 *
 * SIGNING (optional): ECDSA P-256 over the canonical content bytes
 * (SHA-256 digest), carried the same way Guardian release packets do
 * (lib/guardian-packet.ts):
 *   - signerPublicKey: base64 SPKI-encoded public key
 *   - signature:       base64 ECDSA-SHA-256 signature
 *   - contentHash:     SHA-256 hex of the canonical content
 * A signature proves authorship of a specific hash — the signer's
 * name is never recorded. Ephemeral per-session keys (sessionStorage
 * only, never localStorage) let the witness prove authorship later.
 *
 * CHAIN MODEL: a LINEAR chain, not a Merkle tree. Each statement
 * links to exactly one predecessor (genesis = GENESIS_HASH from
 * lib/dag.ts). Kept linear deliberately: exports stay compact and
 * verification is O(n) — no hash-folding needed for a local ledger.
 * Building a chain re-links by timestamp; inserting a historical
 * entry re-links (and therefore re-hashes) everything after it.
 *
 * PRIVACY: statements carry no identity fields, so redaction is a
 * no-op (redactForPublic). Optional ZK blur (zkProofForWitness)
 * proves set-membership of the bound country WITHOUT revealing
 * which member, reusing lib/zk.ts's truthful commitment protocol.
 *
 * TRANSPORT: "VFXWIT1:" + base64url(JSON array) — pasteable into
 * chats, mirrors, and dead drops; import merges by id, deduped.
 */

import { GENESIS_HASH } from "./dag";
import {
  proveSetMembership,
  verifySetMembership,
  type ZKCommitment,
} from "./zk";

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

/** Prefix for encoded ledger tokens. */
export const LEDGER_PREFIX = "VFXWIT1:";

/** localStorage key for the local ledger. */
export const LEDGER_STORAGE_KEY = "vfx-witness-ledger";

/** Max statement length in characters. */
export const MAX_WITNESS_TEXT = 500;

const SESSION_KEY_STORAGE = "vfx-witness-session-key";

const HEX64 = /^[0-9a-f]{64}$/;

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface WitnessStatement {
  /** Unique statement ID */
  id: string;
  /** Public statement text (≤ 500 chars) */
  text: string;
  /** Optional 3-letter country code (ISO3, uppercase) */
  iso3?: string;
  /** Epoch ms when the statement was made */
  ts: number;
  /** SHA-256 hex of the previous statement (genesis = all zeros) */
  prevHash: string;
  /** SHA-256 hex of this statement's canonical content */
  hash: string;
}

export interface SignedWitness extends WitnessStatement {
  /** Base64 SPKI-encoded ECDSA P-256 public key */
  signerPublicKey?: string;
  /** Base64 ECDSA-SHA-256 signature over the canonical content bytes */
  signature?: string;
  /** SHA-256 hex of the canonical content (equals `hash`) */
  contentHash?: string;
}

/** Signer injection point — signs the canonical content bytes. */
export type WitnessSignFn = (content: string) => Promise<{
  signature: string;
  publicKey: string;
}>;

export interface WitnessVerifyResult {
  ok: boolean;
  reason?: string;
}

/* ═══════════════════════════════════════════════════════════════
   Encoding helpers (mirrors lib/guardian-packet.ts)
   ═══════════════════════════════════════════════════════════════ */

function bufferToB64(buf: ArrayBuffer | Uint8Array): string {
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

function bufToB64url(buf: ArrayBuffer | Uint8Array): string {
  return bufferToB64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBuf(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  return b64ToBuf(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
}

function hexFromBuf(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hasSubtle(): boolean {
  return typeof globalThis !== "undefined" && !!globalThis.crypto?.subtle;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `wit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return hexFromBuf(digest);
}

/* ═══════════════════════════════════════════════════════════════
   Canonical content + hashing
   ═══════════════════════════════════════════════════════════════ */

/**
 * Deterministic JSON of { id, text, iso3, ts, prevHash } — the exact
 * field order is canonical and MUST NOT change, or every hash breaks.
 * A missing iso3 serializes as "" so the output is byte-stable whether
 * or not the property existed on the object.
 */
export function canonicalWitnessContent(
  stmt: Pick<WitnessStatement, "id" | "text" | "iso3" | "ts" | "prevHash">,
): string {
  return JSON.stringify({
    id: stmt.id,
    text: stmt.text,
    iso3: stmt.iso3 ?? "",
    ts: stmt.ts,
    prevHash: stmt.prevHash,
  });
}

/** SHA-256 hex of a statement's canonical content. */
export async function hashWitness(
  stmt: Pick<WitnessStatement, "id" | "text" | "iso3" | "ts" | "prevHash">,
): Promise<string> {
  return sha256Hex(canonicalWitnessContent(stmt));
}

/* ═══════════════════════════════════════════════════════════════
   Build + verify single statements
   ═══════════════════════════════════════════════════════════════ */

/**
 * Build a statement: validates input, computes the hash from the
 * canonical content, and — when a signFn is injected — signs the
 * canonical content bytes, recording signature + public key +
 * contentHash. Throws on invalid input.
 */
export async function buildWitness(
  input: { text: string; iso3?: string; ts?: number; prevHash?: string },
  signFn?: WitnessSignFn,
): Promise<SignedWitness> {
  if (!hasSubtle()) {
    throw new Error("Web Crypto API unavailable (requires a secure context)");
  }
  const text = input.text ?? "";
  if (!text.trim()) {
    throw new Error("Statement text must not be empty");
  }
  if (text.length > MAX_WITNESS_TEXT) {
    throw new Error(`Statement text exceeds ${MAX_WITNESS_TEXT} characters`);
  }
  let iso3: string | undefined;
  if (input.iso3 !== undefined && input.iso3 !== null && input.iso3.trim() !== "") {
    iso3 = input.iso3.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(iso3)) {
      throw new Error("iso3 must be a 3-letter country code or absent");
    }
  }
  const base: Pick<WitnessStatement, "id" | "text" | "iso3" | "ts" | "prevHash"> = {
    id: generateId(),
    text,
    iso3,
    ts: input.ts ?? Date.now(),
    prevHash: input.prevHash ?? GENESIS_HASH,
  };
  const hash = await hashWitness(base);
  const stmt: SignedWitness = { ...base, hash };

  if (signFn) {
    const content = canonicalWitnessContent(stmt);
    const { signature, publicKey } = await signFn(content);
    stmt.signature = signature;
    stmt.signerPublicKey = publicKey;
    stmt.contentHash = await hashWitness(stmt);
  }
  return stmt;
}

/**
 * Verify a single statement: shape, canonical recompute, and — when
 * the signer's public key is present — the ECDSA signature over the
 * canonical content bytes. Note: hash checks apply to unsigned
 * statements too; a signature is proof of authorship, not integrity.
 */
export async function verifyWitness(
  stmt: WitnessStatement | SignedWitness,
): Promise<WitnessVerifyResult> {
  if (!stmt || typeof stmt !== "object") return { ok: false, reason: "not an object" };
  if (typeof stmt.id !== "string" || !stmt.id) return { ok: false, reason: "missing id" };
  if (typeof stmt.text !== "string" || !stmt.text.trim()) {
    return { ok: false, reason: "missing or empty text" };
  }
  if (stmt.text.length > MAX_WITNESS_TEXT) {
    return { ok: false, reason: `text exceeds ${MAX_WITNESS_TEXT} characters` };
  }
  if (typeof stmt.ts !== "number" || !Number.isFinite(stmt.ts)) {
    return { ok: false, reason: "invalid ts" };
  }
  if (stmt.iso3 !== undefined && !/^[A-Z]{3}$/.test(stmt.iso3)) {
    return { ok: false, reason: "iso3 must be a 3-letter code or absent" };
  }
  if (typeof stmt.prevHash !== "string" || !HEX64.test(stmt.prevHash)) {
    return { ok: false, reason: "prevHash must be a 64-char hex string" };
  }
  if (typeof stmt.hash !== "string" || !HEX64.test(stmt.hash)) {
    return { ok: false, reason: "hash must be a 64-char hex string" };
  }

  const recomputed = await hashWitness(stmt);
  if (recomputed !== stmt.hash) {
    return { ok: false, reason: "hash mismatch — content was tampered after hashing" };
  }

  const s = stmt as SignedWitness;
  const hasPub = typeof s.signerPublicKey === "string" && s.signerPublicKey !== "";
  const hasSig = typeof s.signature === "string" && s.signature !== "";
  if (!hasPub && !hasSig) return { ok: true };

  if (!hasSig) return { ok: false, reason: "signerPublicKey present but signature missing" };
  if (!hasPub) return { ok: false, reason: "signature present but signerPublicKey missing" };
  if (typeof s.contentHash !== "string" || !s.contentHash) {
    return { ok: false, reason: "contentHash missing" };
  }
  if (!hasSubtle()) return { ok: false, reason: "Web Crypto unavailable" };

  try {
    const contentBytes = new TextEncoder().encode(canonicalWitnessContent(stmt));
    if ((await sha256Hex(canonicalWitnessContent(stmt))) !== s.contentHash) {
      return { ok: false, reason: "contentHash mismatch" };
    }
    const pubKey = await crypto.subtle.importKey(
      "spki",
      b64ToBuf(s.signerPublicKey!),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pubKey,
      b64ToBuf(s.signature!),
      contentBytes,
    );
    return valid
      ? { ok: true }
      : { ok: false, reason: "signature does not verify against this content" };
  } catch {
    return { ok: false, reason: "signature verification failed" };
  }
}

/* ═══════════════════════════════════════════════════════════════
   Chain building + verification
   ═══════════════════════════════════════════════════════════════ */

/**
 * Sort statements by ts (ties broken by id) and link each to the
 * previous statement's hash; the first links to GENESIS_HASH.
 * Statements that already sit unchanged at their position keep their
 * stored hash, signature, and contentHash; anything re-linked gets a
 * fresh hash and drops stale signature fields (content changed).
 * Pass signFn to sign rebuilt entries.
 */
export async function buildWitnessChain(
  statements: SignedWitness[],
  signFn?: WitnessSignFn,
): Promise<SignedWitness[]> {
  const sorted = [...statements].sort(
    (a, b) => a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const out: SignedWitness[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const prevHash = i === 0 ? GENESIS_HASH : out[i - 1].hash;
    const hash = await hashWitness({ id: s.id, text: s.text, iso3: s.iso3, ts: s.ts, prevHash });

    const built: SignedWitness = { id: s.id, text: s.text, ts: s.ts, prevHash, hash };
    if (s.iso3 !== undefined) built.iso3 = s.iso3;

    if (s.prevHash === prevHash && s.hash === hash) {
      // Content is unchanged at this position — keep signature fields.
      if (s.signerPublicKey !== undefined) built.signerPublicKey = s.signerPublicKey;
      if (s.signature !== undefined) built.signature = s.signature;
      if (s.contentHash !== undefined) built.contentHash = s.contentHash;
    } else if (signFn) {
      const content = canonicalWitnessContent(built);
      const res = await signFn(content);
      built.signature = res.signature;
      built.signerPublicKey = res.publicKey;
      built.contentHash = hash;
    }
    out.push(built);
  }
  return out;
}

/**
 * Verify the whole chain: every link's hash is recomputed and the
 * prevHash linkage is checked against the canonical (ts-sorted) order.
 * Returns the per-link status plus the root (last link's hash).
 */
export async function verifyWitnessChain(
  statements: SignedWitness[],
): Promise<
  { rootOk: boolean; root: string; links: { id: string; ok: boolean; reason?: string }[] }
> {
  const sorted = [...statements].sort(
    (a, b) => a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  if (sorted.length === 0) {
    return { rootOk: true, root: GENESIS_HASH, links: [] };
  }
  const links: { id: string; ok: boolean; reason?: string }[] = [];
  let rootOk = true;
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const expectedPrev = i === 0 ? GENESIS_HASH : sorted[i - 1].hash;
    const v = await verifyWitness(s);
    if (!v.ok) {
      rootOk = false;
      links.push({ id: s.id, ok: false, reason: v.reason });
      continue;
    }
    if (s.prevHash !== expectedPrev) {
      rootOk = false;
      links.push({
        id: s.id,
        ok: false,
        reason:
          i === 0
            ? "first entry must link to GENESIS_HASH"
            : "prevHash does not match predecessor — chain broken or reordered",
      });
      continue;
    }
    links.push({ id: s.id, ok: true });
  }
  return { rootOk, root: sorted[sorted.length - 1].hash, links };
}

/* ═══════════════════════════════════════════════════════════════
   Ledger transport (export / import)
   ═══════════════════════════════════════════════════════════════ */

/** "VFXWIT1:" + base64url(JSON of the statement array). */
export function encodeWitnessLedger(statements: SignedWitness[]): string {
  const json = JSON.stringify(statements);
  return LEDGER_PREFIX + bufToB64url(new TextEncoder().encode(json));
}

/** Parse an encoded ledger token. Throws on any malformation. */
export function parseWitnessLedger(token: string): SignedWitness[] {
  if (typeof token !== "string" || !token.startsWith(LEDGER_PREFIX)) {
    throw new Error(`Malformed ledger token — expected prefix ${LEDGER_PREFIX}`);
  }
  let json: string;
  try {
    json = new TextDecoder().decode(b64urlToBuf(token.slice(LEDGER_PREFIX.length)));
  } catch {
    throw new Error("Malformed ledger token — payload is not valid base64url");
  }
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("Malformed ledger token — payload is not valid JSON");
  }
  if (!Array.isArray(data)) {
    throw new Error("Malformed ledger token — payload is not an array");
  }
  const out: SignedWitness[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") {
      throw new Error("Malformed ledger token — entry is not an object");
    }
    const s = item as Record<string, unknown>;
    if (
      typeof s.id !== "string" ||
      typeof s.text !== "string" ||
      typeof s.ts !== "number" ||
      typeof s.prevHash !== "string" ||
      typeof s.hash !== "string"
    ) {
      throw new Error("Malformed ledger token — entry missing required fields");
    }
    if (s.iso3 !== undefined && typeof s.iso3 !== "string") {
      throw new Error("Malformed ledger token — invalid iso3 field");
    }
    const entry: SignedWitness = {
      id: s.id as string,
      text: s.text as string,
      ts: s.ts as number,
      prevHash: s.prevHash as string,
      hash: s.hash as string,
    };
    if (typeof s.iso3 === "string") entry.iso3 = s.iso3;
    if (typeof s.signerPublicKey === "string") entry.signerPublicKey = s.signerPublicKey;
    if (typeof s.signature === "string") entry.signature = s.signature;
    if (typeof s.contentHash === "string") entry.contentHash = s.contentHash;
    out.push(entry);
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════
   Privacy
   ═══════════════════════════════════════════════════════════════ */

/**
 * Statements carry no identity fields — hashes and timestamps are
 * public by design — so redaction strips nothing and returns a copy.
 * Privacy is provided by ZK blur (zkProofForWitness) instead.
 */
export function redactForPublic(
  stmt: WitnessStatement | SignedWitness,
): WitnessStatement | SignedWitness {
  return { ...stmt };
}

/**
 * Optional ZK-blur: prove the statement's bound country is a member
 * of `validSet` WITHOUT revealing which member (lib/zk.ts commitment
 * protocol). The returned proof can be published alongside the
 * statement; for real identity hiding pass a multi-member set.
 * Throws if the statement has no iso3 or the iso3 is not in the set.
 */
export async function zkProofForWitness(
  stmt: WitnessStatement,
  claim: string,
  validSet: string[],
): Promise<{ proof: ZKCommitment; verified: boolean }> {
  if (!stmt.iso3) {
    throw new Error("Statement has no iso3 to prove membership of");
  }
  const { proof } = await proveSetMembership(stmt.iso3, validSet, claim);
  const verified = await verifySetMembership(proof, validSet);
  return { proof, verified };
}

/* ═══════════════════════════════════════════════════════════════
   Local persistence
   ═══════════════════════════════════════════════════════════════ */

/** Load the local ledger from localStorage (empty array on any failure). */
export function loadWitnessLedger(): SignedWitness[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SignedWitness[]) : [];
  } catch {
    return [];
  }
}

/** Persist the ledger to localStorage. Returns false on failure. */
export function saveWitnessLedger(statements: SignedWitness[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(statements));
    return true;
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   Ephemeral session signer
   ═══════════════════════════════════════════════════════════════ */

/**
 * Generate a fresh ephemeral ECDSA P-256 keypair and return a signFn
 * that signs canonical content bytes. The public key (base64 SPKI)
 * rides in the statement; the PRIVATE key is kept in sessionStorage
 * ONLY (never localStorage) so the witness can prove authorship for
 * the rest of the session, then it evaporates.
 */
export async function createEphemeralSigner(): Promise<WitnessSignFn> {
  if (!hasSubtle()) {
    throw new Error("Web Crypto API unavailable (requires a secure context)");
  }
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const pub = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const priv = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const publicKey = bufferToB64(pub);
  const privateKey = bufferToB64(priv);

  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.setItem(SESSION_KEY_STORAGE, privateKey);
    } catch {
      /* keep the key in memory only */
    }
  }

  return async (content: string) => {
    const privKey = await crypto.subtle.importKey(
      "pkcs8",
      b64ToBuf(privateKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
    const sigBuf = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privKey,
      new TextEncoder().encode(content),
    );
    return { signature: bufferToB64(sigBuf), publicKey };
  };
}

/**
 * Retrieve the session's ephemeral private key (base64 PKCS8) if one
 * was generated this session — for proving authorship later. Returns
 * null when none exists.
 */
export function loadSessionPrivateKey(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(SESSION_KEY_STORAGE);
  } catch {
    return null;
  }
}

/**
 * Create a signer using the unified identity from lib/identity.ts.
 *
 * This function creates a signing function compatible with buildWitness
 * that uses the persistent unified identity instead of ephemeral session keys.
 * This provides better continuity across sessions and devices.
 */
export async function createIdentitySigner(): Promise<WitnessSignFn> {
  const { ensureIdentity, signWitnessWithIdentity } = await import("./identity");
  const identity = await ensureIdentity();
  return await signWitnessWithIdentity(identity);
}