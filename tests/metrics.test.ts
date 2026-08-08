import { describe, it, expect } from "vitest";
import {
  resolveMetric,
  evaluateRule,
  METRIC_CATALOG,
  METRIC_BY_PATH,
  getMetricDef,
  formatMetricValue,
} from "../lib/metrics";
import type { CountryData } from "../lib/types";

/**
 * Mock country record — only fields exercised by these tests are populated;
 * the rest are omitted and cast through `unknown` to satisfy the type.
 */
const mockCountry = {
  // top-level fields
  is_un_member: true,
  is_hotspot: false,
  // two-level nested numeric values
  health: {
    doctors_per_1000: 0.5,
    life_expectancy: 72,
    child_mortality_under5_per1k: 30,
    infant_mortality_per1k: null, // null value
  },
  hunger: {
    undernourishment_pct: 25,
    famine_risk_1to5: 4,
    ipc_phase5: false, // boolean value
  },
  economy: {
    gdp_per_capita_usd: 1500,
  },
} as unknown as CountryData;

describe("metrics.ts", () => {
  describe("resolveMetric", () => {
    it("resolves a valid two-level path", () => {
      expect(resolveMetric(mockCountry, "health.doctors_per_1000")).toBe(0.5);
    });

    it("resolves a valid nested path under a different domain", () => {
      expect(resolveMetric(mockCountry, "hunger.undernourishment_pct")).toBe(25);
    });

    it("resolves a top-level (single-segment) path", () => {
      // is_un_member is boolean true → coerced to 1
      expect(resolveMetric(mockCountry, "is_un_member")).toBe(1);
    });

    it("returns null for a missing top-level path", () => {
      expect(resolveMetric(mockCountry, "nonexistent")).toBeNull();
    });

    it("returns null for a missing nested property", () => {
      expect(resolveMetric(mockCountry, "health.bedside_manner")).toBeNull();
    });

    it("returns null when an intermediate segment is missing", () => {
      expect(resolveMetric(mockCountry, "nope.not_there")).toBeNull();
    });

    it("returns null for a null value", () => {
      expect(resolveMetric(mockCountry, "health.infant_mortality_per1k")).toBeNull();
    });

    it("coerces boolean true to 1", () => {
      expect(resolveMetric(mockCountry, "is_un_member")).toBe(1);
    });

    it("coerces boolean false to 0", () => {
      expect(resolveMetric(mockCountry, "is_hotspot")).toBe(0);
      expect(resolveMetric(mockCountry, "hunger.ipc_phase5")).toBe(0);
    });
  });

  describe("evaluateRule", () => {
    // health.doctors_per_1000 = 0.5
    it("returns true when value < threshold", () => {
      expect(evaluateRule(mockCountry, "health.doctors_per_1000", "<", 1)).toBe(true);
    });

    it("returns false when value is not < threshold", () => {
      expect(evaluateRule(mockCountry, "health.doctors_per_1000", "<", 0.5)).toBe(false);
    });

    // hunger.undernourishment_pct = 25
    it("returns true when value <= threshold (equal)", () => {
      expect(evaluateRule(mockCountry, "hunger.undernourishment_pct", "<=", 25)).toBe(true);
    });

    it("returns true when value > threshold", () => {
      expect(evaluateRule(mockCountry, "hunger.undernourishment_pct", ">", 20)).toBe(true);
    });

    it("returns false when value is not > threshold", () => {
      expect(evaluateRule(mockCountry, "hunger.undernourishment_pct", ">", 25)).toBe(false);
    });

    it("returns true when value >= threshold (equal)", () => {
      expect(evaluateRule(mockCountry, "hunger.undernourishment_pct", ">=", 25)).toBe(true);
    });

    it("returns false when value is not >= threshold", () => {
      expect(evaluateRule(mockCountry, "hunger.undernourishment_pct", ">=", 30)).toBe(false);
    });

    it("returns false when the metric resolves to null", () => {
      expect(evaluateRule(mockCountry, "health.infant_mortality_per1k", "<", 100)).toBe(false);
    });
  });

  describe("METRIC_CATALOG", () => {
    it("has entries", () => {
      expect(METRIC_CATALOG.length).toBeGreaterThan(0);
    });

    it("all entries have the required fields (path, label, domain)", () => {
      for (const m of METRIC_CATALOG) {
        expect(m.path).toBeTruthy();
        expect(m.label).toBeTruthy();
        expect(m.domain).toBeTruthy();
      }
    });

    it("all paths are unique", () => {
      const paths = METRIC_CATALOG.map((m) => m.path);
      expect(new Set(paths).size).toBe(paths.length);
    });
  });

  describe("METRIC_BY_PATH", () => {
    it("keys match METRIC_CATALOG paths", () => {
      const catalogPaths = METRIC_CATALOG.map((m) => m.path);
      const byPathKeys = Object.keys(METRIC_BY_PATH);
      expect(byPathKeys).toEqual(catalogPaths);
    });

    it("returns the same def as the catalog for a known path", () => {
      const def = METRIC_BY_PATH["health.doctors_per_1000"];
      expect(def).toBeDefined();
      expect(def.label).toBe("Doctors per 1000");
    });
  });

  describe("getMetricDef", () => {
    it("returns the def for a known path", () => {
      const def = getMetricDef("health.doctors_per_1000");
      expect(def.label).toBe("Doctors per 1000");
      expect(def.unit).toBe("/1000");
    });

    it("returns a fallback def for an unknown path", () => {
      const def = getMetricDef("made.up.path");
      expect(def.path).toBe("made.up.path");
      expect(def.label).toBe("made.up.path");
      expect(def.domain).toBe("hunger");
    });
  });

  describe("formatMetricValue", () => {
    it("returns 'N/A' for null", () => {
      expect(formatMetricValue(null)).toBe("N/A");
    });

    // The implementation uses `toLocaleString(undefined, …)` so the exact
    // glyphs (comma vs dot) depend on the runtime's default locale. Assert
    // against the same formatting logic to keep the tests locale-independent.
    const smallFmt = (n: number) =>
      n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    const largeFmt = (n: number) =>
      n.toLocaleString(undefined, { maximumFractionDigits: 0 });

    it("formats small numbers with up to 2 fraction digits", () => {
      expect(formatMetricValue(0.5)).toBe(smallFmt(0.5));
      expect(formatMetricValue(25)).toBe(smallFmt(25));
    });

    it("formats large numbers (>= 1000) with locale grouping and no decimals", () => {
      expect(formatMetricValue(1500)).toBe(largeFmt(1500));
      expect(formatMetricValue(100000)).toBe(largeFmt(100000));
    });

    it("appends the unit when provided", () => {
      expect(formatMetricValue(25, "%")).toBe(`${smallFmt(25)}%`);
      expect(formatMetricValue(0.5, "/1000")).toBe(`${smallFmt(0.5)}/1000`);
      expect(formatMetricValue(1500, "$")).toBe(`${largeFmt(1500)}$`);
    });

    it("does not append a unit when undefined", () => {
      expect(formatMetricValue(45)).toBe(smallFmt(45));
    });
  });
});
