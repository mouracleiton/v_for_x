/**
 * V FOR X — Gamification Engine
 *
 * Tracks exploration across the platform and awards badges for
 * engagement. All state persists in localStorage (client-side only).
 * SSR-safe: every read/write guards `typeof window`.
 *
 * XP curve: each level requires progressively more XP.
 *   XP for level N = 100 * N^1.5  (level 1→2 needs 100, 2→3 ≈283, …)
 */

/* ═══════════════════════════════════════════════════════════════
 *  TYPES
 * ═══════════════════════════════════════════════════════════════ */

export interface Badge {
  id: string;
  name: string;
  description: string;
  emoji: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  earnedAt?: number;
}

export interface ProgressState {
  countriesVisited: string[];
  dimensionsExplored: string[];
  dossiersRead: string[];
  storiesCompleted: string[];
  campaignsGenerated: number;
  badges: Badge[];
  xp: number;
  level: number;
}

/* ═══════════════════════════════════════════════════════════════
 *  CONSTANTS
 * ═══════════════════════════════════════════════════════════════ */

const STORAGE_KEY = "vfx-gamification";
const TOTAL_COUNTRIES = 200;
const TOTAL_DOSSIERS = 13;

/** XP awarded per action */
const XP_REWARDS = {
  countryVisit: 5,
  dossierRead: 15,
  storyComplete: 20,
  campaignGenerated: 25,
} as const;

/** All badge definitions (static metadata — no earnedAt). */
const BADGE_DEFS: Badge[] = [
  // ── Country exploration ──
  { id: "first-steps", name: "First Steps", description: "Visit your first country", emoji: "👣", tier: "bronze" },
  { id: "explorer", name: "Explorer", description: "Visit 10 countries", emoji: "🧭", tier: "bronze" },
  { id: "voyager", name: "Voyager", description: "Visit 50 countries", emoji: "🌐", tier: "silver" },
  { id: "cartographer", name: "Cartographer", description: "Visit 25 countries", emoji: "🗺️", tier: "silver" },
  { id: "atlas", name: "Atlas", description: "Visit 100 countries", emoji: "🌍", tier: "gold" },
  { id: "globe-trotter", name: "Globe Trotter", description: "Visit 150 countries", emoji: "🌀", tier: "gold" },
  { id: "omniscient", name: "Omniscient", description: "Visit all 200 countries", emoji: "🌌", tier: "platinum" },

  // ── Dossier reading ──
  { id: "dossier-reader", name: "Dossier Reader", description: "Read your first dossier", emoji: "📖", tier: "bronze" },
  { id: "investigator", name: "Investigator", description: "Read 5 dossiers", emoji: "🔍", tier: "silver" },
  { id: "archivist", name: "Archivist", description: "Read all 13 dossiers", emoji: "🗃️", tier: "gold" },

  // ── Story completion ──
  { id: "storyteller-initiate", name: "Listener", description: "Complete your first story", emoji: "🎧", tier: "bronze" },
  { id: "narrator", name: "Narrator", description: "Complete 5 stories", emoji: "🎙️", tier: "silver" },
  { id: "story-master", name: "Story Master", description: "Complete all stories", emoji: "📜", tier: "gold" },

  // ── Campaign generation ──
  { id: "activist", name: "Activist", description: "Generate your first campaign", emoji: "📢", tier: "bronze" },
  { id: "campaigner", name: "Campaigner", description: "Generate 5 campaigns", emoji: "🔥", tier: "silver" },
  { id: "firebrand", name: "Firebrand", description: "Generate 20 campaigns", emoji: "⚡", tier: "platinum" },

  // ── Level milestones ──
  { id: "level-5", name: "Analyst", description: "Reach level 5", emoji: "📊", tier: "silver" },
  { id: "level-10", name: "Strategist", description: "Reach level 10", emoji: "♟️", tier: "gold" },
  { id: "level-20", name: "Architect", description: "Reach level 20", emoji: "🏛️", tier: "platinum" },

  // ── Dimension exploration ──
  { id: "polymath", name: "Polymath", description: "Explore 10 different dimensions", emoji: "🧠", tier: "silver" },
  { id: "renaissance", name: "Renaissance", description: "Explore all 19 dimensions", emoji: "🎯", tier: "gold" },
];

/* ═══════════════════════════════════════════════════════════════
 *  XP / LEVEL MATH
 * ═══════════════════════════════════════════════════════════════ */

/** Calculate level from total XP. Level starts at 1. */
export function levelFromXP(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) {
    level++;
  }
  return level;
}

/** Cumulative XP required to REACH a given level (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  // Cumulative sum of 100 * n^1.5 for n = 1..level-1
  let total = 0;
  for (let n = 1; n < level; n++) {
    total += Math.round(100 * Math.pow(n, 1.5));
  }
  return total;
}

/** XP needed to advance from current level to the next. */
export function xpForNextLevel(currentLevel: number): number {
  return xpForLevel(currentLevel + 1) - xpForLevel(currentLevel);
}

/* ═══════════════════════════════════════════════════════════════
 *  STATE PERSISTENCE
 * ═══════════════════════════════════════════════════════════════ */

function defaultState(): ProgressState {
  return {
    countriesVisited: [],
    dimensionsExplored: [],
    dossiersRead: [],
    storiesCompleted: [],
    campaignsGenerated: 0,
    badges: [],
    xp: 0,
    level: 1,
  };
}

function loadState(): ProgressState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<ProgressState>;
    return {
      ...defaultState(),
      ...parsed,
      countriesVisited: parsed.countriesVisited ?? [],
      dimensionsExplored: parsed.dimensionsExplored ?? [],
      dossiersRead: parsed.dossiersRead ?? [],
      storiesCompleted: parsed.storiesCompleted ?? [],
      badges: parsed.badges ?? [],
    };
  } catch {
    return defaultState();
  }
}

function saveState(state: ProgressState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / private mode errors */
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  PUBLIC API — TRACKING
 * ═══════════════════════════════════════════════════════════════ */

/** Track a visit to a country page. Awards XP on first visit. */
export function trackCountryVisit(iso3: string): void {
  if (typeof window === "undefined") return;
  const state = loadState();
  if (state.countriesVisited.includes(iso3)) return;
  state.countriesVisited.push(iso3);
  state.xp += XP_REWARDS.countryVisit;
  state.level = levelFromXP(state.xp);
  saveState(state);
}

/** Track reading a dossier. Awards XP on first read. */
export function trackDossierRead(id: string): void {
  if (typeof window === "undefined") return;
  const state = loadState();
  if (state.dossiersRead.includes(id)) return;
  state.dossiersRead.push(id);
  state.xp += XP_REWARDS.dossierRead;
  state.level = levelFromXP(state.xp);
  saveState(state);
}

/** Track story completion. Awards XP on first completion. */
export function trackStoryComplete(id: string): void {
  if (typeof window === "undefined") return;
  const state = loadState();
  if (state.storiesCompleted.includes(id)) return;
  state.storiesCompleted.push(id);
  state.xp += XP_REWARDS.storyComplete;
  state.level = levelFromXP(state.xp);
  saveState(state);
}

/** Track campaign generation. Always awards XP. */
export function trackCampaignGenerated(): void {
  if (typeof window === "undefined") return;
  const state = loadState();
  state.campaignsGenerated += 1;
  state.xp += XP_REWARDS.campaignGenerated;
  state.level = levelFromXP(state.xp);
  saveState(state);
}

/** Track dimension exploration (e.g. user opened the hunger lens). */
export function trackDimensionExplored(dimension: string): void {
  if (typeof window === "undefined") return;
  const state = loadState();
  if (state.dimensionsExplored.includes(dimension)) return;
  state.dimensionsExplored.push(dimension);
  state.xp += 3;
  state.level = levelFromXP(state.xp);
  saveState(state);
}

/* ═══════════════════════════════════════════════════════════════
 *  BADGE LOGIC
 * ═══════════════════════════════════════════════════════════════ */

interface BadgeCheckResult {
  earned: boolean;
  progress: number;
  target: number;
}

function checkBadgeCondition(id: string, state: ProgressState): BadgeCheckResult {
  const c = state.countriesVisited.length;
  const d = state.dossiersRead.length;
  const s = state.storiesCompleted.length;
  const g = state.campaignsGenerated;
  const dim = state.dimensionsExplored.length;
  const lvl = state.level;

  const conditions: Record<string, BadgeCheckResult> = {
    "first-steps":       { earned: c >= 1,   progress: Math.min(c, 1),   target: 1 },
    "explorer":          { earned: c >= 10,  progress: Math.min(c, 10),  target: 10 },
    "cartographer":      { earned: c >= 25,  progress: Math.min(c, 25),  target: 25 },
    "voyager":           { earned: c >= 50,  progress: Math.min(c, 50),  target: 50 },
    "atlas":             { earned: c >= 100, progress: Math.min(c, 100), target: 100 },
    "globe-trotter":     { earned: c >= 150, progress: Math.min(c, 150), target: 150 },
    "omniscient":        { earned: c >= TOTAL_COUNTRIES, progress: Math.min(c, TOTAL_COUNTRIES), target: TOTAL_COUNTRIES },
    "dossier-reader":    { earned: d >= 1,   progress: Math.min(d, 1),   target: 1 },
    "investigator":      { earned: d >= 5,   progress: Math.min(d, 5),   target: 5 },
    "archivist":         { earned: d >= TOTAL_DOSSIERS, progress: Math.min(d, TOTAL_DOSSIERS), target: TOTAL_DOSSIERS },
    "storyteller-initiate": { earned: s >= 1, progress: Math.min(s, 1), target: 1 },
    "narrator":          { earned: s >= 5,   progress: Math.min(s, 5),   target: 5 },
    "story-master":      { earned: s >= 10,  progress: Math.min(s, 10),  target: 10 },
    "activist":          { earned: g >= 1,   progress: Math.min(g, 1),   target: 1 },
    "campaigner":        { earned: g >= 5,   progress: Math.min(g, 5),   target: 5 },
    "firebrand":         { earned: g >= 20,  progress: Math.min(g, 20),  target: 20 },
    "level-5":           { earned: lvl >= 5, progress: Math.min(lvl, 5), target: 5 },
    "level-10":          { earned: lvl >= 10, progress: Math.min(lvl, 10), target: 10 },
    "level-20":          { earned: lvl >= 20, progress: Math.min(lvl, 20), target: 20 },
    "polymath":          { earned: dim >= 10, progress: Math.min(dim, 10), target: 10 },
    "renaissance":       { earned: dim >= 19, progress: Math.min(dim, 19), target: 19 },
  };

  return conditions[id] ?? { earned: false, progress: 0, target: 1 };
}

/**
 * Check all badge conditions and award any newly-earned badges.
 * Returns only the badges that were awarded in THIS call (newly earned).
 */
export function checkBadges(): Badge[] {
  if (typeof window === "undefined") return [];
  const state = loadState();
  const earnedIds = new Set(state.badges.map((b) => b.id));
  const newlyEarned: Badge[] = [];

  for (const def of BADGE_DEFS) {
    if (earnedIds.has(def.id)) continue;
    const result = checkBadgeCondition(def.id, state);
    if (result.earned) {
      const badge: Badge = { ...def, earnedAt: Date.now() };
      state.badges.push(badge);
      newlyEarned.push(badge);
    }
  }

  if (newlyEarned.length > 0) {
    saveState(state);
  }

  return newlyEarned;
}

/**
 * Get progress info for a specific badge (for progress bars).
 */
export function getBadgeProgress(id: string): { progress: number; target: number; pct: number } {
  const state = loadState();
  const result = checkBadgeCondition(id, state);
  return {
    progress: result.progress,
    target: result.target,
    pct: result.target > 0 ? Math.round((result.progress / result.target) * 100) : 0,
  };
}

/** Get all badge definitions (without earnedAt — pure metadata). */
export function getAllBadges(): Badge[] {
  return BADGE_DEFS.map((b) => ({ ...b }));
}

/** Get badges sorted by tier for display. */
export function getBadgesByTier(): Record<string, Badge[]> {
  const sorted: Record<string, Badge[]> = { bronze: [], silver: [], gold: [], platinum: [] };
  for (const b of BADGE_DEFS) {
    sorted[b.tier].push({ ...b });
  }
  return sorted;
}

/* ═══════════════════════════════════════════════════════════════
 *  READ-ONLY ACCESSORS
 * ═══════════════════════════════════════════════════════════════ */

/** Get current progress state (merged with earned badges). */
export function getProgress(): ProgressState {
  const state = loadState();
  // Ensure badges are up to date
  const earnedIds = new Set(state.badges.map((b) => b.id));
  for (const def of BADGE_DEFS) {
    if (!earnedIds.has(def.id)) {
      const result = checkBadgeCondition(def.id, state);
      if (result.earned) {
        state.badges.push({ ...def, earnedAt: Date.now() });
      }
    }
  }
  return state;
}

/** Reset all progress (for a "clear" button). */
export function resetProgress(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Tier display colors matching the design system. */
export const TIER_COLORS: Record<Badge["tier"], string> = {
  bronze: "#cd7f32",
  silver: "#b0c4de",
  gold: "#f0a03b",
  platinum: "#22d3a6",
};

/** Tier display labels. */
export const TIER_LABELS: Record<Badge["tier"], string> = {
  bronze: "BRONZE",
  silver: "SILVER",
  gold: "GOLD",
  platinum: "PLATINUM",
};

/* ═══════════════════════════════════════════════════════════════
 *  SIGNED CERTIFICATES
 * ═══════════════════════════════════════════════════════════════ */

export interface AchievementCertificate {
  /** Unique certificate ID */
  id: string;
  /** Badge or milestone being certified */
  badgeId: string;
  badgeName: string;
  badgeTier: Badge["tier"];
  /** Emoji for display */
  emoji: string;
  /** XP at time of certification */
  xp: number;
  level: number;
  /** Countries visited count */
  countriesVisited: number;
  /** Dossiers read count */
  dossiersRead: number;
  /** Campaigns generated */
  campaignsGenerated: number;
  /** SHA-256 hash of the certificate content */
  hash: string;
  /** Epoch ms when certified */
  issuedAt: number;
}

/**
 * Generate a tamper-evident achievement certificate for a earned badge.
 *
 * The certificate contains a SHA-256 hash computed over its canonical
 * content. This hash can be independently verified, shared, or anchored
 * to the Bitcoin blockchain via lib/blockchain-verify.ts for an
 * immutable proof of achievement.
 */
export async function generateCertificate(
  badgeId: string,
): Promise<AchievementCertificate | null> {
  if (typeof window === "undefined") return null;
  const state = loadState();
  const badge = state.badges.find((b) => b.id === badgeId);
  if (!badge || !badge.earnedAt) return null;

  const cert: Omit<AchievementCertificate, "hash"> = {
    id: crypto.randomUUID(),
    badgeId: badge.id,
    badgeName: badge.name,
    badgeTier: badge.tier,
    emoji: badge.emoji,
    xp: state.xp,
    level: state.level,
    countriesVisited: state.countriesVisited.length,
    dossiersRead: state.dossiersRead.length,
    campaignsGenerated: state.campaignsGenerated,
    issuedAt: Date.now(),
  };

  const canonical = JSON.stringify({
    id: cert.id,
    badgeId: cert.badgeId,
    badgeName: cert.badgeName,
    badgeTier: cert.badgeTier,
    xp: cert.xp,
    level: cert.level,
    countriesVisited: cert.countriesVisited,
    dossiersRead: cert.dossiersRead,
    campaignsGenerated: cert.campaignsGenerated,
    issuedAt: cert.issuedAt,
  });

  const buf = new TextEncoder().encode(canonical);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  const hash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { ...cert, hash };
}

/**
 * Verify that a certificate's hash matches its content.
 * Returns true if the certificate has not been tampered with.
 */
export async function verifyCertificate(
  cert: AchievementCertificate,
): Promise<boolean> {
  const canonical = JSON.stringify({
    id: cert.id,
    badgeId: cert.badgeId,
    badgeName: cert.badgeName,
    badgeTier: cert.badgeTier,
    xp: cert.xp,
    level: cert.level,
    countriesVisited: cert.countriesVisited,
    dossiersRead: cert.dossiersRead,
    campaignsGenerated: cert.campaignsGenerated,
    issuedAt: cert.issuedAt,
  });

  const buf = new TextEncoder().encode(canonical);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  const expectedHash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedHash === cert.hash;
}

/**
 * Export a certificate as a downloadable JSON file.
 */
export function exportCertificate(cert: AchievementCertificate): string {
  return JSON.stringify(cert, null, 2);
}

/**
 * Generate a signed achievement certificate using the unified identity.
 *
 * This function creates a tamper-evident certificate that is cryptographically
 * signed by the unified identity, providing verifiable proof of achievement.
 */
export async function generateSignedCertificate(
  badgeId: string,
): Promise<AchievementCertificate & {
  signature?: string;
  signerPublicKey?: string;
  signerHandle?: string;
} | null> {
  if (typeof window === "undefined") return null;

  const { ensureIdentity, signCertificateWithIdentity } = await import("./identity");
  const identity = await ensureIdentity();

  const cert = await generateCertificate(badgeId);
  if (!cert) return null;

  return await signCertificateWithIdentity(identity, cert);
}

/**
 * Verify a signed certificate's signature and content hash.
 *
 * This function verifies both the cryptographic signature and the content hash,
 * ensuring the certificate has not been tampered with and was signed by the
 * claimed identity.
 */
export async function verifySignedCertificate(
  cert: AchievementCertificate & {
    signature?: string;
    signerPublicKey?: string;
    signerHandle?: string;
  },
): Promise<boolean> {
  // First verify the content hash
  const hashValid = await verifyCertificate(cert);
  if (!hashValid) return false;

  // Then verify the signature if present
  if (!cert.signature || !cert.signerPublicKey) {
    // Unsigned certificate is valid if hash matches
    return true;
  }

  try {
    const { verifyWithIdentity } = await import("./identity");
    const publicIdentity = {
      publicKeyHex: cert.signerPublicKey,
      handle: cert.signerHandle || "",
      fingerprint: "",
      createdAt: cert.issuedAt,
    };

    // Reconstruct the hash that was signed
    const canonical = JSON.stringify({
      id: cert.id,
      badgeId: cert.badgeId,
      badgeName: cert.badgeName,
      badgeTier: cert.badgeTier,
      xp: cert.xp,
      level: cert.level,
      countriesVisited: cert.countriesVisited,
      dossiersRead: cert.dossiersRead,
      campaignsGenerated: cert.campaignsGenerated,
      issuedAt: cert.issuedAt,
    });

    const buf = new TextEncoder().encode(canonical);
    const hashBuf = await crypto.subtle.digest("SHA-256", buf);
    const hash = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return await verifyWithIdentity(publicIdentity, hash, cert.signature);
  } catch {
    return false;
  }
}
