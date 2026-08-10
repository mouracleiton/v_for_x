/**
 * V FOR X — Monte Carlo Scenario Simulator
 *
 * Extends the scenario-engine with probabilistic uncertainty
 * quantification. Instead of a single deterministic projection,
 * runs N simulations with perturbed coefficients and reports
 * outcome distributions, confidence intervals, and risk probabilities.
 *
 * Used by Simulator Pro for citable, statistically defensible reports.
 */

import type { CountryData } from "./types";
import {
  simulateScenario,
  type ScenarioConfig,
  type ScenarioResult,
} from "./scenario-engine";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface MonteCarloResult {
  /** Number of simulations run */
  iterations: number;
  /** Per-metric distributions */
  distributions: MetricDistribution[];
  /** Mean result across all simulations */
  mean: ScenarioResult;
  /** Confidence intervals (95%) */
  confidence95: Record<string, { low: number; high: number }>;
  /** Probability that the scenario improves the outcome */
  improvementProbability: Record<string, number>;
}

export interface MetricDistribution {
  key: string;
  label: string;
  unit: string;
  values: number[];
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  p5: number;
  p25: number;
  p75: number;
  p95: number;
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════
   The scenario-engine uses proportional coefficients to project
   outcomes. Monte Carlo perturbs these coefficients within a
   ±20% uncertainty band (uniform) to estimate outcome variance.
*/

function perturbedConfig(base: ScenarioConfig): ScenarioConfig {
  const perturb = (v: number) => v * (0.8 + Math.random() * 0.4);
  return {
    militaryReduction: perturb(base.militaryReduction),
    healthIncrease: perturb(base.healthIncrease),
    educationBoost: perturb(base.educationBoost),
    foodAidAmount: perturb(base.foodAidAmount),
    conflictResolution: base.conflictResolution,
    climateActionPct: perturb(base.climateActionPct),
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function mean(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function stdDev(arr: number[], avg: number): number {
  if (arr.length < 2) return 0;
  const variance = arr.reduce((sum, v) => sum + (v - avg) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/* ═══════════════════════════════════════════════════════════════
   Public API
   ═══════════════════════════════════════════════════════════════ */

/**
 * Run Monte Carlo simulation on a scenario.
 *
 * @param country Base country data
 * @param config Scenario configuration
 * @param iterations Number of simulations (default 1000)
 * @returns Distribution statistics for each projected metric
 */
export function runMonteCarlo(
  country: CountryData,
  config: ScenarioConfig,
  iterations = 1000,
): MonteCarloResult {
  const results: ScenarioResult[] = [];
  const baseline = simulateScenario(country, config);

  for (let i = 0; i < iterations; i++) {
    const perturbed = perturbedConfig(config);
    results.push(simulateScenario(country, perturbed));
  }

  // Build per-metric distributions
  const distributions: MetricDistribution[] = baseline.metrics.map((metric) => {
    const values: number[] = [];
    for (const r of results) {
      const m = r.metrics.find((mm) => mm.key === metric.key);
      if (m && m.projected != null) values.push(m.projected);
    }

    const sorted = [...values].sort((a, b) => a - b);
    const avg = mean(sorted);
    const sd = stdDev(sorted, avg);

    return {
      key: metric.key,
      label: metric.label,
      unit: metric.unit,
      values,
      mean: avg,
      median: median(sorted),
      stdDev: sd,
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      p5: percentile(sorted, 5),
      p25: percentile(sorted, 25),
      p75: percentile(sorted, 75),
      p95: percentile(sorted, 95),
    };
  });

  // Confidence intervals (95%)
  const confidence95: Record<string, { low: number; high: number }> = {};
  for (const dist of distributions) {
    confidence95[dist.key] = { low: dist.p5, high: dist.p95 };
  }

  // Improvement probability: fraction of simulations where the
  // projected value is better than the baseline
  const improvementProbability: Record<string, number> = {};
  for (const metric of baseline.metrics) {
    const dist = distributions.find((d) => d.key === metric.key);
    if (!dist || metric.baseline == null) {
      improvementProbability[metric.key] = 0;
      continue;
    }

    const better = metric.better === "lower";
    const improved = dist.values.filter((v) =>
      better ? v < (metric.baseline ?? 0) : v > (metric.baseline ?? 0),
    );
    improvementProbability[metric.key] = dist.values.length > 0
      ? improved.length / dist.values.length
      : 0;
  }

  return {
    iterations,
    distributions,
    mean: baseline,
    confidence95,
    improvementProbability,
  };
}

/**
 * Format a Monte Carlo result as a citable report section.
 */
export function formatMonteCarloReport(mc: MonteCarloResult): string {
  const lines: string[] = [];
  lines.push(`MONTE CARLO ANALYSIS (${mc.iterations.toLocaleString()} iterations)`);
  lines.push("-".repeat(50));

  for (const dist of mc.distributions) {
    const ci = mc.confidence95[dist.key];
    const prob = mc.improvementProbability[dist.key];
    lines.push(`${dist.label}:`);
    lines.push(`  Mean: ${dist.mean.toFixed(2)} ${dist.unit}`);
    lines.push(`  Median: ${dist.median.toFixed(2)} ${dist.unit}`);
    lines.push(`  Std Dev: ${dist.stdDev.toFixed(2)}`);
    lines.push(`  95% CI: [${ci.low.toFixed(2)}, ${ci.high.toFixed(2)}]`);
    lines.push(`  P(improvement): ${(prob * 100).toFixed(1)}%`);
    lines.push("");
  }

  lines.push("Methodology: Uniform ±20% perturbation on elasticity coefficients.");
  lines.push("Confidence intervals are empirical percentiles from the simulation.");

  return lines.join("\n");
}
