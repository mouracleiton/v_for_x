import { describe, it, expect } from "vitest";
import {
  proveSetMembership,
  verifySetMembership,
  createCommitment,
  openCommitment,
} from "../lib/zk";

describe("zk.ts", () => {
  describe("createCommitment / openCommitment", () => {
    it("should create a verifiable commitment", async () => {
      const { commitment, nonce } = await createCommitment("SDN");
      expect(commitment).toHaveLength(64);
      expect(nonce).toHaveLength(64);
      const valid = await openCommitment(commitment, nonce, "SDN");
      expect(valid).toBe(true);
    });

    it("should reject wrong value on open", async () => {
      const { commitment, nonce } = await createCommitment("SDN");
      const valid = await openCommitment(commitment, nonce, "USA");
      expect(valid).toBe(false);
    });

    it("should reject wrong nonce on open", async () => {
      const { commitment, nonce } = await createCommitment("SDN");
      const valid = await openCommitment(commitment, nonce + "ff", "SDN");
      expect(valid).toBe(false);
    });

    it("should produce different commitments for same value (random nonce)", async () => {
      const a = await createCommitment("SDN");
      const b = await createCommitment("SDN");
      expect(a.commitment).not.toBe(b.commitment);
    });
  });

  describe("proveSetMembership / verifySetMembership", () => {
    const hotspots = ["SDN", "YEM", "AFG", "SOM", "HTI", "SYR"];

    it("should prove and verify valid membership", async () => {
      const { proof } = await proveSetMembership("SDN", hotspots, "hunger_hotspot");
      const verified = await verifySetMembership(proof, hotspots);
      expect(verified).toBe(true);
    });

    it("should reject membership for value not in set", async () => {
      await expect(
        proveSetMembership("USA", hotspots, "hunger_hotspot")
      ).rejects.toThrow("not in the valid set");
    });

    it("should fail verification if set changes", async () => {
      const { proof } = await proveSetMembership("SDN", hotspots, "hunger_hotspot");
      const differentSet = ["USA", "CAN", "MEX"];
      const verified = await verifySetMembership(proof, differentSet);
      expect(verified).toBe(false);
    });

    it("should fail verification with tampered challenge", async () => {
      const { proof } = await proveSetMembership("SDN", hotspots, "hunger_hotspot");
      const tampered = { ...proof, challenge: "0".repeat(64) };
      const verified = await verifySetMembership(tampered, hotspots);
      expect(verified).toBe(false);
    });

    it("should work with any member of the set", async () => {
      for (const member of ["YEM", "AFG", "SOM"]) {
        const { proof } = await proveSetMembership(member, hotspots, "hunger_hotspot");
        const verified = await verifySetMembership(proof, hotspots);
        expect(verified).toBe(true);
      }
    });

    it("should not reveal which member was proven", async () => {
      // The proof for SDN and YEM should be structurally identical
      // (same length, hex format) — an observer can't distinguish them
      const proofA = await proveSetMembership("SDN", hotspots, "hunger_hotspot");
      const proofB = await proveSetMembership("YEM", hotspots, "hunger_hotspot");
      // Commitments must be different (different nonces) but same format
      expect(proofA.proof.commitment).not.toBe(proofB.proof.commitment);
      expect(proofA.proof.commitment).toHaveLength(proofB.proof.commitment.length);
      // Both verify against the full set
      expect(await verifySetMembership(proofA.proof, hotspots)).toBe(true);
      expect(await verifySetMembership(proofB.proof, hotspots)).toBe(true);
    });
  });
});
