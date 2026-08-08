import { describe, it, expect } from "vitest";
import {
  countryToEquation,
  countryToProtocol,
  countryToBlueprints,
  countryToBlueprintLink,
  countryToRegistry,
  countryToTrilha,
  equationToTrilha,
  equationToProtocol,
  equationToRegistry,
  branchLinks,
  type BlueprintMatch,
} from "../lib/crosslinks";
import type { CountryData } from "../lib/types";

/** Build a minimal mock CountryData for testing blueprint matching rules */
function mockCountry(overrides: Partial<CountryData> = {}): CountryData {
  return {
    iso3: "TST",
    name_en: "Test Country",
    name_pt: "País de Teste",
    iso2: "TS",
    un_m49: 900,
    region: "Africa",
    subregion: "Eastern Africa",
    is_un_member: true,
    is_hotspot: false,
    hotspot_score: null,
    population_m: 10,
    hunger: {
      pop_acute_fi_m: null,
      prevalence_pct: null,
      children_sam_m: null,
      ipc_phase5: false,
      famine_risk_1to5: null,
      wfp_class: null,
      undernourishment_pct: null,
      child_stunting_pct: null,
      child_overweight_pct: null,
      anemia_prevalence_pct: null,
      child_wasting_pct: null,
      food_insecurity_mod_severe_pct: null,
    },
    conflict: {
      intensity_1to5: 1,
      displacement_m: null,
      access_blocked_1to5: 1,
      battle_deaths_total: 0,
      deaths_1: 0,
      deaths_2: 0,
      deaths_3: 0,
      deaths_4: 0,
      deaths_5: 0,
    },
    demographics: { population: 10_000_000, population_year: 2024 },
    economy: { gdp_usd: null, gdp_per_capita_usd: null, gdp_year: 2024 },
    health: {
      life_expectancy: null,
      life_expectancy_year: 2024,
      child_mortality_under5_per1k: null,
      infant_mortality_per1k: null,
      maternal_mortality_per100k: null,
      expenditure_pct_gdp: null,
      expenditure_per_capita_usd: null,
      tuberculosis_per100k: null,
      hiv_prevalence_pct: null,
      doctors_per_1000: 5,
      nurses_per_1000: null,
      hospital_beds_per_1000: null,
    },
    human_development: { hdi: null, hdi_category: "—", hdi_year: 2024 },
    military: { expenditure_usd: null, pct_gdp: null, year: 2024 },
    climate: { co2_mt: null, co2_per_capita_t: null, ghg_total_mt: null, year: 2024 },
    inequality: { gini: null, year: null, gini_year: 2024 },
    water_sanitation: {
      basic_access_pct: 100,
      year: 2024,
      basic_sanitation_pct: 100,
      safe_sanitation_pct: 100,
    },
    education: {
      literacy_rate_pct: null,
      primary_enrollment_pct: null,
      secondary_enrollment_pct: null,
      year: 2024,
      primary_completion_pct: null,
      pisa_score: null,
      functional_illiteracy_pct: null,
    },
    connectivity: { internet_users_pct: 100, broadband_per100: null, year: 2024 },
    migration: {
      refugees_origin: null,
      refugees_hosted: null,
      asylum_seekers_origin: null,
      asylum_seekers_hosted: null,
      forcibly_displaced: null,
      idps_disaster_new: null,
      net_migration: null,
      year: 2024,
    },
    environment: {
      forest_area_pct: null,
      renewable_energy_pct: null,
      air_pollution_pm25_ugm3: null,
      year: 2024,
      forest_area_km2: null,
      deforestation_km2: null,
      pesticide_use_tons: null,
    },
    gender: { female_labor_force_pct: null, women_parliament_pct: null, year: 2024 },
    governance: {
      electoral_democracy_index: null,
      democracy_year: 2024,
      corruption_perceptions_index: null,
      cpi_year: 2024,
      political_corruption_index: null,
      political_corruption_year: 2024,
    },
    security: {
      homicide_rate_per100k: null,
      homicide_male_per100k: null,
      homicide_female_per100k: null,
      femicides_per_year: null,
      killings_by_police: null,
      prison_population: null,
      pre_trial_pct: null,
      prison_rate_per_100k: null,
    },
    poverty: { headcount_365_pct: null, headcount_685_pct: null },
    employment: {
      unemployment_pct: null,
      youth_unemployment_pct: null,
      informality_pct: null,
      median_income_usd: null,
      child_labor_m: null,
    },
    ...overrides,
  };
}

describe("crosslinks.ts", () => {
  describe("countryToEquation", () => {
    it("should generate link with country param", () => {
      const link = countryToEquation("SDN");
      expect(link.href).toBe("/equation/?country=SDN");
      expect(link.label).toContain("MODEL");
    });
  });

  describe("countryToProtocol", () => {
    it("should generate conflict-tactics description for high conflict", () => {
      const link = countryToProtocol("SDN", {
        isHotspot: true,
        conflictIntensity: 4,
        famineRisk: 3,
        connectivity: 30,
      });
      expect(link.href).toBe("/protocol-x/?country=SDN");
      expect(link.description).toContain("conflict");
    });

    it("should generate food security description for famine risk", () => {
      const link = countryToProtocol("YEM", {
        isHotspot: true,
        conflictIntensity: 1,
        famineRisk: 4,
        connectivity: 50,
      });
      expect(link.description).toContain("Food security");
    });

    it("should generate resilience description for calm countries", () => {
      const link = countryToProtocol("NOR", {
        isHotspot: false,
        conflictIntensity: 1,
        famineRisk: 1,
        connectivity: 90,
      });
      expect(link.description).toContain("Resilience");
    });
  });

  describe("countryToBlueprints", () => {
    it("should return empty array for healthy country", () => {
      const country = mockCountry();
      const matches = countryToBlueprints(country);
      expect(matches).toHaveLength(0);
    });

    it("should match water-solar-purification for low water access", () => {
      const country = mockCountry({
        water_sanitation: {
          ...mockCountry().water_sanitation,
          basic_access_pct: 50,
          safe_sanitation_pct: 30,
        },
      });
      const matches = countryToBlueprints(country);
      const ids = matches.map((m) => m.blueprintId);
      expect(ids).toContain("water-solar-purification");
    });

    it("should match comms-mesh-network for conflict zones", () => {
      const country = mockCountry({
        conflict: { ...mockCountry().conflict, intensity_1to5: 4 },
      });
      const matches = countryToBlueprints(country);
      const ids = matches.map((m) => m.blueprintId);
      expect(ids).toContain("comms-mesh-network");
    });

    it("should match food-emergency-garden for high famine risk", () => {
      const country = mockCountry({
        hunger: {
          ...mockCountry().hunger,
          undernourishment_pct: 25,
          famine_risk_1to5: 4,
        },
      });
      const matches = countryToBlueprints(country);
      const ids = matches.map((m) => m.blueprintId);
      expect(ids).toContain("food-emergency-garden");
    });

    it("should sort critical before recommended", () => {
      const country = mockCountry({
        hunger: {
          ...mockCountry().hunger,
          undernourishment_pct: 30,
          famine_risk_1to5: 4,
          food_insecurity_mod_severe_pct: 60,
        },
        conflict: { ...mockCountry().conflict, intensity_1to5: 4 },
        water_sanitation: {
          ...mockCountry().water_sanitation,
          basic_access_pct: 50,
          safe_sanitation_pct: 30,
        },
      });
      const matches = countryToBlueprints(country);
      const priorities = matches.map((m) => m.priority);
      const firstCritical = priorities.indexOf("critical");
      const firstRecommended = priorities.indexOf("recommended");
      if (firstCritical >= 0 && firstRecommended >= 0) {
        expect(firstCritical).toBeLessThan(firstRecommended);
      }
    });
  });

  describe("countryToBlueprintLink", () => {
    it("should include match count in label", () => {
      const country = mockCountry({
        hunger: { ...mockCountry().hunger, undernourishment_pct: 30, famine_risk_1to5: 4 },
      });
      const link = countryToBlueprintLink(country);
      expect(link.label).toContain("BLUEPRINTS");
    });

    it("should mention critical count when present", () => {
      const country = mockCountry({
        hunger: { ...mockCountry().hunger, undernourishment_pct: 30, famine_risk_1to5: 4 },
      });
      const link = countryToBlueprintLink(country);
      expect(link.description).toContain("critical");
    });

    it("should handle zero matches gracefully", () => {
      const country = mockCountry();
      const link = countryToBlueprintLink(country);
      expect(link.description).toContain("Browse all");
    });
  });

  describe("simple link generators", () => {
    it("countryToRegistry generates correct link", () => {
      const link = countryToRegistry("USA");
      expect(link.href).toBe("/registry/?country=USA");
    });

    it("countryToTrilha generates correct link", () => {
      const link = countryToTrilha("SDN");
      expect(link.href).toBe("/the-trail/?need=SDN");
    });

    it("equationToTrilha generates correct link", () => {
      const link = equationToTrilha();
      expect(link.href).toBe("/the-trail/");
    });

    it("equationToProtocol generates correct link", () => {
      const link = equationToProtocol();
      expect(link.href).toBe("/protocol-x/");
    });

    it("equationToRegistry generates correct link", () => {
      const link = equationToRegistry();
      expect(link.href).toBe("/registry/");
    });
  });

  describe("branchLinks", () => {
    it("should have at least 25 links", () => {
      expect(branchLinks.length).toBeGreaterThanOrEqual(25);
    });

    it("should have unique hrefs", () => {
      const hrefs = branchLinks.map((l) => l.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    });

    it("should have unique codes", () => {
      const codes = branchLinks.map((l) => l.code);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it("should include all core branches", () => {
      const hrefs = branchLinks.map((l) => l.href);
      expect(hrefs).toContain("/");
      expect(hrefs).toContain("/sorrow-map/");
      expect(hrefs).toContain("/equation/");
      expect(hrefs).toContain("/protocol-x/");
      expect(hrefs).toContain("/registry/");
      expect(hrefs).toContain("/the-web/");
      expect(hrefs).toContain("/the-trail/");
      expect(hrefs).toContain("/fortress/");
      expect(hrefs).toContain("/the-mask/");
    });
  });
});
