import { describe, it, expect } from "vitest";
import type { CountryData, WorldBackbone } from "../lib/types";
import {
  classifyRisk,
  riskColor,
  riskLabel,
  buildProfile,
  buildRanking,
  compareCountries,
  searchProfiles,
  exportRankingCSV,
  CORRUPTION_INDICATORS,
} from "../lib/corruption-radar";

/* ═══════════════════════════════════════════════════════════════
   Test fixtures
   ═══════════════════════════════════════════════════════════════ */

function mockCountry(overrides: Partial<CountryData> = {}): CountryData {
  return {
    iso3: "TST",
    name_en: "Test Country",
    region: "Test Region",
    is_hotspot: false,
    governance: {
      electoral_democracy_index: 0.5,
      democracy_year: 2020,
      corruption_perceptions_index: 50,
      cpi_year: 2020,
      political_corruption_index: null,
      political_corruption_year: 0,
      wgi_composite: 60,
      wgi_composite_year: 2022,
      control_of_corruption_score: 55,
      government_effectiveness_score: 62,
      political_stability_score: 48,
      regulatory_quality_score: 65,
      rule_of_law_score: 58,
      voice_and_accountability_score: 72,
    },
    ...overrides,
  } as CountryData;
}

function mockData(countries: CountryData[]): WorldBackbone {
  return {
    countries,
    metadata: { total_countries: countries.length },
  } as unknown as WorldBackbone;
}

/* ═══════════════════════════════════════════════════════════════
   classifyRisk
   ═══════════════════════════════════════════════════════════════ */

describe("classifyRisk", () => {
  it("classifies scores correctly", () => {
    expect(classifyRisk(80)).toBe("low");
    expect(classifyRisk(75)).toBe("low");
    expect(classifyRisk(60)).toBe("moderate");
    expect(classifyRisk(50)).toBe("moderate");
    expect(classifyRisk(40)).toBe("high");
    expect(classifyRisk(30)).toBe("high");
    expect(classifyRisk(20)).toBe("severe");
    expect(classifyRisk(null)).toBe("severe");
  });
});

describe("riskColor", () => {
  it("returns a color for each level", () => {
    expect(riskColor("low")).toBeTruthy();
    expect(riskColor("moderate")).toBeTruthy();
    expect(riskColor("high")).toBeTruthy();
    expect(riskColor("severe")).toBeTruthy();
  });
});

describe("riskLabel", () => {
  it("returns a label for each level", () => {
    expect(riskLabel("low")).toContain("Low");
    expect(riskLabel("severe")).toContain("Severe");
  });
});

/* ═══════════════════════════════════════════════════════════════
   buildProfile
   ═══════════════════════════════════════════════════════════════ */

describe("buildProfile", () => {
  it("builds a complete profile", () => {
    const country = mockCountry();
    const profile = buildProfile(country);
    expect(profile.iso3).toBe("TST");
    expect(profile.name).toBe("Test Country");
    expect(profile.compositeScore).toBe(60);
    expect(profile.riskLevel).toBe("moderate");
    expect(profile.dataYear).toBe(2022);
    expect(profile.indicators.wgi_composite).toBe(60);
    expect(profile.indicators.control_of_corruption).toBe(55);
  });

  it("handles countries with no governance data", () => {
    const country = mockCountry({
      governance: {
        electoral_democracy_index: null,
        democracy_year: 0,
        corruption_perceptions_index: null,
        cpi_year: 0,
        political_corruption_index: null,
        political_corruption_year: 0,
      },
    });
    const profile = buildProfile(country);
    expect(profile.compositeScore).toBeNull();
    expect(profile.riskLevel).toBe("severe");
  });

  it("falls back to CPI when WGI is missing", () => {
    const country = mockCountry({
      governance: {
        electoral_democracy_index: null,
        democracy_year: 0,
        corruption_perceptions_index: 45,
        cpi_year: 2021,
        political_corruption_index: null,
        political_corruption_year: 0,
      },
    });
    const profile = buildProfile(country);
    expect(profile.indicators.control_of_corruption).toBe(45);
  });
});

/* ═══════════════════════════════════════════════════════════════
   buildRanking
   ═══════════════════════════════════════════════════════════════ */

describe("buildRanking", () => {
  it("ranks countries by composite score", () => {
    const data = mockData([
      mockCountry({ iso3: "AAA", name_en: "Country A", governance: { ...mockCountry().governance, wgi_composite: 80 } }),
      mockCountry({ iso3: "BBB", name_en: "Country B", governance: { ...mockCountry().governance, wgi_composite: 30 } }),
      mockCountry({ iso3: "CCC", name_en: "Country C", governance: { ...mockCountry().governance, wgi_composite: 60 } }),
    ]);
    const ranking = buildRanking(data);
    expect(ranking.profiles[0].iso3).toBe("AAA");
    expect(ranking.profiles[1].iso3).toBe("CCC");
    expect(ranking.profiles[2].iso3).toBe("BBB");
    expect(ranking.profiles[0].rank).toBe(1);
  });

  it("computes percentiles", () => {
    const data = mockData([
      mockCountry({ iso3: "AAA", governance: { ...mockCountry().governance, wgi_composite: 90 } }),
      mockCountry({ iso3: "BBB", governance: { ...mockCountry().governance, wgi_composite: 10 } }),
    ]);
    const ranking = buildRanking(data);
    expect(ranking.profiles[0].percentile).toBe(100);
    expect(ranking.profiles[1].percentile).toBe(50);
  });

  it("counts by risk level", () => {
    const data = mockData([
      mockCountry({ iso3: "AAA", governance: { ...mockCountry().governance, wgi_composite: 85 } }),
      mockCountry({ iso3: "BBB", governance: { ...mockCountry().governance, wgi_composite: 40 } }),
      mockCountry({ iso3: "CCC", governance: { ...mockCountry().governance, wgi_composite: 15 } }),
    ]);
    const ranking = buildRanking(data);
    expect(ranking.byRiskLevel.low).toBe(1);
    expect(ranking.byRiskLevel.high).toBe(1);
    expect(ranking.byRiskLevel.severe).toBe(1);
  });

  it("computes regional averages", () => {
    const data = mockData([
      mockCountry({ iso3: "AAA", region: "Europe", governance: { ...mockCountry().governance, wgi_composite: 80 } }),
      mockCountry({ iso3: "BBB", region: "Europe", governance: { ...mockCountry().governance, wgi_composite: 60 } }),
      mockCountry({ iso3: "CCC", region: "Africa", governance: { ...mockCountry().governance, wgi_composite: 30 } }),
    ]);
    const ranking = buildRanking(data);
    const europe = ranking.byRegion.find((r) => r.region === "Europe");
    const africa = ranking.byRegion.find((r) => r.region === "Africa");
    expect(europe?.averageScore).toBe(70);
    expect(africa?.averageScore).toBe(30);
  });

  it("computes average and median", () => {
    const data = mockData([
      mockCountry({ iso3: "AAA", governance: { ...mockCountry().governance, wgi_composite: 60 } }),
      mockCountry({ iso3: "BBB", governance: { ...mockCountry().governance, wgi_composite: 40 } }),
    ]);
    const ranking = buildRanking(data);
    expect(ranking.averageScore).toBeCloseTo(50, 0);
    expect(ranking.medianScore).toBeGreaterThanOrEqual(40);
    expect(ranking.medianScore).toBeLessThanOrEqual(60);
  });
});

/* ═══════════════════════════════════════════════════════════════
   compareCountries
   ═══════════════════════════════════════════════════════════════ */

describe("compareCountries", () => {
  it("compares two countries", () => {
    const a = mockCountry({ iso3: "AAA", name_en: "Country A", governance: { ...mockCountry().governance, wgi_composite: 80 } });
    const b = mockCountry({ iso3: "BBB", name_en: "Country B", governance: { ...mockCountry().governance, wgi_composite: 40 } });
    const comparison = compareCountries(a, b);
    expect(comparison.countryA.iso3).toBe("AAA");
    expect(comparison.countryB.iso3).toBe("BBB");
    expect(comparison.differences.length).toBe(CORRUPTION_INDICATORS.length);
  });

  it("identifies which country is better", () => {
    const a = mockCountry({ iso3: "AAA", name_en: "Country A", governance: { ...mockCountry().governance, wgi_composite: 90, control_of_corruption_score: 90 } });
    const b = mockCountry({ iso3: "BBB", name_en: "Country B", governance: { ...mockCountry().governance, wgi_composite: 20, control_of_corruption_score: 20 } });
    const comparison = compareCountries(a, b);
    expect(comparison.summary).toContain("Country A");
  });
});

/* ═══════════════════════════════════════════════════════════════
   searchProfiles
   ═══════════════════════════════════════════════════════════════ */

describe("searchProfiles", () => {
  it("filters by query", () => {
    const data = mockData([
      mockCountry({ iso3: "USA", name_en: "United States", governance: { ...mockCountry().governance, wgi_composite: 70 } }),
      mockCountry({ iso3: "BRA", name_en: "Brazil", governance: { ...mockCountry().governance, wgi_composite: 45 } }),
    ]);
    const ranking = buildRanking(data);
    const results = searchProfiles(ranking, { query: "braz" });
    expect(results).toHaveLength(1);
    expect(results[0].iso3).toBe("BRA");
  });

  it("filters by risk level", () => {
    const data = mockData([
      mockCountry({ iso3: "AAA", governance: { ...mockCountry().governance, wgi_composite: 80 } }),
      mockCountry({ iso3: "BBB", governance: { ...mockCountry().governance, wgi_composite: 20 } }),
    ]);
    const ranking = buildRanking(data);
    const severe = searchProfiles(ranking, { riskLevel: "severe" });
    expect(severe).toHaveLength(1);
    expect(severe[0].iso3).toBe("BBB");
  });

  it("filters by score range", () => {
    const data = mockData([
      mockCountry({ iso3: "AAA", governance: { ...mockCountry().governance, wgi_composite: 80 } }),
      mockCountry({ iso3: "BBB", governance: { ...mockCountry().governance, wgi_composite: 50 } }),
      mockCountry({ iso3: "CCC", governance: { ...mockCountry().governance, wgi_composite: 20 } }),
    ]);
    const ranking = buildRanking(data);
    const mid = searchProfiles(ranking, { minScore: 40, maxScore: 60 });
    expect(mid).toHaveLength(1);
    expect(mid[0].iso3).toBe("BBB");
  });
});

/* ═══════════════════════════════════════════════════════════════
   exportRankingCSV
   ═══════════════════════════════════════════════════════════════ */

describe("exportRankingCSV", () => {
  it("generates valid CSV", () => {
    const data = mockData([
      mockCountry({ iso3: "AAA", name_en: "Country A", governance: { ...mockCountry().governance, wgi_composite: 80 } }),
      mockCountry({ iso3: "BBB", name_en: "Country B", governance: { ...mockCountry().governance, wgi_composite: 40 } }),
    ]);
    const ranking = buildRanking(data);
    const csv = exportRankingCSV(ranking);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Rank");
    expect(lines[0]).toContain("Composite");
    expect(lines.length).toBe(3); // header + 2 countries
  });

  it("quotes country names", () => {
    const data = mockData([
      mockCountry({ iso3: "AAA", name_en: "Country, Special", governance: { ...mockCountry().governance, wgi_composite: 80 } }),
    ]);
    const ranking = buildRanking(data);
    const csv = exportRankingCSV(ranking);
    expect(csv).toContain('"Country, Special"');
  });
});
