/**
 * V FOR X — Situation Playbooks
 *
 * Provides 7 situation playbooks for crisis response scenarios. Playbooks are
 * pre-configured checklists and procedures for common emergency situations,
 * with progress tracking and resource links to relevant platform tools.
 *
 * The 7 playbooks:
 *   1. ARREST_RESPONSE: Arrest and detention response procedures
 *   2. INTERNET_SHUTDOWN: Operating during communications blackout
 *   3. FORCED_DISPLACEMENT: Emergency evacuation and displacement
 *   4. MEDICAL_CRISIS: Healthcare access during medical system collapse
 *   5. SURVEILLANCE_DETECTION: Detecting and evading surveillance
 *   6. VIOLENT_CRACKDOWN: Response to state violence and protest suppression
 *   7. DOCUMENT_EMERGENCY: Urgent document protection and evidence preservation
 *
 * Storage: localStorage key "vfx_playbooks_progress"
 */

import { type PersonaId } from "./personas";
import playbookData from "@/data/playbooks.json";

/* ═══════════════════════════════════════════════════════════════
   Playbook Types & Definitions
   ═══════════════════════════════════════════════════════════════ */

export type PlaybookId =
  | "arrest_response"
  | "internet_shutdown"
  | "forced_displacement"
  | "medical_crisis"
  | "surveillance_detection"
  | "violent_crackdown"
  | "document_emergency";

export type PlaybookCategory = "legal" | "infrastructure" | "humanitarian" | "health" | "security" | "evidence";
export type PlaybookSeverity = "critical" | "high" | "medium" | "low";

export interface ChecklistItem {
  /** Checklist item text */
  item: string;
}

export interface Checklist {
  /** Unique checklist identifier */
  id: string;
  /** Checklist title */
  title: string;
  /** Checklist items */
  items: string[];
}

export interface PlaybookResource {
  /** Resource type: tool, contact, guide */
  type: "tool" | "contact" | "guide";
  /** Resource name */
  name: string;
  /** Route href (if tool) */
  route?: string;
  /** URL (if external resource) */
  url?: string;
  /** Description (optional) */
  description?: string;
}

export interface Playbook {
  /** Unique playbook identifier */
  id: PlaybookId;
  /** Playbook name (English base, localized via i18n) */
  name: string;
  /** Short description */
  description: string;
  /** Icon/emoji for the playbook */
  icon: string;
  /** Category of crisis situation */
  category: PlaybookCategory;
  /** Severity level */
  severity: PlaybookSeverity;
  /** Estimated time to complete in seconds */
  estimatedTime: number;
  /** Which personas this playbook is recommended for */
  recommendedFor: PersonaId[];
  /** Checklist groups */
  checklists: Checklist[];
  /** Related tools and resources */
  resources: PlaybookResource[];
}

export interface PlaybookData {
  /** Data version */
  version: number;
  /** Last updated date */
  lastUpdated: string;
  /** Playbooks array */
  playbooks: Playbook[];
}

/* ═══════════════════════════════════════════════════════════════
   Playbook Registry
   ═══════════════════════════════════════════════════════════════ */

// Load playbooks from JSON data
const PLAYBOOKS_DATA: PlaybookData = playbookData as PlaybookData;

// Create a lookup map for easy access
const PLAYBOOKS_MAP: Record<PlaybookId, Playbook> = PLAYBOOKS_DATA.playbooks.reduce(
  (acc, playbook) => ({
    ...acc,
    [playbook.id as PlaybookId]: playbook,
  }),
  {} as Record<PlaybookId, Playbook>
);

export const PLAYBOOKS: Record<PlaybookId, Playbook> = PLAYBOOKS_MAP;

/* ═══════════════════════════════════════════════════════════════
   Playbook Progress Tracking
   ═══════════════════════════════════════════════════════════════ */

const PLAYBOOKS_STORAGE_KEY = "vfx_playbooks_progress";

export interface ChecklistProgress {
  /** Checklist ID */
  checklistId: string;
  /** Completed item indices */
  completedItems: number[];
}

export interface PlaybookProgress {
  /** Playbook ID */
  playbookId: PlaybookId;
  /** Progress for each checklist */
  checklists: ChecklistProgress[];
  /** When playbook was started */
  startedAt: number;
  /** When playbook was completed (null if not completed) */
  completedAt: number | null;
  /** Last item completed timestamp */
  lastCompletedAt: number | null;
  /** Notes added by user */
  notes: string[];
}

export interface PlaybooksState {
  /** Progress for each playbook */
  playbooks: Partial<Record<PlaybookId, PlaybookProgress>>;
  /** When state was last updated */
  lastUpdated: number;
}

/**
 * Get the current playbooks state from localStorage.
 */
export function getPlaybooksState(): PlaybooksState {
  if (typeof window === "undefined") {
    return {
      playbooks: {},
      lastUpdated: Date.now(),
    };
  }

  try {
    const stored = localStorage.getItem(PLAYBOOKS_STORAGE_KEY);
    if (!stored) {
      return initializePlaybooksState();
    }

    const parsed = JSON.parse(stored);
    // Validate structure
    if (!parsed.playbooks || typeof parsed.playbooks !== "object") {
      return initializePlaybooksState();
    }

    return parsed as PlaybooksState;
  } catch {
    return initializePlaybooksState();
  }
}

/**
 * Initialize a fresh playbooks state with all playbooks in progress but incomplete.
 */
function initializePlaybooksState(): PlaybooksState {
  const playbooks: Record<PlaybookId, PlaybookProgress> = {} as any;

  for (const playbookId of Object.keys(PLAYBOOKS) as PlaybookId[]) {
    const playbook = PLAYBOOKS[playbookId];
    const checklistProgress: ChecklistProgress[] = playbook.checklists.map((checklist) => ({
      checklistId: checklist.id,
      completedItems: [],
    }));

    playbooks[playbookId] = {
      playbookId,
      checklists: checklistProgress,
      startedAt: Date.now(),
      completedAt: null,
      lastCompletedAt: null,
      notes: [],
    };
  }

  return {
    playbooks,
    lastUpdated: Date.now(),
  };
}

/**
 * Save the playbooks state to localStorage.
 */
export function savePlaybooksState(state: PlaybooksState): void {
  if (typeof window === "undefined") return;

  try {
    state.lastUpdated = Date.now();
    localStorage.setItem(PLAYBOOKS_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to save playbooks state:", error);
  }
}

/**
 * Get progress for a specific playbook.
 */
export function getPlaybookProgress(playbookId: PlaybookId): PlaybookProgress | null {
  const state = getPlaybooksState();
  return state.playbooks[playbookId] || null;
}

/**
 * Get progress for a specific checklist within a playbook.
 */
export function getChecklistProgress(
  playbookId: PlaybookId,
  checklistId: string
): ChecklistProgress | null {
  const progress = getPlaybookProgress(playbookId);
  if (!progress) return null;

  return progress.checklists.find((c) => c.checklistId === checklistId) || null;
}

/**
 * Mark a checklist item as completed.
 */
export function completeChecklistItem(
  playbookId: PlaybookId,
  checklistId: string,
  itemIndex: number
): void {
  const state = getPlaybooksState();
  const progress = state.playbooks[playbookId];

  if (!progress) {
    // Playbook doesn't exist, initialize it
    const playbook = PLAYBOOKS[playbookId];
    const checklistProgress: ChecklistProgress[] = playbook.checklists.map((checklist) => ({
      checklistId: checklist.id,
      completedItems: [],
    }));

    state.playbooks[playbookId] = {
      playbookId,
      checklists: checklistProgress,
      startedAt: Date.now(),
      completedAt: null,
      lastCompletedAt: null,
      notes: [],
    };
  }

  const playbookProgress = state.playbooks[playbookId];
  if (!playbookProgress) return;

  const checklistProgress = playbookProgress.checklists.find((c) => c.checklistId === checklistId);

  if (!checklistProgress) return;

  // Add item to completed if not already there
  if (!checklistProgress.completedItems.includes(itemIndex)) {
    checklistProgress.completedItems.push(itemIndex);
    playbookProgress.lastCompletedAt = Date.now();
  }

  // Check if playbook is complete (all items in all checklists)
  const playbook = PLAYBOOKS[playbookId];
  const allItemsComplete = playbook.checklists.every((checklist) => {
    const cp = playbookProgress.checklists.find((c) => c.checklistId === checklist.id);
    if (!cp) return false;
    return cp.completedItems.length === checklist.items.length;
  });

  if (allItemsComplete && !playbookProgress.completedAt) {
    playbookProgress.completedAt = Date.now();
  }

  savePlaybooksState(state);
}

/**
 * Unmark a checklist item (toggle off).
 */
export function uncompleteChecklistItem(
  playbookId: PlaybookId,
  checklistId: string,
  itemIndex: number
): void {
  const state = getPlaybooksState();
  const progress = state.playbooks[playbookId];

  if (!progress) return;

  const checklistProgress = progress.checklists.find((c) => c.checklistId === checklistId);
  if (!checklistProgress) return;

  // Remove item from completed
  checklistProgress.completedItems = checklistProgress.completedItems.filter((i) => i !== itemIndex);

  // Update completion status
  const playbook = PLAYBOOKS[playbookId];
  const allItemsComplete = playbook.checklists.every((checklist) => {
    const cp = progress.checklists.find((c) => c.checklistId === checklist.id);
    if (!cp) return false;
    return cp.completedItems.length === checklist.items.length;
  });

  if (!allItemsComplete) {
    progress.completedAt = null;
  }

  savePlaybooksState(state);
}

/**
 * Reset progress for a specific playbook.
 */
export function resetPlaybookProgress(playbookId: PlaybookId): void {
  const state = getPlaybooksState();
  const playbook = PLAYBOOKS[playbookId];

  if (playbook && state.playbooks[playbookId]) {
    const checklistProgress: ChecklistProgress[] = playbook.checklists.map((checklist) => ({
      checklistId: checklist.id,
      completedItems: [],
    }));

    state.playbooks[playbookId] = {
      playbookId,
      checklists: checklistProgress,
      startedAt: Date.now(),
      completedAt: null,
      lastCompletedAt: null,
      notes: [],
    };
    savePlaybooksState(state);
  }
}

/**
 * Reset all playbook progress.
 */
export function resetAllPlaybooksProgress(): void {
  const state = initializePlaybooksState();
  savePlaybooksState(state);
}

/**
 * Check if a checklist item is completed.
 */
export function isChecklistItemCompleted(
  playbookId: PlaybookId,
  checklistId: string,
  itemIndex: number
): boolean {
  const progress = getChecklistProgress(playbookId, checklistId);
  return progress ? progress.completedItems.includes(itemIndex) : false;
}

/**
 * Check if a checklist is fully completed.
 */
export function isChecklistCompleted(playbookId: PlaybookId, checklistId: string): boolean {
  const progress = getChecklistProgress(playbookId, checklistId);
  const playbook = PLAYBOOKS[playbookId];
  if (!progress || !playbook) return false;

  const checklist = playbook.checklists.find((c) => c.id === checklistId);
  if (!checklist) return false;

  return progress.completedItems.length === checklist.items.length;
}

/**
 * Check if a playbook is completed.
 */
export function isPlaybookCompleted(playbookId: PlaybookId): boolean {
  const progress = getPlaybookProgress(playbookId);
  if (!progress) return false;

  const playbook = PLAYBOOKS[playbookId];
  return playbook.checklists.every((checklist) => {
    const cp = progress.checklists.find((c) => c.checklistId === checklist.id);
    if (!cp) return false;
    return cp.completedItems.length === checklist.items.length;
  });
}

/**
 * Get completion percentage for a playbook.
 */
export function getPlaybookCompletion(playbookId: PlaybookId): number {
  const progress = getPlaybookProgress(playbookId);
  const playbook = PLAYBOOKS[playbookId];

  if (!progress || !playbook) return 0;

  let totalItems = 0;
  let completedItems = 0;

  for (const checklist of playbook.checklists) {
    const cp = progress.checklists.find((c) => c.checklistId === checklist.id);
    totalItems += checklist.items.length;
    completedItems += cp ? cp.completedItems.length : 0;
  }

  return totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
}

/**
 * Get completion percentage for a specific checklist.
 */
export function getChecklistCompletion(playbookId: PlaybookId, checklistId: string): number {
  const progress = getChecklistProgress(playbookId, checklistId);
  const playbook = PLAYBOOKS[playbookId];

  if (!progress || !playbook) return 0;

  const checklist = playbook.checklists.find((c) => c.id === checklistId);
  if (!checklist) return 0;

  const total = checklist.items.length;
  const completed = progress.completedItems.length;

  return total > 0 ? (completed / total) * 100 : 0;
}

/* ═══════════════════════════════════════════════════════════════
   Playbook Notes
   ═══════════════════════════════════════════════════════════════ */

/**
 * Add a note to a playbook.
 */
export function addPlaybookNote(playbookId: PlaybookId, note: string): void {
  const state = getPlaybooksState();
  const progress = state.playbooks[playbookId];

  if (!progress) return;

  progress.notes.push(note);
  savePlaybooksState(state);
}

/**
 * Remove a note from a playbook by index.
 */
export function removePlaybookNote(playbookId: PlaybookId, noteIndex: number): void {
  const state = getPlaybooksState();
  const progress = state.playbooks[playbookId];

  if (!progress || noteIndex < 0 || noteIndex >= progress.notes.length) return;

  progress.notes.splice(noteIndex, 1);
  savePlaybooksState(state);
}

/**
 * Get notes for a playbook.
 */
export function getPlaybookNotes(playbookId: PlaybookId): string[] {
  const progress = getPlaybookProgress(playbookId);
  return progress ? progress.notes : [];
}

/* ═══════════════════════════════════════════════════════════════
   Playbook Utilities
   ═══════════════════════════════════════════════════════════════ */

/**
 * Get all playbooks as an array.
 */
export function getAllPlaybooks(): Playbook[] {
  return Object.values(PLAYBOOKS);
}

/**
 * Get a playbook by ID.
 */
export function getPlaybook(playbookId: PlaybookId): Playbook | null {
  return PLAYBOOKS[playbookId] || null;
}

/**
 * Get playbooks recommended for a specific persona.
 */
export function getPlaybooksForPersona(personaId: PersonaId): Playbook[] {
  return getAllPlaybooks().filter((playbook) =>
    playbook.recommendedFor.includes(personaId)
  );
}

/**
 * Get playbooks by category.
 */
export function getPlaybooksByCategory(category: PlaybookCategory): Playbook[] {
  return getAllPlaybooks().filter((playbook) => playbook.category === category);
}

/**
 * Get playbooks by severity.
 */
export function getPlaybooksBySeverity(severity: PlaybookSeverity): Playbook[] {
  return getAllPlaybooks().filter((playbook) => playbook.severity === severity);
}

/**
 * Get completed playbooks.
 */
export function getCompletedPlaybooks(): Playbook[] {
  return getAllPlaybooks().filter((playbook) => isPlaybookCompleted(playbook.id));
}

/**
 * Get in-progress playbooks (started but not completed).
 */
export function getInProgressPlaybooks(): Playbook[] {
  return getAllPlaybooks().filter((playbook) => {
    const progress = getPlaybookProgress(playbook.id);
    return progress && !progress.completedAt && progress.checklists.some((c) => c.completedItems.length > 0);
  });
}

/**
 * Get not-started playbooks.
 */
export function getNotStartedPlaybooks(): Playbook[] {
  return getAllPlaybooks().filter((playbook) => {
    const progress = getPlaybookProgress(playbook.id);
    return !progress || progress.checklists.every((c) => c.completedItems.length === 0);
  });
}

/**
 * Get total completion percentage across all playbooks.
 */
export function getTotalCompletion(): number {
  const playbooks = getAllPlaybooks();
  let totalItems = 0;
  let totalCompleted = 0;

  for (const playbook of playbooks) {
    const progress = getPlaybookProgress(playbook.id);
    if (!progress) continue;

    for (const checklist of playbook.checklists) {
      const cp = progress.checklists.find((c) => c.checklistId === checklist.id);
      totalItems += checklist.items.length;
      totalCompleted += cp ? cp.completedItems.length : 0;
    }
  }

  return totalItems > 0 ? (totalCompleted / totalItems) * 100 : 0;
}

/**
 * Get playbook statistics.
 */
export interface PlaybookStats {
  totalPlaybooks: number;
  completedPlaybooks: number;
  inProgressPlaybooks: number;
  notStartedPlaybooks: number;
  totalItems: number;
  completedItems: number;
  overallCompletion: number;
}

export function getPlaybookStats(): PlaybookStats {
  const playbooks = getAllPlaybooks();
  const completed = getCompletedPlaybooks();
  const inProgress = getInProgressPlaybooks();
  const notStarted = getNotStartedPlaybooks();

  let totalItems = 0;
  let completedItems = 0;

  for (const playbook of playbooks) {
    const progress = getPlaybookProgress(playbook.id);
    if (!progress) continue;

    for (const checklist of playbook.checklists) {
      const cp = progress.checklists.find((c) => c.checklistId === checklist.id);
      totalItems += checklist.items.length;
      completedItems += cp ? cp.completedItems.length : 0;
    }
  }

  return {
    totalPlaybooks: playbooks.length,
    completedPlaybooks: completed.length,
    inProgressPlaybooks: inProgress.length,
    notStartedPlaybooks: notStarted.length,
    totalItems,
    completedItems,
    overallCompletion: totalItems > 0 ? (completedItems / totalItems) * 100 : 0,
  };
}

/**
 * Get a readable description of severity level.
 */
export function getSeverityDescription(severity: PlaybookSeverity): string {
  switch (severity) {
    case "critical":
      return "Critical - Immediate response required";
    case "high":
      return "High - Urgent response needed";
    case "medium":
      return "Medium - Response recommended";
    case "low":
      return "Low - Response when possible";
    default:
      return "Unknown";
  }
}

/**
 * Get category icon.
 */
export function getCategoryIcon(category: PlaybookCategory): string {
  switch (category) {
    case "legal":
      return "⚖️";
    case "infrastructure":
      return "📡";
    case "humanitarian":
      return "🤝";
    case "health":
      return "🏥";
    case "security":
      return "🛡️";
    case "evidence":
      return "📄";
    default:
      return "📋";
  }
}

/**
 * Get category display name.
 */
export function getCategoryDisplayName(category: PlaybookCategory): string {
  switch (category) {
    case "legal":
      return "Legal & Detention";
    case "infrastructure":
      return "Infrastructure";
    case "humanitarian":
      return "Humanitarian";
    case "health":
      return "Medical & Health";
    case "security":
      return "Security & Protection";
    case "evidence":
      return "Evidence & Documentation";
    default:
      return "Other";
  }
}

/**
 * Get playbooks organized by category.
 */
export function getPlaybooksByCategoryMap(): Record<PlaybookCategory, Playbook[]> {
  const map = {} as Record<PlaybookCategory, Playbook[]>;

  for (const playbook of getAllPlaybooks()) {
    if (!map[playbook.category]) {
      map[playbook.category] = [];
    }
    map[playbook.category].push(playbook);
  }

  return map;
}

/**
 * Export playbook progress as JSON for backup.
 */
export function exportPlaybookProgress(): string {
  const state = getPlaybooksState();
  return JSON.stringify(state, null, 2);
}

/**
 * Import playbook progress from JSON backup.
 */
export function importPlaybookProgress(json: string): boolean {
  try {
    const parsed = JSON.parse(json);
    if (!parsed.playbooks || typeof parsed.playbooks !== "object") {
      return false;
    }

    savePlaybooksState(parsed as PlaybooksState);
    return true;
  } catch {
    return false;
  }
}
