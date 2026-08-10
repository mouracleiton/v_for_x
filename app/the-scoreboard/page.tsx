"use client";

/**
 * V FOR X — The Scoreboard [75]
 *
 * Who is improving? Who is backsliding?
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import {
  buildScoreboard,
  regionalVelocity,
  directionColor,
  directionIcon,
  gradeColor,
  type Direction,
} from "@/lib/scoreboard";
import type { WorldBackbone } from "@/lib/types";

const data = backbone as WorldBackbone;

export default function ScoreboardPage() {
  const result = useMemo(() => buildScoreboard(data), []);
  const regions = useMemo(() => regionalVelocity(result.entries), [result]);
  const [filter, setFilter] = useState<Direction | "all">("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [showCount, setShowCount] = useState(30);

  const filtered = useMemo(() => {
    let list = result.entries;
    if (filter !== "all") list = list.filter((e) => e.direction === filter);
    if (regionFilter !== "all") list = list.filter((e) => e.region === regionFilter);
    return list;
  }, [result, filter, regionFilter]);

  const allRegions = useMemo(
    () => [...new Set(result.entries.map((e) => e.region))].sort(),
    [result],
  );

  const counts = {
    improving: result.improving.length,
    stagnant: result.stagnant.length,
    deteriorating: result.deteriorating.length,
  };

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-mono px-1.5 py-0.5 border border-blood text-blood-bright">[75]</span>
          <h1 className="text-2xl md:text-4xl font-bold text-blood-bright glow-blood tracking-widest">
            THE SCOREBOARD
          </h1>
        </div>
        <p className="text-content-secondary text-sm">
          Static snapshots lie. What matters is direction and speed. Are things
          getting better or worse? This is the accountability ledger no government
          wants you to see in one place.
        </p>
      </div>

      {/* Global verdict */}
      <TerminalCard
        title="GLOBAL VERDICT"
        accent={result.globalDirection === "improving" ? "green" : result.globalDirection === "deteriorating" ? "blood" : "amber"}
        className="mb-6"
        glow
      >
        <div className="grid grid-cols-3 gap-4">
          <DirectionStat
            label="Improving"
            count={counts.improving}
            direction="improving"
            active={filter === "improving"}
            onClick={() => { setFilter(filter === "improving" ? "all" : "improving"); sound.select(); }}
          />
          <DirectionStat
            label="Stagnant"
            count={counts.stagnant}
            direction="stagnant"
            active={filter === "stagnant"}
            onClick={() => { setFilter(filter === "stagnant" ? "all" : "stagnant"); sound.select(); }}
          />
          <DirectionStat
            label="Deteriorating"
            count={counts.deteriorating}
            direction="deteriorating"
            active={filter === "deteriorating"}
            onClick={() => { setFilter(filter === "deteriorating" ? "all" : "deteriorating"); sound.select(); }}
          />
        </div>
        <div className="mt-3 text-center text-xs text-content-secondary border-t border-border-dim pt-3">
          Overall direction:{" "}
          <span className="font-bold" style={{ color: directionColor(result.globalDirection) }}>
            {result.globalDirection.toUpperCase()}
          </span>
        </div>
      </TerminalCard>

      {/* Best and worst featured */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {result.bestPerformer && (
          <TerminalCard title="🏆 BEST PERFORMER" accent="green">
            <FeaturedEntry entry={result.bestPerformer} />
          </TerminalCard>
        )}
        {result.worstPerformer && (
          <TerminalCard title="🔻 WORST PERFORMER" accent="blood">
            <FeaturedEntry entry={result.worstPerformer} />
          </TerminalCard>
        )}
      </div>

      {/* Regional velocity */}
      <TerminalCard title="REGIONAL VELOCITY" accent="amber" className="mb-6">
        <div className="space-y-2">
          {regions.map((r) => (
            <div key={r.region} className="flex items-center gap-3">
              <div className="w-32 text-xs text-content-primary truncate">{r.region}</div>
              <div className="flex-1 h-3 bg-void border border-border-dim relative">
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border-dim" />
                <div
                  className="absolute top-0 bottom-0"
                  style={{
                    backgroundColor: directionColor(r.direction),
                    width: `${Math.abs(r.avgVelocity) / 2}%`,
                    left: r.avgVelocity >= 0 ? "50%" : `${50 - Math.abs(r.avgVelocity) / 2}%`,
                  }}
                />
              </div>
              <div className="w-12 text-right text-xs font-mono" style={{ color: directionColor(r.direction) }}>
                {directionIcon(r.direction)} {r.avgVelocity > 0 ? "+" : ""}{r.avgVelocity.toFixed(0)}
              </div>
            </div>
          ))}
        </div>
      </TerminalCard>

      {/* Region filter */}
      <div className="flex flex-wrap gap-1 mb-4">
        <button
          onClick={() => { setRegionFilter("all"); sound.nav(); }}
          className={`text-[10px] px-2 py-1 border transition-colors uppercase tracking-widest ${
            regionFilter === "all"
              ? "border-blood text-blood-bright"
              : "border-border-dim text-content-secondary hover:border-blood"
          }`}
        >
          All Regions
        </button>
        {allRegions.map((r) => (
          <button
            key={r}
            onClick={() => { setRegionFilter(r); sound.nav(); }}
            className={`text-[10px] px-2 py-1 border transition-colors ${
              regionFilter === r
                ? "border-blood text-blood-bright"
                : "border-border-dim text-content-secondary hover:border-blood"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Full ranking */}
      <TerminalCard title="FULL RANKING" accent="blood" className="mb-6">
        <div className="space-y-1">
          {filtered.slice(0, showCount).map((e, i) => (
            <RankingRow key={e.iso3} entry={e} rank={i + 1} />
          ))}
        </div>
        {showCount < filtered.length && (
          <button
            onClick={() => { setShowCount(showCount + 30); sound.select(); }}
            className="w-full mt-3 text-[10px] py-2 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors uppercase tracking-widest"
          >
            Show {Math.min(30, filtered.length - showCount)} more ({filtered.length - showCount} remaining)
          </button>
        )}
      </TerminalCard>

      {/* Methodology */}
      <TerminalCard title="METHODOLOGY" className="mb-6">
        <div className="text-xs text-content-secondary space-y-2">
          <p>
            The velocity score is a weighted composite of 6 signals: undernourishment
            trajectory, conflict intensity, democracy index, child mortality, extreme
            poverty, and military-vs-health spending ratio. Each signal contributes a
            direction and magnitude.
          </p>
          <p>
            Since per-country historical data is limited in the backbone, the model
            uses each country's <strong>standing relative to global peers</strong> as
            a proxy for trajectory — countries far below the mean are presumed to be
            deteriorating, those above improving. This is a transparent heuristic,
            not a prediction.
          </p>
          <p className="text-content-dim">
            ⚠️ The velocity score measures structural pressure, not policy intent. A
            country can be "improving" because it started from a very low base. Always
            read the signals, not just the score.
          </p>
        </div>
      </TerminalCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

function DirectionStat({
  label,
  count,
  direction,
  active,
  onClick,
}: {
  label: string;
  count: number;
  direction: Direction;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-center p-3 border transition-colors ${
        active ? "border-blood bg-panel" : "border-border-dim hover:border-blood"
      }`}
    >
      <div className="text-[10px] text-content-dim uppercase tracking-widest">{label}</div>
      <div className="text-3xl font-bold font-mono" style={{ color: directionColor(direction) }}>
        {count}
      </div>
      <div className="text-[10px]" style={{ color: directionColor(direction) }}>
        {directionIcon(direction)}
      </div>
    </button>
  );
}

function FeaturedEntry({ entry }: { entry: ReturnType<typeof buildScoreboard>["entries"][0] }) {
  return (
    <Link
      href={`/sorrow-map/${entry.iso3.toLowerCase()}/`}
      className="block p-3 border border-border-dim hover:border-blood transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl">{entry.flag}</span>
        <div className="flex-1">
          <div className="text-lg font-bold text-content-primary">{entry.name}</div>
          <div className="text-[10px] text-content-dim">{entry.region}</div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold font-mono" style={{ color: gradeColor(entry.grade) }}>
            {entry.grade}
          </div>
          <div className="text-[10px]" style={{ color: directionColor(entry.direction) }}>
            {directionIcon(entry.direction)} {entry.velocityScore > 0 ? "+" : ""}{entry.velocityScore.toFixed(0)}
          </div>
        </div>
      </div>
      {/* Signals */}
      <div className="mt-3 space-y-1">
        {entry.signals.slice(0, 4).map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-[10px]">
            <span style={{ color: directionColor(s.direction) }}>
              {directionIcon(s.direction)}
            </span>
            <span className="text-content-secondary flex-1">{s.label}</span>
            <span className="text-content-dim font-mono">{s.pctChange > 0 ? "+" : ""}{s.pctChange.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </Link>
  );
}

function RankingRow({
  entry,
  rank,
}: {
  entry: ReturnType<typeof buildScoreboard>["entries"][0];
  rank: number;
}) {
  return (
    <Link
      href={`/sorrow-map/${entry.iso3.toLowerCase()}/`}
      className="flex items-center gap-3 py-1.5 px-2 hover:bg-panel transition-colors group"
    >
      <span className="text-[10px] text-content-dim font-mono w-8">#{rank}</span>
      <span className="text-lg">{entry.flag}</span>
      <span className="text-xs text-content-primary group-hover:text-blood-bright flex-1 truncate">
        {entry.name}
      </span>
      <StatusPill color={entry.direction === "improving" ? "green" : entry.direction === "deteriorating" ? "blood" : "amber"}>
        {entry.grade}
      </StatusPill>
      <span className="text-xs font-mono w-12 text-right" style={{ color: directionColor(entry.direction) }}>
        {directionIcon(entry.direction)} {entry.velocityScore > 0 ? "+" : ""}{entry.velocityScore.toFixed(0)}
      </span>
    </Link>
  );
}
