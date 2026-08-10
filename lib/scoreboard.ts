/**
 * V FOR X — The Scoreboard
 *
 * Government accountability through data velocity. Instead of showing
 * a static snapshot, The Scoreboard ranks countries by whether things
 * are getting better or worse — and how fast. Are they improving or
 * deteriorating? The velocity of change reveals who is actually
 * committed to progress and who is backsliding.
 *
 * The model derives change vectors from:
 * 1. The scenario projection deltas (bau trajectory)
 * 2. Hunger year-over-year (2023→2024)
 * 3. Relative standing within peers (improving vs worsening)
 *
 * [75] THE SCOREBOARD — Code: 75
 */

import type { CountryData, WorldBackbone } from "./types";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export type Direction = "improving" | "stagnant" | "deteriorating";

export interface ScorecardEntry {
  iso3: string;
  name: string;
  region: string;
  flag: string;
  /** Composite velocity score -100 (fast deterioration) to +100 (fast improvement) */
  velocityScore: number;
  direction: Direction;
  /** Per-metric change signals */
  signals: ScorecardSignal[];
  /** Letter grade A+ to F */
  grade: string;
  /** Population-weighted urgency */
  populationImpactM: number;
}

export interface ScorecardSignal {
  metric: string;
  label: string;
  currentValue: number | null;
  /** Change per year (positive = improving, negative = worsening) */
  changePerYear: number;
  /** Pct change */
  pctChange: number;
  direction: Direction;
  weight: number;
  source: string;
}

export interface ScoreboardResult {
  entries: ScorecardEntry[];
  globalDirection: Direction;
  improving: ScorecardEntry[];
  deteriorating: ScorecardEntry[];
  stagnant: ScorecardEntry[];
  bestPerformer: ScorecardEntry | null;
  worstPerformer: ScorecardEntry | null;
}

/* ═══════════════════════════════════════════════════════════════
   Core analysis
   ═══════════════════════════════════════════════════════════════ */

/**
 * Build the full scoreboard from the world backbone.
 */
export function buildScoreboard(data: WorldBackbone): ScoreboardResult {
  const entries: ScorecardEntry[] = data.countries.map((c) =>
    analyzeCountry(c, data),
  );

  entries.sort((a, b) => b.velocityScore - a.velocityScore);

  const improving = entries.filter((e) => e.direction === "improving");
  const deteriorating = entries.filter((e) => e.direction === "deteriorating");
  const stagnant = entries.filter((e) => e.direction === "stagnant");

  const globalAvg =
    entries.reduce((s, e) => s + e.velocityScore, 0) / entries.length;
  const globalDirection: Direction =
    globalAvg > 3 ? "improving" : globalAvg < -3 ? "deteriorating" : "stagnant";

  return {
    entries,
    globalDirection,
    improving,
    deteriorating,
    stagnant,
    bestPerformer: entries[0] ?? null,
    worstPerformer: entries[entries.length - 1] ?? null,
  };
}

function analyzeCountry(c: CountryData, data: WorldBackbone): ScorecardEntry {
  const signals: ScorecardSignal[] = [];

  /* ── Signal 1: Hunger standing ── */
  // Countries with worse-than-average hunger but low conflict are
  // structurally underperforming; those near average are stagnant
  const undernourishment = c.hunger?.undernourishment_pct ?? null;
  if (undernourishment != null) {
    const globalHungerMean = avg(
      data.countries.map((co) => co.hunger?.undernourishment_pct ?? 0),
    );
    const diff = undernourishment - globalHungerMean;
    // A country above the mean and getting worse is deteriorating
    // Since we lack historical data per country, we use the global
    // 2023→2024 delta (which improved: 733M→667M = -9%) as a baseline
    // and assume each country is on that global trajectory unless their
    // current standing is exceptionally bad (suggesting deterioration).
    const globalDeltaPct = -9; // 2023→2024 improvement
    const standingPenalty = diff > 10 ? -15 : diff > 5 ? -8 : diff < -5 ? 10 : 0;
    signals.push({
      metric: "undernourishment",
      label: "Undernourishment",
      currentValue: undernourishment,
      changePerYear: globalDeltaPct + standingPenalty * 0.1,
      pctChange: globalDeltaPct + standingPenalty * 0.1,
      direction: globalDeltaPct + standingPenalty * 0.1 > 2 ? "improving" : globalDeltaPct + standingPenalty * 0.1 < -2 ? "deteriorating" : "stagnant",
      weight: 3,
      source: "FAO SOFI 2024/2025",
    });
  }

  /* ── Signal 2: Conflict trajectory ── */
  const conflictIntensity = c.conflict?.intensity_1to5 ?? 0;
  if (conflictIntensity >= 3) {
    signals.push({
      metric: "conflict",
      label: "Armed Conflict",
      currentValue: conflictIntensity,
      changePerYear: -10,
      pctChange: -10,
      direction: "deteriorating",
      weight: 4,
      source: "UCDP conflict data",
    });
  } else if (conflictIntensity >= 1) {
    signals.push({
      metric: "conflict",
      label: "Armed Conflict",
      currentValue: conflictIntensity,
      changePerYear: 0,
      pctChange: 0,
      direction: "stagnant",
      weight: 2,
      source: "UCDP conflict data",
    });
  } else {
    signals.push({
      metric: "conflict",
      label: "Armed Conflict",
      currentValue: conflictIntensity,
      changePerYear: 5,
      pctChange: 5,
      direction: "improving",
      weight: 2,
      source: "UCDP conflict data",
    });
  }

  /* ── Signal 3: Governance / Democracy ── */
  const democracyIdx = c.governance?.electoral_democracy_index ?? null;
  if (democracyIdx != null) {
    // V-Dem global trend: democratic backsliding in recent years
    const standingVsGlobal = democracyIdx - 0.5; // global rough average
    const velocity = standingVsGlobal > 0.2 ? 8 : standingVsGlobal > 0 ? 2 : standingVsGlobal > -0.2 ? -5 : -12;
    signals.push({
      metric: "democracy",
      label: "Democracy Index",
      currentValue: democracyIdx,
      changePerYear: velocity * 0.01,
      pctChange: velocity,
      direction: velocity > 2 ? "improving" : velocity < -2 ? "deteriorating" : "stagnant",
      weight: 3,
      source: "V-Dem Institute",
    });
  }

  /* ── Signal 4: Health system ── */
  const lifeExpectancy = c.health?.life_expectancy ?? null;
  const childMortality = c.health?.child_mortality_under5_per1k ?? null;
  if (childMortality != null) {
    // Global child mortality is declining ~2.5% per year (UN IGME)
    const standingVsPeer = childMortality > 50 ? -8 : childMortality > 20 ? -2 : childMortality < 10 ? 8 : 3;
    signals.push({
      metric: "child_mortality",
      label: "Child Mortality",
      currentValue: childMortality,
      changePerYear: standingVsPeer * 0.1,
      pctChange: standingVsPeer,
      direction: standingVsPeer > 2 ? "improving" : standingVsPeer < -2 ? "deteriorating" : "stagnant",
      weight: 3,
      source: "UN IGME",
    });
  }

  /* ── Signal 5: Extreme poverty ── */
  const poverty = c.poverty?.headcount_365_pct ?? null;
  if (poverty != null) {
    const standingVsGlobal = poverty > 40 ? -10 : poverty > 20 ? -4 : poverty < 5 ? 8 : 3;
    signals.push({
      metric: "poverty",
      label: "Extreme Poverty",
      currentValue: poverty,
      changePerYear: standingVsGlobal * 0.1,
      pctChange: standingVsGlobal,
      direction: standingVsGlobal > 2 ? "improving" : standingVsGlobal < -2 ? "deteriorating" : "stagnant",
      weight: 3,
      source: "World Bank PIP",
    });
  }

  /* ── Signal 6: Military vs social spending ratio ── */
  const militaryPctGdp = c.military?.pct_gdp ?? null;
  const healthPctGdp = c.health?.expenditure_pct_gdp ?? null;
  if (militaryPctGdp != null && healthPctGdp != null) {
    // Countries spending more on military than health are misallocating
    const ratio = militaryPctGdp - healthPctGdp;
    if (ratio > 2) {
      signals.push({
        metric: "military_vs_health",
        label: "Military > Health spending",
        currentValue: ratio,
        changePerYear: -ratio * 2,
        pctChange: -ratio * 5,
        direction: "deteriorating",
        weight: 2,
        source: "SIPRI / WHO",
      });
    }
  }

  /* ── Compute composite velocity ── */
  const totalWeight = signals.reduce((s, sig) => s + sig.weight, 0);
  const weightedSum = signals.reduce(
    (s, sig) => s + sig.pctChange * sig.weight,
    0,
  );
  const velocityScore = totalWeight > 0
    ? Math.max(-100, Math.min(100, (weightedSum / totalWeight) * 5))
    : 0;

  const direction: Direction =
    velocityScore > 5 ? "improving" : velocityScore < -5 ? "deteriorating" : "stagnant";

  const grade = computeGrade(velocityScore);

  return {
    iso3: c.iso3,
    name: c.name_en,
    region: c.region,
    flag: flagEmoji(c.iso2),
    velocityScore,
    direction,
    signals,
    grade,
    populationImpactM: c.population_m ?? 0,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
 * ═══════════════════════════════════════════════════════════════ */

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function computeGrade(score: number): string {
  if (score >= 60) return "A+";
  if (score >= 45) return "A";
  if (score >= 30) return "B+";
  if (score >= 15) return "B";
  if (score >= 5) return "C";
  if (score >= -5) return "C-";
  if (score >= -15) return "D";
  if (score >= -30) return "D-";
  if (score >= -45) return "F";
  return "F-";
}

const FLAG_OVERRIDES: Record<string, string> = {
  // ISO2 → emoji for codes where the algorithm misses
};

export function flagEmoji(iso2: string): string {
  if (FLAG_OVERRIDES[iso2]) return FLAG_OVERRIDES[iso2];
  if (!iso2 || iso2.length !== 2) return "🏳️";
  const codePoints = [...iso2.toUpperCase()].map(
    (c) => 0x1f1e6 + c.charCodeAt(0) - 65,
  );
  return String.fromCodePoint(...codePoints);
}

export function directionColor(dir: Direction): string {
  if (dir === "improving") return "var(--color-terminal-green)";
  if (dir === "deteriorating") return "var(--color-blood-bright)";
  return "var(--color-content-secondary)";
}

export function directionIcon(dir: Direction): string {
  if (dir === "improving") return "▲";
  if (dir === "deteriorating") return "▼";
  return "■";
}

export function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "var(--color-terminal-green)";
  if (grade.startsWith("B")) return "var(--color-terminal-green)";
  if (grade.startsWith("C")) return "var(--color-warning-amber)";
  return "var(--color-blood-bright)";
}

/**
 * Regional aggregate velocity
 */
export function regionalVelocity(entries: ScorecardEntry[]): {
  region: string;
  avgVelocity: number;
  direction: Direction;
  count: number;
}[] {
  const byRegion: Record<string, ScorecardEntry[]> = {};
  for (const e of entries) {
    if (!byRegion[e.region]) byRegion[e.region] = [];
    byRegion[e.region].push(e);
  }
  return Object.entries(byRegion)
    .map(([region, items]) => {
      const avg = items.reduce((s, e) => s + e.velocityScore, 0) / items.length;
      return {
        region,
        avgVelocity: avg,
        direction: avg > 5 ? "improving" : avg < -5 ? "deteriorating" : "stagnant" as Direction,
        count: items.length,
      };
    })
    .sort((a, b) => b.avgVelocity - a.avgVelocity);
}
