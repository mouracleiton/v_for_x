/**
 * V FOR X — Subnational Vulnerability Analysis
 *
 * Processes and analyzes administrative area (subnational) vulnerability data
 * across multiple countries. Enables visualization of regional vulnerability
 * patterns within countries.
 *
 * Data derived from:
 *   - Subnational administrative boundaries
 *   - Conflict and vulnerability metrics by region
 *
 * Storage: Static JSON at data/subnational_boundaries.json
 */

/* ═══════════════════════════════════════════════════════════════
   Types
═══════════════════════════════════════════════════════════════ */

export interface BoundingBox {
  /** Minimum longitude */
  minLon: number;
  /** Maximum longitude */
  maxLon: number;
  /** Minimum latitude */
  minLat: number;
  /** Maximum latitude */
  maxLat: number;
}

export interface Subdivision {
  /** ISO subdivision code (e.g., "BR-AC") */
  code: string;
  /** English name */
  name_en: string;
  /** Center point [latitude, longitude] */
  centroid: [number, number];
  /** Simplified bounding box polygon */
  polygon: Array<[number, number]>;
  /** Vulnerability score (0-1, higher = more vulnerable) */
  vulnerability_score: number;
}

export interface CountrySubnational {
  /** ISO3 country code */
  iso3: string;
  /** English country name */
  name_en: string;
  /** Administrative subdivisions */
  subdivisions: Subdivision[];
}

export interface SubnationalData {
  meta: {
    title: string;
    description: string;
    sources: string[];
    note: string;
  };
  countries: Record<string, CountrySubnational>;
}

/* ═══════════════════════════════════════════════════════════════
   Derived Types
═══════════════════════════════════════════════════════════════ */

export interface VulnerableRegion {
  /** Country ISO3 */
  country_iso3: string;
  /** Country name */
  country_name: string;
  /** Subdivision code */
  subdivision_code: string;
  /** Subdivision name */
  subdivision_name: string;
  /** Vulnerability score (0-1) */
  vulnerability_score: number;
  /** Center point */
  centroid: [number, number];
  /** Bounding box */
  polygon: Array<[number, number]>;
}

export interface CountryVulnerabilityStats {
  /** Country ISO3 */
  iso3: string;
  /** Country name */
  name: string;
  /** Number of subdivisions */
  totalSubdivisions: number;
  /** Average vulnerability score */
  avgVulnerability: number;
  /** Most vulnerable subdivision */
  mostVulnerable: {
    code: string;
    name: string;
    score: number;
  } | null;
  /** Least vulnerable subdivision */
  leastVulnerable: {
    code: string;
    name: string;
    score: number;
  } | null;
  /** Count of high-vulnerability regions (score > 0.7) */
  highVulnerabilityCount: number;
  /** Count of low-vulnerability regions (score < 0.3) */
  lowVulnerabilityCount: number;
}

export interface VulnerabilityThresholds {
  /** Critical threshold */
  critical: number;
  /** High threshold */
  high: number;
  /** Moderate threshold */
  moderate: number;
  /** Low threshold */
  low: number;
}

/* ═══════════════════════════════════════════════════════════════
   Data Loading
═══════════════════════════════════════════════════════════════ */

let cachedData: SubnationalData | null = null;

/**
 * Load subnational data from static JSON.
 * Cached in memory for subsequent calls.
 */
export async function loadSubnationalData(): Promise<SubnationalData> {
  if (cachedData) return cachedData;

  try {
    const response = await fetch("/api/v1/subnational_boundaries.json");
    if (!response.ok) {
      throw new Error(`Failed to load subnational data: ${response.statusText}`);
    }
    cachedData = await response.json();
    return cachedData!;
  } catch (error) {
    console.error("Error loading subnational data:", error);
    // Return empty structure on error
    return {
      meta: {
        title: "Subnational Vulnerability Data",
        description: "Administrative area vulnerability indicators",
        sources: [],
        note: "No data available",
      },
      countries: {},
    };
  }
}

/**
 * Clear cached data (useful for testing or refresh).
 */
export function clearSubnationalCache(): void {
  cachedData = null;
}

/* ═══════════════════════════════════════════════════════════════
   Data Access
═══════════════════════════════════════════════════════════════ */

/**
 * Get all subdivisions for a specific country.
 */
export function getSubdivisionsForCountry(
  data: SubnationalData,
  iso3: string,
): Subdivision[] {
  const country = data.countries[iso3];
  return country?.subdivisions || [];
}

/**
 * Get a specific subdivision by country and code.
 */
export function getSubdivisionByCode(
  data: SubnationalData,
  countryIso3: string,
  subdivisionCode: string,
): Subdivision | null {
  const country = data.countries[countryIso3];
  if (!country) return null;
  return country.subdivisions.find((s) => s.code === subdivisionCode) || null;
}

/**
 * Get all countries with subnational data.
 */
export function getCountriesWithData(data: SubnationalData): string[] {
  return Object.keys(data.countries);
}

/**
 * Get country name by ISO3 code.
 */
export function getCountryName(data: SubnationalData, iso3: string): string {
  return data.countries[iso3]?.name_en || iso3;
}

/* ═══════════════════════════════════════════════════════════════
   Vulnerability Analysis
═══════════════════════════════════════════════════════════════ */

/**
 * Get most vulnerable regions across all countries.
 */
export function getMostVulnerableRegions(
  data: SubnationalData,
  limit = 20,
): VulnerableRegion[] {
  const regions: VulnerableRegion[] = [];

  for (const [iso3, country] of Object.entries(data.countries)) {
    for (const subdivision of country.subdivisions) {
      regions.push({
        country_iso3: iso3,
        country_name: country.name_en,
        subdivision_code: subdivision.code,
        subdivision_name: subdivision.name_en,
        vulnerability_score: subdivision.vulnerability_score,
        centroid: subdivision.centroid,
        polygon: subdivision.polygon,
      });
    }
  }

  return regions
    .sort((a, b) => b.vulnerability_score - a.vulnerability_score)
    .slice(0, limit);
}

/**
 * Get most vulnerable regions for a specific country.
 */
export function getMostVulnerableInCountry(
  data: SubnationalData,
  iso3: string,
  limit = 10,
): VulnerableRegion[] {
  const country = data.countries[iso3];
  if (!country) return [];

  return country.subdivisions
    .map((s) => ({
      country_iso3: iso3,
      country_name: country.name_en,
      subdivision_code: s.code,
      subdivision_name: s.name_en,
      vulnerability_score: s.vulnerability_score,
      centroid: s.centroid,
      polygon: s.polygon,
    }))
    .sort((a, b) => b.vulnerability_score - a.vulnerability_score)
    .slice(0, limit);
}

/**
 * Compute vulnerability statistics for a country.
 */
export function computeCountryVulnerabilityStats(
  data: SubnationalData,
  iso3: string,
): CountryVulnerabilityStats | null {
  const country = data.countries[iso3];
  if (!country || country.subdivisions.length === 0) return null;

  const subdivisions = country.subdivisions;
  const avgVulnerability =
    subdivisions.reduce((sum, s) => sum + s.vulnerability_score, 0) /
    subdivisions.length;

  const sortedByVulnerability = [...subdivisions].sort(
    (a, b) => b.vulnerability_score - a.vulnerability_score,
  );

  return {
    iso3,
    name: country.name_en,
    totalSubdivisions: subdivisions.length,
    avgVulnerability,
    mostVulnerable: {
      code: sortedByVulnerability[0].code,
      name: sortedByVulnerability[0].name_en,
      score: sortedByVulnerability[0].vulnerability_score,
    },
    leastVulnerable: {
      code: sortedByVulnerability[sortedByVulnerability.length - 1].code,
      name: sortedByVulnerability[sortedByVulnerability.length - 1].name_en,
      score: sortedByVulnerability[sortedByVulnerability.length - 1].vulnerability_score,
    },
    highVulnerabilityCount: subdivisions.filter((s) => s.vulnerability_score > 0.7).length,
    lowVulnerabilityCount: subdivisions.filter((s) => s.vulnerability_score < 0.3).length,
  };
}

/**
 * Get all countries with vulnerability statistics, ranked by average vulnerability.
 */
export function getAllCountriesVulnerabilityStats(
  data: SubnationalData,
): CountryVulnerabilityStats[] {
  const stats: CountryVulnerabilityStats[] = [];

  for (const iso3 of Object.keys(data.countries)) {
    const stat = computeCountryVulnerabilityStats(data, iso3);
    if (stat) {
      stats.push(stat);
    }
  }

  return stats.sort((a, b) => b.avgVulnerability - a.avgVulnerability);
}

/**
 * Find regions by vulnerability threshold.
 */
export function getRegionsByThreshold(
  data: SubnationalData,
  minScore: number,
  maxScore = 1.0,
): VulnerableRegion[] {
  const regions: VulnerableRegion[] = [];

  for (const [iso3, country] of Object.entries(data.countries)) {
    for (const subdivision of country.subdivisions) {
      if (
        subdivision.vulnerability_score >= minScore &&
        subdivision.vulnerability_score <= maxScore
      ) {
        regions.push({
          country_iso3: iso3,
          country_name: country.name_en,
          subdivision_code: subdivision.code,
          subdivision_name: subdivision.name_en,
          vulnerability_score: subdivision.vulnerability_score,
          centroid: subdivision.centroid,
          polygon: subdivision.polygon,
        });
      }
    }
  }

  return regions.sort((a, b) => b.vulnerability_score - a.vulnerability_score);
}

/* ═══════════════════════════════════════════════════════════════
   Formatting & Display
═══════════════════════════════════════════════════════════════ */

/**
 * Get vulnerability level from score.
 */
export function getVulnerabilityLevel(score: number): "critical" | "high" | "moderate" | "low" {
  if (score >= 0.8) return "critical";
  if (score >= 0.6) return "high";
  if (score >= 0.4) return "moderate";
  return "low";
}

/**
 * Get color for vulnerability level.
 */
export function getVulnerabilityColor(score: number): string {
  const level = getVulnerabilityLevel(score);
  switch (level) {
    case "critical":
      return "var(--color-blood-dim)";
    case "high":
      return "var(--color-warning-amber)";
    case "moderate":
      return "var(--color-terminal-yellow)";
    case "low":
      return "var(--color-terminal-green)";
  }
}

/**
 * Format vulnerability score as percentage.
 */
export function formatVulnerabilityScore(score: number): string {
  return `${(score * 100).toFixed(0)}%`;
}

/**
 * Get vulnerability icon/emoji.
 */
export function getVulnerabilityIcon(score: number): string {
  const level = getVulnerabilityLevel(score);
  switch (level) {
    case "critical":
      return "🔴";
    case "high":
      return "🟠";
    case "moderate":
      return "🟡";
    case "low":
      return "🟢";
  }
}

/**
 * Get default vulnerability thresholds.
 */
export function getVulnerabilityThresholds(): VulnerabilityThresholds {
  return {
    critical: 0.8,
    high: 0.6,
    moderate: 0.4,
    low: 0.0,
  };
}

/**
 * Convert polygon to bounding box.
 */
export function polygonToBoundingBox(polygon: Array<[number, number]>): BoundingBox {
  const lons = polygon.map((p) => p[0]);
  const lats = polygon.map((p) => p[1]);

  return {
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
}

/**
 * Format centroid for display.
 */
export function formatCentroid(centroid: [number, number]): string {
  return `${centroid[0].toFixed(2)}°N, ${centroid[1].toFixed(2)}°E`;
}
