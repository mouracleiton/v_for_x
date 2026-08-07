/**
 * V FOR X — Type definitions for world_backbone.json
 */

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
  };
  human_development: {
    hdi: number | null;
    hdi_category: string;
    hdi_year: number;
  };
  military: {
    expenditure_usd: number | null;
    pct_gdp: number | null;
    year: number;
  };
  climate: {
    co2_mt: number | null;
    co2_per_capita_t: number | null;
    ghg_total_mt: number | null;
    year: number;
  };
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
  };
  connectivity: {
    internet_users_pct: number | null;
    broadband_per100: number | null;
    year: number;
  };
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
  };
  gender: {
    female_labor_force_pct: number | null;
    women_parliament_pct: number | null;
    year: number;
  };
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
  };
  poverty: {
    headcount_365_pct: number | null;
    headcount_685_pct: number | null;
  };
  employment: {
    unemployment_pct: number | null;
    youth_unemployment_pct: number | null;
    informality_pct?: number | null;
    median_income_usd?: number | null;
    child_labor_m?: number | null;
  };
  // ── Enriched dimensions (OpenRepublic integration) ──
  justice?: {
    prison_population: number | null;
    prison_rate_per_100k: number | null;
    pre_trial_pct: number | null;
    prison_overcrowding_pct: number | null;
    judicial_efficiency_cases_backlog: number | null;
    rule_of_law_index: number | null;
    _meta?: { sources: string[]; year: number | null };
  };
  energy?: {
    renewable_matrix_pct: number | null;
    renewable_electric_pct: number | null;
    hydroelectric_pct: number | null;
    wind_pct: number | null;
    solar_pct: number | null;
    fossil_electric_pct: number | null;
    nuclear_pct: number | null;
    no_access_electricity_m: number | null;
    _meta?: { sources: string[]; year: number | null };
  };
  taxation?: {
    tax_burden_pct_gdp: number | null;
    consumption_tax_pct: number | null;
    income_tax_pct: number | null;
    property_tax_pct: number | null;
    tax_revenue_total_usd: number | null;
    _meta?: { sources: string[]; year: number | null };
  };
  food_security?: {
    severe_food_insecurity_m: number | null;
    total_food_insecurity_m: number | null;
    min_wage_usd: number | null;
    min_wage_needed_usd: number | null;
    food_cost_affordability_ratio: number | null;
    _meta?: { sources: string[]; year: number | null };
  };
}

export interface Scenario {
  name: string;
  years: number[];
  hunger_total_m: number[];
  hunger_by_region_m: Record<string, number[]>;
  budget_per_year_billion: number[];
  cumulative_cost_billion: number[];
  deaths_avoided_cumulative: number[];
  roi_aggregate: number[];
  interventions?: Record<string, unknown>;
  sdg2_met: boolean;
  final_hunger_m: number;
}

export interface Tactic {
  id: number;
  name: string;
  casualties: string;
  success: string;
  speed: string;
  tier: "S" | "A" | "B";
}

export interface StructuralBlocker {
  id: number;
  name: string;
  affected_m: number | null;
  description: string;
}

export interface ImplementationPhase {
  phase: number;
  name: string;
  period: string;
  target_hunger_m: number;
  reduction_pct: number;
}

export interface WorldBackbone {
  metadata: {
    schema_version: string;
    title: string;
    description: string;
    created: string;
    standard: string;
    sources: string[];
    total_countries: number;
    license: string;
  };
  countries: CountryData[];
  global_indicators: {
    hunger: {
      undernourished_2024_m: number;
      undernourished_2023_m: number;
      moderate_or_severe_fi_m: number;
      severe_fi_m: number;
      proportion_global: string;
      healthy_diet_unreachable_m: number;
      cost_to_eradicate_billion_yr: number;
      source: string;
    };
    military: {
      global_spending_decade_t: number;
      global_spending_yr_t: number;
      hunger_cost_vs_military_pct: number;
      source: string;
    };
    sdg2: {
      target: string;
      status: string;
      projected_2030_bau_m: number;
      projected_2034_ambitious_m: number;
      threshold_m: number;
    };
    interventions_evidence: {
      school_feeding: {
        roi_min: number;
        roi_max: number;
        children_reached_m: number;
        market_size_billion_yr: number;
        source: string;
      };
      smallholder_agriculture: {
        income_increase_pct: number;
        production_increase_pct: number;
        market_access_increase_pct: number;
        target_farmers_m: number;
        source: string;
      };
      agri_rd: { annual_return_pct: number; source: string };
    };
    hunger_drivers: Record<string, unknown>;
  };
  scenarios: Record<string, Scenario>;
  hotspots: {
    wfp_classification: Record<string, string[]>;
    all: {
      iso3: string;
      name_pt: string;
      name_en?: string;
      score: number;
      wfp_class: string;
    }[];
  };
  financing: {
    recommended_scenario: string;
    annual_budget_billion: number;
    pct_world_gdp: number;
    pct_global_military: number;
    allocation: {
      name: string;
      pct: number;
      billion_yr: number;
      justification: string;
    }[];
    alternatives: { name: string; detail: string }[];
  };
  tactics_conflict_zones: Tactic[];
  structural_blockers: StructuralBlocker[];
  implementation_phases: ImplementationPhase[];
}
