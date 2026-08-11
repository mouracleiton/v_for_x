/**
 * V FOR X — Data Quality Scoring
 *
 * Computes per-metric and per-country data coverage scores across
 * the 200×19 dataset. This makes data gaps transparent and helps
 * users understand which claims are well-supported vs. estimated.
 *
 * Philosophy: radical transparency about data limitations. Every
 * number on the platform should be auditable for its source and
 * coverage.
 */

import type { WorldBackbone, CountryData } from "./types";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface MetricCoverage {
  /** Dot-path to the metric (e.g. "hunger.undernourishment_pct") */
  path: string;
  /** Human-readable label */
  label: string;
  /** Number of countries with non-null data */
  filled: number;
  /** Total countries */
  total: number;
  /** Coverage ratio (0-1) */
  coverage: number;
  /** Coverage level for display */
  level: CoverageLevel;
}

export type CoverageLevel = "complete" | "good" | "partial" | "sparse" | "missing";

export interface CountryCoverage {
  iso3: string;
  name: string;
  /** Total non-null fields out of surveyed fields */
  filled: number;
  /** Total surveyed fields */
  total: number;
  /** Coverage ratio (0-1) */
  coverage: number;
  /** List of missing field paths */
  missingFields: string[];
}

export interface DataQualityReport {
  /** Per-metric coverage */
  metrics: MetricCoverage[];
  /** Per-country coverage (sorted worst first) */
  countries: CountryCoverage[];
  /** Overall average coverage */
  averageCoverage: number;
  /** Number of metrics with > 90% coverage */
  completeMetrics: number;
  /** Number of metrics with < 50% coverage */
  sparseMetrics: number;
  /** Total data points (filled) */
  totalFilled: number;
  /** Total possible data points */
  totalPossible: number;
}

/* ═══════════════════════════════════════════════════════════════
   Metric definitions — paths to check
   ═══════════════════════════════════════════════════════════════ */

interface FieldDef {
  path: string;
  label: string;
}

const SURVEYED_FIELDS: FieldDef[] = [
  // Hunger
  { path: "hunger.prevalence_pct", label: "Hunger Prevalence" },
  { path: "hunger.undernourishment_pct", label: "Undernourishment" },
  { path: "hunger.child_stunting_pct", label: "Child Stunting" },
  { path: "hunger.famine_risk_1to5", label: "Famine Risk" },
  { path: "hunger.pop_acute_fi_m", label: "Acute Food Insecurity" },
  // Conflict
  { path: "conflict.intensity_1to5", label: "Conflict Intensity" },
  { path: "conflict.displacement_m", label: "Displacement" },
  // Military
  { path: "military.pct_gdp", label: "Military % GDP" },
  { path: "military.expenditure_usd", label: "Military Expenditure" },
  // Health
  { path: "health.life_expectancy", label: "Life Expectancy" },
  { path: "health.child_mortality_under5_per1k", label: "Child Mortality" },
  { path: "health.doctors_per_1000", label: "Doctors per 1000" },
  { path: "health.hospital_beds_per_1000", label: "Hospital Beds" },
  // Economy
  { path: "economy.gdp_per_capita_usd", label: "GDP per Capita" },
  { path: "inequality.gini", label: "Gini Coefficient" },
  // Governance
  { path: "governance.corruption_perceptions_index", label: "Corruption Index" },
  { path: "governance.electoral_democracy_index", label: "Democracy Index" },
  // Poverty
  { path: "poverty.headcount_365_pct", label: "Extreme Poverty" },
  // Water
  { path: "water_sanitation.safe_sanitation_pct", label: "Safe Sanitation" },
  // Climate
  { path: "climate.co2_per_capita_t", label: "CO2 per Capita" },
  // Education
  { path: "education.literacy_rate_pct", label: "Literacy Rate" },
  // Security
  { path: "security.homicide_rate_per100k", label: "Homicide Rate" },
];

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function coverageLevel(ratio: number): CoverageLevel {
  if (ratio >= 0.95) return "complete";
  if (ratio >= 0.8) return "good";
  if (ratio >= 0.5) return "partial";
  if (ratio >= 0.1) return "sparse";
  return "missing";
}

/* ═══════════════════════════════════════════════════════════════
   Public API
   ═══════════════════════════════════════════════════════════════ */

/**
 * Compute per-metric coverage across all countries.
 */
export function computeMetricCoverage(
  countries: CountryData[],
): MetricCoverage[] {
  const total = countries.length;

  return SURVEYED_FIELDS.map((field) => {
    let filled = 0;
    for (const c of countries) {
      const val = getNestedValue(c, field.path);
      if (val != null && typeof val === "number" && !Number.isNaN(val)) {
        filled++;
      }
    }
    const coverage = total > 0 ? filled / total : 0;
    return {
      path: field.path,
      label: field.label,
      filled,
      total,
      coverage,
      level: coverageLevel(coverage),
    };
  });
}

/**
 * Compute per-country coverage across all surveyed fields.
 */
export function computeCountryCoverage(
  countries: CountryData[],
): CountryCoverage[] {
  return countries
    .map((c) => {
      let filled = 0;
      const missingFields: string[] = [];
      for (const field of SURVEYED_FIELDS) {
        const val = getNestedValue(c, field.path);
        if (val != null && typeof val === "number" && !Number.isNaN(val)) {
          filled++;
        } else {
          missingFields.push(field.path);
        }
      }
      const total = SURVEYED_FIELDS.length;
      return {
        iso3: c.iso3,
        name: c.name_en,
        filled,
        total,
        coverage: total > 0 ? filled / total : 0,
        missingFields,
      };
    })
    .sort((a, b) => a.coverage - b.coverage);
}

/**
 * Generate a full data quality report.
 */
export function generateQualityReport(data: WorldBackbone): DataQualityReport {
  const metrics = computeMetricCoverage(data.countries);
  const countries = computeCountryCoverage(data.countries);

  const totalFilled = metrics.reduce((sum, m) => sum + m.filled, 0);
  const totalPossible = metrics.reduce((sum, m) => sum + m.total, 0);
  const averageCoverage = totalPossible > 0 ? totalFilled / totalPossible : 0;

  return {
    metrics,
    countries,
    averageCoverage,
    completeMetrics: metrics.filter((m) => m.coverage >= 0.9).length,
    sparseMetrics: metrics.filter((m) => m.coverage < 0.5).length,
    totalFilled,
    totalPossible,
  };
}

/**
 * Get a coverage color for display.
 */
export function coverageColor(level: CoverageLevel): string {
  switch (level) {
    case "complete": return "var(--color-terminal-green)";
    case "good": return "#88cc44";
    case "partial": return "var(--color-warning-amber)";
    case "sparse": return "var(--color-blood-dim)";
    case "missing": return "var(--color-blood-bright)";
  }
}

/**
 * Format coverage as a percentage string.
 */
export function formatCoverage(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}
