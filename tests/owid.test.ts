import { describe, it, expect } from "vitest";
import type { OWIDDataset, OWIDIndexEntry } from "../lib/owid";
import {
  getLatestValue,
  getTimeSeries,
  getAllLatest,
  getRanking,
  compareCountries,
  summarizeDataset,
  toLineChartData,
  toBarChartData,
} from "../lib/owid";

/* ═══════════════════════════════════════════════════════════════
   Test fixtures
   ═══════════════════════════════════════════════════════════════ */

function mockDataset(): OWIDDataset {
  return {
    slug: "test-dataset",
    entities: {
      USA: {
        name: "United States",
        code: "USA",
        years: { "2018": 78.5, "2019": 78.8, "2020": 77.0, "2021": 76.1 },
      },
      BRA: {
        name: "Brazil",
        code: "BRA",
        years: { "2018": 75.5, "2019": 75.9, "2020": 74.0, "2021": 73.2 },
      },
      JPN: {
        name: "Japan",
        code: "JPN",
        years: { "2018": 84.2, "2019": 84.5, "2020": 84.6, "2021": 84.5 },
      },
    },
    latest: { USA: 76.1, BRA: 73.2, JPN: 84.5 },
    min_year: 2018,
    max_year: 2021,
    data_columns: ["Life expectancy"],
  };
}

function mockEntry(): OWIDIndexEntry {
  return {
    slug: "test-dataset",
    category: "health",
    label: "Life Expectancy",
    description: "Test dataset",
    source: "Test Source",
    entities: 3,
    min_year: 2018,
    max_year: 2021,
    data_columns: ["Life expectancy"],
  };
}

/* ═══════════════════════════════════════════════════════════════
   getLatestValue
   ═══════════════════════════════════════════════════════════════ */

describe("getLatestValue", () => {
  it("returns the most recent value", () => {
    const ds = mockDataset();
    const result = getLatestValue(ds, "USA");
    expect(result).not.toBeNull();
    expect(result!.value).toBe(76.1);
    expect(result!.year).toBe(2021);
  });

  it("returns null for unknown entity", () => {
    const ds = mockDataset();
    expect(getLatestValue(ds, "ZZZ")).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════
   getTimeSeries
   ═══════════════════════════════════════════════════════════════ */

describe("getTimeSeries", () => {
  it("returns sorted time series", () => {
    const ds = mockDataset();
    const ts = getTimeSeries(ds, "USA");
    expect(ts).not.toBeNull();
    expect(ts!.points.length).toBe(4);
    expect(ts!.points[0].year).toBe(2018);
    expect(ts!.points[3].year).toBe(2021);
  });

  it("returns null for unknown entity", () => {
    const ds = mockDataset();
    expect(getTimeSeries(ds, "ZZZ")).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════
   getAllLatest
   ═══════════════════════════════════════════════════════════════ */

describe("getAllLatest", () => {
  it("returns all countries sorted by value descending", () => {
    const ds = mockDataset();
    const all = getAllLatest(ds);
    expect(all.length).toBe(3);
    expect(all[0].iso3).toBe("JPN");
    expect(all[0].value).toBe(84.5);
    expect(all[2].iso3).toBe("BRA");
  });
});

/* ═══════════════════════════════════════════════════════════════
   getRanking
   ═══════════════════════════════════════════════════════════════ */

describe("getRanking", () => {
  it("returns top N for higher_better", () => {
    const ds = mockDataset();
    const ranking = getRanking(ds, "higher_better", 2);
    expect(ranking.length).toBe(2);
    expect(ranking[0].iso3).toBe("JPN");
  });

  it("reverses for lower_better", () => {
    const ds = mockDataset();
    const ranking = getRanking(ds, "lower_better", 2);
    expect(ranking[0].iso3).toBe("BRA");
  });

  it("returns all when no limit", () => {
    const ds = mockDataset();
    const ranking = getRanking(ds, "higher_better");
    expect(ranking.length).toBe(3);
  });
});

/* ═══════════════════════════════════════════════════════════════
   compareCountries
   ═══════════════════════════════════════════════════════════════ */

describe("compareCountries", () => {
  it("returns time series for each country", () => {
    const ds = mockDataset();
    const series = compareCountries(ds, ["USA", "BRA"]);
    expect(series.length).toBe(2);
  });

  it("skips unknown countries", () => {
    const ds = mockDataset();
    const series = compareCountries(ds, ["USA", "ZZZ"]);
    expect(series.length).toBe(1);
  });
});

/* ═══════════════════════════════════════════════════════════════
   summarizeDataset
   ═══════════════════════════════════════════════════════════════ */

describe("summarizeDataset", () => {
  it("computes summary statistics", () => {
    const ds = mockDataset();
    const summary = summarizeDataset(ds, mockEntry());
    expect(summary.total).toBe(3);
    expect(summary.max).toBe(84.5);
    expect(summary.min).toBe(73.2);
    expect(summary.latestYear).toBe(2021);
  });

  it("handles empty datasets", () => {
    const empty: OWIDDataset = {
      slug: "empty",
      entities: {},
      latest: {},
      min_year: null,
      max_year: null,
      data_columns: [],
    };
    const summary = summarizeDataset(empty, mockEntry());
    expect(summary.total).toBe(0);
    expect(summary.mean).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Chart helpers
   ═══════════════════════════════════════════════════════════════ */

describe("toLineChartData", () => {
  it("produces data points for all years", () => {
    const ds = mockDataset();
    const data = toLineChartData(ds, ["USA", "BRA"]);
    expect(data.length).toBe(4); // 4 years
    expect(data[0]).toHaveProperty("year");
    expect(data[0]).toHaveProperty("USA");
    expect(data[0]).toHaveProperty("BRA");
  });

  it("handles missing countries gracefully", () => {
    const ds = mockDataset();
    const data = toLineChartData(ds, ["USA", "ZZZ"]);
    expect(data.length).toBe(4);
    expect(data[0]).toHaveProperty("USA");
    expect(data[0]).not.toHaveProperty("ZZZ");
  });
});

describe("toBarChartData", () => {
  it("returns top N countries", () => {
    const ds = mockDataset();
    const data = toBarChartData(ds, 2, "higher_better");
    expect(data.length).toBe(2);
    expect(data[0].iso3).toBe("JPN");
  });

  it("rounds values to 2 decimals", () => {
    const ds: OWIDDataset = {
      ...mockDataset(),
      entities: {
        AAA: {
          name: "Country A",
          code: "AAA",
          years: { "2020": 42.56789 },
        },
      },
    };
    const data = toBarChartData(ds, 1);
    expect(data[0].value).toBe(42.57);
  });
});
