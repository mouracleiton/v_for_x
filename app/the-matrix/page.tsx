"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, CountryData } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import DataBar from "@/components/ui/DataBar";
import { sound } from "@/lib/sound";
import { formatNumber } from "@/lib/format";

const data = backbone as WorldBackbone;

/* ═══ DATA COMPLETENESS SCORING ═══
 * Walk every country's nested fields and count nulls vs total.
 */

interface FieldStat {
  path: string;
  nulls: number;
  total: number;
  pct: number;
}

interface CountryStat {
  iso3: string;
  name: string;
  region: string;
  nullCount: number;
  totalCount: number;
  completeness: number; // 0-100
}

const DIMENSION_FIELDS: { dim: string; label: string; fields: (c: CountryData) => (number | null)[] }[] = [
  { dim: "hunger", label: "Hunger", fields: (c) => [c.hunger.undernourishment_pct, c.hunger.child_stunting_pct, c.hunger.famine_risk_1to5, c.hunger.child_wasting_pct, c.hunger.anemia_prevalence_pct] },
  { dim: "conflict", label: "Conflict", fields: (c) => [c.conflict.intensity_1to5 as unknown as number, c.conflict.displacement_m, c.conflict.battle_deaths_total] },
  { dim: "health", label: "Health", fields: (c) => [c.health.life_expectancy, c.health.child_mortality_under5_per1k, c.health.maternal_mortality_per100k, c.health.expenditure_pct_gdp, c.health.doctors_per_1000 ?? null, c.health.hospital_beds_per_1000 ?? null] },
  { dim: "governance", label: "Governance", fields: (c) => [c.governance.corruption_perceptions_index, c.governance.electoral_democracy_index, c.governance.political_corruption_index] },
  { dim: "education", label: "Education", fields: (c) => [c.education.literacy_rate_pct, c.education.primary_enrollment_pct, c.education.secondary_enrollment_pct, c.education.pisa_score ?? null] },
  { dim: "economy", label: "Economy", fields: (c) => [c.economy.gdp_usd, c.economy.gdp_per_capita_usd] },
  { dim: "climate", label: "Climate", fields: (c) => [c.climate.co2_per_capita_t, c.climate.ghg_total_mt] },
  { dim: "environment", label: "Environment", fields: (c) => [c.environment.air_pollution_pm25_ugm3, c.environment.forest_area_pct, c.environment.renewable_energy_pct, c.environment.deforestation_km2 ?? null, c.environment.pesticide_use_tons ?? null] },
  { dim: "inequality", label: "Inequality", fields: (c) => [c.inequality.gini] },
  { dim: "water_sanitation", label: "Water", fields: (c) => [c.water_sanitation.basic_access_pct, c.water_sanitation.safe_sanitation_pct] },
  { dim: "migration", label: "Migration", fields: (c) => [c.migration.refugees_origin, c.migration.refugees_hosted, c.migration.forcibly_displaced, c.migration.net_migration] },
  { dim: "security", label: "Security", fields: (c) => [c.security.homicide_rate_per100k, c.security.femicides_per_year ?? null, c.security.prison_rate_per_100k ?? null] },
  { dim: "poverty", label: "Poverty", fields: (c) => [c.poverty.headcount_365_pct, c.poverty.headcount_685_pct] },
  { dim: "employment", label: "Employment", fields: (c) => [c.employment.unemployment_pct, c.employment.youth_unemployment_pct, c.employment.informality_pct ?? null, c.employment.child_labor_m ?? null] },
  { dim: "gender", label: "Gender", fields: (c) => [c.gender.women_parliament_pct, c.gender.female_labor_force_pct] },
  { dim: "energy", label: "Energy", fields: (c) => [c.energy?.renewable_electric_pct ?? null, c.energy?.no_access_electricity_m ?? null, c.energy?.solar_pct ?? null] },
  { dim: "justice", label: "Justice", fields: (c) => [c.justice?.prison_rate_per_100k ?? null, c.justice?.rule_of_law_index ?? null, c.justice?.pre_trial_pct ?? null] },
  { dim: "taxation", label: "Taxation", fields: (c) => [c.taxation?.tax_burden_pct_gdp ?? null, c.taxation?.consumption_tax_pct ?? null] },
  { dim: "food_security", label: "Food Security", fields: (c) => [c.food_security?.severe_food_insecurity_m ?? null, c.food_security?.min_wage_usd ?? null, c.food_security?.food_cost_affordability_ratio ?? null] },
];

function dimensionCompleteness(c: CountryData): Record<string, number> {
  const result: Record<string, number> = {};
  for (const { dim, fields } of DIMENSION_FIELDS) {
    const vals = fields(c);
    const nonNull = vals.filter((v) => v !== null && v !== undefined).length;
    result[dim] = vals.length > 0 ? (nonNull / vals.length) * 100 : 0;
  }
  return result;
}

type SortKey = "completeness" | "incomplete" | "name";

export default function TheMatrixPage() {
  const [sortKey, setSortKey] = useState<SortKey>("incomplete");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  // Compute per-country stats
  const countryStats = useMemo<CountryStat[]>(() => {
    return data.countries.map((c) => {
      let nullCount = 0;
      let totalCount = 0;
      for (const { fields } of DIMENSION_FIELDS) {
        const vals = fields(c);
        for (const v of vals) {
          totalCount++;
          if (v === null || v === undefined) nullCount++;
        }
      }
      return {
        iso3: c.iso3,
        name: c.name_en,
        region: c.region,
        nullCount,
        totalCount,
        completeness: totalCount > 0 ? ((totalCount - nullCount) / totalCount) * 100 : 0,
      };
    });
  }, []);

  // Per-field stats
  const fieldStats = useMemo<FieldStat[]>(() => {
    const stats: Record<string, { nulls: number; total: number }> = {};
    for (const { dim, fields } of DIMENSION_FIELDS) {
      for (const c of data.countries) {
        const vals = fields(c);
        const nonNull = vals.filter((v) => v !== null && v !== undefined).length;
        if (!stats[dim]) stats[dim] = { nulls: 0, total: 0 };
        stats[dim].total += vals.length;
        stats[dim].nulls += vals.length - nonNull;
      }
    }
    return Object.entries(stats)
      .map(([dim, s]) => ({
        path: DIMENSION_FIELDS.find((d) => d.dim === dim)?.label ?? dim,
        nulls: s.nulls,
        total: s.total,
        pct: s.total > 0 ? (s.nulls / s.total) * 100 : 0,
      }))
      .sort((a, b) => b.pct - a.pct);
  }, []);

  // Global aggregate
  const globalStats = useMemo(() => {
    const totalFields = countryStats.reduce((s, c) => s + c.totalCount, 0);
    const totalNulls = countryStats.reduce((s, c) => s + c.nullCount, 0);
    const avgCompleteness = countryStats.reduce((s, c) => s + c.completeness, 0) / countryStats.length;
    const fullyComplete = countryStats.filter((c) => c.completeness >= 95).length;
    const veryIncomplete = countryStats.filter((c) => c.completeness < 60).length;
    const regions = [...new Set(countryStats.map((c) => c.region))];
    return { totalFields, totalNulls, avgCompleteness, fullyComplete, veryIncomplete, totalCountries: countryStats.length, regions };
  }, [countryStats]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    let result = regionFilter === "all" ? [...countryStats] : countryStats.filter((c) => c.region === regionFilter);
    result.sort((a, b) => {
      if (sortKey === "completeness") return b.completeness - a.completeness;
      if (sortKey === "incomplete") return b.nullCount - a.nullCount;
      return a.name.localeCompare(b.name);
    });
    return result;
  }, [countryStats, regionFilter, sortKey]);

  const selectedCountryData = useMemo(() => {
    if (!selectedCountry) return null;
    const c = data.countries.find((x) => x.iso3 === selectedCountry);
    if (!c) return null;
    return { country: c, dims: dimensionCompleteness(c) };
  }, [selectedCountry]);

  function completenessColor(pct: number): string {
    if (pct >= 90) return "#00ff41";
    if (pct >= 70) return "#88cc00";
    if (pct >= 50) return "#ffaa00";
    if (pct >= 30) return "#ff6600";
    return "#cc0000";
  }

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[18] THE MATRIX</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood tracking-widest">
          THE MATRIX
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // {formatNumber(globalStats.totalNulls)} of {formatNumber(globalStats.totalFields)} data points are null.
          This is a map of what we don&apos;t know — and where the world&apos;s blind spots are.
        </p>
      </div>

      {/* Global stats */}
      <TerminalCard title="DATA INVENTORY" accent="blood" className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">AVG COMPLETENESS</div>
            <div className="text-3xl font-bold" style={{ color: completenessColor(globalStats.avgCompleteness) }}>
              {globalStats.avgCompleteness.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">NULL FIELDS</div>
            <div className="text-3xl text-blood-bright font-bold">{formatNumber(globalStats.totalNulls)}</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">FULLY COVERED</div>
            <div className="text-3xl text-terminal-green font-bold">{globalStats.fullyComplete}</div>
            <div className="text-[10px] text-content-dim">of {globalStats.totalCountries} countries ≥95%</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">SEVERE GAPS</div>
            <div className="text-3xl text-blood font-bold">{globalStats.veryIncomplete}</div>
            <div className="text-[10px] text-content-dim">countries &lt;60% complete</div>
          </div>
        </div>
        <div className="p-3 border border-border-dim bg-void text-xs text-content-secondary">
          <span className="text-blood-bright font-bold">⚠ Why this matters:</span> Every null field
          is a person or problem the international system has chosen not to measure. When we say
          &quot;X% of children are malnourished,&quot; the missing data often represents the most
          invisible, most vulnerable populations — those in conflict zones, under authoritarian regimes,
          or beyond census reach.
        </div>
      </TerminalCard>

      {/* Per-dimension completeness */}
      <TerminalCard title="BLIND SPOTS BY DIMENSION" accent="amber" className="mb-6">
        <p className="text-xs text-content-dim mb-3">
          // Which dimensions have the most missing data across all 200 countries?
        </p>
        <div className="space-y-2">
          {fieldStats.map((f) => (
            <div key={f.path} className="flex items-center gap-3">
              <span className="text-xs text-content-primary w-32 shrink-0">{f.path}</span>
              <div className="flex-1">
                <DataBar
                  value={100 - f.pct}
                  max={100}
                  label={`${f.nulls}/${f.total} null (${f.pct.toFixed(0)}% missing)`}
                  unit="%"
                />
              </div>
              <span
                className="text-xs font-bold w-12 text-right"
                style={{ color: completenessColor(100 - f.pct) }}
              >
                {(100 - f.pct).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </TerminalCard>

      {/* Country completeness explorer */}
      <TerminalCard title="COUNTRY COMPLETENESS // WHERE THE GAPS ARE" className="mb-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-content-dim uppercase tracking-widest">REGION:</span>
            <button
              onClick={() => { setRegionFilter("all"); sound.select(); }}
              className={`text-[10px] px-2 py-1 border ${regionFilter === "all" ? "border-blood text-blood-bright" : "border-border-dim text-content-secondary hover:border-blood"}`}
            >
              ALL
            </button>
            {globalStats.regions.map((r) => (
              <button
                key={r}
                onClick={() => { setRegionFilter(r); sound.select(); }}
                className={`text-[10px] px-2 py-1 border ${regionFilter === r ? "border-blood text-blood-bright" : "border-border-dim text-content-secondary hover:border-blood"}`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-content-dim uppercase tracking-widest">SORT:</span>
            {([
              { id: "incomplete", label: "MOST GAPS" },
              { id: "completeness", label: "BEST COVERED" },
              { id: "name", label: "A-Z" },
            ] as const).map((s) => (
              <button
                key={s.id}
                onClick={() => { setSortKey(s.id); sound.select(); }}
                className={`text-[10px] px-2 py-1 border ${sortKey === s.id ? "border-terminal-green text-terminal-green" : "border-border-dim text-content-secondary hover:border-terminal-green"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Country list — grid of completeness bars */}
        <div className="max-h-96 overflow-y-auto space-y-1 pr-2">
          {filtered.slice(0, 60).map((c) => (
            <button
              key={c.iso3}
              onClick={() => { setSelectedCountry(selectedCountry === c.iso3 ? null : c.iso3); sound.nav(); }}
              className={`w-full flex items-center gap-3 p-2 border transition-colors ${
                selectedCountry === c.iso3
                  ? "border-blood bg-blood/5"
                  : "border-border-dim hover:border-blood"
              }`}
            >
              <span className="text-xs font-bold text-content-secondary w-10">{c.iso3}</span>
              <span className="text-xs text-content-primary w-28 truncate">{c.name}</span>
              <div className="flex-1">
                <div className="h-2 bg-void relative overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${c.completeness}%`,
                      backgroundColor: completenessColor(c.completeness),
                    }}
                  />
                </div>
              </div>
              <span
                className="text-xs font-bold w-20 text-right"
                style={{ color: completenessColor(c.completeness) }}
              >
                {c.nullCount}/{c.totalCount}
              </span>
              <span
                className="text-xs font-bold w-12 text-right"
                style={{ color: completenessColor(c.completeness) }}
              >
                {c.completeness.toFixed(0)}%
              </span>
            </button>
          ))}
        </div>
        {filtered.length > 60 && (
          <div className="text-center text-[10px] text-content-dim mt-2">
            Showing 60 of {filtered.length}. Use region filter to narrow.
          </div>
        )}
      </TerminalCard>

      {/* Selected country dimension breakdown */}
      {selectedCountryData && (
        <TerminalCard
          title={`${selectedCountryData.country.name_en} (${selectedCountryData.country.iso3}) — DIMENSION BREAKDOWN`}
          accent="amber"
          className="mb-6"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(selectedCountryData.dims).map(([dim, pct]) => {
              const label = DIMENSION_FIELDS.find((d) => d.dim === dim)?.label ?? dim;
              return (
                <div key={dim} className="p-2 border border-border-dim bg-void">
                  <div className="text-[10px] text-content-dim uppercase">{label}</div>
                  <div
                    className="text-lg font-bold"
                    style={{ color: completenessColor(pct) }}
                  >
                    {pct.toFixed(0)}%
                  </div>
                  <div className="h-1 bg-abyss mt-1">
                    <div className="h-full" style={{ width: `${pct}%`, backgroundColor: completenessColor(pct) }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4">
            <Link
              href={`/sorrow-map/${selectedCountryData.country.iso3.toLowerCase()}/`}
              className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
            >
              ▶ FULL COUNTRY DOSSIER
            </Link>
          </div>
        </TerminalCard>
      )}

      {/* Source attribution */}
      <TerminalCard title="SOURCES & METHODOLOGY" className="mb-6">
        <div className="space-y-2 text-xs text-content-secondary">
          <p>
            <span className="text-content-dim">// {data.metadata.sources.length} primary sources · {data.metadata.total_countries} countries · CC0</span>
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {data.metadata.sources.slice(0, 12).map((src, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 border border-border-dim text-content-dim">
                {src}
              </span>
            ))}
          </div>
          <p className="mt-3 text-content-dim">
            Completeness is calculated per-country by counting non-null values across all tracked dimensions.
            Enriched dimensions (justice, energy, taxation, food_security) have inherently lower coverage
            because the underlying datasets (OECD, IRENA, etc.) do not publish for all 200 territories.
          </p>
        </div>
        <div className="mt-3">
          <Link href="/the-archive/" className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright">
            ▶ FULL SOURCE DOSSIER
          </Link>
        </div>
      </TerminalCard>
    </div>
  );
}
