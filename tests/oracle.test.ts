import { describe, it, expect } from "vitest";
import {
  METRICS,
  parseQuery,
  executeQuery,
  computeAverage,
  militaryVsHealth,
} from "../lib/oracle";
import { crisisCountry, stableCountry } from "./fixtures/countries";

const countries = [crisisCountry, stableCountry];

describe("oracle — METRICS registry", () => {
  it("has unique ids and non-empty keywords for every metric", () => {
    const ids = METRICS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of METRICS) {
      expect(m.label).toBeTruthy();
      expect(m.keywords.length).toBeGreaterThan(0);
      expect(typeof m.extract).toBe("function");
    }
  });

  it("covers the key crisis dimensions", () => {
    const ids = new Set(METRICS.map((m) => m.id));
    for (const id of ["undernourishment", "child_mortality", "conflict_intensity", "gini", "homicide", "displacement"]) {
      expect(ids.has(id)).toBe(true);
    }
  });
});

describe("oracle — parseQuery", () => {
  it("parses top-N queries with metric + limit", () => {
    const q = parseQuery("Top 10 countries by military spending");
    expect(q).not.toBeNull();
    expect(q!.metric.id).toBe("military_spending");
    expect(q!.comparator).toBe("top");
    expect(q!.limit).toBe(10);
  });

  it("parses threshold queries with > and <", () => {
    const gt = parseQuery("Countries where child mortality > 50");
    expect(gt!.metric.id).toBe("child_mortality");
    expect(gt!.comparator).toBe("gt");
    expect(gt!.threshold).toBe(50);

    const lt = parseQuery("Countries where literacy < 60%");
    expect(lt!.metric.id).toBe("literacy");
    expect(lt!.comparator).toBe("lt");
    expect(lt!.threshold).toBe(60);
  });

  it("detects region qualifiers", () => {
    const q = parseQuery("Top 5 countries by hunger in Africa");
    expect(q!.metric.id).toBe("undernourishment");
    expect(q!.region).toBe("Africa");
    expect(q!.limit).toBe(5);
  });

  it("returns null for unrecognized queries", () => {
    expect(parseQuery("what is the meaning of life")).toBeNull();
  });

  it("defaults top limit to 10", () => {
    const q = parseQuery("countries by gini");
    expect(q!.comparator).toBe("top");
    expect(q!.limit).toBe(10);
  });
});

describe("oracle — executeQuery", () => {
  it("ranks descending for top and returns ranks", () => {
    const parsed = parseQuery("Top countries by gini")!;
    const results = executeQuery(parsed, countries);
    expect(results).toHaveLength(2);
    expect(results[0].country.iso3).toBe("TEST");
    expect(results[0].rank).toBe(1);
    expect(results[1].rank).toBe(2);
  });

  it("ranks ascending for bottom", () => {
    const parsed = parseQuery("Bottom countries by gini")!;
    const results = executeQuery(parsed, countries);
    expect(results[0].country.iso3).toBe("STBL");
  });

  it("filters with > threshold", () => {
    const parsed = parseQuery("countries where child mortality > 50")!;
    const results = executeQuery(parsed, countries);
    expect(results.map((r) => r.country.iso3)).toEqual(["TEST"]);
  });

  it("filters with < threshold", () => {
    const parsed = parseQuery("countries where child mortality < 50")!;
    const results = executeQuery(parsed, countries);
    expect(results.map((r) => r.country.iso3)).toEqual(["STBL"]);
  });

  it("returns the single max/min country", () => {
    const max = executeQuery(parseQuery("country with highest gini")!, countries);
    expect(max).toHaveLength(1);
    expect(max[0].country.iso3).toBe("TEST");

    const min = executeQuery(parseQuery("country with lowest gini")!, countries);
    expect(min[0].country.iso3).toBe("STBL");
  });

  it("applies region filtering", () => {
    const inAfrica = executeQuery(parseQuery("Top countries by gini in Africa")!, countries);
    expect(inAfrica).toHaveLength(2);
    const inAsia = executeQuery(parseQuery("Top countries by gini in Asia")!, countries);
    expect(inAsia).toHaveLength(0);
  });

  it("skips countries with null metric values", () => {
    const withNull = {
      ...stableCountry,
      inequality: { gini: null, year: 2022, gini_year: 2022 },
    };
    const parsed = parseQuery("Top countries by gini")!;
    const results = executeQuery(parsed, [crisisCountry, withNull]);
    expect(results).toHaveLength(1);
    expect(results[0].country.iso3).toBe("TEST");
  });
});

describe("oracle — computeAverage", () => {
  it("computes the mean over results", () => {
    const parsed = parseQuery("average gini")!;
    const results = executeQuery(parsed, countries);
    const avg = computeAverage(results);
    expect(avg).toBeCloseTo((60 + 27) / 2, 5);
  });

  it("returns 0 for an empty set", () => {
    expect(computeAverage([])).toBe(0);
  });
});

describe("oracle — militaryVsHealth", () => {
  it("returns only countries spending more on military than health, ranked by ratio", () => {
    const results = militaryVsHealth(countries);
    expect(results).toHaveLength(1);
    expect(results[0].country.iso3).toBe("TEST");
    expect(results[0].value).toBeGreaterThan(1);
    expect(results[0].rank).toBe(1);
  });
});
