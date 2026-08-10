/**
 * V FOR X — The Exchange (Decentralized Mutual-Aid Matching)
 *
 * A peer-to-peer resource matching system. Citizens post what they
 * have (offers) and what they need (requests). The matching engine
 * connects complementary posts without any central authority.
 *
 * No registration. No tracking. Posts are anonymous and stored locally.
 * The system can export/import match bundles for offline relay via
 * QR codes (lib/relay.ts) or dead drops (lib/idb.ts).
 *
 * Matching considers:
 *   - Resource type compatibility (fuzzy matching)
 *   - Geographic proximity (if location provided)
 *   - Quantity compatibility
 *   - Recency (fresh posts rank higher)
 */

import type { WorldBackbone, CountryData } from "./types";

export type PostType = "offer" | "request";

export type ResourceCategory =
  | "food"
  | "water"
  | "medical"
  | "shelter"
  | "clothing"
  | "transport"
  | "communications"
  | "fuel"
  | "tools"
  | "skills"
  | "protection"
  | "documents"
  | "other";

export interface AidPost {
  id: string;
  type: PostType;
  category: ResourceCategory;
  resource: string;
  quantity: string;
  iso3: string;
  countryName: string;
  region?: string;
  /** Anonymous contact method (encrypted dead drop, handle, etc.) */
  contactMethod?: string;
  notes?: string;
  urgency: 1 | 2 | 3 | 4 | 5;
  ts: number;
  /** Whether this post is still active */
  active: boolean;
  /** Anonymous handle of the poster */
  handle: string;
}

export interface Match {
  offer: AidPost;
  request: AidPost;
  /** 0-100 compatibility score */
  score: number;
  /** Reason for the match */
  reason: string;
  /** Same country? */
  sameCountry: boolean;
  /** Same region? */
  sameRegion: boolean;
}

export interface ExchangeStats {
  totalOffers: number;
  totalRequests: number;
  matches: number;
  unmatchedRequests: number;
  topCategories: { category: ResourceCategory; count: number }[];
  byCountry: { iso3: string; name: string; offers: number; requests: number }[];
}

/* ═══════════════════════════════════════════════════════════
   POST CREATION
   ═══════════════════════════════════════════════════════════ */

export function createPost(
  type: PostType,
  category: ResourceCategory,
  resource: string,
  quantity: string,
  iso3: string,
  countryName: string,
  urgency: AidPost["urgency"] = 3,
  region?: string,
  contactMethod?: string,
  notes?: string,
): AidPost {
  return {
    id: crypto.randomUUID(),
    type,
    category,
    resource: resource.trim(),
    quantity: quantity.trim(),
    iso3,
    countryName,
    region,
    contactMethod,
    notes,
    urgency,
    ts: Date.now(),
    active: true,
    handle: generateHandle(),
  };
}

function generateHandle(): string {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `X-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

/* ═══════════════════════════════════════════════════════════
   MATCHING ENGINE
   ═══════════════════════════════════════════════════════════ */

/**
 * Find all matches between offers and requests.
 */
export function findMatches(offers: AidPost[], requests: AidPost[]): Match[] {
  const matches: Match[] = [];
  const activeOffers = offers.filter((o) => o.active);
  const activeRequests = requests.filter((r) => r.active);

  for (const offer of activeOffers) {
    for (const request of activeRequests) {
      const match = scoreMatch(offer, request);
      if (match.score >= 30) {
        matches.push(match);
      }
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches;
}

/**
 * Score the compatibility between a single offer and request.
 */
export function scoreMatch(offer: AidPost, request: AidPost): Match {
  let score = 0;
  const reasons: string[] = [];

  // Category match (40 points)
  if (offer.category === request.category) {
    score += 40;
    reasons.push("same category");
  }

  // Resource name similarity (30 points)
  const resourceScore = fuzzyMatch(offer.resource.toLowerCase(), request.resource.toLowerCase());
  if (resourceScore > 0) {
    score += Math.round(resourceScore * 30);
    if (resourceScore >= 0.8) reasons.push("resource match");
  }

  // Same country (15 points)
  const sameCountry = offer.iso3 === request.iso3;
  if (sameCountry) {
    score += 15;
    reasons.push("same country");
  }

  // Same region (10 points)
  const sameRegion = !!(sameCountry && offer.region && request.region && offer.region === request.region);
  if (sameRegion) {
    score += 10;
    reasons.push("same region");
  }

  // Urgency bonus (5 points for high-urgency requests)
  if (request.type === "request" && request.urgency >= 4) {
    score += 5;
    reasons.push("high urgency");
  }

  // Recency bonus (fresh posts score higher)
  const ageHours = (Date.now() - request.ts) / 3_600_000;
  if (ageHours < 24) {
    score += 5;
    reasons.push("recent");
  }

  score = Math.min(100, score);

  return {
    offer,
    request,
    score,
    reason: reasons.join(", ") || "weak match",
    sameCountry,
    sameRegion,
  };
}

/**
 * Simple fuzzy string match. Returns 0-1 similarity.
 */
function fuzzyMatch(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.8;

  // Word overlap
  const wordsA = a.split(/\s+/);
  const wordsB = b.split(/\s+/);
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  let overlap = 0;
  for (const w of setA) {
    if (setB.has(w)) overlap++;
  }
  const union = setA.size + setB.size - overlap;
  return union > 0 ? overlap / union : 0;
}

/* ═══════════════════════════════════════════════════════════
   STATS
   ═══════════════════════════════════════════════════════════ */

export function computeStats(posts: AidPost[]): ExchangeStats {
  const offers = posts.filter((p) => p.type === "offer" && p.active);
  const requests = posts.filter((p) => p.type === "request" && p.active);
  const matches = findMatches(offers, requests);

  const matchedRequestIds = new Set(matches.map((m) => m.request.id));
  const unmatchedRequests = requests.filter((r) => !matchedRequestIds.has(r.id)).length;

  // Category counts
  const catCounts: Record<string, number> = {};
  for (const p of posts.filter((p) => p.active)) {
    catCounts[p.category] = (catCounts[p.category] ?? 0) + 1;
  }
  const topCategories = Object.entries(catCounts)
    .map(([category, count]) => ({ category: category as ResourceCategory, count }))
    .sort((a, b) => b.count - a.count);

  // Country counts
  const countryMap: Record<string, { iso3: string; name: string; offers: number; requests: number }> = {};
  for (const p of posts.filter((p) => p.active)) {
    if (!countryMap[p.iso3]) {
      countryMap[p.iso3] = { iso3: p.iso3, name: p.countryName, offers: 0, requests: 0 };
    }
    if (p.type === "offer") countryMap[p.iso3].offers++;
    else countryMap[p.iso3].requests++;
  }
  const byCountry = Object.values(countryMap).sort(
    (a, b) => b.offers + b.requests - a.offers - a.requests,
  );

  return {
    totalOffers: offers.length,
    totalRequests: requests.length,
    matches: matches.length,
    unmatchedRequests,
    topCategories,
    byCountry,
  };
}

/* ═══════════════════════════════════════════════════════════
   METADATA
   ═══════════════════════════════════════════════════════════ */

export const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  food: "Food & Water",
  water: "Clean Water",
  medical: "Medical Supplies",
  shelter: "Shelter",
  clothing: "Clothing",
  transport: "Transportation",
  communications: "Communications",
  fuel: "Fuel & Energy",
  tools: "Tools & Equipment",
  skills: "Skills & Labor",
  protection: "Protection",
  documents: "Documents & ID",
  other: "Other",
};

export const CATEGORY_ICONS: Record<ResourceCategory, string> = {
  food: "🍚",
  water: "💧",
  medical: "⚕️",
  shelter: "🏠",
  clothing: "👕",
  transport: "🚗",
  communications: "📡",
  fuel: "⛽",
  tools: "🔧",
  skills: "🤝",
  protection: "🛡️",
  documents: "📄",
  other: "📦",
};

export const URGENCY_LABELS: Record<number, string> = {
  1: "Low",
  2: "Below Normal",
  3: "Normal",
  4: "High",
  5: "Critical",
};

export const URGENCY_COLORS: Record<number, string> = {
  1: "var(--color-terminal-green)",
  2: "var(--color-terminal-green)",
  3: "var(--color-content-dim)",
  4: "var(--color-warning-amber)",
  5: "var(--color-blood-bright)",
};

/* ═══════════════════════════════════════════════════════════
   SEED DATA (derived from backbone)
   ═══════════════════════════════════════════════════════════ */

/**
 * Generate seed posts from the world_backbone data.
 * Creates realistic example posts for the top crisis countries.
 */
export function generateSeedPosts(data: WorldBackbone): AidPost[] {
  const hotspots = data.hotspots.all.slice(0, 12);
  const posts: AidPost[] = [];
  const now = Date.now();

  const templates: { type: PostType; category: ResourceCategory; resource: string; qty: string; urgency: AidPost["urgency"] }[] = [
    { type: "request", category: "food", resource: "rice, grain, staples", qty: "50kg", urgency: 5 },
    { type: "request", category: "medical", resource: "first aid kits, antibiotics", qty: "10 kits", urgency: 5 },
    { type: "request", category: "water", resource: "clean drinking water", qty: "200L", urgency: 5 },
    { type: "offer", category: "skills", resource: "medical training, first aid", qty: "volunteer", urgency: 2 },
    { type: "offer", category: "transport", resource: "truck, cargo capacity", qty: "2 tons", urgency: 3 },
    { type: "request", category: "shelter", resource: "tents, tarps, blankets", qty: "20 units", urgency: 4 },
    { type: "offer", category: "food", resource: "dried food, canned goods", qty: "100kg", urgency: 2 },
    { type: "request", category: "communications", resource: "satellite phone, radio", qty: "1 unit", urgency: 4 },
  ];

  for (const hotspot of hotspots) {
    const country = data.countries.find((c) => c.iso3 === hotspot.iso3);
    const name = country?.name_en ?? hotspot.iso3;
    const count = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const template = templates[Math.floor(Math.random() * templates.length)];
      posts.push({
        ...createPost(
          template.type,
          template.category,
          template.resource,
          template.qty,
          hotspot.iso3,
          name,
          template.urgency,
          country?.region,
        ),
        ts: now - Math.floor(Math.random() * 72 * 3_600_000),
      });
    }
  }

  return posts;
}
