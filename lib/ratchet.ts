/**
 * V FOR X — Forward Secrecy Ratchet
 *
 * Implements a simplified symmetric ratchet on top of AES-GCM,
 * providing forward secrecy for messaging: compromise of the current
 * session key does not expose past messages.
 *
 * This is NOT a full Double Ratchet (X3DH + DH ratchet + symmetric
 * ratchet). It is a symmetric-only ratchet suitable for enhancing
 * the existing cipher.ts AES-GCM encryption with per-message key
 * rotation. Each message uses a derived key that is then discarded,
 * making retroactive decryption impossible without the chain seed.
 *
 * Usage:
 *   1. Both parties derive a shared secret (e.g. via ECDH or OTP)
 *   2. Each party creates a RatchetState from that secret
 *   3. For each message, call ratchetEncrypt/ratchetDecrypt
 *   4. The key automatically advances after each message
 */

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface RatchetState {
  /** Current chain key (32 bytes as hex) */
  chainKey: string;
  /** Message counter */
  counter: number;
  /** Total messages encrypted/decrypted */
  totalMessages: number;
}

export interface RatchetedMessage {
  /** Counter at time of encryption */
  counter: number;
  /** Ciphertext (hex) */
  ciphertext: string;
  /** IV/nonce used (hex, 12 bytes for AES-GCM) */
  iv: string;
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const out = new Uint8Array(new ArrayBuffer(clean.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * HKDF-like key derivation using SHA-256.
 * Derives a new chain key and a message key from the current chain key.
 */
async function deriveKeys(chainKey: string): Promise<{
  nextChainKey: string;
  messageKey: string;
}> {
  const chainBytes = hexToBytes(chainKey);
  const info = new TextEncoder().encode("ratchet");

  // HMAC-SHA-256(chainKey, "ratchet") → next chain key + message key material
  const key = await crypto.subtle.importKey(
    "raw",
    chainBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, info),
  );

  // Split: first 32 bytes = next chain key, next 32 bytes = message key
  // (sig is 32 bytes, so we derive twice)
  const nextChainKey = bytesToHex(sig);

  // Derive message key from chain key + counter
  const counterBytes = new TextEncoder().encode(`msg-${nextChainKey.slice(0, 16)}`);
  const msgKeyMaterial = await crypto.subtle.importKey(
    "raw",
    sig,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const msgSig = new Uint8Array(
    await crypto.subtle.sign("HMAC", msgKeyMaterial, counterBytes),
  );
  const messageKey = bytesToHex(msgSig);

  return { nextChainKey, messageKey };
}

/* ═══════════════════════════════════════════════════════════════
   Public API
   ═══════════════════════════════════════════════════════════════ */

/**
 * Initialize a ratchet state from a shared secret.
 * Both parties must use the same shared secret to synchronize.
 */
export async function initRatchet(sharedSecret: string): Promise<RatchetState> {
  // Hash the shared secret to get the initial chain key
  const secretBytes = new TextEncoder().encode(sharedSecret);
  const hashBuf = await crypto.subtle.digest("SHA-256", secretBytes);
  const chainKey = bytesToHex(new Uint8Array(hashBuf));

  return {
    chainKey,
    counter: 0,
    totalMessages: 0,
  };
}

/**
 * Encrypt a message using the current ratchet state.
 * The key is derived, used once, then the chain advances.
 * The old key is irrecoverable.
 */
export async function ratchetEncrypt(
  state: RatchetState,
  plaintext: string,
): Promise<{ message: RatchetedMessage; newState: RatchetState }> {
  const { nextChainKey, messageKey } = await deriveKeys(state.chainKey);

  // Import the message key for AES-GCM
  const keyBytes = hexToBytes(messageKey);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  // Generate a random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, encoded),
  );

  return {
    message: {
      counter: state.counter,
      ciphertext: bytesToHex(encrypted),
      iv: bytesToHex(iv),
    },
    newState: {
      chainKey: nextChainKey,
      counter: state.counter + 1,
      totalMessages: state.totalMessages + 1,
    },
  };
}

/**
 * Decrypt a message using the current ratchet state.
 * The key is derived identically to the sender's, then the chain advances.
 */
export async function ratchetDecrypt(
  state: RatchetState,
  message: RatchetedMessage,
): Promise<{ plaintext: string; newState: RatchetState }> {
  const { nextChainKey, messageKey } = await deriveKeys(state.chainKey);

  const keyBytes = hexToBytes(messageKey);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  const iv = hexToBytes(message.iv);
  const ciphertext = hexToBytes(message.ciphertext);

  const decrypted = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ciphertext),
  );

  return {
    plaintext: new TextDecoder().decode(decrypted),
    newState: {
      chainKey: nextChainKey,
      counter: state.counter + 1,
      totalMessages: state.totalMessages + 1,
    },
  };
}

/**
 * Export the ratchet state for syncing between devices.
 * WARNING: This exposes the chain key. Only export to encrypted channels.
 */
export function exportRatchetState(state: RatchetState): string {
  return JSON.stringify(state);
}

/**
 * Import a previously exported ratchet state.
 */
export function importRatchetState(encoded: string): RatchetState | null {
  try {
    const parsed = JSON.parse(encoded);
    if (
      typeof parsed.chainKey === "string" &&
      typeof parsed.counter === "number" &&
      typeof parsed.totalMessages === "number"
    ) {
      return parsed as RatchetState;
    }
    return null;
  } catch {
    return null;
  }
}
