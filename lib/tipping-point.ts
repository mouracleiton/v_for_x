/**
 * V FOR X — The Tipping Point
 *
 * Early warning system. Every country sits somewhere on a spectrum of
 * structural stress. The Tipping Point module measures how close each
 * country is to critical thresholds — famine, conflict escalation,
 * state collapse, health system breakdown — and flags those approaching
 * the edge before the crisis is declared.
 *
 * Different from The Sentinel (which monitors real-time alerts) —
 * The Tipping Point measures structural proximity to collapse based
 * on the underlying data, not event-driven signals.
 *
 * [76] THE TIPPING POINT — Code: 76
 */

import type { CountryData, WorldBackbone } from "./types";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export type AlertLevel = "critical" | "severe" | "warning" | "watch" | "stable";

export interface Threshold {
  id: string;
  label: string;
  dimension: string;
  /** The metric extractor */
  extract: (c: CountryData) => number | null;
  /** The critical threshold value */
  criticalValue: number;
  /** Direction: "above" = crisis when value ≥ criticalValue, "below" = crisis when value ≤ criticalValue */
  direction: "above" | "below";
  unit: string;
  description: string;
  /** What happens when this threshold is crossed */
  consequence: string;
}

export interface CountryTipping {
  iso3: string;
  name: string;
  region: string;
  populationM: number;
  /** Overall proximity to tipping — 0 (safe) to 100 (at threshold) */
  proximityScore: number;
  alertLevel: AlertLevel;
  /** Per-threshold assessments */
  thresholds: ThresholdAssessment[];
  /** Number of thresholds at critical proximity */
  criticalCount: number;
  /** The single most dangerous threshold */
  mostDangerous: ThresholdAssessment | null;
}

export interface ThresholdAssessment {
  threshold: Threshold;
  currentValue: number | null;
  /** 0-100: how close to the tipping point (100 = at/beyond threshold) */
  proximity: number;
  /** Whether the threshold has been crossed */
  crossed: boolean;
  alertLevel: AlertLevel;
}

export interface TippingPointResult {
  countries: CountryTipping[];
  critical: CountryTipping[];
  severe: CountryTipping[];
  warning: CountryTipping[];
  globalAlerts: number;
  populationAtRiskM: number;
  thresholdsBreached: number;
}

/* ═══════════════════════════════════════════════════════════════
   Threshold definitions
 *
 * Each threshold is based on internationally recognized crisis
 * standards: IPC famine classification, WHO health worker density,
 * World Bank poverty lines, V-Dem autocratization thresholds, etc.
 * ═══════════════════════════════════════════════════════════════ */

export const THRESHOLDS: Threshold[] = [
  {
    id: "famine_risk",
    label: "Famine / Catastrophic Hunger",
    dimension: "Hunger",
    extract: (c) => c.hunger?.famine_risk_1to5 ?? null,
    criticalValue: 4,
    direction: "above",
    unit: "/5",
    description: "IPC Phase 4+ famine risk",
    consequence: "Mass casualties from starvation; irreversible child development damage",
  },
  {
    id: "acute_hunger_pct",
    label: "Acute Food Insecurity",
    dimension: "Hunger",
    extract: (c) => c.hunger?.prevalence_pct ?? null,
    criticalValue: 35,
    direction: "above",
    unit: "%",
    description: "Over 35% of population in acute food crisis",
    consequence: "Widespread malnutrition; mortality spike",
  },
  {
    id: "conflict_intensity",
    label: "Active Armed Conflict",
    dimension: "Conflict",
    extract: (c) => c.conflict?.intensity_1to5 ?? null,
    criticalValue: 4,
    direction: "above",
    unit: "/5",
    description: "High-intensity armed conflict",
    consequence: "Mass displacement; infrastructure destruction; civilian casualties",
  },
  {
    id: "displacement",
    label: "Mass Displacement",
    dimension: "Conflict",
    extract: (c) => c.conflict?.displacement_m ?? null,
    criticalValue: 5,
    direction: "above",
    unit: "M",
    description: "Over 5M people displaced",
    consequence: "Regional destabilization; humanitarian emergency",
  },
  {
    id: "child_mortality",
    label: "Child Mortality Crisis",
    dimension: "Health",
    extract: (c) => c.health?.child_mortality_under5_per1k ?? null,
    criticalValue: 80,
    direction: "above",
    unit: "/1k",
    description: "Under-5 mortality above 80/1,000 (SDG 'red zone')",
    consequence: "Preventable child deaths at catastrophic scale",
  },
  {
    id: "doctor_density",
    label: "Health Worker Collapse",
    dimension: "Health",
    extract: (c) => c.health?.doctors_per_1000 ?? null,
    criticalValue: 1,
    direction: "below",
    unit: "/1k",
    description: "Fewer than 1 doctor per 1,000 people (WHO minimum)",
    consequence: "Health system cannot respond to emergencies; preventable deaths",
  },
  {
    id: "extreme_poverty",
    label: "Extreme Poverty Emergency",
    dimension: "Poverty",
    extract: (c) => c.poverty?.headcount_365_pct ?? null,
    criticalValue: 50,
    direction: "above",
    unit: "%",
    description: "Over half the population in extreme poverty",
    consequence: "Systemic deprivation; multi-generational poverty trap",
  },
  {
    id: "democracy_collapse",
    label: "Democratic Collapse",
    dimension: "Governance",
    extract: (c) => c.governance?.electoral_democracy_index ?? null,
    criticalValue: 0.2,
    direction: "below",
    unit: "0-1",
    description: "Electoral democracy index below 0.2 (autocracy threshold)",
    consequence: "No peaceful mechanism for change; repression; unrest",
  },
  {
    id: "water_crisis",
    label: "Water Access Crisis",
    dimension: "Water",
    extract: (c) => c.water_sanitation?.basic_access_pct ?? null,
    criticalValue: 60,
    direction: "below",
    unit: "%",
    description: "Less than 60% have basic drinking water",
    consequence: "Waterborne disease outbreaks; dehydration deaths",
  },
  {
    id: "literacy_crisis",
    label: "Education Collapse",
    dimension: "Education",
    extract: (c) => c.education?.literacy_rate_pct ?? null,
    criticalValue: 50,
    direction: "below",
    unit: "%",
    description: "Less than 50% adult literacy",
    consequence: "Generational exclusion from economic participation",
  },
  {
    id: "homicide_crisis",
    label: "Violence Epidemic",
    dimension: "Security",
    extract: (c) => c.security?.homicide_rate_per100k ?? null,
    criticalValue: 30,
    direction: "above",
    unit: "/100k",
    description: "Homicide rate above 30/100k (epidemic level)",
    consequence: "Breakdown of public safety; mass trauma",
  },
  {
    id: "air_pollution",
    label: "Toxic Air",
    dimension: "Environment",
    extract: (c) => c.environment?.air_pollution_pm25_ugm3 ?? null,
    criticalValue: 35,
    direction: "above",
    unit: "µg/m³",
    description: "PM2.5 above WHO interim target (35 µg/m³)",
    consequence: "Respiratory disease; reduced life expectancy",
  },
];

/* ═══════════════════════════════════════════════════════════════
   Core analysis
 * ═══════════════════════════════════════════════════════════════ */

export function analyzeTippingPoints(data: WorldBackbone): TippingPointResult {
  const countries: CountryTipping[] = data.countries.map((c) =>
    analyzeCountryTipping(c),
  );

  countries.sort((a, b) => b.proximityScore - a.proximityScore);

  const critical = countries.filter((c) => c.alertLevel === "critical");
  const severe = countries.filter((c) => c.alertLevel === "severe");
  const warning = countries.filter((c) => c.alertLevel === "warning");

  const populationAtRiskM = [...critical, ...severe].reduce(
    (s, c) => s + c.populationM,
    0,
  );

  const thresholdsBreached = countries.reduce(
    (s, c) => s + c.criticalCount,
    0,
  );

  return {
    countries,
    critical,
    severe,
    warning,
    globalAlerts: critical.length + severe.length,
    populationAtRiskM,
    thresholdsBreached,
  };
}

function analyzeCountryTipping(c: CountryData): CountryTipping {
  const assessments: ThresholdAssessment[] = [];

  for (const t of THRESHOLDS) {
    const value = t.extract(c);
    if (value == null) continue;

    const proximity = computeProximity(value, t);
    const crossed =
      t.direction === "above" ? value >= t.criticalValue : value <= t.criticalValue;

    assessments.push({
      threshold: t,
      currentValue: value,
      proximity,
      crossed,
      alertLevel: proximityToAlert(proximity, crossed),
    });
  }

  // Composite proximity = max of all threshold proximities (worst case)
  const proximityScore = assessments.length > 0
    ? Math.max(...assessments.map((a) => a.proximity))
    : 0;

  const criticalCount = assessments.filter((a) => a.crossed).length;

  const mostDangerous = assessments.length > 0
    ? assessments.reduce((max, a) => (a.proximity > max.proximity ? a : max))
    : null;

  const alertLevel = determineAlertLevel(proximityScore, criticalCount);

  return {
    iso3: c.iso3,
    name: c.name_en,
    region: c.region,
    populationM: c.population_m ?? 0,
    proximityScore,
    alertLevel,
    thresholds: assessments.sort((a, b) => b.proximity - a.proximity),
    criticalCount,
    mostDangerous,
  };
}

/**
 * Compute proximity 0-100 to a threshold.
 *
 * For "above" thresholds: proximity grows as value approaches criticalValue.
 *   ratio = value / critical; proximity = ratio × 100 (capped at 100).
 *
 * For "below" thresholds: proximity decreases as value exceeds criticalValue.
 *   Uses margin-based formula: proximity = max(0, 100 − margin/critical × 100)
 *   where margin = value − critical. This gives:
 *     − value at 2× critical → proximity ≈ 0 (very safe)
 *     − value just above critical → proximity ≈ 100 (on the edge)
 */
function computeProximity(value: number, t: Threshold): number {
  if (t.direction === "above") {
    if (value <= 0) return 0;
    const ratio = value / t.criticalValue;
    return Math.min(100, ratio * 100);
  } else {
    if (value <= t.criticalValue) return 100;
    const margin = value - t.criticalValue;
    return Math.max(0, 100 - (margin / t.criticalValue) * 100);
  }
}

function proximityToAlert(proximity: number, crossed: boolean): AlertLevel {
  if (crossed || proximity >= 100) return "critical";
  if (proximity >= 85) return "severe";
  if (proximity >= 70) return "warning";
  if (proximity >= 50) return "watch";
  return "stable";
}

function determineAlertLevel(proximity: number, criticalCount: number): AlertLevel {
  if (criticalCount >= 3 || proximity >= 90) return "critical";
  if (criticalCount >= 2 || proximity >= 80) return "severe";
  if (criticalCount >= 1 || proximity >= 65) return "warning";
  if (proximity >= 45) return "watch";
  return "stable";
}

/* ═══════════════════════════════════════════════════════════════
   Display helpers
 * ═══════════════════════════════════════════════════════════════ */

export function alertColor(level: AlertLevel): string {
  switch (level) {
    case "critical": return "var(--color-blood-bright)";
    case "severe": return "var(--color-blood)";
    case "warning": return "var(--color-warning-amber)";
    case "watch": return "var(--color-terminal-green)";
    case "stable": return "var(--color-content-secondary)";
  }
}

export function alertIcon(level: AlertLevel): string {
  switch (level) {
    case "critical": return "🔴";
    case "severe": return "🟠";
    case "warning": return "🟡";
    case "watch": return "🟢";
    case "stable": return "⚪";
  }
}

export function alertLabel(level: AlertLevel): string {
  switch (level) {
    case "critical": return "CRITICAL";
    case "severe": return "SEVERE";
    case "warning": return "WARNING";
    case "watch": return "WATCH";
    case "stable": return "STABLE";
  }
}

/**
 * Aggregate: count countries at each alert level per dimension
 */
export function dimensionBreakdown(
  countries: CountryTipping[],
): { dimension: string; critical: number; severe: number; warning: number }[] {
  const byDimension: Record<string, { critical: number; severe: number; warning: number }> = {};

  for (const c of countries) {
    for (const a of c.thresholds) {
      const dim = a.threshold.dimension;
      if (!byDimension[dim]) byDimension[dim] = { critical: 0, severe: 0, warning: 0 };
      if (a.alertLevel === "critical") byDimension[dim].critical++;
      else if (a.alertLevel === "severe") byDimension[dim].severe++;
      else if (a.alertLevel === "warning") byDimension[dim].warning++;
    }
  }

  return Object.entries(byDimension)
    .map(([dimension, counts]) => ({ dimension, ...counts }))
    .sort((a, b) => (b.critical + b.severe) - (a.critical + a.severe));
}
