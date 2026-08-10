/**
 * V FOR X — The Sentinel (Real-time Repression & Protest Mapping)
 *
 * Situational-awareness engine for mapping state/repressive force
 * deployments during protests in real time. Citizens drop anonymous
 * incident markers (kettle, tear gas, arrests, snipers, military
 * deployment, comms blackout...); the engine aggregates them into
 * live heat zones, clusters nearby reports, suggests escape vectors
 * away from the densest threats, and time-decays everything so the
 * map always reflects the *current* situation.
 *
 * Design principles (matches the V FOR X ethos):
 *   • Local-first & anonymous — reports live in the browser, never
 *     leave the device unless explicitly broadcast as a share token.
 *   • Time-decaying — fresh reports burn hot; stale ones cool off
 *     and auto-expire so the map can be read at a glance.
 *   • Pure functions — every computation below is deterministic and
 *     independently unit-tested in tests/sentinel.test.ts.
 */

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

export type IncidentType =
  | "kettle"
  | "teargas"
  | "arrests"
  | "checkpoint"
  | "water_cannon"
  | "mounted"
  | "plainclothes"
  | "sniper"
  | "military"
  | "live_fire"
  | "baton_charge"
  | "detention_bus"
  | "surveillance"
  | "blackout"
  | "curfew"
  | "barricade"
  | "medical"
  | "safe_corridor";

export type Severity = "info" | "low" | "moderate" | "high" | "critical";

export type IncidentCategory =
  | "force"
  | "tactic"
  | "infra"
  | "civic"
  | "aid"
  | "safe";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Incident extends LatLng {
  id: string;
  type: IncidentType;
  severity: Severity;
  ts: number;
  /** Optional time-to-live after which the incident auto-expires. */
  ttlMs?: number;
  note?: string;
  /** Estimated number of people / officers involved. */
  headcount?: number;
  /** Provenance of the report. */
  source?: "self" | "crowd" | "verified";
  /** Number of independent confirmations. */
  corroboration?: number;
}

export interface IncidentTypeMeta {
  type: IncidentType;
  label: string;
  glyph: string;
  category: IncidentCategory;
  /** Intrinsic threat weight 0..100 (how dangerous this is to civilians). */
  threat: number;
  /** Default severity when a reporter does not choose one. */
  defaultSeverity: Severity;
  description: string;
}

export interface HeatCell extends LatLng {
  /** Aggregated danger intensity 0..100. */
  intensity: number;
  /** Number of incidents contributing. */
  count: number;
}

export interface IncidentCluster {
  id: string;
  center: LatLng;
  incidents: Incident[];
  /** Aggregate effective intensity 0..100. */
  intensity: number;
  /** Dominant (most threatening) incident type in the cluster. */
  dominant: IncidentType;
  count: number;
}

export interface EscapeRoute {
  /** Bearing to travel, degrees clockwise from north. */
  bearing: number;
  /** Human-readable compass direction, e.g. "NE". */
  label: string;
  /** Distance (km) to the edge of the densest threat zone. */
  clearanceKm: number;
  /** Nearest reported safe corridor, if any. */
  nearestSafe?: LatLng & { distanceKm: number };
}

export interface SentinelSummary {
  total: number;
  active: number;
  expired: number;
  byType: Partial<Record<IncidentType, number>>;
  bySeverity: Partial<Record<Severity, number>>;
  /** Sum of headcount where the incident represents a deployed force. */
  forcesDeployed: number;
  arrestsReported: number;
  injuredReported: number;
  /** Hottest single heat cell intensity 0..100. */
  hottestIntensity: number;
  /** Number of distinct high-intensity zones (>50). */
  hotZoneCount: number;
}

/* ═══════════════════════════════════════════════════════════
   INCIDENT CATALOG
   ═══════════════════════════════════════════════════════════ */

export const INCIDENT_TYPES: Record<IncidentType, IncidentTypeMeta> = {
  live_fire: {
    type: "live_fire",
    label: "Live Fire",
    glyph: "💥",
    category: "force",
    threat: 100,
    defaultSeverity: "critical",
    description: "Gunfire or lethal force reported.",
  },
  sniper: {
    type: "sniper",
    label: "Sniper / Overwatch",
    glyph: "🎯",
    category: "force",
    threat: 85,
    defaultSeverity: "critical",
    description: "Rooftop or elevated marksman position.",
  },
  military: {
    type: "military",
    label: "Military Deployed",
    glyph: "🪖",
    category: "force",
    threat: 80,
    defaultSeverity: "critical",
    description: "Armed forces, not regular police.",
  },
  arrests: {
    type: "arrests",
    label: "Mass Arrests",
    glyph: "🚔",
    category: "force",
    threat: 70,
    defaultSeverity: "high",
    description: "Coordinated or mass detentions underway.",
  },
  detention_bus: {
    type: "detention_bus",
    label: "Detention Transport",
    glyph: "🚌",
    category: "force",
    threat: 65,
    defaultSeverity: "high",
    description: "Buses / vehicles loading detainees.",
  },
  kettle: {
    type: "kettle",
    label: "Kettle / Encirclement",
    glyph: "⭕",
    category: "tactic",
    threat: 60,
    defaultSeverity: "high",
    description: "Crowd boxed in on all sides.",
  },
  water_cannon: {
    type: "water_cannon",
    label: "Water Cannon",
    glyph: "🚿",
    category: "force",
    threat: 55,
    defaultSeverity: "high",
    description: "Pressurized water being deployed.",
  },
  baton_charge: {
    type: "baton_charge",
    label: "Baton Charge",
    glyph: "🥁",
    category: "force",
    threat: 50,
    defaultSeverity: "high",
    description: "Line advancing with batons / beating.",
  },
  plainclothes: {
    type: "plainclothes",
    label: "Plainclothes / Militia",
    glyph: "🕵️",
    category: "force",
    threat: 50,
    defaultSeverity: "high",
    description: "Unidentified armed agents or paramilitaries.",
  },
  teargas: {
    type: "teargas",
    label: "Tear Gas / Chemical",
    glyph: "☠️",
    category: "force",
    threat: 45,
    defaultSeverity: "moderate",
    description: "Chemical agents deployed.",
  },
  mounted: {
    type: "mounted",
    label: "Mounted / Cavalry",
    glyph: "🐎",
    category: "force",
    threat: 40,
    defaultSeverity: "moderate",
    description: "Mounted or vehicle-borne units charging.",
  },
  blackout: {
    type: "blackout",
    label: "Comms Blackout",
    glyph: "📵",
    category: "infra",
    threat: 35,
    defaultSeverity: "moderate",
    description: "Internet / mobile network shutdown.",
  },
  curfew: {
    type: "curfew",
    label: "Curfew Imposed",
    glyph: "🌙",
    category: "infra",
    threat: 35,
    defaultSeverity: "moderate",
    description: "Curfew or stay-at-home order declared.",
  },
  checkpoint: {
    type: "checkpoint",
    label: "Checkpoint",
    glyph: "🛑",
    category: "tactic",
    threat: 30,
    defaultSeverity: "moderate",
    description: "ID / vehicle control point.",
  },
  surveillance: {
    type: "surveillance",
    label: "Surveillance",
    glyph: "📡",
    category: "tactic",
    threat: 25,
    defaultSeverity: "low",
    description: "Drones, CCTV, or IMSI catchers observed.",
  },
  barricade: {
    type: "barricade",
    label: "Barricade",
    glyph: "🚧",
    category: "civic",
    threat: 15,
    defaultSeverity: "low",
    description: "Citizen-erected defensive barricade.",
  },
  medical: {
    type: "medical",
    label: "Field Medical / Injured",
    glyph: "🩹",
    category: "aid",
    threat: 5,
    defaultSeverity: "moderate",
    description: "Injured people or field aid point.",
  },
  safe_corridor: {
    type: "safe_corridor",
    label: "Safe Corridor",
    glyph: "🕊️",
    category: "safe",
    threat: 0,
    defaultSeverity: "info",
    description: "Confirmed open exit — pass safely.",
  },
};

/** Ordered list for UI selectors. */
export const ALL_INCIDENT_TYPES = Object.values(INCIDENT_TYPES).sort(
  (a, b) => b.threat - a.threat,
);

export const SEVERITY_INFO: Record<
  Severity,
  { label: string; multiplier: number; color: string }
> = {
  info: { label: "Info", multiplier: 0.3, color: "#3a7bd5" },
  low: { label: "Low", multiplier: 0.5, color: "#5588ff" },
  moderate: { label: "Moderate", multiplier: 0.75, color: "#ffaa00" },
  high: { label: "High", multiplier: 1.0, color: "#ff6600" },
  critical: { label: "Critical", multiplier: 1.25, color: "#ff0033" },
};

export const SEVERITY_ORDER: Severity[] = [
  "info",
  "low",
  "moderate",
  "high",
  "critical",
];

/* ═══════════════════════════════════════════════════════════
   GEO UTILITIES
   ═══════════════════════════════════════════════════════════ */

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Great-circle distance between two coordinates, in kilometres.
 * Used for heat-zone aggregation and clustering.
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Distance from a point to a line segment, in kilometres.
 * Used so escape vectors never cut straight through a threat.
 */
export function distanceToSegmentKm(p: LatLng, a: LatLng, b: LatLng): number {
  const pa = haversineKm(p, a);
  const pb = haversineKm(p, b);
  const ab = haversineKm(a, b);
  if (ab === 0) return pa;
  // Project on the equirectangular approximation good enough at city scale.
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.lng - a.lng) * (b.lng - a.lng) + (p.lat - a.lat) * (b.lat - a.lat)) /
        (ab * ab) /
        (Math.cos(toRad((a.lat + b.lat) / 2)) ** 2 + 1e-9),
    ),
  );
  if (t <= 0) return pa;
  if (t >= 1) return pb;
  const proj: LatLng = {
    lat: a.lat + t * (b.lat - a.lat),
    lng: a.lng + t * (b.lng - a.lng),
  };
  return haversineKm(p, proj);
}

/**
 * Initial bearing (degrees clockwise from north) from a to b.
 */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const COMPASS_SECTORS = [
  "N",
  "NE",
  "E",
  "SE",
  "S",
  "SW",
  "W",
  "NW",
] as const;

/** Convert a bearing in degrees to a 8-wind compass label. */
export function compassLabel(bearing: number): string {
  const idx = Math.round(bearing / 45) % 8;
  return COMPASS_SECTORS[idx];
}

/* ═══════════════════════════════════════════════════════════
   TIME DECAY & INTENSITY
   ═══════════════════════════════════════════════════════════ */

/** Default half-life: a report loses half its intensity every 30 minutes. */
export const DEFAULT_HALF_LIFE_MS = 30 * 60 * 1000;
/** Default time-to-live: incidents auto-expire after 6 hours. */
export const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

/** True if the incident's ttl has elapsed. */
export function isExpired(incident: Incident, nowMs: number): boolean {
  if (incident.ttlMs == null) return false;
  return nowMs - incident.ts >= incident.ttlMs;
}

/**
 * Exponential freshness weight 0..1.
 * A report this moment = 1.0; one half-life ago = 0.5; two = 0.25; etc.
 */
export function freshnessWeight(
  ts: number,
  nowMs: number,
  halfLifeMs: number = DEFAULT_HALF_LIFE_MS,
): number {
  const age = Math.max(0, nowMs - ts);
  if (halfLifeMs <= 0) return 1;
  return Math.pow(0.5, age / halfLifeMs);
}

/**
 * Effective danger intensity of a single incident, 0..100.
 * Combines intrinsic threat, reporter severity, freshness, and
 * corroboration (more confirmations = more credible = weighted up,
 * but capped so spam cannot inflate a zone indefinitely).
 */
export function effectiveIntensity(
  incident: Incident,
  nowMs: number,
  halfLifeMs: number = DEFAULT_HALF_LIFE_MS,
): number {
  const meta = INCIDENT_TYPES[incident.type];
  const sevMul = SEVERITY_INFO[incident.severity].multiplier;
  const fresh = freshnessWeight(incident.ts, nowMs, halfLifeMs);
  const corrob = Math.min(1.5, 1 + 0.1 * (incident.corroboration ?? 0));
  const intensity = meta.threat * sevMul * fresh * corrob;
  return Math.max(0, Math.min(100, intensity));
}

/* ═══════════════════════════════════════════════════════════
   HEAT ZONES
   ═══════════════════════════════════════════════════════════ */

/**
 * Aggregate danger intensity at a point, considering all incidents
 * within `radiusKm` (inverse-distance weighted so closer threats
 * dominate). Returns 0..100.
 */
export function computeHeatZone(
  incidents: Incident[],
  center: LatLng,
  radiusKm: number,
  nowMs: number,
  halfLifeMs: number = DEFAULT_HALF_LIFE_MS,
): { intensity: number; count: number } {
  let intensity = 0;
  let count = 0;
  for (const inc of incidents) {
    if (isExpired(inc, nowMs)) continue;
    const d = haversineKm(center, inc);
    if (d > radiusKm) continue;
    // Linear falloff: full weight at center, zero at the radius edge.
    const falloff = 1 - d / radiusKm;
    intensity += effectiveIntensity(inc, nowMs, halfLifeMs) * falloff;
    count += 1;
  }
  return { intensity: Math.max(0, Math.min(100, intensity)), count };
}

export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export function boundsOf(points: LatLng[]): GeoBounds {
  if (points.length === 0) {
    return { minLat: -60, maxLat: 70, minLng: -180, maxLng: 180 };
  }
  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Sample the incidents onto a regular lat/lng grid of heat cells.
 * Each cell's intensity is the inverse-distance-weighted aggregate
 * (see computeHeatZone). Designed for rendering as overlapping
 * translucent circles — the classic "heat blob" effect.
 */
export function generateHeatGrid(
  incidents: Incident[],
  bounds: GeoBounds,
  cellDeg: number,
  radiusKm: number,
  nowMs: number,
  halfLifeMs: number = DEFAULT_HALF_LIFE_MS,
): HeatCell[] {
  const cells: HeatCell[] = [];
  const live = incidents.filter((i) => !isExpired(i, nowMs));
  if (live.length === 0) return cells;

  const latStart = Math.floor(bounds.minLat / cellDeg) * cellDeg;
  const latEnd = Math.ceil(bounds.maxLat / cellDeg) * cellDeg;
  const lngStart = Math.floor(bounds.minLng / cellDeg) * cellDeg;
  const lngEnd = Math.ceil(bounds.maxLng / cellDeg) * cellDeg;

  for (let lat = latStart; lat <= latEnd; lat += cellDeg) {
    for (let lng = lngStart; lng <= lngEnd; lng += cellDeg) {
      const { intensity, count } = computeHeatZone(
        live,
        { lat: lat + cellDeg / 2, lng: lng + cellDeg / 2 },
        radiusKm,
        nowMs,
        halfLifeMs,
      );
      if (intensity > 1) {
        cells.push({
          lat: lat + cellDeg / 2,
          lng: lng + cellDeg / 2,
          intensity,
          count,
        });
      }
    }
  }
  return cells.sort((a, b) => b.intensity - a.intensity);
}

/* ═══════════════════════════════════════════════════════════
   CLUSTERING (union-find by spatial proximity)
   ═══════════════════════════════════════════════════════════ */

class UnionFind {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }
}

/**
 * Group incidents within `thresholdKm` of one another into clusters.
 * Each cluster's center is the intensity-weighted centroid, and its
 * dominant type is the highest-threat contributing incident.
 */
export function clusterIncidents(
  incidents: Incident[],
  thresholdKm: number,
  nowMs: number,
  halfLifeMs: number = DEFAULT_HALF_LIFE_MS,
): IncidentCluster[] {
  const live = incidents.filter((i) => !isExpired(i, nowMs));
  const n = live.length;
  if (n === 0) return [];
  const uf = new UnionFind(n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (haversineKm(live[i], live[j]) <= thresholdKm) uf.union(i, j);
    }
  }
  const groups = new Map<number, Incident[]>();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(live[i]);
  }
  const clusters: IncidentCluster[] = [];
  for (const [root, members] of groups) {
    let totalI = 0;
    let sumLat = 0,
      sumLng = 0,
      sumW = 0;
    let dominant: Incident = members[0];
    let dominantI = -1;
    for (const inc of members) {
      const w = effectiveIntensity(inc, nowMs, halfLifeMs);
      totalI += w;
      sumLat += inc.lat * (w + 1);
      sumLng += inc.lng * (w + 1);
      sumW += w + 1;
      if (w > dominantI) {
        dominantI = w;
        dominant = inc;
      }
    }
    clusters.push({
      id: `cluster-${root}`,
      center: { lat: sumLat / sumW, lng: sumLng / sumW },
      incidents: members,
      intensity: Math.max(0, Math.min(100, totalI)),
      dominant: dominant.type,
      count: members.length,
    });
  }
  return clusters.sort((a, b) => b.intensity - a.intensity);
}

/* ═══════════════════════════════════════════════════════════
   ESCAPE / SAFETY ROUTING
   ═══════════════════════════════════════════════════════════ */

/**
 * Suggest an escape vector from `from`, steering away from the
 * densest threat cluster within `radiusKm`. Falls back to bearing
 * toward the nearest confirmed safe corridor when available.
 */
export function suggestEscapeRoute(
  from: LatLng,
  incidents: Incident[],
  nowMs: number,
  radiusKm: number = 1.5,
  halfLifeMs: number = DEFAULT_HALF_LIFE_MS,
): EscapeRoute {
  const clusters = clusterIncidents(incidents, radiusKm, nowMs, halfLifeMs);
  const nearby = clusters.filter(
    (c) =>
      c.intensity > 10 &&
      INCIDENT_TYPES[c.dominant].category !== "safe" &&
      haversineKm(from, c.center) <= radiusKm * 3,
  );

  // Nearest safe corridor to head toward.
  const safeCorridors = incidents.filter(
    (i) => i.type === "safe_corridor" && !isExpired(i, nowMs),
  );
  let nearestSafe: EscapeRoute["nearestSafe"];
  if (safeCorridors.length > 0) {
    let best = safeCorridors[0];
    let bestD = haversineKm(from, best);
    for (const s of safeCorridors) {
      const d = haversineKm(from, s);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    nearestSafe = { lat: best.lat, lng: best.lng, distanceKm: bestD };
  }

  if (nearby.length === 0) {
    // No acute threat — if a safe corridor exists head to it, else hold.
    return {
      bearing: nearestSafe ? bearingDeg(from, nearestSafe) : 0,
      label: nearestSafe
        ? compassLabel(bearingDeg(from, nearestSafe))
        : "HOLD",
      clearanceKm: nearestSafe ? nearestSafe.distanceKm : 0,
      nearestSafe,
    };
  }

  // Weighted "centre of mass" of all nearby threats → flee the opposite way.
  let tLat = 0,
    tLng = 0,
    tW = 0;
  for (const c of nearby) {
    const w = c.intensity;
    tLat += c.center.lat * w;
    tLng += c.center.lng * w;
    tW += w;
  }
  const threatCenter: LatLng = { lat: tLat / tW, lng: tLng / tW };
  const toThreat = bearingDeg(from, threatCenter);
  const fleeBearing = (toThreat + 180) % 360;
  const clearanceKm = haversineKm(from, threatCenter);

  // If a safe corridor lies roughly in the flee direction, prefer it.
  if (nearestSafe) {
    const toSafe = bearingDeg(from, nearestSafe);
    const diff = Math.abs(angleDelta(toSafe, fleeBearing));
    if (diff <= 90) {
      return {
        bearing: toSafe,
        label: `${compassLabel(toSafe)} → SAFE`,
        clearanceKm,
        nearestSafe,
      };
    }
  }

  return {
    bearing: fleeBearing,
    label: compassLabel(fleeBearing),
    clearanceKm,
    nearestSafe,
  };
}

/** Smallest absolute difference between two bearings (0..180). */
function angleDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/* ═══════════════════════════════════════════════════════════
   SUMMARIES & FILTERING
   ═══════════════════════════════════════════════════════════ */

export function purgeExpired(
  incidents: Incident[],
  nowMs: number,
): Incident[] {
  return incidents.filter((i) => !isExpired(i, nowMs));
}

export function summarize(
  incidents: Incident[],
  nowMs: number,
  halfLifeMs: number = DEFAULT_HALF_LIFE_MS,
): SentinelSummary {
  const byType: Partial<Record<IncidentType, number>> = {};
  const bySeverity: Partial<Record<Severity, number>> = {};
  let forcesDeployed = 0;
  let arrestsReported = 0;
  let injuredReported = 0;
  let active = 0;
  let expired = 0;

  for (const inc of incidents) {
    byType[inc.type] = (byType[inc.type] ?? 0) + 1;
    bySeverity[inc.severity] = (bySeverity[inc.severity] ?? 0) + 1;
    if (isExpired(inc, nowMs)) {
      expired += 1;
      continue;
    }
    active += 1;
    const cat = INCIDENT_TYPES[inc.type].category;
    if (cat === "force" || cat === "tactic" || cat === "infra") {
      forcesDeployed += inc.headcount ?? 0;
    }
    if (inc.type === "arrests" || inc.type === "detention_bus") {
      arrestsReported += inc.headcount ?? 0;
    }
    if (inc.type === "medical") {
      injuredReported += inc.headcount ?? 0;
    }
  }

  const live = incidents.filter((i) => !isExpired(i, nowMs));
  // Peak heat = the strongest aggregate intensity sampled at any live
  // incident's own location (0.5 km neighbourhood), grid-independent.
  let hottestIntensity = 0;
  for (const inc of live) {
    const z = computeHeatZone(live, inc, 0.5, nowMs, halfLifeMs);
    if (z.intensity > hottestIntensity) hottestIntensity = z.intensity;
  }
  // A "hot zone" is any spatial cluster whose aggregate intensity > 50.
  const hotZoneCount = clusterIncidents(live, 0.75, nowMs, halfLifeMs).filter(
    (c) => c.intensity > 50,
  ).length;

  return {
    total: incidents.length,
    active,
    expired,
    byType,
    bySeverity,
    forcesDeployed,
    arrestsReported,
    injuredReported,
    hottestIntensity,
    hotZoneCount,
  };
}

/** A live, severity-and-freshness-ordered view of incidents for the feed. */
export function liveFeed(
  incidents: Incident[],
  nowMs: number,
  halfLifeMs: number = DEFAULT_HALF_LIFE_MS,
): Incident[] {
  return incidents
    .filter((i) => !isExpired(i, nowMs))
    .map((i) => ({
      i,
      score: effectiveIntensity(i, nowMs, halfLifeMs),
    }))
    .sort((a, b) => b.score - a.score || b.i.ts - a.i.ts)
    .map((x) => x.i);
}

/* ═══════════════════════════════════════════════════════════
   FACTORY + SEED DATA
   ═══════════════════════════════════════════════════════════ */

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createIncident(
  input: Omit<Incident, "id" | "ts"> & { ts?: number },
): Incident {
  return {
    id: uuid(),
    ts: input.ts ?? Date.now(),
    ...input,
  };
}

/**
 * Realistic demo dataset scattered across well-documented protest
 * cities, so the map is informative on first load. Timestamps are
 * relative to `nowMs` so reports always read as "minutes ago".
 */
export function seedIncidents(nowMs: number = Date.now()): Incident[] {
  const ago = (mins: number) => nowMs - mins * 60 * 1000;
  const mk = (
    type: IncidentType,
    lat: number,
    lng: number,
    minsAgo: number,
    severity: Severity,
    note: string,
    headcount?: number,
  ): Incident =>
    createIncident({
      type,
      lat,
      lng,
      ts: ago(minsAgo),
      severity,
      note,
      headcount,
      source: "crowd",
      corroboration: Math.floor(Math.random() * 4),
    });

  return [
    // ── Tehran (Mahsa/Jina uprising geometry) ──
    mk("teargas", 35.7153, 51.4085, 4, "moderate", "Tear gas fired at junction near Enghelab St.", 0),
    mk("live_fire", 35.7129, 51.4122, 7, "critical", "Live rounds reported; confirmed injuries.", 0),
    mk("kettle", 35.7101, 51.3998, 12, "high", "Crowd boxed in on three sides; one exit open south.", 0),
    mk("detention_bus", 35.7087, 51.4061, 18, "high", "Green bus loading detainees.", 40),
    mk("surveillance", 35.7188, 51.4090, 25, "low", "Drone overwatch circling the square.", 0),
    mk("safe_corridor", 35.7055, 51.3950, 9, "info", "Side street open — volunteers guiding people out.", 0),

    // ── Khartoum (RSF / sit-in dispersal geometry) ──
    mk("military", 15.6081, 32.5318, 15, "critical", "RSF vehicles deployed; heavy presence.", 80),
    mk("baton_charge", 15.6024, 32.5262, 20, "high", "Line advancing on sit-in from the river side.", 0),
    mk("medical", 15.5998, 32.5241, 11, "moderate", "Field clinic overwhelmed; need stretchers.", 12),
    mk("blackout", 15.6100, 32.5400, 33, "moderate", "Mobile data cut across the district.", 0),

    // ── Yangon (anti-coup geometry) ──
    mk("plainclothes", 16.8409, 96.1735, 22, "high", "Unmarked men seizing demonstrators.", 0),
    mk("checkpoint", 16.8302, 96.1599, 40, "moderate", "ID checks; phones being confiscated.", 0),
    mk("barricade", 16.8351, 96.1655, 6, "low", "Citizens' barricade holding the avenue.", 0),

    // ── Paris (pension / banlieue geometry) ──
    mk("water_cannon", 48.8675, 2.3475, 8, "high", "Water cannon deployed at Place de la République.", 0),
    mk("mounted", 48.8690, 2.3490, 13, "moderate", "Mounted unit flanking the march.", 0),
    mk("arrests", 48.8658, 2.3455, 17, "high", "Coordinated arrests of front-line group.", 35),
  ];
}

/** Heat color for a 0..100 intensity, interpolated green → amber → blood. */
export function heatColor(intensity: number): string {
  const v = Math.max(0, Math.min(100, intensity)) / 100;
  if (v < 0.5) {
    // green → amber
    const t = v / 0.5;
    const r = Math.round(0x55 + (0xff - 0x55) * t);
    const g = Math.round(0x88 + (0xaa - 0x88) * t);
    const b = Math.round(0xff - 0xff * t);
    return `rgb(${r},${g},${b})`;
  }
  // amber → blood red
  const t = (v - 0.5) / 0.5;
  const r = 0xff;
  const g = Math.round(0xaa - 0xaa * t);
  const b = Math.round(0x00 + 0x33 * t);
  return `rgb(${r},${g},${b})`;
}
