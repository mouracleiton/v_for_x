/**
 * V FOR X — OpenTimestamps Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  makeTimestamp,
  makeWitnessTimestamp,
  makeEvidenceTimestamp,
  encodeTimestampToken,
  decodeTimestampToken,
  verifyTimestamp,
  verifyTimestampToken,
  getCalendarDigest,
  upgradeWithProof,
  getSubmissionInstructions,
  OTS_PREFIX,
  cacheTimestamp,
  getCachedTimestamp,
  loadTimestamps,
  saveTimestamps,
} from "../lib/opentimestamps";

describe("OpenTimestamps", () => {
  const validDigest = "a".repeat(64); // Valid SHA-256 hex
  const mockLocalStorage = new Map<string, string>();

  beforeEach(() => {
    // Mock localStorage
    global.localStorage = {
      getItem: (key: string) => mockLocalStorage.get(key) ?? null,
      setItem: (key: string, value: string) => mockLocalStorage.set(key, value),
      removeItem: (key: string) => mockLocalStorage.delete(key),
      clear: () => mockLocalStorage.clear(),
      length: mockLocalStorage.size,
      key: (index: number) => Array.from(mockLocalStorage.keys())[index] ?? null,
    };
    mockLocalStorage.clear();
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  describe("makeTimestamp", () => {
    it("creates a timestamp token with valid digest", () => {
      const token = makeTimestamp(validDigest, "test-type");
      expect(token.v).toBe(1);
      expect(token.attestation.digest).toBe(validDigest);
      expect(token.attestation.type).toBe("test-type");
      expect(token.attestation.timestamp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
    });

    it("rejects invalid digest format", () => {
      expect(() => makeTimestamp("invalid", "test-type")).toThrow("Invalid SHA-256 digest format");
    });

    it("includes description when provided", () => {
      const token = makeTimestamp(validDigest, "test-type", "Test description");
      expect(token.attestation.description).toBe("Test description");
    });
  });

  describe("makeWitnessTimestamp", () => {
    it("creates VFXOTS1 token for witness root", () => {
      const token = makeWitnessTimestamp(validDigest, 42);
      expect(token).toMatch(/^VFXOTS1:/);
      expect(token.length).toBeGreaterThan(OTS_PREFIX.length);

      const decoded = decodeTimestampToken(token);
      expect(decoded.attestation.type).toBe("witness-root");
      expect(decoded.attestation.digest).toBe(validDigest);
    });
  });

  describe("makeEvidenceTimestamp", () => {
    it("creates VFXOTS1 token for evidence root", () => {
      const token = makeEvidenceTimestamp(validDigest, 10);
      expect(token).toMatch(/^VFXOTS1:/);

      const decoded = decodeTimestampToken(token);
      expect(decoded.attestation.type).toBe("evidence-root");
      expect(decoded.attestation.digest).toBe(validDigest);
    });
  });

  describe("encodeTimestampToken", () => {
    it("encodes token to VFXOTS1 format", () => {
      const token = makeTimestamp(validDigest, "test");
      const encoded = encodeTimestampToken(token);
      expect(encoded).toMatch(/^VFXOTS1:/);
      expect(encoded.length).toBeGreaterThan(OTS_PREFIX.length);
    });
  });

  describe("decodeTimestampToken", () => {
    it("decodes valid VFXOTS1 token", () => {
      const token = makeTimestamp(validDigest, "test");
      const encoded = encodeTimestampToken(token);
      const decoded = decodeTimestampToken(encoded);

      expect(decoded.v).toBe(token.v);
      expect(decoded.attestation.digest).toBe(token.attestation.digest);
      expect(decoded.attestation.type).toBe(token.attestation.type);
    });

    it("rejects non-VFXOTS1 token", () => {
      expect(() => decodeTimestampToken("INVALID")).toThrow("Not a VFXOTS1 token");
    });

    it("rejects malformed base64", () => {
      expect(() => decodeTimestampToken("VFXOTS1:!!!invalid!!!")).toThrow();
    });
  });

  describe("verifyTimestamp", () => {
    it("verifies valid self-signed timestamp", async () => {
      const token = makeTimestamp(validDigest, "test");
      const result = await verifyTimestamp(token);

      expect(result.ok).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("rejects invalid digest format", async () => {
      const token = makeTimestamp(validDigest, "test");
      token.attestation.digest = "invalid";
      const result = await verifyTimestamp(token);

      expect(result.ok).toBe(false);
      expect(result.reason).toBe("Invalid digest format");
    });

    it("rejects future timestamps", async () => {
      const token = makeTimestamp(validDigest, "test");
      token.attestation.timestamp = Math.floor(Date.now() / 1000) + 1000;
      const result = await verifyTimestamp(token);

      expect(result.ok).toBe(false);
      expect(result.reason).toBe("Timestamp is in the future");
    });
  });

  describe("verifyTimestampToken", () => {
    it("verifies encoded token string", async () => {
      const token = makeTimestamp(validDigest, "test");
      const encoded = encodeTimestampToken(token);
      const result = await verifyTimestampToken(encoded);

      expect(result.ok).toBe(true);
    });

    it("handles invalid token", async () => {
      const result = await verifyTimestampToken("INVALID");
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("Failed to decode token");
    });
  });

  describe("getCalendarDigest", () => {
    it("returns digest for calendar submission", () => {
      const token = makeTimestamp(validDigest, "test");
      const digest = getCalendarDigest(token);

      expect(digest).toBe(validDigest);
    });
  });

  describe("getSubmissionInstructions", () => {
    it("generates submission instructions", () => {
      const token = makeTimestamp(validDigest, "test");
      const instructions = getSubmissionInstructions(token);

      expect(instructions).toContain(validDigest);
      expect(instructions).toContain("calendar.opentimestamps.org");
      expect(instructions).toContain("bitcoin");
    });
  });

  describe("upgradeWithProof", () => {
    it("upgrades token with calendar proof", () => {
      const token = makeTimestamp(validDigest, "test");
      const proof = "mock-calendar-proof";
      const blockHeight = 12345;

      const upgraded = upgradeWithProof(token, proof, blockHeight);

      expect(upgraded.proof).toBeDefined();
      expect(upgraded.proof?.otsProof).toBe(proof);
      expect(upgraded.proof?.blockHeight).toBe(blockHeight);
    });

    it("preserves original attestation", () => {
      const token = makeTimestamp(validDigest, "test", "Test description");
      const upgraded = upgradeWithProof(token, "proof", 123);

      expect(upgraded.attestation.digest).toBe(token.attestation.digest);
      expect(upgraded.attestation.type).toBe(token.attestation.type);
      expect(upgraded.attestation.description).toBe(token.attestation.description);
    });
  });

  describe("timestamp caching", () => {
    it("caches and retrieves timestamp", () => {
      const digest = "b".repeat(64);
      const token = makeWitnessTimestamp(digest, 1);

      cacheTimestamp(digest, token);
      const retrieved = getCachedTimestamp(digest);

      expect(retrieved).toBe(token);
    });

    it("returns null for non-cached digest", () => {
      const result = getCachedTimestamp("c".repeat(64));
      expect(result).toBeNull();
    });

    it("persists cache across save/load cycles", () => {
      const digest = "d".repeat(64);
      const token = makeWitnessTimestamp(digest, 1);

      cacheTimestamp(digest, token);
      const loaded1 = loadTimestamps();
      const loaded2 = loadTimestamps();

      expect(loaded1.get(digest)).toBe(token);
      expect(loaded2.get(digest)).toBe(token);
    });

    it("handles localStorage errors gracefully", () => {
      // Broken localStorage
      global.localStorage = null as any;

      expect(() => cacheTimestamp("x".repeat(64), "token")).not.toThrow();
      expect(() => saveTimestamps(new Map())).not.toThrow();
      expect(loadTimestamps()).toBeInstanceOf(Map);
    });
  });

  describe("integration test", () => {
    it("full workflow: create, encode, decode, verify", async () => {
      // Create witness timestamp
      const token = makeWitnessTimestamp(validDigest, 100);
      expect(token).toMatch(/^VFXOTS1:/);

      // Decode
      const decoded = decodeTimestampToken(token);
      expect(decoded.attestation.type).toBe("witness-root");
      expect(decoded.attestation.digest).toBe(validDigest);

      // Verify
      const verifyResult = await verifyTimestamp(decoded);
      expect(verifyResult.ok).toBe(true);

      // Cache
      cacheTimestamp(validDigest, token);
      expect(getCachedTimestamp(validDigest)).toBe(token);

      // Verify encoded token
      const tokenVerifyResult = await verifyTimestampToken(token);
      expect(tokenVerifyResult.ok).toBe(true);
    });
  });
});
