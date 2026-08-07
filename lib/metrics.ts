/**
 * V FOR X — Multi-dimensional metric catalog
 *
 * Maps dotted paths into CountryData to human-readable labels, units,
 * and sensible thresholds for the Signal alert system.
 * Used by The Signal (alert rules) and the SdgScorecard deep-dive.
 */

import type { CountryData } from "./types";

export interface MetricDef {
  /** dotted path into CountryData, e.g. "health.doctors_per_1000" */
  path: string;
  /** human-readable label */
  label: string;
  /** unit suffix, e.g. "%", "/1000", "t" */
  unit?: string;
  /** for metrics where higher = better (e.g. literacy, CPI), flip the "worse" direction */
  higherIsBetter?: boolean;
  /** suggested default threshold for alerts */
  defaultThreshold?: number;
  /** the SDG domain this maps to (for grouping) */
  domain: "water" | "health" | "energy" | "education" | "climate" | "inequality" | "hunger" | "governance" | "economy" | "security";
}

/**
 * Resolve a dotted path string into a numeric value from a country record.
 * Returns null if the path doesn't resolve or the value is null.
 */
export function resolveMetric(country: CountryData, path: string): number | null {
  const parts = path.split(".");
  let val: unknown = country;
  for (const p of parts) {
    if (val == null || typeof val !== "object") return null;
    val = (val as Record<string, unknown>)[p];
  }
  if (val == null) return null;
  const n = typeof val === "boolean" ? (val ? 1 : 0) : Number(val);
  return Number.isFinite(n) ? n : null;
}

/**
 * Evaluate an alert rule against a country.
 * Returns true if the country's metric value triggers the rule.
 */
export function evaluateRule(
  country: CountryData,
  metric: string,
  operator: "<" | "<=" | ">" | ">=",
  threshold: number
): boolean {
  const val = resolveMetric(country, metric);
  if (val === null) return false;
  switch (operator) {
    case "<": return val < threshold;
    case "<=": return val <= threshold;
    case ">": return val > threshold;
    case ">=": return val >= threshold;
    default: return false;
  }
}

/** The full metric catalog — all fields available for alerting. */
export const METRIC_CATALOG: MetricDef[] = [
  // ── Hunger ──
  { path: "hunger.undernourishment_pct", label: "Undernourishment", unit: "%", domain: "hunger", defaultThreshold: 20 },
  { path: "hunger.famine_risk_1to5", label: "Famine Risk", domain: "hunger", defaultThreshold: 3 },
  { path: "hunger.child_stunting_pct", label: "Child Stunting", unit: "%", domain: "hunger", defaultThreshold: 30 },
  { path: "hunger.child_wasting_pct", label: "Child Wasting", unit: "%", domain: "hunger", defaultThreshold: 10 },
  { path: "hunger.anemia_prevalence_pct", label: "Anemia Prevalence", unit: "%", domain: "hunger", defaultThreshold: 40 },
  { path: "hunger.food_insecurity_mod_severe_pct", label: "Food Insecurity (Mod+Severe)", unit: "%", domain: "hunger", defaultThreshold: 50 },

  // ── Water ──
  { path: "water_sanitation.safe_sanitation_pct", label: "Safe Sanitation Access", unit: "%", higherIsBetter: true, domain: "water", defaultThreshold: 50 },
  { path: "water_sanitation.basic_sanitation_pct", label: "Basic Sanitation Access", unit: "%", higherIsBetter: true, domain: "water", defaultThreshold: 70 },
  { path: "water_sanitation.basic_access_pct", label: "Basic Water Access", unit: "%", higherIsBetter: true, domain: "water", defaultThreshold: 90 },

  // ── Health ──
  { path: "health.doctors_per_1000", label: "Doctors per 1000", unit: "/1000", higherIsBetter: true, domain: "health", defaultThreshold: 1.0 },
  { path: "health.life_expectancy", label: "Life Expectancy", unit: "yrs", higherIsBetter: true, domain: "health", defaultThreshold: 65 },
  { path: "health.child_mortality_under5_per1k", label: "Child Mortality (<5)", unit: "/1k", domain: "health", defaultThreshold: 40 },
  { path: "health.infant_mortality_per1k", label: "Infant Mortality", unit: "/1k", domain: "health", defaultThreshold: 30 },
  { path: "health.maternal_mortality_per100k", label: "Maternal Mortality", unit: "/100k", domain: "health", defaultThreshold: 300 },
  { path: "health.expenditure_pct_gdp", label: "Health Spending", unit: "% GDP", higherIsBetter: true, domain: "health", defaultThreshold: 3 },
  { path: "health.hiv_prevalence_pct", label: "HIV Prevalence", unit: "%", domain: "health", defaultThreshold: 5 },

  // ── Energy ──
  { path: "energy.no_access_electricity_m", label: "No Electricity Access", unit: "M", domain: "energy", defaultThreshold: 5 },
  { path: "energy.renewable_electric_pct", label: "Renewable Electricity", unit: "%", higherIsBetter: true, domain: "energy", defaultThreshold: 20 },

  // ── Education ──
  { path: "education.literacy_rate_pct", label: "Literacy Rate", unit: "%", higherIsBetter: true, domain: "education", defaultThreshold: 70 },
  { path: "education.primary_enrollment_pct", label: "Primary Enrollment", unit: "%", higherIsBetter: true, domain: "education", defaultThreshold: 80 },
  { path: "education.secondary_enrollment_pct", label: "Secondary Enrollment", unit: "%", higherIsBetter: true, domain: "education", defaultThreshold: 50 },
  { path: "education.functional_illiteracy_pct", label: "Functional Illiteracy", unit: "%", domain: "education", defaultThreshold: 30 },

  // ── Climate ──
  { path: "climate.co2_per_capita_t", label: "CO2 per Capita", unit: "t", domain: "climate", defaultThreshold: 10 },
  { path: "environment.air_pollution_pm25_ugm3", label: "Air Pollution (PM2.5)", unit: "µg/m³", domain: "climate", defaultThreshold: 35 },
  { path: "environment.renewable_energy_pct", label: "Renewable Energy", unit: "%", higherIsBetter: true, domain: "climate", defaultThreshold: 20 },
  { path: "environment.forest_area_pct", label: "Forest Area", unit: "%", higherIsBetter: true, domain: "climate", defaultThreshold: 20 },

  // ── Inequality ──
  { path: "inequality.gini", label: "Gini Coefficient", domain: "inequality", defaultThreshold: 45 },
  { path: "poverty.headcount_365_pct", label: "Extreme Poverty ($3.65)", unit: "%", domain: "inequality", defaultThreshold: 20 },
  { path: "poverty.headcount_685_pct", label: "Poverty ($6.85)", unit: "%", domain: "inequality", defaultThreshold: 40 },

  // ── Governance ──
  { path: "governance.corruption_perceptions_index", label: "Corruption Perception (CPI)", higherIsBetter: true, domain: "governance", defaultThreshold: 35 },
  { path: "governance.electoral_democracy_index", label: "Democracy Index", higherIsBetter: true, domain: "governance", defaultThreshold: 0.4 },

  // ── Economy ──
  { path: "economy.gdp_per_capita_usd", label: "GDP per Capita", unit: "$", higherIsBetter: true, domain: "economy", defaultThreshold: 2000 },
  { path: "employment.unemployment_pct", label: "Unemployment", unit: "%", domain: "economy", defaultThreshold: 15 },
  { path: "employment.youth_unemployment_pct", label: "Youth Unemployment", unit: "%", domain: "economy", defaultThreshold: 25 },
  { path: "military.pct_gdp", label: "Military Spending", unit: "% GDP", domain: "economy", defaultThreshold: 5 },

  // ── Security ──
  { path: "security.homicide_rate_per100k", label: "Homicide Rate", unit: "/100k", domain: "security", defaultThreshold: 20 },

  // ── Connectivity ──
  { path: "connectivity.internet_users_pct", label: "Internet Users", unit: "%", higherIsBetter: true, domain: "economy", defaultThreshold: 40 },

  // ── Gender ──
  { path: "gender.women_parliament_pct", label: "Women in Parliament", unit: "%", higherIsBetter: true, domain: "governance", defaultThreshold: 20 },
  { path: "gender.female_labor_force_pct", label: "Female Labor Force", unit: "%", higherIsBetter: true, domain: "governance", defaultThreshold: 30 },
];

/** Quick lookup by path */
export const METRIC_BY_PATH: Record<string, MetricDef> = Object.fromEntries(
  METRIC_CATALOG.map((m) => [m.path, m])
);

/** Get a metric def by path, with fallback */
export function getMetricDef(path: string): MetricDef {
  return METRIC_BY_PATH[path] ?? { path, label: path, domain: "hunger" };
}

/** Format a metric value with its unit */
export function formatMetricValue(value: number | null, unit?: string): string {
  if (value === null) return "N/A";
  const formatted =
    Math.abs(value) >= 1000
      ? value.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return formatted + (unit ? unit : "");
}
