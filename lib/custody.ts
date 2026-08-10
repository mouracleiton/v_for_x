/**
 * V FOR X — Chain of Custody Tracker
 *
 * Tracks evidence from capture through final submission, with each
 * step signed and hash-chained. This creates a tamper-evident audit
 * trail that can be presented in legal or tribunal contexts.
 *
 * Flow:
 *   CAPTURE → HASH → TIMESTAMP → VERIFY → SUBMIT → TRIBUNAL
 *
 * Each transition creates a CustodyEntry with:
 *   - The actor's identity (anonymous handle + public key)
 *   - An ECDSA signature over the entry hash
 *   - A timestamp
 *   - A link to the previous entry
 */

import { sha256Sync } from "./citizen-tools";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export type CustodyAction =
  | "CAPTURE"
  | "HASH"
  | "TIMESTAMP"
  | "VERIFY"
  | "TRANSMIT"
  | "SUBMIT"
  | "ARCHIVE";

export interface CustodyEntry {
  /** Unique entry ID */
  id: string;
  /** Action performed */
  action: CustodyAction;
  /** SHA-256 hash of the evidence at this step */
  evidenceHash: string;
  /** Actor's anonymous handle */
  actor: string;
  /** Actor's public key (hex, ECDSA P-256) */
  actorPubKey?: string;
  /** ECDSA signature over this entry's hash (hex) */
  signature?: string;
  /** Free-text note about this custody step */
  note?: string;
  /** ISO timestamp */
  ts: string;
  /** Hash of this entry for chain integrity */
  entryHash: string;
  /** Hash of the previous entry */
  prevHash: string;
  /** Additional metadata */
  metadata?: Record<string, string>;
}

export interface ChainOfCustody {
  entries: CustodyEntry[];
  /** Final evidence hash (from the last entry) */
  currentHash: string;
  /** Whether the chain integrity is intact */
  valid: boolean;
  /** Where the chain broke (if invalid) */
  brokenAt: number | null;
}

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

const GENESIS_HASH = "0".repeat(64);

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function computeEntryHash(entry: Omit<CustodyEntry, "entryHash">): string {
  const canonical = JSON.stringify({
    id: entry.id,
    action: entry.action,
    evidenceHash: entry.evidenceHash,
    actor: entry.actor,
    note: entry.note ?? "",
    ts: entry.ts,
    prevHash: entry.prevHash,
    metadata: entry.metadata ?? {},
  });
  return sha256Sync(canonical);
}

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `cust-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ═══════════════════════════════════════════════════════════════
   Public API
   ═══════════════════════════════════════════════════════════════ */

/**
 * Start a new chain of custody for a piece of evidence.
 */
export function initiateCustody(
  evidenceHash: string,
  actor: string,
  note?: string,
): CustodyEntry {
  const entry: Omit<CustodyEntry, "entryHash"> = {
    id: generateId(),
    action: "CAPTURE",
    evidenceHash: evidenceHash.toLowerCase(),
    actor,
    note: note ?? "Initial capture",
    ts: new Date().toISOString(),
    prevHash: GENESIS_HASH,
  };

  return { ...entry, entryHash: computeEntryHash(entry) };
}

/**
 * Add a new step to an existing chain of custody.
 */
export function addCustodyStep(
  chain: CustodyEntry[],
  action: CustodyAction,
  evidenceHash: string,
  actor: string,
  note?: string,
  metadata?: Record<string, string>,
): CustodyEntry {
  const prevHash = chain.length > 0 ? chain[chain.length - 1].entryHash : GENESIS_HASH;

  const entry: Omit<CustodyEntry, "entryHash"> = {
    id: generateId(),
    action,
    evidenceHash: evidenceHash.toLowerCase(),
    actor,
    note,
    ts: new Date().toISOString(),
    prevHash,
    metadata,
  };

  return { ...entry, entryHash: computeEntryHash(entry) };
}

/**
 * Verify the integrity of a chain of custody.
 * Checks that:
 *   1. Each entry's hash matches its content
 *   2. Each entry links to the previous entry
 *   3. The chain starts from genesis
 */
export function verifyCustodyChain(entries: CustodyEntry[]): ChainOfCustody {
  if (entries.length === 0) {
    return {
      entries: [],
      currentHash: "",
      valid: true,
      brokenAt: null,
    };
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Verify entry hash
    const { entryHash, ...rest } = entry;
    const recomputed = computeEntryHash(rest);
    if (recomputed !== entry.entryHash) {
      return {
        entries,
        currentHash: entry.evidenceHash,
        valid: false,
        brokenAt: i,
      };
    }

    // Verify chain linkage
    const expectedPrev = i === 0 ? GENESIS_HASH : entries[i - 1].entryHash;
    if (entry.prevHash !== expectedPrev) {
      return {
        entries,
        currentHash: entry.evidenceHash,
        valid: false,
        brokenAt: i,
      };
    }
  }

  return {
    entries,
    currentHash: entries[entries.length - 1].evidenceHash,
    valid: true,
    brokenAt: null,
  };
}

/**
 * Sign a custody entry with an ECDSA private key.
 * The signature covers the entry hash, proving the actor's identity.
 */
export async function signCustodyEntry(
  entry: CustodyEntry,
  privateKey: CryptoKey,
  pubKeyHex: string,
): Promise<CustodyEntry> {
  const data = new TextEncoder().encode(entry.entryHash);
  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    data,
  );
  const signature = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { ...entry, signature, actorPubKey: pubKeyHex };
}

/**
 * Export a chain of custody as a signed JSON document.
 */
export function exportCustodyChain(entries: CustodyEntry[]): string {
  const chain = verifyCustodyChain(entries);
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    valid: chain.valid,
    entries,
    summary: {
      steps: entries.length,
      actions: entries.map((e) => e.action),
      actors: [...new Set(entries.map((e) => e.actor))],
      firstCapture: entries[0]?.ts,
      lastAction: entries[entries.length - 1]?.ts,
    },
  }, null, 2);
}

/**
 * Generate a human-readable custody report.
 */
export function formatCustodyReport(entries: CustodyEntry[]): string {
  if (entries.length === 0) return "Empty chain of custody.";

  const chain = verifyCustodyChain(entries);
  const lines: string[] = [];
  lines.push("CHAIN OF CUSTODY REPORT");
  lines.push("=".repeat(50));
  lines.push(`Status: ${chain.valid ? "✓ INTACT" : "✗ BROKEN at step " + chain.brokenAt}`);
  lines.push(`Steps: ${entries.length}`);
  lines.push(`Evidence Hash: ${entries[0].evidenceHash}`);
  lines.push("");

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    lines.push(`[${i + 1}] ${e.action} — ${e.ts}`);
    lines.push(`    Actor: ${e.actor}${e.signature ? " ✓ SIGNED" : ""}`);
    if (e.note) lines.push(`    Note: ${e.note}`);
    lines.push(`    Hash: ${e.entryHash.slice(0, 16)}…`);
    lines.push("");
  }

  return lines.join("\n");
}
