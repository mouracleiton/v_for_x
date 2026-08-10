/**
 * V FOR X — The Cipher (Steganography + One-Time Pad)
 *
 * Two complementary tools for hiding the existence of messages:
 *
 * 1. ONE-TIME PAD (OTP): Information-theoretically secure encryption.
 *    XOR the message with a truly random key of equal length.
 *    Each pad is single-use. Distribute pads in person.
 *
 * 2. LSB STEGANOGRAPHY: Hide a message in the least-significant
 *    bits of an image's pixel data. The image looks unchanged but
 *    carries a hidden payload. Resists casual inspection.
 *
 * 3. FIELD CODEBOOK: A fixed mapping of code words to meanings,
 *    reducing message length for burst transmission over radio/QR.
 *
 * All operations are client-side only. No data leaves the browser.
 */

/* ═══════════════════════════════════════════════════════════
   ONE-TIME PAD
   ═══════════════════════════════════════════════════════════ */

/**
 * Generate a random one-time pad as a hex string.
 * The pad length matches the message byte length.
 */
export function generateOTP(byteLength: number): string {
  if (byteLength < 1) throw new Error("Pad length must be at least 1 byte");
  const arr = new Uint8Array(byteLength);
  crypto.getRandomValues(arr);
  return bytesToHex(arr);
}

/**
 * Encrypt a message with a one-time pad (XOR).
 * Returns hex-encoded ciphertext. The pad must be at least as
 * long as the message (in bytes).
 */
export function encryptWithOTP(message: string, padHex: string): string {
  const msgBytes = new TextEncoder().encode(message);
  const padBytes = hexToBytes(padHex);
  if (padBytes.length < msgBytes.length) {
    throw new Error(
      `Pad too short: message is ${msgBytes.length} bytes, pad is ${padBytes.length} bytes. ` +
        "OTP requires a pad at least as long as the message.",
    );
  }
  const ct = new Uint8Array(msgBytes.length);
  for (let i = 0; i < msgBytes.length; i++) {
    ct[i] = msgBytes[i] ^ padBytes[i];
  }
  return bytesToHex(ct);
}

/**
 * Decrypt a one-time-pad ciphertext back to plaintext.
 */
export function decryptWithOTP(ctHex: string, padHex: string): string {
  const ctBytes = hexToBytes(ctHex);
  const padBytes = hexToBytes(padHex);
  if (padBytes.length < ctBytes.length) {
    throw new Error("Pad too short for this ciphertext");
  }
  const pt = new Uint8Array(ctBytes.length);
  for (let i = 0; i < ctBytes.length; i++) {
    pt[i] = ctBytes[i] ^ padBytes[i];
  }
  return new TextDecoder().decode(pt);
}

/* ═══════════════════════════════════════════════════════════
   LSB STEGANOGRAPHY
   ═══════════════════════════════════════════════════════════ */

/** MAGIC header so extract knows a payload is present */
const STEG_MAGIC = "VFX1";

/**
 * Embed a text message into an image's pixel data using LSB steganography.
 * Operates on an ImageData object (from a canvas).
 *
 * Uses 2 bits per channel (RGB) of each pixel for a balance of capacity
 * and imperceptibility. A 4-byte magic header + 4-byte length prefix
 * precede the payload so extraction can verify integrity.
 *
 * Returns a NEW ImageData — the original is not mutated.
 */
export function embedInImage(imageData: ImageData, message: string): ImageData {
  const msgBytes = new TextEncoder().encode(message);
  const header = new TextEncoder().encode(STEG_MAGIC);
  const lenBytes = new Uint8Array(4);
  const view = new DataView(lenBytes.buffer);
  view.setUint32(0, msgBytes.length, false);

  const payload = new Uint8Array(header.length + lenBytes.length + msgBytes.length);
  payload.set(header, 0);
  payload.set(lenBytes, header.length);
  payload.set(msgBytes, header.length + lenBytes.length);

  // 2 bits per channel → need payload.length * 4 bits per channel slot
  const totalBits = payload.length * 8;
  const bitsPerChannel = 2;
  const channelsNeeded = Math.ceil(totalBits / bitsPerChannel);
  const availableChannels = imageData.width * imageData.height * 3; // RGB only

  if (channelsNeeded > availableChannels) {
    throw new Error(
      `Message too large for this image. Need ${channelsNeeded} channels, ` +
        `have ${availableChannels}. Use a larger image or shorter message.`,
    );
  }

  const out = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height,
  );

  const bits: number[] = [];
  for (const byte of payload) {
    for (let bit = 7; bit >= 0; bit--) {
      bits.push((byte >> bit) & 1);
    }
  }

  let bitIdx = 0;
  for (let i = 0; i < out.data.length && bitIdx < bits.length; i += 4) {
    for (let c = 0; c < 3 && bitIdx < bits.length; c++) {
      const channel = i + c;
      const b0 = bits[bitIdx] ?? 0;
      const b1 = bits[bitIdx + 1] ?? 0;
      out.data[channel] = (out.data[channel] & 0xfc) | (b0 << 1) | b1;
      bitIdx += 2;
    }
  }

  return out;
}

/**
 * Extract a hidden message from an image that was embedded with embedInImage.
 * Returns null if no valid V FX steganographic payload is found.
 */
export function extractFromImage(imageData: ImageData): string | null {
  const bits: number[] = [];
  let channelCount = 0;
  const maxBits = imageData.width * imageData.height * 3 * 2;
  const headerByteLen = new TextEncoder().encode(STEG_MAGIC).length + 4;
  const minBits = headerByteLen * 8;

  for (let i = 0; i < imageData.data.length && bits.length < maxBits; i += 4) {
    for (let c = 0; c < 3; c++) {
      if (bits.length >= maxBits) break;
      const channel = i + c;
      bits.push((imageData.data[channel] >> 1) & 1);
      bits.push(imageData.data[channel] & 1);
      channelCount++;
      if (channelCount * 2 >= minBits && bits.length >= minBits) {
        break;
      }
    }
    if (channelCount * 2 >= minBits && bits.length >= minBits) {
      break;
    }
  }

  const bytes = bitsToBytes(bits);
  const headerBytes = new TextEncoder().encode(STEG_MAGIC);
  let match = true;
  for (let i = 0; i < headerBytes.length; i++) {
    if (bytes[i] !== headerBytes[i]) {
      match = false;
      break;
    }
  }
  if (!match) return null;

  const lenView = new DataView(bytes.buffer, headerBytes.length, 4);
  const msgLen = lenView.getUint32(0, false);
  const maxPossible = Math.floor(maxBits / 8) - headerBytes.length - 4;
  if (msgLen > maxPossible || msgLen === 0) return null;

  const allBits: number[] = [];
  let chIdx = 0;
  for (let i = 0; i < imageData.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const channel = i + c;
      allBits.push((imageData.data[channel] >> 1) & 1);
      allBits.push(imageData.data[channel] & 1);
      chIdx++;
      if (chIdx >= Math.ceil((headerBytes.length + 4 + msgLen) * 4)) break;
    }
    if (chIdx >= Math.ceil((headerBytes.length + 4 + msgLen) * 4)) break;
  }

  const allBytes = bitsToBytes(allBits);
  const msgStart = headerBytes.length + 4;
  const msgBytes = allBytes.slice(msgStart, msgStart + msgLen);
  return new TextDecoder().decode(msgBytes);
}

/**
 * Calculate the maximum message size (in characters) that can
 * be embedded in an image of the given dimensions.
 */
export function maxMessageSize(width: number, height: number): number {
  const totalChannels = width * height * 3;
  const totalBits = totalChannels * 2;
  const totalBytes = Math.floor(totalBits / 8);
  const headerLen = new TextEncoder().encode(STEG_MAGIC).length + 4;
  return Math.max(0, totalBytes - headerLen);
}

/* ═══════════════════════════════════════════════════════════
   FIELD CODEBOOK
   ═══════════════════════════════════════════════════════════ */

export interface CodebookEntry {
  code: string;
  meaning: string;
}

/**
 * A standard field codebook for burst communication.
 * Designed for use over radio, QR codes, or dead drops where
 * bandwidth is extremely limited. Each code is 2-3 characters.
 */
export const STANDARD_CODEBOOK: CodebookEntry[] = [
  { code: "AA", meaning: "All clear / safe" },
  { code: "AB", meaning: "Need immediate extraction" },
  { code: "AC", meaning: "Under surveillance" },
  { code: "AD", meaning: "Document drop completed" },
  { code: "AE", meaning: "Meeting confirmed" },
  { code: "AF", meaning: "Meeting cancelled — compromised" },
  { code: "AG", meaning: "Move to backup location" },
  { code: "AH", meaning: "Await further instructions" },
  { code: "BA", meaning: "Medical emergency" },
  { code: "BB", meaning: "Need supplies" },
  { code: "BC", meaning: "Have supplies to share" },
  { code: "BD", meaning: "Network compromised — burn keys" },
  { code: "BE", meaning: "New keys at dead drop 7" },
  { code: "BF", meaning: "Do not contact for 48h" },
  { code: "CA", meaning: "Evidence secured" },
  { code: "CB", meaning: "Evidence destroyed per protocol" },
  { code: "CC", meaning: "Witness relocated safely" },
  { code: "CD", meaning: "Cannot verify source" },
  { code: "CE", meaning: "Source confirmed reliable" },
  { code: "CF", meaning: "Release canary payload" },
];

/**
 * Encode a message using the codebook — replaces known phrases
 * with their short codes to minimize message length.
 */
export function encodeWithCodebook(message: string, codebook: CodebookEntry[] = STANDARD_CODEBOOK): string {
  let result = message;
  for (const entry of codebook) {
    result = result.replaceAll(entry.meaning, `[${entry.code}]`);
  }
  return result;
}

/**
 * Decode a codebook-encoded message back to full text.
 */
export function decodeWithCodebook(message: string, codebook: CodebookEntry[] = STANDARD_CODEBOOK): string {
  let result = message;
  for (const entry of codebook) {
    result = result.replaceAll(`[${entry.code}]`, entry.meaning);
  }
  return result;
}

/* ═══════════════════════════════════════════════════════════
   HEX / BYTE UTILITIES
   ═══════════════════════════════════════════════════════════ */

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 !== 0 ? "0" + hex : hex;
  const bytes = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bitsToBytes(bits: number[]): Uint8Array {
  const byteLen = Math.floor(bits.length / 8);
  const bytes = new Uint8Array(byteLen);
  for (let i = 0; i < byteLen; i++) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit++) {
      byte = (byte << 1) | (bits[i * 8 + bit] ?? 0);
    }
    bytes[i] = byte;
  }
  return bytes;
}
