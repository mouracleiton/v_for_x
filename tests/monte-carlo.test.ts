import { describe, it, expect } from "vitest";
import backbone from "../data/world_backbone.json";
import type { WorldBackbone } from "../lib/types";
import { runMonteCarlo, formatMonteCarloReport } from "../lib/monte-carlo";
import type { ScenarioConfig } from "../lib/scenario-engine";

const data = backbone as WorldBackbone;

const testConfig: ScenarioConfig = {
  militaryReduction: 50,
  healthIncrease: 30,
  educationBoost: 20,
  foodAidAmount: 5,
  conflictResolution: false,
  climateActionPct: 10,
};

describe("runMonteCarlo", () => {
  it("returns distributions for all metrics", () => {
    const country = data.countries[0];
    const mc = runMonteCarlo(country, testConfig, 100);
    expect(mc.iterations).toBe(100);
    expect(mc.distributions.length).toBeGreaterThan(0);
  });

  it("computes mean and percentiles", () => {
    const country = data.countries[0];
    const mc = runMonteCarlo(country, testConfig, 100);
    for (const dist of mc.distributions) {
      expect(typeof dist.mean).toBe("number");
      expect(typeof dist.median).toBe("number");
      expect(typeof dist.p5).toBe("number");
      expect(typeof dist.p95).toBe("number");
      expect(dist.p5).toBeLessThanOrEqual(dist.median);
      expect(dist.median).toBeLessThanOrEqual(dist.p95);
    }
  });

  it("computes confidence intervals", () => {
    const country = data.countries[0];
    const mc = runMonteCarlo(country, testConfig, 100);
    for (const dist of mc.distributions) {
      const ci = mc.confidence95[dist.key];
      expect(ci.low).toBeLessThanOrEqual(ci.high);
    }
  });

  it("computes improvement probability between 0 and 1", () => {
    const country = data.countries[0];
    const mc = runMonteCarlo(country, testConfig, 100);
    for (const key of Object.keys(mc.improvementProbability)) {
      const p = mc.improvementProbability[key];
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("produces non-zero std dev (perturbation has effect)", () => {
    const country = data.countries[0];
    const mc = runMonteCarlo(country, testConfig, 200);
    const withVariance = mc.distributions.filter((d) => d.stdDev > 0);
    expect(withVariance.length).toBeGreaterThan(0);
  });

  it("produces different results with different configs", () => {
    const country = data.countries[0];
    const minimal: ScenarioConfig = {
      militaryReduction: 0, healthIncrease: 0, educationBoost: 0,
      foodAidAmount: 0, conflictResolution: false, climateActionPct: 0,
    };
    const mc1 = runMonteCarlo(country, minimal, 50);
    const mc2 = runMonteCarlo(country, testConfig, 50);
    // At least one metric should differ
    const diffs = mc1.distributions.filter((d, i) =>
      Math.abs(d.mean - mc2.distributions[i].mean) > 0.01,
    );
    expect(diffs.length).toBeGreaterThan(0);
  });

  it("handles fewer iterations gracefully", () => {
    const country = data.countries[0];
    const mc = runMonteCarlo(country, testConfig, 10);
    expect(mc.iterations).toBe(10);
    expect(mc.distributions.length).toBeGreaterThan(0);
  });
});

describe("formatMonteCarloReport", () => {
  it("produces a readable report", () => {
    const country = data.countries[0];
    const mc = runMonteCarlo(country, testConfig, 50);
    const report = formatMonteCarloReport(mc);
    expect(report).toContain("MONTE CARLO");
    expect(report).toContain("iterations");
    expect(report).toContain("95% CI");
    expect(report).toContain("P(improvement)");
    expect(report).toContain("Methodology");
  });
});
