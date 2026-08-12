/**
 * V FOR X — Trail Fulfillment Receipts (VFXFUL1)
 *
 * When a need is met by an offer on The Trail, a fulfillment receipt
 * records *that aid actually arrived* — signed, hash-chained to the
 * match, and exportable as a compact token. This closes the
 * See → Understand → Act → Hold loop for mutual aid: the receipt is
 * the proof that the act happened.
 *
 * Why it matters: in a serverless mesh, the only evidence a convoy
 * delivered, a clinic dispensed medicine, or a shelter housed people
 * is a verifiable record signed by the giver/receiver. Receipts are
 * hash-bound to the originating need+offer ids, so a forged receipt
 * for a match that never existed can't be invented.
 *
 * CANONICAL CONTENT (byte-exact — field order is canonical):
 *   JSON.stringify({ id, needId, offerId, matchHash, iso3, item,
 *                     qty, fulfilledQty, fulfilledBy, status, note, ts })
 * A receipt's `hash` is the SHA-256 hex of its canonical content.
 *
 * SIGNING (optional): ECDSA P-256 over the canonical content bytes,
 * carrying signerPublicKey + signature + contentHash so any recipient
 * can verify authorship offline.
 *
 * WITNESS/DAG BRIDGE: `toWitnessText()` renders a receipt into a
 * single-line statement that can be appended to the Witness ledger
 * (`lib/witness.ts`) — folding fulfillment into the public record.
 *
 * Token format: VFXFUL1:base64url(JSON(SignedFulfillment))
 */

import type { TrailMatch } from "./trail-match";

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

export const FULFILLMENT_PREFIX = "VFXFUL1:";

export const FULFILLMENT_STORAGE_KEY = "vfx-fulfillments";

/** Maximum note length. */
export const MAX_FULFILL_NOTE = 280;

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export type FulfillmentStatus =
  | "delivered" // full delivery completed
  | "partial" // partial quantity delivered
  | "in_transit" // en route / claimed
  | "failed"; // attempted but failed

export interface FulfillmentReceipt {
  /** Unique receipt id. */
  id: string;
  /** Trail entry id of the need that was met. */
  needId: string;
  /** Trail entry id of the offer that met it. */
  offerId: string;
  /** SHA-256 hex of the originating match (binds to the match). */
  matchHash: string;
  /** Optional ISO3 country code. */
  iso3?: string;
  /** Item/category that was fulfilled. */
  item: string;
  /** Original quantity requested/offered. */
  qty?: string;
  /** Quantity actually delivered. */
  fulfilledQty?: string;
  /** Handle of the fulfiller (the one signing). */
  fulfilledBy?: string;
  /** Delivery state. */
  status: FulfillmentStatus;
  /** Freeform note (≤ 280 chars). */
  note?: string;
  /** Epoch ms. */
  ts: number;
  /** SHA-256 hex of canonical content. */
  hash: string;
}

export interface SignedFulfillment extends FulfillmentReceipt {
  /** Base64 SPKI ECDSA P-256 public key. */
  signerPublicKey?: string;
  /** Base64 ECDSA-SHA-256 signature. */
  signature?: string;
  /** SHA-256 hex of canonical content (equals `hash`). */
  contentHash?: string;
}

export interface FulfillmentVerifyResult {
  ok: boolean;
  reason?: string;
}

/** Signer injection point — signs the canonical content bytes. */
export type FulfillSignFn = (content: string) => Promise<{
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
   Match hashing (binds receipt to an actual match)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Deterministic SHA-256 of a match's binding fields.
 * Stable across devices so two parties can independently verify the
 * same receipt refers to the same match.
 */
export async function hashMatch(match: TrailMatch): Promise<string> {
  const content = JSON.stringify({
    needId: match.need.id,
    offerId: match.offer.id,
    category: match.categoryMatch,
    score: Math.round(match.score * 1e6) / 1e6,
  });
  return sha256Hex(content);
}

/**
 * Hash a match from raw ids (when the full match object isn't available).
 */
export async function hashMatchIds(
  needId: string,
  offerId: string,
): Promise<string> {
  return sha256Hex(JSON.stringify({ needId, offerId }));
}

/* ═══════════════════════════════════════════════════════════════
   Canonical content + creation
   ═══════════════════════════════════════════════════════════════ */

/** Canonical, deterministic JSON of a receipt (byte-exact, fixed order). */
export function canonicalFulfillment(r: Omit<FulfillmentReceipt, "hash">): string {
  return JSON.stringify({
    id: r.id,
    needId: r.needId,
    offerId: r.offerId,
    matchHash: r.matchHash,
    iso3: r.iso3 ?? "",
    item: r.item,
    qty: r.qty ?? "",
    fulfilledQty: r.fulfilledQty ?? "",
    fulfilledBy: r.fulfilledBy ?? "",
    status: r.status,
    note: (r.note ?? "").slice(0, MAX_FULFILL_NOTE),
    ts: r.ts,
  });
}

export interface CreateFulfillmentInput {
  match?: TrailMatch;
  needId?: string;
  offerId?: string;
  matchHash?: string;
  iso3?: string;
  item?: string;
  qty?: string;
  fulfilledQty?: string;
  fulfilledBy?: string;
  status?: FulfillmentStatus;
  note?: string;
  ts?: number;
  id?: string;
}

/**
 * Create a fulfillment receipt, hashing it against the originating match.
 * Either pass a full `match`, or `needId`+`offerId` (matchHash is derived).
 */
export async function createFulfillment(
  input: CreateFulfillmentInput,
): Promise<FulfillmentReceipt> {
  let needId: string;
  let offerId: string;
  let matchHash: string;
  let item: string;
  let qty: string | undefined;
  let iso3: string | undefined;

  if (input.match) {
    needId = input.match.need.id;
    offerId = input.match.offer.id;
    matchHash = input.matchHash ?? (await hashMatch(input.match));
    item = input.item ?? input.match.offer.item ?? input.match.offer.category;
    qty = input.qty ?? input.match.offer.qty;
    iso3 = input.iso3 ?? input.match.offer.iso3 ?? input.match.need.iso3;
  } else {
    needId = (input.needId ?? "").trim();
    offerId = (input.offerId ?? "").trim();
    if (!needId || !offerId) {
      throw new Error("createFulfillment requires a match or needId+offerId");
    }
    matchHash = input.matchHash ?? (await hashMatchIds(needId, offerId));
    item = input.item ?? "";
    qty = input.qty;
    iso3 = input.iso3;
  }

  if (!item) throw new Error("Fulfillment requires an item");

  const status = input.status ?? "delivered";
  const id =
    input.id ?? crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const ts = input.ts ?? Date.now();

  const base: Omit<FulfillmentReceipt, "hash"> = {
    id,
    needId,
    offerId,
    matchHash,
    iso3,
    item,
    qty,
    fulfilledQty: input.fulfilledQty,
    fulfilledBy: input.fulfilledBy,
    status,
    note: input.note,
    ts,
  };

  const hash = await sha256Hex(canonicalFulfillment(base));
  return { ...base, hash };
}

/* ═══════════════════════════════════════════════════════════════
   Signing + verification
   ═══════════════════════════════════════════════════════════════ */

/** Sign a receipt with a P-256 keypair. */
export async function signFulfillment(
  receipt: FulfillmentReceipt,
  keyPair: CryptoKeyPair,
): Promise<SignedFulfillment> {
  if (!hasSubtle()) throw new Error("Web Crypto API unavailable");
  const base = stripHash(receipt);
  const content = new TextEncoder().encode(canonicalFulfillment(base));
  const pub = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keyPair.privateKey,
    content,
  );
  return {
    ...receipt,
    signerPublicKey: bufToB64url(pub),
    signature: bufToB64url(sigBuf),
    contentHash: receipt.hash,
  };
}

/** Sign a receipt with an injected signer (used by identity layer). */
export async function signFulfillmentWith(
  receipt: FulfillmentReceipt,
  sign: FulfillSignFn,
): Promise<SignedFulfillment> {
  const base = stripHash(receipt);
  const { signature, publicKey } = await sign(canonicalFulfillment(base));
  return { ...receipt, signerPublicKey: publicKey, signature, contentHash: receipt.hash };
}

function stripHash(r: FulfillmentReceipt): Omit<FulfillmentReceipt, "hash"> {
  const { hash: _hash, ...rest } = r;
  void _hash;
  return rest;
}

/**
 * Verify a signed fulfillment: content hash matches AND the signature
 * (if present) verifies against the canonical content.
 */
export async function verifyFulfillment(
  signed: SignedFulfillment,
): Promise<FulfillmentVerifyResult> {
  if (!signed || !signed.hash) return { ok: false, reason: "missing_hash" };
  if (!hasSubtle()) return { ok: false, reason: "no_webcrypto" };

  // Recompute the content hash.
  const base = stripHash(signed);
  const recomputed = await sha256Hex(canonicalFulfillment(base));
  if (recomputed !== signed.hash) return { ok: false, reason: "hash_mismatch" };

  // Optional ECDSA signature check.
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
        new TextEncoder().encode(canonicalFulfillment(base)),
      );
      if (!ok) return { ok: false, reason: "signature_invalid" };
    } catch {
      return { ok: false, reason: "signature_parse_error" };
    }
  }

  return { ok: true };
}

/* ═══════════════════════════════════════════════════════════════
   Witness / DAG bridge
   ═══════════════════════════════════════════════════════════════ */

/**
 * Render a receipt as a one-line witness statement. Append this text
 * to `lib/witness.ts` to fold the fulfillment into the public ledger.
 */
export function toWitnessText(signed: SignedFulfillment): string {
  const parts = [
    `FULFILLED ${signed.status}`,
    signed.item,
  ];
  if (signed.fulfilledQty) parts.push(`(${signed.fulfilledQty})`);
  if (signed.iso3) parts.push(`[${signed.iso3}]`);
  parts.push(`need:${signed.needId.slice(0, 8)}`);
  parts.push(`offer:${signed.offerId.slice(0, 8)}`);
  parts.push(`h:${signed.hash.slice(0, 12)}`);
  return parts.join(" ");
}

/* ═══════════════════════════════════════════════════════════════
   Token encoding (export/import)
   ═══════════════════════════════════════════════════════════════ */

/** Encode a signed fulfillment as a compact shareable token. */
export function encodeFulfillmentToken(signed: SignedFulfillment): string {
  return FULFILLMENT_PREFIX + bufToB64url(new TextEncoder().encode(JSON.stringify(signed)));
}

/** Decode a fulfillment token. Throws on malformed input. */
export function decodeFulfillmentToken(token: string): SignedFulfillment {
  const raw = (token ?? "").trim();
  if (!raw.startsWith(FULFILLMENT_PREFIX)) {
    throw new Error(`Not a fulfillment token (expected ${FULFILLMENT_PREFIX})`);
  }
  let json: string;
  try {
    json = new TextDecoder().decode(b64urlToBytes(raw.slice(FULFILLMENT_PREFIX.length)));
  } catch {
    throw new Error("Malformed fulfillment token (bad base64url)");
  }
  let signed: SignedFulfillment;
  try {
    signed = JSON.parse(json) as SignedFulfillment;
  } catch {
    throw new Error("Malformed fulfillment token (bad JSON)");
  }
  if (!signed || !signed.id || !signed.needId || !signed.offerId || !signed.hash) {
    throw new Error("Fulfillment token missing required fields");
  }
  return signed;
}

/** Detect a fulfillment token. */
export function isFulfillmentToken(token: string): boolean {
  return typeof token === "string" && token.trim().startsWith(FULFILLMENT_PREFIX);
}

/* ═══════════════════════════════════════════════════════════════
   Local storage (client-side only)
   ═══════════════════════════════════════════════════════════════ */

/** Load all local fulfillment receipts. */
export function loadLocalFulfillments(): SignedFulfillment[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(FULFILLMENT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SignedFulfillment[]) : [];
  } catch {
    return [];
  }
}

/** Persist fulfillment receipts locally. */
export function saveLocalFulfillments(receipts: SignedFulfillment[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(FULFILLMENT_STORAGE_KEY, JSON.stringify(receipts));
  } catch {
    /* ignore */
  }
}

/**
 * Add a receipt to local storage, deduped by id.
 */
export function addLocalFulfillment(signed: SignedFulfillment): SignedFulfillment[] {
  const all = loadLocalFulfillments();
  if (!all.some((r) => r.id === signed.id)) all.push(signed);
  saveLocalFulfillments(all);
  return all;
}

/* ═══════════════════════════════════════════════════════════════
   Aggregation
   ═══════════════════════════════════════════════════════════════ */

export interface FulfillmentSummary {
  total: number;
  delivered: number;
  partial: number;
  inTransit: number;
  failed: number;
  signed: number;
  /** Distinct needs covered. */
  distinctNeeds: number;
  /** Distinct offers that delivered. */
  distinctOffers: number;
}

/** Summarize a collection of receipts. */
export function summarizeFulfillments(receipts: SignedFulfillment[]): FulfillmentSummary {
  const needs = new Set<string>();
  const offers = new Set<string>();
  let delivered = 0;
  let partial = 0;
  let inTransit = 0;
  let failed = 0;
  let signed = 0;
  for (const r of receipts) {
    needs.add(r.needId);
    offers.add(r.offerId);
    if (r.status === "delivered") delivered++;
    else if (r.status === "partial") partial++;
    else if (r.status === "in_transit") inTransit++;
    else if (r.status === "failed") failed++;
    if (r.signature && r.signerPublicKey) signed++;
  }
  return {
    total: receipts.length,
    delivered,
    partial,
    inTransit,
    failed,
    signed,
    distinctNeeds: needs.size,
    distinctOffers: offers.size,
  };
}

/** Human-readable summary line for a receipt. */
export function describeFulfillment(r: SignedFulfillment): string {
  const qty = r.fulfilledQty ? ` (${r.fulfilledQty})` : "";
  const iso = r.iso3 ? ` [${r.iso3}]` : "";
  const sig = r.signature ? " ✓" : "";
  return `${r.status.toUpperCase()} · ${r.item}${qty}${iso} · h:${r.hash.slice(0, 8)}${sig}`;
}
