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

/** Storage key for identity history (previous identities for grace period) */
const IDENTITY_HISTORY_KEY = "vfx_identity_history";

/** Grace period for signature verification (30 days in milliseconds) */
const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/** Entry in identity history */
interface IdentityHistoryEntry {
  /** The identity that was rotated out */
  identity: Identity;
  /** When this identity was rotated out (timestamp) */
  rotatedAt: number;
  /** When the grace period ends (timestamp) */
  gracePeriodUntil: number;
}

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
 * Rotate to a new identity key.
 *
 * This function:
 * 1. Generates a new keypair
 * 2. Saves the old identity to history with rotation timestamp
 * 3. Sets the new identity as current
 * 4. Prunes old identities whose grace period has expired
 *
 * The old identity remains verifiable for 30 days (grace period).
 * Returns the new identity.
 */
export async function rotateIdentity(): Promise<Identity> {
  // Load current identity
  const currentIdentity = await loadIdentity();
  if (!currentIdentity) {
    throw new Error("No current identity to rotate. Use generateIdentity() first.");
  }

  // Generate new identity
  const newIdentity = await generateIdentity();

  // Save current identity to history
  await saveIdentityToHistory(currentIdentity);

  // Save new identity as current
  await saveIdentity(newIdentity);

  // Prune expired identities from history
  await pruneExpiredIdentities();

  return newIdentity;
}

/**
 * Save an identity to the history for grace period verification.
 */
export async function saveIdentityToHistory(identity: Identity): Promise<void> {
  const history = await loadPreviousIdentities();

  const entry: IdentityHistoryEntry = {
    identity,
    rotatedAt: Date.now(),
    gracePeriodUntil: identity.createdAt + GRACE_PERIOD_MS,
  };

  // Add to history (most recent first)
  history.unshift(entry);

  // Save to localStorage - need to await the crypto key exports
  const historyData = await Promise.all(
    history.map(async (entry) => ({
      privateJwk: await crypto.subtle.exportKey("jwk", entry.identity.privateKey),
      publicJwk: await crypto.subtle.exportKey("jwk", entry.identity.publicKey),
      publicKeyHex: entry.identity.publicKeyHex,
      handle: entry.identity.handle,
      fingerprint: entry.identity.fingerprint,
      createdAt: entry.identity.createdAt,
      rotatedAt: entry.rotatedAt,
      gracePeriodUntil: entry.gracePeriodUntil,
    }))
  );

  localStorage.setItem(IDENTITY_HISTORY_KEY, JSON.stringify(historyData));
}

/**
 * Load all previous identities from history.
 *
 * Returns an array of IdentityHistoryEntry, ordered from most recent to oldest.
 */
export async function loadPreviousIdentities(): Promise<IdentityHistoryEntry[]> {
  const stored = localStorage.getItem(IDENTITY_HISTORY_KEY);
  if (!stored) return [];

  try {
    const historyData = JSON.parse(stored);

    const entries: IdentityHistoryEntry[] = [];

    for (const data of historyData) {
      try {
        const privateKey = await crypto.subtle.importKey(
          "jwk",
          data.privateJwk,
          { name: "ECDSA", namedCurve: "P-256" },
          true,
          ["sign"]
        );

        const publicKey = await crypto.subtle.importKey(
          "jwk",
          data.publicJwk,
          { name: "ECDSA", namedCurve: "P-256" },
          true,
          ["verify"]
        );

        entries.push({
          identity: {
            privateKey,
            publicKey,
            publicKeyHex: data.publicKeyHex,
            handle: data.handle,
            fingerprint: data.fingerprint,
            createdAt: data.createdAt,
          },
          rotatedAt: data.rotatedAt,
          gracePeriodUntil: data.gracePeriodUntil,
        });
          } catch {
            // Skip a corrupted individual history entry; keep the rest.
          }
    }

    // Sort by rotatedAt descending (most recent first)
    return entries.sort((a, b) => b.rotatedAt - a.rotatedAt);
  } catch {
    // Corrupted storage, clear it
    localStorage.removeItem(IDENTITY_HISTORY_KEY);
    return [];
  }
}

/**
 * Prune identities from history whose grace period has expired.
 */
async function pruneExpiredIdentities(): Promise<void> {
  const history = await loadPreviousIdentities();
  const now = Date.now();

  // Filter out entries where grace period has expired
  const validEntries = history.filter((entry) => entry.gracePeriodUntil > now);

  if (validEntries.length === history.length) {
    // Nothing to prune
    return;
  }

  // Save pruned history
  if (validEntries.length === 0) {
    localStorage.removeItem(IDENTITY_HISTORY_KEY);
  } else {
    const historyData = await Promise.all(
      validEntries.map(async (entry) => ({
        privateJwk: await crypto.subtle.exportKey("jwk", entry.identity.privateKey),
        publicJwk: await crypto.subtle.exportKey("jwk", entry.identity.publicKey),
        publicKeyHex: entry.identity.publicKeyHex,
        handle: entry.identity.handle,
        fingerprint: entry.identity.fingerprint,
        createdAt: entry.identity.createdAt,
        rotatedAt: entry.rotatedAt,
        gracePeriodUntil: entry.gracePeriodUntil,
      }))
    );

    localStorage.setItem(IDENTITY_HISTORY_KEY, JSON.stringify(historyData));
  }
}

/**
 * Verify a signature with grace period support.
 *
 * This function attempts to verify a signature using:
 * 1. The provided public identity
 * 2. Any previous identities still within their 30-day grace period
 *
 * This is useful during key rotation transition periods where signatures
 * made with the old key should still be accepted.
 *
 * Returns true if the signature is valid with any identity (current or within grace period).
 */
export async function verifySignatureWithGrace(
  publicIdentity: PublicIdentity,
  hash: string,
  signature: string
): Promise<boolean> {
  const now = Date.now();

  // First, try verifying with the provided public identity
  const directVerify = await verifyWithIdentity(publicIdentity, hash, signature);
  if (directVerify) {
    return true;
  }

  // If that fails, check if any previous identities match and are within grace period
  const history = await loadPreviousIdentities();

  for (const entry of history) {
    // Skip if grace period has expired
    if (entry.gracePeriodUntil <= now) {
      continue;
    }

    // Check if this history entry matches the provided public identity
    if (
      entry.identity.publicKeyHex === publicIdentity.publicKeyHex &&
      entry.identity.handle === publicIdentity.handle
    ) {
      // This is a previous identity - verify with it
      const verifyResult = await verifyWithIdentity(
        {
          publicKeyHex: entry.identity.publicKeyHex,
          handle: entry.identity.handle,
          fingerprint: entry.identity.fingerprint,
          createdAt: entry.identity.createdAt,
        },
        hash,
        signature
      );

      if (verifyResult) {
        return true;
      }
    }
  }

  // No valid signature found
  return false;
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
export function publicCard(identity: Identity): PublicIdentity {
  return {
    publicKeyHex: identity.publicKeyHex,
    handle: identity.handle,
    fingerprint: identity.fingerprint,
    createdAt: identity.createdAt,
  };
}

/**
 * Export identity as a public card (no private key).
 *
 * This can be shared with others for verification purposes.
 * @deprecated Use publicCard instead for consistency.
 */
export function exportPublicCard(identity: Identity): PublicIdentity {
  return publicCard(identity);
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
 * Encode a public identity card as a VFXID1PUB token.
 *
 * Format: VFXID1PUB:base64url({version, handle, publicKeyHex, fingerprint, createdAt})
 * This token contains NO private key and NO signature - it's purely for sharing your public identity.
 * Use this when you want to share your identity info without proving ownership.
 */
export function encodePublicCardToken(identity: Identity): string {
  const publicCardData = {
    version: 1,
    handle: identity.handle,
    publicKeyHex: identity.publicKeyHex,
    fingerprint: identity.fingerprint,
    createdAt: identity.createdAt,
  };

  const json = JSON.stringify(publicCardData);
  const base64 = btoa(json);
  return `VFXID1PUB:${base64}`;
}

/**
 * Decode a VFXID1PUB public card token.
 *
 * Returns the public identity if the format is valid, null otherwise.
 * No signature verification is performed since public cards are not signed.
 */
export function decodePublicCardToken(token: string): PublicIdentity | null {
  if (!token.startsWith("VFXID1PUB:")) {
    return null;
  }

  try {
    const base64 = token.slice(10); // Remove "VFXID1PUB:"
    const json = atob(base64);
    const data = JSON.parse(json);

    if (data.version !== 1) {
      return null;
    }

    return {
      publicKeyHex: data.publicKeyHex,
      handle: data.handle,
      fingerprint: data.fingerprint,
      createdAt: data.createdAt,
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

/**
 * Sign a witness statement using the unified identity.
 *
 * This function creates a signing function compatible with lib/witness.ts
 * that uses the unified identity for signing witness statements.
 */
export async function signWitnessWithIdentity(
  identity: Identity
): Promise<(content: string) => Promise<{ signature: string; publicKey: string }>> {
  return async (content: string) => {
    // Import public key as SPKI for witness format
    const pubRaw = await crypto.subtle.exportKey("spki", identity.publicKey);
    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(pubRaw)));

    // Sign the content
    const contentBytes = new TextEncoder().encode(content);
    const sigBuf = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      identity.privateKey,
      contentBytes
    );
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

    return {
      signature: signatureBase64,
      publicKey: publicKeyBase64
    };
  };
}

/**
 * Sign a mirror claim using the unified identity.
 *
 * This function generates a mirror keypair compatible with lib/mirror.ts
 * but derived from the unified identity.
 */
export async function signMirrorClaimWithIdentity(
  identity: Identity,
  input: {
    transport: string;
    endpoint: string;
    region?: string;
    buildHash?: string;
    buildVersion?: string;
  }
): Promise<import("./mirror").MirrorNode> {
  const { MIRROR_KIT_VERSION } = await import("./mirror");

  // Create a mirror-compatible keypair from the identity
  const pubRaw = await crypto.subtle.exportKey("spki", identity.publicKey);
  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(pubRaw)));

  // Generate handle from identity's public key hash
  const pubHashBuf = await crypto.subtle.digest("SHA-256", pubRaw);
  const pubHashHex = bytesToHex(new Uint8Array(pubHashBuf));
  const handle = `V-${pubHashHex.slice(0, 4)}-${pubHashHex.slice(4, 8)}`;

  // Create the claim content
  const ts = Date.now();
  const id = crypto.randomUUID();

  const partial = {
    id,
    handle,
    transport: input.transport,
    endpoint: input.endpoint,
    region: input.region?.trim() || undefined,
    buildHash: input.buildHash?.trim() || "unknown",
    buildVersion: input.buildVersion?.trim() || undefined,
    kitVersion: MIRROR_KIT_VERSION,
    ts,
  };

  // Sign using identity
  const canonical = JSON.stringify({
    id: partial.id,
    handle: partial.handle,
    transport: partial.transport,
    endpoint: partial.endpoint,
    region: partial.region ?? "",
    buildHash: partial.buildHash,
    buildVersion: partial.buildVersion ?? "",
    kitVersion: partial.kitVersion,
    ts: partial.ts,
  });

  const contentBytes = new TextEncoder().encode(canonical);
  const contentHashBuf = await crypto.subtle.digest("SHA-256", contentBytes);
  const contentHash = bytesToHex(new Uint8Array(contentHashBuf));

  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    identity.privateKey,
    contentBytes
  );
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

  return {
    ...partial,
    signerPublicKey: publicKeyBase64,
    signature: signatureBase64,
    contentHash,
  } as import("./mirror").MirrorNode;
}

/**
 * Sign a review reveal using the unified identity.
 *
 * This function signs a blinded peer review reveal using the unified identity.
 */
export async function signReviewRevealWithIdentity(
  identity: Identity,
  revealed: import("./review").RevealedReview
): Promise<import("./review").RevealedReview> {
  const { canonicalReview } = await import("./review");

  const canonical = canonicalReview(revealed.review, revealed.nonce);
  const contentBytes = new TextEncoder().encode(canonical);

  // Export public key as SPKI
  const pubRaw = await crypto.subtle.exportKey("spki", identity.publicKey);
  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(pubRaw)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  // Sign
  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    identity.privateKey,
    contentBytes
  );
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return {
    ...revealed,
    signature: signatureBase64,
    signerPublicKey: publicKeyBase64,
  };
}

/**
 * Sign a gamification certificate using the unified identity.
 *
 * This function creates a signed achievement certificate that proves
 * the badge was earned by the identity holder.
 */
export async function signCertificateWithIdentity(
  identity: Identity,
  cert: import("./gamification").AchievementCertificate
): Promise<import("./gamification").AchievementCertificate & {
  signature?: string;
  signerPublicKey?: string;
  signerHandle?: string;
}> {
  // Create canonical content
  const canonical = JSON.stringify({
    id: cert.id,
    badgeId: cert.badgeId,
    badgeName: cert.badgeName,
    badgeTier: cert.badgeTier,
    xp: cert.xp,
    level: cert.level,
    countriesVisited: cert.countriesVisited,
    dossiersRead: cert.dossiersRead,
    campaignsGenerated: cert.campaignsGenerated,
    issuedAt: cert.issuedAt,
  });

  const contentBytes = new TextEncoder().encode(canonical);

  // Export public key as hex
  const pubRaw = await crypto.subtle.exportKey("raw", identity.publicKey);
  const publicKeyHex = bytesToHex(new Uint8Array(pubRaw));

  // Sign the hash
  const hashBuf = await crypto.subtle.digest("SHA-256", contentBytes);
  const signature = await signWithIdentity(identity, bytesToHex(new Uint8Array(hashBuf)));

  return {
    ...cert,
    signature,
    signerPublicKey: publicKeyHex,
    signerHandle: identity.handle,
  };
}
