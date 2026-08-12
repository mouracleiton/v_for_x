/**
 * Phase 13 — Verifiable public record (RFC, dispute, mirror-feed, data-freshness, review decay)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createRFC,
  signRFC,
  verifyRFC,
  encodeRFCToken,
  decodeRFCToken,
  isRFCToken,
  createEndorsement,
  signEndorsement,
  verifyEndorsement,
  tallyEndorsements,
  encodeEndorsementToken,
  decodeEndorsementToken,
  describeRFC,
  summarizeTally,
  loadLocalRFCs,
  addLocalRFC,
} from "@/lib/rfc";
import {
  createDispute,
  signDispute,
  verifyDispute,
  evaluateDisputes,
  encodeDisputeToken,
  decodeDisputeToken,
  isDisputeToken,
  describeDispute,
  severityWeight,
  DEFAULT_DISPUTE_THRESHOLD,
  type SignedDispute,
} from "@/lib/dispute";
import {
  gatherMirrorFeed,
  analyzeFeed,
  gatherRingFeed,
  liveRootFetcher,
  feedFromReport,
  summarizeFeed,
  type RootFetcher,
} from "@/lib/mirror-feed";
import {
  DATA_SOURCES,
  buildReport,
  computeEntry,
  statusForAge,
  stalenessScore,
  formatAge,
  statusColor,
  summarizeReport,
  type DataSource,
} from "@/lib/data-freshness";
import {
  createReviewCommitment,
  reviewDecayWeight,
  weightedAggregateReviews,
  REVIEW_DECAY_HALF_LIFE_DAYS,
  type PeerReview,
} from "@/lib/review";
import { detectToken } from "@/lib/tokens";
import { seedRing, type RingEntry } from "@/lib/mirror-ring";

beforeEach(() => {
  localStorage.clear();
});

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};
vi.stubGlobal("localStorage", localStorageMock);

async function makeKey() {
  return crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
}

/* ═══════════════════════════════════════════════════════════════
   RFC (VFXRFC1)
   ═══════════════════════════════════════════════════════════════ */

describe("signed RFC governance proposals", () => {
  it("creates and hashes an RFC", async () => {
    const rfc = await createRFC({ title: "Adopt convoy threshold K=3", body: "We propose...", groundingHash: "a".repeat(64) });
    expect(rfc.id).toBeTruthy();
    expect(rfc.status).toBe("open");
    expect(rfc.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws on missing title/body", async () => {
    await expect(createRFC({ title: "", body: "x" })).rejects.toThrow();
    await expect(createRFC({ title: "x", body: "" })).rejects.toThrow();
  });

  it("signs and verifies", async () => {
    const kp = await makeKey();
    const rfc = await createRFC({ title: "T", body: "B" });
    const signed = await signRFC(rfc, kp);
    expect(signed.signature).toBeTruthy();
    expect(await verifyRFC(signed)).toEqual({ ok: true });
  });

  it("detects tampering", async () => {
    const kp = await makeKey();
    const signed = await signRFC(await createRFC({ title: "T", body: "B" }), kp);
    signed.title = "Changed";
    const res = await verifyRFC(signed);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("hash_mismatch");
  });

  it("encodes and decodes tokens, detected by registry", async () => {
    const kp = await makeKey();
    const signed = await signRFC(await createRFC({ title: "T", body: "B" }), kp);
    const token = encodeRFCToken(signed);
    expect(token.startsWith("VFXRFC1:")).toBe(true);
    expect(isRFCToken(token)).toBe(true);
    expect(detectToken(token)?.spec.id).toBe("VFXRFC1");
    expect(decodeRFCToken(token).id).toBe(signed.id);
  });

  it("persists RFCs locally deduped", async () => {
    const rfc = await createRFC({ title: "T", body: "B" });
    addLocalRFC(rfc);
    addLocalRFC(rfc);
    expect(loadLocalRFCs()).toHaveLength(1);
  });

  it("rejects malformed tokens", () => {
    expect(() => decodeRFCToken("nope")).toThrow();
  });

  it("describes and summarizes", async () => {
    const rfc = await createRFC({ title: "T", body: "B" });
    expect(describeRFC(rfc)).toContain("[OPEN]");
    expect(summarizeTally({ endorsements: 3, objections: 1, abstentions: 0, net: 2, voters: 4 })).toContain("+3");
  });
});

describe("RFC endorsements", () => {
  it("creates, signs, and verifies endorsements", async () => {
    const kp = await makeKey();
    const e = await createEndorsement({ rfcId: "r1", stance: "endorse", comment: "good" });
    const signed = await signEndorsement(e, kp);
    expect(await verifyEndorsement(signed)).toEqual({ ok: true });
    const token = encodeEndorsementToken(signed);
    expect(decodeEndorsementToken(token).rfcId).toBe("r1");
  });

  it("tallies endorsements, deduping by signer", async () => {
    const kp1 = await makeKey();
    const kp2 = await makeKey();
    const kp3 = await makeKey();
    const e1 = await signEndorsement(await createEndorsement({ rfcId: "r", stance: "endorse" }), kp1);
    const e2 = await signEndorsement(await createEndorsement({ rfcId: "r", stance: "endorse" }), kp2);
    const e3 = await signEndorsement(await createEndorsement({ rfcId: "r", stance: "object" }), kp3);
    // duplicate from kp1 (different content, same key) should be deduped
    const e1dup = await signEndorsement(await createEndorsement({ rfcId: "r", stance: "abstain" }), kp1);
    const tally = await tallyEndorsements([e1, e2, e3, e1dup]);
    expect(tally.endorsements).toBe(2);
    expect(tally.objections).toBe(1);
    expect(tally.net).toBe(1);
    // kp1's two votes dedupe to one
    expect(tally.abstentions).toBe(0);
  });

  it("tally rejects unverifiable endorsements", async () => {
    const e = await createEndorsement({ rfcId: "r", stance: "endorse" });
    // not signed but has no signature fields → still counts (unsigned is allowed)
    const tally = await tallyEndorsements([e]);
    expect(tally.endorsements).toBe(1);
    // tampered hash → rejected
    const tampered = { ...e, hash: "0".repeat(64) };
    const tally2 = await tallyEndorsements([tampered]);
    expect(tally2.endorsements).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Dispute (VFXDSP1)
   ═══════════════════════════════════════════════════════════════ */

describe("dossier dispute workflow", () => {
  it("creates and hashes a dispute", async () => {
    const d = await createDispute({ dossierId: "d1", reason: "fabricated casualty figures", severity: "fabrication" });
    expect(d.dossierId).toBe("d1");
    expect(d.severity).toBe("fabrication");
    expect(d.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws without reason or dossierId", async () => {
    await expect(createDispute({ dossierId: "", reason: "x" })).rejects.toThrow();
    await expect(createDispute({ dossierId: "d", reason: "" })).rejects.toThrow();
  });

  it("signs and verifies", async () => {
    const kp = await makeKey();
    const signed = await signDispute(await createDispute({ dossierId: "d", reason: "r" }), kp);
    expect(await verifyDispute(signed)).toEqual({ ok: true });
  });

  it("detects tampering", async () => {
    const kp = await makeKey();
    const signed = await signDispute(await createDispute({ dossierId: "d", reason: "r" }), kp);
    signed.reason = "changed";
    const res = await verifyDispute(signed);
    expect(res.ok).toBe(false);
  });

  it("encodes tokens detected by registry", async () => {
    const d = await createDispute({ dossierId: "d", reason: "r" });
    const token = encodeDisputeToken(d);
    expect(isDisputeToken(token)).toBe(true);
    expect(detectToken(token)?.spec.id).toBe("VFXDSP1");
    expect(decodeDisputeToken(token).dossierId).toBe("d");
  });

  it("evaluates threshold: distinct signers only", async () => {
    const kp1 = await makeKey();
    const kp2 = await makeKey();
    const kp3 = await makeKey();
    const d1 = await signDispute(await createDispute({ dossierId: "d", reason: "a", action: "unpublish" }), kp1);
    const d2 = await signDispute(await createDispute({ dossierId: "d", reason: "b", action: "unpublish" }), kp2);
    const d3 = await signDispute(await createDispute({ dossierId: "d", reason: "c", action: "flag", severity: "fabrication" }), kp3);
    // 3 distinct signers → over threshold (default 3); majority voted unpublish
    const status = await evaluateDisputes("d", [d1, d2, d3]);
    expect(status.overThreshold).toBe(true);
    expect(status.distinctSigners).toBe(3);
    expect(status.maxSeverity).toBe("fabrication");
    expect(status.recommendedAction).toBe("unpublish");
  });

  it("under threshold does not recommend action", async () => {
    const kp1 = await makeKey();
    const d1 = await signDispute(await createDispute({ dossierId: "d", reason: "a" }), kp1);
    const status = await evaluateDisputes("d", [d1]);
    expect(status.overThreshold).toBe(false);
    expect(status.recommendedAction).toBeNull();
  });

  it("dedupes disputes from the same signer", async () => {
    const kp = await makeKey();
    const d1 = await signDispute(await createDispute({ dossierId: "d", reason: "a" }), kp);
    const d2 = await signDispute(await createDispute({ dossierId: "d", reason: "b" }), kp);
    const status = await evaluateDisputes("d", [d1, d2]);
    expect(status.distinctSigners).toBe(1);
  });

  it("respects custom threshold", async () => {
    const kps = await Promise.all([makeKey(), makeKey()]);
    const ds: SignedDispute[] = [];
    for (let i = 0; i < kps.length; i++) {
      const d = await createDispute({ dossierId: "d", reason: String(i) });
      ds.push(await signDispute(d, kps[i]!));
    }
    const status = await evaluateDisputes("d", ds, 2);
    expect(status.overThreshold).toBe(true);
    expect(status.threshold).toBe(2);
  });

  it("severityWeight ranks correctly", async () => {
    expect(severityWeight("fabrication")).toBeGreaterThan(severityWeight("minor"));
    expect(severityWeight("serious")).toBeGreaterThan(severityWeight("moderate"));
    expect(DEFAULT_DISPUTE_THRESHOLD).toBe(3);
    const d = await createDispute({ dossierId: "d", reason: "r", severity: "serious", action: "correct" });
    expect(describeDispute(d)).toContain("SERIOUS");
    expect(describeDispute(d)).toContain("correct");
  });
});

/* ═══════════════════════════════════════════════════════════════
   Mirror Feed
   ═══════════════════════════════════════════════════════════════ */

describe("cross-mirror consensus feed", () => {
  it("aggregates roots and detects agreement", async () => {
    const fetcher: RootFetcher = async (host) => (host.includes("agree") ? "rootAAA" : null);
    const result = await gatherMirrorFeed(
      [{ host: "agree1" }, { host: "agree2" }, { host: "down1" }],
      fetcher,
    );
    expect(result.reachable).toBe(2);
    expect(result.attempted).toBe(3);
    expect(result.inAgreement).toBe(true);
    expect(result.distinctRoots).toEqual(["rootAAA"]);
    expect(result.majorityPercentage).toBe(100);
  });

  it("detects a fork when roots diverge", async () => {
    const fetcher: RootFetcher = async (host) =>
      host.startsWith("a") ? "rootA" : "rootB";
    const result = await gatherMirrorFeed(
      [{ host: "a1" }, { host: "a2" }, { host: "b1" }],
      fetcher,
    );
    expect(result.hasFork).toBe(true);
    expect(result.distinctRoots).toHaveLength(2);
    expect(result.majority).not.toBeNull();
    expect(result.majority!.count).toBe(2);
  });

  it("analyzeFeed works with no roots", () => {
    const result = analyzeFeed([{ host: "x", root: null, ts: 0 }]);
    expect(result.reachable).toBe(0);
    expect(result.inAgreement).toBe(true); // vacuously
    expect(summarizeFeed(result)).toContain("none reachable");
  });

  it("liveRootFetcher returns null when fetch unavailable", async () => {
    const f = liveRootFetcher();
    const realFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = undefined; // simulate no fetch
    try {
      expect(await f("https://example.com")).toBeNull();
    } finally {
      (globalThis as any).fetch = realFetch;
    }
  });

  it("gatherRingFeed uses the ring hosts", async () => {
    const ring: RingEntry[] = seedRing([
      { host: "https://m1.example", transport: "clearnet", claimedAt: "2024-01-01" },
      { host: "https://m2.example", transport: "clearnet", claimedAt: "2024-01-01" },
    ]);
    const fetcher: RootFetcher = async () => "rootX";
    const result = await gatherRingFeed(ring, fetcher);
    expect(result.reachable).toBe(2);
    expect(result.inAgreement).toBe(true);
  });

  it("feedFromReport builds from attestations", () => {
    const json = JSON.stringify({
      attestations: [
        { mirrorEndpoint: "https://m1", rootHash: "r1", ts: 1 },
        { mirrorEndpoint: "https://m2", rootHash: "r1", ts: 2 },
      ],
    });
    const result = feedFromReport(json);
    expect(result).not.toBeNull();
    expect(result!.reachable).toBe(2);
    expect(result!.inAgreement).toBe(true);
  });

  it("feedFromReport returns null on bad json", () => {
    expect(feedFromReport("not json")).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════
   Data Freshness
   ═══════════════════════════════════════════════════════════════ */

describe("data freshness dashboard", () => {
  it("statusForAge classifies by ratio", () => {
    expect(statusForAge(3, 7)).toBe("fresh");
    expect(statusForAge(8, 7)).toBe("aging");
    expect(statusForAge(15, 7)).toBe("stale");
    expect(statusForAge(30, 7)).toBe("critical");
  });

  it("statusForAge handles irregular cadence", () => {
    expect(statusForAge(10, null)).toBe("fresh");
    expect(statusForAge(400, null)).toBe("critical");
  });

  it("stalenessScore is bounded 0..1", () => {
    expect(stalenessScore(3, 7)).toBe(0);
    expect(stalenessScore(100, 7)).toBe(1);
    expect(stalenessScore(50, null)).toBeGreaterThan(0);
  });

  it("computeEntry computes age and status", () => {
    const now = Date.UTC(2024, 5, 1);
    const src: DataSource = { id: "x", label: "X", category: "conflict", publisher: "P", lastUpdated: now - 20 * 86_400_000, cadenceDays: 7, source: "f" };
    const e = computeEntry(src, now);
    expect(e.ageDays).toBeCloseTo(20, 0);
    expect(e.status).toBe("stale");
    expect(e.overdueDays).toBeGreaterThan(0);
  });

  it("buildReport aggregates and finds worst status", () => {
    const now = Date.UTC(2024, 5, 1);
    const report = buildReport(DATA_SOURCES, now);
    expect(report.entries.length).toBe(DATA_SOURCES.length);
    expect(report.counts).toBeDefined();
    expect(report.worstStatus).toBeTruthy();
    expect(report.meanStaleness).toBeGreaterThanOrEqual(0);
    expect(summarizeReport(report)).toContain("fresh");
  });

  it("formatAge and statusColor helpers", () => {
    expect(formatAge(0)).toBe("today");
    expect(formatAge(10)).toContain("days");
    expect(formatAge(60)).toContain("months");
    expect(formatAge(400)).toContain("years");
    expect(statusColor("fresh")).toBe("#00ff41");
    expect(statusColor("critical")).toBe("#ff0000");
  });
});

/* ═══════════════════════════════════════════════════════════════
   Review reputation decay
   ═══════════════════════════════════════════════════════════════ */

describe("review reputation decay", () => {
  const DAY = 86_400_000;

  it("reviewDecayWeight is 1.0 today and 0.5 after one half-life", () => {
    const now = Date.UTC(2024, 5, 1);
    expect(reviewDecayWeight(now, now)).toBeCloseTo(1, 5);
    const halfYearAgo = now - REVIEW_DECAY_HALF_LIFE_DAYS * DAY;
    expect(reviewDecayWeight(halfYearAgo, now)).toBeCloseTo(0.5, 2);
  });

  it("weight decreases monotonically with age", () => {
    const now = Date.UTC(2024, 5, 1);
    const w0 = reviewDecayWeight(now, now);
    const w1 = reviewDecayWeight(now - 30 * DAY, now);
    const w2 = reviewDecayWeight(now - 365 * DAY, now);
    expect(w0).toBeGreaterThan(w1);
    expect(w1).toBeGreaterThan(w2);
  });

  it("weightedAggregateReviews weights recent reviews higher", async () => {
    const now = Date.UTC(2024, 5, 1);
    const recent: PeerReview = { dossierId: "d", rating: 5, flags: ["verified_evidence"], ts: now - 1 * DAY };
    const old: PeerReview = { dossierId: "d", rating: 1, flags: ["insufficient"], ts: now - 720 * DAY };

    const recentCommit = await createReviewCommitment(recent);
    const oldCommit = await createReviewCommitment(old);

    const result = await weightedAggregateReviews(
      { reviewerRecent: recentCommit.commit, reviewerOld: oldCommit.commit },
      [
        { review: recent, nonce: recentCommit.nonce },
        { review: old, nonce: oldCommit.nonce },
      ],
      now,
    );
    expect(result.count).toBe(2);
    // weighted mean should be pulled toward the recent rating (5) > unweighted
    expect(result.weightedMeanRating).toBeGreaterThan(result.meanRating);
    expect(result.effectiveN).toBeGreaterThan(0);
    expect(result.mostInfluential).not.toBeNull();
    expect(result.mostInfluential!.rating).toBe(5);
  });
});
