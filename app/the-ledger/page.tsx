"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import DataBar from "@/components/ui/DataBar";
import { sound } from "@/lib/sound";
import { formatNumber, formatMoney } from "@/lib/format";

const data = backbone as WorldBackbone;

type Tab = "financing" | "blockers" | "phases";

export default function TheLedgerPage() {
  const [tab, setTab] = useState<Tab>("financing");

  // Financing alternatives — compute what each could fund
  const financingAlternatives = useMemo(() => {
    const hungerCost = 93; // $B/yr
    const quickWins = 422; // water+health+energy+education+hunger

    return data.financing.alternatives.map((alt) => {
      // Parse dollar figures from the detail string
      const detail = alt.detail;
      let minB = 0;
      let maxB = 0;
      const matches = detail.match(/\$([\d,]+)-?([\d,]+)?B/i);
      if (matches) {
        minB = parseInt(matches[1].replace(/,/g, ""));
        maxB = matches[2] ? parseInt(matches[2].replace(/,/g, "")) : minB;
      } else {
        // Military redistribution: "1% = $24B/yr"
        const milMatch = detail.match(/\$([\d,.]+)B/);
        if (milMatch) {
          minB = parseFloat(milMatch[1]);
          maxB = minB;
        }
      }
      const avgB = (minB + maxB) / 2;
      const fundsHungerPct = (avgB / hungerCost) * 100;
      const fundsQuickWinsPct = (avgB / quickWins) * 100;
      return {
        name: alt.name,
        detail,
        minB,
        maxB,
        avgB,
        fundsHungerPct,
        fundsQuickWinsPct,
        canEndHunger: avgB >= hungerCost,
        canFundQuickWins: avgB >= quickWins,
      };
    });
  }, []);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[24] THE LEDGER</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood tracking-widest">
          THE LEDGER
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // The money exists. The blockers are known. The roadmap is written.
          What&apos;s missing is political will. Here&apos;s the full accounting.
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2 mb-6">
        {([
          { id: "financing", label: "HOW TO PAY", count: data.financing.alternatives.length },
          { id: "blockers", label: "STRUCTURAL BLOCKERS", count: data.structural_blockers.length },
          { id: "phases", label: "THE ROADMAP", count: data.implementation_phases.length },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); sound.select(); }}
            className={`text-[10px] px-3 py-1.5 border transition-colors ${
              tab === t.id
                ? "border-blood text-blood-bright bg-blood/5"
                : "border-border-dim text-content-secondary hover:border-blood"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* ═══ FINANCING TAB ═══ */}
      {tab === "financing" && (
        <>
          <TerminalCard title="5 WAYS TO FUND THE END OF HUNGER" accent="amber" className="mb-6">
            <p className="text-xs text-content-dim mb-4">
              // Each alternative raises more than the $93B/yr needed. The question was never
              &quot;can we afford it?&quot; — it was always &quot;will we choose to?&quot;
            </p>

            {/* Recommended allocation reminder */}
            <div className="p-3 border border-blood-dim bg-abyss mb-4">
              <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">
                RECOMMENDED: {data.financing.recommended_scenario}
              </div>
              <div className="text-lg text-blood-bright font-bold">
                ${data.financing.annual_budget_billion}B/yr
                <span className="text-sm text-content-secondary font-normal ml-2">
                  = {data.financing.pct_global_military}% of global military spending
                  = {data.financing.pct_world_gdp}% of world GDP
                </span>
              </div>
            </div>

            {/* Alternatives cards */}
            <div className="space-y-3">
              {financingAlternatives.map((alt) => (
                <div key={alt.name} className="p-3 border border-border-dim bg-void">
                  <div className="flex items-baseline justify-between mb-2">
                    <h3 className="text-sm font-bold text-blood-bright">{alt.name}</h3>
                    <div className="text-right">
                      <span className="text-lg text-terminal-green font-bold">
                        {alt.minB === alt.maxB
                          ? `$${formatNumber(alt.avgB)}B`
                          : `$${formatNumber(alt.minB)}–${formatNumber(alt.maxB)}B`}
                      </span>
                      <span className="text-[10px] text-content-dim">/yr</span>
                    </div>
                  </div>
                  <p className="text-xs text-content-secondary mb-3">{alt.detail}</p>

                  {/* What it funds */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[9px] text-content-dim uppercase">FUNDS HUNGER FIX</div>
                      <DataBar
                        value={Math.min(alt.fundsHungerPct, 100)}
                        max={100}
                        label={alt.fundsHungerPct >= 100 ? "✓ FULLY FUNDED" : `${alt.fundsHungerPct.toFixed(0)}% of need`}
                        unit="%"
                      />
                    </div>
                    <div>
                      <div className="text-[9px] text-content-dim uppercase">FUNDS ALL 6 SDGs ($422B)</div>
                      <DataBar
                        value={Math.min(alt.fundsQuickWinsPct, 100)}
                        max={100}
                        label={alt.fundsQuickWinsPct >= 100 ? "✓ FULLY FUNDED" : `${alt.fundsQuickWinsPct.toFixed(0)}% of need`}
                        unit="%"
                      />
                    </div>
                  </div>

                  {alt.canEndHunger && (
                    <div className="mt-2 text-[10px] text-terminal-green font-bold">
                      ✓ This alone could end global hunger
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TerminalCard>

          {/* The allocation breakdown */}
          <TerminalCard title="WHERE THE $93B GOES // RECOMMENDED ALLOCATION" accent="green" className="mb-6">
            <div className="space-y-2">
              {data.financing.allocation.map((item) => (
                <div key={item.name} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-content-primary font-bold">{item.name}</span>
                      <span className="text-xs text-terminal-green font-bold">${item.billion_yr}B</span>
                    </div>
                    <DataBar value={item.pct} max={25} label={item.justification} unit="%" />
                  </div>
                </div>
              ))}
            </div>
          </TerminalCard>
        </>
      )}

      {/* ═══ BLOCKERS TAB ═══ */}
      {tab === "blockers" && (
        <TerminalCard title="STRUCTURAL BLOCKERS // WHY HUNGER PERSISTS" accent="blood" className="mb-6">
          <p className="text-xs text-content-dim mb-4">
            // Money alone doesn&apos;t solve these. Each blocker requires a different kind of action —
            political, logistical, or military (humanitarian corridors).
          </p>
          <div className="space-y-3">
            {data.structural_blockers.map((blocker) => (
              <div key={blocker.id} className="p-4 border border-blood-dim bg-void">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl text-blood-dim font-bold">{blocker.id}</span>
                    <h3 className="text-sm font-bold text-blood-bright">{blocker.name}</h3>
                  </div>
                  {blocker.affected_m && (
                    <StatusPill color="blood">{formatNumber(blocker.affected_m)}M affected</StatusPill>
                  )}
                </div>
                <p className="text-xs text-content-secondary">{blocker.description}</p>

                {/* Related tactics */}
                <div className="mt-3 pt-3 border-t border-border-dim">
                  <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">
                    COUNTERMEASURES
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {data.tactics_conflict_zones
                      .filter((t) => {
                        if (blocker.name.includes("Armed Conflict"))
                          return [1, 2, 3, 8, 11, 12, 13].includes(t.id);
                        if (blocker.name.includes("Climate"))
                          return [5, 12].includes(t.id); // Local production, R&D
                        if (blocker.name.includes("Corruption"))
                          return [6, 7, 11].includes(t.id); // Sanctions, diplomacy, tribunal
                        if (blocker.name.includes("Restricted"))
                          return [1, 2, 3, 4].includes(t.id); // Corridors, airlift, cross-border, crypto
                        return false;
                      })
                      .map((t) => (
                        <Link
                          key={t.id}
                          href="/the-tactics/"
                          className="text-[10px] px-2 py-0.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
                        >
                          [{t.tier}] {t.name}
                        </Link>
                      ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Hunger drivers context */}
          <div className="mt-6 p-4 border border-border-dim bg-abyss">
            <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">
              THE 4 DRIVERS OF HUNGER (FAO)
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(data.global_indicators.hunger_drivers).map(([key, val]) => {
                const v = val as { affected_m?: number | null; countries?: number; is_primary?: boolean; note?: string };
                return (
                  <div key={key} className="text-xs">
                    <div className="font-bold text-content-primary uppercase">{key.replace(/_/g, " ")}</div>
                    {v.is_primary && <StatusPill color="blood">PRIMARY DRIVER</StatusPill>}
                    <div className="text-content-secondary mt-1">
                      {v.affected_m ? `${formatNumber(v.affected_m)}M affected` : v.note}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TerminalCard>
      )}

      {/* ═══ PHASES TAB ═══ */}
      {tab === "phases" && (
        <TerminalCard title="THE 10-YEAR ROADMAP // END HUNGER BY 2034" accent="green" className="mb-6">
          <p className="text-xs text-content-dim mb-4">
            // The Ambitious scenario ($93B/yr) has 3 phases. Each has clear targets.
            This is not a wish — it&apos;s a plan with milestones.
          </p>

          {/* Phase timeline */}
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border-dim" />

            {data.implementation_phases.map((phase) => {
              const startYear = phase.period.includes("2025") ? 2025 : phase.period.includes("2028") ? 2028 : 2031;
              const endYear = phase.period.includes("2027") ? 2027 : phase.period.includes("2030") ? 2030 : 2034;
              const yearSpan = endYear - startYear;
              const colors = ["#ffaa00", "#00ff41", "#00ddff"];

              return (
                <div key={phase.phase} className="relative pl-12 pb-8">
                  {/* Timeline dot */}
                  <div
                    className="absolute left-2 top-1 w-5 h-5 rounded-full border-2 z-10"
                    style={{ borderColor: colors[phase.phase - 1], backgroundColor: "#0a0a0a" }}
                  >
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold" style={{ color: colors[phase.phase - 1] }}>
                      {phase.phase}
                    </span>
                  </div>

                  {/* Phase card */}
                  <div className="p-4 border" style={{ borderColor: colors[phase.phase - 1] + "44" }}>
                    <div className="flex items-baseline justify-between mb-2">
                      <h3 className="text-sm font-bold" style={{ color: colors[phase.phase - 1] }}>
                        Phase {phase.phase}: {phase.name}
                      </h3>
                      <span className="text-[10px] text-content-dim">{phase.period} ({yearSpan} yrs)</span>
                    </div>

                    {/* Progress toward target */}
                    <div className="mb-3">
                      <div className="text-[10px] text-content-dim uppercase mb-1">TARGET</div>
                      <div className="flex items-baseline gap-3">
                        <span className="text-2xl font-bold" style={{ color: colors[phase.phase - 1] }}>
                          {formatNumber(phase.target_hunger_m)}M
                        </span>
                        <span className="text-xs text-content-secondary">
                          undernourished ({phase.reduction_pct}% reduction)
                        </span>
                      </div>
                    </div>

                    {/* Visual progress bar */}
                    <div className="relative h-4 bg-void border border-border-dim overflow-hidden">
                      {(() => {
                        const totalReduction = data.implementation_phases.reduce((s, p) => s + p.reduction_pct, 0);
                        let offset = 0;
                        return data.implementation_phases.map((p) => {
                          const width = (p.reduction_pct / totalReduction) * 100;
                          const isActive = p.phase === phase.phase;
                          const color = colors[p.phase - 1];
                          const style = {
                            position: "absolute" as const,
                            left: `${offset}%`,
                            width: `${width}%`,
                            height: "100%",
                            backgroundColor: color,
                            opacity: isActive ? 1 : 0.25,
                          };
                          offset += width;
                          return <div key={p.phase} style={style} />;
                        });
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Final outcome */}
          <div className="p-4 border border-terminal-green bg-terminal-green/5 mt-4">
            <div className="text-[10px] text-terminal-green uppercase tracking-widest mb-1">END STATE (2034)</div>
            <div className="text-xl text-terminal-green font-bold glow-green">
              19M undernourished globally — down from 667M.
            </div>
            <div className="text-xs text-content-secondary mt-1">
              SDG2 target met. 97% reduction. 8.7M lives saved. All for $93B/yr — less than 4% of military spending.
            </div>
          </div>
        </TerminalCard>
      )}

      {/* Cross-links */}
      <div className="flex flex-wrap gap-2">
        <Link href="/the-allocator/" className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright">
          ▶ ALLOCATE THE BUDGET
        </Link>
        <Link href="/the-timeline/" className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright">
          ▶ SCENARIO TIMELINE
        </Link>
        <Link href="/the-choice/" className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright">
          ▶ MILITARY vs HEALTH
        </Link>
        <Link href="/equation/" className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright">
          ▶ THE EQUATION
        </Link>
      </div>
    </div>
  );
}
