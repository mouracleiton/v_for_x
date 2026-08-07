/**
 * V FOR X — Migration Flow Data
 *
 * Derived from world_backbone.json migration data.
 * Represents the global displacement crisis as directed flows.
 */

import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, CountryData } from "./types";

const data = backbone as WorldBackbone;

export interface FlowNode {
  iso3: string;
  name: string;
  region: string;
  isHotspot: boolean;
  refugeesOrigin: number;
  refugeesHosted: number;
  forciblyDisplaced: number;
  idpsDisaster: number;
  netMigration: number;
  popM: number;
}

export interface FlowEdge {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  // We don't have bilateral flow data, but we can estimate regional flows
  estimatedFlow: number;
  type: "regional" | "continental";
}

export interface FlowStats {
  totalRefugees: number;
  totalDisplaced: number;
  totalIDPs: number;
  totalHosts: number;
  totalOrigins: number;
  topOrigins: FlowNode[];
  topHosts: FlowNode[];
  worstDisplacementRatio: FlowNode[];
}

/** Build flow nodes from the backbone data */
export function buildFlowNodes(): FlowNode[] {
  return data.countries
    .map((c: CountryData) => ({
      iso3: c.iso3,
      name: c.name_en,
      region: c.region,
      isHotspot: c.is_hotspot,
      refugeesOrigin: c.migration.refugees_origin ?? 0,
      refugeesHosted: c.migration.refugees_hosted ?? 0,
      forciblyDisplaced: c.migration.forcibly_displaced ?? 0,
      idpsDisaster: c.migration.idps_disaster_new ?? 0,
      netMigration: c.migration.net_migration ?? 0,
      popM: c.population_m,
    }))
    .filter((n) => n.refugeesOrigin > 0 || n.refugeesHosted > 0 || n.forciblyDisplaced > 100000);
}

/** Compute aggregate statistics */
export function computeFlowStats(nodes: FlowNode[]): FlowStats {
  const totalRefugees = nodes.reduce((s, n) => s + n.refugeesOrigin, 0);
  const totalDisplaced = nodes.reduce((s, n) => s + n.forciblyDisplaced, 0);
  const totalIDPs = nodes.reduce((s, n) => s + n.idpsDisaster, 0);

  const topOrigins = [...nodes]
    .filter((n) => n.refugeesOrigin > 0)
    .sort((a, b) => b.refugeesOrigin - a.refugeesOrigin)
    .slice(0, 12);

  const topHosts = [...nodes]
    .filter((n) => n.refugeesHosted > 0)
    .sort((a, b) => b.refugeesHosted - a.refugeesHosted)
    .slice(0, 12);

  // Worst displacement-to-population ratio
  const worstDisplacementRatio = [...nodes]
    .filter((n) => n.forciblyDisplaced > 0 && n.popM > 0)
    .map((n) => ({ ...n, _ratio: n.forciblyDisplaced / (n.popM * 1_000_000) }))
    .sort((a, b) => (b as any)._ratio - (a as any)._ratio)
    .slice(0, 10);

  return {
    totalRefugees,
    totalDisplaced,
    totalIDPs,
    totalHosts: nodes.filter((n) => n.refugeesHosted > 0).length,
    totalOrigins: nodes.filter((n) => n.refugeesOrigin > 0).length,
    topOrigins,
    topHosts,
    worstDisplacementRatio,
  };
}

/**
 * Estimate flows between origin and host countries.
 * Since we lack bilateral data, we estimate based on:
 * 1. Regional proximity (same region = higher flow)
 * 2. Continental proximity (same broader area)
 * 3. Host capacity vs origin volume
 *
 * This produces a plausible visualization of where refugees likely go.
 */
export function estimateFlows(nodes: FlowNode[]): FlowEdge[] {
  const origins = nodes.filter((n) => n.refugeesOrigin > 50000);
  const hosts = nodes.filter((n) => n.refugeesHosted > 50000);

  const edges: FlowEdge[] = [];

  for (const origin of origins) {
    // Find hosts in the same region first
    const regionalHosts = hosts.filter((h) => h.region === origin.region && h.iso3 !== origin.iso3);
    const continentalHosts = hosts.filter(
      (h) => h.iso3 !== origin.iso3 &&
      isNearby(origin, h) &&
      !regionalHosts.includes(h)
    );

    // Distribute origin's refugees across regional hosts (weighted by host capacity)
    const totalRegionalCapacity = regionalHosts.reduce((s, h) => s + h.refugeesHosted, 0);
    for (const host of regionalHosts) {
      if (totalRegionalCapacity === 0) break;
      const share = host.refugeesHosted / totalRegionalCapacity;
      const flow = Math.round(origin.refugeesOrigin * share * 0.6); // 60% stay regional
      if (flow > 1000) {
        edges.push({
          from: origin.iso3,
          fromName: origin.name,
          to: host.iso3,
          toName: host.name,
          estimatedFlow: flow,
          type: "regional",
        });
      }
    }

    // Remaining go to continental/global hosts
    const remaining = origin.refugeesOrigin * 0.4;
    const totalContinentalCapacity = continentalHosts.reduce((s, h) => s + h.refugeesHosted, 0);
    for (const host of continentalHosts) {
      if (totalContinentalCapacity === 0) break;
      const share = host.refugeesHosted / totalContinentalCapacity;
      const flow = Math.round(remaining * share);
      if (flow > 5000) {
        edges.push({
          from: origin.iso3,
          fromName: origin.name,
          to: host.iso3,
          toName: host.name,
          estimatedFlow: flow,
          type: "continental",
        });
      }
    }
  }

  return edges.sort((a, b) => b.estimatedFlow - a.estimatedFlow);
}

/** Rough geographic proximity check using region groupings */
const REGION_GROUPS: Record<string, string> = {
  Africa: "afroeurasia",
  Asia: "afroeurasia",
  Europe: "afroeurasia",
  Americas: "americas",
  Oceania: "oceania",
};

function isNearby(a: FlowNode, b: FlowNode): boolean {
  return REGION_GROUPS[a.region] === REGION_GROUPS[b.region];
}

export function flowWidth(flow: number, maxFlow: number): number {
  return 1 + (flow / maxFlow) * 8;
}

export function flowColor(type: "regional" | "continental"): string {
  return type === "regional" ? "#e10600" : "#ff6600";
}
