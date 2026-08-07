"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, CountryData } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { formatNumber, formatMoney } from "@/lib/format";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const data = backbone as WorldBackbone;

/* ═══════════════════════════════════════════════════════════════
   METRIC DEFINITIONS — for correlation explorer
   Each metric knows how to extract a number from a country.
   inverse = true means higher is BETTER (for interpretation only).
   ═══════════════════════════════════════════════════════════════ */

interface MetricDef {
  id: string;
  label: string;
  unit: string;
  inverse?: boolean;
  extract: (c: CountryData) => number | null;
}

const METRICS: MetricDef[] = [
  { id: "undernourishment", label: "Undernourishment", unit: "%", extract: (c) => c.hunger.undernourishment_pct },
  { id: "child_stunting", label: "Child Stunting", unit: "%", extract: (c) => c.hunger.child_stunting_pct },
  { id: "famine_risk", label: "Famine Risk", unit: "/5", extract: (c) => c.hunger.famine_risk_1to5 },
  { id: "conflict_intensity", label: "Conflict Intensity", unit: "/5", extract: (c) => c.conflict.intensity_1to5 },
  { id: "displacement", label: "Displacement", unit: "M", extract: (c) => c.conflict.displacement_m },
  { id: "corruption_cpi", label: "Corruption (CPI)", unit: "", inverse: true, extract: (c) => c.governance.corruption_perceptions_index },
  { id: "democracy_idx", label: "Democracy Index", unit: "", inverse: true, extract: (c) => c.governance.electoral_democracy_index },
  { id: "military_pct_gdp", label: "Military % GDP", unit: "%", extract: (c) => c.military.pct_gdp },
  { id: "gdp_per_capita", label: "GDP Per Capita", unit: "$", inverse: true, extract: (c) => c.economy.gdp_per_capita_usd },
  { id: "life_expectancy", label: "Life Expectancy", unit: "yrs", inverse: true, extract: (c) => c.health.life_expectancy },
  { id: "child_mortality", label: "Child Mortality (U5)", unit: "/1k", extract: (c) => c.health.child_mortality_under5_per1k },
  { id: "doctors_per_1000", label: "Doctors /1000", unit: "", inverse: true, extract: (c) => c.health.doctors_per_1000 ?? null },
  { id: "hospital_beds", label: "Hospital Beds /1000", unit: "", inverse: true, extract: (c) => c.health.hospital_beds_per_1000 ?? null },
  { id: "co2_per_capita", label: "CO₂ Per Capita", unit: "t", extract: (c) => c.climate.co2_per_capita_t },
  { id: "air_pollution", label: "Air Pollution (PM2.5)", unit: "µg/m³", extract: (c) => c.environment.air_pollution_pm25_ugm3 },
  { id: "renewable_energy", label: "Renewable Energy", unit: "%", inverse: true, extract: (c) => c.environment.renewable_energy_pct },
  { id: "renewable_electric", label: "Renewable Electricity", unit: "%", inverse: true, extract: (c) => c.energy?.renewable_electric_pct ?? null },
  { id: "no_electricity", label: "No Electricity Access (M)", unit: "M", extract: (c) => c.energy?.no_access_electricity_m ?? null },
  { id: "poverty_365", label: "Extreme Poverty ($3.65)", unit: "%", extract: (c) => c.poverty.headcount_365_pct },
  { id: "homicide_rate", label: "Homicide Rate", unit: "/100k", extract: (c) => c.security.homicide_rate_per100k },
  { id: "prison_rate", label: "Incarceration Rate", unit: "/100k", extract: (c) => c.justice?.prison_rate_per_100k ?? c.security?.prison_rate_per_100k ?? null },
  { id: "tax_burden", label: "Tax Burden % GDP", unit: "%", extract: (c) => c.taxation?.tax_burden_pct_gdp ?? null },
  { id: "pisa_score", label: "PISA Score", unit: "", inverse: true, extract: (c) => c.education.pisa_score ?? null },
  { id: "food_insecurity", label: "Severe Food Insecurity (M)", unit: "M", extract: (c) => c.food_security?.severe_food_insecurity_m ?? null },
  { id: "gini", label: "Inequality (Gini)", unit: "", extract: (c) => c.inequality.gini },
  { id: "internet_access", label: "Internet Access", unit: "%", inverse: true, extract: (c) => c.connectivity.internet_users_pct },
  { id: "women_parliament", label: "Women in Parliament", unit: "%", inverse: true, extract: (c) => c.gender.women_parliament_pct },
];

function getMetric(id: string): MetricDef {
  return METRICS.find((m) => m.id === id) ?? METRICS[0];
}

/* ═══════════════════════════════════════════════════════════════
   COMPARISON ROW DEFINITIONS — for side-by-side table
   inverse = true means higher value is BETTER.
   ═══════════════════════════════════════════════════════════════ */

interface CompareRow {
  category: string;
  label: string;
  unit: string;
  inverse?: boolean;
  extract: (c: CountryData) => number | null;
  format: (n: number) => string;
}

const COMPARE_ROWS: CompareRow[] = [
  { category: "HUNGER", label: "Undernourishment", unit: "%", extract: (c) => c.hunger.undernourishment_pct, format: (n) => n.toFixed(1) + "%" },
  { category: "HUNGER", label: "Child Stunting", unit: "%", extract: (c) => c.hunger.child_stunting_pct, format: (n) => n.toFixed(1) + "%" },
  { category: "HUNGER", label: "Child Wasting", unit: "%", extract: (c) => c.hunger.child_wasting_pct, format: (n) => n.toFixed(1) + "%" },
  { category: "HUNGER", label: "Famine Risk", unit: "/5", extract: (c) => c.hunger.famine_risk_1to5, format: (n) => n.toFixed(1) },
  { category: "CONFLICT", label: "Conflict Intensity", unit: "/5", extract: (c) => c.conflict.intensity_1to5, format: (n) => n.toFixed(0) },
  { category: "CONFLICT", label: "Displacement", unit: "M", extract: (c) => c.conflict.displacement_m, format: (n) => n.toFixed(2) + "M" },
  { category: "CONFLICT", label: "Battle Deaths (total)", unit: "", extract: (c) => c.conflict.battle_deaths_total, format: (n) => formatNumber(n) },
  { category: "MILITARY", label: "Expenditure", unit: "$", extract: (c) => c.military.expenditure_usd, format: (n) => formatMoney(n) },
  { category: "MILITARY", label: "% of GDP", unit: "%", extract: (c) => c.military.pct_gdp, format: (n) => n.toFixed(1) + "%" },
  { category: "GOVERNANCE", label: "Corruption (CPI)", unit: "", inverse: true, extract: (c) => c.governance.corruption_perceptions_index, format: (n) => n.toFixed(1) },
  { category: "GOVERNANCE", label: "Democracy Index", unit: "", inverse: true, extract: (c) => c.governance.electoral_democracy_index, format: (n) => n.toFixed(2) },
  { category: "GOVERNANCE", label: "Political Corruption", unit: "", extract: (c) => c.governance.political_corruption_index, format: (n) => n.toFixed(2) },
  { category: "ECONOMY", label: "GDP", unit: "$", inverse: true, extract: (c) => c.economy.gdp_usd, format: (n) => formatMoney(n) },
  { category: "ECONOMY", label: "GDP Per Capita", unit: "$", inverse: true, extract: (c) => c.economy.gdp_per_capita_usd, format: (n) => "$" + formatMoney(n) },
  { category: "HEALTH", label: "Life Expectancy", unit: "yrs", inverse: true, extract: (c) => c.health.life_expectancy, format: (n) => n.toFixed(1) },
  { category: "HEALTH", label: "Child Mortality (U5)", unit: "/1k", extract: (c) => c.health.child_mortality_under5_per1k, format: (n) => n.toFixed(1) },
  { category: "HEALTH", label: "Health Expenditure % GDP", unit: "%", inverse: true, extract: (c) => c.health.expenditure_pct_gdp, format: (n) => n.toFixed(1) + "%" },
  { category: "HEALTH", label: "Doctors /1000", unit: "", inverse: true, extract: (c) => c.health.doctors_per_1000 ?? null, format: (n) => n.toFixed(1) },
  { category: "HEALTH", label: "Hospital Beds /1000", unit: "", inverse: true, extract: (c) => c.health.hospital_beds_per_1000 ?? null, format: (n) => n.toFixed(1) },
  { category: "EDUCATION", label: "PISA Score", unit: "", inverse: true, extract: (c) => c.education.pisa_score ?? null, format: (n) => n.toFixed(0) },
  { category: "CLIMATE", label: "CO₂ Per Capita", unit: "t", extract: (c) => c.climate.co2_per_capita_t, format: (n) => n.toFixed(2) },
  { category: "CLIMATE", label: "GHG Total", unit: "Mt", extract: (c) => c.climate.ghg_total_mt, format: (n) => n.toFixed(1) },
  { category: "ENVIRONMENT", label: "Air Pollution (PM2.5)", unit: "µg/m³", extract: (c) => c.environment.air_pollution_pm25_ugm3, format: (n) => n.toFixed(1) },
  { category: "ENVIRONMENT", label: "Renewable Energy", unit: "%", inverse: true, extract: (c) => c.environment.renewable_energy_pct, format: (n) => n.toFixed(1) + "%" },
  { category: "ENERGY", label: "Renewable Electricity", unit: "%", inverse: true, extract: (c) => c.energy?.renewable_electric_pct ?? null, format: (n) => n.toFixed(1) + "%" },
  { category: "ENERGY", label: "No Electricity Access", unit: "M", extract: (c) => c.energy?.no_access_electricity_m ?? null, format: (n) => n.toFixed(1) + "M" },
  { category: "POVERTY", label: "Extreme Poverty ($3.65)", unit: "%", extract: (c) => c.poverty.headcount_365_pct, format: (n) => n.toFixed(1) + "%" },
  { category: "SECURITY", label: "Homicide Rate", unit: "/100k", extract: (c) => c.security.homicide_rate_per100k, format: (n) => n.toFixed(1) },
  { category: "JUSTICE", label: "Incarceration Rate", unit: "/100k", extract: (c) => c.justice?.prison_rate_per_100k ?? null, format: (n) => n.toFixed(0) },
  { category: "TAXATION", label: "Tax Burden % GDP", unit: "%", extract: (c) => c.taxation?.tax_burden_pct_gdp ?? null, format: (n) => n.toFixed(1) + "%" },
  { category: "FOOD SECURITY", label: "Severe Food Insecurity", unit: "M", extract: (c) => c.food_security?.severe_food_insecurity_m ?? null, format: (n) => n.toFixed(1) + "M" },
  { category: "INEQUALITY", label: "Gini Coefficient", unit: "", extract: (c) => c.inequality.gini, format: (n) => n.toFixed(1) },
  { category: "GENDER", label: "Women in Parliament", unit: "%", inverse: true, extract: (c) => c.gender.women_parliament_pct, format: (n) => n.toFixed(1) + "%" },
];

/* ═══════════════════════════════════════════════════════════════
   QUICK-PICK PRESETS
   ═══════════════════════════════════════════════════════════════ */

const QUICK_PICKS: { label: string; iso3s: string[] }[] = [
  { label: "Top 3 Crises", iso3s: ["SDN", "SSD", "PSE"] },
  { label: "Nordic vs Global South", iso3s: ["NOR", "SWE", "DNK", "COD", "SDN", "YEM"] },
  { label: "BRICS", iso3s: ["BRA", "RUS", "IND", "CHN", "ZAF"] },
  { label: "G7", iso3s: ["USA", "GBR", "DEU", "FRA", "JPN", "ITA", "CAN"] },
  { label: "Top 5 Populous", iso3s: ["CHN", "IND", "USA", "IDN", "PAK"] },
];

/* ═══════════════════════════════════════════════════════════════
   PEARSON CORRELATION
   ═══════════════════════════════════════════════════════════════ */

function pearsonR(pairs: { x: number; y: number }[]): number {
  const n = pairs.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (const p of pairs) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
  }
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (den === 0) return 0;
  return num / den;
}

function interpretR(r: number): { text: string; color: string } {
  const abs = Math.abs(r);
  if (abs >= 0.7) return { text: r > 0 ? "STRONG POSITIVE CORRELATION" : "STRONG NEGATIVE CORRELATION", color: "#e10600" };
  if (abs >= 0.5) return { text: r > 0 ? "MODERATE POSITIVE CORRELATION" : "MODERATE NEGATIVE CORRELATION", color: "#ffaa00" };
  if (abs >= 0.3) return { text: r > 0 ? "WEAK POSITIVE CORRELATION" : "WEAK NEGATIVE CORRELATION", color: "#ffaa00" };
  if (abs >= 0.1) return { text: r > 0 ? "NEGLIGIBLE POSITIVE CORRELATION" : "NEGLIGIBLE NEGATIVE CORRELATION", color: "#888888" };
  return { text: "NO CORRELATION", color: "#888888" };
}

/* ═══════════════════════════════════════════════════════════════
   CUSTOM SCATTER TOOLTIP
   ═══════════════════════════════════════════════════════════════ */

function ScatterTooltip({ active, payload, xMetric, yMetric }: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; iso3: string; x: number; y: number; isHotspot: boolean } }>;
  xMetric: MetricDef;
  yMetric: MetricDef;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div
      className="border p-2 text-xs"
      style={{
        backgroundColor: "#0a0a0a",
        borderColor: p.isHotspot ? "#e10600" : "#444",
        color: "#ccc",
      }}
    >
      <div className="font-bold" style={{ color: p.isHotspot ? "#e10600" : "#00ff41" }}>
        {p.name} <span className="text-content-dim">[{p.iso3}]</span>
      </div>
      <div className="mt-1" style={{ color: "#888" }}>
        {xMetric.label}: <span style={{ color: "#ccc" }}>{p.x.toFixed(2)}{xMetric.unit}</span>
      </div>
      <div style={{ color: "#888" }}>
        {yMetric.label}: <span style={{ color: "#ccc" }}>{p.y.toFixed(2)}{yMetric.unit}</span>
      </div>
      {p.isHotspot && (
        <div className="mt-1" style={{ color: "#e10600", fontSize: "9px" }}>⚠ HOTSPOT</div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CUSTOM SCATTER POINT (shapes)
   ═══════════════════════════════════════════════════════════════ */

function renderHotspotPoint(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props;
  if (cx === undefined || cy === undefined) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill="#e10600"
      stroke="#ff3333"
      strokeWidth={1}
      opacity={0.85}
    />
  );
}

function renderNormalPoint(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props;
  if (cx === undefined || cy === undefined) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3}
      fill="#00aa33"
      stroke="#00ff41"
      strokeWidth={0.5}
      opacity={0.6}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function TheLensPage() {
  /* ── Correlation state ── */
  const [xMetricId, setXMetricId] = useState("gdp_per_capita");
  const [yMetricId, setYMetricId] = useState("child_mortality");

  const xMetric = useMemo(() => getMetric(xMetricId), [xMetricId]);
  const yMetric = useMemo(() => getMetric(yMetricId), [yMetricId]);

  /* ── Scatter data: split by hotspot ── */
  const { hotspotsData, normalData, correlation, nPlotted } = useMemo(() => {
    interface ScatterPoint {
      name: string;
      iso3: string;
      x: number;
      y: number;
      isHotspot: boolean;
    }
    const hot: ScatterPoint[] = [];
    const norm: ScatterPoint[] = [];
    const pairs: { x: number; y: number }[] = [];

    for (const c of data.countries) {
      const xv = xMetric.extract(c);
      const yv = yMetric.extract(c);
      if (xv == null || yv == null || isNaN(xv) || isNaN(yv)) continue;
      const point: ScatterPoint = {
        name: c.name_en,
        iso3: c.iso3,
        x: xv,
        y: yv,
        isHotspot: c.is_hotspot,
      };
      pairs.push({ x: xv, y: yv });
      if (c.is_hotspot) {
        hot.push(point);
      } else {
        norm.push(point);
      }
    }

    return {
      hotspotsData: hot,
      normalData: norm,
      correlation: pearsonR(pairs),
      nPlotted: pairs.length,
    };
  }, [xMetric, yMetric]);

  const interp = useMemo(() => interpretR(correlation), [correlation]);

  /* ── Comparison state ── */
  const [selectedIso3, setSelectedIso3] = useState<string[]>(["SDN", "NOR", "USA", "COD"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  /* Close picker on outside click */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedCountries = useMemo(
    () =>
      selectedIso3
        .map((iso3) => data.countries.find((c) => c.iso3 === iso3))
        .filter((c): c is CountryData => c !== undefined),
    [selectedIso3]
  );

  const filteredList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return data.countries
      .filter(
        (c) =>
          !selectedIso3.includes(c.iso3) &&
          (q === "" ||
            c.name_en.toLowerCase().includes(q) ||
            c.iso3.toLowerCase().includes(q))
      )
      .sort((a, b) => a.name_en.localeCompare(b.name_en));
  }, [searchQuery, selectedIso3]);

  const addCountry = useCallback((iso3: string) => {
    setSelectedIso3((prev) => {
      if (prev.includes(iso3)) return prev;
      if (prev.length >= 5) return prev;
      return [...prev, iso3];
    });
    setSearchQuery("");
  }, []);

  const removeCountry = useCallback((iso3: string) => {
    setSelectedIso3((prev) => prev.filter((x) => x !== iso3));
  }, []);

  const applyQuickPick = useCallback((iso3s: string[]) => {
    setSelectedIso3(iso3s.slice(0, 5));
    setSearchQuery("");
    setPickerOpen(false);
  }, []);

  /* ── Per-row best/worst computation ── */
  function getRowExtremes(
    row: CompareRow,
    countries: CountryData[]
  ): { bestIdx: number; worstIdx: number } {
    let bestVal = row.inverse ? -Infinity : Infinity;
    let worstVal = row.inverse ? Infinity : -Infinity;
    let bestIdx = -1;
    let worstIdx = -1;
    countries.forEach((c, i) => {
      const v = row.extract(c);
      if (v == null || isNaN(v)) return;
      if (row.inverse) {
        if (v > bestVal) { bestVal = v; bestIdx = i; }
        if (v < worstVal) { worstVal = v; worstIdx = i; }
      } else {
        if (v < bestVal) { bestVal = v; bestIdx = i; }
        if (v > worstVal) { worstVal = v; worstIdx = i; }
      }
    });
    return { bestIdx, worstIdx };
  }

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* ── HEADER ── */}
      <div className="mb-6 border-b border-border-dim pb-4">
        <div className="flex items-baseline gap-4 flex-wrap">
          <span className="text-xs text-content-dim">[09]</span>
          <h1 className="text-2xl md:text-3xl font-bold text-blood-bright glow-blood tracking-widest">
            THE LENS
          </h1>
          <StatusPill color="amber">ANALYTICS</StatusPill>
        </div>
        <p className="text-sm text-content-secondary mt-2">
          <span className="text-content-dim">//</span> Correlation is causation&apos;s shadow.
          Compare countries. Find patterns. Make arguments.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
         SECTION 1 — CORRELATION EXPLORER
         ═══════════════════════════════════════════════════════════════ */}
      <TerminalCard
        title="CORRELATION EXPLORER // CROSS-DIMENSION ANALYSIS"
        accent="amber"
        className="mb-6"
      >
        {/* Axis selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-content-dim uppercase tracking-widest mb-1 block">
              X-AXIS METRIC
            </label>
            <select
              value={xMetricId}
              onChange={(e) => setXMetricId(e.target.value)}
              className="w-full bg-void border border-border-dim text-content-primary text-sm px-3 py-2 focus:border-blood-bright focus:outline-none"
            >
              {METRICS.map((m) => (
                <option key={m.id} value={m.id} className="bg-void text-content-primary">
                  {m.label}
                  {m.unit ? ` (${m.unit})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-content-dim uppercase tracking-widest mb-1 block">
              Y-AXIS METRIC
            </label>
            <select
              value={yMetricId}
              onChange={(e) => setYMetricId(e.target.value)}
              className="w-full bg-void border border-border-dim text-content-primary text-sm px-3 py-2 focus:border-blood-bright focus:outline-none"
            >
              {METRICS.map((m) => (
                <option key={m.id} value={m.id} className="bg-void text-content-primary">
                  {m.label}
                  {m.unit ? ` (${m.unit})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div className="border border-border-dim p-3 bg-abyss">
            <div className="text-[10px] text-content-dim uppercase tracking-widest">
              PEARSON r
            </div>
            <div
              className="text-3xl font-bold mt-1"
              style={{ color: interp.color }}
            >
              {correlation.toFixed(3)}
            </div>
          </div>
          <div className="border border-border-dim p-3 bg-abyss">
            <div className="text-[10px] text-content-dim uppercase tracking-widest">
              INTERPRETATION
            </div>
            <div
              className="text-xs font-bold mt-1"
              style={{ color: interp.color }}
            >
              {interp.text}
            </div>
          </div>
          <div className="border border-border-dim p-3 bg-abyss col-span-2 md:col-span-1">
            <div className="text-[10px] text-content-dim uppercase tracking-widest">
              DATA POINTS (N)
            </div>
            <div className="text-3xl font-bold mt-1 text-content-primary">
              {nPlotted}
              <span className="text-sm text-content-dim ml-1">/ {data.countries.length}</span>
            </div>
          </div>
        </div>

        {/* Scatter chart */}
        <div className="border border-border-dim bg-abyss p-2 h-[320px] sm:h-[400px] md:h-[480px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, bottom: 50, left: 20 }}>
              <CartesianGrid stroke="#1a1a1a" strokeDasharray="2 4" />
              <XAxis
                type="number"
                dataKey="x"
                name={xMetric.label}
                stroke="#666"
                tick={{ fill: "#888", fontSize: 10, fontFamily: "monospace" }}
                label={{
                  value: xMetric.label + (xMetric.unit ? ` (${xMetric.unit})` : ""),
                  position: "bottom",
                  offset: 15,
                  fill: "#aaa",
                  fontSize: 11,
                  fontFamily: "monospace",
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={yMetric.label}
                stroke="#666"
                tick={{ fill: "#888", fontSize: 10, fontFamily: "monospace" }}
                label={{
                  value: yMetric.label + (yMetric.unit ? ` (${yMetric.unit})` : ""),
                  angle: -90,
                  position: "insideLeft",
                  offset: 0,
                  fill: "#aaa",
                  fontSize: 11,
                  fontFamily: "monospace",
                }}
              />
              <ZAxis range={[40, 40]} />
              <ReferenceLine y={0} stroke="#333" strokeDasharray="3 3" />
              <ReferenceLine x={0} stroke="#333" strokeDasharray="3 3" />
              <Tooltip
                cursor={{ strokeDasharray: "3 3", stroke: "#444" }}
                content={<ScatterTooltip xMetric={xMetric} yMetric={yMetric} />}
              />
              <Scatter
                name="Normal"
                data={normalData}
                fill="#00aa33"
                shape={renderNormalPoint}
              />
              <Scatter
                name="Hotspots"
                data={hotspotsData}
                fill="#e10600"
                shape={renderHotspotPoint}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 mt-3 text-xs text-content-secondary">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3"
              style={{ backgroundColor: "#e10600", border: "1px solid #ff3333" }}
            />
            HOTSPOT COUNTRIES ({hotspotsData.length})
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3"
              style={{ backgroundColor: "#00aa33", border: "1px solid #00ff41" }}
            />
            STANDARD COUNTRIES ({normalData.length})
          </div>
        </div>
      </TerminalCard>

      {/* ═══════════════════════════════════════════════════════════════
         SECTION 2 — COUNTRY COMPARISON TOOL
         ═══════════════════════════════════════════════════════════════ */}
      <TerminalCard
        title="COUNTRY COMPARISON TOOL // SIDE-BY-SIDE ANALYSIS"
        accent="green"
        className="mb-6"
      >
        {/* Quick picks */}
        <div className="mb-4">
          <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">
            // QUICK-PICK COMPARISONS
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_PICKS.map((qp) => (
              <button
                key={qp.label}
                onClick={() => applyQuickPick(qp.iso3s)}
                className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green transition-all"
              >
                ▶ {qp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Country picker */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] text-content-dim uppercase tracking-widest">
              // SELECT COUNTRIES ({selectedIso3.length}/5)
            </div>
          </div>

          {/* Selected chips */}
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedCountries.map((c) => (
              <span
                key={c.iso3}
                className="inline-flex items-center gap-1.5 text-xs px-2 py-1 border"
                style={{
                  backgroundColor: c.is_hotspot ? "#1a0000" : "#001a00",
                  borderColor: c.is_hotspot ? "#cc0000" : "#00aa33",
                  color: c.is_hotspot ? "#e10600" : "#00ff41",
                }}
              >
                <span className="font-bold">{c.iso3}</span>
                <span className="text-content-secondary">{c.name_en}</span>
                <button
                  onClick={() => removeCountry(c.iso3)}
                  className="ml-1 text-content-dim hover:text-blood-bright transition-colors"
                  aria-label={`Remove ${c.name_en}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>

          {/* Search input + dropdown */}
          <div className="relative" ref={pickerRef}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPickerOpen(true);
              }}
              onFocus={() => setPickerOpen(true)}
              placeholder={selectedIso3.length >= 5 ? "MAX 5 COUNTRIES — REMOVE ONE TO ADD" : "> Search countries by name or ISO3..."}
              disabled={selectedIso3.length >= 5}
              className="w-full bg-void border border-border-dim text-content-primary text-sm px-3 py-2 focus:border-terminal-green focus:outline-none disabled:opacity-40"
            />
            {pickerOpen && selectedIso3.length < 5 && (
              <div
                className="absolute z-50 w-full mt-1 border border-border-dim bg-void max-h-64 overflow-y-auto"
                style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.8)" }}
              >
                {filteredList.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-content-dim">NO MATCHING COUNTRIES</div>
                ) : (
                  filteredList.slice(0, 100).map((c) => (
                    <button
                      key={c.iso3}
                      onClick={() => addCountry(c.iso3)}
                      className="w-full flex items-center justify-between text-left px-3 py-1.5 text-xs hover:bg-panel-hi border-b border-border-dim transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-bold text-content-secondary w-8">{c.iso3}</span>
                        <span className="text-content-primary">{c.name_en}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        {c.is_hotspot && (
                          <span className="text-blood-bright text-[9px]">⚠</span>
                        )}
                        <span className="text-content-dim text-[9px]">{c.region}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Comparison table */}
        {selectedCountries.length < 2 ? (
          <div className="border border-border-dim p-8 text-center text-content-dim text-sm">
            // SELECT AT LEAST 2 COUNTRIES TO BEGIN COMPARISON
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 border border-border-dim bg-abyss text-content-dim uppercase tracking-widest text-[10px] sticky left-0">
                    DIMENSION
                  </th>
                  {selectedCountries.map((c) => (
                    <th
                      key={c.iso3}
                      className="p-2 border border-border-dim bg-abyss min-w-[120px]"
                    >
                      <Link
                        href={`/sorrow-map/${c.iso3.toLowerCase()}/`}
                        className="block hover:underline"
                      >
                        <div
                          className="font-bold"
                          style={{ color: c.is_hotspot ? "#e10600" : "#00ff41" }}
                        >
                          {c.iso3}
                        </div>
                        <div className="text-content-secondary text-[10px] truncate max-w-[110px]">
                          {c.name_en}
                        </div>
                        {c.is_hotspot && (
                          <div className="text-blood-bright text-[8px] mt-0.5">HOTSPOT</div>
                        )}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, rowIdx) => {
                  const { bestIdx, worstIdx } = getRowExtremes(row, selectedCountries);
                  return (
                    <tr
                      key={`${row.category}-${row.label}`}
                      className={rowIdx % 2 === 0 ? "bg-void" : "bg-abyss"}
                    >
                      <td className="p-2 border border-border-dim text-content-secondary sticky left-0">
                        <div className="text-[9px] text-content-dim uppercase">{row.category}</div>
                        <div className="text-content-primary whitespace-nowrap">{row.label}</div>
                      </td>
                      {selectedCountries.map((c, ci) => {
                        const v = row.extract(c);
                        const isBest = ci === bestIdx && bestIdx !== worstIdx;
                        const isWorst = ci === worstIdx && bestIdx !== worstIdx;
                        return (
                          <td
                            key={c.iso3}
                            className="p-2 border border-border-dim text-center"
                            style={{
                              backgroundColor: isBest
                                ? "rgba(0,255,65,0.08)"
                                : isWorst
                                  ? "rgba(225,6,0,0.08)"
                                  : undefined,
                              color: v == null ? "#444" : "#ccc",
                            }}
                          >
                            {v == null || isNaN(v) ? (
                              <span className="text-content-dim">—</span>
                            ) : (
                              <span
                                className="font-bold"
                                style={{
                                  color: isBest
                                    ? "#00ff41"
                                    : isWorst
                                      ? "#e10600"
                                      : "#ccc",
                                }}
                              >
                                {row.format(v)}
                                {isBest && <span className="ml-1 text-[8px] text-terminal-green">✓</span>}
                                {isWorst && <span className="ml-1 text-[8px] text-blood-bright">✗</span>}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend for best/worst */}
        <div className="flex items-center gap-6 mt-3 text-xs text-content-secondary">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 border"
              style={{ backgroundColor: "rgba(0,255,65,0.08)", borderColor: "#00ff41" }}
            />
            <span className="text-terminal-green">BEST VALUE IN ROW</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 border"
              style={{ backgroundColor: "rgba(225,6,0,0.08)", borderColor: "#e10600" }}
            />
            <span className="text-blood-bright">WORST VALUE IN ROW</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-content-dim">—</span>
            <span>NO DATA AVAILABLE</span>
          </div>
        </div>

        {/* Dossier links */}
        {selectedCountries.length >= 2 && (
          <div className="mt-4 pt-4 border-t border-border-dim">
            <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">
              // FULL DOSSIERS
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedCountries.map((c) => (
                <Link
                  key={c.iso3}
                  href={`/sorrow-map/${c.iso3.toLowerCase()}/`}
                  className="text-xs px-3 py-1 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-all"
                >
                  ▶ {c.iso3} — {c.name_en}
                </Link>
              ))}
            </div>
          </div>
        )}
      </TerminalCard>
    </div>
  );
}
