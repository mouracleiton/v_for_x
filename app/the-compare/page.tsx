"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useStore } from "@/stores/useStore";
import { tc } from "@/lib/i18n-content";
import { tlEvents } from "@/lib/timelines-i18n";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, CountryData } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import DataBar from "@/components/ui/DataBar";
import ExportPanel from "@/components/shared/ExportPanel";
import { sound } from "@/lib/sound";
import { formatNumber, formatMoney, formatPct } from "@/lib/format";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  exportCountryCSV,
  downloadFile,
  generateEmbedCode,
} from "@/lib/export-utils";

const data = backbone as WorldBackbone;

/* ═══════════════════════════════════════════════════════════════
   10 RADAR DIMENSIONS — normalized 0-100 (100 = most vulnerable)
   ═══════════════════════════════════════════════════════════════ */

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const norm = (v: number | null, lo: number, hi: number) =>
  v === null || !Number.isFinite(v) ? null : clamp(((v - lo) / (hi - lo)) * 100);
const normInv = (v: number | null, lo: number, hi: number) => {
  const n = norm(v, lo, hi);
  return n === null ? null : 100 - n;
};

interface RadarDim {
  key: string;
  label: string;
  score: (c: CountryData) => number | null;
}

const RADAR_DIMS: RadarDim[] = [
  { key: "hunger", label: "Hunger", score: (c) => norm(c.hunger.undernourishment_pct, 0, 60) },
  { key: "conflict", label: "Conflict", score: (c) => norm(c.conflict.intensity_1to5, 0, 5) },
  { key: "poverty", label: "Poverty", score: (c) => norm(c.poverty.headcount_365_pct, 0, 80) },
  { key: "health", label: "Health", score: (c) => norm(c.health.child_mortality_under5_per1k, 0, 120) },
  { key: "education", label: "Education", score: (c) => normInv(c.education.literacy_rate_pct, 0, 100) },
  { key: "water", label: "Water", score: (c) => normInv(c.water_sanitation.safe_sanitation_pct, 0, 100) },
  { key: "inequality", label: "Inequality", score: (c) => norm(c.inequality.gini, 20, 65) },
  { key: "military", label: "Military", score: (c) => norm(c.military.pct_gdp, 0, 12) },
  { key: "climate", label: "Climate", score: (c) => norm(c.climate.co2_per_capita_t, 0, 20) },
  { key: "governance", label: "Governance", score: (c) => normInv(c.governance.corruption_perceptions_index, 0, 100) },
];

/* ═══════════════════════════════════════════════════════════════
   19-DIMENSION COMPARISON TABLE — color-coded best/worst
   inverse = true means higher value is BETTER.
   ═══════════════════════════════════════════════════════════════ */

interface CompareRow {
  category: string;
  label: string;
  inverse?: boolean;
  extract: (c: CountryData) => number | null;
  format: (n: number) => string;
}

const COMPARE_ROWS: CompareRow[] = [
  // 1-3: Hunger
  { category: "HUNGER", label: "Undernourishment", extract: (c) => c.hunger.undernourishment_pct, format: formatPct },
  { category: "HUNGER", label: "Child Stunting", extract: (c) => c.hunger.child_stunting_pct, format: formatPct },
  { category: "HUNGER", label: "Famine Risk", extract: (c) => c.hunger.famine_risk_1to5, format: (n) => n.toFixed(1) + "/5" },
  // 4: Conflict
  { category: "CONFLICT", label: "Conflict Intensity", extract: (c) => c.conflict.intensity_1to5, format: (n) => n.toFixed(0) + "/5" },
  // 5: Poverty
  { category: "POVERTY", label: "Extreme Poverty ($3.65)", extract: (c) => c.poverty.headcount_365_pct, format: formatPct },
  // 6-7: Health
  { category: "HEALTH", label: "Life Expectancy", inverse: true, extract: (c) => c.health.life_expectancy, format: (n) => n.toFixed(1) + " yrs" },
  { category: "HEALTH", label: "Child Mortality (U5)", extract: (c) => c.health.child_mortality_under5_per1k, format: (n) => n.toFixed(1) + "/1k" },
  // 8-9: Education
  { category: "EDUCATION", label: "Literacy Rate", inverse: true, extract: (c) => c.education.literacy_rate_pct, format: formatPct },
  { category: "EDUCATION", label: "PISA Score", inverse: true, extract: (c) => c.education.pisa_score ?? null, format: (n) => n.toFixed(0) },
  // 10: Water
  { category: "WATER", label: "Safe Sanitation", inverse: true, extract: (c) => c.water_sanitation.safe_sanitation_pct, format: formatPct },
  // 11: Inequality
  { category: "INEQUALITY", label: "Gini Coefficient", extract: (c) => c.inequality.gini, format: (n) => n.toFixed(1) },
  // 12-13: Military
  { category: "MILITARY", label: "Military Spending", extract: (c) => c.military.expenditure_usd, format: formatMoney },
  { category: "MILITARY", label: "Military % GDP", extract: (c) => c.military.pct_gdp, format: formatPct },
  // 14: Climate
  { category: "CLIMATE", label: "CO₂ per Capita", extract: (c) => c.climate.co2_per_capita_t, format: (n) => n.toFixed(2) + " t" },
  // 15-16: Governance
  { category: "GOVERNANCE", label: "Corruption (CPI)", inverse: true, extract: (c) => c.governance.corruption_perceptions_index, format: (n) => n.toFixed(1) },
  { category: "GOVERNANCE", label: "Democracy Index", inverse: true, extract: (c) => c.governance.electoral_democracy_index, format: (n) => n.toFixed(2) },
  // 17: Economy
  { category: "ECONOMY", label: "GDP per Capita", inverse: true, extract: (c) => c.economy.gdp_per_capita_usd, format: (n) => "$" + formatNumber(n) },
  // 18: Displacement
  { category: "DISPLACEMENT", label: "Forcibly Displaced", extract: (c) => c.migration.forcibly_displaced, format: (n) => formatNumber(n) },
  // 19: Homicide
  { category: "SECURITY", label: "Homicide Rate", extract: (c) => c.security.homicide_rate_per100k, format: (n) => n.toFixed(1) + "/100k" },
];

/* ═══════════════════════════════════════════════════════════════
   BAR-CHART KEY METRICS (normalized 0-100 to max among selected)
   ═══════════════════════════════════════════════════════════════ */

interface KeyMetric {
  key: string;
  label: string;
  unit: string;
  inverse?: boolean;
  extract: (c: CountryData) => number | null;
  /** how to render the raw value in the tooltip */
  raw: (n: number) => string;
}

const KEY_METRICS: KeyMetric[] = [
  { key: "population", label: "Population", unit: "M", extract: (c) => c.population_m, raw: (n) => formatNumber(n * 1e6) },
  { key: "gdppc", label: "GDP per Capita", unit: "$", inverse: true, extract: (c) => c.economy.gdp_per_capita_usd, raw: (n) => formatMoney(n) },
  { key: "hunger", label: "Hunger", unit: "%", extract: (c) => c.hunger.undernourishment_pct, raw: formatPct },
  { key: "lifeexp", label: "Life Expectancy", unit: "yrs", inverse: true, extract: (c) => c.health.life_expectancy, raw: (n) => n.toFixed(1) },
  { key: "military", label: "Military Spending", unit: "$", extract: (c) => c.military.expenditure_usd, raw: formatMoney },
];

/* ═══════════════════════════════════════════════════════════════
   QUICK-PICK PRESETS
   ═══════════════════════════════════════════════════════════════ */

const QUICK_PICKS: { label: string; iso3s: string[] }[] = [
  { label: "Crisis Trio (Hotspot / Developed / Surprising)", iso3s: ["SDN", "NOR", "USA"] },
  { label: "Top 3 Crises", iso3s: ["SDN", "SSD", "YEM"] },
  { label: "BRICS", iso3s: ["BRA", "RUS", "IND", "CHN", "ZAF"] },
  { label: "Nordic vs Global South", iso3s: ["NOR", "SWE", "COD", "SDN"] },
  { label: "G7", iso3s: ["USA", "GBR", "DEU", "FRA", "JPN", "ITA", "CAN"] },
  { label: "Americas", iso3s: ["USA", "BRA", "MEX", "HTI", "VEN"] },
];

const COUNTRY_COLORS = [
  "var(--color-blood-bright)",
  "var(--color-terminal-green)",
  "var(--color-command-bright)",
  "var(--color-warning-amber)",
];

const MAX_COUNTRIES = 4;

/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function TheComparePage() {
  const { lang } = useStore();

  // Default: one hotspot (SDN), one developed (NOR), one surprising (USA).
  const [selectedIso3, setSelectedIso3] = useState<string[]>(["SDN", "NOR", "USA"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

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
            c.iso3.toLowerCase().includes(q) ||
            c.region.toLowerCase().includes(q))
      )
      .sort((a, b) => a.name_en.localeCompare(b.name_en));
  }, [searchQuery, selectedIso3]);

  const addCountry = useCallback((iso3: string) => {
    setSelectedIso3((prev) =>
      prev.includes(iso3) || prev.length >= MAX_COUNTRIES
        ? prev
        : [...prev, iso3]
    );
    setSearchQuery("");
    sound.select();
  }, []);

  const removeCountry = useCallback((iso3: string) => {
    setSelectedIso3((prev) => prev.filter((x) => x !== iso3));
    sound.select();
  }, []);

  const applyQuickPick = useCallback((iso3s: string[]) => {
    setSelectedIso3(iso3s.slice(0, MAX_COUNTRIES));
    setSearchQuery("");
    setPickerOpen(false);
    sound.success();
  }, []);

  /* ── Radar data ── */
  const radarData = useMemo(
    () =>
      RADAR_DIMS.map((dim) => {
        const row: Record<string, number | string> = { dimension: dim.label };
        for (const c of selectedCountries) {
          const s = dim.score(c);
          row[c.iso3] = s !== null ? Math.round(s) : 0;
        }
        return row;
      }),
    [selectedCountries]
  );

  /* ── Per-row best/worst computation ── */
  function getRowExtremes(row: CompareRow, countries: CountryData[]) {
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

  /* ── Bar chart data (normalized 0-100 to max among selected) ── */
  const barData = useMemo(() => {
    return KEY_METRICS.map((metric) => {
      const values = selectedCountries.map((c) => metric.extract(c));
      const validMax = Math.max(...values.filter((v): v is number => v != null && !isNaN(v)));
      const baseMax = validMax > 0 ? validMax : 1;
      const entry: Record<string, number | string | null> = { metric: metric.label };
      for (const c of selectedCountries) {
        const v = metric.extract(c);
        entry[c.iso3] = v != null && !isNaN(v) && v >= 0
          ? Math.round((v / baseMax) * 100)
          : 0;
      }
      return { entry, metric, baseMax };
    });
  }, [selectedCountries]);

  /* ── Narrative generator ── */
  const narratives = useMemo(() => {
    if (selectedCountries.length < 2) return [];
    const lines: { tone: "worse" | "better" | "neutral"; text: string }[] = [];
    const [a, b] = [selectedCountries[0], selectedCountries[1]];

    // Undernourishment ratio
    const ua = a.hunger.undernourishment_pct;
    const ub = b.hunger.undernourishment_pct;
    if (ua != null && ub != null && ub > 0) {
      const ratio = ua / ub;
      if (ratio > 1.5) {
        lines.push({
          tone: "worse",
          text: `${a.name_en} has ${ratio.toFixed(1)}× the undernourishment rate of ${b.name_en} (${formatPct(ua)} vs ${formatPct(ub)}).`,
        });
      } else if (ratio < 0.67) {
        lines.push({
          tone: "better",
          text: `${a.name_en} has a far lower undernourishment rate than ${b.name_en} (${formatPct(ua)} vs ${formatPct(ub)}) — ${(ub / ua).toFixed(1)}× better.`,
        });
      }
    }

    // GDP per capita contrast + disadvantage
    const ga = a.economy.gdp_per_capita_usd;
    const gb = b.economy.gdp_per_capita_usd;
    const la = a.health.life_expectancy;
    const lb = b.health.life_expectancy;
    if (ga != null && gb != null && ga > gb && la != null && lb != null && la < lb) {
      lines.push({
        tone: "neutral",
        text: `Despite ${a.name_en} earning ${formatMoney(ga)} per capita (${(ga / Math.max(gb, 1)).toFixed(1)}× ${b.name_en}'s ${formatMoney(gb)}), its life expectancy (${la.toFixed(0)}) still trails ${b.name_en}'s (${lb.toFixed(0)}).`,
      });
    }

    // Military vs health
    const ma = a.military.expenditure_usd;
    const mb = b.military.expenditure_usd;
    if (ma != null && mb != null && ma > mb * 2) {
      lines.push({
        tone: "neutral",
        text: `${a.name_en} spends ${formatMoney(ma)} on its military — ${(ma / Math.max(mb, 1)).toFixed(1)}× ${b.name_en}'s ${formatMoney(mb)}.`,
      });
    }

    // Corruption gap
    const ca = a.governance.corruption_perceptions_index;
    const cb = b.governance.corruption_perceptions_index;
    if (ca != null && cb != null && Math.abs(ca - cb) >= 20) {
      const better = ca > cb ? a : b;
      const worse = ca > cb ? b : a;
      lines.push({
        tone: "worse",
        text: `${better.name_en} scores ${Math.max(ca, cb).toFixed(0)}/100 on the Corruption Perceptions Index; ${worse.name_en} lags at ${Math.min(ca, cb).toFixed(0)} — a ${Math.abs(ca - cb).toFixed(0)}-point governance gap.`,
      });
    }

    return lines;
  }, [selectedCountries]);

  /* ── Crisis timelines for comparison ── */
  const timelineData = useMemo(
    () =>
      selectedCountries.map((c) => ({
        country: c,
        events: tlEvents(c.iso3, lang),
      })),
    [selectedCountries, lang]
  );
  const timelineMaxLen = useMemo(
    () => Math.max(0, ...timelineData.map((t) => t.events.length)),
    [timelineData]
  );
  const hasTimeline = timelineData.some((t) => t.events.length > 0);

  /* ── Shareable link ── */
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${window.location.pathname}?c=${selectedIso3.join(",")}`;
  }, [selectedIso3]);

  const copyShareLink = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      sound.copy();
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      sound.error();
    }
  };

  const copyDataJSON = () => {
    if (typeof window === "undefined" || selectedCountries.length === 0) return;
    const json = JSON.stringify(selectedCountries, null, 2);
    navigator.clipboard?.writeText(json).then(() => { sound.copy(); }).catch(() => sound.error());
  };

  const downloadComparisonCSV = () => {
    if (selectedCountries.length === 0) return;
    downloadFile(
      `vfx-compare-${selectedIso3.join("-")}.csv`,
      selectedCountries.map((c) => exportCountryCSV(c)).join("\n\n"),
      "text/csv;charset=utf-8"
    );
    sound.select();
  };

  const embedSnippet = useMemo(
    () => generateEmbedCode("the-compare", { c: selectedIso3.join(",") }),
    [selectedIso3]
  );

  const copyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedSnippet);
      sound.copy();
    } catch {
      sound.error();
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* ── HEADER ── */}
      <div className="mb-6 border-b border-border-dim pb-4">
        <div className="flex items-baseline gap-4 flex-wrap">
          <span className="text-xs text-content-dim">{tc(lang, "branch.lens")}[⇄]</span>
          <h1 className="text-2xl md:text-3xl font-bold text-blood-bright glow-blood tracking-widest">
            THE COMPARE
          </h1>
          <StatusPill color="amber">SIDE-BY-SIDE ANALYSIS</StatusPill>
        </div>
        <p className="text-sm text-content-secondary mt-2">
          Overlay 2–4 countries across 19 vulnerability dimensions. Radar, data
          table, key-metric bars, and an auto-generated narrative. The contrast
          is the argument.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
         COUNTRY SELECTOR
         ═══════════════════════════════════════════════════════════════ */}
      <TerminalCard title="country selector" accent="green" className="mb-6">
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
                className="text-[11px] px-3 py-1.5 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green transition-all"
              >
                ▶ {qp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Selected chips */}
        <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">
          // SELECTED ({selectedIso3.length}/{MAX_COUNTRIES})
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedCountries.map((c, i) => (
            <span
              key={c.iso3}
              className="inline-flex items-center gap-1.5 text-xs px-2 py-1 border"
              style={{
                backgroundColor: c.is_hotspot ? "#1a0000" : "#001a00",
                borderColor: COUNTRY_COLORS[i % COUNTRY_COLORS.length],
                color: c.is_hotspot ? "var(--color-blood-bright)" : "var(--color-terminal-green)",
              }}
            >
              <span
                className="inline-block w-2 h-2"
                style={{ backgroundColor: COUNTRY_COLORS[i % COUNTRY_COLORS.length] }}
              />
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

        {/* Search + dropdown */}
        <div className="relative" ref={pickerRef}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPickerOpen(true);
            }}
            onFocus={() => setPickerOpen(true)}
            placeholder={
              selectedIso3.length >= MAX_COUNTRIES
                ? `MAX ${MAX_COUNTRIES} COUNTRIES — REMOVE ONE TO ADD`
                : "> Search countries by name, ISO3, or region…"
            }
            disabled={selectedIso3.length >= MAX_COUNTRIES}
            className="w-full bg-void border border-border-dim text-content-primary text-sm px-3 py-2 focus:border-terminal-green focus:outline-none disabled:opacity-40"
          />
          {pickerOpen && selectedIso3.length < MAX_COUNTRIES && (
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
                      {c.is_hotspot && <span className="text-blood-bright text-[9px]">⚠</span>}
                      <span className="text-content-dim text-[9px]">{c.region}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Export / share bar */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-border-dim">
          <span className="text-[10px] text-content-dim uppercase tracking-widest">// export:</span>
          <button
            onClick={downloadComparisonCSV}
            className="text-[10px] px-2.5 py-1 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green transition-colors"
          >
            ⭳ CSV
          </button>
          <button
            onClick={copyDataJSON}
            className="text-[10px] px-2.5 py-1 border border-border-dim text-content-secondary hover:border-command hover:text-command-bright transition-colors"
          >
            ⧉ COPY JSON
          </button>
          <button
            onClick={copyEmbed}
            className="text-[10px] px-2.5 py-1 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors"
          >
            {"</>"} EMBED
          </button>
          <button
            onClick={copyShareLink}
            className="text-[10px] px-2.5 py-1 border border-border-dim text-content-secondary hover:border-amber hover:text-warning-amber transition-colors"
          >
            {linkCopied ? "✓ LINK COPIED" : "🔗 SHAREABLE LINK"}
          </button>
        </div>
      </TerminalCard>

      {selectedCountries.length < 2 ? (
        <div className="terminal-card p-12 text-center">
          <div className="text-content-dim text-sm">
            // SELECT AT LEAST 2 COUNTRIES TO BEGIN COMPARISON
          </div>
        </div>
      ) : (
        <>
          {/* ═══════════════════════════════════════════════════════
             1. RADAR CHART
             ═══════════════════════════════════════════════════════ */}
          <TerminalCard title="vulnerability radar — 10 dimensions overlaid" accent="blood" className="mb-6">
            <div style={{ width: "100%", height: 420 }}>
              <ResponsiveContainer>
                <RadarChart data={radarData} outerRadius="74%">
                  <PolarGrid stroke="#2a4264" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: "#8da3c4", fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#4a5d7a", fontSize: 8 }} angle={90} />
                  {selectedCountries.map((c, i) => {
                    const color = COUNTRY_COLORS[i % COUNTRY_COLORS.length];
                    return (
                      <Radar
                        key={c.iso3}
                        name={c.iso3}
                        dataKey={c.iso3}
                        stroke={color}
                        fill={color}
                        fillOpacity={0.08}
                        strokeWidth={2}
                      />
                    );
                  })}
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-abyss)",
                      border: "1px solid var(--color-border-bright)",
                      fontSize: "11px",
                      borderRadius: 0,
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[10px] text-content-dim mt-2 italic">
              ▸ Score 0–100 (100 = most vulnerable). Each country overlays on the same axes for direct contrast.
            </div>
          </TerminalCard>

          {/* ═══════════════════════════════════════════════════════
             2. DATA TABLE — 19 dimensions
             ═══════════════════════════════════════════════════════ */}
          <TerminalCard title="data table — 19 dimensions side by side" accent="amber" className="mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="text-left p-2 border border-border-dim bg-abyss text-content-dim uppercase tracking-widest text-[10px] sticky left-0 z-10">
                      Dimension
                    </th>
                    {selectedCountries.map((c, i) => (
                      <th key={c.iso3} className="p-2 border border-border-dim bg-abyss min-w-[130px]">
                        <Link href={`/sorrow-map/${c.iso3.toLowerCase()}/`} className="block hover:underline">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="inline-block w-2 h-2" style={{ backgroundColor: COUNTRY_COLORS[i % COUNTRY_COLORS.length] }} />
                            <span className="font-bold text-content-primary">{c.iso3}</span>
                          </div>
                          <div className="text-content-secondary text-[10px] truncate max-w-[120px]">{c.name_en}</div>
                          {c.is_hotspot && <div className="text-blood-bright text-[8px] mt-0.5">⚠ HOTSPOT</div>}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row, rowIdx) => {
                    const { bestIdx, worstIdx } = getRowExtremes(row, selectedCountries);
                    return (
                      <tr key={`${row.category}-${row.label}`} className={rowIdx % 2 === 0 ? "bg-void" : "bg-abyss"}>
                        <td className="p-2 border border-border-dim text-content-secondary sticky left-0 z-10" style={{ background: rowIdx % 2 === 0 ? "var(--color-void)" : "var(--color-abyss)" }}>
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
                                  ? "rgba(34,211,166,0.10)"
                                  : isWorst
                                    ? "rgba(226,56,86,0.10)"
                                    : undefined,
                              }}
                            >
                              {v == null || isNaN(v) ? (
                                <span className="text-content-dim">—</span>
                              ) : (
                                <span
                                  className="font-bold"
                                  style={{
                                    color: isBest
                                      ? "var(--color-terminal-green)"
                                      : isWorst
                                        ? "var(--color-blood-bright)"
                                        : "var(--color-content-secondary)",
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
            <div className="flex items-center gap-6 mt-3 text-[10px] text-content-secondary flex-wrap">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 border" style={{ backgroundColor: "rgba(34,211,166,0.10)", borderColor: "var(--color-terminal-green)" }} />
                <span className="text-terminal-green">BEST VALUE</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 border" style={{ backgroundColor: "rgba(226,56,86,0.10)", borderColor: "var(--color-blood-bright)" }} />
                <span className="text-blood-bright">WORST VALUE</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-content-dim">—</span>
                <span>NO DATA</span>
              </div>
            </div>
          </TerminalCard>

          {/* ═══════════════════════════════════════════════════════
             3. BAR CHART — key metrics
             ═══════════════════════════════════════════════════════ */}
          <TerminalCard title="key metrics — normalized comparison" accent="amber" className="mb-6">
            <div style={{ width: "100%", height: 340 }}>
              <ResponsiveContainer>
                <BarChart data={barData.map((b) => b.entry)} margin={{ top: 20, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid stroke="var(--color-border-dim)" strokeDasharray="2 4" />
                  <XAxis dataKey="metric" stroke="#4a5d7a" tick={{ fill: "#8da3c4", fontSize: 10 }} interval={0} />
                  <YAxis stroke="#4a5d7a" tick={{ fill: "#4a5d7a", fontSize: 9 }} domain={[0, 100]} unit="%" />
                  <Tooltip
                    cursor={{ fill: "rgba(91,156,246,0.06)" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const metricDef = barData.find((b) => b.metric.label === label)?.metric;
                      return (
                        <div
                          className="border p-2 text-xs"
                          style={{ background: "var(--color-abyss)", borderColor: "var(--color-border-bright)" }}
                        >
                          <div className="font-bold text-content-primary mb-1">{label}{metricDef ? ` (${metricDef.unit})` : ""}</div>
                          {payload.map((p) => {
                            const c = selectedCountries.find((cc) => cc.iso3 === p.name);
                            const raw = c && metricDef ? metricDef.extract(c) : null;
                            return (
                              <div key={p.name as string} className="flex items-center gap-2">
                                <span className="inline-block w-2 h-2" style={{ backgroundColor: p.color }} />
                                <span className="text-content-secondary">{p.name}</span>
                                <span className="font-bold text-content-primary ml-auto">
                                  {raw != null && !isNaN(raw) ? metricDef!.raw(raw) : "N/A"}
                                </span>
                                <span className="text-content-dim">({p.value}%)</span>
                              </div>
                            );
                          })}
                          <div className="text-[9px] text-content-dim mt-1 italic">bars normalized to max among selected</div>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  {selectedCountries.map((c, i) => (
                    <Bar key={c.iso3} dataKey={c.iso3} name={c.iso3} radius={[3, 3, 0, 0]}>
                      {barData.map((_, idx) => (
                        <Cell key={idx} fill={COUNTRY_COLORS[i % COUNTRY_COLORS.length]} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              {KEY_METRICS.map((m) => {
                const vals = selectedCountries
                  .map((c) => ({ c, v: m.extract(c) }))
                  .filter((x): x is { c: CountryData; v: number } => x.v != null && !isNaN(x.v));
                const max = vals.length > 0 ? Math.max(...vals.map((x) => x.v)) : 1;
                return (
                  <div key={m.key} className="border border-border-dim p-3 bg-abyss">
                    <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2 flex items-center justify-between">
                      <span>{m.label}</span>
                      <span className="text-content-dim normal-case">{m.inverse ? "higher = better" : "higher = worse"}</span>
                    </div>
                    <div className="space-y-1.5">
                      {vals.map(({ c, v }) => (
                        <DataBar
                          key={c.iso3}
                          value={v}
                          max={max}
                          label={c.iso3}
                          inverse={m.inverse}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </TerminalCard>

          {/* ═══════════════════════════════════════════════════════
             4. NARRATIVE GENERATOR
             ═══════════════════════════════════════════════════════ */}
          <TerminalCard title="narrative generator — auto-analysis" accent="green" className="mb-6">
            {narratives.length === 0 ? (
              <div className="text-xs text-content-dim text-center py-6">
                // INSUFFICIENT CONTRAST BETWEEN {selectedCountries[0]?.name_en} AND {selectedCountries[1]?.name_en} FOR A HEADLINE
              </div>
            ) : (
              <div className="space-y-3">
                {narratives.map((n, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 border"
                    style={{
                      borderColor:
                        n.tone === "worse"
                          ? "var(--color-blood)"
                          : n.tone === "better"
                            ? "var(--color-terminal-green)"
                            : "var(--color-border-bright)",
                      backgroundColor: "var(--color-abyss)",
                    }}
                  >
                    <StatusPill color={n.tone === "worse" ? "blood" : n.tone === "better" ? "green" : "dim"}>
                      {n.tone === "worse" ? "↓ GAP" : n.tone === "better" ? "↑ EDGE" : "⇄ CONTRAST"}
                    </StatusPill>
                    <p className="text-sm text-content-secondary leading-relaxed flex-1">{n.text}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="text-[10px] text-content-dim mt-3 italic">
              ▸ Generated automatically from {selectedCountries.length}-country contrast. First two selections anchor the comparison.
            </div>
          </TerminalCard>

          {/* ═══════════════════════════════════════════════════════
             5. TIMELINE COMPARISON
             ═══════════════════════════════════════════════════════ */}
          <TerminalCard title="crisis timeline comparison" accent="blood" className="mb-6">
            {!hasTimeline ? (
              <div className="text-xs text-content-dim text-center py-6">
                // NO CRISIS TIMELINE DATA FOR THE SELECTED COUNTRIES
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {timelineData.map((t, i) => (
                  <div key={t.country.iso3} className="border border-border-dim p-3 bg-abyss">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border-dim">
                      <span className="inline-block w-2 h-2" style={{ backgroundColor: COUNTRY_COLORS[i % COUNTRY_COLORS.length] }} />
                      <Link href={`/sorrow-map/${t.country.iso3.toLowerCase()}/`} className="font-bold text-content-primary hover:text-blood-bright">
                        {t.country.name_en}
                      </Link>
                      <span className="text-[9px] text-content-dim ml-auto">{t.events.length} EVENTS</span>
                    </div>
                    {t.events.length === 0 ? (
                      <div className="text-[10px] text-content-dim italic">No timeline recorded.</div>
                    ) : (
                      <ol className="space-y-1.5">
                        {t.events.map((ev, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-[11px]">
                            <span className="text-[9px] text-content-dim font-mono mt-0.5 shrink-0">{String(idx + 1).padStart(2, "0")}</span>
                            <span className="text-content-secondary leading-snug">{ev}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="text-[10px] text-content-dim mt-3 italic">
              ▸ Side-by-side crisis chronologies where available. Longest timeline: {timelineMaxLen} events.
            </div>
          </TerminalCard>

          {/* ═══════════════════════════════════════════════════════
             EXPORT PANEL
             ═══════════════════════════════════════════════════════ */}
          <ExportPanel
            countries={selectedCountries}
            page="the-compare"
            params={{ c: selectedIso3.join(",") }}
          />
        </>
      )}
    </div>
  );
}
