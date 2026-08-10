import { describe, it, expect } from "vitest";
import {
  THRESHOLDS,
  analyzeTippingPoints,
  dimensionBreakdown,
  alertColor,
  alertIcon,
  alertLabel,
  type AlertLevel,
} from "../lib/tipping-point";
import type { WorldBackbone } from "../lib/types";

const mockBackbone = {
  countries: [
    { iso3: "NOR", name_en: "Norway", region: "Europe", subregion: "Northern Europe", population_m: 5, hunger: { famine_risk_1to5: 1, prevalence_pct: 2, undernourishment_pct: 2.5 }, conflict: { intensity_1to5: 0, displacement_m: 0 }, health: { child_mortality_under5_per1k: 3, doctors_per_1000: 4.5 }, poverty: { headcount_365_pct: 0.5 }, governance: { electoral_democracy_index: 0.9 }, water_sanitation: { basic_access_pct: 100 }, education: { literacy_rate_pct: 99 }, security: { homicide_rate_per100k: 0.5 }, environment: { air_pollution_pm25_ugm3: 8 } },
    { iso3: "YEM", name_en: "Yemen", region: "Asia", subregion: "Western Asia", population_m: 34, hunger: { famine_risk_1to5: 5, prevalence_pct: 50, undernourishment_pct: 45 }, conflict: { intensity_1to5: 4, displacement_m: 4 }, health: { child_mortality_under5_per1k: 60, doctors_per_1000: 0.3 }, poverty: { headcount_365_pct: 65 }, governance: { electoral_democracy_index: 0.15 }, water_sanitation: { basic_access_pct: 55 }, education: { literacy_rate_pct: 70 }, security: { homicide_rate_per100k: 10 }, environment: { air_pollution_pm25_ugm3: 50 } },
    { iso3: "SOM", name_en: "Somalia", region: "Africa", subregion: "Eastern Africa", population_m: 17, hunger: { famine_risk_1to5: 4, prevalence_pct: 45, undernourishment_pct: 50 }, conflict: { intensity_1to5: 3, displacement_m: 3 }, health: { child_mortality_under5_per1k: 90, doctors_per_1000: 0.2 }, poverty: { headcount_365_pct: 70 }, governance: { electoral_democracy_index: 0.1 }, water_sanitation: { basic_access_pct: 50 }, education: { literacy_rate_pct: 40 }, security: { homicide_rate_per100k: 15 }, environment: { air_pollution_pm25_ugm3: 60 } },
    { iso3: "USA", name_en: "United States", region: "Americas", subregion: "Northern America", population_m: 333, hunger: { famine_risk_1to5: 1, prevalence_pct: 5, undernourishment_pct: 3 }, conflict: { intensity_1to5: 0, displacement_m: 0 }, health: { child_mortality_under5_per1k: 7, doctors_per_1000: 2.6 }, poverty: { headcount_365_pct: 1 }, governance: { electoral_democracy_index: 0.75 }, water_sanitation: { basic_access_pct: 99 }, education: { literacy_rate_pct: 99 }, security: { homicide_rate_per100k: 7 }, environment: { air_pollution_pm25_ugm3: 9 } },
  ],
  metadata: { schema_version: "1", title: "", description: "", created: "", standard: "", sources: [], total_countries: 4, license: "", data_layers: [], last_updated: "" },
} as unknown as WorldBackbone;

describe("tipping-point", () => {
  describe("THRESHOLDS", () => {
    it("has at least 10 thresholds", () => {
      expect(THRESHOLDS.length).toBeGreaterThanOrEqual(10);
    });

    it("each threshold has valid fields", () => {
      for (const t of THRESHOLDS) {
        expect(t.id).toBeTruthy();
        expect(t.label).toBeTruthy();
        expect(t.criticalValue).toBeGreaterThan(0);
        expect(["above", "below"]).toContain(t.direction);
        expect(typeof t.extract).toBe("function");
        expect(t.consequence).toBeTruthy();
      }
    });
  });

  describe("analyzeTippingPoints", () => {
    it("analyzes all countries", () => {
      const result = analyzeTippingPoints(mockBackbone);
      expect(result.countries.length).toBe(4);
    });

    it("sorts by proximity score descending", () => {
      const result = analyzeTippingPoints(mockBackbone);
      for (let i = 1; i < result.countries.length; i++) {
        expect(result.countries[i - 1].proximityScore).toBeGreaterThanOrEqual(
          result.countries[i].proximityScore,
        );
      }
    });

    it("flags crisis countries as critical", () => {
      const result = analyzeTippingPoints(mockBackbone);
      // Yemen and Somalia should be critical
      const yemen = result.countries.find((c) => c.iso3 === "YEM");
      expect(yemen?.alertLevel).toBe("critical");
      // SOM crosses multiple thresholds
      const criticalIsos = result.critical.map((c) => c.iso3);
      expect(criticalIsos).toContain("SOM");
    });

    it("stable countries have low proximity", () => {
      const result = analyzeTippingPoints(mockBackbone);
      const norway = result.countries.find((c) => c.iso3 === "NOR");
      expect(norway!.proximityScore).toBeLessThan(50);
    });

    it("counts thresholds breached", () => {
      const result = analyzeTippingPoints(mockBackbone);
      expect(result.thresholdsBreached).toBeGreaterThan(0);
    });

    it("population at risk includes crisis countries", () => {
      const result = analyzeTippingPoints(mockBackbone);
      // Yemen (34M) + Somalia (17M) = 51M at minimum
      expect(result.populationAtRiskM).toBeGreaterThanOrEqual(50);
    });

    it("each country has threshold assessments", () => {
      const result = analyzeTippingPoints(mockBackbone);
      for (const c of result.countries) {
        expect(c.thresholds).toBeDefined();
        if (c.thresholds.length > 0) {
          expect(c.mostDangerous).not.toBeNull();
        }
      }
    });
  });

  describe("dimensionBreakdown", () => {
    it("produces per-dimension counts", () => {
      const result = analyzeTippingPoints(mockBackbone);
      const breakdown = dimensionBreakdown(result.countries);
      expect(breakdown.length).toBeGreaterThan(0);
      const totalCritical = breakdown.reduce((s, d) => s + d.critical, 0);
      expect(totalCritical).toBeGreaterThan(0);
    });
  });

  describe("alert helpers", () => {
    it("alertColor returns CSS variables for each level", () => {
      const levels: AlertLevel[] = ["critical", "severe", "warning", "watch", "stable"];
      for (const l of levels) {
        expect(alertColor(l)).toContain("var(--");
      }
    });

    it("alertIcon returns emoji for each level", () => {
      expect(alertIcon("critical")).toBeTruthy();
      expect(alertIcon("stable")).toBeTruthy();
    });

    it("alertLabel returns uppercase label", () => {
      expect(alertLabel("critical")).toBe("CRITICAL");
      expect(alertLabel("stable")).toBe("STABLE");
    });
  });
});
