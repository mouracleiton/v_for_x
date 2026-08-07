"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import { formatNumber } from "@/lib/format";
import {
  BUDGET_ITEMS,
  calculateAllocation,
  PRESETS,
  TOTAL_FULL_COST,
  MILITARY_PER_DAY_B,
} from "@/lib/allocator";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export default function AllocatorPage() {
  const [allocations, setAllocations] = useState<Record<string, number>>({
    sdg2_hunger: 93,
    sdg6_water: 0,
    sdg3_health: 0,
    sdg7_energy: 0,
    sdg4_education: 0,
    sdg10_inequality: 0,
  });

  const result = useMemo(() => calculateAllocation(allocations), [allocations]);

  const updateAllocation = useCallback((id: string, value: number) => {
    setAllocations((prev) => ({ ...prev, [id]: Math.max(0, Math.round(value)) }));
  }, []);

  const applyPreset = useCallback((presetAllocations: Record<string, number>) => {
    setAllocations({ ...presetAllocations });
    sound.select();
  }, []);

  const resetAll = useCallback(() => {
    setAllocations(Object.fromEntries(BUDGET_ITEMS.map((i) => [i.id, 0])));
    sound.error();
  }, []);

  // Bar chart data
  const chartData = useMemo(
    () =>
      result.allocations.map((a) => ({
        name: a.item.sdg,
        label: a.item.label,
        allocated: Math.round(a.allocatedB),
        full: a.item.fullCostB,
        fundedPct: Math.round(a.fundedPct),
        color: a.item.color,
      })),
    [result]
  );

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[15] THE ALLOCATOR</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood tracking-widest">
          THE ALLOCATOR
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // You have the entire world military budget. Every slider you drag is a life you save or a missile you build. Choose.
        </p>
      </div>

      {/* Summary bar */}
      <TerminalCard title="YOUR BUDGET" accent="blood" glow className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">ALLOCATED</div>
            <div className="text-2xl text-blood-bright font-bold glow-blood">
              ${formatNumber(result.totalAllocatedB)}B
            </div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">REACH</div>
            <div className="text-2xl text-terminal-green font-bold glow-green">
              {formatNumber(result.totalReachM)}M
            </div>
            <div className="text-[10px] text-content-dim">people impacted</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">= MILITARY DAYS</div>
            <div className="text-2xl text-content-primary font-bold">
              {result.daysOfMilitary.toFixed(1)}
            </div>
            <div className="text-[10px] text-content-dim">{result.pctMilitary.toFixed(1)}% of annual</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">= WORLD GDP</div>
            <div className="text-2xl text-content-primary font-bold">
              {result.pctWorldGdp.toFixed(2)}%
            </div>
            <div className="text-[10px] text-content-dim">of $106.7T</div>
          </div>
        </div>

        {/* Funding status pills */}
        <div className="flex flex-wrap gap-2">
          <StatusPill color="green">{result.fullyFundedCount} FULLY FUNDED</StatusPill>
          {result.partiallyFundedCount > 0 && (
            <StatusPill color="amber">{result.partiallyFundedCount} PARTIAL</StatusPill>
          )}
          {result.unfundedCount > 0 && (
            <StatusPill color="blood">{result.unfundedCount} UNFUNDED</StatusPill>
          )}
          <button
            onClick={resetAll}
            className="text-[10px] px-2 py-0.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright ml-auto"
          >
            [ RESET ]
          </button>
        </div>

        {/* Contextual moral framing */}
        <div className="mt-4 p-3 border border-border-dim bg-void text-xs">
          {result.totalAllocatedB === 0 ? (
            <span className="text-content-dim">
              // Every dollar unallocated is a dollar available for destruction.
              The world spends ${MILITARY_PER_DAY_B}B per day on weapons.
            </span>
          ) : result.totalAllocatedB >= TOTAL_FULL_COST ? (
            <span className="text-terminal-green glow-green">
              // You funded everything. All six SDG goals. ${result.totalAllocatedB}B — that&apos;s {" "}
              {result.daysOfMilitary.toFixed(0)} days of military spending. {" "}
              {formatNumber(result.totalReachM)}M lives transformed. This is what &quot;enough&quot; looks like.
            </span>
          ) : (
            <span className="text-blood">
              // You allocated ${formatNumber(result.totalAllocatedB)}B. The world spends that on {" "}
              military in {result.daysOfMilitary.toFixed(1)} days. {" "}
              {result.daysOfMilitary < 1
                ? "Less than one day of war spending."
                : `${Math.round(result.daysOfMilitary / 7)} weeks of war spending.`}
            </span>
          )}
        </div>
      </TerminalCard>

      {/* Presets */}
      <TerminalCard title="QUICK SCENARIOS" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {PRESETS.map((preset) => {
            const total = Object.values(preset.allocations).reduce((a, b) => a + b, 0);
            return (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset.allocations)}
                className="p-3 border border-border-dim hover:border-blood text-left transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blood-bright group-hover:glow-blood">
                    {preset.label}
                  </span>
                  <span className="text-[10px] text-content-dim">${formatNumber(total)}B/yr</span>
                </div>
                <div className="text-[10px] text-content-secondary mt-1">{preset.desc}</div>
              </button>
            );
          })}
        </div>
      </TerminalCard>

      {/* Allocation sliders */}
      <TerminalCard title="ALLOCATE THE BUDGET" accent="amber" className="mb-6">
        <div className="space-y-5">
          {BUDGET_ITEMS.map((item) => {
            const allocated = allocations[item.id] ?? 0;
            const fundedPct = item.fullCostB > 0 ? (allocated / item.fullCostB) * 100 : 0;
            const reachM = item.fullCostB > 0 ? (allocated / item.fullCostB) * item.reachFullM : 0;
            const isFullyFunded = fundedPct >= 99.5;
            const isPartiallyFunded = fundedPct > 0.5 && fundedPct < 99.5;

            return (
              <div key={item.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[9px] font-mono px-1.5 py-0.5 border"
                      style={{ borderColor: item.color, color: item.color }}
                    >
                      {item.sdg}
                    </span>
                    <span className="text-sm font-bold" style={{ color: item.color }}>
                      {item.label}
                    </span>
                    {isFullyFunded && <StatusPill color="green">FULL</StatusPill>}
                    {isPartiallyFunded && <StatusPill color="amber">{fundedPct.toFixed(0)}%</StatusPill>}
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold" style={{ color: item.color }}>
                      ${formatNumber(allocated)}B
                    </span>
                    <span className="text-[10px] text-content-dim ml-1">/ ${item.fullCostB}B</span>
                  </div>
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min={0}
                  max={item.fullCostB}
                  step={1}
                  value={allocated}
                  onChange={(e) => updateAllocation(item.id, parseInt(e.target.value))}
                  className="w-full h-2 appearance-none cursor-pointer allocator-slider"
                  style={{
                    background: `linear-gradient(to right, ${item.color} 0%, ${item.color} ${fundedPct}%, var(--color-border-dim) ${fundedPct}%, var(--color-border-dim) 100%)`,
                  }}
                  aria-label={`Allocate ${item.label}`}
                />

                {/* Outcomes */}
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-content-secondary">
                    {reachM > 0.5 ? (
                      <>
                        <span className="font-bold" style={{ color: item.color }}>
                          {formatNumber(reachM)}M
                        </span>{" "}
                        {item.metricLabel}
                      </>
                    ) : (
                      <span className="text-content-dim">No allocation</span>
                    )}
                  </span>
                  <span className="text-content-dim">{item.description}</span>
                </div>
              </div>
            );
          })}
        </div>
      </TerminalCard>

      {/* Visualization */}
      <TerminalCard title="FUNDING BREAKDOWN" accent="green" className="mb-6">
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="name" tick={{ fill: "#999", fontSize: 11 }} />
              <YAxis tick={{ fill: "#999", fontSize: 10 }} label={{ value: "$B/year", angle: -90, position: "insideLeft", fill: "#666", fontSize: 10 }} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                contentStyle={{ background: "#0a0a0a", border: "1px solid #444", fontSize: "11px" }}
                formatter={(value, name) => {
                  const v = Number(value);
                  if (name === "allocated") return [`$${formatNumber(v)}B`, "Allocated"];
                  return [`$${formatNumber(v)}B`, "Full cost"];
                }}
                labelFormatter={(label) => {
                  const item = chartData.find((d) => d.name === label);
                  return item ? `${label} — ${item.label}` : label;
                }}
              />
              <Bar dataKey="full" fill="#222" name="Full cost" radius={[2, 2, 0, 0]} />
              <Bar dataKey="allocated" name="allocated" radius={[2, 2, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-6 mt-2 text-[10px] text-content-secondary">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 bg-[#222] border border-border-dim" />
            FULL COST
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 bg-blood" />
            YOUR ALLOCATION
          </div>
        </div>
      </TerminalCard>

      {/* Comparison: what could this buy in military terms */}
      <TerminalCard title="THE MATH OF MORALITY" className="mb-6">
        <div className="space-y-3 text-xs">
          <div className="p-3 border border-border-dim bg-void">
            <div className="text-blood-bright font-bold mb-2">
              YOUR ALLOCATION = {result.daysOfMilitary.toFixed(1)} DAYS OF GLOBAL MILITARY SPENDING
            </div>
            <div className="text-content-secondary space-y-1">
              <p>
                Global military spending: <span className="text-blood-bright font-bold">$2.41T/year</span> = {" "}
                <span className="text-blood-bright font-bold">${MILITARY_PER_DAY_B}B/day</span> = {" "}
                <span className="text-blood-bright font-bold">$275M/hour</span>
              </p>
              <p>
                Your budget of <span className="font-bold text-content-primary">${formatNumber(result.totalAllocatedB)}B</span> represents: {" "}
                <span className="text-terminal-green font-bold">{result.pctMilitary.toFixed(2)}%</span> of annual military spending.
              </p>
              <p>
                For context: the F-35 program cost <span className="text-content-primary">$1.7T over its lifetime</span>. {" "}
                Your allocation could fund it for {" "}
                <span className="font-bold" style={{ color: result.totalAllocatedB > 1700 ? "#00ff41" : "#e10600" }}>
                  {result.totalAllocatedB > 0 ? `${(1700 / result.totalAllocatedB).toFixed(1)}x over` : "infinity"}
                </span>.
              </p>
            </div>
          </div>

          <div className="p-3 border border-blood-dim bg-abyss">
            <div className="text-terminal-green font-bold mb-1">THE REFUSAL</div>
            <p className="text-content-secondary">
              {result.totalAllocatedB === 0
                ? "You allocated nothing. This is the world's actual choice right now."
                : result.totalAllocatedB >= TOTAL_FULL_COST
                  ? "You proved it's possible. $828B is 34% of military spending. The math checks out. The only thing missing is the political will."
                  : `You allocated ${formatNumber(result.totalReachM)}M people a better life. The remaining ${formatNumber(TOTAL_FULL_COST - result.totalAllocatedB)}B would save the rest. That's ${(TOTAL_FULL_COST - result.totalAllocatedB) / MILITARY_PER_DAY_B} more days of military spending.`}
            </p>
          </div>
        </div>
      </TerminalCard>

      {/* Cross-links */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/equation/"
          className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
        >
          ▶ FULL HUNGER MODEL
        </Link>
        <Link
          href="/the-act/"
          className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
        >
          ▶ TURN THIS INTO A CAMPAIGN
        </Link>
        <Link
          href="/sorrow-map/"
          className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
        >
          ▶ SEE WHO SUFFERS
        </Link>
      </div>
    </div>
  );
}
