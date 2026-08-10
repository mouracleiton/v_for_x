/**
 * V FOR X — The Watch (Threshold Alert Rules)
 *
 * Proactive monitoring of crisis data. Define threshold rules like
 * "alert me when country X's hunger prevalence exceeds 30%" or
 * "alert me when any country's risk score crosses 70".
 *
 * Rules are evaluated against the world_backbone data on each visit.
 * Since V FOR X is fully static (no backend), alerts are evaluated
 * client-side — results are shown on page load, not pushed.
 *
 * Integrates with:
 *   - lib/risk-model.ts for risk score evaluation
 *   - lib/idb.ts for persistence (shares the alert_rules store)
 */

import type { WorldBackbone, CountryData } from "./types";
import { calculateRiskScore } from "./risk-model";

export type WatchOperator = "<" | "<=" | ">" | ">=" | "==";

export type WatchMetric =
  | "risk_score"
  | "hunger.prevalence_pct"
  | "hunger.undernourishment_pct"
  | "conflict.intensity_1to5"
  | "health.child_mortality_under5_per1k"
  | "governance.corruption_perceptions_index"
  | "governance.electoral_democracy_index"
  | "military.pct_gdp"
  | "poverty.headcount_365_pct"
  | "water_sanitation.safe_sanitation_pct"
  | "migration.forcibly_displaced"
  | "climate.co2_per_capita_t"
  | "inequality.gini"
  | "security.homicide_rate_per100k"
  | "employment.unemployment_pct";

export interface WatchRule {
  id: string;
  name: string;
  /** Metric path to watch */
  metric: WatchMetric;
  metricLabel: string;
  operator: WatchOperator;
  threshold: number;
  /** Scope: "all" for all countries, or a specific ISO3 */
  scope: "all" | string;
  /** ISO3 of specific country (if scope is a specific country) */
  countryIso3?: string;
  countryName?: string;
  createdAt: number;
  /** Whether this rule triggered on last evaluation */
  lastTriggered?: number;
  active: boolean;
}

export interface WatchResult {
  rule: WatchRule;
  triggered: boolean;
  /** Countries that match the rule (if scope is "all") */
  matchedCountries: { iso3: string; name: string; value: number }[];
  /** The specific country's value (if scope is a specific country) */
  countryValue?: number;
  message: string;
}

/* ═══════════════════════════════════════════════════════════
   METRIC METADATA
   ═══════════════════════════════════════════════════════════ */

export interface MetricInfo {
  key: WatchMetric;
  label: string;
  unit: string;
  description: string;
  /** Typical range for slider defaults */
  min: number;
  max: number;
  /** Direction: is higher bad or good? */
  direction: "higher_is_worse" | "higher_is_better";
}

export const METRIC_INFO: Record<WatchMetric, MetricInfo> = {
  risk_score: {
    key: "risk_score",
    label: "Crisis Risk Score",
    unit: "/100",
    description: "V FOR X composite risk score (10 weighted factors)",
    min: 0,
    max: 100,
    direction: "higher_is_worse",
  },
  "hunger.prevalence_pct": {
    key: "hunger.prevalence_pct",
    label: "Hunger Prevalence",
    unit: "%",
    description: "Share of population facing food insecurity",
    min: 0,
    max: 100,
    direction: "higher_is_worse",
  },
  "hunger.undernourishment_pct": {
    key: "hunger.undernourishment_pct",
    label: "Undernourishment",
    unit: "%",
    description: "Share of population undernourished",
    min: 0,
    max: 100,
    direction: "higher_is_worse",
  },
  "conflict.intensity_1to5": {
    key: "conflict.intensity_1to5",
    label: "Conflict Intensity",
    unit: "/5",
    description: "UCDP conflict intensity scale",
    min: 0,
    max: 5,
    direction: "higher_is_worse",
  },
  "health.child_mortality_under5_per1k": {
    key: "health.child_mortality_under5_per1k",
    label: "Child Mortality (under-5)",
    unit: "/1000",
    description: "Under-5 deaths per 1,000 live births",
    min: 0,
    max: 150,
    direction: "higher_is_worse",
  },
  "governance.corruption_perceptions_index": {
    key: "governance.corruption_perceptions_index",
    label: "Corruption Perceptions Index",
    unit: "/100",
    description: "Transparency International CPI (lower = more corrupt)",
    min: 0,
    max: 100,
    direction: "higher_is_better",
  },
  "governance.electoral_democracy_index": {
    key: "governance.electoral_democracy_index",
    label: "Democracy Index",
    unit: "/1",
    description: "V-Dem electoral democracy index",
    min: 0,
    max: 1,
    direction: "higher_is_better",
  },
  "military.pct_gdp": {
    key: "military.pct_gdp",
    label: "Military Spending",
    unit: "% GDP",
    description: "Military expenditure as % of GDP",
    min: 0,
    max: 20,
    direction: "higher_is_worse",
  },
  "poverty.headcount_365_pct": {
    key: "poverty.headcount_365_pct",
    label: "Extreme Poverty",
    unit: "%",
    description: "Population living on < $3.65/day",
    min: 0,
    max: 100,
    direction: "higher_is_worse",
  },
  "water_sanitation.safe_sanitation_pct": {
    key: "water_sanitation.safe_sanitation_pct",
    label: "Safe Sanitation Access",
    unit: "%",
    description: "Population with safely-managed sanitation",
    min: 0,
    max: 100,
    direction: "higher_is_better",
  },
  "migration.forcibly_displaced": {
    key: "migration.forcibly_displaced",
    label: "Forcibly Displaced",
    unit: "people",
    description: "Total forcibly displaced population",
    min: 0,
    max: 15_000_000,
    direction: "higher_is_worse",
  },
  "climate.co2_per_capita_t": {
    key: "climate.co2_per_capita_t",
    label: "CO2 per Capita",
    unit: "t",
    description: "Carbon dioxide emissions per person",
    min: 0,
    max: 40,
    direction: "higher_is_worse",
  },
  "inequality.gini": {
    key: "inequality.gini",
    label: "Inequality (Gini)",
    unit: "",
    description: "Gini coefficient (0 = equal, 100 = unequal)",
    min: 0,
    max: 100,
    direction: "higher_is_worse",
  },
  "security.homicide_rate_per100k": {
    key: "security.homicide_rate_per100k",
    label: "Homicide Rate",
    unit: "/100k",
    description: "Homicides per 100,000 population",
    min: 0,
    max: 100,
    direction: "higher_is_worse",
  },
  "employment.unemployment_pct": {
    key: "employment.unemployment_pct",
    label: "Unemployment",
    unit: "%",
    description: "Total unemployment rate",
    min: 0,
    max: 50,
    direction: "higher_is_worse",
  },
};

/* ═══════════════════════════════════════════════════════════
   RULE CREATION
   ═══════════════════════════════════════════════════════════ */

export function createRule(
  name: string,
  metric: WatchMetric,
  operator: WatchOperator,
  threshold: number,
  scope: "all" | string = "all",
  countryName?: string,
): WatchRule {
  return {
    id: crypto.randomUUID(),
    name,
    metric,
    metricLabel: METRIC_INFO[metric].label,
    operator,
    threshold,
    scope,
    countryIso3: scope !== "all" ? scope : undefined,
    countryName,
    createdAt: Date.now(),
    active: true,
  };
}

/* ═══════════════════════════════════════════════════════════
   METRIC EXTRACTION
   ═══════════════════════════════════════════════════════════ */

/**
 * Extract a metric value from a country record.
 * Handles nested paths like "health.child_mortality_under5_per1k".
 */
export function extractMetric(country: CountryData, metric: WatchMetric): number | null {
  if (metric === "risk_score") {
    return calculateRiskScore(country).score;
  }

  const parts = metric.split(".");
  let value: unknown = country;
  for (const part of parts) {
    if (value == null || typeof value !== "object") return null;
    value = (value as Record<string, unknown>)[part];
  }
  if (value == null || typeof value !== "number") return null;
  return value;
}

/**
 * Compare a value against a threshold using the given operator.
 */
export function compare(a: number, operator: WatchOperator, b: number): boolean {
  switch (operator) {
    case "<": return a < b;
    case "<=": return a <= b;
    case ">": return a > b;
    case ">=": return a >= b;
    case "==": return a === b;
    default: return false;
  }
}

/* ═══════════════════════════════════════════════════════════
   RULE EVALUATION
   ═══════════════════════════════════════════════════════════ */

/**
 * Evaluate a single rule against the full dataset.
 */
export function evaluateRule(rule: WatchRule, data: WorldBackbone): WatchResult {
  if (rule.scope === "all") {
    const matchedCountries: { iso3: string; name: string; value: number }[] = [];

    for (const c of data.countries) {
      const val = extractMetric(c, rule.metric);
      if (val !== null && compare(val, rule.operator, rule.threshold)) {
        matchedCountries.push({
          iso3: c.iso3,
          name: c.name_en,
          value: val,
        });
      }
    }

    matchedCountries.sort((a, b) => {
      const dir = METRIC_INFO[rule.metric].direction === "higher_is_worse" ? -1 : 1;
      return dir * (b.value - a.value);
    });

    const triggered = matchedCountries.length > 0;
    const message = triggered
      ? `${matchedCountries.length} ${matchedCountries.length === 1 ? "country" : "countries"} ${rule.operator} ${rule.threshold} ${METRIC_INFO[rule.metric].unit}`
      : `No countries currently match this threshold`;

    return {
      rule,
      triggered,
      matchedCountries,
      message,
    };
  } else {
    const country = data.countries.find((c) => c.iso3 === rule.scope);
    if (!country) {
      return {
        rule,
        triggered: false,
        matchedCountries: [],
        message: "Country not found in dataset",
      };
    }

    const val = extractMetric(country, rule.metric);
    if (val === null) {
      return {
        rule,
        triggered: false,
        matchedCountries: [],
        message: "Metric not available for this country",
      };
    }

    const triggered = compare(val, rule.operator, rule.threshold);
    const message = triggered
      ? `${country.name_en}: ${val} ${rule.operator} ${rule.threshold}`
      : `${country.name_en}: ${val} (threshold: ${rule.operator} ${rule.threshold}) — not triggered`;

    return {
      rule,
      triggered,
      matchedCountries: triggered
        ? [{ iso3: country.iso3, name: country.name_en, value: val }]
        : [],
      countryValue: val,
      message,
    };
  }
}

/**
 * Evaluate all rules and return results sorted by trigger status.
 */
export function evaluateAllRules(rules: WatchRule[], data: WorldBackbone): WatchResult[] {
  return rules
    .filter((r) => r.active)
    .map((r) => evaluateRule(r, data))
    .sort((a, b) => {
      if (a.triggered !== b.triggered) return a.triggered ? -1 : 1;
      return b.matchedCountries.length - a.matchedCountries.length;
    });
}

/* ═══════════════════════════════════════════════════════════
   PRESETS
   ═══════════════════════════════════════════════════════════ */

export function presetRules(): Omit<WatchRule, "id" | "createdAt">[] {
  return [
    {
      name: "Critical Risk Countries",
      metric: "risk_score",
      metricLabel: "Crisis Risk Score",
      operator: ">=",
      threshold: 70,
      scope: "all",
      active: true,
    },
    {
      name: "Severe Hunger (>30%)",
      metric: "hunger.prevalence_pct",
      metricLabel: "Hunger Prevalence",
      operator: ">",
      threshold: 30,
      scope: "all",
      active: true,
    },
    {
      name: "Active Conflict (L4+)",
      metric: "conflict.intensity_1to5",
      metricLabel: "Conflict Intensity",
      operator: ">=",
      threshold: 4,
      scope: "all",
      active: true,
    },
    {
      name: "Extreme Corruption (CPI <30)",
      metric: "governance.corruption_perceptions_index",
      metricLabel: "Corruption Perceptions Index",
      operator: "<",
      threshold: 30,
      scope: "all",
      active: true,
    },
    {
      name: "High Child Mortality (>50/1000)",
      metric: "health.child_mortality_under5_per1k",
      metricLabel: "Child Mortality (under-5)",
      operator: ">",
      threshold: 50,
      scope: "all",
      active: true,
    },
  ];
}
