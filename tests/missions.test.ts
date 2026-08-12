/**
 * V FOR X — Missions Tests
 *
 * Tests for guided missions and VFXMSN1 progress tokens.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MISSIONS,
  getMissionsState,
  saveMissionsState,
  getMissionProgress,
  completeMissionStep,
  resetMissionProgress,
  resetAllMissionsProgress,
  isStepCompleted,
  isMissionCompleted,
  getNextStep,
  getMissionCompletion,
  encodeMissionProgress,
  decodeMissionProgress,
  importMissionProgress,
  exportAllMissionProgress,
  importMultipleMissionProgress,
  getAllMissions,
  getMission,
  getMissionsForPersona,
  getCompletedMissions,
  getInProgressMissions,
  getNotStartedMissions,
  getTotalCompletion,
  getMissionStats,
  type MissionId,
} from "../lib/missions";

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

describe("missions.ts — Mission Definitions", () => {
  it("should have 6 missions defined", () => {
    const missions = getAllMissions();
    expect(missions).toHaveLength(6);
  });

  it("should have required mission IDs", () => {
    const missionIds = getAllMissions().map((m) => m.id);
    expect(missionIds).toContain("establish_identity");
    expect(missionIds).toContain("verify_claims");
    expect(missionIds).toContain("secure_communications");
    expect(missionIds).toContain("evidence_collection");
    expect(missionIds).toContain("mutual_aid_coordination");
    expect(missionIds).toContain("dead_mans_switch");
  });

  it("should have valid mission structures", () => {
    for (const mission of getAllMissions()) {
      expect(mission.id).toBeTruthy();
      expect(mission.name).toBeTruthy();
      expect(mission.description).toBeTruthy();
      expect(mission.icon).toBeTruthy();
      expect(mission.recommendedFor).toBeInstanceOf(Array);
      expect(mission.steps).toBeInstanceOf(Array);
      expect(mission.estimatedTime).toBeGreaterThan(0);
      expect(mission.difficulty).toMatch(/^(beginner|intermediate|advanced)$/);
      expect(mission.capabilities).toBeInstanceOf(Array);
    }
  });

  it("should have valid step structures", () => {
    for (const mission of getAllMissions()) {
      for (const step of mission.steps) {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.description).toBeTruthy();
        expect(typeof step.requiresAction).toBe("boolean");
        expect(step.estimatedTime).toBeGreaterThan(0);
      }
    }
  });
});

describe("missions.ts — Progress Tracking", () => {
  beforeEach(() => {
    localStorage.clear();
    resetAllMissionsProgress();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should initialize missions state", () => {
    const state = getMissionsState();
    expect(state.missions).toBeDefined();
    expect(state.lastUpdated).toBeGreaterThan(0);
    expect(Object.keys(state.missions)).toHaveLength(6);
  });

  it("should get mission progress", () => {
    const progress = getMissionProgress("establish_identity");
    expect(progress).toBeDefined();
    expect(progress?.missionId).toBe("establish_identity");
    expect(progress?.completedSteps).toEqual([]);
    expect(progress?.startedAt).toBeGreaterThan(0);
    expect(progress?.completedAt).toBeNull();
  });

  it("should complete a mission step", async () => {
    await completeMissionStep("establish_identity", "choose_persona");

    const progress = getMissionProgress("establish_identity");
    expect(progress?.completedSteps).toContain("choose_persona");
    expect(progress?.lastCompletedAt).toBeGreaterThan(0);
  });

  it("should not duplicate completed steps", async () => {
    await completeMissionStep("establish_identity", "choose_persona");
    await completeMissionStep("establish_identity", "choose_persona");

    const progress = getMissionProgress("establish_identity");
    expect(progress?.completedSteps.filter((s) => s === "choose_persona")).toHaveLength(1);
  });

  it("should mark mission as complete when all steps done", async () => {
    const mission = MISSIONS["establish_identity"];
    for (const step of mission.steps) {
      await completeMissionStep("establish_identity", step.id);
    }

    const progress = getMissionProgress("establish_identity");
    expect(progress?.completedAt).toBeGreaterThan(0);
    expect(isMissionCompleted("establish_identity")).toBe(true);
  });

  it("should check if step is completed", async () => {
    expect(isStepCompleted("establish_identity", "choose_persona")).toBe(false);

    await completeMissionStep("establish_identity", "choose_persona");
    expect(isStepCompleted("establish_identity", "choose_persona")).toBe(true);
  });

  it("should reset mission progress", async () => {
    await completeMissionStep("establish_identity", "choose_persona");
    expect(isStepCompleted("establish_identity", "choose_persona")).toBe(true);

    resetMissionProgress("establish_identity");
    expect(isStepCompleted("establish_identity", "choose_persona")).toBe(false);
  });

  it("should reset all missions progress", async () => {
    await completeMissionStep("establish_identity", "choose_persona");
    await completeMissionStep("verify_claims", "understand_verification");

    resetAllMissionsProgress();

    expect(isStepCompleted("establish_identity", "choose_persona")).toBe(false);
    expect(isStepCompleted("verify_claims", "understand_verification")).toBe(false);
  });

  it("should get next incomplete step", async () => {
    const next = getNextStep("establish_identity");
    expect(next).toBeTruthy();
    expect(next?.id).toBe("choose_persona");

    await completeMissionStep("establish_identity", "choose_persona");
    const next2 = getNextStep("establish_identity");
    expect(next2?.id).not.toBe("choose_persona");
  });

  it("should return null for next step when mission complete", async () => {
    const mission = MISSIONS["establish_identity"];
    for (const step of mission.steps) {
      await completeMissionStep("establish_identity", step.id);
    }

    const next = getNextStep("establish_identity");
    expect(next).toBeNull();
  });

  it("should get mission completion percentage", async () => {
    expect(getMissionCompletion("establish_identity")).toBe(0);

    const mission = MISSIONS["establish_identity"];
    const stepsToComplete = Math.ceil(mission.steps.length / 2);
    for (let i = 0; i < stepsToComplete; i++) {
      await completeMissionStep("establish_identity", mission.steps[i].id);
    }

    const completion = getMissionCompletion("establish_identity");
    expect(completion).toBeGreaterThan(0);
    expect(completion).toBeLessThanOrEqual(100);
  });
});

describe("missions.ts — VFXMSN1 Token Format", () => {
  beforeEach(() => {
    localStorage.clear();
    resetAllMissionsProgress();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should encode mission progress as VFXMSN1 token", async () => {
    await completeMissionStep("establish_identity", "choose_persona");
    const token = encodeMissionProgress("establish_identity");

    expect(token).toBeTruthy();
    expect(token?.startsWith("VFXMSN1:")).toBe(true);
  });

  it("should decode valid VFXMSN1 token", async () => {
    await completeMissionStep("establish_identity", "choose_persona");
    const token = encodeMissionProgress("establish_identity");

    expect(token).toBeTruthy();

    const decoded = decodeMissionProgress(token!);
    expect(decoded).toBeTruthy();
    expect(decoded?.m).toBe("establish_identity");
    expect(decoded?.s).toContain("choose_persona");
    expect(decoded?.v).toBe(1);
  });

  it("should return null for invalid token", () => {
    expect(decodeMissionProgress("")).toBeNull();
    expect(decodeMissionProgress("invalid")).toBeNull();
    expect(decodeMissionProgress("VFXWIT1:abc")).toBeNull();
  });

  it("should import mission progress from token", async () => {
    await completeMissionStep("establish_identity", "choose_persona");
    const token = encodeMissionProgress("establish_identity");

    expect(token).toBeTruthy();

    // Reset progress
    resetMissionProgress("establish_identity");
    expect(isStepCompleted("establish_identity", "choose_persona")).toBe(false);

    // Import from token
    const imported = importMissionProgress(token!);
    expect(imported).toBe(true);
    expect(isStepCompleted("establish_identity", "choose_persona")).toBe(true);
  });

  it("should export all mission progress", async () => {
    await completeMissionStep("establish_identity", "choose_persona");
    await completeMissionStep("verify_claims", "understand_verification");

    const tokens = exportAllMissionProgress();

    expect(tokens.length).toBeGreaterThanOrEqual(2);
    expect(tokens.some(t => t.startsWith("VFXMSN1:"))).toBe(true);

    // Verify the exported tokens can be decoded
    const decoded = tokens.map(t => decodeMissionProgress(t));
    expect(decoded.every(d => d !== null)).toBe(true);
  });

  it("should import multiple mission progress tokens", () => {
    const token1 = encodeMissionProgress("establish_identity");
    const token2 = encodeMissionProgress("verify_claims");

    expect(token1).toBeTruthy();
    expect(token2).toBeTruthy();

    // Reset progress
    resetAllMissionsProgress();

    // Import both tokens
    const imported = importMultipleMissionProgress([token1!, token2!]);
    expect(imported).toBe(2);
  });

  it("should handle partially valid token imports", () => {
    const token1 = encodeMissionProgress("establish_identity");
    const invalidToken = "VFXWIT1:invalid";

    expect(token1).toBeTruthy();

    // Reset progress
    resetAllMissionsProgress();

    // Import mixed tokens
    const imported = importMultipleMissionProgress([token1!, invalidToken]);
    expect(imported).toBe(1);
  });
});

describe("missions.ts — Mission Queries", () => {
  beforeEach(() => {
    localStorage.clear();
    resetAllMissionsProgress();
  });

  it("should get all missions", () => {
    const missions = getAllMissions();
    expect(missions).toHaveLength(6);
  });

  it("should get mission by ID", () => {
    const mission = getMission("establish_identity");
    expect(mission).toBeTruthy();
    expect(mission?.id).toBe("establish_identity");
  });

  it("should return null for invalid mission ID", () => {
    const mission = getMission("invalid" as MissionId);
    expect(mission).toBeNull();
  });

  it("should get missions for persona", () => {
    const journalistMissions = getMissionsForPersona("journalist");
    expect(journalistMissions.length).toBeGreaterThan(0);
    expect(journalistMissions.length).toBeLessThanOrEqual(6);
  });

  it("should get completed missions", async () => {
    expect(getCompletedMissions()).toHaveLength(0);

    const mission = MISSIONS["establish_identity"];
    for (const step of mission.steps) {
      await completeMissionStep("establish_identity", step.id);
    }

    expect(getCompletedMissions()).toHaveLength(1);
  });

  it("should get in-progress missions", async () => {
    expect(getInProgressMissions()).toHaveLength(0);

    await completeMissionStep("establish_identity", "choose_persona");

    const inProgress = getInProgressMissions();
    expect(inProgress).toHaveLength(1);
    expect(inProgress[0].id).toBe("establish_identity");
  });

  it("should get not-started missions", async () => {
    const notStarted = getNotStartedMissions();
    expect(notStarted).toHaveLength(6);

    await completeMissionStep("establish_identity", "choose_persona");

    const notStarted2 = getNotStartedMissions();
    expect(notStarted2).toHaveLength(5);
  });

  it("should get total completion percentage", async () => {
    expect(getTotalCompletion()).toBe(0);

    const mission = MISSIONS["establish_identity"];
    for (const step of mission.steps) {
      await completeMissionStep("establish_identity", step.id);
    }

    const total = getTotalCompletion();
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(100);
  });
});

describe("missions.ts — Mission Statistics", () => {
  beforeEach(() => {
    localStorage.clear();
    resetAllMissionsProgress();
  });

  it("should get mission stats", () => {
    const stats = getMissionStats();

    expect(stats.totalMissions).toBe(6);
    expect(stats.completedMissions).toBe(0);
    expect(stats.inProgressMissions).toBe(0);
    expect(stats.notStartedMissions).toBe(6);
    expect(stats.totalSteps).toBeGreaterThan(0);
    expect(stats.completedSteps).toBe(0);
    expect(stats.overallCompletion).toBe(0);
  });

  it("should update stats after completing missions", async () => {
    const mission = MISSIONS["establish_identity"];
    for (const step of mission.steps) {
      await completeMissionStep("establish_identity", step.id);
    }

    const stats = getMissionStats();

    expect(stats.completedMissions).toBe(1);
    expect(stats.notStartedMissions).toBe(5);
    expect(stats.completedSteps).toBe(mission.steps.length);
    expect(stats.overallCompletion).toBeGreaterThan(0);
  });

  it("should track in-progress missions correctly", async () => {
    await completeMissionStep("establish_identity", "choose_persona");
    await completeMissionStep("verify_claims", "understand_verification");

    const stats = getMissionStats();

    expect(stats.inProgressMissions).toBe(2);
    expect(stats.notStartedMissions).toBe(4);
  });
});

describe("missions.ts — Persona Filtering", () => {
  it("should recommend all missions for journalist", () => {
    const journalistMissions = getMissionsForPersona("journalist");
    expect(journalistMissions.length).toBeGreaterThan(0);
    expect(journalistMissions.length).toBeLessThanOrEqual(6);
  });

  it("should recommend relevant missions for civilian", () => {
    const civilianMissions = getMissionsForPersona("civilian");
    expect(civilianMissions.length).toBeGreaterThan(0);
    expect(civilianMissions).toHaveLength(
      civilianMissions.filter(m => m.recommendedFor.includes("civilian")).length
    );
  });

  it("should recommend secure_communications for activist", () => {
    const activistMissions = getMissionsForPersona("activist");
    const missionIds = activistMissions.map(m => m.id);
    expect(missionIds).toContain("secure_communications");
  });

  it("should recommend verify_claims for journalist", () => {
    const journalistMissions = getMissionsForPersona("journalist");
    const missionIds = journalistMissions.map(m => m.id);
    expect(missionIds).toContain("verify_claims");
  });

  it("should recommend mutual_aid_coordination for aid_worker", () => {
    const aidWorkerMissions = getMissionsForPersona("aid_worker");
    const missionIds = aidWorkerMissions.map(m => m.id);
    expect(missionIds).toContain("mutual_aid_coordination");
  });
});

describe("missions.ts — Token Persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should persist state to localStorage", async () => {
    await completeMissionStep("establish_identity", "choose_persona");

    const stored = localStorage.getItem("vfx_missions_progress");
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);
    expect(parsed.missions).toBeDefined();
    expect(parsed.missions.establish_identity.completedSteps).toContain("choose_persona");
  });

  it("should restore state from localStorage", () => {
    // Set up state manually
    const state = {
      missions: {
        establish_identity: {
          missionId: "establish_identity",
          completedSteps: ["choose_persona", "create_identity"],
          startedAt: Date.now(),
          completedAt: null,
          lastCompletedAt: Date.now(),
        },
      },
      lastUpdated: Date.now(),
    };

    localStorage.setItem("vfx_missions_progress", JSON.stringify(state));

    // Clear the in-memory cache (simulating page reload)
    const restoredState = getMissionsState();
    expect(restoredState.missions.establish_identity?.completedSteps).toHaveLength(2);
    expect(isStepCompleted("establish_identity", "choose_persona")).toBe(true);
  });
});

describe("missions.ts — Edge Cases", () => {
  beforeEach(() => {
    localStorage.clear();
    resetAllMissionsProgress();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should handle completing same step twice", async () => {
    await completeMissionStep("establish_identity", "choose_persona");
    await completeMissionStep("establish_identity", "choose_persona");

    const progress = getMissionProgress("establish_identity");
    expect(progress?.completedSteps.filter(s => s === "choose_persona")).toHaveLength(1);
  });

  it("should handle completing steps out of order", async () => {
    await completeMissionStep("establish_identity", "export_identity");
    await completeMissionStep("establish_identity", "choose_persona");

    const progress = getMissionProgress("establish_identity");
    expect(progress?.completedSteps).toContain("choose_persona");
    expect(progress?.completedSteps).toContain("export_identity");
  });

  it("should handle getting progress for non-existent mission", () => {
    const progress = getMissionProgress("nonexistent" as MissionId);
    expect(progress).toBeNull();
  });

  it("should handle invalid token format during import", () => {
    const result = importMissionProgress("not-a-token");
    expect(result).toBe(false);
  });

  it("should handle empty token during decode", () => {
    const decoded = decodeMissionProgress("");
    expect(decoded).toBeNull();
  });

  it("should handle token with wrong prefix", () => {
    const decoded = decodeMissionProgress("VFXWIT1:something");
    expect(decoded).toBeNull();
  });
});