import { describe, it, expect } from "vitest";
import {
  SHOCK_PRESETS,
  simulateDomino,
  severityColor,
  severityLabel,
  DIMENSION_LABELS,
} from "../lib/domino";
import type { WorldBackbone } from "../lib/types";

const mockBackbone = {
  countries: [
    { iso3: "SOM", name_en: "Somalia", region: "Africa", subregion: "Eastern Africa", population_m: 17, iso2: "SO", hunger: { undernourishment_pct: 50, famine_risk_1to5: 4 }, conflict: { intensity_1to5: 4 }, governance: { electoral_democracy_index: 0.1 }, poverty: { headcount_365_pct: 70 } },
    { iso3: "ETH", name_en: "Ethiopia", region: "Africa", subregion: "Eastern Africa", population_m: 120, iso2: "ET", hunger: { undernourishment_pct: 20, famine_risk_1to5: 3 }, conflict: { intensity_1to5: 2 }, governance: { electoral_democracy_index: 0.2 }, poverty: { headcount_365_pct: 30 } },
    { iso3: "KEN", name_en: "Kenya", region: "Africa", subregion: "Eastern Africa", population_m: 54, iso2: "KE", hunger: { undernourishment_pct: 25, famine_risk_1to5: 2 }, conflict: { intensity_1to5: 1 }, governance: { electoral_democracy_index: 0.4 }, poverty: { headcount_365_pct: 35 } },
    { iso3: "USA", name_en: "United States", region: "Americas", subregion: "Northern America", population_m: 333, iso2: "US", hunger: { undernourishment_pct: 2, famine_risk_1to5: 1 }, conflict: { intensity_1to5: 0 }, governance: { electoral_democracy_index: 0.8 }, poverty: { headcount_365_pct: 1 } },
  ],
  metadata: { schema_version: "1", title: "", description: "", created: "", standard: "", sources: [], total_countries: 4, license: "", data_layers: [], last_updated: "" },
} as unknown as WorldBackbone;

describe("domino", () => {
  describe("SHOCK_PRESETS", () => {
    it("has at least 5 presets", () => {
      expect(SHOCK_PRESETS.length).toBeGreaterThanOrEqual(5);
    });

    it("each preset has valid fields", () => {
      for (const p of SHOCK_PRESETS) {
        expect(p.id).toBeTruthy();
        expect(p.label).toBeTruthy();
        expect(p.epicenterIso3).toHaveLength(3);
        expect(p.initialSeverity).toBeGreaterThan(0);
        expect(p.initialSeverity).toBeLessThanOrEqual(1);
        expect(p.primaryDimension).toBeTruthy();
      }
    });
  });

  describe("simulateDomino", () => {
    it("returns epicenter as step 0", () => {
      const preset = SHOCK_PRESETS[0]; // Horn of Africa / SOM
      const result = simulateDomino(mockBackbone, preset);
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.steps[0].iso3).toBe("SOM");
      expect(result.steps[0].step).toBe(0);
      expect(result.steps[0].severity).toBe(preset.initialSeverity);
    });

    it("propagates to nearby countries in the same subregion", () => {
      const preset = SHOCK_PRESETS[0]; // SOM epicenter
      const result = simulateDomino(mockBackbone, preset);
      const iso3s = result.steps.map((s) => s.iso3);
      // Should affect at least one neighbor (ETH or KEN)
      expect(iso3s).toContain("SOM");
      const affectedNeighbors = iso3s.filter((i) => ["ETH", "KEN"].includes(i));
      expect(affectedNeighbors.length).toBeGreaterThan(0);
    });

    it("countries affected is at least 1", () => {
      const result = simulateDomino(mockBackbone, SHOCK_PRESETS[0]);
      expect(result.countriesAffected).toBeGreaterThanOrEqual(1);
    });

    it("population affected is positive", () => {
      const result = simulateDomino(mockBackbone, SHOCK_PRESETS[0]);
      expect(result.populationAffectedM).toBeGreaterThan(0);
    });

    it("summary is non-empty", () => {
      const result = simulateDomino(mockBackbone, SHOCK_PRESETS[0]);
      expect(result.summary.length).toBeGreaterThan(20);
      expect(result.summary).toContain("countries");
    });

    it("pathway chains grow with steps", () => {
      const result = simulateDomino(mockBackbone, SHOCK_PRESETS[0]);
      const epicenter = result.steps[0];
      const laterSteps = result.steps.filter((s) => s.step > 0);
      if (laterSteps.length > 0) {
        expect(laterSteps[0].pathway.length).toBeGreaterThan(epicenter.pathway.length);
      }
    });

    it("handles unknown epicenter gracefully", () => {
      const result = simulateDomino(mockBackbone, {
        id: "test",
        label: "Test",
        description: "test",
        epicenterIso3: "ZZZ",
        primaryDimension: "hunger",
        initialSeverity: 0.9,
        icon: "💥",
      });
      expect(result.steps).toHaveLength(0);
      expect(result.countriesAffected).toBe(0);
    });
  });

  describe("severity helpers", () => {
    it("severityColor returns CSS variable strings", () => {
      expect(severityColor(0.9)).toContain("var(--");
      expect(severityColor(0.5)).toContain("var(--");
      expect(severityColor(0.1)).toContain("var(--");
    });

    it("severityLabel returns appropriate labels", () => {
      expect(severityLabel(0.9)).toBe("CATASTROPHIC");
      expect(severityLabel(0.5)).toBe("SEVERE");
      expect(severityLabel(0.3)).toBe("MODERATE");
      expect(severityLabel(0.1)).toBe("MINOR");
    });
  });

  describe("DIMENSION_LABELS", () => {
    it("has labels for all dimensions", () => {
      const keys = Object.keys(DIMENSION_LABELS);
      expect(keys.length).toBeGreaterThanOrEqual(8);
      for (const v of Object.values(DIMENSION_LABELS)) {
        expect(v).toBeTruthy();
      }
    });
  });
});
