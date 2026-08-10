"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import {
  buildRanking,
  searchProfiles,
  classifyRisk,
  riskColor,
  riskLabel,
  exportRankingCSV,
  CORRUPTION_INDICATORS,
  type CorruptionIndicator,
  type CorruptionRiskLevel,
} from "@/lib/corruption-radar";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
} from "recharts";

const data = backbone as WorldBackbone;

export default function TheRadarPage() {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("all");
  const [riskFilter, setRiskFilter] = useState<CorruptionRiskLevel | "all">("all");
  const [selectedIndicator, setSelectedIndicator] = useState<CorruptionIndicator>("wgi_composite");
  const [sortKey, setSortKey] = useState<CorruptionIndicator>("wgi_composite");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const ranking = useMemo(() => buildRanking(data), []);
  const regions = useMemo(
    () => Array.from(new Set(data.countries.map((c) => c.region))).sort(),
    [],
  );

  const filtered = useMemo(
    () =>
      searchProfiles(ranking, {
        query: query.trim() || undefined,
        region: region !== "all" ? region : undefined,
        riskLevel: riskFilter !== "all" ? riskFilter : undefined,
      }),
    [ranking, query, region, riskFilter],
  );

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a.indicators[sortKey] ?? -1;
      const bv = b.indicators[sortKey] ?? -1;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const handleSort = useCallback(
    (key: CorruptionIndicator) => {
      if (key === sortKey) {
        setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
      sound.nav();
    },
    [sortKey],
  );

  const handleExport = useCallback(() => {
    const csv = exportRankingCSV(ranking);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "corruption-radar-database.csv";
    a.click();
    URL.revokeObjectURL(url);
    sound.success();
  }, [ranking]);

  // Top 10 most/least corrupt for bar chart
  const top10 = useMemo(
    () =>
      ranking.profiles
        .filter((p) => p.compositeScore !== null)
        .slice(0, 10)
        .map((p) => ({ name: p.iso3, score: p.compositeScore })),
    [ranking],
  );

  const bottom10 = useMemo(
    () =>
      [...ranking.profiles]
        .filter((p) => p.compositeScore !== null)
        .slice(-10)
        .reverse()
        .map((p) => ({ name: p.iso3, score: p.compositeScore })),
    [ranking],
  );

  // Radar data for average by risk level
  const radarData = useMemo(
    () =>
      CORRUPTION_INDICATORS.filter((i) => i.id !== "wgi_composite").map((ind) => {
        const vals = ranking.profiles
          .filter((p) => p.indicators[ind.id] != null)
          .map((p) => p.indicators[ind.id]!);
        const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        return { indicator: ind.shortLabel, global: Math.round(avg * 10) / 10 };
      }),
    [ranking],
  );

  const indicatorDef = CORRUPTION_INDICATORS.find((i) => i.id === selectedIndicator)!;

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">
        📡 THE RADAR
      </h1>
      <p className="text-content-secondary text-sm mb-6">
        // corruption database — {ranking.totalRanked} countries ranked across {CORRUPTION_INDICATORS.length - 1} governance dimensions
      </p>

      {/* Summary stats */}
      <TerminalCard title="GLOBAL OVERVIEW" accent={ranking.byRiskLevel.severe > 0 ? "blood" : "green"} glow={ranking.byRiskLevel.severe > 10}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold text-content-primary">{ranking.totalRanked}</div>
            <div className="text-xs text-content-dim">COUNTRIES RANKED</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-terminal-green">{ranking.byRiskLevel.low}</div>
            <div className="text-xs text-content-dim">LOW RISK</div>
          </div>
          <div>
            <div className="text-3xl font-bold" style={{ color: riskColor("high") }}>{ranking.byRiskLevel.high}</div>
            <div className="text-xs text-content-dim">HIGH RISK</div>
          </div>
          <div>
            <div className="text-3xl font-bold" style={{ color: riskColor("severe") }}>{ranking.byRiskLevel.severe}</div>
            <div className="text-xs text-content-dim">SEVERE</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 justify-center">
          {ranking.byRegion.map((r) => (
            <span
              key={r.region}
              className="text-[10px] px-2 py-0.5 border border-border-dim text-content-secondary"
              style={{
                borderColor: r.averageScore < 30 ? riskColor("severe") : r.averageScore < 50 ? riskColor("high") : "var(--color-border-dim)",
                color: r.averageScore < 30 ? riskColor("severe") : r.averageScore < 50 ? riskColor("high") : "var(--color-content-secondary)",
              }}
            >
              {r.region}: {r.averageScore}
            </span>
          ))}
        </div>
      </TerminalCard>

      {/* Charts */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TerminalCard title="TOP 10 — CLEANEST GOVERNANCE" accent="green">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={top10} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis type="number" domain={[0, 100]} stroke="#666" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" stroke="#666" tick={{ fontSize: 10 }} width={40} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0a0a0a", border: "1px solid #ff3344", fontSize: 12 }}
              />
              <Bar dataKey="score" fill="#22d3a6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </TerminalCard>

        <TerminalCard title="BOTTOM 10 — MOST CORRUPT" accent="blood">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={bottom10} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis type="number" domain={[0, 100]} stroke="#666" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" stroke="#666" tick={{ fontSize: 10 }} width={40} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0a0a0a", border: "1px solid #ff3344", fontSize: 12 }}
              />
              <Bar dataKey="score" fill="#cc0000" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </TerminalCard>
      </div>

      {/* Governance dimensions radar */}
      <div className="mt-4">
        <TerminalCard title="GOVERNANCE DIMENSIONS — GLOBAL AVERAGE" accent="amber">
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#333" />
              <PolarAngleAxis dataKey="indicator" stroke="#888" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis domain={[0, 100]} stroke="#444" tick={{ fontSize: 8 }} />
              <Radar name="Global Average" dataKey="global" stroke="#ff3344" fill="#ff3344" fillOpacity={0.3} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </RadarChart>
          </ResponsiveContainer>
        </TerminalCard>
      </div>

      {/* Controls */}
      <div className="mt-4">
        <TerminalCard title="DATABASE EXPLORER" accent="blood">
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search countries…"
              className="flex-1 min-w-[150px] bg-abyss border border-border-dim text-content-primary text-sm p-2"
            />
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="bg-abyss border border-border-dim text-content-primary text-sm p-2"
            >
              <option value="all">All Regions</option>
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as CorruptionRiskLevel | "all")}
              className="bg-abyss border border-border-dim text-content-primary text-sm p-2"
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
              <option value="severe">Severe</option>
            </select>
            <button
              onClick={handleExport}
              className="px-3 py-2 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green text-xs"
            >
              ⬇ CSV EXPORT
            </button>
          </div>

          {/* Sortable table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-dim text-content-dim">
                  <th className="text-left p-2 cursor-pointer hover:text-blood-bright" onClick={() => handleSort("wgi_composite")}>
                    Rank {sortKey === "wgi_composite" && (sortDir === "desc" ? "↓" : "↑")}
                  </th>
                  <th className="text-left p-2">Country</th>
                  <th className="text-left p-2">ISO</th>
                  <th className="text-left p-2">Region</th>
                  <th className="text-right p-2 cursor-pointer hover:text-blood-bright" onClick={() => handleSort("wgi_composite")}>
                    Composite {sortKey === "wgi_composite" && (sortDir === "desc" ? "↓" : "↑")}
                  </th>
                  <th className="text-right p-2 cursor-pointer hover:text-blood-bright" onClick={() => handleSort("control_of_corruption")}>
                    Corr. {sortKey === "control_of_corruption" && (sortDir === "desc" ? "↓" : "↑")}
                  </th>
                  <th className="text-right p-2 cursor-pointer hover:text-blood-bright" onClick={() => handleSort("government_effectiveness")}>
                    Effect. {sortKey === "government_effectiveness" && (sortDir === "desc" ? "↓" : "↑")}
                  </th>
                  <th className="text-right p-2 cursor-pointer hover:text-blood-bright" onClick={() => handleSort("rule_of_law")}>
                    Law {sortKey === "rule_of_law" && (sortDir === "desc" ? "↓" : "↑")}
                  </th>
                  <th className="text-center p-2">Risk</th>
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 50).map((p) => (
                  <tr
                    key={p.iso3}
                    className="border-b border-border-dim/50 hover:bg-panel-hi"
                  >
                    <td className="p-2 text-content-dim">#{p.rank}</td>
                    <td className="p-2">
                      <Link
                        href={`/sorrow-map/${p.iso3.toLowerCase()}/`}
                        className="text-content-primary hover:text-blood-bright"
                        onClick={() => sound.nav()}
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="p-2 text-content-dim font-mono">{p.iso3}</td>
                    <td className="p-2 text-content-dim">{p.region}</td>
                    <td className="p-2 text-right font-bold" style={{ color: p.compositeScore != null ? riskColor(classifyRisk(p.compositeScore)) : "var(--color-content-dim)" }}>
                      {p.compositeScore ?? "—"}
                    </td>
                    <td className="p-2 text-right text-content-secondary">{p.indicators.control_of_corruption ?? "—"}</td>
                    <td className="p-2 text-right text-content-secondary">{p.indicators.government_effectiveness ?? "—"}</td>
                    <td className="p-2 text-right text-content-secondary">{p.indicators.rule_of_law ?? "—"}</td>
                    <td className="p-2 text-center">
                      <span
                        className="text-[9px] px-1.5 py-0.5 border"
                        style={{
                          borderColor: riskColor(p.riskLevel),
                          color: riskColor(p.riskLevel),
                        }}
                      >
                        {p.riskLevel.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sorted.length > 50 && (
            <div className="mt-2 text-center text-[10px] text-content-dim">
              Showing 50 of {sorted.length} results — use search to filter
            </div>
          )}
        </TerminalCard>
      </div>

      {/* Indicator selector */}
      <div className="mt-4">
        <TerminalCard title="INDICATOR DETAIL" accent="amber">
          <p className="text-xs text-content-dim mb-2">{indicatorDef.description}</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {CORRUPTION_INDICATORS.map((ind) => (
              <button
                key={ind.id}
                onClick={() => {
                  setSelectedIndicator(ind.id);
                  sound.select();
                }}
                className={`text-[10px] px-2 py-1 border ${
                  selectedIndicator === ind.id
                    ? "border-blood text-blood-bright bg-blood/10"
                    : "border-border-dim text-content-secondary hover:border-blood"
                }`}
              >
                {ind.shortLabel}
              </button>
            ))}
          </div>
          <div className="text-xs text-content-secondary">
            Scale: {indicatorDef.scale} · Direction: higher = {indicatorDef.direction === "higher_better" ? "cleaner" : "more corrupt"}
          </div>
        </TerminalCard>
      </div>

      <div className="mt-6 text-center text-[10px] text-content-dim">
        Powered by World Bank Worldwide Governance Indicators · 6 dimensions · Transparent methodology · CC0
      </div>
    </div>
  );
}
