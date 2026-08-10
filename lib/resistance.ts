/**
 * V FOR X — The Resistance (Global Movement Tracker)
 *
 * Maps civil resistance movements, protests, strikes, and civil
 * disobedience around the world. Derives a "movement strength"
 * score from structural data (democracy index, conflict intensity,
 * corruption level) and provides historical context.
 *
 * Built on the research of Erica Chenoweth: nonviolent movements
 * succeed 53% of the time vs 26% for armed resistance. Mass
 * participation (3.5% of population) is the tipping point.
 *
 * Since V FOR X is static, this module provides the analytical
 * framework and structural indicators — not live event tracking.
 */

import type { WorldBackbone, CountryData } from "./types";
import { calculateRiskScore } from "./risk-model";

export type MovementType =
  | "pro_democracy"
  | "anti_corruption"
  | "labor_strike"
  | "civil_rights"
  | "anti_war"
  | "climate_justice"
  | "women_rights"
  | "indigenous"
  | "anti_regime"
  | "economic_justice";

export type MovementStatus = "active" | "suppressed" | "victorious" | "stalled" | "emerging";

export interface ResistanceMovement {
  id: string;
  type: MovementType;
  title: string;
  country: string;
  iso3: string;
  status: MovementStatus;
  /** Estimated participation (absolute number) */
  participationEstimate: number;
  /** Percentage of population participating */
  participationPct: number;
  startDate: string;
  /** Key demands */
  demands: string[];
  /** Tactics used */
  tactics: string[];
  /** Structural conditions that enable/fuel this movement */
  conditions: MovementConditions;
  /** Movement strength score 0-100 */
  strength: number;
  notes?: string;
}

export interface MovementConditions {
  democracyIndex: number | null;
  corruptionIndex: number | null;
  conflictIntensity: number;
  unemployment: number | null;
  hungerPrevalence: number | null;
  riskScore: number;
}

export interface ResistanceStats {
  totalMovements: number;
  active: number;
  suppressed: number;
  victorious: number;
  totalParticipants: number;
  averageStrength: number;
  byType: { type: MovementType; count: number; participants: number }[];
  byCountry: { iso3: string; name: string; count: number; participants: number }[];
  /** Countries with conditions ripe for resistance but no recorded movement */
  ripeCountries: { iso3: string; name: string; ripeScore: number; topDriver: string }[];
}

export interface HistoricalReference {
  movement: string;
  country: string;
  year: string;
  type: MovementType;
  participants: number;
  outcome: "success" | "failure" | "partial";
  lesson: string;
}

/* ═══════════════════════════════════════════════════════════
   MOVEMENT STRENGTH SCORING
   ═══════════════════════════════════════════════════════════ */

/**
 * Compute movement strength on a 0-100 scale.
 * Factors:
 *   1. Participation as % of population (the Chenoweth 3.5% threshold)
 *   2. Breadth of demands (broad coalitions are stronger)
 *   3. Tactical diversity (multiple nonviolent methods)
 *   4. Structural conditions (grievance level)
 *   5. Status (active > emerging > stalled > suppressed)
 */
export function computeStrength(movement: Pick<ResistanceMovement, "participationPct" | "demands" | "tactics" | "status" | "conditions">): number {
  let score = 0;

  // 1. Participation (0-40 points)
  // 3.5% = the Chenoweth threshold for guaranteed success
  const participationScore = Math.min(40, (movement.participationPct / 3.5) * 40);
  score += participationScore;

  // 2. Demand breadth (0-15 points)
  const demandScore = Math.min(15, movement.demands.length * 3);
  score += demandScore;

  // 3. Tactical diversity (0-15 points)
  const tacticScore = Math.min(15, movement.tactics.length * 3);
  score += tacticScore;

  // 4. Structural grievance (0-20 points)
  const grievance = movement.conditions.riskScore;
  const grievanceScore = Math.min(20, (grievance / 100) * 20);
  score += grievanceScore;

  // 5. Status modifier (0-10 points)
  const statusScores: Record<MovementStatus, number> = {
    active: 10,
    emerging: 7,
    victorious: 10,
    stalled: 4,
    suppressed: 2,
  };
  score += statusScores[movement.status];

  return Math.round(Math.min(100, score));
}

/* ═══════════════════════════════════════════════════════════
   CONDITIONS EXTRACTION
   ═══════════════════════════════════════════════════════════ */

export function extractConditions(country: CountryData): MovementConditions {
  return {
    democracyIndex: country.governance.electoral_democracy_index,
    corruptionIndex: country.governance.corruption_perceptions_index,
    conflictIntensity: country.conflict.intensity_1to5,
    unemployment: country.employment.unemployment_pct,
    hungerPrevalence: country.hunger.prevalence_pct,
    riskScore: calculateRiskScore(country).score,
  };
}

/* ═══════════════════════════════════════════════════════════
   RIPENESS SCORING
 * ═══════════════════════════════════════════════════════════ */

/**
 * Score how "ripe" a country is for resistance based on structural
 * conditions. This does NOT predict movements — it identifies where
 * the data shows extreme grievances that historically correlate with
 * civil resistance.
 */
export function computeRipeness(country: CountryData): {
  score: number;
  topDriver: string;
  conditions: MovementConditions;
} {
  const conditions = extractConditions(country);
  let score = 0;
  const drivers: { label: string; value: number }[] = [];

  // Low democracy index → anti-regime sentiment
  if (conditions.democracyIndex !== null && conditions.democracyIndex !== undefined && !isNaN(conditions.democracyIndex)) {
    const democracyScore = (1 - conditions.democracyIndex) * 25;
    score += democracyScore;
    drivers.push({ label: "Low democracy index", value: democracyScore });
  }

  // High corruption → anti-corruption sentiment
  if (conditions.corruptionIndex !== null && conditions.corruptionIndex !== undefined && !isNaN(conditions.corruptionIndex)) {
    const corruptionScore = ((100 - conditions.corruptionIndex) / 100) * 20;
    score += corruptionScore;
    drivers.push({ label: "High corruption", value: corruptionScore });
  }

  // High conflict → anti-war / anti-regime
  const ci = conditions.conflictIntensity || 0;
  const conflictScore = (ci / 5) * 15;
  score += conflictScore;
  drivers.push({ label: "Active conflict", value: conflictScore });

  // High hunger → economic justice
  if (conditions.hungerPrevalence !== null && conditions.hungerPrevalence !== undefined && !isNaN(conditions.hungerPrevalence)) {
    const hungerScore = (conditions.hungerPrevalence / 100) * 15;
    score += hungerScore;
    drivers.push({ label: "Food insecurity", value: hungerScore });
  }

  // High unemployment → labor unrest
  if (conditions.unemployment !== null && conditions.unemployment !== undefined && !isNaN(conditions.unemployment)) {
    const unemploymentScore = (conditions.unemployment / 50) * 10;
    score += unemploymentScore;
    drivers.push({ label: "High unemployment", value: unemploymentScore });
  }

  // Overall risk score
  const rs = conditions.riskScore || 0;
  const riskScore = (rs / 100) * 15;
  score += riskScore;
  drivers.push({ label: "Composite crisis risk", value: riskScore });

  drivers.sort((a, b) => b.value - a.value);
  score = Math.min(100, Math.round(score));
  if (isNaN(score)) score = 0;

  return {
    score,
    topDriver: drivers[0]?.label ?? "Composite conditions",
    conditions,
  };
}

/**
 * Rank countries by resistance ripeness. Returns countries with
 * high grievance scores that may be primed for (or already experiencing)
 * civil resistance.
 */
export function getRipeCountries(
  data: WorldBackbone,
  limit = 20,
): { iso3: string; name: string; ripeScore: number; topDriver: string }[] {
  return data.countries
    .map((c) => {
      const r = computeRipeness(c);
      return {
        iso3: c.iso3,
        name: c.name_en,
        ripeScore: r.score,
        topDriver: r.topDriver,
      };
    })
    .sort((a, b) => b.ripeScore - a.ripeScore)
    .slice(0, limit);
}

/* ═══════════════════════════════════════════════════════════
   MOVEMENT CREATION
   ═══════════════════════════════════════════════════════════ */

export function createMovement(
  type: MovementType,
  title: string,
  country: CountryData,
  status: MovementStatus,
  participationEstimate: number,
  startDate: string,
  demands: string[],
  tactics: string[],
  notes?: string,
): ResistanceMovement {
  const conditions = extractConditions(country);
  const participationPct = (participationEstimate / country.demographics.population) * 100;
  const strength = computeStrength({
    participationPct,
    demands,
    tactics,
    status,
    conditions,
  });

  return {
    id: crypto.randomUUID(),
    type,
    title,
    country: country.name_en,
    iso3: country.iso3,
    status,
    participationEstimate,
    participationPct: +participationPct.toFixed(3),
    startDate,
    demands,
    tactics,
    conditions,
    strength,
    notes,
  };
}

/* ═══════════════════════════════════════════════════════════
   STATS
   ═══════════════════════════════════════════════════════════ */

export function computeStats(movements: ResistanceMovement[], data: WorldBackbone): ResistanceStats {
  const active = movements.filter((m) => m.status === "active").length;
  const suppressed = movements.filter((m) => m.status === "suppressed").length;
  const victorious = movements.filter((m) => m.status === "victorious").length;
  const totalParticipants = movements.reduce((sum, m) => sum + m.participationEstimate, 0);
  const averageStrength = movements.length > 0
    ? Math.round(movements.reduce((sum, m) => sum + m.strength, 0) / movements.length)
    : 0;

  // By type
  const typeMap: Record<string, { count: number; participants: number }> = {};
  for (const m of movements) {
    if (!typeMap[m.type]) typeMap[m.type] = { count: 0, participants: 0 };
    typeMap[m.type].count++;
    typeMap[m.type].participants += m.participationEstimate;
  }
  const byType = Object.entries(typeMap)
    .map(([type, v]) => ({ type: type as MovementType, ...v }))
    .sort((a, b) => b.participants - a.participants);

  // By country
  const countryMap: Record<string, { iso3: string; name: string; count: number; participants: number }> = {};
  for (const m of movements) {
    if (!countryMap[m.iso3]) {
      countryMap[m.iso3] = { iso3: m.iso3, name: m.country, count: 0, participants: 0 };
    }
    countryMap[m.iso3].count++;
    countryMap[m.iso3].participants += m.participationEstimate;
  }
  const byCountry = Object.values(countryMap).sort((a, b) => b.participants - a.participants);

  // Ripe countries (top countries with high grievance but no recorded movement)
  const movementCountries = new Set(movements.map((m) => m.iso3));
  const ripeCountries = getRipeCountries(data, 50)
    .filter((c) => !movementCountries.has(c.iso3))
    .slice(0, 15);

  return {
    totalMovements: movements.length,
    active,
    suppressed,
    victorious,
    totalParticipants,
    averageStrength,
    byType,
    byCountry,
    ripeCountries,
  };
}

/* ═══════════════════════════════════════════════════════════
   HISTORICAL REFERENCES
   ═══════════════════════════════════════════════════════════ */

/**
 * Historical nonviolent resistance movements with documented outcomes.
 * Data from the NAVCO (Nonviolent and Violent Campaigns and Outcomes)
 * dataset by Erica Chenoweth and colleagues.
 */
export const HISTORICAL_MOVEMENTS: HistoricalReference[] = [
  {
    movement: "Indian Independence Movement",
    country: "India",
    year: "1930-1947",
    type: "anti_regime",
    participants: 60_000_000,
    outcome: "success",
    lesson: "Sustained mass nonviolent resistance over 17 years defeated the world's largest empire.",
  },
  {
    movement: "Salt March",
    country: "India",
    year: "1930",
    type: "anti_regime",
    participants: 100_000,
    outcome: "success",
    lesson: "A single symbolic act of mass civil disobedience galvanized a nation.",
  },
  {
    movement: "Montgomery Bus Boycott",
    country: "USA",
    year: "1955-1956",
    type: "civil_rights",
    participants: 40_000,
    outcome: "success",
    lesson: "Economic noncooperation (boycott) forced desegregation in 381 days.",
  },
  {
    movement: "People Power Revolution",
    country: "Philippines",
    year: "1986",
    type: "anti_regime",
    participants: 2_000_000,
    outcome: "success",
    lesson: "2M unarmed civilians faced down tanks and ousted Marcos without a shot fired.",
  },
  {
    movement: "Velvet Revolution",
    country: "Czechoslovakia",
    year: "1989",
    type: "pro_democracy",
    participants: 500_000,
    outcome: "success",
    lesson: "A student protest grew to 500K in 11 days and toppled a 41-year dictatorship.",
  },
  {
    movement: "Baltic Way (Living Chain)",
    country: "Estonia/Latvia/Lithuania",
    year: "1989",
    type: "pro_democracy",
    participants: 2_000_000,
    outcome: "success",
    lesson: "2M people joined hands across 600km. Nonviolent demonstration of unity won independence.",
  },
  {
    movement: "Burmese Uprising (8888)",
    country: "Myanmar",
    year: "1988",
    type: "anti_regime",
    participants: 1_000_000,
    outcome: "failure",
    lesson: "Mass protests without unified leadership and international support can be crushed.",
  },
  {
    movement: "Tiananmen Square Protests",
    country: "China",
    year: "1989",
    type: "pro_democracy",
    participants: 1_000_000,
    outcome: "failure",
    lesson: "Even millions of peaceful protesters can be massacred when a regime is willing to use extreme force.",
  },
  {
    movement: "Otpor! / Bulldozer Revolution",
    country: "Serbia",
    year: "2000",
    type: "anti_regime",
    participants: 500_000,
    outcome: "success",
    lesson: "A youth movement with humor, discipline, and strategy toppled Milošević.",
  },
  {
    movement: "Rose Revolution",
    country: "Georgia",
    year: "2003",
    type: "anti_regime",
    participants: 100_000,
    outcome: "success",
    lesson: "Nonviolent mass protest overturned a fraudulent election.",
  },
  {
    movement: "Orange Revolution",
    country: "Ukraine",
    year: "2004",
    type: "pro_democracy",
    participants: 500_000,
    outcome: "partial",
    lesson: "Mass protest forced a re-run election, but structural change requires sustained organizing.",
  },
  {
    movement: "Arab Spring (Tunisia)",
    country: "Tunisia",
    year: "2010-2011",
    type: "anti_regime",
    participants: 1_000_000,
    outcome: "success",
    lesson: "One vendor's self-immolation sparked a nonviolent revolution that toppled a 23-year dictator in 28 days.",
  },
  {
    movement: "Sudan Revolution",
    country: "Sudan",
    year: "2019",
    type: "anti_regime",
    participants: 1_000_000,
    outcome: "partial",
    lesson: "Sustained civil disobedience ousted Bashir after 30 years, but the military interrupted the transition.",
  },
];

/* ═══════════════════════════════════════════════════════════
   TACTICS REFERENCE
   ═══════════════════════════════════════════════════════════ */

export interface TacticInfo {
  name: string;
  category: "protest" | "noncooperation" | "intervention";
  description: string;
  riskLevel: "low" | "medium" | "high";
  effectiveness: number;
}

/**
 * Gene Sharp's 198 Methods of Nonviolent Action, grouped by category
 * with the most effective and common tactics highlighted.
 */
export const RESISTANCE_TACTICS: TacticInfo[] = [
  { name: "Mass Protest / Demonstration", category: "protest", description: "Large public gathering expressing collective dissent", riskLevel: "medium", effectiveness: 70 },
  { name: "Strike / Work Stoppage", category: "noncooperation", description: "Refusing to work — withdraws economic support from the regime", riskLevel: "high", effectiveness: 85 },
  { name: "Boycott (Economic)", category: "noncooperation", description: "Refusing to buy specific goods or from specific entities", riskLevel: "low", effectiveness: 65 },
  { name: "Boycott (Political)", category: "noncooperation", description: "Refusing to participate in political processes (elections, etc.)", riskLevel: "medium", effectiveness: 60 },
  { name: "Civil Disobedience", category: "intervention", description: "Deliberate, open violation of unjust laws, accepting consequences", riskLevel: "high", effectiveness: 80 },
  { name: "Sit-in / Occupation", category: "intervention", description: "Physically occupying a space to disrupt operations", riskLevel: "high", effectiveness: 75 },
  { name: "Hunger Strike", category: "intervention", description: "Refusing food to demand change — maximum personal sacrifice", riskLevel: "high", effectiveness: 55 },
  { name: "Go-slow / Work-to-rule", category: "noncooperation", description: "Doing exactly the minimum required — paralyzes from within", riskLevel: "medium", effectiveness: 70 },
  { name: "Underground Press / Samizdat", category: "intervention", description: "Clandestine publishing and distribution of information", riskLevel: "high", effectiveness: 65 },
  { name: "Petition / Appeal", category: "protest", description: "Formal written demand delivered to authorities", riskLevel: "low", effectiveness: 30 },
  { name: "Picketing", category: "protest", description: "Standing vigil at a location to inform and dissuade", riskLevel: "medium", effectiveness: 45 },
  { name: "Motorcade / Convoy", category: "protest", description: "Organized vehicle procession for visibility", riskLevel: "medium", effectiveness: 40 },
  { name: "Symbolic Public Act", category: "protest", description: "Theatrical, artistic, or symbolic demonstrations", riskLevel: "low", effectiveness: 50 },
  { name: "Tax Refusal", category: "noncooperation", description: "Refusing to pay taxes that fund the regime", riskLevel: "high", effectiveness: 60 },
  { name: "Student Strike", category: "noncooperation", description: "Students refuse to attend classes", riskLevel: "medium", effectiveness: 55 },
  { name: "General Strike", category: "noncooperation", description: "Nationwide work stoppage — the most powerful nonviolent weapon", riskLevel: "high", effectiveness: 90 },
  { name: "Parallel Government", category: "intervention", description: "Establishing alternative governance structures", riskLevel: "high", effectiveness: 75 },
  { name: "Mutual Aid Networks", category: "intervention", description: "Building community self-sufficiency outside state control", riskLevel: "low", effectiveness: 65 },
];

/* ═══════════════════════════════════════════════════════════
   METADATA
   ═══════════════════════════════════════════════════════════ */

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  pro_democracy: "Pro-Democracy",
  anti_corruption: "Anti-Corruption",
  labor_strike: "Labor / Workers",
  civil_rights: "Civil Rights",
  anti_war: "Anti-War / Peace",
  climate_justice: "Climate Justice",
  women_rights: "Women's Rights",
  indigenous: "Indigenous Rights",
  anti_regime: "Anti-Regime",
  economic_justice: "Economic Justice",
};

export const STATUS_LABELS: Record<MovementStatus, string> = {
  active: "Active",
  suppressed: "Suppressed",
  victorious: "Victorious",
  stalled: "Stalled",
  emerging: "Emerging",
};

export const STATUS_COLORS: Record<MovementStatus, string> = {
  active: "#00ddff",
  suppressed: "var(--color-blood-bright)",
  victorious: "var(--color-terminal-green)",
  stalled: "var(--color-warning-amber)",
  emerging: "var(--color-content-dim)",
};

export function strengthLabel(score: number): string {
  if (score >= 80) return "Mass Movement";
  if (score >= 60) return "Strong";
  if (score >= 40) return "Significant";
  if (score >= 20) return "Developing";
  return "Marginal";
}

export function strengthColor(score: number): string {
  if (score >= 80) return "var(--color-terminal-green)";
  if (score >= 60) return "#00ddff";
  if (score >= 40) return "var(--color-warning-amber)";
  return "var(--color-blood)";
}
