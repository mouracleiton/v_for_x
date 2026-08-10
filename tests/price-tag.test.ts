import { describe, it, expect } from "vitest";
import {
  buildCounters,
  computeTick,
  getYearAnchor,
  getDayAnchor,
  formatTickValue,
  counterColor,
  generateShareText,
} from "../lib/price-tag";
import type { WorldBackbone } from "../lib/types";

/* Minimal mock backbone for testing */
const mockBackbone = {
  countries: [
    {
      iso3: "USA", name_en: "United States", region: "Americas", subregion: "Northern America",
      population_m: 333, iso2: "US", un_m49: 840, is_un_member: true, is_hotspot: false, hotspot_score: 0,
      hunger: { pop_acute_fi_m: 5, prevalence_pct: 5, undernourishment_pct: 2, famine_risk_1to5: 1, wfp_class: "low", child_stunting_pct: 2, child_wasting_pct: 1, anemia_prevalence_pct: 5, child_overweight_pct: 8, food_insecurity_mod_severe_pct: 5, children_sam_m: 0.1, ipc_phase5: false },
      conflict: { intensity_1to5: 1, displacement_m: 0, access_blocked_1to5: 1, battle_deaths_total: 100, deaths_1: 0, deaths_2: 0, deaths_3: 0, deaths_4: 0, deaths_5: 0 },
      demographics: { population: 333000000, population_year: 2023 },
      economy: { gdp_usd: 25e12, gdp_per_capita_usd: 75000, gdp_year: 2023 },
      health: { life_expectancy: 78, life_expectancy_year: 2023, child_mortality_under5_per1k: 7, infant_mortality_per1k: 6, maternal_mortality_per100k: 20, expenditure_pct_gdp: 17, expenditure_per_capita_usd: 12000, tuberculosis_per100k: 3, hiv_prevalence_pct: 0.4, doctors_per_1000: 2.6 },
      poverty: { headcount_365_pct: 1, headcount_685_pct: 2 },
      military: { expenditure_usd: 800e9, pct_gdp: 3.5, year: 2023 },
      migration: { refugees_hosted: 0, refugees_origin: 0, asylum_seekers_hosted: 0, asylum_seekers_origin: 0, forcibly_displaced: 0, idps_disaster_new: 0, net_migration: 0, year: 2023 },
      environment: { deforestation_km2: 100, forest_area_km2: 3e6, forest_area_pct: 33, air_pollution_pm25_ugm3: 8, renewable_energy_pct: 20, pesticide_use_tons: 50000, year: 2023 },
      climate: { co2_per_capita_t: 14 },
    },
    {
      iso3: "YEM", name_en: "Yemen", region: "Asia", subregion: "Western Asia",
      population_m: 34, iso2: "YE", un_m49: 887, is_un_member: true, is_hotspot: true, hotspot_score: 95,
      hunger: { pop_acute_fi_m: 17, prevalence_pct: 50, undernourishment_pct: 45, famine_risk_1to5: 5, wfp_class: "very_high", child_stunting_pct: 40, child_wasting_pct: 15, anemia_prevalence_pct: 50, child_overweight_pct: 3, food_insecurity_mod_severe_pct: 60, children_sam_m: 2, ipc_phase5: true },
      conflict: { intensity_1to5: 4, displacement_m: 4, access_blocked_1to5: 4, battle_deaths_total: 5000, deaths_1: 1000, deaths_2: 2000, deaths_3: 1000, deaths_4: 500, deaths_5: 500 },
      demographics: { population: 34000000, population_year: 2023 },
      economy: { gdp_usd: 20e9, gdp_per_capita_usd: 600, gdp_year: 2023 },
      health: { life_expectancy: 65, life_expectancy_year: 2023, child_mortality_under5_per1k: 60, infant_mortality_per1k: 50, maternal_mortality_per100k: 200, expenditure_pct_gdp: 3, expenditure_per_capita_usd: 50, tuberculosis_per100k: 50, hiv_prevalence_pct: 0.1, doctors_per_1000: 0.3 },
      poverty: { headcount_365_pct: 60, headcount_685_pct: 70 },
      military: { expenditure_usd: 0, pct_gdp: 0, year: 2023 },
      migration: { refugees_hosted: 0, refugees_origin: 0, asylum_seekers_hosted: 0, asylum_seekers_origin: 0, forcibly_displaced: 4, idps_disaster_new: 100000, net_migration: -200000, year: 2023 },
      environment: { deforestation_km2: 0, forest_area_km2: 1000, forest_area_pct: 1, air_pollution_pm25_ugm3: 50, renewable_energy_pct: 0, pesticide_use_tons: 100, year: 2023 },
      climate: { co2_per_capita_t: 0.4 },
    },
  ],
  global_indicators: {
    hunger: { undernourished_2024_m: 667, undernourished_2023_m: 733, acute_fi_m: 300 },
    sdg2: { status: "off_track", threshold_m: 150, target: "Zero Hunger", projected_2030_bau_m: 650, projected_2034_ambitious_m: 150 },
  },
  financing: { annual_budget_billion: 93 },
  scenarios: {},
  hotspots: { all: [] },
  metadata: { schema_version: "1", title: "test", description: "", created: "", standard: "", sources: [], total_countries: 2, license: "", data_layers: [], last_updated: "" },
} as unknown as WorldBackbone;

describe("price-tag", () => {
  describe("buildCounters", () => {
    it("produces a non-empty array of counters", () => {
      const counters = buildCounters(mockBackbone);
      expect(counters.length).toBeGreaterThan(5);
    });

    it("each counter has valid per-second rate", () => {
      const counters = buildCounters(mockBackbone);
      for (const c of counters) {
        expect(c.perSecond).toBeGreaterThan(0);
        expect(c.perMinute).toBe(c.perSecond * 60);
        expect(c.perHour).toBe(c.perSecond * 3600);
        expect(c.perDay).toBe(c.perSecond * 86400);
      }
    });

    it("includes hunger counters", () => {
      const counters = buildCounters(mockBackbone);
      const ids = counters.map((c) => c.id);
      expect(ids).toContain("hunger_undernourished");
      expect(ids).toContain("hunger_acute");
    });

    it("includes military spending counter", () => {
      const counters = buildCounters(mockBackbone);
      const ids = counters.map((c) => c.id);
      expect(ids).toContain("military_spending");
    });

    it("includes environmental counters", () => {
      const counters = buildCounters(mockBackbone);
      const ids = counters.map((c) => c.id);
      expect(ids).toContain("deforestation");
      expect(ids).toContain("co2_emissions");
    });

    it("undernourished counter derives from global_indicators", () => {
      const counters = buildCounters(mockBackbone);
      const hunger = counters.find((c) => c.id === "hunger_undernourished");
      expect(hunger).toBeDefined();
      // 667M from the mock
      expect(hunger!.annualTotal).toBe(667_000_000);
    });
  });

  describe("computeTick", () => {
    it("returns elapsed seconds and counter values", () => {
      const counters = buildCounters(mockBackbone);
      const tick = computeTick(counters, 60_000); // 1 minute
      expect(tick.elapsedSeconds).toBeCloseTo(60, 1);
      expect(Object.keys(tick.counters).length).toBe(counters.length);
    });

    it("computes accumulated values proportional to elapsed time", () => {
      const counters = buildCounters(mockBackbone);
      const tick1 = computeTick(counters, 1000); // 1 sec
      const tick60 = computeTick(counters, 60_000); // 60 sec
      const id = counters[0].id;
      expect(tick60.counters[id] / tick1.counters[id]).toBeCloseTo(60, 2);
    });
  });

  describe("anchor functions", () => {
    it("getYearAnchor returns Jan 1 of current year", () => {
      const anchor = getYearAnchor(new Date("2025-06-15T12:00:00Z"));
      const anchorDate = new Date(anchor);
      expect(anchorDate.getUTCFullYear()).toBe(2025);
      expect(anchorDate.getUTCMonth()).toBe(0);
      expect(anchorDate.getUTCDate()).toBe(1);
    });

    it("getDayAnchor returns midnight UTC", () => {
      const anchor = getDayAnchor(new Date("2025-06-15T14:30:00Z"));
      const anchorDate = new Date(anchor);
      expect(anchorDate.getUTCHours()).toBe(0);
      expect(anchorDate.getUTCMinutes()).toBe(0);
    });
  });

  describe("formatTickValue", () => {
    it("formats dollar values with K/M/B/T suffixes", () => {
      expect(formatTickValue(500, "$")).toBe("$500");
      expect(formatTickValue(1500, "$")).toMatch(/K/);
      expect(formatTickValue(2e6, "$")).toMatch(/M/);
      expect(formatTickValue(3e9, "$")).toMatch(/B/);
      expect(formatTickValue(4e12, "$")).toMatch(/T/);
    });

    it("formats people values with M/B suffixes", () => {
      expect(formatTickValue(1500, "people")).toMatch(/\d/);
      expect(formatTickValue(2e6, "people")).toMatch(/M/);
      expect(formatTickValue(2e9, "people")).toMatch(/B/);
    });
  });

  describe("counterColor", () => {
    it("returns different colors for different categories", () => {
      const counters = buildCounters(mockBackbone);
      const human = counters.find((c) => c.category === "human" && c.severity === 3)!;
      const econ = counters.find((c) => c.category === "economic")!;
      expect(counterColor(human)).not.toBe(counterColor(econ));
    });
  });

  describe("generateShareText", () => {
    it("produces non-empty text with anchor label", () => {
      const counters = buildCounters(mockBackbone);
      const tick = computeTick(counters, 3600_000);
      const text = generateShareText(tick, counters, "January 1, 2025");
      expect(text).toContain("January 1, 2025");
      expect(text.length).toBeGreaterThan(20);
    });
  });
});
