/**
 * V FOR X — Operations Journal
 *
 * Local activity logging for self-monitoring and ops journal.
 * Tracks user actions, mission progress, and platform usage patterns.
 * All data stays local - no phone-home, no analytics.
 *
 * Storage: localStorage key "vfx_ops_journal"
 */

import type { PersonaId } from "./personas";
import type { MissionId } from "./missions";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export type OpsEventType =
  | "persona_selected"
  | "identity_created"
  | "identity_loaded"
  | "identity_rotated"
  | "mission_started"
  | "mission_step_completed"
  | "mission_completed"
  | "pack_created"
  | "pack_imported"
  | "witness_signed"
  | "evidence_created"
  | "trail_entry_created"
  | "webrtc_connection"
  | "guardian_packet_created"
  | "deadman_armed"
  | "page_visited"
  | "search_performed"
  | "export_triggered"
  | "settings_changed"
  | "custom";

export interface OpsEvent {
  /** Unique event ID (UUID v4) */
  id: string;
  /** Event type */
  type: OpsEventType;
  /** When the event occurred */
  timestamp: number;
  /** Event title/description */
  title: string;
  /** Optional details */
  details?: Record<string, unknown>;
  /** Related persona (if applicable) */
  personaId?: PersonaId;
  /** Related mission (if applicable) */
  missionId?: MissionId;
  /** Related page/route (if applicable) */
  route?: string;
  /** Identity handle when event was logged (optional, for binding) */
  identityHandle?: string;
  /** Identity fingerprint when event was logged (optional, for verification) */
  identityFingerprint?: string;
}

export interface OpsJournal {
  /** All recorded events */
  events: OpsEvent[];
  /** When the journal was created */
  createdAt: number;
  /** When the journal was last updated */
  lastUpdated: number;
}

export interface OpsStats {
  /** Total events recorded */
  totalEvents: number;
  /** Events by type */
  eventsByType: Record<OpsEventType, number>;
  /** Most active routes */
  topRoutes: Array<{ route: string; count: number }>;
  /** Mission completion count */
  missionsCompleted: number;
  /** Current persona (if set) */
  currentPersona: PersonaId | null;
  /** Journal age in days */
  journalAgeDays: number;
}

const OPS_JOURNAL_STORAGE_KEY = "vfx_ops_journal";

/* ═══════════════════════════════════════════════════════════════
   Journal Management
   ═══════════════════════════════════════════════════════════════ */

/**
 * Get the ops journal from localStorage.
 * Creates a new journal if none exists.
 */
export function getOpsJournal(): OpsJournal {
  if (typeof localStorage === "undefined") {
    return {
      events: [],
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    };
  }

  try {
    const stored = localStorage.getItem(OPS_JOURNAL_STORAGE_KEY);
    if (!stored) {
      return createOpsJournal();
    }

    const parsed = JSON.parse(stored) as OpsJournal;

    // Validate structure
    if (!Array.isArray(parsed.events) || typeof parsed.lastUpdated !== "number") {
      return createOpsJournal();
    }

    return parsed;
  } catch {
    return createOpsJournal();
  }
}

/**
 * Create a new ops journal.
 */
function createOpsJournal(): OpsJournal {
  const journal: OpsJournal = {
    events: [],
    createdAt: Date.now(),
    lastUpdated: Date.now(),
  };

  saveOpsJournal(journal);
  return journal;
}

/**
 * Save the ops journal to localStorage.
 */
export function saveOpsJournal(journal: OpsJournal): void {
  if (typeof localStorage === "undefined") return;

  try {
    journal.lastUpdated = Date.now();
    localStorage.setItem(OPS_JOURNAL_STORAGE_KEY, JSON.stringify(journal));
  } catch (error) {
    console.error("Failed to save ops journal:", error);
  }
}

/* ═══════════════════════════════════════════════════════════════
   Event Logging
   ═══════════════════════════════════════════════════════════════ */

/**
 * Generate a simple UUID v4.
 */
function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Log an event to the ops journal.
 * Automatically attaches identity handle/fingerprint if available.
 */
export async function logEvent(event: Omit<OpsEvent, "id" | "timestamp" | "identityHandle" | "identityFingerprint">): Promise<void> {
  const journal = getOpsJournal();

  const newEvent: OpsEvent = {
    id: generateId(),
    timestamp: Date.now(),
    ...event,
  };

  // Attach identity information if available
  try {
    if (typeof window !== "undefined" && window.crypto) {
      const { loadIdentity } = await import("./identity");
      const identity = await loadIdentity();
      if (identity) {
        newEvent.identityHandle = identity.handle;
        newEvent.identityFingerprint = identity.fingerprint;
      }
    }
  } catch {
    // Silently fail if identity system is not available
    // This maintains backward compatibility
  }

  journal.events.push(newEvent);

  // Keep only the last 1000 events to prevent storage bloat
  if (journal.events.length > 1000) {
    journal.events = journal.events.slice(-1000);
  }

  saveOpsJournal(journal);
}

/**
 * Log a persona selection event.
 */
export async function logPersonaSelected(personaId: PersonaId, personaName?: string): Promise<void> {
  await logEvent({
    type: "persona_selected",
    title: `Selected persona: ${personaName || personaId}`,
    details: { personaId, personaName },
    personaId,
  });
}

/**
 * Log an identity creation event.
 */
export async function logIdentityCreated(handle: string): Promise<void> {
  await logEvent({
    type: "identity_created",
    title: `Created identity: ${handle}`,
    details: { handle },
  });
}

/**
 * Log an identity loaded event.
 */
export async function logIdentityLoaded(handle: string): Promise<void> {
  await logEvent({
    type: "identity_loaded",
    title: `Loaded identity: ${handle}`,
    details: { handle },
  });
}

/**
 * Log an identity rotation event.
 */
export async function logIdentityRotated(oldHandle: string, newHandle: string): Promise<void> {
  await logEvent({
    type: "identity_rotated",
    title: `Rotated identity: ${oldHandle} → ${newHandle}`,
    details: { oldHandle, newHandle },
  });
}

/**
 * Log a mission started event.
 */
export async function logMissionStarted(missionId: MissionId, missionName: string): Promise<void> {
  await logEvent({
    type: "mission_started",
    title: `Started mission: ${missionName}`,
    details: { missionId, missionName },
    missionId,
  });
}

/**
 * Log a mission step completed event.
 */
export async function logMissionStepCompleted(
  missionId: MissionId,
  stepId: string,
  stepTitle: string
): Promise<void> {
  await logEvent({
    type: "mission_step_completed",
    title: `Completed step: ${stepTitle}`,
    details: { missionId, stepId, stepTitle },
    missionId,
  });
}

/**
 * Log a mission completed event.
 */
export async function logMissionCompleted(missionId: MissionId, missionName: string): Promise<void> {
  await logEvent({
    type: "mission_completed",
    title: `Completed mission: ${missionName}`,
    details: { missionId, missionName },
    missionId,
  });
}

/**
 * Log a page visit event.
 */
export async function logPageVisited(route: string, title?: string): Promise<void> {
  await logEvent({
    type: "page_visited",
    title: `Visited: ${title || route}`,
    details: { route, title },
    route,
  });
}

/**
 * Log a custom event.
 */
export async function logCustomEvent(title: string, details?: Record<string, unknown>): Promise<void> {
  await logEvent({
    type: "custom",
    title,
    details,
  });
}

/* ═══════════════════════════════════════════════════════════════
   Event Querying
   ═══════════════════════════════════════════════════════════════ */

/**
 * Get events by type.
 */
export function getEventsByType(type: OpsEventType): OpsEvent[] {
  const journal = getOpsJournal();
  return journal.events.filter((e) => e.type === type);
}

/**
 * Get events by mission ID.
 */
export function getEventsByMission(missionId: MissionId): OpsEvent[] {
  const journal = getOpsJournal();
  return journal.events.filter((e) => e.missionId === missionId);
}

/**
 * Get events by persona ID.
 */
export function getEventsByPersona(personaId: PersonaId): OpsEvent[] {
  const journal = getOpsJournal();
  return journal.events.filter((e) => e.personaId === personaId);
}

/**
 * Get events by route.
 */
export function getEventsByRoute(route: string): OpsEvent[] {
  const journal = getOpsJournal();
  return journal.events.filter((e) => e.route === route);
}

/**
 * Get recent events (last N events).
 */
export function getRecentEvents(count: number = 20): OpsEvent[] {
  const journal = getOpsJournal();
  return journal.events.slice(-count).reverse();
}

/**
 * Get events within a time range.
 */
export function getEventsInTimeRange(startTime: number, endTime: number): OpsEvent[] {
  const journal = getOpsJournal();
  return journal.events.filter((e) => e.timestamp >= startTime && e.timestamp <= endTime);
}

/* ═══════════════════════════════════════════════════════════════
   Statistics
   ═══════════════════════════════════════════════════════════════ */

/**
 * Get ops journal statistics.
 */
export function getOpsStats(): OpsStats {
  const journal = getOpsJournal();
  const events = journal.events;

  // Count events by type
  const eventsByType: Record<OpsEventType, number> = {
    persona_selected: 0,
    identity_created: 0,
    identity_loaded: 0,
    identity_rotated: 0,
    mission_started: 0,
    mission_step_completed: 0,
    mission_completed: 0,
    pack_created: 0,
    pack_imported: 0,
    witness_signed: 0,
    evidence_created: 0,
    trail_entry_created: 0,
    webrtc_connection: 0,
    guardian_packet_created: 0,
    deadman_armed: 0,
    page_visited: 0,
    search_performed: 0,
    export_triggered: 0,
    settings_changed: 0,
    custom: 0,
  };

  // Count routes
  const routeCounts: Record<string, number> = {};
  let missionsCompleted = 0;

  for (const event of events) {
    eventsByType[event.type]++;

    if (event.route) {
      routeCounts[event.route] = (routeCounts[event.route] || 0) + 1;
    }

    if (event.type === "mission_completed") {
      missionsCompleted++;
    }
  }

  // Get top routes
  const topRoutes = Object.entries(routeCounts)
    .map(([route, count]) => ({ route, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Get current persona
  const currentPersona = null; // Will be updated by calling code

  // Calculate journal age
  const journalAgeDays = Math.floor((Date.now() - journal.createdAt) / (1000 * 60 * 60 * 24));

  return {
    totalEvents: events.length,
    eventsByType,
    topRoutes,
    missionsCompleted,
    currentPersona,
    journalAgeDays,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Journal Management
   ═══════════════════════════════════════════════════════════════ */

/**
 * Clear all events from the journal.
 * Does not delete the journal itself, just clears the events array.
 */
export function clearOpsJournal(): void {
  const journal = getOpsJournal();
  journal.events = [];
  saveOpsJournal(journal);
}

/**
 * Delete the entire ops journal.
 * This cannot be undone.
 */
export function deleteOpsJournal(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(OPS_JOURNAL_STORAGE_KEY);
}

/**
 * Export the ops journal as JSON.
 */
export function exportOpsJournal(): string {
  const journal = getOpsJournal();
  return JSON.stringify(journal, null, 2);
}

/**
 * Import ops journal from JSON.
 * Returns true if import succeeded.
 */
export function importOpsJournal(json: string): boolean {
  try {
    const data = JSON.parse(json) as OpsJournal;

    // Validate structure
    if (!Array.isArray(data.events) || typeof data.lastUpdated !== "number") {
      return false;
    }

    saveOpsJournal(data);
    return true;
  } catch {
    return false;
  }
}