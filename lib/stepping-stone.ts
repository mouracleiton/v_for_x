/**
 * V FOR X — The Stepping Stone (Circumvention Live-Tester)
 *
 * A client-side tool that probes which circumvention transports actually
 * work from the user's CURRENT connection, measures speed/latency, and
 * recommends the best path right now.
 *
 * The browser cannot perform raw TCP, cannot forge TLS SNI, and cannot set
 * the HTTP `Host` header independently of the URL origin — so true domain
 * fronting cannot be executed from a page. Instead, each transport is probed
 * via the primitives the browser DOES expose:
 *
 *   • DIRECT          — plain HTTPS reachability + a real download-throughput
 *                       measurement against a public speed-test endpoint.
 *   • DOMAIN_FRONTING — CDN-edge reachability + latency to high-reputation
 *                       "front" domains. If the edge that serves many Hosts is
 *                       reachable, the fronting technique is viable from here.
 *   • SNOWFLAKE       — WebRTC + STUN viability. Snowflake bridges connect a
 *                       censored client to a volunteer proxy over WebRTC; if
 *                       the browser can gather a server-reflexive (srflx) ICE
 *                       candidate from a public STUN server, the transport is
 *                       viable from this network.
 *   • MASQUE          — DNS-over-HTTPS (DoH) reachability. MASQUE tunnels
 *                       traffic through HTTP CONNECT over TLS to a relay and
 *                       depends on encrypted-DNS infrastructure; a reachable
 *                       JSON DoH endpoint signals the building blocks work.
 *
 * All scoring is PURE (no browser APIs) so it is fully unit-testable. Only the
 * probe runners touch the network / WebRTC, and they are guarded for non-browser
 * environments. No data ever leaves the device except the probe requests
 * themselves to the public infrastructure listed in PROBE_ENDPOINTS.
 *
 * Modeled on defensive censorship-measurement tools (OONI Probe, Snowflake's
 * NAT-probing). This is anti-censorship tooling, by design.
 */

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

export type TransportId = "direct" | "domain_fronting" | "snowflake" | "masque";

export type ProbeStatus = "working" | "degraded" | "blocked" | "unknown";

export interface ProbeResult {
  transport: TransportId;
  status: ProbeStatus;
  /** Round-trip latency in milliseconds (lower is better). null if unmeasured. */
  latencyMs: number | null;
  /** Estimated download throughput in kbps (higher is better). null if unmeasured. */
  throughputKbps: number | null;
  /** One-line human-readable measurement summary. */
  detail: string;
  /** Individual measured facts, e.g. ["srflx candidate in 142ms", "STUN: stun.l.google.com"]. */
  evidence: string[];
  /** Epoch milliseconds when the probe completed. */
  measuredAt: number;
}

export interface TransportDef {
  id: TransportId;
  name: string;
  /** Short label of the technique, e.g. "WebRTC + STUN". */
  technique: string;
  description: string;
  /** Inherent reliability/usability weight, 0..1. Shifts the score without dominating it. */
  reliabilityWeight: number;
  /** Typical real-world throughput ceiling in kbps, used to normalize throughput scoring. */
  throughputCeilingKbps: number;
  /** Whether the transport provides a usable tunnel from a censored network. */
  bypassesCensorship: boolean;
}

export interface RankedTransport {
  def: TransportDef;
  result: ProbeResult;
  score: number;
  rank: number;
}

export interface Recommendation {
  bestTransport: TransportId | null;
  bestName: string;
  bestScore: number;
  rationale: string;
  fallbackChain: { transport: TransportId; name: string; status: ProbeStatus; score: number }[];
  /** Overall connectivity verdict for this network. */
  verdict: "clear" | "partial" | "blocked" | "unknown";
  summary: string;
}

export type ProbeMap = Partial<Record<TransportId, ProbeResult>>;

/* ═══════════════════════════════════════════════════════════
   TRANSPORT DEFINITIONS
   ═══════════════════════════════════════════════════════════ */

export const TRANSPORTS: Record<TransportId, TransportDef> = {
  direct: {
    id: "direct",
    name: "DIRECT",
    technique: "Plain HTTPS",
    description:
      "Baseline plain-HTTPS connectivity. If this works you are not fully blocked; the other transports become speed or privacy upgrades rather than escapes.",
    reliabilityWeight: 1.0,
    throughputCeilingKbps: 20000,
    bypassesCensorship: false,
  },
  domain_fronting: {
    id: "domain_fronting",
    name: "DOMAIN FRONTING",
    technique: "CDN edge + shared-front Host",
    description:
      "Hides the real destination behind a benign-looking Host on a CDN edge shared by many domains. Now mostly killed by major CDNs, but where a shared edge is reachable the technique remains viable.",
    reliabilityWeight: 0.45,
    throughputCeilingKbps: 8000,
    bypassesCensorship: true,
  },
  snowflake: {
    id: "snowflake",
    name: "SNOWFLAKE",
    technique: "WebRTC + STUN bridge",
    description:
      "A Tor pluggable transport that bridges a censored client to a volunteer proxy over WebRTC. Viable wherever the browser can punch through NAT via a public STUN server.",
    reliabilityWeight: 0.8,
    throughputCeilingKbps: 4000,
    bypassesCensorship: true,
  },
  masque: {
    id: "masque",
    name: "MASQUE",
    technique: "HTTP CONNECT over TLS + DoH",
    description:
      "Tunnels traffic through HTTP CONNECT over TLS to a relay, relying on encrypted-DNS infrastructure. Viable wherever DNS-over-HTTPS endpoints are reachable.",
    reliabilityWeight: 0.65,
    throughputCeilingKbps: 6000,
    bypassesCensorship: true,
  },
};

export const TRANSPORT_ORDER: TransportId[] = ["direct", "domain_fronting", "snowflake", "masque"];

/* ═══════════════════════════════════════════════════════════
   PUBLIC PROBE ENDPOINTS

   All targets are legitimate, public, defensive infrastructure:
   • generate_204 / cdn-cgi/trace — standard connectivity-check endpoints.
   • speed.cloudflare.com/__down  — Cloudflare's public, CORS-enabled speed test.
   • DNS-over-HTTPS JSON APIs      — Cloudflare & Google public resolvers.
   • Public STUN servers           — the same servers Snowflake itself uses.
   No data is submitted; these are read-only reachability/speed checks.
   ═══════════════════════════════════════════════════════════ */

export const PROBE_ENDPOINTS = {
  /** Plain-HTTPS reachability + latency targets (mode: no-cors). */
  reachability: [
    "https://www.gstatic.com/generate_204",
    "https://www.google.com/generate_204",
    "https://cloudflare.com/cdn-cgi/trace",
  ],
  /** High-reputation CDN "front" domains (mode: no-cors). */
  cdnFronts: [
    "https://cdn.jsdelivr.net/npm/jsdelivr-py@1/favicon.ico",
    "https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-mml-chtml.js",
  ],
  /** Public, CORS-enabled download-throughput test endpoint. */
  throughput: "https://speed.cloudflare.com/__down",
  /** JSON DNS-over-HTTPS endpoints (CORS-enabled). */
  doh: [
    "https://cloudflare-dns.com/dns-query?name=example.com&type=A",
    "https://dns.google/resolve?name=example.com&type=A",
  ],
  /** Public STUN servers (used by Snowflake itself). */
  stun: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"],
} as const;

/* ═══════════════════════════════════════════════════════════
   SCORING — PURE FUNCTIONS

   Each probe yields up to 100 points:
     base (status)   0..50   primary signal — did it work at all?
     latency         0..25   lower RTT = faster path
     throughput      0..25   higher kbps = fatter pipe
   The transport's reliability weight then nudges the result.
   ═══════════════════════════════════════════════════════════ */

/** Thresholds (ms) for latency scoring. Below LATENCY_FLOOR → full marks. */
const LATENCY_FLOOR = 50;
const LATENCY_CEIL = 800;

/** Base points awarded purely by probe status. */
export function baseScore(status: ProbeStatus): number {
  switch (status) {
    case "working":
      return 50;
    case "degraded":
      return 30;
    case "unknown":
      return 12;
    case "blocked":
    default:
      return 0;
  }
}

/** Latency contribution, 0..25. null/unknown latency → 0. */
export function latencyScore(latencyMs: number | null): number {
  if (latencyMs === null || latencyMs === undefined || !isFinite(latencyMs) || latencyMs < 0) {
    return 0;
  }
  if (latencyMs <= LATENCY_FLOOR) return 25;
  if (latencyMs >= LATENCY_CEIL) return 0;
  const t = (LATENCY_CEIL - latencyMs) / (LATENCY_CEIL - LATENCY_FLOOR);
  return Math.round(t * 25);
}

/** Throughput contribution, 0..25, on a sqrt curve so low bandwidth still scores. null → 0. */
export function throughputScore(throughputKbps: number | null, ceilingKbps: number): number {
  if (
    throughputKbps === null ||
    throughputKbps === undefined ||
    !isFinite(throughputKbps) ||
    throughputKbps <= 0 ||
    ceilingKbps <= 0
  ) {
    return 0;
  }
  const ratio = Math.min(1, throughputKbps / ceilingKbps);
  return Math.round(Math.sqrt(ratio) * 25);
}

/**
 * Score a single probe result against its transport definition, 0..100.
 * Pure — safe to unit-test without a browser.
 */
export function scoreResult(result: ProbeResult, def: TransportDef): number {
  const base = baseScore(result.status);
  const lat = latencyScore(result.latencyMs);
  const thr = throughputScore(result.throughputKbps, def.throughputCeilingKbps);
  const raw = base + lat + thr;
  // Reliability weight nudges but never dominates: range [0.6×, 1.0×].
  const weighted = raw * (0.6 + 0.4 * def.reliabilityWeight);
  return Math.round(Math.max(0, Math.min(100, weighted)));
}

/** Numeric priority for status, used for stable sorting. */
export function statusPriority(status: ProbeStatus): number {
  switch (status) {
    case "working":
      return 0;
    case "degraded":
      return 1;
    case "unknown":
      return 2;
    case "blocked":
    default:
      return 3;
  }
}

/**
 * Rank all transports from a probe map. Working, fast, fat transports win;
 * ties broken by status priority then by definition order (stable).
 * Returns entries even for transports that were never probed (status unknown).
 */
export function rankTransports(results: ProbeMap): RankedTransport[] {
  const ranked = TRANSPORT_ORDER.map((id) => {
    const def = TRANSPORTS[id];
    const result: ProbeResult =
      results[id] ?? emptyResult(id);
    return { def, result, score: scoreResult(result, def), rank: 0 };
  });

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const sp = statusPriority(a.result.status) - statusPriority(b.result.status);
    if (sp !== 0) return sp;
    return TRANSPORT_ORDER.indexOf(a.def.id) - TRANSPORT_ORDER.indexOf(b.def.id);
  });

  ranked.forEach((r, i) => {
    r.rank = i + 1;
  });
  return ranked;
}

/** A blank result for a transport that was never probed. */
export function emptyResult(transport: TransportId): ProbeResult {
  return {
    transport,
    status: "unknown",
    latencyMs: null,
    throughputKbps: null,
    detail: "Not tested yet.",
    evidence: [],
    measuredAt: 0,
  };
}

/* ═══════════════════════════════════════════════════════════
   RECOMMENDATION ENGINE — PURE
   ═══════════════════════════════════════════════════════════ */

/**
 * Produce a best-path recommendation from a probe map.
 *
 * Verdict logic:
 *   • clear   — the direct baseline works. You have connectivity; transports
 *               are speed/privacy upgrades, not escapes.
 *   • partial — the direct baseline is blocked/degraded BUT at least one
 *               censorship-bypassing transport works. You are censored but
 *               can escape.
 *   • blocked — nothing works. Hard censorship or you are offline.
 *   • unknown — no probe has completed yet.
 */
export function recommend(results: ProbeMap): Recommendation {
  const ranked = rankTransports(results);
  const direct = results.direct;
  const directWorks = direct?.status === "working";
  const anyBypassWorks = ranked.some(
    (r) => r.def.bypassesCensorship && r.result.status === "working",
  );
  const anyDegraded = ranked.some((r) => r.result.status === "degraded");
  const probed = ranked.filter((r) => r.result.status !== "unknown");

  // Verdict
  let verdict: Recommendation["verdict"];
  if (probed.length === 0) {
    verdict = "unknown";
  } else if (directWorks) {
    verdict = "clear";
  } else if (anyBypassWorks) {
    verdict = "partial";
  } else if (anyDegraded) {
    verdict = "partial";
  } else {
    verdict = "blocked";
  }

  // Best path: prefer a working censorship-bypassing transport; otherwise the
  // top-ranked transport overall. For a "clear" network, direct is usually best.
  let best: RankedTransport | undefined;
  if (verdict === "partial") {
    best =
      ranked.find((r) => r.def.bypassesCensorship && r.result.status === "working") ??
      ranked.find((r) => r.result.status !== "blocked") ??
      ranked[0];
  } else {
    best = ranked.find((r) => r.result.status === "working") ?? ranked[0];
  }

  const fallbackChain = ranked
    .filter((r) => r !== best)
    .map((r) => ({
      transport: r.def.id,
      name: r.def.name,
      status: r.result.status,
      score: r.score,
    }));

  const rationale = buildRationale(best, verdict, results);
  const summary = buildSummary(verdict, best, results);

  return {
    bestTransport: best?.def.id ?? null,
    bestName: best?.def.name ?? "—",
    bestScore: best?.score ?? 0,
    rationale,
    fallbackChain,
    verdict,
    summary,
  };
}

function buildRationale(best: RankedTransport | undefined, verdict: Recommendation["verdict"], results: ProbeMap): string {
  if (!best || best.result.status === "unknown") {
    return "Run the test suite to measure which transports are reachable from this connection.";
  }
  const r = best.result;
  const latTxt = r.latencyMs !== null ? `${Math.round(r.latencyMs)}ms RTT` : "RTT unknown";
  const thrTxt =
    r.throughputKbps !== null
      ? r.throughputKbps >= 1000
        ? `${(r.throughputKbps / 1000).toFixed(1)} Mbps down`
        : `${Math.round(r.throughputKbps)} kbps down`
      : "throughput unknown";
  const head = `${best.def.name} scored ${best.score}/100 (${r.status}, ${latTxt}, ${thrTxt}).`;

  switch (verdict) {
    case "clear":
      return `${head} Your baseline connection is open, so this is your fastest usable path — the bypass transports below are privacy upgrades, not escapes.`;
    case "partial": {
      const direct = results.direct;
      const directNote =
        direct?.status === "blocked"
          ? "Direct access is blocked from this network."
          : direct?.status === "degraded"
            ? "Direct access is degraded from this network."
            : "Direct access is not confirmed.";
      return `${head} ${directNote} This path gets you past the censorship that ${directNote.toLowerCase()}`;
    }
    case "blocked":
      return `${head} No transport reached the open network from here. You may be offline, behind a strict firewall, or facing active blocking of every tested path.`;
    default:
      return head;
  }
}

function buildSummary(verdict: Recommendation["verdict"], _best: RankedTransport | undefined, _results: ProbeMap): string {
  switch (verdict) {
    case "clear":
      return "NETWORK OPEN — direct access works. Transports below are ranked by speed and privacy.";
    case "partial":
      return "CENSORSHIP DETECTED — direct access is blocked or degraded, but at least one bypass transport works. Use the recommended path.";
    case "blocked":
      return "HARD BLOCK / OFFLINE — no tested transport reached the open network. Try a different network, a bridge, or physical distribution (USB dead drop).";
    default:
      return "NOT TESTED — press RUN to probe which transports work from this connection.";
  }
}

/* ═══════════════════════════════════════════════════════════
   DISPLAY HELPERS — PURE
   ═══════════════════════════════════════════════════════════ */

export interface Rating {
  label: string;
  /** CSS color variable or hex for the terminal palette. */
  color: string;
}

/** Human rating + color for a latency value. */
export function latencyRating(latencyMs: number | null): Rating {
  if (latencyMs === null || latencyMs === undefined || !isFinite(latencyMs)) {
    return { label: "—", color: "var(--color-content-dim)" };
  }
  if (latencyMs <= 80) return { label: "FAST", color: "var(--color-terminal-green)" };
  if (latencyMs <= 200) return { label: "OK", color: "var(--color-terminal-green)" };
  if (latencyMs <= 450) return { label: "SLOW", color: "var(--color-warning-amber)" };
  return { label: "POOR", color: "var(--color-blood-bright)" };
}

/** Human rating + color for a throughput value. */
export function throughputRating(throughputKbps: number | null): Rating {
  if (throughputKbps === null || throughputKbps === undefined || !isFinite(throughputKbps) || throughputKbps <= 0) {
    return { label: "—", color: "var(--color-content-dim)" };
  }
  if (throughputKbps >= 5000) return { label: "FAT", color: "var(--color-terminal-green)" };
  if (throughputKbps >= 1500) return { label: "GOOD", color: "var(--color-terminal-green)" };
  if (throughputKbps >= 400) return { label: "THIN", color: "var(--color-warning-amber)" };
  return { label: "STARVED", color: "var(--color-blood-bright)" };
}

/** StatusPill-style color token for a probe status. */
export function statusColor(status: ProbeStatus): "green" | "amber" | "blood" | "dim" {
  switch (status) {
    case "working":
      return "green";
    case "degraded":
      return "amber";
    case "blocked":
      return "blood";
    default:
      return "dim";
  }
}

/** Uppercase status label. */
export function statusLabel(status: ProbeStatus): string {
  switch (status) {
    case "working":
      return "WORKING";
    case "degraded":
      return "DEGRADED";
    case "blocked":
      return "BLOCKED";
    default:
      return "UNKNOWN";
  }
}

/** Format a kbps value for display. */
export function formatThroughput(kbps: number | null): string {
  if (kbps === null || kbps === undefined || !isFinite(kbps)) return "—";
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} Mbps`;
  return `${Math.round(kbps)} kbps`;
}

/** Format a latency value for display. */
export function formatLatency(ms: number | null): string {
  if (ms === null || ms === undefined || !isFinite(ms)) return "—";
  return `${Math.round(ms)} ms`;
}

/* ═══════════════════════════════════════════════════════════
   BROWSER PROBE RUNNERS — IMPURE

   Everything below touches fetch / WebRTC / timers. Each helper is robust:
   timeouts via AbortController, no-cors for cross-origin reachability, and
   graceful classification of failures. None of this runs during unit tests.
   ═══════════════════════════════════════════════════════════ */

/** Runtime browser-capability check (not a module-load constant, so SSR and
 *  test environments that lack a real fetch are detected at call time). */
function hasBrowserEnv(): boolean {
  return typeof window !== "undefined" && typeof window.fetch === "function";
}

interface FetchOutcome {
  ok: boolean;
  latencyMs: number;
  /** Classification of any failure. */
  error?: string;
}

async function timedFetch(url: string, timeoutMs: number, mode: RequestMode): Promise<FetchOutcome> {
  if (!hasBrowserEnv()) {
    return { ok: false, latencyMs: 0, error: "no-browser" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    await fetch(url, { mode, cache: "no-store", signal: controller.signal, redirect: "follow" });
    return { ok: true, latencyMs: performance.now() - start };
  } catch (e) {
    const elapsed = performance.now() - start;
    const aborted = e instanceof DOMException && e.name === "AbortError";
    return {
      ok: false,
      latencyMs: elapsed,
      error: aborted ? "timeout" : "network-blocked",
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Probe a list of no-cors endpoints; succeed if at least one resolves. Returns best (lowest) latency. */
async function reachabilityProbe(urls: readonly string[], timeoutMs: number): Promise<{
  ok: boolean;
  latencyMs: number | null;
  reached: string;
  evidence: string[];
}> {
  const evidence: string[] = [];
  const latencies: number[] = [];
  let reached = "";
  await Promise.all(
    urls.map(async (url) => {
      const out = await timedFetch(url, timeoutMs, "no-cors");
      if (out.ok) {
        latencies.push(out.latencyMs);
        reached = reached || url;
        evidence.push(`✓ ${hostOf(url)} — ${Math.round(out.latencyMs)}ms`);
      } else {
        evidence.push(`✗ ${hostOf(url)} — ${out.error}`);
      }
    }),
  );
  const ok = latencies.length > 0;
  const latencyMs = ok ? Math.min(...latencies) : null;
  return { ok, latencyMs, reached, evidence };
}

/** Measure real download throughput against Cloudflare's public, CORS-enabled speed endpoint. */
async function throughputProbe(bytes: number, timeoutMs: number): Promise<{ kbps: number | null; elapsedMs: number }> {
  if (!hasBrowserEnv()) return { kbps: null, elapsedMs: 0 };
  const url = `${PROBE_ENDPOINTS.throughput}?bytes=${bytes}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    const res = await fetch(url, { mode: "cors", cache: "no-store", signal: controller.signal });
    if (!res.ok && res.status !== 0) {
      return { kbps: null, elapsedMs: performance.now() - start };
    }
    const buf = await res.arrayBuffer();
    const elapsedMs = performance.now() - start;
    if (elapsedMs <= 0 || buf.byteLength <= 0) return { kbps: null, elapsedMs };
    const bits = buf.byteLength * 8;
    const kbps = bits / elapsedMs; // bits per ms == kbps
    return { kbps, elapsedMs };
  } catch {
    return { kbps: null, elapsedMs: performance.now() - start };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * WebRTC + STUN viability probe (the Snowflake transport primitive).
 * Creates a transient RTCPeerConnection, gathers ICE candidates, and reports
 * whether a server-reflexive (srflx) candidate was obtained and how long it took.
 */
async function stunProbe(stunUrls: readonly string[], timeoutMs: number): Promise<{
  ok: boolean;
  srflx: boolean;
  latencyMs: number | null;
  candidateType: string;
  detail: string;
  evidence: string[];
}> {
  const evidence: string[] = [];
  if (!hasBrowserEnv() || typeof RTCPeerConnection === "undefined") {
    return { ok: false, srflx: false, latencyMs: null, candidateType: "none", detail: "WebRTC unavailable", evidence: ["✗ RTCPeerConnection not supported"] };
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (r: {
      ok: boolean;
      srflx: boolean;
      latencyMs: number | null;
      candidateType: string;
      detail: string;
      evidence: string[];
    }) => {
      if (settled) return;
      settled = true;
      try {
        pc.close();
      } catch {
        /* ignore */
      }
      resolve(r);
    };

    const start = performance.now();
    let pc: RTCPeerConnection;
    try {
      pc = new RTCPeerConnection({ iceServers: stunUrls.map((u) => ({ urls: u })) });
    } catch (e) {
      resolve({
        ok: false,
        srflx: false,
        latencyMs: null,
        candidateType: "none",
        detail: "RTCPeerConnection construction failed",
        evidence: [`✗ ${String(e)}`],
      });
      return;
    }

    const timer = setTimeout(() => {
      finish({
        ok: false,
        srflx: false,
        latencyMs: null,
        candidateType: "none",
        detail: "STUN gathering timed out",
        evidence: [...evidence, "✗ STUN timeout — UDP/WebRTC may be blocked"],
      });
    }, timeoutMs);

    // A data channel is required to trigger ICE gathering in some browsers.
    try {
      pc.createDataChannel("stepping-stone");
    } catch {
      /* ignore */
    }

    pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
      const c = e.candidate;
      if (!c) {
        // Gathering complete.
        clearTimeout(timer);
        const elapsed = performance.now() - start;
        const srflxSeen = evidence.some((line) => line.includes("srflx"));
        finish({
          ok: srflxSeen,
          srflx: srflxSeen,
          latencyMs: srflxSeen ? elapsed : null,
          candidateType: srflxSeen ? "srflx" : "host-only",
          detail: srflxSeen
            ? `Server-reflexive candidate obtained — NAT traversal works.`
            : "No server-reflexive candidate — NAT/STUN traversal blocked.",
          evidence,
        });
        return;
      }
      const cand = c as unknown as { type?: string; candidate?: string };
      const typ = cand.type ?? "unknown";
      evidence.push(`• ICE ${typ} via ${hostOf(cand.candidate ?? "") || "local"} (${Math.round(performance.now() - start)}ms)`);
    };

    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch((e) => {
        clearTimeout(timer);
        finish({
          ok: false,
          srflx: false,
          latencyMs: null,
          candidateType: "none",
          detail: "ICE offer failed",
          evidence: [...evidence, `✗ ${String(e)}`],
        });
      });
  });
}

function hostOf(urlOrCandidate: string): string {
  try {
    if (urlOrCandidate.startsWith("http")) return new URL(urlOrCandidate).host;
  } catch {
    /* fall through */
  }
  // ICE candidate strings look like: "...typ srflx raddr ... rport ..."
  const m = urlOrCandidate.match(/([0-9]{1,3}(?:\.[0-9]{1,3}){3})/);
  return m ? m[1] : "";
}

/* ═══════════════════════════════════════════════════════════
   ORCHESTRATION — runs every transport probe, reports progress.
   ═══════════════════════════════════════════════════════════ */

export interface ProbeProgress {
  transport: TransportId;
  phase: string;
}

/**
 * Run all circumvention-transport probes from the current connection.
 * Calls onProgress before each transport begins. Returns a map of results.
 * No-op (returns unknowns) outside a browser.
 */
export async function runAllProbes(
  onProgress?: (p: ProbeProgress) => void,
  opts: { timeoutMs?: number; throughputBytes?: number } = {},
): Promise<ProbeMap> {
  const timeoutMs = opts.timeoutMs ?? 6000;
  const bytes = opts.throughputBytes ?? 262144; // 256 KiB download sample
  const results: ProbeMap = {};

  if (!hasBrowserEnv()) {
    return results;
  }

  /* ── DIRECT ── baseline reachability + throughput ── */
  onProgress?.({ transport: "direct", phase: "reachability" });
  const reach = await reachabilityProbe(PROBE_ENDPOINTS.reachability, timeoutMs);
  onProgress?.({ transport: "direct", phase: "throughput" });
  const tp = await throughputProbe(bytes, timeoutMs);
  const directEvidence = [...reach.evidence];
  if (tp.kbps !== null) directEvidence.push(`↓ ${formatThroughput(tp.kbps)} (${Math.round(tp.elapsedMs)}ms / 256KiB)`);
  results.direct = {
    transport: "direct",
    status: reach.ok ? (tp.kbps !== null ? "working" : "degraded") : "blocked",
    latencyMs: reach.latencyMs,
    throughputKbps: tp.kbps,
    detail: reach.ok
      ? `Direct HTTPS reachable${reach.latencyMs !== null ? ` at ${Math.round(reach.latencyMs)}ms` : ""}${tp.kbps !== null ? `, ${formatThroughput(tp.kbps)} download` : ""}.`
      : "Direct HTTPS unreachable — every baseline endpoint failed.",
    evidence: directEvidence,
    measuredAt: Date.now(),
  };

  /* ── DOMAIN FRONTING ── CDN edge + shared-front reachability ── */
  onProgress?.({ transport: "domain_fronting", phase: "cdn-edge" });
  const front = await reachabilityProbe(PROBE_ENDPOINTS.cdnFronts, timeoutMs);
  const frontReached = front.evidence.filter((e) => e.startsWith("✓")).length;
  results.domain_fronting = {
    transport: "domain_fronting",
    status: front.ok ? (frontReached >= 2 ? "working" : "degraded") : "blocked",
    latencyMs: front.latencyMs,
    throughputKbps: front.ok ? estimateFrontThroughput(results.direct) : null,
    detail: front.ok
      ? `${frontReached}/${PROBE_ENDPOINTS.cdnFronts.length} shared-edge CDN fronts reachable${front.latencyMs !== null ? ` at ${Math.round(front.latencyMs)}ms` : ""}. Fronting technique is viable from here.`
      : "No CDN front reachable — domain fronting is not viable from this network.",
    evidence: front.evidence,
    measuredAt: Date.now(),
  };

  /* ── SNOWFLAKE ── WebRTC + STUN viability ── */
  onProgress?.({ transport: "snowflake", phase: "webrtc-stun" });
  const stun = await stunProbe(PROBE_ENDPOINTS.stun, timeoutMs + 2000);
  results.snowflake = {
    transport: "snowflake",
    status: stun.srflx ? "working" : stun.ok ? "degraded" : "blocked",
    latencyMs: stun.latencyMs,
    // In-browser WebRTC throughput to a volunteer proxy can't be measured here;
    // report the transport's typical ceiling only when viable.
    throughputKbps: stun.srflx ? TRANSPORTS.snowflake.throughputCeilingKbps : null,
    detail: stun.detail,
    evidence: stun.evidence,
    measuredAt: Date.now(),
  };

  /* ── MASQUE ── DNS-over-HTTPS reachability ── */
  onProgress?.({ transport: "masque", phase: "doh" });
  const doh = await reachabilityProbeAsJson(PROBE_ENDPOINTS.doh, timeoutMs);
  results.masque = {
    transport: "masque",
    status: doh.ok ? (doh.parsed ? "working" : "degraded") : "blocked",
    latencyMs: doh.latencyMs,
    throughputKbps: doh.ok ? estimateFrontThroughput(results.direct) : null,
    detail: doh.ok
      ? `Encrypted-DNS (DoH) reachable${doh.latencyMs !== null ? ` at ${Math.round(doh.latencyMs)}ms` : ""}${doh.parsed ? ", JSON answer parsed" : ", reachable but unverified answer"}. MASQUE building blocks work.`
      : "DoH endpoints unreachable — MASQUE's DNS dependency is blocked from here.",
    evidence: doh.evidence,
    measuredAt: Date.now(),
  };

  return results;
}

/**
 * Like reachabilityProbe but for CORS-enabled JSON DoH endpoints. "ok" means
 * the fetch resolved; "parsed" means a JSON body with an Answer array came back,
 * which is the stronger signal that the resolver actually answered.
 */
async function reachabilityProbeAsJson(urls: readonly string[], timeoutMs: number): Promise<{
  ok: boolean;
  parsed: boolean;
  latencyMs: number | null;
  evidence: string[];
}> {
  const evidence: string[] = [];
  const latencies: number[] = [];
  let parsed = false;
  await Promise.all(
    urls.map(async (url) => {
      const out = await timedFetch(url, timeoutMs, "cors");
      if (!out.ok) {
        evidence.push(`✗ ${hostOf(url)} — ${out.error}`);
        return;
      }
      latencies.push(out.latencyMs);
      // Try to confirm a real DNS answer was returned.
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(url, { mode: "cors", cache: "no-store", signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const body = await res.json();
          if (body && (body.Answer || body.Answer === null || body.Status === 0 || Array.isArray(body.Answer))) {
            parsed = true;
            evidence.push(`✓ ${hostOf(url)} — DNS answer (${Math.round(out.latencyMs)}ms)`);
          } else {
            evidence.push(`~ ${hostOf(url)} — reachable, unexpected body (${Math.round(out.latencyMs)}ms)`);
          }
        } else {
          evidence.push(`~ ${hostOf(url)} — HTTP ${res.status} (${Math.round(out.latencyMs)}ms)`);
        }
      } catch {
        evidence.push(`~ ${hostOf(url)} — reachable, body unreadable (${Math.round(out.latencyMs)}ms)`);
      }
    }),
  );
  const ok = latencies.length > 0;
  return { ok, parsed, latencyMs: ok ? Math.min(...latencies) : null, evidence };
}

/**
 * Throughput for fronted/DoH transports can't be measured directly without a
 * tunneled payload; fall back to a conservative fraction of the direct baseline.
 */
function estimateFrontThroughput(direct: ProbeResult | undefined): number | null {
  if (!direct || direct.throughputKbps === null) return null;
  // Assume a tunneled path loses ~40% to overhead.
  return Math.max(0, direct.throughputKbps * 0.6);
}
