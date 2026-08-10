import { describe, it, expect } from "vitest";
import {
  createFactCheck,
  addSource,
  removeSource,
  setManualVerdict,
  computeVerdictReport,
  recommendVerdict,
  getVerdict,
  exportFactCheck,
  hashSourceContent,
  verifySource,
  buildSeedFactChecks,
  CREDIBILITY_WEIGHTS,
  VERDICT_LABELS,
} from "../lib/verdict";
import type { FactCheck } from "../lib/verdict";

async function fcWith(sources: Parameters<typeof addSource>[1][]): Promise<FactCheck> {
  let fc = createFactCheck({ text: "Test claim", claimant: "Claimant", medium: "speech" });
  for (const s of sources) fc = await addSource(fc, s);
  return fc;
}

describe("verdict.ts", () => {
  describe("hashSourceContent / verifySource", () => {
    it("should produce a 64-char hex digest", async () => {
      const h = await hashSourceContent("hello world");
      expect(h).toHaveLength(64);
      expect(h).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should be deterministic for identical content", async () => {
      const a = await hashSourceContent("the regime denies everything");
      const b = await hashSourceContent("the regime denies everything");
      expect(a).toBe(b);
    });

    it("should detect tampering via verifySource", async () => {
      let fc = await fcWith([
        {
          title: "S",
          publisher: "Wire",
          accessedDate: "2025-01-01",
          stance: "refutes_claim",
          credibility: "high",
          excerpt: "Original cited text.",
        },
      ]);
      const intact = await verifySource(fc.sources[0]);
      expect(intact).toBe(true);

      const tampered = { ...fc.sources[0], excerpt: "Silently edited text." };
      const broken = await verifySource(tampered);
      expect(broken).toBe(false);
    });
  });

  describe("createFactCheck / addSource", () => {
    it("should create an empty fact check", () => {
      const fc = createFactCheck({ text: "X", claimant: "Y", medium: "other" });
      expect(fc.id).toBeDefined();
      expect(fc.sources).toHaveLength(0);
      expect(fc.status).toBe("open");
      expect(fc.title).toBe("X");
    });

    it("should truncate long claims into a title", () => {
      const long =
        "This is a very long claim that exceeds the seventy character limit for an auto generated title and should be truncated";
      const fc = createFactCheck({ text: long, claimant: "Y", medium: "other" });
      expect(fc.title.endsWith("…")).toBe(true);
      expect(fc.title.length).toBeLessThanOrEqual(70);
    });

    it("should hash the excerpt on add", async () => {
      const fc = await fcWith([
        {
          title: "S",
          publisher: "Wire",
          accessedDate: "2025-01-01",
          stance: "supports_claim",
          credibility: "high",
          excerpt: "corroborating text",
        },
      ]);
      expect(fc.sources).toHaveLength(1);
      expect(fc.sources[0].contentHash).toHaveLength(64);
      expect(fc.sources[0].id).toBeDefined();
    });

    it("should respect a precomputed contentHash if supplied", async () => {
      const pre = await hashSourceContent("fixed");
      const fc = await fcWith([
        {
          title: "S",
          publisher: "Wire",
          accessedDate: "2025-01-01",
          stance: "supports_claim",
          credibility: "medium",
          excerpt: "fixed",
          contentHash: pre,
        },
      ]);
      expect(fc.sources[0].contentHash).toBe(pre);
    });

    it("should remove a source by id", async () => {
      const fc = await fcWith([
        {
          title: "A",
          publisher: "P1",
          accessedDate: "2025-01-01",
          stance: "supports_claim",
          credibility: "medium",
          excerpt: "a",
        },
        {
          title: "B",
          publisher: "P2",
          accessedDate: "2025-01-01",
          stance: "supports_claim",
          credibility: "medium",
          excerpt: "b",
        },
      ]);
      const removed = removeSource(fc, fc.sources[0].id);
      expect(removed.sources).toHaveLength(1);
      expect(removed.sources[0].title).toBe("B");
    });
  });

  describe("recommendVerdict", () => {
    it("should be unverified with no sources", () => {
      expect(recommendVerdict([])).toBe("unverified");
    });

    it("should be false when high-credibility sources refute", () => {
      expect(
        recommendVerdict([
          { id: "1", title: "a", publisher: "A", accessedDate: "x", stance: "refutes_claim", credibility: "high", contentHash: "h", excerpt: "a" },
          { id: "2", title: "b", publisher: "B", accessedDate: "x", stance: "refutes_claim", credibility: "high", contentHash: "h", excerpt: "b" },
          { id: "3", title: "c", publisher: "C", accessedDate: "x", stance: "refutes_claim", credibility: "high", contentHash: "h", excerpt: "c" },
        ]),
      ).toBe("false");
    });

    it("should be true when high-credibility sources support", () => {
      expect(
        recommendVerdict([
          { id: "1", title: "a", publisher: "A", accessedDate: "x", stance: "supports_claim", credibility: "high", contentHash: "h", excerpt: "a" },
          { id: "2", title: "b", publisher: "B", accessedDate: "x", stance: "supports_claim", credibility: "high", contentHash: "h", excerpt: "b" },
        ]),
      ).toBe("true");
    });

    it("should be misleading when contextual dominates", () => {
      // 1 low support + 1 medium refute + 2 established contextual
      expect(
        recommendVerdict([
          { id: "1", title: "a", publisher: "A", accessedDate: "x", stance: "supports_claim", credibility: "low", contentHash: "h", excerpt: "a" },
          { id: "2", title: "b", publisher: "B", accessedDate: "x", stance: "refutes_claim", credibility: "medium", contentHash: "h", excerpt: "b" },
          { id: "3", title: "c", publisher: "C", accessedDate: "x", stance: "contextual", credibility: "established", contentHash: "h", excerpt: "c" },
          { id: "4", title: "d", publisher: "D", accessedDate: "x", stance: "contextual", credibility: "established", contentHash: "h", excerpt: "d" },
        ]),
      ).toBe("misleading");
    });

    it("should be mixed when support and refute are balanced", () => {
      // one medium support vs one medium refute => truthScore 0 => mixed
      expect(
        recommendVerdict([
          { id: "1", title: "a", publisher: "A", accessedDate: "x", stance: "supports_claim", credibility: "medium", contentHash: "h", excerpt: "a" },
          { id: "2", title: "b", publisher: "B", accessedDate: "x", stance: "refutes_claim", credibility: "medium", contentHash: "h", excerpt: "b" },
        ]),
      ).toBe("mixed");
    });
  });

  describe("computeVerdictReport", () => {
    it("should return minimal confidence and gaps for an empty check", () => {
      const fc = createFactCheck({ text: "x", claimant: "y", medium: "other" });
      const r = computeVerdictReport(fc);
      expect(r.confidence).toBe(0);
      expect(r.level).toBe("minimal");
      expect(r.verdict).toBe("unverified");
      expect(r.gaps.length).toBeGreaterThan(0);
    });

    it("should score high confidence for 3 independent high-credibility refutations", async () => {
      const fc = await fcWith([
        { title: "a", publisher: "Wire A", url: "https://x", publishedDate: "2025-01-01", accessedDate: "2025-01-02", stance: "refutes_claim", credibility: "high", excerpt: "a" },
        { title: "b", publisher: "Wire B", url: "https://y", publishedDate: "2025-01-01", accessedDate: "2025-01-02", stance: "refutes_claim", credibility: "high", excerpt: "b" },
        { title: "c", publisher: "Wire C", url: "https://z", publishedDate: "2025-01-01", accessedDate: "2025-01-02", stance: "refutes_claim", credibility: "high", excerpt: "c" },
      ]);
      const r = computeVerdictReport(fc);
      expect(r.verdict).toBe("false");
      expect(r.confidence).toBeGreaterThanOrEqual(80);
      expect(r.level).toBe("high");
      expect(r.independentPublishers).toBe(3);
      expect(r.corroboratingSources).toBe(3);
    });

    it("should flag non-independence when all sources share a publisher", async () => {
      const fc = await fcWith([
        { title: "a", publisher: "Same Outlet", accessedDate: "2025-01-02", stance: "refutes_claim", credibility: "high", excerpt: "a" },
        { title: "b", publisher: "Same Outlet", accessedDate: "2025-01-02", stance: "refutes_claim", credibility: "high", excerpt: "b" },
      ]);
      const r = computeVerdictReport(fc);
      expect(r.independentPublishers).toBe(1);
      expect(r.gaps.some((g) => /independ/i.test(g))).toBe(true);
    });

    it("should flag missing high-credibility sources", async () => {
      const fc = await fcWith([
        { title: "a", publisher: "A", accessedDate: "2025-01-02", stance: "refutes_claim", credibility: "low", excerpt: "a" },
        { title: "b", publisher: "B", accessedDate: "2025-01-02", stance: "refutes_claim", credibility: "low", excerpt: "b" },
      ]);
      const r = computeVerdictReport(fc);
      expect(r.gaps.some((g) => /high-credibility/i.test(g))).toBe(true);
    });

    it("should respect a manual verdict override", async () => {
      let fc = await fcWith([
        { title: "a", publisher: "A", accessedDate: "2025-01-02", stance: "refutes_claim", credibility: "high", excerpt: "a" },
        { title: "b", publisher: "B", accessedDate: "2025-01-02", stance: "refutes_claim", credibility: "high", excerpt: "b" },
      ]);
      fc = setManualVerdict(fc, "true");
      const r = computeVerdictReport(fc);
      expect(r.recommendedVerdict).toBe("false");
      expect(r.verdict).toBe("true");
      expect(getVerdict(fc)).toBe("true");
    });
  });

  describe("exportFactCheck", () => {
    it("should export a structured JSON package with the schema tag and source hashes", async () => {
      const fc = await fcWith([
        { title: "a", publisher: "A", url: "https://a", accessedDate: "2025-01-02", stance: "refutes_claim", credibility: "high", excerpt: "abc" },
      ]);
      const json = exportFactCheck(fc);
      const parsed = JSON.parse(json);
      expect(parsed.schema).toBe("vfx-verdict/1");
      expect(parsed.sources[0].contentHash).toHaveLength(64);
      expect(parsed.verdict.final).toBe("false");
      expect(parsed.verdict.recommended).toBe("false");
    });
  });

  describe("metadata", () => {
    it("should expose weights and verdict labels", () => {
      expect(CREDIBILITY_WEIGHTS.high).toBeGreaterThan(CREDIBILITY_WEIGHTS.low);
      expect(Object.keys(VERDICT_LABELS)).toHaveLength(5);
    });
  });

  describe("buildSeedFactChecks", () => {
    it("should build seed sheets with computed content hashes and matching verdicts", async () => {
      const seeds = await buildSeedFactChecks();
      expect(seeds.length).toBeGreaterThanOrEqual(3);
      for (const s of seeds) {
        expect(s.seed).toBe(true);
        expect(s.sources.length).toBeGreaterThan(0);
        for (const src of s.sources) {
          expect(src.contentHash).toHaveLength(64);
          const ok = await verifySource(src);
          expect(ok).toBe(true);
        }
      }
      const byTitle = Object.fromEntries(seeds.map((s) => [s.manualVerdict, s]));
      expect(byTitle.false).toBeDefined();
      expect(byTitle.misleading).toBeDefined();
      expect(byTitle.mixed).toBeDefined();
    });
  });
});
