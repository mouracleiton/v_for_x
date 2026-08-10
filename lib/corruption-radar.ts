/**
 * V FOR X — Corruption Radar Engine
 *
 * Inspired by corruptionradar.org's Subnational Corruption Database.
 * Provides multi-dimensional corruption analysis across 6 WGI indicators,
 * with composite scoring, risk classification, ranking, comparison,
 * and trend analysis.
 *
 * Data sources:
 *   - World Bank Worldwide Governance Indicators (6 dimensions)
 *   - Transparency International CPI (where available)
 *   - V-Dem Electoral Democracy Index
 *
 * All scoring is transparent — every weight, ceiling, and normalization
 * is documented in the code.
 */

import type { CountryData, WorldBackbone } from "./types";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export type CorruptionIndicator =
  | "wgi_composite"
  | "control_of_corruption"
  | "government_effectiveness"
  | "political_stability"
  | "regulatory_quality"
  | "rule_of_law"
  | "voice_and_accountability";

export type CorruptionRiskLevel = "low" | "moderate" | "high" | "severe";

export interface CorruptionIndicatorDef {
  id: CorruptionIndicator;
  label: string;
  shortLabel: string;
  description: string;
  /** Scale: z-score range for raw, 0-100 for scores */
  scale: "z-score" | "0-100";
  /** Direction: higher is better or worse */
  direction: "higher_better" | "worse_better";
  /** Color for "bad" end of spectrum */
  color: string;
}

export interface CountryCorruptionProfile {
  iso3: string;
  name: string;
  region: string;
  /** WGI composite score (0-100, higher = less corrupt) */
  compositeScore: number | null;
  /** Risk level */
  riskLevel: CorruptionRiskLevel;
  /** Individual indicator scores */
  indicators: Record<CorruptionIndicator, number | null>;
  /** Year of most recent data */
  dataYear: number | null;
  /** Global rank (1 = least corrupt) */
  rank: number | null;
  /** Percentile (0-100, higher = cleaner) */
  percentile: number | null;
  /** Is this country flagged as a hotspot? */
  isHotspot: boolean;
}

export interface CorruptionRanking {
  profiles: CountryCorruptionProfile[];
  totalRanked: number;
  averageScore: number;
  medianScore: number;
  byRiskLevel: Record<CorruptionRiskLevel, number>;
  byRegion: { region: string; averageScore: number; count: number }[];
}

export interface CorruptionComparison {
  countryA: CountryCorruptionProfile;
  countryB: CountryCorruptionProfile;
  differences: { indicator: CorruptionIndicator; label: string; diff: number; better: "A" | "B" | "tie" }[];
  summary: string;
}

/* ═══════════════════════════════════════════════════════════════
   Indicator Definitions
   ═══════════════════════════════════════════════════════════════ */

export const CORRUPTION_INDICATORS: CorruptionIndicatorDef[] = [
  {
    id: "wgi_composite",
    label: "WGI Composite Score",
    shortLabel: "Composite",
    description: "Average of all 6 WGI indicators (0-100, higher = cleaner governance)",
    scale: "0-100",
    direction: "higher_better",
    color: "#ff3344",
  },
  {
    id: "control_of_corruption",
    label: "Control of Corruption",
    shortLabel: "Corruption",
    description: "Perceptions of the extent to which public power is exercised for private gain",
    scale: "0-100",
    direction: "higher_better",
    color: "#cc0000",
  },
  {
    id: "government_effectiveness",
    label: "Government Effectiveness",
    shortLabel: "Effectiveness",
    description: "Quality of public services, civil service independence, policy formulation",
    scale: "0-100",
    direction: "higher_better",
    color: "#ff6600",
  },
  {
    id: "political_stability",
    label: "Political Stability",
    shortLabel: "Stability",
    description: "Likelihood of political instability or politically-motivated violence",
    scale: "0-100",
    direction: "higher_better",
    color: "#ffaa00",
  },
  {
    id: "regulatory_quality",
    label: "Regulatory Quality",
    shortLabel: "Regulation",
    description: "Ability of government to provide sound policies and regulations",
    scale: "0-100",
    direction: "higher_better",
    color: "#88cc44",
  },
  {
    id: "rule_of_law",
    label: "Rule of Law",
    shortLabel: "Rule of Law",
    description: "Confidence in and abidance by rules of society (contract enforcement, courts, police)",
    scale: "0-100",
    direction: "higher_better",
    color: "#44aaff",
  },
  {
    id: "voice_and_accountability",
    label: "Voice & Accountability",
    shortLabel: "Voice",
    description: "Freedom of expression, association, and media; citizen participation",
    scale: "0-100",
    direction: "higher_better",
    color: "#aa44ff",
  },
];

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

/**
 * Classify corruption risk from a 0-100 score (higher = cleaner).
 */
export function classifyRisk(score: number | null): CorruptionRiskLevel {
  if (score == null) return "severe";
  if (score >= 75) return "low";
  if (score >= 50) return "moderate";
  if (score >= 30) return "high";
  return "severe";
}

/**
 * Get a color for a corruption risk level.
 */
export function riskColor(level: CorruptionRiskLevel): string {
  switch (level) {
    case "low": return "#22d3a6";
    case "moderate": return "#ffcc00";
    case "high": return "#ff6600";
    case "severe": return "#cc0000";
  }
}

/**
 * Get a human-readable risk label.
 */
export function riskLabel(level: CorruptionRiskLevel): string {
  switch (level) {
    case "low": return "Low Corruption";
    case "moderate": return "Moderate Corruption";
    case "high": return "High Corruption";
    case "severe": return "Severe Corruption";
  }
}

/* ═══════════════════════════════════════════════════════════════
   Profile Building
   ═══════════════════════════════════════════════════════════════ */

/**
 * Extract a single indicator value from a country's governance data.
 * Returns the _score (0-100) variant if available.
 */
function extractIndicator(
  country: CountryData,
  indicator: CorruptionIndicator,
): number | null {
  const gov = country.governance as Record<string, unknown>;
  if (indicator === "wgi_composite") {
    const v = gov["wgi_composite"];
    return typeof v === "number" ? v : null;
  }
  // Prefer _score variant (0-100 normalized)
  const scoreKey = `${indicator}_score`;
  const score = gov[scoreKey];
  if (typeof score === "number") return score;

  // Fall back to raw CPI value mapped to corruption_perceptions_index
  if (indicator === "control_of_corruption") {
    const cpi = gov["corruption_perceptions_index"];
    return typeof cpi === "number" ? cpi : null;
  }

  return null;
}

/**
 * Build a corruption profile for a single country.
 */
export function buildProfile(country: CountryData): CountryCorruptionProfile {
  const gov = country.governance as Record<string, unknown>;
  const compositeScore =
    typeof gov["wgi_composite"] === "number" ? (gov["wgi_composite"] as number) : null;

  const indicators = {} as Record<CorruptionIndicator, number | null>;
  for (const def of CORRUPTION_INDICATORS) {
    indicators[def.id] = extractIndicator(country, def.id);
  }

  const dataYear =
    typeof gov["wgi_composite_year"] === "number"
      ? (gov["wgi_composite_year"] as number)
      : typeof gov["cpi_year"] === "number"
        ? (gov["cpi_year"] as number)
        : null;

  return {
    iso3: country.iso3,
    name: country.name_en,
    region: country.region,
    compositeScore,
    riskLevel: classifyRisk(compositeScore),
    indicators,
    dataYear,
    rank: null, // filled in by ranking
    percentile: null, // filled in by ranking
    isHotspot: country.is_hotspot ?? false,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Ranking & Analysis
   ═══════════════════════════════════════════════════════════════ */

/**
 * Build a full corruption ranking across all countries.
 */
export function buildRanking(data: WorldBackbone): CorruptionRanking {
  const profiles = data.countries
    .map(buildProfile)
    .filter((p) => p.compositeScore !== null)
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));

  // Assign ranks and percentiles
  const total = profiles.length;
  for (let i = 0; i < profiles.length; i++) {
    profiles[i].rank = i + 1;
    profiles[i].percentile = total > 0 ? Math.round(((total - i) / total) * 100) : 0;
  }

  // Add countries with no data at the end
  const noData = data.countries
    .map(buildProfile)
    .filter((p) => p.compositeScore === null);
  const allProfiles = [...profiles, ...noData];

  // Statistics
  const scores = profiles.map((p) => p.compositeScore!);
  const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const sorted = [...scores].sort((a, b) => a - b);
  const medianScore = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;

  // By risk level
  const byRiskLevel: Record<CorruptionRiskLevel, number> = {
    low: 0,
    moderate: 0,
    high: 0,
    severe: 0,
  };
  for (const p of profiles) {
    byRiskLevel[p.riskLevel]++;
  }

  // By region
  const regionMap = new Map<string, { sum: number; count: number }>();
  for (const p of profiles) {
    const entry = regionMap.get(p.region) ?? { sum: 0, count: 0 };
    entry.sum += p.compositeScore ?? 0;
    entry.count++;
    regionMap.set(p.region, entry);
  }
  const byRegion = Array.from(regionMap.entries())
    .map(([region, { sum, count }]) => ({
      region,
      averageScore: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
      count,
    }))
    .sort((a, b) => a.averageScore - b.averageScore);

  return {
    profiles: allProfiles,
    totalRanked: profiles.length,
    averageScore: Math.round(averageScore * 10) / 10,
    medianScore: Math.round(medianScore * 10) / 10,
    byRiskLevel,
    byRegion,
  };
}

/**
 * Compare two countries' corruption profiles.
 */
export function compareCountries(
  countryA: CountryData,
  countryB: CountryData,
): CorruptionComparison {
  const profileA = buildProfile(countryA);
  const profileB = buildProfile(countryB);

  const differences = CORRUPTION_INDICATORS.map((def) => {
    const valA = profileA.indicators[def.id];
    const valB = profileB.indicators[def.id];

    if (valA == null && valB == null) {
      return { indicator: def.id, label: def.shortLabel, diff: 0, better: "tie" as const };
    }

    const diff = (valA ?? 0) - (valB ?? 0);
    let better: "A" | "B" | "tie";
    if (Math.abs(diff) < 0.5) better = "tie";
    else if (diff > 0) better = "A";
    else better = "B";

    return { indicator: def.id, label: def.shortLabel, diff, better };
  });

  const aWins = differences.filter((d) => d.better === "A").length;
  const bWins = differences.filter((d) => d.better === "B").length;
  const summary =
    aWins > bWins
      ? `${profileA.name} scores better on ${aWins} of ${differences.length} indicators`
      : bWins > aWins
        ? `${profileB.name} scores better on ${bWins} of ${differences.length} indicators`
        : "Both countries score similarly across indicators";

  return {
    countryA: profileA,
    countryB: profileB,
    differences,
    summary,
  };
}

/**
 * Filter and search corruption profiles.
 */
export function searchProfiles(
  ranking: CorruptionRanking,
  options: {
    query?: string;
    region?: string;
    riskLevel?: CorruptionRiskLevel;
    minScore?: number;
    maxScore?: number;
  } = {},
): CountryCorruptionProfile[] {
  let results = ranking.profiles.filter((p) => p.compositeScore !== null);

  if (options.query) {
    const q = options.query.toLowerCase();
    results = results.filter(
      (p) => p.name.toLowerCase().includes(q) || p.iso3.toLowerCase().includes(q),
    );
  }

  if (options.region && options.region !== "all") {
    results = results.filter((p) => p.region === options.region);
  }

  if (options.riskLevel) {
    results = results.filter((p) => p.riskLevel === options.riskLevel);
  }

  if (options.minScore != null) {
    results = results.filter((p) => (p.compositeScore ?? 0) >= options.minScore!);
  }

  if (options.maxScore != null) {
    results = results.filter((p) => (p.compositeScore ?? 0) <= options.maxScore!);
  }

  return results;
}

/**
 * Generate a CSV export of corruption data.
 */
export function exportRankingCSV(ranking: CorruptionRanking): string {
  const headers = ["Rank", "ISO3", "Country", "Region", "Composite", "Risk", ...CORRUPTION_INDICATORS.map((i) => i.shortLabel)];
  const lines = [headers.join(",")];

  for (const p of ranking.profiles.filter((p) => p.compositeScore !== null)) {
    const vals = CORRUPTION_INDICATORS.map((ind) => p.indicators[ind.id] ?? "");
    lines.push([
      p.rank ?? "",
      p.iso3,
      `"${p.name}"`,
      p.region,
      p.compositeScore ?? "",
      p.riskLevel,
      ...vals,
    ].join(","));
  }

  return lines.join("\n");
}
