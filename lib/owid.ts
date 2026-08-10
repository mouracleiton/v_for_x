/**
 * V FOR X — Our World in Data (OWID) Integration
 *
 * Loads, queries, and serves OWID datasets that were fetched by
 * scripts/fetch_owid.py. Each dataset is stored as JSON in
 * data/owid_datasets/{slug}.json.
 *
 * Provides:
 *   - Dataset loading and caching
 *   - Country-level lookups (by ISO3 or name)
 *   - Time-series extraction
 *   - Multi-dataset comparison
 *   - Statistical summaries
 *
 * All data is loaded client-side from the static export. No API
 * calls at runtime.
 */

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface OWIDEntity {
  name: string;
  code: string | null;
  years: Record<string, number>;
}

export interface OWIDDataset {
  slug: string;
  entities: Record<string, OWIDEntity>;
  latest: Record<string, number>;
  min_year: number | null;
  max_year: number | null;
  data_columns: string[];
}

export interface OWIDIndexEntry {
  slug: string;
  category: string;
  label: string;
  description: string;
  source: string;
  entities: number;
  min_year: number | null;
  max_year: number | null;
  data_columns: string[];
}

export interface OWIDIndex {
  version: number;
  fetched_at: string;
  total_datasets: number;
  categories: string[];
  datasets: OWIDIndexEntry[];
}

export interface OWIDTimeSeries {
  entity: string;
  name: string;
  points: { year: number; value: number }[];
}

export interface OWIDCountryValue {
  iso3: string;
  name: string;
  value: number;
  year: number;
}

export interface OWIDSummary {
  slug: string;
  label: string;
  category: string;
  total: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  latestYear: number | null;
}

/* ═══════════════════════════════════════════════════════════════
   Dataset Loading
   ═══════════════════════════════════════════════════════════════ */

/**
 * Dataset cache to avoid re-fetching.
 */
const cache = new Map<string, OWIDDataset>();

/**
 * Load an OWID dataset by slug.
 * Uses dynamic import for Next.js static export compatibility.
 */
export async function loadDataset(slug: string): Promise<OWIDDataset | null> {
  if (cache.has(slug)) return cache.get(slug)!;

  try {
    const mod = await import(`@/data/owid_datasets/${slug}.json`);
    const data = mod.default as OWIDDataset;
    cache.set(slug, data);
    return data;
  } catch {
    return null;
  }
}

/**
 * Load multiple datasets at once.
 */
export async function loadDatasets(slugs: string[]): Promise<Record<string, OWIDDataset | null>> {
  const entries = await Promise.all(
    slugs.map(async (slug) => [slug, await loadDataset(slug)] as const),
  );
  return Object.fromEntries(entries);
}

/**
 * Load the OWID index (catalog of all datasets).
 */
export async function loadIndex(): Promise<OWIDIndex | null> {
  try {
    const mod = await import("@/data/owid_index.json");
    return mod.default as OWIDIndex;
  } catch {
    return null;
  }
}

/**
 * Get datasets by category.
 */
export async function getDatasetsByCategory(category: string): Promise<OWIDIndexEntry[]> {
  const index = await loadIndex();
  if (!index) return [];
  return index.datasets.filter((d) => d.category === category);
}

/* ═══════════════════════════════════════════════════════════════
   Data Querying
   ═══════════════════════════════════════════════════════════════ */

/**
 * Get the latest value for a specific country in a dataset.
 */
export function getLatestValue(
  dataset: OWIDDataset,
  iso3: string,
): { value: number; year: number } | null {
  const entity = dataset.entities[iso3];
  if (!entity || Object.keys(entity.years).length === 0) return null;

  const years = Object.keys(entity.years).map(Number).sort((a, b) => b - a);
  const latestYear = years[0];
  const value = entity.years[latestYear];

  return { value, year: latestYear };
}

/**
 * Get a full time series for a country in a dataset.
 */
export function getTimeSeries(
  dataset: OWIDDataset,
  iso3: string,
): OWIDTimeSeries | null {
  const entity = dataset.entities[iso3];
  if (!entity) return null;

  const points = Object.entries(entity.years)
    .map(([year, value]) => ({ year: Number(year), value }))
    .sort((a, b) => a.year - b.year);

  if (points.length === 0) return null;

  return {
    entity: iso3,
    name: entity.name,
    points,
  };
}

/**
 * Get the latest values for all countries in a dataset.
 * Returns sorted array (highest value first).
 */
export function getAllLatest(dataset: OWIDDataset): OWIDCountryValue[] {
  const results: OWIDCountryValue[] = [];

  for (const [code, entity] of Object.entries(dataset.entities)) {
    const years = Object.keys(entity.years).map(Number);
    if (years.length === 0) continue;

    const latestYear = Math.max(...years);
    const value = entity.years[latestYear];

    results.push({
      iso3: code,
      name: entity.name,
      value,
      year: latestYear,
    });
  }

  return results.sort((a, b) => b.value - a.value);
}

/**
 * Get a ranked list of countries for a dataset.
 */
export function getRanking(
  dataset: OWIDDataset,
  direction: "higher_better" | "lower_better" = "higher_better",
  limit?: number,
): OWIDCountryValue[] {
  const all = getAllLatest(dataset);
  if (direction === "lower_better") {
    all.reverse();
  }
  return limit ? all.slice(0, limit) : all;
}

/**
 * Compare time series across multiple countries for a dataset.
 */
export function compareCountries(
  dataset: OWIDDataset,
  iso3List: string[],
): OWIDTimeSeries[] {
  return iso3List
    .map((iso3) => getTimeSeries(dataset, iso3))
    .filter((ts): ts is OWIDTimeSeries => ts !== null);
}

/* ═══════════════════════════════════════════════════════════════
   Statistical Summaries
   ═══════════════════════════════════════════════════════════════ */

/**
 * Compute summary statistics for a dataset.
 */
export function summarizeDataset(
  dataset: OWIDDataset,
  entry: OWIDIndexEntry,
): OWIDSummary {
  const all = getAllLatest(dataset);
  const values = all.map((c) => c.value);

  if (values.length === 0) {
    return {
      slug: dataset.slug,
      label: entry.label,
      category: entry.category,
      total: 0,
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      latestYear: null,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const years = all.map((c) => c.year);

  return {
    slug: dataset.slug,
    label: entry.label,
    category: entry.category,
    total: values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    latestYear: Math.max(...years),
  };
}

/* ═══════════════════════════════════════════════════════════════
   Chart Data Helpers
   ═══════════════════════════════════════════════════════════════ */

/**
 * Format a dataset for Recharts line chart.
 * Returns data points for multiple countries.
 */
export function toLineChartData(
  dataset: OWIDDataset,
  iso3List: string[],
): Array<Record<string, number | string>> {
  // Collect all years from all countries
  const allYears = new Set<number>();
  const series: Record<string, OWIDTimeSeries> = {};

  for (const iso3 of iso3List) {
    const ts = getTimeSeries(dataset, iso3);
    if (ts) {
      series[iso3] = ts;
      ts.points.forEach((p) => allYears.add(p.year));
    }
  }

  const years = Array.from(allYears).sort((a, b) => a - b);

  return years.map((year) => {
    const point: Record<string, number | string> = { year };
    for (const [iso3, ts] of Object.entries(series)) {
      const dataPoint = ts.points.find((p) => p.year === year);
      if (dataPoint) {
        point[iso3] = dataPoint.value;
      }
    }
    return point;
  });
}

/**
 * Format a dataset for a bar chart (latest values, top N countries).
 */
export function toBarChartData(
  dataset: OWIDDataset,
  topN: number,
  direction: "higher_better" | "lower_better" = "higher_better",
): Array<{ name: string; value: number; iso3: string }> {
  const ranking = getRanking(dataset, direction, topN);
  return ranking.map((c) => ({
    name: c.name,
    value: Math.round(c.value * 100) / 100,
    iso3: c.iso3,
  }));
}

/**
 * Format a dataset for a scatter plot (dataset value vs. a country metric).
 */
export function toScatterData(
  dataset: OWIDDataset,
  countryMetrics: Record<string, number>,
): Array<{ x: number; y: number; name: string; iso3: string }> {
  const all = getAllLatest(dataset);
  return all
    .filter((c) => countryMetrics[c.iso3] != null)
    .map((c) => ({
      x: c.value,
      y: countryMetrics[c.iso3],
      name: c.name,
      iso3: c.iso3,
    }));
}
