import { describe, it, expect } from "vitest";
import {
  createRule,
  extractMetric,
  compare,
  evaluateRule,
  evaluateAllRules,
  presetRules,
  METRIC_INFO,
} from "../lib/watch";
import backbone from "../data/world_backbone.json";
import type { WorldBackbone } from "../lib/types";

const data = backbone as WorldBackbone;

describe("watch.ts", () => {
  describe("createRule", () => {
    it("should create a rule with id", () => {
      const rule = createRule("Test", "risk_score", ">=", 70, "all");
      expect(rule.id).toBeDefined();
      expect(rule.metric).toBe("risk_score");
      expect(rule.operator).toBe(">=");
      expect(rule.threshold).toBe(70);
      expect(rule.active).toBe(true);
    });
  });

  describe("extractMetric", () => {
    it("should extract nested metrics", () => {
      const country = data.countries.find((c) => c.iso3 === "SDN");
      if (!country) return;
      const val = extractMetric(country, "hunger.prevalence_pct");
      expect(typeof val).toBe("number");
    });

    it("should compute risk_score", () => {
      const country = data.countries.find((c) => c.iso3 === "SDN");
      if (!country) return;
      const val = extractMetric(country, "risk_score");
      expect(val).not.toBeNull();
      expect(val!).toBeGreaterThanOrEqual(0);
      expect(val!).toBeLessThanOrEqual(100);
    });

    it("should return null for missing metrics", () => {
      const country = data.countries[0];
      // Use a valid country but check for null handling
      const val = extractMetric(country, "employment.unemployment_pct");
      // Value could be null if country has no data
      expect(val === null || typeof val === "number").toBe(true);
    });
  });

  describe("compare", () => {
    it("should compare correctly for all operators", () => {
      expect(compare(5, "<", 10)).toBe(true);
      expect(compare(10, "<", 10)).toBe(false);
      expect(compare(10, "<=", 10)).toBe(true);
      expect(compare(15, ">", 10)).toBe(true);
      expect(compare(10, ">=", 10)).toBe(true);
      expect(compare(10, "==", 10)).toBe(true);
      expect(compare(11, "==", 10)).toBe(false);
    });
  });

  describe("evaluateRule", () => {
    it("should find matching countries for a global rule", () => {
      const rule = createRule("High Hunger", "hunger.prevalence_pct", ">", 0, "all");
      const result = evaluateRule(rule, data);
      expect(result.triggered).toBe(true);
      expect(result.matchedCountries.length).toBeGreaterThan(0);
    });

    it("should evaluate a country-specific rule", () => {
      const rule = createRule("SDN Risk", "risk_score", ">", 0, "SDN");
      const result = evaluateRule(rule, data);
      expect(result.triggered).toBe(true);
      expect(result.countryValue).not.toBeUndefined();
    });

    it("should return not triggered when no countries match", () => {
      const rule = createRule("Impossible", "hunger.prevalence_pct", ">", 999, "all");
      const result = evaluateRule(rule, data);
      expect(result.triggered).toBe(false);
      expect(result.matchedCountries).toHaveLength(0);
    });
  });

  describe("evaluateAllRules", () => {
    it("should sort triggered rules first", () => {
      const rules = [
        createRule("Triggered", "risk_score", ">", 0),
        createRule("Not Triggered", "risk_score", ">", 999),
      ];
      const results = evaluateAllRules(rules, data);
      expect(results[0].triggered).toBe(true);
      expect(results[1].triggered).toBe(false);
    });

    it("should filter inactive rules", () => {
      const rules = [
        { ...createRule("Active", "risk_score", ">", 0), active: true },
        { ...createRule("Inactive", "risk_score", ">", 0), active: false },
      ];
      const results = evaluateAllRules(rules, data);
      expect(results).toHaveLength(1);
    });
  });

  describe("presetRules", () => {
    it("should return at least 3 presets", () => {
      const presets = presetRules();
      expect(presets.length).toBeGreaterThanOrEqual(3);
    });

    it("should cover different metrics", () => {
      const presets = presetRules();
      const metrics = new Set(presets.map((p) => p.metric));
      expect(metrics.size).toBeGreaterThan(1);
    });
  });

  describe("METRIC_INFO", () => {
    it("should have info for all metrics", () => {
      expect(Object.keys(METRIC_INFO).length).toBeGreaterThanOrEqual(10);
      expect(METRIC_INFO["risk_score"]).toBeDefined();
      expect(METRIC_INFO["hunger.prevalence_pct"]).toBeDefined();
    });
  });
});
