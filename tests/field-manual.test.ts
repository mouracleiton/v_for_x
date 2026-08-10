import { describe, it, expect } from "vitest";
import {
  FIELD_MANUALS,
  getManuals,
  getManual,
  getManualsByScenario,
  generatePrintableHTML,
  SCENARIO_LABELS,
} from "../lib/field-manual";

describe("field-manual.ts", () => {
  describe("FIELD_MANUALS", () => {
    it("should have 10 manuals", () => {
      expect(FIELD_MANUALS).toHaveLength(10);
    });

    it("should have unique ids", () => {
      const ids = FIELD_MANUALS.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("should have all required fields", () => {
      for (const m of FIELD_MANUALS) {
        expect(m.title).toBeDefined();
        expect(m.subtitle).toBeDefined();
        expect(m.icon).toBeDefined();
        expect(m.summary).toBeDefined();
        expect(m.phases.length).toBeGreaterThan(0);
        expect(m.kitChecklist.length).toBeGreaterThan(0);
        expect(m.warnings.length).toBeGreaterThan(0);
        expect(m.emergencyContacts.length).toBeGreaterThan(0);
      }
    });

    it("should have phases with timeframes and actions", () => {
      for (const m of FIELD_MANUALS) {
        for (const phase of m.phases) {
          expect(phase.name).toBeDefined();
          expect(phase.timeframe).toBeDefined();
          expect(phase.actions.length).toBeGreaterThan(0);
        }
      }
    });

    it("should have at least one critical action across all phases", () => {
      for (const m of FIELD_MANUALS) {
        const allActions = m.phases.flatMap((p) => p.actions);
        expect(allActions.some((a) => a.critical)).toBe(true);
      }
    });
  });

  describe("getManuals", () => {
    it("should return all manuals", () => {
      expect(getManuals()).toHaveLength(10);
    });
  });

  describe("getManual", () => {
    it("should find a manual by id", () => {
      const m = getManual("fm-blackout");
      expect(m).not.toBeNull();
      expect(m!.title).toContain("Grid Failure");
    });

    it("should return null for unknown id", () => {
      expect(getManual("nonexistent")).toBeNull();
    });
  });

  describe("getManualsByScenario", () => {
    it("should filter by scenario", () => {
      const manuals = getManualsByScenario("blackout");
      expect(manuals.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("generatePrintableHTML", () => {
    it("should generate valid HTML", () => {
      const m = FIELD_MANUALS[0];
      const html = generatePrintableHTML(m);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain(m.title);
      expect(html).toContain(m.summary);
      expect(html).toContain("</html>");
    });

    it("should include all phases and warnings", () => {
      const m = FIELD_MANUALS.find((x) => x.id === "fm-arrest")!;
      const html = generatePrintableHTML(m);
      expect(html).toContain("IMMEDIATE");
      expect(html).toContain("warnings");
    });
  });

  describe("SCENARIO_LABELS", () => {
    it("should have labels for all scenarios", () => {
      expect(Object.keys(SCENARIO_LABELS).length).toBe(10);
    });
  });
});
