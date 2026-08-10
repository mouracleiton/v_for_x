/**
 * V FOR X — Alert Trigger Engine
 *
 * Bridges the Watch threshold system to browser notifications.
 * On each page load (or manual check), compares current rule results
 * against the last-seen state stored in IndexedDB. When a rule
 * transitions from not-triggered → triggered, a Notification is fired.
 *
 * Since V FOR X is fully static (no push server), this is the closest
 * equivalent to push notifications — it runs on every page open and
 * surfaces new breaches immediately.
 *
 * Integrates with:
 *   - lib/watch.ts (rule evaluation)
 *   - lib/idb.ts (last-seen state persistence)
 *   - public/sw.js (push handler, for when a server is added later)
 */

import type { WatchResult } from "./watch";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface AlertTrigger {
  ruleId: string;
  ruleName: string;
  metric: string;
  message: string;
  countries: { iso3: string; name: string; value: number }[];
  triggeredAt: number;
  /** Was this rule newly triggered since last check? */
  isNew: boolean;
}

export interface AlertCheckResult {
  triggers: AlertTrigger[];
  newCount: number;
  totalActive: number;
}

/* ═══════════════════════════════════════════════════════════════
   State persistence (localStorage, not IndexedDB, for simplicity
   and synchronous access during page load)
   ═══════════════════════════════════════════════════════════════ */

const STATE_KEY = "vfx_alert_state";

interface RuleState {
  triggered: boolean;
  lastSeen: number;
  matchedCount: number;
}

function loadState(): Record<string, RuleState> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveState(state: Record<string, RuleState>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or disabled
  }
}

/* ═══════════════════════════════════════════════════════════════
   Core engine
   ═══════════════════════════════════════════════════════════════ */

/**
 * Process watch results and identify newly-triggered rules.
 *
 * Compares the current trigger state against the stored "last seen"
 * state. Any rule that was previously not-triggered (or never seen)
 * and is now triggered is marked as `isNew`.
 *
 * After processing, the state is updated to reflect the current
 * snapshot.
 */
export function processAlerts(results: WatchResult[]): AlertCheckResult {
  const prevState = loadState();
  const triggers: AlertTrigger[] = [];
  const newState: Record<string, RuleState> = {};
  const now = Date.now();
  let newCount = 0;

  for (const result of results) {
    const ruleId = result.rule.id;
    const wasTriggered = prevState[ruleId]?.triggered ?? false;

    newState[ruleId] = {
      triggered: result.triggered,
      lastSeen: now,
      matchedCount: result.matchedCountries.length,
    };

    if (result.triggered) {
      const isNew = !wasTriggered;
      if (isNew) newCount++;

      triggers.push({
        ruleId,
        ruleName: result.rule.name,
        metric: result.rule.metric,
        message: result.message,
        countries: result.matchedCountries.slice(0, 5),
        triggeredAt: now,
        isNew,
      });
    }
  }

  saveState(newState);

  return {
    triggers,
    newCount,
    totalActive: triggers.length,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Browser Notification Integration
   ═══════════════════════════════════════════════════════════════ */

/**
 * Request notification permission from the user.
 * Must be called from a user gesture (button click).
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

/**
 * Fire browser notifications for newly-triggered rules.
 * Only fires for rules marked `isNew` to avoid notification spam.
 */
export function fireAlertNotifications(
  checkResult: AlertCheckResult,
): number {
  if (typeof Notification === "undefined") return 0;
  if (Notification.permission !== "granted") return 0;

  let fired = 0;
  for (const trigger of checkResult.triggers) {
    if (!trigger.isNew) continue;

    const topCountries = trigger.countries
      .slice(0, 3)
      .map((c) => c.name)
      .join(", ");

    const body = topCountries
      ? `${trigger.ruleName}: ${topCountries}`
      : trigger.message;

    try {
      new Notification("V FOR X — Threshold Alert", {
        body,
        tag: trigger.ruleId,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        requireInteraction: false,
      });
      fired++;
    } catch {
      // Notification creation can fail in some contexts
    }
  }

  return fired;
}

/**
 * Full alert check: process results, fire notifications, return summary.
 * Call this on page load or after rule evaluation.
 */
export function runAlertCheck(results: WatchResult[]): AlertCheckResult {
  const checkResult = processAlerts(results);
  fireAlertNotifications(checkResult);
  return checkResult;
}

/**
 * Check if notifications are supported and permitted.
 */
export function notificationsEnabled(): boolean {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

/**
 * Get a summary string for display.
 */
export function formatAlertSummary(check: AlertCheckResult): string {
  if (check.totalActive === 0) return "No active alerts";
  const parts = [`${check.totalActive} active`];
  if (check.newCount > 0) {
    parts.push(`${check.newCount} NEW`);
  }
  return parts.join(" · ");
}
