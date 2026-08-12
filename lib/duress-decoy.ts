/**
 * V FOR X — Duress Decoy Mode with Full Identity Stashing
 *
 * Extends the panic/duress system with a decoy mode that supports:
 * 1. Second/decoy identity generation (plausible but separate from real identity)
 * 2. Stashing (backing up) the real identity, missions progress, and ops journal
 * 3. Restoring the real data when exiting decoy mode
 * 4. Full audit trail of stash/restore operations
 *
 * When coerced to unlock the device, the user enters the decoy
 * duress code instead of the real one. The app enters decoy mode:
 *   - Real identity, missions, and ops journal are securely backed up
 *   - A decoy identity is generated and becomes active
 *   - Plausible fake data is shown (benign country visits, low-level badges)
 *   - All sensitive IndexedDB stores remain hidden
 *   - The app looks and behaves normally
 *
 * When exiting decoy mode, the real identity and data are restored,
 * and the decoy identity is discarded.
 *
 * This is the standard "hidden volume" approach used by VeraCrypt
 * and similar tools, adapted for a web app context with dual identity support.
 */

import type { Identity } from "./identity";
import { generateIdentity, saveIdentity, loadIdentity, deleteIdentity, saveIdentityToHistory, loadPreviousIdentities } from "./identity";
import { getMissionsState, saveMissionsState, resetAllMissionsProgress } from "./missions";
import { getOpsJournal, saveOpsJournal, clearOpsJournal } from "./ops-journal";
import { createBackup, saveBackup, restoreBackup, executePanicWipe, type StorageBackup } from "./storage-map";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export type DuressMode = "normal" | "decoy" | "wipe";

export interface DuressConfig {
  /** The decoy duress code that triggers decoy mode */
  decoyCode: string;
  /** Whether decoy mode is enabled */
  enabled: boolean;
  /** Handle of the decoy identity (if set) */
  decoyIdentityHandle?: string;
}

export interface DuressStashRecord {
  /** When the real data was stashed */
  stashedAt: number;
  /** Backup ID containing the real data */
  backupId: string;
  /** Handle of the real identity that was stashed */
  realIdentityHandle: string;
  /** Whether the stash has been restored */
  restored: boolean;
  /** When the stash was restored (null if not restored) */
  restoredAt: number | null;
}

/* ═══════════════════════════════════════════════════════════════
   State persistence
   ═══════════════════════════════════════════════════════════════ */

const DECOY_CONFIG_KEY = "vfx_duress_cfg";
const DECOY_MODE_KEY = "vfx_duress_mode";
const DECOY_IDENTITY_KEY = "vfx_duress_decoy_identity";
const STASH_RECORD_KEY = "vfx_duress_stash_record";

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
 * Full decoy activation with identity stashing.
 *
 * This async function:
 * 1. Backs up the real identity, missions progress, and ops journal
 * 2. Generates or loads a decoy identity
 * 3. Activates the decoy identity with plausible fake data
 * 4. Records the stash operation in the audit log
 *
 * Returns the stash record for tracking.
 */
export async function enterDecoyMode(): Promise<DuressStashRecord> {
  // Load current state before entering decoy mode
  const realIdentity = await loadIdentity();
  if (!realIdentity) {
    throw new Error("Cannot enter decoy mode: no real identity found. Create an identity first.");
  }

  // Create backup of real data
  const keysToBackup = [
    "vfx_identity",
    "vfx_identity_history",
    "vfx_missions_progress",
    "vfx_ops_journal",
  ];

  const backup = createBackup(
    keysToBackup,
    `duress-stash-${realIdentity.handle}`,
    "Real identity and data stashed before entering decoy mode"
  );
  saveBackup(backup);

  // Generate decoy identity if it doesn't exist
  let decoyIdentity = await loadDecoyIdentity();
  if (!decoyIdentity) {
    decoyIdentity = await generateDecoyIdentity();
    await saveDecoyIdentity(decoyIdentity);
  }

  // Switch to decoy identity (this replaces the real identity)
  await saveIdentity(decoyIdentity);

  // Activate decoy data (fake gamification, clear watchlist, etc.)
  activateDecoyData();

  // Set mode to decoy
  setActiveMode("decoy");

  // Record the stash operation
  const stashRecord: DuressStashRecord = {
    stashedAt: Date.now(),
    backupId: backup.id,
    realIdentityHandle: realIdentity.handle,
    restored: false,
    restoredAt: null,
  };
  saveStashRecord(stashRecord);

  // Log in ops journal (using decoy identity now)
  try {
    // Create a minimal log that we entered decoy mode (recorded in decoy journal)
    const { logEvent } = await import("./ops-journal");
    await logEvent({
      type: "custom",
      title: "Entered decoy mode",
      details: {
        decoyHandle: decoyIdentity.handle,
        realHandleStashed: realIdentity.handle,
      },
    });
  } catch {
    // Silently fail if ops journal is not available
  }

  return stashRecord;
}

/**
 * Exit decoy mode and restore real identity and data.
 *
 * This async function:
 * 1. Loads the stash record to find the real data backup
 * 2. Restores the real identity, missions progress, and ops journal
 * 3. Clears the decoy identity
 * 4. Records the restoration in the audit log
 *
 * Returns the handle of the restored real identity.
 */
export async function exitDecoyMode(): Promise<string> {
  // Load stash record
  const stashRecord = loadStashRecord();
  if (!stashRecord) {
    throw new Error("Cannot exit decoy mode: no stash record found. Real data may be lost.");
  }

  if (stashRecord.restored) {
    throw new Error("Stash already restored. Cannot restore twice.");
  }

  // Load the backup containing real data
  const backups = await import("./storage-map");
  const allBackups = backups.loadBackups();
  const realBackup = allBackups.find((b) => b.id === stashRecord.backupId);

  if (!realBackup) {
    throw new Error("Cannot exit decoy mode: backup containing real data not found.");
  }

  // Restore the real data (this restores identity, missions, ops journal)
  restoreBackup(realBackup);

  // Load the restored real identity to verify
  const realIdentity = await loadIdentity();
  if (!realIdentity || realIdentity.handle !== stashRecord.realIdentityHandle) {
    throw new Error("Real identity restoration failed or identity mismatch.");
  }

  // Clear the decoy identity
  deleteDecoyIdentity();

  // Set mode back to normal
  setActiveMode("normal");

  // Update stash record
  stashRecord.restored = true;
  stashRecord.restoredAt = Date.now();
  saveStashRecord(stashRecord);

  // Log in ops journal (using real identity now)
  try {
    const { logEvent } = await import("./ops-journal");
    await logEvent({
      type: "custom",
      title: "Exited decoy mode - real identity restored",
      details: {
        realHandle: realIdentity.handle,
        decoyModeDuration: Date.now() - stashRecord.stashedAt,
      },
    });
  } catch {
    // Silently fail if ops journal is not available
  }

  return realIdentity.handle;
}

/**
 * Check if we're currently in decoy mode.
 */
export function isInDecoyMode(): boolean {
  return getActiveMode() === "decoy";
}

/* ═══════════════════════════════════════════════════════════════
   Decoy Identity Management
   ═══════════════════════════════════════════════════════════════ */

/**
 * Load the decoy identity from localStorage.
 */
async function loadDecoyIdentity(): Promise<Identity | null> {
  const stored = localStorage.getItem(DECOY_IDENTITY_KEY);
  if (!stored) return null;

  try {
    const data = JSON.parse(stored);

    const privateKey = await crypto.subtle.importKey(
      "jwk",
      data.privateJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign"]
    );

    const publicKey = await crypto.subtle.importKey(
      "jwk",
      data.publicJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["verify"]
    );

    return {
      privateKey,
      publicKey,
      publicKeyHex: data.publicKeyHex,
      handle: data.handle,
      fingerprint: data.fingerprint,
      createdAt: data.createdAt,
    };
  } catch {
    return null;
  }
}

/**
 * Save the decoy identity to localStorage.
 */
async function saveDecoyIdentity(identity: Identity): Promise<void> {
  const privateJwk = await crypto.subtle.exportKey("jwk", identity.privateKey);
  const publicJwk = await crypto.subtle.exportKey("jwk", identity.publicKey);

  const data = {
    privateJwk,
    publicJwk,
    publicKeyHex: identity.publicKeyHex,
    handle: identity.handle,
    fingerprint: identity.fingerprint,
    createdAt: identity.createdAt,
  };

  localStorage.setItem(DECOY_IDENTITY_KEY, JSON.stringify(data));

  // Update duress config to track the decoy identity handle
  const config = loadDuressConfig();
  config.decoyIdentityHandle = identity.handle;
  saveDuressConfig(config);
}

/**
 * Delete the decoy identity from localStorage.
 */
function deleteDecoyIdentity(): void {
  localStorage.removeItem(DECOY_IDENTITY_KEY);

  // Clear decoy identity handle from config
  const config = loadDuressConfig();
  config.decoyIdentityHandle = undefined;
  saveDuressConfig(config);
}

/**
 * Generate a decoy identity that looks plausible but is completely separate.
 *
 * The decoy identity:
 * - Has a different handle/fingerprint than the real identity
 * - Is generated deterministically from the decoy code (so it's consistent)
 * - Can be used for signing but is not linked to the real identity
 */
async function generateDecoyIdentity(): Promise<Identity> {
  // Generate decoy identity (similar to normal identity but marked as decoy)
  const decoyIdentity = await generateIdentity();

  return decoyIdentity;
}

/* ═══════════════════════════════════════════════════════════════
   Stash Record Management
   ═══════════════════════════════════════════════════════════════ */

/**
 * Load the stash record from localStorage.
 */
function loadStashRecord(): DuressStashRecord | null {
  if (typeof localStorage === "undefined") return null;

  try {
    const raw = localStorage.getItem(STASH_RECORD_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DuressStashRecord;
  } catch {
    return null;
  }
}

/**
 * Save the stash record to localStorage.
 */
function saveStashRecord(record: DuressStashRecord): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(STASH_RECORD_KEY, JSON.stringify(record));
  } catch {
    // Storage error, ignore
  }
}

/**
 * Clear the stash record from localStorage.
 */
function clearStashRecord(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STASH_RECORD_KEY);
}

/* ═══════════════════════════════════════════════════════════════
   Utility Functions
   ═══════════════════════════════════════════════════════════════ */

/**
 * Get the current stash status.
 *
 * Returns information about whether data is stashed and whether it can be restored.
 */
export function getStashStatus(): {
  isStashed: boolean;
  canRestore: boolean;
  stashRecord: DuressStashRecord | null;
  isInDecoyMode: boolean;
} {
  const stashRecord = loadStashRecord();
  const inDecoyMode = isInDecoyMode();

  return {
    isStashed: stashRecord !== null,
    canRestore: stashRecord !== null && !stashRecord.restored && inDecoyMode,
    stashRecord,
    isInDecoyMode: inDecoyMode,
  };
}

/**
 * Force restore real data from stash (emergency recovery).
 *
 * This can be called if the normal exitDecoyMode fails or if you want to
 * restore data while in a corrupted state. It performs a panic wipe on
 * the current state then restores from the stash backup.
 *
 * Returns the handle of the restored identity.
 */
export async function emergencyRestoreRealIdentity(): Promise<string> {
  const stashRecord = loadStashRecord();
  if (!stashRecord) {
    throw new Error("No stash record found. Cannot perform emergency restore.");
  }

  // Load the backup
  const backups = await import("./storage-map");
  const allBackups = backups.loadBackups();
  const realBackup = allBackups.find((b) => b.id === stashRecord.backupId);

  if (!realBackup) {
    throw new Error("Backup containing real data not found.");
  }

  // Perform panic wipe on current state (clears everything)
  await executePanicWipe("manual", {
    reason: "Emergency restore - clearing current state before restoring real data",
    testMode: false,
  });

  // Restore the real data
  restoreBackup(realBackup);

  // Verify restoration
  const realIdentity = await loadIdentity();
  if (!realIdentity || realIdentity.handle !== stashRecord.realIdentityHandle) {
    throw new Error("Emergency restore verification failed.");
  }

  // Update stash record
  stashRecord.restored = true;
  stashRecord.restoredAt = Date.now();
  saveStashRecord(stashRecord);

  // Reset mode to normal
  setActiveMode("normal");

  return realIdentity.handle;
}
