/**
 * V FOR X — The Promises (Politician Pledge Tracker)
 *
 * A truth-score system for political promises. Citizens record what
 * politicians pledged, track whether those promises were kept, and
 * compute a transparent truth-score. All data is user-contributed
 * and stored locally.
 *
 * Truth-score = (kept / (kept + broken)) weighted by importance.
 * Pending promises don't count against the score but are flagged
 * if they exceed their target date.
 */

export type PromiseStatus = "fulfilled" | "broken" | "pending" | "stalled" | "in_progress";

export type PromiseImportance = "critical" | "major" | "minor";

export type PromiseCategory =
  | "hunger"
  | "health"
  | "education"
  | "climate"
  | "security"
  | "economy"
  | "governance"
  | "human_rights"
  | "infrastructure"
  | "other";

export interface Politician {
  id: string;
  name: string;
  position: string;
  country: string;
  party?: string;
  termStart?: string;
  termEnd?: string;
  createdAt: number;
}

export interface Promise {
  id: string;
  politicianId: string;
  text: string;
  category: PromiseCategory;
  importance: PromiseImportance;
  dateMade: string;
  targetDate?: string;
  status: PromiseStatus;
  evidence?: string;
  notes?: string;
  updatedAt: number;
}

export interface TruthScore {
  politicianId: string;
  totalPromises: number;
  fulfilled: number;
  broken: number;
  inProgress: number;
  pending: number;
  stalled: number;
  /** 0-100 score (weighted, only fulfilled+broken count in denominator) */
  score: number;
  level: "untested" | "honest" | "mixed" | "dishonest" | "pathological";
  /** Promises past their target date with no resolution */
  overdue: number;
}

export interface PoliticianWithScore extends Politician {
  score: TruthScore;
}

/* ═══════════════════════════════════════════════════════════
   POLITICIAN MANAGEMENT
   ═══════════════════════════════════════════════════════════ */

export function createPolitician(
  name: string,
  position: string,
  country: string,
  party?: string,
): Politician {
  return {
    id: crypto.randomUUID(),
    name,
    position,
    country,
    party,
    createdAt: Date.now(),
  };
}

/* ═══════════════════════════════════════════════════════════
   PROMISE MANAGEMENT
   ═══════════════════════════════════════════════════════════ */

export function createPromise(
  politicianId: string,
  text: string,
  category: PromiseCategory,
  importance: PromiseImportance,
  dateMade: string,
  targetDate?: string,
): Promise {
  return {
    id: crypto.randomUUID(),
    politicianId,
    text,
    category,
    importance,
    dateMade,
    targetDate,
    status: "pending",
    updatedAt: Date.now(),
  };
}

export function updatePromiseStatus(
  promise: Promise,
  status: PromiseStatus,
  evidence?: string,
  notes?: string,
): Promise {
  return {
    ...promise,
    status,
    evidence: evidence ?? promise.evidence,
    notes: notes ?? promise.notes,
    updatedAt: Date.now(),
  };
}

/* ═══════════════════════════════════════════════════════════
   TRUTH SCORE COMPUTATION
   ═══════════════════════════════════════════════════════════ */

const IMPORTANCE_WEIGHTS: Record<PromiseImportance, number> = {
  critical: 3,
  major: 2,
  minor: 1,
};

export function computeTruthScore(politicianId: string, promises: Promise[]): TruthScore {
  const polPromises = promises.filter((p) => p.politicianId === politicianId);
  const total = polPromises.length;

  if (total === 0) {
    return {
      politicianId,
      totalPromises: 0,
      fulfilled: 0,
      broken: 0,
      inProgress: 0,
      pending: 0,
      stalled: 0,
      score: 0,
      level: "untested",
      overdue: 0,
    };
  }

  const fulfilled = polPromises.filter((p) => p.status === "fulfilled").length;
  const broken = polPromises.filter((p) => p.status === "broken").length;
  const inProgress = polPromises.filter((p) => p.status === "in_progress").length;
  const pending = polPromises.filter((p) => p.status === "pending").length;
  const stalled = polPromises.filter((p) => p.status === "stalled").length;

  // Weighted score: only count resolved promises (fulfilled + broken)
  let weightedKept = 0;
  let weightedTotal = 0;
  let overdue = 0;
  const now = new Date();

  for (const p of polPromises) {
    const weight = IMPORTANCE_WEIGHTS[p.importance];

    if (p.status === "fulfilled" || p.status === "broken") {
      weightedTotal += weight;
      if (p.status === "fulfilled") weightedKept += weight;
    }

    // Check for overdue pending promises
    if (p.status === "pending" && p.targetDate) {
      const target = new Date(p.targetDate);
      if (target < now) overdue++;
    }
  }

  const score = weightedTotal > 0 ? Math.round((weightedKept / weightedTotal) * 100) : 0;

  let level: TruthScore["level"];
  const resolved = fulfilled + broken;
  if (resolved === 0) {
    level = "untested";
  } else if (score >= 75) {
    level = "honest";
  } else if (score >= 50) {
    level = "mixed";
  } else if (score >= 25) {
    level = "dishonest";
  } else {
    level = "pathological";
  }

  return {
    politicianId,
    totalPromises: total,
    fulfilled,
    broken,
    inProgress,
    pending,
    stalled,
    score,
    level,
    overdue,
  };
}

/**
 * Rank politicians by truth score. Un politicians (no resolved promises)
 * sort last. Ties break by total promise count.
 */
export function rankPoliticians(politicians: Politician[], promises: Promise[]): PoliticianWithScore[] {
  return politicians
    .map((p) => ({ ...p, score: computeTruthScore(p.id, promises) }))
    .sort((a, b) => {
      if (a.score.level === "untested" && b.score.level !== "untested") return 1;
      if (a.score.level !== "untested" && b.score.level === "untested") return -1;
      if (b.score.score !== a.score.score) return b.score.score - a.score.score;
      return b.score.totalPromises - a.score.totalPromises;
    });
}

/* ═══════════════════════════════════════════════════════════
   METADATA
   ═══════════════════════════════════════════════════════════ */

export const STATUS_LABELS: Record<PromiseStatus, string> = {
  fulfilled: "Fulfilled",
  broken: "Broken",
  pending: "Pending",
  stalled: "Stalled",
  in_progress: "In Progress",
};

export const STATUS_COLORS: Record<PromiseStatus, string> = {
  fulfilled: "var(--color-terminal-green)",
  broken: "var(--color-blood-bright)",
  pending: "var(--color-content-dim)",
  stalled: "var(--color-warning-amber)",
  in_progress: "#00ddff",
};

export const IMPORTANCE_LABELS: Record<PromiseImportance, string> = {
  critical: "Critical",
  major: "Major",
  minor: "Minor",
};

export const CATEGORY_LABELS_PROMISES: Record<PromiseCategory, string> = {
  hunger: "Hunger & Food",
  health: "Healthcare",
  education: "Education",
  climate: "Climate",
  security: "Security & Military",
  economy: "Economy",
  governance: "Governance & Corruption",
  human_rights: "Human Rights",
  infrastructure: "Infrastructure",
  other: "Other",
};

export const LEVEL_LABELS: Record<TruthScore["level"], string> = {
  untested: "Untested",
  honest: "Honest",
  mixed: "Mixed",
  dishonest: "Dishonest",
  pathological: "Pathological Liar",
};

export const LEVEL_COLORS: Record<TruthScore["level"], string> = {
  untested: "var(--color-content-dim)",
  honest: "var(--color-terminal-green)",
  mixed: "var(--color-warning-amber)",
  dishonest: "var(--color-blood)",
  pathological: "var(--color-blood-bright)",
};
