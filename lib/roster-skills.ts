/**
 * V FOR X — Roster Skills Taxonomy + Geo Radius + Vouch Graph
 *
 * Extends The Roster with three trust-by-proximity capabilities so an
 * operator can find the *right* helper fast, offline:
 *
 *   1. SKILLS TAXONOMY — match a need ("I need an asylum lawyer who
 *      speaks Farsi") against helper specialties using a normalized
 *      skill tree + fuzzy keyword overlap.
 *   2. GEO RADIUS — find helpers within N km of a point, using the
 *      country centroids (no per-helper GPS needed). Reuses the
 *      Haversine math from lib/trail-match.ts.
 *   3. VOUCH GRAPH — compute each helper's trust depth: how many
 *      distinct identities vouch for them, and how deep the vouch
 *      chain runs (1-hop, 2-hop…), so a lone self-vouch can't masquerade
 *      as broad community trust.
 *
 * All offline, no accounts. The roster ships as static JSON.
 */

import type { Helper } from "./roster";
import { haversineKm } from "./trail-match";
import type { Lang } from "./i18n";

/* ═══════════════════════════════════════════════════════════════
   Skill taxonomy
   ═══════════════════════════════════════════════════════════════ */

/** Canonical skill buckets every specialty maps to. */
export type SkillBucket =
  | "legal"
  | "medical"
  | "security"
  | "logistics"
  | "translation"
  | "tech"
  | "journalism"
  | "psychosocial"
  | "finance"
  | "coordination"
  | "other";

const SKILL_KEYWORDS: Record<SkillBucket, string[]> = {
  legal: ["lawyer", "legal", "asylum", "refugee", "detention", "immigration", "appeal", "reunification", "solicitor", "attorney", "rights"],
  medical: ["doctor", "medical", "medic", "nurse", "clinic", "trauma", "psychiat", "health", "pharma", "telemedicine", "emergency medicine"],
  security: ["security", "digital security", "opsec", "cyber", "encryption", "vpn", "threat", "safe", "protection"],
  logistics: ["logistics", "transport", "convoy", "supply", "delivery", "driver", "warehouse", "routing"],
  translation: ["translation", "translator", "interpret", "language", "linguist"],
  tech: ["developer", "engineer", "software", "sysadmin", "data", "network", "infrastructure"],
  journalism: ["journalist", "report", "investigat", "media", "press", "editor", "osint", "forensic"],
  psychosocial: ["psychosocial", "counsel", "trauma support", "social work", "mental health", "support"],
  finance: ["finance", "accounting", "grant", "funding", "audit", "compliance"],
  coordination: ["coordination", "coordination", "ngo", "field", "operations", "logistics coordinator"],
  other: [],
};

/** Classify a free-text specialty into one or more skill buckets. */
export function classifySpecialty(specialty: string): SkillBucket[] {
  const lower = specialty.toLowerCase();
  const buckets: SkillBucket[] = [];
  for (const [bucket, keywords] of Object.entries(SKILL_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) buckets.push(bucket as SkillBucket);
  }
  return buckets.length > 0 ? buckets : ["other"];
}

/** All skill buckets a helper covers (union over their specialties). */
export function helperSkills(helper: Helper): SkillBucket[] {
  const set = new Set<SkillBucket>();
  for (const s of helper.specialties ?? []) {
    for (const b of classifySpecialty(s)) set.add(b);
  }
  return Array.from(set);
}

export interface SkillQuery {
  /** Free-text skill need, e.g. "asylum lawyer Farsi". */
  query?: string;
  /** Required skill buckets (AND not enforced — any match scores). */
  buckets?: SkillBucket[];
  /** Required language codes (ISO 639-1). */
  languages?: Lang[];
  /** Required country (ISO3). */
  country?: string;
  /** Only available helpers. */
  availableOnly?: boolean;
}

export interface SkillMatch {
  helper: Helper;
  /** 0..1 overall score. */
  score: number;
  /** Matched skill buckets. */
  matchedBuckets: SkillBucket[];
  /** Matched language codes. */
  matchedLanguages: Lang[];
  /** Keyword overlap from the free-text query. */
  keywordHits: string[];
}

/** Normalize text into lowercase keyword tokens. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

/**
 * Rank helpers against a skill query. Returns matches sorted by score.
 * Score blends bucket overlap, language coverage, country, and keyword
 * relevance.
 */
export function searchBySkills(helpers: Helper[], query: SkillQuery): SkillMatch[] {
  const queryTokens = query.query ? tokenize(query.query) : [];
  const queryBuckets = new Set(query.buckets ?? []);
  const requiredLangs = new Set(query.languages ?? []);

  const matches: SkillMatch[] = [];
  for (const helper of helpers) {
    if (query.availableOnly && helper.availability !== "available") continue;
    if (query.country && helper.country !== query.country) continue;

    const skills = helperSkills(helper);
    const matchedBuckets = queryBuckets.size > 0
      ? skills.filter((b) => queryBuckets.has(b))
      : skills;

    const helperLangs = new Set((helper.languages ?? []) as Lang[]);
    const matchedLanguages = (query.languages ?? []).filter((l) => helperLangs.has(l));
    // If languages were required, a helper with none of them scores 0.
    if (requiredLangs.size > 0 && matchedLanguages.length === 0) continue;

    // Keyword relevance: how many query tokens appear in specialties.
    const specText = (helper.specialties ?? []).join(" ").toLowerCase();
    const keywordHits = queryTokens.filter((t) => specText.includes(t));

    // Score: bucket overlap (0.4) + language coverage (0.3) + keywords (0.3)
    const bucketScore = queryBuckets.size > 0
      ? matchedBuckets.length / queryBuckets.size
      : Math.min(1, skills.length / 3);
    const langScore = requiredLangs.size > 0
      ? matchedLanguages.length / requiredLangs.size
      : 1;
    const keywordScore = queryTokens.length > 0
      ? Math.min(1, keywordHits.length / Math.max(1, queryTokens.length))
      : 0.5;

    const score = bucketScore * 0.4 + langScore * 0.3 + keywordScore * 0.3;
    if (score <= 0) continue;

    matches.push({ helper, score, matchedBuckets, matchedLanguages, keywordHits });
  }

  matches.sort((a, b) => b.score - a.score);
  return matches;
}

/* ═══════════════════════════════════════════════════════════════
   Geo radius
   ═══════════════════════════════════════════════════════════════ */

export interface GeoResult {
  helper: Helper;
  /** Distance in km (0 if country-only with no centroid match). */
  distanceKm: number;
}

/**
 * Find helpers within `radiusKm` of a point. Helpers carry an ISO3
 * country; we look up that country's centroid and measure from there.
 * This is deliberately coarse (country-level) to preserve privacy —
 * no per-helper coordinates are stored.
 *
 * @param centroids map of ISO3 → { lat, lon }
 */
export function searchByRadius(
  helpers: Helper[],
  lat: number,
  lon: number,
  radiusKm: number,
  centroids: Record<string, { lat: number; lon: number }>,
): GeoResult[] {
  const results: GeoResult[] = [];
  for (const helper of helpers) {
    const c = centroids[helper.country];
    if (!c) continue;
    const dist = haversineKm(lat, lon, c.lat, c.lon);
    if (dist <= radiusKm) results.push({ helper, distanceKm: dist });
  }
  results.sort((a, b) => a.distanceKm - b.distanceKm);
  return results;
}

/* ═══════════════════════════════════════════════════════════════
   Vouch graph
   ═══════════════════════════════════════════════════════════════ */

export interface VouchTrust {
  /** Helper id. */
  helperId: string;
  /** Number of distinct vouching identities (unique public keys). */
  distinctVouchers: number;
  /** Depth of the longest vouch chain reaching this helper. */
  vouchDepth: number;
  /** Trust tier label. */
  tier: "self" | "vouched" | "trusted" | "well-vouched";
}

/**
 * Compute vouch trust for each helper. A vouch is a directed edge
 * from the voucher's handle → the helper. Distinct vouchers are
 * counted by unique public key (so one identity can't inflate trust).
 *
 * Depth is the longest chain of vouches that reaches a helper
 * (A vouches B, B vouches C → depth 2 for C). Capped at a sane limit.
 */
export function computeVouchTrust(helpers: Helper[]): Map<string, VouchTrust> {
  const byHandle = new Map<string, Helper>();
  for (const h of helpers) byHandle.set(h.handle, h);

  // Build edges: voucher handle → set of helper ids they vouched for.
  const edges = new Map<string, Set<string>>();
  // distinct vouchers per helper (by public key)
  const distinctKeys = new Map<string, Set<string>>();
  for (const h of helpers) {
    for (const v of h.vouches ?? []) {
      const target = byHandle.get(v.byHandle)?.id ?? h.id;
      if (!edges.has(v.byHandle)) edges.set(v.byHandle, new Set());
      edges.get(v.byHandle)!.add(target);
      if (!distinctKeys.has(target)) distinctKeys.set(target, new Set());
      if (v.byPublicKey) distinctKeys.get(target)!.add(v.byPublicKey);
    }
  }

  // Depth via longest-path DP (DAG-ish; cap to avoid cycles).
  const MAX_DEPTH = 6;
  const depthCache = new Map<string, number>();
  const computeDepth = (helperId: string, visiting: Set<string>): number => {
    if (depthCache.has(helperId)) return depthCache.get(helperId)!;
    if (visiting.has(helperId)) return 0; // cycle guard
    // Who vouches FOR this helper?
    let best = 0;
    visiting.add(helperId);
    for (const [voucherHandle, targets] of edges.entries()) {
      if (targets.has(helperId)) {
        const voucherHelper = byHandle.get(voucherHandle);
        if (voucherHelper) {
          const d = computeDepth(voucherHelper.id, visiting);
          if (d + 1 > best) best = d + 1;
        } else {
          best = Math.max(best, 1);
        }
      }
    }
    visiting.delete(helperId);
    if (best > MAX_DEPTH) best = MAX_DEPTH;
    depthCache.set(helperId, best);
    return best;
  };

  const out = new Map<string, VouchTrust>();
  for (const h of helpers) {
    const keys = distinctKeys.get(h.id) ?? new Set<string>();
    const distinctVouchers = keys.size;
    const vouchDepth = computeDepth(h.id, new Set());
    let tier: VouchTrust["tier"] = "self";
    if (distinctVouchers >= 3) tier = "well-vouched";
    else if (distinctVouchers >= 2) tier = "trusted";
    else if (distinctVouchers >= 1) tier = "vouched";
    out.set(h.id, { helperId: h.id, distinctVouchers, vouchDepth, tier });
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════
   Display helpers
   ═══════════════════════════════════════════════════════════════ */

export function describeSkillMatch(m: SkillMatch): string {
  const langs = m.matchedLanguages.length > 0 ? ` · ${m.matchedLanguages.join(",")}` : "";
  const buckets = m.matchedBuckets.length > 0 ? ` [${m.matchedBuckets.join(",")}]` : "";
  return `${m.helper.handle} · ${(m.score * 100).toFixed(0)}%${buckets}${langs}`;
}

export function tierLabel(tier: VouchTrust["tier"]): string {
  switch (tier) {
    case "well-vouched": return "★★★ well-vouched";
    case "trusted": return "★★ trusted";
    case "vouched": return "★ vouched";
    default: return "self-attested only";
  }
}
