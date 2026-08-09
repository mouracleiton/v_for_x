"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/stores/useStore";
import { tc } from "@/lib/i18n-content";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, Scenario } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import { formatNumber } from "@/lib/format";
import {
  LineChart,
  Line,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  BarChart,
  Bar,
  Cell,
} from "recharts";

const data = backbone as WorldBackbone;

const SCENARIO_META = [
  { key: "bau", label: "BAU", budget: 0, desc: "Status quo", color: "var(--color-content-dim)" },
  { key: "minimo", label: "MÍNIMO", budget: 15, desc: "$15B/yr", color: "var(--color-blood-dim)" },
  { key: "moderado", label: "MODERADO", budget: 40, desc: "$40B/yr", color: "var(--color-warning-amber)" },
  { key: "ambicioso", label: "AMBICIOSO", budget: 93, desc: "$93B/yr", color: "var(--color-terminal-green)" },
  { key: "maximo", label: "MÁXIMO", budget: 150, desc: "$150B/yr", color: "#00ddff" },
] as const;

const INTERVENTION_COLORS = [
  "var(--color-blood-bright)", "var(--color-warning-amber)", "var(--color-terminal-green)", "#00ddff", "#aa44ff", "#ff6600",
];

type Tab = "hunger" | "deaths" | "regions" | "interventions";

export default function TheTimelinePage() {
  const { lang } = useStore();
  const [selectedScenarios, setSelectedScenarios] = useState<Set<string>>(
    new Set(["bau", "ambicioso"])
  );
  const [tab, setTab] = useState<Tab>("hunger");
  const [scrubYear, setScrubYear] = useState<number>(2025);

  const toggleScenario = (key: string) => {
    setSelectedScenarios((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key); // keep at least 1
      } else {
        next.add(key);
      }
      return next;
    });
    sound.select();
  };

  const years = data.scenarios.bau.years;

  // Build chart data for hunger trajectory
  const hungerChartData = useMemo(() => {
    return years.map((year, i) => {
      const row: Record<string, number | string> = { year: String(year) };
      for (const meta of SCENARIO_META) {
        if (selectedScenarios.has(meta.key)) {
          const scen = data.scenarios[meta.key];
          row[meta.key] = Math.round(scen.hunger_total_m[i] * 10) / 10;
        }
      }
      return row;
    });
  }, [selectedScenarios, years]);

  // Build chart data for deaths avoided
  const deathsChartData = useMemo(() => {
    return years.map((year, i) => {
      const row: Record<string, number | string> = { year: String(year) };
      for (const meta of SCENARIO_META) {
        if (selectedScenarios.has(meta.key)) {
          const scen = data.scenarios[meta.key];
          row[meta.key] = scen.deaths_avoided_cumulative[i];
        }
      }
      return row;
    });
  }, [selectedScenarios, years]);

  // Scrub year data
  const scrubIdx = years.indexOf(scrubYear);
  const scrubData = useMemo(() => {
    return SCENARIO_META.filter((m) => selectedScenarios.has(m.key)).map((m) => {
      const scen = data.scenarios[m.key];
      return {
        key: m.key,
        label: m.label,
        color: m.color,
        hunger: Math.round(scen.hunger_total_m[scrubIdx] * 10) / 10,
        deaths: scen.deaths_avoided_cumulative[scrubIdx],
        budget: scen.budget_per_year_billion[scrubIdx],
        cumulativeCost: scen.cumulative_cost_billion[scrubIdx],
        sdg2: scen.sdg2_met,
      };
    });
  }, [selectedScenarios, scrubIdx]);

  // Regional breakdown for selected scenario at scrub year
  const [regionScenario, setRegionScenario] = useState<string>("ambicioso");
  const regionalData = useMemo(() => {
    const scen = data.scenarios[regionScenario];
    const regions = Object.keys(scen.hunger_by_region_m);
    const startYear = years[0];
    const current = regions.map((r) => ({
      region: r,
      start: Math.round(scen.hunger_by_region_m[r][0] * 10) / 10,
      atScrub: Math.round(scen.hunger_by_region_m[r][scrubIdx] * 10) / 10,
      end: Math.round(scen.hunger_by_region_m[r][years.length - 1] * 10) / 10,
    }));
    return { regions: current, scenarioName: scen.name };
  }, [regionScenario, scrubIdx, years]);

  // Intervention ROI data
  const interventionData = useMemo(() => {
    const scen = data.scenarios["ambicioso"];
    if (!scen.interventions) return [];
    return Object.entries(scen.interventions).map(([key, iv], i) => ({
      name: (iv as { name: string }).name,
      budget: (iv as { budget_billion: number }).budget_billion,
      people: (iv as { people_helped: number }).people_helped / 1e6,
      roi: (iv as { roi: number }).roi,
      color: INTERVENTION_COLORS[i % INTERVENTION_COLORS.length],
    }));
  }, []);

  const chartTooltipStyle = {
    background: "var(--color-abyss)",
    border: "1px solid #444",
    fontSize: "11px",
  };

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">{tc(lang, "timeline.tag")}</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood tracking-widest">
          {tc(lang, "timeline.title")}
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // {tc(lang, "timeline.subtitle_extra")} {formatNumber(8745173)} {tc(lang, "timeline.lives_in_balance")}
        </p>
      </div>

      {/* Scenario selector */}
      <TerminalCard title={tc(lang, "timeline.select_scenarios")} className="mb-6">
        <div className="flex flex-wrap gap-2">
          {SCENARIO_META.map((m) => {
            const active = selectedScenarios.has(m.key);
            const scen = data.scenarios[m.key];
            return (
              <button
                key={m.key}
                onClick={() => toggleScenario(m.key)}
                className={`px-3 py-2 border text-xs font-bold transition-all ${active ? "bg-panel" : "opacity-50 hover:opacity-80"}`}
                style={{ borderColor: m.color, color: active ? m.color : "#666" }}
              >
                <div>{m.label}</div>
                <div className="text-[9px] opacity-70">{m.desc}</div>
                <div className="text-[9px] opacity-50">
                  {scen.sdg2_met ? "✓ SDG2" : "✗ SDG2"}
                </div>
              </button>
            );
          })}
        </div>
      </TerminalCard>

      {/* Tab selector */}
      <div className="flex gap-2 mb-4">
        {([
          { id: "hunger", label: tc(lang, "timeline.tab_hunger") },
          { id: "deaths", label: tc(lang, "timeline.tab_deaths") },
          { id: "regions", label: tc(lang, "timeline.tab_regions") },
          { id: "interventions", label: tc(lang, "timeline.tab_interventions") },
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
            {t.label}
          </button>
        ))}
      </div>

      {/* HUNGER TRAJECTORY TAB */}
      {tab === "hunger" && (
        <TerminalCard title={tc(lang, "card.hunger_10yr")} accent="amber" className="mb-6">
          <div style={{ width: "100%", height: 380 }}>
            <ResponsiveContainer>
              <AreaChart data={hungerChartData} margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-dim)" />
                <XAxis dataKey="year" tick={{ fill: "#888", fontSize: 10 }} />
                <YAxis tick={{ fill: "#888", fontSize: 10 }} label={{ value: "M people", angle: -90, position: "insideLeft", fill: "#666", fontSize: 10 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <ReferenceLine y={19} stroke="var(--color-terminal-green)" strokeDasharray="3 3" label={{ value: "SDG2 target (19M)", fill: "var(--color-terminal-green)", fontSize: 9 }} />
                {SCENARIO_META.filter((m) => selectedScenarios.has(m.key)).map((m) => (
                  <Area
                    key={m.key}
                    type="monotone"
                    dataKey={m.key}
                    name={m.label}
                    stroke={m.color}
                    fill={m.color}
                    fillOpacity={0.05}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: "10px" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[10px] text-content-dim mt-2">
            {tc(lang, "timeline.hunger_desc")}
          </div>
        </TerminalCard>
      )}

      {/* DEATHS AVOIDED TAB */}
      {tab === "deaths" && (
        <TerminalCard title={tc(lang, "card.lives_saved")} accent="green" className="mb-6">
          <div style={{ width: "100%", height: 380 }}>
            <ResponsiveContainer>
              <LineChart data={deathsChartData} margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-dim)" />
                <XAxis dataKey="year" tick={{ fill: "#888", fontSize: 10 }} />
                <YAxis
                  tick={{ fill: "#888", fontSize: 10 }}
                  tickFormatter={(v) => formatNumber(v)}
                  label={{ value: "Lives saved (cumulative)", angle: -90, position: "insideLeft", fill: "#666", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value) => [formatNumber(Number(value)), "Lives saved"]}
                />
                {SCENARIO_META.filter((m) => selectedScenarios.has(m.key)).map((m) => (
                  <Line
                    key={m.key}
                    type="monotone"
                    dataKey={m.key}
                    name={m.label}
                    stroke={m.color}
                    strokeWidth={2}
                    dot={{ r: 2, fill: m.color }}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: "10px" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="p-3 mt-3 border border-terminal-green/30 bg-terminal-green/5 text-xs text-terminal-green">
            {tc(lang, "timeline.ambitious_saves")} {formatNumber(8745173)} {tc(lang, "timeline.lives_10yr")}
            {tc(lang, "timeline.thats")}{" "}
            <span className="font-bold">${(93e9 / 8745173).toFixed(0)}</span>
            {" "}/{tc(lang, "timeline.life_year")} — {tc(lang, "timeline.cheaper_missile")}
          </div>
        </TerminalCard>
      )}

      {/* REGIONAL IMPACT TAB */}
      {tab === "regions" && (
        <TerminalCard title={tc(lang, "card.regional_impact")} accent="amber" className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] text-content-dim uppercase tracking-widest">{tc(lang, "timeline.scenario_word")}:</span>
            {SCENARIO_META.filter((m) => m.key !== "bau").map((m) => (
              <button
                key={m.key}
                onClick={() => { setRegionScenario(m.key); sound.select(); }}
                className={`text-[10px] px-2 py-1 border ${regionScenario === m.key ? "border-blood text-blood-bright" : "border-border-dim text-content-secondary hover:border-blood"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart
                data={regionalData.regions.map((r) => ({ region: r.region, start: r.start, end: r.end }))}
                margin={{ top: 10, right: 10, bottom: 20, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-dim)" />
                <XAxis dataKey="region" tick={{ fill: "#888", fontSize: 10 }} />
                <YAxis tick={{ fill: "#888", fontSize: 10 }} label={{ value: "M hungry", angle: -90, position: "insideLeft", fill: "#666", fontSize: 10 }} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [`${formatNumber(Number(v))}M`, ""]} />
                <Bar dataKey="start" name="2025" fill="var(--color-blood)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="end" name="2034" fill="#006633" radius={[2, 2, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: "10px" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {regionalData.regions.map((r) => {
              const reduction = r.start > 0 ? ((r.start - r.end) / r.start * 100) : 0;
              return (
                <div key={r.region} className="p-3 border border-border-dim bg-void">
                  <div className="font-bold text-content-primary text-sm">{r.region}</div>
                  <div className="text-xs text-content-secondary mt-1">
                    <span className="text-blood-bright font-bold">{r.start}M</span> {tc(lang, "timeline.hungry_today")} → {" "}
                    <span className="text-terminal-green font-bold">{r.end}M</span> {tc(lang, "timeline.by_2034")}
                  </div>
                  <div className="text-xs text-terminal-green font-bold mt-1">
                    {reduction.toFixed(0)}% {tc(lang, "timeline.reduction")} · {formatNumber(r.start - r.end)}M {tc(lang, "timeline.fed")}
                  </div>
                </div>
              );
            })}
          </div>
        </TerminalCard>
      )}

      {/* INTERVENTION ROI TAB */}
      {tab === "interventions" && (
        <TerminalCard title={tc(lang, "card.intervention_roi")} accent="green" className="mb-6">
          <p className="text-xs text-content-dim mb-3">
            {tc(lang, "timeline.roi_desc")}
          </p>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <BarChart
                data={interventionData}
                layout="vertical"
                margin={{ top: 10, right: 30, bottom: 20, left: 120 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-dim)" />
                <XAxis type="number" tick={{ fill: "#888", fontSize: 10 }} label={{ value: "Budget ($B/yr)", position: "bottom", fill: "#666", fontSize: 10, offset: 5 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#ccc", fontSize: 9 }} width={120} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value, name) => {
                    if (name === "budget") return [`$${formatNumber(Number(value))}B`, "Budget"];
                    return [`${formatNumber(Number(value))}M`, "People reached"];
                  }}
                />
                <Bar dataKey="budget" name="budget" radius={[0, 4, 4, 0]}>
                  {interventionData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ROI table */}
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-dim text-content-dim text-[10px] uppercase tracking-widest">
                  <th className="text-left p-2">{tc(lang, "timeline.th_intervention")}</th>
                  <th className="text-right p-2">{tc(lang, "timeline.th_budget")}</th>
                  <th className="text-right p-2">{tc(lang, "timeline.th_people_reached")}</th>
                  <th className="text-right p-2">{tc(lang, "timeline.th_cost_person")}</th>
                  <th className="text-center p-2">{tc(lang, "timeline.th_roi")}</th>
                </tr>
              </thead>
              <tbody>
                {interventionData.map((iv, i) => (
                  <tr key={i} className="border-b border-border-dim">
                    <td className="p-2 flex items-center gap-2">
                      <span className="inline-block w-2 h-2" style={{ backgroundColor: iv.color }} />
                      <span className="text-content-primary font-bold">{iv.name}</span>
                    </td>
                    <td className="p-2 text-right text-blood-bright font-bold">${formatNumber(iv.budget)}B</td>
                    <td className="p-2 text-right text-terminal-green">{formatNumber(iv.people)}M</td>
                    <td className="p-2 text-right text-content-secondary">
                      ${iv.budget > 0 ? (iv.budget / iv.people).toFixed(0) : "?"}/{tc(lang, "timeline.person")}
                    </td>
                    <td className="p-2 text-center">
                      <span
                        className="font-bold px-2 py-0.5 border"
                        style={{
                          borderColor: iv.roi >= 10 ? "var(--color-terminal-green)" : iv.roi >= 5 ? "var(--color-warning-amber)" : "var(--color-blood)",
                          color: iv.roi >= 10 ? "var(--color-terminal-green)" : iv.roi >= 5 ? "var(--color-warning-amber)" : "var(--color-blood)",
                        }}
                      >
                        {iv.roi}× {tc(lang, "timeline.roi_word")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 mt-3 border border-terminal-green/30 bg-terminal-green/5 text-xs">
            <span className="text-terminal-green font-bold">{tc(lang, "timeline.agri_roi")}</span> {tc(lang, "timeline.agri_roi_desc")}
          </div>
        </TerminalCard>
      )}

      {/* Year scrubber */}
      <TerminalCard title={tc(lang, "card.timeline_scrubber")} accent="amber" className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <span className="text-[10px] text-content-dim">2025</span>
          <input
            type="range"
            min={2025}
            max={2034}
            step={1}
            value={scrubYear}
            onChange={(e) => { setScrubYear(parseInt(e.target.value)); sound.select(); }}
            className="flex-1 h-2 appearance-none cursor-pointer allocator-slider"
            style={{
              background: `linear-gradient(to right, var(--color-blood-bright) 0%, var(--color-warning-amber) 50%, var(--color-terminal-green) 100%)`,
            }}
          />
          <span className="text-[10px] text-content-dim">2034</span>
          <span className="text-lg font-bold text-blood-bright w-16 text-center">{scrubYear}</span>
        </div>

        {/* State at selected year */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {scrubData.map((s) => (
            <div key={s.key} className="p-3 border border-border-dim bg-void">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block w-3 h-3" style={{ backgroundColor: s.color }} />
                <span className="text-xs font-bold" style={{ color: s.color }}>{s.label}</span>
                {s.sdg2 && <StatusPill color="green">{tc(lang, "timeline.sdg2_met")}</StatusPill>}
              </div>
              <div className="text-2xl font-bold" style={{ color: s.hunger < 20 ? "var(--color-terminal-green)" : s.hunger < 200 ? "var(--color-warning-amber)" : "var(--color-blood)" }}>
                {formatNumber(s.hunger)}M
              </div>
              <div className="text-[10px] text-content-dim">{tc(lang, "timeline.undernourished_in")} {scrubYear}</div>
              <div className="mt-2 text-xs text-terminal-green">
                {formatNumber(s.deaths)} {tc(lang, "timeline.lives_saved_cumul")}
              </div>
              <div className="text-[10px] text-content-dim">
                ${formatNumber(s.cumulativeCost)}B {tc(lang, "timeline.invested_total")}
              </div>
            </div>
          ))}
        </div>
      </TerminalCard>

      {/* Cross-links */}
      <div className="flex flex-wrap gap-2">
        <Link href="/the-allocator/" className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright">
          {tc(lang, "timeline.link_allocator")}
        </Link>
        <Link href="/the-choice/" className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright">
          {tc(lang, "timeline.link_choice")}
        </Link>
        <Link href="/equation/" className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright">
          {tc(lang, "timeline.link_equation")}
        </Link>
      </div>
    </div>
  );
}
