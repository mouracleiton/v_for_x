import type { EjatlasConflict, EjatlasSummary } from "./types";
import summaryData from "@/data/ejatlas-summary.json";

const summary = summaryData as EjatlasSummary;

/**
 * V FOR X — EJAtlas data access helpers
 * Provides lightweight lookups over the environmental conflict dataset.
 */

export function getEjatlasSummary(): EjatlasSummary {
  return summary;
}

export function getCountryConflictSummary(iso3: string) {
  return summary.country_summaries[iso3] ?? null;
}

export function getTotalConflicts(): number {
  return summary.metadata.total_conflicts;
}

export function getTopConflictCountries(limit = 10) {
  return Object.entries(summary.country_summaries)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, limit)
    .map(([iso3, data]) => ({ iso3, ...data }));
}

export function getGlobalCategories() {
  return summary.summary.by_category;
}

export function getStatusBreakdown() {
  const map: Record<string, string> = {
    "in operation": "Active",
    stopped: "Stopped",
    "under construction": "Building",
    "planned (decision to go ahead eg eia undertaken, etc)": "Planned",
    "proposed (exploration phase)": "Proposed",
    unknown: "Unknown",
    "": "Unknown",
  };
  return summary.summary.by_status.map((s) => ({
    ...s,
    label: map[s.name] ?? s.name,
  }));
}

export function intensityColor(level: string): string {
  switch (level) {
    case "high": return "#ff0000";
    case "medium": return "#ff7f50";
    case "low": return "#ffc40d";
    case "latent": return "#049cdb";
    default: return "#666";
  }
}

export function severityRank(sev: string): number {
  return sev === "high" ? 3 : sev === "moderate" ? 2 : 1;
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    "in operation": "ACTIVE",
    stopped: "STOPPED",
    "under construction": "BUILDING",
    "planned (decision to go ahead eg eia undertaken, etc)": "PLANNED",
    "proposed (exploration phase)": "PROPOSED",
  };
  return map[status] ?? (status || "UNKNOWN").toUpperCase();
}

export { type EjatlasConflict };
