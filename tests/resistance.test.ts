import { describe, it, expect } from "vitest";
import {
  computeStrength,
  extractConditions,
  computeRipeness,
  getRipeCountries,
  createMovement,
  computeStats,
  HISTORICAL_MOVEMENTS,
  RESISTANCE_TACTICS,
  strengthLabel,
  strengthColor,
} from "../lib/resistance";
import backbone from "../data/world_backbone.json";
import type { WorldBackbone } from "../lib/types";

const data = backbone as WorldBackbone;

describe("resistance.ts", () => {
  describe("computeStrength", () => {
    it("should score high for mass movements with diverse tactics", () => {
      const score = computeStrength({
        participationPct: 4, // above Chenoweth threshold
        demands: ["End corruption", "Free elections", "Release prisoners"],
        tactics: ["General Strike", "Mass Protest", "Civil Disobedience"],
        status: "active",
        conditions: {
          democracyIndex: 0.2,
          corruptionIndex: 20,
          conflictIntensity: 3,
          unemployment: 30,
          hungerPrevalence: 40,
          riskScore: 70,
        },
      });
      expect(score).toBeGreaterThan(70);
    });

    it("should score low for marginal movements", () => {
      const score = computeStrength({
        participationPct: 0.1,
        demands: ["Single demand"],
        tactics: ["Petition"],
        status: "emerging",
        conditions: {
          democracyIndex: 0.8,
          corruptionIndex: 70,
          conflictIntensity: 1,
          unemployment: 5,
          hungerPrevalence: 5,
          riskScore: 20,
        },
      });
      expect(score).toBeLessThan(30);
    });
  });

  describe("extractConditions", () => {
    it("should extract conditions from a country", () => {
      const country = data.countries.find((c) => c.iso3 === "SDN");
      if (!country) return;
      const conditions = extractConditions(country);
      expect(conditions.conflictIntensity).toBeGreaterThanOrEqual(0);
      expect(conditions.riskScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe("computeRipeness", () => {
    it("should compute a ripeness score", () => {
      const country = data.countries.find((c) => c.iso3 === "SDN");
      if (!country) return;
      const result = computeRipeness(country);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.topDriver).toBeDefined();
    });
  });

  describe("getRipeCountries", () => {
    it("should return ranked countries", () => {
      const ripe = getRipeCountries(data, 10);
      expect(ripe).toHaveLength(10);
      // Sorted descending
      for (let i = 1; i < ripe.length; i++) {
        expect(ripe[i].ripeScore).toBeLessThanOrEqual(ripe[i - 1].ripeScore);
      }
    });
  });

  describe("createMovement", () => {
    it("should create a movement with computed strength", () => {
      const country = data.countries.find((c) => c.iso3 === "SDN");
      if (!country) return;
      const m = createMovement(
        "anti_regime",
        "Sudan Uprising",
        country,
        "active",
        1_000_000,
        "2024-01-01",
        ["End military rule", "Transition to democracy"],
        ["Mass protests", "Civil disobedience", "General strike"],
      );
      expect(m.id).toBeDefined();
      expect(m.strength).toBeGreaterThan(0);
      expect(m.participationPct).toBeGreaterThan(0);
    });
  });

  describe("computeStats", () => {
    it("should compute correct stats", () => {
      const country = data.countries.find((c) => c.iso3 === "SDN");
      if (!country) return;
      const movements = [
        createMovement("anti_regime", "M1", country, "active", 100_000, "2024", ["D1"], ["T1"]),
        createMovement("labor_strike", "M2", country, "suppressed", 50_000, "2024", ["D2"], ["T2"]),
      ];
      const stats = computeStats(movements, data);
      expect(stats.totalMovements).toBe(2);
      expect(stats.active).toBe(1);
      expect(stats.suppressed).toBe(1);
      expect(stats.totalParticipants).toBe(150_000);
    });
  });

  describe("HISTORICAL_MOVEMENTS", () => {
    it("should have at least 10 historical references", () => {
      expect(HISTORICAL_MOVEMENTS.length).toBeGreaterThanOrEqual(10);
    });

    it("should include successful and failed movements", () => {
      const outcomes = new Set(HISTORICAL_MOVEMENTS.map((m) => m.outcome));
      expect(outcomes.has("success")).toBe(true);
      expect(outcomes.has("failure")).toBe(true);
    });

    it("should include lessons for all movements", () => {
      for (const m of HISTORICAL_MOVEMENTS) {
        expect(m.lesson).toBeDefined();
        expect(m.lesson!.length).toBeGreaterThan(10);
      }
    });
  });

  describe("RESISTANCE_TACTICS", () => {
    it("should have at least 10 tactics", () => {
      expect(RESISTANCE_TACTICS.length).toBeGreaterThanOrEqual(10);
    });

    it("should cover all three categories", () => {
      const cats = new Set(RESISTANCE_TACTICS.map((t) => t.category));
      expect(cats.has("protest")).toBe(true);
      expect(cats.has("noncooperation")).toBe(true);
      expect(cats.has("intervention")).toBe(true);
    });

    it("should have general strike as the most effective", () => {
      const sorted = [...RESISTANCE_TACTICS].sort((a, b) => b.effectiveness - a.effectiveness);
      expect(sorted[0].name).toContain("General Strike");
    });
  });

  describe("strength helpers", () => {
    it("should return labels", () => {
      expect(strengthLabel(85)).toBe("Mass Movement");
      expect(strengthLabel(65)).toBe("Strong");
      expect(strengthLabel(45)).toBe("Significant");
      expect(strengthLabel(25)).toBe("Developing");
      expect(strengthLabel(10)).toBe("Marginal");
    });

    it("should return colors", () => {
      expect(strengthColor(85)).toBeDefined();
      expect(strengthColor(45)).toBeDefined();
    });
  });
});
