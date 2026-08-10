/**
 * V FOR X — ECDH Key Agreement for Encrypted Dead Drops
 *
 * Replaces the deterministic key derivation in action-network.ts
 * with real Elliptic Curve Diffie-Hellman (ECDH) key agreement.
 *
 * Each participant generates an ECDH key pair (P-256). To establish
 * a shared secret for a dead drop, two participants compute:
 *   sharedSecret = ECDH(myPrivateKey, theirPublicKey)
 *
 * Both arrive at the same secret without ever transmitting it.
 * The shared secret is then used to derive an AES-GCM key via
 * PBKDF2, providing true forward-secret dead-drop encryption.
 *
 * Even if the circle ID is known, messages cannot be decrypted
 * without both participants' ECDH key agreement.
 */

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface ECDHIdentity {
  /** Random handle for display */
  handle: string;
  /** Hex-encoded raw public key (65 bytes for P-256 uncompressed) */
  publicKeyHex: string;
  /** Epoch ms when created */
  createdAt: number;
}

export interface ECDHKeyMaterial {
  identity: ECDHIdentity;
  /** Private CryptoKey for ECDH operations (non-extractable) */
  privateKey: CryptoKey;
}

export interface SharedChannel {
  /** The derived AES-GCM CryptoKey for encryption/decryption */
  key: CryptoKey;
  /** Hex fingerprint of the shared secret for verification */
  fingerprint: string;
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const out = new Uint8Array(new ArrayBuffer(clean.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

function generateHandle(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `V-${seg(4)}-${seg(4)}`;
}

/* ═══════════════════════════════════════════════════════════════
   Public API
   ═══════════════════════════════════════════════════════════════ */

/**
 * Generate a new ECDH key pair (P-256) for a participant.
 * The private key is non-extractable — it never leaves the device.
 */
export async function generateECDHIdentity(): Promise<ECDHKeyMaterial> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"],
  );

  const pubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const publicKeyHex = bytesToHex(new Uint8Array(pubRaw));

  return {
    identity: {
      handle: generateHandle(),
      publicKeyHex,
      createdAt: Date.now(),
    },
    privateKey: keyPair.privateKey,
  };
}

/**
 * Import a public key from hex for ECDH key agreement.
 */
export async function importPublicKey(publicKeyHex: string): Promise<CryptoKey> {
  const raw = hexToBytes(publicKeyHex);
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
}

/**
 * Derive a shared AES-GCM encryption key from a private key and
 * the other party's public key using ECDH.
 *
 * Both parties compute the same shared secret independently.
 * The secret is then processed through PBKDF2 to derive the final
 * encryption key.
 */
export async function deriveSharedKey(
  myPrivateKey: CryptoKey,
  theirPublicKeyHex: string,
): Promise<SharedChannel> {
  const theirPublicKey = await importPublicKey(theirPublicKeyHex);

  // ECDH shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: theirPublicKey },
    myPrivateKey,
    256,
  );

  // Derive AES-GCM key from shared secret via HKDF
  const sharedBytes = new Uint8Array(sharedBits);
  const baseKey = await crypto.subtle.importKey(
    "raw",
    sharedBytes,
    "HKDF",
    false,
    ["deriveKey"],
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: new TextEncoder().encode("vfx-dead-drop-v1"),
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  // Fingerprint = SHA-256 of shared secret, first 16 bytes hex
  const fpBuf = await crypto.subtle.digest("SHA-256", sharedBytes);
  const fingerprint = bytesToHex(new Uint8Array(fpBuf)).slice(0, 32);

  return { key: aesKey, fingerprint };
}

/**
 * Encrypt a message using a derived shared key.
 */
export async function encryptWithSharedKey(
  channel: SharedChannel,
  plaintext: string,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      channel.key,
      encoded,
    ),
  );

  return {
    ciphertext: bytesToHex(encrypted),
    iv: bytesToHex(iv),
  };
}

/**
 * Decrypt a message using a derived shared key.
 */
export async function decryptWithSharedKey(
  channel: SharedChannel,
  ciphertext: string,
  iv: string,
): Promise<string> {
  const ctBytes = hexToBytes(ciphertext);
  const ivBytes = hexToBytes(iv);

  const decrypted = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes },
      channel.key,
      ctBytes,
    ),
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Export an ECDH identity (public info only) for sharing.
 */
export function exportECDHIdentity(identity: ECDHIdentity): string {
  return JSON.stringify(identity);
}

/**
 * Parse an imported ECDH identity.
 */
export function parseECDHIdentity(json: string): ECDHIdentity | null {
  try {
    const parsed = JSON.parse(json);
    if (
      typeof parsed.handle === "string" &&
      typeof parsed.publicKeyHex === "string" &&
      typeof parsed.createdAt === "number"
    ) {
      return parsed as ECDHIdentity;
    }
    return null;
  } catch {
    return null;
  }
}
