import { describe, it, expect } from "vitest";
import {
  buildChoiceData,
  ratioColor,
  ratioLabel,
  COST_PER_MILLION_HUNGRY_B,
  MILITARY_PER_DAY_B,
} from "../lib/choice";
import type { CountryData } from "../lib/types";

/* ═══ TEST DATA — minimal countries for choice formula ═══ */
const makeCountry = (overrides: Partial<CountryData>): CountryData => ({
  iso3: "TEST",
  name_en: "Test",
  name_pt: "Teste",
  iso2: "TE",
  un_m49: 900,
  region: "Test",
  subregion: "Test",
  is_un_member: true,
  is_hotspot: false,
  hotspot_score: null,
  population_m: 10,
  demographics: { population: 10_000_000, population_year: 2024 },
  hunger: {
    pop_acute_fi_m: null, prevalence_pct: null, children_sam_m: null,
    ipc_phase5: false, famine_risk_1to5: null, wfp_class: null,
    undernourishment_pct: 10, child_stunting_pct: null, child_overweight_pct: null,
    anemia_prevalence_pct: null, child_wasting_pct: null,
    food_insecurity_mod_severe_pct: null,
  },
  conflict: {
    intensity_1to5: 0, displacement_m: null, access_blocked_1to5: 0,
    battle_deaths_total: 0, deaths_1: 0, deaths_2: 0, deaths_3: 0, deaths_4: 0, deaths_5: 0,
  },
  economy: { gdp_usd: 10e9, gdp_per_capita_usd: 1000, gdp_year: 2023 },
  health: {
    life_expectancy: 70, life_expectancy_year: 2023,
    child_mortality_under5_per1k: null, infant_mortality_per1k: null,
    maternal_mortality_per100k: null, expenditure_pct_gdp: 5,
    expenditure_per_capita_usd: null, tuberculosis_per100k: null, hiv_prevalence_pct: null,
  },
  human_development: { hdi: 0.5, hdi_category: "medium", hdi_year: 2023 },
  military: { expenditure_usd: 1e9, pct_gdp: 10, year: 2023 },
  climate: { co2_mt: null, co2_per_capita_t: null, ghg_total_mt: null, year: 2022 },
  inequality: { gini: null, year: null, gini_year: 2022 },
  water_sanitation: { basic_access_pct: null, year: 2022, basic_sanitation_pct: null, safe_sanitation_pct: null },
  education: {
    literacy_rate_pct: null, primary_enrollment_pct: null, secondary_enrollment_pct: null,
    year: 2022, primary_completion_pct: null,
  },
  connectivity: { internet_users_pct: null, broadband_per100: null, year: 2022 },
  migration: {
    refugees_origin: null, refugees_hosted: null, asylum_seekers_origin: null,
    asylum_seekers_hosted: null, forcibly_displaced: null, idps_disaster_new: null,
    net_migration: null, year: 2024,
  },
  environment: { forest_area_pct: null, renewable_energy_pct: null, air_pollution_pm25_ugm3: null, year: 2022 },
  gender: { female_labor_force_pct: null, women_parliament_pct: null, year: 2023 },
  governance: {
    electoral_democracy_index: null, democracy_year: 2023,
    corruption_perceptions_index: null, cpi_year: 2023,
    political_corruption_index: null, political_corruption_year: 2023,
  },
  security: { homicide_rate_per100k: null, homicide_male_per100k: null, homicide_female_per100k: null },
  poverty: { headcount_365_pct: null, headcount_685_pct: null },
  employment: { unemployment_pct: null, youth_unemployment_pct: null },
  ...overrides,
} as CountryData);

describe("choice.ts", () => {
  describe("constants", () => {
    it("MILITARY_PER_DAY_B should be $6.6B", () => {
      expect(MILITARY_PER_DAY_B).toBe(6.6);
    });

    it("COST_PER_MILLION_HUNGRY_B should be ~$0.1394B", () => {
      expect(COST_PER_MILLION_HUNGRY_B).toBeCloseTo(0.1394, 3);
    });
  });

  describe("buildChoiceData", () => {
    const countries = [
      makeCountry({ iso3: "A", name_en: "Country A", military: { expenditure_usd: 10e9, pct_gdp: 20, year: 2023 } }),
      makeCountry({ iso3: "B", name_en: "Country B", military: { expenditure_usd: 1e9, pct_gdp: 2, year: 2023 } }),
      makeCountry({ iso3: "C", name_en: "Country C", military: { expenditure_usd: 0, pct_gdp: 0, year: 2023 } }),
    ];

    const entries = buildChoiceData(countries);

    it("should filter out countries with military=0", () => {
      expect(entries).toHaveLength(2);
      expect(entries.find((e) => e.iso3 === "C")).toBeUndefined();
    });

    it("should compute correct military in billions", () => {
      const a = entries.find((e) => e.iso3 === "A");
      expect(a!.militaryB).toBeCloseTo(10, 1);
    });

    it("should compute health spending from GDP * expenditure_pct", () => {
      const a = entries.find((e) => e.iso3 === "A");
      // GDP $10B * 5% health = $0.5B
      expect(a!.healthB).toBeCloseTo(0.5, 2);
    });

    it("should compute military/health ratio correctly", () => {
      const a = entries.find((e) => e.iso3 === "A");
      // $10B military / $0.5B health = 20x
      expect(a!.ratio).toBeCloseTo(20, 1);
    });

    it("should compute cost to fix hunger", () => {
      const a = entries.find((e) => e.iso3 === "A");
      // 1M hungry (10% of 10M) * $0.1394B per million = $0.1394B
      expect(a!.costFixHungerB).toBeCloseTo(0.1394, 3);
    });

    it("should compute days of local military spending to fix hunger", () => {
      const a = entries.find((e) => e.iso3 === "A");
      // Daily military = $10B / 365 = $0.0274B/day
      // Days = $0.1394B / $0.0274B = ~5.09 days
      expect(a!.daysLocalMilitary).toBeGreaterThan(4);
      expect(a!.daysLocalMilitary).toBeLessThan(7);
    });
  });

  describe("ratioColor", () => {
    it("should return bright red for ratios >= 2", () => {
      expect(ratioColor(3)).toBe("#ff0000");
    });

    it("should return green for ratios < 0.5", () => {
      expect(ratioColor(0.3)).toBe("#00ff41");
    });

    it("should return amber for ratios ~0.5-0.9", () => {
      expect(ratioColor(0.7)).toBe("#ffaa00");
    });
  });

  describe("ratioLabel", () => {
    it("should label ratios >= 2 as 'MORE ON WAR'", () => {
      expect(ratioLabel(3)).toContain("MORE ON WAR");
    });

    it("should label ratios >= 1 as 'WAR > HEALTH'", () => {
      expect(ratioLabel(1.5)).toContain("WAR > HEALTH");
    });
  });
});
