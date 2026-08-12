/**
 * V FOR X — Resume Session
 *
 * Phase 21 north-star: "Reopen last country + persona + mission step after reload."
 *
 * Records the visitor's last meaningful position in the See → Understand →
 * Act → Hold → Coordinate → Protect loop so a stranger can close the tab,
 * reopen it, and land back on the dossier/country/mission they were on —
 * with the same persona filter and the same mission step selected.
 *
 * Storage: localStorage key "vfx-resume-session" (single object, JSON).
 * The object is small, deterministic, and panic-wipe aware (see lib/storage-map.ts).
 *
 * No network, no accounts, no PII — just the last route + UI hints.
 */

const STORAGE_KEY = "vfx-resume-session";

export interface ResumeEntry {
  /** ISO 8601 timestamp of the visit */
  ts: number;
  /** Last route visited (pathname, no query/hash), e.g. "/sorrow-map/sdn" */
  route: string;
  /** Optional ISO3 country code if the route was country-scoped */
  iso3?: string;
  /** Optional dossier id if the route was a dossier */
  dossierId?: string;
  /** Optional mission id from lib/missions.ts */
  missionId?: string;
  /** Optional mission step index */
  missionStep?: number;
  /** Optional persona from lib/personas.ts */
  persona?: string;
  /** Optional human-readable label for the resume strip */
  label?: string;
}

export interface ResumeState {
  /** Most recent entry (the one to resume) */
  current: ResumeEntry | null;
  /** Previous entry (one step back) */
  previous: ResumeEntry | null;
}

/* ═══════════════════════════════════════════════════════════════
   Low-level storage (safe under jsdom / SSR / disabled storage)
   ═══════════════════════════════════════════════════════════════ */

function readRaw(): { current: ResumeEntry | null; previous: ResumeEntry | null } {
  if (typeof localStorage === "undefined") {
    return { current: null, previous: null };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { current: null, previous: null };
    const parsed = JSON.parse(raw) as Partial<ResumeState>;
    return {
      current: parsed.current ?? null,
      previous: parsed.previous ?? null,
    };
  } catch {
    return { current: null, previous: null };
  }
}

function writeRaw(state: ResumeState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / disabled storage — silently drop; resume is a UX nicety */
  }
}

/* ═══════════════════════════════════════════════════════════════
   Public API
   ═══════════════════════════════════════════════════════════════ */

/** Read the current resume state (or empty if none / unreadable). */
export function loadResume(): ResumeState {
  return readRaw();
}

/**
 * Record a visit. Demotes the prior `current` to `previous` and stores
 * the new entry as `current`. De-dupes consecutive identical routes so
 * a refresh does not pollute history.
 *
 * If `iso3` / `dossierId` are not supplied but the route matches a known
 * country/dossier pattern, they are inferred so callers can pass just the
 * pathname.
 */
export function recordVisit(entry: Omit<ResumeEntry, "ts"> & { ts?: number }): ResumeState {
  const inferred = entryFromRoute(entry.route);
  const merged: ResumeEntry = {
    ts: entry.ts ?? Date.now(),
    route: entry.route,
    iso3: (entry.iso3 ?? inferred.iso3)?.toUpperCase(),
    dossierId: entry.dossierId ?? inferred.dossierId,
    ...(entry.missionId !== undefined && { missionId: entry.missionId }),
    ...(entry.missionStep !== undefined && { missionStep: entry.missionStep }),
    ...(entry.persona !== undefined && { persona: entry.persona }),
    ...(entry.label !== undefined && { label: entry.label }),
  };
  const next: ResumeEntry = Object.fromEntries(
    Object.entries(merged).filter(([, v]) => v !== undefined),
  ) as ResumeEntry;

  const prior = readRaw();

  // De-dupe: if the same route + scope, just refresh the timestamp
  if (
    prior.current &&
    prior.current.route === next.route &&
    prior.current.iso3 === next.iso3 &&
    prior.current.dossierId === next.dossierId &&
    prior.current.missionId === next.missionId &&
    prior.current.missionStep === next.missionStep
  ) {
    const mergedEntry: ResumeEntry = { ...prior.current, ts: next.ts };
    // Persona updates on the same route count as a soft update, not a new entry
    const state: ResumeState = {
      current: next.persona ? { ...mergedEntry, persona: next.persona } : mergedEntry,
      previous: prior.previous,
    };
    writeRaw(state);
    return state;
  }

  const state: ResumeState = {
    current: next,
    previous: prior.current,
  };
  writeRaw(state);
  return state;
}

/** Clear resume state (used by panic-wipe, duress flip, or explicit reset). */
export function clearResume(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Build a human-readable label for the resume strip.
 * Falls back through provided label → dossier id → iso3 → route.
 */
export function resumeLabel(entry: ResumeEntry | null): string {
  if (!entry) return "";
  if (entry.label) return entry.label;
  if (entry.dossierId) return `Dossier ${entry.dossierId}`;
  if (entry.iso3) return entry.iso3.toUpperCase();
  return entry.route;
}

/**
 * Returns the relative-time label like "2m ago" / "3h ago" / "just now".
 * Defensive against clock skew (negative deltas clamp to "just now").
 */
export function resumeAgo(entry: ResumeEntry | null, now: number = Date.now()): string {
  if (!entry) return "";
  const delta = now - entry.ts;
  if (delta < 60_000) return "just now";
  const mins = Math.floor(delta / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/* ═══════════════════════════════════════════════════════════════
   Route classification helpers
   ═══════════════════════════════════════════════════════════════ */

const ISO3_RE = /^\/sorrow-map\/([a-z]{3})\/?$/i;
const DOSSIER_RE = /^\/registry\/([a-z0-9-]+)\/?$/i;
const MISSION_RE = /^\/the-missions\/?$/;

/**
 * Parse a route into a ResumeEntry with as much scope as can be inferred.
 * Useful for components that only know their pathname.
 */
export function entryFromRoute(
  route: string,
  opts: { persona?: string; missionId?: string; missionStep?: number; label?: string } = {},
): Omit<ResumeEntry, "ts"> {
  const base: Omit<ResumeEntry, "ts"> = { route };

  const iso3Match = ISO3_RE.exec(route);
  if (iso3Match) {
    base.iso3 = iso3Match[1].toUpperCase();
  }

  const dossierMatch = DOSSIER_RE.exec(route);
  if (dossierMatch) {
    base.dossierId = dossierMatch[1];
  }

  if (MISSION_RE.test(route) && opts.missionId) {
    base.missionId = opts.missionId;
    if (opts.missionStep !== undefined) base.missionStep = opts.missionStep;
  }

  if (opts.persona) base.persona = opts.persona;
  if (opts.label) base.label = opts.label;

  return base;
}
