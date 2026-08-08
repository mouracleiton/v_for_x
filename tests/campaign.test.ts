import { describe, it, expect } from "vitest";
import { analyzeNeeds, generateCountryCampaign } from "../lib/campaign";
import type { CountryData, WorldBackbone } from "../lib/types";
import backbone from "../data/world_backbone.json";

const data = backbone as WorldBackbone;
const realCountry = data.countries[0];

function mockCountry(overrides: Partial<CountryData> = {}): CountryData {
  return {
    iso3: "TST", name_en: "Test Country", name_pt: "Teste", iso2: "TS",
    un_m49: 900, region: "Africa", subregion: "East Africa",
    is_un_member: true, is_hotspot: false, hotspot_score: null,
    population_m: 10,
    hunger: {
      pop_acute_fi_m: null, prevalence_pct: null, children_sam_m: null,
      ipc_phase5: false, famine_risk_1to5: null, wfp_class: null,
      undernourishment_pct: null, child_stunting_pct: null,
      child_overweight_pct: null, anemia_prevalence_pct: null,
      child_wasting_pct: null, food_insecurity_mod_severe_pct: null,
    },
    conflict: { intensity_1to5: 1, displacement_m: null, access_blocked_1to5: 1,
      battle_deaths_total: 0, deaths_1: 0, deaths_2: 0, deaths_3: 0, deaths_4: 0, deaths_5: 0 },
    demographics: { population: 10_000_000, population_year: 2024 },
    economy: { gdp_usd: null, gdp_per_capita_usd: null, gdp_year: 2024 },
    health: { life_expectancy: null, life_expectancy_year: 2024,
      child_mortality_under5_per1k: null, infant_mortality_per1k: null,
      maternal_mortality_per100k: null, expenditure_pct_gdp: null,
      expenditure_per_capita_usd: null, tuberculosis_per100k: null,
      hiv_prevalence_pct: null, doctors_per_1000: 5,
      nurses_per_1000: null, hospital_beds_per_1000: null },
    human_development: { hdi: null, hdi_category: "—", hdi_year: 2024 },
    military: { expenditure_usd: null, pct_gdp: null, year: 2024 },
    climate: { co2_mt: null, co2_per_capita_t: null, ghg_total_mt: null, year: 2024 },
    inequality: { gini: null, year: null, gini_year: 2024 },
    water_sanitation: { basic_access_pct: 100, year: 2024,
      basic_sanitation_pct: 100, safe_sanitation_pct: 100 },
    education: { literacy_rate_pct: null, primary_enrollment_pct: null,
      secondary_enrollment_pct: null, year: 2024, primary_completion_pct: null,
      pisa_score: null, functional_illiteracy_pct: null },
    connectivity: { internet_users_pct: 100, broadband_per100: null, year: 2024 },
    migration: { refugees_origin: null, refugees_hosted: null,
      asylum_seekers_origin: null, asylum_seekers_hosted: null,
      forcibly_displaced: null, idps_disaster_new: null,
      net_migration: null, year: 2024 },
    environment: { forest_area_pct: null, renewable_energy_pct: null,
      air_pollution_pm25_ugm3: null, year: 2024, forest_area_km2: null,
      deforestation_km2: null, pesticide_use_tons: null },
    gender: { female_labor_force_pct: null, women_parliament_pct: null, year: 2024 },
    governance: { electoral_democracy_index: null, democracy_year: 2024,
      corruption_perceptions_index: null, cpi_year: 2024,
      political_corruption_index: null, political_corruption_year: 2024 },
    security: { homicide_rate_per100k: null, homicide_male_per100k: null,
      homicide_female_per100k: null, femicides_per_year: null,
      killings_by_police: null, prison_population: null,
      pre_trial_pct: null, prison_rate_per_100k: null },
    poverty: { headcount_365_pct: null, headcount_685_pct: null },
    employment: { unemployment_pct: null, youth_unemployment_pct: null,
      informality_pct: null, median_income_usd: null, child_labor_m: null },
    ...overrides,
  };
}

describe("campaign.ts", () => {
  describe("analyzeNeeds", () => {
    it("should return empty array for healthy country", () => {
      const needs = analyzeNeeds(mockCountry());
      expect(needs).toHaveLength(0);
    });

    it("should detect high undernourishment", () => {
      const country = mockCountry({
        hunger: { ...mockCountry().hunger, undernourishment_pct: 25 },
      });
      const needs = analyzeNeeds(country);
      const hunger = needs.find((n) => n.category === "HUNGER");
      expect(hunger).toBeDefined();
      expect(hunger!.severity).toBeGreaterThan(0);
    });

    it("should detect child stunting", () => {
      const country = mockCountry({
        hunger: { ...mockCountry().hunger, child_stunting_pct: 30 },
      });
      const needs = analyzeNeeds(country);
      expect(needs.some((n) => n.category === "CHILD HEALTH")).toBe(true);
    });

    it("should detect low doctor ratio", () => {
      const country = mockCountry({
        health: { ...mockCountry().health, doctors_per_1000: 0.3 },
      });
      const needs = analyzeNeeds(country);
      expect(needs.some((n) => n.category === "HEALTHCARE" || n.category === "HEALTH")).toBe(true);
    });

    it("should sort needs by severity descending", () => {
      const country = mockCountry({
        hunger: { ...mockCountry().hunger, undernourishment_pct: 40, child_stunting_pct: 15 },
        poverty: { headcount_365_pct: 30, headcount_685_pct: null },
      });
      const needs = analyzeNeeds(country);
      for (let i = 1; i < needs.length; i++) {
        expect(needs[i - 1].severity).toBeGreaterThanOrEqual(needs[i].severity);
      }
    });
  });

  describe("generateCountryCampaign", () => {
    it("should generate a campaign kit with tweets", () => {
      const kit = generateCountryCampaign(realCountry, data);
      expect(kit).toBeDefined();
      expect(kit.tweets.length).toBeGreaterThan(0);
    });

    it("should include a hook tweet", () => {
      const kit = generateCountryCampaign(realCountry, data);
      expect(kit.tweets.some((t) => t.type === "hook")).toBe(true);
    });

    it("should include whatsapp and instagram formats", () => {
      const kit = generateCountryCampaign(realCountry, data);
      expect(kit.whatsapp).toBeTruthy();
      expect(kit.instagram).toBeTruthy();
    });

    it("should include email subject and body", () => {
      const kit = generateCountryCampaign(realCountry, data);
      expect(kit.email.subject).toBeTruthy();
      expect(kit.email.body).toBeTruthy();
    });

    it("should include a brief with sources", () => {
      const kit = generateCountryCampaign(realCountry, data);
      expect(kit.brief).toBeDefined();
      expect(kit.brief.sources.length).toBeGreaterThan(0);
    });
  });
});
