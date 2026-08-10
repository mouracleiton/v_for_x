import { describe, it, expect, beforeAll } from "vitest";
import {
  generateOTP,
  encryptWithOTP,
  decryptWithOTP,
  embedInImage,
  extractFromImage,
  maxMessageSize,
  encodeWithCodebook,
  decodeWithCodebook,
  STANDARD_CODEBOOK,
} from "../lib/cipher";

// Polyfill ImageData for Node.js test environment
if (typeof globalThis.ImageData === "undefined") {
  class ImageDataPolyfill {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    colorSpace: string = "srgb";
    constructor(width: number, height: number);
    constructor(data: Uint8ClampedArray, width: number, height?: number);
    constructor(...args: number[] | [Uint8ClampedArray, number, number?]) {
      if (args[0] instanceof Uint8ClampedArray) {
        this.data = args[0];
        this.width = args[1];
        this.height = args[2] ?? args[0].length / (4 * args[1]);
      } else {
        const [w, h] = args as number[];
        this.width = w;
        this.height = h;
        this.data = new Uint8ClampedArray(w * h * 4);
      }
    }
  }
  (globalThis as any).ImageData = ImageDataPolyfill;
}

describe("cipher.ts", () => {
  describe("One-Time Pad", () => {
    it("should generate a pad of the correct length", () => {
      const pad = generateOTP(32);
      expect(pad).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(pad).toMatch(/^[0-9a-f]+$/);
    });

    it("should reject zero or negative lengths", () => {
      expect(() => generateOTP(0)).toThrow();
      expect(() => generateOTP(-1)).toThrow();
    });

    it("should encrypt and decrypt correctly", () => {
      const message = "Hello, resistance.";
      const msgBytes = new TextEncoder().encode(message);
      const pad = generateOTP(msgBytes.length + 10);
      const ct = encryptWithOTP(message, pad);
      const pt = decryptWithOTP(ct, pad);
      expect(pt).toBe(message);
    });

    it("should produce different ciphertext for different pads", () => {
      const message = "Secret message";
      const msgBytes = new TextEncoder().encode(message);
      const pad1 = generateOTP(msgBytes.length);
      const pad2 = generateOTP(msgBytes.length);
      const ct1 = encryptWithOTP(message, pad1);
      const ct2 = encryptWithOTP(message, pad2);
      expect(ct1).not.toBe(ct2);
    });

    it("should fail when pad is too short", () => {
      const message = "This is a long message";
      const shortPad = generateOTP(5);
      expect(() => encryptWithOTP(message, shortPad)).toThrow("Pad too short");
    });

    it("should decrypt to garbage with wrong pad", () => {
      const message = "Correct message";
      const msgBytes = new TextEncoder().encode(message);
      const pad1 = generateOTP(msgBytes.length);
      const pad2 = generateOTP(msgBytes.length);
      const ct = encryptWithOTP(message, pad1);
      const wrong = decryptWithOTP(ct, pad2);
      expect(wrong).not.toBe(message);
    });
  });

  describe("LSB Steganography", () => {
    function makeImageData(width: number, height: number): ImageData {
      return new ImageData(width, height);
    }

    it("should embed and extract a message", () => {
      const img = makeImageData(100, 100);
      const message = "Hidden payload for the resistance";
      const stego = embedInImage(img, message);
      const extracted = extractFromImage(stego);
      expect(extracted).toBe(message);
    });

    it("should return null when no message is embedded", () => {
      const img = makeImageData(100, 100);
      const result = extractFromImage(img);
      expect(result).toBeNull();
    });

    it("should handle empty message gracefully", () => {
      const img = makeImageData(50, 50);
      // An empty string message should fail or return null on extraction
      // because msgLen would be 0 which we reject
      const stego = embedInImage(img, "");
      const extracted = extractFromImage(stego);
      expect(extracted).toBeNull();
    });

    it("should compute correct max message size", () => {
      const size = maxMessageSize(100, 100);
      expect(size).toBeGreaterThan(0);
      // 100x100 image, 3 channels per pixel, 2 bits per channel
      // = 30000 channels * 2 bits = 60000 bits = 7500 bytes
      // minus header (4 bytes for "VFX1" + 4 bytes for length = 8 bytes)
      expect(size).toBeGreaterThan(7000);
    });

    it("should throw when message is too large", () => {
      const img = makeImageData(2, 2);
      const bigMessage = "x".repeat(1000);
      expect(() => embedInImage(img, bigMessage)).toThrow("too large");
    });

    it("should not modify the original image", () => {
      const img = makeImageData(50, 50);
      const originalData = new Uint8ClampedArray(img.data);
      embedInImage(img, "test message");
      expect(Array.from(img.data)).toEqual(Array.from(originalData));
    });
  });

  describe("Field Codebook", () => {
    it("should encode known phrases to codes", () => {
      const message = "Need immediate extraction from the area.";
      const encoded = encodeWithCodebook(message);
      expect(encoded).toContain("[AB]");
      expect(encoded).not.toContain("Need immediate extraction");
    });

    it("should decode codes back to phrases", () => {
      const message = "[AB] from the area.";
      const decoded = decodeWithCodebook(message);
      expect(decoded).toContain("Need immediate extraction");
    });

    it("should round-trip encode and decode", () => {
      const message = "All clear / safe. Need supplies. Evidence secured.";
      const encoded = encodeWithCodebook(message);
      const decoded = decodeWithCodebook(encoded);
      expect(decoded).toBe(message);
    });

    it("should have at least 15 entries in standard codebook", () => {
      expect(STANDARD_CODEBOOK.length).toBeGreaterThanOrEqual(15);
    });
  });
});
