/**
 * V FOR X — On-device Semantic Oracle
 *
 * Real natural-language understanding over 200 countries × 28 dimensions.
 * Builds a vector semantic index entirely on-device (WASM / WebGPU) and
 * answers conceptual questions that keyword matching cannot, e.g.
 *   "Which countries are most likely to tip into famine next year?"
 *
 * Privacy by design: this module performs ZERO network access. The only
 * thing that ever crosses the wire is the one-time download of the public
 * open-source embedding model (cached locally forever after). Every user
 * query is embedded and compared against the local index in-browser.
 * Nothing about the query ever leaves the device.
 *
 * Architecture note — this file is deliberately model-agnostic and has no
 * dependency on transformers.js. All vector math (cosine similarity,
 * direction-aware normalization, composite crisis scoring, ranking) is
 * pure and deterministic, taking an injected `EmbedFn`. That makes the
 * intelligence fully unit-testable without downloading a model, and lets
 * the runtime model loader (lib/embeddings.ts) be swapped or mocked freely.
 */

import type { CountryData } from "./types";
import type { MetricDef } from "./oracle";
import { METRICS, parseQuery, executeQuery, type ParsedQuery, type QueryResult } from "./oracle";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

/**
 * Embeds an array of raw strings into equal-length unit vectors.
 * Implemented by lib/embeddings.ts at runtime via transformers.js.
 * Pure modules accept this as a parameter so they stay testable.
 */
export type EmbedFn = (texts: string[]) => Promise<number[][]>;

export interface SemanticIndex {
  modelId: string;
  dim: number;
  /** Stable cache key derived from model + data version. */
  cacheKey: string;
  metrics: MetricDef[];
  countries: CountryData[];
  /** Embedding per metric, aligned with `metrics`. */
  metricVectors: number[][];
  /** Embedding per country profile, aligned with `countries`. */
  countryVectors: number[][];
  /** Per-metric normalization stats (min/max) computed over present data. */
  metricStats: MetricStats[];
}

export interface MetricStats {
  min: number;
  max: number;
  range: number;
  /** For each country, whether a non-null value is present for this metric. */
  present: boolean[];
}

export interface MetricContribution {
  metric: MetricDef;
  /** Query→metric cosine similarity (raw). */
  similarity: number;
  /** Normalized weight used in the composite (sums to 1 across contributions). */
  weight: number;
}

export interface CountryHitMetric {
  metric: MetricDef;
  weight: number;
  /** 0..1 crisis-normalized value for this country on this metric. */
  normalizedValue: number;
  /** Raw metric value. */
  rawValue: number;
}

export interface SemanticCountryResult {
  country: CountryData;
  rank: number;
  /** Blended final score in [0,1] used for ranking. */
  score: number;
  /** Weighted-composite crisis score across relevant metrics. */
  composite: number;
  /** Direct query→country-profile semantic similarity. */
  semantic: number;
  /** Top contributing metrics for this country (explainability). */
  topMetrics: CountryHitMetric[];
}

export interface SemanticSearchResult {
  results: SemanticCountryResult[];
  /** Metric weights derived from the query (explainability). */
  metricWeights: MetricContribution[];
  interpretation: string;
  /** How the query was resolved. */
  mode: "concept" | "metric-threshold";
}

export interface SearchOptions {
  /** Number of countries to return. Default 15. */
  topK?: number;
  /** Softmax temperature for metric weighting (lower = sharper). Default 0.15. */
  temperature?: number;
  /** Cosine floor below which a metric is dropped from the composite. Default 0.12. */
  relevanceFloor?: number;
  /** Weight of the composite metric score vs direct semantic similarity. Default 0.8. */
  compositeWeight?: number;
  /** Optional region filter (pre-filters the country pool). */
  region?: string;
}

/* ═══════════════════════════════════════════════════════════════
   Vector math — pure, deterministic
   ═══════════════════════════════════════════════════════════════ */

/** Cosine similarity. Works on number[] and Float32Array. */
export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  for (let i = 0; i < len; i++) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Numerically stable softmax over similarities, with a relevance floor. */
export function softmaxWeights(
  sims: number[],
  temperature: number,
  floor: number
): number[] {
  const kept = sims.map((s) => (s >= floor ? s : -Infinity));
  const finite = kept.filter((s) => s !== -Infinity);
  if (finite.length === 0) {
    // Fall back: uniform over everything.
    return sims.map(() => 1 / sims.length);
  }
  const max = Math.max(...finite);
  const exps = kept.map((s) => (s === -Infinity ? 0 : Math.exp((s - max) / temperature)));
  const sum = exps.reduce((a, b) => a + b, 0);
  if (sum === 0) return sims.map(() => 1 / sims.length);
  return exps.map((e) => e / sum);
}

/* ═══════════════════════════════════════════════════════════════
   Corpus builders — turn structured data into embeddable language
   ═══════════════════════════════════════════════════════════════ */

/** A rich, model-friendly description of a metric for semantic matching. */
export function buildMetricCorpus(metric: MetricDef): string {
  const direction = metric.higherIsCrisis
    ? "Higher values indicate a worsening crisis."
    : "Lower values indicate worse outcomes.";
  return [
    metric.label,
    `Measured in ${metric.unit || "arbitrary units"}.`,
    `Related concepts: ${metric.keywords.join(", ")}.`,
    direction,
  ].join(" ");
}

/**
 * Turns a country's row of numbers into natural-language "crisis profile"
 * text. This is the semantic index over the 200×N matrix: the embedding of
 * this sentence captures the overall shape of a country's situation, so a
 * conceptual query ("countries near famine") matches the right countries
 * even when no single keyword is present.
 */
export function buildCountryProfile(country: CountryData, metrics: MetricDef[]): string {
  const parts: string[] = [`${country.name_en} (${country.region}).`];
  for (const m of metrics) {
    const v = m.extract(country);
    if (v === null || v === undefined || Number.isNaN(v)) continue;
    parts.push(`${m.label}: ${formatProfileValue(v, m)}.`);
  }
  if (country.is_hotspot) parts.push("Designated hunger hotspot.");
  return parts.join(" ");
}

function formatProfileValue(v: number, metric: MetricDef): string {
  if (metric.unit === "%") return `${round(v, 1)}%`;
  if (metric.unit === "M people" || metric.unit === "M") return `${round(v, 1)} million`;
  if (metric.unit.includes("per 1k") || metric.unit.includes("per 100k"))
    return `${round(v, 1)} ${metric.unit}`;
  if (v >= 1_000_000_000) return `$${round(v / 1_000_000_000, 1)} billion`;
  if (v >= 1_000_000) return `${round(v / 1_000_000, 1)} million`;
  return `${round(v, 2)}`;
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/* ═══════════════════════════════════════════════════════════════
   Normalization — direction-aware crisis scaling to [0,1]
   ═══════════════════════════════════════════════════════════════ */

/** Compute min/max per metric across all countries that have a value. */
export function computeMetricStats(
  countries: CountryData[],
  metrics: MetricDef[]
): MetricStats[] {
  return metrics.map((m) => {
    const values: number[] = [];
    const present: boolean[] = [];
    for (const c of countries) {
      const v = m.extract(c);
      const ok = v !== null && v !== undefined && !Number.isNaN(v);
      present.push(ok);
      if (ok) values.push(v as number);
    }
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    return { min, max, range: max - min || 1, present };
  });
}

/**
 * Normalize a raw metric value to a 0..1 *crisis* scale where 1 = worst.
 * Direction is inferred from the metric definition: `higherIsCrisis`
 * metrics scale up with the value; everything else is inverted (higher is
 * better, so low values are the crisis).
 */
export function normalizeValue(
  value: number,
  stats: MetricStats,
  metric: MetricDef
): number {
  if (stats.range === 0) return 0;
  const frac = (value - stats.min) / stats.range;
  const clamped = Math.max(0, Math.min(1, frac));
  return metric.higherIsCrisis ? clamped : 1 - clamped;
}

/* ═══════════════════════════════════════════════════════════════
   Index construction
   ═══════════════════════════════════════════════════════════════ */

/** Stable cache key derived from model id + data version. */
export function indexCacheKey(
  modelId: string,
  countries: CountryData[],
  schemaVersion?: string,
  lastUpdated?: string
): string {
  const isoSig = countries.map((c) => c.iso3).join(",");
  return `${modelId}|${schemaVersion ?? "0"}|${lastUpdated ?? "?"}|${isoSig}`;
}

/**
 * Build the full semantic index: embeds every metric description and every
 * country profile. This is the one-time, cacheable computation (the
 * "semantic index over the 200×N data"). Embeddings are batched in chunks
 * to respect model throughput limits; `onProgress` reports 0..1.
 */
export async function buildSemanticIndex(
  countries: CountryData[],
  metrics: MetricDef[],
  embed: EmbedFn,
  opts: {
    modelId: string;
    schemaVersion?: string;
    lastUpdated?: string;
    chunkSize?: number;
    onProgress?: (frac: number, label: string) => void;
  }
): Promise<SemanticIndex> {
  const chunkSize = opts.chunkSize ?? 32;
  const onProgress = opts.onProgress ?? (() => {});

  onProgress(0.02, "Embedding metric dimensions…");
  const metricCorpora = metrics.map(buildMetricCorpus);
  const metricVectors: number[][] = [];
  for (let i = 0; i < metricCorpora.length; i += chunkSize) {
    const chunk = metricCorpora.slice(i, i + chunkSize);
    const vecs = await embed(chunk);
    metricVectors.push(...vecs);
    onProgress(0.02 + 0.08 * (i / metricCorpora.length), "Embedding metric dimensions…");
  }

  onProgress(0.1, "Profiling 200 countries…");
  const profiles = countries.map((c) => buildCountryProfile(c, metrics));

  const total = profiles.length;
  const countryVectors: number[][] = [];
  for (let i = 0; i < total; i += chunkSize) {
    const chunk = profiles.slice(i, i + chunkSize);
    const vecs = await embed(chunk);
    countryVectors.push(...vecs);
    onProgress(0.1 + 0.85 * (i / total), `Indexing countries ${i + 1}–${Math.min(i + chunkSize, total)} of ${total}…`);
  }

  onProgress(0.98, "Computing normalization statistics…");
  const metricStats = computeMetricStats(countries, metrics);

  const dim = metricVectors[0]?.length ?? countryVectors[0]?.length ?? 0;
  onProgress(1, "Semantic index ready.");

  return {
    modelId: opts.modelId,
    dim,
    cacheKey: indexCacheKey(opts.modelId, countries, opts.schemaVersion, opts.lastUpdated),
    metrics,
    countries,
    metricVectors,
    countryVectors,
    metricStats,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Query routing
   ═══════════════════════════════════════════════════════════════ */

/**
 * Phrases that signal a conceptual / composite question rather than a
 * request for a single metric with a hard threshold. When present, the
 * semantic composite ranker takes over even if a keyword also matched.
 */
const CONCEPTUAL_SIGNALS = [
  "tip into", "tipping", "brink", "on the edge", "verge of",
  "collapse", "failing", "failed state", "fragile",
  "most vulnerable", "most precarious", "most at risk", "at risk of",
  "likely to", "risk of", "vulnerable to", "prone to",
  "worst affected", "worst hit", "hardest hit", "most affected",
  "where is life", "where are people", "most oppressed",
  "suffer the most", "struggling the most", "in crisis", "in danger",
  "next year", "soon", "imminent",
  "safest", "best place", "best quality of life", "thriving",
  "most unequal", "most corrupt",
];

export function isConceptualQuery(query: string): boolean {
  const lower = query.toLowerCase();
  if (CONCEPTUAL_SIGNALS.some((p) => lower.includes(p))) return true;
  // No comparator keyword and no explicit number → likely conceptual.
  const hasComparator = /[><]|above|below|over|under|more than|less than|higher than|lower than|exceeding/.test(lower);
  const hasNumber = /\b\d+(\.\d+)?\b/.test(lower);
  return !hasComparator && !hasNumber;
}

/* ═══════════════════════════════════════════════════════════════
   Search — the semantic answer engine
   ═══════════════════════════════════════════════════════════════ */

/** Metric weights induced by the query (softmax over query→metric sims). */
export function computeMetricWeights(
  queryVec: number[],
  index: SemanticIndex,
  opts: SearchOptions = {}
): MetricContribution[] {
  const temperature = opts.temperature ?? 0.15;
  const floor = opts.relevanceFloor ?? 0.12;

  const sims = index.metricVectors.map((mv) => cosineSimilarity(queryVec, mv));
  const weights = softmaxWeights(sims, temperature, floor);

  return index.metrics
    .map((metric, i) => ({ metric, similarity: sims[i], weight: weights[i] }))
    .filter((c) => c.weight > 0)
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Full semantic search. Blends two on-device signals:
 *   1. composite — a weighted, direction-normalized crisis score across the
 *      metrics most relevant to the query (precise, interpretable).
 *   2. semantic — direct cosine similarity between the query and each
 *      country's crisis-profile embedding (captures shape/concept).
 *
 * For threshold queries ("hunger > 30%") the heuristic engine is more
 * exact, so callers may pass the parsed query to route into metric-threshold
 * mode (semantic metric identification + precise numeric filtering).
 */
export function semanticSearch(
  queryVec: number[],
  index: SemanticIndex,
  opts: SearchOptions = {}
): SemanticSearchResult {
  const topK = opts.topK ?? 15;
  const compositeWeight = opts.compositeWeight ?? 0.8;

  const region = opts.region?.toLowerCase();

  // Pre-filter by region.
  const poolIdx: number[] = [];
  for (let i = 0; i < index.countries.length; i++) {
    const c = index.countries[i];
    if (region) {
      const r = c.region.toLowerCase();
      const sr = c.subregion.toLowerCase();
      if (!r.includes(region) && !sr.includes(region) && !region.includes(r)) continue;
    }
    poolIdx.push(i);
  }

  const contributions = computeMetricWeights(queryVec, index, opts);

  const hits: SemanticCountryResult[] = poolIdx.map((ci) => {
    const country = index.countries[ci];

    // Composite crisis score, re-normalizing over metrics this country has.
    let num = 0;
    let denom = 0;
    const perMetric: CountryHitMetric[] = [];
    for (const con of contributions) {
      const mi = index.metrics.indexOf(con.metric);
      if (!index.metricStats[mi].present[ci]) continue;
      const raw = con.metric.extract(country);
      if (raw === null || raw === undefined || Number.isNaN(raw)) continue;
      const norm = normalizeValue(raw, index.metricStats[mi], con.metric);
      num += con.weight * norm;
      denom += con.weight;
      perMetric.push({ metric: con.metric, weight: con.weight, normalizedValue: norm, rawValue: raw });
    }
    const composite = denom > 0 ? num / denom : 0;

    const semantic = cosineSimilarity(queryVec, index.countryVectors[ci]);
    const score = compositeWeight * composite + (1 - compositeWeight) * Math.max(0, semantic);

    perMetric.sort((a, b) => b.weight * b.normalizedValue - a.weight * a.normalizedValue);

    return {
      country,
      rank: 0,
      score,
      composite,
      semantic,
      topMetrics: perMetric.slice(0, 4),
    };
  });

  hits.sort((a, b) => b.score - a.score);
  const ranked = hits.slice(0, topK).map((h, i) => ({ ...h, rank: i + 1 }));

  const topMetricNames = contributions.slice(0, 3).map((c) => c.metric.label.toLowerCase());
  const interpretation = region
    ? `Semantic rank: ${topMetricNames.join(", ")} in ${opts.region}`
    : `Semantic rank by ${topMetricNames.join(", ")}`;

  return { results: ranked, metricWeights: contributions, interpretation, mode: "concept" };
}

/* ═══════════════════════════════════════════════════════════════
   Hybrid bridge — semantic metric identification + exact execution
   ═══════════════════════════════════════════════════════════════ */

/**
 * For a threshold/rank query, identify the most relevant metric *semantically*
 * (falling back to the heuristic keyword match), then run the exact, tested
 * numeric executor. This upgrades metric identification beyond keywords while
 * keeping numeric precision intact. Returns null if nothing relevant is found.
 */
export function semanticMetricThreshold(
  queryVec: number[],
  index: SemanticIndex,
  rawQuery: string
): { parsed: ParsedQuery; results: QueryResult[] } | null {
  const heuristic = parseQuery(rawQuery);

  // Choose metric: prefer a strong semantic match, else heuristic.
  const contributions = computeMetricWeights(queryVec, index, { relevanceFloor: 0.18 });
  let metric = heuristic?.metric ?? null;
  if (contributions.length > 0 && contributions[0].similarity >= 0.25) {
    metric = contributions[0].metric;
  }
  if (!metric) return null;

  // Re-parse with the chosen metric to inherit comparator/threshold/region logic.
  const parsed: ParsedQuery = heuristic
    ? { ...heuristic, metric }
    : {
        metric,
        comparator: "top",
        limit: 10,
        raw: rawQuery,
        interpretation: `Top 10 countries by ${metric.label}`,
      };

  const results = executeQuery(parsed, index.countries);
  if (results.length === 0) return null;
  return { parsed, results };
}

/* ═══════════════════════════════════════════════════════════════
   Examples — queries the heuristic engine cannot parse, but the
   semantic engine answers natively.
   ═══════════════════════════════════════════════════════════════ */

export const SEMANTIC_EXAMPLE_QUERIES = [
  "Which countries are most likely to tip into famine next year?",
  "Where is life most precarious for children?",
  "Countries on the brink of collapse",
  "Where are people most oppressed and surveilled?",
  "Most unequal societies on earth",
  "Countries failing their most vulnerable",
  "Where is the air deadliest to breathe?",
  "Safest countries with the best quality of life",
];

/** Re-export the metric registry for convenience in the UI. */
export { METRICS };
