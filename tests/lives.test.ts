import { describe, it, expect } from "vitest";
import backbone from "../data/world_backbone.json";
import type { WorldBackbone } from "../lib/types";
import {
  computeGlobalToll,
  computeRealTimeToll,
  computeCountryToll,
  formatNumber,
  formatTollSentence,
  createMemorialEntry,
} from "../lib/lives";

const data = backbone as WorldBackbone;

describe("lives.ts", () => {
  describe("computeGlobalToll", () => {
    it("should compute toll breakdown for major causes", () => {
      const toll = computeGlobalToll(data);
      expect(toll.length).toBeGreaterThanOrEqual(4);
      expect(toll.some((t) => t.causeKey === "hunger")).toBe(true);
      expect(toll.some((t) => t.causeKey === "conflict")).toBe(true);
      expect(toll.some((t) => t.causeKey === "disease")).toBe(true);
    });

    it("should have positive death counts", () => {
      const toll = computeGlobalToll(data);
      for (const t of toll) {
        expect(t.annualDeaths).toBeGreaterThan(0);
        expect(t.perDay).toBeGreaterThan(0);
        expect(t.perHour).toBeGreaterThan(0);
      }
    });

    it("should compute per-second rates", () => {
      const toll = computeGlobalToll(data);
      for (const t of toll) {
        expect(t.perSecond).toBeGreaterThan(0);
      }
    });

    it("should include prevention cost for hunger", () => {
      const toll = computeGlobalToll(data);
      const hunger = toll.find((t) => t.causeKey === "hunger");
      expect(hunger?.preventionCostBillion).toBeDefined();
      expect(hunger?.preventionNote).toBeDefined();
    });
  });

  describe("computeRealTimeToll", () => {
    it("should compute deaths since visit start", () => {
      const toll = computeGlobalToll(data);
      const startedAt = Date.now() - 60_000; // 1 minute ago
      const result = computeRealTimeToll(toll, startedAt);
      expect(result.sinceVisit).toBeGreaterThan(0);
      expect(result.perSecond).toBeGreaterThan(0);
      expect(result.causes.length).toBe(toll.length);
    });

    it("should compute deaths today", () => {
      const toll = computeGlobalToll(data);
      const startedAt = Date.now() - 3_600_000;
      const result = computeRealTimeToll(toll, startedAt);
      expect(result.today).toBeGreaterThan(0);
    });
  });

  describe("computeCountryToll", () => {
    it("should compute toll for a specific country", () => {
      const country = data.countries.find((c) => c.iso3 === "SDN");
      if (!country) return; // skip if not found
      const toll = computeCountryToll(country);
      expect(toll.total).toBeGreaterThanOrEqual(0);
      expect(toll.childDeaths).toBeGreaterThanOrEqual(0);
    });
  });

  describe("formatNumber", () => {
    it("should format large numbers", () => {
      expect(formatNumber(9_000_000)).toBe("9.0M");
      expect(formatNumber(1_500)).toBe("1.5K");
      expect(formatNumber(42)).toBe("42");
    });
  });

  describe("formatTollSentence", () => {
    it("should produce a readable sentence", () => {
      const toll = computeGlobalToll(data);
      const hunger = toll.find((t) => t.causeKey === "hunger")!;
      const sentence = formatTollSentence(hunger);
      expect(sentence).toContain("die");
      expect(sentence).toContain("Hunger");
    });
  });

  describe("createMemorialEntry", () => {
    it("should create a memorial with id", () => {
      const entry = createMemorialEntry("Unknown Child", "hunger", "SDN", 2024, "Gone too soon.");
      expect(entry.id).toBeDefined();
      expect(entry.name).toBe("Unknown Child");
    });
  });
});
