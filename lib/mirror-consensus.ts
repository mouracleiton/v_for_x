/**
 * V FOR X — Mirror Consensus (root hash fork detection)
 *
 * Detects when different mirrors have different root hashes, indicating
 * potential censorship, data manipulation, or network partition. Mirrors
 * share their ring fingerprint root (from lib/mirror-ring.ts) as signed
 * attestations; this library collects and compares them to find forks.
 *
 * The consensus model:
 *   - Each mirror computes a SHA-256 root over its verified ring
 *   - Mirrors share signed root attestations (VFXCON1 tokens)
 *   - Collect attestations from multiple sources
 *   - Detect forks: divergent roots indicate tampering or partition
 *   - Track which mirrors agree vs disagree
 *   - Provide consensus metrics and alerts
 *
 * Fully static, no backend, local verification only.
 */

/* ═══════════════════════════════════════════════════════════════
   ENCODING HELPERS
   ═══════════════════════════════════════════════════════════════ */

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
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

/** Version of the consensus protocol. */
export const CONSENSUS_VERSION = "1.0.0";

/** Prefix for consensus root attestations. */
export const CONSENSUS_TOKEN_PREFIX = "VFXCON1:";

/** A signed root hash attestation from a mirror. */
export interface ConsensusAttestation {
  /** Unique attestation id (uuid). */
  id: string;
  /** Mirror endpoint that generated this attestation. */
  mirrorEndpoint: string;
  /** Transport type (clearnet, onion, ipfs, mesh, usb). */
  transport: "clearnet" | "onion" | "ipfs" | "mesh" | "usb";
  /** The root hash this mirror observes (64-char SHA-256 hex). */
  rootHash: string;
  /** Number of mirrors in this ring (for context). */
  ringSize: number;
  /** Number of verified mirrors in this ring. */
  verifiedCount: number;
  /** Timestamp when this attestation was created. */
  ts: number;
  /** CONSENSUS_VERSION at signing time. */
  version: string;
  /** Signer public key (base64 SPKI). */
  signerPublicKey: string;
  /** ECDSA signature over the canonical content (base64). */
  signature: string;
  /** SHA-256 hex of the canonical content that was signed. */
  contentHash: string;
}

/** A group of mirrors that agree on the same root hash. */
export interface ConsensusGroup {
  /** The shared root hash. */
  rootHash: string;
  /** Number of mirrors in this group. */
  count: number;
  /** Mirrors in this group. */
  mirrors: string[];
  /** Sample attestations from this group. */
  attestations: ConsensusAttestation[];
}

/** Consensus analysis result. */
export interface ConsensusAnalysis {
  /** Total number of attestations analyzed. */
  totalAttestations: number;
  /** Number of unique root hashes found (forks if >1). */
  uniqueRoots: number;
  /** Whether there is a fork (multiple root hashes). */
  hasFork: boolean;
  /** Groups of mirrors by root hash. */
  groups: ConsensusGroup[];
  /** The largest consensus group (most mirrors agree). */
  majorityGroup: ConsensusGroup | null;
  /** Percentage of mirrors in the majority group. */
  majorityPercentage: number;
  /** Timestamp of the analysis. */
  analyzedAt: number;
}

/** Fork detail for UI display. */
export interface ForkDetail {
  /** The conflicting root hash. */
  rootHash: string;
  /** Short display fingerprint (12 chars). */
  shortFingerprint: string;
  /** Number of mirrors reporting this root. */
  mirrorCount: number;
  /** Percentage of total attestations. */
  percentage: number;
  /** Mirror endpoints in this fork. */
  mirrors: string[];
  /** Whether this is the majority fork. */
  isMajority: boolean;
  /** Sample attestations from this fork. */
  attestations: ConsensusAttestation[];
}

/** Short fingerprint (12 hex chars) for display. */
export function shortRootFingerprint(rootHash: string): string {
  return (rootHash ?? "").slice(0, 12);
}

/* ═══════════════════════════════════════════════════════════
   ATTESTATION CREATION & SIGNING
   ═══════════════════════════════════════════════════════════ */

/**
 * The deterministic JSON that gets hashed and signed.
 * MUST stay in sync with verification logic.
 */
function canonicalAttestationContent(att: {
  id: string;
  mirrorEndpoint: string;
  transport: string;
  rootHash: string;
  ringSize: number;
  verifiedCount: number;
  ts: number;
  version: string;
}): string {
  return JSON.stringify({
    id: att.id,
    mirrorEndpoint: att.mirrorEndpoint,
    transport: att.transport,
    rootHash: att.rootHash,
    ringSize: att.ringSize,
    verifiedCount: att.verifiedCount,
    ts: att.ts,
    version: att.version,
  });
}

/** Inputs needed to create a consensus attestation. */
export interface CreateAttestationInput {
  /** Mirror endpoint (URL, .onion, etc.). */
  mirrorEndpoint: string;
  /** Transport type. */
  transport: "clearnet" | "onion" | "ipfs" | "mesh" | "usb";
  /** The root hash this mirror observes. */
  rootHash: string;
  /** Number of mirrors in the ring. */
  ringSize: number;
  /** Number of verified mirrors in the ring. */
  verifiedCount: number;
}

/**
 * Create and sign a consensus attestation.
 * Uses the same ECDSA P-256 pattern as mirror claims.
 */
export async function createConsensusAttestation(
  signerPublicKey: string,
  privateKeyBase64: string,
  input: CreateAttestationInput,
): Promise<ConsensusAttestation> {
  if (!hasSubtle()) {
    throw new Error("Web Crypto API unavailable");
  }

  const endpoint = input.mirrorEndpoint.trim();
  if (endpoint.length < 3) {
    throw new Error("Mirror endpoint must be at least 3 characters");
  }

  if (!/^[a-f0-9]{64}$/.test(input.rootHash)) {
    throw new Error("Root hash must be a 64-char SHA-256 hex string");
  }

  if (input.ringSize < 0 || input.verifiedCount < 0) {
    throw new Error("Ring counts must be non-negative");
  }

  if (input.verifiedCount > input.ringSize) {
    throw new Error("Verified count cannot exceed ring size");
  }

  const ts = Date.now();
  const id =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `con-${ts}-${Math.random().toString(36).slice(2, 10)}`;

  const partial = {
    id,
    mirrorEndpoint: endpoint,
    transport: input.transport,
    rootHash: input.rootHash,
    ringSize: input.ringSize,
    verifiedCount: input.verifiedCount,
    ts,
    version: CONSENSUS_VERSION,
  };

  const content = canonicalAttestationContent(partial);
  const contentBytes = new TextEncoder().encode(content);
  const contentHash = hexFromBuf(
    await crypto.subtle.digest("SHA-256", contentBytes),
  );

  const privKey = await crypto.subtle.importKey(
    "pkcs8",
    b64ToBytes(privateKeyBase64),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privKey,
    contentBytes,
  );

  return {
    ...partial,
    signerPublicKey,
    signature: bufToB64(sigBuf),
    contentHash,
  };
}

/**
 * Verify a consensus attestation's ECDSA signature.
 * Returns false on any malformed input (never throws).
 */
export async function verifyConsensusAttestation(
  att: ConsensusAttestation,
): Promise<boolean> {
  if (!hasSubtle()) return false;
  if (!att || typeof att !== "object") return false;

  const validTransports = ["clearnet", "onion", "ipfs", "mesh", "usb"];
  if (!validTransports.includes(att.transport)) return false;
  if (!att.signature || !att.signerPublicKey || !att.contentHash) return false;
  if (!/^[a-f0-9]{64}$/.test(att.rootHash)) return false;

  try {
    const pubKey = await crypto.subtle.importKey(
      "spki",
      b64ToBytes(att.signerPublicKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );

    const content = canonicalAttestationContent(att);
    const contentBytes = new TextEncoder().encode(content);

    const recomputed = hexFromBuf(
      await crypto.subtle.digest("SHA-256", contentBytes),
    );
    if (recomputed !== att.contentHash) return false;

    return crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pubKey,
      b64ToBytes(att.signature),
      contentBytes,
    );
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════
   TOKEN ENCODING/DECODING
   ═══════════════════════════════════════════════════════════ */

/**
 * Encode a consensus attestation as a compact, shareable base64 token.
 */
export function encodeConsensusAttestation(att: ConsensusAttestation): string {
  const json = JSON.stringify(att);
  return CONSENSUS_TOKEN_PREFIX + bufToB64(new TextEncoder().encode(json));
}

/**
 * Decode a consensus attestation token.
 * Throws on malformed input; does NOT verify the signature.
 */
export function decodeConsensusAttestation(token: string): ConsensusAttestation {
  const raw = (token ?? "").trim();
  if (!raw.startsWith(CONSENSUS_TOKEN_PREFIX)) {
    throw new Error("Not a consensus attestation token");
  }
  const b64 = raw.slice(CONSENSUS_TOKEN_PREFIX.length);
  let json: string;
  try {
    json = new TextDecoder().decode(b64ToBytes(b64));
  } catch {
    throw new Error("Corrupt token (bad base64)");
  }
  let att: ConsensusAttestation;
  try {
    att = JSON.parse(json);
  } catch {
    throw new Error("Corrupt token (bad JSON)");
  }
  if (!att || typeof att !== "object") throw new Error("Corrupt token");
  if (!att.id || !att.rootHash || !att.signature) {
    throw new Error("Token is missing required fields");
  }
  return att;
}

/* ═══════════════════════════════════════════════════════════
   CONSENSUS ANALYSIS
   ═══════════════════════════════════════════════════════════ */

/**
 * Analyze a set of attestations to detect forks and consensus.
 * Returns detailed analysis of which mirrors agree vs disagree.
 */
export async function analyzeConsensus(
  attestations: ConsensusAttestation[],
): Promise<ConsensusAnalysis> {
  const validAttestations = (
    await Promise.all(
      attestations.map(async (att) => ({
        attestation: att,
        valid: await verifyConsensusAttestation(att),
      })),
    )
  )
    .filter((result) => result.valid)
    .map((result) => result.attestation);

  // Group by root hash
  const byRoot = new Map<string, ConsensusAttestation[]>();
  for (const att of validAttestations) {
    if (!byRoot.has(att.rootHash)) {
      byRoot.set(att.rootHash, []);
    }
    byRoot.get(att.rootHash)!.push(att);
  }

  // Build consensus groups
  const groups: ConsensusGroup[] = Array.from(byRoot.entries()).map(
    ([rootHash, attestations]) => ({
      rootHash,
      count: attestations.length,
      mirrors: attestations.map((a) => a.mirrorEndpoint),
      attestations,
    }),
  );

  // Sort groups by size (largest first)
  groups.sort((a, b) => b.count - a.count);

  const totalGroups = groups.length;
  const majorityGroup = groups.length > 0 ? groups[0] : null;
  const majorityPercentage =
    totalGroups > 0 ? (majorityGroup!.count / validAttestations.length) * 100 : 0;

  return {
    totalAttestations: attestations.length,
    uniqueRoots: byRoot.size,
    hasFork: byRoot.size > 1,
    groups,
    majorityGroup,
    majorityPercentage,
    analyzedAt: Date.now(),
  };
}

/**
 * Build fork details for UI display.
 * Returns an array of forks sorted by size (largest first).
 */
export function buildForkDetails(analysis: ConsensusAnalysis): ForkDetail[] {
  if (!analysis.hasFork || analysis.groups.length === 0) {
    return [];
  }

  return analysis.groups.map((group) => ({
    rootHash: group.rootHash,
    shortFingerprint: shortRootFingerprint(group.rootHash),
    mirrorCount: group.count,
    percentage: analysis.totalAttestations > 0
      ? (group.count / analysis.totalAttestations) * 100
      : 0,
    mirrors: group.mirrors,
    isMajority: analysis.majorityGroup?.rootHash === group.rootHash,
    attestations: group.attestations,
  }));
}

/**
 * Check if a set of attestations indicates a potential attack.
 * Returns alert level and reason.
 */
export interface ForkAlert {
  level: "none" | "low" | "medium" | "high" | "severe";
  reason: string;
  confidence: number;
}

export function assessForkSeverity(analysis: ConsensusAnalysis): ForkAlert {
  if (!analysis.hasFork) {
    return { level: "none", reason: "All mirrors agree on root hash", confidence: 1.0 };
  }

  const forkCount = analysis.uniqueRoots;
  const majorityPct = analysis.majorityPercentage;

  // Severe: Many forks, no clear majority
  if (forkCount >= 4 || majorityPct < 40) {
    return {
      level: "severe",
      reason: `${forkCount} conflicting root hashes detected with ${majorityPct.toFixed(1)}% majority - possible network partition or coordinated attack`,
      confidence: 0.9,
    };
  }

  // High: Multiple forks, weak majority
  if (forkCount >= 3 || majorityPct < 60) {
    return {
      level: "high",
      reason: `${forkCount} conflicting root hashes detected with ${majorityPct.toFixed(1)}% majority - potential data tampering or censorship`,
      confidence: 0.75,
    };
  }

  // Medium: Clear fork present
  if (forkCount === 2 && majorityPct < 80) {
    return {
      level: "medium",
      reason: `Binary fork detected with ${majorityPct.toFixed(1)}% majority - investigate mirror integrity`,
      confidence: 0.6,
    };
  }

  // Low: Minor fork, strong majority
  return {
    level: "low",
    reason: `Minor fork with ${majorityPct.toFixed(1)}% consensus - likely stale mirror`,
    confidence: 0.5,
  };
}

/**
 * Create a consensus report for sharing (JSON string).
 */
export interface ConsensusReport {
  analysis: ConsensusAnalysis;
  forks: ForkDetail[];
  alert: ForkAlert;
  generatedAt: number;
}

export async function generateConsensusReport(
  attestations: ConsensusAttestation[],
): Promise<string> {
  const analysis = await analyzeConsensus(attestations);
  const forks = buildForkDetails(analysis);
  const alert = assessForkSeverity(analysis);

  const report: ConsensusReport = {
    analysis,
    forks,
    alert,
    generatedAt: Date.now(),
  };

  return JSON.stringify(report, null, 2);
}

/**
 * Parse a consensus report from JSON.
 */
export function parseConsensusReport(json: string): ConsensusReport {
  const report = JSON.parse(json) as ConsensusReport;
  if (!report.analysis || !report.forks || !report.alert) {
    throw new Error("Invalid consensus report format");
  }
  return report;
}

/**
 * Import attestations from various sources (tokens, reports, etc.).
 */
export async function importAttestations(
  inputs: string[],
): Promise<ConsensusAttestation[]> {
  const attestations: ConsensusAttestation[] = [];

  for (const input of inputs) {
    const trimmed = input.trim();

    try {
      // Try as consensus attestation token
      if (trimmed.startsWith(CONSENSUS_TOKEN_PREFIX)) {
        const att = decodeConsensusAttestation(trimmed);
        if (await verifyConsensusAttestation(att)) {
          attestations.push(att);
        }
        continue;
      }

      // Try as consensus report (extract attestations)
      if (trimmed.startsWith("{")) {
        try {
          const report = parseConsensusReport(trimmed);
          // Extract attestations from the report groups
          for (const group of report.analysis.groups) {
            for (const att of group.attestations) {
              if (await verifyConsensusAttestation(att)) {
                attestations.push(att);
              }
            }
          }
        } catch {
          // Not a valid report, skip
        }
      }
    } catch {
      // Skip invalid inputs
    }
  }

  return attestations;
}

/**
 * Export attestations as shareable tokens.
 */
export function exportAttestationsAsTokens(
  attestations: ConsensusAttestation[],
): string[] {
  return attestations.map(encodeConsensusAttestation);
}

/**
 * Deduplicate attestations by ID, keeping the newest.
 */
export function deduplicateAttestations(
  attestations: ConsensusAttestation[],
): ConsensusAttestation[] {
  const byId = new Map<string, ConsensusAttestation>();

  for (const att of attestations) {
    const existing = byId.get(att.id);
    if (!existing || att.ts > existing.ts) {
      byId.set(att.id, att);
    }
  }

  return Array.from(byId.values());
}

/**
 * Filter attestations by age (keep only recent ones).
 */
export function filterRecentAttestations(
  attestations: ConsensusAttestation[],
  maxAgeMs: number = 24 * 60 * 60 * 1000, // 24 hours default
): ConsensusAttestation[] {
  const cutoff = Date.now() - maxAgeMs;
  return attestations.filter((att) => att.ts >= cutoff);
}

/**
 * Get statistics about a set of attestations.
 */
export interface AttestationStats {
  total: number;
  verified: number;
  byTransport: Record<string, number>;
  ageStats: {
    newest: number;
    oldest: number;
    averageAge: number;
  };
}

export async function getAttestationStats(
  attestations: ConsensusAttestation[],
): Promise<AttestationStats> {
  const byTransport: Record<string, number> = {};
  let newest = 0;
  let oldest = Infinity;
  let totalAge = 0;
  let verified = 0;

  for (const att of attestations) {
    // Transport stats
    byTransport[att.transport] = (byTransport[att.transport] || 0) + 1;

    // Age stats
    if (att.ts > newest) newest = att.ts;
    if (att.ts < oldest) oldest = att.ts;
    totalAge += Date.now() - att.ts;

    // Verification
    if (await verifyConsensusAttestation(att)) {
      verified++;
    }
  }

  return {
    total: attestations.length,
    verified,
    byTransport,
    ageStats: {
      newest,
      oldest: oldest === Infinity ? 0 : oldest,
      averageAge: attestations.length > 0 ? totalAge / attestations.length : 0,
    },
  };
}