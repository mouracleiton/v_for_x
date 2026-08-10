"use client";

/**
 * V FOR X — The Price Tag [72]
 *
 * Real-time "cost of inaction" meter. Every second the numbers tick up.
 * The framing: "Since January 1st this year, X people have gone hungry."
 * Designed to be viral, shareable, and viscerally felt.
 */

import { useState, useEffect, useMemo, useRef } from "react";
import backbone from "@/data/world_backbone.json";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import {
  buildCounters,
  computeTick,
  getYearAnchor,
  getDayAnchor,
  formatTickValue,
  counterColor,
  generateShareText,
  type PriceCounter,
} from "@/lib/price-tag";
import type { WorldBackbone } from "@/lib/types";

const data = backbone as WorldBackbone;

type AnchorMode = "year" | "day" | "session";

export default function PriceTagPage() {
  const allCounters = useMemo(() => buildCounters(data), []);
  const [anchorMode, setAnchorMode] = useState<AnchorMode>("year");
  const [tick, setTick] = useState(0);
  const sessionStart = useRef(Date.now());

  // Determine the anchor timestamp
  const anchorTs = useMemo(() => {
    if (anchorMode === "year") return getYearAnchor();
    if (anchorMode === "day") return getDayAnchor();
    return sessionStart.current;
  }, [anchorMode]);

  // Re-render every 100ms for smooth ticking
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(interval);
  }, []);

  const now = Date.now();
  const elapsedMs = now - anchorTs;
  const snapshot = useMemo(
    () => computeTick(allCounters, elapsedMs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allCounters, anchorTs, tick],
  );

  // Group counters
  const humanCounters = allCounters.filter((c) => c.category === "human");
  const econCounters = allCounters.filter((c) => c.category === "economic");
  const envCounters = allCounters.filter((c) => c.category === "environment");

  const anchorLabel =
    anchorMode === "year"
      ? `January 1, ${new Date().getUTCFullYear()}`
      : anchorMode === "day"
        ? "midnight today"
        : "you opened this page";

  const handleShare = () => {
    const text = generateShareText(snapshot, allCounters, anchorLabel);
    if (navigator.share) {
      navigator.share({ title: "V FOR X — The Price Tag", text });
    } else {
      navigator.clipboard.writeText(text);
      sound.select();
    }
  };

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-mono px-1.5 py-0.5 border border-blood text-blood-bright">[72]</span>
          <h1 className="text-2xl md:text-4xl font-bold text-blood-bright glow-blood tracking-widest">
            THE PRICE TAG
          </h1>
        </div>
        <p className="text-content-secondary text-sm">
          The cost of inaction, measured in real time. The meter never stops.
          Every number traces back to a verified source in the data backbone.
        </p>
      </div>

      {/* Anchor selector */}
      <TerminalCard title="METER ANCHOR" accent="amber" className="mb-6">
        <div className="flex flex-wrap gap-2">
          {(["year", "day", "session"] as AnchorMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setAnchorMode(m); sound.select(); }}
              className={`text-[10px] px-3 py-1.5 border transition-colors uppercase tracking-widest ${
                anchorMode === m
                  ? "border-blood text-blood-bright bg-panel"
                  : "border-border-dim text-content-secondary hover:border-blood"
              }`}
            >
              {m === "year" ? `Since Jan 1 ${new Date().getUTCFullYear()}` : m === "day" ? "Since midnight" : "Since page load"}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-content-dim mt-2">
          Elapsed: {formatElapsed(snapshot.elapsedSeconds)}
        </div>
      </TerminalCard>

      {/* FEATURED METER — highest severity */}
      <FeaturedMeters
        counters={humanCounters.filter((c) => c.severity >= 3)}
        snapshot={snapshot}
        anchorLabel={anchorLabel}
      />

      {/* ALL HUMAN COUNTERS */}
      <TerminalCard title="HUMAN COST" accent="blood" glow className="mb-6">
        <div className="space-y-3">
          {humanCounters.map((c) => (
            <CounterRow key={c.id} counter={c} value={snapshot.counters[c.id] ?? 0} />
          ))}
        </div>
      </TerminalCard>

      {/* ECONOMIC */}
      {econCounters.length > 0 && (
        <TerminalCard title="ECONOMIC WASTE" accent="amber" className="mb-6">
          <div className="space-y-3">
            {econCounters.map((c) => (
              <CounterRow key={c.id} counter={c} value={snapshot.counters[c.id] ?? 0} />
            ))}
          </div>
        </TerminalCard>
      )}

      {/* ENVIRONMENT */}
      {envCounters.length > 0 && (
        <TerminalCard title="ENVIRONMENTAL DESTRUCTION" accent="green" className="mb-6">
          <div className="space-y-3">
            {envCounters.map((c) => (
              <CounterRow key={c.id} counter={c} value={snapshot.counters[c.id] ?? 0} />
            ))}
          </div>
        </TerminalCard>
      )}

      {/* Comparison strip */}
      <ComparisonStrip snapshot={snapshot} counters={allCounters} />

      {/* Share */}
      <div className="flex justify-center mb-8">
        <button
          onClick={handleShare}
          className="text-xs px-6 py-2 border border-blood text-blood-bright hover:bg-panel transition-colors uppercase tracking-widest"
        >
          📤 Share these numbers
        </button>
      </div>

      {/* Methodology */}
      <TerminalCard title="METHODOLOGY" className="mb-6">
        <div className="text-xs text-content-secondary space-y-2">
          <p>
            Every counter is derived from <code className="text-blood-bright">world_backbone.json</code> and
            converted to per-second rates using <code>annual ÷ 31,557,600 seconds</code> (365.25 days).
          </p>
          <p>
            The tick you see is computed live in your browser:{" "}
            <code className="text-terminal-green">rate × elapsed_seconds</code>. No data is fabricated
            or estimated beyond what the sources provide.
          </p>
          <p className="text-content-dim">
            ⚠️ These are rates derived from annual totals. They represent the scale of ongoing
            suffering, not discrete events happening at precise moments.
          </p>
        </div>
      </TerminalCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

function FeaturedMeters({
  counters,
  snapshot,
  anchorLabel,
}: {
  counters: PriceCounter[];
  snapshot: ReturnType<typeof computeTick>;
  anchorLabel: string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {counters.slice(0, 3).map((c) => {
        const val = snapshot.counters[c.id] ?? 0;
        const color = counterColor(c);
        return (
          <div
            key={c.id}
            className="terminal-card p-4 text-center"
            style={{ borderColor: color + "44" }}
          >
            <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">
              {c.label}
            </div>
            <div
              className="text-3xl md:text-4xl font-bold font-mono tabular-nums glow-blood"
              style={{ color }}
            >
              {formatTickValue(val, c.unit)}
            </div>
            <div className="text-[10px] text-content-dim mt-1">
              since {anchorLabel}
            </div>
            <div className="text-[10px] mt-1" style={{ color }}>
              {formatTickValue(c.perSecond, c.unit)}/sec
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CounterRow({
  counter,
  value,
}: {
  counter: PriceCounter;
  value: number;
}) {
  const color = counterColor(counter);
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border-dim last:border-0">
      <div className="flex-1">
        <div className="text-xs font-bold text-content-primary">
          {counter.label}
        </div>
        <div className="text-[10px] text-content-dim">{counter.source}</div>
      </div>
      <div className="text-right">
        <div
          className="text-xl font-bold font-mono tabular-nums"
          style={{ color }}
        >
          {formatTickValue(value, counter.unit)}
        </div>
        <div className="text-[10px] text-content-dim">
          {formatTickValue(counter.perHour, counter.unit)}/hr ·{" "}
          {formatTickValue(counter.perDay, counter.unit)}/day
        </div>
      </div>
    </div>
  );
}

function ComparisonStrip({
  snapshot,
  counters,
}: {
  snapshot: ReturnType<typeof computeTick>;
  counters: PriceCounter[];
}) {
  const military = counters.find((c) => c.id === "military_spending");
  const sdg2 = counters.find((c) => c.id === "sdg2_deficit");
  if (!military || !sdg2) return null;

  const militaryVal = snapshot.counters[military.id] ?? 0;
  const sdg2Val = snapshot.counters[sdg2.id] ?? 0;
  const ratio = sdg2Val > 0 ? militaryVal / sdg2Val : 0;

  return (
    <TerminalCard title="THE INVERSION" accent="blood" className="mb-6" glow>
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div className="text-[10px] text-content-dim uppercase tracking-widest">
            Military spending (accumulated)
          </div>
          <div className="text-2xl text-warning-amber font-bold font-mono">
            {formatTickValue(militaryVal, "$")}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-content-dim uppercase tracking-widest">
            To end hunger (accumulated)
          </div>
          <div className="text-2xl text-terminal-green font-bold font-mono">
            {formatTickValue(sdg2Val, "$")}
          </div>
        </div>
      </div>
      <div className="border-t border-border-dim pt-3">
        <div className="text-xs text-content-secondary text-center">
          For every <span className="text-blood-bright font-bold">{ratio > 0 ? ratio.toFixed(1) : "—"}</span> spent
          on weapons, <span className="text-terminal-green font-bold">$1</span> would end hunger.
        </div>
      </div>
    </TerminalCard>
  );
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}
