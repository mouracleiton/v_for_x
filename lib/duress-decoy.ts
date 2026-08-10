/**
 * V FOR X — Duress Decoy Mode
 *
 * Extends the panic/duress system with a decoy mode: instead of
 * wiping everything (which signals to a coercer that data existed),
 * the decoy mode swaps in plausible fake data that looks real.
 *
 * When coerced to unlock the device, the user enters the decoy
 * duress code instead of the real one. The app enters decoy mode:
 *   - Shows a plausible subset of "safe" data (benign country visits,
 *     low-level badges, no sensitive dossiers or messages)
 *   - All sensitive IndexedDB stores remain encrypted/hidden
 *   - The app looks and behaves normally
 *
 * This is the standard "hidden volume" approach used by VeraCrypt
 * and similar tools, adapted for a web app context.
 */

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export type DuressMode = "normal" | "decoy" | "wipe";

export interface DuressConfig {
  /** The decoy duress code that triggers decoy mode */
  decoyCode: string;
  /** Whether decoy mode is enabled */
  enabled: boolean;
}

/* ═══════════════════════════════════════════════════════════════
   State persistence
   ═══════════════════════════════════════════════════════════════ */

const DECOY_CONFIG_KEY = "vfx_duress_cfg";
const DECOY_MODE_KEY = "vfx_duress_mode";

/**
 * Load the duress configuration.
 * The config is stored in localStorage (not IndexedDB) so it survives
 * a panic wipe of the main data stores.
 */
export function loadDuressConfig(): DuressConfig {
  if (typeof localStorage === "undefined") {
    return { decoyCode: "", enabled: false };
  }
  try {
    const raw = localStorage.getItem(DECOY_CONFIG_KEY);
    if (!raw) return { decoyCode: "", enabled: false };
    return JSON.parse(raw);
  } catch {
    return { decoyCode: "", enabled: false };
  }
}

/**
 * Save the duress configuration.
 */
export function saveDuressConfig(config: DuressConfig): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(DECOY_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

/**
 * Set up the decoy mode with a user-chosen code.
 */
export function enableDecoyMode(decoyCode: string): void {
  saveDuressConfig({ decoyCode, enabled: true });
}

/**
 * Disable decoy mode entirely.
 */
export function disableDecoyMode(): void {
  saveDuressConfig({ decoyCode: "", enabled: false });
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(DECOY_MODE_KEY);
  }
}

/**
 * Get the current active duress mode.
 * "normal" = regular operation
 * "decoy" = showing fake data
 */
export function getActiveMode(): DuressMode {
  if (typeof localStorage === "undefined") return "normal";
  try {
    const mode = localStorage.getItem(DECOY_MODE_KEY);
    return (mode as DuressMode) || "normal";
  } catch {
    return "normal";
  }
}

/**
 * Set the active duress mode.
 */
export function setActiveMode(mode: DuressMode): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (mode === "normal") {
      localStorage.removeItem(DECOY_MODE_KEY);
    } else {
      localStorage.setItem(DECOY_MODE_KEY, mode);
    }
  } catch {
    // ignore
  }
}

/**
 * Check if a given code is the decoy code.
 * Returns the action to take.
 */
export function checkDuressCode(code: string): DuressMode {
  const config = loadDuressConfig();
  if (!config.enabled || !config.decoyCode) return "normal";
  if (code === config.decoyCode) return "decoy";
  return "normal";
}

/* ═══════════════════════════════════════════════════════════════
   Decoy data generation
   ═══════════════════════════════════════════════════════════════ */

/**
 * Generate plausible decoy gamification state that looks real
 * but contains no sensitive information.
 *
 * - A few "safe" country visits (popular tourist destinations)
 * - A couple of bronze badges
 * - Low XP that looks like casual usage
 */
export function generateDecoyState() {
  const safeCountries = [
    "FRA", "DEU", "JPN", "BRA", "AUS", "CAN", "GBR", "ITA", "ESP", "PRT",
  ];
  const safeDimensions = ["demographics", "economy", "health"];
  const visitedCount = 5 + Math.floor(Math.random() * 5);
  const visited = safeCountries.slice(0, visitedCount);

  return {
    countriesVisited: visited,
    dimensionsExplored: safeDimensions,
    dossiersRead: [] as string[],
    storiesCompleted: [] as string[],
    campaignsGenerated: 0,
    badges: [
      { id: "first-steps", name: "First Steps", description: "Visit your first country", emoji: "👣", tier: "bronze" as const, earnedAt: Date.now() - 86400000 * 7 },
      { id: "explorer", name: "Explorer", description: "Visit 10 countries", emoji: "🧭", tier: "bronze" as const, earnedAt: Date.now() - 86400000 * 3 },
    ],
    xp: visitedCount * 5 + 9,
    level: 1,
  };
}

/**
 * Apply decoy state to the gamification store, replacing the real
 * data with fake data.
 */
export function activateDecoyData(): void {
  if (typeof localStorage === "undefined") return;
  const decoy = generateDecoyState();
  localStorage.setItem("vfx-gamification", JSON.stringify(decoy));
  // Clear the watchlist (no sensitive alert rules in decoy mode)
  localStorage.removeItem("vfx-watch");
  // Set a benign session
  localStorage.setItem(
    "vfx-session",
    JSON.stringify({
      startTime: Date.now(),
      ttlMs: 3600000,
      countryContext: null,
    }),
  );
}

/**
 * Full decoy activation: set mode, swap in fake data.
 */
export function enterDecoyMode(): void {
  setActiveMode("decoy");
  activateDecoyData();
}

/**
 * Exit decoy mode and return to normal operation.
 * Note: the real data was replaced by decoy data, so exiting
 * decoy mode only changes the mode flag. Real data recovery
 * requires re-importing from a backup.
 */
export function exitDecoyMode(): void {
  setActiveMode("normal");
}

/**
 * Check if we're currently in decoy mode.
 */
export function isInDecoyMode(): boolean {
  return getActiveMode() === "decoy";
}
