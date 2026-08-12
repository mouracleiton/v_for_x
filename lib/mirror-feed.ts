/**
 * V FOR X — Cross-Mirror Consensus Auto-Feed (Mirror Ring)
 *
 * When a device is briefly online, it can ask each Mirror Ring host for
 * that mirror's current consensus root hash. Aggregating those roots
 * answers a single high-stakes question: **are the mirrors in agreement,
 * or has one of them been silently edited?**
 *
 * The network fetch is isolated behind an injectable `fetchRoot`
 * function so the core stays testable offline and never phones home
 * without an explicit UI opt-in. A thin `liveFeed` helper wires it to
 * `fetch()` for the online path.
 *
 * Fully optional: offline, the feed simply returns "no reachable
 * mirrors". No background polling, no telemetry.
 */

import type { RingEntry } from "./mirror-ring";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

/** A mirror host + the root hash it reported (or null if unreachable). */
export interface MirrorFeedEntry {
  host: string;
  root: string | null;
  ts: number;
  /** Why the root is missing, when applicable. */
  error?: string;
}

/** A group of mirrors that reported the same root hash. */
export interface FeedRootGroup {
  root: string;
  count: number;
  hosts: string[];
}

export interface MirrorFeedResult {
  /** Per-mirror results. */
  entries: MirrorFeedEntry[];
  /** Reachable mirrors that returned a root. */
  reachable: number;
  /** Total mirrors attempted. */
  attempted: number;
  /** Groups of mirrors sharing each root hash. */
  groups: FeedRootGroup[];
  /** The largest group (majority root). */
  majority: FeedRootGroup | null;
  /** Distinct root hashes observed. */
  distinctRoots: string[];
  /** Whether all reachable mirrors agree (≤1 distinct root). */
  inAgreement: boolean;
  /** Whether a fork is detected (>1 distinct root). */
  hasFork: boolean;
  /** Percentage of reachable mirrors in the majority group. */
  majorityPercentage: number;
  /** Epoch ms the feed was gathered. */
  ts: number;
}

/**
 * Injectable root fetcher. Given a mirror host, return its current
 * consensus root hash, or null if unreachable. The default `liveFeed`
 * implementation uses `fetch()`.
 */
export type RootFetcher = (host: string) => Promise<string | null>;

/* ═══════════════════════════════════════════════════════════════
   Core: gather roots from mirrors and analyze consensus
   ═══════════════════════════════════════════════════════════════ */

/**
 * Gather consensus roots from a list of mirrors using an injectable
 * fetcher, then run a lightweight agreement analysis. Safe to call
 * offline — every unreachable mirror simply contributes a null root.
 */
export async function gatherMirrorFeed(
  mirrors: { host: string }[],
  fetchRoot: RootFetcher,
  now = Date.now(),
): Promise<MirrorFeedResult> {
  const entries: MirrorFeedEntry[] = [];
  for (const m of mirrors) {
    try {
      const root = await fetchRoot(m.host);
      entries.push({ host: m.host, root, ts: now, error: root ? undefined : "no_root" });
    } catch (e) {
      entries.push({
        host: m.host,
        root: null,
        ts: now,
        error: e instanceof Error ? e.message : "fetch_failed",
      });
    }
  }
  return analyzeFeed(entries, now);
}

/** Re-analyze an existing set of feed entries (no network). */
export function analyzeFeed(entries: MirrorFeedEntry[], now = Date.now()): MirrorFeedResult {
  const withRoot = entries.filter((e) => e.root !== null);
  const reachable = withRoot.length;

  // Group mirrors by the root they reported.
  const byRoot = new Map<string, string[]>();
  for (const e of withRoot) {
    const root = e.root as string;
    const arr = byRoot.get(root) ?? [];
    arr.push(e.host);
    byRoot.set(root, arr);
  }

  const groups: FeedRootGroup[] = Array.from(byRoot.entries())
    .map(([root, hosts]) => ({ root, count: hosts.length, hosts }))
    .sort((a, b) => b.count - a.count);

  const distinctRoots = groups.map((g) => g.root);
  const majority = groups[0] ?? null;
  const majorityPercentage = reachable > 0 && majority ? Math.round((majority.count / reachable) * 100) : 0;
  const hasFork = distinctRoots.length > 1;

  return {
    entries,
    reachable,
    attempted: entries.length,
    groups,
    majority,
    distinctRoots,
    inAgreement: !hasFork,
    hasFork,
    majorityPercentage,
    ts: now,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Mirror Ring integration
   ═══════════════════════════════════════════════════════════════ */

/**
 * Gather the consensus feed from a Mirror Ring (RingEntry[] from
 * lib/mirror-ring.ts), using the supplied fetcher.
 */
export async function gatherRingFeed(
  ring: RingEntry[],
  fetchRoot: RootFetcher,
  now = Date.now(),
): Promise<MirrorFeedResult> {
  const mirrors = ring
    .map((e) => ({ host: e.host }));
  return gatherMirrorFeed(mirrors, fetchRoot, now);
}

/* ═══════════════════════════════════════════════════════════════
   Live network fetch (opt-in, online only)
   ═══════════════════════════════════════════════════════════════ */

/** Default root path mirrors serve their consensus root at. */
export const DEFAULT_ROOT_PATH = "/api/v1/consensus-root.json";

/**
 * Live root fetcher using the browser fetch API. Returns null for any
 * network error or non-2xx. Honors an abort signal so the UI can bail.
 */
export function liveRootFetcher(path = DEFAULT_ROOT_PATH, timeoutMs = 4000): RootFetcher {
  return async (host: string): Promise<string | null> => {
    if (typeof fetch !== "function") return null;
    const base = host.replace(/\/$/, "");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(base + path, { signal: controller.signal });
      if (!res.ok) return null;
      const data = (await res.json()) as { root?: string; rootHash?: string };
      return data.root ?? data.rootHash ?? null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
}

/**
 * Run the live feed against a Mirror Ring. Returns the same result as
 * gatherRingFeed but pre-wired to fetch(). The caller decides whether
 * the network is allowed (e.g. gated behind Quiet Hours).
 */
export async function liveFeed(
  ring: RingEntry[],
  path = DEFAULT_ROOT_PATH,
  now = Date.now(),
): Promise<MirrorFeedResult> {
  return gatherRingFeed(ring, liveRootFetcher(path), now);
}

/* ═══════════════════════════════════════════════════════════════
   Reporting
   ═══════════════════════════════════════════════════════════════ */

/** Build a feed result from a mirror-exported report (best-effort). */
export function feedFromReport(json: string): MirrorFeedResult | null {
  let parsed: { entries?: MirrorFeedEntry[]; attestations?: { mirrorEndpoint: string; rootHash: string; ts: number }[] };
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  const entries: MirrorFeedEntry[] =
    parsed.entries ??
    (parsed.attestations ?? []).map((a) => ({
      host: a.mirrorEndpoint,
      root: a.rootHash,
      ts: a.ts,
    }));
  return analyzeFeed(entries, Date.now());
}

/** One-line summary for a feed card. */
export function summarizeFeed(result: MirrorFeedResult): string {
  if (result.attempted === 0) return "No mirrors in ring.";
  if (result.reachable === 0) return `${result.attempted} mirrors, none reachable.`;
  const agree = result.inAgreement ? "AGREE" : "DIVERGE";
  return `${result.reachable}/${result.attempted} reachable · roots ${agree} (${result.distinctRoots.length} distinct, ${result.majorityPercentage}% majority).`;
}
