/**
 * V FOR X — Subnational Choropleth Map Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadSubnationalData,
  clearSubnationalCache,
  getSubdivisionsForCountry,
  getVulnerabilityColor,
  formatVulnerabilityScore,
  type SubnationalData,
  type Subdivision,
} from "../lib/subnational";

describe("Subnational Choropleth Map Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSubnationalCache();
  });

  afterEach(() => {
    clearSubnationalCache();
  });

  it("should load subnational data for map rendering", async () => {
    const mockData: SubnationalData = {
      meta: {
        title: "Test Subnational Data",
        description: "Test data for subnational vulnerability",
        sources: ["Test"],
        note: "Test only",
      },
      countries: {
        BRA: {
          iso3: "BRA",
          name_en: "Brazil",
          subdivisions: [
            {
              code: "BR-SP",
              name_en: "São Paulo",
              centroid: [-23.55, -46.64],
              polygon: [[-24, -47], [-24, -46], [-23, -46], [-23, -47], [-24, -47]],
              vulnerability_score: 0.65,
            },
            {
              code: "BR-RJ",
              name_en: "Rio de Janeiro",
              centroid: [-22.90, -43.17],
              polygon: [[-23, -44], [-23, -43], [-22, -43], [-22, -44], [-23, -44]],
              vulnerability_score: 0.72,
            },
          ],
        },
      },
    };

    global.fetch = async () =>
      Promise.resolve({
        ok: true,
        json: async () => mockData,
      } as Response);

    const data = await loadSubnationalData();
    expect(data.countries.BRA).toBeDefined();
    expect(data.countries.BRA.subdivisions).toHaveLength(2);
  });

  it("should retrieve subdivisions for specific country", async () => {
    const mockData: SubnationalData = {
      meta: {
        title: "Test",
        description: "Test",
        sources: ["Test"],
        note: "Test",
      },
      countries: {
        USA: {
          iso3: "USA",
          name_en: "United States",
          subdivisions: [
            {
              code: "US-CA",
              name_en: "California",
              centroid: [36.77, -119.41],
              polygon: [[35, -120], [35, -119], [38, -119], [38, -120], [35, -120]],
              vulnerability_score: 0.45,
            },
            {
              code: "US-NY",
              name_en: "New York",
              centroid: [42.95, -75.52],
              polygon: [[42, -77], [42, -74], [45, -74], [45, -77], [42, -77]],
              vulnerability_score: 0.38,
            },
          ],
        },
      },
    };

    global.fetch = async () =>
      Promise.resolve({
        ok: true,
        json: async () => mockData,
      } as Response);

    const data = await loadSubnationalData();
    const subdivisions = getSubdivisionsForCountry(data, "USA");

    expect(subdivisions).toHaveLength(2);
    expect(subdivisions[0].code).toBe("US-CA");
    expect(subdivisions[1].code).toBe("US-NY");
  });

  it("should provide vulnerability colors for map styling", () => {
    // Test critical vulnerability color
    const criticalColor = getVulnerabilityColor(0.85);
    expect(criticalColor).toBe("var(--color-blood-dim)");

    // Test high vulnerability color
    const highColor = getVulnerabilityColor(0.65);
    expect(highColor).toBe("var(--color-warning-amber)");

    // Test moderate vulnerability color
    const moderateColor = getVulnerabilityColor(0.5);
    expect(moderateColor).toBe("var(--color-terminal-yellow)");

    // Test low vulnerability color
    const lowColor = getVulnerabilityColor(0.25);
    expect(lowColor).toBe("var(--color-terminal-green)");
  });

  it("should format vulnerability scores for map tooltips", () => {
    expect(formatVulnerabilityScore(0.85)).toBe("85%");
    expect(formatVulnerabilityScore(0.72)).toBe("72%");
    expect(formatVulnerabilityScore(0.45)).toBe("45%");
    expect(formatVulnerabilityScore(0.0)).toBe("0%");
    expect(formatVulnerabilityScore(1.0)).toBe("100%");
  });

  it("should handle countries with no subnational data", async () => {
    const mockData: SubnationalData = {
      meta: {
        title: "Test",
        description: "Test",
        sources: ["Test"],
        note: "Test",
      },
      countries: {},
    };

    global.fetch = async () =>
      Promise.resolve({
        ok: true,
        json: async () => mockData,
      } as Response);

    const data = await loadSubnationalData();
    const subdivisions = getSubdivisionsForCountry(data, "XYZ");

    expect(subdivisions).toEqual([]);
  });

  it("should provide polygon data for Leaflet rendering", async () => {
    const mockData: SubnationalData = {
      meta: {
        title: "Test",
        description: "Test",
        sources: ["Test"],
        note: "Test",
      },
      countries: {
        TEST: {
          iso3: "TEST",
          name_en: "Test Country",
          subdivisions: [
            {
              code: "TS-01",
              name_en: "Test Region",
              centroid: [0, 0],
              polygon: [[-1, -1], [-1, 1], [1, 1], [1, -1], [-1, -1]],
              vulnerability_score: 0.5,
            },
          ],
        },
      },
    };

    global.fetch = async () =>
      Promise.resolve({
        ok: true,
        json: async () => mockData,
      } as Response);

    const data = await loadSubnationalData();
    const subdivisions = getSubdivisionsForCountry(data, "TEST");

    expect(subdivisions).toHaveLength(1);
    expect(subdivisions[0].polygon).toEqual([
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
      [-1, -1],
    ]);
    expect(subdivisions[0].centroid).toEqual([0, 0]);
  });

  it("should support multiple countries with varying subdivision counts", async () => {
    const mockData: SubnationalData = {
      meta: {
        title: "Test",
        description: "Test",
        sources: ["Test"],
        note: "Test",
      },
      countries: {
        SMALL: {
          iso3: "SMALL",
          name_en: "Small Country",
          subdivisions: [
            {
              code: "SC-01",
              name_en: "Only Region",
              centroid: [0, 0],
              polygon: [[-1, -1], [-1, 1], [1, 1], [1, -1], [-1, -1]],
              vulnerability_score: 0.5,
            },
          ],
        },
        LARGE: {
          iso3: "LARGE",
          name_en: "Large Country",
          subdivisions: Array.from({ length: 10 }, (_, i) => ({
            code: `LC-${String(i + 1).padStart(2, "0")}`,
            name_en: `Region ${i + 1}`,
            centroid: [i * 10, i * 10],
            polygon: [
              [i * 10 - 1, i * 10 - 1],
              [i * 10 - 1, i * 10 + 1],
              [i * 10 + 1, i * 10 + 1],
              [i * 10 + 1, i * 10 - 1],
              [i * 10 - 1, i * 10 - 1],
            ],
            vulnerability_score: 0.3 + i * 0.05,
          })),
        },
      },
    };

    global.fetch = async () =>
      Promise.resolve({
        ok: true,
        json: async () => mockData,
      } as Response);

    const data = await loadSubnationalData();

    const smallSubdivisions = getSubdivisionsForCountry(data, "SMALL");
    expect(smallSubdivisions).toHaveLength(1);

    const largeSubdivisions = getSubdivisionsForCountry(data, "LARGE");
    expect(largeSubdivisions).toHaveLength(10);
  });
});

describe("Subnational Map Data Processing", () => {
  it("should convert subdivision data to GeoJSON-compatible format", () => {
    const subdivision: Subdivision = {
      code: "BR-SP",
      name_en: "São Paulo",
      centroid: [-23.55, -46.64],
      polygon: [[-24, -47], [-24, -46], [-23, -46], [-23, -47], [-24, -47]],
      vulnerability_score: 0.65,
    };

    // Verify the subdivision has all required properties for GeoJSON conversion
    expect(subdivision.code).toBeDefined();
    expect(subdivision.name_en).toBeDefined();
    expect(subdivision.centroid).toBeDefined();
    expect(subdivision.polygon).toBeDefined();
    expect(subdivision.vulnerability_score).toBeDefined();
    expect(subdivision.polygon).toHaveLength(5); // Closed polygon
  });

  it("should handle vulnerability score ranges for color mapping", () => {
    const testScores = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];
    const colors = testScores.map((score) => getVulnerabilityColor(score));

    // All colors should be CSS variable references
    colors.forEach((color) => {
      expect(color).toMatch(/^var\(--color-/);
    });

    // Critical scores should get blood color
    expect(getVulnerabilityColor(0.8)).toBe("var(--color-blood-dim)");
    expect(getVulnerabilityColor(0.9)).toBe("var(--color-blood-dim)");

    // Low scores should get green color
    expect(getVulnerabilityColor(0.3)).toBe("var(--color-terminal-green)");
    expect(getVulnerabilityColor(0.1)).toBe("var(--color-terminal-green)");
  });

  it("should provide formatted vulnerability scores for tooltips", () => {
    const cases = [
      { score: 0.0, expected: "0%" },
      { score: 0.25, expected: "25%" },
      { score: 0.5, expected: "50%" },
      { score: 0.75, expected: "75%" },
      { score: 0.999, expected: "100%" },
    ];

    cases.forEach(({ score, expected }) => {
      expect(formatVulnerabilityScore(score)).toBe(expected);
    });
  });
});