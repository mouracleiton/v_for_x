"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/stores/useStore";
import { tc } from "@/lib/i18n-content";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, CountryData } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import DataBar from "@/components/ui/DataBar";
import { sound } from "@/lib/sound";
import { formatNumber, formatPct } from "@/lib/format";
import { calculateVulnerability, scoreColor, scoreLabel } from "@/lib/vulnerability";
import {
  getEjatlasSummary,
  getTopConflictCountries,
  getGlobalCategories,
} from "@/lib/ejatlas";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { DOMAIN_WEIGHTS } from "@/lib/vulnerability";

const data = backbone as WorldBackbone;

interface RegionData {
  name: string;
  countries: CountryData[];
  count: number;
  totalPop: number;
  hotspotCount: number;
  conflictCount: number;
  avgVulnerability: number;
  topCrises: { iso3: string; name: string; score: number }[];
  domainAverages: Record<string, number>;
  refugeesOrigin: number;
  refugeesHosted: number;
  displaced: number;
  undernourished: number;
}

function buildRegionData(countries: CountryData[]): RegionData[] {
  const groups: Record<string, CountryData[]> = {};
  for (const c of countries) {
    if (!groups[c.region]) groups[c.region] = [];
    groups[c.region].push(c);
  }
  return Object.entries(groups).map(([name, cs]) => {
    const vulnerabilityResults = cs.map((c) => calculateVulnerability(c));
    const avgVuln = vulnerabilityResults.reduce((s, r) => s + r.composite, 0) / vulnerabilityResults.length;

    // Domain averages across all countries in region
    const domainAverages: Record<string, number> = {};
    for (const dw of DOMAIN_WEIGHTS) {
      const scores = vulnerabilityResults
        .map((r) => r.domains.find((d) => d.domain === dw.domain))
        .filter((d) => d && d.hasData && !Number.isNaN(d.score));
      domainAverages[dw.domain] = scores.length > 0
        ? scores.reduce((s, d) => s + (d as { score: number }).score, 0) / scores.length
        : 0;
    }

    const topCrises = cs
      .map((c) => ({ iso3: c.iso3, name: c.name_en, score: calculateVulnerability(c).composite }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      name,
      countries: cs,
      count: cs.length,
      totalPop: cs.reduce((s, c) => s + c.population_m, 0),
      hotspotCount: cs.filter((c) => c.is_hotspot).length,
      conflictCount: cs.filter((c) => c.conflict.intensity_1to5 >= 3).length,
      avgVulnerability: avgVuln,
      topCrises,
      domainAverages,
      refugeesOrigin: cs.reduce((s, c) => s + (c.migration.refugees_origin ?? 0), 0),
      refugeesHosted: cs.reduce((s, c) => s + (c.migration.refugees_hosted ?? 0), 0),
      displaced: cs.reduce((s, c) => s + (c.migration.forcibly_displaced ?? 0), 0),
      undernourished: cs.reduce((s, c) => s + ((c.population_m || 0) * (c.hunger.undernourishment_pct ?? 0) / 100), 0),
    };
  }).sort((a, b) => b.avgVulnerability - a.avgVulnerability);
}

export default function TheFrontsPage() {
  const { lang } = useStore();
  const regions = useMemo(() => buildRegionData(data.countries), []);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(regions[0]?.name ?? null);

  const region = useMemo(
    () => regions.find((r) => r.name === selectedRegion) ?? regions[0],
    [regions, selectedRegion]
  );

  // Radar data for selected region
  const radarData = useMemo(() => {
    if (!region) return [];
    return DOMAIN_WEIGHTS.map((dw) => ({
      domain: dw.label,
      score: Math.round(region.domainAverages[dw.domain] || 0),
    }));
  }, [region]);

  // All-regions comparison radar
  const comparisonData = useMemo(() => {
    return DOMAIN_WEIGHTS.map((dw) => {
      const row: Record<string, number | string> = { domain: dw.label.split(" ")[0] };
      for (const r of regions) {
        row[r.name] = Math.round(r.domainAverages[dw.domain] || 0);
      }
      return row;
    });
  }, [regions]);

  const regionColors: Record<string, string> = {
    Africa: "var(--color-blood)",
    Asia: "#ff6600",
    Americas: "#00ddff",
    Europe: "var(--color-terminal-green)",
    Oceania: "#aa44ff",
  };

  if (!region) return null;

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">{tc(lang, "fronts.tag")}</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood tracking-widest">
          {tc(lang, "fronts.title")}
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          {tc(lang, "fronts.subtitle_extra")}
        </p>
      </div>

      {/* Region selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {regions.map((r) => {
          const active = selectedRegion === r.name;
          const color = regionColors[r.name] ?? "#888";
          return (
            <button
              key={r.name}
              onClick={() => { setSelectedRegion(r.name); sound.nav(); }}
              className={`px-3 py-2 border text-xs font-bold transition-all ${
                active ? "bg-panel" : ""
              }`}
              style={{
                borderColor: active ? color : "var(--color-border-dim)",
                color: active ? color : "var(--color-content-secondary)",
              }}
            >
              {r.name.toUpperCase()}
              <span className="ml-2 text-[9px] opacity-70">({r.count})</span>
            </button>
          );
        })}
      </div>

      {/* Selected region overview */}
      <TerminalCard
        key={region.name}
        title={`${region.name.toUpperCase()} // ${region.count} ${tc(lang, "fronts.countries")} · ${formatNumber(region.totalPop)}M ${tc(lang, "act.people_word")}`}
        accent="blood"
        glow
        className="mb-6"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">{tc(lang, "fronts.avg_vulnerability")}</div>
            <div className="text-3xl font-bold" style={{ color: scoreColor(region.avgVulnerability) }}>
              {region.avgVulnerability.toFixed(1)}
            </div>
            <div className="text-[10px]" style={{ color: scoreColor(region.avgVulnerability) }}>
              {scoreLabel(region.avgVulnerability)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">{tc(lang, "fronts.hotspots")}</div>
            <div className="text-3xl text-blood-bright font-bold">{region.hotspotCount}</div>
            <div className="text-[10px] text-content-dim">{tc(lang, "fronts.of")} {data.hotspots.all.length} {tc(lang, "fronts.worldwide")}</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">{tc(lang, "fronts.conflict_zones")}</div>
            <div className="text-3xl text-blood font-bold">{region.conflictCount}</div>
            <div className="text-[10px] text-content-dim">{tc(lang, "fronts.intensity_3_5")}</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">{tc(lang, "fronts.displaced")}</div>
            <div className="text-3xl text-content-primary font-bold">{formatNumber(region.displaced)}</div>
            <div className="text-[10px] text-content-dim">{tc(lang, "fronts.forcibly_displaced")}</div>
          </div>
        </div>

        {/* Sub-stats */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="p-2 border border-border-dim bg-void">
            <span className="text-content-dim">{tc(lang, "fronts.undernourished_label")}:</span>{" "}
            <span className="text-blood-bright font-bold">{formatNumber(region.undernourished)}M</span>
            {" "}({((region.undernourished / region.totalPop) * 100).toFixed(1)}% of population)
          </div>
          <div className="p-2 border border-border-dim bg-void">
            <span className="text-content-dim">{tc(lang, "fronts.refugee_burden")}:</span>{" "}
            <span className="text-terminal-green font-bold">{tc(lang, "fronts.hosts")} {formatNumber(region.refugeesHosted)}</span>
            {" · "}
            <span className="text-blood-bright font-bold">{tc(lang, "fronts.produces")} {formatNumber(region.refugeesOrigin)}</span>
          </div>
        </div>
      </TerminalCard>

      {/* Two-column: radar + top crises */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Region vulnerability radar */}
        <TerminalCard title={`${region.name.toUpperCase()} — ${tc(lang, "fronts.vulnerability_profile")}`}>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <RadarChart data={radarData} outerRadius="70%">
                <PolarGrid stroke="#333" />
                <PolarAngleAxis dataKey="domain" tick={{ fill: "#999", fontSize: 9 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#555", fontSize: 8 }} angle={90} />
                <Radar
                  name={region.name}
                  dataKey="score"
                  stroke={regionColors[region.name] ?? "var(--color-blood-bright)"}
                  fill={regionColors[region.name] ?? "var(--color-blood-bright)"}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={{ background: "var(--color-abyss)", border: "1px solid #444", fontSize: "11px" }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </TerminalCard>

        {/* Top crises in region */}
        <TerminalCard title={`${tc(lang, "fronts.worst_crises_in")} ${region.name.toUpperCase()}`} accent="blood">
          <div className="space-y-2">
            {region.topCrises.map((c, i) => (
              <Link
                key={c.iso3}
                href={`/sorrow-map/${c.iso3.toLowerCase()}/`}
                className="flex items-center gap-3 p-2 terminal-card hover:border-blood transition-colors block"
              >
                <span className="text-blood-dim font-bold text-xs w-6">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-content-primary truncate">{c.name}</span>
                  <span className="text-[10px] text-content-dim ml-2">{c.iso3}</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold" style={{ color: scoreColor(c.score) }}>
                    {c.score.toFixed(1)}
                  </div>
                  <div className="text-[9px]" style={{ color: scoreColor(c.score) }}>
                    {scoreLabel(c.score)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </TerminalCard>
      </div>

      {/* All countries in region */}
      <TerminalCard title={`${tc(lang, "fronts.all_countries_in")} ${region.name.toUpperCase()} (${region.count})`} className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-dim text-content-dim text-[10px] uppercase tracking-widest">
                <th className="text-left p-2">{tc(lang, "fronts.th_country")}</th>
                <th className="text-right p-2">{tc(lang, "fronts.th_vulnerability")}</th>
                <th className="text-right p-2">{tc(lang, "fronts.th_undernourish")}</th>
                <th className="text-right p-2">{tc(lang, "fronts.th_conflict")}</th>
                <th className="text-right p-2">{tc(lang, "fronts.th_gdp_cap")}</th>
                <th className="text-right p-2">{tc(lang, "fronts.th_homicide")}</th>
                <th className="text-left p-2">{tc(lang, "fronts.th_status")}</th>
              </tr>
            </thead>
            <tbody>
              {[...region.countries]
                .sort((a, b) => calculateVulnerability(b).composite - calculateVulnerability(a).composite)
                .map((c) => {
                  const vuln = calculateVulnerability(c);
                  return (
                    <tr key={c.iso3} className="border-b border-border-dim hover:bg-panel/50">
                      <td className="p-2">
                        <Link href={`/sorrow-map/${c.iso3.toLowerCase()}/`} className="text-content-primary font-bold hover:text-blood-bright">
                          {c.name_en}
                        </Link>
                      </td>
                      <td className="p-2 text-right">
                        <span className="font-bold" style={{ color: scoreColor(vuln.composite) }}>
                          {vuln.composite.toFixed(0)}
                        </span>
                      </td>
                      <td className="p-2 text-right text-content-secondary">
                        {c.hunger.undernourishment_pct !== null ? `${c.hunger.undernourishment_pct.toFixed(1)}%` : "—"}
                      </td>
                      <td className="p-2 text-right">
                        <span style={{ color: c.conflict.intensity_1to5 >= 3 ? "var(--color-blood-bright)" : "#666" }}>
                          {c.conflict.intensity_1to5}/5
                        </span>
                      </td>
                      <td className="p-2 text-right text-content-secondary">
                        {c.economy.gdp_per_capita_usd !== null ? `$${formatNumber(c.economy.gdp_per_capita_usd)}` : "—"}
                      </td>
                      <td className="p-2 text-right text-content-secondary">
                        {c.security.homicide_rate_per100k !== null ? c.security.homicide_rate_per100k.toFixed(1) : "—"}
                      </td>
                      <td className="p-2">
                        {c.is_hotspot && <StatusPill color="blood">{tc(lang, "act.hotspot")}</StatusPill>}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </TerminalCard>

      {/* Cross-region comparison */}
      <TerminalCard title={tc(lang, "fronts.regional_comparison")} accent="amber" className="mb-6">
        <p className="text-xs text-content-dim mb-3">
          {tc(lang, "fronts.comparison_desc")}
        </p>
        <div style={{ width: "100%", height: 380 }}>
          <ResponsiveContainer>
            <RadarChart data={comparisonData} outerRadius="68%">
              <PolarGrid stroke="#333" />
              <PolarAngleAxis dataKey="domain" tick={{ fill: "#999", fontSize: 9 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#555", fontSize: 8 }} angle={90} />
              {regions.map((r) => (
                <Radar
                  key={r.name}
                  name={r.name}
                  dataKey={r.name}
                  stroke={regionColors[r.name] ?? "#888"}
                  fill={regionColors[r.name] ?? "#888"}
                  fillOpacity={0.03}
                  strokeWidth={2}
                />
              ))}
              <Tooltip
                contentStyle={{ background: "var(--color-abyss)", border: "1px solid #444", fontSize: "11px" }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        {/* Region legend */}
        <div className="flex flex-wrap gap-4 mt-3">
          {regions.map((r) => (
            <button
              key={r.name}
              onClick={() => { setSelectedRegion(r.name); sound.nav(); }}
              className="flex items-center gap-2 text-[10px] hover:underline"
            >
              <span className="inline-block w-3 h-3" style={{ backgroundColor: regionColors[r.name] ?? "#888" }} />
              <span style={{ color: regionColors[r.name] ?? "#888" }}>{r.name}</span>
              <span className="text-content-dim">{tc(lang, "fronts.avg")} {r.avgVulnerability.toFixed(0)}</span>
            </button>
          ))}
        </div>
      </TerminalCard>

      {/* ═══ ENVIRONMENTAL CONFLICT FRONT (EJAtlas) ═══ */}
      <EjatlasSection />

      {/* Cross-links */}
      <div className="flex flex-wrap gap-2">
        <Link href="/the-index/" className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright">
          {tc(lang, "fronts.link_index")}
        </Link>
        <Link href="/the-exodus/" className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright">
          {tc(lang, "fronts.link_exodus")}
        </Link>
        <Link href="/sorrow-map/" className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright">
          {tc(lang, "fronts.link_map")}
        </Link>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ENVIRONMENTAL CONFLICT FRONT (EJAtlas)
   Global socio-environmental conflicts from ejatlas.org
   ═══════════════════════════════════════════════════════════════ */

function shortCatName(name: string): string {
  return name.replace(/\(.*\)/, "").replace(/&.*/, "").trim();
}

function EjatlasSection() {
  const { lang } = useStore();
  const eja = useMemo(() => getEjatlasSummary(), []);
  const topCountries = useMemo(() => getTopConflictCountries(15), []);
  const categories = useMemo(() => getGlobalCategories(), []);
  const [view, setView] = useState<"countries" | "categories" | "companies">("countries");

  const maxCat = Math.max(...categories.map((c) => c.count));
  const stopped = eja.summary.by_status.find((s) => s.name === "stopped")?.count ?? 0;
  const pctStopped = ((stopped / eja.metadata.total_conflicts) * 100).toFixed(0);

  return (
    <TerminalCard
      title={`ENVIRONMENTAL CONFLICT FRONT // ${formatNumber(eja.metadata.total_conflicts)} CASES`}
      accent="green"
      glow
      className="mb-6"
    >
      <div className="space-y-4">
        {/* Attribution */}
        <div className="text-[10px] text-content-dim border-b border-border-dim pb-2">
          Data:{" "}
          <a href="https://ejatlas.org" target="_blank" rel="noopener noreferrer" className="text-terminal-green hover:underline">
            EJAtlas
          </a>{" "}
          — Global Atlas of Environmental Justice · ICTA-UAB · CC BY-NC-SA 3.0 · {eja.metadata.total_countries} countries · {formatNumber(eja.metadata.total_companies)} companies
        </div>

        {/* Headline stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">Total Conflicts</div>
            <div className="text-3xl text-blood-bright font-bold">{formatNumber(eja.metadata.total_conflicts)}</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">Countries</div>
            <div className="text-3xl text-content-primary font-bold">{eja.metadata.total_countries}</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">Companies Named</div>
            <div className="text-3xl text-warning-amber font-bold">{formatNumber(eja.metadata.total_companies)}</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">Stopped / Suspended</div>
            <div className="text-3xl text-terminal-green font-bold">{formatNumber(stopped)}</div>
            <div className="text-[10px] text-terminal-green">{pctStopped}% success rate</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">High Intensity</div>
            <div className="text-3xl text-blood font-bold">
              {eja.summary.by_intensity.find((i) => i.name === "high")?.count ?? 0}
            </div>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex gap-1">
          {([
            ["countries", "TOP COUNTRIES"],
            ["categories", "CONFLICT TYPES"],
            ["companies", "TOP COMPANIES"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setView(key); sound.nav(); }}
              className={`px-3 py-1 text-[10px] font-bold border transition-colors ${
                view === key
                  ? "border-terminal-green text-terminal-green bg-terminal-green/5"
                  : "border-border-dim text-content-dim hover:text-content-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* View content */}
        {view === "countries" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {topCountries.map((c, i) => {
              const country = data.countries.find((co) => co.iso3 === c.iso3);
              const name = country?.name_en ?? c.iso3;
              const stoppedPct = c.total > 0 ? (c.stopped / c.total) * 100 : 0;
              return (
                <Link
                  key={c.iso3}
                  href={`/sorrow-map/${c.iso3.toLowerCase()}/`}
                  className="flex items-center gap-2 p-2 border border-border-dim hover:border-blood transition-colors group"
                >
                  <span className="text-content-dim font-bold text-xs w-6">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-content-primary font-bold group-hover:text-blood-bright truncate">{name}</div>
                    <div className="text-[9px] text-content-dim">
                      {c.total} conflicts · {c.high_severity} high · {stoppedPct.toFixed(0)}% stopped
                    </div>
                  </div>
                  <span className="text-lg font-bold text-blood-bright">{c.total}</span>
                </Link>
              );
            })}
          </div>
        )}

        {view === "categories" && (
          <div className="space-y-1.5">
            {categories.map((cat) => (
              <div key={cat.name} className="flex items-center gap-2 text-xs">
                <span className="text-content-secondary flex-1 truncate" title={cat.name}>
                  {shortCatName(cat.name)}
                </span>
                <div className="w-32 h-3 bg-void border border-border-dim flex-shrink-0">
                  <div
                    className="h-full bg-blood/60"
                    style={{ width: `${(cat.count / maxCat) * 100}%` }}
                  />
                </div>
                <span className="text-content-dim w-8 text-right">{cat.count}</span>
              </div>
            ))}
          </div>
        )}

        {view === "companies" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
            {eja.summary.top_companies.map((c, i) => (
              <div key={c.name} className="flex items-center gap-2 p-1.5 text-xs border border-border-dim bg-void/50">
                <span className="text-content-dim w-4 text-right">{i + 1}.</span>
                <span className="text-content-secondary flex-1 truncate" title={c.name}>{c.name}</span>
                <span className="text-blood-bright font-bold">{c.count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Status breakdown */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border-dim">
          {eja.summary.by_status.filter((s) => s.name && s.name !== "unknown").map((s) => (
            <StatusPill
              key={s.name}
              color={s.name === "stopped" ? "green" : s.name === "in operation" ? "blood" : "dim"}
            >
              {s.name === "in operation" ? "ACTIVE" : s.name === "stopped" ? "STOPPED" : s.name.toUpperCase().slice(0, 12)}: {s.count}
            </StatusPill>
          ))}
        </div>
      </div>
    </TerminalCard>
  );
}
