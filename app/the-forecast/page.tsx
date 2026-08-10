"use client";

/**
 * V FOR X — The Forecast
 *
 * A transparent crisis-risk ranking of the world's most stressed
 * countries, built from the 10-factor weighted model in lib/risk-model.
 * Every weight, ceiling, and normalization is disclosed. This is a
 * heuristic scoring aid — not predictive AI.
 */

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, CountryData } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import {
  calculateRiskScore,
  forecastRisk,
  getTopAtRisk,
  RISK_FACTORS,
  METHODOLOGY_TEXT,
  type RiskLevel,
} from "@/lib/risk-model";
import { formatNumber } from "@/lib/format";

const data = backbone as WorldBackbone;

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

const LEVEL_META: Record<
  RiskLevel,
  { color: string; bg: string; label: string }
> = {
  low: { color: "#22d3a6", bg: "rgba(34,211,166,0.12)", label: "LOW" },
  moderate: { color: "#5b9cf6", bg: "rgba(91,156,246,0.12)", label: "MODERATE" },
  high: { color: "#f0a93b", bg: "rgba(240,169,59,0.12)", label: "HIGH" },
  severe: { color: "#e23856", bg: "rgba(226,56,86,0.14)", label: "SEVERE" },
  critical: { color: "#ff5c6c", bg: "rgba(255,92,108,0.16)", label: "CRITICAL" },
};

function levelColor(level: string): string {
  return (LEVEL_META[level as RiskLevel] ?? LEVEL_META.moderate).color;
}

/** Tiny inline sparkline from the conflict-death trajectory (older→newer). */
function Sparkline({ values }: { values: number[] }) {
  const vals = values.filter((v) => typeof v === "number" && v >= 0);
  if (vals.length < 2) return <span className="text-content-dim text-[10px]">—</span>;
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const range = max - min || 1;
  const w = 60;
  const h = 16;
  const step = w / (vals.length - 1);
  const pts = vals
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  const rising = vals[vals.length - 1] >= vals[vals.length - 2];
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline
        points={pts}
        fill="none"
        stroke={rising ? "#e23856" : "#22d3a6"}
        strokeWidth="1.5"
      />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════ */

export default function TheForecastPage() {
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [showMethodology, setShowMethodology] = useState(false);
  const [showTransparency, setShowTransparency] = useState(false);

  const top30 = useMemo(() => getTopAtRisk(data.countries, 30), []);
  const maxScore = top30[0]?.score || 100;

  // Risk distribution across ALL countries (for the chart).
  const distribution = useMemo(() => {
    const buckets: Record<RiskLevel, number> = {
      low: 0,
      moderate: 0,
      high: 0,
      severe: 0,
      critical: 0,
    };
    for (const c of data.countries) {
      const { level } = calculateRiskScore(c);
      buckets[level]++;
    }
    return (["low", "moderate", "high", "severe", "critical"] as RiskLevel[]).map((lvl) => ({
      level: LEVEL_META[lvl].label,
      count: buckets[lvl],
      fill: LEVEL_META[lvl].color,
    }));
  }, []);

  const selectedCountry = useMemo(
    () => data.countries.find((c) => c.iso3 === selectedIso) ?? null,
    [selectedIso],
  );

  const selectedScore = useMemo(
    () => (selectedCountry ? calculateRiskScore(selectedCountry) : null),
    [selectedCountry],
  );

  const selectedForecast = useMemo(
    () => (selectedCountry ? forecastRisk(selectedCountry) : null),
    [selectedCountry],
  );

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* ── Header ── */}
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-blood-bright glow-blood">
          The Forecast
        </h1>
        <p className="text-content-secondary mt-2 text-sm max-w-3xl">
          A transparent, weighted ranking of the world&apos;s most structurally stressed
          countries. 10 factors, fully disclosed weights, normalized 0–100. This is a
          heuristic model — not a prediction of future events.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setShowMethodology((s) => !s)}
            className="text-xs uppercase tracking-widest px-3 py-1.5 border border-border-dim text-content-secondary hover:text-command"
          >
            {showMethodology ? "▾" : "▸"} Methodology
          </button>
          <button
            onClick={() => setShowTransparency((s) => !s)}
            className="text-xs uppercase tracking-widest px-3 py-1.5 border border-border-dim text-content-secondary hover:text-command"
          >
            {showTransparency ? "▾" : "▸"} Open full transparency
          </button>
        </div>
      </header>

      {/* ── Methodology disclosure ── */}
      {showMethodology && (
        <TerminalCard title="methodology & limitations" accent="amber">
          <pre className="text-[11px] leading-relaxed text-content-secondary whitespace-pre-wrap">
            {METHODOLOGY_TEXT}
          </pre>
        </TerminalCard>
      )}

      {/* ── Full transparency: all weights + calculations ── */}
      {showTransparency && (
        <TerminalCard title="all weights & normalizations" accent="green">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-content-dim text-left border-b border-border-dim">
                  <th className="py-1 pr-3">Factor</th>
                  <th className="py-1 pr-3">Weight</th>
                  <th className="py-1 pr-3">Direction</th>
                  <th className="py-1 pr-3">Ceiling</th>
                  <th className="py-1">Description</th>
                </tr>
              </thead>
              <tbody>
                {RISK_FACTORS.map((f) => (
                  <tr key={f.key} className="border-b border-border-dim/50">
                    <td className="py-1.5 pr-3 text-content-primary">{f.label}</td>
                    <td className="py-1.5 pr-3 text-terminal-green">{f.weight}</td>
                    <td className="py-1.5 pr-3 text-content-secondary">{f.direction}</td>
                    <td className="py-1.5 pr-3 text-content-secondary">
                      {f.key === "inflation_rate"
                        ? "—"
                        : f.key === "conflict_intensity"
                          ? "5"
                          : f.key === "press_freedom"
                            ? "1"
                            : f.key === "child_mortality"
                              ? "150/1k"
                              : f.key === "refugees_and_idps"
                                ? "15M"
                                : f.key === "access_to_electricity"
                                  ? "80M"
                                  : f.key === "unemployment"
                                    ? "50%"
                                    : "100"}
                    </td>
                    <td className="py-1.5 text-content-dim">{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-content-dim mt-3">
            Score = (Σ normalized·weight) / (Σ weight of factors with data) × 100. Missing
            factors are skipped and weights re-normalized, so no country is penalised for
            data gaps.
          </p>
        </TerminalCard>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ═══ LEFT: Top-30 table ═══ */}
        <div className="lg:col-span-2 space-y-6">
          <TerminalCard title="top 30 at-risk countries" accent="blood">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-content-dim text-left border-b border-border-dim">
                    <th className="py-1 pr-2">#</th>
                    <th className="py-1 pr-2">Country</th>
                    <th className="py-1 pr-2">Score</th>
                    <th className="py-1 pr-2">Level</th>
                    <th className="py-1 pr-2">Top factor</th>
                    <th className="py-1">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {top30.map((row, i) => {
                    const isSel = row.iso3 === selectedIso;
                    return (
                      <tr
                        key={row.iso3}
                        onClick={() => setSelectedIso(isSel ? null : row.iso3)}
                        className="cursor-pointer border-b border-border-dim/40 hover:bg-panel-hi"
                        style={{ background: isSel ? "rgba(91,156,246,0.08)" : undefined }}
                      >
                        <td className="py-1.5 pr-2 text-content-dim">{i + 1}</td>
                        <td className="py-1.5 pr-2">
                          <span className="text-content-primary">{row.name}</span>{" "}
                          <span className="text-content-dim">{row.iso3}</span>
                        </td>
                        <td className="py-1.5 pr-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="font-bold tabular-nums"
                              style={{ color: levelColor(row.level) }}
                            >
                              {row.score.toFixed(1)}
                            </span>
                            <div
                              className="h-1.5 w-16 bg-void border border-border-dim"
                              style={{ minWidth: "4rem" }}
                            >
                              <div
                                className="h-full"
                                style={{
                                  width: `${(row.score / maxScore) * 100}%`,
                                  background: levelColor(row.level),
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-1.5 pr-2">
                          <span
                            className="inline-block px-1.5 py-0.5 text-[10px] uppercase border"
                            style={{
                              color: levelColor(row.level),
                              borderColor: levelColor(row.level),
                              background: LEVEL_META[row.level as RiskLevel]?.bg,
                            }}
                          >
                            {LEVEL_META[row.level as RiskLevel]?.label ?? row.level}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2 text-content-secondary">{row.topFactor}</td>
                        <td className="py-1.5">
                          <Sparkline
                            values={
                              data.countries.find((c) => c.iso3 === row.iso3)
                                ?.conflict
                                ? [
                                    data.countries.find((c) => c.iso3 === row.iso3)!.conflict.deaths_1,
                                    data.countries.find((c) => c.iso3 === row.iso3)!.conflict.deaths_2,
                                    data.countries.find((c) => c.iso3 === row.iso3)!.conflict.deaths_3,
                                    data.countries.find((c) => c.iso3 === row.iso3)!.conflict.deaths_4,
                                    data.countries.find((c) => c.iso3 === row.iso3)!.conflict.deaths_5,
                                  ]
                                : []
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-content-dim mt-2">
              Click a row for a full factor breakdown. Sparkline = conflict-death trajectory
              (5 yrs, older→newer).
            </p>
          </TerminalCard>
        </div>

        {/* ═══ RIGHT: distribution + detail ═══ */}
        <div className="space-y-6">
          {/* Distribution chart */}
          <TerminalCard title="risk distribution (all 200)" accent="green">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={distribution} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="level"
                  tick={{ fill: "#8da3c4", fontSize: 10 }}
                  axisLine={{ stroke: "#1a2a44" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#8da3c4", fontSize: 10 }}
                  axisLine={{ stroke: "#1a2a44" }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(91,156,246,0.08)" }}
                  contentStyle={{
                    background: "#0f1a2e",
                    border: "1px solid #2a4264",
                    fontSize: 12,
                    color: "#dfe7f5",
                  }}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {distribution.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </TerminalCard>

          {/* Country detail */}
          <TerminalCard title="factor breakdown" accent="blood">
            {!selectedCountry || !selectedScore ? (
              <p className="text-sm text-content-dim py-6 text-center">
                Select a country from the table to inspect its risk factors.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-content-primary font-bold">
                      {selectedCountry.name_en}{" "}
                      <span className="text-content-dim text-xs">{selectedCountry.iso3}</span>
                    </div>
                    <div className="text-content-dim text-xs">{selectedCountry.region}</div>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-2xl font-bold tabular-nums"
                      style={{ color: levelColor(selectedScore.level) }}
                    >
                      {selectedScore.score.toFixed(1)}
                    </div>
                    <StatusPill color={selectedScore.level === "low" || selectedScore.level === "moderate" ? "green" : selectedScore.level === "high" ? "amber" : "blood"}>
                      {LEVEL_META[selectedScore.level].label}
                    </StatusPill>
                  </div>
                </div>

                {selectedForecast && (
                  <div
                    className="text-xs p-2 border border-border-dim"
                    style={{
                      borderColor:
                        selectedForecast.trend === "deteriorating"
                          ? "var(--color-blood)"
                          : selectedForecast.trend === "improving"
                            ? "var(--color-terminal-green)"
                            : "var(--color-border-dim)",
                    }}
                  >
                    <span className="text-content-dim">Forecast:</span>{" "}
                    <span style={{ color: levelColor(selectedScore.level) }}>
                      {selectedForecast.currentScore.toFixed(1)} →{" "}
                      {selectedForecast.projectedScore.toFixed(1)}
                    </span>{" "}
                    <span
                      style={{
                        color:
                          selectedForecast.trend === "deteriorating"
                            ? "var(--color-blood-bright)"
                            : selectedForecast.trend === "improving"
                              ? "var(--color-terminal-green)"
                              : "var(--color-content-secondary)",
                      }}
                    >
                      {selectedForecast.trend.toUpperCase()}
                    </span>
                    <div className="text-content-dim mt-1 leading-relaxed">
                      {selectedForecast.rationale}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  {[...selectedScore.factors]
                    .sort((a, b) => b.contribution - a.contribution)
                    .map((f) => {
                      const totalContrib = selectedScore.factors.reduce(
                        (s, x) => s + x.contribution,
                        0,
                      ) || 1;
                      return (
                        <div key={f.key}>
                          <div className="flex justify-between text-xs">
                            <span className="text-content-secondary">{f.label}</span>
                            <span className="text-content-dim tabular-nums">
                              {formatNumber(f.value)} ·{" "}
                              <span style={{ color: levelColor(selectedScore.level) }}>
                                +{((f.contribution / totalContrib) * 100).toFixed(0)}%
                              </span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-void border border-border-dim">
                            <div
                              className="h-full"
                              style={{
                                width: `${(f.normalized * 100).toFixed(0)}%`,
                                background: levelColor(selectedScore.level),
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </TerminalCard>
        </div>
      </div>
    </div>
  );
}
