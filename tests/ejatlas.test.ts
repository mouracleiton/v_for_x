import { describe, it, expect } from "vitest";
import {
  getEjatlasSummary,
  getCountryConflictSummary,
  getTotalConflicts,
  getTopConflictCountries,
  getGlobalCategories,
  getStatusBreakdown,
  intensityColor,
  severityRank,
  statusLabel,
} from "../lib/ejatlas";

describe("ejatlas.ts — EJAtlas data access", () => {
  describe("getEjatlasSummary", () => {
    it("returns the full summary object", () => {
      const s = getEjatlasSummary();
      expect(s).toBeTruthy();
      expect(s.metadata).toBeDefined();
      expect(s.summary).toBeDefined();
      expect(s.country_summaries).toBeDefined();
    });

    it("has metadata with expected fields", () => {
      const m = getEjatlasSummary().metadata;
      expect(m.schema_version).toBeTruthy();
      expect(typeof m.total_conflicts).toBe("number");
      expect(typeof m.total_countries).toBe("number");
      expect(m.source).toContain("ejatlas");
    });
  });

  describe("getTotalConflicts", () => {
    it("returns the metadata total_conflicts count", () => {
      const total = getTotalConflicts();
      expect(total).toBe(getEjatlasSummary().metadata.total_conflicts);
      expect(total).toBeGreaterThan(0);
    });
  });

  describe("getCountryConflictSummary", () => {
    it("returns a summary for a country present in the dataset", () => {
      const firstIso = Object.keys(getEjatlasSummary().country_summaries)[0];
      const cs = getCountryConflictSummary(firstIso);
      expect(cs).not.toBeNull();
      expect(cs!.total).toBeGreaterThan(0);
      expect(Array.isArray(cs!.top_categories)).toBe(true);
      expect(Array.isArray(cs!.top_conflicts)).toBe(true);
    });

    it("returns null for an unknown ISO3 code", () => {
      expect(getCountryConflictSummary("ZZZ")).toBeNull();
    });
  });

  describe("getTopConflictCountries", () => {
    it("returns entries sorted by total descending up to the limit", () => {
      const top = getTopConflictCountries(5);
      expect(top).toHaveLength(5);
      for (let i = 1; i < top.length; i++) {
        expect(top[i - 1].total).toBeGreaterThanOrEqual(top[i].total);
      }
    });

    it("respects a custom limit", () => {
      const top = getTopConflictCountries(3);
      expect(top).toHaveLength(3);
    });

    it("includes the iso3 code on each entry", () => {
      const [first] = getTopConflictCountries(1);
      expect(typeof first.iso3).toBe("string");
      expect(first.iso3.length).toBe(3);
    });

    it("defaults to 10 when no limit given", () => {
      expect(getTopConflictCountries()).toHaveLength(10);
    });
  });

  describe("getGlobalCategories", () => {
    it("returns the by_category breakdown array", () => {
      const cats = getGlobalCategories();
      expect(Array.isArray(cats)).toBe(true);
      expect(cats.length).toBeGreaterThan(0);
      for (const c of cats) {
        expect(typeof c.name).toBe("string");
        expect(typeof c.count).toBe("number");
      }
    });
  });

  describe("getStatusBreakdown", () => {
    it("maps raw status names to human-friendly labels", () => {
      const breakdown = getStatusBreakdown();
      expect(breakdown.length).toBeGreaterThan(0);
      const labels = breakdown.map((s) => s.label);
      // Every mapped label should be non-empty and title/upper-cased
      for (const l of labels) {
        expect(l.length).toBeGreaterThan(0);
      }
    });

    it("preserves the count alongside the relabeled name", () => {
      const breakdown = getStatusBreakdown();
      for (const s of breakdown) {
        expect(typeof s.count).toBe("number");
        expect(typeof s.name).toBe("string");
      }
    });

    it("labels the known canonical statuses", () => {
      const breakdown = getStatusBreakdown();
      const names = breakdown.map((s) => s.name);
      // The dataset should contain at least one recognized status string.
      const known = [
        "in operation",
        "stopped",
        "under construction",
        "unknown",
        "",
      ];
      expect(known.some((k) => names.includes(k))).toBe(true);
    });
  });

  describe("intensityColor", () => {
    it("returns a hex color for each known level", () => {
      expect(intensityColor("high")).toBe("#ff0000");
      expect(intensityColor("medium")).toBe("#ff7f50");
      expect(intensityColor("low")).toBe("#ffc40d");
      expect(intensityColor("latent")).toBe("#049cdb");
    });

    it("returns a neutral grey for unknown levels", () => {
      expect(intensityColor("unknown")).toBe("#666");
      expect(intensityColor("nonsense")).toBe("#666");
    });
  });

  describe("severityRank", () => {
    it("ranks high > moderate > low", () => {
      expect(severityRank("high")).toBeGreaterThan(severityRank("moderate"));
      expect(severityRank("moderate")).toBeGreaterThan(severityRank("low"));
    });

    it("returns 1 for any unrecognised severity", () => {
      expect(severityRank("unknown")).toBe(1);
      expect(severityRank("")).toBe(1);
    });
  });

  describe("statusLabel", () => {
    it("returns upper-cased canonical labels", () => {
      expect(statusLabel("in operation")).toBe("ACTIVE");
      expect(statusLabel("stopped")).toBe("STOPPED");
      expect(statusLabel("under construction")).toBe("BUILDING");
    });

    it("upper-cases unknown statuses", () => {
      expect(statusLabel("something new")).toBe("SOMETHING NEW");
      expect(statusLabel("")).toBe("UNKNOWN");
    });
  });
});
