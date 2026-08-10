import { describe, it, expect, beforeAll } from "vitest";
import {
  cosineSimilarity,
  softmaxWeights,
  normalizeValue,
  computeMetricStats,
  computeMetricWeights,
  buildMetricCorpus,
  buildCountryProfile,
  buildSemanticIndex,
  semanticSearch,
  semanticMetricThreshold,
  isConceptualQuery,
  indexCacheKey,
  type EmbedFn,
} from "../lib/semantic-oracle";
import { METRICS, type MetricDef } from "../lib/oracle";
import type { CountryData } from "../lib/types";
import backbone from "../data/world_backbone.json";

const realData = backbone as unknown as { countries: CountryData[] };

/* ═══════════════════════════════════════════════════════════════
   Deterministic mock embedder
   Maps a small set of crisis concepts onto orthogonal basis vectors so
   the ranking logic is exercised without downloading a real model.
   ═══════════════════════════════════════════════════════════════ */

const AXES = {
  hunger: [1, 0, 0, 0, 0, 0, 0, 0],
  conflict: [0, 1, 0, 0, 0, 0, 0, 0],
  military: [0, 0, 1, 0, 0, 0, 0, 0],
  health: [0, 0, 0, 1, 0, 0, 0, 0],
  poverty: [0, 0, 0, 0, 1, 0, 0, 0],
  climate: [0, 0, 0, 0, 0, 1, 0, 0],
  governance: [0, 0, 0, 0, 0, 0, 1, 0],
  economy: [0, 0, 0, 0, 0, 0, 0, 1],
} as const;

const CONCEPT_KEYWORDS: Record<keyof typeof AXES, string[]> = {
  hunger: ["hunger", "undernourish", "starv", "malnourish", "food insecur", "famine", "stunt", "wasting", "acute food"],
  conflict: ["conflict", "war", "violence", "battle", "displace", "refugee"],
  military: ["military", "defense", "arms", "war budget", "defense spending"],
  health: ["life expectancy", "lifespan", "doctors", "physician", "child mortality", "infant", "health spending", "healthcare"],
  poverty: ["poverty", "poor", "destitution", "extreme poverty"],
  climate: ["co2", "carbon", "emissions", "air pollution", "pm25", "smog", "climate emissions"],
  governance: ["corruption", "corrupt", "democracy", "democratic", "freedom", "authoritarian", "autocracy"],
  economy: ["gdp", "income", "wealth", "economic output", "per capita", "unemploy"],
};

function makeMockEmbedder(): EmbedFn {
  return async (texts: string[]) =>
    texts.map((t) => {
      const lower = t.toLowerCase();
      let acc = new Array(8).fill(0);
      for (const [axis, kws] of Object.entries(CONCEPT_KEYWORDS) as [keyof typeof AXES, string[]][]) {
        if (kws.some((k) => lower.includes(k))) {
          acc = acc.map((v, i) => v + AXES[axis][i]);
        }
      }
      const norm = Math.hypot(...acc) || 1;
      return acc.map((v) => v / norm);
    });
}

/* ═══════════════════════════════════════════════════════════════
   Pure vector math
   ═══════════════════════════════════════════════════════════════ */

describe("semantic-oracle · vector math", () => {
  it("cosineSimilarity is 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  });

  it("cosineSimilarity is 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it("cosineSimilarity handles zeros and mismatched lengths", () => {
    expect(cosineSimilarity([], [1])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  it("softmax concentrates weight on the largest input above the floor", () => {
    const w = softmaxWeights([0.9, 0.2, 0.1], 0.15, 0.12);
    expect(w[0]).toBeGreaterThan(w[1]);
    expect(w[0]).toBeGreaterThan(w[2]);
    const sum = w[0] + w[1] + w[2];
    expect(sum).toBeCloseTo(1, 6);
  });

  it("softmax floors out low-similarity entries", () => {
    const w = softmaxWeights([0.9, 0.01, 0.0], 0.15, 0.12);
    expect(w[1]).toBe(0);
    expect(w[2]).toBe(0);
  });

  it("softmax falls back to uniform when all are below the floor", () => {
    const w = softmaxWeights([0.01, 0.02], 0.15, 0.12);
    expect(w[0]).toBeCloseTo(0.5, 6);
    expect(w[1]).toBeCloseTo(0.5, 6);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Normalization (direction-aware)
   ═══════════════════════════════════════════════════════════════ */

describe("semantic-oracle · normalization", () => {
  const stats = { min: 0, max: 100, range: 100, present: [true] };

  it("treats higherIsCrisis metrics as worse-when-larger", () => {
    const metric = { higherIsCrisis: true } as MetricDef;
    expect(normalizeValue(100, stats, metric)).toBeCloseTo(1);
    expect(normalizeValue(0, stats, metric)).toBeCloseTo(0);
  });

  it("inverts non-crisis metrics (higher is better → low is the crisis)", () => {
    const metric = { higherIsCrisis: undefined } as MetricDef;
    expect(normalizeValue(0, stats, metric)).toBeCloseTo(1);
    expect(normalizeValue(100, stats, metric)).toBeCloseTo(0);
  });

  it("clamps out-of-range values", () => {
    const metric = { higherIsCrisis: true } as MetricDef;
    expect(normalizeValue(200, stats, metric)).toBe(1);
    expect(normalizeValue(-5, stats, metric)).toBe(0);
  });

  it("computeMetricStats computes min/max over present values only", () => {
    const m: MetricDef = {
      id: "x",
      label: "X",
      unit: "",
      keywords: [],
      extract: (c) => (c as unknown as { _v?: number })._v ?? null,
    };
    const countries = [
      { _v: 10 },
      { _v: 50 },
      { _v: null },
      { _v: 30 },
    ] as unknown as CountryData[];
    const [stats] = computeMetricStats(countries, [m]);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(50);
    expect(stats.present).toEqual([true, true, false, true]);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Corpus + profile builders
   ═══════════════════════════════════════════════════════════════ */

describe("semantic-oracle · corpus builders", () => {
  it("buildMetricCorpus includes label, unit, keywords and direction", () => {
    const m = METRICS.find((x) => x.id === "undernourishment")!;
    const text = buildMetricCorpus(m);
    expect(text.toLowerCase()).toContain("undernourishment");
    expect(text.toLowerCase()).toContain("famine");
    expect(text.toLowerCase()).toContain("crisis"); // higherIsCrisis
  });

  it("buildCountryProfile produces a readable sentence with present metrics", () => {
    const c = realData.countries.find((x) => x.iso3 === "AFG")!;
    const text = buildCountryProfile(c, METRICS);
    expect(text).toContain("Afghanistan");
    // Should include at least one hunger metric value.
    expect(text.toLowerCase()).toMatch(/undernourish|food insecur|stunt/);
  });

  it("buildCountryProfile skips null metric values", () => {
    const c = realData.countries[0];
    const text = buildCountryProfile(c, METRICS);
    // No literal "null" should leak into the profile.
    expect(text).not.toMatch(/: null/);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Concept detection
   ═══════════════════════════════════════════════════════════════ */

describe("semantic-oracle · concept detection", () => {
  it("flags conceptual queries", () => {
    expect(isConceptualQuery("Which countries are most likely to tip into famine next year?")).toBe(true);
    expect(isConceptualQuery("Countries on the brink of collapse")).toBe(true);
    expect(isConceptualQuery("Where is life most precarious for children?")).toBe(true);
  });

  it("does not flag hard-threshold queries", () => {
    expect(isConceptualQuery("Countries where hunger > 30%")).toBe(false);
    expect(isConceptualQuery("Top 10 countries by military spending")).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Cache key
   ═══════════════════════════════════════════════════════════════ */

describe("semantic-oracle · cache key", () => {
  it("is stable for identical inputs", () => {
    const cs = realData.countries;
    expect(indexCacheKey("M", cs, "1", "2024")).toBe(indexCacheKey("M", cs, "1", "2024"));
  });

  it("changes when the model or data version changes", () => {
    const cs = realData.countries;
    expect(indexCacheKey("M", cs, "1", "2024")).not.toBe(indexCacheKey("M2", cs, "1", "2024"));
    expect(indexCacheKey("M", cs, "1", "2024")).not.toBe(indexCacheKey("M", cs, "2", "2024"));
  });
});

/* ═══════════════════════════════════════════════════════════════
   End-to-end semantic search (real data + mock embedder)
   ═══════════════════════════════════════════════════════════════ */

describe("semantic-oracle · semantic search", () => {
  let index: Awaited<ReturnType<typeof buildSemanticIndex>>;

  beforeAll(async () => {
    index = await buildSemanticIndex(realData.countries, METRICS, makeMockEmbedder(), {
      modelId: "mock",
    });
  });

  it("builds an index with one vector per country and per metric", () => {
    expect(index.countryVectors.length).toBe(realData.countries.length);
    expect(index.metricVectors.length).toBe(METRICS.length);
    expect(index.dim).toBeGreaterThan(0);
    expect(index.metricStats.length).toBe(METRICS.length);
  });

  it("ranks real famine-crisis countries at the top for a famine query", async () => {
    const embed = makeMockEmbedder();
    const [queryVec] = await embed(["which countries are most likely to tip into famine next year"]);
    const res = semanticSearch(queryVec, index, { topK: 15 });

    expect(res.results).toHaveLength(15);
    // Every result has a score and rank.
    res.results.forEach((r, i) => {
      expect(r.rank).toBe(i + 1);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    });

    // Canonical famine-risk countries (IPC/WFP) must surface in the top 15.
    const isoSet = new Set(res.results.map((r) => r.country.iso3));
    const canonical = ["SDN", "COD", "YEM", "MDG", "AFG", "SYR"];
    const hits = canonical.filter((iso) => isoSet.has(iso));
    expect(hits.length).toBeGreaterThanOrEqual(5);

    // Semantic quality: the top-15 mean undernourishment must far exceed the
    // global mean — proving the ranker concentrates on genuinely hungry nations.
    const undVals = realData.countries
      .map((c) => c.hunger.undernourishment_pct)
      .filter((v): v is number => v != null);
    const globalMean =
      undVals.reduce((a, b) => a + b, 0) / undVals.length;
    const topMean =
      res.results
        .map((r) => r.country.hunger.undernourishment_pct)
        .filter((v): v is number => v != null)
        .reduce((a, b) => a + b, 0) / 15;
    expect(topMean).toBeGreaterThan(globalMean * 1.5);

    // Scores are monotonically non-increasing.
    for (let i = 1; i < res.results.length; i++) {
      expect(res.results[i - 1].score).toBeGreaterThanOrEqual(res.results[i].score);
    }
  });

  it("attributes weight to hunger-family metrics for a famine query", async () => {
    const embed = makeMockEmbedder();
    const [queryVec] = await embed(["countries at risk of famine and mass starvation"]);
    const weights = computeMetricWeights(queryVec, index);
    const topIds = weights.slice(0, 5).map((w) => w.metric.id);
    expect(topIds).toContain("undernourishment");
  });

  it("results carry explainability (top contributing metrics)", async () => {
    const embed = makeMockEmbedder();
    const [queryVec] = await embed(["famine risk"]);
    const res = semanticSearch(queryVec, index, { topK: 5 });
    const top = res.results[0];
    expect(top.topMetrics.length).toBeGreaterThan(0);
    top.topMetrics.forEach((m) => {
      expect(m.normalizedValue).toBeGreaterThanOrEqual(0);
      expect(m.normalizedValue).toBeLessThanOrEqual(1);
    });
  });

  it("respects a region filter", async () => {
    const embed = makeMockEmbedder();
    const [queryVec] = await embed(["hunger crisis"]);
    const res = semanticSearch(queryVec, index, { topK: 50, region: "africa" });
    res.results.forEach((r) => {
      const region = r.country.region.toLowerCase();
      const sub = r.country.subregion.toLowerCase();
      expect(region.includes("africa") || sub.includes("africa")).toBe(true);
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
   Hybrid threshold mode (semantic metric ID + exact execution)
   ═══════════════════════════════════════════════════════════════ */

describe("semantic-oracle · hybrid threshold", () => {
  let index: Awaited<ReturnType<typeof buildSemanticIndex>>;

  beforeAll(async () => {
    index = await buildSemanticIndex(realData.countries, METRICS, makeMockEmbedder(), {
      modelId: "mock",
    });
  });

  it("semantically identifies the metric for a threshold query without the keyword", async () => {
    const embed = makeMockEmbedder();
    // No literal "mortality" keyword, but "child death rate" should map to
    // the child-mortality metric semantically (via the health/death concept).
    const [queryVec] = await embed(["child death rate above 50"]);
    const res = semanticMetricThreshold(queryVec, index, "child death rate above 50");
    expect(res).not.toBeNull();
    expect(res!.results.length).toBeGreaterThan(0);
    // Every returned value must actually exceed the threshold.
    res!.results.forEach((r) => expect(r.value).toBeGreaterThan(50));
  });

  it("returns null when nothing relevant can be inferred", async () => {
    const embed = makeMockEmbedder();
    const [queryVec] = await embed(["zzz irrelevant gibberish"]);
    const res = semanticMetricThreshold(queryVec, index, "zzz irrelevant gibberish");
    expect(res).toBeNull();
  });
});
