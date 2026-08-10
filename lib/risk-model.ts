/**
 * V FOR X — Transparent Crisis Risk Forecasting Model
 *
 * A fully transparent, weighted-factor model that scores every country's
 * structural crisis risk on a normalized 0–100 scale. Every input, weight,
 * and normalization ceiling is public and explained in METHODOLOGY_TEXT.
 *
 * ⚠️ IMPORTANT — this is a HEURISTIC scoring model, NOT predictive AI.
 * It cannot tell you when a war will break out or a famine will be
 * declared. It ranks countries by accumulated structural stress so that
 * analysts, journalists, and citizens can see where the data is worst and
 * ask better questions. Read METHODOLOGY_TEXT before quoting any number.
 */

import type { CountryData } from "./types";

/* ═══════════════════════════════════════════════════════════
   RISK FACTORS
   ═══════════════════════════════════════════════════════════ */

export interface RiskFactor {
  key: string;
  label: string;
  weight: number;
  direction: "bad_high" | "bad_low";
  description: string;
}

/**
 * Internal factor definition: the public RiskFactor fields plus an
 * extractor and a normalization ceiling (the raw value at which the
 * factor is considered maximally bad → normalized 1.0).
 */
interface FactorConfig extends RiskFactor {
  extract: (c: CountryData) => number | null;
  /** Raw value mapped to normalized == 1.0 (worst). */
  ceiling: number;
}

/* The 10 weighted factors, with the best available field in CountryData.
 *
 * NOTE on data gaps: the dataset has no dedicated `inflation_rate`,
 * `press_freedom`, or `government_effectiveness` fields. We therefore use
 * the closest validated proxies and document them below. Where a proxy is
 * unavailable for a country, that factor is skipped and the remaining
 * weights are re-normalized so the 0–100 score stays comparable.
 */
const FACTOR_CONFIGS: FactorConfig[] = [
  {
    key: "hunger_prevalence",
    label: "Hunger Prevalence",
    weight: 15,
    direction: "bad_high",
    description:
      "Share of the population facing food insecurity (hunger.prevalence_pct, 0–100).",
    extract: (c) => c.hunger.prevalence_pct,
    ceiling: 100,
  },
  {
    key: "child_mortality",
    label: "Child Mortality (under-5)",
    weight: 12,
    direction: "bad_high",
    description:
      "Under-5 deaths per 1,000 live births (health.child_mortality_under5_per1k).",
    extract: (c) => c.health.child_mortality_under5_per1k,
    ceiling: 150,
  },
  {
    key: "conflict_intensity",
    label: "Conflict Intensity",
    weight: 15,
    direction: "bad_high",
    description:
      "UCDP conflict intensity scale, 1–5 (conflict.intensity_1to5).",
    extract: (c) => c.conflict.intensity_1to5,
    ceiling: 5,
  },
  {
    key: "inflation_rate",
    label: "Inflation Rate (proxy)",
    weight: 8,
    direction: "bad_high",
    description:
      "Consumer inflation is not in the dataset; this slot reads 0 everywhere. " +
      "It is retained for model transparency and re-normalized out when null.",
    // No validated inflation field exists — extract returns null so the
    // weight is excluded from normalization (see calculateRiskScore).
    extract: () => null,
    ceiling: 50,
  },
  {
    key: "unemployment",
    label: "Unemployment",
    weight: 7,
    direction: "bad_high",
    description:
      "Total unemployment rate (employment.unemployment_pct).",
    extract: (c) => c.employment.unemployment_pct,
    ceiling: 50,
  },
  {
    key: "press_freedom",
    label: "Press Freedom (proxy: democracy index)",
    weight: 10,
    direction: "bad_low",
    description:
      "No press-freedom field; proxied by V-Dem electoral democracy index " +
      "(governance.electoral_democracy_index, 0–1). Less democratic ⇒ worse.",
    extract: (c) => c.governance.electoral_democracy_index,
    ceiling: 1,
  },
  {
    key: "government_effectiveness",
    label: "Govt. Effectiveness (proxy: CPI)",
    weight: 10,
    direction: "bad_low",
    description:
      "No govt-effectiveness field; proxied by Corruption Perceptions Index " +
      "(governance.corruption_perceptions_index, 0–100). Lower ⇒ more corrupt ⇒ worse.",
    extract: (c) => c.governance.corruption_perceptions_index,
    ceiling: 100,
  },
  {
    key: "safe_water_access",
    label: "Safe Water/Sanitation Access",
    weight: 8,
    direction: "bad_low",
    description:
      "Share with safely-managed sanitation (water_sanitation.safe_sanitation_pct, 0–100). Lower ⇒ worse.",
    extract: (c) => c.water_sanitation.safe_sanitation_pct,
    ceiling: 100,
  },
  {
    key: "access_to_electricity",
    label: "Electricity Access Gap",
    weight: 5,
    direction: "bad_high",
    description:
      "Millions without electricity access (energy.no_access_electricity_m). Higher ⇒ worse.",
    extract: (c) => c.energy?.no_access_electricity_m ?? null,
    ceiling: 80,
  },
  {
    key: "refugees_and_idps",
    label: "Refugees & IDPs",
    weight: 10,
    direction: "bad_high",
    description:
      "Forcibly displaced population (migration.forcibly_displaced). Higher ⇒ worse.",
    extract: (c) => c.migration.forcibly_displaced,
    ceiling: 15_000_000,
  },
];

/** Public array of the 10 weighted factors (as specified). */
export const RISK_FACTORS: RiskFactor[] = FACTOR_CONFIGS.map(
  ({ key, label, weight, direction, description }) => ({
    key,
    label,
    weight,
    direction,
    description,
  }),
);

/* ═══════════════════════════════════════════════════════════
   NORMALIZATION
   ═══════════════════════════════════════════════════════════ */

/** Clamp a raw value to a 0–1 severity given a factor's direction + ceiling. */
export function normalizeFactor(
  raw: number,
  factor: Pick<FactorConfig, "direction" | "ceiling">,
): number {
  if (factor.ceiling <= 0) return 0;
  if (factor.direction === "bad_high") {
    return Math.max(0, Math.min(1, raw / factor.ceiling));
  }
  // bad_low: lower raw is worse → invert.
  return Math.max(0, Math.min(1, (factor.ceiling - raw) / factor.ceiling));
}

export type RiskLevel = "low" | "moderate" | "high" | "severe" | "critical";

export interface RiskFactorResult {
  key: string;
  label: string;
  value: number;
  normalized: number;
  contribution: number;
}

export interface RiskScore {
  score: number;
  level: RiskLevel;
  factors: RiskFactorResult[];
}

/** Map a 0–100 score to a severity level. */
export function levelFromScore(score: number): RiskLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "severe";
  if (score >= 40) return "high";
  if (score >= 20) return "moderate";
  return "low";
}

/**
 * Calculate a country's crisis risk score on a 0–100 scale.
 *
 * Each available factor is normalized to 0–1 (1 = worst), multiplied by
 * its weight, summed, then divided by the sum of weights of the factors
 * that actually had data (so missing data does not silently zero a
 * country). The single largest contributor is returned via getTopAtRisk.
 */
export function calculateRiskScore(country: CountryData): RiskScore {
  let weightedSum = 0;
  let weightUsed = 0;
  const factors: RiskFactorResult[] = [];

  for (const f of FACTOR_CONFIGS) {
    const raw = f.extract(country);
    if (raw === null || raw === undefined || Number.isNaN(raw)) continue;
    const norm = normalizeFactor(raw, f);
    const contribution = norm * f.weight;
    weightedSum += contribution;
    weightUsed += f.weight;
    factors.push({
      key: f.key,
      label: f.label,
      value: raw,
      normalized: norm,
      contribution,
    });
  }

  const score = weightUsed > 0 ? (weightedSum / weightUsed) * 100 : 0;
  return { score: Math.round(score * 10) / 10, level: levelFromScore(score), factors };
}

/* ═══════════════════════════════════════════════════════════
   FORECAST (heuristic trend projection)
   ═══════════════════════════════════════════════════════════ */

export interface RiskForecast {
  currentScore: number;
  projectedScore: number;
  trend: "improving" | "stable" | "deteriorating";
  rationale: string;
}

/**
 * Heuristic short-horizon trend projection.
 *
 * Uses the year-over-year trajectory of conflict-related deaths
 * (conflict.deaths_1 … deaths_5, oldest→newest) as the principal
 * volatility signal, blended with the current risk score. A rising death
 * toll pushes the projection up; a falling one pulls it down; the
 * magnitude scales with recent volatility (deviation of the last two
 * points from the 5-year mean).
 *
 * This is NOT a prediction of future events — only a read of current
 * momentum in the data.
 */
export function forecastRisk(country: CountryData): RiskForecast {
  const { score: currentScore } = calculateRiskScore(country);

  const deaths = [
    country.conflict.deaths_1,
    country.conflict.deaths_2,
    country.conflict.deaths_3,
    country.conflict.deaths_4,
    country.conflict.deaths_5,
  ].filter((d) => typeof d === "number" && d >= 0);

  let delta = 0;
  let rationaleBits: string[] = [];

  if (deaths.length >= 2) {
    const mean = deaths.reduce((a, b) => a + b, 0) / deaths.length || 1;
    const recent = deaths[deaths.length - 1];
    const previous = deaths[deaths.length - 2];
    const momentum = recent - previous; // positive = escalating
    // Volatility = how far the last point sits from the 5-yr mean (normalised).
    const volatility = Math.abs(recent - mean) / (mean || 1);

    // Translate momentum into a score delta (capped).
    delta = Math.max(-12, Math.min(12, momentum / (mean || 1) * 8));
    // Scale the swing by recent volatility, but keep it bounded.
    delta = delta * (0.5 + Math.min(1, volatility));

    rationaleBits.push(
      `Conflict deaths moved ${previous}→${recent} (5-yr mean ${Math.round(mean)}); ` +
        `volatility ${(volatility * 100).toFixed(0)}%.`,
    );
  } else {
    rationaleBits.push(
      "Insufficient conflict-death history — projection anchored to current score.",
    );
  }

  // Anchor correction: very high base scores drift slightly upward (risk
  // begets risk), very low scores drift slightly downward (resilience).
  if (currentScore >= 70) delta += 1.5;
  if (currentScore <= 15) delta -= 1.5;

  const projectedScore = Math.max(0, Math.min(100, currentScore + delta));
  const roundedProjected = Math.round(projectedScore * 10) / 10;

  let trend: RiskForecast["trend"];
  if (delta > 1.5) trend = "deteriorating";
  else if (delta < -1.5) trend = "improving";
  else trend = "stable";

  rationaleBits.push(
    `Base risk score ${currentScore.toFixed(1)} projected to ${roundedProjected.toFixed(1)} (Δ ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}).`,
  );

  return {
    currentScore,
    projectedScore: roundedProjected,
    trend,
    rationale: rationaleBits.join(" "),
  };
}

/* ═══════════════════════════════════════════════════════════
   RANKING
   ═══════════════════════════════════════════════════════════ */

export interface AtRiskEntry {
  iso3: string;
  name: string;
  score: number;
  level: string;
  topFactor: string;
}

/**
 * Rank countries by risk score and return the top `limit`, each with its
 * single biggest contributing factor (label) for a one-glance read.
 */
export function getTopAtRisk(
  countries: CountryData[],
  limit: number,
): AtRiskEntry[] {
  return countries
    .map((c) => {
      const { score, level, factors } = calculateRiskScore(c);
      const top =
        factors.length > 0
          ? [...factors].sort((a, b) => b.contribution - a.contribution)[0]
          : null;
      return {
        iso3: c.iso3,
        name: c.name_en,
        score,
        level,
        topFactor: top ? top.label : "—",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/* ═══════════════════════════════════════════════════════════
   METHODOLOGY DISCLOSURE
   ═══════════════════════════════════════════════════════════ */

export const METHODOLOGY_TEXT = `V FOR X CRISIS RISK MODEL — METHODOLOGY & LIMITATIONS

PURPOSE
This model produces a transparent, comparable 0–100 structural-risk score
for every country in the dataset. Its goal is to make "where is the data
worst?" answerable at a glance — for journalists, researchers, and
citizens. It is a ranking aid, not an oracle.

THIS IS A HEURISTIC MODEL, NOT PREDICTIVE AI.
No machine learning is used. No future events are forecast with causal
confidence. The numbers reflect current, observed indicators only.

THE 10 WEIGHTED FACTORS
  • Hunger Prevalence .................... weight 15  (higher = worse)
  • Child Mortality (under-5) ............ weight 12  (higher = worse)
  • Conflict Intensity ................... weight 15  (higher = worse)
  • Inflation Rate (proxy) ............... weight  8  (no field; excluded)
  • Unemployment ......................... weight  7  (higher = worse)
  • Press Freedom (proxy: democracy) ..... weight 10  (lower = worse)
  • Govt. Effectiveness (proxy: CPI) ..... weight 10  (lower = worse)
  • Safe Water/Sanitation Access ......... weight  8  (lower = worse)
  • Electricity Access Gap ............... weight  5  (higher = worse)
  • Refugees & IDPs ...................... weight 10  (higher = worse)

NORMALIZATION
Each factor is scaled to 0–1 against a documented "ceiling" (the raw value
treated as maximally bad). For "bad_high" factors, normalized = raw/ceiling.
For "bad_low" factors, normalized = (ceiling − raw)/ceiling. Each normalized
value is multiplied by its weight; the score is (Σ contributions / Σ weights
of factors with data) × 100.

DATA-GAP HANDLING
Where a country lacks a value for a factor, that factor is SKIPPED and the
remaining weights are re-normalized. A country is therefore never punished
for missing data. Inflation has no validated field anywhere in the dataset
and is always excluded.

SEVERITY LEVELS (0–100)
  low 0–19 · moderate 20–39 · high 40–59 · severe 60–79 · critical 80–100

FORECAST (forecastRisk)
A short-horizon momentum read, NOT a prediction. It uses the year-over-year
trajectory of conflict deaths as the principal volatility signal and nudges
the current score up or down. Treat the projected number as "direction of
travel in the data," never as a forecast of casualties or famine.

LIMITATIONS
  • Weights are judgemental, not statistically fitted.
  • Proxies (democracy index, CPI) stand in for unavailable concepts.
  • The model cannot see context outside its 10 inputs (e.g. drought,
    elections, sanctions) and will miss fast-breaking crises.
  • Always corroborate any score with the full country dossier before acting.

Open data, CC0. Question every number — including this one.`;
