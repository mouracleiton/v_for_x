import type { CountryData } from "./types";

/**
 * V FOR X — Cross-branch link generator
 * Generates contextual links between branches based on data context.
 */

export interface CrossLink {
  href: string;
  label: string;
  description: string;
}

export function countryToEquation(iso3: string): CrossLink {
  return {
    href: `/equation/?country=${iso3}`,
    label: "MODEL THE SOLUTION",
    description: "See the cost to fix this country's hunger crisis",
  };
}

export function countryToProtocol(iso3: string, crisisProfile: {
  isHotspot: boolean;
  conflictIntensity: number;
  famineRisk: number;
  connectivity: number;
}): CrossLink {
  return {
    href: `/protocol-x/?country=${iso3}`,
    label: "RELEVANT BLUEPRINTS",
    description: crisisProfile.conflictIntensity >= 3
      ? "Survival and resistance tactics for active conflict zones"
      : crisisProfile.famineRisk >= 3
        ? "Food security and emergency agriculture blueprints"
        : "Resilience and preparedness guides for this region",
  };
}

/* ═══ BLUEPRINT MATCHING ═══
 * Maps a country's data profile to relevant Protocol-X blueprints.
 * Each rule checks one or more conditions on the country record.
 */

export interface BlueprintMatch {
  blueprintId: string;
  reason: string;
  priority: "critical" | "recommended" | "resilience";
}

interface BlueprintRule {
  id: string;
  match: (c: CountryData) => boolean;
  reason: (c: CountryData) => string;
  priority: "critical" | "recommended" | "resilience";
}

const BLUEPRINT_RULES: BlueprintRule[] = [
  // Water
  {
    id: "water-solar-purification",
    match: (c) =>
      (c.water_sanitation.basic_access_pct ?? 100) < 80 ||
      (c.water_sanitation.safe_sanitation_pct ?? 100) < 50,
    reason: (c) =>
      `Water access at ${c.water_sanitation.basic_access_pct ?? "?"}%. Solar purification needs no chemicals or electricity.`,
    priority: "critical",
  },
  {
    id: "water-boiling",
    match: (c) =>
      (c.water_sanitation.basic_access_pct ?? 100) < 90,
    reason: (c) =>
      `Basic water access: ${c.water_sanitation.basic_access_pct ?? "?"}%. Boiling is the universal fallback.`,
    priority: "recommended",
  },
  // Food
  {
    id: "food-drying",
    match: (c) =>
      (c.hunger.undernourishment_pct ?? 0) > 15 ||
      (c.hunger.food_insecurity_mod_severe_pct ?? 0) > 30,
    reason: (c) =>
      `Undernourishment ${c.hunger.undernourishment_pct ?? "?"}%. Food preservation extends scarce supplies.`,
    priority: "critical",
  },
  {
    id: "food-emergency-garden",
    match: (c) =>
      (c.hunger.undernourishment_pct ?? 0) > 20 ||
      (c.hunger.famine_risk_1to5 ?? 0) >= 3,
    reason: (c) =>
      `Famine risk ${c.hunger.famine_risk_1to5 ?? "?"}/5. Self-sufficient food production reduces dependency.`,
    priority: "critical",
  },
  // Power
  {
    id: "power-micro-solar",
    match: (c) =>
      (c.energy?.no_access_electricity_m ?? 0) > 0 ||
      (c.connectivity.internet_users_pct ?? 100) < 40,
    reason: (c) =>
      c.energy?.no_access_electricity_m
        ? `${c.energy.no_access_electricity_m}M without electricity. Micro-solar is decentralized power.`
        : `Internet access at ${c.connectivity.internet_users_pct ?? "?"}%. Solar power enables connectivity.`,
    priority: "recommended",
  },
  {
    id: "power-bicycle-generator",
    match: (c) =>
      (c.energy?.no_access_electricity_m ?? 0) > 1,
    reason: (c) =>
      `${c.energy?.no_access_electricity_m}M without grid power. Human-powered generation works anywhere.`,
    priority: "resilience",
  },
  // Comms
  {
    id: "comms-mesh-network",
    match: (c) =>
      (c.connectivity.internet_users_pct ?? 100) < 50 ||
      c.conflict.intensity_1to5 >= 3,
    reason: (c) =>
      c.conflict.intensity_1to5 >= 3
        ? `Conflict L${c.conflict.intensity_1to5}/5. Mesh networks survive infrastructure attacks.`
        : `Internet at ${c.connectivity.internet_users_pct ?? "?"}%. Mesh networking bypasses central control.`,
    priority: "critical",
  },
  {
    id: "comms-dead-drop",
    match: (c) => c.conflict.intensity_1to5 >= 4,
    reason: () =>
      `Severe conflict. Dead drops enable communication when all networks are monitored or destroyed.`,
    priority: "critical",
  },
  // Medical
  {
    id: "medical-field-first-aid",
    match: (c) =>
      (c.health.doctors_per_1000 ?? 5) < 1.0 ||
      (c.health.child_mortality_under5_per1k ?? 0) > 40,
    reason: (c) =>
      `Doctors: ${c.health.doctors_per_1000 ?? "?"}/1000. Field first-aid saves lives when no doctor exists.`,
    priority: "critical",
  },
  // Security
  {
    id: "security-digital-opsec",
    match: (c) =>
      (c.governance.electoral_democracy_index ?? 1) < 0.4 ||
      (c.governance.corruption_perceptions_index ?? 100) < 35,
    reason: (c) =>
      `Democracy index: ${c.governance.electoral_democracy_index ?? "?"}. OpSec is survival under authoritarian regimes.`,
    priority: "recommended",
  },
  // Organizing
  {
    id: "organizing-mutual-aid",
    match: (c) =>
      (c.hunger.undernourishment_pct ?? 0) > 15 ||
      (c.poverty.headcount_365_pct ?? 0) > 20,
    reason: (c) =>
      `Extreme poverty: ${c.poverty.headcount_365_pct ?? "?"}%. Mutual aid networks are community survival infrastructure.`,
    priority: "recommended",
  },
  {
    id: "organizing-nonviolent-resistance",
    match: (c) =>
      c.conflict.intensity_1to5 >= 3 ||
      (c.governance.electoral_democracy_index ?? 1) < 0.3,
    reason: (c) =>
      `Conflict L${c.conflict.intensity_1to5}/5. Nonviolent resistance succeeds 53% of the time vs 26% for armed.`,
    priority: "critical",
  },
];

/** Returns matching blueprints for a country, sorted by priority. */
export function countryToBlueprints(country: CountryData): BlueprintMatch[] {
  const matches = BLUEPRINT_RULES.filter((r) => r.match(country)).map((r) => ({
    blueprintId: r.id,
    reason: r.reason(country),
    priority: r.priority,
  }));
  const order = { critical: 0, recommended: 1, resilience: 2 };
  return matches.sort((a, b) => order[a.priority] - order[b.priority]);
}

/** Returns a single link object for protocol-x with contextual description. */
export function countryToBlueprintLink(country: CountryData): CrossLink {
  const matches = countryToBlueprints(country);
  const critical = matches.filter((m) => m.priority === "critical").length;
  return {
    href: `/protocol-x/?country=${country.iso3}`,
    label: `${matches.length} RELEVANT BLUEPRINTS`,
    description: critical > 0
      ? `${critical} critical-priority survival protocols for this country's conditions`
      : matches.length > 0
        ? `${matches.length} resilience guides matched to this country's profile`
        : "Browse all survival and resilience blueprints",
  };
}

export function countryToRegistry(iso3: string): CrossLink {
  return {
    href: `/registry/?country=${iso3}`,
    label: "SEE RESPONSIBLE ACTORS",
    description: "Dossiers on governance and corruption in this country",
  };
}

export function countryToTrilha(iso3: string): CrossLink {
  return {
    href: `/the-trail/?need=${iso3}`,
    label: "ROUTE RESOURCES HERE",
    description: "Connect this region to aid and logistics networks",
  };
}

export function equationToTrilha(): CrossLink {
  return {
    href: "/the-trail/",
    label: "FUND THE SOLUTION",
    description: "Route resources based on the financing allocation",
  };
}

export function equationToProtocol(): CrossLink {
  return {
    href: "/protocol-x/",
    label: "IMPLEMENTATION GUIDES",
    description: "How to advocate for and execute each financing mechanism",
  };
}

export function equationToRegistry(): CrossLink {
  return {
    href: "/registry/",
    label: "DOCUMENT FOR TRIBUNAL",
    description: "War crimes documentation → ICJ accountability flow",
  };
}

export const branchLinks = [
  { href: "/", label: "BRIEFING", code: "00" },
  { href: "/sorrow-map/", label: "SORROW MAP", code: "01" },
  { href: "/equation/", label: "THE EQUATION", code: "02" },
  { href: "/protocol-x/", label: "PROTOCOL X", code: "03" },
  { href: "/registry/", label: "REGISTRY", code: "04" },
  { href: "/the-web/", label: "THE WEB", code: "05" },
  { href: "/the-trail/", label: "THE TRAIL", code: "06" },
  { href: "/fortress/", label: "FORTRESS", code: "07" },
  { href: "/the-mask/", label: "MASK", code: "08" },
  { href: "/the-lens/", label: "THE LENS", code: "09" },
  { href: "/the-archive/", label: "ARCHIVE", code: "10" },
  { href: "/the-signal/", label: "SIGNAL", code: "11" },
  { href: "/the-act/", label: "THE ACT", code: "12" },
  { href: "/the-index/", label: "THE INDEX", code: "13" },
  { href: "/the-stories/", label: "STORIES", code: "14" },
  { href: "/the-allocator/", label: "ALLOCATOR", code: "15" },
  { href: "/the-exodus/", label: "EXODUS", code: "16" },
  { href: "/the-tactics/", label: "TACTICS", code: "17" },
  { href: "/the-matrix/", label: "MATRIX", code: "18" },
  { href: "/the-fronts/", label: "FRONTS", code: "19" },
  { href: "/the-choice/", label: "CHOICE", code: "20" },
  { href: "/the-briefing/", label: "BRIEFING", code: "21" },
  { href: "/the-timeline/", label: "TIMELINE", code: "22" },
  { href: "/the-api/", label: "API", code: "23" },
  { href: "/the-ledger/", label: "LEDGER", code: "24" },
  { href: "/the-dashboard/", label: "DASHBOARD", code: "25" },
] as const;
