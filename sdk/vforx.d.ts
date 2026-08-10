/**
 * V FOR X — Developer SDK Type Definitions
 * Type definitions for the @vforx/sdk JavaScript/TypeScript package.
 *
 * All 200 countries × ~87 fields per country, typed end-to-end.
 * License: CC0. No auth, no rate limits — it is static data.
 */

// ── Country field types (mirrors lib/types.ts CountryData) ──

export interface CountryHunger {
  pop_acute_fi_m: number | null;
  prevalence_pct: number | null;
  children_sam_m: number | null;
  ipc_phase5: boolean;
  famine_risk_1to5: number | null;
  wfp_class: string | null;
  undernourishment_pct: number | null;
  child_stunting_pct: number | null;
  child_overweight_pct: number | null;
  anemia_prevalence_pct: number | null;
  child_wasting_pct: number | null;
  food_insecurity_mod_severe_pct: number | null;
}

export interface CountryConflict {
  intensity_1to5: number;
  displacement_m: number | null;
  access_blocked_1to5: number;
  battle_deaths_total: number;
  deaths_1: number;
  deaths_2: number;
  deaths_3: number;
  deaths_4: number;
  deaths_5: number;
}

export interface CountryData {
  iso3: string;
  name_en: string;
  name_pt: string;
  name_es?: string;
  name_fr?: string;
  name_zh?: string;
  name_ja?: string;
  name_ko?: string;
  name_hi?: string;
  name_ar?: string;
  name_ru?: string;
  iso2: string;
  un_m49: number;
  region: string;
  subregion: string;
  is_un_member: boolean;
  is_hotspot: boolean;
  hotspot_score: number | null;
  population_m: number;
  hunger: CountryHunger;
  conflict: CountryConflict;
  demographics: { population: number; population_year: number };
  economy: {
    gdp_usd: number | null;
    gdp_per_capita_usd: number | null;
    gdp_year: number;
  };
  health: {
    life_expectancy: number | null;
    life_expectancy_year: number;
    child_mortality_under5_per1k: number | null;
    infant_mortality_per1k: number | null;
    maternal_mortality_per100k: number | null;
    expenditure_pct_gdp: number | null;
    expenditure_per_capita_usd: number | null;
    tuberculosis_per100k: number | null;
    hiv_prevalence_pct: number | null;
    doctors_per_1000?: number | null;
    nurses_per_1000?: number | null;
    hospital_beds_per_1000?: number | null;
  };
  human_development: { hdi: number | null; hdi_category: string; hdi_year: number };
  military: { expenditure_usd: number | null; pct_gdp: number | null; year: number };
  climate: { co2_mt: number | null; co2_per_capita_t: number | null; ghg_total_mt: number | null; year: number };
  inequality: { gini: number | null; year: number | null; gini_year: number };
  water_sanitation: {
    basic_access_pct: number | null;
    year: number;
    basic_sanitation_pct: number | null;
    safe_sanitation_pct: number | null;
  };
  education: {
    literacy_rate_pct: number | null;
    primary_enrollment_pct: number | null;
    secondary_enrollment_pct: number | null;
    year: number;
    primary_completion_pct: number | null;
    pisa_score?: number | null;
    functional_illiteracy_pct?: number | null;
  };
  connectivity: { internet_users_pct: number | null; broadband_per100: number | null; year: number };
  migration: {
    refugees_origin: number | null;
    refugees_hosted: number | null;
    asylum_seekers_origin: number | null;
    asylum_seekers_hosted: number | null;
    forcibly_displaced: number | null;
    idps_disaster_new: number | null;
    net_migration: number | null;
    year: number;
  };
  environment: {
    forest_area_pct: number | null;
    renewable_energy_pct: number | null;
    air_pollution_pm25_ugm3: number | null;
    year: number;
    forest_area_km2: number | null;
    deforestation_km2?: number | null;
    pesticide_use_tons?: number | null;
  };
  gender: { female_labor_force_pct: number | null; women_parliament_pct: number | null; year: number };
  governance: {
    electoral_democracy_index: number | null;
    democracy_year: number;
    corruption_perceptions_index: number | null;
    cpi_year: number;
    political_corruption_index: number | null;
    political_corruption_year: number;
  };
  security: {
    homicide_rate_per100k: number | null;
    homicide_male_per100k: number | null;
    homicide_female_per100k: number | null;
    femicides_per_year?: number | null;
    killings_by_police?: number | null;
    prison_population?: number | null;
    pre_trial_pct?: number | null;
    prison_rate_per_100k?: number | null;
  };
  poverty: { headcount_365_pct: number | null; headcount_685_pct: number | null };
  employment: {
    unemployment_pct: number | null;
    youth_unemployment_pct: number | null;
    informality_pct?: number | null;
    median_income_usd?: number | null;
    child_labor_m?: number | null;
  };
}

// ── Query interfaces ───────────────────────────────────────

/** A single country lookup by ISO3 code (e.g. "BRA", "USA"). */
export interface CountryQuery {
  iso3: string;
}

/** Compare 2–N countries side by side. */
export interface ComparisonQuery {
  iso3List: string[];
}

/** Filter countries by one or more metric ranges. */
export interface FilterOptions {
  /** Region filter, e.g. "Africa", "Americas". */
  region?: string;
  /** Metric range filters keyed by dotted path, e.g. { "hunger.prevalence_pct": { min: 20 } }. */
  metrics?: Record<string, { min?: number; max?: number }>;
  /** Limit the number of results. */
  limit?: number;
}

// ── Response types ──────────────────────────────────────────

/** Result wrapper for a single country. */
export interface CountryResult {
  found: boolean;
  country?: CountryData;
}

/** Result wrapper for a list of countries. */
export interface ListResult {
  count: number;
  countries: CountryData[];
}

/** Global statistics for a single metric across all countries. */
export interface StatsResult {
  metric: string;
  min: number;
  max: number;
  mean: number;
  median: number;
  count: number;
  /** ISO3 of the country with the minimum value. */
  minCountry: string;
  /** ISO3 of the country with the maximum value. */
  maxCountry: string;
}

/** A ranked entry returned by VForX.rank(). */
export interface RankedEntry {
  rank: number;
  iso3: string;
  name: string;
  value: number;
}

/** Lightweight country info returned by VForX.countries(). */
export interface CountryInfo {
  iso3: string;
  iso2: string;
  name: string;
  region: string;
  population: number;
  is_hotspot: boolean;
}

/** Options for ranking. */
export interface RankOptions {
  /** "asc" = smallest first; "desc" = largest first (default). */
  direction?: "asc" | "desc";
  /** Number of entries to return. Default 10. */
  limit?: number;
}

// ── Main SDK interface ──────────────────────────────────────

export interface VForXSDK {
  /** The full dataset (200 countries) once loaded. */
  data: { countries: CountryData[] };

  /** Get a single country by ISO3 code. */
  getCountry(iso3: string): CountryResult;

  /** Search countries by name (any language field). */
  search(query: string): CountryData[];

  /** Compare multiple countries side by side. */
  compare(iso3List: string[]): CountryData[];

  /** Filter countries by region and/or metric ranges. */
  filter(options: FilterOptions): CountryData[];

  /** Rank countries by a metric. */
  rank(metricKey: string, options?: RankOptions): RankedEntry[];

  /** Compute global statistics (min/max/mean/median) for a metric. */
  stats(metricKey: string): StatsResult;

  /** List all countries with basic info. */
  countries(): CountryInfo[];
}

// UMD global export
declare const VForX: VForXSDK;

export default VForX;
