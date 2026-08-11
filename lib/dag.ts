/**
 * V FOR X — Signed Hash-Chained Ledger (DAG)
 *
 * Each ledger entry contains a SHA-256 hash computed over:
 *   { prevHash, ts, source, destination, amount, purpose, status, signerHandle }
 *
 * The `prevHash` field links each entry to its predecessor, forming an
 * append-only chain. Any tampering with a past entry invalidates every
 * subsequent hash, making the ledger tamper-evident.
 *
 * This is a client-side only DAG — no external chain or consensus.
 * For multi-device verification, export the chain and compare hashes.
 *
 * Used by The Trail (resource routing ledger).
 */

export interface DagEntry {
  id?: number;
  ts: number;
  source: string;
  destination: string;
  amount: string;
  purpose: string;
  status: "PENDING" | "IN_TRANSIT" | "VERIFIED";
  signerHandle?: string;
  /** SHA-256 hex of this entry's canonical content */
  hash: string;
  /** SHA-256 hex of the previous entry in the chain (genesis = "0".repeat(64)) */
  prevHash: string;
  /** Optional ECDSA P-256 signature (hex) over `hash`, proving authorship */
  signature?: string;
  /** Optional public key (hex) of the signer, for independent verification */
  signerPubKey?: string;
}

export interface ChainVerification {
  valid: boolean;
  brokenAt: number | null; // index of first broken entry
  totalEntries: number;
  brokenHash: string | null;
  message: string;
}

/** The genesis hash — all zeros. First entry in any chain links to this. */
export const GENESIS_HASH = "0".repeat(64);

/** Canonical JSON stringification — keys in deterministic order */
function canonicalize(entry: {
  prevHash: string;
  ts: number;
  source: string;
  destination: string;
  amount: string;
  purpose: string;
  status: string;
  signerHandle?: string;
}): string {
  return JSON.stringify({
    prevHash: entry.prevHash,
    ts: entry.ts,
    source: entry.source,
    destination: entry.destination,
    amount: entry.amount,
    purpose: entry.purpose,
    status: entry.status,
    signerHandle: entry.signerHandle ?? "",
  });
}

/**
 * Compute SHA-256 hash for a ledger entry.
 * The hash includes prevHash, making entries chain-linked.
 */
export async function computeEntryHash(
  entry: {
    prevHash: string;
    ts: number;
    source: string;
    destination: string;
    amount: string;
    purpose: string;
    status: string;
    signerHandle?: string;
  }
): Promise<string> {
  const data = canonicalize(entry);
  const buf = new TextEncoder().encode(data);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Create a new DAG entry, chaining to the previous entry's hash.
 * Returns the entry with hash and prevHash populated.
 */
export async function createDagEntry(
  data: Omit<DagEntry, "hash" | "prevHash" | "id">,
  prevHash: string
): Promise<DagEntry> {
  const base: Omit<DagEntry, "hash" | "id"> = {
    ...data,
    prevHash,
  };
  const hash = await computeEntryHash(base);
  return { ...base, hash };
}

/**
 * Recompute the hash of an entry and verify it matches the stored hash.
 */
export async function verifyEntry(entry: DagEntry): Promise<boolean> {
  const expected = await computeEntryHash({
    prevHash: entry.prevHash,
    ts: entry.ts,
    source: entry.source,
    destination: entry.destination,
    amount: entry.amount,
    purpose: entry.purpose,
    status: entry.status,
    signerHandle: entry.signerHandle,
  });
  return expected === entry.hash;
}

/**
 * Verify the integrity of an entire chain.
 * Checks that:
 * 1. Each entry's hash matches its content
 * 2. Each entry's prevHash matches the previous entry's hash
 * 3. The chain starts with the genesis prevHash (all zeros)
 */
export async function verifyChain(entries: DagEntry[]): Promise<ChainVerification> {
  if (entries.length === 0) {
    return { valid: true, brokenAt: null, totalEntries: 0, brokenHash: null, message: "Empty chain is valid" };
  }

  const GENESIS = "0".repeat(64);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Verify hash matches content
    const recomputedHash = await computeEntryHash({
      prevHash: entry.prevHash,
      ts: entry.ts,
      source: entry.source,
      destination: entry.destination,
      amount: entry.amount,
      purpose: entry.purpose,
      status: entry.status,
      signerHandle: entry.signerHandle,
    });

    if (recomputedHash !== entry.hash) {
      return {
        valid: false,
        brokenAt: i,
        totalEntries: entries.length,
        brokenHash: entry.hash,
        message: `Entry ${i} hash mismatch — content was tampered after hashing`,
      };
    }

    // Verify chain linkage
    const expectedPrev = i === 0 ? GENESIS : entries[i - 1].hash;
    if (entry.prevHash !== expectedPrev) {
      return {
        valid: false,
        brokenAt: i,
        totalEntries: entries.length,
        brokenHash: entry.prevHash,
        message: `Entry ${i} prevHash does not match entry ${i - 1}'s hash — chain broken or entries reordered`,
      };
    }
  }

  return {
    valid: true,
    brokenAt: null,
    totalEntries: entries.length,
    brokenHash: null,
    message: `Chain valid — ${entries.length} entries verified`,
  };
}

/**
 * Get the last hash in a chain (for linking the next entry).
 * Returns genesis hash if chain is empty.
 */
export function getLastHash(entries: DagEntry[]): string {
  if (entries.length === 0) return "0".repeat(64);
  return entries[entries.length - 1].hash;
}

/**
 * Truncate a hash for display (first 12 chars).
 */
export function shortHash(hash: string): string {
  return hash.slice(0, 12);
}

/* ═══════════════════════════════════════════════════════════════
   ECDSA Signature Support
   ═══════════════════════════════════════════════════════════════ */

/**
 * Sign a DAG entry's hash with an ECDSA P-256 private key.
 *
 * Returns a hex signature string that can be embedded in `entry.signature`.
 * Anyone with the public key can verify the entry was authored by the
 * key holder — making the ledger cryptographically attributable.
 */
export async function signDagEntry(
  entry: DagEntry,
  privateKey: CryptoKey,
): Promise<string> {
  const data = hexToBytes(entry.hash);
  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    data,
  );
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify that a DAG entry's signature was produced by the holder of the
 * matching private key. Returns false if the entry is unsigned.
 */
export async function verifyDagSignature(entry: DagEntry): Promise<boolean> {
  if (!entry.signature || !entry.signerPubKey) return false;
  try {
    const pubKeyBytes = hexToBytes(entry.signerPubKey);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      pubKeyBytes,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const data = hexToBytes(entry.hash);
    const sigBytes = hexToBytes(entry.signature);
    return crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      cryptoKey,
      sigBytes,
      data,
    );
  } catch {
    return false;
  }
}

/**
 * Generate an ECDSA P-256 keypair for signing DAG entries.
 * Returns the CryptoKeyPair plus the raw public key in hex.
 */
export async function generateDagKeyPair(): Promise<{
  keyPair: CryptoKeyPair;
  publicKeyHex: string;
}> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const pubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const publicKeyHex = Array.from(new Uint8Array(pubRaw))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { keyPair, publicKeyHex };
}

/** Convert a hex string to a Uint8Array backed by a regular ArrayBuffer. */
function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const out = new Uint8Array(new ArrayBuffer(clean.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

/**
 * Create a signed DAG entry using the unified identity by default.
 *
 * This is a convenience function that creates a DAG entry and signs it
 * using the unified identity from lib/identity.ts, providing a consistent
 * signing experience across all modules.
 */
export async function createIdentitySignedDagEntry(
  data: Omit<DagEntry, "hash" | "prevHash" | "id" | "signature" | "signerPubKey">,
  prevHash: string,
): Promise<DagEntry> {
  const { ensureIdentity, createSignedDagEntry } = await import("./identity");
  const identity = await ensureIdentity();
  return await createSignedDagEntry(data, prevHash, identity);
}
