import { describe, it, expect } from "vitest";
import {
  simulateScenario,
  metricImproved,
  getCountryScenarios,
  type ScenarioConfig,
} from "../lib/scenario-engine";
import { crisisCountry, stableCountry } from "./fixtures/countries";

const fullPackage: ScenarioConfig = {
  militaryReduction: 70,
  healthIncrease: 80,
  educationBoost: 90,
  foodAidAmount: 40,
  conflictResolution: true,
  climateActionPct: 90,
};

const nothing: ScenarioConfig = {
  militaryReduction: 0,
  healthIncrease: 0,
  educationBoost: 0,
  foodAidAmount: 0,
  conflictResolution: false,
  climateActionPct: 0,
};

describe("scenario-engine — simulateScenario", () => {
  it("returns identical baseline/projected with no interventions", () => {
    const r = simulateScenario(crisisCountry, nothing);
    expect(r.projected).toEqual(r.baseline);
    for (const v of Object.values(r.deltaPct)) expect(v).toBe(0);
    expect(r.narrative).toContain("No interventions selected");
  });

  it("projects improvement in every metric under the full package", () => {
    const r = simulateScenario(crisisCountry, fullPackage);
    const improved = r.metrics.filter((m) => metricImproved(m)).map((m) => m.key);
    expect(improved).toContain("hunger_prevalence");
    expect(improved).toContain("child_mortality");
    expect(improved).toContain("life_expectancy");
    expect(improved).toContain("gdp_per_capita");
    expect(improved).toContain("military_pct_gdp");
    expect(improved).toContain("health_pct_gdp");
    expect(improved).toContain("education_enrollment");
    expect(improved).toContain("famine_risk");
  });

  it("scales projected values by the coefficients", () => {
    const r = simulateScenario(crisisCountry, fullPackage);
    // hunger: 45 - (40*0.5 + 90*0.1 + 12*1.0) = 45 - 41 = 4
    expect(r.projected.hunger_prevalence).toBeCloseTo(4, 5);
    // child mortality: 100 * (1 - (21+12+2.7+25)/100) = 39.3
    expect(r.projected.child_mortality).toBeCloseTo(39.3, 5);
    // life expectancy: 55 + 9.7
    expect(r.projected.life_expectancy).toBeCloseTo(64.7, 5);
    // military % GDP: 4 * 0.3
    expect(r.projected.military_pct_gdp).toBeCloseTo(1.2, 5);
    // health % GDP: 2 * 1.8 + (4 * 0.7)
    expect(r.projected.health_pct_gdp).toBeCloseTo(6.4, 5);
  });

  it("clamps hunger at 0 and education at 100", () => {
    const massive: ScenarioConfig = { ...fullPackage, foodAidAmount: 500, educationBoost: 200 };
    const r = simulateScenario(crisisCountry, massive);
    expect(r.projected.hunger_prevalence).toBe(0);
    expect(r.projected.education_enrollment).toBe(100);
  });

  it("passes nulls through when baseline data is missing", () => {
    const sparse = {
      ...stableCountry,
      hunger: { ...stableCountry.hunger, undernourishment_pct: null, famine_risk_1to5: null },
      health: { ...stableCountry.health, child_mortality_under5_per1k: null, life_expectancy: null },
      economy: { ...stableCountry.economy, gdp_per_capita_usd: null },
      military: { ...stableCountry.military, pct_gdp: null },
      education: { ...stableCountry.education, primary_enrollment_pct: null },
    };
    const r = simulateScenario(sparse, fullPackage);
    expect(r.baseline.hunger_prevalence).toBeNull();
    expect(r.projected.hunger_prevalence).toBeNull();
    expect(r.projected.child_mortality).toBeNull();
    expect(r.projected.life_expectancy).toBeNull();
    expect(r.projected.gdp_per_capita).toBeNull();
    expect(r.projected.military_pct_gdp).toBeNull();
    expect(r.projected.education_enrollment).toBeNull();
  });

  it("scales conflict effects by conflict intensity", () => {
    const lowIntensity = { ...crisisCountry, conflict: { ...crisisCountry.conflict, intensity_1to5: 1 } };
    const rHigh = simulateScenario(crisisCountry, fullPackage);
    const rLow = simulateScenario(lowIntensity, fullPackage);
    // Hunger drop is larger when conflict resolution removes an active war
    expect(rHigh.projected.hunger_prevalence!).toBeLessThan(rLow.projected.hunger_prevalence!);
  });

  it("builds a narrative describing the selected actions", () => {
    const r = simulateScenario(stableCountry, fullPackage);
    expect(r.narrative).toContain("redirect 70% of military spending");
    expect(r.narrative).toContain("inject $40B in targeted food aid");
    expect(r.narrative).toContain("resolve the active armed conflict");
  });

  it("computes consistent delta percentages", () => {
    const r = simulateScenario(crisisCountry, fullPackage);
    const hung = r.metrics.find((m) => m.key === "hunger_prevalence")!;
    const expected = ((4 - 45) / 45) * 100;
    expect(hung.deltaPct).toBeCloseTo(expected, 5);
  });
});

describe("scenario-engine — metricImproved", () => {
  it("judges by the 'better' direction", () => {
    expect(metricImproved({ better: "lower", deltaPct: -5 } as never)).toBe(true);
    expect(metricImproved({ better: "lower", deltaPct: 5 } as never)).toBe(false);
    expect(metricImproved({ better: "higher", deltaPct: 5 } as never)).toBe(true);
    expect(metricImproved({ better: "higher", deltaPct: -5 } as never)).toBe(false);
    expect(metricImproved({ better: "higher", deltaPct: 0 } as never)).toBe(false);
  });
});

describe("scenario-engine — getCountryScenarios", () => {
  it("returns optimistic, moderate, and minimal presets in decreasing magnitude", () => {
    const presets = getCountryScenarios("TEST");
    expect(presets.map((p) => p.name)).toEqual(["Optimistic", "Moderate", "Minimal"]);
    expect(presets[0].config.militaryReduction).toBeGreaterThan(presets[1].config.militaryReduction);
    expect(presets[1].config.militaryReduction).toBeGreaterThan(presets[2].config.militaryReduction);
    expect(presets[0].config.conflictResolution).toBe(true);
    expect(presets[2].config.conflictResolution).toBe(false);
  });
});
