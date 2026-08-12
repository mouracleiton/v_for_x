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

/* ═══════════════════════════════════════════════════════════════
   Amplitude allocation
   (Phase 26 A — Quantum P2P Squad adaptation)
   ═══════════════════════════════════════════════════════════════ */

import {
  sovereigntyFriction,
  FRICTION_MULTIPLIER,
  type FrictionLevel,
  type RelationshipsData,
} from "./relationships";

/** Deterministic seedable RNG so the same inputs yield the same pick. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string into a 32-bit seed (FNV-1a). */
export function seedFromString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface AmplitudeTask {
  /** Free-text skill need, e.g. "asylum lawyer Farsi". */
  query?: string;
  /** Required skill buckets. */
  buckets?: SkillBucket[];
  /** Required languages. */
  languages?: Lang[];
  /** Destination ISO3 — used for sovereignty friction lookup. */
  destinationIso3?: string;
}

export interface AmplitudeWeights {
  /** Per-helper skill match (0..1), e.g. from searchBySkills(). */
  skillMatch?: Record<string, number>;
  /** Vouch tier per helper id (drives exposure-risk damping). */
  vouchTier?: Record<string, VouchTrust["tier"]>;
  /** Ops-journal recent-activity count per helper id (higher = more exposed). */
  recentActivity?: Record<string, number>;
  /** Relationships data for sovereignty-friction lookup. */
  relationships?: RelationshipsData;
}

export interface AmplitudeCandidate {
  helper: Helper;
  /** Raw amplitude weight before |w|² collapse. */
  weight: number;
  /** Sovereignty friction applied on the helper→destination corridor. */
  friction: FrictionLevel;
  /** Derived exposure-risk factor (0..1, higher = more exposed). */
  exposureRisk: number;
}

export interface AmplitudeAllocation {
  /** Ranked candidates (highest amplitude first). */
  candidates: AmplitudeCandidate[];
  /** Picked helper id (|w|² collapse over candidates). */
  picked: string;
  /** Seed used for the deterministic RNG. */
  seed: number;
  /** VFXAMP1 serialized token. */
  token: string;
}

const TIER_FACTOR: Record<VouchTrust["tier"], number> = {
  "well-vouched": 1,
  trusted: 0.8,
  vouched: 0.6,
  self: 0.4,
};

/** Map a vouch tier + recent-activity count into an exposure-risk factor 0..1. */
export function exposureRisk(
  tier: VouchTrust["tier"] | undefined,
  recentActivity: number | undefined,
): number {
  // Higher tier trust → slightly LOWER baseline exposure risk (better opsec).
  // More recent activity → HIGHER exposure (more visible on the network).
  const tierBase = tier ? 1 - (TIER_FACTOR[tier] ?? 0.5) : 0.5;
  const activity = Math.min(1, (recentActivity ?? 0) / 10);
  return Math.min(1, Math.max(0, tierBase * 0.4 + activity * 0.6));
}

/**
 * Allocate a helper by amplitude: weight_i = skill_match_i · sovereignty_compat_i ·
 * (1 − exposure_risk_i); collapse samples ∝ |weight_i|² via a seedable RNG so
 * the same inputs always pick the same helper (no real randomness in static
 * export). Returns VFXAMP1 token for verifiability.
 */
export function allocateByAmplitude(
  helpers: Helper[],
  task: AmplitudeTask,
  weights: AmplitudeWeights = {},
  seed?: number,
): AmplitudeAllocation | null {
  const matches = searchBySkills(helpers, {
    query: task.query,
    buckets: task.buckets,
    languages: task.languages,
    availableOnly: true,
  });

  const candidates: AmplitudeCandidate[] = matches
    .map((m) => {
      const skillMatch = m.score;
      const tier = weights.vouchTier?.[m.helper.id];
      const activity = weights.recentActivity?.[m.helper.id] ?? 0;
      const expRisk = exposureRisk(tier, activity);
      let frictionMult = FRICTION_MULTIPLIER.clean;
      let friction: FrictionLevel = "clean";
      if (task.destinationIso3 && weights.relationships) {
        const f = sovereigntyFriction(
          weights.relationships,
          m.helper.country,
          task.destinationIso3,
        );
        friction = f.level;
        frictionMult = f.multiplier;
      }
      const weight = skillMatch * frictionMult * (1 - expRisk);
      return { helper: m.helper, weight, friction, exposureRisk: expRisk };
    })
    .filter((c) => c.weight > 0);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.weight - a.weight);

  const seedValue =
    seed ??
    seedFromString(
      `${task.query ?? ""}|${(task.buckets ?? []).join(",")}|${(task.languages ?? []).join(",")}|${candidates.map((c) => c.helper.id).join("|")}`,
    );

  // Collapse: |w|² sampling with the seedable RNG.
  const totalAmp = candidates.reduce((sum, c) => sum + c.weight * c.weight, 0);
  const rng = mulberry32(seedValue);
  const roll = rng() * totalAmp;
  let acc = 0;
  let picked = candidates[0].helper.id;
  for (const c of candidates) {
    acc += c.weight * c.weight;
    if (roll <= acc) {
      picked = c.helper.id;
      break;
    }
  }

  const token = encodeAmplitudeToken({
    candidates,
    picked,
    seed: seedValue,
    task,
  });

  return { candidates, picked, seed: seedValue, token };
}

/** VFXAMP1 token serialization. */
export function encodeAmplitudeToken(a: {
  candidates: AmplitudeCandidate[];
  picked: string;
  seed: number;
  task: AmplitudeTask;
}): string {
  const payload = {
    v: 1,
    picked: a.picked,
    seed: a.seed,
    task: {
      query: a.task.query ?? "",
      buckets: a.task.buckets ?? [],
      languages: a.task.languages ?? [],
      destination: a.task.destinationIso3 ?? "",
    },
    n: a.candidates.length,
    top: a.candidates.slice(0, 3).map((c) => ({
      id: c.helper.id,
      w: Number(c.weight.toFixed(4)),
      f: c.friction,
    })),
  };
  return `VFXAMP1:${JSON.stringify(payload)}`;
}

/** Parse a VFXAMP1 token back to its payload, or null if malformed. */
export function parseAmplitudeToken(token: string): {
  picked: string;
  seed: number;
  task: { query: string; buckets: string[]; languages: string[]; destination: string };
  n: number;
  top: Array<{ id: string; w: number; f: string }>;
} | null {
  if (!token || !token.startsWith("VFXAMP1:")) return null;
  try {
    const payload = JSON.parse(token.slice("VFXAMP1:".length));
    if (!payload || typeof payload !== "object") return null;
    return payload as {
      picked: string;
      seed: number;
      task: { query: string; buckets: string[]; languages: string[]; destination: string };
      n: number;
      top: Array<{ id: string; w: number; f: string }>;
    };
  } catch {
    return null;
  }
}

/** True when a string is a VFXAMP1 token. */
export function isAmplitudeToken(token: string): boolean {
  return typeof token === "string" && token.startsWith("VFXAMP1:");
}
