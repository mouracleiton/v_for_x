/**
 * V FOR X — War Updates (Multi-Source Conflict Intelligence)
 *
 * Pure helpers over the static `data/war-updates.json` snapshot, which
 * aggregates data from 8 open-source conflict intelligence providers:
 *   ISW, ACLED, LiveUAMap, War-Radar, WarWatch, War-Monitor, War.Direct,
 *   and the Telegram Archive of the War (Lviv Center).
 *
 * All functions are pure and dependency-free so they are safe for both
 * build-time static export and client-side use.
 */

import type { CountryData } from "./types";

/* ═══════════════════════════════════════════════════════════
   SHARED TYPES
   ═══════════════════════════════════════════════════════════ */

export type TheaterSeverity = "critical" | "high" | "moderate";

export type TheaterStatus =
  | "active_high_intensity"
  | "active_brinkmanship"
  | "active";

export interface WarReportLink {
  title: string;
  url: string;
  type?: string;
}

export interface KeyDevelopment {
  date: string;
  text: string;
  tag: string;
}

export interface LatestReport {
  title: string;
  date: string;
  url: string;
}

/* ═══════════════════════════════════════════════════════════
   SOURCE TYPES
   ═══════════════════════════════════════════════════════════ */

export type SourceType =
  | "research_institute"
  | "conflict_database"
  | "live_event_map"
  | "ai_conflict_monitor"
  | "legal_monitor"
  | "osint_aggregator"
  | "historical_archive";

export interface WarSourceMeta {
  id: string;
  name: string;
  short_name: string;
  url: string;
  tagline: string;
  description: string;
  type: SourceType;
  license_note: string;
  stats: Record<string, number>;
}

/* ═══════════════════════════════════════════════════════════
   THEATER TYPES
   ═══════════════════════════════════════════════════════════ */

export interface AcledStats {
  weekly_events?: number;
  weekly_change_pct?: number;
  civilian_targeting_events?: number;
  civilians_killed_weekly?: number;
  air_drone_strikes?: number;
  shelling_events?: number;
  armed_clashes?: number;
  infrastructure_attacks?: number;
  infrastructure_breakdown?: Record<string, number>;
  drone_strikes_moscow_city?: number;
  drone_strikes_moscow_region?: number;
  killed_since_april_2023?: number;
  killed_since_2021_coup?: number;
  distinct_armed_groups?: number;
  geographic_diffusion_pct?: number;
  share_of_global_conflict_events_pct?: number;
  killed_by_political_violence?: number;
  armed_groups?: number;
  civilian_targeting_events_count?: number;
  acled_rank?: number;
  us_israel_strikes_on_iran_total?: number;
  iranian_strikes_total?: number;
  [key: string]: number | undefined | Record<string, number>;
}

export interface InfrastructureBreakdown {
  education: number;
  healthcare: number;
  energy: number;
  residential: number;
}

export interface CasualtyByCountry {
  country: string;
  killed: number;
  wounded?: number;
  displaced_m?: number;
  civilians_killed?: number;
  military_killed?: number;
  children_killed?: number;
}

export interface AircraftLoss {
  type: string;
  detail: string;
  side: string;
}

export interface KeyFigureEliminated {
  name: string;
  role: string;
  date: string;
}

export interface WarDirectScoreboard {
  total_killed: number;
  total_wounded: number;
  total_displaced_m: number;
  total_affected_m: number;
  casualties_by_country: CasualtyByCountry[];
  us_israel_military: {
    targets_struck: number;
    verified_strikes: number;
    bombs_dropped: number;
    iranian_warships_sunk: number;
    senior_leaders_killed: number;
    iran_missile_launchers_destroyed_pct: number;
    bridges_severed: number;
    war_cost_b: number;
  };
  iran_axis_military: {
    strikes_on_israel_gulf: number;
    missiles_fired: number;
    us_aircraft_downed: number;
    oil_price_increase_pct: number;
    hormuz_traffic_reduction_pct: number;
  };
  aircraft_losses: AircraftLoss[];
  key_figures_eliminated: KeyFigureEliminated[];
}

export interface GlobalImpact {
  oil_price_before: number;
  oil_price_after: number;
  hormuz_traffic_before_mbpd: number;
  hormuz_traffic_reduction_pct: number;
  qatar_lng_exports: string;
  iraq_oil_before_mbpd: number;
  iraq_oil_after_mbpd: number;
  ships_stranded: number;
  iran_internet_blackout_days: number;
  iran_internet_connectivity_pct: number;
  people_facing_hunger_m: number;
  global_fertilizer_via_hormuz_pct: number;
}

export interface CeasefireEvent {
  date: string;
  event: string;
}

export interface WarMonitorStats {
  civilian_casualties_un?: number;
  killed_donbas_pre_invasion?: number;
  idp_millions?: number;
  refugees_millions?: number;
  energy_capacity_destroyed_pct?: number;
  frontline_km?: number;
  afu_personnel?: number;
  western_aid_total_b?: number;
  frozen_russian_reserves_b?: number;
  sanctions_against_russia?: number;
}

export interface TelegramArchiveStats {
  items_archived?: number;
  data_volume_tb?: number;
  date_range_start?: string;
  date_range_end?: string;
}

export interface ConflictTheater {
  id: string;
  name: string;
  code: string;
  severity: TheaterSeverity;
  status: TheaterStatus;
  overview_path: string;
  regions: string[];
  iso3_links: string[];
  start_year: number;
  summary: string;
  has_map: boolean;
  sources_tracking: string[];
  acled_stats?: AcledStats;
  war_monitor_stats?: WarMonitorStats;
  telegram_archive_stats?: TelegramArchiveStats;
  war_direct_scoreboard?: WarDirectScoreboard;
  global_impact?: GlobalImpact;
  ceasefire_timeline?: CeasefireEvent[];
  latest_report: LatestReport;
  key_developments: KeyDevelopment[];
  featured_reports: WarReportLink[];
}

/* ═══════════════════════════════════════════════════════════
   ACLED TYPES
   ═══════════════════════════════════════════════════════════ */

export interface AcledEventType {
  type: string;
  disorder_type: string;
  sub_events: string[];
}

export interface AcledConflictCategory {
  name: string;
  description: string;
}

export interface AcledMonitor {
  name: string;
  frequency: string;
  note?: string;
}

export interface AcledConflictRanking {
  rank: number;
  country: string;
  note: string;
}

export interface AcledData {
  event_types: AcledEventType[];
  conflict_categories: AcledConflictCategory[];
  actor_types: string[];
  regions: string[];
  monitors: AcledMonitor[];
  conflict_index_top: AcledConflictRanking[];
}

/* ═══════════════════════════════════════════════════════════
   WARMATCH TYPES
   ═══════════════════════════════════════════════════════════ */

export interface WarWatchClassification {
  code: string;
  name: string;
  description: string;
}

export interface WarWatchData {
  operator: string;
  funded_by: string[];
  launched: string;
  integrates: string[];
  classification_categories: WarWatchClassification[];
  counts: {
    total_armed_conflicts: number;
    international_armed_conflicts: number;
    military_occupations: number;
    non_international_armed_conflicts: number;
    countries_with_ihl_analysis: number;
  };
  ihl_themes: string[];
  violation_categories: string[];
  reporting_periods: {
    classification: string;
    ihl_compliance: string;
    data_cutoff: string;
  };
}

/* ═══════════════════════════════════════════════════════════
   LIVEUAMAP / WAR-RADAR / WAR-MONITOR TYPES
   ═══════════════════════════════════════════════════════════ */

export interface LiveUAMapData {
  founded: string;
  founders: string[];
  operator: string;
  used_by: string[];
  regions_covered: number;
  languages: string[];
  data_format: string;
  event_categories: string[];
  color_coding: Record<string, string>;
  verification: string;
  api_pricing: {
    pro: { price_per_month: number; requests_per_day: number };
    enterprise: { price_per_month: number; requests_per_day: number };
  };
  key_conflict_maps: string[];
}

export interface WarRadarSeverity {
  level: string;
  color: string;
  definition: string;
}

export interface WarRadarData {
  conflict_types: string[];
  severity_levels: WarRadarSeverity[];
  data_sources: {
    rss_feeds: string[];
    newsapi_queries: number;
    gdelt: string;
  };
  targeted_regions: string[];
}

export interface WarMonitorData {
  conflict_zones: string[];
  region_trackers: string[];
  event_categories: string[];
  sources_ingested: string[];
  features: string[];
}

/* ═══════════════════════════════════════════════════════════
   WAR.DIRECT TYPES
   ═══════════════════════════════════════════════════════════ */

export interface WarDirectData {
  conflict_name: string;
  conflict_start: string;
  conflict_day: number;
  co_built_by: string;
  people_informed: number;
  coalitions: {
    us_israel_side: { members: string[]; host_nations: string[] };
    hormuz_shipping_coalition: { nations_signed: number; key_members: string[] };
    iran_axis_side: { members: string[] };
    neutral: string[];
  };
  report_card_sections: string[];
  features: string[];
  public_opinion_us: Record<string, number>;
  data_sources: string[];
}

/* ═══════════════════════════════════════════════════════════
   TELEGRAM ARCHIVE TYPES
   ═══════════════════════════════════════════════════════════ */

export interface ThematicDataset {
  name: string;
  channels?: number;
  chats?: number;
  units?: number;
  collections?: number;
  topics?: string[];
  date?: string;
  note?: string;
}

export interface TelegramArchiveData {
  operator: string;
  coordinator: string;
  date_range: string;
  status: string;
  items_archived: number;
  channels: number;
  chats: number;
  chatbots: number;
  data_volume_tb: number;
  content_types: string[];
  geographic_coverage: string[];
  thematic_datasets: ThematicDataset[];
  partners: string[];
  access: string;
}

/* ═══════════════════════════════════════════════════════════
   GLOBAL TYPES
   ═══════════════════════════════════════════════════════════ */

export interface GlobalStats {
  active_conflicts_tracked_min: number;
  acled_yearly_events: number;
  acled_estimated_deaths_yearly: number;
  acled_countries_covered: number;
  liveuamap_regions: number;
  warwatch_conflicts: number;
  warwatch_iacs: number;
  warwatch_niacs: number;
  warwatch_occupations: number;
  wardirect_total_killed: number;
  wardirect_total_wounded: number;
  wardirect_total_displaced_m: number;
  wardirect_conflict_day: number;
  telegram_archive_items: number;
  telegram_archive_tb: number;
  isw_theaters: number;
  sources_count: number;
}

export interface WarUpdatesData {
  last_synced: string;
  sources: WarSourceMeta[];
  theaters: ConflictTheater[];
  acled: AcledData;
  warwatch: WarWatchData;
  liveuamap: LiveUAMapData;
  war_radar: WarRadarData;
  war_monitor: WarMonitorData;
  war_direct: WarDirectData;
  telegram_archive: TelegramArchiveData;
  global_statistics: GlobalStats;
}

/* ═══════════════════════════════════════════════════════════
   SEVERITY METADATA
   ═══════════════════════════════════════════════════════════ */

export const SEVERITY_META: Record<
  TheaterSeverity,
  { label: string; color: string; rank: number }
> = {
  critical: { label: "CRITICAL", color: "var(--color-blood)", rank: 3 },
  high: { label: "HIGH", color: "var(--color-warning-amber)", rank: 2 },
  moderate: { label: "MODERATE", color: "var(--color-terminal-green)", rank: 1 },
};

export const STATUS_META: Record<TheaterStatus, { label: string }> = {
  active_high_intensity: { label: "HIGH INTENSITY" },
  active_brinkmanship: { label: "BRINKMANSHIP" },
  active: { label: "ACTIVE" },
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  research_institute: "Research Institute",
  conflict_database: "Conflict Database",
  live_event_map: "Live Event Map",
  ai_conflict_monitor: "AI Conflict Monitor",
  legal_monitor: "Legal Monitor",
  osint_aggregator: "OSINT Aggregator",
  historical_archive: "Historical Archive",
};

/* ═══════════════════════════════════════════════════════════
   DATE HELPERS
   ═══════════════════════════════════════════════════════════ */

export function formatDate(iso: string): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${months[m - 1]} ${d}, ${y}`;
}

export function daysAgo(iso: string): number {
  const then = new Date(iso + "T00:00:00Z").getTime();
  const now = new Date().getTime();
  return Math.floor((now - then) / 86_400_000);
}

export function freshnessLabel(iso: string): string {
  const d = daysAgo(iso);
  if (d <= 0) return "today";
  if (d === 1) return "1d ago";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

/* ═══════════════════════════════════════════════════════════
   QUERY HELPERS
   ═══════════════════════════════════════════════════════════ */

export function countRegions(theaters: ConflictTheater[]): number {
  const set = new Set<string>();
  for (const t of theaters) {
    for (const r of t.regions) set.add(r);
  }
  return set.size;
}

export function sortTheaters(theaters: ConflictTheater[]): ConflictTheater[] {
  return [...theaters].sort((a, b) => {
    const sev = SEVERITY_META[b.severity].rank - SEVERITY_META[a.severity].rank;
    if (sev !== 0) return sev;
    return b.latest_report.date.localeCompare(a.latest_report.date);
  });
}

export function getTheater(
  data: WarUpdatesData,
  id: string,
): ConflictTheater | undefined {
  return data.theaters.find((t) => t.id === id);
}

export function getSource(
  data: WarUpdatesData,
  id: string,
): WarSourceMeta | undefined {
  return data.sources.find((s) => s.id === id);
}

export function allDevelopments(
  data: WarUpdatesData,
): (KeyDevelopment & { theater: string; theaterId: string })[] {
  const out: (KeyDevelopment & { theater: string; theaterId: string })[] = [];
  for (const t of data.theaters) {
    for (const k of t.key_developments) {
      out.push({ ...k, theater: t.name, theaterId: t.id });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export function theatersByRegion(
  data: WarUpdatesData,
  region: string,
): ConflictTheater[] {
  const q = region.toLowerCase();
  return data.theaters.filter((t) =>
    t.regions.some((r) => r.toLowerCase().includes(q)),
  );
}

export function theatersBySource(
  data: WarUpdatesData,
  sourceId: string,
): ConflictTheater[] {
  return data.theaters.filter((t) => t.sources_tracking.includes(sourceId));
}

export function severityCounts(
  data: WarUpdatesData,
): Record<TheaterSeverity, number> {
  const out: Record<TheaterSeverity, number> = {
    critical: 0,
    high: 0,
    moderate: 0,
  };
  for (const t of data.theaters) out[t.severity]++;
  return out;
}

export function countDevelopments(data: WarUpdatesData): number {
  return data.theaters.reduce((s, t) => s + t.key_developments.length, 0);
}

export function theaterToCountries(
  theater: ConflictTheater,
  countries: CountryData[],
): CountryData[] {
  return theater.iso3_links
    .map((iso3) => countries.find((c) => c.iso3 === iso3))
    .filter((c): c is CountryData => c !== undefined);
}

/** Returns all source IDs that track at least one theater. */
export function activeSourceIds(data: WarUpdatesData): string[] {
  const set = new Set<string>();
  for (const t of data.theaters) {
    for (const s of t.sources_tracking) set.add(s);
  }
  return [...set];
}
