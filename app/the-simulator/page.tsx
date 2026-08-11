"use client";

import { useMemo, useState } from "react";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import { formatMoney } from "@/lib/format";
import {
  simulateScenario,
  getCountryScenarios,
  metricImproved,
  type ScenarioConfig,
} from "@/lib/scenario-engine";
import { runMonteCarlo, formatMonteCarloReport } from "@/lib/monte-carlo";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const wb = backbone as WorldBackbone;

/* ── Country list (alphabetical) ── */
const COUNTRIES = [...wb.countries].sort((a, b) =>
  a.name_en.localeCompare(b.name_en)
);

const DEFAULT_CONFIG: ScenarioConfig = {
  militaryReduction: 35,
  healthIncrease: 40,
  educationBoost: 45,
  foodAidAmount: 15,
  conflictResolution: true,
  climateActionPct: 50,
};

/* ── Slider definition ── */
interface SliderDef {
  key: keyof ScenarioConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  hint: string;
}

const SLIDERS: SliderDef[] = [
  { key: "militaryReduction", label: "Military Reduction", min: 0, max: 80, step: 5, unit: "%", hint: "Redirect share of military budget to civilian needs" },
  { key: "healthIncrease", label: "Health Spending Increase", min: 0, max: 100, step: 5, unit: "%", hint: "Proportional rise in national health expenditure" },
  { key: "educationBoost", label: "Education Boost", min: 0, max: 100, step: 5, unit: "%", hint: "Boost to enrollment & education spending" },
  { key: "foodAidAmount", label: "Targeted Food Aid", min: 0, max: 50, step: 1, unit: "B$", hint: "Billions USD injected as food aid" },
  { key: "climateActionPct", label: "Climate Action Commitment", min: 0, max: 100, step: 5, unit: "%", hint: "Adaptation & mitigation effort" },
];

/* ── Formatting helpers ── */
function fmt(unit: string, v: number | null): string {
  if (v === null || v === undefined) return "N/A";
  switch (unit) {
    case "$":
      return formatMoney(v);
    case "% GDP":
      return v.toFixed(1) + "%";
    case "%":
      return v.toFixed(1) + "%";
    case "/1k":
      return v.toFixed(1);
    case "yrs":
      return v.toFixed(1);
    case "/5":
      return v.toFixed(1);
    default:
      return v.toFixed(1);
  }
}

const AXIS_LABEL: Record<string, string> = {
  hunger_prevalence: "Undernour.",
  child_mortality: "Child Mort.",
  life_expectancy: "Life Exp.",
  gdp_per_capita: "GDP/Cap",
  military_pct_gdp: "Mil %GDP",
  health_pct_gdp: "Health %",
  education_enrollment: "School",
  famine_risk: "Famine",
};

/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function SimulatorPage() {
  const defaultIso =
    COUNTRIES.find((c) => c.iso3 === "YEM")?.iso3 ?? COUNTRIES[0]?.iso3 ?? "";
  const [iso3, setIso3] = useState<string>(defaultIso);
  const [config, setConfig] = useState<ScenarioConfig>(DEFAULT_CONFIG);

  const country = useMemo(
    () => COUNTRIES.find((c) => c.iso3 === iso3) ?? COUNTRIES[0],
    [iso3]
  );

  // population_m is only present for a subset of countries; fall back to the
  // always-present demographics.population (absolute count) when missing.
  const popM =
    country.population_m != null
      ? country.population_m
      : (country.demographics.population ?? 0) / 1e6;

  const result = useMemo(
    () => (country ? simulateScenario(country, config) : null),
    [country, config]
  );

  const [mcIterations, setMcIterations] = useState(1000);
  const [showMc, setShowMc] = useState(false);
  const mc = useMemo(
    () => (country && showMc ? runMonteCarlo(country, config, mcIterations) : null),
    [country, config, mcIterations, showMc]
  );

  const presets = useMemo(() => getCountryScenarios(iso3), [iso3]);

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.metrics
      .filter((m) => m.baseline !== null && m.baseline !== 0)
      .map((m) => ({
        name: AXIS_LABEL[m.key] ?? m.label,
        Baseline: 100,
        Projected: +((m.projected! / m.baseline!) * 100).toFixed(1),
        improved: metricImproved(m),
      }));
  }, [result]);

  if (!country || !result) {
    return (
      <div className="p-10 text-blood-bright text-sm">
        <span className="cursor-blink">&gt; NO DATA...</span>
      </div>
    );
  }

  const setVal = (key: keyof ScenarioConfig, value: number | boolean) =>
    setConfig((c) => ({ ...c, [key]: value }));

  return (
    <main className="min-h-dvh max-w-6xl mx-auto px-3 sm:px-5 py-8">
      {/* ── Header ── */}
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-terminal-green mb-1">
          &gt; MODULE: SCENARIO SIMULATOR
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-content-primary mb-2">
          The Simulator — Model the Fix
        </h1>
        <p className="text-sm text-content-secondary max-w-3xl">
          Pick any country and redirect resources away from weapons and war into
          health, food, education and climate. Watch the human-cost math update
          live. Every slider is a choice between spending on destruction and
          spending on life.
        </p>
      </header>

      {/* ── Country selector ── */}
      <TerminalCard title="TARGET JURISDICTION" accent="amber" className="mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-xs uppercase tracking-widest text-content-secondary">
            Country
          </label>
          <select
            value={iso3}
            onChange={(e) => setIso3(e.target.value)}
            className="flex-1 bg-abyss border border-border-dim text-content-primary px-3 py-2 text-sm focus:border-command focus:outline-none"
          >
            {COUNTRIES.map((c) => (
              <option key={c.iso3} value={c.iso3}>
                {c.name_en} ({c.iso3})
              </option>
            ))}
          </select>
          <span className="text-xs text-content-dim">
            {country.region} · pop {popM.toFixed(1)}M
          </span>
        </div>
      </TerminalCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── LEFT: controls ── */}
        <div className="space-y-5">
          <TerminalCard title="INTERVENTION LEVERS" accent="blood">
            {/* Preset buttons */}
            <div className="mb-4">
              <p className="text-xs uppercase tracking-widest text-content-secondary mb-2">
                Preset Packages
              </p>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => setConfig(p.config)}
                    title={p.description}
                    className="inline-pill px-3 py-1.5 text-xs border border-border-dim text-content-secondary hover:border-command hover:text-command-bright transition-colors"
                  >
                    {p.name}
                  </button>
                ))}
                <button
                  onClick={() => setConfig(DEFAULT_CONFIG)}
                  className="inline-pill px-3 py-1.5 text-xs border border-border-dim text-content-dim hover:text-content-secondary transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Sliders */}
            <div className="space-y-4">
              {SLIDERS.map((s) => (
                <div key={s.key}>
                  <div className="flex items-baseline justify-between mb-1">
                    <label className="text-xs text-content-primary">
                      {s.label}
                    </label>
                    <span className="text-sm text-terminal-green font-bold">
                      {config[s.key] as number}
                      {s.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    className="allocator-slider w-full"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={config[s.key] as number}
                    onChange={(e) =>
                      setVal(s.key, Number(e.target.value))
                    }
                  />
                  <p className="text-[10px] text-content-dim mt-0.5">{s.hint}</p>
                </div>
              ))}

              {/* Conflict toggle */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <label className="text-xs text-content-primary">
                    Resolve Active Conflict
                  </label>
                  <p className="text-[10px] text-content-dim">
                    Model a negotiated end to armed conflict
                  </p>
                </div>
                <button
                  onClick={() =>
                    setVal("conflictResolution", !config.conflictResolution)
                  }
                  className="px-3 py-1.5 text-xs border transition-colors"
                  style={{
                    borderColor: config.conflictResolution
                      ? "var(--color-terminal-green)"
                      : "var(--color-border-dim)",
                    color: config.conflictResolution
                      ? "var(--color-terminal-green)"
                      : "var(--color-content-dim)",
                  }}
                >
                  {config.conflictResolution ? "● ENGAGED" : "○ OFF"}
                </button>
              </div>
            </div>
          </TerminalCard>
        </div>

        {/* ── RIGHT: results ── */}
        <div className="space-y-5">
          <TerminalCard title="PROJECTED OUTCOMES" accent="green">
            <div className="space-y-1.5">
              {result.metrics.map((m) => {
                const improved = metricImproved(m);
                const neutral = m.deltaPct === 0;
                const color = neutral
                  ? "var(--color-content-dim)"
                  : improved
                    ? "var(--color-terminal-green)"
                    : "var(--color-blood-bright)";
                const arrow = neutral ? "→" : improved ? "▼" : "▲";
                return (
                  <div
                    key={m.key}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-baseline text-xs py-1 border-b border-border-dim/60 last:border-0"
                  >
                    <span className="text-content-secondary">{m.label}</span>
                    <span className="text-content-dim tabular-nums text-right">
                      {fmt(m.unit, m.baseline)}
                    </span>
                    <span className="text-content-dim">→</span>
                    <span
                      className="tabular-nums text-right font-bold"
                      style={{ color }}
                      title={`${m.deltaPct >= 0 ? "+" : ""}${m.deltaPct.toFixed(1)}%`}
                    >
                      {fmt(m.unit, m.projected)}{" "}
                      <span style={{ color }}>
                        {arrow}
                        {Math.abs(m.deltaPct).toFixed(1)}%
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-content-dim mt-2">
              ▼ = improvement (green) · ▲ = regression (red) · baselines in dim,
              projected in color
            </p>
          </TerminalCard>

          <TerminalCard title="BASELINE vs PROJECTED (INDEX)" accent="green">
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 8, bottom: 28, left: -16 }}
                >
                  <CartesianGrid
                    strokeDasharray="2 4"
                    stroke="var(--color-border-dim)"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "var(--color-content-secondary)", fontSize: 10 }}
                    angle={-25}
                    textAnchor="end"
                    height={48}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fill: "var(--color-content-secondary)", fontSize: 10 }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(91,156,246,0.06)" }}
                    contentStyle={{
                      background: "var(--color-abyss)",
                      border: "1px solid var(--color-border-bright)",
                      borderRadius: 4,
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                    }}
                    labelStyle={{ color: "var(--color-content-primary)" }}
                  />
                  <Bar dataKey="Baseline" fill="var(--color-border-bright)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Projected" radius={[2, 2, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell
                        key={i}
                        fill={
                          d.Projected === 100
                            ? "var(--color-border-bright)"
                            : d.improved
                              ? "var(--color-terminal-green)"
                              : "var(--color-blood-bright)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-content-dim mt-1">
              All metrics indexed to baseline = 100. Bars below 100 on a
              &quot;lower-is-better&quot; metric (or above 100 on
              &quot;higher-is-better&quot;) are colored green.
            </p>
          </TerminalCard>
        </div>
      </div>

      {/* ── Monte Carlo uncertainty analysis ── */}
      <TerminalCard title="MONTE CARLO UNCERTAINTY ANALYSIS" accent="amber" className="mt-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
          <button
            onClick={() => setShowMc((s) => !s)}
            className="inline-pill px-3 py-1.5 text-xs border border-border-dim text-content-secondary hover:border-command hover:text-command-bright transition-colors"
          >
            {showMc ? "■ HIDE MONTE CARLO" : "▶ RUN MONTE CARLO"}
          </button>
          {showMc && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-content-secondary">Iterations</label>
              <select
                value={mcIterations}
                onChange={(e) => setMcIterations(Number(e.target.value))}
                className="bg-abyss border border-border-dim text-content-primary px-2 py-1 text-xs"
              >
                {[100, 500, 1000, 5000, 10000].map((n) => (
                  <option key={n} value={n}>{n.toLocaleString()}</option>
                ))}
              </select>
              <span className="text-[10px] text-content-dim">
                ±20% coefficient perturbation
              </span>
            </div>
          )}
        </div>

        {mc && (
          <div className="space-y-2">
            <p className="text-[10px] text-content-dim">
              {mc.iterations.toLocaleString()} simulations per metric · empirical 95% confidence intervals
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-content-dim border-b border-border-dim">
                    <th className="text-left py-1 pr-2">Metric</th>
                    <th className="text-right py-1 px-2">Median</th>
                    <th className="text-right py-1 px-2">Mean</th>
                    <th className="text-right py-1 px-2">σ</th>
                    <th className="text-right py-1 px-2">95% CI</th>
                    <th className="text-right py-1 px-2">P(improve)</th>
                  </tr>
                </thead>
                <tbody>
                  {mc.distributions.map((d) => {
                    const ci = mc.confidence95[d.key];
                    const prob = mc.improvementProbability[d.key];
                    const probColor =
                      prob >= 0.8
                        ? "var(--color-terminal-green)"
                        : prob >= 0.5
                          ? "var(--color-warning-amber)"
                          : "var(--color-blood-bright)";
                    return (
                      <tr key={d.key} className="border-b border-border-dim/50">
                        <td className="py-1 pr-2 text-content-primary">{d.label}</td>
                        <td className="py-1 px-2 text-right tabular-nums text-content-primary">{d.median.toFixed(1)}</td>
                        <td className="py-1 px-2 text-right tabular-nums text-content-secondary">{d.mean.toFixed(1)}</td>
                        <td className="py-1 px-2 text-right tabular-nums text-content-dim">{d.stdDev.toFixed(1)}</td>
                        <td className="py-1 px-2 text-right tabular-nums text-content-secondary">
                          [{ci.low.toFixed(1)}, {ci.high.toFixed(1)}]
                        </td>
                        <td className="py-1 px-2 text-right tabular-nums font-bold" style={{ color: probColor }}>
                          {(prob * 100).toFixed(0)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Distribution visualization */}
            <div className="mt-3 space-y-2">
              {mc.distributions.slice(0, 4).map((d) => {
                const ci = mc.confidence95[d.key];
                const lo = Math.min(d.min, ci.low);
                const hi = Math.max(d.max, ci.high);
                const span = hi - lo || 1;
                const mid = (ci.low + ci.high) / 2;
                const ciLeft = ((ci.low - lo) / span) * 100;
                const ciWidth = ((ci.high - ci.low) / span) * 100;
                const medPct = ((d.median - lo) / span) * 100;
                return (
                  <div key={d.key}>
                    <div className="flex justify-between text-[10px] text-content-dim mb-0.5">
                      <span>{d.label}</span>
                      <span className="tabular-nums">
                        {d.min.toFixed(1)} … {d.max.toFixed(1)} ({d.unit})
                      </span>
                    </div>
                    <div className="relative h-3 bg-abyss border border-border-dim">
                      <div
                        className="absolute top-0 bottom-0 bg-command/20 border-x border-command/50"
                        style={{ left: `${ciLeft}%`, width: `${ciWidth}%` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-terminal-green"
                        style={{ left: `${medPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <details className="mt-3">
              <summary className="text-[10px] text-content-dim cursor-pointer hover:text-content-secondary">
                View full Monte Carlo report
              </summary>
              <pre className="mt-2 p-3 bg-abyss border border-border-dim text-[10px] text-content-secondary whitespace-pre-wrap overflow-x-auto">
                {formatMonteCarloReport(mc)}
              </pre>
            </details>
            <p className="text-[10px] text-content-dim mt-2">
              Methodology: uniform ±20% perturbation on elasticity coefficients. Confidence intervals are empirical percentiles. Not a prediction — an uncertainty band around the model.
            </p>
          </div>
        )}
      </TerminalCard>

      {/* ── Narrative ── */}
      <TerminalCard title="IMPACT BRIEFING" accent="amber" className="mt-5">
        <p className="text-sm text-content-primary leading-relaxed">
          {result.narrative}
        </p>
      </TerminalCard>

      <footer className="mt-6 text-[10px] text-content-dim text-center">
        Order-of-magnitude estimates from V FOR X&apos;s proportional resource
        model. Not a forecast. Data: FAO · WHO · World Bank · SIPRI.
      </footer>
    </main>
  );
}
