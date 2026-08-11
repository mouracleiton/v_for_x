import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  PLAYBOOKS,
  getPlaybook,
  getAllPlaybooks,
  getPlaybooksForPersona,
  getPlaybooksByCategory,
  getPlaybooksBySeverity,
  getPlaybookProgress,
  getChecklistProgress,
  completeChecklistItem,
  uncompleteChecklistItem,
  resetPlaybookProgress,
  resetAllPlaybooksProgress,
  isChecklistItemCompleted,
  isChecklistCompleted,
  isPlaybookCompleted,
  getPlaybookCompletion,
  getChecklistCompletion,
  addPlaybookNote,
  removePlaybookNote,
  getPlaybookNotes,
  getCompletedPlaybooks,
  getInProgressPlaybooks,
  getNotStartedPlaybooks,
  getTotalCompletion,
  getPlaybookStats,
  getSeverityDescription,
  getCategoryIcon,
  getCategoryDisplayName,
  getPlaybooksByCategoryMap,
  exportPlaybookProgress,
  importPlaybookProgress,
  type PlaybookId,
  type PlaybookCategory,
  type PlaybookSeverity,
} from "../lib/playbooks";

describe("playbooks.ts", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    // Clean up after each test
    localStorage.clear();
  });

  describe("PLAYBOOKS constant", () => {
    it("should have exactly 7 playbooks", () => {
      expect(Object.keys(PLAYBOOKS)).toHaveLength(7);
    });

    it("should have all required playbook IDs", () => {
      const expectedIds: PlaybookId[] = [
        "arrest_response",
        "internet_shutdown",
        "forced_displacement",
        "medical_crisis",
        "surveillance_detection",
        "violent_crackdown",
        "document_emergency",
      ];
      expectedIds.forEach((id) => {
        expect(PLAYBOOKS[id]).toBeDefined();
      });
    });

    it("should have valid playbook structure", () => {
      Object.values(PLAYBOOKS).forEach((playbook) => {
        expect(playbook).toHaveProperty("id");
        expect(playbook).toHaveProperty("name");
        expect(playbook).toHaveProperty("description");
        expect(playbook).toHaveProperty("icon");
        expect(playbook).toHaveProperty("category");
        expect(playbook).toHaveProperty("severity");
        expect(playbook).toHaveProperty("estimatedTime");
        expect(playbook).toHaveProperty("recommendedFor");
        expect(playbook).toHaveProperty("checklists");
        expect(playbook).toHaveProperty("resources");

        expect(playbook.checklists).toBeInstanceOf(Array);
        expect(playbook.resources).toBeInstanceOf(Array);
        expect(playbook.checklists.length).toBeGreaterThan(0);
        expect(playbook.resources.length).toBeGreaterThan(0);

        // Validate checklist structure
        playbook.checklists.forEach((checklist) => {
          expect(checklist).toHaveProperty("id");
          expect(checklist).toHaveProperty("title");
          expect(checklist).toHaveProperty("items");
          expect(checklist.items).toBeInstanceOf(Array);
          expect(checklist.items.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe("getPlaybook", () => {
    it("should return playbook by valid ID", () => {
      const playbook = getPlaybook("arrest_response");
      expect(playbook).toBeDefined();
      expect(playbook?.id).toBe("arrest_response");
    });

    it("should return null for invalid ID", () => {
      const playbook = getPlaybook("invalid_playbook" as PlaybookId);
      expect(playbook).toBeNull();
    });
  });

  describe("getAllPlaybooks", () => {
    it("should return all 7 playbooks", () => {
      const playbooks = getAllPlaybooks();
      expect(playbooks).toHaveLength(7);
    });
  });

  describe("getPlaybooksForPersona", () => {
    it("should return playbooks recommended for journalist", () => {
      const playbooks = getPlaybooksForPersona("journalist");
      expect(playbooks.length).toBeGreaterThan(0);
      playbooks.forEach((playbook) => {
        expect(playbook.recommendedFor).toContain("journalist");
      });
    });

    it("should return playbooks recommended for civilian", () => {
      const playbooks = getPlaybooksForPersona("civilian");
      expect(playbooks.length).toBeGreaterThan(0);
      playbooks.forEach((playbook) => {
        expect(playbook.recommendedFor).toContain("civilian");
      });
    });

    it("should return different playbooks for different personas", () => {
      const journalistPlaybooks = getPlaybooksForPersona("journalist");
      const civilianPlaybooks = getPlaybooksForPersona("civilian");
      expect(journalistPlaybooks.length).not.toBe(civilianPlaybooks.length);
    });
  });

  describe("getPlaybooksByCategory", () => {
    it("should return playbooks in security category", () => {
      const playbooks = getPlaybooksByCategory("security");
      expect(playbooks.length).toBeGreaterThan(0);
      playbooks.forEach((playbook) => {
        expect(playbook.category).toBe("security");
      });
    });

    it("should return playbooks in evidence category", () => {
      const playbooks = getPlaybooksByCategory("evidence");
      expect(playbooks.length).toBeGreaterThan(0);
      playbooks.forEach((playbook) => {
        expect(playbook.category).toBe("evidence");
      });
    });
  });

  describe("getPlaybooksBySeverity", () => {
    it("should return critical severity playbooks", () => {
      const playbooks = getPlaybooksBySeverity("critical");
      expect(playbooks.length).toBeGreaterThan(0);
      playbooks.forEach((playbook) => {
        expect(playbook.severity).toBe("critical");
      });
    });

    it("should return high severity playbooks", () => {
      const playbooks = getPlaybooksBySeverity("high");
      expect(playbooks.length).toBeGreaterThan(0);
      playbooks.forEach((playbook) => {
        expect(playbook.severity).toBe("high");
      });
    });
  });

  describe("Playbook Progress Tracking", () => {
    describe("completeChecklistItem", () => {
      it("should mark checklist item as completed", () => {
        const playbookId = "arrest_response" as PlaybookId;
        const playbook = PLAYBOOKS[playbookId];
        const checklistId = playbook.checklists[0].id;
        const itemIndex = 0;

        completeChecklistItem(playbookId, checklistId, itemIndex);

        const progress = getChecklistProgress(playbookId, checklistId);
        expect(progress).toBeDefined();
        expect(progress?.completedItems).toContain(itemIndex);
      });

      it("should handle multiple completions", () => {
        const playbookId = "arrest_response" as PlaybookId;
        const playbook = PLAYBOOKS[playbookId];
        const checklistId = playbook.checklists[0].id;

        completeChecklistItem(playbookId, checklistId, 0);
        completeChecklistItem(playbookId, checklistId, 1);
        completeChecklistItem(playbookId, checklistId, 2);

        const progress = getChecklistProgress(playbookId, checklistId);
        expect(progress?.completedItems).toEqual([0, 1, 2]);
      });

      it("should not duplicate completed items", () => {
        const playbookId = "arrest_response" as PlaybookId;
        const playbook = PLAYBOOKS[playbookId];
        const checklistId = playbook.checklists[0].id;

        completeChecklistItem(playbookId, checklistId, 0);
        completeChecklistItem(playbookId, checklistId, 0); // Duplicate

        const progress = getChecklistProgress(playbookId, checklistId);
        expect(progress?.completedItems).toEqual([0]);
      });
    });

    describe("uncompleteChecklistItem", () => {
      it("should remove checklist item from completed", () => {
        const playbookId = "arrest_response" as PlaybookId;
        const playbook = PLAYBOOKS[playbookId];
        const checklistId = playbook.checklists[0].id;

        completeChecklistItem(playbookId, checklistId, 0);
        completeChecklistItem(playbookId, checklistId, 1);
        uncompleteChecklistItem(playbookId, checklistId, 0);

        const progress = getChecklistProgress(playbookId, checklistId);
        expect(progress?.completedItems).toEqual([1]);
      });
    });

    describe("isChecklistItemCompleted", () => {
      it("should return true for completed items", () => {
        const playbookId = "arrest_response" as PlaybookId;
        const playbook = PLAYBOOKS[playbookId];
        const checklistId = playbook.checklists[0].id;

        completeChecklistItem(playbookId, checklistId, 0);

        expect(isChecklistItemCompleted(playbookId, checklistId, 0)).toBe(true);
        expect(isChecklistItemCompleted(playbookId, checklistId, 1)).toBe(false);
      });
    });

    describe("isChecklistCompleted", () => {
      it("should return true when all items completed", () => {
        const playbookId = "arrest_response" as PlaybookId;
        const playbook = PLAYBOOKS[playbookId];
        const checklist = playbook.checklists[0];
        const checklistId = checklist.id;

        // Complete all items in checklist
        for (let i = 0; i < checklist.items.length; i++) {
          completeChecklistItem(playbookId, checklistId, i);
        }

        expect(isChecklistCompleted(playbookId, checklistId)).toBe(true);
      });

      it("should return false when not all items completed", () => {
        const playbookId = "arrest_response" as PlaybookId;
        const playbook = PLAYBOOKS[playbookId];
        const checklistId = playbook.checklists[0].id;

        completeChecklistItem(playbookId, checklistId, 0);

        expect(isChecklistCompleted(playbookId, checklistId)).toBe(false);
      });
    });

    describe("isPlaybookCompleted", () => {
      it("should return true when all checklists completed", () => {
        const playbookId = "arrest_response" as PlaybookId;
        const playbook = PLAYBOOKS[playbookId];

        // Complete all items in all checklists
        playbook.checklists.forEach((checklist) => {
          for (let i = 0; i < checklist.items.length; i++) {
            completeChecklistItem(playbookId, checklist.id, i);
          }
        });

        expect(isPlaybookCompleted(playbookId)).toBe(true);
      });

      it("should return false when not fully completed", () => {
        const playbookId = "arrest_response" as PlaybookId;
        const playbook = PLAYBOOKS[playbookId];

        // Complete only first checklist
        const firstChecklist = playbook.checklists[0];
        for (let i = 0; i < firstChecklist.items.length; i++) {
          completeChecklistItem(playbookId, firstChecklist.id, i);
        }

        expect(isPlaybookCompleted(playbookId)).toBe(false);
      });
    });

    describe("getPlaybookCompletion", () => {
      it("should return 0 for no progress", () => {
        const completion = getPlaybookCompletion("arrest_response");
        expect(completion).toBe(0);
      });

      it("should return 100 when fully completed", () => {
        const playbookId = "arrest_response" as PlaybookId;
        const playbook = PLAYBOOKS[playbookId];

        // Complete all items
        playbook.checklists.forEach((checklist) => {
          for (let i = 0; i < checklist.items.length; i++) {
            completeChecklistItem(playbookId, checklist.id, i);
          }
        });

        expect(getPlaybookCompletion(playbookId)).toBe(100);
      });

      it("should calculate partial completion correctly", () => {
        const playbookId = "arrest_response" as PlaybookId;
        const playbook = PLAYBOOKS[playbookId];

        // Complete half of first checklist
        const firstChecklist = playbook.checklists[0];
        const halfItems = Math.floor(firstChecklist.items.length / 2);
        for (let i = 0; i < halfItems; i++) {
          completeChecklistItem(playbookId, firstChecklist.id, i);
        }

        const completion = getPlaybookCompletion(playbookId);
        expect(completion).toBeGreaterThan(0);
        expect(completion).toBeLessThan(100);
      });
    });

    describe("getChecklistCompletion", () => {
      it("should return 0 for no progress", () => {
        const playbookId = "arrest_response" as PlaybookId;
        const checklistId = PLAYBOOKS[playbookId].checklists[0].id;

        const completion = getChecklistCompletion(playbookId, checklistId);
        expect(completion).toBe(0);
      });

      it("should return 100 when fully completed", () => {
        const playbookId = "arrest_response" as PlaybookId;
        const checklist = PLAYBOOKS[playbookId].checklists[0];
        const checklistId = checklist.id;

        for (let i = 0; i < checklist.items.length; i++) {
          completeChecklistItem(playbookId, checklistId, i);
        }

        expect(getChecklistCompletion(playbookId, checklistId)).toBe(100);
      });
    });
  });

  describe("Playbook Notes", () => {
    it("should add note to playbook", () => {
      const playbookId = "arrest_response" as PlaybookId;
      const note = "This is an important note";

      addPlaybookNote(playbookId, note);

      const notes = getPlaybookNotes(playbookId);
      expect(notes).toContain(note);
    });

    it("should add multiple notes", () => {
      const playbookId = "arrest_response" as PlaybookId;

      addPlaybookNote(playbookId, "Note 1");
      addPlaybookNote(playbookId, "Note 2");
      addPlaybookNote(playbookId, "Note 3");

      const notes = getPlaybookNotes(playbookId);
      expect(notes).toHaveLength(3);
      expect(notes).toEqual(["Note 1", "Note 2", "Note 3"]);
    });

    it("should remove note by index", () => {
      const playbookId = "arrest_response" as PlaybookId;

      addPlaybookNote(playbookId, "Note 1");
      addPlaybookNote(playbookId, "Note 2");
      addPlaybookNote(playbookId, "Note 3");

      removePlaybookNote(playbookId, 1);

      const notes = getPlaybookNotes(playbookId);
      expect(notes).toEqual(["Note 1", "Note 3"]);
    });

    it("should return empty array for playbook with no notes", () => {
      const notes = getPlaybookNotes("arrest_response");
      expect(notes).toEqual([]);
    });
  });

  describe("resetPlaybookProgress", () => {
    it("should reset playbook progress", () => {
      const playbookId = "arrest_response" as PlaybookId;
      const playbook = PLAYBOOKS[playbookId];

      // Complete some items
      completeChecklistItem(playbookId, playbook.checklists[0].id, 0);
      addPlaybookNote(playbookId, "Test note");

      // Reset
      resetPlaybookProgress(playbookId);

      expect(getPlaybookCompletion(playbookId)).toBe(0);
      expect(getPlaybookNotes(playbookId)).toEqual([]);
    });
  });

  describe("resetAllPlaybooksProgress", () => {
    it("should reset all playbook progress", () => {
      // Complete some items in multiple playbooks
      completeChecklistItem("arrest_response", PLAYBOOKS.arrest_response.checklists[0].id, 0);
      completeChecklistItem("internet_shutdown", PLAYBOOKS.internet_shutdown.checklists[0].id, 0);
      addPlaybookNote("medical_crisis", "Test note");

      // Reset all
      resetAllPlaybooksProgress();

      expect(getPlaybookCompletion("arrest_response")).toBe(0);
      expect(getPlaybookCompletion("internet_shutdown")).toBe(0);
      expect(getPlaybookNotes("medical_crisis")).toEqual([]);
    });
  });

  describe("Playbook Status Queries", () => {
    beforeEach(() => {
      // Setup some progress
      const arrestPlaybook = PLAYBOOKS.arrest_response;
      completeChecklistItem("arrest_response", arrestPlaybook.checklists[0].id, 0);

      // Complete a full playbook
      const shutdownPlaybook = PLAYBOOKS.internet_shutdown;
      shutdownPlaybook.checklists.forEach((checklist) => {
        for (let i = 0; i < checklist.items.length; i++) {
          completeChecklistItem("internet_shutdown", checklist.id, i);
        }
      });
    });

    it("should return completed playbooks", () => {
      const completed = getCompletedPlaybooks();
      expect(completed.length).toBeGreaterThan(0);
      expect(completed.find((p) => p.id === "internet_shutdown")).toBeDefined();
    });

    it("should return in-progress playbooks", () => {
      const inProgress = getInProgressPlaybooks();
      expect(inProgress.length).toBeGreaterThan(0);
      expect(inProgress.find((p) => p.id === "arrest_response")).toBeDefined();
    });

    it("should return not-started playbooks", () => {
      const notStarted = getNotStartedPlaybooks();
      expect(notStarted.length).toBeGreaterThan(0);
      // Should not include arrest_response or internet_shutdown
      expect(notStarted.find((p) => p.id === "arrest_response")).toBeUndefined();
      expect(notStarted.find((p) => p.id === "internet_shutdown")).toBeUndefined();
    });
  });

  describe("getTotalCompletion", () => {
    it("should return 0 for no progress", () => {
      expect(getTotalCompletion()).toBe(0);
    });

    it("should calculate total completion across all playbooks", () => {
      // Complete half of items in first checklist of first playbook
      const playbook = PLAYBOOKS.arrest_response;
      const halfItems = Math.floor(playbook.checklists[0].items.length / 2);
      for (let i = 0; i < halfItems; i++) {
        completeChecklistItem("arrest_response", playbook.checklists[0].id, i);
      }

      const total = getTotalCompletion();
      expect(total).toBeGreaterThan(0);
      expect(total).toBeLessThan(100);
    });
  });

  describe("getPlaybookStats", () => {
    it("should return stats with all properties", () => {
      const stats = getPlaybookStats();

      expect(stats).toHaveProperty("totalPlaybooks");
      expect(stats).toHaveProperty("completedPlaybooks");
      expect(stats).toHaveProperty("inProgressPlaybooks");
      expect(stats).toHaveProperty("notStartedPlaybooks");
      expect(stats).toHaveProperty("totalItems");
      expect(stats).toHaveProperty("completedItems");
      expect(stats).toHaveProperty("overallCompletion");

      expect(stats.totalPlaybooks).toBe(7);
      expect(stats.totalItems).toBeGreaterThan(0);
    });

    it("should track completed playbooks correctly", () => {
      // Complete a playbook
      const playbook = PLAYBOOKS.internet_shutdown;
      playbook.checklists.forEach((checklist) => {
        for (let i = 0; i < checklist.items.length; i++) {
          completeChecklistItem("internet_shutdown", checklist.id, i);
        }
      });

      const stats = getPlaybookStats();
      expect(stats.completedPlaybooks).toBe(1);
    });
  });

  describe("Utility Functions", () => {
    describe("getSeverityDescription", () => {
      it("should return descriptions for all severity levels", () => {
        expect(getSeverityDescription("critical")).toContain("Critical");
        expect(getSeverityDescription("high")).toContain("High");
        expect(getSeverityDescription("medium")).toContain("Medium");
        expect(getSeverityDescription("low")).toContain("Low");
      });
    });

    describe("getCategoryIcon", () => {
      it("should return icons for all categories", () => {
        expect(getCategoryIcon("legal")).toBeTruthy();
        expect(getCategoryIcon("infrastructure")).toBeTruthy();
        expect(getCategoryIcon("humanitarian")).toBeTruthy();
        expect(getCategoryIcon("health")).toBeTruthy();
        expect(getCategoryIcon("security")).toBeTruthy();
        expect(getCategoryIcon("evidence")).toBeTruthy();
      });
    });

    describe("getCategoryDisplayName", () => {
      it("should return display names for all categories", () => {
        expect(getCategoryDisplayName("legal")).toContain("Legal");
        expect(getCategoryDisplayName("infrastructure")).toContain("Infrastructure");
        expect(getCategoryDisplayName("humanitarian")).toContain("Humanitarian");
        expect(getCategoryDisplayName("health")).toContain("Medical");
        expect(getCategoryDisplayName("security")).toContain("Security");
        expect(getCategoryDisplayName("evidence")).toContain("Evidence");
      });
    });

    describe("getPlaybooksByCategoryMap", () => {
      it("should organize playbooks by category", () => {
        const map = getPlaybooksByCategoryMap();

        expect(Object.keys(map).length).toBeGreaterThan(0);
        expect(map["security"]).toBeDefined();
        expect(map["evidence"]).toBeDefined();

        // Check that playbooks are in correct categories
        expect(map["legal"]?.find((p) => p.id === "arrest_response")).toBeDefined();
        expect(map["evidence"]?.find((p) => p.id === "document_emergency")).toBeDefined();
      });
    });
  });

  describe("Import/Export", () => {
    it("should export playbook progress as JSON", () => {
      const playbookId = "arrest_response" as PlaybookId;
      const checklistId = PLAYBOOKS[playbookId].checklists[0].id;

      completeChecklistItem(playbookId, checklistId, 0);
      addPlaybookNote(playbookId, "Test note");

      const exported = exportPlaybookProgress();

      expect(exported).toBeTruthy();
      const parsed = JSON.parse(exported);
      expect(parsed.playbooks).toBeDefined();
      expect(parsed.playbooks[playbookId]).toBeDefined();
    });

    it("should import playbook progress from JSON", () => {
      const playbookId = "arrest_response" as PlaybookId;
      const checklistId = PLAYBOOKS[playbookId].checklists[0].id;

      // Create some progress
      completeChecklistItem(playbookId, checklistId, 0);
      addPlaybookNote(playbookId, "Test note");

      // Export
      const exported = exportPlaybookProgress();

      // Clear and import
      localStorage.clear();
      const imported = importPlaybookProgress(exported);

      expect(imported).toBe(true);
      expect(isChecklistItemCompleted(playbookId, checklistId, 0)).toBe(true);
      expect(getPlaybookNotes(playbookId)).toContain("Test note");
    });

    it("should return false for invalid JSON", () => {
      const imported = importPlaybookProgress("invalid json");
      expect(imported).toBe(false);
    });

    it("should return false for malformed data", () => {
      const imported = importPlaybookProgress(JSON.stringify({ invalid: "data" }));
      expect(imported).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle invalid playbook IDs gracefully", () => {
      expect(getPlaybook("invalid" as PlaybookId)).toBeNull();
      expect(getPlaybookProgress("invalid" as PlaybookId)).toBeNull();
      expect(getPlaybookCompletion("invalid" as PlaybookId)).toBe(0);
    });

    it("should handle invalid checklist IDs gracefully", () => {
      const progress = getChecklistProgress("arrest_response", "invalid_checklist");
      expect(progress).toBeNull();
      expect(getChecklistCompletion("arrest_response", "invalid_checklist")).toBe(0);
    });

    it("should handle out of range item indices", () => {
      const checklistId = PLAYBOOKS.arrest_response.checklists[0].id;

      // Should not throw error
      completeChecklistItem("arrest_response", checklistId, 9999);
      uncompleteChecklistItem("arrest_response", checklistId, 9999);

      // Item should still be marked as completed if we completed it
      completeChecklistItem("arrest_response", checklistId, 0);
      expect(isChecklistItemCompleted("arrest_response", checklistId, 0)).toBe(true);
    });

    it("should handle out of range note indices", () => {
      addPlaybookNote("arrest_response", "Test note");

      // Should not throw error
      removePlaybookNote("arrest_response", 9999);

      // Valid removal should still work
      removePlaybookNote("arrest_response", 0);
      expect(getPlaybookNotes("arrest_response")).toEqual([]);
    });
  });
});
