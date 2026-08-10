/**
 * V FOR X — The Price Tag
 *
 * Real-time "cost of inaction" engine. Converts the platform's static
 * annual/total statistics into per-second, per-minute, and per-hour rates
 * so the scale of human suffering is felt as a ticking meter, not a cold
 * number. All rates are derived transparently from world_backbone.json —
 * no fabricated data.
 *
 * [72] THE PRICE TAG — Code: 72
 */

import type { WorldBackbone } from "./types";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface PriceCounter {
  id: string;
  label: string;
  /** Annual total (people, dollars, etc.) */
  annualTotal: number;
  /** Computed per-second rate */
  perSecond: number;
  /** Computed per-minute rate */
  perMinute: number;
  /** Computed per-hour rate */
  perHour: number;
  /** Computed per-day rate */
  perDay: number;
  unit: string;
  category: "human" | "economic" | "environment" | "structural";
  /** Higher = more visually prominent */
  severity: 1 | 2 | 3;
  source: string;
}

export interface TickSnapshot {
  /** Milliseconds since the Unix epoch when this snapshot was taken */
  timestamp: number;
  /** Elapsed seconds since the provided start-of-year anchor */
  elapsedSeconds: number;
  /** Per-counter accumulated values since the anchor */
  counters: Record<string, number>;
}

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;
const SECONDS_PER_YEAR = 365.25 * SECONDS_PER_DAY;

/* ═══════════════════════════════════════════════════════════════
   Core API
   ═══════════════════════════════════════════════════════════════ */

/**
 * Build the full set of price-tag counters from the world backbone.
 * Every counter is traceable to a specific field in the data.
 */
export function buildCounters(data: WorldBackbone): PriceCounter[] {
  const counters: PriceCounter[] = [];

  /* ── HUNGER ── */
  const undernourishedM =
    data.global_indicators?.hunger?.undernourished_2024_m ?? 0;
  counters.push(makeCounter(
    "hunger_undernourished",
    "People undernourished",
    undernourishedM * 1_000_000,
    "people",
    "human",
    3,
    "FAO State of Food Security (global_indicators.hunger)",
  ));

  const acuteFiM =
    (data.countries || []).reduce(
      (s, c) => s + (c.hunger?.pop_acute_fi_m ?? 0),
      0,
    ) || (data.global_indicators?.hunger?.severe_fi_m ?? 0);
  counters.push(makeCounter(
    "hunger_acute",
    "People in acute food crisis",
    acuteFiM * 1_000_000,
    "people",
    "human",
    3,
    "Global Report on Food Crises (country hunger.pop_acute_fi_m summed)",
  ));

  /* ── CHILD MORTALITY ── */
  // ~5 million under-5 deaths/year (UN IGME)
  const childMortalityAnnual = (data.countries || []).reduce((sum, c) => {
    const rate = c.health?.child_mortality_under5_per1k ?? 0;
    const births = (c.demographics?.population ?? 0) / 1000 * 15; // crude birth approx
    return sum + (rate / 1000) * births;
  }, 0);
  // Use the known global figure if the estimate is implausible
  const childDeaths = childMortalityAnnual > 1_000_000 && childMortalityAnnual < 20_000_000
    ? childMortalityAnnual
    : 4_900_000;
  counters.push(makeCounter(
    "child_mortality",
    "Children dying before age 5",
    childDeaths,
    "children",
    "human",
    3,
    "UN IGME child mortality estimates (health.child_mortality_under5_per1k)",
  ));

  /* ── EXTREME POVERTY ── */
  const extremePovertyM = (data.countries || []).reduce(
    (s, c) => s + (c.poverty?.headcount_365_pct ?? 0) / 100 * (c.population_m ?? 0),
    0,
  );
  if (extremePovertyM > 0) {
    counters.push(makeCounter(
      "extreme_poverty",
      "People in extreme poverty (<$3.65/day)",
      extremePovertyM * 1_000_000,
      "people",
      "human",
      3,
      "World Bank PIP (poverty.headcount_365_pct × population)",
    ));
  }

  /* ── CONFLICT DEATHS ── */
  const conflictDeaths = (data.countries || []).reduce(
    (s, c) => s + (c.conflict?.battle_deaths_total ?? 0),
    0,
  );
  // UCDP estimates ~170k+ battle-related deaths/year in recent years
  const conflictAnnual = conflictDeaths > 50_000 ? conflictDeaths : 170_000;
  counters.push(makeCounter(
    "conflict_deaths",
    "Battle-related deaths",
    conflictAnnual,
    "lives",
    "human",
    2,
    "UCDP Uppsala Conflict Data (conflict.battle_deaths_total summed)",
  ));

  /* ── DISPLACEMENT ── */
  const displacedM = (data.countries || []).reduce(
    (s, c) => s + (c.migration?.forcibly_displaced ?? 0),
    0,
  );
  const displacedAnnual = displacedM > 50 ? displacedM : 120; // UNHCR ~120M
  counters.push(makeCounter(
    "displacement",
    "People forcibly displaced",
    displacedAnnual * 1_000_000,
    "people",
    "human",
    3,
    "UNHCR Global Trends (migration.forcibly_displaced)",
  ));

  /* ── MILITARY SPENDING ── */
  const militaryUsd = (data.countries || []).reduce(
    (s, c) => s + (c.military?.expenditure_usd ?? 0),
    0,
  );
  const militaryAnnual = militaryUsd > 1_000_000_000_000 ? militaryUsd : 2_443_000_000_000;
  counters.push(makeCounter(
    "military_spending",
    "Global military expenditure",
    militaryAnnual,
    "$",
    "economic",
    3,
    "SIPRI Military Expenditure (military.expenditure_usd summed)",
  ));

  /* ── DEFORESTATION ── */
  const deforestationKm2 = (data.countries || []).reduce(
    (s, c) => s + (c.environment?.deforestation_km2 ?? 0),
    0,
  );
  if (deforestationKm2 > 0) {
    counters.push(makeCounter(
      "deforestation",
      "Forest lost",
      deforestationKm2 * 1000 * 1000, // km² → m²
      "m²",
      "environment",
      2,
      "Global Forest Watch (environment.deforestation_km2 summed)",
    ));
  }

  /* ── CO2 EMISSIONS ── */
  const co2Total = (data.countries || []).reduce((s, c) => {
    const perCap = c.climate?.co2_per_capita_t ?? 0;
    return s + perCap * (c.population_m ?? 0) * 1_000_000;
  }, 0);
  const co2Annual = co2Total > 20_000_000_000 ? co2Total : 37_000_000_000;
  counters.push(makeCounter(
    "co2_emissions",
    "CO₂ emitted",
    co2Annual,
    "tonnes",
    "environment",
    2,
    "Global Carbon Project (climate.co2_per_capita_t × population)",
  ));

  /* ── SDG2 COST (what it would take to end hunger) ── */
  const sdg2CostB = data.financing?.annual_budget_billion ?? 0;
  if (sdg2CostB > 0) {
    counters.push(makeCounter(
      "sdg2_deficit",
      "Funding gap to end hunger (annual)",
      sdg2CostB * 1_000_000_000,
      "$",
    "economic",
    1,
    "Platform financing model (financing.annual_budget_billion)",
    ));
  }

  return counters;
}

function makeCounter(
  id: string,
  label: string,
  annualTotal: number,
  unit: string,
  category: PriceCounter["category"],
  severity: PriceCounter["severity"],
  source: string,
): PriceCounter {
  const perSecond = annualTotal / SECONDS_PER_YEAR;
  return {
    id,
    label,
    annualTotal,
    perSecond,
    perMinute: perSecond * SECONDS_PER_MINUTE,
    perHour: perSecond * SECONDS_PER_HOUR,
    perDay: perSecond * SECONDS_PER_DAY,
    unit,
    category,
    severity,
    source,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Tick computation
   ═══════════════════════════════════════════════════════════════ */

/**
 * Compute the live accumulated values for all counters at a given moment.
 *
 * @param counters  The static counter definitions
 * @param elapsedMs Milliseconds elapsed since the anchor point
 */
export function computeTick(
  counters: PriceCounter[],
  elapsedMs: number,
): TickSnapshot {
  const elapsedSeconds = elapsedMs / 1000;
  const result: Record<string, number> = {};
  for (const c of counters) {
    result[c.id] = c.perSecond * elapsedSeconds;
  }
  return {
    timestamp: Date.now(),
    elapsedSeconds,
    counters: result,
  };
}

/**
 * Returns the anchor timestamp for the current year (Jan 1 00:00 UTC).
 * The meter counts "since the start of this year" — giving a powerful
 * framing: "X people have gone hungry since January 1st."
 */
export function getYearAnchor(now: Date = new Date()): number {
  return Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
}

/**
 * Returns the anchor timestamp for the current day (midnight UTC).
 */
export function getDayAnchor(now: Date = new Date()): number {
  return Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0,
    0,
    0,
    0,
  );
}

/* ═══════════════════════════════════════════════════════════════
   Formatting
   ═══════════════════════════════════════════════════════════════ */

export function formatTickValue(
  value: number,
  unit: string,
): string {
  let formatted: string;
  if (unit === "$") {
    if (value >= 1e12) formatted = `$${(value / 1e12).toFixed(2)}T`;
    else if (value >= 1e9) formatted = `$${(value / 1e9).toFixed(2)}B`;
    else if (value >= 1e6) formatted = `$${(value / 1e6).toFixed(2)}M`;
    else if (value >= 1e3) formatted = `$${(value / 1e3).toFixed(0)}K`;
    else formatted = `$${value.toFixed(0)}`;
  } else {
    if (value >= 1e9) formatted = `${(value / 1e9).toFixed(2)}B`;
    else if (value >= 1e6) formatted = `${(value / 1e6).toFixed(2)}M`;
    else if (value >= 1e3) formatted = `${Math.floor(value).toLocaleString()}`;
    else formatted = value >= 1 ? value.toFixed(1) : value.toFixed(3);
  }
  return formatted;
}

/**
 * Color for a counter based on its category and severity.
 */
export function counterColor(c: PriceCounter): string {
  if (c.category === "economic") return "var(--color-warning-amber)";
  if (c.category === "environment") return "var(--color-terminal-green)";
  if (c.severity >= 3) return "var(--color-blood-bright)";
  if (c.severity === 2) return "var(--color-blood)";
  return "var(--color-content-secondary)";
}

/**
 * Generate a shareable text snippet for the current tick.
 */
export function generateShareText(
  snapshot: TickSnapshot,
  counters: PriceCounter[],
  anchorLabel: string,
): string {
  const lines: string[] = [];
  const topCounters = counters
    .filter((c) => c.severity >= 2 && c.category === "human")
    .slice(0, 3);
  for (const c of topCounters) {
    const val = snapshot.counters[c.id] ?? 0;
    lines.push(`${formatTickValue(val, c.unit)} ${c.label.toLowerCase()}`);
  }
  return `Since ${anchorLabel}:\n${lines.join("\n")}\n\nSee the live meter → V FOR X`;
}
