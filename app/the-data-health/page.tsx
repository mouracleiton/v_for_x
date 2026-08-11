"use client";

import { useMemo, useState } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import {
  generateQualityReport,
  coverageColor,
  formatCoverage,
  type CoverageLevel,
} from "@/lib/data-quality";

const data = backbone as WorldBackbone;

const LEVEL_LABEL: Record<CoverageLevel, string> = {
  complete: "COMPLETE",
  good: "GOOD",
  partial: "PARTIAL",
  sparse: "SPARSE",
  missing: "MISSING",
};

export default function TheDataHealthPage() {
  const report = useMemo(() => generateQualityReport(data), []);
  const [view, setView] = useState<"metrics" | "countries">("metrics");
  const [sortAsc, setSortAsc] = useState(false);

  const metrics = useMemo(() => {
    const list = [...report.metrics].sort((a, b) =>
      sortAsc ? a.coverage - b.coverage : b.coverage - a.coverage
    );
    return list;
  }, [report, sortAsc]);

  const countries = useMemo(() => {
    const list = [...report.countries].sort((a, b) =>
      sortAsc ? b.coverage - a.coverage : a.coverage - b.coverage
    );
    return list;
  }, [report, sortAsc]);

  const [selectedCountry, setSelectedCountry] = useState<string>(report.countries[0]?.iso3 ?? "");
  const selected = report.countries.find((c) => c.iso3 === selectedCountry);

  return (
    <main className="min-h-dvh max-w-6xl mx-auto px-3 sm:px-5 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-terminal-green mb-1">
          &gt; MODULE: DATA INTEGRITY
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-content-primary mb-2">
          The Data Health Monitor
        </h1>
        <p className="text-sm text-content-secondary max-w-3xl">
          Radical transparency about data limitations. Every number on this
          platform is auditable for coverage — this page shows how much of the
          200×19 matrix is real measurement vs. sparse estimate.
        </p>
      </header>

      <TerminalCard title="OVERALL DATA HEALTH" accent="green" className="mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold text-terminal-green">
              {formatCoverage(report.averageCoverage)}
            </div>
            <div className="text-xs text-content-dim mt-1">AVERAGE COVERAGE</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-content-primary">
              {report.totalFilled.toLocaleString()}
            </div>
            <div className="text-xs text-content-dim mt-1">FILLED DATA POINTS</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-terminal-green">
              {report.completeMetrics}/{report.metrics.length}
            </div>
            <div className="text-xs text-content-dim mt-1">METRICS &gt; 90%</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blood-bright">
              {report.sparseMetrics}
            </div>
            <div className="text-xs text-content-dim mt-1">METRICS &lt; 50%</div>
          </div>
        </div>
        <p className="text-[10px] text-content-dim mt-3">
          Coverage = share of 200 countries with a non-null numeric value for
          that field. Missing data is disclosed, not hidden.
        </p>
      </TerminalCard>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1">
          {(["metrics", "countries"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-3 py-1.5 text-xs border transition-colors"
              style={{
                borderColor:
                  view === v ? "var(--color-terminal-green)" : "var(--color-border-dim)",
                color:
                  view === v ? "var(--color-terminal-green)" : "var(--color-content-secondary)",
              }}
            >
              {v === "metrics" ? "BY METRIC" : "BY COUNTRY"}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSortAsc((s) => !s)}
          className="text-[10px] px-3 py-1.5 border border-border-dim text-content-secondary hover:border-command"
        >
          {sortAsc ? "WORST FIRST ▲" : "BEST FIRST ▼"}
        </button>
      </div>

      {view === "metrics" ? (
        <TerminalCard title="PER-METRIC COVERAGE" accent="amber">
          <div className="space-y-1.5">
            {metrics.map((m) => (
              <div
                key={m.path}
                className="grid grid-cols-[minmax(0,1fr)_90px_auto] gap-2 items-center text-xs py-1 border-b border-border-dim/50 last:border-0"
              >
                <div className="min-w-0">
                  <span className="text-content-primary">{m.label}</span>
                  <span className="text-content-dim font-mono text-[10px] ml-2">
                    {m.path}
                  </span>
                </div>
                <div className="h-1.5 bg-abyss border border-border-dim/60">
                  <div
                    className="h-full"
                    style={{
                      width: `${m.coverage * 100}%`,
                      background: coverageColor(m.level),
                    }}
                  />
                </div>
                <span
                  className="text-right tabular-nums font-bold w-28"
                  style={{ color: coverageColor(m.level) }}
                >
                  {formatCoverage(m.coverage)}
                  <span className="text-content-dim font-normal ml-1">
                    {LEVEL_LABEL[m.level]}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </TerminalCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <TerminalCard title="PER-COUNTRY COVERAGE" accent="amber">
            <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
              {countries.map((c) => (
                <button
                  key={c.iso3}
                  onClick={() => setSelectedCountry(c.iso3)}
                  className="w-full grid grid-cols-[minmax(0,1fr)_80px] gap-2 items-center text-xs py-1 border-b border-border-dim/50 last:border-0 text-left hover:bg-abyss transition-colors"
                >
                  <span className="text-content-secondary truncate">
                    {c.name} <span className="text-content-dim font-mono">{c.iso3}</span>
                  </span>
                  <span className="text-right tabular-nums font-bold">
                    {c.filled}/{c.total}
                    <span className="text-content-dim font-normal ml-1">
                      {formatCoverage(c.coverage)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </TerminalCard>

          {selected && (
            <TerminalCard title={`DATA DIAGNOSIS — ${selected.name.toUpperCase()}`} accent="green">
              <div className="mb-3">
                <div className="text-4xl font-bold" style={{ color: coverageColor(selected.missingFields.length === 0 ? "complete" : selected.coverage >= 0.8 ? "good" : selected.coverage >= 0.5 ? "partial" : selected.coverage >= 0.1 ? "sparse" : "missing") }}>
                  {formatCoverage(selected.coverage)}
                </div>
                <p className="text-xs text-content-dim">
                  {selected.filled} of {selected.total} surveyed fields present
                </p>
              </div>
              {selected.missingFields.length > 0 ? (
                <>
                  <p className="text-xs uppercase tracking-widest text-blood-bright mb-2">
                    Missing / sparse fields ({selected.missingFields.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.missingFields.map((f) => (
                      <span key={f} className="text-[10px] font-mono px-2 py-0.5 border border-blood/40 text-blood-bright">
                        {f}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-content-dim mt-3">
                    These fields are treated as &quot;no data&quot; throughout the platform —
                    excluded from correlations, indexes, and comparisons rather than
                    imputed silently.
                  </p>
                </>
              ) : (
                <p className="text-xs text-terminal-green">
                  Full coverage — every surveyed field is present for this country.
                </p>
              )}
            </TerminalCard>
          )}
        </div>
      )}

      <footer className="mt-6 text-[10px] text-content-dim text-center">
        Coverage reflects the current frozen dataset. Data: FAO · WHO · World
        Bank · SIPRI · UCDP · V-Dem · UNHCR · Transparency International.
      </footer>
    </main>
  );
}
