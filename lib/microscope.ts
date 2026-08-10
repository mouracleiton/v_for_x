/**
 * V FOR X — The Microscope
 *
 * Single-metric deep-dive explorer. Pick any field from the country data
 * and get a complete statistical analysis: ranking, distribution, regional
 * averages, outliers, quintile breakdown, and worst/best performers.
 *
 * Different from The Cartographer (which maps a metric) and The Lens
 * (which correlates two metrics) — The Microscope zooms into ONE metric
 * to understand its full global distribution.
 *
 * [74] THE MICROSCOPE — Code: 74
 */

import type { CountryData, WorldBackbone } from "./types";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface MicroscopeField {
  key: string;
  label: string;
  category: string;
  unit: string;
  /** When true, lower is better (e.g. mortality) */
  inverse?: boolean;
  extract: (c: CountryData) => number | null;
  description: string;
}

export interface CountryMetric {
  iso3: string;
  name: string;
  region: string;
  subregion: string;
  populationM: number;
  value: number | null;
  rank: number;
  percentile: number;
  zScore: number | null;
}

export interface MetricStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  q1: number;
  q3: number;
  iqr: number;
  skewness: number;
}

export interface RegionalStat {
  region: string;
  mean: number;
  median: number;
  min: number;
  max: number;
  count: number;
  bestCountry: string;
  worstCountry: string;
}

export interface OutlierResult {
  country: string;
  iso3: string;
  value: number;
  type: "high" | "low";
  zScore: number;
  /** How extreme relative to IQR fences */
  severity: "extreme" | "moderate";
}

export interface QuintileBucket {
  label: string;
  range: [number, number];
  count: number;
  populationM: number;
  countries: string[];
}

export interface MicroscopeResult {
  field: MicroscopeField;
  countries: CountryMetric[];
  stats: MetricStats;
  regions: RegionalStat[];
  outliers: OutlierResult[];
  quintiles: QuintileBucket[];
  best: CountryMetric | null;
  worst: CountryMetric | null;
  globalAggregate: number;
  aggregateLabel: string;
}

/* ═══════════════════════════════════════════════════════════════
   Available fields — mirrors Cartographer fields + more
   ═══════════════════════════════════════════════════════════════ */

export const FIELDS: MicroscopeField[] = [
  // Hunger
  { key: "hunger_undernourishment", label: "Undernourishment %", category: "Hunger", unit: "%", extract: c => c.hunger?.undernourishment_pct ?? null, description: "Share of population undernourished (FAO)" },
  { key: "hunger_stunting", label: "Child Stunting %", category: "Hunger", unit: "%", extract: c => c.hunger?.child_stunting_pct ?? null, description: "Children under 5 stunted (low height-for-age)" },
  { key: "hunger_wasting", label: "Child Wasting %", category: "Hunger", unit: "%", extract: c => c.hunger?.child_wasting_pct ?? null, description: "Children under 5 wasted (low weight-for-height)" },
  { key: "hunger_famine_risk", label: "Famine Risk", category: "Hunger", unit: "/5", extract: c => c.hunger?.famine_risk_1to5 ?? null, description: "Risk of famine (1-5 scale)" },
  { key: "hunger_anemia", label: "Anemia Prevalence %", category: "Hunger", unit: "%", extract: c => c.hunger?.anemia_prevalence_pct ?? null, description: "Anemia prevalence in population" },
  // Conflict
  { key: "conflict_intensity", label: "Conflict Intensity", category: "Conflict", unit: "/5", extract: c => c.conflict?.intensity_1to5 ?? null, description: "Armed conflict intensity (1-5 scale)" },
  { key: "conflict_displacement", label: "Displacement (M)", category: "Conflict", unit: "M", extract: c => c.conflict?.displacement_m ?? null, description: "Forcibly displaced population (millions)" },
  // Military
  { key: "military_expenditure", label: "Military Spending", category: "Military", unit: "USD", extract: c => c.military?.expenditure_usd ?? null, description: "Annual military expenditure (USD)" },
  { key: "military_pct_gdp", label: "Military % GDP", category: "Military", unit: "%", extract: c => c.military?.pct_gdp ?? null, description: "Military expenditure as share of GDP" },
  // Health
  { key: "health_life_expectancy", label: "Life Expectancy", category: "Health", unit: "yrs", inverse: true, extract: c => c.health?.life_expectancy ?? null, description: "Average life expectancy at birth" },
  { key: "health_child_mortality", label: "Child Mortality /1k", category: "Health", unit: "/1k", extract: c => c.health?.child_mortality_under5_per1k ?? null, description: "Under-5 mortality per 1,000 live births" },
  { key: "health_maternal_mortality", label: "Maternal Mortality /100k", category: "Health", unit: "/100k", extract: c => c.health?.maternal_mortality_per100k ?? null, description: "Maternal deaths per 100k live births" },
  { key: "health_doctors", label: "Doctors /1k", category: "Health", unit: "/1k", inverse: true, extract: c => c.health?.doctors_per_1000 ?? null, description: "Physicians per 1,000 people" },
  { key: "health_spending_pct", label: "Health Spending % GDP", category: "Health", unit: "%", inverse: true, extract: c => c.health?.expenditure_pct_gdp ?? null, description: "Health expenditure as share of GDP" },
  // Poverty
  { key: "poverty_extreme", label: "Extreme Poverty %", category: "Poverty", unit: "%", extract: c => c.poverty?.headcount_365_pct ?? null, description: "Population living under $3.65/day" },
  // Economy
  { key: "gdp_per_capita", label: "GDP per Capita", category: "Economy", unit: "USD", inverse: true, extract: c => c.economy?.gdp_per_capita_usd ?? null, description: "GDP per capita (USD)" },
  { key: "unemployment", label: "Unemployment %", category: "Economy", unit: "%", extract: c => c.employment?.unemployment_pct ?? null, description: "Unemployment rate" },
  { key: "youth_unemployment", label: "Youth Unemployment %", category: "Economy", unit: "%", extract: c => c.employment?.youth_unemployment_pct ?? null, description: "Youth unemployment rate" },
  // Inequality
  { key: "gini", label: "Gini Coefficient", category: "Inequality", unit: "", extract: c => c.inequality?.gini ?? null, description: "Income inequality (0=equal, 100=max)" },
  // Water
  { key: "water_access", label: "Water Access %", category: "Water", unit: "%", inverse: true, extract: c => c.water_sanitation?.basic_access_pct ?? null, description: "Population with basic drinking water" },
  // Education
  { key: "literacy", label: "Literacy Rate %", category: "Education", unit: "%", inverse: true, extract: c => c.education?.literacy_rate_pct ?? null, description: "Adult literacy rate" },
  // Governance
  { key: "corruption_cpi", label: "Corruption Index", category: "Governance", unit: "", inverse: true, extract: c => c.governance?.corruption_perceptions_index ?? null, description: "Corruption Perceptions Index (higher=cleaner)" },
  { key: "democracy", label: "Democracy Index", category: "Governance", unit: "0-1", inverse: true, extract: c => c.governance?.electoral_democracy_index ?? null, description: "V-Dem electoral democracy index" },
  // Security
  { key: "homicide", label: "Homicide Rate /100k", category: "Security", unit: "/100k", extract: c => c.security?.homicide_rate_per100k ?? null, description: "Intentional homicides per 100k" },
  // Climate
  { key: "air_pollution", label: "Air Pollution PM2.5", category: "Climate", unit: "µg/m³", extract: c => c.environment?.air_pollution_pm25_ugm3 ?? null, description: "PM2.5 air pollution (µg/m³)" },
];

/* ═══════════════════════════════════════════════════════════════
   Core analysis
   ═══════════════════════════════════════════════════════════════ */

export function analyzeMetric(
  data: WorldBackbone,
  field: MicroscopeField,
): MicroscopeResult {
  const countries: CountryMetric[] = [];

  // Extract and pair values
  for (const c of data.countries) {
    const val = field.extract(c);
    countries.push({
      iso3: c.iso3,
      name: c.name_en,
      region: c.region,
      subregion: c.subregion,
      populationM: c.population_m ?? 0,
      value: val,
      rank: 0,
      percentile: 0,
      zScore: null,
    });
  }

  const valid = countries.filter((c) => c.value != null && !Number.isNaN(c.value));
  const values = valid.map((c) => c.value!);

  // Stats
  const stats = computeStats(values);

  // Rank (worst to best for non-inverse, best to worst for inverse)
  const sorted = [...valid].sort((a, b) =>
    field.inverse ? (a.value! - b.value!) : (b.value! - a.value!),
  );
  sorted.forEach((c, i) => {
    c.rank = i + 1;
    c.percentile = ((sorted.length - i) / sorted.length) * 100;
    c.zScore = stats.stdDev > 0 ? (c.value! - stats.mean) / stats.stdDev : null;
  });

  // Regional breakdown
  const regions = computeRegional(valid);

  // Outliers
  const outliers = findOutliers(valid, stats);

  // Quintiles
  const quintiles = computeQuintiles(sorted, field);

  // Best/Worst
  // sorted is worst-to-best regardless of inverse/non-inverse,
  // so best = last element, worst = first element
  const best = sorted[sorted.length - 1];
  const worst = sorted[0];

  // Global aggregate
  const { aggregate, label } = computeAggregate(valid, field);

  return {
    field,
    countries: sorted,
    stats,
    regions,
    outliers,
    quintiles,
    best: best ?? null,
    worst: worst ?? null,
    globalAggregate: aggregate,
    aggregateLabel: label,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Statistical helpers
   ═══════════════════════════════════════════════════════════════ */

function computeStats(values: number[]): MetricStats {
  const n = values.length;
  if (n === 0) {
    return { count: 0, min: 0, max: 0, mean: 0, median: 0, stdDev: 0, q1: 0, q3: 0, iqr: 0, skewness: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  const median = percentile(sorted, 50);
  const q1 = percentile(sorted, 25);
  const q3 = percentile(sorted, 75);

  // Skewness (Fisher-Pearson)
  const skewness = stdDev > 0
    ? values.reduce((s, v) => s + ((v - mean) / stdDev) ** 3, 0) / n
    : 0;

  return {
    count: n,
    min: sorted[0],
    max: sorted[n - 1],
    mean,
    median,
    stdDev,
    q1,
    q3,
    iqr: q3 - q1,
    skewness,
  };
}

function percentile(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0];
  const idx = (p / 100) * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function computeRegional(countries: CountryMetric[]): RegionalStat[] {
  const byRegion: Record<string, CountryMetric[]> = {};
  for (const c of countries) {
    if (!byRegion[c.region]) byRegion[c.region] = [];
    byRegion[c.region].push(c);
  }
  return Object.entries(byRegion)
    .map(([region, items]) => {
      const vals = items.map((c) => c.value!).sort((a, b) => a - b);
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const sortedByVal = [...items].sort((a, b) => (b.value! - a.value!));
      return {
        region,
        mean,
        median: percentile(vals, 50),
        min: vals[0],
        max: vals[vals.length - 1],
        count: vals.length,
        bestCountry: sortedByVal[sortedByVal.length - 1]?.name ?? "—",
        worstCountry: sortedByVal[0]?.name ?? "—",
      };
    })
    .sort((a, b) => b.mean - a.mean);
}

function findOutliers(countries: CountryMetric[], stats: MetricStats): OutlierResult[] {
  if (stats.iqr === 0) return [];
  const lowerFence = stats.q1 - 1.5 * stats.iqr;
  const upperFence = stats.q3 + 1.5 * stats.iqr;
  const extremeLower = stats.q1 - 3 * stats.iqr;
  const extremeUpper = stats.q3 + 3 * stats.iqr;

  const results: OutlierResult[] = [];
  for (const c of countries) {
    const v = c.value!;
    if (v < lowerFence) {
      results.push({
        country: c.name,
        iso3: c.iso3,
        value: v,
        type: "low",
        zScore: c.zScore ?? 0,
        severity: v < extremeLower ? "extreme" : "moderate",
      });
    } else if (v > upperFence) {
      results.push({
        country: c.name,
        iso3: c.iso3,
        value: v,
        type: "high",
        zScore: c.zScore ?? 0,
        severity: v > extremeUpper ? "extreme" : "moderate",
      });
    }
  }
  return results.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
}

function computeQuintiles(sorted: CountryMetric[], field: MicroscopeField): QuintileBucket[] {
  const n = sorted.length;
  if (n < 5) return [];
  const bucketSize = Math.ceil(n / 5);
  const labels = field.inverse
    ? ["Best 20%", "Good 20%", "Middle 20%", "Poor 20%", "Worst 20%"]
    : ["Worst 20%", "Poor 20%", "Middle 20%", "Good 20%", "Best 20%"];
  const buckets: QuintileBucket[] = [];

  for (let i = 0; i < 5; i++) {
    const start = i * bucketSize;
    const end = i === 4 ? n : Math.min(start + bucketSize, n);
    const items = sorted.slice(start, end);
    if (items.length === 0) continue;
    const vals = items.map((c) => c.value!);
    buckets.push({
      label: labels[i],
      range: [Math.min(...vals), Math.max(...vals)],
      count: items.length,
      populationM: items.reduce((s, c) => s + c.populationM, 0),
      countries: items.map((c) => c.iso3),
    });
  }
  return buckets;
}

function computeAggregate(countries: CountryMetric[], field: MicroscopeField): {
  aggregate: number;
  label: string;
} {
  // For population-weighted metrics like poverty/hunger, compute the
  // population-weighted mean × total population for a sense of scale
  const totalPop = countries.reduce((s, c) => s + c.populationM, 0);
  if (totalPop === 0) return { aggregate: 0, label: "—" };

  // If the field is a percentage, compute total affected
  if (field.unit === "%") {
    const weightedMean =
      countries.reduce((s, c) => s + (c.value ?? 0) * c.populationM, 0) / totalPop;
    return {
      aggregate: weightedMean,
      label: `Global weighted average: ${weightedMean.toFixed(1)}%`,
    };
  }
  // For counts (USD, M people), sum them
  if (field.unit === "USD" || field.unit === "M") {
    const total = countries.reduce((s, c) => s + (c.value ?? 0), 0);
    return { aggregate: total, label: `Global total` };
  }
  // For rates, just give the mean
  return { aggregate: 0, label: "Rate-based metric (see mean above)" };
}

/* ═══════════════════════════════════════════════════════════════
   Display helpers
   ═══════════════════════════════════════════════════════════════ */

export function formatValue(value: number | null, unit: string): string {
  if (value == null) return "—";
  if (unit === "USD") {
    if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
    if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  }
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === "") return value.toFixed(2);
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(value % 1 === 0 ? 0 : 1);
}

export function getCategories(): string[] {
  return [...new Set(FIELDS.map((f) => f.category))];
}
