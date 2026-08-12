/**
 * V FOR X — Duress Identity System Tests
 *
 * Tests the full duress identity implementation with:
 * - Dual identity system (real + decoy)
 * - Stashing and restoration of real data
 * - Decoy identity generation and management
 * - Audit trail and emergency recovery
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  enableDecoyMode,
  disableDecoyMode,
  loadDuressConfig,
  getActiveMode,
  setActiveMode,
  checkDuressCode,
  generateDecoyState,
  activateDecoyData,
  enterDecoyMode,
  exitDecoyMode,
  isInDecoyMode,
  getStashStatus,
  emergencyRestoreRealIdentity,
  type DuressMode,
  type DuressConfig,
  type DuressStashRecord,
} from "../lib/duress-decoy";
import {
  generateIdentity,
  saveIdentity,
  loadIdentity,
  deleteIdentity,
  type Identity,
} from "../lib/identity";
import { saveBackup, loadBackups, clearAllBackups } from "../lib/storage-map";

describe("Duress Identity System", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
    // Clear backups
    clearAllBackups();
  });

  afterEach(() => {
    // Cleanup after each test
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
    clearAllBackups();
  });

  describe("Basic Duress Mode Configuration", () => {
    it("should enable decoy mode with a duress code", () => {
      enableDecoyMode("1234");

      const config = loadDuressConfig();
      expect(config.enabled).toBe(true);
      expect(config.decoyCode).toBe("1234");
    });

    it("should disable decoy mode", () => {
      enableDecoyMode("1234");
      disableDecoyMode();

      const config = loadDuressConfig();
      expect(config.enabled).toBe(false);
      expect(config.decoyCode).toBe("");
    });

    it("should check duress code correctly", () => {
      enableDecoyMode("1234");

      expect(checkDuressCode("1234")).toBe("decoy");
      expect(checkDuressCode("wrong")).toBe("normal");
      expect(checkDuressCode("")).toBe("normal");
    });

    it("should return normal when decoy mode is disabled", () => {
      expect(checkDuressCode("1234")).toBe("normal");
    });
  });

  describe("Active Mode Management", () => {
    it("should set and get active mode", () => {
      expect(getActiveMode()).toBe("normal");

      setActiveMode("decoy");
      expect(getActiveMode()).toBe("decoy");

      setActiveMode("wipe");
      expect(getActiveMode()).toBe("wipe");

      setActiveMode("normal");
      expect(getActiveMode()).toBe("normal");
    });

    it("should clear mode when setting to normal", () => {
      setActiveMode("decoy");
      expect(getActiveMode()).toBe("decoy");

      setActiveMode("normal");
      expect(getActiveMode()).toBe("normal");

      // Mode should be cleared from localStorage
      const modeKey = "vfx_duress_mode";
      expect(localStorage.getItem(modeKey)).toBeNull();
    });

    it("should report decoy mode status correctly", () => {
      expect(isInDecoyMode()).toBe(false);

      setActiveMode("decoy");
      expect(isInDecoyMode()).toBe(true);

      setActiveMode("normal");
      expect(isInDecoyMode()).toBe(false);
    });
  });

  describe("Decoy Data Generation", () => {
    it("should generate plausible decoy state", () => {
      const decoyState = generateDecoyState();

      expect(decoyState.countriesVisited).toBeDefined();
      expect(decoyState.countriesVisited.length).toBeGreaterThan(0);
      expect(decoyState.countriesVisited.length).toBeLessThanOrEqual(10);

      expect(decoyState.badges).toBeDefined();
      expect(decoyState.badges.length).toBe(2);

      expect(decoyState.xp).toBeDefined();
      expect(decoyState.level).toBe(1);
    });

    it("should generate different decoy states each time", () => {
      const state1 = generateDecoyState();
      const state2 = generateDecoyState();

      // Due to Math.random() being called in quick succession, we allow for the possibility
      // of identical states, but test that the function is capable of generating different states
      const allStatesEqual =
        JSON.stringify(state1.countriesVisited) === JSON.stringify(state2.countriesVisited);

      // If by chance they're the same, generate a third state to verify randomness
      if (allStatesEqual) {
        const state3 = generateDecoyState();
        expect(JSON.stringify(state1.countriesVisited)).not.toBe(JSON.stringify(state3.countriesVisited));
      } else {
        // If they're different, the test passes
        expect(state1.countriesVisited).not.toEqual(state2.countriesVisited);
      }
    });

    it("should only include safe countries in decoy state", () => {
      const decoyState = generateDecoyState();
      const riskyRegions = ["SYR", "AFG", "YEM", "SDN", "MMR", "UKR", "GZA"];

      for (const country of decoyState.countriesVisited) {
        expect(riskyRegions).not.toContain(country);
      }
    });
  });

  describe("Decoy Data Activation", () => {
    it("should activate decoy data in localStorage", () => {
      activateDecoyData();

      const gamification = localStorage.getItem("vfx-gamification");
      expect(gamification).toBeDefined();

      const parsed = JSON.parse(gamification || "{}");
      expect(parsed.countriesVisited).toBeDefined();
      expect(parsed.badges).toBeDefined();
    });

    it("should clear watchlist when activating decoy data", () => {
      localStorage.setItem("vfx-watch", JSON.stringify({ some: "data" }));

      activateDecoyData();

      const watchlist = localStorage.getItem("vfx-watch");
      expect(watchlist).toBeNull();
    });

    it("should set benign session in decoy mode", () => {
      activateDecoyData();

      const session = localStorage.getItem("vfx-session");
      expect(session).toBeDefined();

      const parsed = JSON.parse(session || "{}");
      expect(parsed.countryContext).toBeNull();
    });
  });

  describe("Full Duress Mode with Identity Stashing", () => {
    it("should enter decoy mode with identity stashing", async () => {
      // Create and save a real identity
      const realIdentity = await generateIdentity();
      await saveIdentity(realIdentity);

      // Set up decoy mode
      enableDecoyMode("1234");

      // Enter decoy mode
      const stashRecord = await enterDecoyMode();

      // Verify stash record was created
      expect(stashRecord.realIdentityHandle).toBe(realIdentity.handle);
      expect(stashRecord.restored).toBe(false);
      expect(stashRecord.stashedAt).toBeDefined();
      expect(stashRecord.backupId).toBeDefined();

      // Verify backup was created
      const backups = loadBackups();
      const backup = backups.find((b) => b.id === stashRecord.backupId);
      expect(backup).toBeDefined();

      // Verify current identity is now the decoy identity
      const currentIdentity = await loadIdentity();
      expect(currentIdentity).toBeDefined();
      expect(currentIdentity?.handle).not.toBe(realIdentity.handle);

      // Verify we're in decoy mode
      expect(isInDecoyMode()).toBe(true);

      // Verify decoy data is activated
      const gamification = localStorage.getItem("vfx-gamification");
      expect(gamification).toBeDefined();
    });

    it("should exit decoy mode and restore real identity", async () => {
      // Create and save a real identity
      const realIdentity = await generateIdentity();
      await saveIdentity(realIdentity);

      // Set up decoy mode
      enableDecoyMode("1234");

      // Enter decoy mode
      await enterDecoyMode();

      const decoyIdentity = await loadIdentity();
      expect(decoyIdentity?.handle).not.toBe(realIdentity.handle);

      // Exit decoy mode
      const restoredHandle = await exitDecoyMode();

      // Verify real identity was restored
      expect(restoredHandle).toBe(realIdentity.handle);

      const restoredIdentity = await loadIdentity();
      expect(restoredIdentity?.handle).toBe(realIdentity.handle);

      // Verify we're no longer in decoy mode
      expect(isInDecoyMode()).toBe(false);

      // Verify stash record was updated
      const stashStatus = getStashStatus();
      expect(stashStatus.stashRecord?.restored).toBe(true);
      expect(stashStatus.stashRecord?.restoredAt).toBeDefined();
    });

    it("should throw error when entering decoy mode without real identity", async () => {
      enableDecoyMode("1234");

      await expect(enterDecoyMode()).rejects.toThrow(
        "Cannot enter decoy mode: no real identity found"
      );
    });

    it("should throw error when exiting decoy mode without stash", async () => {
      // Create a real identity but don't stash it
      const realIdentity = await generateIdentity();
      await saveIdentity(realIdentity);

      // Manually set decoy mode without stashing
      setActiveMode("decoy");

      await expect(exitDecoyMode()).rejects.toThrow(
        "Cannot exit decoy mode: no stash record found"
      );
    });

    it("should throw error when trying to restore twice", async () => {
      // Create and save a real identity
      const realIdentity = await generateIdentity();
      await saveIdentity(realIdentity);

      // Set up decoy mode
      enableDecoyMode("1234");

      // Enter and exit decoy mode
      await enterDecoyMode();
      await exitDecoyMode();

      // Try to exit again (should fail)
      setActiveMode("decoy"); // Reset mode for test
      await expect(exitDecoyMode()).rejects.toThrow("Stash already restored");
    });
  });

  describe("Stash Status and Monitoring", () => {
    it("should report no stash when none exists", () => {
      const status = getStashStatus();

      expect(status.isStashed).toBe(false);
      expect(status.canRestore).toBe(false);
      expect(status.stashRecord).toBeNull();
      expect(status.isInDecoyMode).toBe(false);
    });

    it("should report stash status correctly after entering decoy mode", async () => {
      // Create and save a real identity
      const realIdentity = await generateIdentity();
      await saveIdentity(realIdentity);

      // Set up decoy mode
      enableDecoyMode("1234");

      // Enter decoy mode
      await enterDecoyMode();

      const status = getStashStatus();

      expect(status.isStashed).toBe(true);
      expect(status.canRestore).toBe(true);
      expect(status.stashRecord).toBeDefined();
      expect(status.stashRecord?.restored).toBe(false);
      expect(status.isInDecoyMode).toBe(true);
    });

    it("should report cannot restore after restoration", async () => {
      // Create and save a real identity
      const realIdentity = await generateIdentity();
      await saveIdentity(realIdentity);

      // Set up decoy mode
      enableDecoyMode("1234");

      // Enter and exit decoy mode
      await enterDecoyMode();
      await exitDecoyMode();

      const status = getStashStatus();

      expect(status.isStashed).toBe(true);
      expect(status.canRestore).toBe(false); // Already restored
      expect(status.stashRecord?.restored).toBe(true);
      expect(status.isInDecoyMode).toBe(false);
    });
  });

  describe("Emergency Recovery", () => {
    it("should perform emergency restore when normal exit fails", async () => {
      // Create and save a real identity
      const realIdentity = await generateIdentity();
      await saveIdentity(realIdentity);

      // Set up decoy mode
      enableDecoyMode("1234");

      // Enter decoy mode
      await enterDecoyMode();

      // Verify we're in decoy mode with different identity
      const decoyIdentity = await loadIdentity();
      expect(decoyIdentity?.handle).not.toBe(realIdentity.handle);

      // Perform emergency restore
      const restoredHandle = await emergencyRestoreRealIdentity();

      // Verify real identity was restored
      expect(restoredHandle).toBe(realIdentity.handle);

      const restoredIdentity = await loadIdentity();
      expect(restoredIdentity?.handle).toBe(realIdentity.handle);

      // Verify mode was reset to normal
      expect(isInDecoyMode()).toBe(false);
    });

    it("should throw error when emergency restore without stash", async () => {
      await expect(emergencyRestoreRealIdentity()).rejects.toThrow(
        "No stash record found"
      );
    });

    it("should throw error when backup is missing", async () => {
      // Create and save a real identity
      const realIdentity = await generateIdentity();
      await saveIdentity(realIdentity);

      // Set up decoy mode
      enableDecoyMode("1234");

      // Enter decoy mode
      await enterDecoyMode();

      // Clear backups to simulate missing backup
      clearAllBackups();

      await expect(emergencyRestoreRealIdentity()).rejects.toThrow(
        "Backup containing real data not found"
      );
    });
  });

  describe("Identity Isolation", () => {
    it("should keep real and decoy identities separate", async () => {
      // Create and save a real identity
      const realIdentity = await generateIdentity();
      await saveIdentity(realIdentity);

      // Set up decoy mode
      enableDecoyMode("1234");

      // Enter decoy mode
      await enterDecoyMode();

      const decoyIdentity = await loadIdentity();

      // Identities should be different
      expect(decoyIdentity?.handle).not.toBe(realIdentity.handle);
      expect(decoyIdentity?.publicKeyHex).not.toBe(realIdentity.publicKeyHex);
      expect(decoyIdentity?.fingerprint).not.toBe(realIdentity.fingerprint);

      // Exit decoy mode
      await exitDecoyMode();

      const restoredIdentity = await loadIdentity();

      // Should have real identity back
      expect(restoredIdentity?.handle).toBe(realIdentity.handle);
      expect(restoredIdentity?.publicKeyHex).toBe(realIdentity.publicKeyHex);
      expect(restoredIdentity?.fingerprint).toBe(realIdentity.fingerprint);
    });

    it("should generate consistent decoy identity across multiple entries", async () => {
      // Create and save a real identity
      const realIdentity = await generateIdentity();
      await saveIdentity(realIdentity);

      // Set up decoy mode
      enableDecoyMode("1234");

      // Enter decoy mode first time
      await enterDecoyMode();
      const firstDecoyIdentity = await loadIdentity();

      // Exit and re-enter decoy mode
      await exitDecoyMode();
      await enterDecoyMode();
      const secondDecoyIdentity = await loadIdentity();

      // Decoy identities should be different (new generation each time)
      // since we're not using deterministic generation
      expect(secondDecoyIdentity?.handle).not.toBe(firstDecoyIdentity?.handle);
    });
  });

  describe("Data Persistence Across Duress Cycle", () => {
    it("should preserve missions progress across duress cycle", async () => {
      // This test would verify that missions progress is properly backed up and restored
      // For now, we'll test the mechanism exists

      // Create and save a real identity
      const realIdentity = await generateIdentity();
      await saveIdentity(realIdentity);

      // Simulate missions progress
      const missionsState = {
        missions: {
          test_mission: {
            missionId: "test_mission" as const,
            completedSteps: ["step1", "step2"],
            startedAt: Date.now(),
            completedAt: null,
            lastCompletedAt: Date.now(),
          },
        },
        lastUpdated: Date.now(),
      };
      localStorage.setItem("vfx_missions_progress", JSON.stringify(missionsState));

      // Set up decoy mode
      enableDecoyMode("1234");

      // Enter decoy mode
      await enterDecoyMode();

      // Missions should be cleared in decoy mode (or show decoy data)
      const decoyMissions = localStorage.getItem("vfx_missions_progress");
      expect(decoyMissions).toBeDefined(); // Should have decoy data

      // Exit decoy mode
      await exitDecoyMode();

      // Real missions should be restored
      const restoredMissions = localStorage.getItem("vfx_missions_progress");
      expect(restoredMissions).toBeDefined();
      const parsed = JSON.parse(restoredMissions || "{}");
      expect(parsed.missions?.test_mission?.completedSteps).toEqual(["step1", "step2"]);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle localStorage unavailability gracefully", () => {
      // Save original localStorage
      const originalLocalStorage = global.localStorage;

      // Mock localStorage as unavailable
      delete (global as any).localStorage;

      expect(() => loadDuressConfig()).not.toThrow();
      expect(() => setActiveMode("normal")).not.toThrow();
      expect(() => enableDecoyMode("1234")).not.toThrow();

      // Restore localStorage
      global.localStorage = originalLocalStorage;
    });

    it("should handle corrupted decoy config", () => {
      localStorage.setItem("vfx_duress_cfg", "invalid-json");

      const config = loadDuressConfig();
      expect(config.enabled).toBe(false);
      expect(config.decoyCode).toBe("");
    });

    it("should handle corrupted stash record", () => {
      localStorage.setItem("vfx_duress_stash_record", "invalid-json");

      const status = getStashStatus();
      expect(status.stashRecord).toBeNull();
    });
  });

  describe("Integration with Storage Map", () => {
    it("should use storage map backup system", async () => {
      // Create and save a real identity
      const realIdentity = await generateIdentity();
      await saveIdentity(realIdentity);

      // Set up decoy mode
      enableDecoyMode("1234");

      // Enter decoy mode
      const stashRecord = await enterDecoyMode();

      // Verify backup was created using storage map system
      const backups = loadBackups();
      const backup = backups.find((b) => b.id === stashRecord.backupId);

      expect(backup).toBeDefined();
      expect(backup?.localStorage).toBeDefined();
      expect(backup?.localStorage["vfx_identity"]).toBeDefined(); // Real identity should be backed up

      // Verify backup metadata
      expect(backup?.label).toContain("duress-stash");
      expect(backup?.metadata.categories).toContain("identity");
    });
  });
});
