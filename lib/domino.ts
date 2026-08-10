/**
 * V FOR X — The Domino
 *
 * Cascading crisis simulator. Pick a shock (a drought in the Horn of Africa,
 * a currency collapse, a war), and watch it propagate through 24 dimensions
 * across countries via trade, migration, and conflict spillover channels.
 *
 * The model is deliberately transparent: each propagation step is a weighted
 * adjacency multiplied by a response coefficient. Nothing is a black box.
 *
 * [73] THE DOMINO — Code: 73
 */

import type { CountryData, WorldBackbone } from "./types";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export type DimensionKey =
  | "hunger"
  | "conflict"
  | "displacement"
  | "poverty"
  | "health"
  | "economy"
  | "governance"
  | "environment";

export interface ShockPreset {
  id: string;
  label: string;
  description: string;
  /** The country where the shock originates */
  epicenterIso3: string;
  /** Primary dimension affected */
  primaryDimension: DimensionKey;
  /** Initial severity 0-1 */
  initialSeverity: number;
  icon: string;
}

export interface PropagationStep {
  /** ISO3 of the affected country */
  iso3: string;
  /** Country name */
  name: string;
  /** Dimension affected */
  dimension: DimensionKey;
  /** Estimated severity of impact 0-1 */
  severity: number;
  /** How this domino fell — the causal chain */
  pathway: string[];
  /** Step number in the cascade (0 = epicenter) */
  step: number;
}

export interface DominoResult {
  preset: ShockPreset;
  /** All cascading impacts, sorted by step then severity */
  steps: PropagationStep[];
  /** Total population affected across all steps */
  populationAffectedM: number;
  /** Number of countries affected */
  countriesAffected: number;
  /** A summary line for sharing */
  summary: string;
}

/* ═══════════════════════════════════════════════════════════════
   Shock presets — derived from real crisis patterns in the data
   ═══════════════════════════════════════════════════════════════ */

export const SHOCK_PRESETS: ShockPreset[] = [
  {
    id: "horn_drought",
    label: "Horn of Africa Drought",
    description: "Multi-year drought collapses agriculture across the Horn of Africa",
    epicenterIso3: "SOM",
    primaryDimension: "hunger",
    initialSeverity: 0.9,
    icon: "🌵",
  },
  {
    id: "currency_collapse",
    label: "Currency Collapse",
    description: "A major economy's currency loses 60% of its value overnight",
    epicenterIso3: "ARG",
    primaryDimension: "economy",
    initialSeverity: 0.8,
    icon: "📉",
  },
  {
    id: "grain blockade",
    label: "Grain Export Blockade",
    description: "A major grain exporter blocks shipments, disrupting global food supply",
    epicenterIso3: "UKR",
    primaryDimension: "hunger",
    initialSeverity: 0.85,
    icon: "🚢",
  },
  {
    id: "conflict_escalation",
    label: "Regional War Escalation",
    description: "An active conflict intensifies, displacing millions",
    epicenterIso3: "SDN",
    primaryDimension: "conflict",
    initialSeverity: 0.95,
    icon: "⚔️",
  },
  {
    id: "climate_disaster",
    label: "Mega-Flood",
    description: "Unprecedented flooding destroys infrastructure in South Asia",
    epicenterIso3: "PAK",
    primaryDimension: "environment",
    initialSeverity: 0.8,
    icon: "🌊",
  },
  {
    id: "pandemic",
    label: "Health System Collapse",
    description: "A health crisis overwhelms medical infrastructure",
    epicenterIso3: "IND",
    primaryDimension: "health",
    initialSeverity: 0.75,
    icon: "🦠",
  },
];

/* ═══════════════════════════════════════════════════════════════
   Propagation weights
 *
 * Defines how a shock in one dimension spills into others. Each entry
 * says: "a unit shock in dimension X causes a 0.Y severity shock in
 * dimension Z." All weights are heuristic, derived from observed crisis
 * patterns (e.g., hunger → displacement is well-documented).
 * ═══════════════════════════════════════════════════════════════ */

const DIMENSION_PROPAGATION: Record<DimensionKey, Array<{ to: DimensionKey; weight: number; reason: string }>> = {
  hunger: [
    { to: "displacement", weight: 0.6, reason: "Food shortages trigger mass migration" },
    { to: "conflict", weight: 0.4, reason: "Resource competition fuels violence" },
    { to: "poverty", weight: 0.7, reason: "Food prices push families into destitution" },
    { to: "health", weight: 0.5, reason: "Malnutrition weakens immune systems" },
  ],
  conflict: [
    { to: "displacement", weight: 0.8, reason: "Violence forces populations to flee" },
    { to: "hunger", weight: 0.6, reason: "Conflict blocks food access and agriculture" },
    { to: "poverty", weight: 0.5, reason: "Economic activity collapses in war zones" },
    { to: "health", weight: 0.4, reason: "Health infrastructure is destroyed" },
  ],
  displacement: [
    { to: "poverty", weight: 0.6, reason: "Refugees lose livelihoods" },
    { to: "health", weight: 0.4, reason: "Crowded camps breed disease" },
    { to: "conflict", weight: 0.3, reason: "Demographic pressure can spark tensions" },
  ],
  poverty: [
    { to: "hunger", weight: 0.5, reason: "Families cannot afford food" },
    { to: "health", weight: 0.4, reason: "Cannot access healthcare" },
    { to: "governance", weight: 0.3, reason: "Economic desperation fuels unrest" },
  ],
  economy: [
    { to: "poverty", weight: 0.7, reason: "Inflation destroys purchasing power" },
    { to: "hunger", weight: 0.4, reason: "Imported food becomes unaffordable" },
    { to: "governance", weight: 0.5, reason: "Economic collapse erodes state capacity" },
  ],
  governance: [
    { to: "conflict", weight: 0.5, reason: "State collapse creates power vacuums" },
    { to: "poverty", weight: 0.4, reason: "Institutions cannot deliver services" },
    { to: "health", weight: 0.3, reason: "Public health systems degrade" },
  ],
  environment: [
    { to: "hunger", weight: 0.6, reason: "Crop yields collapse" },
    { to: "displacement", weight: 0.5, reason: "Areas become uninhabitable" },
    { to: "poverty", weight: 0.4, reason: "Livelihoods tied to natural resources lost" },
  ],
  health: [
    { to: "economy", weight: 0.5, reason: "Labor force depleted" },
    { to: "poverty", weight: 0.4, reason: "Medical costs push families into poverty" },
    { to: "displacement", weight: 0.3, reason: "Communities flee health crises" },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   Geographic spillover
 *
 * Shocks propagate to neighboring countries via shared borders,
 * regional proximity, and trade/migration corridors.
 * ═══════════════════════════════════════════════════════════════ */

/** Regional proximity multiplier — countries in the same subregion get hit harder */
function regionProximity(
  epicenter: CountryData,
  target: CountryData,
): number {
  if (epicenter.iso3 === target.iso3) return 1.0;
  if (epicenter.subregion === target.subregion) return 0.7;
  if (epicenter.region === target.region) return 0.4;
  return 0.15; // Global ripple effect
}

/** Vulnerability multiplier — structurally fragile countries absorb more impact */
function vulnerabilityFactor(country: CountryData): number {
  let v = 0.5; // baseline
  // Higher hunger = more vulnerable to cascading hunger
  if ((country.hunger?.undernourishment_pct ?? 0) > 20) v += 0.2;
  // Active conflict amplifies all shocks
  if ((country.conflict?.intensity_1to5 ?? 0) >= 3) v += 0.2;
  // Low governance capacity reduces resilience
  if ((country.governance?.electoral_democracy_index ?? 1) < 0.4) v += 0.1;
  // Poverty amplifies
  if ((country.poverty?.headcount_365_pct ?? 0) > 40) v += 0.1;
  // Cap at 1.0
  return Math.min(v, 1.0);
}

/* ═══════════════════════════════════════════════════════════════
   Core simulation
   ═══════════════════════════════════════════════════════════════ */

const MAX_STEPS = 4;
const MIN_SEVERITY_THRESHOLD = 0.08;

/**
 * Simulate a cascading crisis from a shock preset.
 * Returns the full domino chain: epicenter → first-order spillovers →
 * second-order spillovers → etc.
 */
export function simulateDomino(
  data: WorldBackbone,
  preset: ShockPreset,
): DominoResult {
  const countries = data.countries;
  const epicenter = countries.find((c) => c.iso3 === preset.epicenterIso3);
  if (!epicenter) {
    return {
      preset,
      steps: [],
      populationAffectedM: 0,
      countriesAffected: 0,
      summary: "Epicenter country not found in data.",
    };
  }

  const steps: PropagationStep[] = [];
  const visited = new Set<string>(); // "ISO3:dimension" keys
  const affectedCountries = new Set<string>();

  // Step 0: The epicenter
  steps.push({
    iso3: epicenter.iso3,
    name: epicenter.name_en,
    dimension: preset.primaryDimension,
    severity: preset.initialSeverity,
    pathway: [`${preset.label} — ${preset.description}`],
    step: 0,
  });
  visited.add(`${epicenter.iso3}:${preset.primaryDimension}`);
  affectedCountries.add(epicenter.iso3);

  // BFS cascade
  let frontier: PropagationStep[] = [steps[0]];

  for (let stepNum = 1; stepNum <= MAX_STEPS; stepNum++) {
    const nextFrontier: PropagationStep[] = [];

    for (const node of frontier) {
      const sourceCountry = countries.find((c) => c.iso3 === node.iso3)!;
      const propagations = DIMENSION_PROPAGATION[node.dimension] ?? [];

      // Propagate to same dimension in nearby countries
      for (const target of countries) {
        if (target.iso3 === sourceCountry.iso3) continue;
        const proximity = regionProximity(sourceCountry, target);
        const vuln = vulnerabilityFactor(target);
        const newSeverity = node.severity * proximity * vuln * 0.6; // decay factor

        if (newSeverity < MIN_SEVERITY_THRESHOLD) continue;

        const key = `${target.iso3}:${node.dimension}`;
        if (visited.has(key)) continue;
        visited.add(key);

        nextFrontier.push({
          iso3: target.iso3,
          name: target.name_en,
          dimension: node.dimension,
          severity: newSeverity,
          pathway: [...node.pathway, `→ ${sourceCountry.name_en} spillover to ${target.name_en} (${(proximity * 100).toFixed(0)}% proximity, ${(vuln * 100).toFixed(0)}% vulnerability)`],
          step: stepNum,
        });
        affectedCountries.add(target.iso3);
      }

      // Propagate to new dimensions (cascading within epicenter + neighbors)
      for (const prop of propagations) {
        const newSeverity = node.severity * prop.weight * vulnerabilityFactor(sourceCountry);
        if (newSeverity < MIN_SEVERITY_THRESHOLD) continue;

        const key = `${sourceCountry.iso3}:${prop.to}`;
        if (visited.has(key)) continue;
        visited.add(key);

        nextFrontier.push({
          iso3: sourceCountry.iso3,
          name: sourceCountry.name_en,
          dimension: prop.to,
          severity: newSeverity,
          pathway: [...node.pathway, `→ ${prop.reason}`],
          step: stepNum,
        });
      }
    }

    if (nextFrontier.length === 0) break;
    // Keep top impacts per step to avoid explosion
    nextFrontier.sort((a, b) => b.severity - a.severity);
    const kept = nextFrontier.slice(0, 12);
    steps.push(...kept);
    frontier = kept;
  }

  // Sort by step, then severity
  steps.sort((a, b) => {
    if (a.step !== b.step) return a.step - b.step;
    return b.severity - a.severity;
  });

  // Calculate population affected
  let popAffected = 0;
  for (const iso3 of affectedCountries) {
    const c = countries.find((co) => co.iso3 === iso3);
    if (c) popAffected += c.population_m ?? 0;
  }

  const summary = `${preset.label}: ${affectedCountries.size} countries, ${popAffected.toFixed(0)}M people in the cascade path.`;

  return {
    preset,
    steps,
    populationAffectedM: popAffected,
    countriesAffected: affectedCountries.size,
    summary,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

export function severityColor(severity: number): string {
  if (severity >= 0.7) return "var(--color-blood-bright)";
  if (severity >= 0.4) return "var(--color-blood)";
  if (severity >= 0.2) return "var(--color-warning-amber)";
  return "var(--color-content-secondary)";
}

export function severityLabel(severity: number): string {
  if (severity >= 0.7) return "CATASTROPHIC";
  if (severity >= 0.4) return "SEVERE";
  if (severity >= 0.2) return "MODERATE";
  return "MINOR";
}

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  hunger: "Hunger",
  conflict: "Conflict",
  displacement: "Displacement",
  poverty: "Poverty",
  health: "Health",
  economy: "Economy",
  governance: "Governance",
  environment: "Environment",
};
