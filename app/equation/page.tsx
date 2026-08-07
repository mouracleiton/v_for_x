"use client";

import { useState, useMemo } from "react";
import backbone from "@/data/world_backbone.json";
import TerminalCard from "@/components/ui/TerminalCard";
import DataBar from "@/components/ui/DataBar";
import StatusPill from "@/components/ui/StatusPill";
import Link from "next/link";
import { tierColor } from "@/lib/format";
import type { WorldBackbone, Scenario } from "@/lib/types";

const data = backbone as WorldBackbone;

const scenarioPresets = [
  { key: "bau", label: "BAU", budget: 0, desc: "Status quo" },
  { key: "minimo", label: "MINIMO", budget: 15, desc: "$15B/yr" },
  { key: "moderado", label: "MODERADO", budget: 45, desc: "$45B/yr" },
  { key: "ambicioso", label: "AMBICIOSO", budget: 93, desc: "$93B/yr" },
  { key: "maximo", label: "MAXIMO", budget: 150, desc: "$150B/yr" },
];

export default function EquationPage() {
  const [selectedScenario, setSelectedScenario] = useState("ambicioso");
  const [selectedFinancing, setSelectedFinancing] = useState<number[]>([]);

  const scenario = data.scenarios[selectedScenario] as Scenario;

  const projectionData = useMemo(() => {
    return scenario.years.map((year, i) => ({
      year: String(year),
      hunger: Math.round(scenario.hunger_total_m[i] * 10) / 10,
      deaths: Math.round(scenario.deaths_avoided_cumulative[i] / 1000),
      budget: scenario.budget_per_year_billion[i],
    }));
  }, [scenario]);

  const financingTotal = useMemo(() => {
    const mechs = data.financing.alternatives;
    return selectedFinancing.reduce((sum, idx) => {
      const m = mechs[idx];
      const match = m.detail.match(/\$(\d+)-?(\d+)?/);
      if (match) {
        const lo = parseInt(match[1]);
        const hi = match[2] ? parseInt(match[2]) : lo;
        return sum + (lo + hi) / 2;
      }
      return sum;
    }, 0);
  }, [selectedFinancing]);

  const maxHunger = Math.max(...data.scenarios.bau.hunger_total_m);
  const targetLine = data.global_indicators.sdg2.threshold_m;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[02] THE EQUATION</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          THE EQUATION
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // Don't just see the problem. Model the fix. Real numbers, real projections, real solutions.
        </p>
      </div>

      {/* A. Scenario Simulator */}
      <TerminalCard title="SCENARIO SIMULATOR" glow className="mb-6">
        <p className="text-xs text-content-secondary mb-4">
          Adjust the slider to see how different annual investments change the hunger trajectory (2025-2034)
        </p>

        {/* Preset buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          {scenarioPresets.map((p) => (
            <button
              key={p.key}
              onClick={() => setSelectedScenario(p.key)}
              className={`px-3 py-1.5 text-xs border transition-colors ${
                selectedScenario === p.key
                  ? "bg-blood text-void border-blood-bright"
                  : "border-border-dim text-content-secondary hover:border-blood-dim"
              }`}
            >
              <span className="font-bold">{p.label}</span>
              <span className="text-content-dim ml-2">{p.desc}</span>
            </button>
          ))}
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="terminal-card p-3">
            <div className="text-xs text-content-dim">FINAL HUNGER (2034)</div>
            <div
              className={`text-xl font-bold ${
                scenario.sdg2_met ? "text-terminal-green" : "text-blood"
              }`}
            >
              {scenario.final_hunger_m.toFixed(1)}M
            </div>
          </div>
          <div className="terminal-card p-3">
            <div className="text-xs text-content-dim">ANNUAL COST</div>
            <div className="text-xl font-bold text-content-primary">
              ${scenario.budget_per_year_billion[0]}B
            </div>
          </div>
          <div className="terminal-card p-3">
            <div className="text-xs text-content-dim">SDG2 TARGET</div>
            {scenario.sdg2_met ? (
              <StatusPill color="green">ACHIEVED</StatusPill>
            ) : (
              <StatusPill color="blood">NOT MET</StatusPill>
            )}
          </div>
          <div className="terminal-card p-3">
            <div className="text-xs text-content-dim">DEATHS AVOIDED</div>
            <div className="text-xl font-bold text-terminal-green">
              {Math.round(
                scenario.deaths_avoided_cumulative[
                  scenario.deaths_avoided_cumulative.length - 1
                ] / 1000
              )}
              K
            </div>
          </div>
        </div>

        {/* ASCII projection chart */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-content-dim mb-2">
            <span>HUNGER PROJECTION 2025-2034 (M people)</span>
            <span style={{ color: targetLine < 100 ? "#00ff41" : "#cc0000" }}>
              SDG2 threshold: {targetLine}M
            </span>
          </div>
          {projectionData.map((d) => {
            const barLen = Math.round((d.hunger / maxHunger) * 40);
            const isBelowThreshold = d.hunger < targetLine;
            return (
              <div key={d.year} className="flex items-center gap-2 text-xs">
                <span className="text-content-dim w-10">{d.year}</span>
                <span
                  className="font-bold"
                  style={{
                    color: isBelowThreshold ? "#00ff41" : "#cc0000",
                  }}
                >
                  {"█".repeat(barLen)}
                  <span className="text-content-dim">
                    {"░".repeat(40 - barLen)}
                  </span>
                </span>
                <span
                  className="w-16 text-right"
                  style={{
                    color: isBelowThreshold ? "#00ff41" : "#cc0000",
                  }}
                >
                  {d.hunger.toFixed(0)}M
                </span>
              </div>
            );
          })}
        </div>

        {/* What does $93B mean */}
        <div className="mt-6 p-3 terminal-card">
          <div className="text-xs text-content-dim mb-2">
            $93B/YEAR IN CONTEXT:
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>As % of world military spending:</span>
              <span className="text-blood-bright">
                {data.financing.pct_global_military}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>As % of world GDP:</span>
              <span className="text-blood-bright">
                {data.financing.pct_world_gdp}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>World military spending per day:</span>
              <span className="text-blood-bright">$6.5B</span>
            </div>
            <div className="flex justify-between">
              <span>Days of military spending to fund 1 year of hunger eradication:</span>
              <span className="text-terminal-green">14 days</span>
            </div>
          </div>
        </div>
      </TerminalCard>

      {/* B. Intervention ROI */}
      <TerminalCard
        title="INTERVENTION ROI — PROVEN, EVIDENCE-BACKED"
        accent="green"
        className="mb-6"
      >
        <p className="text-xs text-content-secondary mb-4">
          These aren't opinions. These are measured returns from real programs.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* School feeding */}
          <div className="terminal-card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blood-bright">SCHOOL FEEDING</span>
              <StatusPill color="green">PROVEN</StatusPill>
            </div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-content-secondary">ROI:</span>
                <span className="text-terminal-green font-bold">
                  {data.global_indicators.interventions_evidence.school_feeding.roi_min}-
                  {data.global_indicators.interventions_evidence.school_feeding.roi_max}x
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-secondary">Children reached:</span>
                <span className="text-content-primary">
                  {data.global_indicators.interventions_evidence.school_feeding.children_reached_m}M
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-secondary">Market size:</span>
                <span className="text-content-primary">
                  ${data.global_indicators.interventions_evidence.school_feeding.market_size_billion_yr}B/yr
                </span>
              </div>
            </div>
            <div className="text-xs text-content-dim mt-2 italic">
              [Source: {data.global_indicators.interventions_evidence.school_feeding.source}]
            </div>
          </div>

          {/* Smallholder agriculture */}
          <div className="terminal-card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blood-bright">SMALLHOLDER AGRI</span>
              <StatusPill color="green">PROVEN</StatusPill>
            </div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-content-secondary">Income increase:</span>
                <span className="text-terminal-green font-bold">
                  +{data.global_indicators.interventions_evidence.smallholder_agriculture.income_increase_pct}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-secondary">Production increase:</span>
                <span className="text-terminal-green font-bold">
                  +{data.global_indicators.interventions_evidence.smallholder_agriculture.production_increase_pct}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-secondary">Target farmers:</span>
                <span className="text-content-primary">
                  {data.global_indicators.interventions_evidence.smallholder_agriculture.target_farmers_m}M
                </span>
              </div>
            </div>
            <div className="text-xs text-content-dim mt-2 italic">
              [Source: {data.global_indicators.interventions_evidence.smallholder_agriculture.source}]
            </div>
          </div>

          {/* Agri R&D */}
          <div className="terminal-card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blood-bright">AGRI R&D</span>
              <StatusPill color="green">PROVEN</StatusPill>
            </div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-content-secondary">Annual return:</span>
                <span className="text-terminal-green font-bold">
                  {data.global_indicators.interventions_evidence.agri_rd.annual_return_pct}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-secondary">Focus:</span>
                <span className="text-content-primary">Climate-resilient crops</span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-secondary">Timeline:</span>
                <span className="text-content-secondary">3-4 year lag</span>
              </div>
            </div>
            <div className="text-xs text-content-dim mt-2 italic">
              [Source: {data.global_indicators.interventions_evidence.agri_rd.source}]
            </div>
          </div>
        </div>
      </TerminalCard>

      {/* Budget allocation */}
      <TerminalCard title="BUDGET ALLOCATION — RECOMMENDED SCENARIO ($93B/YR)" className="mb-6">
        <div className="space-y-2">
          {data.financing.allocation.map((a, i) => (
            <div key={i}>
              <DataBar
                value={a.pct}
                max={100}
                label={`${a.name} — $${a.billion_yr}B/yr`}
                unit="%"
              />
              <div className="text-xs text-content-dim mt-0.5 ml-2">{a.justification}</div>
            </div>
          ))}
        </div>
      </TerminalCard>

      {/* C. Financing Mechanisms */}
      <TerminalCard title="FINANCING MECHANISMS — BUILD YOUR PACKAGE" className="mb-6">
        <p className="text-xs text-content-secondary mb-4">
          Select mechanisms to build a funding package. Target: $93B/yr.
        </p>
        <div className="flex items-center gap-4 mb-4">
          <div className="text-xs">
            <span className="text-content-dim">YOUR PACKAGE: </span>
            <span
              className={`text-lg font-bold ${
                financingTotal >= 93 ? "text-terminal-green" : "text-blood"
              }`}
            >
              ${financingTotal.toFixed(0)}B
            </span>
            <span className="text-content-dim"> / $93B target</span>
          </div>
          {financingTotal >= 93 && (
            <StatusPill color="green">TARGET REACHED</StatusPill>
          )}
        </div>
        <div className="space-y-2">
          {data.financing.alternatives.map((m, i) => (
            <label
              key={i}
              className="flex items-start gap-3 p-3 terminal-card cursor-pointer hover:border-blood transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedFinancing.includes(i)}
                onChange={() => {
                  setSelectedFinancing((prev) =>
                    prev.includes(i)
                      ? prev.filter((x) => x !== i)
                      : [...prev, i]
                  );
                }}
                className="mt-1 accent-blood"
              />
              <div className="flex-1">
                <div className="text-xs font-bold text-content-primary">{m.name}</div>
                <div className="text-xs text-content-secondary mt-1">{m.detail}</div>
              </div>
            </label>
          ))}
        </div>
      </TerminalCard>

      {/* D. Conflict Zone Tactics */}
      <TerminalCard title="CONFLICT ZONE TACTICS — RANKED BY EFFICACY" accent="amber" className="mb-6">
        <p className="text-xs text-content-secondary mb-4">
          17 documented approaches to deliver aid in active conflict zones. Tier S = zero-casualty, immediate.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-dim text-content-dim">
                <th className="text-left py-2 px-2">TIER</th>
                <th className="text-left py-2 px-2">TACTIC</th>
                <th className="text-left py-2 px-2 hidden sm:table-cell">CASUALTIES</th>
                <th className="text-left py-2 px-2">SUCCESS</th>
                <th className="text-left py-2 px-2 hidden sm:table-cell">SPEED</th>
              </tr>
            </thead>
            <tbody>
              {data.tactics_conflict_zones.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-border-dim hover:bg-panel transition-colors"
                >
                  <td className="py-2 px-2">
                    <span
                      className="inline-block w-6 text-center font-bold"
                      style={{ color: tierColor(t.tier) }}
                    >
                      {t.tier}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-content-primary">{t.name}</td>
                  <td className="py-2 px-2 text-content-secondary hidden sm:table-cell">
                    {t.casualties}
                  </td>
                  <td className="py-2 px-2">
                    <span
                      style={{
                        color:
                          t.success.includes("Alta") || t.success === "53%"
                            ? "#00ff41"
                            : t.success.includes("Media") || t.success === "26%"
                              ? "#ffaa00"
                              : "#cc0000",
                      }}
                    >
                      {t.success}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-content-secondary hidden sm:table-cell">
                    {t.speed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex gap-4 text-xs">
          <span style={{ color: "#00ff41" }}>■ S: Zero-casualty, immediate</span>
          <span style={{ color: "#ffaa00" }}>■ A: Low casualty, variable</span>
          <span style={{ color: "#cc0000" }}>■ B: High casualty, last resort</span>
        </div>
      </TerminalCard>

      {/* E. Implementation Timeline */}
      <TerminalCard title="IMPLEMENTATION TIMELINE" accent="green" className="mb-6">
        <div className="space-y-4">
          {data.implementation_phases.map((p) => (
            <div key={p.phase} className="flex items-start gap-4">
              <div className="text-2xl font-bold text-blood-dim shrink-0">
                P{p.phase}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-content-primary">
                    {p.name}
                  </span>
                  <span className="text-xs text-content-dim">({p.period})</span>
                </div>
                <div className="text-xs text-content-secondary mt-1">
                  Target: {p.target_hunger_m}M hungry (-{p.reduction_pct}%)
                </div>
                <DataBar
                  value={p.reduction_pct}
                  max={100}
                  label={`Hunger reduction`}
                  unit="%"
                  inverse
                />
              </div>
            </div>
          ))}
        </div>
      </TerminalCard>

      {/* Cross-links */}
      <TerminalCard title="CROSS-LINKS">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link href="/the-trail/" className="terminal-card p-3 hover:border-blood block">
            <div className="text-xs text-blood-bright font-bold">→ FUND THE SOLUTION</div>
            <div className="text-xs text-content-secondary mt-1">Route resources using this allocation</div>
          </Link>
          <Link href="/protocol-x/" className="terminal-card p-3 hover:border-blood block">
            <div className="text-xs text-blood-bright font-bold">→ IMPLEMENTATION GUIDES</div>
            <div className="text-xs text-content-secondary mt-1">How to advocate for each mechanism</div>
          </Link>
          <Link href="/registry/" className="terminal-card p-3 hover:border-blood block">
            <div className="text-xs text-blood-bright font-bold">→ DOCUMENT FOR TRIBUNAL</div>
            <div className="text-xs text-content-secondary mt-1">War crimes → ICJ accountability</div>
          </Link>
        </div>
      </TerminalCard>
    </div>
  );
}
