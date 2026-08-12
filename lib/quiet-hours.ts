/**
 * V FOR X — Quiet Hours (software kill-switch for all network APIs)
 *
 * A single global switch an operator can flip so the app makes ZERO
 * network requests — the most important OpSec guarantee under
 * surveillance. When Quiet Hours is on, every network call (mirror
 * feed, fetch, beacon, analytics, link prefetch) must go through an
 * `assertNetworkAllowed` gate that throws.
 *
 * Design:
 *   • `install()` wraps `window.fetch` and `XMLHttpRequest` so even
 *     third-party code can't escape the kill-switch.
 *   • `withNetwork(fn)` runs a callback with the switch temporarily
 *     lifted (explicit, audited opt-in), restoring it afterwards.
 *   • `createQuietFetch()` returns a guarded fetch usable anywhere.
 *   • State persists to localStorage so a reload respects the switch.
 *
 * No telemetry, no background polling. Off by default.
 */

/* ═══════════════════════════════════════════════════════════════
   Constants & types
   ═══════════════════════════════════════════════════════════════ */

export const QUIET_HOURS_KEY = "vfx-quiet-hours";

export class NetworkBlockError extends Error {
  constructor(message = "Network blocked by Quiet Hours") {
    super(message);
    this.name = "NetworkBlockError";
  }
}

export interface QuietHoursConfig {
  /** Whether the kill-switch is currently armed. */
  enabled: boolean;
  /** Optional scheduled window (24h, local). When set, quiet auto-toggles. */
  schedule?: {
    startHour: number; // 0..23
    endHour: number; // 0..23 (may wrap past midnight)
  };
  /** Epoch ms the config was last changed. */
  updatedAt: number;
}

/* ═══════════════════════════════════════════════════════════════
   State
   ═══════════════════════════════════════════════════════════════ */

let currentConfig: QuietHoursConfig = loadConfig();

/** Load the persisted config (defaults to disabled). */
export function loadConfig(): QuietHoursConfig {
  const fallback: QuietHoursConfig = { enabled: false, updatedAt: 0 };
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(QUIET_HOURS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<QuietHoursConfig>;
    return {
      enabled: !!parsed.enabled,
      schedule: parsed.schedule,
      updatedAt: parsed.updatedAt ?? 0,
    };
  } catch {
    return fallback;
  }
}

/** Persist the config to localStorage. */
export function saveConfig(config: QuietHoursConfig): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(QUIET_HOURS_KEY, JSON.stringify(config));
  } catch { /* ignore */ }
}

/** Get the current config. */
export function getConfig(): QuietHoursConfig {
  return currentConfig;
}

/* ═══════════════════════════════════════════════════════════════
   Core: enable / disable / toggle
   ═══════════════════════════════════════════════════════════════ */

/** Arm the kill-switch (block all network). */
export function enable(): QuietHoursConfig {
  currentConfig = { ...currentConfig, enabled: true, updatedAt: Date.now() };
  saveConfig(currentConfig);
  return currentConfig;
}

/** Disarm the kill-switch (allow network). */
export function disable(): QuietHoursConfig {
  currentConfig = { ...currentConfig, enabled: false, updatedAt: Date.now() };
  saveConfig(currentConfig);
  return currentConfig;
}

/** Toggle the switch. Returns the new config. */
export function toggle(): QuietHoursConfig {
  return currentConfig.enabled ? disable() : enable();
}

/** Set a recurring quiet schedule. */
export function setSchedule(startHour: number, endHour: number): QuietHoursConfig {
  currentConfig = {
    ...currentConfig,
    schedule: { startHour, endHour },
    updatedAt: Date.now(),
  };
  saveConfig(currentConfig);
  return currentConfig;
}

/** Clear the schedule. */
export function clearSchedule(): QuietHoursConfig {
  currentConfig = { ...currentConfig, schedule: undefined, updatedAt: Date.now() };
  saveConfig(currentConfig);
  return currentConfig;
}

/* ═══════════════════════════════════════════════════════════════
   Network gate
   ═══════════════════════════════════════════════════════════════ */

/**
 * Whether network access is currently allowed (kill-switch off AND
 * outside any scheduled quiet window).
 */
export function isNetworkAllowed(now = new Date()): boolean {
  if (currentConfig.enabled) return false;
  if (currentConfig.schedule) {
    const hour = now.getHours();
    const { startHour, endHour } = currentConfig.schedule;
    if (startHour === endHour) return true; // empty window
    if (startHour < endHour) {
      return hour < startHour || hour >= endHour;
    }
    // wraps past midnight
    return hour >= endHour && hour < startHour;
  }
  return true;
}

/**
 * Assert that network access is allowed; throws NetworkBlockError if
 * the kill-switch is armed. Call this before any network request.
 */
export function assertNetworkAllowed(now = new Date()): void {
  if (!isNetworkAllowed(now)) {
    throw new NetworkBlockError();
  }
}

/**
 * Run a callback with the kill-switch temporarily lifted. Restores
 * the previous state in a `finally`, so an exception can't leave the
 * switch open. Use for explicit, audited opt-in network operations.
 */
export async function withNetwork<T>(fn: () => Promise<T> | T): Promise<T> {
  const wasEnabled = currentConfig.enabled;
  if (wasEnabled) {
    currentConfig = { ...currentConfig, enabled: false };
  }
  try {
    return await fn();
  } finally {
    if (wasEnabled) {
      currentConfig = { ...currentConfig, enabled: true };
    }
  }
}

/**
 * Create a guarded `fetch` that respects Quiet Hours. Throws
 * NetworkBlockError when the switch is armed; otherwise delegates to
 * the real fetch.
 */
export function createQuietFetch(
  realFetch?: typeof fetch,
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  const impl = realFetch ?? (typeof fetch !== "undefined" ? fetch.bind(globalThis) : undefined);
  return async (input, init) => {
    assertNetworkAllowed();
    if (!impl) throw new Error("fetch is not available in this environment");
    return impl(input, init);
  };
}

/* ═══════════════════════════════════════════════════════════════
   Install (wrap global fetch + XHR)
   ═══════════════════════════════════════════════════════════════ */

let installed = false;
let originalFetch: typeof fetch | undefined;
let OriginalXHR: typeof XMLHttpRequest | undefined;

/**
 * Install the kill-switch globally: wrap `window.fetch` and
 * `XMLHttpRequest` so all network code (including third-party) is
 * gated. Idempotent — safe to call multiple times. `uninstall()`
 * restores the originals.
 */
export function install(): void {
  if (installed) return;
  if (typeof globalThis !== "undefined") {
    if (typeof globalThis.fetch === "function") {
      originalFetch = globalThis.fetch;
      globalThis.fetch = createQuietFetch(originalFetch) as typeof fetch;
    }
    if (typeof globalThis.XMLHttpRequest === "function") {
      OriginalXHR = globalThis.XMLHttpRequest;
      const GuardedXHR = function (this: XMLHttpRequest) {
        const xhr = new OriginalXHR!();
        const origOpen = xhr.open.bind(xhr);
        xhr.open = ((method: string, url: string, ...rest: unknown[]) => {
          assertNetworkAllowed();
          return origOpen(method, url, ...(rest as [boolean, string | null]));
        }) as XMLHttpRequest["open"];
        return xhr;
      } as unknown as typeof XMLHttpRequest;
      globalThis.XMLHttpRequest = GuardedXHR;
    }
  }
  installed = true;
}

/** Restore the original fetch / XHR (undo `install()`). */
export function uninstall(): void {
  if (!installed) return;
  if (typeof globalThis !== "undefined") {
    if (originalFetch) globalThis.fetch = originalFetch;
    if (OriginalXHR) globalThis.XMLHttpRequest = OriginalXHR;
  }
  originalFetch = undefined;
  OriginalXHR = undefined;
  installed = false;
}

/** Whether the global kill-switch is installed. */
export function isInstalled(): boolean {
  return installed;
}

/* ═══════════════════════════════════════════════════════════════
   Display
   ═══════════════════════════════════════════════════════════════ */

/** One-line status for the UI. */
export function statusLabel(now = new Date()): string {
  if (currentConfig.enabled) return "QUIET — network blocked";
  if (currentConfig.schedule && !isNetworkAllowed(now)) {
    return "QUIET (scheduled) — network blocked";
  }
  return "Network allowed";
}

/** Whether the switch is currently armed (manual or scheduled). */
export function isQuietActive(now = new Date()): boolean {
  return !isNetworkAllowed(now);
}
