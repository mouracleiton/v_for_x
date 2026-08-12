/**
 * V FOR X — The Convoy (N-of-M coordinate escrow)
 *
 * Delivery coordinates are the most dangerous data in a mutual-aid
 * network: revealing them lets an adversary ambush a convoy or raid a
 * drop site. The Convoy splits the drop coordinates into N shares so
 * that **no single courier** (and no adversary who captures one) can
 * learn the destination, yet any K couriers who meet can reconstruct it.
 *
 * This is Shamir Secret Sharing over GF(256) — the same primitive
 * behind social key-recovery and threshold custody. The math:
 *
 *   • Pick a random polynomial p(x) of degree K−1 with p(0) = secret.
 *   • Share i = p(i) for i = 1..N.
 *   • Any K shares → Lagrange interpolation at x=0 recovers the secret.
 *   • Any K−1 shares reveal *nothing* about the secret (information-
 *     theoretic security: even unbounded compute can't help).
 *
 * GF(256) is used so the scheme works on raw bytes without rounding:
 * every field element is exactly one byte, addition is XOR, and the
 * reducing polynomial is 0x11B (AES's field).
 *
 * Token format: VFXCNV1:base64url(JSON({ id, iso3, n, k, x, y, ts }))
 * Each courier carries ONE share token. They are independently
 * unforgeable — a wrong share produces garbage, never a partial secret.
 *
 * Fully offline, no servers, no accounts. The coordinates never leave
 * the device until K shares are intentionally combined.
 */

/* ═══════════════════════════════════════════════════════════════
   Token constants
   ═══════════════════════════════════════════════════════════════ */

export const CONVOY_PREFIX = "VFXCNV1:";

export const CONVOY_STORAGE_KEY = "vfx-convoy-shares";

/** Maximum shares in a scheme (GF(256) allows 255 non-zero points). */
export const MAX_SHARES = 255;

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface ConvoyShare {
  /** Scheme id shared by all shares of one secret. */
  id: string;
  /** Optional ISO3 country code. */
  iso3?: string;
  /** Total number of shares (N). */
  n: number;
  /** Threshold required to reconstruct (K). */
  k: number;
  /** This share's x-coordinate (1..N, never 0). */
  x: number;
  /** This share's y-value (one byte per secret byte). */
  y: number[];
  /** Epoch ms the scheme was created. */
  ts: number;
}

export interface ConvoySplitOptions {
  /** Total shares to mint (N). */
  n: number;
  /** Threshold needed to reconstruct (K). 1 ≤ K ≤ N. */
  k: number;
  /** Optional ISO3 code carried on every share. */
  iso3?: string;
  /** Optional scheme id (random if omitted). */
  id?: string;
  /** Optional timestamp (Date.now() if omitted). */
  ts?: number;
}

export interface ConvoyResult {
  ok: boolean;
  secret?: string;
  reason?: string;
  /** Number of shares used. */
  sharesUsed: number;
}

/* ═══════════════════════════════════════════════════════════════
   GF(256) arithmetic (reducing polynomial 0x11B, generator 3)
   ═══════════════════════════════════════════════════════════════ */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGfTables(): void {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    // multiply by generator 3 = xtime(x) XOR x (3 is a primitive element
    // of GF(256) under the reducing polynomial 0x11B — it generates all
    // 255 non-zero elements; 2/`xtime` alone does NOT, it cycles at 51).
    const xtime = (x & 0x80) !== 0 ? ((x << 1) ^ 0x11b) & 0xff : (x << 1) & 0xff;
    x = xtime ^ x;
  }
  // Duplicate the exp table so we can index without mod for mult lookups.
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

/** GF(256) multiplication. */
export function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/** GF(256) multiplicative inverse (0 has no inverse → 0). */
export function gfInv(a: number): number {
  if (a === 0) return 0;
  return GF_EXP[255 - GF_LOG[a]];
}

/** GF(256) division (a/b). */
export function gfDiv(a: number, b: number): number {
  if (a === 0) return 0;
  if (b === 0) throw new Error("GF(256) division by zero");
  return GF_EXP[(GF_LOG[a] + 255 - GF_LOG[b]) % 255];
}

/* ═══════════════════════════════════════════════════════════════
   Polynomial helpers
   ═══════════════════════════════════════════════════════════════ */

/**
 * Evaluate a polynomial (coefficients low→high) at point x over GF(256).
 * coefficients[0] is the constant term (the secret).
 */
export function gfEval(coeffs: number[], x: number): number {
  if (x === 0) return coeffs[0];
  // Horner's method in GF(256)
  let result = coeffs[coeffs.length - 1];
  for (let i = coeffs.length - 2; i >= 0; i--) {
    result = gfMul(result, x) ^ coeffs[i];
  }
  return result;
}

/**
 * Generate K cryptographically-random coefficients where coeff[0] = secret.
 */
function makeCoeffs(secret: number, k: number): number[] {
  const coeffs = new Array<number>(k);
  coeffs[0] = secret;
  const rand = crypto.getRandomValues(new Uint8Array(k - 1));
  for (let i = 1; i < k; i++) coeffs[i] = rand[i - 1];
  return coeffs;
}

/**
 * Lagrange interpolation at x=0 over GF(256) to recover the constant
 * term (the secret) from K points.
 *
 * For each share i: basis_i(0) = Π (0 − x_j) / (x_i − x_j) for j ≠ i.
 */
export function gfInterpolateZero(points: { x: number; y: number }[]): number {
  let secret = 0;
  for (let i = 0; i < points.length; i++) {
    let num = 1;
    let den = 1;
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      num = gfMul(num, points[j].x); // (0 − x_j) = x_j in GF(2^m)
      den = gfMul(den, points[i].x ^ points[j].x);
    }
    const basis = gfDiv(num, den);
    secret ^= gfMul(points[i].y, basis);
  }
  return secret;
}

/* ═══════════════════════════════════════════════════════════════
   Core: split / combine (byte-wise)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Split a secret byte array into N shares with threshold K.
 * Returns N shares; any K of them reconstruct the secret.
 */
export function splitSecret(
  secret: Uint8Array,
  options: ConvoySplitOptions,
): ConvoyShare[] {
  const { n, k } = options;
  if (!Number.isInteger(n) || !Number.isInteger(k)) {
    throw new Error("n and k must be integers");
  }
  if (k < 1 || k > n) {
    throw new Error(`Invalid threshold: need 1 ≤ k ≤ n (got k=${k}, n=${n})`);
  }
  if (n > MAX_SHARES) {
    throw new Error(`Too many shares (max ${MAX_SHARES})`);
  }
  if (secret.length === 0) {
    throw new Error("secret must not be empty");
  }

  const id = options.id ?? crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const ts = options.ts ?? Date.now();
  const iso3 = options.iso3?.trim().toUpperCase();

  // Generate ONE polynomial per byte (fixed across all shares), then
  // evaluate each polynomial at x = 1..N. The constant term is the secret.
  const polys: number[][] = [];
  for (let b = 0; b < secret.length; b++) {
    polys.push(makeCoeffs(secret[b], k));
  }

  const shares: ConvoyShare[] = [];
  for (let idx = 1; idx <= n; idx++) {
    const y: number[] = polys.map((coeffs) => gfEval(coeffs, idx));
    shares.push({ id, iso3, n, k, x: idx, y, ts });
  }
  return shares;
}

/**
 * Combine K or more shares to recover the original secret bytes.
 * Throws if fewer than K shares are provided or shares are inconsistent.
 */
export function combineShares(shares: ConvoyShare[]): Uint8Array {
  if (!Array.isArray(shares) || shares.length === 0) {
    throw new Error("No shares provided");
  }
  const k = shares[0].k;
  if (shares.length < k) {
    throw new Error(`Need at least ${k} shares, got ${shares.length}`);
  }
  const len = shares[0].y.length;
  if (len === 0) throw new Error("Empty share y");

  // Use the first K shares.
  const use = shares.slice(0, k);
  for (const s of use) {
    if (s.k !== k) throw new Error("Share threshold mismatch");
    if (s.y.length !== len) throw new Error("Share length mismatch");
  }

  const out = new Uint8Array(len);
  for (let b = 0; b < len; b++) {
    const points = use.map((s) => ({ x: s.x, y: s.y[b] }));
    out[b] = gfInterpolateZero(points);
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════
   High-level: coordinates + token encoding
   ═══════════════════════════════════════════════════════════════ */

/**
 * Split delivery coordinates (or any text secret) into N share tokens.
 * Returns one VFXCNV1 token per courier. Any K reconstruct the coords.
 */
export function createConvoyShares(
  secretText: string,
  options: ConvoySplitOptions,
): string[] {
  if (typeof secretText !== "string" || secretText.length === 0) {
    throw new Error("secretText must be a non-empty string");
  }
  const bytes = new TextEncoder().encode(secretText);
  const shares = splitSecret(bytes, options);
  return shares.map(encodeConvoyShare);
}

/**
 * Recover the secret text from K or more share tokens.
 */
export function recoverConvoySecret(tokens: string[]): ConvoyResult {
  const shares: ConvoyShare[] = [];
  for (const t of tokens) {
    try {
      shares.push(decodeConvoyShare(t));
    } catch {
      // skip unparseable tokens
    }
  }
  if (shares.length === 0) {
    return { ok: false, reason: "no_valid_shares", sharesUsed: 0 };
  }
  try {
    const bytes = combineShares(shares);
    return {
      ok: true,
      secret: new TextDecoder().decode(bytes),
      sharesUsed: shares.length,
    };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "reconstruct_failed",
      sharesUsed: shares.length,
    };
  }
}

/* ═══════════════════════════════════════════════════════════════
   Token encoding
   ═══════════════════════════════════════════════════════════════ */

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

/** Encode a single convoy share as a VFXCNV1 token. */
export function encodeConvoyShare(share: ConvoyShare): string {
  const json = JSON.stringify(share);
  return CONVOY_PREFIX + bufToB64url(new TextEncoder().encode(json));
}

/** Decode a VFXCNV1 token into a share. Throws on malformed input. */
export function decodeConvoyShare(token: string): ConvoyShare {
  const raw = (token ?? "").trim();
  if (!raw.startsWith(CONVOY_PREFIX)) {
    throw new Error(`Not a convoy token (expected ${CONVOY_PREFIX})`);
  }
  let share: ConvoyShare;
  try {
    const json = new TextDecoder().decode(b64urlToBytes(raw.slice(CONVOY_PREFIX.length)));
    share = JSON.parse(json) as ConvoyShare;
  } catch {
    throw new Error("Malformed convoy token");
  }
  if (!share || typeof share !== "object") throw new Error("Convoy token not an object");
  if (typeof share.id !== "string" || !share.id) throw new Error("Convoy token missing id");
  if (!Number.isInteger(share.n) || !Number.isInteger(share.k)) throw new Error("Convoy token bad n/k");
  if (!Number.isInteger(share.x) || share.x < 1) throw new Error("Convoy token bad x");
  if (!Array.isArray(share.y) || share.y.length === 0) throw new Error("Convoy token bad y");
  if (typeof share.ts !== "number") throw new Error("Convoy token bad ts");
  return share;
}

/** Detect whether a string is a convoy share token. */
export function isConvoyToken(token: string): boolean {
  return typeof token === "string" && token.trim().startsWith(CONVOY_PREFIX);
}

/* ═══════════════════════════════════════════════════════════════
   Verification & utilities
   ═══════════════════════════════════════════════════════════════ */

/**
 * Validate that a set of share tokens all belong to the same scheme
 * and that there are enough to reconstruct.
 */
export function verifyShareSet(tokens: string[]): {
  ok: boolean;
  reason?: string;
  id?: string;
  count: number;
  k: number;
  n: number;
} {
  const shares: ConvoyShare[] = [];
  for (const t of tokens) {
    try {
      shares.push(decodeConvoyShare(t));
    } catch {
      return { ok: false, reason: "malformed_token", count: 0, k: 0, n: 0 };
    }
  }
  if (shares.length === 0) return { ok: false, reason: "no_shares", count: 0, k: 0, n: 0 };

  const id = shares[0].id;
  const k = shares[0].k;
  const n = shares[0].n;
  const seenX = new Set<number>();
  for (const s of shares) {
    if (s.id !== id) return { ok: false, reason: "mixed_schemes", count: shares.length, k, n };
    if (s.k !== k || s.n !== n) return { ok: false, reason: "scheme_mismatch", count: shares.length, k, n };
    if (seenX.has(s.x)) return { ok: false, reason: "duplicate_share", count: shares.length, k, n };
    seenX.add(s.x);
  }
  if (shares.length < k) {
    return { ok: false, reason: `need_${k}_have_${shares.length}`, id, count: shares.length, k, n };
  }
  return { ok: true, id, count: shares.length, k, n };
}

/** Human-readable label for a share (e.g. "share 3 of 5 · K=3"). */
export function describeShare(share: ConvoyShare): string {
  return `share ${share.x} of ${share.n} · K=${share.k}${share.iso3 ? ` · ${share.iso3}` : ""}`;
}
