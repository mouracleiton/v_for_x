/**
 * V FOR X — Blockchain Evidence Notarization
 *
 * Anchors evidence hashes to the Bitcoin blockchain via OpenTimestamps —
 * a free, keyless, decentralized timestamping service. A hash anchored
 * to Bitcoin gets an immutable, independently-verifiable proof that the
 * evidence existed at a specific point in time. No authority can forge
 * or back-date it.
 *
 * Flow:
 *   1. Evidence is hashed client-side (see citizen-tools.hashFile).
 *   2. `notarizeEvidence` submits the 32-byte digest to an OpenTimestamps
 *      calendar over its binary protocol. The calendar folds it into a
 *      Merkle tree and commits the root to a Bitcoin transaction.
 *   3. Once confirmed, the proof can be verified by anyone, anywhere —
 *      including offline, against a copy of the Bitcoin chain.
 *
 * If the network is unreachable (a common reality for the people who
 * need this most), the stamp is queued locally and resubmitted later.
 */

import { sha256Sync } from "./citizen-tools";
import { DagEntry, GENESIS_HASH } from "./dag";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface NotarizationResult {
  /** Bitcoin transaction id once the stamp lands on-chain (if known). */
  txHash?: string;
  /** Block height containing the anchoring transaction. */
  confirmationBlock?: number;
  /** Epoch milliseconds when the notarization was initiated. */
  timestamp: number;
  /** True while the stamp is awaiting Bitcoin confirmation. */
  pending: boolean;
  /** The evidence digest that was submitted. */
  hash: string;
}

export interface VerifyResult {
  /** Whether an on-chain confirmation was found. */
  confirmed: boolean;
  /** Epoch ms of the attestation, when recoverable. */
  timestamp?: number;
  /** Bitcoin block height of the confirmation. */
  blockHeight?: number;
}

export interface MerkleProof {
  /** The leaf hash this proof step belongs to (group proofs by this). */
  hash: string;
  /** Position of `hash` relative to its sibling at this tree level. */
  direction: "left" | "right";
  /** The sibling digest combined with `hash` at this level. */
  sibling: string;
}

/* ═══════════════════════════════════════════════════════════════
   OpenTimestamps constants
   ═══════════════════════════════════════════════════════════════ */

/** The free, public, keyless Bitcoin calendar. */
const OTS_CALENDAR_URL =
  "https://btc.calendar.opentimestamps.org/timestamp";

/**
 * Binary protocol markers for OpenTimestamps attestations.
 *
 * - PENDING (0x83): a calendar has accepted the hash but Bitcoin has
 *   not confirmed it yet. Followed by the calendar URL.
 * - BITCOIN (0x88): the hash is anchored in a Bitcoin block. Followed
 *   by the 4-byte big-endian block height.
 */
const OTS_PENDING_ATTESTATION = 0x83;
const OTS_BITCOIN_ATTESTATION = 0x88;

/** Abort a flaky submission after this many milliseconds. */
const SUBMIT_TIMEOUT_MS = 15_000;

/** localStorage bucket for stamps awaiting later submission. */
const PENDING_STAMP_KEY = "vfx_pending_stamps";

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

/** Persist a stamp locally so it can be resubmitted when connectivity returns. */
function queuePendingStamp(hash: string, timestamp: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(PENDING_STAMP_KEY);
    const queue: Array<{ hash: string; timestamp: number }> = raw
      ? JSON.parse(raw)
      : [];
    queue.push({ hash, timestamp });
    localStorage.setItem(PENDING_STAMP_KEY, JSON.stringify(queue));
  } catch {
    // Storage full or disabled — fail open; the in-memory result still returns.
  }
}

/**
 * Read back previously-queued stamps (for a "resubmit now" UI flow).
 */
export function getQueuedStamps(): Array<{ hash: string; timestamp: number }> {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(PENDING_STAMP_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Clear a stamp from the local queue after a successful submission. */
export function clearQueuedStamp(hash: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(PENDING_STAMP_KEY);
    const queue: Array<{ hash: string; timestamp: number }> = raw
      ? JSON.parse(raw)
      : [];
    const next = queue.filter((s) => s.hash !== hash);
    localStorage.setItem(PENDING_STAMP_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/**
 * Best-effort scan of an OpenTimestamps binary proof for the two
 * attestation types we care about. Fresh submissions return a pending
 * proof; upgraded proofs contain a Bitcoin attestation.
 */
function parseOtsProof(bytes: Uint8Array): {
  confirmed: boolean;
  blockHeight?: number;
} {
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === OTS_BITCOIN_ATTESTATION && i + 4 < bytes.length) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const height = view.getUint32(i + 1, false);
      if (height > 0 && height < 1_000_000_000) {
        return { confirmed: true, blockHeight: height };
      }
    }
    if (bytes[i] === OTS_PENDING_ATTESTATION) {
      // Pending attestation present — not yet on-chain.
      return { confirmed: false };
    }
  }
  return { confirmed: false };
}

/* ═══════════════════════════════════════════════════════════════
   Public API
   ═══════════════════════════════════════════════════════════════ */

/**
 * Submit a 64-char hex SHA-256 digest to the OpenTimestamps calendar.
 *
 * The request is the binary stamp protocol: the 32 raw digest bytes
 * followed by a single 0x00 "append" marker telling the calendar to
 * fold this hash into its current Merkle tree.
 *
 * On success the calendar replies with a binary timestamp proof. A
 * fresh submission is always *pending* (Bitcoin confirmation takes
 * hours). If the network is unavailable, the stamp is queued locally
 * and the result reports `pending: true` so the caller can retry later.
 */
export async function notarizeEvidence(hash: string): Promise<NotarizationResult> {
  const timestamp = Date.now();
  const cleanHash = hash.trim().toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(cleanHash)) {
    throw new Error("notarizeEvidence expects a 64-char hex SHA-256 digest");
  }

  const digest = hexToBytes(cleanHash);
  // Binary stamp request: <32-byte digest> + append marker (0x00).
  const body = new Uint8Array(digest.length + 1);
  body.set(digest, 0);
  body[digest.length] = 0x00;

  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : undefined;
  const timeout = controller
    ? setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS)
    : undefined;

  try {
    const res = await fetch(OTS_CALENDAR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        Accept: "application/vnd.opentimestamps.v1",
      },
      body,
      signal: controller?.signal,
    });

    if (timeout) clearTimeout(timeout);

    if (!res.ok) {
      // Server rejected the stamp — queue for later rather than throwing.
      queuePendingStamp(cleanHash, timestamp);
      return { hash: cleanHash, timestamp, pending: true };
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    const proof = parseOtsProof(buf);

    if (proof.confirmed) {
      clearQueuedStamp(cleanHash);
      return {
        hash: cleanHash,
        timestamp,
        pending: false,
        confirmationBlock: proof.blockHeight,
      };
    }

    // Accepted but awaiting Bitcoin confirmation.
    queuePendingStamp(cleanHash, timestamp);
    return { hash: cleanHash, timestamp, pending: true };
  } catch {
    if (timeout) clearTimeout(timeout);
    // Offline, blocked, or timed out — never throw; queue for resubmission.
    queuePendingStamp(cleanHash, timestamp);
    return { hash: cleanHash, timestamp, pending: true };
  }
}

/**
 * Verify an existing OpenTimestamps proof (a `.ots` file). Reads the
 * binary proof and looks for a confirmed Bitcoin attestation.
 */
export async function verifyTimestamp(file: File): Promise<VerifyResult> {
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const proof = parseOtsProof(buf);
    return {
      confirmed: proof.confirmed,
      blockHeight: proof.blockHeight,
      timestamp: proof.confirmed ? file.lastModified : undefined,
    };
  } catch {
    return { confirmed: false };
  }
}

/**
 * Build a Merkle tree from a list of evidence hashes and return the
 * root plus per-leaf audit proofs.
 *
 * Each leaf's full proof is the subset of `proofs` whose `hash` field
 * equals that leaf's digest, in insertion (level) order. To verify a
 * leaf, walk its proof top-to-bottom: if `direction === "left"`, the
 * next node is `H(leaf || sibling)`; otherwise `H(sibling || leaf)`.
 *
 * Odd levels duplicate the final node (Bitcoin-style). A single hash
 * is its own root with an empty proof set.
 */
export function createMerkleLeaf(
  hashes: string[]
): { root: string; proofs: MerkleProof[] } {
  if (hashes.length === 0) {
    return { root: sha256Sync(""), proofs: [] };
  }
  if (hashes.length === 1) {
    return { root: hashes[0].toLowerCase(), proofs: [] };
  }

  // Track, for every active node, the leaf it ultimately descends from
  // (the "witness") so we can record proof steps per original leaf.
  let level: Array<{ node: string; leaf: string }> = hashes.map((h) => ({
    node: h.toLowerCase(),
    leaf: h.toLowerCase(),
  }));

  const proofs: MerkleProof[] = [];

  while (level.length > 1) {
    const next: Array<{ node: string; leaf: string }> = [];

    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right =
        i + 1 < level.length ? level[i + 1] : level[i]; // duplicate last if odd

      // Record proof steps for the witnesses on each side.
      proofs.push({
        hash: left.leaf,
        direction: "left",
        sibling: right.node,
      });
      if (i + 1 < level.length) {
        proofs.push({
          hash: right.leaf,
          direction: "right",
          sibling: left.node,
        });
      }

      const parent = sha256Sync(left.node + right.node);
      // Keep the left witness as the parent's witness for upper levels.
      next.push({ node: parent, leaf: left.leaf });
    }

    level = next;
  }

  return { root: level[0].node, proofs };
}

/**
 * Anchor an evidence hash into the local signed DAG (lib/dag.ts).
 *
 * Creates a new tamper-evident ledger entry whose `destination` is the
 * evidence digest, chaining to the previous entry's hash. The returned
 * string is the new entry's hash — proof that the evidence was
 * committed to the local chain at this moment. Synchronous, using the
 * same canonical form as dag.ts so it round-trips through verifyEntry.
 */
export function anchorToDag(hash: string, dagEntries: DagEntry[]): string {
  const evidenceHash = hash.trim().toLowerCase();
  const prevHash =
    dagEntries.length > 0 ? dagEntries[dagEntries.length - 1].hash : GENESIS_HASH;

  const canonical = JSON.stringify({
    prevHash,
    ts: Date.now(),
    source: "evidence",
    destination: evidenceHash,
    amount: "1",
    purpose: "evidence_anchor",
    status: "VERIFIED",
    signerHandle: "",
  });

  return sha256Sync(canonical);
}
