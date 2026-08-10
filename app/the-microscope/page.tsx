"use client";

/**
 * V FOR X — The Microscope [74]
 *
 * Pick a metric, see its full global distribution.
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import DataBar from "@/components/ui/DataBar";
import { sound } from "@/lib/sound";
import {
  FIELDS,
  getCategories,
  analyzeMetric,
  formatValue,
  type MicroscopeField,
} from "@/lib/microscope";
import type { WorldBackbone } from "@/lib/types";

const data = backbone as WorldBackbone;

export default function MicroscopePage() {
  const categories = useMemo(() => getCategories(), []);
  const [activeCategory, setActiveCategory] = useState(categories[0]);
  const [selectedKey, setSelectedKey] = useState(FIELDS[0].key);

  const categoryFields = FIELDS.filter((f) => f.category === activeCategory);
  const field = FIELDS.find((f) => f.key === selectedKey) ?? FIELDS[0];

  const result = useMemo(() => analyzeMetric(data, field), [field]);

  // Top/bottom 10 for the ranking table
  const top10 = result.countries.slice(0, 10);
  const bottom10 = result.countries.slice(-10).reverse();

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-mono px-1.5 py-0.5 border border-blood text-blood-bright">[74]</span>
          <h1 className="text-2xl md:text-4xl font-bold text-blood-bright glow-blood tracking-widest">
            THE MICROSCOPE
          </h1>
        </div>
        <p className="text-content-secondary text-sm">
          Zoom into one metric. See its complete global distribution — ranking,
          outliers, regional gaps, and quintile breakdown across 200 countries.
        </p>
      </div>

      {/* Field selector */}
      <TerminalCard title="SELECT METRIC" accent="blood" className="mb-6" glow>
        {/* Category tabs */}
        <div className="flex flex-wrap gap-1 mb-3">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                const first = FIELDS.find((f) => f.category === cat);
                if (first) setSelectedKey(first.key);
                sound.nav();
              }}
              className={`text-[10px] px-2 py-1 border transition-colors uppercase tracking-widest ${
                activeCategory === cat
                  ? "border-blood text-blood-bright bg-panel"
                  : "border-border-dim text-content-secondary hover:border-blood"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        {/* Field dropdown */}
        <div className="flex flex-wrap gap-2">
          {categoryFields.map((f) => (
            <button
              key={f.key}
              onClick={() => { setSelectedKey(f.key); sound.select(); }}
              className={`text-[10px] px-2 py-1 border transition-colors ${
                selectedKey === f.key
                  ? "border-blood text-blood-bright"
                  : "border-border-dim text-content-secondary hover:border-blood"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="mt-3 text-[10px] text-content-dim border-t border-border-dim pt-2">
          {field.description}
        </div>
      </TerminalCard>

      {/* Key stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatBox label="Mean" value={formatValue(result.stats.mean, field.unit)} color="var(--color-warning-amber)" />
        <StatBox label="Median" value={formatValue(result.stats.median, field.unit)} color="var(--color-terminal-green)" />
        <StatBox label="Std Dev" value={formatValue(result.stats.stdDev, field.unit)} color="var(--color-content-secondary)" />
        <StatBox label="Range" value={`${formatValue(result.stats.min, field.unit)} – ${formatValue(result.stats.max, field.unit)}`} color="var(--color-blood)" />
      </div>

      {/* Distribution histogram */}
      <TerminalCard title="DISTRIBUTION" accent="green" className="mb-6">
        <Histogram values={result.countries.map((c) => c.value).filter((v): v is number => v != null)} field={field} />
        <div className="mt-2 text-[10px] text-content-dim">
          Skewness: {result.stats.skewness.toFixed(2)} {" "}
          ({result.stats.skewness > 0.5 ? "right-skewed (few countries with extreme values)" : result.stats.skewness < -0.5 ? "left-skewed" : "roughly symmetric"})
        </div>
      </TerminalCard>

      {/* Best & Worst */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <TerminalCard title={`WORST: ${field.label.toUpperCase()}`} accent="blood">
          {result.worst && (
            <Link
              href={`/sorrow-map/${result.worst.iso3.toLowerCase()}/`}
              className="block p-3 border border-border-dim hover:border-blood transition-colors"
            >
              <div className="text-xs text-content-dim">#{result.countries.length} of {result.countries.length}</div>
              <div className="text-lg font-bold text-content-primary">{result.worst.name}</div>
              <div className="text-2xl text-blood-bright font-bold font-mono">
                {formatValue(result.worst.value, field.unit)}
              </div>
              <div className="text-[10px] text-content-dim">{result.worst.region}</div>
            </Link>
          )}
        </TerminalCard>
        <TerminalCard title={`BEST: ${field.label.toUpperCase()}`} accent="green">
          {result.best && (
            <Link
              href={`/sorrow-map/${result.best.iso3.toLowerCase()}/`}
              className="block p-3 border border-border-dim hover:border-terminal-green transition-colors"
            >
              <div className="text-xs text-content-dim">#1 of {result.countries.length}</div>
              <div className="text-lg font-bold text-content-primary">{result.best.name}</div>
              <div className="text-2xl text-terminal-green font-bold font-mono">
                {formatValue(result.best.value, field.unit)}
              </div>
              <div className="text-[10px] text-content-dim">{result.best.region}</div>
            </Link>
          )}
        </TerminalCard>
      </div>

      {/* Regional breakdown */}
      <TerminalCard title="REGIONAL BREAKDOWN" accent="amber" className="mb-6">
        <div className="space-y-2">
          {result.regions.map((r) => (
            <div key={r.region} className="flex items-center gap-3 py-1">
              <div className="w-32 text-xs text-content-primary truncate">{r.region}</div>
              <div className="flex-1">
                <DataBar
                  value={r.mean}
                  max={result.stats.max}
                  label={`${formatValue(r.mean, field.unit)} (mean of ${r.count} countries)`}
                  unit={field.unit}
                />
              </div>
            </div>
          ))}
        </div>
      </TerminalCard>

      {/* Outliers */}
      {result.outliers.length > 0 && (
        <TerminalCard title="OUTLIERS (1.5×IQR)" accent="blood" className="mb-6">
          <div className="space-y-2">
            {result.outliers.slice(0, 8).map((o, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Link
                  href={`/sorrow-map/${o.iso3.toLowerCase()}/`}
                  className="text-content-primary hover:text-blood-bright font-bold w-32 truncate"
                >
                  {o.country}
                </Link>
                <span className="text-content-dim text-[10px]">{o.type === "high" ? "↑" : "↓"}</span>
                <span className={`font-mono ${o.type === "high" ? "text-blood-bright" : "text-terminal-green"}`}>
                  {formatValue(o.value, field.unit)}
                </span>
                <span className="text-[10px] text-content-dim">z={o.zScore.toFixed(1)}</span>
                {o.severity === "extreme" && (
                  <StatusPill color="blood">EXTREME</StatusPill>
                )}
              </div>
            ))}
          </div>
        </TerminalCard>
      )}

      {/* Quintile breakdown */}
      {result.quintiles.length > 0 && (
        <TerminalCard title="QUINTILE BREAKDOWN" accent="amber" className="mb-6">
          <div className="space-y-2">
            {result.quintiles.map((q, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-24 text-[10px] text-content-dim uppercase tracking-widest">{q.label}</div>
                <div className="flex-1 text-xs text-content-secondary">
                  {formatValue(q.range[0], field.unit)} – {formatValue(q.range[1], field.unit)}
                </div>
                <div className="text-xs text-content-primary font-mono">{q.count}</div>
                <div className="text-[10px] text-content-dim">{q.populationM.toFixed(0)}M</div>
              </div>
            ))}
          </div>
        </TerminalCard>
      )}

      {/* Full ranking */}
      <TerminalCard title={`TOP 10 — WORST ${field.label.toUpperCase()}`} accent="blood" className="mb-6">
        <div className="space-y-1">
          {top10.map((c) => (
            <RankingRow key={c.iso3} rank={c.rank} name={c.name} value={c.value} unit={field.unit} iso3={c.iso3} />
          ))}
        </div>
      </TerminalCard>

      <TerminalCard title={`TOP 10 — BEST ${field.label.toUpperCase()}`} accent="green" className="mb-6">
        <div className="space-y-1">
          {bottom10.map((c) => (
            <RankingRow key={c.iso3} rank={c.rank} name={c.name} value={c.value} unit={field.unit} iso3={c.iso3} />
          ))}
        </div>
      </TerminalCard>

      {/* Aggregate */}
      <TerminalCard title="GLOBAL SCALE" className="mb-6">
        <div className="text-center py-4">
          <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">
            {field.label}
          </div>
          <div className="text-2xl text-blood-bright font-bold font-mono">
            {result.aggregateLabel}
          </div>
        </div>
      </TerminalCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="terminal-card p-3 text-center">
      <div className="text-[10px] text-content-dim uppercase tracking-widest">{label}</div>
      <div className="text-lg font-bold font-mono" style={{ color }}>{value}</div>
    </div>
  );
}

function Histogram({ values, field }: { values: number[]; field: MicroscopeField }) {
  const BINS = 20;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range === 0) return <div className="text-xs text-content-dim text-center py-4">All values identical.</div>;

  const binSize = range / BINS;
  const bins = new Array(BINS).fill(0);
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binSize), BINS - 1);
    bins[idx]++;
  }
  const maxBin = Math.max(...bins);

  return (
    <div>
      <div className="flex items-end gap-px h-24">
        {bins.map((count, i) => {
          const binStart = min + i * binSize;
          const binEnd = binStart + binSize;
          const height = (count / maxBin) * 100;
          const isExtreme = i < 3 || i >= BINS - 3;
          return (
            <div
              key={i}
              className="flex-1 group relative"
              style={{ height: `${height}%`, minHeight: "2px" }}
              title={`${formatValue(binStart, field.unit)} – ${formatValue(binEnd, field.unit)}: ${count} countries`}
            >
              <div
                className={`w-full h-full ${isExtreme ? "bg-blood" : "bg-terminal-green"} opacity-70 hover:opacity-100 transition-opacity`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-content-dim mt-1">
        <span>{formatValue(min, field.unit)}</span>
        <span>{formatValue(max, field.unit)}</span>
      </div>
    </div>
  );
}

function RankingRow({
  rank,
  name,
  value,
  unit,
  iso3,
}: {
  rank: number;
  name: string;
  value: number | null;
  unit: string;
  iso3: string;
}) {
  return (
    <Link
      href={`/sorrow-map/${iso3.toLowerCase()}/`}
      className="flex items-center gap-3 py-1 px-2 hover:bg-panel transition-colors group"
    >
      <span className="text-[10px] text-content-dim font-mono w-8">#{rank}</span>
      <span className="text-xs text-content-primary group-hover:text-blood-bright flex-1 truncate">
        {name}
      </span>
      <span className="text-xs font-mono text-content-secondary">
        {formatValue(value, unit)}
      </span>
    </Link>
  );
}
