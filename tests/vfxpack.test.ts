import { describe, it, expect, beforeEach } from "vitest";
import {
  VFXPACK_PREFIX,
  MAX_TOKENS_IN_PACK,
  MAX_LABEL_LENGTH,
  createPack,
  createSignedPack,
  createPackWithIdentity,
  validatePack,
  encodePack,
  decodePack,
  decodeAndValidatePack,
  mergePacks,
  mergePackTokens,
  extractTokens,
  filterPackByType,
  summarizePack,
  packFingerprint,
  canonicalPackContent,
  hashPackContent,
  type VfxPack,
} from "../lib/vfxpack";
import { detectToken } from "../lib/tokens";

/* ═══════════════════════════════════════════════════════════════
   Test helpers
   ═══════════════════════════════════════════════════════════════ */

// Mock some VFX* tokens for testing
const MOCK_TOKENS = {
  witness1: "VFXWIT1:eyJpZCI6IndpdC0xIiwidGV4dCI6IlRlc3Qgc3RhdGVtZW50IiwiaXNvMyI6IlVTQVIsInRzIjoxNjk5NjY0MDAwMDAsInByZXZIYXNoIjoiMDcwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCIsImhhc2giOiJhYmMxMjM0NTY3ODkwYWJjMTIzNDU2Nzg5MGFiYzEyMzQ1Njc4OTBhYmMxIn0",
  witness2: "VFXWIT1:eyJpZCI6IndpdC0yIiwidGV4dCI6IkFub3RoZXIgc3RhdGVtZW50IiwiaXNvMyI6IlBSTiIsInRzIjoxNjk5NjY0MTAwMDAsInByZXZIYXNoIjoiMDcwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCIsImhhc2giOiJkZWYxMjM0NTY3ODkwZGVmMTIzNDU2Nzg5MGRlZjEyMzQ1Njc4OTBkZWYxIn0",
  identity: "VFXID1:eyJ2ZXJzaW9uIjoxLCJoYW5kbGUiOiJWLUFCQ0QtRUZHSCIsInB1YmxpY0tleUhleCI6IjEyMzQ1Njc4YWJjZGVmIiwic2lnbmF0dXJlIjoiYWJjZGVmMTIzNDU2Nzg5In0",
  sig1: "VFXSIG1:b3V0ZXJzcGFjZQ",
  invalid: "NOT-A-TOKEN",
  empty: "",
};

// Generate a test keypair
async function generateTestKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
}

describe("vfxpack.ts", () => {
  describe("createPack", () => {
    it("creates an unsigned pack from tokens", () => {
      const tokens = [MOCK_TOKENS.witness1, MOCK_TOKENS.sig1];
      const pack = createPack(tokens);

      expect(pack.format).toBe("vfx-pack-1");
      expect(pack.version).toBe(1);
      expect(pack.tokens).toEqual(tokens);
      expect(pack.signature).toBeUndefined();
      expect(pack.signerPublicKey).toBeUndefined();
      expect(pack.contentHash).toBeUndefined();
    });

    it("creates a pack with metadata", () => {
      const tokens = [MOCK_TOKENS.witness1];
      const pack = createPack(tokens, {
        label: "Test Pack",
        description: "A test description",
        iso3: "USA",
        kind: "crisis",
        ts: 1699664000000,
      });

      expect(pack.label).toBe("Test Pack");
      expect(pack.description).toBe("A test description");
      expect(pack.iso3).toBe("USA");
      expect(pack.kind).toBe("crisis");
      expect(pack.ts).toBe(1699664000000);
    });

    it("trims whitespace from tokens", () => {
      const tokens = ["  VFXWIT1:test  ", "\nVFXSIG1:foo\n"];
      const pack = createPack(tokens);

      expect(pack.tokens).toEqual(["VFXWIT1:test", "VFXSIG1:foo"]);
    });

    it("throws on non-array tokens", () => {
      expect(() => createPack("not an array" as any)).toThrow("tokens must be an array");
    });

    it("throws on too many tokens", () => {
      const tokens = Array(MAX_TOKENS_IN_PACK + 1).fill(MOCK_TOKENS.witness1);
      expect(() => createPack(tokens)).toThrow(/Too many tokens/);
    });

    it("throws on empty tokens", () => {
      expect(() => createPack(["", MOCK_TOKENS.witness1])).toThrow("Empty token found");
    });

    it("throws on non-string tokens", () => {
      expect(() => createPack([123 as any])).toThrow("All tokens must be strings");
    });

    it("throws on label too long", () => {
      const tokens = [MOCK_TOKENS.witness1];
      const longLabel = "x".repeat(MAX_LABEL_LENGTH + 1);
      expect(() => createPack(tokens, { label: longLabel })).toThrow(/Label too long/);
    });

    it("throws on invalid iso3", () => {
      const tokens = [MOCK_TOKENS.witness1];
      expect(() => createPack(tokens, { iso3: "XX" })).toThrow("iso3 must be a 3-letter country code");
    });

    it("normalizes iso3 to uppercase", () => {
      const tokens = [MOCK_TOKENS.witness1];
      const pack = createPack(tokens, { iso3: "usa" });
      expect(pack.iso3).toBe("USA");
    });

    it("defaults to general kind when not specified", () => {
      const tokens = [MOCK_TOKENS.witness1];
      const pack = createPack(tokens);
      expect(pack.kind).toBe("general");
    });

    it("defaults ts to now when not specified", () => {
      const tokens = [MOCK_TOKENS.witness1];
      const before = Date.now();
      const pack = createPack(tokens);
      const after = Date.now();
      expect(pack.ts).toBeGreaterThanOrEqual(before);
      expect(pack.ts).toBeLessThanOrEqual(after);
    });
  });

  describe("canonicalPackContent", () => {
    it("produces deterministic JSON", () => {
      const pack = createPack([MOCK_TOKENS.witness1], {
        label: "Test",
        description: "Desc",
        iso3: "USA",
        kind: "crisis",
        ts: 1234567890,
      });

      const content = canonicalPackContent(pack);
      const parsed = JSON.parse(content);

      expect(parsed).toEqual({
        version: 1,
        tokens: [MOCK_TOKENS.witness1],
        label: "Test",
        description: "Desc",
        iso3: "USA",
        kind: "crisis",
        ts: 1234567890,
      });
    });

    it("handles missing optional fields with empty strings", () => {
      const pack = createPack([MOCK_TOKENS.witness1], { ts: 1234567890 });
      const content = canonicalPackContent(pack);
      const parsed = JSON.parse(content);

      expect(parsed.label).toBe("");
      expect(parsed.description).toBe("");
      expect(parsed.iso3).toBe("");
      expect(parsed.kind).toBe("");
    });
  });

  describe("hashPackContent", () => {
    it("computes SHA-256 hash of canonical content", async () => {
      const pack = createPack([MOCK_TOKENS.witness1], { ts: 1234567890 });
      const hash = await hashPackContent(pack);

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("is deterministic for same content", async () => {
      const pack1 = createPack([MOCK_TOKENS.witness1], { ts: 1234567890 });
      const pack2 = createPack([MOCK_TOKENS.witness1], { ts: 1234567890 });

      const hash1 = await hashPackContent(pack1);
      const hash2 = await hashPackContent(pack2);

      expect(hash1).toBe(hash2);
    });

    it("differs for different content", async () => {
      const pack1 = createPack([MOCK_TOKENS.witness1], { ts: 1234567890 });
      const pack2 = createPack([MOCK_TOKENS.witness2], { ts: 1234567890 });

      const hash1 = await hashPackContent(pack1);
      const hash2 = await hashPackContent(pack2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("createSignedPack", () => {
    it("creates and signs a pack", async () => {
      const tokens = [MOCK_TOKENS.witness1, MOCK_TOKENS.sig1];
      const keyPair = await generateTestKeyPair();

      const pack = await createSignedPack(tokens, keyPair, {
        label: "Signed Test Pack",
      });

      expect(pack.format).toBe("vfx-pack-1");
      expect(pack.tokens).toEqual(tokens);
      expect(pack.label).toBe("Signed Test Pack");
      expect(pack.signerPublicKey).toBeTruthy();
      expect(pack.signature).toBeTruthy();
      expect(pack.contentHash).toBeTruthy();
    });

    it("signature can be verified", async () => {
      const tokens = [MOCK_TOKENS.witness1];
      const keyPair = await generateTestKeyPair();

      const pack = await createSignedPack(tokens, keyPair);
      const result = await validatePack(pack);

      expect(result.ok).toBe(true);
    });
  });

  describe("validatePack", () => {
    it("validates a well-formed pack", async () => {
      const tokens = [MOCK_TOKENS.witness1];
      const pack = createPack(tokens);
      const result = await validatePack(pack);

      expect(result.ok).toBe(true);
      expect(result.pack).toBe(pack);
      expect(result.tokenTypes).toContain("VFXWIT1");
      expect(result.tokenCounts["VFXWIT1"]).toBe(1);
    });

    it("validates a signed pack with good signature", async () => {
      const tokens = [MOCK_TOKENS.witness1];
      const keyPair = await generateTestKeyPair();
      const pack = await createSignedPack(tokens, keyPair);
      const result = await validatePack(pack);

      expect(result.ok).toBe(true);
    });

    it("rejects pack with bad format", async () => {
      const pack = { format: "bad-format", version: 1, tokens: [], ts: 0 } as unknown as VfxPack;
      const result = await validatePack(pack);

      expect(result.ok).toBe(false);
      expect(result.reason).toContain("invalid format");
    });

    it("rejects pack with unsupported version", async () => {
      const pack = { format: "vfx-pack-1", version: 99, tokens: [], ts: 0 } as unknown as VfxPack;
      const result = await validatePack(pack);

      expect(result.ok).toBe(false);
      expect(result.reason).toContain("unsupported version");
    });

    it("rejects pack with non-array tokens", async () => {
      const pack = { format: "vfx-pack-1", version: 1, tokens: "not-array" as any, ts: 0 } as VfxPack;
      const result = await validatePack(pack);

      expect(result.ok).toBe(false);
      expect(result.reason).toContain("tokens must be an array");
    });

    it("rejects pack with too many tokens", async () => {
      const tokens = Array(MAX_TOKENS_IN_PACK + 1).fill(MOCK_TOKENS.witness1);
      // Bypass createPack validation to test validatePack directly
      const badPack = { format: "vfx-pack-1", version: 1, tokens, ts: 0 } as VfxPack;
      const result = await validatePack(badPack);

      expect(result.ok).toBe(false);
      expect(result.reason).toContain("too many tokens");
    });

    it("rejects pack with invalid ts", async () => {
      const pack = { format: "vfx-pack-1", version: 1, tokens: [], ts: NaN } as any;
      const result = await validatePack(pack);

      expect(result.ok).toBe(false);
      expect(result.reason).toContain("invalid ts");
    });

    it("rejects pack with invalid label", async () => {
      const pack = { format: "vfx-pack-1", version: 1, tokens: [], label: 123, ts: 0 } as any;
      const result = await validatePack(pack);

      expect(result.ok).toBe(false);
      expect(result.reason).toContain("label must be a string");
    });

    it("rejects pack with invalid iso3", async () => {
      const pack = { format: "vfx-pack-1", version: 1, tokens: [], iso3: "XX", ts: 0 } as any;
      const result = await validatePack(pack);

      expect(result.ok).toBe(false);
      expect(result.reason).toContain("iso3 must be a 3-letter country code");
    });

    it("rejects pack with incomplete signature fields", async () => {
      const tokens = [MOCK_TOKENS.witness1];
      const pack = createPack(tokens);
      (pack as any).signerPublicKey = "present";
      const result = await validatePack(pack);

      expect(result.ok).toBe(false);
      expect(result.reason).toContain("signature fields incomplete");
    });

    it("rejects signed pack with tampered content", async () => {
      const tokens = [MOCK_TOKENS.witness1];
      const keyPair = await generateTestKeyPair();
      const pack = await createSignedPack(tokens, keyPair);

      // Tamper with content
      pack.label = "Tampered";
      const result = await validatePack(pack);

      expect(result.ok).toBe(false);
      expect(result.reason).toContain("contentHash mismatch");
    });

    it("rejects signed pack with wrong signature", async () => {
      const tokens = [MOCK_TOKENS.witness1];
      const keyPair = await generateTestKeyPair();
      const pack = await createSignedPack(tokens, keyPair);

      // Replace signature with garbage
      pack.signature = "bad" + pack.signature!.slice(3);
      const result = await validatePack(pack);

      expect(result.ok).toBe(false);
      expect(result.reason).toContain("signature does not verify");
    });

    it("detects token types correctly", async () => {
      const tokens = [MOCK_TOKENS.witness1, MOCK_TOKENS.witness2, MOCK_TOKENS.sig1, MOCK_TOKENS.invalid];
      const pack = createPack(tokens);
      const result = await validatePack(pack);

      expect(result.ok).toBe(true);
      expect(result.tokenTypes).toContain("VFXWIT1");
      expect(result.tokenTypes).toContain("VFXSIG1");
      expect(result.tokenCounts["VFXWIT1"]).toBe(2);
      expect(result.tokenCounts["VFXSIG1"]).toBe(1);
      expect(result.tokenCounts["unknown"]).toBe(1);
    });
  });

  describe("encodePack / decodePack", () => {
    it("encodes a pack as VFXPACK1 token", () => {
      const tokens = [MOCK_TOKENS.witness1];
      const pack = createPack(tokens);
      const encoded = encodePack(pack);

      expect(encoded).toMatch(/^VFXPACK1:/);
      expect(encoded.length).toBeGreaterThan(VFXPACK_PREFIX.length);
    });

    it("decodes a VFXPACK1 token", () => {
      const tokens = [MOCK_TOKENS.witness1];
      const pack = createPack(tokens, { label: "Test Pack" });
      const encoded = encodePack(pack);
      const decoded = decodePack(encoded);

      expect(decoded.format).toBe("vfx-pack-1");
      expect(decoded.version).toBe(1);
      expect(decoded.tokens).toEqual(tokens);
      expect(decoded.label).toBe("Test Pack");
    });

    it("round-trips signed pack", async () => {
      const tokens = [MOCK_TOKENS.witness1, MOCK_TOKENS.sig1];
      const keyPair = await generateTestKeyPair();
      const original = await createSignedPack(tokens, keyPair, { label: "Round Trip" });

      const encoded = encodePack(original);
      const decoded = decodePack(encoded);

      expect(decoded.format).toBe(original.format);
      expect(decoded.tokens).toEqual(original.tokens);
      expect(decoded.label).toBe(original.label);
      expect(decoded.signerPublicKey).toBe(original.signerPublicKey);
      expect(decoded.signature).toBe(original.signature);
      expect(decoded.contentHash).toBe(original.contentHash);
    });

    it("throws on non-VFXPACK token", () => {
      expect(() => decodePack(MOCK_TOKENS.witness1)).toThrow(/Not a VFXPACK token/);
    });

    it("throws on malformed base64", () => {
      expect(() => decodePack("VFXPACK1:not-valid-base64!")).toThrow(/invalid base64url/);
    });

    it("throws on malformed JSON", () => {
      const badToken = "VFXPACK1:" + btoa("not json");
      expect(() => decodePack(badToken)).toThrow(/invalid JSON/);
    });

    it("throws on non-object payload", () => {
      const badToken = "VFXPACK1:" + btoa("[]");
      expect(() => decodePack(badToken)).toThrow(/not an object/);
    });

    it("throws on unknown format", () => {
      const payload = JSON.stringify({ format: "bad-format", version: 1, tokens: [], ts: 0 });
      const encoded = "VFXPACK1:" + btoa(payload);
      expect(() => decodePack(encoded)).toThrow(/unknown format/);
    });

    it("throws on unsupported version", () => {
      const payload = JSON.stringify({ format: "vfx-pack-1", version: 99, tokens: [], ts: 0 });
      const encoded = "VFXPACK1:" + btoa(payload);
      expect(() => decodePack(encoded)).toThrow(/unsupported version/);
    });

    it("throws on missing required fields", () => {
      const payload = JSON.stringify({ format: "vfx-pack-1", version: 1, tokens: "bad", ts: 0 });
      const encoded = "VFXPACK1:" + btoa(payload);
      expect(() => decodePack(encoded)).toThrow(/tokens not an array/);
    });
  });

  describe("decodeAndValidatePack", () => {
    it("decodes and validates a good pack", async () => {
      const tokens = [MOCK_TOKENS.witness1];
      const pack = createPack(tokens);
      const encoded = encodePack(pack);
      const result = await decodeAndValidatePack(encoded);

      expect(result.ok).toBe(true);
      expect(result.pack.tokens).toEqual(tokens);
    });

    it("handles malformed tokens gracefully", async () => {
      const result = await decodeAndValidatePack("invalid");

      expect(result.ok).toBe(false);
      expect(result.reason).toBeTruthy();
    });

    it("validates signatures on signed packs", async () => {
      const tokens = [MOCK_TOKENS.witness1];
      const keyPair = await generateTestKeyPair();
      const pack = await createSignedPack(tokens, keyPair);
      const encoded = encodePack(pack);
      const result = await decodeAndValidatePack(encoded);

      expect(result.ok).toBe(true);
    });
  });

  describe("mergePacks", () => {
    it("merges multiple packs", () => {
      const pack1 = createPack([MOCK_TOKENS.witness1]);
      const pack2 = createPack([MOCK_TOKENS.witness2]);
      const merged = mergePacks([pack1, pack2]);

      expect(merged.tokens).toHaveLength(2);
      expect(merged.tokens).toContain(MOCK_TOKENS.witness1);
      expect(merged.tokens).toContain(MOCK_TOKENS.witness2);
    });

    it("deduplicates tokens", () => {
      const pack1 = createPack([MOCK_TOKENS.witness1]);
      const pack2 = createPack([MOCK_TOKENS.witness1, MOCK_TOKENS.witness2]);
      const merged = mergePacks([pack1, pack2]);

      expect(merged.tokens).toHaveLength(2);
      expect(merged.tokens).toContain(MOCK_TOKENS.witness1);
      expect(merged.tokens).toContain(MOCK_TOKENS.witness2);
    });

    it("merges with metadata options", () => {
      const pack1 = createPack([MOCK_TOKENS.witness1]);
      const pack2 = createPack([MOCK_TOKENS.witness2]);
      const merged = mergePacks([pack1, pack2], {
        label: "Merged Pack",
        description: "Combined from two sources",
        iso3: "USA",
        kind: "collection",
      });

      expect(merged.label).toBe("Merged Pack");
      expect(merged.description).toBe("Combined from two sources");
      expect(merged.iso3).toBe("USA");
      expect(merged.kind).toBe("collection");
    });

    it("drops signatures from merged packs", async () => {
      const keyPair = await generateTestKeyPair();
      const pack1 = await createSignedPack([MOCK_TOKENS.witness1], keyPair);
      const pack2 = await createSignedPack([MOCK_TOKENS.witness2], keyPair);
      const merged = mergePacks([pack1, pack2]);

      expect(merged.signerPublicKey).toBeUndefined();
      expect(merged.signature).toBeUndefined();
      expect(merged.contentHash).toBeUndefined();
    });

    it("handles empty pack array", () => {
      const merged = mergePacks([]);
      expect(merged.tokens).toEqual([]);
    });

    it("skips invalid packs", () => {
      const pack1 = createPack([MOCK_TOKENS.witness1]);
      const merged = mergePacks([pack1, null as any, "bad" as any]);

      expect(merged.tokens).toEqual([MOCK_TOKENS.witness1]);
    });
  });

  describe("mergePackTokens", () => {
    it("merges encoded pack tokens", async () => {
      const pack1 = createPack([MOCK_TOKENS.witness1]);
      const pack2 = createPack([MOCK_TOKENS.witness2]);
      const token1 = encodePack(pack1);
      const token2 = encodePack(pack2);

      const merged = await mergePackTokens([token1, token2]);

      expect(merged).toMatch(/^VFXPACK1:/);
      const decoded = decodePack(merged);
      expect(decoded.tokens).toHaveLength(2);
    });

    it("skips invalid pack tokens", async () => {
      const pack1 = createPack([MOCK_TOKENS.witness1]);
      const token1 = encodePack(pack1);

      const merged = await mergePackTokens([token1, "invalid", "also-invalid"]);

      const decoded = decodePack(merged);
      expect(decoded.tokens).toEqual([MOCK_TOKENS.witness1]);
    });
  });

  describe("extractTokens", () => {
    it("extracts all tokens from a pack", () => {
      const pack = createPack([MOCK_TOKENS.witness1, MOCK_TOKENS.witness2]);
      const tokens = extractTokens(pack);

      expect(tokens).toHaveLength(2);
      expect(tokens).toContain(MOCK_TOKENS.witness1);
      expect(tokens).toContain(MOCK_TOKENS.witness2);
    });

    it("deduplicates tokens", () => {
      const pack = createPack([MOCK_TOKENS.witness1, MOCK_TOKENS.witness1, MOCK_TOKENS.witness2]);
      const tokens = extractTokens(pack);

      expect(tokens).toHaveLength(2);
    });

    it("handles pack with no tokens", () => {
      const pack = createPack([]);
      const tokens = extractTokens(pack);

      expect(tokens).toEqual([]);
    });

    it("handles null pack", () => {
      const tokens = extractTokens(null as any);
      expect(tokens).toEqual([]);
    });
  });

  describe("filterPackByType", () => {
    it("filters pack by allowed token types", () => {
      const pack = createPack([MOCK_TOKENS.witness1, MOCK_TOKENS.sig1, MOCK_TOKENS.identity]);
      const filtered = filterPackByType(pack, ["VFXWIT1"]);

      expect(filtered.tokens).toEqual([MOCK_TOKENS.witness1]);
    });

    it("includes multiple allowed types", () => {
      const pack = createPack([MOCK_TOKENS.witness1, MOCK_TOKENS.sig1, MOCK_TOKENS.identity]);
      const filtered = filterPackByType(pack, ["VFXWIT1", "VFXSIG1"]);

      expect(filtered.tokens).toHaveLength(2);
      expect(filtered.tokens).toContain(MOCK_TOKENS.witness1);
      expect(filtered.tokens).toContain(MOCK_TOKENS.sig1);
    });

    it("returns empty pack when no tokens match", () => {
      const pack = createPack([MOCK_TOKENS.witness1]);
      const filtered = filterPackByType(pack, ["VSIG1"]);

      expect(filtered.tokens).toEqual([]);
    });

    it("copies metadata to filtered pack", () => {
      const pack = createPack([MOCK_TOKENS.witness1, MOCK_TOKENS.sig1], {
        label: "Original",
        iso3: "USA",
      });
      const filtered = filterPackByType(pack, ["VFXWIT1"]);

      expect(filtered.label).toContain("Original");
      expect(filtered.iso3).toBe("USA");
    });
  });

  describe("summarizePack", () => {
    it("generates summary for unsigned pack", () => {
      const pack = createPack([MOCK_TOKENS.witness1, MOCK_TOKENS.witness2]);
      const summary = summarizePack(pack);

      expect(summary).toContain("2 tokens");
      expect(summary).toContain("VFXWIT1: 2");
    });

    it("includes label in summary", () => {
      const pack = createPack([MOCK_TOKENS.witness1], { label: "Test Pack" });
      const summary = summarizePack(pack);

      expect(summary).toContain("Test Pack");
    });

    it("includes iso3 in summary", () => {
      const pack = createPack([MOCK_TOKENS.witness1], { iso3: "USA" });
      const summary = summarizePack(pack);

      expect(summary).toContain("[USA]");
    });

    it("handles mixed token types", () => {
      const pack = createPack([MOCK_TOKENS.witness1, MOCK_TOKENS.sig1, MOCK_TOKENS.invalid]);
      const summary = summarizePack(pack);

      expect(summary).toContain("VFXWIT1: 1");
      expect(summary).toContain("VFXSIG1: 1");
      expect(summary).toContain("unknown: 1");
    });

    it("handles singular token", () => {
      const pack = createPack([MOCK_TOKENS.witness1]);
      const summary = summarizePack(pack);

      expect(summary).toContain("1 token");
      expect(summary).not.toContain("tokens");
    });
  });

  describe("packFingerprint", () => {
    it("returns contentHash for signed packs", async () => {
      const tokens = [MOCK_TOKENS.witness1];
      const keyPair = await generateTestKeyPair();
      const pack = await createSignedPack(tokens, keyPair);

      const fingerprint = packFingerprint(pack);
      expect(fingerprint).toHaveLength(12);
      expect(fingerprint).toBe(pack.contentHash!.slice(0, 12));
    });

    it("returns ts-based fingerprint for unsigned packs", () => {
      const pack = createPack([MOCK_TOKENS.witness1], { ts: 1699664000000 });
      const fingerprint = packFingerprint(pack);

      expect(fingerprint).toHaveLength(12);
      expect(fingerprint).toBeTruthy();
    });
  });

  describe("Integration tests", () => {
    it("full round-trip: create -> sign -> encode -> decode -> validate", async () => {
      const tokens = [MOCK_TOKENS.witness1, MOCK_TOKENS.witness2, MOCK_TOKENS.sig1];
      const keyPair = await generateTestKeyPair();

      // Create and sign
      const original = await createSignedPack(tokens, keyPair, {
        label: "Integration Test",
        description: "Full round-trip test",
        iso3: "PRT",
        kind: "crisis",
      });

      // Encode
      const encoded = encodePack(original);
      expect(encoded).toMatch(/^VFXPACK1:[a-zA-Z0-9_-]+$/);

      // Decode
      const decoded = decodePack(encoded);
      expect(decoded.tokens).toEqual(tokens);
      expect(decoded.label).toBe("Integration Test");

      // Validate
      const validation = await validatePack(decoded);
      expect(validation.ok).toBe(true);
      expect(validation.tokenTypes).toContain("VFXWIT1");
      expect(validation.tokenTypes).toContain("VFXSIG1");
    });

    it("creates a crisis pack for a specific country", async () => {
      const tokens = [
        MOCK_TOKENS.witness1,
        MOCK_TOKENS.witness2,
        MOCK_TOKENS.sig1,
        MOCK_TOKENS.identity,
      ];
      const keyPair = await generateTestKeyPair();

      const crisisPack = await createSignedPack(tokens, keyPair, {
        label: "Lebanon Crisis Pack",
        description: "Emergency information for Lebanon crisis response",
        iso3: "LBN",
        kind: "crisis",
      });

      expect(crisisPack.iso3).toBe("LBN");
      expect(crisisPack.kind).toBe("crisis");
      expect(crisisPack.tokens).toHaveLength(4);

      const validation = await validatePack(crisisPack);
      expect(validation.ok).toBe(true);
    });

    it("merges multiple source packs into one backup pack", async () => {
      const keyPair = await generateTestKeyPair();

      const pack1 = await createSignedPack([MOCK_TOKENS.witness1], keyPair, { iso3: "USA" });
      const pack2 = await createSignedPack([MOCK_TOKENS.witness2], keyPair, { iso3: "PRT" });
      const pack3 = createPack([MOCK_TOKENS.sig1]);

      const merged = mergePacks([pack1, pack2, pack3], {
        label: "Backup Pack",
        kind: "backup",
      });

      expect(merged.tokens).toHaveLength(3);
      expect(merged.kind).toBe("backup");
      expect(merged.label).toBe("Backup Pack");
      expect(merged.signerPublicKey).toBeUndefined(); // Merged packs are unsigned
    });
  });
});
