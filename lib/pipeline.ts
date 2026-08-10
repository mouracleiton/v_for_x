/**
 * V FOR X — Scenario → Risk → Campaign Pipeline
 *
 * Connects three previously isolated modules into a single flow:
 *   1. simulateScenario → produces projected outcomes
 *   2. forecastRisk → contextualizes the result in risk terms
 *   3. generateCountryCampaign → produces advocacy material
 *
 * This is the "here's what would fix it" pipeline — the most
 * persuasive tool for advocates.
 */

import type { CountryData, WorldBackbone } from "./types";
import {
  simulateScenario,
  type ScenarioConfig,
  type ScenarioResult,
} from "./scenario-engine";
import {
  calculateRiskScore,
  forecastRisk,
  type RiskScore,
  type RiskForecast,
} from "./risk-model";
import { generateCountryCampaign, analyzeNeeds, type CampaignKit, type NeedAnalysis } from "./campaign";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface PipelineResult {
  /** Country analyzed */
  iso3: string;
  countryName: string;
  /** Scenario simulation output */
  scenario: ScenarioResult;
  /** Current risk score */
  currentRisk: RiskScore;
  /** Risk forecast (momentum-based) */
  forecast: RiskForecast;
  /** Estimated risk score after applying the scenario */
  projectedRisk: RiskScore;
  /** Whether the scenario would improve the risk score */
  improvesRisk: boolean;
  /** Estimated risk score change */
  riskDelta: number;
  /** Generated advocacy campaign */
  campaign: CampaignKit;
  /** Top urgent needs */
  needs: NeedAnalysis[];
  /** Human-readable summary */
  summary: string;
}

/* ═══════════════════════════════════════════════════════════════
   Pipeline
   ═══════════════════════════════════════════════════════════════ */

/**
 * Run the full scenario → risk → campaign pipeline for a country.
 *
 * 1. Simulates the intervention scenario
 * 2. Computes current and projected risk scores
 * 3. Generates an advocacy campaign informed by the results
 *
 * Returns a unified result that can drive a single page UI.
 */
export function runScenarioCampaignPipeline(
  country: CountryData,
  data: WorldBackbone,
  config: ScenarioConfig,
): PipelineResult {
  // 1. Simulate the scenario
  const scenario = simulateScenario(country, config);

  // 2. Compute current risk
  const currentRisk = calculateRiskScore(country);

  // 3. Compute forecast
  const forecast = forecastRisk(country);

  // 4. Estimate projected risk by creating a synthetic country
  //    with the scenario's projected values
  const projectedCountry: CountryData = {
    ...country,
    hunger: {
      ...country.hunger,
      prevalence_pct: scenario.projected.hunger_prevalence ?? country.hunger.prevalence_pct,
    },
    health: {
      ...country.health,
      child_mortality_under5_per1k: scenario.projected.child_mortality ?? country.health.child_mortality_under5_per1k,
      life_expectancy: scenario.projected.life_expectancy ?? country.health.life_expectancy,
    },
    conflict: {
      ...country.conflict,
      intensity_1to5: config.conflictResolution
        ? Math.max(1, country.conflict.intensity_1to5 - 1)
        : country.conflict.intensity_1to5,
    },
    military: {
      ...country.military,
      pct_gdp: scenario.projected.military_pct_gdp ?? country.military.pct_gdp,
    },
  };
  const projectedRisk = calculateRiskScore(projectedCountry);

  // 5. Compute improvement
  const riskDelta = projectedRisk.score - currentRisk.score;
  const improvesRisk = riskDelta < 0;

  // 6. Analyze needs
  const needs = analyzeNeeds(country);

  // 7. Generate campaign
  const campaign = generateCountryCampaign(country, data);

  // 8. Build summary
  const improvedMetrics = scenario.metrics.filter(
    (m) => m.deltaPct !== 0 && ((m.better === "lower" && m.deltaPct < 0) || (m.better === "higher" && m.deltaPct > 0)),
  );
  const worsenedMetrics = scenario.metrics.filter(
    (m) => m.deltaPct !== 0 && ((m.better === "lower" && m.deltaPct > 0) || (m.better === "higher" && m.deltaPct < 0)),
  );

  const parts: string[] = [];
  if (improvedMetrics.length > 0) {
    parts.push(
      `${improvedMetrics.length} metric${improvedMetrics.length > 1 ? "s" : ""} would improve` +
        (riskDelta !== 0 ? ` (risk score ${improvesRisk ? "↓" : "↑"} ${Math.abs(riskDelta).toFixed(1)} pts)` : ""),
    );
  }
  if (worsenedMetrics.length > 0) {
    parts.push(`${worsenedMetrics.length} would worsen`);
  }
  const summary = parts.length > 0 ? parts.join(", ") : "No significant change projected";

  return {
    iso3: country.iso3,
    countryName: country.name_en,
    scenario,
    currentRisk,
    forecast,
    projectedRisk,
    improvesRisk,
    riskDelta,
    campaign,
    needs,
    summary,
  };
}

/**
 * Generate a citable report from a pipeline result.
 * Includes methodology, inputs, outputs, and confidence notes.
 */
export function generateCitableReport(result: PipelineResult): string {
  const lines: string[] = [];
  lines.push(`V FOR X — SCENARIO IMPACT REPORT`);
  lines.push(`Country: ${result.countryName} (${result.iso3})`);
  lines.push(`Generated: ${new Date(result.scenario.metrics[0]?.baseline ?? 0).toISOString()}`);
  lines.push("");
  lines.push("INTERVENTION PARAMETERS:");
  lines.push(`  Military reduction: ${result.scenario.config.militaryReduction}%`);
  lines.push(`  Health spending increase: ${result.scenario.config.healthIncrease}%`);
  lines.push(`  Education boost: ${result.scenario.config.educationBoost}%`);
  lines.push(`  Food aid: $${result.scenario.config.foodAidAmount}B`);
  lines.push(`  Conflict resolution: ${result.scenario.config.conflictResolution ? "Yes" : "No"}`);
  lines.push(`  Climate action: ${result.scenario.config.climateActionPct}%`);
  lines.push("");
  lines.push("PROJECTED OUTCOMES:");
  for (const m of result.scenario.metrics) {
    const dir =
      m.deltaPct === 0 ? "→" : m.deltaPct > 0 ? "↑" : "↓";
    lines.push(
      `  ${m.label}: ${m.baseline?.toFixed(1) ?? "N/A"} → ${m.projected?.toFixed(1) ?? "N/A"} ${m.unit} (${dir} ${Math.abs(m.deltaPct).toFixed(1)}%)`,
    );
  }
  lines.push("");
  lines.push("RISK ASSESSMENT:");
  lines.push(`  Current risk score: ${result.currentRisk.score.toFixed(1)}/100 (${result.currentRisk.level})`);
  lines.push(`  Projected risk score: ${result.projectedRisk.score.toFixed(1)}/100 (${result.projectedRisk.level})`);
  lines.push(`  Change: ${result.riskDelta > 0 ? "+" : ""}${result.riskDelta.toFixed(1)} pts`);
  lines.push(`  Forecast trend: ${result.forecast.trend}`);
  lines.push("");
  lines.push("METHODOLOGY:");
  lines.push("  Proportional elasticity coefficients applied to baseline data.");
  lines.push("  Risk model: 10-factor weighted average (see lib/risk-model.ts).");
  lines.push("  Confidence: directional, not predictive. See METHODOLOGY_TEXT for details.");
  lines.push("");
  lines.push("— Generated by V FOR X. CC0 Public Domain.");
  return lines.join("\n");
}
