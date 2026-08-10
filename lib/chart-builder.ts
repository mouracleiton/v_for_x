/**
 * V FOR X — Chart Builder Utilities
 *
 * Configurable chart data extraction from CountryData.
 * Powers the interactive chart builder at /the-chart-builder/.
 *
 * All extractors are null-safe so charts degrade gracefully when a
 * country lacks a given dimension.
 */

import type { CountryData } from "./types";

/* ═══════════════════════════════════════════════════════════════
   PUBLIC TYPES
   ═══════════════════════════════════════════════════════════════ */

export interface ChartConfig {
  metricKeys: string[];
  chartType: "bar" | "line" | "scatter";
  filter?: {
    region?: string;
    minPopulation?: number;
    maxResults?: number;
  };
  sortBy: "value" | "name" | "none";
  sortOrder: "asc" | "desc";
}

export interface MetricOption {
  key: string;
  label: string;
  unit: string;
  category: string;
}

export interface BuiltChartData {
  labels: string[];
  datasets: { label: string; data: number[] }[];
}

export interface MetricExtremes {
  min: number;
  max: number;
  minCountry: string;
  maxCountry: string;
}

/* ═══════════════════════════════════════════════════════════════
   REGIONS
   ═══════════════════════════════════════════════════════════════ */

/** All UN statistical regions present in the dataset. */
export const REGION_LIST: string[] = [
  "Africa",
  "Americas",
  "Asia",
  "Europe",
  "Oceania",
];

/* ═══════════════════════════════════════════════════════════════
   METRIC EXTRACTORS
   Each maps a stable string key to a value from CountryData.
   ═══════════════════════════════════════════════════════════════ */

type Extractor = (c: CountryData) => number | null;

export const METRIC_EXTRACTORS: Record<string, Extractor> = {
  // ── Hunger ──
  undernourishment: (c) => c.hunger.undernourishment_pct,
  hunger_prevalence: (c) => c.hunger.prevalence_pct,
  child_stunting: (c) => c.hunger.child_stunting_pct,
  child_wasting: (c) => c.hunger.child_wasting_pct,
  famine_risk: (c) => c.hunger.famine_risk_1to5,
  // ── Conflict ──
  conflict_intensity: (c) => c.conflict.intensity_1to5,
  displacement: (c) => c.conflict.displacement_m,
  battle_deaths: (c) => c.conflict.battle_deaths_total,
  refugees_origin: (c) => c.migration.refugees_origin,
  // ── Health ──
  child_mortality: (c) => c.health.child_mortality_under5_per1k,
  infant_mortality: (c) => c.health.infant_mortality_per1k,
  life_expectancy: (c) => c.health.life_expectancy,
  maternal_mortality: (c) => c.health.maternal_mortality_per100k,
  doctors_per_1000: (c) => c.health.doctors_per_1000 ?? null,
  hospital_beds: (c) => c.health.hospital_beds_per_1000 ?? null,
  hiv_prevalence: (c) => c.health.hiv_prevalence_pct,
  suicide_rate: (c) => c.mental_health?.suicide_rate_per100k ?? null,
  // ── Economy ──
  gdp_per_capita: (c) => c.economy.gdp_per_capita_usd,
  military_pct_gdp: (c) => c.military.pct_gdp,
  military_expenditure: (c) => c.military.expenditure_usd,
  unemployment: (c) => c.employment.unemployment_pct,
  youth_unemployment: (c) => c.employment.youth_unemployment_pct,
  extreme_poverty: (c) => c.poverty.headcount_365_pct,
  gini: (c) => c.inequality.gini,
  hdi: (c) => c.human_development.hdi,
  tax_burden: (c) => c.taxation?.tax_burden_pct_gdp ?? null,
  // ── Governance ──
  corruption_cpi: (c) => c.governance.corruption_perceptions_index,
  democracy_index: (c) => c.governance.electoral_democracy_index,
  women_parliament: (c) => c.gender.women_parliament_pct,
  homicide_rate: (c) => c.security.homicide_rate_per100k,
  // ── Infrastructure / Environment ──
  safe_water_access: (c) => c.water_sanitation.safe_sanitation_pct,
  basic_water: (c) => c.water_sanitation.basic_access_pct,
  internet_access: (c) => c.connectivity.internet_users_pct,
  electricity_no_access: (c) => c.energy?.no_access_electricity_m ?? null,
  literacy: (c) => c.education.literacy_rate_pct,
  pisa_score: (c) => c.education.pisa_score ?? null,
  renewable_energy: (c) => c.environment.renewable_energy_pct,
  air_pollution: (c) => c.environment.air_pollution_pm25_ugm3,
  co2_per_capita: (c) => c.climate.co2_per_capita_t,
};

/* ═══════════════════════════════════════════════════════════════
   METRIC OPTIONS (catalogue for the UI)
   Grouped by category: Health, Economy, Conflict, Governance,
   Infrastructure.
   ═══════════════════════════════════════════════════════════════ */

export const METRIC_OPTIONS: MetricOption[] = [
  // ── Health ──
  { key: "undernourishment", label: "Undernourishment", unit: "%", category: "Health" },
  { key: "hunger_prevalence", label: "Acute Food Insecurity", unit: "%", category: "Health" },
  { key: "child_stunting", label: "Child Stunting", unit: "%", category: "Health" },
  { key: "child_wasting", label: "Child Wasting", unit: "%", category: "Health" },
  { key: "child_mortality", label: "Child Mortality (U5)", unit: "/1k", category: "Health" },
  { key: "infant_mortality", label: "Infant Mortality", unit: "/1k", category: "Health" },
  { key: "life_expectancy", label: "Life Expectancy", unit: "yrs", category: "Health" },
  { key: "maternal_mortality", label: "Maternal Mortality", unit: "/100k", category: "Health" },
  { key: "doctors_per_1000", label: "Doctors", unit: "/1k", category: "Health" },
  { key: "hospital_beds", label: "Hospital Beds", unit: "/1k", category: "Health" },
  { key: "hiv_prevalence", label: "HIV Prevalence", unit: "%", category: "Health" },
  { key: "suicide_rate", label: "Suicide Rate", unit: "/100k", category: "Health" },
  // ── Economy ──
  { key: "gdp_per_capita", label: "GDP Per Capita", unit: "$", category: "Economy" },
  { key: "military_pct_gdp", label: "Military % GDP", unit: "%", category: "Economy" },
  { key: "military_expenditure", label: "Military Spending", unit: "$", category: "Economy" },
  { key: "unemployment", label: "Unemployment", unit: "%", category: "Economy" },
  { key: "youth_unemployment", label: "Youth Unemployment", unit: "%", category: "Economy" },
  { key: "extreme_poverty", label: "Extreme Poverty", unit: "%", category: "Economy" },
  { key: "gini", label: "Inequality (Gini)", unit: "", category: "Economy" },
  { key: "hdi", label: "Human Development Index", unit: "", category: "Economy" },
  { key: "tax_burden", label: "Tax Burden % GDP", unit: "%", category: "Economy" },
  // ── Conflict ──
  { key: "conflict_intensity", label: "Conflict Intensity", unit: "/5", category: "Conflict" },
  { key: "displacement", label: "Displacement", unit: "M", category: "Conflict" },
  { key: "battle_deaths", label: "Battle Deaths", unit: "", category: "Conflict" },
  { key: "refugees_origin", label: "Refugees (origin)", unit: "", category: "Conflict" },
  { key: "famine_risk", label: "Famine Risk", unit: "/5", category: "Conflict" },
  // ── Governance ──
  { key: "corruption_cpi", label: "Corruption (CPI)", unit: "/100", category: "Governance" },
  { key: "democracy_index", label: "Democracy Index", unit: "", category: "Governance" },
  { key: "women_parliament", label: "Women in Parliament", unit: "%", category: "Governance" },
  { key: "homicide_rate", label: "Homicide Rate", unit: "/100k", category: "Governance" },
  // ── Infrastructure ──
  { key: "safe_water_access", label: "Safe Water Access", unit: "%", category: "Infrastructure" },
  { key: "basic_water", label: "Basic Water Access", unit: "%", category: "Infrastructure" },
  { key: "internet_access", label: "Internet Access", unit: "%", category: "Infrastructure" },
  { key: "electricity_no_access", label: "No Electricity Access", unit: "M", category: "Infrastructure" },
  { key: "literacy", label: "Literacy Rate", unit: "%", category: "Infrastructure" },
  { key: "pisa_score", label: "PISA Score", unit: "", category: "Infrastructure" },
  { key: "renewable_energy", label: "Renewable Energy", unit: "%", category: "Infrastructure" },
  { key: "air_pollution", label: "Air Pollution (PM2.5)", unit: "µg/m³", category: "Infrastructure" },
  { key: "co2_per_capita", label: "CO₂ Per Capita", unit: "t", category: "Infrastructure" },
];

/** Categories in display order. */
export const METRIC_CATEGORIES: string[] = [
  "Health",
  "Economy",
  "Conflict",
  "Governance",
  "Infrastructure",
];

/** Get the option metadata for a key. */
export function getMetricOption(key: string): MetricOption | undefined {
  return METRIC_OPTIONS.find((o) => o.key === key);
}

/** Default color palette for up to 8 concurrent series. */
export const SERIES_COLORS: string[] = [
  "#c42b3e",
  "#22d3a6",
  "#5b9cf6",
  "#f0a93b",
  "#e23856",
  "#7db5ff",
  "#a06bff",
  "#7CFF6B",
];

/* ═══════════════════════════════════════════════════════════════
   buildChartData — extract + filter + sort + format
   ═══════════════════════════════════════════════════════════════ */

/**
 * Extract chart-ready data from the country list according to `config`.
 * Returns one dataset per selected metric, aligned to a shared set of
 * country-name labels.
 */
export function buildChartData(
  countries: CountryData[],
  config: ChartConfig
): BuiltChartData {
  const keys = config.metricKeys.filter((k) => METRIC_EXTRACTORS[k]);
  if (keys.length === 0) return { labels: [], datasets: [] };

  // ── Filter ──
  let pool = countries;
  if (config.filter?.region) {
    pool = pool.filter((c) => c.region === config.filter!.region);
  }
  if (config.filter?.minPopulation != null) {
    pool = pool.filter((c) => c.population_m >= config.filter!.minPopulation!);
  }

  // ── Build rows: only keep countries where every selected metric has a value ──
  interface Row {
    name: string;
    values: number[];
  }
  let rows: Row[] = pool
    .map((c) => ({
      name: c.name_en,
      values: keys.map((k) => METRIC_EXTRACTORS[k](c)),
    }))
    .filter(
      (r) =>
        r.values.every(
          (v) => v !== null && v !== undefined && Number.isFinite(v)
        )
    )
    .map((r) => ({
      name: r.name,
      values: r.values as number[],
    }));

  // ── Sort ──
  if (config.sortBy === "name") {
    rows.sort((a, b) => a.name.localeCompare(b.name));
  } else if (config.sortBy === "value") {
    rows.sort((a, b) => a.values[0] - b.values[0]);
  }
  if (config.sortOrder === "desc") rows.reverse();

  // ── Limit results ──
  const max = config.filter?.maxResults;
  if (max != null && max > 0) rows = rows.slice(0, max);

  const labels = rows.map((r) => r.name);
  const datasets = keys.map((k, i) => ({
    label: getMetricOption(k)?.label ?? k,
    data: rows.map((r) => r.values[i]),
  }));

  return { labels, datasets };
}

/* ═══════════════════════════════════════════════════════════════
   getMetricExtremes — global min / max for a metric
   ═══════════════════════════════════════════════════════════════ */

/**
 * Find the countries holding the global minimum and maximum value for
 * a given metric key.
 */
export function getMetricExtremes(
  countries: CountryData[],
  key: string
): MetricExtremes {
  const ext = METRIC_EXTRACTORS[key];
  const na: MetricExtremes = {
    min: NaN,
    max: NaN,
    minCountry: "N/A",
    maxCountry: "N/A",
  };
  if (!ext) return na;

  let min = Infinity;
  let max = -Infinity;
  let minCountry = "N/A";
  let maxCountry = "N/A";

  for (const c of countries) {
    const v = ext(c);
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    if (v < min) {
      min = v;
      minCountry = c.name_en;
    }
    if (v > max) {
      max = v;
      maxCountry = c.name_en;
    }
  }

  if (min === Infinity) return na;
  return { min, max, minCountry, maxCountry };
}

/* ═══════════════════════════════════════════════════════════════
   URL ENCODING — shareable chart configurations
   ═══════════════════════════════════════════════════════════════ */

/** Encode a ChartConfig into a compact, URL-safe query string. */
export function encodeConfig(config: ChartConfig): string {
  const p = new URLSearchParams();
  p.set("m", config.metricKeys.join(","));
  p.set("t", config.chartType);
  p.set("sb", config.sortBy);
  p.set("so", config.sortOrder);
  if (config.filter?.region) p.set("r", config.filter.region);
  if (config.filter?.minPopulation != null)
    p.set("min", String(config.filter.minPopulation));
  if (config.filter?.maxResults != null)
    p.set("n", String(config.filter.maxResults));
  return p.toString();
}

/** Decode a query string back into a ChartConfig (with defaults). */
export function decodeConfig(query: string): ChartConfig {
  const p = new URLSearchParams(query);
  const metricKeys = (p.get("m") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && METRIC_EXTRACTORS[s]);
  return {
    metricKeys: metricKeys.length ? metricKeys : ["undernourishment"],
    chartType: (p.get("t") as ChartConfig["chartType"]) ?? "bar",
    sortBy: (p.get("sb") as ChartConfig["sortBy"]) ?? "value",
    sortOrder: (p.get("so") as ChartConfig["sortOrder"]) ?? "desc",
    filter: {
      region: p.get("r") || undefined,
      minPopulation: p.has("min") ? Number(p.get("min")) : undefined,
      maxResults: p.has("n") ? Number(p.get("n")) : 15,
    },
  };
}

/** Sensible default configuration. */
export const DEFAULT_CONFIG: ChartConfig = {
  metricKeys: ["undernourishment", "child_mortality"],
  chartType: "bar",
  filter: { region: undefined, maxResults: 15 },
  sortBy: "value",
  sortOrder: "desc",
};
