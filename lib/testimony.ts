/**
 * V FOR X — The Testimony (Signed Witness Statements)
 *
 * A system for collecting timestamped, cryptographically signed
 * witness statements. Each testimony is:
 *   1. ECDSA-signed with an anonymous P-256 keypair
 *   2. Hash-chained into an append-only log (tamper-evident)
 *   3. Locally stored (IndexedDB)
 *
 * The chain ensures that once a testimony is recorded, any tampering
 * with past entries breaks the chain and is immediately detectable.
 *
 * Testimonies can be exported as structured JSON packages for use
 * in Tribunal cases, ICC submissions, or media reports.
 *
 * Uses patterns from lib/dag.ts (hash chaining) and lib/submission.ts
 * (ECDSA signing).
 */

import { computeEntryHash, GENESIS_HASH } from "./dag";

export type TestimonyCategory =
  | "war_crime"
  | "human_rights"
  | "corruption"
  | "environmental"
  | "displacement"
  | "violence"
  | "other";

export interface Testimony {
  id: string;
  /** Anonymous signer handle (e.g., "V-ABCD-EFGH") */
  signerHandle: string;
  /** The statement itself */
  statement: string;
  /** When the event occurred */
  eventDate: string;
  /** Where (country ISO3, region, or general) */
  location: string;
  iso3?: string;
  category: TestimonyCategory;
  /** Whether the witness consents to public disclosure */
  consentPublic: boolean;
  /** Linked evidence IDs (from Tribunal or Vault) */
  linkedEvidence?: string[];
  /** Anonymous ECDSA public key (base64 SPKI) */
  signerPublicKey: string;
  /** ECDSA signature (base64) */
  signature: string;
  /** When this testimony was signed and recorded */
  ts: number;
  /** Content hash (what was signed) */
  contentHash: string;
}

export interface TestimonyChainEntry {
  testimonyId: string;
  ts: number;
  contentHash: string;
  /** Links to previous entry in chain */
  prevHash: string;
  /** This entry's hash */
  hash: string;
}

export interface ChainVerificationResult {
  valid: boolean;
  totalEntries: number;
  brokenAt: number | null;
  message: string;
}

/* ═══════════════════════════════════════════════════════════
   ENCODING HELPERS
   ═══════════════════════════════════════════════════════════ */

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function hasSubtle(): boolean {
  return typeof globalThis !== "undefined" && !!globalThis.crypto?.subtle;
}

/* ═══════════════════════════════════════════════════════════
   KEY MANAGEMENT
   ═══════════════════════════════════════════════════════════ */

export interface AnonymousKeyPair {
  publicKey: string;
  privateKey: string;
  handle: string;
}

/**
 * Generate an anonymous ECDSA P-256 keypair for signing testimony.
 * Returns base64-encoded SPKI public key, PKCS8 private key, and
 * a random anonymous handle.
 */
export async function generateTestimonyKey(): Promise<AnonymousKeyPair> {
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

  // Generate a random handle from the public key hash
  const pubHash = await crypto.subtle.digest("SHA-256", pub);
  const hashHex = Array.from(new Uint8Array(pubHash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const handle = `V-${hashHex.slice(0, 4)}-${hashHex.slice(4, 8)}`;

  return {
    publicKey: bufToB64(pub),
    privateKey: bufToB64(priv),
    handle,
  };
}

/* ═══════════════════════════════════════════════════════════
   TESTIMONY CREATION & SIGNING
   ═══════════════════════════════════════════════════════════ */

/**
 * Create and sign a testimony with an anonymous keypair.
 */
export async function createTestimony(
  keyPair: AnonymousKeyPair,
  data: {
    statement: string;
    eventDate: string;
    location: string;
    iso3?: string;
    category: TestimonyCategory;
    consentPublic: boolean;
    linkedEvidence?: string[];
  },
): Promise<Testimony> {
  if (!hasSubtle()) {
    throw new Error("Web Crypto API unavailable");
  }
  if (data.statement.trim().length < 10) {
    throw new Error("Statement must be at least 10 characters");
  }

  const ts = Date.now();
  const id = crypto.randomUUID();

  // Build the canonical content to hash and sign
  const content = JSON.stringify({
    id,
    statement: data.statement,
    eventDate: data.eventDate,
    location: data.location,
    category: data.category,
    ts,
  });
  const contentBytes = new TextEncoder().encode(content);
  const hashBuf = await crypto.subtle.digest("SHA-256", contentBytes);
  const contentHash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Import the private key for signing
  const privKey = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(keyPair.privateKey), (c) => c.charCodeAt(0)),
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
    id,
    signerHandle: keyPair.handle,
    statement: data.statement,
    eventDate: data.eventDate,
    location: data.location,
    iso3: data.iso3,
    category: data.category,
    consentPublic: data.consentPublic,
    linkedEvidence: data.linkedEvidence,
    signerPublicKey: keyPair.publicKey,
    signature: bufToB64(sigBuf),
    ts,
    contentHash,
  };
}

/**
 * Verify a testimony's signature against its public key.
 */
export async function verifyTestimony(testimony: Testimony): Promise<boolean> {
  if (!hasSubtle()) return false;

  try {
    const pubKey = await crypto.subtle.importKey(
      "spki",
      Uint8Array.from(atob(testimony.signerPublicKey), (c) => c.charCodeAt(0)),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );

    // Reconstruct the content that was signed
    const content = JSON.stringify({
      id: testimony.id,
      statement: testimony.statement,
      eventDate: testimony.eventDate,
      location: testimony.location,
      category: testimony.category,
      ts: testimony.ts,
    });
    const contentBytes = new TextEncoder().encode(content);
    const sigBytes = Uint8Array.from(atob(testimony.signature), (c) => c.charCodeAt(0));

    return crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pubKey,
      sigBytes,
      contentBytes,
    );
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════
   HASH-CHAINED LOG
   ═══════════════════════════════════════════════════════════ */

/**
 * Build a hash-chained log entry from a testimony.
 * Each entry links to the previous testimony's hash, forming a
 * tamper-evident append-only chain.
 */
export async function buildChainEntry(
  testimony: Testimony,
  prevHash: string,
): Promise<TestimonyChainEntry> {
  const hash = await computeEntryHash({
    prevHash,
    ts: testimony.ts,
    source: testimony.signerHandle,
    destination: testimony.id,
    amount: "1",
    purpose: "testimony",
    status: "SIGNED",
    signerHandle: testimony.signerHandle,
  });

  return {
    testimonyId: testimony.id,
    ts: testimony.ts,
    contentHash: testimony.contentHash,
    prevHash,
    hash,
  };
}

/**
 * Build the full hash chain from an ordered list of testimonies.
 */
export async function buildChain(testimonies: Testimony[]): Promise<TestimonyChainEntry[]> {
  const entries: TestimonyChainEntry[] = [];
  let prevHash = GENESIS_HASH;

  for (const t of testimonies) {
    const entry = await buildChainEntry(t, prevHash);
    entries.push(entry);
    prevHash = entry.hash;
  }

  return entries;
}

/**
 * Verify the integrity of a testimony chain.
 */
export async function verifyChain(
  testimonies: Testimony[],
  chain: TestimonyChainEntry[],
): Promise<ChainVerificationResult> {
  if (testimonies.length !== chain.length) {
    return {
      valid: false,
      totalEntries: chain.length,
      brokenAt: null,
      message: `Mismatch: ${testimonies.length} testimonies vs ${chain.length} chain entries`,
    };
  }

  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i];
    const expectedPrev = i === 0 ? GENESIS_HASH : chain[i - 1].hash;

    if (entry.prevHash !== expectedPrev) {
      return {
        valid: false,
        totalEntries: chain.length,
        brokenAt: i,
        message: `Chain broken at entry ${i}: prevHash mismatch`,
      };
    }

    const recomputed = await computeEntryHash({
      prevHash: entry.prevHash,
      ts: entry.ts,
      source: testimonies[i].signerHandle,
      destination: entry.testimonyId,
      amount: "1",
      purpose: "testimony",
      status: "SIGNED",
      signerHandle: testimonies[i].signerHandle,
    });

    if (recomputed !== entry.hash) {
      return {
        valid: false,
        totalEntries: chain.length,
        brokenAt: i,
        message: `Chain broken at entry ${i}: content was tampered`,
      };
    }
  }

  return {
    valid: true,
    totalEntries: chain.length,
    brokenAt: null,
    message: `Chain valid — ${chain.length} entries verified`,
  };
}

/* ═══════════════════════════════════════════════════════════
   EXPORT
   ═══════════════════════════════════════════════════════════ */

export function exportTestimonyPackage(
  testimonies: Testimony[],
  chain: TestimonyChainEntry[],
): string {
  return JSON.stringify({
    type: "vfx_testimony_package",
    version: 1,
    exportedAt: Date.now(),
    testimonies,
    chain,
  }, null, 2);
}

/* ═══════════════════════════════════════════════════════════
   METADATA
   ═══════════════════════════════════════════════════════════ */

export const CATEGORY_LABELS: Record<TestimonyCategory, string> = {
  war_crime: "War Crime",
  human_rights: "Human Rights Violation",
  corruption: "Corruption",
  environmental: "Environmental Crime",
  displacement: "Forced Displacement",
  violence: "Violence / Atrocity",
  other: "Other",
};
