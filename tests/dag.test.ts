import { describe, it, expect } from "vitest";
import {
  createDagEntry,
  computeEntryHash,
  verifyEntry,
  verifyChain,
  getLastHash,
  shortHash,
  GENESIS_HASH,
  signDagEntry,
  verifyDagSignature,
  generateDagKeyPair,
  type DagEntry,
} from "../lib/dag";

// crypto.subtle is available in Node 20+ global scope
const GENESIS = "0".repeat(64);

async function makeTestEntry(
  overrides: Partial<Omit<DagEntry, "id">> = {}
): Promise<DagEntry> {
  const base: Omit<DagEntry, "hash" | "id"> = {
    ts: 1700000000000,
    source: "V-ABCD-EFGH",
    destination: "Zone-7",
    amount: "$5,000",
    purpose: "food",
    status: "PENDING",
    signerHandle: "V-ABCD-EFGH",
    prevHash: GENESIS,
    ...overrides,
  };
  const hash = await computeEntryHash(base);
  return { ...base, hash };
}

describe("dag.ts", () => {
  describe("computeEntryHash", () => {
    it("should return a 64-char hex string", async () => {
      const hash = await computeEntryHash({
        ts: 1000,
        source: "A",
        destination: "B",
        amount: "$100",
        purpose: "test",
        status: "PENDING",
        signerHandle: "A",
        prevHash: GENESIS,
      });
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it("should produce different hashes for different content", async () => {
      const h1 = await computeEntryHash({
        ts: 1000, source: "A", destination: "B", amount: "$100",
        purpose: "food", status: "PENDING", signerHandle: "A", prevHash: GENESIS,
      });
      const h2 = await computeEntryHash({
        ts: 1000, source: "A", destination: "B", amount: "$100",
        purpose: "medical", status: "PENDING", signerHandle: "A", prevHash: GENESIS,
      });
      expect(h1).not.toBe(h2);
    });

    it("should produce same hash for identical content", async () => {
      const data = {
        ts: 2000, source: "X", destination: "Y", amount: "$50",
        purpose: "water", status: "VERIFIED", signerHandle: "X", prevHash: GENESIS,
      };
      const h1 = await computeEntryHash(data);
      const h2 = await computeEntryHash(data);
      expect(h1).toBe(h2);
    });

    it("should produce different hashes for different prevHash (chain linkage)", async () => {
      const base = {
        ts: 1000, source: "A", destination: "B", amount: "$100",
        purpose: "food", status: "PENDING", signerHandle: "A",
      };
      const h1 = await computeEntryHash({ ...base, prevHash: GENESIS });
      const h2 = await computeEntryHash({ ...base, prevHash: "a".repeat(64) });
      expect(h1).not.toBe(h2);
    });
  });

  describe("createDagEntry", () => {
    it("should create entry with hash and prevHash", async () => {
      const entry = await createDagEntry(
        {
          ts: 1000,
          source: "A",
          destination: "B",
          amount: "$100",
          purpose: "food",
          status: "PENDING",
          signerHandle: "A",
        },
        GENESIS
      );
      expect(entry.hash).toHaveLength(64);
      expect(entry.prevHash).toBe(GENESIS);
    });

    it("should chain to previous entry hash", async () => {
      const entry1 = await createDagEntry(
        { ts: 1000, source: "A", destination: "B", amount: "$100", purpose: "food", status: "PENDING", signerHandle: "A" },
        GENESIS
      );
      const entry2 = await createDagEntry(
        { ts: 2000, source: "C", destination: "D", amount: "$200", purpose: "water", status: "VERIFIED", signerHandle: "C" },
        entry1.hash
      );
      expect(entry2.prevHash).toBe(entry1.hash);
      expect(entry2.hash).not.toBe(entry1.hash);
    });
  });

  describe("verifyEntry", () => {
    it("should return true for untampered entry", async () => {
      const entry = await makeTestEntry();
      expect(await verifyEntry(entry)).toBe(true);
    });

    it("should return false for tampered amount", async () => {
      const entry = await makeTestEntry();
      entry.amount = "$999,999"; // tamper!
      expect(await verifyEntry(entry)).toBe(false);
    });

    it("should return false for tampered status", async () => {
      const entry = await makeTestEntry();
      entry.status = "VERIFIED"; // tamper!
      expect(await verifyEntry(entry)).toBe(false);
    });

    it("should return false for tampered prevHash", async () => {
      const entry = await makeTestEntry();
      entry.prevHash = "f".repeat(64); // tamper!
      expect(await verifyEntry(entry)).toBe(false);
    });
  });

  describe("verifyChain", () => {
    it("should accept empty chain", async () => {
      const result = await verifyChain([]);
      expect(result.valid).toBe(true);
    });

    it("should accept valid single-entry chain", async () => {
      const entry = await makeTestEntry();
      const result = await verifyChain([entry]);
      expect(result.valid).toBe(true);
    });

    it("should accept valid multi-entry chain", async () => {
      const e1 = await makeTestEntry({ ts: 1000 });
      const e2 = await makeTestEntry({ ts: 2000, prevHash: e1.hash });
      const e3 = await makeTestEntry({ ts: 3000, prevHash: e2.hash });
      const result = await verifyChain([e1, e2, e3]);
      expect(result.valid).toBe(true);
      expect(result.totalEntries).toBe(3);
    });

    it("should reject chain with tampered entry", async () => {
      const e1 = await makeTestEntry({ ts: 1000 });
      const e2 = await makeTestEntry({ ts: 2000, prevHash: e1.hash });
      e1.amount = "$0"; // tamper with first entry
      const result = await verifyChain([e1, e2]);
      expect(result.valid).toBe(false);
      expect(result.brokenAt).toBe(0);
    });

    it("should reject chain with broken linkage", async () => {
      const e1 = await makeTestEntry({ ts: 1000 });
      const e2 = await makeTestEntry({ ts: 2000, prevHash: "deadbeef".repeat(8) });
      // Recompute e2's hash to be valid for its own content, but linkage is broken
      const e2Hash = await computeEntryHash({
        ts: 2000, source: "V-ABCD-EFGH", destination: "Zone-7", amount: "$5,000",
        purpose: "food", status: "PENDING", signerHandle: "V-ABCD-EFGH",
        prevHash: "deadbeef".repeat(8),
      });
      e2.hash = e2Hash;
      const result = await verifyChain([e1, e2]);
      expect(result.valid).toBe(false);
      expect(result.brokenAt).toBe(1);
      expect(result.message).toContain("prevHash");
    });

    it("should reject chain where entry content was changed after hashing", async () => {
      const e1 = await makeTestEntry({ ts: 1000 });
      const e2 = await makeTestEntry({ ts: 2000, prevHash: e1.hash });
      // Tamper with e2 after its hash was computed
      e2.purpose = "laundering";
      const result = await verifyChain([e1, e2]);
      expect(result.valid).toBe(false);
      expect(result.brokenAt).toBe(1);
    });
  });

  describe("getLastHash", () => {
    it("should return genesis for empty chain", () => {
      expect(getLastHash([])).toBe(GENESIS);
    });

    it("should return last entry's hash", async () => {
      const e1 = await makeTestEntry({ ts: 1000 });
      const e2 = await makeTestEntry({ ts: 2000, prevHash: e1.hash });
      expect(getLastHash([e1, e2])).toBe(e2.hash);
    });
  });

  describe("shortHash", () => {
    it("should return first 12 characters", () => {
      const hash = "abcdef1234567890abcdef1234567890";
      expect(shortHash(hash)).toBe("abcdef123456");
    });

    it("should handle genesis hash", () => {
      expect(shortHash(GENESIS)).toBe("000000000000");
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
   ECDSA Signature tests
   ═══════════════════════════════════════════════════════════════ */

describe("DAG ECDSA signatures", () => {
  it("generateDagKeyPair returns a valid keypair and hex public key", async () => {
    const { keyPair, publicKeyHex } = await generateDagKeyPair();
    expect(keyPair.privateKey).toBeDefined();
    expect(keyPair.publicKey).toBeDefined();
    // P-256 raw public key = 65 bytes (0x04 + 32 + 32) = 130 hex chars
    expect(publicKeyHex).toMatch(/^[0-9a-f]{130}$/);
  });

  it("signDagEntry produces a hex signature", async () => {
    const { keyPair } = await generateDagKeyPair();
    const entry = await makeTestEntry();
    const sig = await signDagEntry(entry, keyPair.privateKey);
    expect(sig).toMatch(/^[0-9a-f]+$/);
    expect(sig.length).toBeGreaterThan(0);
  });

  it("verifyDagSignature returns true for a validly signed entry", async () => {
    const { keyPair, publicKeyHex } = await generateDagKeyPair();
    const entry = await makeTestEntry();
    entry.signature = await signDagEntry(entry, keyPair.privateKey);
    entry.signerPubKey = publicKeyHex;
    expect(await verifyDagSignature(entry)).toBe(true);
  });

  it("verifyDagSignature returns false for a tampered entry", async () => {
    const { keyPair, publicKeyHex } = await generateDagKeyPair();
    const entry = await makeTestEntry();
    entry.signature = await signDagEntry(entry, keyPair.privateKey);
    entry.signerPubKey = publicKeyHex;
    // Tamper with the hash
    entry.hash = "f".repeat(64);
    expect(await verifyDagSignature(entry)).toBe(false);
  });

  it("verifyDagSignature returns false for unsigned entries", async () => {
    const entry = await makeTestEntry();
    expect(await verifyDagSignature(entry)).toBe(false);
  });

  it("verifyDagSignature returns false with wrong public key", async () => {
    const { keyPair: signerPair, publicKeyHex } = await generateDagKeyPair();
    const { keyPair: otherPair } = await generateDagKeyPair();
    const entry = await makeTestEntry();
    // Sign with one key, but claim a different public key
    entry.signature = await signDagEntry(entry, signerPair.privateKey);
    const otherPub = await generateDagKeyPair();
    entry.signerPubKey = otherPub.publicKeyHex;
    expect(await verifyDagSignature(entry)).toBe(false);
  });

  it("two different keypairs produce different signatures for the same entry", async () => {
    const entry = await makeTestEntry();
    const { keyPair: pairA } = await generateDagKeyPair();
    const { keyPair: pairB } = await generateDagKeyPair();
    const sigA = await signDagEntry(entry, pairA.privateKey);
    const sigB = await signDagEntry(entry, pairB.privateKey);
    expect(sigA).not.toBe(sigB);
  });
});
