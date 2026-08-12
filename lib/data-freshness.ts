/**
 * V FOR X — Data Freshness Dashboard (lib/data-freshness.ts)
 *
 * A small strip that shows how stale each data dimension is, so a reader
 * knows whether the numbers on a briefing are from yesterday or last
 * year. Fully offline: it reads a seeded registry of data sources (with
 * their embedded last-updated timestamps and expected update cadence)
 * and computes age, staleness, and a traffic-light status.
 *
 * The registry is seeded from the known static data files in data/ and
 * public/api/v1/. A build step or operator can extend it. Age is
 * measured against `now` (default Date.now()), so the strip is always
 * honest about how long ago the snapshot was taken.
 */

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export type FreshnessStatus = "fresh" | "aging" | "stale" | "critical" | "unknown";

export type DataCategory =
  | "conflict"
  | "governance"
  | "humanitarian"
  | "economic"
  | "environmental"
  | "demographic"
  | "sanctions"
  | "infrastructure";

export interface DataSource {
  /** Stable id. */
  id: string;
  /** Human label. */
  label: string;
  /** Category bucket. */
  category: DataCategory;
  /** Origin publisher (e.g. "ACLED", "World Bank", "OWID"). */
  publisher: string;
  /** Epoch ms the data was last updated. */
  lastUpdated: number;
  /** Expected update cadence in days (null = irregular). */
  cadenceDays: number | null;
  /** Static file path or API slug the data lives at. */
  source: string;
  /** Optional license / terms note. */
  license?: string;
}

export interface FreshnessEntry {
  source: DataSource;
  /** Days since lastUpdated. */
  ageDays: number;
  /** 0 (fresh) .. 1 (critical). */
  staleness: number;
  status: FreshnessStatus;
  /** Days overdue vs cadence (negative = within cadence). */
  overdueDays: number;
}

export interface FreshnessReport {
  entries: FreshnessEntry[];
  /** Overall worst status. */
  worstStatus: FreshnessStatus;
  /** Mean staleness 0..1. */
  meanStaleness: number;
  /** Count by status. */
  counts: Record<FreshnessStatus, number>;
  /** Sources whose data is older than its cadence. */
  overdueCount: number;
  /** Epoch ms the report was computed. */
  now: number;
}

/* ═══════════════════════════════════════════════════════════════
   Seeded registry
   ═══════════════════════════════════════════════════════════════ */

const DAY = 86_400_000;

/** A seeded set of the major data dimensions the platform relies on. */
export const DATA_SOURCES: DataSource[] = [
  {
    id: "acled-conflict",
    label: "Armed conflict events",
    category: "conflict",
    publisher: "ACLED",
    lastUpdated: Date.UTC(2024, 0, 1),
    cadenceDays: 7,
    source: "data/world_backbone_geo.json",
    license: "CC BY-NC",
  },
  {
    id: "governance-wbi",
    label: "Worldwide Governance Indicators",
    category: "governance",
    publisher: "World Bank",
    lastUpdated: Date.UTC(2023, 5, 30),
    cadenceDays: 365,
    source: "scripts/fetch_governance.py",
    license: "World Bank Open Data",
  },
  {
    id: "worldbank-gdp",
    label: "GDP & economic indicators",
    category: "economic",
    publisher: "World Bank",
    lastUpdated: Date.UTC(2023, 11, 1),
    cadenceDays: 180,
    source: "scripts/fetch_worldbank.py",
    license: "World Bank Open Data",
  },
  {
    id: "owid",
    label: "Our World in Data metrics",
    category: "humanitarian",
    publisher: "OWID",
    lastUpdated: Date.UTC(2023, 9, 1),
    cadenceDays: 90,
    source: "scripts/fetch_owid.py",
    license: "CC BY",
  },
  {
    id: "ejatlas",
    label: "Environmental conflicts (EJAtlas)",
    category: "environmental",
    publisher: "EJAtlas",
    lastUpdated: Date.UTC(2023, 6, 1),
    cadenceDays: 365,
    source: "data/ejatlas-summary.json",
    license: "CC BY-NC-SA",
  },
  {
    id: "subnational",
    label: "Subnational vulnerability boundaries",
    category: "humanitarian",
    publisher: "V FOR X (compiled)",
    lastUpdated: Date.UTC(2024, 0, 1),
    cadenceDays: 90,
    source: "data/subnational_boundaries.json",
  },
  {
    id: "sanctions",
    label: "Sanctions & designated entities",
    category: "sanctions",
    publisher: "OpenSanctions",
    lastUpdated: Date.UTC(2024, 0, 1),
    cadenceDays: 14,
    source: "scripts/fetch_sanctions_dossiers.py",
  },
  {
    id: "crisis-timelines",
    label: "Crisis event timelines",
    category: "conflict",
    publisher: "V FOR X (curated)",
    lastUpdated: Date.UTC(2024, 0, 1),
    cadenceDays: 30,
    source: "data/crisis_timelines.json",
  },
  {
    id: "war-updates",
    label: "Front-line war updates",
    category: "conflict",
    publisher: "V FOR X (curated)",
    lastUpdated: Date.UTC(2024, 0, 15),
    cadenceDays: 7,
    source: "data/war-updates.json",
  },
];

/* ═══════════════════════════════════════════════════════════════
   Status thresholds
   ═══════════════════════════════════════════════════════════════ */

/**
 * Map an age ratio (ageDays / cadenceDays) to a status.
 *   fresh    : within cadence
 *   aging    : up to 1.5× cadence
 *   stale    : up to 3× cadence
 *   critical : beyond 3× cadence
 */
export function statusForAge(ageDays: number, cadenceDays: number | null): FreshnessStatus {
  if (cadenceDays == null || cadenceDays <= 0) {
    // Irregular cadence: classify by absolute age.
    if (ageDays <= 90) return "fresh";
    if (ageDays <= 180) return "aging";
    if (ageDays <= 365) return "stale";
    return "critical";
  }
  const ratio = ageDays / cadenceDays;
  if (ratio <= 1) return "fresh";
  if (ratio <= 1.5) return "aging";
  if (ratio <= 3) return "stale";
  return "critical";
}

/**
 * Staleness score 0..1. 0 = within cadence (fresh), 1 = 3× cadence or more.
 */
export function stalenessScore(ageDays: number, cadenceDays: number | null): number {
  if (cadenceDays == null || cadenceDays <= 0) {
    return Math.min(1, ageDays / 365);
  }
  return Math.min(1, Math.max(0, (ageDays - cadenceDays) / (2 * cadenceDays)));
}

/* ═══════════════════════════════════════════════════════════════
   Core: compute a freshness entry / report
   ═══════════════════════════════════════════════════════════════ */

/** Compute a single source's freshness. */
export function computeEntry(source: DataSource, now = Date.now()): FreshnessEntry {
  const ageDays = Math.max(0, (now - source.lastUpdated) / DAY);
  const status = statusForAge(ageDays, source.cadenceDays);
  const staleness = stalenessScore(ageDays, source.cadenceDays);
  const overdueDays = source.cadenceDays ? ageDays - source.cadenceDays : 0;
  return { source, ageDays, staleness, status, overdueDays };
}

/** Build a full freshness report over a set of sources. */
export function buildReport(sources = DATA_SOURCES, now = Date.now()): FreshnessReport {
  const entries = sources
    .map((s) => computeEntry(s, now))
    .sort((a, b) => b.ageDays - a.ageDays);

  const order: FreshnessStatus[] = ["fresh", "aging", "stale", "critical", "unknown"];
  const rank: Record<FreshnessStatus, number> = {
    fresh: 0, aging: 1, stale: 2, critical: 3, unknown: 4,
  };

  const counts: Record<FreshnessStatus, number> = {
    fresh: 0, aging: 0, stale: 0, critical: 0, unknown: 0,
  };
  let worstStatus: FreshnessStatus = "fresh";
  let worstRank = -1;
  let stalenessSum = 0;
  let overdueCount = 0;

  for (const e of entries) {
    counts[e.status]++;
    stalenessSum += e.staleness;
    if (e.overdueDays > 0) overdueCount++;
    if (rank[e.status] > worstRank) {
      worstRank = rank[e.status];
      worstStatus = e.status;
    }
  }

  void order;

  return {
    entries,
    worstStatus,
    meanStaleness: entries.length > 0 ? stalenessSum / entries.length : 0,
    counts,
    overdueCount,
    now,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Display helpers
   ═══════════════════════════════════════════════════════════════ */

/** Human-readable age string (e.g. "42 days", "8 months"). */
export function formatAge(ageDays: number): string {
  if (ageDays < 1) return "today";
  if (ageDays < 30) return `${Math.round(ageDays)} days`;
  if (ageDays < 365) return `${Math.round(ageDays / 30)} months`;
  const years = ageDays / 365;
  return `${years.toFixed(1)} years`;
}

/** Color token for a status (matches the terminal palette). */
export function statusColor(status: FreshnessStatus): string {
  switch (status) {
    case "fresh": return "#00ff41";
    case "aging": return "#ffc40d";
    case "stale": return "#ff7f50";
    case "critical": return "#ff0000";
    default: return "#666";
  }
}

/** One-line summary for the freshness strip. */
export function summarizeReport(report: FreshnessReport): string {
  const { fresh, aging, stale, critical } = report.counts;
  return `${fresh} fresh · ${aging} aging · ${stale} stale · ${critical} critical (${report.overdueCount} overdue)`;
}
