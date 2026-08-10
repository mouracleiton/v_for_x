import { describe, it, expect } from "vitest";
import backbone from "../data/world_backbone.json";
import type { WorldBackbone } from "../lib/types";
import {
  createTriggerRule,
  evaluateCondition,
  evaluateTrigger,
  evaluateAllTriggers,
  presetTriggerRules,
  formatCondition,
  formatRule,
} from "../lib/trigger-engine";
import { calculateRiskScore } from "../lib/risk-model";

const data = backbone as WorldBackbone;

describe("createTriggerRule", () => {
  it("creates a rule with conditions and actions", () => {
    const rule = createTriggerRule("Test", [
      { metric: "risk_score", operator: ">=", value: 70 },
    ]);
    expect(rule.name).toBe("Test");
    expect(rule.conditions).toHaveLength(1);
    expect(rule.actions).toEqual(["notify"]);
    expect(rule.active).toBe(true);
    expect(rule.fireCount).toBe(0);
  });
});

describe("evaluateCondition", () => {
  it("evaluates a simple threshold condition", () => {
    const country = data.countries[0];
    const riskScore = calculateRiskScore(country).score;
    const cond = { metric: "risk_score" as const, operator: ">=" as const, value: Math.floor(riskScore) };
    expect(evaluateCondition(country, cond)).toBe(true);
  });

  it("returns false for unmet conditions", () => {
    const country = data.countries[0];
    const cond = { metric: "risk_score" as const, operator: ">=" as const, value: 999 };
    expect(evaluateCondition(country, cond)).toBe(false);
  });

  it("respects iso3 scope", () => {
    const country = data.countries[0];
    const cond = {
      metric: "risk_score" as const,
      operator: ">=" as const,
      value: 0,
      iso3: "ZZZ",
    };
    expect(evaluateCondition(country, cond)).toBe(false);
  });
});

describe("evaluateTrigger", () => {
  it("fires when conditions are met", () => {
    const rule = createTriggerRule("All countries", [
      { metric: "risk_score", operator: ">=", value: 0 },
    ]);
    const fired = evaluateTrigger(rule, data);
    expect(fired).not.toBeNull();
    expect(fired!.matchedCountries.length).toBeGreaterThan(0);
  });

  it("returns null when no countries match", () => {
    const rule = createTriggerRule("Impossible", [
      { metric: "risk_score", operator: ">=", value: 999 },
    ]);
    expect(evaluateTrigger(rule, data)).toBeNull();
  });

  it("returns null for inactive rules", () => {
    const rule = createTriggerRule("Inactive", [
      { metric: "risk_score", operator: ">=", value: 0 },
    ]);
    rule.active = false;
    expect(evaluateTrigger(rule, data)).toBeNull();
  });

  it("supports AND logic for multiple conditions", () => {
    const rule = createTriggerRule("Compound", [
      { metric: "risk_score", operator: ">=", value: 50 },
      { metric: "hunger.prevalence_pct", operator: ">=", value: 20 },
    ]);
    const fired = evaluateTrigger(rule, data);
    if (fired) {
      // Every matched country should satisfy both conditions
      for (const m of fired.matchedCountries) {
        expect(m.values["risk_score"]).toBeGreaterThanOrEqual(50);
        expect(m.values["hunger.prevalence_pct"]).toBeGreaterThanOrEqual(20);
      }
    }
  });
});

describe("evaluateAllTriggers", () => {
  it("evaluates all active rules", () => {
    const rules = presetTriggerRules();
    const fired = evaluateAllTriggers(rules, data);
    expect(Array.isArray(fired)).toBe(true);
  });
});

describe("presetTriggerRules", () => {
  it("returns a set of preset rules", () => {
    const rules = presetTriggerRules();
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) {
      expect(r.conditions.length).toBeGreaterThan(0);
      expect(r.actions.length).toBeGreaterThan(0);
    }
  });
});

describe("formatCondition / formatRule", () => {
  it("formats a condition", () => {
    const cond = { metric: "risk_score" as const, operator: ">=" as const, value: 70, label: "Risk" };
    expect(formatCondition(cond)).toBe("Risk >= 70");
  });

  it("formats a full rule", () => {
    const rule = createTriggerRule("Alert", [
      { metric: "risk_score" as const, operator: ">=" as const, value: 70 },
    ]);
    const formatted = formatRule(rule);
    expect(formatted).toContain("Alert");
    expect(formatted).toContain("risk_score");
    expect(formatted).toContain("70");
  });
});
