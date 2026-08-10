/**
 * V FOR X — Public Datasets Catalog (The Vault)
 *
 * A curated registry of open, mission-aligned datasets for exposing
 * corruption, mapping conflict, and documenting human-rights abuse.
 * Sourced and vetted from the Awesome Public Datasets catalog.
 *
 * Pure functions — safe for both server (build-time export) and
 * client use. No runtime dependencies.
 */

import catalogData from "@/data/public_datasets.json";

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

export type DatasetCategory =
  | "conflict"
  | "rights"
  | "hunger"
  | "health"
  | "climate"
  | "inequality"
  | "migration"
  | "water"
  | "governance"
  | "economy"
  | "energy"
  | "geodata";

export type DatasetPriority = "critical" | "high" | "standard";

export interface DatasetCategoryMeta {
  label: string;
  icon: string;
  mapsTo: string;
}

export interface Dataset {
  id: string;
  name: string;
  provider: string;
  category: DatasetCategory;
  priority: DatasetPriority;
  description: string;
  url: string;
  format: string;
  license: string;
  coverage: string;
  cadence: string;
  mapsTo: string;
  tags: string[];
}

export interface CatalogMeta {
  schema_version: string;
  title: string;
  description: string;
  created: string;
  curated_from: string;
  license: string;
  total_datasets: number;
}

export interface PublicDatasetsCatalog {
  metadata: CatalogMeta;
  categories: Record<string, DatasetCategoryMeta>;
  datasets: Dataset[];
}

/* ═══════════════════════════════════════════════════════════
   MODULE LOAD
   ═══════════════════════════════════════════════════════════ */

const catalog = catalogData as PublicDatasetsCatalog;

/* ═══════════════════════════════════════════════════════════
   ACCESSORS
   ═══════════════════════════════════════════════════════════ */

export function getCatalog(): PublicDatasetsCatalog {
  return catalog;
}

export function getMetadata(): CatalogMeta {
  return catalog.metadata;
}

export function getAllDatasets(): Dataset[] {
  return catalog.datasets;
}

export function getDatasetById(id: string): Dataset | undefined {
  return catalog.datasets.find((d) => d.id === id);
}

export function getCategories(): Record<string, DatasetCategoryMeta> {
  return catalog.categories;
}

export function getCategoryList(): {
  key: DatasetCategory;
  label: string;
  icon: string;
  mapsTo: string;
}[] {
  return Object.entries(catalog.categories).map(([key, meta]) => ({
    key: key as DatasetCategory,
    label: meta.label,
    icon: meta.icon,
    mapsTo: meta.mapsTo,
  }));
}

/** Return datasets belonging to a single category. */
export function getByCategory(category: DatasetCategory): Dataset[] {
  return catalog.datasets.filter((d) => d.category === category);
}

/** Return datasets matching a given priority level. */
export function getByPriority(priority: DatasetPriority): Dataset[] {
  return catalog.datasets.filter((d) => d.priority === priority);
}

/** Return datasets that map to a given backbone dimension. */
export function getByDimension(dimension: string): Dataset[] {
  return catalog.datasets.filter((d) => d.mapsTo === dimension);
}

/** Return the unique list of tags across the whole catalog (sorted). */
export function getAllTags(): string[] {
  const tags = new Set<string>();
  for (const d of catalog.datasets) {
    for (const tag of d.tags) tags.add(tag);
  }
  return Array.from(tags).sort();
}

/* ═══════════════════════════════════════════════════════════
   COUNTS / STATS
   ═══════════════════════════════════════════════════════════ */

export interface CatalogStats {
  total: number;
  byCategory: Record<string, number>;
  byPriority: Record<DatasetPriority, number>;
  byDimension: Record<string, number>;
  categories: number;
  criticalCount: number;
}

export function getStats(): CatalogStats {
  const byCategory: Record<string, number> = {};
  const byPriority: Record<DatasetPriority, number> = {
    critical: 0,
    high: 0,
    standard: 0,
  };
  const byDimension: Record<string, number> = {};

  for (const d of catalog.datasets) {
    byCategory[d.category] = (byCategory[d.category] ?? 0) + 1;
    byPriority[d.priority] += 1;
    byDimension[d.mapsTo] = (byDimension[d.mapsTo] ?? 0) + 1;
  }

  return {
    total: catalog.datasets.length,
    byCategory,
    byPriority,
    byDimension,
    categories: Object.keys(catalog.categories).length,
    criticalCount: byPriority.critical,
  };
}

/* ═══════════════════════════════════════════════════════════
   SEARCH
   ═══════════════════════════════════════════════════════════ */

export interface SearchFilters {
  query?: string;
  category?: DatasetCategory | "all";
  priority?: DatasetPriority | "all";
}

export interface ScoredDataset {
  dataset: Dataset;
  score: number;
}

/**
 * Score a single dataset against a free-text query.
 * Returns 0 for no match, higher = better. Matches name,
 * provider, description, and tags.
 */
export function scoreDataset(d: Dataset, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  const name = d.name.toLowerCase();
  const provider = d.provider.toLowerCase();
  const description = d.description.toLowerCase();
  const tags = d.tags.join(" ").toLowerCase();

  if (name === q) return 100;
  if (name.startsWith(q)) return 90;
  if (name.includes(q)) return 80;
  if (provider.includes(q)) return 70;
  if (tags.split(" ").some((t) => t.startsWith(q))) return 65;
  if (description.includes(q)) return 50;

  // Subsequence (fuzzy) match against the name
  let qi = 0;
  for (let ti = 0; ti < name.length && qi < q.length; ti++) {
    if (name[ti] === q[qi]) qi++;
  }
  if (qi === q.length) return 30;

  return 0;
}

/** Search and filter the catalog, returning scored, sorted results. */
export function searchDatasets(filters: SearchFilters = {}): ScoredDataset[] {
  const { query = "", category = "all", priority = "all" } = filters;
  const results: ScoredDataset[] = [];

  for (const d of catalog.datasets) {
    if (category !== "all" && d.category !== category) continue;
    if (priority !== "all" && d.priority !== priority) continue;
    const score = scoreDataset(d, query);
    if (score > 0) {
      results.push({ dataset: d, score });
    }
  }

  const priorityRank: Record<DatasetPriority, number> = {
    critical: 0,
    high: 1,
    standard: 2,
  };

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return priorityRank[a.dataset.priority] - priorityRank[b.dataset.priority];
  });

  return results;
}

/* ═══════════════════════════════════════════════════════════
   PRIORITY HELPERS
   ═══════════════════════════════════════════════════════════ */

export const PRIORITY_META: Record<
  DatasetPriority,
  { label: string; color: "blood" | "amber" | "dim" }
> = {
  critical: { label: "CRITICAL", color: "blood" },
  high: { label: "HIGH", color: "amber" },
  standard: { label: "STANDARD", color: "dim" },
};
