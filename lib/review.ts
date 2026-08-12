/**
 * V FOR X — Blinded Peer Review (The Registry cross-validation)
 *
 * A two-phase commit/reveal protocol for dossier corroboration that
 * works with zero servers and zero trust:
 *
 *   PHASE 1 — COMMIT: the reviewer writes their verdict
 *   (rating 1-5 + corroboration flags) but stores only a
 *   SHA-256 COMMITMENT = H(verdict || nonce). Nothing about the
 *   content is observable; a dossier page can count commitments
 *   without knowing who said what.
 *
 *   PHASE 2 — REVEAL: the reviewer later discloses (verdict, nonce).
 *   Anyone can re-run H(verdict || nonce) and confirm it matches the
 *   earlier commitment — so a reviewer cannot change their verdict
 *   after seeing how others voted (no late-game flip-flopping), and
 *   an impostor cannot forge a review for a commitment they never
 *   made unless they also produced the nonce.
 *
 *   SIGNING: optional ECDSA binding — the reviewer signs the reveal
 *   with their anonymous identity key, proving the review came from
 *   one identity without exposing any personal data.
 *
 * P2P aggregation: reviews travel as compact tokens (VFXRV1:). A
 * dossier page accepts revealed reviews pasted from anywhere,
 * verifies each (commitment match + optional signature), and
 * aggregates only the *verifiable* set. No data ever leaves the
 * device unless the reviewer explicitly exports it.
 */

export const REVIEW_TOKEN_PREFIX = "VFXRV1:";

export type ReviewCorroboration =
  | "verified_evidence"
  | "has_sources"
  | "independent_account"
  | "contradicts_claim"
  | "insufficient";

export interface PeerReview {
  /** Dossier id being reviewed. */
  dossierId: string;
  /** Rating 1..5 (5 = fully corroborated). */
  rating: number;
  /** Corroboration flags (subset of 5 allowed). */
  flags: ReviewCorroboration[];
  /** Freeform note (kept local unless exported). */
  note?: string;
  /** Epoch ms the review was written. */
  ts: number;
}

export interface ReviewCommitment {
  /** Hex SHA-256 of canonical(review || nonce). */
  commit: string;
  /** Base64url random nonce. Withheld until phase 2. */
  nonce: string;
  /** Epoch ms of the commit. */
  ts: number;
}

export interface RevealedReview {
  review: PeerReview;
  /** Nonce that unlocks commit verification. */
  nonce: string;
  /** ECDSA signature (base64url) over canonical(review || nonce) if bound. */
  signature?: string;
  /** Signer public key (base64 SPKI). */
  signerPublicKey?: string;
}

export interface ReviewVerification {
  verified: boolean;
  /** Which check failed, when not verified. */
  reason?: string;
}

export interface AggregateReview {
  /** Verifiable reviews only. */
  count: number;
  /** Reveals that failed verification. */
  rejected: number;
  /** Mean rating over verified reviews (0 if none). */
  meanRating: number;
  /** Distribution of ratings 1..5. */
  ratingHistogram: number[];
  /** Corroboration flag tallies (non-contradictory flags only, deduped per review). */
  flagTallies: Record<ReviewCorroboration, number>;
}

/* ═══════════════════════════════════════════════════════════
   ENCODING HELPERS
   ═══════════════════════════════════════════════════════════ */

const hexFromBuf = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

function bufToB64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
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

/** Copy into an ArrayBuffer-backed view (WebCrypto digest/import requirement). */
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

const FLAGS: ReviewCorroboration[] = [
  "verified_evidence",
  "has_sources",
  "independent_account",
  "contradicts_claim",
  "insufficient",
];

/* ═══════════════════════════════════════════════════════════
   VALIDATION
   ═══════════════════════════════════════════════════════════ */

export function isValidRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

export function isValidFlags(flags: ReviewCorroboration[]): boolean {
  return Array.isArray(flags) && flags.every((f) => FLAGS.includes(f));
}

export function isValidReview(review: PeerReview): boolean {
  return (
    !!review &&
    typeof review.dossierId === "string" &&
    review.dossierId.length > 0 &&
    isValidRating(review.rating) &&
    isValidFlags(review.flags) &&
    typeof review.ts === "number"
  );
}

/* ═══════════════════════════════════════════════════════════
   CANONICAL CONTENT
   ═══════════════════════════════════════════════════════════ */

/** Canonical, deterministic JSON of a review (with or without nonce). */
export function canonicalReview(review: PeerReview, nonce = ""): string {
  return JSON.stringify({
    dossierId: review.dossierId,
    rating: review.rating,
    flags: [...review.flags].sort(),
    note: review.note ?? "",
    ts: review.ts,
    nonce,
  });
}

/* ═══════════════════════════════════════════════════════════
   PHASE 1 — COMMIT
   ═══════════════════════════════════════════════════════════ */

/**
 * Commit to a review without revealing it. Returns the commitment
 * (the nonce must be kept local until phase 2).
 */
export async function createReviewCommitment(
  review: PeerReview,
): Promise<ReviewCommitment> {
  if (!isValidReview(review)) throw new Error("Invalid review");
  if (!hasSubtle()) throw new Error("Web Crypto API unavailable");

  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = bufToB64url(nonceBytes);
  const commit = await sha256Hex(canonicalReview(review, nonce));
  return { commit, nonce, ts: Date.now() };
}

/* ═══════════════════════════════════════════════════════════
   PHASE 2 — REVEAL + VERIFICATION
   ═══════════════════════════════════════════════════════════ */

/**
 * Verify that a revealed review matches a commitment.
 * True only when H(canonical(review || nonce)) === commitment.
 */
export async function verifyReveal(
  commitment: string,
  revealed: RevealedReview,
): Promise<ReviewVerification> {
  if (!commitment || typeof commitment !== "string") {
    return { verified: false, reason: "missing_commitment" };
  }
  if (!revealed || !revealed.review || !isValidReview(revealed.review)) {
    return { verified: false, reason: "invalid_review" };
  }
  if (!revealed.nonce || typeof revealed.nonce !== "string") {
    return { verified: false, reason: "missing_nonce" };
  }
  if (!hasSubtle()) return { verified: false, reason: "no_webcrypto" };

  const recomputed = await sha256Hex(canonicalReview(revealed.review, revealed.nonce));
  if (recomputed !== commitment) {
    return { verified: false, reason: "commitment_mismatch" };
  }

  // Optional ECDSA identity binding.
  if (revealed.signature || revealed.signerPublicKey) {
    if (!revealed.signature || !revealed.signerPublicKey) {
      return { verified: false, reason: "partial_signature" };
    }
    try {
      const pubKey = await crypto.subtle.importKey(
        "spki",
        asBufferSource(b64urlToBytes(revealed.signerPublicKey)),
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"],
      );
      const ok = await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        pubKey,
        asBufferSource(b64urlToBytes(revealed.signature)),
        new TextEncoder().encode(canonicalReview(revealed.review, revealed.nonce)),
      );
      if (!ok) return { verified: false, reason: "sig_mismatch" };
    } catch {
      return { verified: false, reason: "sig_parse_error" };
    }
  }

  return { verified: true };
}

/**
 * Sign a reveal document (review + nonce) with a P-256 keypair.
 * The public key is passed explicitly so identity binding is
 * verifiable without exposing the private key.
 */
export async function signReveal(
  revealed: RevealedReview,
  keyPair: CryptoKeyPair,
): Promise<RevealedReview> {
  if (!hasSubtle()) throw new Error("Web Crypto API unavailable");
  const content = new TextEncoder().encode(canonicalReview(revealed.review, revealed.nonce));
  const pub = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keyPair.privateKey,
    content,
  );
  return {
    ...revealed,
    signature: bufToB64url(sigBuf),
    signerPublicKey: bufToB64url(pub),
  };
}

/* ═══════════════════════════════════════════════════════════
   AGGREGATION
   ═══════════════════════════════════════════════════════════ */

/**
 * Aggregate revealed reviews against a set of known commitments.
 * Only reviews whose reveal verifies count; everything else is
 * tallied as rejected. The `commitments` list is a map keyed by
 * the reviewer's identity (e.g. identity handle) → commitment hex,
 * so each reviewer contributes at most one counted review.
 */
export async function aggregateReviews(
  commitments: Record<string, string>,
  revealed: RevealedReview[],
): Promise<AggregateReview> {
  const histogram = [0, 0, 0, 0, 0];
  const tallies: Record<ReviewCorroboration, number> = {
    verified_evidence: 0,
    has_sources: 0,
    independent_account: 0,
    contradicts_claim: 0,
    insufficient: 0,
  };

  let count = 0;
  let rejected = 0;
  let sum = 0;
  const usedReviewers = new Set<string>();

  for (const r of revealed) {
    // A reveal is only countable when one of the commitments matches.
    let matchedKey: string | null = null;
    for (const [key, commitment] of Object.entries(commitments)) {
      const res = await verifyReveal(commitment, r);
      if (res.verified) {
        matchedKey = key;
        break;
      }
    }
    if (matchedKey === null) {
      rejected++;
      continue;
    }
    if (usedReviewers.has(matchedKey)) continue; // one review per reviewer
    usedReviewers.add(matchedKey);

    count++;
    sum += r.review.rating;
    histogram[r.review.rating - 1]++;
    for (const f of r.review.flags) {
      if (f === "contradicts_claim" || f === "insufficient") continue;
      tallies[f]++;
    }
  }

  return {
    count,
    rejected,
    meanRating: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
    ratingHistogram: histogram,
    flagTallies: tallies,
  };
}

/* ═══════════════════════════════════════════════════════════
   TOKEN ENCODING (export/import)
   ═══════════════════════════════════════════════════════════ */

/** Encode a revealed review as a compact shareable token. */
export function encodeReviewToken(revealed: RevealedReview): string {
  return REVIEW_TOKEN_PREFIX + bufToB64url(new TextEncoder().encode(JSON.stringify(revealed)));
}

/** Decode a review token. Throws on malformed input. */
export function decodeReviewToken(token: string): RevealedReview {
  const raw = (token ?? "").trim();
  if (!raw.startsWith(REVIEW_TOKEN_PREFIX)) {
    throw new Error("Not a review token");
  }
  let json: string;
  try {
    json = new TextDecoder().decode(b64urlToBytes(raw.slice(REVIEW_TOKEN_PREFIX.length)));
  } catch {
    throw new Error("Corrupt review token (bad base64)");
  }
  let revealed: RevealedReview;
  try {
    revealed = JSON.parse(json) as RevealedReview;
  } catch {
    throw new Error("Corrupt review token (bad JSON)");
  }
  if (!revealed || !revealed.review || !revealed.nonce) {
    throw new Error("Review token missing required fields");
  }
  if (!isValidReview(revealed.review)) {
    throw new Error("Review token carries an invalid review");
  }
  return revealed;
}

/* ═══════════════════════════════════════════════════════════
   LOCAL STORAGE (client-side only, per dossier)
   ═══════════════════════════════════════════════════════════ */

const STORE_PREFIX = "vfx-reviews:";

/** Load revealed reviews for a dossier from localStorage. */
export function loadLocalReviews(dossierId: string): RevealedReview[] {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + dossierId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RevealedReview[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist revealed reviews for a dossier. */
export function saveLocalReviews(dossierId: string, reviews: RevealedReview[]): void {
  try {
    localStorage.setItem(STORE_PREFIX + dossierId, JSON.stringify(reviews));
  } catch { /* ignore */ }
}

/** Load the pending (unrevealed) nonce for a dossier, if any. */
export function loadLocalNonce(dossierId: string): string | null {
  try {
    return localStorage.getItem(STORE_PREFIX + dossierId + ":nonce");
  } catch {
    return null;
  }
}

export function saveLocalNonce(dossierId: string, nonce: string | null): void {
  try {
    if (nonce === null) localStorage.removeItem(STORE_PREFIX + dossierId + ":nonce");
    else localStorage.setItem(STORE_PREFIX + dossierId + ":nonce", nonce);
  } catch { /* ignore */ }
}

/**
 * Sign a review reveal using the unified identity.
 *
 * This function uses the persistent unified identity from lib/identity.ts
 * instead of generating ephemeral keypairs. This provides better continuity
 * and allows reviewers to maintain their identity across sessions.
 */
export async function signRevealWithIdentity(
  revealed: RevealedReview,
): Promise<RevealedReview> {
  const { ensureIdentity, signReviewRevealWithIdentity } = await import("./identity");
  const identity = await ensureIdentity();
  return await signReviewRevealWithIdentity(identity, revealed);
}

/* ═══════════════════════════════════════════════════════════════
   Reputation decay (Phase 13)
   ═══════════════════════════════════════════════════════════════ */

const DAY_MS = 86_400_000;

/**
 * Half-life for review reputation decay, in days. A review's weight
 * halves every this many days, so recent corroboration matters more
 * than stale votes while never discarding old evidence outright.
 */
export const REVIEW_DECAY_HALF_LIFE_DAYS = 180;

/**
 * Exponential decay weight for a review, based on its age.
 * Returns 0 < weight ≤ 1: a review from today weighs 1.0, one from
 * `halfLifeDays` ago weighs 0.5, and so on. Reviews older than
 * ~10 half-lives are effectively zero but never exactly zero.
 *
 * @param ts        the review's timestamp (epoch ms)
 * @param now       reference time (default Date.now())
 * @param halfLifeDays  half-life in days (default REVIEW_DECAY_HALF_LIFE_DAYS)
 */
export function reviewDecayWeight(
  ts: number,
  now = Date.now(),
  halfLifeDays = REVIEW_DECAY_HALF_LIFE_DAYS,
): number {
  if (!Number.isFinite(ts) || !Number.isFinite(now)) return 0;
  const ageDays = Math.max(0, (now - ts) / DAY_MS);
  if (halfLifeDays <= 0) return 1;
  return Math.pow(0.5, ageDays / halfLifeDays);
}

export interface WeightedAggregateReview {
  /** Verifiable reviews (same as AggregateReview.count). */
  count: number;
  rejected: number;
  /** Time-weighted mean rating (recent reviews count more). */
  weightedMeanRating: number;
  /** Unweighted mean rating (for comparison). */
  meanRating: number;
  /** Time-weighted corroboration flag tallies. */
  flagTallies: Record<ReviewCorroboration, number>;
  /** Sum of weights (effective sample size). */
  effectiveN: number;
  /** The single highest-weight review (most influential). */
  mostInfluential: { rating: number; weight: number; ts: number } | null;
}

/**
 * Aggregate revealed reviews with exponential time-decay weighting.
 *
 * Recent corroboration matters more than stale votes: each verified
 * review contributes `weight = 0.5^(age / halfLife)` to the weighted
 * mean, so a dossier propped up by old reviews drifts downward as new
 * evidence fails to arrive. Falls back to the unweighted mean when no
 * decay is requested (halfLifeDays = Infinity).
 *
 * @param commitments reviewer→commitment map (as in aggregateReviews)
 * @param revealed    the revealed reviews to aggregate
 * @param now         reference time (default Date.now())
 * @param halfLifeDays half-life for decay (default 180 days)
 */
export async function weightedAggregateReviews(
  commitments: Record<string, string>,
  revealed: RevealedReview[],
  now = Date.now(),
  halfLifeDays = REVIEW_DECAY_HALF_LIFE_DAYS,
): Promise<WeightedAggregateReview> {
  const flagTallies: Record<ReviewCorroboration, number> = {
    verified_evidence: 0,
    has_sources: 0,
    independent_account: 0,
    contradicts_claim: 0,
    insufficient: 0,
  };

  let count = 0;
  let rejected = 0;
  let weightedSum = 0;
  let unweightedSum = 0;
  let weightSum = 0;
  const usedReviewers = new Set<string>();
  let mostInfluential: { rating: number; weight: number; ts: number } | null = null;

  for (const r of revealed) {
    let matchedKey: string | null = null;
    for (const [key, commitment] of Object.entries(commitments)) {
      const res = await verifyReveal(commitment, r);
      if (res.verified) {
        matchedKey = key;
        break;
      }
    }
    if (matchedKey === null) {
      rejected++;
      continue;
    }
    if (usedReviewers.has(matchedKey)) continue;
    usedReviewers.add(matchedKey);

    const weight = reviewDecayWeight(r.review.ts, now, halfLifeDays);
    count++;
    weightedSum += r.review.rating * weight;
    unweightedSum += r.review.rating;
    weightSum += weight;

    for (const f of r.review.flags) {
      if (f === "contradicts_claim" || f === "insufficient") continue;
      flagTallies[f] += weight;
    }

    if (!mostInfluential || weight > mostInfluential.weight) {
      mostInfluential = { rating: r.review.rating, weight, ts: r.review.ts };
    }
  }

  return {
    count,
    rejected,
    weightedMeanRating: weightSum > 0 ? Math.round((weightedSum / weightSum) * 100) / 100 : 0,
    meanRating: count > 0 ? Math.round((unweightedSum / count) * 100) / 100 : 0,
    flagTallies,
    effectiveN: Math.round(weightSum * 100) / 100,
    mostInfluential,
  };
}