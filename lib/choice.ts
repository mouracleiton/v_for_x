/**
 * V FOR X — The Choice: Military vs Social Spending analyzer
 *
 * Computes the moral calculus per country:
 * - Military vs health spending ratio
 * - "How many days of YOUR military spending would end YOUR hunger?"
 * - Global ranking of worst offenders
 *
 * All derived from world_backbone.json fields.
 */

import type { CountryData } from "./types";

export const MILITARY_PER_DAY_B = 6.6; // $B/day global military spending
export const COST_PER_MILLION_HUNGRY_B = 93 / 667; // $0.1394B per million people

export interface ChoiceEntry {
  iso3: string;
  name: string;
  region: string;
  isHotspot: boolean;
  militaryB: number;
  healthB: number;
  ratio: number; // military / health
  undernourishedM: number;
  costFixHungerB: number;
  daysLocalMilitary: number; // days of THIS country's military to fix its own hunger
  daysGlobalMilitary: number; // days of global military to fix this country's hunger
  popM: number;
  milPctGdp: number;
  healthPctGdp: number;
}

export function buildChoiceData(countries: CountryData[]): ChoiceEntry[] {
  const entries: ChoiceEntry[] = [];
  for (const c of countries) {
    const mil = c.military?.expenditure_usd;
    const healthPct = c.health?.expenditure_pct_gdp;
    const gdp = c.economy?.gdp_usd;
    const pop = c.demographics?.population ?? 0;
    const underPct = c.hunger?.undernourishment_pct;

    if (mil == null || gdp == null || healthPct == null) continue;
    if (mil <= 0 || gdp <= 0) continue;

    const healthUsd = (gdp * healthPct) / 100;
    const ratio = healthUsd > 0 ? mil / healthUsd : 0;
    const underM = pop * (underPct ?? 0) / 1e6 / 100;
    const costFixB = underM * COST_PER_MILLION_HUNGRY_B;
    const dailyMilB = mil / 1e9 / 365;
    const daysLocal = dailyMilB > 0 ? costFixB / dailyMilB : 0;
    const daysGlobal = costFixB / MILITARY_PER_DAY_B;

    entries.push({
      iso3: c.iso3,
      name: c.name_en,
      region: c.region,
      isHotspot: c.is_hotspot,
      militaryB: mil / 1e9,
      healthB: healthUsd / 1e9,
      ratio,
      undernourishedM: underM,
      costFixHungerB: costFixB,
      daysLocalMilitary: daysLocal,
      daysGlobalMilitary: daysGlobal,
      popM: pop / 1e6,
      milPctGdp: c.military.pct_gdp ?? 0,
      healthPctGdp: healthPct,
    });
  }
  return entries;
}

export function ratioColor(ratio: number): string {
  if (ratio >= 2) return "#ff0000";
  if (ratio >= 1.5) return "#cc0000";
  if (ratio >= 1) return "#e10600";
  if (ratio >= 0.5) return "#ffaa00";
  return "#00ff41";
}

export function ratioLabel(ratio: number): string {
  if (ratio >= 2) return `${ratio.toFixed(2)}× MORE ON WAR`;
  if (ratio >= 1) return `${ratio.toFixed(2)}× — WAR > HEALTH`;
  if (ratio >= 0.5) return `${ratio.toFixed(2)}× — near parity`;
  return `${ratio.toFixed(2)}× — health wins`;
}
