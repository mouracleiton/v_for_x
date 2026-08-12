/**
 * V FOR X — Trail Auto-Match (needs ↔ offers)
 *
 * Matches resource needs against offers using geographic proximity,
 * category fit, and tag overlap — fully offline, no server.
 *
 * The Trail is the mutual-aid routing layer: people post what they
 * need (food, medicine, transport, shelter) and what they can offer.
 * This module finds the best pairings so aid reaches people without
 * a central dispatcher.
 *
 * Every match is scored 0..1 and ranked. A match is only suggested
 * when score exceeds a configurable threshold. No data leaves the
 * device; matching runs over the local list of entries.
 */

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export type TrailEntryType = "need" | "offer";

export interface TrailEntry {
  /** Stable id. */
  id: string;
  /** Whether this is a request or a supply. */
  type: TrailEntryType;
  /** Resource category, e.g. "food", "medical", "shelter", "transport". */
  category: string;
  /** Specific item description, e.g. "insulin", "bottled water". */
  item: string;
  /** ISO3 country code. */
  iso3: string;
  /** Optional latitude. */
  lat?: number;
  /** Optional longitude. */
  lon?: number;
  /** Free-text tags for fuzzy matching. */
  tags?: string[];
  /** Quantity offered or needed (string keeps units flexible). */
  qty?: string;
  /** Pseudonymous handle of the poster. */
  handle?: string;
  /** Epoch ms when posted. */
  ts: number;
}

export interface TrailMatch {
  need: TrailEntry;
  offer: TrailEntry;
  /** Overall score 0..1 (higher = better). */
  score: number;
  /** Distance in km (null if either side lacks coordinates). */
  distanceKm: number | null;
  /** How many tags overlapped. */
  tagOverlap: string[];
  /** Category matched exactly. */
  categoryMatch: boolean;
  /** Human-readable reason summary. */
  reason: string;
}

export interface MatchOptions {
  /** Maximum distance in km to consider a match (ignored if null). */
  maxDistanceKm?: number | null;
  /** Minimum score to include (default 0.2). */
  minScore?: number;
  /** Weight for category match (default 0.4). */
  categoryWeight?: number;
  /** Weight for tag overlap (default 0.3). */
  tagWeight?: number;
  /** Weight for geographic proximity (default 0.3). */
  geoWeight?: number;
  /** Limit number of returned matches (default 50). */
  limit?: number;
}

/* ═══════════════════════════════════════════════════════════════
   Geography — Haversine
   ═══════════════════════════════════════════════════════════════ */

const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance between two lat/lon points in kilometres.
 * Returns 0 if any coordinate is missing or invalid.
 */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (
    !Number.isFinite(lat1) || !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) || !Number.isFinite(lon2)
  ) {
    return 0;
  }
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/* ═══════════════════════════════════════════════════════════════
   Scoring helpers
   ═══════════════════════════════════════════════════════════════ */

/** Normalize a tag list to lowercase, trimmed, deduped. */
export function normalizeTags(tags?: string[]): string[] {
  if (!tags || !Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const n = String(t ?? "").trim().toLowerCase();
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/** Return tags present in both lists (normalized). */
export function tagIntersection(a: string[], b: string[]): string[] {
  const setB = new Set(normalizeTags(b));
  return normalizeTags(a).filter((t) => setB.has(t));
}

/**
 * Geographic proximity score 0..1.
 * 1.0 when the two points coincide, decaying linearly to 0 at maxKm.
 * Returns null when either side lacks coordinates.
 */
export function geoScore(
  need: TrailEntry,
  offer: TrailEntry,
  maxKm: number,
): number | null {
  if (
    need.lat == null || need.lon == null ||
    offer.lat == null || offer.lon == null
  ) {
    return null;
  }
  const dist = haversineKm(need.lat, need.lon, offer.lat, offer.lon);
  if (maxKm <= 0) return dist === 0 ? 1 : 0;
  return Math.max(0, 1 - dist / maxKm);
}

/* ═══════════════════════════════════════════════════════════════
   Core matching
   ═══════════════════════════════════════════════════════════════ */

/**
 * Score a single need↔offer pair.
 *
 * The score blends three signals:
 *   • category match (exact string equality after normalization),
 *   • tag overlap (Jaccard over normalized tag sets),
 *   • geographic proximity (linear decay within maxKm).
 *
 * When geography is unavailable the category and tag weights are
 * renormalized so the total still falls in 0..1.
 */
export function scorePair(
  need: TrailEntry,
  offer: TrailEntry,
  opts: MatchOptions = {},
): TrailMatch | null {
  if (need.type !== "need" || offer.type !== "offer") return null;

  const maxKm = opts.maxDistanceKm ?? 500;
  const catWeight = opts.categoryWeight ?? 0.4;
  const tagWeight = opts.tagWeight ?? 0.3;
  const geoWeight = opts.geoWeight ?? 0.3;

  // Category match
  const catMatch =
    need.category.trim().toLowerCase() === offer.category.trim().toLowerCase();
  const catScore = catMatch ? 1 : 0;

  // Tag Jaccard
  const needTags = normalizeTags(need.tags);
  const offerTags = normalizeTags(offer.tags);
  const overlap = tagIntersection(needTags, offerTags);
  const union = new Set([...needTags, ...offerTags]);
  const tagScore = union.size > 0 ? overlap.length / union.size : 0;

  // Geography
  const g = geoScore(need, offer, maxKm);
  const hasGeo = g !== null;

  // Renormalize weights when geo is unavailable
  const effGeo = hasGeo ? geoWeight : 0;
  const weightSum = catWeight + tagWeight + effGeo;
  const norm = weightSum > 0 ? 1 / weightSum : 1;

  let distanceKm: number | null = null;
  let geoVal = 0;
  if (hasGeo) {
    geoVal = g as number;
    distanceKm = haversineKm(
      need.lat as number, need.lon as number,
      offer.lat as number, offer.lon as number,
    );
  }

  const score =
    (catScore * catWeight + tagScore * tagWeight + geoVal * effGeo) * norm;

  // Build human-readable reason
  const parts: string[] = [];
  if (catMatch) parts.push("category match");
  if (overlap.length > 0) parts.push(`${overlap.length} shared tag${overlap.length > 1 ? "s" : ""}`);
  if (distanceKm !== null) parts.push(`${distanceKm.toFixed(0)} km apart`);
  const reason = parts.length > 0 ? parts.join(", ") : "weak similarity";

  return {
    need,
    offer,
    score,
    distanceKm,
    tagOverlap: overlap,
    categoryMatch: catMatch,
    reason,
  };
}

/**
 * Find the best offers for a single need, ranked by score.
 */
export function findOffersForNeed(
  need: TrailEntry,
  entries: TrailEntry[],
  opts: MatchOptions = {},
): TrailMatch[] {
  const minScore = opts.minScore ?? 0.2;
  const limit = opts.limit ?? 50;
  const matches: TrailMatch[] = [];
  for (const offer of entries) {
    if (offer.type !== "offer") continue;
    const m = scorePair(need, offer, opts);
    if (m && m.score >= minScore) matches.push(m);
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}

/**
 * Find the best needs for a single offer, ranked by score.
 */
export function findNeedsForOffer(
  offer: TrailEntry,
  entries: TrailEntry[],
  opts: MatchOptions = {},
): TrailMatch[] {
  const minScore = opts.minScore ?? 0.2;
  const limit = opts.limit ?? 50;
  const matches: TrailMatch[] = [];
  for (const need of entries) {
    if (need.type !== "need") continue;
    const m = scorePair(need, offer, opts);
    if (m && m.score >= minScore) matches.push(m);
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}

/**
 * Match all needs against all offers in a list.
 * Returns every qualifying pair, sorted by score descending.
 */
export function matchAll(
  entries: TrailEntry[],
  opts: MatchOptions = {},
): TrailMatch[] {
  const needs = entries.filter((e) => e.type === "need");
  const offers = entries.filter((e) => e.type === "offer");
  const minScore = opts.minScore ?? 0.2;
  const limit = opts.limit ?? 50;
  const matches: TrailMatch[] = [];
  for (const need of needs) {
    for (const offer of offers) {
      const m = scorePair(need, offer, opts);
      if (m && m.score >= minScore) matches.push(m);
    }
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}

/**
 * Build a one-line summary of a match for display.
 */
export function summarizeMatch(m: TrailMatch): string {
  const item = m.offer.item || m.offer.category;
  const dist = m.distanceKm !== null ? ` (${m.distanceKm.toFixed(0)} km)` : "";
  return `${m.score.toFixed(2)} → ${item}${dist} [${m.reason}]`;
}
