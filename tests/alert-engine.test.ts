import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  processAlerts,
  formatAlertSummary,
  notificationsEnabled,
  type AlertCheckResult,
} from "../lib/alert-engine";
import type { WatchResult } from "../lib/watch";

// Polyfill localStorage for Node test environment
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};
vi.stubGlobal("localStorage", localStorageMock);

function makeResult(
  ruleId: string,
  triggered: boolean,
  matchedCount = 0,
): WatchResult {
  return {
    rule: {
      id: ruleId,
      name: `Rule ${ruleId}`,
      metric: "risk_score" as any,
      metricLabel: "Crisis Risk Score",
      operator: ">=",
      threshold: 70,
      scope: "all",
      createdAt: Date.now(),
      active: true,
    },
    triggered,
    matchedCountries: Array.from({ length: matchedCount }, (_, i) => ({
      iso3: `C${i}`,
      name: `Country ${i}`,
      value: 75,
    })),
    message: triggered ? "triggered" : "not triggered",
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("processAlerts", () => {
  it("marks all triggered rules as new on first run", () => {
    const results = [makeResult("r1", true, 3), makeResult("r2", false)];
    const check = processAlerts(results);
    expect(check.totalActive).toBe(1);
    expect(check.newCount).toBe(1);
    expect(check.triggers[0].isNew).toBe(true);
  });

  it("does not mark rules as new on subsequent runs if still triggered", () => {
    const results = [makeResult("r1", true, 3)];
    processAlerts(results);
    const check2 = processAlerts(results);
    expect(check2.newCount).toBe(0);
    expect(check2.triggers[0].isNew).toBe(false);
  });

  it("detects newly triggered rules", () => {
    const results1 = [makeResult("r1", false)];
    processAlerts(results1);
    const results2 = [makeResult("r1", true, 2)];
    const check = processAlerts(results2);
    expect(check.newCount).toBe(1);
    expect(check.triggers[0].isNew).toBe(true);
  });

  it("handles empty results", () => {
    const check = processAlerts([]);
    expect(check.triggers).toHaveLength(0);
    expect(check.newCount).toBe(0);
  });

  it("stores state between calls", () => {
    const results = [makeResult("r1", true, 1)];
    processAlerts(results);
    const raw = localStorage.getItem("vfx_alert_state");
    expect(raw).toBeTruthy();
    const state = JSON.parse(raw!);
    expect(state.r1.triggered).toBe(true);
  });
});

describe("formatAlertSummary", () => {
  it("returns no active alerts message for empty results", () => {
    const check: AlertCheckResult = {
      triggers: [],
      newCount: 0,
      totalActive: 0,
    };
    expect(formatAlertSummary(check)).toBe("No active alerts");
  });

  it("includes active count", () => {
    const check: AlertCheckResult = {
      triggers: [{ ruleId: "r1", ruleName: "R1", metric: "risk_score", message: "msg", countries: [], triggeredAt: 0, isNew: false }],
      newCount: 0,
      totalActive: 1,
    };
    expect(formatAlertSummary(check)).toBe("1 active");
  });

  it("includes new count when > 0", () => {
    const check: AlertCheckResult = {
      triggers: [{ ruleId: "r1", ruleName: "R1", metric: "risk_score", message: "msg", countries: [], triggeredAt: 0, isNew: true }],
      newCount: 1,
      totalActive: 1,
    };
    expect(formatAlertSummary(check)).toContain("1 NEW");
  });
});

describe("notificationsEnabled", () => {
  it("returns false when Notification is undefined", () => {
    expect(notificationsEnabled()).toBe(false);
  });
});
