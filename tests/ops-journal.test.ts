/**
 * V FOR X — Operations Journal Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getOpsJournal,
  logEvent,
  logPersonaSelected,
  logIdentityCreated,
  logMissionStarted,
  logPageVisited,
  getEventsByType,
  getEventsByMission,
  getRecentEvents,
  getOpsStats,
  clearOpsJournal,
  deleteOpsJournal,
  exportOpsJournal,
  importOpsJournal,
  type OpsEvent,
} from "../lib/ops-journal";
import type { PersonaId } from "../lib/personas";
import type { MissionId } from "../lib/missions";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string): string | null => store[key] || null,
    setItem: (key: string, value: string): void => {
      store[key] = value;
    },
    removeItem: (key: string): void => {
      delete store[key];
    },
    clear: (): void => {
      store = {};
    },
  };
})();

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
});

// Mock personas module
vi.mock("../lib/personas", () => ({
  PERSONAS: {
    journalist: { id: "journalist", name: "Journalist" },
    activist: { id: "activist", name: "Activist" },
  },
  getPersona: vi.fn(() => null),
}));

describe("ops-journal.ts — Journal Management", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should create a new journal", () => {
    const journal = getOpsJournal();
    expect(journal).toBeDefined();
    expect(journal.events).toEqual([]);
    expect(journal.createdAt).toBeGreaterThan(0);
    expect(journal.lastUpdated).toBeGreaterThan(0);
  });

  it("should persist journal to localStorage", async () => {
    await logEvent({
      type: "custom",
      title: "Test event",
    });

    const stored = localStorage.getItem("vfx_ops_journal");
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);
    expect(parsed.events).toHaveLength(1);
  });

  it("should clear journal events", async () => {
    await logEvent({
      type: "custom",
      title: "Test event",
    });

    clearOpsJournal();

    const journal = getOpsJournal();
    expect(journal.events).toEqual([]);
  });

  it("should delete journal entirely", async () => {
    await logEvent({
      type: "custom",
      title: "Test event",
    });

    deleteOpsJournal();

    const stored = localStorage.getItem("vfx_ops_journal");
    expect(stored).toBeNull();
  });
});

describe("ops-journal.ts — Event Logging", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should log a basic event", async () => {
    await logEvent({
      type: "custom",
      title: "Test event",
      details: { test: "data" },
    });

    const journal = getOpsJournal();
    expect(journal.events).toHaveLength(1);

    const event = journal.events[0];
    expect(event.type).toBe("custom");
    expect(event.title).toBe("Test event");
    expect(event.details).toEqual({ test: "data" });
    expect(event.id).toBeTruthy();
    expect(event.timestamp).toBeGreaterThan(0);
  });

  it("should generate unique IDs for events", async () => {
    await logEvent({ type: "custom", title: "Event 1" });
    await logEvent({ type: "custom", title: "Event 2" });

    const journal = getOpsJournal();
    expect(journal.events[0].id).not.toBe(journal.events[1].id);
  });

  it("should limit journal to 1000 events", async () => {
    // Add 1001 events
    for (let i = 0; i < 1001; i++) {
      await logEvent({
        type: "custom",
        title: `Event ${i}`,
      });
    }

    const journal = getOpsJournal();
    expect(journal.events.length).toBe(1000);
  });

  it("should log persona selection", async () => {
    await logPersonaSelected("journalist", "Journalist");

    const journal = getOpsJournal();
    expect(journal.events).toHaveLength(1);

    const event = journal.events[0];
    expect(event.type).toBe("persona_selected");
    expect(event.personaId).toBe("journalist");
  });

  it("should log identity creation", async () => {
    await logIdentityCreated("V-ABCD-1234");

    const journal = getOpsJournal();
    expect(journal.events).toHaveLength(1);

    const event = journal.events[0];
    expect(event.type).toBe("identity_created");
    expect(event.title).toContain("V-ABCD-1234");
  });

  it("should log mission start", async () => {
    await logMissionStarted("establish_identity", "Establish Your Identity");

    const journal = getOpsJournal();
    expect(journal.events).toHaveLength(1);

    const event = journal.events[0];
    expect(event.type).toBe("mission_started");
    expect(event.missionId).toBe("establish_identity");
  });

  it("should log page visit", async () => {
    await logPageVisited("/the-trail", "The Trail");

    const journal = getOpsJournal();
    expect(journal.events).toHaveLength(1);

    const event = journal.events[0];
    expect(event.type).toBe("page_visited");
    expect(event.route).toBe("/the-trail");
  });
});

describe("ops-journal.ts — Event Querying", () => {
  beforeEach(async () => {
    localStorage.clear();

    // Add test events
    await logEvent({ type: "custom", title: "Event 1" });
    await logEvent({ type: "page_visited", title: "Visited page", route: "/test" });
    await logEvent({ type: "custom", title: "Event 2" });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should get events by type", () => {
    const customEvents = getEventsByType("custom");
    expect(customEvents).toHaveLength(2);

    const pageEvents = getEventsByType("page_visited");
    expect(pageEvents).toHaveLength(1);
  });

  it("should get events by mission ID", async () => {
    await logMissionStarted("establish_identity", "Test Mission");

    const missionEvents = getEventsByMission("establish_identity");
    expect(missionEvents.length).toBeGreaterThan(0);
    expect(missionEvents.every((e) => e.missionId === "establish_identity")).toBe(true);
  });

  it("should get events by route", () => {
    const journal = getOpsJournal();
    const routeEvents = journal.events.filter(e => e.route === "/test");
    expect(routeEvents).toHaveLength(1);
    expect(routeEvents[0].route).toBe("/test");
  });

  it("should get recent events", () => {
    const recent = getRecentEvents(2);
    expect(recent).toHaveLength(2);
    // Should be in reverse chronological order
    expect(recent[0].title).toBe("Event 2");
    expect(recent[1].title).toBe("Visited page");
  });

  it("should return empty array when no events match", () => {
    const events = getEventsByType("identity_created");
    expect(events).toHaveLength(0);
  });
});

describe("ops-journal.ts — Statistics", () => {
  beforeEach(async () => {
    localStorage.clear();

    // Add test events
    await logEvent({ type: "custom", title: "Event 1" });
    await logEvent({ type: "custom", title: "Event 2" });
    await logEvent({ type: "page_visited", title: "Visited page", route: "/test" });
    await logEvent({ type: "page_visited", title: "Visited page", route: "/test" });
    await logEvent({ type: "mission_completed", title: "Mission done" });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should calculate statistics correctly", () => {
    const stats = getOpsStats();

    expect(stats.totalEvents).toBe(5);
    expect(stats.eventsByType.custom).toBe(2);
    expect(stats.eventsByType.page_visited).toBe(2);
    expect(stats.eventsByType.mission_completed).toBe(1);
    expect(stats.missionsCompleted).toBe(1);
    expect(stats.currentPersona).toBeNull();
  });

  it("should track top routes", () => {
    const stats = getOpsStats();

    expect(stats.topRoutes).toHaveLength(1);
    expect(stats.topRoutes[0].route).toBe("/test");
    expect(stats.topRoutes[0].count).toBe(2);
  });

  it("should calculate journal age in days", () => {
    const stats = getOpsStats();
    expect(stats.journalAgeDays).toBeGreaterThanOrEqual(0);
    expect(stats.journalAgeDays).toBeLessThan(1); // Should be very recent
  });
});

describe("ops-journal.ts — Export/Import", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should export journal as JSON", async () => {
    await logEvent({ type: "custom", title: "Test event" });

    const exported = exportOpsJournal();
    expect(exported).toBeTruthy();

    const parsed = JSON.parse(exported);
    expect(parsed.events).toHaveLength(1);
  });

  it("should import journal from JSON", () => {
    const journalData = {
      events: [
        {
          id: "test-id",
          type: "custom" as const,
          timestamp: Date.now(),
          title: "Imported event",
        },
      ],
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    };

    const json = JSON.stringify(journalData);
    const success = importOpsJournal(json);

    expect(success).toBe(true);

    const imported = getOpsJournal();
    expect(imported.events).toHaveLength(1);
    expect(imported.events[0].title).toBe("Imported event");
  });

  it("should reject invalid import data", () => {
    const success = importOpsJournal("invalid json");
    expect(success).toBe(false);

    const success2 = importOpsJournal('{"events": "not an array"}');
    expect(success2).toBe(false);
  });
});