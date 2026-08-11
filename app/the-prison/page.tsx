"use client";

import { useMemo, useState } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, CountryData } from "@/lib/types";

const data = backbone as WorldBackbone;

interface Row {
  iso3: string;
  name: string;
  region: string;
  rate: number | null;
  population: number | null;
  preTrial: number | null;
  overcrowding: number | null;
}

function buildRows(): Row[] {
  return data.countries.map((c: CountryData) => ({
    iso3: c.iso3,
    name: c.name_en,
    region: c.region,
    rate: c.justice?.prison_rate_per_100k ?? c.security?.prison_rate_per_100k ?? null,
    population: c.justice?.prison_population ?? c.security?.prison_population ?? null,
    preTrial: c.justice?.pre_trial_pct ?? null,
    overcrowding: c.justice?.prison_overcrowding_pct ?? null,
  }));
}

const ALL_ROWS = buildRows();

export default function ThePrisonPage() {
  const [region, setRegion] = useState<string>("all");
  const [minRate, setMinRate] = useState(0);
  const [minRows, setMinRows] = useState(30);

  const regions = useMemo(() => [...new Set(ALL_ROWS.map((r) => r.region))].sort(), []);

  const rows = useMemo(() => {
    let list =
      region === "all"
        ? ALL_ROWS
        : ALL_ROWS.filter((r) => r.region === region);
    list = list
      .filter((r) => r.rate !== null && r.rate >= minRate)
      .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
    return list.slice(0, minRows);
  }, [region, minRate, minRows]);

  const covered = useMemo(() => ALL_ROWS.filter((r) => r.rate !== null).length, []);
  const meanRate = useMemo(() => {
    const vals = ALL_ROWS.filter((r) => r.rate !== null).map((r) => r.rate!);
    return vals.reduce((s, v) => s + v, 0) / (vals.length || 1);
  }, []);
  const totalPrisoners = useMemo(
    () => ALL_ROWS.filter((r) => r.population !== null).reduce((s, r) => s + (r.population ?? 0), 0),
    [],
  );
  const usRow = ALL_ROWS.find((r) => r.iso3 === "USA");

  return (
    <main className="min-h-dvh max-w-6xl mx-auto px-3 sm:px-5 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-terminal-green mb-1">
          &gt; MODULE: INCARCERATION & JUSTICE
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-content-primary mb-2">
          The Prison Atlas
        </h1>
        <p className="text-sm text-content-secondary max-w-3xl">
          Incarceration is the most visible expression of a state&apos;s
          justice system — and often its most punitive one. Prisoners per
          100,000 people reveals which societies rely on cages over care.
          Rates are ranked high-to-low; gaps are disclosed, never imputed.
        </p>
      </header>

      <TerminalCard title="KEY FIGURES" accent="amber" className="mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold text-warning-amber">
              {totalPrisoners >= 1e6 ? `${(totalPrisoners / 1e6).toFixed(1)}M` : totalPrisoners.toLocaleString()}
            </div>
            <div className="text-xs text-content-dim mt-1">PRISONERS (RECORDED)</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-content-primary">{meanRate.toFixed(0)}</div>
            <div className="text-xs text-content-dim mt-1">GLOBAL MEAN RATE /100K</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blood-bright">{covered}/200</div>
            <div className="text-xs text-content-dim mt-1">COUNTRIES WITH DATA</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blood-bright">
              {usRow?.rate !== null && usRow?.rate !== undefined ? `${usRow.rate.toFixed(0)}` : "—"}
            </div>
            <div className="text-xs text-content-dim mt-1">USA RATE /100K (rank {usRow ? ALL_ROWS.filter((r) => (r.rate ?? -1) > (usRow.rate ?? 0)).length + 1 : "—"})</div>
          </div>
        </div>
      </TerminalCard>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="bg-abyss border border-border-dim text-content-primary px-2 py-1.5 text-xs"
        >
          <option value="all">ALL REGIONS</option>
          {regions.map((r) => (
            <option key={r} value={r}>{r.toUpperCase()}</option>
          ))}
        </select>
        <select
          value={minRate}
          onChange={(e) => setMinRate(Number(e.target.value))}
          className="bg-abyss border border-border-dim text-content-primary px-2 py-1.5 text-xs"
        >
          {[0, 50, 100, 150, 200, 300].map((n) => (
            <option key={n} value={n}>RATE &gt; {n}</option>
          ))}
        </select>
        <select
          value={minRows}
          onChange={(e) => setMinRows(Number(e.target.value))}
          className="bg-abyss border border-border-dim text-content-primary px-2 py-1.5 text-xs"
        >
          {[15, 30, 50, 100, 200].map((n) => (
            <option key={n} value={n}>SHOW TOP {n}</option>
          ))}
        </select>
      </div>

      <TerminalCard title={`RANKED — PRISONERS PER 100,000 (${rows.length})`} accent="blood">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-content-dim border-b border-border-dim">
                <th className="text-left py-2 pr-2">#</th>
                <th className="text-left py-2 pr-2">Country</th>
                <th className="text-right py-2 px-2">Rate /100k</th>
                <th className="text-right py-2 px-2">Prisoners</th>
                <th className="text-right py-2 px-2">Pre-trial %</th>
                <th className="text-right py-2 px-2">Overcrowding %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const maxRate = rows[0]?.rate ?? 1;
                const bar = ((r.rate ?? 0) / maxRate) * 100;
                const high = (r.rate ?? 0) >= 300;
                return (
                  <tr key={r.iso3} className="border-b border-border-dim/40">
                    <td className="py-1.5 pr-2 text-content-dim">{i + 1}</td>
                    <td className="py-1.5 pr-2">
                      <a href={`/sorrow-map/${r.iso3.toLowerCase()}/`} className="text-content-primary hover:text-blood-bright transition-colors">
                        {r.name}
                      </a>
                      <span className="text-content-dim font-mono text-[10px] ml-1">{r.iso3}</span>
                      <div className="h-1 bg-abyss mt-1 max-w-[200px]">
                        <div
                          className="h-full"
                          style={{ width: `${bar}%`, background: high ? "var(--color-blood-bright)" : "var(--color-warning-amber)" }}
                        />
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums font-bold" style={{ color: high ? "var(--color-blood-bright)" : "var(--color-content-primary)" }}>
                      {r.rate !== null ? r.rate.toFixed(0) : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-content-secondary">
                      {r.population !== null ? r.population.toLocaleString() : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-content-dim">
                      {r.preTrial !== null ? `${r.preTrial.toFixed(0)}%` : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-content-dim">
                      {r.overcrowding !== null ? `${r.overcrowding.toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-content-dim mt-2">
          Pre-trial detention and prison overcrowding are sparse fields
          worldwide (disclosed where available). Rate = prisoners per 100,000
          population. Red bars = rate ≥ 300/100k.
        </p>
      </TerminalCard>

      <footer className="mt-6 text-[10px] text-content-dim text-center">
        Prison rates: World Prison Brief / national justice statistics.
        Coverage gaps are disclosed, not imputed.
      </footer>
    </main>
  );
}
