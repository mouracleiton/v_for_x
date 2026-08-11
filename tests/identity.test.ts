import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  generateIdentity,
  saveIdentity,
  loadIdentity,
  ensureIdentity,
  deleteIdentity,
  signWithIdentity,
  verifyWithIdentity,
  computeSafetyNumber,
  publicCard,
  exportPublicCard,
  encodeIdentityToken,
  decodeIdentityToken,
  encodePublicCardToken,
  decodePublicCardToken,
  createSignedDagEntry,
  verifyDagEntrySignature,
  type Identity,
  type PublicIdentity,
} from "../lib/identity";

describe("identity.ts", () => {
  beforeEach(() => {
    // Clear any existing identity before each test
    deleteIdentity();
  });

  afterEach(() => {
    // Clean up after each test
    deleteIdentity();
  });

  describe("generateIdentity", () => {
    it("should generate a valid identity with all required fields", async () => {
      const identity = await generateIdentity();

      expect(identity.privateKey).toBeDefined();
      expect(identity.publicKey).toBeDefined();
      expect(identity.publicKeyHex).toMatch(/^[0-9a-f]{130}$/); // P-256 raw = 65 bytes
      expect(identity.handle).toMatch(/^V-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(identity.fingerprint).toHaveLength(12);
      expect(identity.fingerprint).toMatch(/^[0-9a-f]{12}$/);
      expect(identity.createdAt).toBeLessThanOrEqual(Date.now());
      expect(identity.createdAt).toBeGreaterThan(Date.now() - 1000);
    });

    it("should generate unique handles", async () => {
      const handles = new Set();
      for (let i = 0; i < 100; i++) {
        const identity = await generateIdentity();
        handles.add(identity.handle);
      }
      expect(handles.size).toBe(100);
    });

    it("should generate unique keypairs", async () => {
      const identities = await Promise.all([
        generateIdentity(),
        generateIdentity(),
        generateIdentity(),
      ]);

      const pubKeys = new Set(identities.map((id) => id.publicKeyHex));
      expect(pubKeys.size).toBe(3);
    });
  });

  describe("saveIdentity and loadIdentity", () => {
    it("should save and load identity correctly", async () => {
      const original = await generateIdentity();
      await saveIdentity(original);

      const loaded = await loadIdentity();
      expect(loaded).not.toBeNull();
      expect(loaded!.publicKeyHex).toBe(original.publicKeyHex);
      expect(loaded!.handle).toBe(original.handle);
      expect(loaded!.fingerprint).toBe(original.fingerprint);
      expect(loaded!.createdAt).toBe(original.createdAt);
    });

    it("should restore functional CryptoKey objects", async () => {
      const original = await generateIdentity();
      const testHash = "a".repeat(64);
      const originalSig = await signWithIdentity(original, testHash);
      const publicCard = exportPublicCard(original);

      await saveIdentity(original);
      const loaded = await loadIdentity();
      expect(loaded).not.toBeNull();

      const loadedSig = await signWithIdentity(loaded!, testHash);

      // Both signatures should be valid (ECDSA is non-deterministic)
      expect(await verifyWithIdentity(publicCard, testHash, originalSig)).toBe(true);
      expect(await verifyWithIdentity(publicCard, testHash, loadedSig)).toBe(true);
    });

    it("should return null when no identity exists", async () => {
      const identity = await loadIdentity();
      expect(identity).toBeNull();
    });

    it("should handle corrupted storage gracefully", async () => {
      localStorage.setItem("vfx_identity", "invalid json");
      const identity = await loadIdentity();
      expect(identity).toBeNull();
      expect(localStorage.getItem("vfx_identity")).toBeNull();
    });
  });

  describe("ensureIdentity", () => {
    it("should create new identity if none exists", async () => {
      deleteIdentity();
      const identity = await ensureIdentity();
      expect(identity).toBeDefined();
      expect(identity.handle).toMatch(/^V-/);
    });

    it("should load existing identity if available", async () => {
      const original = await generateIdentity();
      await saveIdentity(original);

      const loaded = await ensureIdentity();
      expect(loaded.publicKeyHex).toBe(original.publicKeyHex);
      expect(loaded.handle).toBe(original.handle);
    });

    it("should not create multiple identities on repeated calls", async () => {
      deleteIdentity();
      const id1 = await ensureIdentity();
      const id2 = await ensureIdentity();
      expect(id1.publicKeyHex).toBe(id2.publicKeyHex);
    });
  });

  describe("deleteIdentity", () => {
    it("should remove stored identity", async () => {
      const identity = await generateIdentity();
      await saveIdentity(identity);

      expect(await loadIdentity()).not.toBeNull();
      deleteIdentity();
      expect(await loadIdentity()).toBeNull();
    });

    it("should be safe to call when no identity exists", () => {
      expect(() => deleteIdentity()).not.toThrow();
      deleteIdentity();
      deleteIdentity();
    });
  });

  describe("signWithIdentity and verifyWithIdentity", () => {
    it("should sign and verify a hash correctly", async () => {
      const identity = await generateIdentity();
      const hash = "abc123".repeat(21); // 252 chars, but we pad to 64
      const fullHash = hash.padEnd(64, "0");

      const signature = await signWithIdentity(identity, fullHash);
      expect(signature).toMatch(/^[0-9a-f]+$/);
      expect(signature.length).toBeGreaterThan(0);

      const publicCard = exportPublicCard(identity);
      const isValid = await verifyWithIdentity(publicCard, fullHash, signature);
      expect(isValid).toBe(true);
    });

    it("should produce different signatures for different hashes", async () => {
      const identity = await generateIdentity();
      const sig1 = await signWithIdentity(identity, "a".repeat(64));
      const sig2 = await signWithIdentity(identity, "b".repeat(64));
      expect(sig1).not.toBe(sig2);
    });

    it("should fail verification for wrong signature", async () => {
      const identity = await generateIdentity();
      const hash = "a".repeat(64);
      const signature = await signWithIdentity(identity, hash);

      const publicCard = exportPublicCard(identity);
      const isValid = await verifyWithIdentity(publicCard, "b".repeat(64), signature);
      expect(isValid).toBe(false);
    });

    it("should fail verification with wrong public key", async () => {
      const identity1 = await generateIdentity();
      const identity2 = await generateIdentity();
      const hash = "a".repeat(64);
      const signature = await signWithIdentity(identity1, hash);

      const publicCard2 = exportPublicCard(identity2);
      const isValid = await verifyWithIdentity(publicCard2, hash, signature);
      expect(isValid).toBe(false);
    });
  });

  describe("computeSafetyNumber", () => {
    it("should compute consistent safety number regardless of order", async () => {
      const id1 = await generateIdentity();
      const id2 = await generateIdentity();

      const sn1 = await computeSafetyNumber(id1, id2);
      const sn2 = await computeSafetyNumber(id2, id1);

      expect(sn1).toBe(sn2);
      expect(sn1).toHaveLength(64);
      expect(sn1).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should produce different safety numbers for different pairs", async () => {
      const id1 = await generateIdentity();
      const id2 = await generateIdentity();
      const id3 = await generateIdentity();

      const sn12 = await computeSafetyNumber(id1, id2);
      const sn23 = await computeSafetyNumber(id2, id3);
      const sn13 = await computeSafetyNumber(id1, id3);

      expect(sn12).not.toBe(sn23);
      expect(sn23).not.toBe(sn13);
      expect(sn12).not.toBe(sn13);
    });

    it("should produce same safety number for same pair", async () => {
      const id1 = await generateIdentity();
      const id2 = await generateIdentity();

      const sn1 = await computeSafetyNumber(id1, id2);
      const sn2 = await computeSafetyNumber(id1, id2);

      expect(sn1).toBe(sn2);
    });
  });

  describe("exportPublicCard", () => {
    it("should export only public information", async () => {
      const identity = await generateIdentity();
      const card = exportPublicCard(identity);

      expect(card.publicKeyHex).toBe(identity.publicKeyHex);
      expect(card.handle).toBe(identity.handle);
      expect(card.fingerprint).toBe(identity.fingerprint);
      expect(card.createdAt).toBe(identity.createdAt);
      expect((card as any).privateKey).toBeUndefined();
      expect((card as any).publicKey).toBeUndefined();
    });

    it("should not include private key in public card", async () => {
      const identity = await generateIdentity();
      const card = exportPublicCard(identity);

      const cardJson = JSON.stringify(card);
      expect(cardJson).not.toContain("private");
    });
  });

  describe("encodeIdentityToken and decodeIdentityToken", () => {
    it("should encode and decode identity token correctly", async () => {
      const identity = await generateIdentity();
      const token = await encodeIdentityToken(identity);

      expect(token).toMatch(/^VFXID1:/);

      const decoded = await decodeIdentityToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.publicKeyHex).toBe(identity.publicKeyHex);
      expect(decoded!.handle).toBe(identity.handle);
      expect(decoded!.fingerprint).toBe(identity.fingerprint);
    });

    it("should verify signature during decode", async () => {
      const identity = await generateIdentity();
      const token = await encodeIdentityToken(identity);

      // Tamper with the token
      const tamperedToken = token + "tamper";
      const decoded = await decodeIdentityToken(tamperedToken);
      expect(decoded).toBeNull();
    });

    it("should reject tokens with wrong version", async () => {
      const identity = await generateIdentity();
      const token = await encodeIdentityToken(identity);

      // Parse and modify version
      const base64 = token.slice(7);
      const json = atob(base64);
      const data = JSON.parse(json);
      data.version = 2;
      const tamperedJson = JSON.stringify(data);
      const tamperedBase64 = btoa(tamperedJson);
      const tamperedToken = `VFXID1:${tamperedBase64}`;

      const decoded = await decodeIdentityToken(tamperedToken);
      expect(decoded).toBeNull();
    });

    it("should reject malformed tokens", async () => {
      expect(await decodeIdentityToken("invalid")).toBeNull();
      expect(await decodeIdentityToken("VFXID1:")).toBeNull();
      expect(await decodeIdentityToken("VFXID1:invalid-base64")).toBeNull();
    });

    it("should reject tokens without VFXID1 prefix", async () => {
      const identity = await generateIdentity();
      const token = await encodeIdentityToken(identity);

      const wrongPrefix = token.replace("VFXID1:", "VFXID2:");
      const decoded = await decodeIdentityToken(wrongPrefix);
      expect(decoded).toBeNull();
    });
  });

  describe("publicCard", () => {
    it("should export only public information", async () => {
      const identity = await generateIdentity();
      const card = publicCard(identity);

      expect(card.publicKeyHex).toBe(identity.publicKeyHex);
      expect(card.handle).toBe(identity.handle);
      expect(card.fingerprint).toBe(identity.fingerprint);
      expect(card.createdAt).toBe(identity.createdAt);
      expect((card as any).privateKey).toBeUndefined();
      expect((card as any).publicKey).toBeUndefined();
    });

    it("should not include private key in public card", async () => {
      const identity = await generateIdentity();
      const card = publicCard(identity);

      const cardJson = JSON.stringify(card);
      expect(cardJson).not.toContain("private");
    });
  });

  describe("encodePublicCardToken and decodePublicCardToken", () => {
    it("should encode and decode public card token correctly", async () => {
      const identity = await generateIdentity();
      const token = encodePublicCardToken(identity);

      expect(token).toMatch(/^VFXID1PUB:/);

      const decoded = decodePublicCardToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.publicKeyHex).toBe(identity.publicKeyHex);
      expect(decoded!.handle).toBe(identity.handle);
      expect(decoded!.fingerprint).toBe(identity.fingerprint);
      expect(decoded!.createdAt).toBe(identity.createdAt);
    });

    it("should not include private key in public card token", async () => {
      const identity = await generateIdentity();
      const token = encodePublicCardToken(identity);

      const tokenJson = atob(token.slice(10));
      expect(tokenJson).not.toContain("private");
    });

    it("should handle malformed public card tokens", () => {
      expect(decodePublicCardToken("invalid")).toBeNull();
      expect(decodePublicCardToken("VFXID1PUB:")).toBeNull();
      expect(decodePublicCardToken("VFXID1PUB:invalid-base64")).toBeNull();
    });

    it("should reject tokens with wrong prefix", () => {
      expect(decodePublicCardToken("VFXID1:something")).toBeNull();
      expect(decodePublicCardToken("VFXID2:something")).toBeNull();
    });

    it("should reject tokens with wrong version", async () => {
      const identity = await generateIdentity();
      const token = encodePublicCardToken(identity);

      // Parse and modify version
      const base64 = token.slice(10);
      const json = atob(base64);
      const data = JSON.parse(json);
      data.version = 2;
      const tamperedJson = JSON.stringify(data);
      const tamperedBase64 = btoa(tamperedJson);
      const tamperedToken = `VFXID1PUB:${tamperedBase64}`;

      const decoded = decodePublicCardToken(tamperedToken);
      expect(decoded).toBeNull();
    });

    it("should encode public card from exported public identity", async () => {
      const identity = await generateIdentity();
      const exported = publicCard(identity);
      const token = encodePublicCardToken(identity);

      const decoded = decodePublicCardToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.publicKeyHex).toBe(exported.publicKeyHex);
      expect(decoded!.handle).toBe(exported.handle);
      expect(decoded!.fingerprint).toBe(exported.fingerprint);
      expect(decoded!.createdAt).toBe(exported.createdAt);
    });

    it("should differentiate between VFXID1 and VFXID1PUB tokens", async () => {
      const identity = await generateIdentity();
      const signedToken = await encodeIdentityToken(identity);
      const publicCardToken = encodePublicCardToken(identity);

      expect(signedToken).toMatch(/^VFXID1:/);
      expect(publicCardToken).toMatch(/^VFXID1PUB:/);

      // Signed token should decode with signature verification
      const signedDecoded = await decodeIdentityToken(signedToken);
      expect(signedDecoded).not.toBeNull();

      // Public card token should decode without signature verification
      const publicDecoded = decodePublicCardToken(publicCardToken);
      expect(publicDecoded).not.toBeNull();

      // Both should have the same public information
      expect(signedDecoded!.publicKeyHex).toBe(publicDecoded!.publicKeyHex);
      expect(signedDecoded!.handle).toBe(publicDecoded!.handle);
    });
  });

  describe("createSignedDagEntry", () => {
    it("should create a DAG entry with identity signature", async () => {
      const identity = await generateIdentity();
      const entry = await createSignedDagEntry(
        {
          ts: Date.now(),
          source: identity.handle,
          destination: "Zone-7",
          amount: "$5,000",
          purpose: "food",
          status: "PENDING",
          signerHandle: identity.handle,
        },
        "0".repeat(64),
        identity
      );

      expect(entry.signature).toBeDefined();
      expect(entry.signature).toMatch(/^[0-9a-f]+$/);
      expect(entry.signerPubKey).toBe(identity.publicKeyHex);
      expect(entry.signerHandle).toBe(identity.handle);
    });

    it("should produce verifiable signatures", async () => {
      const identity = await generateIdentity();
      const entry = await createSignedDagEntry(
        {
          ts: Date.now(),
          source: identity.handle,
          destination: "Zone-7",
          amount: "$5,000",
          purpose: "food",
          status: "PENDING",
          signerHandle: identity.handle,
        },
        "0".repeat(64),
        identity
      );

      const verified = await verifyDagEntrySignature(entry);
      expect(verified).not.toBeNull();
      expect(verified!.publicKeyHex).toBe(identity.publicKeyHex);
      expect(verified!.handle).toBe(identity.handle);
    });

    it("should fail verification for tampered entries", async () => {
      const identity = await generateIdentity();
      const entry = await createSignedDagEntry(
        {
          ts: Date.now(),
          source: identity.handle,
          destination: "Zone-7",
          amount: "$5,000",
          purpose: "food",
          status: "PENDING",
          signerHandle: identity.handle,
        },
        "0".repeat(64),
        identity
      );

      // Tamper with the entry and recompute hash (simulating an attacker trying to forge)
      entry.amount = "$999,999";
      // Recompute hash for the tampered content (but keep the old signature)
      const tamperedHash = await import("../lib/dag").then(m => m.computeEntryHash({
        prevHash: entry.prevHash,
        ts: entry.ts,
        source: entry.source,
        destination: entry.destination,
        amount: entry.amount,
        purpose: entry.purpose,
        status: entry.status,
        signerHandle: entry.signerHandle,
      }));
      entry.hash = tamperedHash;

      // The signature should no longer be valid for the new hash
      const verified = await verifyDagEntrySignature(entry);
      expect(verified).toBeNull();
    });
  });

  describe("verifyDagEntrySignature", () => {
    it("should return null for unsigned entries", async () => {
      const entry: any = {
        hash: "a".repeat(64),
        ts: Date.now(),
      };

      const verified = await verifyDagEntrySignature(entry);
      expect(verified).toBeNull();
    });

    it("should return null for entries with missing signature", async () => {
      const entry: any = {
        hash: "a".repeat(64),
        ts: Date.now(),
        signerPubKey: "deadbeef".repeat(32),
      };

      const verified = await verifyDagEntrySignature(entry);
      expect(verified).toBeNull();
    });
  });
});
