"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, CountryData } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import {
  analyzeCorrelation,
  correlationMatrix,
  strongestCorrelations,
  interpretR,
  formatPValue,
  significanceStars,
  type MetricDef,
} from "@/lib/correlation";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  ZAxis,
} from "recharts";

const data = backbone as WorldBackbone;

/* ═══════════════════════════════════════════════════════════════
   METRIC DEFINITIONS
   Extract a numeric value from a CountryData for each of the 40+
   well-populated fields across the 19 data dimensions.
   inverse = true means higher is BETTER (interpretation only).
   ═══════════════════════════════════════════════════════════════ */

const METRICS: MetricDef[] = [
  // Hunger
  { id: "hunger.prevalence", label: "Hunger Prevalence", unit: "%", extract: (c) => c.hunger.prevalence_pct },
  { id: "hunger.undernourishment", label: "Undernourishment", unit: "%", extract: (c) => c.hunger.undernourishment_pct },
  { id: "hunger.stunting", label: "Child Stunting", unit: "%", extract: (c) => c.hunger.child_stunting_pct },
  { id: "hunger.famine", label: "Famine Risk", unit: "/5", extract: (c) => c.hunger.famine_risk_1to5 },
  // Conflict
  { id: "conflict.intensity", label: "Conflict Intensity", unit: "/5", extract: (c) => c.conflict.intensity_1to5 },
  { id: "conflict.displacement", label: "Displacement", unit: "M", extract: (c) => c.conflict.displacement_m },
  // Economy
  { id: "economy.gdp_pc", label: "GDP per Capita", unit: "$", inverse: true, extract: (c) => c.economy.gdp_per_capita_usd },
  { id: "economy.gini", label: "Gini Coefficient", unit: "", extract: (c) => c.inequality.gini },
  // Health
  { id: "health.le", label: "Life Expectancy", unit: "yrs", inverse: true, extract: (c) => c.health.life_expectancy },
  { id: "health.child_mort", label: "Child Mortality (U5)", unit: "/1k", extract: (c) => c.health.child_mortality_under5_per1k },
  { id: "health.doctors", label: "Doctors /1000", unit: "", inverse: true, extract: (c) => c.health.doctors_per_1000 ?? null },
  { id: "health.beds", label: "Hospital Beds /1000", unit: "", inverse: true, extract: (c) => c.health.hospital_beds_per_1000 ?? null },
  // Governance
  { id: "gov.cpi", label: "Corruption (CPI)", unit: "/100", inverse: true, extract: (c) => c.governance.corruption_perceptions_index },
  { id: "gov.democracy", label: "Democracy Index", unit: "/1", inverse: true, extract: (c) => c.governance.electoral_democracy_index },
  // Military
  { id: "mil.pct_gdp", label: "Military % GDP", unit: "%", extract: (c) => c.military.pct_gdp },
  { id: "mil.exp", label: "Military Expenditure", unit: "$B", extract: (c) => c.military.expenditure_usd ? c.military.expenditure_usd / 1e9 : null },
  // Poverty
  { id: "pov.365", label: "Extreme Poverty ($3.65)", unit: "%", extract: (c) => c.poverty.headcount_365_pct },
  { id: "pov.685", label: "Poverty ($6.85)", unit: "%", extract: (c) => c.poverty.headcount_685_pct },
  // Water
  { id: "water.sanitation", label: "Safe Sanitation", unit: "%", inverse: true, extract: (c) => c.water_sanitation.safe_sanitation_pct },
  { id: "water.basic", label: "Basic Water Access", unit: "%", inverse: true, extract: (c) => c.water_sanitation.basic_access_pct },
  // Education
  { id: "edu.literacy", label: "Literacy Rate", unit: "%", inverse: true, extract: (c) => c.education.literacy_rate_pct },
  { id: "edu.enroll", label: "Primary Enrollment", unit: "%", inverse: true, extract: (c) => c.education.primary_enrollment_pct ?? null },
  // Climate
  { id: "clim.co2", label: "CO₂ per Capita", unit: "t", extract: (c) => c.climate.co2_per_capita_t },
  { id: "env.pm25", label: "Air Pollution PM2.5", unit: "µg/m³", extract: (c) => c.environment.air_pollution_pm25_ugm3 ?? null },
  // Inequality / demographics
  { id: "ineq.gini", label: "Gini (Inequality)", unit: "", extract: (c) => c.inequality.gini },
  // Migration
  { id: "mig.forcibly", label: "Forcibly Displaced", unit: "M", extract: (c) => c.migration.forcibly_displaced },
  { id: "mig.refugees", label: "Refugees Hosted", unit: "M", extract: (c) => c.migration.refugees_hosted ?? null },
  // Security
  { id: "sec.homicide", label: "Homicide Rate", unit: "/100k", extract: (c) => c.security.homicide_rate_per100k },
  { id: "sec.femicide", label: "Femicides / Year", unit: "", extract: (c) => c.security.femicides_per_year ?? null },
  // Justice
  { id: "jus.rule_of_law", label: "Rule of Law", unit: "", inverse: true, extract: (c) => c.justice?.rule_of_law_index ?? null },
  { id: "jus.pretrial", label: "Pre-Trial Detention", unit: "%", extract: (c) => c.justice?.pre_trial_pct ?? null },
  { id: "jus.overcrowd", label: "Prison Overcrowding", unit: "%", extract: (c) => c.justice?.prison_overcrowding_pct ?? null },
  // Food security
  { id: "food.min_wage", label: "Minimum Wage", unit: "$", inverse: true, extract: (c) => c.food_security?.min_wage_usd ?? null },
  { id: "food.afford", label: "Food Affordability Ratio", unit: "×", extract: (c) => c.food_security?.food_cost_affordability_ratio ?? null },
  // Energy
  { id: "energy.renewable", label: "Renewable Electricity", unit: "%", inverse: true, extract: (c) => c.energy?.renewable_electric_pct ?? null },
  { id: "energy.no_access", label: "No Electricity Access", unit: "M", extract: (c) => c.energy?.no_access_electricity_m ?? null },
  // Mental health
  { id: "mh.suicide", label: "Suicide Rate", unit: "/100k", extract: (c) => c.mental_health?.suicide_rate_per100k ?? null },
];

const metricById = (id: string): MetricDef =>
  METRICS.find((m) => m.id === id) ?? METRICS[0];

/* ═══════════════════════════════════════════════════════════════ */

export default function CorrelationLabPage() {
  const [metricAId, setMetricAId] = useState("hunger.undernourishment");
  const [metricBId, setMetricBId] = useState("mil.pct_gdp");

  const metricA = metricById(metricAId);
  const metricB = metricById(metricBId);

  const result = useMemo(
    () => analyzeCorrelation(data.countries, metricA, metricB),
    [metricA, metricB],
  );

  const scatterData = useMemo(() => {
    const pts: { iso3: string; name: string; x: number | null; y: number | null }[] = [];
    for (const c of data.countries) {
      pts.push({
        iso3: c.iso3,
        name: c.name_en,
        x: metricA.extract(c),
        y: metricB.extract(c),
      });
    }
    return pts.filter((p) => p.x != null && p.y != null);
  }, [metricA, metricB]);

  const interpretation = interpretR(result.pearsonR);
  const strongest = useMemo(
    () => strongestCorrelations(data.countries, metricA, METRICS, 40).slice(0, 12),
    [metricA],
  );

  const matrix = useMemo(() => correlationMatrix(data.countries, METRICS).slice(0, 40), []);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">🔬 THE CORRELATION LAB</h1>
      <p className="text-content-secondary text-sm mb-6">
        // guided statistical explorer — 200 countries × {METRICS.length} fields · Pearson R, Spearman R, R², p-value · computed 100% in your browser
      </p>

      {/* ═══ METRIC PICKER ═══ */}
      <TerminalCard title="SELECT TWO METRICS" accent="amber" className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-content-dim uppercase tracking-widest block mb-1">Metric A (X axis)</label>
            <select
              value={metricAId}
              onChange={(e) => { setMetricAId(e.target.value); sound.select(); }}
              className="w-full bg-abyss border border-border-dim px-2 py-2 text-xs text-content-primary"
            >
              {METRICS.map((m) => <option key={m.id} value={m.id}>{m.label} ({m.unit})</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-content-dim uppercase tracking-widest block mb-1">Metric B (Y axis)</label>
            <select
              value={metricBId}
              onChange={(e) => { setMetricBId(e.target.value); sound.select(); }}
              className="w-full bg-abyss border border-border-dim px-2 py-2 text-xs text-content-primary"
            >
              {METRICS.map((m) => <option key={m.id} value={m.id}>{m.label} ({m.unit})</option>)}
            </select>
          </div>
        </div>
        <p className="text-[10px] text-content-dim mt-3">
          ⚠️ Correlation is not causation. These functions measure statistical association only — interpretation is left to the human analyst.
        </p>
      </TerminalCard>

      {/* ═══ SCATTER PLOT ═══ */}
      <TerminalCard title={`${metricA.label} vs ${metricB.label}`} accent="green" className="mb-6">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 16, bottom: 10, left: 16 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" dataKey="x" name={metricA.label} tick={{ fontSize: 10, fill: "#8fa3c8" }} stroke="#2a3550" />
              <YAxis type="number" dataKey="y" name={metricB.label} tick={{ fontSize: 10, fill: "#8fa3c8" }} stroke="#2a3550" />
              <ZAxis range={[36, 36]} />
              <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1000000, y: 1000000 }]} stroke="#ff2a3c" strokeDasharray="4 4" opacity={0.3} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{ background: "#0a0f1e", border: "1px solid #2a3550", fontSize: 11 }}
              />
              <Scatter data={scatterData} fill="#00ddff" fillOpacity={0.6} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </TerminalCard>

      {/* ═══ STATS ═══ */}
      <TerminalCard title="ANALYSIS" accent="blood" glow className="mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
          <StatCell label="Pearson R" value={result.pearsonR.toFixed(3)} color={interpretation.color} />
          <StatCell label="R²" value={result.rSquared.toFixed(3)} color="var(--color-content-primary)" />
          <StatCell label="Spearman R" value={result.spearmanR.toFixed(3)} color="var(--color-content-primary)" />
          <StatCell label="p-value" value={formatPValue(result.pValue)} color={result.significant ? "var(--color-terminal-green)" : "var(--color-content-secondary)"} />
          <StatCell label="Significance" value={significanceStars(result.pValue) || "ns"} color={result.significant ? "var(--color-terminal-green)" : "var(--color-content-secondary)"} />
          <StatCell label="Countries (n)" value={String(result.n)} color="var(--color-content-primary)" />
        </div>
        <div className="mt-4 p-3 border text-center" style={{ borderColor: interpretation.color + "55", background: "var(--color-void)" }}>
          <span className="text-sm font-bold uppercase tracking-widest" style={{ color: interpretation.color }}>
            {interpretation.text}
          </span>
          <p className="text-xs text-content-secondary mt-1">
            {result.significant
              ? "Statistically significant at p < 0.05 — this association is unlikely to be random."
              : "Not statistically significant — the relationship may be noise, or the sample is too small."}
          </p>
        </div>
      </TerminalCard>

      {/* ═══ STRONGEST CORRELATIONS FROM METRIC A ═══ */}
      <TerminalCard title={`STRONGEST PARTNERS — ${metricA.label.toUpperCase()}`} accent="amber" className="mb-6">
        <div className="space-y-1">
          {strongest.map((e) => {
            const interp = interpretR(e.result.pearsonR);
            return (
              <button
                key={e.metricB}
                onClick={() => { setMetricBId(e.metricB); sound.select(); }}
                className="w-full flex items-center justify-between gap-2 px-2 py-1.5 border border-border-dim bg-abyss hover:border-blood hover:bg-panel transition-colors text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs" style={{ color: interp.color }}>{e.result.pearsonR.toFixed(3)}</span>
                  <span className="text-xs text-content-primary truncate">{e.labelB}</span>
                  <span className="text-[10px] text-content-dim">n={e.result.n}</span>
                  <span className="text-[10px] text-terminal-green">{significanceStars(e.result.pValue)}</span>
                </div>
                <span className="text-[10px] text-content-dim shrink-0">→ set as B</span>
              </button>
            );
          })}
        </div>
      </TerminalCard>

      {/* ═══ TOP 40 GLOBAL PAIRS ═══ */}
      <TerminalCard title="TOP 40 CORRELATION MATRIX (ALL PAIRS)" accent="green">
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {matrix.map((e, i) => {
            const interp = interpretR(e.result.pearsonR);
            return (
              <div key={`${e.metricA}-${e.metricB}`} className="flex items-center gap-3 px-2 py-1 border-b border-border-dim last:border-0">
                <span className="text-[10px] text-content-dim w-6">{i + 1}</span>
                <span className="text-xs text-content-primary w-40 truncate" title={e.labelA}>{e.labelA}</span>
                <span className="text-content-dim text-xs">×</span>
                <span className="text-xs text-content-primary w-40 truncate" title={e.labelB}>{e.labelB}</span>
                <span className="flex-1" />
                <span className="font-mono text-xs w-14 text-right" style={{ color: interp.color }}>{e.result.pearsonR.toFixed(3)}</span>
                <span className="text-[10px] text-terminal-green w-6 text-right">{significanceStars(e.result.pValue)}</span>
                <span className="text-[10px] text-content-dim w-8 text-right">n={e.result.n}</span>
              </div>
            );
          })}
        </div>
      </TerminalCard>

      {/* ═══ CROSSLINKS ═══ */}
      <div className="flex flex-wrap gap-2 mt-6">
        <Link href="/sorrow-map/" className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright">→ Sorrow Map</Link>
        <Link href="/the-compare/" className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright">→ The Compare</Link>
        <Link href="/the-price-tag/" className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright">→ The Price Tag</Link>
      </div>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="border border-border-dim bg-void p-2">
      <div className="text-lg font-bold font-mono" style={{ color }}>{value}</div>
      <div className="text-[10px] text-content-dim uppercase tracking-widest mt-1">{label}</div>
    </div>
  );
}
