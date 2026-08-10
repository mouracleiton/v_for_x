/**
 * V FOR X — Statistical Correlation Library
 *
 * Pure functions for computing correlations and regression statistics
 * over numeric data. No external dependencies — everything is computed
 * client-side, in-browser, with full transparency.
 *
 * Used by The Lens (correlation explorer) and available to any module
 * that needs to quantify relationships between metrics.
 *
 * ⚠️ Correlation is not causation. These functions measure statistical
 * association only. The interpretation is left to the human analyst.
 */

import type { CountryData } from "./types";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface CorrelationResult {
  /** Pearson correlation coefficient (-1 to 1) */
  pearsonR: number;
  /** Coefficient of determination (0 to 1) — fraction of variance explained */
  rSquared: number;
  /** Spearman rank correlation coefficient (-1 to 1) */
  spearmanR: number;
  /** Approximate p-value for the Pearson correlation */
  pValue: number;
  /** Number of paired observations */
  n: number;
  /** Whether the correlation is statistically significant (p < 0.05) */
  significant: boolean;
}

export interface RegressionLine {
  slope: number;
  intercept: number;
  rSquared: number;
}

export interface CorrelationMatrixEntry {
  metricA: string;
  metricB: string;
  labelA: string;
  labelB: string;
  result: CorrelationResult;
}

export interface MetricDef {
  id: string;
  label: string;
  unit: string;
  extract: (c: CountryData) => number | null;
  inverse?: boolean;
}

/* ═══════════════════════════════════════════════════════════════
   Core Statistics
   ═══════════════════════════════════════════════════════════════ */

/**
 * Compute the Pearson product-moment correlation coefficient.
 *
 * Measures the linear relationship between two variables.
 * Returns a value in [-1, 1] where:
 *   1 = perfect positive linear correlation
 *  -1 = perfect negative linear correlation
 *   0 = no linear correlation
 */
export function pearsonR(pairs: Array<{ x: number; y: number }>): number {
  const n = pairs.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (const p of pairs) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
  }
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (den === 0) return 0;
  return num / den;
}

/**
 * Compute the Spearman rank correlation coefficient.
 *
 * Measures the monotonic relationship between two variables.
 * More robust to outliers and non-linear relationships than Pearson.
 */
export function spearmanR(pairs: Array<{ x: number; y: number }>): number {
  const n = pairs.length;
  if (n < 2) return 0;
  const xRanks = rank(pairs.map((p) => p.x));
  const yRanks = rank(pairs.map((p) => p.y));
  const rankedPairs = xRanks.map((x, i) => ({ x, y: yRanks[i] }));
  return pearsonR(rankedPairs);
}

/**
 * Compute ranks of an array of values (1 = smallest).
 * Ties receive the average of their positions.
 */
function rank(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j++;
    const avgRank = (i + 1 + j + 1) / 2;
    for (let k = i; k <= j; k++) {
      ranks[indexed[k].i] = avgRank;
    }
    i = j + 1;
  }
  return ranks;
}

/**
 * Simple linear regression (least squares).
 * Returns slope, intercept, and R² of the fit.
 */
export function linearRegression(
  pairs: Array<{ x: number; y: number }>,
): RegressionLine {
  const n = pairs.length;
  if (n < 2) return { slope: 0, intercept: 0, rSquared: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const p of pairs) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, rSquared: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const r = pearsonR(pairs);

  return { slope, intercept, rSquared: r * r };
}

/**
 * Approximate the two-tailed p-value for a Pearson correlation.
 *
 * Uses the t-distribution approximation:
 *   t = r * sqrt((n-2)/(1-r²))
 *   p ≈ 2 * (1 - CDF(|t|, df=n-2))
 *
 * The CDF is approximated using the regularized incomplete beta function.
 * This is accurate enough for the n > 30 sample sizes typical in our data.
 */
export function correlationPValue(r: number, n: number): number {
  if (n < 3) return 1;
  const absR = Math.min(Math.abs(r), 0.9999);
  const df = n - 2;
  const t = absR * Math.sqrt(df / (1 - absR * absR));
  // Two-tailed p-value from t-distribution
  // Use the incomplete beta function approximation
  const x = df / (df + t * t);
  const pBeta = regularizedIncompleteBeta(x, df / 2, 0.5);
  return Math.min(1, Math.max(0, pBeta));
}

/**
 * Regularized incomplete beta function I_x(a, b).
 * Used for computing t-distribution p-values.
 *
 * Uses the symmetry I_x(a,b) = 1 - I_{1-x}(b,a) when x is large
 * to ensure numerical stability of the continued fraction.
 */
function regularizedIncompleteBeta(
  x: number,
  a: number,
  b: number,
): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Use symmetry for numerical stability when x is large
  if (x >= (a + 1) / (a + b + 2)) {
    return 1 - regularizedIncompleteBeta(1 - x, b, a);
  }

  const lbeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front =
    Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lbeta) / a;

  // Use continued fraction expansion (Lentz's method)
  const cf = continuedBetaFraction(x, a, b);
  return front * cf;
}

function continuedBetaFraction(
  x: number,
  a: number,
  b: number,
): number {
  const maxIter = 200;
  const epsilon = 1e-15;
  let f = 1;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < epsilon) d = epsilon;
  d = 1 / d;

  for (let m = 1; m <= maxIter; m++) {
    const mf = m;
    const numerator = mf * (b - mf) * x / ((a + 2 * mf - 1) * (a + 2 * mf));
    d = 1 + numerator * d;
    if (Math.abs(d) < epsilon) d = epsilon;
    c = 1 + numerator / c;
    if (Math.abs(c) < epsilon) c = epsilon;
    d = 1 / d;
    f *= d * c;

    const numerator2 = -(mf * (a + mf) * x) / ((a + 2 * mf - 1) * (a + 2 * mf));
    d = 1 + numerator2 * d;
    if (Math.abs(d) < epsilon) d = epsilon;
    c = 1 + numerator2 / c;
    if (Math.abs(c) < epsilon) c = epsilon;
    d = 1 / d;
    const delta = d * c;
    f *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }

  return f;
}

/** Lanczos approximation of the log Gamma function. */
function logGamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];

  if (x < 0.5) {
    // Reflection formula
    return (
      Math.log(Math.PI / Math.sin(Math.PI * x)) -
      logGamma(1 - x)
    );
  }

  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) {
    a += c[i] / (x + i);
  }
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/* ═══════════════════════════════════════════════════════════════
   High-level API
   ═══════════════════════════════════════════════════════════════ */

/**
 * Full correlation analysis between two metric extractors over a
 * set of countries. Returns Pearson R, Spearman R, R², p-value,
 * sample size, and significance.
 */
export function analyzeCorrelation(
  countries: CountryData[],
  metricA: MetricDef,
  metricB: MetricDef,
): CorrelationResult {
  const pairs: Array<{ x: number; y: number }> = [];
  for (const c of countries) {
    const x = metricA.extract(c);
    const y = metricB.extract(c);
    if (x != null && y != null && !Number.isNaN(x) && !Number.isNaN(y)) {
      pairs.push({ x, y });
    }
  }

  const r = pearsonR(pairs);
  const sr = spearmanR(pairs);
  const n = pairs.length;
  const p = correlationPValue(r, n);

  return {
    pearsonR: r,
    rSquared: r * r,
    spearmanR: sr,
    pValue: p,
    n,
    significant: p < 0.05,
  };
}

/**
 * Build a full correlation matrix across multiple metrics.
 * Returns all unique pairs with their correlation results.
 */
export function correlationMatrix(
  countries: CountryData[],
  metrics: MetricDef[],
): CorrelationMatrixEntry[] {
  const entries: CorrelationMatrixEntry[] = [];
  for (let i = 0; i < metrics.length; i++) {
    for (let j = i + 1; j < metrics.length; j++) {
      const result = analyzeCorrelation(countries, metrics[i], metrics[j]);
      entries.push({
        metricA: metrics[i].id,
        metricB: metrics[j].id,
        labelA: metrics[i].label,
        labelB: metrics[j].label,
        result,
      });
    }
  }
  return entries.sort((a, b) => Math.abs(b.result.pearsonR) - Math.abs(a.result.pearsonR));
}

/**
 * Find the strongest correlations (positive or negative) between
 * a given metric and all others.
 */
export function strongestCorrelations(
  countries: CountryData[],
  targetMetric: MetricDef,
  allMetrics: MetricDef[],
  minN = 10,
): CorrelationMatrixEntry[] {
  return allMetrics
    .filter((m) => m.id !== targetMetric.id)
    .map((m) => ({
      metricA: targetMetric.id,
      metricB: m.id,
      labelA: targetMetric.label,
      labelB: m.label,
      result: analyzeCorrelation(countries, targetMetric, m),
    }))
    .filter((e) => e.result.n >= minN)
    .sort((a, b) => Math.abs(b.result.pearsonR) - Math.abs(a.result.pearsonR));
}

/* ═══════════════════════════════════════════════════════════════
   Interpretation
   ═══════════════════════════════════════════════════════════════ */

export function interpretR(r: number): {
  strength: string;
  direction: string;
  text: string;
  color: string;
} {
  const abs = Math.abs(r);
  const direction = r > 0 ? "positive" : "negative";

  if (abs >= 0.7)
    return {
      strength: "strong",
      direction,
      text: r > 0 ? "STRONG POSITIVE" : "STRONG NEGATIVE",
      color: "var(--color-blood-bright)",
    };
  if (abs >= 0.5)
    return {
      strength: "moderate",
      direction,
      text: r > 0 ? "MODERATE POSITIVE" : "MODERATE NEGATIVE",
      color: "var(--color-warning-amber)",
    };
  if (abs >= 0.3)
    return {
      strength: "weak",
      direction,
      text: r > 0 ? "WEAK POSITIVE" : "WEAK NEGATIVE",
      color: "var(--color-warning-amber)",
    };
  if (abs >= 0.1)
    return {
      strength: "negligible",
      direction,
      text: r > 0 ? "NEGLIGIBLE POSITIVE" : "NEGLIGIBLE NEGATIVE",
      color: "var(--color-content-secondary)",
    };
  return {
    strength: "none",
    direction: "none",
    text: "NO CORRELATION",
    color: "var(--color-content-secondary)",
  };
}

/**
 * Format a p-value for display.
 * Values below 0.001 show as "< 0.001".
 */
export function formatPValue(p: number): string {
  if (p < 0.001) return "< 0.001";
  if (p < 0.01) return p.toFixed(3);
  return p.toFixed(3);
}

/**
 * Significance stars for display.
 * *** p<0.001, ** p<0.01, * p<0.05
 */
export function significanceStars(p: number): string {
  if (p < 0.001) return "***";
  if (p < 0.01) return "**";
  if (p < 0.05) return "*";
  return "";
}
