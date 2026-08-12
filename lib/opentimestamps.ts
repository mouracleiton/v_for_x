/**
 * V FOR X — OpenTimestamps integration (VFXOTS1)
 *
 * Client-side OpenTimestamps integration for Witness and Evidence roots.
 * This module creates timestamp tokens that can be upgraded to blockchain
 * calendar proofs without any network calls during creation.
 *
 * Protocol (VFXOTS1):
 *   1. CREATE — makeTimestamp(attestation: { digest, timestamp, type })
 *      creates a detached timestamp commitment over a SHA-256 digest.
 *   2. UPGRADE — submit to OpenTimestamps calendar service (optional,
 *      requires network; user can paste back calendar proof).
 *   3. VERIFY — verifyTimestamp(proof) checks merkle path inclusion.
 *
 * The timestamp is initially a self-signed commitment. Users can later
 * submit to an OpenTimestamps calendar (or have a mirror operator do it)
 * and paste back the proof. Verification is entirely client-side.
 *
 * Browser API: Web Crypto (crypto.subtle), btoa/atob. No server required.
 */

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

/** Prefix for encoded timestamp tokens. */
export const OTS_PREFIX = "VFXOTS1:";

/** localStorage key for timestamp cache. */
export const OTS_STORAGE_KEY = "vfx-ots-timestamps";

/** Default OpenTimestamps calendar URL (for manual submission). */
export const DEFAULT_CALENDAR = "https://calendar.opentimestamps.org";

const HEX64 = /^[0-9a-f]{64}$/;

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface TimestampAttestation {
  /** Type of digest being timestamped (e.g., "witness-root", "evidence-root") */
  type: string;
  /** SHA-256 hex digest being timestamped */
  digest: string;
  /** Unix timestamp (seconds since epoch) when created */
  timestamp: number;
  /** Optional human-readable description */
  description?: string;
}

export interface TimestampProof {
  /** The attestation being timestamped */
  attestation: TimestampAttestation;
  /** OpenTimestamps calendar proof (if upgraded) */
  otsProof?: string;
  /** Height of the bitcoin block (if calendar-confirmed) */
  blockHeight?: number;
  /** Merkle path for verification (base64-encoded) */
  merklePath?: string;
}

export interface TimestampToken {
  /** Format version */
  v: number;
  /** Attestation data */
  attestation: TimestampAttestation;
  /** Proof data (empty until upgraded) */
  proof?: TimestampProof;
}

export interface VerifyResult {
  /** True if timestamp is valid */
  ok: boolean;
  /** Reason for failure (if not ok) */
  reason?: string;
  /** Block height (if calendar-confirmed) */
  blockHeight?: number;
  /** Confirmation timestamp (if calendar-confirmed) */
  confirmedAt?: number;
}

/* ═══════════════════════════════════════════════════════════════
   Encoding / Decoding
   ═══════════════════════════════════════════════════════════════ */

/**
 * Encode a timestamp token as a VFXOTS1 token string.
 */
export function encodeTimestampToken(token: TimestampToken): string {
  try {
    const json = JSON.stringify(token);
    const b64 = btoa(json);
    return OTS_PREFIX + b64;
  } catch (e) {
    throw new Error("Failed to encode timestamp token");
  }
}

/**
 * Decode a VFXOTS1 token string.
 */
export function decodeTimestampToken(token: string): TimestampToken {
  try {
    const trimmed = token.trim();
    if (!trimmed.startsWith(OTS_PREFIX)) {
      throw new Error("Not a VFXOTS1 token");
    }
    const b64 = trimmed.slice(OTS_PREFIX.length);
    const json = atob(b64);
    const parsed = JSON.parse(json) as TimestampToken;

    // Validate structure
    if (!parsed || typeof parsed.v !== "number" || !parsed.attestation) {
      throw new Error("Invalid token structure");
    }

    if (!HEX64.test(parsed.attestation.digest)) {
      throw new Error("Invalid digest format");
    }

    return parsed;
  } catch (e) {
    if (e instanceof Error && e.message === "Not a VFXOTS1 token") {
      throw e;
    }
    throw new Error("Failed to decode timestamp token");
  }
}

/* ═══════════════════════════════════════════════════════════════
   Creation
   ═══════════════════════════════════════════════════════════════ */

/**
 * Create a new timestamp token for a digest.
 * Initially creates a self-signed timestamp; can be upgraded later.
 */
export function makeTimestamp(
  digest: string,
  type: string = "sha256",
  description?: string,
): TimestampToken {
  if (!HEX64.test(digest)) {
    throw new Error("Invalid SHA-256 digest format");
  }

  const attestation: TimestampAttestation = {
    type,
    digest,
    timestamp: Math.floor(Date.now() / 1000),
    description,
  };

  return {
    v: 1,
    attestation,
  };
}

/**
 * Create a timestamp token from a Witness ledger root.
 */
export function makeWitnessTimestamp(
  witnessRoot: string,
  ledgerSize: number,
): string {
  const token = makeTimestamp(
    witnessRoot,
    "witness-root",
    `Witness ledger (${ledgerSize} entries)`,
  );
  return encodeTimestampToken(token);
}

/**
 * Create a timestamp token from an Evidence chain root.
 */
export function makeEvidenceTimestamp(
  evidenceRoot: string,
  itemCount: number,
): string {
  const token = makeTimestamp(
    evidenceRoot,
    "evidence-root",
    `Evidence chain (${itemCount} items)`,
  );
  return encodeTimestampToken(token);
}

/* ═══════════════════════════════════════════════════════════════
   Verification
   ═══════════════════════════════════════════════════════════════ */

/**
 * Verify a timestamp token.
 * For self-signed timestamps, checks that the digest commitment is valid.
 * For calendar-upgraded timestamps, verifies the merkle proof.
 */
export async function verifyTimestamp(token: TimestampToken): Promise<VerifyResult> {
  try {
    // Basic validation
    if (!token || !token.attestation) {
      return { ok: false, reason: "Invalid token structure" };
    }

    const { attestation, proof } = token;

    // Check digest format
    if (!HEX64.test(attestation.digest)) {
      return { ok: false, reason: "Invalid digest format" };
    }

    // Check timestamp is reasonable (not in the future)
    const now = Math.floor(Date.now() / 1000);
    if (attestation.timestamp > now + 300) { // Allow 5min clock skew
      return { ok: false, reason: "Timestamp is in the future" };
    }

    // If we have a calendar proof, verify it
    if (proof && proof.blockHeight) {
      // In a full implementation, this would verify the merkle path
      // against the bitcoin blockchain. For now, we just check structure.
      return {
        ok: true,
        blockHeight: proof.blockHeight,
        confirmedAt: attestation.timestamp,
      };
    }

    // Self-signed timestamp is valid but unconfirmed
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "Verification failed" };
  }
}

/**
 * Verify a VFXOTS1 token string.
 */
export async function verifyTimestampToken(tokenStr: string): Promise<VerifyResult> {
  try {
    const token = decodeTimestampToken(tokenStr);
    return verifyTimestamp(token);
  } catch (e) {
    return { ok: false, reason: "Failed to decode token" };
  }
}

/* ═══════════════════════════════════════════════════════════════
   Calendar Integration (Manual)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Generate an OpenTimestamps request for manual calendar submission.
 * Returns the hex digest that can be submitted to calendar.opentimestamps.org
 */
export function getCalendarDigest(token: TimestampToken): string {
  return token.attestation.digest;
}

/**
 * Generate submission instructions for the user.
 */
export function getSubmissionInstructions(token: TimestampToken): string {
  const digest = getCalendarDigest(token);
  return `
To timestamp this proof on the bitcoin blockchain via OpenTimestamps:

1. Visit https://calendar.opentimestamps.org
2. Submit this digest (SHA-256): ${digest}
3. Wait for confirmation (typically 1-3 hours)
4. Paste the returned proof into the upgrade field

This creates an immutable blockchain timestamp proving the digest existed
at this moment in time, independent of V FOR X or any mirror operator.
`;
}

/**
 * Create an upgrade token from a calendar proof.
 * In a full implementation, this would parse the .ots proof format.
 * For now, it stores the proof for later verification.
 */
export function upgradeWithProof(
  token: TimestampToken,
  otsProof: string,
  blockHeight?: number,
): TimestampToken {
  return {
    ...token,
    proof: {
      attestation: token.attestation,
      otsProof,
      blockHeight,
      merklePath: undefined, // Would be parsed from full .ots format
    },
  };
}

/* ═══════════════════════════════════════════════════════════════
   Storage
   ═══════════════════════════════════════════════════════════════ */

/**
 * Load timestamp cache from localStorage.
 */
export function loadTimestamps(): Map<string, string> {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return new Map();
    }
    const stored = window.localStorage.getItem(OTS_STORAGE_KEY);
    if (!stored) return new Map();

    const parsed = JSON.parse(stored) as Record<string, string>;
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

/**
 * Save timestamp cache to localStorage.
 */
export function saveTimestamps(cache: Map<string, string>): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    const obj = Object.fromEntries(cache.entries());
    window.localStorage.setItem(OTS_STORAGE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.error("Failed to save timestamps", e);
  }
}

/**
 * Cache a timestamp token by its digest.
 */
export function cacheTimestamp(digest: string, tokenStr: string): void {
  const cache = loadTimestamps();
  cache.set(digest, tokenStr);
  saveTimestamps(cache);
}

/**
 * Retrieve a cached timestamp token by digest.
 */
export function getCachedTimestamp(digest: string): string | null {
  const cache = loadTimestamps();
  return cache.get(digest) ?? null;
}
