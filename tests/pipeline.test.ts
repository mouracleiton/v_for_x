import { describe, it, expect } from "vitest";
import backbone from "../data/world_backbone.json";
import type { WorldBackbone } from "../lib/types";
import { runScenarioCampaignPipeline, generateCitableReport } from "../lib/pipeline";
import type { ScenarioConfig } from "../lib/scenario-engine";

const data = backbone as WorldBackbone;

const testConfig: ScenarioConfig = {
  militaryReduction: 50,
  healthIncrease: 50,
  educationBoost: 30,
  foodAidAmount: 5,
  conflictResolution: true,
  climateActionPct: 20,
};

describe("runScenarioCampaignPipeline", () => {
  it("returns a complete pipeline result", () => {
    const country = data.countries[0];
    const result = runScenarioCampaignPipeline(country, data, testConfig);
    expect(result.iso3).toBe(country.iso3);
    expect(result.countryName).toBe(country.name_en);
    expect(result.scenario).toBeDefined();
    expect(result.currentRisk).toBeDefined();
    expect(result.forecast).toBeDefined();
    expect(result.projectedRisk).toBeDefined();
    expect(result.campaign).toBeDefined();
    expect(result.needs).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  it("computes risk delta between current and projected", () => {
    const country = data.countries[0];
    const result = runScenarioCampaignPipeline(country, data, testConfig);
    expect(typeof result.riskDelta).toBe("number");
    expect(result.improvesRisk).toBe(result.riskDelta < 0);
  });

  it("generates a summary string", () => {
    const country = data.countries.find((c) => c.iso3 === "YEM");
    if (country) {
      const result = runScenarioCampaignPipeline(country, data, testConfig);
      expect(result.summary.length).toBeGreaterThan(0);
    }
  });

  it("produces different results for different configs", () => {
    const country = data.countries[0];
    const minimal: ScenarioConfig = {
      militaryReduction: 0,
      healthIncrease: 0,
      educationBoost: 0,
      foodAidAmount: 0,
      conflictResolution: false,
      climateActionPct: 0,
    };
    const result1 = runScenarioCampaignPipeline(country, data, minimal);
    const result2 = runScenarioCampaignPipeline(country, data, testConfig);
    expect(result1.scenario.metrics).not.toEqual(result2.scenario.metrics);
  });

  it("generates campaign with tweets", () => {
    const country = data.countries[0];
    const result = runScenarioCampaignPipeline(country, data, testConfig);
    expect(result.campaign.tweets.length).toBeGreaterThan(0);
  });
});

describe("generateCitableReport", () => {
  it("produces a text report with sections", () => {
    const country = data.countries[0];
    const result = runScenarioCampaignPipeline(country, data, testConfig);
    const report = generateCitableReport(result);
    expect(report).toContain("SCENARIO IMPACT REPORT");
    expect(report).toContain("INTERVENTION PARAMETERS");
    expect(report).toContain("PROJECTED OUTCOMES");
    expect(report).toContain("RISK ASSESSMENT");
    expect(report).toContain("METHODOLOGY");
  });

  it("includes the country name", () => {
    const country = data.countries[0];
    const result = runScenarioCampaignPipeline(country, data, testConfig);
    const report = generateCitableReport(result);
    expect(report).toContain(country.name_en);
  });

  it("includes all scenario metrics", () => {
    const country = data.countries[0];
    const result = runScenarioCampaignPipeline(country, data, testConfig);
    const report = generateCitableReport(result);
    for (const metric of result.scenario.metrics) {
      expect(report).toContain(metric.label);
    }
  });
});
