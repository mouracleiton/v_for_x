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
  femaleRate: number | null;
  maleRate: number | null;
  totalRate: number | null;
  womenParliament: number | null;
  femicidesPerYear: number | null;
  killingsByPolice: number | null;
}

function buildRows(): Row[] {
  return data.countries.map((c: CountryData) => ({
    iso3: c.iso3,
    name: c.name_en,
    region: c.region,
    femaleRate: c.security?.homicide_female_per100k ?? null,
    maleRate: c.security?.homicide_male_per100k ?? null,
    totalRate: c.security?.homicide_rate_per100k ?? null,
    womenParliament: c.gender?.women_parliament_pct ?? null,
    femicidesPerYear: c.security?.femicides_per_year ?? null,
    killingsByPolice: c.security?.killings_by_police ?? null,
  }));
}

const ALL_ROWS = buildRows();

export default function TheViolencePage() {
  const [region, setRegion] = useState<string>("all");
  const [minRows, setMinRows] = useState(25);
  const [sortKey, setSortKey] = useState<"femaleRate" | "maleRate" | "totalRate" | "gap">(
    "femaleRate",
  );

  const regions = useMemo(
    () => [...new Set(ALL_ROWS.map((r) => r.region))].sort(),
    [],
  );

  const rows = useMemo(() => {
    let list = region === "all" ? ALL_ROWS : ALL_ROWS.filter((r) => r.region === region);
    list = list
      .filter((r) => r.femaleRate !== null)
      .sort((a, b) => {
        if (sortKey === "gap") {
          const gapA = a.femaleRate !== null && a.maleRate !== null ? a.femaleRate - a.maleRate : -Infinity;
          const gapB = b.femaleRate !== null && b.maleRate !== null ? b.femaleRate - b.maleRate : -Infinity;
          return gapB - gapA;
        }
        return (b[sortKey] ?? -1) - (a[sortKey] ?? -1);
      });
    return list.slice(0, minRows);
  }, [region, minRows, sortKey]);

  const covered = useMemo(
    () => ALL_ROWS.filter((r) => r.femaleRate !== null).length,
    [],
  );
  const meanFemale = useMemo(() => {
    const vals = ALL_ROWS.filter((r) => r.femaleRate !== null).map((r) => r.femaleRate!);
    return vals.reduce((s, v) => s + v, 0) / (vals.length || 1);
  }, []);

  return (
    <main className="min-h-dvh max-w-6xl mx-auto px-3 sm:px-5 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-terminal-green mb-1">
          &gt; MODULE: STATE VIOLENCE AGAINST WOMEN
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-blood-bright mb-2">
          The Violence Atlas
        </h1>
        <p className="text-sm text-content-secondary max-w-3xl">
          Female homicide rates measure how safe women are from the most
          extreme violence — much of it intimate-partner or domestic. The
          female/male split exposes societies where women bear a
          disproportionate share of killing. Direct femicide counts and
          police-killing statistics are sparse worldwide; female homicide per
          100k is the reliable proxy (UNODC methodology).
        </p>
      </header>

      <TerminalCard title="KEY FIGURES" accent="blood" className="mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold text-blood-bright">{covered}/200</div>
            <div className="text-xs text-content-dim mt-1">COUNTRIES WITH DATA</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blood-bright">{meanFemale.toFixed(1)}</div>
            <div className="text-xs text-content-dim mt-1">GLOBAL MEAN F/100K</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-warning-amber">
              {rows.filter((r) => r.femaleRate !== null && r.maleRate !== null && r.femaleRate > r.maleRate).length}
            </div>
            <div className="text-xs text-content-dim mt-1">F &gt; M RATE (TOP {minRows})</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-content-primary">
              {rows[0]?.name ?? "—"}
            </div>
            <div className="text-xs text-content-dim mt-1">HIGHEST F/100K</div>
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
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
          className="bg-abyss border border-border-dim text-content-primary px-2 py-1.5 text-xs"
        >
          <option value="femaleRate">SORT: FEMALE RATE</option>
          <option value="maleRate">SORT: MALE RATE</option>
          <option value="totalRate">SORT: TOTAL RATE</option>
          <option value="gap">SORT: F−M GAP (women over-exposed)</option>
        </select>
        <select
          value={minRows}
          onChange={(e) => setMinRows(Number(e.target.value))}
          className="bg-abyss border border-border-dim text-content-primary px-2 py-1.5 text-xs"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>SHOW TOP {n}</option>
          ))}
        </select>
      </div>

      <TerminalCard title={`RANKED — FEMALE HOMICIDES PER 100,000 (${rows.length})`} accent="amber">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-content-dim border-b border-border-dim">
                <th className="text-left py-2 pr-2">#</th>
                <th className="text-left py-2 pr-2">Country</th>
                <th className="text-right py-2 px-2">Female /100k</th>
                <th className="text-right py-2 px-2">Male /100k</th>
                <th className="text-right py-2 px-2">Total /100k</th>
                <th className="text-right py-2 px-2">F/M ratio</th>
                <th className="text-right py-2 px-2">Women in parliament %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const femaleBar = (r.femaleRate ?? 0) / Math.max(rows[0]?.femaleRate ?? 1, 1);
                const ratio =
                  r.femaleRate !== null && r.maleRate !== null && r.maleRate > 0
                    ? r.femaleRate / r.maleRate
                    : null;
                const overExposed = ratio !== null && ratio > 1;
                return (
                  <tr key={r.iso3} className="border-b border-border-dim/40">
                    <td className="py-1.5 pr-2 text-content-dim">{i + 1}</td>
                    <td className="py-1.5 pr-2">
                      <a href={`/sorrow-map/${r.iso3.toLowerCase()}/`} className="text-content-primary hover:text-blood-bright transition-colors">
                        {r.name}
                      </a>
                      <span className="text-content-dim font-mono text-[10px] ml-1">{r.iso3}</span>
                      <div className="h-1 bg-abyss mt-1 max-w-[180px]">
                        <div className="h-full bg-blood" style={{ width: `${femaleBar * 100}%` }} />
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums font-bold text-blood-bright">
                      {r.femaleRate !== null ? r.femaleRate.toFixed(1) : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-content-secondary">
                      {r.maleRate !== null ? r.maleRate.toFixed(1) : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-content-dim">
                      {r.totalRate !== null ? r.totalRate.toFixed(1) : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {ratio !== null ? (
                        <span style={{ color: overExposed ? "var(--color-blood-bright)" : "var(--color-content-secondary)" }}>
                          {ratio.toFixed(2)}{overExposed && " ▲"}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-content-secondary">
                      {r.womenParliament !== null ? `${r.womenParliament.toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-content-dim mt-2">
          ▲ = female homicide rate exceeds male rate. F/M &gt; 1 marks societies
          where women are killed at rates above men — a signature of femicide
          as a distinct phenomenon rather than collateral violence. Direct
          femicide counts ({ALL_ROWS.filter((r) => r.femicidesPerYear !== null).length} countries) and
          police killings ({ALL_ROWS.filter((r) => r.killingsByPolice !== null).length} countries) are
          disclosed where available.
        </p>
      </TerminalCard>

      <footer className="mt-6 text-[10px] text-content-dim text-center">
        Female/male homicide splits: UNODC Global Study on Homicide. Women in
        parliament: IPU. Coverage gaps are disclosed, not imputed.
      </footer>
    </main>
  );
}
