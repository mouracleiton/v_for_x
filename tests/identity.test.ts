import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  generateIdentity,
  saveIdentity,
  loadIdentity,
  ensureIdentity,
  deleteIdentity,
  signWithIdentity,
  verifyWithIdentity,
  verifySignatureWithGrace,
  computeSafetyNumber,
  publicCard,
  exportPublicCard,
  encodeIdentityToken,
  decodeIdentityToken,
  encodePublicCardToken,
  decodePublicCardToken,
  createSignedDagEntry,
  verifyDagEntrySignature,
  rotateIdentity,
  loadPreviousIdentities,
  type Identity,
  type PublicIdentity,
} from "../lib/identity";

describe("identity.ts", () => {
  beforeEach(() => {
    // Clear any existing identity and history before each test
    deleteIdentity();
    localStorage.removeItem("vfx_identity_history");
  });

  afterEach(() => {
    // Clean up after each test
    deleteIdentity();
    localStorage.removeItem("vfx_identity_history");
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

  describe("rotateIdentity", () => {
    it("should throw error when no current identity exists", async () => {
      deleteIdentity();
      await expect(rotateIdentity()).rejects.toThrow("No current identity to rotate");
    });

    it("should generate new identity and save old to history", async () => {
      const originalIdentity = await ensureIdentity();
      const originalHandle = originalIdentity.handle;
      const originalPubKey = originalIdentity.publicKeyHex;

      const newIdentity = await rotateIdentity();

      // New identity should be different
      expect(newIdentity.handle).not.toBe(originalHandle);
      expect(newIdentity.publicKeyHex).not.toBe(originalPubKey);

      // Current identity should be the new one
      const current = await loadIdentity();
      expect(current!.handle).toBe(newIdentity.handle);
      expect(current!.publicKeyHex).toBe(newIdentity.publicKeyHex);

      // Old identity should be in history
      const history = await loadPreviousIdentities();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].identity.handle).toBe(originalHandle);
      expect(history[0].identity.publicKeyHex).toBe(originalPubKey);
    });

    it("should maintain rotation timestamps in history", async () => {
      const originalIdentity = await ensureIdentity();
      const beforeRotation = Date.now();

      await rotateIdentity();

      const history = await loadPreviousIdentities();
      expect(history.length).toBeGreaterThan(0);

      const entry = history[0];
      expect(entry.rotatedAt).toBeGreaterThanOrEqual(beforeRotation);
      expect(entry.rotatedAt).toBeLessThanOrEqual(Date.now());
      expect(entry.gracePeriodUntil).toBeGreaterThan(Date.now());
    });

    it("should generate valid new identity", async () => {
      await ensureIdentity();
      const newIdentity = await rotateIdentity();

      expect(newIdentity.privateKey).toBeDefined();
      expect(newIdentity.publicKey).toBeDefined();
      expect(newIdentity.publicKeyHex).toMatch(/^[0-9a-f]{130}$/);
      expect(newIdentity.handle).toMatch(/^V-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(newIdentity.fingerprint).toHaveLength(12);
    });

    it("should accumulate history on multiple rotations", async () => {
      await ensureIdentity();

      const handles: string[] = [];
      handles.push((await loadIdentity())!.handle);

      // Rotate 3 times
      for (let i = 0; i < 3; i++) {
        await rotateIdentity();
        handles.push((await loadIdentity())!.handle);
      }

      // Should have 4 handles total (original + 3 rotations)
      expect(handles.length).toBe(4);
      // All handles should be unique
      expect(new Set(handles).size).toBe(4);

      // History should have 3 entries (original moved to history + 2 subsequent rotations)
      const history = await loadPreviousIdentities();
      expect(history.length).toBe(3);

      // Verify the handles match
      expect(history[0].identity.handle).toBe(handles[2]); // Second rotation
      expect(history[1].identity.handle).toBe(handles[1]); // First rotation
      expect(history[2].identity.handle).toBe(handles[0]); // Original
    });

    it("should preserve signature validity during grace period", async () => {
      const originalIdentity = await ensureIdentity();
      const testHash = "test".repeat(16);
      const originalSignature = await signWithIdentity(originalIdentity, testHash);

      // Rotate identity
      await rotateIdentity();
      const newIdentity = await loadIdentity();

      // Signature made with OLD key should still be verifiable using grace period
      const originalPublicCard = publicCard(originalIdentity);
      const isValidWithGrace = await verifySignatureWithGrace(
        originalPublicCard,
        testHash,
        originalSignature
      );
      expect(isValidWithGrace).toBe(true);

      // New identity should also work for new signatures
      const newSignature = await signWithIdentity(newIdentity!, testHash);
      const newPublicCard = publicCard(newIdentity!);
      const isValidNew = await verifyWithIdentity(newPublicCard, testHash, newSignature);
      expect(isValidNew).toBe(true);
    });
  });

  describe("loadPreviousIdentities", () => {
    it("should return empty array when no history exists", async () => {
      deleteIdentity();
      const history = await loadPreviousIdentities();
      expect(history).toEqual([]);
    });

    it("should load identity history after rotation", async () => {
      await ensureIdentity();
      const firstHandle = (await loadIdentity())!.handle;

      await rotateIdentity();
      const history = await loadPreviousIdentities();

      expect(history.length).toBeGreaterThan(0);
      expect(history[0].identity.handle).toBe(firstHandle);
    });

    it("should restore functional CryptoKey objects from history", async () => {
      await ensureIdentity();
      const originalIdentity = (await loadIdentity())!;
      const testHash = "test".repeat(16);
      const originalSignature = await signWithIdentity(originalIdentity, testHash);

      await rotateIdentity();
      const history = await loadPreviousIdentities();

      expect(history.length).toBeGreaterThan(0);
      const restoredIdentity = history[0].identity;

      // Restored identity should be able to sign
      const newSignature = await signWithIdentity(restoredIdentity, testHash);
      expect(newSignature).toMatch(/^[0-9a-f]+$/);

      // Original signature should verify with restored public key
      const publicCardData = publicCard(restoredIdentity);
      const isValid = await verifyWithIdentity(publicCardData, testHash, originalSignature);
      expect(isValid).toBe(true);
    });

    it("should handle corrupted history gracefully", async () => {
      await ensureIdentity();
      await rotateIdentity();

      // Corrupt the history
      localStorage.setItem("vfx_identity_history", "invalid json");

      const history = await loadPreviousIdentities();
      expect(history).toEqual([]);
      expect(localStorage.getItem("vfx_identity_history")).toBeNull();
    });

    it("should sort history by rotation date (most recent first)", async () => {
      await ensureIdentity();

      const handles: string[] = [];
      handles.push((await loadIdentity())!.handle);

      // Rotate multiple times
      for (let i = 0; i < 3; i++) {
        await rotateIdentity();
        handles.push((await loadIdentity())!.handle);
      }

      const history = await loadPreviousIdentities();

      // History should be in reverse chronological order
      // After 3 rotations: handles = [original, rotation1, rotation2, rotation3]
      // Current identity is handles[3], history contains [handles[2], handles[1], handles[0]]
      expect(history.length).toBe(3);
      expect(history[0].identity.handle).toBe(handles[2]); // Most recent rotation
      expect(history[1].identity.handle).toBe(handles[1]); // Middle rotation
      expect(history[2].identity.handle).toBe(handles[0]); // Original (oldest)
    });

    it("should skip corrupted entries but keep valid ones", async () => {
      await ensureIdentity();
      const firstHandle = (await loadIdentity())!.handle;

      await rotateIdentity();
      const secondHandle = (await loadIdentity())!.handle;

      // Corrupt the history by adding invalid entry
      const currentHistory = localStorage.getItem("vfx_identity_history");
      if (currentHistory) {
        const historyData = JSON.parse(currentHistory);
        historyData.push({ invalid: "entry" });
        localStorage.setItem("vfx_identity_history", JSON.stringify(historyData));
      }

      const history = await loadPreviousIdentities();

      // Should have skipped the corrupted entry but kept valid ones
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].identity.handle).toBeDefined();
    });
  });

  describe("verifySignatureWithGrace", () => {
    it("should verify signatures with current identity", async () => {
      const identity = await ensureIdentity();
      const hash = "test".repeat(16);
      const signature = await signWithIdentity(identity, hash);

      const publicCardData = publicCard(identity);
      const isValid = await verifySignatureWithGrace(publicCardData, hash, signature);

      expect(isValid).toBe(true);
    });

    it("should verify signatures from previous identities within grace period", async () => {
      const originalIdentity = await ensureIdentity();
      const hash = "test".repeat(16);
      const originalSignature = await signWithIdentity(originalIdentity, hash);

      await rotateIdentity();

      const originalPublicCard = publicCard(originalIdentity);
      const isValid = await verifySignatureWithGrace(originalPublicCard, hash, originalSignature);

      expect(isValid).toBe(true);
    });

    it("should reject invalid signatures", async () => {
      const identity = await ensureIdentity();
      const hash = "test".repeat(16);
      const wrongSignature = "bad".repeat(64);

      const publicCardData = publicCard(identity);
      const isValid = await verifySignatureWithGrace(publicCardData, hash, wrongSignature);

      expect(isValid).toBe(false);
    });

    it("should verify signatures from previous identities within grace period", async () => {
      await ensureIdentity();
      const originalIdentity = (await loadIdentity())!;
      const hash = "test".repeat(16);
      const originalSignature = await signWithIdentity(originalIdentity, hash);

      await rotateIdentity();

      // Get the current identity (after rotation)
      const currentIdentity = await loadIdentity();

      // Verify with original identity (should work within grace period)
      const originalPublicCard = publicCard(originalIdentity);
      const isValidWithOriginal = await verifySignatureWithGrace(originalPublicCard, hash, originalSignature);
      expect(isValidWithOriginal).toBe(true);

      // Verification with current identity should fail (different key)
      const currentPublicCard = publicCard(currentIdentity!);
      const isValidWithCurrent = await verifySignatureWithGrace(currentPublicCard, hash, originalSignature);
      expect(isValidWithCurrent).toBe(false);
    });

    it("should work with multiple previous identities", async () => {
      await ensureIdentity();

      const signatures: { hash: string; signature: string; handle: string }[] = [];

      // Create signatures with different identities
      for (let i = 0; i < 3; i++) {
        const identity = await loadIdentity();
        const hash = `test${i}`.repeat(14); // Different hash for each
        const signature = await signWithIdentity(identity!, hash);
        signatures.push({
          hash,
          signature,
          handle: identity!.handle,
        });

        if (i < 2) {
          await rotateIdentity();
        }
      }

      // All signatures should verify with grace period
      for (const { hash, signature, handle } of signatures) {
        // For the last signature (current identity), we need to use current identity
        const currentIdentity = await loadIdentity();
        if (handle === currentIdentity!.handle) {
          // This is the current identity, verify directly
          const publicCardData = publicCard(currentIdentity!);
          const isValid = await verifySignatureWithGrace(publicCardData, hash, signature);
          expect(isValid).toBe(true);
        } else {
          // This is a previous identity, find it in history
          const history = await loadPreviousIdentities();
          const identityEntry = history.find((entry) => entry.identity.handle === handle);
          expect(identityEntry).toBeDefined();

          const publicCardData = publicCard(identityEntry!.identity);
          const isValid = await verifySignatureWithGrace(publicCardData, hash, signature);
          expect(isValid).toBe(true);
        }
      }
    });

    it("should fall back to direct verification if history is empty", async () => {
      const identity = await ensureIdentity();
      const hash = "test".repeat(16);
      const signature = await signWithIdentity(identity, hash);

      // Clear history to simulate no previous identities
      localStorage.removeItem("vfx_identity_history");

      const publicCardData = publicCard(identity);
      const isValid = await verifySignatureWithGrace(publicCardData, hash, signature);

      expect(isValid).toBe(true);
    });

    it("should handle verification with wrong public key correctly", async () => {
      const identity1 = await ensureIdentity();
      const identity2 = await generateIdentity();
      const hash = "test".repeat(16);
      const signature = await signWithIdentity(identity1, hash);

      const publicCardData = publicCard(identity2);
      const isValid = await verifySignatureWithGrace(publicCardData, hash, signature);

      expect(isValid).toBe(false);
    });
  });

  describe("grace period functionality", () => {
    it("should set grace period to 30 days from creation", async () => {
      await ensureIdentity();
      const beforeRotation = Date.now();

      await rotateIdentity();

      const history = await loadPreviousIdentities();
      expect(history.length).toBeGreaterThan(0);

      const entry = history[0];
      const gracePeriodMs = entry.gracePeriodUntil - entry.identity.createdAt;
      const expectedMs = 30 * 24 * 60 * 60 * 1000; // 30 days

      expect(gracePeriodMs).toBe(expectedMs);
    });

    it("should calculate remaining days correctly", async () => {
      await ensureIdentity();
      await rotateIdentity();

      const history = await loadPreviousIdentities();
      const entry = history[0];

      const now = Date.now();
      const remainingMs = entry.gracePeriodUntil - now;
      const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

      expect(remainingDays).toBeGreaterThan(0);
      expect(remainingDays).toBeLessThanOrEqual(30);
    });

    it("should identify expired grace periods correctly", async () => {
      await ensureIdentity();
      await rotateIdentity();

      // Manually expire the grace period
      const historyData = JSON.parse(localStorage.getItem("vfx_identity_history")!);
      historyData[0].gracePeriodUntil = Date.now() - 1000;
      localStorage.setItem("vfx_identity_history", JSON.stringify(historyData));

      const history = await loadPreviousIdentities();
      const entry = history[0];

      expect(entry.gracePeriodUntil).toBeLessThan(Date.now());
    });
  });
});
