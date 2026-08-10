import { describe, it, expect } from "vitest";
import {
  createTestimony,
  verifyTestimony,
  generateTestimonyKey,
  buildChainEntry,
  buildChain,
  verifyChain,
  exportTestimonyPackage,
  CATEGORY_LABELS,
} from "../lib/testimony";

// crypto.subtle is available in Node 20+
if (!globalThis.crypto?.randomUUID) {
  (globalThis.crypto as any) = {
    ...(globalThis.crypto || {}),
    randomUUID: () => "test-" + Math.random().toString(36).slice(2),
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    },
    subtle: (globalThis.crypto as any)?.subtle,
  };
}

describe("testimony.ts", () => {
  describe("generateTestimonyKey", () => {
    it("should generate a keypair with handle", async () => {
      const keyPair = await generateTestimonyKey();
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.handle).toMatch(/^V-[a-f0-9]{4}-[a-f0-9]{4}$/);
    });

    it("should generate unique handles", async () => {
      const k1 = await generateTestimonyKey();
      const k2 = await generateTestimonyKey();
      expect(k1.handle).not.toBe(k2.handle);
    });
  });

  describe("createTestimony", () => {
    it("should create a signed testimony", async () => {
      const keyPair = await generateTestimonyKey();
      const testimony = await createTestimony(keyPair, {
        statement: "I witnessed artillery strikes on the residential district of the city.",
        eventDate: "2024-01-15",
        location: "Khartoum, Sudan",
        iso3: "SDN",
        category: "war_crime",
        consentPublic: true,
      });
      expect(testimony.id).toBeDefined();
      expect(testimony.signerHandle).toBe(keyPair.handle);
      expect(testimony.signature).toBeDefined();
      expect(testimony.contentHash).toHaveLength(64);
      expect(testimony.consentPublic).toBe(true);
    });

    it("should reject short statements", async () => {
      const keyPair = await generateTestimonyKey();
      await expect(
        createTestimony(keyPair, {
          statement: "Short",
          eventDate: "2024",
          location: "X",
          category: "other",
          consentPublic: false,
        }),
      ).rejects.toThrow("at least 10 characters");
    });
  });

  describe("verifyTestimony", () => {
    it("should verify a valid testimony", async () => {
      const keyPair = await generateTestimonyKey();
      const testimony = await createTestimony(keyPair, {
        statement: "This is a valid testimony about what I observed on that day.",
        eventDate: "2024-01-20",
        location: "Test Location",
        category: "human_rights",
        consentPublic: true,
      });
      const valid = await verifyTestimony(testimony);
      expect(valid).toBe(true);
    });

    it("should reject tampered testimony", async () => {
      const keyPair = await generateTestimonyKey();
      const testimony = await createTestimony(keyPair, {
        statement: "This is the original statement about what happened.",
        eventDate: "2024-01-20",
        location: "Test Location",
        category: "human_rights",
        consentPublic: true,
      });
      const tampered = { ...testimony, statement: "This is a TAMPERED statement about what happened." };
      const valid = await verifyTestimony(tampered);
      expect(valid).toBe(false);
    });
  });

  describe("Chain", () => {
    it("should build a hash chain from testimonies", async () => {
      const keyPair = await generateTestimonyKey();
      const t1 = await createTestimony(keyPair, {
        statement: "First testimony about event one.",
        eventDate: "2024-01-01",
        location: "Location A",
        category: "war_crime",
        consentPublic: true,
      });
      const t2 = await createTestimony(keyPair, {
        statement: "Second testimony about event two.",
        eventDate: "2024-01-02",
        location: "Location B",
        category: "war_crime",
        consentPublic: true,
      });
      const chain = await buildChain([t1, t2]);
      expect(chain).toHaveLength(2);
      expect(chain[0].prevHash).toMatch(/^0+$/); // genesis
      expect(chain[1].prevHash).toBe(chain[0].hash);
    });

    it("should verify a valid chain", async () => {
      const keyPair = await generateTestimonyKey();
      const testimonies = await Promise.all([
        createTestimony(keyPair, {
          statement: "First statement about the events I witnessed.",
          eventDate: "2024-01-01",
          location: "Loc A",
          category: "corruption",
          consentPublic: true,
        }),
        createTestimony(keyPair, {
          statement: "Second statement about different events I saw.",
          eventDate: "2024-01-02",
          location: "Loc B",
          category: "corruption",
          consentPublic: true,
        }),
      ]);
      const chain = await buildChain(testimonies);
      const result = await verifyChain(testimonies, chain);
      expect(result.valid).toBe(true);
      expect(result.totalEntries).toBe(2);
    });

    it("should detect chain tampering", async () => {
      const keyPair = await generateTestimonyKey();
      const testimonies = await Promise.all([
        createTestimony(keyPair, {
          statement: "First statement about what happened there.",
          eventDate: "2024-01-01",
          location: "Loc A",
          category: "corruption",
          consentPublic: true,
        }),
        createTestimony(keyPair, {
          statement: "Second statement about a different event entirely.",
          eventDate: "2024-01-02",
          location: "Loc B",
          category: "corruption",
          consentPublic: true,
        }),
      ]);
      const chain = await buildChain(testimonies);
      // Tamper with the first testimony's signer handle in the chain computation
      const tamperedChain = [...chain];
      tamperedChain[1] = { ...tamperedChain[1], prevHash: "f".repeat(64) };
      const result = await verifyChain(testimonies, tamperedChain);
      expect(result.valid).toBe(false);
      expect(result.brokenAt).toBe(1);
    });
  });

  describe("exportTestimonyPackage", () => {
    it("should export valid JSON", async () => {
      const keyPair = await generateTestimonyKey();
      const t = await createTestimony(keyPair, {
        statement: "A statement for export testing purposes here.",
        eventDate: "2024-01-01",
        location: "Test",
        category: "other",
        consentPublic: true,
      });
      const chain = await buildChain([t]);
      const exported = exportTestimonyPackage([t], chain);
      const parsed = JSON.parse(exported);
      expect(parsed.type).toBe("vfx_testimony_package");
      expect(parsed.testimonies).toHaveLength(1);
    });
  });

  describe("metadata", () => {
    it("should have category labels", () => {
      expect(Object.keys(CATEGORY_LABELS).length).toBeGreaterThanOrEqual(5);
    });
  });
});
