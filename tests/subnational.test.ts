/**
 * V FOR X — Subnational Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  loadSubnationalData,
  clearSubnationalCache,
  getSubdivisionsForCountry,
  getSubdivisionByCode,
  getCountriesWithData,
  getCountryName,
  getMostVulnerableRegions,
  getMostVulnerableInCountry,
  computeCountryVulnerabilityStats,
  getAllCountriesVulnerabilityStats,
  getRegionsByThreshold,
  getVulnerabilityLevel,
  getVulnerabilityColor,
  formatVulnerabilityScore,
  formatCentroid,
  polygonToBoundingBox,
  getVulnerabilityIcon,
  getVulnerabilityThresholds,
  type SubnationalData,
} from "../lib/subnational";

// Mock fetch
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
          code: "BR-AC",
          name_en: "Acre",
          centroid: [-9.02, -70.55],
          polygon: [
            [-10.42, -72.55],
            [-10.42, -68.55],
            [-7.62, -68.55],
            [-7.62, -72.55],
            [-10.42, -72.55],
          ],
          vulnerability_score: 0.72,
        },
        {
          code: "BR-SP",
          name_en: "São Paulo",
          centroid: [-23.55, -46.64],
          polygon: [
            [-24.95, -48.14],
            [-24.95, -45.14],
            [-22.15, -45.14],
            [-22.15, -48.14],
            [-24.95, -48.14],
          ],
          vulnerability_score: 0.45,
        },
        {
          code: "BR-DF",
          name_en: "Distrito Federal",
          centroid: [-15.79, -47.88],
          polygon: [
            [-17.19, -49.88],
            [-17.19, -45.88],
            [-14.39, -45.88],
            [-14.39, -49.88],
            [-17.19, -49.88],
          ],
          vulnerability_score: 0.20,
        },
      ],
    },
    COD: {
      iso3: "COD",
      name_en: "Democratic Republic of Congo",
      subdivisions: [
        {
          code: "CD-KN",
          name_en: "Kinshasa",
          centroid: [-4.44, 15.27],
          polygon: [
            [-5.84, 13.77],
            [-5.84, 16.77],
            [-3.04, 16.77],
            [-3.04, 13.77],
            [-5.84, 13.77],
          ],
          vulnerability_score: 0.85,
        },
        {
          code: "CD-BU",
          name_en: "Bas-Uele",
          centroid: [4.12, 25.23],
          polygon: [
            [2.72, 23.73],
            [2.72, 26.73],
            [5.52, 26.73],
            [5.52, 23.73],
            [2.72, 23.73],
          ],
          vulnerability_score: 0.68,
        },
      ],
    },
  },
};

describe("subnational.ts — Data Loading", () => {
  beforeEach(() => {
    clearSubnationalCache();
  });

  afterEach(() => {
    clearSubnationalCache();
  });

  it("should load subnational data", async () => {
    global.fetch = async () =>
      Promise.resolve({
        ok: true,
        json: async () => JSON.parse(JSON.stringify(mockData)),
      } as Response);

    const data = await loadSubnationalData();
    expect(data).toBeDefined();
    expect(Object.keys(data.countries)).toHaveLength(2);
    expect(data.countries.BRA).toBeDefined();
    expect(data.countries.COD).toBeDefined();
  });

  it("should cache data on subsequent calls", async () => {
    global.fetch = async () =>
      Promise.resolve({
        ok: true,
        json: async () => JSON.parse(JSON.stringify(mockData)),
      } as Response);

    const data1 = await loadSubnationalData();
    const data2 = await loadSubnationalData();
    expect(data1).toBe(data2);
  });

  it("should clear cache", async () => {
    let callCount = 0;
    global.fetch = async () => {
      callCount++;
      return Promise.resolve({
        ok: true,
        json: async () => {
          // Return new object each time to test cache clearing
          return JSON.parse(JSON.stringify(mockData));
        },
      } as Response);
    };

    const data1 = await loadSubnationalData();
    const initialCalls = callCount;
    clearSubnationalCache();
    const data2 = await loadSubnationalData();

    // Should have called fetch again after clearing cache
    expect(callCount).toBeGreaterThan(initialCalls);
    // Objects should be different references
    expect(data1).not.toBe(data2);
  });
});

describe("subnational.ts — Data Access", () => {
  beforeEach(() => {
    clearSubnationalCache();
    global.fetch = async () =>
      Promise.resolve({
        ok: true,
        json: async () => mockData,
      } as Response);
  });

  afterEach(() => {
    clearSubnationalCache();
  });

  it("should get subdivisions for a country", async () => {
    const data = await loadSubnationalData();
    const braSubdivisions = getSubdivisionsForCountry(data, "BRA");
    expect(braSubdivisions).toHaveLength(3);
    expect(braSubdivisions[0].code).toBe("BR-AC");
  });

  it("should return empty array for non-existent country", async () => {
    const data = await loadSubnationalData();
    const xyzSubdivisions = getSubdivisionsForCountry(data, "XYZ");
    expect(xyzSubdivisions).toHaveLength(0);
  });

  it("should get subdivision by code", async () => {
    const data = await loadSubnationalData();
    const subdivision = getSubdivisionByCode(data, "BRA", "BR-AC");
    expect(subdivision).toBeDefined();
    expect(subdivision?.name_en).toBe("Acre");
  });

  it("should return null for non-existent subdivision", async () => {
    const data = await loadSubnationalData();
    const subdivision = getSubdivisionByCode(data, "BRA", "BR-XX");
    expect(subdivision).toBeNull();
  });

  it("should get all countries with data", async () => {
    const data = await loadSubnationalData();
    const countries = getCountriesWithData(data);
    expect(countries).toHaveLength(2);
    expect(countries).toContain("BRA");
    expect(countries).toContain("COD");
  });

  it("should get country name", async () => {
    const data = await loadSubnationalData();
    const name = getCountryName(data, "BRA");
    expect(name).toBe("Brazil");
  });

  it("should return ISO3 for non-existent country name", async () => {
    const data = await loadSubnationalData();
    const name = getCountryName(data, "XYZ");
    expect(name).toBe("XYZ");
  });
});

describe("subnational.ts — Vulnerability Analysis", () => {
  beforeEach(() => {
    clearSubnationalCache();
    global.fetch = async () =>
      Promise.resolve({
        ok: true,
        json: async () => mockData,
      } as Response);
  });

  afterEach(() => {
    clearSubnationalCache();
  });

  it("should get most vulnerable regions across all countries", async () => {
    const data = await loadSubnationalData();
    const regions = getMostVulnerableRegions(data, 10);
    expect(regions).toHaveLength(5); // Total subdivisions in mock data
    expect(regions[0].subdivision_code).toBe("CD-KN"); // Highest score (0.85)
    expect(regions[0].vulnerability_score).toBe(0.85);
  });

  it("should sort most vulnerable regions by score descending", async () => {
    const data = await loadSubnationalData();
    const regions = getMostVulnerableRegions(data, 10);
    for (let i = 0; i < regions.length - 1; i++) {
      expect(regions[i].vulnerability_score).toBeGreaterThanOrEqual(
        regions[i + 1].vulnerability_score
      );
    }
  });

  it("should get most vulnerable regions for specific country", async () => {
    const data = await loadSubnationalData();
    const braRegions = getMostVulnerableInCountry(data, "BRA", 10);
    expect(braRegions).toHaveLength(3);
    expect(braRegions[0].subdivision_code).toBe("BR-AC"); // Highest score in BRA
    expect(braRegions[0].country_iso3).toBe("BRA");
  });

  it("should return empty array for non-existent country in most vulnerable", async () => {
    const data = await loadSubnationalData();
    const xyzRegions = getMostVulnerableInCountry(data, "XYZ", 10);
    expect(xyzRegions).toHaveLength(0);
  });

  it("should compute country vulnerability stats", async () => {
    const data = await loadSubnationalData();
    const braStats = computeCountryVulnerabilityStats(data, "BRA");
    expect(braStats).toBeDefined();
    expect(braStats?.iso3).toBe("BRA");
    expect(braStats?.name).toBe("Brazil");
    expect(braStats?.totalSubdivisions).toBe(3);
    expect(braStats?.avgVulnerability).toBeCloseTo((0.72 + 0.45 + 0.2) / 3, 2);
    expect(braStats?.mostVulnerable?.code).toBe("BR-AC");
    expect(braStats?.mostVulnerable?.score).toBe(0.72);
    expect(braStats?.leastVulnerable?.code).toBe("BR-DF");
    expect(braStats?.leastVulnerable?.score).toBe(0.2);
    expect(braStats?.highVulnerabilityCount).toBe(1); // Only BR-AC > 0.7
    expect(braStats?.lowVulnerabilityCount).toBe(1); // Only BR-DF < 0.3
  });

  it("should return null for non-existent country stats", async () => {
    const data = await loadSubnationalData();
    const xyzStats = computeCountryVulnerabilityStats(data, "XYZ");
    expect(xyzStats).toBeNull();
  });

  it("should get all countries vulnerability stats", async () => {
    const data = await loadSubnationalData();
    const allStats = getAllCountriesVulnerabilityStats(data);
    expect(allStats).toHaveLength(2);
    // COD should be first (higher avg vulnerability: (0.85+0.68)/2 = 0.765)
    expect(allStats[0].iso3).toBe("COD");
    expect(allStats[0].avgVulnerability).toBeGreaterThan(allStats[1].avgVulnerability);
  });

  it("should get regions by threshold", async () => {
    const data = await loadSubnationalData();
    const criticalRegions = getRegionsByThreshold(data, 0.8, 1.0);
    expect(criticalRegions).toHaveLength(1);
    expect(criticalRegions[0].subdivision_code).toBe("CD-KN");
  });

  it("should get regions by threshold range", async () => {
    const data = await loadSubnationalData();
    const highRegions = getRegionsByThreshold(data, 0.6, 0.8);
    expect(highRegions).toHaveLength(2); // BR-AC (0.72) and CD-BU (0.68)
    expect(highRegions.every((r) => r.vulnerability_score >= 0.6 && r.vulnerability_score < 0.8)).toBe(
      true
    );
  });

  it("should return empty array for threshold with no matches", async () => {
    const data = await loadSubnationalData();
    const noRegions = getRegionsByThreshold(data, 0.95, 1.0);
    expect(noRegions).toHaveLength(0);
  });
});

describe("subnational.ts — Formatting & Display", () => {
  it("should get vulnerability level for score", () => {
    expect(getVulnerabilityLevel(0.85)).toBe("critical");
    expect(getVulnerabilityLevel(0.65)).toBe("high");
    expect(getVulnerabilityLevel(0.45)).toBe("moderate");
    expect(getVulnerabilityLevel(0.25)).toBe("low");
  });

  it("should get vulnerability color for score", () => {
    expect(getVulnerabilityColor(0.85)).toBe("var(--color-blood-dim)");
    expect(getVulnerabilityColor(0.65)).toBe("var(--color-warning-amber)");
    expect(getVulnerabilityColor(0.45)).toBe("var(--color-terminal-yellow)");
    expect(getVulnerabilityColor(0.25)).toBe("var(--color-terminal-green)");
  });

  it("should get vulnerability icon", () => {
    expect(getVulnerabilityIcon(0.85)).toBe("🔴");
    expect(getVulnerabilityIcon(0.65)).toBe("🟠");
    expect(getVulnerabilityIcon(0.45)).toBe("🟡");
    expect(getVulnerabilityIcon(0.25)).toBe("🟢");
  });

  it("should format vulnerability score as percentage", () => {
    expect(formatVulnerabilityScore(0.85)).toBe("85%");
    expect(formatVulnerabilityScore(0.65)).toBe("65%");
    expect(formatVulnerabilityScore(0.45)).toBe("45%");
    expect(formatVulnerabilityScore(0.25)).toBe("25%");
    expect(formatVulnerabilityScore(0.0)).toBe("0%");
    expect(formatVulnerabilityScore(1.0)).toBe("100%");
  });

  it("should format centroid coordinates", () => {
    expect(formatCentroid([-9.02, -70.55])).toBe("-9.02°N, -70.55°E");
    expect(formatCentroid([4.12, 25.23])).toBe("4.12°N, 25.23°E");
  });

  it("should get vulnerability thresholds", () => {
    const thresholds = getVulnerabilityThresholds();
    expect(thresholds.critical).toBe(0.8);
    expect(thresholds.high).toBe(0.6);
    expect(thresholds.moderate).toBe(0.4);
    expect(thresholds.low).toBe(0.0);
  });

  it("should convert polygon to bounding box", () => {
    const polygon = [
      [10, 20],
      [10, 30],
      [15, 30],
      [15, 20],
      [10, 20],
    ] as Array<[number, number]>;
    const bbox = polygonToBoundingBox(polygon);
    expect(bbox.minLon).toBe(10);
    expect(bbox.maxLon).toBe(15);
    expect(bbox.minLat).toBe(20);
    expect(bbox.maxLat).toBe(30);
  });

  it("should handle complex polygon bounding box", () => {
    const polygon = [
      [-10.42, -72.55],
      [-10.42, -68.55],
      [-7.62, -68.55],
      [-7.62, -72.55],
      [-10.42, -72.55],
    ] as Array<[number, number]>;
    const bbox = polygonToBoundingBox(polygon);
    expect(bbox.minLon).toBe(-10.42);
    expect(bbox.maxLon).toBe(-7.62);
    expect(bbox.minLat).toBe(-72.55);
    expect(bbox.maxLat).toBe(-68.55);
  });
});

describe("subnational.ts — Error Handling", () => {
  it("should handle fetch error gracefully", async () => {
    clearSubnationalCache();
    global.fetch = async () =>
      Promise.resolve({
        ok: false,
        statusText: "Not Found",
      } as Response);

    const data = await loadSubnationalData();
    expect(data).toBeDefined();
    expect(Object.keys(data.countries)).toHaveLength(0);
  });

  it("should handle network error", async () => {
    clearSubnationalCache();
    global.fetch = async () => Promise.reject(new Error("Network error"));

    const data = await loadSubnationalData();
    expect(data).toBeDefined();
    expect(Object.keys(data.countries)).toHaveLength(0);
  });
});
