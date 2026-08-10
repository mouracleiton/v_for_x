import { describe, it, expect } from "vitest";
import {
  FIELDS,
  getCategories,
  analyzeMetric,
  formatValue,
} from "../lib/microscope";
import type { WorldBackbone, CountryData } from "../lib/types";

function mockCountry(overrides: Partial<CountryData> = {}): CountryData {
  return {
    iso3: "USA", name_en: "United States", region: "Americas", subregion: "Northern America",
    population_m: 333, iso2: "US", un_m49: 840, is_un_member: true, is_hotspot: false, hotspot_score: 0,
    hunger: { pop_acute_fi_m: 5, prevalence_pct: 5, undernourishment_pct: 2, famine_risk_1to5: 1, wfp_class: "low", child_stunting_pct: 2, child_wasting_pct: 1, anemia_prevalence_pct: 5, child_overweight_pct: 8, food_insecurity_mod_severe_pct: 5, children_sam_m: 0.1, ipc_phase5: false },
    conflict: { intensity_1to5: 0, displacement_m: 0, access_blocked_1to5: 1, battle_deaths_total: 0, deaths_1: 0, deaths_2: 0, deaths_3: 0, deaths_4: 0, deaths_5: 0 },
    demographics: { population: 333000000, population_year: 2023 },
    economy: { gdp_usd: 25e12, gdp_per_capita_usd: 75000, gdp_year: 2023 },
    health: { life_expectancy: 78, life_expectancy_year: 2023, child_mortality_under5_per1k: 7, infant_mortality_per1k: 6, maternal_mortality_per100k: 20, expenditure_pct_gdp: 17, expenditure_per_capita_usd: 12000, tuberculosis_per100k: 3, hiv_prevalence_pct: 0.4, doctors_per_1000: 2.6 },
    poverty: { headcount_365_pct: 1, headcount_685_pct: 2 },
    military: { expenditure_usd: 800e9, pct_gdp: 3.5, year: 2023 },
    inequality: { gini: 40, gini_year: 2023, year: 2023 },
    governance: { corruption_perceptions_index: 70, cpi_year: 2023, electoral_democracy_index: 0.8, democracy_year: 2023, political_corruption_index: 20, political_corruption_year: 2023 },
    education: { literacy_rate_pct: 99, pisa_score: 500, primary_completion_pct: 99, primary_enrollment_pct: 99, secondary_enrollment_pct: 95, functional_illiteracy_pct: 5, year: 2023 },
    employment: { unemployment_pct: 4, youth_unemployment_pct: 8, child_labor_m: 0, informality_pct: 5, median_income_usd: 50000 },
    environment: { deforestation_km2: 100, forest_area_km2: 3e6, forest_area_pct: 33, air_pollution_pm25_ugm3: 8, renewable_energy_pct: 20, pesticide_use_tons: 50000, year: 2023 },
    security: { homicide_rate_per100k: 5, femicides_per_year: 0, homicide_male_per100k: 7, homicide_female_per100k: 2, killings_by_police: 0, pre_trial_pct: 20, prison_population: 2e6, prison_rate_per_100k: 600 },
    water_sanitation: { basic_access_pct: 99, basic_sanitation_pct: 99, safe_sanitation_pct: 95, year: 2023 },
    climate: { co2_per_capita_t: 14 },
    human_development: { hdi: 0.9, hdi_category: "very_high", hdi_year: 2023 },
    ...overrides,
  } as unknown as CountryData;
}

const mockBackbone = {
  countries: [
    mockCountry({ iso3: "USA", name_en: "United States", region: "Americas", health: { life_expectancy: 78, life_expectancy_year: 2023, child_mortality_under5_per1k: 7, infant_mortality_per1k: 6, maternal_mortality_per100k: 20, expenditure_pct_gdp: 17, expenditure_per_capita_usd: 12000, tuberculosis_per100k: 3, hiv_prevalence_pct: 0.4, doctors_per_1000: 2.6 } }),
    mockCountry({ iso3: "YEM", name_en: "Yemen", region: "Asia", subregion: "Western Asia", population_m: 34, health: { life_expectancy: 65, life_expectancy_year: 2023, child_mortality_under5_per1k: 60, infant_mortality_per1k: 50, maternal_mortality_per100k: 200, expenditure_pct_gdp: 3, expenditure_per_capita_usd: 50, tuberculosis_per100k: 50, hiv_prevalence_pct: 0.1, doctors_per_1000: 0.3 } }),
    mockCountry({ iso3: "NOR", name_en: "Norway", region: "Europe", subregion: "Northern Europe", population_m: 5, health: { life_expectancy: 83, life_expectancy_year: 2023, child_mortality_under5_per1k: 3, infant_mortality_per1k: 2, maternal_mortality_per100k: 5, expenditure_pct_gdp: 10, expenditure_per_capita_usd: 8000, tuberculosis_per100k: 5, hiv_prevalence_pct: 0.1, doctors_per_1000: 4.5 } }),
    mockCountry({ iso3: "BRA", name_en: "Brazil", region: "Americas", subregion: "South America", population_m: 214, health: { life_expectancy: 75, life_expectancy_year: 2023, child_mortality_under5_per1k: 14, infant_mortality_per1k: 12, maternal_mortality_per100k: 60, expenditure_pct_gdp: 9, expenditure_per_capita_usd: 900, tuberculosis_per100k: 40, hiv_prevalence_pct: 0.5, doctors_per_1000: 2.2 } }),
  ],
  metadata: { schema_version: "1", title: "", description: "", created: "", standard: "", sources: [], total_countries: 4, license: "", data_layers: [], last_updated: "" },
} as unknown as WorldBackbone;

describe("microscope", () => {
  describe("FIELDS", () => {
    it("has at least 20 fields", () => {
      expect(FIELDS.length).toBeGreaterThanOrEqual(20);
    });

    it("each field has a working extractor", () => {
      for (const f of FIELDS) {
        expect(f.key).toBeTruthy();
        expect(f.label).toBeTruthy();
        expect(f.category).toBeTruthy();
        expect(typeof f.extract).toBe("function");
      }
    });
  });

  describe("getCategories", () => {
    it("returns unique category list", () => {
      const cats = getCategories();
      const unique = new Set(cats);
      expect(unique.size).toBe(cats.length);
      expect(cats.length).toBeGreaterThan(5);
    });
  });

  describe("analyzeMetric", () => {
    it("produces a valid result for life expectancy", () => {
      const field = FIELDS.find((f) => f.key === "health_life_expectancy")!;
      const result = analyzeMetric(mockBackbone, field);
      expect(result.countries.length).toBe(4);
      expect(result.stats.count).toBe(4);
      expect(result.stats.min).toBeLessThanOrEqual(result.stats.max);
    });

    it("computes mean correctly", () => {
      const field = FIELDS.find((f) => f.key === "health_life_expectancy")!;
      const result = analyzeMetric(mockBackbone, field);
      const values = [78, 65, 83, 75];
      const expectedMean = values.reduce((a, b) => a + b, 0) / values.length;
      expect(result.stats.mean).toBeCloseTo(expectedMean, 1);
    });

    it("ranks countries correctly", () => {
      const field = FIELDS.find((f) => f.key === "health_life_expectancy")!;
      const result = analyzeMetric(mockBackbone, field);
      // Life expectancy is inverse, so best = highest = Norway (83)
      expect(result.best?.iso3).toBe("NOR");
      expect(result.worst?.iso3).toBe("YEM");
    });

    it("computes regional breakdown", () => {
      const field = FIELDS.find((f) => f.key === "health_life_expectancy")!;
      const result = analyzeMetric(mockBackbone, field);
      expect(result.regions.length).toBeGreaterThan(0);
    });

    it("handles fields with null values", () => {
      const field = FIELDS.find((f) => f.key === "hunger_famine_risk")!;
      const result = analyzeMetric(mockBackbone, field);
      // May have fewer valid countries; should not crash
      expect(result.countries).toBeDefined();
    });

    it("computes z-scores for each country", () => {
      const field = FIELDS.find((f) => f.key === "health_life_expectancy")!;
      const result = analyzeMetric(mockBackbone, field);
      for (const c of result.countries) {
        if (c.value != null) {
          expect(c.zScore).not.toBeNull();
        }
      }
    });
  });

  describe("formatValue", () => {
    it("formats USD values", () => {
      expect(formatValue(800e9, "USD")).toMatch(/B/);
      expect(formatValue(25e12, "USD")).toMatch(/T/);
    });

    it("formats percentage values", () => {
      expect(formatValue(45.5, "%")).toBe("45.5%");
    });

    it("returns dash for null", () => {
      expect(formatValue(null, "%")).toBe("—");
    });
  });
});
