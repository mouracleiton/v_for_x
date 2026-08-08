import { describe, it, expect } from "vitest";
import {
  BUDGET_ITEMS,
  calculateAllocation,
  PRESETS,
  TOTAL_FULL_COST,
  MILITARY_PER_DAY_B,
} from "../lib/allocator";

describe("allocator.ts", () => {
  describe("BUDGET_ITEMS", () => {
    it("should have 6 SDG items", () => {
      expect(BUDGET_ITEMS).toHaveLength(6);
    });

    it("should have unique IDs", () => {
      const ids = BUDGET_ITEMS.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("should have all items with positive full cost", () => {
      for (const item of BUDGET_ITEMS) {
        expect(item.fullCostB).toBeGreaterThan(0);
        expect(item.reachFullM).toBeGreaterThan(0);
      }
    });
  });

  describe("TOTAL_FULL_COST", () => {
    it("should equal sum of all item costs", () => {
      const sum = BUDGET_ITEMS.reduce((s, i) => s + i.fullCostB, 0);
      expect(TOTAL_FULL_COST).toBe(sum);
    });

    it("should be $828B (93+114+176+35+97+313)", () => {
      expect(TOTAL_FULL_COST).toBe(828);
    });
  });

  describe("calculateAllocation — empty", () => {
    const result = calculateAllocation({});

    it("should report zero allocation", () => {
      expect(result.totalAllocatedB).toBe(0);
      expect(result.totalReachM).toBe(0);
    });

    it("should report 0 fully funded", () => {
      expect(result.fullyFundedCount).toBe(0);
    });

    it("should report 6 unfunded", () => {
      expect(result.unfundedCount).toBe(6);
    });
  });

  describe("calculateAllocation — full funding", () => {
    const fullAlloc: Record<string, number> = {};
    for (const item of BUDGET_ITEMS) {
      fullAlloc[item.id] = item.fullCostB;
    }
    const result = calculateAllocation(fullAlloc);

    it("should report total allocated = $828B", () => {
      expect(result.totalAllocatedB).toBe(828);
    });

    it("should report 6 fully funded", () => {
      expect(result.fullyFundedCount).toBe(6);
    });

    it("should report 0 unfunded", () => {
      expect(result.unfundedCount).toBe(0);
    });

    it("should compute correct days of military spending", () => {
      expect(result.daysOfMilitary).toBeCloseTo(828 / MILITARY_PER_DAY_B, 1);
    });

    it("should reach combined total people", () => {
      const expectedReach = BUDGET_ITEMS.reduce((s, i) => s + i.reachFullM, 0);
      expect(result.totalReachM).toBeCloseTo(expectedReach, 0);
    });
  });

  describe("calculateAllocation — partial funding", () => {
    const result = calculateAllocation({
      sdg2_hunger: 46, // half of 93
      sdg7_energy: 35, // full
    });

    it("should report 1 fully funded (energy)", () => {
      expect(result.fullyFundedCount).toBe(1);
    });

    it("should report 1 partially funded (hunger)", () => {
      expect(result.partiallyFundedCount).toBe(1);
    });

    it("should compute partial reach for hunger", () => {
      const hunger = result.allocations.find((a) => a.item.id === "sdg2_hunger");
      // 46/93 ≈ 49.5% funded
      expect(hunger!.fundedPct).toBeCloseTo(49.5, 0);
      expect(hunger!.reachM).toBeCloseTo(667 * 46 / 93, 0);
    });

    it("should report correct total allocated", () => {
      expect(result.totalAllocatedB).toBe(46 + 35);
    });
  });

  describe("PRESETS", () => {
    it("should have at least 4 presets", () => {
      expect(PRESETS.length).toBeGreaterThanOrEqual(4);
    });

    it("Quick Wins preset should include all 6 SDG items", () => {
      const qw = PRESETS.find((p) => p.label.includes("QUICK WINS"));
      expect(qw).toBeDefined();
      // Quick Wins includes water+health+energy+education+hunger
      expect(qw!.allocations.sdg2_hunger).toBe(93);
      expect(qw!.allocations.sdg7_energy).toBe(35);
      expect(qw!.allocations.sdg10_inequality).toBe(0);
    });

    it("each preset should have all 6 budget items as keys", () => {
      for (const preset of PRESETS) {
        for (const item of BUDGET_ITEMS) {
          expect(preset.allocations).toHaveProperty(item.id);
        }
      }
    });
  });
});
