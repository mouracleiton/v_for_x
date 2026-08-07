"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, CountryData } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import DataBar from "@/components/ui/DataBar";
import { sound } from "@/lib/sound";
import {
  DOMAIN_WEIGHTS,
  calculateVulnerability,
  scoreColor,
  scoreLabel,
} from "@/lib/vulnerability";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

const data = backbone as WorldBackbone;

type Tab = "ranking" | "comparison" | "regions";

/* ═══ REGIONAL AGGREGATION ═══ */

interface RegionAgg {
  region: string;
  countries: number;
  population: number;
  avgUndernourishment: number | null;
  avgLiteracy: number | null;
  avgLifeExpectancy: number | null;
  avgGini: number | null;
  avgChildMortality: number | null;
  avgDoctors: number | null;
  avgCpi: number | null;
  avgCo2: number | null;
  conflictCountries: number;
  hotspotCount: number;
}

function aggregateByRegion(countries: CountryData[]): RegionAgg[] {
  const groups = new Map<string, CountryData[]>();
  for (const c of countries) {
    const arr = groups.get(c.region) ?? [];
    arr.push(c);
    groups.set(c.region, arr);
  }
  const results: RegionAgg[] = [];
  for (const [region, cs] of groups) {
    const popW = (val: (c: CountryData) => number | null | undefined) => {
      const pairs = cs
        .map((c) => ({ v: val(c), p: c.demographics.population }))
        .filter((x) => x.v !== null && x.v !== undefined && x.p > 0);
      if (pairs.length === 0) return null;
      const totalP = pairs.reduce((a, b) => a + b.p, 0);
      return pairs.reduce((a, b) => a + (b.v as number) * b.p, 0) / totalP;
    };
    results.push({
      region,
      countries: cs.length,
      population: cs.reduce((a, b) => a + b.demographics.population, 0),
      avgUndernourishment: popW((c) => c.hunger.undernourishment_pct),
      avgLiteracy: popW((c) => c.education.literacy_rate_pct),
      avgLifeExpectancy: popW((c) => c.health.life_expectancy),
      avgGini: popW((c) => c.inequality.gini),
      avgChildMortality: popW((c) => c.health.child_mortality_under5_per1k),
      avgDoctors: popW((c) => c.health.doctors_per_1000),
      avgCpi: popW((c) => c.governance.corruption_perceptions_index),
      avgCo2: popW((c) => c.climate.co2_per_capita_t),
      conflictCountries: cs.filter((c) => c.conflict.intensity_1to5 >= 3).length,
      hotspotCount: cs.filter((c) => c.is_hotspot).length,
    });
  }
  // Sort by undernourishment descending (worst first)
  return results.sort((a, b) => (b.avgUndernourishment ?? 0) - (a.avgUndernourishment ?? 0));
}

/* ═══ COMPARISON METRICS ═══ */

interface CompareMetric {
  label: string;
  extract: (c: CountryData) => number | null;
  unit: string;
  higherIsBetter?: boolean;
}

const COMPARE_METRICS: CompareMetric[] = [
  { label: "Undernourishment", extract: (c) => c.hunger.undernourishment_pct, unit: "%" },
  { label: "Child Stunting", extract: (c) => c.hunger.child_stunting_pct, unit: "%" },
  { label: "Famine Risk", extract: (c) => c.hunger.famine_risk_1to5, unit: "/5" },
  { label: "Conflict Intensity", extract: (c) => c.conflict.intensity_1to5, unit: "/5" },
  { label: "Doctors / 1k", extract: (c) => c.health.doctors_per_1000 ?? null, unit: "/1k", higherIsBetter: true },
  { label: "Life Expectancy", extract: (c) => c.health.life_expectancy, unit: "yrs", higherIsBetter: true },
  { label: "Child Mortality", extract: (c) => c.health.child_mortality_under5_per1k, unit: "/1k" },
  { label: "Literacy", extract: (c) => c.education.literacy_rate_pct, unit: "%", higherIsBetter: true },
  { label: "Safe Sanitation", extract: (c) => c.water_sanitation.safe_sanitation_pct, unit: "%", higherIsBetter: true },
  { label: "CO2 / Capita", extract: (c) => c.climate.co2_per_capita_t, unit: "t" },
  { label: "Gini", extract: (c) => c.inequality.gini, unit: "" },
  { label: "Extreme Poverty", extract: (c) => c.poverty.headcount_365_pct, unit: "%" },
  { label: "CPI", extract: (c) => c.governance.corruption_perceptions_index, unit: "", higherIsBetter: true },
  { label: "Military % GDP", extract: (c) => c.military.pct_gdp, unit: "%" },
  { label: "Internet Users", extract: (c) => c.connectivity.internet_users_pct, unit: "%", higherIsBetter: true },
  { label: "Homicide Rate", extract: (c) => c.security.homicide_rate_per100k, unit: "/100k" },
];

function fmt(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

/** Colors for up to 4 radar polygons — high contrast on dark background */
const RADAR_COLORS = ["#cc0000", "#00ddff", "#00ff41", "#ffaa00"];

export default function TheIndexPage() {
  const [tab, setTab] = useState<Tab>("ranking");

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[13] THE INDEX</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          THE INDEX
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // rank. compare. aggregate. the analytics engine — composite vulnerability scores,
          side-by-side country comparison, and regional rollups across all 19 dimensions.
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {([
          { key: "ranking", label: "VULNERABILITY RANKING" },
          { key: "comparison", label: "COUNTRY COMPARISON" },
          { key: "regions", label: "REGIONAL ROLLUPS" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); sound.select(); }}
            className={`px-3 py-1.5 text-xs border transition-colors ${
              tab === t.key
                ? "border-blood text-blood-bright bg-blood/10"
                : "border-border-dim text-content-secondary hover:border-blood-dim"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "ranking" && <VulnerabilityRanking />}
      {tab === "comparison" && <ComparisonMode />}
      {tab === "regions" && <RegionalRollups />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   1. VULNERABILITY RANKING
   ═══════════════════════════════════════════════════════════════ */

function VulnerabilityRanking() {
  const [weights, setWeights] = useState<Record<string, number>>(
    Object.fromEntries(DOMAIN_WEIGHTS.map((d) => [d.domain, d.defaultWeight]))
  );
  const [showAll, setShowAll] = useState(false);

  const ranked = useMemo(() => {
    return data.countries
      .map((c) => ({
        country: c,
        result: calculateVulnerability(c, weights),
      }))
      .filter((x) => x.result.missingDomains.length < 5) // filter out countries with too little data
      .sort((a, b) => b.result.composite - a.result.composite);
  }, [weights]);

  const visible = showAll ? ranked : ranked.slice(0, 25);
  const resetWeights = () => {
    setWeights(Object.fromEntries(DOMAIN_WEIGHTS.map((d) => [d.domain, d.defaultWeight])));
    sound.select();
  };

  return (
    <div className="space-y-6">
      {/* Weight controls */}
      <TerminalCard title="DOMAIN WEIGHTS — DEFINE YOUR INDEX" accent="amber" glow>
        <p className="text-xs text-content-secondary mb-4">
          // adjust the weights to redefine what "vulnerable" means. the ranking updates live.
          higher weight = that domain matters more. zero = ignore it entirely.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DOMAIN_WEIGHTS.map((dw) => (
            <div key={dw.domain} className="border border-border-dim bg-void p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold" style={{ color: dw.color }}>
                  {dw.label}
                </span>
                <span className="text-xs text-content-dim font-mono">
                  {weights[dw.domain]?.toFixed(1) ?? "0.0"}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={weights[dw.domain] ?? 0}
                onChange={(e) => {
                  setWeights((prev) => ({ ...prev, [dw.domain]: parseFloat(e.target.value) }));
                }}
                className="w-full accent-blood"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={resetWeights}
            className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
          >
            ↺ RESET DEFAULTS
          </button>
          <button
            onClick={() => {
              const eq: Record<string, number> = {};
              for (const dw of DOMAIN_WEIGHTS) eq[dw.domain] = 1;
              setWeights(eq);
              sound.select();
            }}
            className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
          >
            ⚖ EQUAL WEIGHTS
          </button>
        </div>
      </TerminalCard>

      {/* Ranking */}
      <TerminalCard title={`VULNERABILITY RANKING — ${showAll ? `ALL ${ranked.length}` : "TOP 25"}`} accent="blood" glow>
        <div className="space-y-1">
          {visible.map((item, i) => {
            const score = item.result.composite;
            const color = scoreColor(score);
            const label = scoreLabel(score);
            return (
              <Link
                key={item.country.iso3}
                href={`/sorrow-map/${item.country.iso3.toLowerCase()}/`}
                className="flex items-center gap-2 p-2 border border-border-dim hover:border-blood bg-void transition-colors group"
              >
                <span className="text-xs text-content-dim font-mono w-8 text-right">
                  #{i + 1}
                </span>
                <span className="text-xs text-content-primary font-bold w-32 sm:w-40 truncate">
                  {item.country.name_en}
                </span>
                <span className="text-[10px] text-content-dim font-mono hidden sm:inline">
                  {item.country.iso3}
                </span>
                <div className="flex-1 h-3 bg-void border border-border-dim overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${score}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-xs font-bold font-mono w-10 text-right" style={{ color }}>
                  {score.toFixed(0)}
                </span>
                <span className="text-[9px] uppercase w-16 text-right" style={{ color }}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
        {!showAll && ranked.length > 25 && (
          <button
            onClick={() => { setShowAll(true); sound.select(); }}
            className="block w-full text-center py-2 mt-3 text-xs border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors"
          >
            ▼ SHOW ALL {ranked.length} COUNTRIES
          </button>
        )}
        {showAll && (
          <button
            onClick={() => { setShowAll(false); sound.select(); }}
            className="block w-full text-center py-2 mt-3 text-xs border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors"
          >
            ▲ COLLAPSE TO TOP 25
          </button>
        )}
      </TerminalCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   2. COUNTRY COMPARISON
   ═══════════════════════════════════════════════════════════════ */

function ComparisonMode() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>(["SSD", "NOR", "IND"]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return data.countries
      .filter(
        (c) =>
          (c.name_en.toLowerCase().includes(q) || c.iso3.toLowerCase().includes(q)) &&
          !selected.includes(c.iso3)
      )
      .slice(0, 6);
  }, [search, selected]);

  const countries = useMemo(
    () => selected.map((iso) => data.countries.find((c) => c.iso3 === iso)).filter(Boolean) as CountryData[],
    [selected]
  );

  // Build radar data: one entry per domain, with each country's score as a key
  const radarData = useMemo(() => {
    return DOMAIN_WEIGHTS.map((dw) => {
      const entry: Record<string, number | string | null> = { domain: dw.label };
      for (const c of countries) {
        const vuln = calculateVulnerability(c);
        const domainScore = vuln.domains.find((d) => d.domain === dw.domain);
        entry[c.iso3] = domainScore && domainScore.hasData ? domainScore.score : null;
      }
      return entry;
    });
  }, [countries]);

  function addCountry(iso: string) {
    if (selected.length >= 4) {
      sound.error();
      return;
    }
    if (!selected.includes(iso)) {
      setSelected([...selected, iso]);
      sound.select();
    }
    setSearch("");
  }

  function removeCountry(iso: string) {
    setSelected(selected.filter((x) => x !== iso));
    sound.select();
  }

  // For each metric, find best/worst among selected
  function metricWinner(metric: CompareMetric, values: (number | null)[]): { bestIdx: number; worstIdx: number } {
    const valid = values.map((v, i) => ({ v: v as number, i })).filter((x) => x.v !== null);
    if (valid.length === 0) return { bestIdx: -1, worstIdx: -1 };
    let best = valid[0];
    let worst = valid[0];
    for (const x of valid) {
      if (metric.higherIsBetter ? x.v > best.v : x.v < best.v) best = x;
      if (metric.higherIsBetter ? x.v < worst.v : x.v > worst.v) worst = x;
    }
    return { bestIdx: best.i, worstIdx: worst.i };
  }

  return (
    <div className="space-y-6">
      <TerminalCard title="SELECT COUNTRIES (MAX 4)" accent="green">
        <p className="text-xs text-content-secondary mb-3">
          // pin up to 4 countries for side-by-side comparison across {COMPARE_METRICS.length} metrics.
        </p>
        <div className="relative mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Add country (e.g. Sudan, SSD…)"
            className="w-full bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-terminal-green focus:outline-none"
          />
          {searchResults.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 border border-border-dim bg-abyss max-h-60 overflow-y-auto">
              {searchResults.map((c) => (
                <button
                  key={c.iso3}
                  onClick={() => addCountry(c.iso3)}
                  className="w-full text-left px-3 py-2 text-xs border-b border-border-dim last:border-b-0 hover:bg-panel"
                >
                  <span className="text-content-dim font-mono mr-2">{c.iso3}</span>
                  {c.name_en}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {countries.map((c) => (
            <span key={c.iso3} className="flex items-center gap-1 px-2 py-1 border border-terminal-green bg-terminal-green/5 text-xs">
              <span className="text-content-dim font-mono">{c.iso3}</span>
              <span className="text-content-primary">{c.name_en}</span>
              <button onClick={() => removeCountry(c.iso3)} className="text-blood-bright ml-1">✕</button>
            </span>
          ))}
          {countries.length === 0 && (
            <span className="text-xs text-content-dim">No countries selected.</span>
          )}
        </div>
      </TerminalCard>

      {countries.length >= 2 && (
        <TerminalCard title="CRISIS PROFILE RADAR — DOMAIN VULNERABILITY" accent="blood" glow>
          <p className="text-xs text-content-secondary mb-3">
            // one polygon per country — the shape of the crisis. each axis is a domain
            normalized to 0-100 where 100 = maximum vulnerability. bigger area = worse off.
          </p>
          <div className="h-[300px] sm:h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                data={radarData}
                margin={{ top: 10, right: 40, bottom: 10, left: 40 }}
              >
                <PolarGrid stroke="var(--color-border-dim, #333)" />
                <PolarAngleAxis
                  dataKey="domain"
                  tick={{ fill: "var(--color-content-dim, #888)", fontSize: 10 }}
                />
                <PolarRadiusAxis
                  domain={[0, 100]}
                  tick={{ fill: "var(--color-content-dim, #555)", fontSize: 8 }}
                  tickCount={5}
                  stroke="var(--color-border-dim, #333)"
                />
                {countries.map((c, i) => (
                  <Radar
                    key={c.iso3}
                    name={c.name_en}
                    dataKey={c.iso3}
                    stroke={RADAR_COLORS[i % RADAR_COLORS.length]}
                    fill={RADAR_COLORS[i % RADAR_COLORS.length]}
                    fillOpacity={0.12}
                    strokeWidth={2}
                    dot={{ r: 2, fillOpacity: 1 }}
                  />
                ))}
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(value: string) => (
                    <span style={{ color: "var(--color-content-primary)" }}>{value}</span>
                  )}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-abyss, #0a0a0a)",
                    border: "1px solid var(--color-blood, #cc0000)",
                    borderRadius: 0,
                    fontSize: 11,
                  }}
                  labelStyle={{ color: "var(--color-content-dim)" }}
                  formatter={(value) => [
                    value != null && typeof value === "number" && !Number.isNaN(value) ? value.toFixed(1) : "N/A",
                    "",
                  ]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[10px] text-content-dim mt-2">
            ▸ Composite scores for each country:{" "}
            {countries.map((c, i) => {
              const vuln = calculateVulnerability(c);
              return (
                <span key={c.iso3}>
                  {i > 0 && " · "}
                  <span style={{ color: RADAR_COLORS[i % RADAR_COLORS.length] }}>
                    {c.iso3}
                  </span>
                  {" "}
                  <span className="font-mono" style={{ color: scoreColor(vuln.composite) }}>
                    {vuln.composite.toFixed(0)}
                  </span>
                </span>
              );
            })}
          </div>
        </TerminalCard>
      )}

      {countries.length >= 2 && (
        <TerminalCard title="SIDE-BY-SIDE COMPARISON" accent="blood" glow>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-dim">
                  <th className="text-left py-2 px-2 text-content-dim uppercase sticky left-0 bg-abyss">Metric</th>
                  {countries.map((c) => (
                    <th key={c.iso3} className="text-right py-2 px-2 text-content-primary font-bold whitespace-nowrap">
                      {c.name_en}
                      <div className="text-[9px] text-content-dim font-mono">{c.iso3}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_METRICS.map((metric) => {
                  const values = countries.map((c) => metric.extract(c));
                  const { bestIdx, worstIdx } = metricWinner(metric, values);
                  return (
                    <tr key={metric.label} className="border-b border-border-dim/50 hover:bg-panel/40">
                      <td className="py-1.5 px-2 text-content-secondary sticky left-0 bg-abyss whitespace-nowrap">
                        {metric.label}
                        {metric.unit && <span className="text-content-dim ml-0.5">{metric.unit}</span>}
                      </td>
                      {values.map((v, i) => (
                        <td key={i} className="text-right py-1.5 px-2 font-mono">
                          <span
                            className={
                              i === bestIdx ? "text-terminal-green font-bold"
                              : i === worstIdx ? "text-blood-bright font-bold"
                              : "text-content-primary"
                            }
                          >
                            {fmt(v)}
                            {i === bestIdx && v !== null && <span className="text-[8px] ml-0.5">✓</span>}
                            {i === worstIdx && v !== null && values.filter((x) => x !== null).length > 1 && (
                              <span className="text-[8px] ml-0.5">✗</span>
                            )}
                          </span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex gap-4 mt-3 text-[10px]">
            <span className="text-terminal-green">✓ best value</span>
            <span className="text-blood-bright">✗ worst value</span>
          </div>
        </TerminalCard>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   3. REGIONAL ROLLUPS
   ═══════════════════════════════════════════════════════════════ */

function RegionalRollups() {
  const regions = useMemo(() => aggregateByRegion(data.countries), []);

  return (
    <div className="space-y-4">
      <TerminalCard title="REGIONAL AGGREGATION — POPULATION-WEIGHTED" accent="amber" glow>
        <p className="text-xs text-content-secondary mb-4">
          // every metric below is weighted by population across all countries in the region.
          ranked worst-first by undernourishment.
        </p>
        <div className="space-y-2">
          {regions.map((r) => (
            <div key={r.region} className="border border-border-dim bg-void p-3">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-content-primary">{r.region}</span>
                  <span className="text-[10px] text-content-dim">
                    {r.countries} countries · {(r.population / 1e6).toFixed(0)}M people
                  </span>
                </div>
                <div className="flex gap-1">
                  {r.hotspotCount > 0 && (
                    <StatusPill color="blood">{r.hotspotCount} hotspot{r.hotspotCount > 1 ? "s" : ""}</StatusPill>
                  )}
                  {r.conflictCountries > 0 && (
                    <StatusPill color="amber">{r.conflictCountries} in conflict</StatusPill>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {r.avgUndernourishment !== null && (
                  <div>
                    <span className="text-content-dim text-[10px] uppercase block">Undernourish</span>
                    <span className={r.avgUndernourishment > 15 ? "text-blood-bright font-bold" : "text-content-primary"}>
                      {r.avgUndernourishment.toFixed(1)}%
                    </span>
                  </div>
                )}
                {r.avgLifeExpectancy !== null && (
                  <div>
                    <span className="text-content-dim text-[10px] uppercase block">Life Exp</span>
                    <span className={r.avgLifeExpectancy < 65 ? "text-blood-bright" : "text-content-primary"}>
                      {r.avgLifeExpectancy.toFixed(1)}y
                    </span>
                  </div>
                )}
                {r.avgDoctors !== null && (
                  <div>
                    <span className="text-content-dim text-[10px] uppercase block">Doctors/1k</span>
                    <span className={r.avgDoctors < 2 ? "text-blood-bright font-bold" : "text-content-primary"}>
                      {r.avgDoctors.toFixed(2)}
                    </span>
                  </div>
                )}
                {r.avgLiteracy !== null && (
                  <div>
                    <span className="text-content-dim text-[10px] uppercase block">Literacy</span>
                    <span className={r.avgLiteracy < 70 ? "text-blood-bright" : "text-content-primary"}>
                      {r.avgLiteracy.toFixed(0)}%
                    </span>
                  </div>
                )}
                {r.avgGini !== null && (
                  <div>
                    <span className="text-content-dim text-[10px] uppercase block">Gini</span>
                    <span className={r.avgGini > 40 ? "text-warning-amber" : "text-content-primary"}>
                      {r.avgGini.toFixed(1)}
                    </span>
                  </div>
                )}
                {r.avgCpi !== null && (
                  <div>
                    <span className="text-content-dim text-[10px] uppercase block">CPI</span>
                    <span className={r.avgCpi < 40 ? "text-warning-amber" : "text-content-primary"}>
                      {r.avgCpi.toFixed(0)}
                    </span>
                  </div>
                )}
                {r.avgCo2 !== null && (
                  <div>
                    <span className="text-content-dim text-[10px] uppercase block">CO2/cap</span>
                    <span className={r.avgCo2 > 5 ? "text-warning-amber" : "text-content-primary"}>
                      {r.avgCo2.toFixed(2)}t
                    </span>
                  </div>
                )}
                {r.avgChildMortality !== null && (
                  <div>
                    <span className="text-content-dim text-[10px] uppercase block">Child Mort</span>
                    <span className={r.avgChildMortality > 30 ? "text-blood-bright font-bold" : "text-content-primary"}>
                      {r.avgChildMortality.toFixed(1)}/1k
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </TerminalCard>
    </div>
  );
}
