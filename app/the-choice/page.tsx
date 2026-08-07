"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import DataBar from "@/components/ui/DataBar";
import { sound } from "@/lib/sound";
import { formatNumber } from "@/lib/format";
import {
  buildChoiceData,
  ratioColor,
  ratioLabel,
  MILITARY_PER_DAY_B,
  type ChoiceEntry,
} from "@/lib/choice";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

const data = backbone as WorldBackbone;

type SortKey = "ratio" | "daysLocal" | "military" | "undernourished";
type ViewMode = "offenders" | "all";

export default function TheChoicePage() {
  const entries = useMemo(() => buildChoiceData(data.countries), []);
  const [sortKey, setSortKey] = useState<SortKey>("ratio");
  const [viewMode, setViewMode] = useState<ViewMode>("offenders");
  const [hoveredIso3, setHoveredIso3] = useState<string | null>(null);

  // Worst offenders: military > health
  const offenders = useMemo(
    () => entries.filter((e) => e.ratio >= 1).sort((a, b) => b.ratio - a.ratio),
    [entries]
  );

  // Sorted display list
  const displayList = useMemo(() => {
    let list = viewMode === "offenders" ? [...offenders] : [...entries];
    list.sort((a, b) => {
      switch (sortKey) {
        case "ratio": return b.ratio - a.ratio;
        case "daysLocal": return b.daysLocalMilitary - a.daysLocalMilitary;
        case "military": return b.militaryB - a.militaryB;
        case "undernourished": return b.undernourishedM - a.undernourishedM;
      }
    });
    return list;
  }, [entries, offenders, viewMode, sortKey]);

  // Global aggregate
  const globalStats = useMemo(() => {
    const totalMil = entries.reduce((s, e) => s + e.militaryB, 0);
    const totalHealth = entries.reduce((s, e) => s + e.healthB, 0);
    const totalUndernourished = entries.reduce((s, e) => s + e.undernourishedM, 0);
    const totalCostFix = entries.reduce((s, e) => s + e.costFixHungerB, 0);
    const offenderCount = offenders.length;
    return {
      totalMil,
      totalHealth,
      globalRatio: totalMil / totalHealth,
      totalUndernourished,
      totalCostFix,
      offenderCount,
      daysToFixAll: totalCostFix / MILITARY_PER_DAY_B,
    };
  }, [entries, offenders]);

  // Scatter data: military vs health
  const scatterData = useMemo(() => {
    return entries.map((e) => ({
      iso3: e.iso3,
      name: e.name,
      x: e.healthB,
      y: e.militaryB,
      ratio: e.ratio,
      isOffender: e.ratio >= 1,
    }));
  }, [entries]);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[20] THE CHOICE</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood tracking-widest">
          THE CHOICE
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // Every government makes the same choice: how much to spend killing vs healing.
          {globalStats.offenderCount} countries spend more on military than health.
          The world spends ${formatNumber(globalStats.totalMil)}B/yr on weapons and ${formatNumber(globalStats.totalHealth)}B on health.
        </p>
      </div>

      {/* Global stats */}
      <TerminalCard title="THE GLOBAL CHOICE" accent="blood" glow className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">WORLD MILITARY</div>
            <div className="text-2xl text-blood-bright font-bold glow-blood">
              ${formatNumber(globalStats.totalMil)}B
            </div>
            <div className="text-[10px] text-content-dim">per year</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">WORLD HEALTH</div>
            <div className="text-2xl text-terminal-green font-bold">
              ${formatNumber(globalStats.totalHealth)}B
            </div>
            <div className="text-[10px] text-content-dim">per year</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">RATIO</div>
            <div className="text-2xl text-content-primary font-bold">
              {globalStats.globalRatio.toFixed(2)}×
            </div>
            <div className="text-[10px] text-content-dim">military / health</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">OFFENDERS</div>
            <div className="text-2xl text-blood font-bold">
              {globalStats.offenderCount}
            </div>
            <div className="text-[10px] text-content-dim">military &gt; health</div>
          </div>
        </div>
        <div className="p-3 border border-blood-dim bg-void text-xs text-blood">
          The world&apos;s tracked hunger could be ended with ${globalStats.totalCostFix.toFixed(1)}B —
          that&apos;s {globalStats.daysToFixAll.toFixed(1)} days of global military spending.
          Every single undernourished human, reached, for less than 4% of the war budget.
        </div>
      </TerminalCard>

      {/* Scatter: Military vs Health spending */}
      <TerminalCard title="MILITARY vs HEALTH SPENDING // THE LINE" accent="amber" className="mb-6">
        <p className="text-xs text-content-dim mb-3">
          // Every dot is a country. Above the line = military wins. Below = health wins.
          The line is parity (1:1). Red dots spend more on war than healing.
        </p>
        <div style={{ width: "100%", height: 420 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 20, right: 30, bottom: 50, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis
                type="number"
                dataKey="x"
                name="Health"
                tick={{ fill: "#888", fontSize: 10 }}
                label={{ value: "HEALTH SPENDING ($B/yr) →", position: "bottom", fill: "#666", fontSize: 10, offset: 15 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Military"
                tick={{ fill: "#888", fontSize: 10 }}
                label={{ value: "↑ MILITARY ($B/yr)", angle: -90, position: "insideLeft", fill: "#666", fontSize: 10 }}
              />
              <ReferenceLine
                segment={[{ x: 0, y: 0 }, { x: 80, y: 80 }]}
                stroke="#444"
                strokeDasharray="4 4"
                label={{ value: "PARITY (1:1)", position: "top", fill: "#555", fontSize: 9 }}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3", stroke: "#444" }}
                contentStyle={{ background: "#0a0a0a", border: "1px solid #444", fontSize: "11px" }}
                formatter={(value, name) => [`$${formatNumber(Number(value))}B`, name === "x" ? "Health" : "Military"]}
                labelFormatter={() => ""}
              />
              <Scatter name="Countries" data={scatterData}>
                {scatterData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.isOffender ? "#cc0000" : "#006633"}
                    stroke={entry.isOffender ? "#ff3333" : "#00ff41"}
                    strokeWidth={hoveredIso3 === entry.iso3 ? 2 : 0.5}
                    opacity={hoveredIso3 === null || hoveredIso3 === entry.iso3 ? 0.85 : 0.3}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-6 mt-2 text-[10px] text-content-secondary">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#990000", border: "1px solid #cc0000" }} />
            MILITARY &gt; HEALTH ({offenders.length})
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#006633", border: "1px solid #00ff41" }} />
            HEALTH &gt; MILITARY
          </div>
        </div>
      </TerminalCard>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-content-dim uppercase tracking-widest">VIEW:</span>
          {([
            { id: "offenders", label: "WORST OFFENDERS" },
            { id: "all", label: "ALL COUNTRIES" },
          ] as const).map((v) => (
            <button
              key={v.id}
              onClick={() => { setViewMode(v.id); sound.select(); }}
              className={`text-[10px] px-2 py-1 border transition-colors ${
                viewMode === v.id
                  ? "border-blood text-blood-bright bg-blood/5"
                  : "border-border-dim text-content-secondary hover:border-blood"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-content-dim uppercase tracking-widest">SORT:</span>
          {([
            { id: "ratio", label: "RATIO" },
            { id: "daysLocal", label: "DAYS TO FIX" },
            { id: "military", label: "MILITARY $" },
            { id: "undernourished", label: "HUNGRY" },
          ] as const).map((s) => (
            <button
              key={s.id}
              onClick={() => { setSortKey(s.id); sound.select(); }}
              className={`text-[10px] px-2 py-1 border transition-colors ${
                sortKey === s.id
                  ? "border-terminal-green text-terminal-green bg-terminal-green/5"
                  : "border-border-dim text-content-secondary hover:border-terminal-green"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Country ranking */}
      <TerminalCard title="THE RANKING // MORAL CALCULUS PER COUNTRY" className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-dim text-content-dim text-[10px] uppercase tracking-widest">
                <th className="text-left p-2">#</th>
                <th className="text-left p-2">Country</th>
                <th className="text-right p-2">Military</th>
                <th className="text-right p-2">Health</th>
                <th className="text-center p-2">Ratio</th>
                <th className="text-right p-2">Hungry</th>
                <th className="text-right p-2">Cost to Fix</th>
                <th className="text-center p-2">Days of Local Mil.</th>
              </tr>
            </thead>
            <tbody>
              {displayList.slice(0, 30).map((e, i) => (
                <tr
                  key={e.iso3}
                  className={`border-b border-border-dim hover:bg-panel/50 transition-colors cursor-pointer ${hoveredIso3 === e.iso3 ? "bg-panel/50" : ""}`}
                  onMouseEnter={() => setHoveredIso3(e.iso3)}
                  onMouseLeave={() => setHoveredIso3(null)}
                  onClick={() => sound.nav()}
                >
                  <td className="p-2 text-content-dim">{i + 1}</td>
                  <td className="p-2">
                    <Link href={`/sorrow-map/${e.iso3.toLowerCase()}/`} className="text-content-primary font-bold hover:text-blood-bright">
                      {e.name}
                    </Link>
                    {e.isHotspot && <span className="text-blood-bright text-[9px] ml-1">⚠</span>}
                  </td>
                  <td className="p-2 text-right text-blood-bright font-bold">${formatNumber(e.militaryB)}B</td>
                  <td className="p-2 text-right text-terminal-green">${formatNumber(e.healthB)}B</td>
                  <td className="p-2 text-center">
                    <span
                      className="text-xs font-bold px-2 py-0.5 border"
                      style={{ borderColor: ratioColor(e.ratio), color: ratioColor(e.ratio) }}
                    >
                      {e.ratio.toFixed(2)}×
                    </span>
                  </td>
                  <td className="p-2 text-right text-content-secondary">
                    {e.undernourishedM > 0.05 ? `${e.undernourishedM.toFixed(1)}M` : "—"}
                  </td>
                  <td className="p-2 text-right text-content-secondary">
                    {e.costFixHungerB > 0.01 ? `$${e.costFixHungerB.toFixed(2)}B` : "—"}
                  </td>
                  <td className="p-2 text-center">
                    {e.undernourishedM > 0.05 ? (
                      <span className="font-bold" style={{ color: e.daysLocalMilitary < 1 ? "#00ff41" : "#ffaa00" }}>
                        {e.daysLocalMilitary < 1
                          ? `${(e.daysLocalMilitary * 24).toFixed(1)} HOURS`
                          : `${e.daysLocalMilitary.toFixed(1)} DAYS`}
                      </span>
                    ) : (
                      <span className="text-content-dim">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {displayList.length > 30 && (
          <div className="text-center text-[10px] text-content-dim mt-2">
            Showing 30 of {displayList.length} countries
          </div>
        )}
      </TerminalCard>

      {/* The devastating summary */}
      <TerminalCard title="THE DEVASTATING MATH" accent="blood" className="mb-6">
        <div className="space-y-4 text-sm">
          {/* Most absurd ratios */}
          {offenders.slice(0, 3).map((e) => (
            <div key={e.iso3} className="flex items-start gap-3 p-3 border border-border-dim bg-void">
              <span className="text-2xl">⚠</span>
              <div className="flex-1">
                <div className="font-bold text-blood-bright">
                  {e.name} spends {e.ratio.toFixed(1)}× more on military than health.
                </div>
                <div className="text-xs text-content-secondary mt-1">
                  ${formatNumber(e.militaryB)}B for weapons, ${formatNumber(e.healthB)}B for healing.
                  {e.undernourishedM > 0.05 && (
                    <>
                      {" "}It would take{" "}
                      <span className="text-terminal-green font-bold">
                        {e.daysLocalMilitary < 1
                          ? `${(e.daysLocalMilitary * 24).toFixed(0)} hours`
                          : `${e.daysLocalMilitary.toFixed(1)} days`}
                      </span>{" "}
                      of their own military spending to feed all {e.undernourishedM.toFixed(1)}M hungry {e.name.replace(/\s*\(.*\)/, "")}s.
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Cheapest fix */}
          {(() => {
            const withHunger = entries.filter((e) => e.undernourishedM > 0.1);
            if (withHunger.length === 0) return null;
            const cheapest = [...withHunger].sort((a, b) => a.daysLocalMilitary - b.daysLocalMilitary)[0];
            return (
              <div className="flex items-start gap-3 p-3 border border-terminal-green/30 bg-terminal-green/5">
                <span className="text-2xl text-terminal-green">✓</span>
                <div className="flex-1">
                  <div className="font-bold text-terminal-green">
                    {cheapest.name}: {cheapest.undernourishedM.toFixed(1)}M people are hungry.
                  </div>
                  <div className="text-xs text-content-secondary mt-1">
                    Cost to fix: ${cheapest.costFixHungerB.toFixed(2)}B = {" "}
                    {cheapest.daysLocalMilitary < 1
                      ? `${(cheapest.daysLocalMilitary * 24).toFixed(0)} hours`
                      : `${cheapest.daysLocalMilitary.toFixed(1)} days`}{" "}
                    of their own military spending.
                    This is the scale of the choice being made.
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </TerminalCard>

      {/* Cross-links */}
      <div className="flex flex-wrap gap-2">
        <Link href="/the-allocator/" className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright">
          ▶ ALLOCATE THE BUDGET
        </Link>
        <Link href="/equation/" className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright">
          ▶ THE HUNGER EQUATION
        </Link>
        <Link href="/sorrow-map/" className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright">
          ▶ WHO SUFFERS
        </Link>
      </div>
    </div>
  );
}
