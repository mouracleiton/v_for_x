/**
 * V FOR X — Unified Crypto Identity Layer
 *
 * Provides a persistent ECDSA P-256 identity that can be used across
 * all modules requiring cryptographic signatures:
 * - DAG entries (Trail ledger)
 * - Witness statements (The Receipts)
 * - Mirror claims (The Mirror Ring)
 * - Blinded reviews (Registry)
 * - Gamification certificates
 *
 * The identity is stored in localStorage and consists of:
 * - A keypair (private key for signing, public key for verification)
 * - A handle (human-readable identifier, e.g., "V-ABCD-EFGH")
 * - A fingerprint (short hex of public key for safety numbers)
 *
 * VFXID1 token format: VFXID1:base64({handle, publicKeyHex, signature})
 */

export interface Identity {
  /** ECDSA P-256 private key (extractable for persistence) */
  privateKey: CryptoKey;
  /** ECDSA P-256 public key */
  publicKey: CryptoKey;
  /** Raw public key in hex format (for sharing and verification) */
  publicKeyHex: string;
  /** Human-readable handle (e.g., "V-ABCD-EFGH") */
  handle: string;
  /** Short fingerprint for safety numbers (first 12 chars of SHA-256 of public key) */
  fingerprint: string;
  /** Timestamp when identity was created */
  createdAt: number;
}

export interface PublicIdentity {
  publicKeyHex: string;
  handle: string;
  fingerprint: string;
  createdAt: number;
}

export interface IdentityToken {
  version: 1;
  handle: string;
  publicKeyHex: string;
  signature: string; // Signature over {handle, publicKeyHex}
}

/** Storage key for identity in localStorage */
const IDENTITY_STORAGE_KEY = "vfx_identity";

/**
 * Generate a new unified identity.
 *
 * Creates an ECDSA P-256 keypair and generates a random handle.
 * The handle format is V-XXXX-XXXX where X is a random uppercase letter.
 */
export async function generateIdentity(): Promise<Identity> {
  // Generate ECDSA P-256 keypair
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true, // extractable
    ["sign", "verify"]
  );

  // Export public key as raw bytes
  const pubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const publicKeyHex = bytesToHex(new Uint8Array(pubRaw));

  // Generate fingerprint (SHA-256 of public key, first 12 chars)
  const hashBuf = await crypto.subtle.digest("SHA-256", pubRaw);
  const fingerprint = bytesToHex(new Uint8Array(hashBuf)).slice(0, 12);

  // Generate random handle: V-XXXX-XXXX
  const handle = generateHandle();

  return {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    publicKeyHex,
    handle,
    fingerprint,
    createdAt: Date.now(),
  };
}

/**
 * Generate a random handle in format V-XXXX-XXXX.
 */
function generateHandle(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No ambiguous chars
  const randomSegment = (): string => {
    let seg = "";
    for (let i = 0; i < 4; i++) {
      seg += chars[Math.floor(Math.random() * chars.length)];
    }
    return seg;
  };
  return `V-${randomSegment()}-${randomSegment()}`;
}

/**
 * Save identity to localStorage.
 *
 * The private key is exported as JWK (JSON Web Key) for persistence.
 */
export async function saveIdentity(identity: Identity): Promise<void> {
  const privateJwk = await crypto.subtle.exportKey("jwk", identity.privateKey);
  const publicJwk = await crypto.subtle.exportKey("jwk", identity.publicKey);

  const data = {
    privateJwk,
    publicJwk,
    publicKeyHex: identity.publicKeyHex,
    handle: identity.handle,
    fingerprint: identity.fingerprint,
    createdAt: identity.createdAt,
  };

  localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(data));
}

/**
 * Load identity from localStorage.
 *
 * Returns null if no identity exists.
 */
export async function loadIdentity(): Promise<Identity | null> {
  const stored = localStorage.getItem(IDENTITY_STORAGE_KEY);
  if (!stored) return null;

  try {
    const data = JSON.parse(stored);

    const privateKey = await crypto.subtle.importKey(
      "jwk",
      data.privateJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      true, // extractable
      ["sign"]
    );

    const publicKey = await crypto.subtle.importKey(
      "jwk",
      data.publicJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      true, // extractable
      ["verify"]
    );

    return {
      privateKey,
      publicKey,
      publicKeyHex: data.publicKeyHex,
      handle: data.handle,
      fingerprint: data.fingerprint,
      createdAt: data.createdAt,
    };
  } catch {
    // Corrupted storage, clear it
    localStorage.removeItem(IDENTITY_STORAGE_KEY);
    return null;
  }
}

/**
 * Ensure an identity exists, creating one if necessary.
 *
 * Convenience function that loads or generates an identity.
 */
export async function ensureIdentity(): Promise<Identity> {
  let identity = await loadIdentity();
  if (!identity) {
    identity = await generateIdentity();
    await saveIdentity(identity);
  }
  return identity;
}

/**
 * Delete the stored identity.
 *
 * Use with caution - this cannot be undone.
 */
export function deleteIdentity(): void {
  localStorage.removeItem(IDENTITY_STORAGE_KEY);
}

/**
 * Sign a message hash with the identity's private key.
 *
 * Returns a hex signature string.
 */
export async function signWithIdentity(
  identity: Identity,
  hash: string
): Promise<string> {
  const data = hexToBytes(hash);
  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    identity.privateKey,
    data.buffer as ArrayBuffer
  );
  return bytesToHex(new Uint8Array(sigBuf));
}

/**
 * Verify a signature against a public identity.
 *
 * Returns true if the signature is valid.
 */
export async function verifyWithIdentity(
  publicIdentity: PublicIdentity,
  hash: string,
  signature: string
): Promise<boolean> {
  try {
    const pubKeyBytes = hexToBytes(publicIdentity.publicKeyHex);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      pubKeyBytes.buffer as ArrayBuffer,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    const data = hexToBytes(hash);
    const sigBytes = hexToBytes(signature);
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      cryptoKey,
      sigBytes.buffer as ArrayBuffer,
      data.buffer as ArrayBuffer
    );
  } catch {
    return false;
  }
}

/**
 * Compute safety number between two identities.
 *
 * The safety number is a SHA-256 hash of the two public keys concatenated
 * in sorted order (lexicographically by hex string). This ensures that
 * A vs B produces the same safety number as B vs A.
 *
 * Useful for verifying you're talking to the right person (compare in person).
 */
export async function computeSafetyNumber(
  identityA: PublicIdentity | Identity,
  identityB: PublicIdentity | Identity
): Promise<string> {
  const keys = [identityA.publicKeyHex, identityB.publicKeyHex].sort();
  const combined = keys.join("");
  const buf = new TextEncoder().encode(combined);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf.buffer as ArrayBuffer);
  return bytesToHex(new Uint8Array(hashBuf));
}

/**
 * Export identity as a public card (no private key).
 *
 * This can be shared with others for verification purposes.
 */
export function exportPublicCard(identity: Identity): PublicIdentity {
  return {
    publicKeyHex: identity.publicKeyHex,
    handle: identity.handle,
    fingerprint: identity.fingerprint,
    createdAt: identity.createdAt,
  };
}

/**
 * Encode an identity as a VFXID1 token.
 *
 * Format: VFXID1:base64url({version, handle, publicKeyHex, signature})
 * The signature is over the string `${handle}|${publicKeyHex}`
 */
export async function encodeIdentityToken(identity: Identity): Promise<string> {
  const message = `${identity.handle}|${identity.publicKeyHex}`;
  const messageBuf = new TextEncoder().encode(message);
  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    identity.privateKey,
    messageBuf.buffer as ArrayBuffer
  );
  const signature = bytesToHex(new Uint8Array(sigBuf));

  const token: IdentityToken = {
    version: 1,
    handle: identity.handle,
    publicKeyHex: identity.publicKeyHex,
    signature,
  };

  const json = JSON.stringify(token);
  const base64 = btoa(json);
  return `VFXID1:${base64}`;
}

/**
 * Decode and verify a VFXID1 token.
 *
 * Returns the public identity if the signature is valid, null otherwise.
 */
export async function decodeIdentityToken(
  token: string
): Promise<PublicIdentity | null> {
  if (!token.startsWith("VFXID1:")) {
    return null;
  }

  try {
    const base64 = token.slice(7); // Remove "VFXID1:"
    const json = atob(base64);
    const data: IdentityToken = JSON.parse(json);

    if (data.version !== 1) {
      return null;
    }

    // Verify signature
    const message = `${data.handle}|${data.publicKeyHex}`;
    const messageBuf = new TextEncoder().encode(message);
    const sigBytes = hexToBytes(data.signature);
    const pubKeyBytes = hexToBytes(data.publicKeyHex);

    const publicKey = await crypto.subtle.importKey(
      "raw",
      pubKeyBytes.buffer as ArrayBuffer,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );

    const isValid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      sigBytes.buffer as ArrayBuffer,
      messageBuf.buffer as ArrayBuffer
    );

    if (!isValid) {
      return null;
    }

    // Compute fingerprint
    const hashBuf = await crypto.subtle.digest("SHA-256", pubKeyBytes.buffer as ArrayBuffer);
    const fingerprint = bytesToHex(new Uint8Array(hashBuf)).slice(0, 12);

    return {
      publicKeyHex: data.publicKeyHex,
      handle: data.handle,
      fingerprint,
      createdAt: Date.now(), // Not stored in token
    };
  } catch {
    return null;
  }
}

/**
 * Convert a hex string to a Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const buf = new Uint8Array(clean.length / 2);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return buf;
}

/**
 * Convert a Uint8Array to a hex string.
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Create a signed DAG entry using the unified identity.
 *
 * This is a convenience function that combines identity signing
 * with DAG entry creation.
 */
export async function createSignedDagEntry(
  data: Omit<
    import("./dag").DagEntry,
    "hash" | "prevHash" | "id" | "signature" | "signerPubKey"
  > & { signature?: string; signerPubKey?: string },
  prevHash: string,
  identity: Identity
): Promise<import("./dag").DagEntry> {
  const { createDagEntry } = await import("./dag");

  // Create the base entry with undefined signature fields
  const baseEntry = await createDagEntry(
    {
      ...data,
      signature: undefined,
      signerPubKey: undefined,
    } as import("./dag").DagEntry,
    prevHash
  );

  // Now sign it and add signature fields
  const signature = await signWithIdentity(identity, baseEntry.hash);

  return {
    ...baseEntry,
    signature,
    signerPubKey: identity.publicKeyHex,
    signerHandle: identity.handle,
  };
}

/**
 * Verify a DAG entry's signature and return the public identity of the signer.
 *
 * Returns null if the signature is invalid.
 */
export async function verifyDagEntrySignature(
  entry: import("./dag").DagEntry
): Promise<PublicIdentity | null> {
  if (!entry.signature || !entry.signerPubKey) {
    return null;
  }

  // Try verification using the DAG module
  try {
    const { verifyDagSignature } = await import("./dag");
    const isValid = await verifyDagSignature(entry);

    if (!isValid) {
      return null;
    }
  } catch {
    return null;
  }

  // Compute fingerprint
  const pubKeyBytes = hexToBytes(entry.signerPubKey);
  const hashBuf = await crypto.subtle.digest("SHA-256", pubKeyBytes.buffer as ArrayBuffer);
  const fingerprint = bytesToHex(new Uint8Array(hashBuf)).slice(0, 12);

  return {
    publicKeyHex: entry.signerPubKey,
    handle: entry.signerHandle || "",
    fingerprint,
    createdAt: entry.ts,
  };
}
