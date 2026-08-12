/**
 * V FOR X — Resume Session tests
 *
 * Phase 21 north-star: "Reopen last country + persona + mission step after reload."
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  recordVisit,
  loadResume,
  clearResume,
  resumeLabel,
  resumeAgo,
  entryFromRoute,
  type ResumeEntry,
} from "../lib/resume-session";

describe("resume-session", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty state when nothing recorded", () => {
    const state = loadResume();
    expect(state.current).toBeNull();
    expect(state.previous).toBeNull();
  });

  it("records a basic visit as current", () => {
    const state = recordVisit({ route: "/sorrow-map/sdn" });
    expect(state.current?.route).toBe("/sorrow-map/sdn");
    expect(state.current?.iso3).toBe("SDN");
    expect(state.previous).toBeNull();
  });

  it("persists across reads", () => {
    recordVisit({ route: "/the-briefing" });
    const state = loadResume();
    expect(state.current?.route).toBe("/the-briefing");
  });

  it("demotes prior current to previous on next visit", () => {
    recordVisit({ route: "/sorrow-map/sdn", iso3: "sdn" });
    const second = recordVisit({ route: "/registry/REG-001", dossierId: "REG-001" });
    expect(second.current?.route).toBe("/registry/REG-001");
    expect(second.previous?.route).toBe("/sorrow-map/sdn");
  });

  it("de-dupes consecutive identical routes (refresh)", () => {
    recordVisit({ route: "/sorrow-map/sdn", iso3: "sdn" });
    const before = loadResume();
    const ts0 = before.current!.ts;
    // tiny delay to ensure a different ts would have been recorded
    const state = recordVisit({ route: "/sorrow-map/sdn", iso3: "sdn" });
    expect(state.current?.route).toBe("/sorrow-map/sdn");
    expect(state.previous).toBeNull(); // not demoted
    expect(state.current!.ts).toBeGreaterThanOrEqual(ts0);
  });

  it("updates persona in place on the same route", () => {
    recordVisit({ route: "/the-briefing", persona: "journalist" });
    const state = recordVisit({ route: "/the-briefing", persona: "aid" });
    expect(state.current?.persona).toBe("aid");
    expect(state.previous).toBeNull();
  });

  it("normalizes iso3 to uppercase", () => {
    const state = recordVisit({ route: "/sorrow-map/col", iso3: "col" });
    expect(state.current?.iso3).toBe("COL");
  });

  it("preserves mission step context", () => {
    const state = recordVisit({
      route: "/the-missions",
      missionId: "first-witness",
      missionStep: 3,
    });
    expect(state.current?.missionId).toBe("first-witness");
    expect(state.current?.missionStep).toBe(3);
  });

  it("stores optional label for the resume strip", () => {
    const state = recordVisit({
      route: "/registry/REG-001",
      dossierId: "REG-001",
      label: "Omar al-Bashir",
    });
    expect(state.current?.label).toBe("Omar al-Bashir");
  });

  it("clears on explicit reset", () => {
    recordVisit({ route: "/the-briefing" });
    clearResume();
    const state = loadResume();
    expect(state.current).toBeNull();
  });

  it("resumeLabel falls back through label → dossier → iso3 → route", () => {
    expect(resumeLabel(null)).toBe("");
    expect(resumeLabel({ ts: 0, route: "/x" })).toBe("/x");
    expect(resumeLabel({ ts: 0, route: "/x", iso3: "sdn" })).toBe("SDN");
    expect(resumeLabel({ ts: 0, route: "/x", dossierId: "REG-9" })).toBe("Dossier REG-9");
    expect(resumeLabel({ ts: 0, route: "/x", label: "Custom" })).toBe("Custom");
  });

  it("resumeAgo formats relative time defensively", () => {
    const now = 1_000_000_000_000;
    expect(resumeAgo(null, now)).toBe("");
    expect(resumeAgo({ ts: now, route: "/x" }, now)).toBe("just now");
    expect(resumeAgo({ ts: now - 5 * 60_000, route: "/x" }, now)).toBe("5m ago");
    expect(resumeAgo({ ts: now - 3 * 3_600_000, route: "/x" }, now)).toBe("3h ago");
    expect(resumeAgo({ ts: now - 4 * 86_400_000, route: "/x" }, now)).toBe("4d ago");
    // negative delta clamps
    expect(resumeAgo({ ts: now + 60_000, route: "/x" }, now)).toBe("just now");
  });

  describe("entryFromRoute", () => {
    it("classifies /sorrow-map/<iso3>", () => {
      const e = entryFromRoute("/sorrow-map/Sudan");
      // Sudan is not a valid ISO3; classifier only matches 3-letter codes
      expect(e.iso3).toBeUndefined();
    });

    it("classifies /sorrow-map/sdn (lowercase)", () => {
      const e = entryFromRoute("/sorrow-map/sdn");
      expect(e.iso3).toBe("SDN");
    });

    it("classifies /registry/<id>", () => {
      const e = entryFromRoute("/registry/reg-bashir-001");
      expect(e.dossierId).toBe("reg-bashir-001");
    });

    it("attaches mission id/step when supplied", () => {
      const e = entryFromRoute("/the-missions", { missionId: "first-witness", missionStep: 2 });
      expect(e.missionId).toBe("first-witness");
      expect(e.missionStep).toBe(2);
    });

    it("ignores mission step when route is not /the-missions", () => {
      const e = entryFromRoute("/the-briefing", { missionId: "first-witness", missionStep: 2 });
      expect(e.missionId).toBeUndefined();
      expect(e.missionStep).toBeUndefined();
    });

    it("passes through persona + label opts", () => {
      const e = entryFromRoute("/x", { persona: "journalist", label: "Briefing" });
      expect(e.persona).toBe("journalist");
      expect(e.label).toBe("Briefing");
    });
  });

  it("end-to-end: country → dossier → back generates a clean history", () => {
    recordVisit({ route: "/sorrow-map/sdn", iso3: "sdn", label: "Sudan" });
    recordVisit({ route: "/registry/REG-001", dossierId: "REG-001", label: "Bashir dossier" });
    recordVisit({ route: "/sorrow-map/sdn", iso3: "sdn", label: "Sudan" });

    const state = loadResume();
    expect(state.current?.iso3).toBe("SDN");
    expect(state.previous?.route).toBe("/registry/REG-001");
    expect(state.previous?.dossierId).toBe("REG-001");
  });

  it("end-to-end: full ResumeEntry round-trips", () => {
    const entry: ResumeEntry = {
      ts: 1_700_000_000_000,
      route: "/the-missions",
      missionId: "first-witness",
      missionStep: 4,
      persona: "journalist",
      label: "First Witness",
    };
    const state = recordVisit(entry);
    expect(state.current).toMatchObject({
      missionId: "first-witness",
      missionStep: 4,
      persona: "journalist",
    });
    const reloaded = loadResume();
    expect(reloaded.current?.missionId).toBe("first-witness");
  });
});
