import { describe, it, expect } from "vitest";
import {
  REVIEW_TOKEN_PREFIX,
  createReviewCommitment,
  verifyReveal,
  signReveal,
  aggregateReviews,
  canonicalReview,
  encodeReviewToken,
  decodeReviewToken,
  isValidRating,
  isValidReview,
  type PeerReview,
  type RevealedReview,
} from "../lib/review";

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

const REVIEW: PeerReview = {
  dossierId: "DA-2024-001",
  rating: 4,
  flags: ["verified_evidence", "has_sources"],
  note: "Source documents match the ICC warrant.",
  ts: Date.now(),
};

async function committed(
  review: PeerReview = REVIEW,
): Promise<{ commitment: string; revealed: RevealedReview }> {
  const { commit, nonce } = await createReviewCommitment(review);
  return { commitment: commit, revealed: { review, nonce } };
}

describe("review.ts", () => {
  describe("validation", () => {
    it("accepts valid ratings and rejects out-of-range", () => {
      for (let r = 1; r <= 5; r++) expect(isValidRating(r)).toBe(true);
      expect(isValidRating(0)).toBe(false);
      expect(isValidRating(6)).toBe(false);
      expect(isValidRating(3.5)).toBe(false);
      expect(isValidRating("4" as never)).toBe(false);
    });

    it("validates reviews", () => {
      expect(isValidReview(REVIEW)).toBe(true);
      expect(isValidReview({ ...REVIEW, dossierId: "" })).toBe(false);
      expect(isValidReview({ ...REVIEW, flags: ["bogus" as never] })).toBe(false);
      expect(isValidReview(null as never)).toBe(false);
    });
  });

  describe("commit/reveal", () => {
    it("reveals a review that matches its commitment", async () => {
      const { commitment, revealed } = await committed();
      const res = await verifyReveal(commitment, revealed);
      expect(res.verified).toBe(true);
    });

    it("rejects a reveal with the wrong nonce (tampered content)", async () => {
      const { commitment } = await committed();
      const res = await verifyReveal(commitment, {
        review: { ...REVIEW, rating: 5 },
        nonce: "stolen-nonce",
      });
      expect(res.verified).toBe(false);
      expect(res.reason).toBe("commitment_mismatch");
    });

    it("rejects a reveal of a different review", async () => {
      const { commitment, revealed } = await committed();
      const res = await verifyReveal(commitment, {
        ...revealed,
        review: { ...REVIEW, dossierId: "DA-2024-999" },
      });
      expect(res.verified).toBe(false);
    });

    it("rejects malformed inputs", async () => {
      const { revealed } = await committed();
      expect((await verifyReveal("", revealed)).verified).toBe(false);
      expect((await verifyReveal("abc", null as never)).verified).toBe(false);
      expect((await verifyReveal("abc", { ...revealed, nonce: "" })).verified).toBe(false);
    });

    it("canonical content is deterministic", () => {
      const a = canonicalReview(REVIEW, "nonce-1");
      const b = canonicalReview(REVIEW, "nonce-1");
      expect(a).toBe(b);
      expect(canonicalReview(REVIEW, "nonce-1")).not.toBe(canonicalReview(REVIEW, "nonce-2"));
    });
  });

  describe("signing", () => {
    it("signs and verifies an identity-bound reveal", async () => {
      const { commitment, revealed } = await committed();
      const keyPair = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"],
      );
      const signed = await signReveal(revealed, keyPair);
      expect(signed.signature).toBeTruthy();
      expect(signed.signerPublicKey).toBeTruthy();

      const res = await verifyReveal(commitment, signed);
      expect(res.verified).toBe(true);
    });

    it("fails verification when the signature was made by a different key", async () => {
      const { commitment, revealed } = await committed();
      const otherKey = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"],
      );
      const signed = await signReveal(revealed, otherKey);
      // tamper: swap signer key claim with yet another key
      const thirdKey = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"],
      );
      const pub = new Uint8Array(await crypto.subtle.exportKey("spki", thirdKey.publicKey));
      const swapped = {
        ...signed,
        signerPublicKey: btoa(String.fromCharCode(...pub)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
      };
      const res = await verifyReveal(commitment, swapped);
      expect(res.verified).toBe(false);
      expect(res.reason).toBe("sig_mismatch");
    });
  });

  describe("aggregation", () => {
    it("counts only commitment-verified reveals", async () => {
      const r1 = await committed({ ...REVIEW, rating: 5, ts: 100 });
      const r2 = await committed({ ...REVIEW, rating: 5, ts: 90, flags: ["has_sources"] });
      const junk = {
        review: { ...REVIEW, rating: 1, ts: 80 },
        nonce: "not-the-nonce",
      };
      const agg = await aggregateReviews(
        { "reviewer-1": r1.commitment, "reviewer-2": r2.commitment },
        [r1.revealed, junk, r2.revealed],
      );
      expect(agg.count).toBe(2);
      expect(agg.rejected).toBe(1);
      expect(agg.meanRating).toBe(5);
      expect(agg.ratingHistogram).toEqual([0, 0, 0, 0, 2]);
      expect(agg.flagTallies.verified_evidence).toBe(1);
      expect(agg.flagTallies.has_sources).toBe(2);
    });

    it("dedupes multiple reveals from the same reviewer", async () => {
      const r1 = await committed({ ...REVIEW, rating: 5 });
      const dup = await committed({ ...REVIEW, rating: 5 });
      const agg = await aggregateReviews(
        { "reviewer-1": r1.commitment },
        [r1.revealed, dup.revealed],
      );
      expect(agg.count).toBe(1);
    });

    it("handles empty input", async () => {
      const agg = await aggregateReviews({}, []);
      expect(agg.count).toBe(0);
      expect(agg.meanRating).toBe(0);
      expect(agg.ratingHistogram).toEqual([0, 0, 0, 0, 0]);
    });
  });

  describe("tokens", () => {
    it("round-trips review tokens", async () => {
      const { revealed } = await committed();
      const token = encodeReviewToken(revealed);
      expect(token.startsWith(REVIEW_TOKEN_PREFIX)).toBe(true);
      const decoded = decodeReviewToken(token);
      expect(decoded.review.rating).toBe(REVIEW.rating);
      expect(decoded.nonce).toBe(revealed.nonce);
    });

    it("rejects malformed tokens", () => {
      expect(() => decodeReviewToken("garbage")).toThrow(/Not a review token/);
      expect(() => decodeReviewToken(REVIEW_TOKEN_PREFIX + "!!!")).toThrow();
      expect(() => decodeReviewToken(REVIEW_TOKEN_PREFIX + "e30=")).toThrow();
      const token = encodeReviewToken({
        review: REVIEW,
        nonce: "x",
      });
      void token;
    });
  });
});