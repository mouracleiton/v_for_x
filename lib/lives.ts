/**
 * V FOR X — The Lives (Memorial Counter)
 *
 * The statistics on this platform represent real human lives.
 * This module humanizes the numbers — a running tally of lives
 * lost to preventable causes, derived from the world_backbone data.
 *
 * Every child who dies of hunger, every civilian killed in conflict,
 * every person who dies from lack of healthcare access — they are
 * not statistics. They are names, faces, stories.
 *
 * This module:
 *   1. Computes the global death toll from preventable causes
 *   2. Estimates the toll in real-time (per second, since your visit)
 *   3. Provides per-cause breakdowns and per-country data
 *   4. Allows attaching personal memorial entries to statistics
 */

import type { WorldBackbone, CountryData } from "./types";

export interface TollBreakdown {
  cause: string;
  causeKey: string;
  annualDeaths: number;
  perDay: number;
  perHour: number;
  perMinute: number;
  perSecond: number;
  /** What it would cost to prevent (USD/year) */
  preventionCostBillion?: number;
  preventionNote?: string;
  icon: string;
}

export interface MemorialEntry {
  id: string;
  name: string;
  cause: string;
  country: string;
  year: number;
  message: string;
  addedAt: number;
}

export interface RealTimeToll {
  /** Deaths since the user started their session */
  sinceVisit: number;
  /** Deaths today (estimated) */
  today: number;
  /** Per-second rate across all tracked causes */
  perSecond: number;
  /** Breakdown by cause */
  causes: TollBreakdown[];
  startedAt: number;
}

/* ═══════════════════════════════════════════════════════════
   ANNUAL TOLL COMPUTATION
   ═══════════════════════════════════════════════════════════ */

/**
 * Compute the global death toll from preventable causes.
 * All figures are derived from the world_backbone dataset and
 * WHO/UNICEF/FAO published mortality estimates.
 */
export function computeGlobalToll(data: WorldBackbone): TollBreakdown[] {
  const breakdowns: TollBreakdown[] = [];

  // 1. Hunger-related deaths
  // WHO: ~9 million people die of hunger/hunger-related causes each year
  // ~3.1M children under 5 die from malnutrition-related causes
  const hungerDeaths = 9_000_000;
  breakdowns.push({
    cause: "Hunger & Malnutrition",
    causeKey: "hunger",
    annualDeaths: hungerDeaths,
    perDay: Math.round(hungerDeaths / 365),
    perHour: Math.round(hungerDeaths / 365 / 24),
    perMinute: Math.round(hungerDeaths / 365 / 24 / 60),
    perSecond: +(hungerDeaths / 365 / 24 / 60 / 60).toFixed(1),
    preventionCostBillion: 93,
    preventionNote: "$93B/year — 0.9% of global military spending",
    icon: "🍞",
  });

  // 2. Child mortality (under-5, preventable portion)
  // UN IGME: ~4.8M children under 5 die annually; ~2.3M in first month
  // Vast majority are preventable
  const childDeaths = data.countries.reduce(
    (sum, c) => {
      const mortality = c.health.child_mortality_under5_per1k ?? 0;
      const births = c.demographics.population / 1000 * 18; // ~18 births/1000 globally
      return sum + mortality * births;
    },
    0,
  );
  const childDeathsRounded = Math.round(Math.min(childDeaths, 5_000_000));
  breakdowns.push({
    cause: "Child Mortality (under-5, preventable)",
    causeKey: "child_mortality",
    annualDeaths: childDeathsRounded,
    perDay: Math.round(childDeathsRounded / 365),
    perHour: Math.round(childDeathsRounded / 365 / 24),
    perMinute: Math.round(childDeathsRounded / 365 / 24 / 60),
    perSecond: +(childDeathsRounded / 365 / 24 / 60 / 60).toFixed(2),
    preventionNote: "Most are preventable with basic healthcare, nutrition, and clean water",
    icon: "👶",
  });

  // 3. Conflict deaths
  // UCDP: ~170K battle-related deaths in recent years; total including
  // indirect far higher. We use the direct figure.
  const conflictDeaths = data.countries.reduce(
    (sum, c) => sum + (c.conflict.battle_deaths_total || 0),
    0,
  );
  const conflictDeathsRounded = Math.max(conflictDeaths, 170_000);
  breakdowns.push({
    cause: "Armed Conflict",
    causeKey: "conflict",
    annualDeaths: conflictDeathsRounded,
    perDay: Math.round(conflictDeathsRounded / 365),
    perHour: Math.round(conflictDeathsRounded / 365 / 24),
    perMinute: Math.round(conflictDeathsRounded / 365 / 24 / 60),
    perSecond: +(conflictDeathsRounded / 365 / 24 / 60 / 60).toFixed(2),
    preventionNote: "Nonviolent resistance succeeds 53% of the time vs 26% for armed",
    icon: "⚔️",
  });

  // 4. Lack of clean water & sanitation
  // WHO: ~1.4M deaths/year from unsafe water, sanitation, hygiene
  const waterDeaths = 1_400_000;
  breakdowns.push({
    cause: "Unsafe Water & Sanitation",
    causeKey: "water",
    annualDeaths: waterDeaths,
    perDay: Math.round(waterDeaths / 365),
    perHour: Math.round(waterDeaths / 365 / 24),
    perMinute: Math.round(waterDeaths / 365 / 24 / 60),
    perSecond: +(waterDeaths / 365 / 24 / 60 / 60).toFixed(2),
    preventionCostBillion: 114,
    preventionNote: "SDG 6 — universal access to water & sanitation by 2030",
    icon: "💧",
  });

  // 5. Preventable diseases (malaria, TB, HIV, vaccine-preventable)
  // WHO: TB ~1.3M, Malaria ~600K, HIV ~600K, vaccine-preventable ~1.5M
  const diseaseDeaths = 4_000_000;
  breakdowns.push({
    cause: "Preventable Diseases (TB, Malaria, HIV, Vaccine-preventable)",
    causeKey: "disease",
    annualDeaths: diseaseDeaths,
    perDay: Math.round(diseaseDeaths / 365),
    perHour: Math.round(diseaseDeaths / 365 / 24),
    perMinute: Math.round(diseaseDeaths / 365 / 24 / 60),
    perSecond: +(diseaseDeaths / 365 / 24 / 60 / 60).toFixed(2),
    preventionNote: "These diseases are treatable and often curable with existing tools",
    icon: "⚕️",
  });

  return breakdowns;
}

/* ═══════════════════════════════════════════════════════════
   REAL-TIME TOLL
   ═══════════════════════════════════════════════════════════ */

/**
 * Compute the real-time toll counter since a given start time.
 */
export function computeRealTimeToll(
  causes: TollBreakdown[],
  startedAt: number,
  now = Date.now(),
): RealTimeToll {
  const elapsedSeconds = (now - startedAt) / 1000;
  const perSecond = causes.reduce((sum, c) => sum + c.perSecond, 0);

  // Today's deaths: proportion of today elapsed * daily rate
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todaySeconds = (now - startOfDay.getTime()) / 1000;
  const perDay = causes.reduce((sum, c) => sum + c.perDay, 0);
  const today = Math.floor((todaySeconds / 86400) * perDay);

  return {
    sinceVisit: Math.floor(elapsedSeconds * perSecond),
    today,
    perSecond: +perSecond.toFixed(1),
    causes,
    startedAt,
  };
}

/* ═══════════════════════════════════════════════════════════
   PER-COUNTRY TOLL
   ═══════════════════════════════════════════════════════════ */

/**
 * Compute the estimated annual preventable death toll for a specific country.
 */
export function computeCountryToll(country: CountryData): {
  childDeaths: number;
  conflictDeaths: number;
  hungerDeaths: number;
  total: number;
} {
  const pop = country.demographics.population;
  const births = pop / 1000 * 18; // approximate annual births
  const childMortality = country.health.child_mortality_under5_per1k ?? 0;
  const childDeaths = Math.round(childMortality * births);

  const conflictDeaths = country.conflict.battle_deaths_total || 0;

  // Estimate hunger deaths proportional to undernourishment
  const undernourishment = country.hunger.undernourishment_pct ?? 0;
  const hungerPop = (undernourishment / 100) * pop;
  // Global hunger death rate is ~0.12% of undernourished population per year
  const hungerDeaths = Math.round(hungerPop * 0.0012);

  return {
    childDeaths,
    conflictDeaths,
    hungerDeaths,
    total: childDeaths + conflictDeaths + hungerDeaths,
  };
}

/* ═══════════════════════════════════════════════════════════
   FORMATTING
   ═══════════════════════════════════════════════════════════ */

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatTollSentence(toll: TollBreakdown): string {
  const rate = toll.perSecond >= 1
    ? `one every ${(1 / toll.perSecond).toFixed(1)} seconds`
    : `${toll.perMinute} per minute`;
  return `Every year, ${formatNumber(toll.annualDeaths)} people die from ${toll.cause}. That's ${rate}.`;
}

/* ═══════════════════════════════════════════════════════════
   MEMORIAL ENTRIES
   ═══════════════════════════════════════════════════════════ */

export function createMemorialEntry(
  name: string,
  cause: string,
  country: string,
  year: number,
  message: string,
): MemorialEntry {
  return {
    id: crypto.randomUUID(),
    name,
    cause,
    country,
    year,
    message,
    addedAt: Date.now(),
  };
}
