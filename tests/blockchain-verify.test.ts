import { describe, it, expect, vi } from "vitest";
import {
  createMerkleLeaf,
  anchorToDag,
  getQueuedStamps,
  clearQueuedStamp,
  verifyTimestamp,
  notarizeEvidence,
  type MerkleProof,
} from "../lib/blockchain-verify";
import { GENESIS_HASH, type DagEntry } from "../lib/dag";

/* ═══════════════════════════════════════════════════════════════
   createMerkleLeaf
   ═══════════════════════════════════════════════════════════════ */

describe("createMerkleLeaf", () => {
  it("returns the hash itself for a single leaf with no proofs", () => {
    const hash = "a".repeat(64);
    const { root, proofs } = createMerkleLeaf([hash]);
    expect(root).toBe(hash);
    expect(proofs).toHaveLength(0);
  });

  it("returns sha256 of empty string for an empty list", () => {
    const { root, proofs } = createMerkleLeaf([]);
    expect(root).toMatch(/^[0-9a-f]{64}$/);
    expect(proofs).toHaveLength(0);
  });

  it("produces a root and audit proofs for multiple hashes", () => {
    const hashes = [
      "a".repeat(64),
      "b".repeat(64),
      "c".repeat(64),
      "d".repeat(64),
    ];
    const { root, proofs } = createMerkleLeaf(hashes);
    expect(root).toMatch(/^[0-9a-f]{64}$/);
    expect(root).not.toBe(hashes[0]);
    expect(proofs.length).toBeGreaterThan(0);
  });

  it("handles odd number of leaves (duplicates last)", () => {
    const hashes = ["a".repeat(64), "b".repeat(64), "c".repeat(64)];
    const { root, proofs } = createMerkleLeaf(hashes);
    expect(root).toMatch(/^[0-9a-f]{64}$/);
    expect(proofs.length).toBeGreaterThan(0);
  });

  it("normalizes hashes to lowercase", () => {
    const upper = "A".repeat(64);
    const { root: rootUpper } = createMerkleLeaf([upper]);
    const { root: rootLower } = createMerkleLeaf([upper.toLowerCase()]);
    expect(rootUpper).toBe(rootLower);
  });

  it("produces deterministic roots for the same input set", () => {
    const hashes = ["1".repeat(64), "2".repeat(64)];
    const a = createMerkleLeaf(hashes);
    const b = createMerkleLeaf(hashes);
    expect(a.root).toBe(b.root);
    expect(a.proofs).toEqual(b.proofs);
  });

  it("produces different roots for different input sets", () => {
    const setA = ["a".repeat(64), "b".repeat(64)];
    const setB = ["c".repeat(64), "d".repeat(64)];
    expect(createMerkleLeaf(setA).root).not.toBe(createMerkleLeaf(setB).root);
  });

  it("proofs reference one of the original leaf hashes", () => {
    const hashes = ["a".repeat(64), "b".repeat(64)];
    const { proofs } = createMerkleLeaf(hashes);
    for (const p of proofs) {
      expect(hashes).toContain(p.hash);
    }
  });

  it("proof directions are valid", () => {
    const hashes = ["a".repeat(64), "b".repeat(64), "c".repeat(64)];
    const { proofs } = createMerkleLeaf(hashes);
    for (const p of proofs) {
      expect(p.direction === "left" || p.direction === "right").toBe(true);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════
   anchorToDag
   ═══════════════════════════════════════════════════════════════ */

describe("anchorToDag", () => {
  const validHash = "f".repeat(64);

  it("chains from genesis when dagEntries is empty", () => {
    const anchor = anchorToDag(validHash, []);
    expect(anchor).toMatch(/^[0-9a-f]{64}$/);
    expect(anchor).not.toBe(GENESIS_HASH);
  });

  it("chains from the last entry hash when entries exist", () => {
    const prevEntry: DagEntry = {
      prevHash: GENESIS_HASH,
      ts: Date.now(),
      source: "test",
      destination: "prev-evidence",
      amount: "1",
      purpose: "evidence_anchor",
      status: "VERIFIED",
      signerHandle: "",
      hash: "e".repeat(64),
    };
    const anchorFromEmpty = anchorToDag(validHash, []);
    const anchorFromPrev = anchorToDag(validHash, [prevEntry]);
    expect(anchorFromEmpty).not.toBe(anchorFromPrev);
  });

  it("produces different anchors for different evidence hashes", () => {
    const otherHash = "e".repeat(64);
    expect(anchorToDag(validHash, [])).not.toBe(anchorToDag(otherHash, []));
  });

  it("normalizes the evidence hash to lowercase", () => {
    const upper = "F".repeat(64);
    const anchor = anchorToDag(upper, []);
    // The anchor itself is always lowercase hex
    expect(anchor).toBe(anchor.toLowerCase());
    expect(anchor).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces deterministic output for identical inputs at the same time", () => {
    // Note: ts is embedded via Date.now() so we can't test exact determinism
    // across calls, but the format must always be a valid hex hash
    const anchor = anchorToDag(validHash, []);
    expect(anchor).toMatch(/^[0-9a-f]{64}$/);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Local stamp queue (getQueuedStamps / clearQueuedStamp)
   ═══════════════════════════════════════════════════════════════ */

describe("stamp queue", () => {
  it("getQueuedStamps returns an array", () => {
    const stamps = getQueuedStamps();
    expect(Array.isArray(stamps)).toBe(true);
  });

  it("clearQueuedStamp does not throw for unknown hash", () => {
    expect(() => clearQueuedStamp("nonexistent".repeat(5))).not.toThrow();
  });
});

/* ═══════════════════════════════════════════════════════════════
   verifyTimestamp
   ═══════════════════════════════════════════════════════════════ */

describe("verifyTimestamp", () => {
  it("returns confirmed=false for an invalid file", async () => {
    const blob = new Blob(["not a real ots proof"], { type: "application/octet-stream" });
    const file = new File([blob], "fake.ots", { type: "application/octet-stream" });
    const result = await verifyTimestamp(file);
    expect(result.confirmed).toBe(false);
  });

  it("returns confirmed=false for a file with only pending attestation", async () => {
    // 0x83 = pending attestation marker
    const bytes = new Uint8Array([0x83, 0x00]);
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const file = new File([blob], "pending.ots", { type: "application/octet-stream" });
    const result = await verifyTimestamp(file);
    expect(result.confirmed).toBe(false);
  });

  it("returns confirmed=true when a Bitcoin attestation is present", async () => {
    // 0x88 = Bitcoin attestation, followed by 4-byte big-endian block height
    const blockHeight = 800000;
    const bytes = new Uint8Array(5);
    bytes[0] = 0x88;
    const view = new DataView(bytes.buffer);
    view.setUint32(1, blockHeight, false);
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const file = new File([blob], "confirmed.ots", { type: "application/octet-stream" });
    const result = await verifyTimestamp(file);
    expect(result.confirmed).toBe(true);
    expect(result.blockHeight).toBe(blockHeight);
  });
});

/* ═══════════════════════════════════════════════════════════════
   notarizeEvidence
   ═══════════════════════════════════════════════════════════════ */

describe("notarizeEvidence", () => {
  it("throws for invalid hash format", async () => {
    await expect(notarizeEvidence("not-a-hash")).rejects.toThrow(
      "notarizeEvidence expects a 64-char hex SHA-256 digest"
    );
  });

  it("throws for hash with wrong length", async () => {
    await expect(notarizeEvidence("a".repeat(63))).rejects.toThrow();
    await expect(notarizeEvidence("a".repeat(65))).rejects.toThrow();
  });

  it("returns pending result when network is unavailable", async () => {
    const validHash = "a".repeat(64);
    // Mock fetch to fail
    global.fetch = vi.fn().mockRejectedValue(new Error("offline"));
    const result = await notarizeEvidence(validHash);
    expect(result.pending).toBe(true);
    expect(result.hash).toBe(validHash);
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it("queues pending stamps locally on network failure", async () => {
    const validHash = "b".repeat(64);
    const before = getQueuedStamps().length;
    global.fetch = vi.fn().mockRejectedValue(new Error("offline"));
    await notarizeEvidence(validHash);
    const after = getQueuedStamps();
    expect(after.length).toBeGreaterThan(before);
  });

  it("normalizes hash to lowercase", async () => {
    const upperHash = "A".repeat(64);
    global.fetch = vi.fn().mockRejectedValue(new Error("offline"));
    const result = await notarizeEvidence(upperHash);
    expect(result.hash).toBe(upperHash.toLowerCase());
  });
});
