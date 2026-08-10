/**
 * V FOR X — Interactive Scenario Simulator engine
 *
 * Projects the impact of redirecting resources from military spending,
 * conflict, and extractive structures into health, education, food aid,
 * and climate adaptation. Coefficients are documented, proportional, and
 * derived from the order-of-magnitude relationships cited in the platform's
 * SDG equations (e.g. each $1B of targeted food aid measurably lowers
 * undernourishment; every 1% of military budget redirected to health lowers
 * child mortality). These are model estimates, not predictions.
 */

import type { CountryData } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════
   CONFIG — adjustable levers
   ═══════════════════════════════════════════════════════════════ */

export interface ScenarioConfig {
  /** 0–80 — share of the military budget redirected to civilian needs */
  militaryReduction: number;
  /** 0–100 — proportional increase in national health spending */
  healthIncrease: number;
  /** 0–100 — boost to education enrollment / spending */
  educationBoost: number;
  /** billions USD injected as targeted food aid */
  foodAidAmount: number;
  /** resolve the country's active armed conflict */
  conflictResolution: boolean;
  /** 0–100 — commitment to climate adaptation / mitigation */
  climateActionPct: number;
}

/* ═══════════════════════════════════════════════════════════════
   RESULT STRUCTURES
   ═══════════════════════════════════════════════════════════════ */

export interface ScenarioProjected {
  hunger_prevalence: number | null; // undernourishment %
  child_mortality: number | null; // per 1,000 live births (U5)
  life_expectancy: number | null; // years
  gdp_per_capita: number | null; // USD
  military_pct_gdp: number | null; // %
  health_pct_gdp: number | null; // %
  education_enrollment: number | null; // primary net enrollment %
  famine_risk: number | null; // 1–5
}

export interface ScenarioDelta {
  hunger_prevalence: number;
  child_mortality: number;
  life_expectancy: number;
  gdp_per_capita: number;
  military_pct_gdp: number;
  health_pct_gdp: number;
  education_enrollment: number;
  famine_risk: number;
}

export interface ScenarioMetric {
  key: keyof ScenarioProjected;
  label: string;
  unit: string;
  better: "lower" | "higher";
  baseline: number | null;
  projected: number | null;
  deltaPct: number;
}

export interface ScenarioResult {
  config: ScenarioConfig;
  baseline: ScenarioProjected;
  projected: ScenarioProjected;
  deltaPct: ScenarioDelta;
  metrics: ScenarioMetric[];
  narrative: string;
}

export interface ScenarioPreset {
  name: string;
  description: string;
  config: ScenarioConfig;
}

/* ═══════════════════════════════════════════════════════════════
   COEFFICIENT MODEL — documented, proportional
   ═══════════════════════════════════════════════════════════════ */

const COEF = {
  // ── Military → health / peace dividend ──
  /** each 1% of military budget redirected to health lowers child mortality ~0.3% */
  MIL_TO_HEALTH_CHILD_MORT_PCT: 0.3,
  /** each 1% military→health redirect adds ~0.02yr life expectancy */
  MIL_TO_HEALTH_LE_YEARS: 0.02,
  /** peace dividend: each 1% military reduction lifts GDP ~0.01% */
  MIL_PEACE_DIVIDEND_GDP_PCT: 0.01,

  // ── Direct health spend increase ──
  /** each 1% health spending increase adds ~0.04yr life expectancy */
  HEALTH_LE_YEARS_PER_PCT: 0.04,
  /** each 1% health spending increase lowers child mortality ~0.15% */
  HEALTH_CHILD_MORT_PCT_PER_PCT: 0.15,

  // ── Education boost ──
  /** each 1% education boost lowers undernourishment ~0.10pp (nutrition literacy) */
  EDUCATION_HUNGER_PP: 0.1,
  /** each 1% education boost adds ~0.03yr life expectancy */
  EDUCATION_LE_YEARS: 0.03,
  /** each 1% education boost lifts GDP ~0.02% */
  EDUCATION_GDP_PCT: 0.02,

  // ── Food aid ──
  /** each $1B targeted food aid lowers undernourishment prevalence ~0.50pp */
  FOOD_AID_PP_PER_BILLION: 0.5,

  // ── Conflict resolution (scaled by intensity 0–1) ──
  CONFLICT_HUNGER_PP: 12,
  CONFLICT_CHILD_MORT_PCT: 25,
  CONFLICT_LE_YEARS: 1.5,
  CONFLICT_GDP_PCT: 3,

  // ── Climate action ──
  /** each 1% climate action lifts GDP ~0.04% */
  CLIMATE_GDP_PCT_PER_PCT: 0.04,
  /** each 1% climate action adds ~0.01yr life expectancy */
  CLIMATE_LE_YEARS_PER_PCT: 0.01,
  /** each 1% climate action lowers child mortality ~0.03% */
  CLIMATE_CHILD_MORT_PCT_PER_PCT: 0.03,
} as const;

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(Math.max(n, lo), hi);

const pctDelta = (base: number | null, proj: number | null): number => {
  if (base === null || proj === null || base === 0) return 0;
  return ((proj - base) / base) * 100;
};

/** Returns true when a metric moved in its "better" direction. */
export function metricImproved(m: ScenarioMetric): boolean {
  if (m.deltaPct === 0) return false;
  return m.better === "lower" ? m.deltaPct < 0 : m.deltaPct > 0;
}

/* ═══════════════════════════════════════════════════════════════
   CORE SIMULATION
   ═══════════════════════════════════════════════════════════════ */

export function simulateScenario(
  base: CountryData,
  config: ScenarioConfig
): ScenarioResult {
  const intensity = base.conflict.intensity_1to5 ?? 0;
  const intensityRatio = clamp(intensity / 5, 0, 1);
  const milPct = base.military.pct_gdp ?? 0;

  const baseline: ScenarioProjected = {
    hunger_prevalence: base.hunger.undernourishment_pct ?? null,
    child_mortality: base.health.child_mortality_under5_per1k ?? null,
    life_expectancy: base.health.life_expectancy ?? null,
    gdp_per_capita: base.economy.gdp_per_capita_usd ?? null,
    military_pct_gdp: base.military.pct_gdp ?? null,
    health_pct_gdp: base.health.expenditure_pct_gdp ?? null,
    education_enrollment: base.education.primary_enrollment_pct ?? null,
    famine_risk: base.hunger.famine_risk_1to5 ?? null,
  };

  // ── Hunger prevalence (undernourishment pp) ──
  let hungerDropPP = 0;
  hungerDropPP += config.foodAidAmount * COEF.FOOD_AID_PP_PER_BILLION;
  hungerDropPP += config.educationBoost * COEF.EDUCATION_HUNGER_PP;
  if (config.conflictResolution)
    hungerDropPP += COEF.CONFLICT_HUNGER_PP * intensityRatio;
  const hungerProjected =
    baseline.hunger_prevalence == null
      ? null
      : Math.max(0, baseline.hunger_prevalence - hungerDropPP);

  // ── Child mortality (per 1k) ──
  let childMortDropPct = 0;
  childMortDropPct += config.militaryReduction * COEF.MIL_TO_HEALTH_CHILD_MORT_PCT;
  childMortDropPct += config.healthIncrease * COEF.HEALTH_CHILD_MORT_PCT_PER_PCT;
  childMortDropPct += config.climateActionPct * COEF.CLIMATE_CHILD_MORT_PCT_PER_PCT;
  if (config.conflictResolution)
    childMortDropPct += COEF.CONFLICT_CHILD_MORT_PCT * intensityRatio;
  const childMortProjected =
    baseline.child_mortality == null
      ? null
      : Math.max(0, baseline.child_mortality * (1 - childMortDropPct / 100));

  // ── Life expectancy (years) ──
  let leGain = 0;
  leGain += config.militaryReduction * COEF.MIL_TO_HEALTH_LE_YEARS;
  leGain += config.healthIncrease * COEF.HEALTH_LE_YEARS_PER_PCT;
  leGain += config.educationBoost * COEF.EDUCATION_LE_YEARS;
  leGain += config.climateActionPct * COEF.CLIMATE_LE_YEARS_PER_PCT;
  if (config.conflictResolution)
    leGain += COEF.CONFLICT_LE_YEARS * intensityRatio;
  const leProjected =
    baseline.life_expectancy == null ? null : baseline.life_expectancy + leGain;

  // ── GDP per capita (%) ──
  let gdpPct = 0;
  gdpPct += config.educationBoost * COEF.EDUCATION_GDP_PCT;
  gdpPct += config.climateActionPct * COEF.CLIMATE_GDP_PCT_PER_PCT;
  gdpPct += config.militaryReduction * COEF.MIL_PEACE_DIVIDEND_GDP_PCT;
  if (config.conflictResolution)
    gdpPct += COEF.CONFLICT_GDP_PCT * intensityRatio;
  const gdpProjected =
    baseline.gdp_per_capita == null
      ? null
      : baseline.gdp_per_capita * (1 + gdpPct / 100);

  // ── Military % GDP (direct reduction) ──
  const milProjected =
    baseline.military_pct_gdp == null
      ? null
      : baseline.military_pct_gdp * (1 - config.militaryReduction / 100);

  // ── Health % GDP (increase + redirected military share) ──
  const healthFromRedirect = milPct * (config.militaryReduction / 100);
  const healthProjected =
    baseline.health_pct_gdp == null
      ? null
      : baseline.health_pct_gdp * (1 + config.healthIncrease / 100) +
        healthFromRedirect;

  // ── Education enrollment (%) ──
  const eduProjected =
    baseline.education_enrollment == null
      ? null
      : Math.min(100, baseline.education_enrollment * (1 + config.educationBoost / 100));

  // ── Famine risk (1–5) ──
  const famineReductionFrac =
    Math.min(hungerDropPP / 40, 1) * 0.6 +
    (config.conflictResolution ? intensityRatio * 0.4 : 0);
  const famineProjected =
    baseline.famine_risk == null
      ? null
      : Math.max(0, baseline.famine_risk * (1 - famineReductionFrac));

  const projected: ScenarioProjected = {
    hunger_prevalence: hungerProjected,
    child_mortality: childMortProjected,
    life_expectancy: leProjected,
    gdp_per_capita: gdpProjected,
    military_pct_gdp: milProjected,
    health_pct_gdp: healthProjected,
    education_enrollment: eduProjected,
    famine_risk: famineProjected,
  };

  const deltaPct: ScenarioDelta = {
    hunger_prevalence: pctDelta(baseline.hunger_prevalence, projected.hunger_prevalence),
    child_mortality: pctDelta(baseline.child_mortality, projected.child_mortality),
    life_expectancy: pctDelta(baseline.life_expectancy, projected.life_expectancy),
    gdp_per_capita: pctDelta(baseline.gdp_per_capita, projected.gdp_per_capita),
    military_pct_gdp: pctDelta(baseline.military_pct_gdp, projected.military_pct_gdp),
    health_pct_gdp: pctDelta(baseline.health_pct_gdp, projected.health_pct_gdp),
    education_enrollment: pctDelta(baseline.education_enrollment, projected.education_enrollment),
    famine_risk: pctDelta(baseline.famine_risk, projected.famine_risk),
  };

  const metrics = buildMetrics(baseline, projected, deltaPct);
  const narrative = buildNarrative(base, config, baseline, projected, deltaPct);

  return { config, baseline, projected, deltaPct, metrics, narrative };
}

/* ═══════════════════════════════════════════════════════════════
   METRIC TABLE BUILDER
   ═══════════════════════════════════════════════════════════════ */

function buildMetrics(
  baseline: ScenarioProjected,
  projected: ScenarioProjected,
  deltaPct: ScenarioDelta
): ScenarioMetric[] {
  const defs: {
    key: keyof ScenarioProjected;
    label: string;
    unit: string;
    better: "lower" | "higher";
  }[] = [
    { key: "hunger_prevalence", label: "Undernourishment", unit: "%", better: "lower" },
    { key: "child_mortality", label: "Child Mortality (U5)", unit: "/1k", better: "lower" },
    { key: "life_expectancy", label: "Life Expectancy", unit: "yrs", better: "higher" },
    { key: "gdp_per_capita", label: "GDP per Capita", unit: "$", better: "higher" },
    { key: "military_pct_gdp", label: "Military Spending", unit: "% GDP", better: "lower" },
    { key: "health_pct_gdp", label: "Health Spending", unit: "% GDP", better: "higher" },
    { key: "education_enrollment", label: "Primary Enrollment", unit: "%", better: "higher" },
    { key: "famine_risk", label: "Famine Risk", unit: "/5", better: "lower" },
  ];

  return defs.map((d) => ({
    key: d.key,
    label: d.label,
    unit: d.unit,
    better: d.better,
    baseline: baseline[d.key],
    projected: projected[d.key],
    deltaPct: deltaPct[d.key],
  }));
}

/* ═══════════════════════════════════════════════════════════════
   NARRATIVE GENERATOR
   ═══════════════════════════════════════════════════════════════ */

function buildNarrative(
  base: CountryData,
  config: ScenarioConfig,
  baseline: ScenarioProjected,
  projected: ScenarioProjected,
  deltaPct: ScenarioDelta
): string {
  const actions: string[] = [];
  if (config.militaryReduction > 0)
    actions.push(`redirect ${config.militaryReduction}% of military spending into civilian needs`);
  if (config.healthIncrease > 0)
    actions.push(`raise health expenditure by ${config.healthIncrease}%`);
  if (config.educationBoost > 0)
    actions.push(`boost education by ${config.educationBoost}%`);
  if (config.foodAidAmount > 0)
    actions.push(`inject $${config.foodAidAmount}B in targeted food aid`);
  if (config.conflictResolution)
    actions.push("resolve the active armed conflict");
  if (config.climateActionPct > 0)
    actions.push(`commit to ${config.climateActionPct}% climate adaptation`);

  const lead =
    actions.length > 0
      ? `Under this package, ${base.name_en} would ${actions.join(", ")}.`
      : `No interventions selected — ${base.name_en} remains on its current trajectory.`;

  const outcomes: string[] = [];

  if (
    baseline.child_mortality != null &&
    projected.child_mortality != null &&
    deltaPct.child_mortality !== 0
  ) {
    outcomes.push(
      `Under-5 child mortality would move from ${baseline.child_mortality.toFixed(
        1
      )} to ${projected.child_mortality.toFixed(1)} per 1,000 (${deltaPct.child_mortality.toFixed(
        1
      )}%)`
    );
  }
  if (
    baseline.hunger_prevalence != null &&
    projected.hunger_prevalence != null &&
    deltaPct.hunger_prevalence !== 0
  ) {
    outcomes.push(
      `undernourishment from ${baseline.hunger_prevalence.toFixed(1)}% to ${projected.hunger_prevalence.toFixed(
        1
      )}% (${deltaPct.hunger_prevalence.toFixed(1)}%)`
    );
  }
  if (
    baseline.life_expectancy != null &&
    projected.life_expectancy != null &&
    deltaPct.life_expectancy !== 0
  ) {
    outcomes.push(
      `life expectancy from ${baseline.life_expectancy.toFixed(1)} to ${projected.life_expectancy.toFixed(
        1
      )} years (${deltaPct.life_expectancy >= 0 ? "+" : ""}${deltaPct.life_expectancy.toFixed(1)}%)`
    );
  }
  if (
    baseline.gdp_per_capita != null &&
    projected.gdp_per_capita != null &&
    deltaPct.gdp_per_capita !== 0
  ) {
    outcomes.push(
      `GDP per capita by ${deltaPct.gdp_per_capita >= 0 ? "+" : ""}${deltaPct.gdp_per_capita.toFixed(1)}%`
    );
  }

  const body = outcomes.length ? ` Projected impact: ${outcomes.join("; ")}.` : "";

  const closing =
    actions.length > 0
      ? " These are order-of-magnitude estimates from the platform's proportional resource model — every redirected dollar is a choice between weapons and human life."
      : "";

  return lead + body + closing;
}

/* ═══════════════════════════════════════════════════════════════
   PRESET SCENARIOS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Returns three preset intervention packages (optimistic / moderate / minimal).
 * The `iso3` is accepted so callers can scope presets per country in future;
 * the magnitudes are intentionally generic and globally meaningful.
 */
export function getCountryScenarios(_iso3: string): ScenarioPreset[] {
  return [
    {
      name: "Optimistic",
      description:
        "Full redirection: deep military cuts, doubled health & education, major food aid, peace, aggressive climate action.",
      config: {
        militaryReduction: 70,
        healthIncrease: 80,
        educationBoost: 90,
        foodAidAmount: 40,
        conflictResolution: true,
        climateActionPct: 90,
      },
    },
    {
      name: "Moderate",
      description:
        "Credible reform package: meaningful military trimming, solid health & education gains, targeted aid, peace dividend.",
      config: {
        militaryReduction: 35,
        healthIncrease: 40,
        educationBoost: 45,
        foodAidAmount: 15,
        conflictResolution: true,
        climateActionPct: 50,
      },
    },
    {
      name: "Minimal",
      description:
        "Status-quo-plus: token adjustments, small aid, no peace process, low climate ambition.",
      config: {
        militaryReduction: 10,
        healthIncrease: 15,
        educationBoost: 15,
        foodAidAmount: 5,
        conflictResolution: false,
        climateActionPct: 20,
      },
    },
  ];
}
