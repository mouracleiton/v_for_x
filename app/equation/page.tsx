"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/stores/useStore";
import { tc } from "@/lib/i18n-content";
import { t } from "@/lib/i18n";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend, Area, AreaChart,
} from "recharts";
import backbone from "@/data/world_backbone.json";
import TerminalCard from "@/components/ui/TerminalCard";
import DataBar from "@/components/ui/DataBar";
import StatusPill from "@/components/ui/StatusPill";
import ShareableStat from "@/components/shared/ShareableStat";
import Link from "next/link";
import { tierColor } from "@/lib/format";
import type { WorldBackbone, Scenario, SdgEquation } from "@/lib/types";

const data = backbone as WorldBackbone;

const scenarioPresets = [
  { key: "bau", labelKey: "eq.bau", budget: 0, desc: "—" },
  { key: "minimo", labelKey: "eq.scenario_min", budget: 15, desc: "$15B/yr" },
  { key: "moderado", labelKey: "eq.scenario_mod", budget: 45, desc: "$45B/yr" },
  { key: "ambicioso", labelKey: "eq.scenario_amb", budget: 93, desc: "$93B/yr" },
  { key: "maximo", labelKey: "eq.scenario_max", budget: 150, desc: "$150B/yr" },
];

/* Translation key arrays for data-bound strings */
const ALLOC_NAME_KEYS = [
  "eq.alloc_smallholder", "eq.alloc_social", "eq.alloc_school",
  "eq.alloc_rural", "eq.alloc_rnd", "eq.alloc_emergency",
];
const ALLOC_JUST_KEYS = [
  "common.multiplier_effect", "common.immediate_safety_net", "common.breaks_cycle",
  "eq.just_rural_lag", "eq.just_rnd_lag", "common.save_lives",
];
const FIN_NAME_KEYS = [
  "eq.fin_military_name", "eq.fin_wealth_name", "eq.fin_tobin_name",
  "eq.fin_beps_name", "eq.fin_debt_name",
];
const FIN_DETAIL_KEYS = [
  "eq.fin_military_detail", "eq.fin_wealth_detail", "eq.fin_tobin_detail",
  "eq.fin_beps_detail", "eq.fin_debt_detail",
];
const TACTIC_NAME_KEYS = [
  "eq.tactic_1", "eq.tactic_2", "eq.tactic_3", "eq.tactic_4", "eq.tactic_5",
  "eq.tactic_6", "eq.tactic_7", "eq.tactic_8", "eq.tactic_9", "eq.tactic_10",
  "eq.tactic_11", "eq.tactic_12", "eq.tactic_13", "eq.tactic_14", "eq.tactic_15",
  "eq.tactic_16", "eq.tactic_17",
];
const CASUALTY_MAP: Record<string, string> = {
  "~0": "eq.cas_zero", "0": "eq.cas_zero",
  "Low": "eq.cas_low", "Baixas": "eq.cas_low",
  "Moderate": "eq.cas_moderate", "Moderadas": "eq.cas_moderate",
  "High": "eq.cas_high", "Altas": "eq.cas_high",
  "High-Cat": "eq.cas_high_cat", "Altas-Cat": "eq.cas_high_cat",
  "Catastrophic": "eq.cas_catastrophic", "Catastrof": "eq.cas_catastrophic",
};
const SPEED_MAP: Record<string, string> = {
  "Immediate": "eq.spd_immediate", "Imediato": "eq.spd_immediate",
  "Days": "eq.spd_days", "Dias": "eq.spd_days",
  "Weeks": "eq.spd_weeks", "Semanas": "eq.spd_weeks",
  "Months": "eq.spd_months", "Meses": "eq.spd_months",
  "Years": "eq.spd_years", "Anos": "eq.spd_years",
  "Months-Years": "eq.spd_months_years", "Meses-Anos": "eq.spd_months_years",
  "Days-Weeks": "eq.spd_days_weeks", "Dias-Semanas": "eq.spd_days_weeks",
  "Slow": "eq.spd_slow", "Lento": "eq.spd_slow",
};
const SUCCESS_MAP: Record<string, string> = {
  "High": "eq.success_high", "Medium": "eq.success_medium",
  "Variable": "eq.success_variable", "Slow": "eq.success_slow",
};

const scenarioColors: Record<string, string> = {
  bau: "var(--color-content-dim)",
  minimo: "var(--color-blood-dim)",
  moderado: "var(--color-warning-amber)",
  ambicioso: "var(--color-terminal-green)",
  maximo: "#00ddff",
};

/* Multi-scenario comparison data for recharts */
function buildComparisonData(years: number[], scenarios: Record<string, Scenario>) {
  return years.map((year, i) => ({
    year: String(year),
    bau: Math.round(scenarios.bau.hunger_total_m[i] * 10) / 10,
    minimo: Math.round(scenarios.minimo.hunger_total_m[i] * 10) / 10,
    moderado: Math.round(scenarios.moderado.hunger_total_m[i] * 10) / 10,
    ambicioso: Math.round(scenarios.ambicioso.hunger_total_m[i] * 10) / 10,
    maximo: Math.round(scenarios.maximo.hunger_total_m[i] * 10) / 10,
  }));
}

/* Tooltip styling for recharts */
const chartTooltipStyle = {
  contentStyle: {
    background: "var(--color-abyss)",
    border: "1px solid var(--color-blood)",
    borderRadius: 0,
    fontSize: "11px",
    fontFamily: "JetBrains Mono, monospace",
  },
  labelStyle: { color: "var(--color-blood-bright)", fontWeight: "bold" },
  itemStyle: { color: "var(--color-content-primary)" },
};

export default function EquationPage() {
  const { lang } = useStore();
  const [selectedScenario, setSelectedScenario] = useState("ambicioso");
  const [selectedFinancing, setSelectedFinancing] = useState<number[]>([]);
  const [selectedSdg, setSelectedSdg] = useState<string>("sdg6_water");

  const scenario = data.scenarios[selectedScenario] as Scenario;

  const projectionData = useMemo(() => {
    return scenario.years.map((year, i) => ({
      year: String(year),
      hunger: Math.round(scenario.hunger_total_m[i] * 10) / 10,
      deaths: Math.round(scenario.deaths_avoided_cumulative[i] / 1000),
      budget: scenario.budget_per_year_billion[i],
    }));
  }, [scenario]);

  const comparisonData = useMemo(
    () => buildComparisonData(data.scenarios.ambicioso.years, data.scenarios),
    []
  );

  const sdgThreshold = data.global_indicators.sdg2.threshold_m;

  const regionData = useMemo(() => {
    const regions = Object.keys(scenario.hunger_by_region_m);
    return scenario.years.map((year, i) => {
      const row: Record<string, number | string> = { year: String(year) };
      for (const r of regions) {
        row[r] = Math.round(scenario.hunger_by_region_m[r][i] * 10) / 10;
      }
      return row;
    });
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
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[02] {t(lang, "nav.equation")}</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          {t(lang, "nav.equation")}
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          {tc(lang, "subtitle.equation")}
        </p>
      </div>

      {/* A. Scenario Simulator */}
      <TerminalCard title={tc(lang, "equation.scenario_simulator")} glow className="mb-6">
        <p className="text-xs text-content-secondary mb-4">
          {tc(lang, "eq.adjust_slider")}
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
              <span className="font-bold">{tc(lang, p.labelKey)}</span>
              <span className="text-content-dim ml-2">{p.desc}</span>
            </button>
          ))}
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="terminal-card p-3">
            <div className="text-xs text-content-dim">{tc(lang, "eq.final_hunger")}</div>
            <div
              className={`text-xl font-bold ${
                scenario.sdg2_met ? "text-terminal-green" : "text-blood"
              }`}
            >
              {scenario.final_hunger_m.toFixed(1)}M
            </div>
          </div>
          <div className="terminal-card p-3">
            <div className="text-xs text-content-dim">{tc(lang, "eq.annual_cost")}</div>
            <div className="text-xl font-bold text-content-primary">
              ${scenario.budget_per_year_billion[0]}B
            </div>
          </div>
          <div className="terminal-card p-3">
            <div className="text-xs text-content-dim">{tc(lang, "eq.sdg2_target")}</div>
            {scenario.sdg2_met ? (
              <StatusPill color="green">{tc(lang, "eq.achieved")}</StatusPill>
            ) : (
              <StatusPill color="blood">{tc(lang, "status.not_met")}</StatusPill>
            )}
          </div>
          <div className="terminal-card p-3">
            <div className="text-xs text-content-dim">{tc(lang, "eq.deaths_avoided")}</div>
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
            <span>{tc(lang, "eq.hunger_projection")}</span>
            <span style={{ color: targetLine < 100 ? "var(--color-terminal-green)" : "var(--color-blood)" }}>
              {tc(lang, "eq.sdg2_threshold")}
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
                    color: isBelowThreshold ? "var(--color-terminal-green)" : "var(--color-blood)",
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
                    color: isBelowThreshold ? "var(--color-terminal-green)" : "var(--color-blood)",
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
            {tc(lang, "eq.context_label")}
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>{tc(lang, "eq.pct_military_label")}</span>
              <span className="text-blood-bright">
                {data.financing.pct_global_military}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>{tc(lang, "eq.pct_gdp_label")}</span>
              <span className="text-blood-bright">
                {data.financing.pct_world_gdp}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>{tc(lang, "eq.military_per_day")}</span>
              <span className="text-blood-bright">$6.5B</span>
            </div>
            <div className="flex justify-between">
              <span>{tc(lang, "eq.days_to_fund")}</span>
              <span className="text-terminal-green">{tc(lang, "eq.14_days")}</span>
            </div>
          </div>
        </div>
      </TerminalCard>

      {/* SCENARIO TIMELINE — recharts multi-line */}
      <TerminalCard title={tc(lang, "card.eq.scenario_timeline")} accent="blood" glow className="mb-6">
        <p className="text-xs text-content-secondary mb-4">
          {tc(lang, "eq.every_line_future")}
        </p>
        <div className="border border-border-dim bg-void p-2 h-[280px] sm:h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={comparisonData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-dim)" />
              <XAxis dataKey="year" stroke="#444" tick={{ fill: "#888", fontSize: 10 }} />
              <YAxis stroke="#444" tick={{ fill: "#888", fontSize: 10 }} label={{ value: tc(lang, "eq.m_people_hungry"), angle: -90, position: "insideLeft", fill: "#666", fontSize: 10 }} />
              <Tooltip {...chartTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "10px", fontFamily: "monospace" }} />
              <ReferenceLine y={sdgThreshold} stroke="var(--color-terminal-green)" strokeDasharray="5 5" label={{ value: `${tc(lang, "eq.sdg2_label")} ${sdgThreshold}M`, fill: "var(--color-terminal-green)", fontSize: 9, position: "right" }} />
              <Line type="monotone" dataKey="bau" name={tc(lang, "eq.bau")} stroke={scenarioColors.bau} strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="minimo" name={`${tc(lang, "eq.scenario_min")} ($15B)`} stroke={scenarioColors.minimo} strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="moderado" name={`${tc(lang, "eq.scenario_mod")} ($40B)`} stroke={scenarioColors.moderado} strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="ambicioso" name={`${tc(lang, "eq.scenario_amb")} ($93B)`} stroke={scenarioColors.ambicioso} strokeWidth={3} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="maximo" name={`${tc(lang, "eq.scenario_max")} ($150B)`} stroke={scenarioColors.maximo} strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
          {scenarioPresets.map((p) => {
            const sc = data.scenarios[p.key];
            const finalM = sc.final_hunger_m;
            const gap = data.scenarios.bau.final_hunger_m - finalM;
            return (
              <div key={p.key} className="border border-border-dim p-2 text-center" style={{ borderColor: scenarioColors[p.key] + "66" }}>
                <div className="text-[9px] text-content-dim uppercase">{tc(lang, p.labelKey)}</div>
                <div className="text-sm font-bold" style={{ color: scenarioColors[p.key] }}>
                  {finalM.toFixed(0)}M
                </div>
                <div className="text-[9px] text-content-secondary">
                  {gap > 0 ? `-${gap.toFixed(0)}M ${tc(lang, "eq.vs_bau")}` : tc(lang, "eq.baseline")}
                </div>
                <div className="mt-1">
                  {sc.sdg2_met ? (
                    <StatusPill color="green">{tc(lang, "eq.sdg2_met_check")}</StatusPill>
                  ) : (
                    <StatusPill color="dim">{tc(lang, "eq.fail")}</StatusPill>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </TerminalCard>

      {/* REGIONAL BREAKDOWN — area chart for selected scenario */}
      <TerminalCard title={`${tc(lang, "eq.regional_prefix")} ${selectedScenario.toUpperCase()} ${tc(lang, "eq.scenario_suffix")}`} accent="amber" className="mb-6">
        <p className="text-xs text-content-secondary mb-4">
          {tc(lang, "eq.where_concentrates")}
        </p>
        <div className="border border-border-dim bg-void p-2 h-[220px] sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={regionData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-dim)" />
              <XAxis dataKey="year" stroke="#444" tick={{ fill: "#888", fontSize: 10 }} />
              <YAxis stroke="#444" tick={{ fill: "#888", fontSize: 10 }} />
              <Tooltip {...chartTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "10px", fontFamily: "monospace" }} />
              <Area type="monotone" dataKey="Africa" stackId="1" stroke="var(--color-blood-bright)" fill="var(--color-blood-dim)" fillOpacity={0.7} />
              <Area type="monotone" dataKey="Asia" stackId="1" stroke="var(--color-warning-amber)" fill="#332200" fillOpacity={0.7} />
              <Area type="monotone" dataKey="Latin America" stackId="1" stroke="var(--color-terminal-green)" fill="#003300" fillOpacity={0.7} />
              <Area type="monotone" dataKey="Oceania" stackId="1" stroke="#00ddff" fill="#002233" fillOpacity={0.7} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </TerminalCard>

      {/* FINANCING SOURCES — viral stat visualization */}
      <TerminalCard title={tc(lang, "equation.money_source")} accent="green" glow className="mb-6">
        <p className="text-xs text-content-secondary mb-4">
          {tc(lang, "eq.viral_stat")}
        </p>

        {/* Viral numbers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="border border-terminal-green bg-terminal-green/5 p-4 text-center">
            <div className="text-3xl font-bold text-terminal-green glow-green">
              {data.financing.pct_world_gdp}%
            </div>
            <div className="text-[10px] text-content-secondary uppercase mt-1">
              {tc(lang, "eq.of_world_gdp")}
            </div>
            <div className="text-[9px] text-content-dim mt-1">
              {tc(lang, "eq.out_of_gdp")}
            </div>
          </div>
          <div className="border border-blood bg-blood/5 p-4 text-center">
            <div className="text-3xl font-bold text-blood-bright glow-blood">
              {data.financing.pct_global_military}%
            </div>
            <div className="text-[10px] text-content-secondary uppercase mt-1">
              {tc(lang, "eq.of_military_spending")}
            </div>
            <div className="text-[9px] text-content-dim mt-1">
              {tc(lang, "eq.out_of_military")}
            </div>
          </div>
          <div className="border border-warning-amber bg-warning-amber/5 p-4 text-center">
            <div className="text-3xl font-bold text-warning-amber">
              14
            </div>
            <div className="text-[10px] text-content-secondary uppercase mt-1">
              {tc(lang, "eq.days_military")}
            </div>
            <div className="text-[9px] text-content-dim mt-1">
              {tc(lang, "eq.funds_one_year")}
            </div>
          </div>
        </div>

        {/* Scale bar: military vs hunger */}
        <div className="mb-6">
          <div className="flex justify-between text-[10px] text-content-dim mb-1">
            <span>{tc(lang, "eq.scale_comparison")}</span>
            <span>$0 → $2.4T</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-content-secondary w-28 shrink-0">{tc(lang, "eq.hunger_fix")}</span>
              <div className="flex-1 h-4 bg-void border border-border-dim">
                <div className="h-full bg-terminal-green" style={{ width: "3.9%" }} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-content-secondary w-28 shrink-0">{tc(lang, "eq.world_military")}</span>
              <div className="flex-1 h-4 bg-void border border-border-dim">
                <div className="h-full bg-blood" style={{ width: "100%" }} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-content-secondary w-28 shrink-0">{tc(lang, "eq.world_gdp")}</span>
              <div className="flex-1 h-4 bg-void border border-border-dim">
                <div className="h-full bg-content-dim" style={{ width: "100%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Shareable viral stats */}
        <div className="mb-4">
          <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">
            {tc(lang, "eq.tap_to_copy")}
          </div>
          <div className="space-y-2">
            <ShareableStat text={`${tc(lang, "eq.share_stat_1_pre")}${data.financing.pct_global_military}%${tc(lang, "eq.share_stat_1_post")}`} />
            <ShareableStat text={tc(lang, "eq.share_stat_2")} />
            <ShareableStat text={`${tc(lang, "eq.share_stat_3_pre")}${data.financing.pct_world_gdp}%${tc(lang, "eq.share_stat_3_post")}`} />
          </div>
        </div>
      </TerminalCard>

      {/* B. Intervention ROI */}
      <TerminalCard
        title={tc(lang, "eq.intervention_roi")}
        accent="green"
        className="mb-6"
      >
        <p className="text-xs text-content-secondary mb-4">
          {tc(lang, "eq.these_not_opinions")}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* School feeding */}
          <div className="terminal-card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blood-bright">{tc(lang, "eq.school_feeding")}</span>
              <StatusPill color="green">{tc(lang, "status.proven")}</StatusPill>
            </div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-content-secondary">{tc(lang, "eq.roi")}</span>
                <span className="text-terminal-green font-bold">
                  {data.global_indicators.interventions_evidence.school_feeding.roi_min}-
                  {data.global_indicators.interventions_evidence.school_feeding.roi_max}x
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-secondary">{tc(lang, "common.children_reached")}</span>
                <span className="text-content-primary">
                  {data.global_indicators.interventions_evidence.school_feeding.children_reached_m}M
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-secondary">{tc(lang, "common.market_size")}</span>
                <span className="text-content-primary">
                  ${data.global_indicators.interventions_evidence.school_feeding.market_size_billion_yr}B/yr
                </span>
              </div>
            </div>
            <div className="text-xs text-content-dim mt-2 italic">
              [{tc(lang, "common.source")} {data.global_indicators.interventions_evidence.school_feeding.source}]
            </div>
          </div>

          {/* Smallholder agriculture */}
          <div className="terminal-card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blood-bright">{tc(lang, "eq.smallholder_agri")}</span>
              <StatusPill color="green">{tc(lang, "status.proven")}</StatusPill>
            </div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-content-secondary">{tc(lang, "common.income_increase")}</span>
                <span className="text-terminal-green font-bold">
                  +{data.global_indicators.interventions_evidence.smallholder_agriculture.income_increase_pct}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-secondary">{tc(lang, "common.production_increase")}</span>
                <span className="text-terminal-green font-bold">
                  +{data.global_indicators.interventions_evidence.smallholder_agriculture.production_increase_pct}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-secondary">{tc(lang, "common.target_farmers")}</span>
                <span className="text-content-primary">
                  {data.global_indicators.interventions_evidence.smallholder_agriculture.target_farmers_m}M
                </span>
              </div>
            </div>
            <div className="text-xs text-content-dim mt-2 italic">
              [{tc(lang, "common.source")} {data.global_indicators.interventions_evidence.smallholder_agriculture.source}]
            </div>
          </div>

          {/* Agri R&D */}
          <div className="terminal-card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blood-bright">{tc(lang, "eq.agri_rd")}</span>
              <StatusPill color="green">{tc(lang, "status.proven")}</StatusPill>
            </div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-content-secondary">{tc(lang, "common.annual_return")}</span>
                <span className="text-terminal-green font-bold">
                  {data.global_indicators.interventions_evidence.agri_rd.annual_return_pct}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-secondary">{tc(lang, "common.focus")}</span>
                <span className="text-content-primary">{tc(lang, "eq.climate_crops")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-secondary">{tc(lang, "common.timeline")}</span>
                <span className="text-content-secondary">{tc(lang, "eq.year_lag")}</span>
              </div>
            </div>
            <div className="text-xs text-content-dim mt-2 italic">
              [{tc(lang, "common.source")} {data.global_indicators.interventions_evidence.agri_rd.source}]
            </div>
          </div>
        </div>
      </TerminalCard>

      {/* Budget allocation */}
      <TerminalCard title={tc(lang, "card.eq.budget_allocation")} className="mb-6">
        <div className="space-y-2">
          {data.financing.allocation.map((a, i) => (
            <div key={i}>
              <DataBar
                value={a.pct}
                max={100}
                label={`${ALLOC_NAME_KEYS[i] ? tc(lang, ALLOC_NAME_KEYS[i]) : a.name} — $${a.billion_yr}B/yr`}
                unit="%"
              />
              <div className="text-xs text-content-dim mt-0.5 ml-2">{ALLOC_JUST_KEYS[i] ? tc(lang, ALLOC_JUST_KEYS[i]) : a.justification}</div>
            </div>
          ))}
        </div>
      </TerminalCard>

      {/* C. Financing Mechanisms */}
      <TerminalCard title={tc(lang, "card.eq.financing")} className="mb-6">
        <p className="text-xs text-content-secondary mb-4">
          {tc(lang, "eq.select_mechanisms_sub")}
        </p>
        <div className="flex items-center gap-4 mb-4">
          <div className="text-xs">
            <span className="text-content-dim">{tc(lang, "eq.your_package")} </span>
            <span
              className={`text-lg font-bold ${
                financingTotal >= 93 ? "text-terminal-green" : "text-blood"
              }`}
            >
              ${financingTotal.toFixed(0)}B
            </span>
            <span className="text-content-dim"> {tc(lang, "eq.93b_target")}</span>
          </div>
          {financingTotal >= 93 && (
            <StatusPill color="green">{tc(lang, "eq.target_reached")}</StatusPill>
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
                <div className="text-xs font-bold text-content-primary">{FIN_NAME_KEYS[i] ? tc(lang, FIN_NAME_KEYS[i]) : m.name}</div>
                <div className="text-xs text-content-secondary mt-1">{FIN_DETAIL_KEYS[i] ? tc(lang, FIN_DETAIL_KEYS[i]) : m.detail}</div>
              </div>
            </label>
          ))}
        </div>
      </TerminalCard>

      {/* D. Conflict Zone Tactics */}
      <TerminalCard title={tc(lang, "card.eq.conflict_tactics")} accent="amber" className="mb-6">
        <p className="text-xs text-content-secondary mb-4">
          {tc(lang, "eq.conflict_tactics_sub")}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-dim text-content-dim">
                <th className="text-left py-2 px-2">{tc(lang, "eq.tier_header")}</th>
                <th className="text-left py-2 px-2">{tc(lang, "eq.tactic_header")}</th>
                <th className="text-left py-2 px-2 hidden sm:table-cell">{tc(lang, "eq.casualties_header")}</th>
                <th className="text-left py-2 px-2">{tc(lang, "eq.success_header")}</th>
                <th className="text-left py-2 px-2 hidden sm:table-cell">{tc(lang, "eq.speed_header")}</th>
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
                  <td className="py-2 px-2 text-content-primary">{TACTIC_NAME_KEYS[t.id - 1] ? tc(lang, TACTIC_NAME_KEYS[t.id - 1]) : t.name}</td>
                  <td className="py-2 px-2 text-content-secondary hidden sm:table-cell">
                    {CASUALTY_MAP[t.casualties] ? tc(lang, CASUALTY_MAP[t.casualties]) : t.casualties}
                  </td>
                  <td className="py-2 px-2">
                    <span
                      style={{
                        color:
                          t.success.includes("Alta") || t.success === "53%"
                            ? "var(--color-terminal-green)"
                            : t.success.includes("Media") || t.success === "26%"
                              ? "var(--color-warning-amber)"
                              : "var(--color-blood)",
                      }}
                    >
                      {SUCCESS_MAP[t.success] ? tc(lang, SUCCESS_MAP[t.success]) : t.success}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-content-secondary hidden sm:table-cell">
                    {SPEED_MAP[t.speed] ? tc(lang, SPEED_MAP[t.speed]) : t.speed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex gap-4 text-xs">
          <span style={{ color: "var(--color-terminal-green)" }}>■ S: {tc(lang, "eq.tier_s_desc")}</span>
          <span style={{ color: "var(--color-warning-amber)" }}>■ A: {tc(lang, "eq.tier_a_desc")}</span>
          <span style={{ color: "var(--color-blood)" }}>■ B: {tc(lang, "eq.tier_b_desc")}</span>
        </div>
      </TerminalCard>

      {/* E. Implementation Timeline */}
      <TerminalCard title={tc(lang, "card.eq.implementation")} accent="green" className="mb-6">
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
                  {tc(lang, "eq.target_label")} {p.target_hunger_m}{tc(lang, "eq.target_m_hungry")} (-{p.reduction_pct}%)
                </div>
                <DataBar
                  value={p.reduction_pct}
                  max={100}
                  label={tc(lang, "eq.hunger_reduction")}
                  unit="%"
                  inverse
                />
              </div>
            </div>
          ))}
        </div>
      </TerminalCard>

      {/* CROSS-DOMAIN EQUATIONS — SDG 3/4/6/7/10/13 */}
      {data.sdg_equations && (
        <SdgEquationsSection
          equations={data.sdg_equations}
          selectedSdg={selectedSdg}
          onSelectSdg={setSelectedSdg}
        />
      )}

      {/* Cross-links */}
      <TerminalCard title={tc(lang, "card.cross_links")}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link href="/the-trail/" className="terminal-card p-3 hover:border-blood block">
            <div className="text-xs text-blood-bright font-bold">→ {tc(lang, "eq.fund_solution")}</div>
            <div className="text-xs text-content-secondary mt-1">{tc(lang, "eq.route_resources")}</div>
          </Link>
          <Link href="/protocol-x/" className="terminal-card p-3 hover:border-blood block">
            <div className="text-xs text-blood-bright font-bold">→ {tc(lang, "eq.implementation_guides")}</div>
            <div className="text-xs text-content-secondary mt-1">{tc(lang, "eq.how_advocate")}</div>
          </Link>
          <Link href="/registry/" className="terminal-card p-3 hover:border-blood block">
            <div className="text-xs text-blood-bright font-bold">→ {tc(lang, "eq.document_tribunal")}</div>
            <div className="text-xs text-content-secondary mt-1">{tc(lang, "eq.war_crimes_icj")}</div>
          </Link>
        </div>
      </TerminalCard>
    </div>
  );
}

/* ── SDG PARALLEL EQUATIONS ──
 * Same moral-clarity framing as the hunger equation: compute the gap from
 * real data, show the cost, compare to military spending.
 */
const sdgTabMeta: Record<string, { label: string; color: string; sdg: string }> = {
  sdg6_water:   { label: "WATER",   color: "#00ddff", sdg: "SDG 6" },
  sdg3_health:  { label: "HEALTH",  color: "var(--color-blood-bright)", sdg: "SDG 3" },
  sdg7_energy:  { label: "ENERGY",  color: "var(--color-warning-amber)", sdg: "SDG 7" },
  sdg4_education: { label: "EDUCATION", color: "var(--color-terminal-green)", sdg: "SDG 4" },
  sdg13_climate: { label: "CLIMATE", color: "#cc6600", sdg: "SDG 13" },
  sdg10_inequality: { label: "INEQUALITY", color: "#aa44ff", sdg: "SDG 10" },
};

function SdgEquationsSection({
  equations,
  selectedSdg,
  onSelectSdg,
}: {
  equations: NonNullable<WorldBackbone["sdg_equations"]>;
  selectedSdg: string;
  onSelectSdg: (key: string) => void;
}) {
  const { lang } = useStore();
  const eq = equations.equations[selectedSdg] as SdgEquation;
  const meta = sdgTabMeta[selectedSdg] || sdgTabMeta.sdg6_water;
  const keys = Object.keys(equations.equations);
  const eqMeta = equations.meta;

  // Build a scale comparison bar (cost vs military vs GDP)
  const costB = eq.cost.annual_billion;
  const milB = eqMeta.world_military_trillion_yr * 1000;

  return (
    <>
      {/* Section header */}
      <TerminalCard
        title={tc(lang, "eq.cross_domain")}
        accent="amber"
        glow
        className="mb-6"
      >
        <p className="text-xs text-content-secondary mb-4">
          {tc(lang, "eq.every_gap_cheaper")}
        </p>

        {/* Quick-wins aggregate */}
        {eqMeta.quick_wins_total_billion && (
          <div className="border border-terminal-green bg-terminal-green/5 p-4 mb-4">
            <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">
              {tc(lang, "eq.combined_eq")}
            </div>
            <div className="text-lg text-terminal-green font-bold glow-green">
              ${eqMeta.quick_wins_total_billion}B/year
            </div>
            <div className="text-xs text-content-secondary mt-1">
              {eqMeta.quick_wins_label}
            </div>
            <div className="text-xs text-content-dim mt-1">
              = {eqMeta.quick_wins_pct_military}% of world military spending · {eqMeta.quick_wins_days_military} days
            </div>
          </div>
        )}

        {/* SDG tabs */}
        <div className="flex flex-wrap gap-2">
          {keys.map((key) => {
            const tm = sdgTabMeta[key];
            const isActive = selectedSdg === key;
            return (
              <button
                key={key}
                onClick={() => onSelectSdg(key)}
                className={`px-3 py-2 text-xs border transition-colors ${
                  isActive
                    ? "bg-void"
                    : "border-border-dim text-content-secondary hover:border-blood-dim"
                }`}
                style={isActive ? { borderColor: tm.color, color: tm.color } : {}}
              >
                <span className="text-content-dim mr-1">{tm.sdg}</span>
                <span className="font-bold">{tm.label}</span>
              </button>
            );
          })}
        </div>
      </TerminalCard>

      {/* Active SDG equation */}
      <TerminalCard
        title={`${meta.sdg} — ${eq.title.toUpperCase()}`}
        accent="amber"
        className="mb-6"
      >
        {/* Moral framing */}
        <div className="border-l-2 pl-3 mb-4" style={{ borderColor: meta.color }}>
          <p className="text-sm text-content-primary italic">{eq.moral_framing}</p>
          <p className="text-xs text-content-dim mt-1">{eq.subtitle}</p>
        </div>

        {/* The gap */}
        <div className="terminal-card p-3 mb-4">
          <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">
            {tc(lang, "eq.the_gap_dynamic").replace("{N}", String(data.metadata.total_countries))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(eq.current_gap).filter(([, v]) => typeof v === "number" || typeof v === "string").slice(0, 6).map(([k, v]) => (
              <div key={k}>
                <div className="text-[10px] text-content-dim uppercase">{k.replace(/_/g, " ")}</div>
                <div className="text-sm font-bold text-content-primary">
                  {typeof v === "number" ? v.toLocaleString() : v}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* The cost */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="border border-blood bg-blood/5 p-3 text-center">
            <div className="text-[9px] text-content-dim uppercase">{tc(lang, "eq.annual_cost")}</div>
            <div className="text-xl font-bold text-blood-bright">
              {eq.cost.annual_trillion ? `$${eq.cost.annual_trillion}T` : `$${costB}B`}
            </div>
            <div className="text-[9px] text-content-dim mt-1">{tc(lang, "eq.per_year")}</div>
          </div>
          <div className="border p-3 text-center" style={{ borderColor: meta.color + "66", background: meta.color + "0d" }}>
            <div className="text-[9px] text-content-dim uppercase">{tc(lang, "eq.pct_military_short")}</div>
            <div className="text-xl font-bold" style={{ color: meta.color }}>
              {eq.affordability.pct_military}%
            </div>
            <div className="text-[9px] text-content-dim mt-1">{eq.affordability.days_of_military} {tc(lang, "eq.days_lower")}</div>
          </div>
          <div className="border border-border-dim p-3 text-center">
            <div className="text-[9px] text-content-dim uppercase">{tc(lang, "eq.pct_gdp_short")}</div>
            <div className="text-xl font-bold text-content-primary">
              {eq.affordability.pct_world_gdp}%
            </div>
            <div className="text-[9px] text-content-dim mt-1">{tc(lang, "eq.of_world_gdp_approx")}</div>
          </div>
          <div className="border border-terminal-green bg-terminal-green/5 p-3 text-center">
            <div className="text-[9px] text-content-dim uppercase">{tc(lang, "eq.status_label")}</div>
            <div className="text-sm font-bold text-terminal-green uppercase mt-1">
              {eq.status.replace(/_/g, " ")}
            </div>
            <div className="text-[9px] text-content-dim mt-1">{eq.sdg_target}</div>
          </div>
        </div>

        {/* Scale comparison bar */}
        <div className="mb-4">
          <div className="flex justify-between text-[10px] text-content-dim mb-1">
            <span>{tc(lang, "eq.scale_comparison")}</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-content-secondary w-32 shrink-0">
                {eq.title} ({eq.cost.annual_trillion ? `$${eq.cost.annual_trillion}T` : `$${costB}B`})
              </span>
              <div className="flex-1 h-4 bg-void border border-border-dim">
                <div className="h-full" style={{ width: `${Math.min(100, costB / milB * 100)}%`, backgroundColor: meta.color }} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-content-secondary w-32 shrink-0">
                {tc(lang, "eq.world_military_scale")} (${eqMeta.world_military_trillion_yr}T)
              </span>
              <div className="flex-1 h-4 bg-void border border-border-dim">
                <div className="h-full bg-blood" style={{ width: "100%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Affordability framing */}
        <div className="terminal-card p-3 mb-4">
          <p className="text-xs text-content-primary font-bold">
            {eq.affordability.framing}
          </p>
        </div>

        {/* Interventions */}
        <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">
          {tc(lang, "eq.evidence_backed")}
        </div>
        <div className="space-y-2">
          {eq.interventions.map((iv, i) => (
            <div key={i} className="terminal-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="text-xs font-bold text-content-primary">{iv.name}</div>
                  <div className="text-xs text-content-secondary mt-0.5">{iv.roi_note}</div>
                </div>
                <div className="text-right shrink-0">
                  {iv.cost_billion_yr !== undefined && (
                    <div className="text-xs font-bold text-blood-bright">${iv.cost_billion_yr}B/yr</div>
                  )}
                  {iv.revenue_billion_yr !== undefined && (
                    <div className="text-xs font-bold text-terminal-green">+${iv.revenue_billion_yr}B/yr</div>
                  )}
                  <div className="text-[9px] text-content-dim">{iv.reach_m >= 1000 ? `${(iv.reach_m / 1000).toFixed(1)}B` : `${iv.reach_m}M`} {tc(lang, "common.reached")}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Source */}
        <div className="text-[10px] text-content-dim italic mt-3">
          {tc(lang, "eq.source_prefix")} {eq.cost.source}]
        </div>
      </TerminalCard>
    </>
  );
}
