import { describe, it, expect } from "vitest";
import { computeDiff, TRACKED_METRICS } from "../lib/diff";

/**
 * Minimal mock backbone shape:
 *   { metadata: { created, total_countries }, countries: [{ iso3, name_en?, ...nested }] }
 * Countries are keyed by `iso3`; nested objects match the dotted metric paths
 * (e.g. "hunger.undernourishment_pct").
 */
interface MockCountry {
  iso3: string;
  name_en?: string;
  [key: string]: unknown;
}

interface MockBackbone {
  metadata: { created: string; total_countries: number };
  countries: MockCountry[];
}

function makeBackbone(countries: MockCountry[], date = "2026-01-01"): MockBackbone {
  return { metadata: { created: date, total_countries: countries.length }, countries };
}

describe("diff.ts", () => {
  describe("TRACKED_METRICS", () => {
    it("should be a non-empty array of metric definitions", () => {
      expect(Array.isArray(TRACKED_METRICS)).toBe(true);
      expect(TRACKED_METRICS.length).toBeGreaterThan(0);
    });

    it("each metric should have a dotted path and a non-empty label", () => {
      for (const m of TRACKED_METRICS) {
        expect(typeof m.path).toBe("string");
        expect(m.path).toContain(".");
        expect(typeof m.label).toBe("string");
        expect(m.label.length).toBeGreaterThan(0);
      }
    });

    it("paths should be unique", () => {
      const paths = TRACKED_METRICS.map((m) => m.path);
      expect(new Set(paths).size).toBe(paths.length);
    });
  });

  describe("computeDiff — identical backbones", () => {
    const country: MockCountry = {
      iso3: "IDN",
      name_en: "Identica",
      hunger: { undernourishment_pct: 12 },
      education: { literacy_rate_pct: 70 },
    };
    const result = computeDiff(makeBackbone([country]), makeBackbone([country]));

    it("should report zero total changes", () => {
      expect(result.totalChanges).toBe(0);
    });

    it("should report zero worsened and zero improved", () => {
      expect(result.worsened).toBe(0);
      expect(result.improved).toBe(0);
    });

    it("should report no new or removed countries", () => {
      expect(result.newCountries).toHaveLength(0);
      expect(result.removedCountries).toHaveLength(0);
    });

    it("should produce empty changes / topChanges / thresholdCrossings", () => {
      expect(result.changes).toHaveLength(0);
      expect(result.topChanges).toHaveLength(0);
      expect(result.thresholdCrossings).toHaveLength(0);
    });
  });

  describe("computeDiff — worsened metric (higherIsWorse)", () => {
    // undernourishment_pct has higherIsWorse: true, thresholds [10,20,40]
    const result = computeDiff(
      makeBackbone([{ iso3: "WOR", name_en: "Worsenia", hunger: { undernourishment_pct: 10 } }]),
      makeBackbone([{ iso3: "WOR", name_en: "Worsenia", hunger: { undernourishment_pct: 25 } }]),
    );
    const change = result.changes.find((c) => c.path === "hunger.undernourishment_pct");

    it("should detect exactly one change", () => {
      expect(result.totalChanges).toBe(1);
      expect(change).toBeDefined();
    });

    it("should classify the increase as direction 'worse'", () => {
      expect(change!.direction).toBe("worse");
    });

    it("should compute delta and pctChange", () => {
      expect(change!.oldValue).toBe(10);
      expect(change!.newValue).toBe(25);
      expect(change!.delta).toBe(15);
      expect(change!.pctChange).toBeCloseTo(150, 0);
    });

    it("should count it as worsened, not improved", () => {
      expect(result.worsened).toBe(1);
      expect(result.improved).toBe(0);
    });
  });

  describe("computeDiff — improved metric (higher = better)", () => {
    // literacy_rate_pct is a "good" metric: an increase is an improvement
    const result = computeDiff(
      makeBackbone([{ iso3: "IMP", name_en: "Improvia", education: { literacy_rate_pct: 50 } }]),
      makeBackbone([{ iso3: "IMP", name_en: "Improvia", education: { literacy_rate_pct: 80 } }]),
    );
    const change = result.changes.find((c) => c.path === "education.literacy_rate_pct");

    it("should detect exactly one change", () => {
      expect(result.totalChanges).toBe(1);
      expect(change).toBeDefined();
    });

    it("should classify the increase as direction 'better'", () => {
      expect(change!.direction).toBe("better");
    });

    it("should compute delta and pctChange", () => {
      expect(change!.oldValue).toBe(50);
      expect(change!.newValue).toBe(80);
      expect(change!.delta).toBe(30);
      expect(change!.pctChange).toBeCloseTo(60, 0);
    });

    it("should count it as improved, not worsened", () => {
      expect(result.improved).toBe(1);
      expect(result.worsened).toBe(0);
    });
  });

  describe("computeDiff — country added", () => {
    const result = computeDiff(
      makeBackbone([{ iso3: "OLD", name_en: "Oldland" }]),
      makeBackbone([
        { iso3: "OLD", name_en: "Oldland" },
        { iso3: "NEW", name_en: "Newland" },
      ]),
    );

    it("should list the new country with its name", () => {
      expect(result.newCountries).toHaveLength(1);
      expect(result.newCountries[0]).toEqual({ iso3: "NEW", countryName: "Newland" });
    });

    it("should report no removed countries", () => {
      expect(result.removedCountries).toHaveLength(0);
    });

    it("should not flag any metric changes", () => {
      expect(result.totalChanges).toBe(0);
    });
  });

  describe("computeDiff — country removed", () => {
    const result = computeDiff(
      makeBackbone([
        { iso3: "OLD", name_en: "Oldland" },
        { iso3: "GON", name_en: "Goneland" },
      ]),
      makeBackbone([{ iso3: "OLD", name_en: "Oldland" }]),
    );

    it("should list the removed country with its name", () => {
      expect(result.removedCountries).toHaveLength(1);
      expect(result.removedCountries[0]).toEqual({ iso3: "GON", countryName: "Goneland" });
    });

    it("should report no new countries", () => {
      expect(result.newCountries).toHaveLength(0);
    });

    it("should not flag any metric changes", () => {
      expect(result.totalChanges).toBe(0);
    });
  });

  describe("computeDiff — threshold crossing", () => {
    // famine_risk_1to5: higherIsWorse, thresholds [3,4,5]; 2 -> 4 crosses 3 and 4
    const result = computeDiff(
      makeBackbone([{ iso3: "FAM", name_en: "Faminea", hunger: { famine_risk_1to5: 2 } }]),
      makeBackbone([{ iso3: "FAM", name_en: "Faminea", hunger: { famine_risk_1to5: 4 } }]),
    );
    const crossing = result.thresholdCrossings.find((c) => c.path === "hunger.famine_risk_1to5");

    it("should detect a threshold crossing", () => {
      expect(result.thresholdCrossings).toHaveLength(1);
      expect(crossing).toBeDefined();
    });

    it("the crossing should carry the before/after values", () => {
      expect(crossing!.oldValue).toBe(2);
      expect(crossing!.newValue).toBe(4);
    });

    it("a change that stays within the same band should NOT be a crossing", () => {
      const within = computeDiff(
        makeBackbone([{ iso3: "WBN", name_en: "Withinia", hunger: { famine_risk_1to5: 4 } }]),
        makeBackbone([{ iso3: "WBN", name_en: "Withinia", hunger: { famine_risk_1to5: 4.5 } }]),
      );
      expect(within.thresholdCrossings).toHaveLength(0);
    });
  });

  describe("computeDiff — null transitions", () => {
    const nullToValue = computeDiff(
      // old country has no hunger data → undernourishment resolves to null
      makeBackbone([{ iso3: "NUL", name_en: "Nullandia" }]),
      makeBackbone([{ iso3: "NUL", name_en: "Nullandia", hunger: { undernourishment_pct: 15 } }]),
    );
    const valueToNull = computeDiff(
      makeBackbone([{ iso3: "NUL", name_en: "Nullandia", hunger: { undernourishment_pct: 15 } }]),
      makeBackbone([{ iso3: "NUL", name_en: "Nullandia" }]),
    );
    const added = nullToValue.changes.find((c) => c.path === "hunger.undernourishment_pct");
    const removed = valueToNull.changes.find((c) => c.path === "hunger.undernourishment_pct");

    it("null -> value should produce a change with null oldValue", () => {
      expect(added).toBeDefined();
      expect(added!.oldValue).toBeNull();
      expect(added!.newValue).toBe(15);
    });

    it("null -> value should have null delta/pctChange and neutral direction", () => {
      expect(added!.delta).toBeNull();
      expect(added!.pctChange).toBeNull();
      expect(added!.direction).toBe("neutral");
    });

    it("value -> null should produce a change with null newValue", () => {
      expect(removed).toBeDefined();
      expect(removed!.oldValue).toBe(15);
      expect(removed!.newValue).toBeNull();
    });

    it("value -> null should have null delta/pctChange and neutral direction", () => {
      expect(removed!.delta).toBeNull();
      expect(removed!.pctChange).toBeNull();
      expect(removed!.direction).toBe("neutral");
    });

    it("null transitions should never be threshold crossings", () => {
      expect(nullToValue.thresholdCrossings).toHaveLength(0);
      expect(valueToNull.thresholdCrossings).toHaveLength(0);
    });
  });

  describe("computeDiff — full DiffResult scenario", () => {
    // Two countries with different fields changed, plus one added and one removed.
    const usaOld: MockCountry = {
      iso3: "USA",
      name_en: "United States",
      hunger: { undernourishment_pct: 5 },
    };
    const usaNew: MockCountry = {
      iso3: "USA",
      name_en: "United States",
      hunger: { undernourishment_pct: 30 },
    };
    const zweOld: MockCountry = {
      iso3: "ZWE",
      name_en: "Zimbabwe",
      education: { literacy_rate_pct: 40 },
    };
    const zweNew: MockCountry = {
      iso3: "ZWE",
      name_en: "Zimbabwe",
      education: { literacy_rate_pct: 90 },
    };
    const oldCountry: MockCountry = { iso3: "OLD", name_en: "Oldland" };
    const newCountry: MockCountry = { iso3: "NEW", name_en: "Newland" };

    const result = computeDiff(
      makeBackbone([usaOld, zweOld, oldCountry], "2026-01-01"),
      makeBackbone([usaNew, zweNew, newCountry], "2026-02-01"),
    );

    it("should report totals: 2 changes, 1 worsened, 1 improved", () => {
      expect(result.totalChanges).toBe(2);
      expect(result.worsened).toBe(1);
      expect(result.improved).toBe(1);
    });

    it("should report the added and removed countries", () => {
      expect(result.newCountries).toEqual([{ iso3: "NEW", countryName: "Newland" }]);
      expect(result.removedCountries).toEqual([{ iso3: "OLD", countryName: "Oldland" }]);
    });

    it("changes should cover both countries' metrics", () => {
      const paths = result.changes.map((c) => c.path).sort();
      expect(paths).toEqual(["education.literacy_rate_pct", "hunger.undernourishment_pct"]);
    });

    it("topChanges should be sorted by severity then |pctChange| desc", () => {
      expect(result.topChanges).toHaveLength(2);
      // both critical; USA undernourishment 5->30 = 500% beats ZWE literacy 40->90 = 125%
      expect(result.topChanges[0].path).toBe("hunger.undernourishment_pct");
      expect(result.topChanges[0].severity).toBe("critical");
      expect(result.topChanges[1].path).toBe("education.literacy_rate_pct");
    });

    it("thresholdCrossings should include both metrics that crossed bands", () => {
      expect(result.thresholdCrossings).toHaveLength(2);
      const crossedPaths = result.thresholdCrossings.map((c) => c.path).sort();
      expect(crossedPaths).toEqual(["education.literacy_rate_pct", "hunger.undernourishment_pct"]);
    });

    it("summary should carry both dates and country counts", () => {
      expect(result.summary).toEqual({
        oldTotalCountries: 3,
        newTotalCountries: 3,
        oldDate: "2026-01-01",
        newDate: "2026-02-01",
      });
    });

    it("oldDate/newDate should mirror the backbone metadata", () => {
      expect(result.oldDate).toBe("2026-01-01");
      expect(result.newDate).toBe("2026-02-01");
    });
  });
});
