/**
 * V FOR X — Trigger Rules Engine
 *
 * Extends the Watch system with a more expressive rules language:
 * compound conditions, time-based triggers, and action execution.
 *
 * A TriggerRule is like a WatchRule but supports:
 *   - Multiple conditions (AND logic)
 *   - Threshold deltas (change detection)
 *   - Action execution (notification, sound, navigation)
 *
 * Rules are evaluated client-side on each data refresh.
 */

import type { WorldBackbone, CountryData } from "./types";
import type { WatchMetric, WatchOperator } from "./watch";
import { extractMetric, compare } from "./watch";
import { calculateRiskScore } from "./risk-model";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface TriggerCondition {
  metric: WatchMetric;
  operator: WatchOperator;
  value: number;
  /** Optional: only trigger for this country */
  iso3?: string;
  /** Label for display */
  label?: string;
}

export type TriggerAction =
  | "notify"
  | "sound"
  | "navigate"
  | "log"
  | "export_report";

export interface TriggerRule {
  id: string;
  name: string;
  /** All conditions must be true (AND logic) */
  conditions: TriggerCondition[];
  /** What to do when triggered */
  actions: TriggerAction[];
  /** Navigate to this URL (if action includes "navigate") */
  navigateTo?: string;
  active: boolean;
  createdAt: number;
  /** Last time this rule fired */
  lastFired?: number;
  /** Number of times this rule has fired */
  fireCount: number;
}

export interface TriggerFired {
  rule: TriggerRule;
  matchedCountries: { iso3: string; name: string; values: Record<string, number> }[];
  firedAt: number;
}

/* ═══════════════════════════════════════════════════════════════
   Rule creation
   ═══════════════════════════════════════════════════════════════ */

export function createTriggerRule(
  name: string,
  conditions: TriggerCondition[],
  actions: TriggerAction[] = ["notify"],
  navigateTo?: string,
): TriggerRule {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `trigger-${Date.now()}`,
    name,
    conditions,
    actions,
    navigateTo,
    active: true,
    createdAt: Date.now(),
    fireCount: 0,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Evaluation
   ═══════════════════════════════════════════════════════════════ */

/**
 * Evaluate a single condition against a country.
 */
export function evaluateCondition(
  country: CountryData,
  condition: TriggerCondition,
): boolean {
  if (condition.iso3 && country.iso3 !== condition.iso3) return false;

  const val = extractMetric(country, condition.metric);
  if (val === null) return false;

  return compare(val, condition.operator, condition.value);
}

/**
 * Evaluate a trigger rule against all countries.
 * Returns matched countries if all conditions are satisfied (AND).
 */
export function evaluateTrigger(
  rule: TriggerRule,
  data: WorldBackbone,
): TriggerFired | null {
  if (!rule.active) return null;

  const scope = rule.conditions[0]?.iso3;
  const countries = scope
    ? data.countries.filter((c) => c.iso3 === scope)
    : data.countries;

  const matched: { iso3: string; name: string; values: Record<string, number> }[] = [];

  for (const c of countries) {
    const allMatch = rule.conditions.every((cond) => evaluateCondition(c, cond));
    if (allMatch) {
      const values: Record<string, number> = {};
      for (const cond of rule.conditions) {
        const v = extractMetric(c, cond.metric);
        if (v !== null) values[cond.metric] = v;
      }
      matched.push({ iso3: c.iso3, name: c.name_en, values });
    }
  }

  if (matched.length === 0) return null;

  return {
    rule,
    matchedCountries: matched.slice(0, 10),
    firedAt: Date.now(),
  };
}

/**
 * Evaluate all trigger rules.
 */
export function evaluateAllTriggers(
  rules: TriggerRule[],
  data: WorldBackbone,
): TriggerFired[] {
  return rules
    .map((r) => evaluateTrigger(r, data))
    .filter((f): f is TriggerFired => f !== null);
}

/* ═══════════════════════════════════════════════════════════════
   Preset rules
   ═══════════════════════════════════════════════════════════════ */

export function presetTriggerRules(): TriggerRule[] {
  return [
    createTriggerRule(
      "Critical Risk + Active Conflict",
      [
        { metric: "risk_score", operator: ">=", value: 70, label: "Risk ≥ 70" },
        { metric: "conflict.intensity_1to5", operator: ">=", value: 3, label: "Conflict ≥ 3" },
      ],
      ["notify", "log"],
    ),
    createTriggerRule(
      "Severe Hunger in Hotspot",
      [
        { metric: "hunger.prevalence_pct", operator: ">=", value: 40, label: "Hunger ≥ 40%" },
      ],
      ["notify"],
    ),
    createTriggerRule(
      "Military > Health Spending",
      [
        { metric: "military.pct_gdp", operator: ">", value: 5, label: "Military > 5% GDP" },
      ],
      ["notify"],
      "/the-choice/",
    ),
    createTriggerRule(
      "Extreme Poverty Spike",
      [
        { metric: "poverty.headcount_365_pct", operator: ">=", value: 50, label: "Poverty ≥ 50%" },
      ],
      ["notify", "export_report"],
    ),
  ];
}

/* ═══════════════════════════════════════════════════════════════
   Condition label builder
   ═══════════════════════════════════════════════════════════════ */

export function formatCondition(cond: TriggerCondition): string {
  const label = cond.label ?? cond.metric;
  return `${label} ${cond.operator} ${cond.value}`;
}

export function formatRule(rule: TriggerRule): string {
  return `${rule.name}: ${rule.conditions.map(formatCondition).join(" AND ")}`;
}
