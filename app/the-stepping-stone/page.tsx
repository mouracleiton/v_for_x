"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import DataBar from "@/components/ui/DataBar";
import { sound } from "@/lib/sound";
import {
  runAllProbes,
  rankTransports,
  recommend,
  TRANSPORTS,
  TRANSPORT_ORDER,
  statusColor,
  statusLabel,
  statusPriority,
  latencyRating,
  throughputRating,
  formatLatency,
  formatThroughput,
  emptyResult,
  type ProbeMap,
  type ProbeResult,
  type TransportId,
  type ProbeProgress,
} from "@/lib/stepping-stone";

const VERDICT_META: Record<
  "clear" | "partial" | "blocked" | "unknown",
  { color: "green" | "amber" | "blood" | "dim"; glyph: string; title: string }
> = {
  clear: { color: "green", glyph: "◉", title: "NETWORK OPEN" },
  partial: { color: "amber", glyph: "⚠", title: "CENSORSHIP DETECTED" },
  blocked: { color: "blood", glyph: "✕", title: "HARD BLOCK / OFFLINE" },
  unknown: { color: "dim", glyph: "?", title: "NOT TESTED" },
};

export default function TheSteppingStonePage() {
  const [results, setResults] = useState<ProbeMap>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ProbeProgress | null>(null);
  const [lastRun, setLastRun] = useState<number | null>(null);
  const [logOpen, setLogOpen] = useState<Record<TransportId, boolean>>({
    direct: false,
    domain_fronting: false,
    snowflake: false,
    masque: false,
  });

  const recommendation = useMemo(() => recommend(results), [results]);
  const ranked = useMemo(() => rankTransports(results), [results]);

  const cardAccent = (s: ProbeResult["status"]): "blood" | "green" | "amber" =>
    s === "working" ? "green" : s === "degraded" ? "amber" : "blood";

  const runTests = useCallback(async () => {
    setRunning(true);
    setResults({});
    setProgress(null);
    sound.select();
    try {
      const map = await runAllProbes((p) => {
        setProgress(p);
        sound.nav();
      });
      setResults(map);
      setLastRun(Date.now());
      sound.success();
    } catch {
      sound.error();
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, []);

  const verdict = VERDICT_META[recommendation.verdict];

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[62] CIRCUMVENTION LIVE-TESTER</div>
        <h1 className="text-2xl md:text-3xl font-bold glow-blood">
          <span className="text-blood-bright">THE STEPPING STONE</span>
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // Don&apos;t trust the docs — test the wire. Probe which transports actually work from
          <span className="text-blood"> this </span> connection, measure speed/latency, and get the
          best path <span className="text-blood">right now.</span>
        </p>
      </div>

      {/* Run control */}
      <TerminalCard title="live probe" accent="green" glow className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={runTests}
            disabled={running}
            className="px-4 py-2 text-xs font-bold tracking-widest border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {running ? "▮▮ PROBING…" : "▶ RUN TEST SUITE"}
          </button>
          <div className="flex-1 text-xs text-content-secondary">
            {running && progress ? (
              <span>
                <span className="text-terminal-green">▸</span>{" "}
                <span className="text-blood-bright">{TRANSPORTS[progress.transport].name}</span>
                <span className="text-content-dim"> — {progress.phase}…</span>
              </span>
            ) : lastRun ? (
              <span>
                last run{" "}
                <span className="text-content-primary">
                  {new Date(lastRun).toLocaleTimeString()}
                </span>{" "}
                ·{" "}
                <span className="text-content-dim">
                  {TRANSPORT_ORDER.filter((id) => results[id]?.status === "working").length}/
                  {TRANSPORT_ORDER.length} paths working
                </span>
              </span>
            ) : (
              <span>
                tests: direct HTTPS · domain fronting · snowflake (WebRTC/STUN) · MASQUE (DoH).
                ~10–20s. No data leaves your device except the probe requests themselves.
              </span>
            )}
          </div>
        </div>
        {/* progress strip */}
        <div className="mt-3 flex gap-1">
          {TRANSPORT_ORDER.map((id) => {
            const r = results[id];
            const active = running && progress?.transport === id;
            const done = r && r.status !== "unknown";
            return (
              <div
                key={id}
                className="flex-1 h-1.5 transition-colors"
                style={{
                  backgroundColor: active
                    ? "var(--color-warning-amber)"
                    : done
                      ? r.status === "working"
                        ? "var(--color-terminal-green)"
                        : r.status === "degraded"
                          ? "var(--color-warning-amber)"
                          : r.status === "blocked"
                            ? "var(--color-blood)"
                            : "#333333"
                      : "#1a1a1a",
                }}
                title={TRANSPORTS[id].name}
              />
            );
          })}
        </div>
      </TerminalCard>

      {/* Recommendation */}
      <TerminalCard title="best path right now" accent="blood" className="mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <StatusPill color={verdict.color}>
            {verdict.glyph} {verdict.title}
          </StatusPill>
          {recommendation.bestTransport && recommendation.bestScore > 0 && (
            <>
              <span className="text-content-dim text-xs">→ RECOMMENDED:</span>
              <span className="text-terminal-green text-sm font-bold tracking-widest">
                {recommendation.bestName}
              </span>
              <span className="text-content-secondary text-xs">
                ({recommendation.bestScore}/100)
              </span>
            </>
          )}
        </div>
        <p className="text-xs text-content-secondary leading-relaxed mb-3">
          {recommendation.rationale}
        </p>
        {recommendation.fallbackChain.length > 0 && recommendation.verdict !== "unknown" && (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-content-dim mb-2">
              fallback chain
            </div>
            <div className="flex flex-wrap gap-2">
              {recommendation.fallbackChain
                .filter((f) => f.status !== "unknown")
                .map((f) => (
                  <span
                    key={f.transport}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] border"
                    style={{
                      borderColor:
                        f.status === "working"
                          ? "var(--color-terminal-green)"
                          : f.status === "degraded"
                            ? "var(--color-warning-amber)"
                            : "var(--color-blood)",
                      color:
                        f.status === "working"
                          ? "var(--color-terminal-green)"
                          : f.status === "degraded"
                            ? "var(--color-warning-amber)"
                            : "var(--color-blood-bright)",
                    }}
                  >
                    {f.name} · {f.score}
                  </span>
                ))}
            </div>
          </div>
        )}
      </TerminalCard>

      {/* Per-transport results */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {ranked.map((entry) => {
          const { def, result: r, score } = entry;
          const isBest = recommendation.bestTransport === def.id && score > 0;
          const lat = latencyRating(r.latencyMs);
          const thr = throughputRating(r.throughputKbps);
          return (
            <TerminalCard
              key={def.id}
              title={`${def.name}`}
              accent={cardAccent(r.status)}
              className={isBest ? "border-terminal-green" : ""}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <StatusPill color={statusColor(r.status)}>{statusLabel(r.status)}</StatusPill>
                  {def.bypassesCensorship && (
                    <span className="text-[9px] text-content-dim uppercase tracking-wider">
                      bypass
                    </span>
                  )}
                </div>
                <span
                  className="text-xs font-bold"
                  style={{
                    color:
                      score >= 70
                        ? "var(--color-terminal-green)"
                        : score >= 40
                          ? "var(--color-warning-amber)"
                          : score > 0
                            ? "var(--color-blood-bright)"
                            : "var(--color-content-dim)",
                  }}
                >
                  {score}/100
                </span>
              </div>

              <div className="text-[10px] text-content-dim mb-3 uppercase tracking-wider">
                {def.technique}
              </div>

              {/* metrics */}
              <div className="space-y-2 mb-3">
                <div className="flex justify-between text-xs">
                  <span className="text-content-secondary">latency</span>
                  <span style={{ color: lat.color }}>
                    {formatLatency(r.latencyMs)} <span className="text-[10px]">{lat.label}</span>
                  </span>
                </div>
                <DataBar
                  value={r.throughputKbps ?? 0}
                  max={def.throughputCeilingKbps}
                  label="throughput"
                  unit=""
                />
                <div className="flex justify-end text-[10px]" style={{ color: thr.color }}>
                  {formatThroughput(r.throughputKbps)} {thr.label}
                </div>
              </div>

              <p className="text-xs text-content-secondary leading-relaxed mb-2 min-h-[2.5rem]">
                {r.detail}
              </p>

              {/* evidence log */}
              {r.evidence.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() =>
                      setLogOpen((prev) => ({ ...prev, [def.id]: !prev[def.id] }))
                    }
                    className="text-[10px] text-content-dim hover:text-blood-bright transition-colors"
                  >
                    {logOpen[def.id] ? "▾ hide evidence" : "▸ show evidence"}
                  </button>
                  {logOpen[def.id] && (
                    <pre className="mt-2 text-[10px] leading-snug text-terminal-green bg-void border border-border-dim p-2 overflow-x-auto whitespace-pre-wrap">
{r.evidence.join("\n")}
                    </pre>
                  )}
                </div>
              )}
            </TerminalCard>
          );
        })}
      </div>

      {/* Honest limitations — like the-mask threat model */}
      <TerminalCard title="what this can and cannot measure" accent="amber" className="mb-6">
        <div className="space-y-3 text-xs">
          <div>
            <span className="text-terminal-green font-bold">CAN MEASURE:</span>{" "}
            <span className="text-content-secondary">
              whether a transport&apos;s building blocks are reachable — plain HTTPS, CDN edges,
              WebRTC/STUN NAT traversal, and DNS-over-HTTPS. Latency is the real fetch RTT;
              throughput is a genuine 256&nbsp;KiB download against a public speed-test endpoint.
            </span>
          </div>
          <div>
            <span className="text-blood-bright font-bold">CANNOT MEASURE:</span>{" "}
            <span className="text-content-secondary">
              a browser cannot forge TLS SNI or set the <code>Host</code> header independently of
              the URL, so true domain fronting cannot be executed from a page — we probe whether the
              shared CDN edge is reachable instead. WebRTC throughput to a real Snowflake volunteer
              is reported as the transport&apos;s typical ceiling, not a live measurement. MASQUE is
              inferred from DoH reachability, not an end-to-end tunnel.
            </span>
          </div>
          <div>
            <span className="text-warning-amber font-bold">INTERPRET WITH CARE:</span>{" "}
            <span className="text-content-secondary">
              a <em>working</em> probe means the primitive reaches the open network from here — it
              is a strong signal, not a guarantee that a full Tor/MASQUE session will succeed against
              an active adversary. Cross-check with{" "}
              <Link href="/the-onion/" className="text-blood-bright underline">
                The Onion
              </Link>{" "}
              and{" "}
              <Link href="/fortress/" className="text-blood-bright underline">
                The Fortress
              </Link>
              .
            </span>
          </div>
        </div>
        <div className="mt-3 p-2 border border-blood-dim bg-panel text-xs text-blood">
          ⚠ SAFETY: running this test generates identifiable network traffic to public endpoints. If
          merely <em>testing</em> circumvention could endanger you, do not run it on a monitored
          network. See{" "}
          <Link href="/the-mask/" className="text-blood-bright underline">
            The Mask
          </Link>{" "}
          for threat modelling.
        </div>
      </TerminalCard>

      {/* Cross-links */}
      <TerminalCard title="related circumvention tools">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/the-onion/"
            className="terminal-card p-3 hover:border-blood transition-colors block"
          >
            <div className="text-[10px] text-content-dim">[56]</div>
            <div className="text-xs font-bold text-blood mt-1">THE ONION</div>
            <div className="text-[10px] text-content-secondary mt-0.5">
              Host this platform as a Tor hidden service mirror.
            </div>
          </Link>
          <Link
            href="/fortress/"
            className="terminal-card p-3 hover:border-blood transition-colors block"
          >
            <div className="text-[10px] text-content-dim">[07]</div>
            <div className="text-xs font-bold text-blood mt-1">THE FORTRESS</div>
            <div className="text-[10px] text-content-secondary mt-0.5">
              Hydra nodes, IPFS, mesh, dead drops — infrastructure that survives takedown.
            </div>
          </Link>
          <Link
            href="/the-mask/"
            className="terminal-card p-3 hover:border-blood transition-colors block"
          >
            <div className="text-[10px] text-content-dim">[08]</div>
            <div className="text-xs font-bold text-blood mt-1">THE MASK</div>
            <div className="text-[10px] text-content-secondary mt-0.5">
              OpSec, threat models, duress codes — protect yourself first.
            </div>
          </Link>
        </div>
      </TerminalCard>
    </div>
  );
}
