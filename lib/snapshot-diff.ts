/**
 * V FOR X — Snapshot Diff Engine (lib/snapshot-diff.ts)
 *
 * "What got worse this month?" — diffs two world_backbone snapshots
 * (saved by `scripts/snapshot.py`) and reports every numeric metric
 * that changed, per country and globally. The output powers the
 * "what got worse" home strip and the Digest.
 *
 * Snapshots are deep JSON objects; this engine walks them recursively,
 * comparing only numeric leaf values (and array lengths), so it works
 * against any shape the backbone evolves into without schema lock-in.
 *
 * Wired to npm scripts:
 *   npm run snapshot            — save a snapshot (python)
 *   npm run snapshot:summary    — diff latest vs previous (this engine)
 *   npm run snapshot:list       — list snapshots
 *
 * Fully offline — both snapshots are local files.
 */

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export type ChangeDirection = "up" | "down" | "added" | "removed";

export interface MetricChange {
  /** Dotted path to the changed value (e.g. "AFG.displacement"). */
  path: string;
  /** Previous value. */
  old: number | null;
  /** New value. */
  now: number | null;
  /** Absolute delta. */
  delta: number;
  /** Relative change (fraction; Infinity when old was 0). */
  relDelta: number;
  direction: ChangeDirection;
}

export interface CountryDiff {
  iso3: string;
  changes: MetricChange[];
  /** Net "worsening" score: sum of deltas for worse-direction metrics. */
  worsening: number;
  /** Net "improving" score. */
  improving: number;
}

export interface SnapshotDiffResult {
  /** Per-country diffs (only countries with changes). */
  countries: CountryDiff[];
  /** Global indicator changes. */
  global: MetricChange[];
  /** Total metrics that changed. */
  totalChanges: number;
  /** Countries that got worse. */
  countriesWorsened: number;
  /** Countries that improved. */
  countriesImproved: number;
  /** Epoch ms of the diff. */
  ts: number;
  /** Human summary. */
  summary: string;
}

/* ═══════════════════════════════════════════════════════════════
   Recursive numeric diff
   ═══════════════════════════════════════════════════════════════ */

/**
 * Walk two JSON values in parallel, emitting a MetricChange for every
 * numeric leaf that differs (and array-length changes). String/bool
 * changes are ignored (this is a *metric* diff, not a full patch).
 */
export function diffNumeric(
  oldVal: unknown,
  newVal: unknown,
  prefix = "",
  out: MetricChange[] = [],
): MetricChange[] {
  if (isNumber(oldVal) && isNumber(newVal)) {
    if (oldVal !== newVal) {
      const delta = newVal - oldVal;
      const rel = oldVal === 0 ? Infinity : delta / Math.abs(oldVal);
      out.push({
        path: prefix,
        old: oldVal,
        now: newVal,
        delta,
        relDelta: rel,
        direction: delta > 0 ? "up" : "down",
      });
    }
    return out;
  }

  if (isNumber(oldVal) && newVal == null) {
    out.push({ path: prefix, old: oldVal, now: null, delta: -oldVal, relDelta: -1, direction: "removed" });
    return out;
  }
  if (oldVal == null && isNumber(newVal)) {
    out.push({ path: prefix, old: null, now: newVal, delta: newVal, relDelta: Infinity, direction: "added" });
    return out;
  }

  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    if (oldVal.length !== newVal.length) {
      out.push({
        path: prefix ? `${prefix}.length` : "length",
        old: oldVal.length,
        now: newVal.length,
        delta: newVal.length - oldVal.length,
        relDelta: oldVal.length === 0 ? Infinity : (newVal.length - oldVal.length) / oldVal.length,
        direction: newVal.length > oldVal.length ? "up" : "down",
      });
    }
    // Recurse into aligned elements.
    const n = Math.max(oldVal.length, newVal.length);
    for (let i = 0; i < n; i++) {
      diffNumeric(oldVal[i], newVal[i], `${prefix}[${i}]`, out);
    }
    return out;
  }

  if (isPlainObject(oldVal) && isPlainObject(newVal)) {
    const keys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
    for (const k of keys) {
      diffNumeric(
        (oldVal as Record<string, unknown>)[k],
        (newVal as Record<string, unknown>)[k],
        prefix ? `${prefix}.${k}` : k,
        out,
      );
    }
    return out;
  }

  return out;
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/* ═══════════════════════════════════════════════════════════════
   Backbone-aware diff
   ═══════════════════════════════════════════════════════════════ */

export interface Backbone {
  countries?: { iso3: string; [k: string]: unknown }[];
  global_indicators?: Record<string, unknown>;
  [k: string]: unknown;
}

/**
 * Diff two backbone snapshots, separating country-level changes from
 * global indicators. `worseIsUp` is a set of dotted metric-path
 * fragments where an *increase* means worse (e.g. displacement, deaths,
 * hunger). Metrics not in the set default to "up = worse" only when
 * their name suggests harm.
 */
export function diffBackbone(
  oldSnap: Backbone,
  newSnap: Backbone,
  worseIsUp = DEFAULT_WORSE_IS_UP,
): SnapshotDiffResult {
  const ts = Date.now();
  const countryList: CountryDiff[] = [];
  const oldByIso = indexByIso(oldSnap.countries ?? []);
  const newByIso = indexByIso(newSnap.countries ?? []);
  const allIso = new Set([...Object.keys(oldByIso), ...Object.keys(newByIso)]);

  for (const iso3 of allIso) {
    const oldC = oldByIso[iso3];
    const newC = newByIso[iso3];
    const changes = diffNumeric(oldC ?? null, newC ?? null);
    if (changes.length === 0) continue;
    let worsening = 0;
    let improving = 0;
    for (const c of changes) {
      if (isWorse(c, worseIsUp)) worsening += Math.abs(c.delta);
      else improving += Math.abs(c.delta);
    }
    countryList.push({ iso3, changes, worsening, improving });
  }

  const global = diffNumeric(oldSnap.global_indicators ?? {}, newSnap.global_indicators ?? {});

  const countriesWorsened = countryList.filter((c) => c.worsening > c.improving).length;
  const countriesImproved = countryList.filter((c) => c.improving > c.worsening).length;
  const totalChanges = countryList.reduce((s, c) => s + c.changes.length, 0) + global.length;

  countryList.sort((a, b) => b.worsening - a.worsening);

  const summary = buildSummary(countryList, global, countriesWorsened, countriesImproved);

  return {
    countries: countryList,
    global,
    totalChanges,
    countriesWorsened,
    countriesImproved,
    ts,
    summary,
  };
}

function indexByIso(countries: { iso3: string; [k: string]: unknown }[]): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const c of countries) {
    if (c.iso3) out[c.iso3] = c as Record<string, unknown>;
  }
  return out;
}

/** Metric path fragments where a value going UP means conditions WORSENED. */
export const DEFAULT_WORSE_IS_UP = [
  "displacement",
  "refugees",
  "idp",
  "deaths",
  "casualties",
  "fatalities",
  "hunger",
  "undernourish",
  "food_insecur",
  "conflict",
  "violence",
  "sanctions",
  "poverty",
  "unemployment",
  "inflation",
  "debt",
  "corruption",
  "military",
  "arms",
  "covid",
  "cases",
  "attack",
];

/** Metric path fragments where a value going UP means conditions IMPROVED. */
export const BETTER_IS_UP = [
  "gdp",
  "literacy",
  "education",
  "vaccin",
  "water_access",
  "sanitation",
  "electricity",
  "health_access",
  "freedom",
  "press",
  "democracy",
  "peace",
  "aid",
];

function isWorse(change: MetricChange, worseIsUp: string[]): boolean {
  if (change.direction === "added") return false;
  if (change.direction === "removed") return false;
  const lower = change.path.toLowerCase();
  const upMeansBetter = BETTER_IS_UP.some((f) => lower.includes(f));
  const upMeansWorse = worseIsUp.some((f) => lower.includes(f));
  // Default: up = worse unless explicitly a "better is up" metric.
  if (upMeansBetter) return change.direction === "down";
  if (upMeansWorse) return change.direction === "up";
  return change.direction === "up";
}

/* ═══════════════════════════════════════════════════════════════
   Summary + display
   ═══════════════════════════════════════════════════════════════ */

function buildSummary(
  countries: CountryDiff[],
  global: MetricChange[],
  worsened: number,
  improved: number,
): string {
  const parts: string[] = [];
  parts.push(`${global.length + countries.reduce((s, c) => s + c.changes.length, 0)} metrics changed.`);
  parts.push(`${worsened} countr${worsened === 1 ? "y" : "ies"} worsened, ${improved} improved.`);
  const top = countries.slice(0, 3).map((c) => c.iso3);
  if (top.length > 0) parts.push(`Most-worsened: ${top.join(", ")}.`);
  return parts.join(" ");
}

/** Format a single change for display. */
export function describeChange(c: MetricChange): string {
  const arrow = c.direction === "up" ? "↑" : c.direction === "down" ? "↓" : c.direction === "added" ? "+" : "−";
  const oldStr = c.old === null ? "—" : c.old.toLocaleString();
  const newStr = c.now === null ? "—" : c.now.toLocaleString();
  const rel = Number.isFinite(c.relDelta)
    ? ` (${c.relDelta >= 0 ? "+" : ""}${(c.relDelta * 100).toFixed(1)}%)`
    : "";
  return `${c.path}: ${oldStr} ${arrow} ${newStr}${rel}`;
}

/** The top-N worsening countries for a "what got worse" strip. */
export function topWorsened(diff: SnapshotDiffResult, limit = 10): CountryDiff[] {
  return [...diff.countries].sort((a, b) => b.worsening - a.worsening).slice(0, limit);
}
