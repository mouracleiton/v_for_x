import { describe, it, expect } from "vitest";
import {
  createPolitician,
  createPromise,
  updatePromiseStatus,
  computeTruthScore,
  rankPoliticians,
  STATUS_LABELS,
  LEVEL_LABELS,
} from "../lib/promises";

describe("promises.ts", () => {
  describe("createPolitician", () => {
    it("should create a politician with id", () => {
      const p = createPolitician("John Doe", "President", "Countryland", "Progress Party");
      expect(p.id).toBeDefined();
      expect(p.name).toBe("John Doe");
      expect(p.position).toBe("President");
      expect(p.country).toBe("Countryland");
    });
  });

  describe("createPromise", () => {
    it("should create a pending promise", () => {
      const p = createPromise("p1", "End hunger by 2030", "hunger", "critical", "2024-01-01");
      expect(p.status).toBe("pending");
      expect(p.importance).toBe("critical");
      expect(p.category).toBe("hunger");
    });
  });

  describe("updatePromiseStatus", () => {
    it("should update status and evidence", () => {
      const p = createPromise("p1", "Build 100 schools", "education", "major", "2024");
      const updated = updatePromiseStatus(p, "fulfilled", "100 schools built (verified)");
      expect(updated.status).toBe("fulfilled");
      expect(updated.evidence).toContain("100 schools");
    });
  });

  describe("computeTruthScore", () => {
    it("should return untested for no promises", () => {
      const score = computeTruthScore("p1", []);
      expect(score.level).toBe("untested");
      expect(score.score).toBe(0);
    });

    it("should return untested when all promises are pending", () => {
      const promises = [
        createPromise("p1", "Promise 1", "health", "major", "2024"),
        createPromise("p1", "Promise 2", "economy", "minor", "2024"),
      ];
      const score = computeTruthScore("p1", promises);
      expect(score.level).toBe("untested");
    });

    it("should score 100 when all fulfilled", () => {
      const promises = [
        createPromise("p1", "Promise 1", "health", "major", "2024"),
        createPromise("p1", "Promise 2", "economy", "minor", "2024"),
      ].map((p) => updatePromiseStatus(p, "fulfilled"));
      const score = computeTruthScore("p1", promises);
      expect(score.score).toBe(100);
      expect(score.level).toBe("honest");
    });

    it("should score 0 when all broken", () => {
      const promises = [
        createPromise("p1", "Promise 1", "health", "major", "2024"),
      ].map((p) => updatePromiseStatus(p, "broken"));
      const score = computeTruthScore("p1", promises);
      expect(score.score).toBe(0);
      expect(score.level).toBe("pathological");
    });

    it("should weight critical promises more heavily", () => {
      const promises = [
        createPromise("p1", "Critical promise", "hunger", "critical", "2024"),
        createPromise("p1", "Minor promise", "other", "minor", "2024"),
      ];
      const fulfilled = promises.map((p, i) =>
        i === 1 ? updatePromiseStatus(p, "fulfilled") : updatePromiseStatus(p, "broken"),
      );
      const score = computeTruthScore("p1", fulfilled);
      // Only minor fulfilled, critical broken → low score
      expect(score.score).toBeLessThan(30);
    });

    it("should count overdue pending promises", () => {
      const past = "2020-01-01";
      const promises = [
        createPromise("p1", "Old promise", "health", "major", "2019", past),
      ];
      const score = computeTruthScore("p1", promises);
      expect(score.overdue).toBe(1);
    });
  });

  describe("rankPoliticians", () => {
    it("should sort by score descending", () => {
      const p1 = createPolitician("Honest Pol", "Mayor", "Country A");
      const p2 = createPolitician("Liar Pol", "Mayor", "Country B");

      const promises = [
        ...[createPromise(p1.id, "P", "health", "major", "2024")].map((p) => updatePromiseStatus(p, "fulfilled")),
        ...[createPromise(p2.id, "P", "health", "major", "2024")].map((p) => updatePromiseStatus(p, "broken")),
      ];

      const ranked = rankPoliticians([p1, p2], promises);
      expect(ranked[0].name).toBe("Honest Pol");
      expect(ranked[0].score.score).toBe(100);
      expect(ranked[1].score.score).toBe(0);
    });

    it("should sort untested politicians last", () => {
      const p1 = createPolitician("Tested", "Mayor", "A");
      const p2 = createPolitician("Untested", "Mayor", "B");

      const promises = [
        createPromise(p1.id, "P", "health", "major", "2024"),
      ].map((p) => updatePromiseStatus(p, "fulfilled"));

      const ranked = rankPoliticians([p2, p1], promises);
      expect(ranked[0].name).toBe("Tested");
      expect(ranked[1].name).toBe("Untested");
    });
  });

  describe("metadata", () => {
    it("should have all status labels", () => {
      expect(Object.keys(STATUS_LABELS)).toHaveLength(5);
    });
    it("should have all level labels", () => {
      expect(Object.keys(LEVEL_LABELS)).toHaveLength(5);
    });
  });
});
