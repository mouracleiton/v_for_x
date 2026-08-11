import { describe, it, expect } from "vitest";
import {
  RISK_FACTORS,
  normalizeFactor,
  levelFromScore,
  calculateRiskScore,
  forecastRisk,
  getTopAtRisk,
  METHODOLOGY_TEXT,
} from "../lib/risk-model";
import { crisisCountry, stableCountry } from "./fixtures/countries";

describe("risk-model — RISK_FACTORS registry", () => {
  it("exposes 10 documented factors", () => {
    expect(RISK_FACTORS).toHaveLength(10);
  });

  it("has unique keys and positive weights", () => {
    const keys = RISK_FACTORS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const f of RISK_FACTORS) {
      expect(f.weight).toBeGreaterThan(0);
      expect(["bad_high", "bad_low"]).toContain(f.direction);
      expect(f.label).toBeTruthy();
      expect(f.description).toBeTruthy();
    }
  });
});

describe("risk-model — normalizeFactor", () => {
  it("normalizes bad_high to raw/ceiling with clamping", () => {
    const f = { direction: "bad_high" as const, ceiling: 100 };
    expect(normalizeFactor(0, f)).toBe(0);
    expect(normalizeFactor(50, f)).toBe(0.5);
    expect(normalizeFactor(150, f)).toBe(1);
    expect(normalizeFactor(-10, f)).toBe(0);
  });

  it("inverts bad_low factors", () => {
    const f = { direction: "bad_low" as const, ceiling: 100 };
    expect(normalizeFactor(0, f)).toBe(1);
    expect(normalizeFactor(100, f)).toBe(0);
    expect(normalizeFactor(40, f)).toBe(0.6);
    expect(normalizeFactor(200, f)).toBe(0);
  });

  it("returns 0 for a non-positive ceiling", () => {
    expect(normalizeFactor(10, { direction: "bad_high", ceiling: 0 })).toBe(0);
  });
});

describe("risk-model — levelFromScore", () => {
  it("maps boundary scores to severity levels", () => {
    expect(levelFromScore(0)).toBe("low");
    expect(levelFromScore(19)).toBe("low");
    expect(levelFromScore(20)).toBe("moderate");
    expect(levelFromScore(39.9)).toBe("moderate");
    expect(levelFromScore(40)).toBe("high");
    expect(levelFromScore(59)).toBe("high");
    expect(levelFromScore(60)).toBe("severe");
    expect(levelFromScore(79)).toBe("severe");
    expect(levelFromScore(80)).toBe("critical");
    expect(levelFromScore(100)).toBe("critical");
  });
});

describe("risk-model — calculateRiskScore", () => {
  it("scores the crisis country high and the stable country low", () => {
    const crisis = calculateRiskScore(crisisCountry);
    const stable = calculateRiskScore(stableCountry);
    expect(crisis.score).toBeGreaterThan(60);
    expect(stable.score).toBeLessThan(30);
    expect(crisis.score).toBeGreaterThan(stable.score);
  });

  it("excludes inflation (no field) and reports the remaining factors", () => {
    const result = calculateRiskScore(crisisCountry);
    const keys = result.factors.map((f) => f.key);
    expect(keys).not.toContain("inflation_rate");
    expect(keys).toHaveLength(9); // 10 minus the always-null inflation slot
  });

  it("weights the severity correctly for bad_high and bad_low factors", () => {
    const result = calculateRiskScore(crisisCountry);
    const press = result.factors.find((f) => f.key === "press_freedom")!;
    const refugees = result.factors.find((f) => f.key === "refugees_and_idps")!;
    // electoral_democracy_index 0.15 → normalized 0.85 (bad), weight 10
    expect(press.normalized).toBeCloseTo(0.85, 5);
    expect(press.contribution).toBeCloseTo(8.5, 5);
    // 3M displaced vs ceiling 15M → normalized 0.2, weight 10
    expect(refugees.normalized).toBeCloseTo(0.2, 5);
  });

  it("produces factor results where contribution equals normalized × weight", () => {
    const result = calculateRiskScore(stableCountry);
    for (const f of result.factors) {
      expect(f.contribution).toBeCloseTo(f.normalized * RISK_FACTORS.find((r) => r.key === f.key)!.weight, 5);
    }
  });
});

describe("risk-model — getTopAtRisk", () => {
  it("ranks descending and respects the limit", () => {
    const ranked = getTopAtRisk([stableCountry, crisisCountry], 1);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].iso3).toBe("TEST");
    expect(ranked[0].score).toBeGreaterThan(60);
  });

  it("returns a topFactor label for each entry", () => {
    const ranked = getTopAtRisk([crisisCountry], 1);
    expect(ranked[0].topFactor).toBeTruthy();
    expect(ranked[0].level).toBeTruthy();
  });
});

describe("risk-model — forecastRisk", () => {
  it("reads momentum from the conflict-deaths trajectory", () => {
    const escalating = {
      ...stableCountry,
      conflict: {
        ...stableCountry.conflict,
        deaths_1: 100, deaths_2: 200, deaths_3: 400, deaths_4: 800, deaths_5: 1600,
      },
    };
    const forecast = forecastRisk(escalating);
    expect(forecast.trend).toBe("deteriorating");
    expect(forecast.projectedScore).toBeGreaterThan(forecast.currentScore);
    expect(forecast.rationale).toContain("deaths");
  });

  it("reports improving when conflict deaths fall", () => {
    const deescalating = {
      ...crisisCountry,
      conflict: {
        ...crisisCountry.conflict,
        deaths_1: 5000, deaths_2: 4000, deaths_3: 3000, deaths_4: 2000, deaths_5: 1000,
      },
    };
    const forecast = forecastRisk(deescalating);
    expect(forecast.trend).toBe("improving");
    expect(forecast.projectedScore).toBeLessThan(forecast.currentScore);
  });

  it("anchors to current score when history is insufficient", () => {
    // Negative sentinels are filtered out by the `d >= 0` guard (no-data convention)
    const sparse = {
      ...stableCountry,
      conflict: { ...stableCountry.conflict, deaths_1: -1, deaths_2: -1, deaths_3: -1, deaths_4: -1, deaths_5: -1 },
    };
    const forecast = forecastRisk(sparse);
    expect(forecast.rationale).toContain("Insufficient");
    expect(forecast.projectedScore).toBeGreaterThanOrEqual(0);
    expect(forecast.projectedScore).toBeLessThanOrEqual(100);
  });

  it("keeps the projection within [0, 100]", () => {
    const extreme = { ...crisisCountry, conflict: { ...crisisCountry.conflict, deaths_1: 1e6, deaths_2: 1e6, deaths_3: 1e6, deaths_4: 1e6, deaths_5: 1e7 } };
    const forecast = forecastRisk(extreme);
    expect(forecast.projectedScore).toBeLessThanOrEqual(100);
    expect(forecast.projectedScore).toBeGreaterThanOrEqual(0);
  });
});

describe("risk-model — METHODOLOGY_TEXT", () => {
  it("discloses weights, normalization, and the heuristic disclaimer", () => {
    expect(METHODOLOGY_TEXT).toContain("weight");
    expect(METHODOLOGY_TEXT).toContain("NOT PREDICTIVE AI");
    expect(METHODOLOGY_TEXT).toContain("HEURISTIC");
  });
});
