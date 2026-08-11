/**
 * V FOR X — Persona Modes
 *
 * Provides 5 persona modes that filter navigation and surface relevant tools
 * based on user role and threat model. Personas are stored in localStorage and
 * persist across sessions.
 *
 * The 5 personas:
 *   - JOURNALIST: Verification, witness, evidence, documentation
 *   - AID_WORKER: Allocation, trail, exchange, coordination
 *   - ACTIVIST: Direct action, resistance, safety, comms
 *   - RESEARCHER: Analysis, data, forecasting, methodology
 *   - CIVILIAN: General public, basic awareness, family safety
 *
 * Persona-based navigation:
 *   - Each persona has a set of "primary" routes that surface prominently
 *   - BranchNav can filter to show only persona-relevant routes
 *   - Persona affects home page CTAs and onboarding flow
 *
 * Storage: localStorage key "vfx_persona"
 */

/* ═══════════════════════════════════════════════════════════════
   Persona Definitions
   ═══════════════════════════════════════════════════════════════ */

export type PersonaId = "journalist" | "aid_worker" | "activist" | "researcher" | "civilian";

export interface Persona {
  /** Unique identifier for the persona */
  id: PersonaId;
  /** Display name (English base, localized via i18n) */
  name: string;
  /** Short description of the persona's focus */
  description: string;
  /** Icon/emoji for the persona */
  icon: string;
  /** Primary color accent */
  color: string;
  /** Primary navigation routes for this persona (href codes) */
  primaryRoutes: string[];
  /** Secondary routes (show but not emphasize) */
  secondaryRoutes: string[];
  /** Routes to hide/de-emphasize for this persona */
  hiddenRoutes: string[];
  /** Default ISO3 region focus for this persona (optional) */
  defaultRegion?: string;
  /** Threat model level for this persona */
  threatLevel: "low" | "medium" | "high" | "extreme";
}

export const PERSONAS: Record<PersonaId, Persona> = {
  journalist: {
    id: "journalist",
    name: "Journalist",
    description: "Verify claims, document evidence, protect sources",
    icon: "📰",
    color: "#3b82f6",
    primaryRoutes: ["01", "59", "19", "14", "21", "52"], // Sorrow Map, Forensics, Fronts, Stories, Briefing, Press Kit
    secondaryRoutes: ["29", "31", "46", "08", "50"], // Oracle, Vault, Testimony, Mask, Cipher
    hiddenRoutes: [],
    threatLevel: "high",
  },
  aid_worker: {
    id: "aid_worker",
    name: "Aid Worker",
    description: "Coordinate resources, track allocation, reach communities",
    icon: "🏥",
    color: "#10b981",
    primaryRoutes: ["06", "15", "39", "43", "12", "42"], // Trail, Allocator, Exchange, Submit, Act, Field Manual
    secondaryRoutes: ["01", "21", "34", "11", "59"], // Sorrow Map, Briefing, Simulator, Signal, Forensics
    hiddenRoutes: [],
    threatLevel: "medium",
  },
  activist: {
    id: "activist",
    name: "Activist",
    description: "Direct action, secure comms, evade surveillance",
    icon: "✊",
    color: "#f59e0b",
    primaryRoutes: ["12", "38", "08", "50", "05", "11"], // Act, Resistance, Mask, Cipher, Web, Signal
    secondaryRoutes: ["06", "42", "43", "54", "53", "01"], // Trail, Field Manual, Submit, Quorum, Relay, Sorrow Map
    hiddenRoutes: ["24"], // Ledger (government-facing tools)
    threatLevel: "extreme",
  },
  researcher: {
    id: "researcher",
    name: "Researcher",
    description: "Analyze data, forecast scenarios, document methodology",
    icon: "🔬",
    color: "#8b5cf6",
    primaryRoutes: ["02", "29", "30", "21", "09", "22"], // Equation, Oracle, Forecast, Briefing, Lens, Timeline
    secondaryRoutes: ["01", "13", "34", "35", "33"], // Sorrow Map, Index, Simulator, Crucible, Compare
    hiddenRoutes: [],
    threatLevel: "low",
  },
  civilian: {
    id: "civilian",
    name: "Civilian",
    description: "Stay informed, prepare family, find help",
    icon: "👤",
    color: "#6b7280",
    primaryRoutes: ["01", "21", "12", "42", "50", "51"], // Sorrow Map, Briefing, Act, Field Manual, Cipher, Canary
    secondaryRoutes: ["06", "15", "39", "43", "52"], // Trail, Allocator, Exchange, Submit, Press Kit
    hiddenRoutes: ["24", "54", "56"], // Ledger, Quorum, Onion (advanced tools)
    threatLevel: "medium",
  },
};

/* ═══════════════════════════════════════════════════════════════
   Persona Storage
   ═══════════════════════════════════════════════════════════════ */

const PERSONA_STORAGE_KEY = "vfx_persona";
const FULL_NAV_STORAGE_KEY = "vfx_full_nav";

/**
 * Get the current persona from localStorage.
 * Returns null if no persona is set.
 */
export function getPersona(): PersonaId | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(PERSONA_STORAGE_KEY);
    if (!stored) return null;

    const personaId = stored as PersonaId;
    if (PERSONAS[personaId]) {
      return personaId;
    }
    // Invalid persona stored, clear it
    localStorage.removeItem(PERSONA_STORAGE_KEY);
    return null;
  } catch {
    return null;
  }
}

/**
 * Set the current persona.
 */
export function setPersona(personaId: PersonaId): void {
  if (typeof window === "undefined") return;

  if (!PERSONAS[personaId]) {
    throw new Error(`Invalid persona ID: ${personaId}`);
  }

  localStorage.setItem(PERSONA_STORAGE_KEY, personaId);
}

/**
 * Clear the stored persona.
 */
export function clearPersona(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PERSONA_STORAGE_KEY);
}

/**
 * Get the persona object for the current persona.
 * Returns null if no persona is set.
 */
export function getCurrentPersona(): Persona | null {
  const personaId = getPersona();
  return personaId ? PERSONAS[personaId] : null;
}

/* ═══════════════════════════════════════════════════════════════
   Full Navigation Toggle
   ═══════════════════════════════════════════════════════════════ */

/**
 * Check if "full navigation" mode is enabled (show all routes regardless of persona).
 */
export function getFullNav(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const stored = localStorage.getItem(FULL_NAV_STORAGE_KEY);
    return stored === "true";
  } catch {
    return false;
  }
}

/**
 * Set the full navigation toggle.
 */
export function setFullNav(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FULL_NAV_STORAGE_KEY, enabled ? "true" : "false");
}

/**
 * Toggle full navigation mode.
 */
export function toggleFullNav(): boolean {
  const current = getFullNav();
  const newValue = !current;
  setFullNav(newValue);
  return newValue;
}

/* ═══════════════════════════════════════════════════════════════
   Route Filtering
   ═══════════════════════════════════════════════════════════════ */

export interface RouteFilterResult {
  /** Routes to show prominently */
  primary: string[];
  /** Routes to show normally */
  secondary: string[];
  /** Routes to hide */
  hidden: string[];
}

/**
 * Get route visibility for the current persona.
 * Returns all routes as primary if no persona is set or full nav is enabled.
 *
 * Note: Unknown routes (not in getAllRouteCodes) are always hidden unless
 * full nav is enabled with no persona.
 */
export function getRouteVisibility(): RouteFilterResult {
  const fullNav = getFullNav();
  const persona = getCurrentPersona();

  if (fullNav || !persona) {
    // Show all known routes as primary when full nav or no persona
    return {
      primary: getAllRouteCodes(),
      secondary: [],
      hidden: [],
    };
  }

  return {
    primary: persona.primaryRoutes,
    secondary: persona.secondaryRoutes,
    hidden: persona.hiddenRoutes,
  };
}

/**
 * Check if a route code should be visible for the current persona.
 * Returns false for unknown routes unless in full nav mode.
 * Full nav mode overrides persona filtering for all known routes.
 */
export function isRouteVisible(routeCode: string): boolean {
  const fullNav = getFullNav();
  const persona = getCurrentPersona();
  const allRoutes = getAllRouteCodes();

  // If full nav is on, all known routes are visible regardless of persona
  if (fullNav) {
    return allRoutes.includes(routeCode);
  }

  // If no persona and not full nav, all known routes are visible
  if (!persona) {
    return allRoutes.includes(routeCode);
  }

  // Check persona-specific visibility
  return persona.primaryRoutes.includes(routeCode) || persona.secondaryRoutes.includes(routeCode);
}

/**
 * Check if a route code is primary for the current persona.
 * Returns false for unknown routes or when in full nav mode.
 */
export function isRoutePrimary(routeCode: string): boolean {
  const fullNav = getFullNav();
  const persona = getCurrentPersona();

  // Full nav mode: no routes are "primary" since everything is shown equally
  if (fullNav) {
    return false;
  }

  // No persona: no primary distinction
  if (!persona) {
    return false;
  }

  // Check if route is in persona's primary routes
  return persona.primaryRoutes.includes(routeCode);
}

/**
 * Get all route codes across the platform.
 * This is a centralized list derived from DIRECTORY_CLUSTERS in page.tsx
 */
export function getAllRouteCodes(): string[] {
  return [
    "01", "26", "62", "25", "27", "16", "19", "28", "14", "29", "10", "30", "31", "32", "33", "72", // Explore
    "02", "20", "15", "34", "22", "13", "09", "24", "35", "17", "18", "36", "21", "37", "74", "73", "23", // Analyze
    "12", "03", "04", "38", "11", "39", "06", "40", "42", "41", "43", // Act
    "44", "45", "46", "47", "48", "75", "76", // Hold
    "08", "49", "50", "51", "59", "52", "05", "53", "54", "55", // Protect
    "07", "56", "62", "57", "58", // Infrastructure
  ];
}

/**
 * Filter an array of route codes to only include visible routes for the current persona.
 */
export function filterVisibleRoutes(routeCodes: string[]): string[] {
  return routeCodes.filter(isRouteVisible);
}

/**
 * Sort route codes by visibility (primary first, then secondary).
 */
export function sortRoutesByVisibility(routeCodes: string[]): string[] {
  const visibility = getRouteVisibility();

  return [...routeCodes].sort((a, b) => {
    const aPrimary = visibility.primary.includes(a);
    const bPrimary = visibility.primary.includes(b);
    const aSecondary = visibility.secondary.includes(a);
    const bSecondary = visibility.secondary.includes(b);

    // Primary routes first
    if (aPrimary && !bPrimary) return -1;
    if (!aPrimary && bPrimary) return 1;

    // Then secondary routes
    if (aSecondary && !bSecondary) return -1;
    if (!aSecondary && bSecondary) return 1;

    // Maintain original order for same tier
    return 0;
  });
}

/* ═══════════════════════════════════════════════════════════════
   Persona Selection Utilities
   ═══════════════════════════════════════════════════════════════ */

/**
 * Get recommended persona based on a simple questionnaire.
 * Returns null if questionnaire is incomplete.
 */
export interface PersonaQuestionnaire {
  /** Primary use case */
  primaryUse?: "verify" | "coordinate" | "act" | "analyze" | "stay_informed";
  /** Risk level concern */
  riskConcern?: "low" | "medium" | "high" | "extreme";
  /** Technical expertise */
  technicalLevel?: "basic" | "intermediate" | "advanced";
}

export function recommendPersona(questionnaire: PersonaQuestionnaire): PersonaId | null {
  const { primaryUse, riskConcern, technicalLevel } = questionnaire;

  if (!primaryUse) return null;

  // Direct mapping based on primary use case
  switch (primaryUse) {
    case "verify":
      return "journalist";
    case "coordinate":
      return "aid_worker";
    case "act":
      // Activist for high/extreme risk, civilian for lower risk
      if (riskConcern === "high" || riskConcern === "extreme") return "activist";
      return "civilian";
    case "analyze":
      return "researcher";
    case "stay_informed":
      // Civilian for basic, researcher for advanced
      if (technicalLevel === "advanced") return "researcher";
      return "civilian";
    default:
      return null;
  }
}

/**
 * Get all personas as an array for UI selection.
 */
export function getAllPersonas(): Persona[] {
  return Object.values(PERSONAS);
}

/**
 * Get persona by ID.
 */
export function getPersonaById(id: PersonaId): Persona | null {
  return PERSONAS[id] || null;
}

/* ═══════════════════════════════════════════════════════════════
   Persona Metadata
   ═══════════════════════════════════════════════════════════════ */

/**
 * Get the number of routes considered "primary" for a persona.
 */
export function getPersonaPrimaryCount(personaId: PersonaId): number {
  const persona = getPersonaById(personaId);
  return persona ? persona.primaryRoutes.length : 0;
}

/**
 * Get the total number of visible routes for a persona (primary + secondary).
 */
export function getPersonaVisibleCount(personaId: PersonaId): number {
  const persona = getPersonaById(personaId);
  if (!persona) return 0;
  return persona.primaryRoutes.length + persona.secondaryRoutes.length;
}

/**
 * Get the threat level for a persona.
 */
export function getPersonaThreatLevel(personaId: PersonaId): Persona["threatLevel"] | null {
  const persona = getPersonaById(personaId);
  return persona ? persona.threatLevel : null;
}

/**
 * Get a human-readable description of the threat level.
 */
export function getThreatLevelDescription(level: Persona["threatLevel"]): string {
  switch (level) {
    case "low":
      return "Low risk - general public use";
    case "medium":
      return "Medium risk - some caution advised";
    case "high":
      return "High risk - heightened security measures";
    case "extreme":
      return "Extreme risk - maximum security, use caution";
    default:
      return "Unknown";
  }
}
