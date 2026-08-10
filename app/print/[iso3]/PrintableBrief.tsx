"use client";

import { useMemo, useCallback, use } from "react";
import backbone from "@/data/world_backbone.json";
import dossiersData from "@/data/dossier-seed.json";
import type { WorldBackbone, CountryData } from "@/lib/types";
import {
  calculateVulnerability,
  scoreColor,
  scoreLabel,
} from "@/lib/vulnerability";
import { analyzeNeeds } from "@/lib/campaign";
import { formatNumber, formatPct, formatMoney, wfpClassLabel } from "@/lib/format";
import { sound } from "@/lib/sound";
import { SITE } from "@/lib/seo";

const data = backbone as WorldBackbone;

/* ═══════════════════════════════════════════════════════════════
   DOSSIER TYPE (mirrors registry page interface)
   ═══════════════════════════════════════════════════════════════ */
interface Dossier {
  id: string;
  subject: string;
  country_iso3: string;
  category: string;
  severity: string;
  status: string;
  accusation: string;
  evidence: { type: string; description: string }[];
  country_data_ref: string;
  updated_at: string;
}
const dossiers = dossiersData as Dossier[];

/* ═══════════════════════════════════════════════════════════════
   FLAG EMOJI FROM ISO2
   ═══════════════════════════════════════════════════════════════ */
function flagEmoji(iso2: string): string {
  if (!iso2 || iso2.length !== 2) return "🏳️";
  const codePoints = iso2
    .toUpperCase()
    .split("")
    .map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

/* ═══════════════════════════════════════════════════════════════
   KEY METRIC DEFINITIONS (12 indicators)
   higherIsWorse=true  → rank 1 = worst (highest value)
   higherIsWorse=false → rank 1 = worst (lowest value)
   ═══════════════════════════════════════════════════════════════ */
interface KeyMetric {
  label: string;
  extract: (c: CountryData) => number | null;
  higherIsWorse: boolean;
  fmt: (n: number) => string;
}

const KEY_METRICS: KeyMetric[] = [
  { label: "Population", extract: (c) => c.demographics.population, higherIsWorse: false, fmt: (n) => formatNumber(n) },
  { label: "Undernourishment", extract: (c) => c.hunger.undernourishment_pct, higherIsWorse: true, fmt: (n) => formatPct(n) },
  { label: "Life Expectancy", extract: (c) => c.health.life_expectancy, higherIsWorse: false, fmt: (n) => n.toFixed(1) + " yrs" },
  { label: "Child Mortality (U5)", extract: (c) => c.health.child_mortality_under5_per1k, higherIsWorse: true, fmt: (n) => n.toFixed(1) + " /1k" },
  { label: "GDP Per Capita", extract: (c) => c.economy.gdp_per_capita_usd, higherIsWorse: false, fmt: (n) => formatMoney(n) },
  { label: "Military % GDP", extract: (c) => c.military.pct_gdp, higherIsWorse: true, fmt: (n) => formatPct(n) },
  { label: "Corruption (CPI)", extract: (c) => c.governance.corruption_perceptions_index, higherIsWorse: false, fmt: (n) => n.toFixed(0) + " /100" },
  { label: "Inequality (Gini)", extract: (c) => c.inequality.gini, higherIsWorse: true, fmt: (n) => n.toFixed(1) },
  { label: "Literacy Rate", extract: (c) => c.education.literacy_rate_pct, higherIsWorse: false, fmt: (n) => formatPct(n) },
  { label: "Human Dev. Index", extract: (c) => c.human_development.hdi, higherIsWorse: false, fmt: (n) => n.toFixed(3) },
  { label: "Conflict Intensity", extract: (c) => c.conflict.intensity_1to5, higherIsWorse: true, fmt: (n) => n.toFixed(0) + " /5" },
  { label: "Displacement", extract: (c) => c.conflict.displacement_m, higherIsWorse: true, fmt: (n) => formatNumber(n) + " M" },
];

/* ═══════════════════════════════════════════════════════════════
   GLOBAL RANK
   ═══════════════════════════════════════════════════════════════ */
function globalRank(
  countries: CountryData[],
  iso3: string,
  m: KeyMetric
): { rank: number; total: number } | null {
  const vals = countries
    .map((c) => ({ iso3: c.iso3, v: m.extract(c) }))
    .filter((x) => x.v !== null && x.v !== undefined && Number.isFinite(x.v));
  vals.sort((a, b) =>
    m.higherIsWorse ? (b.v as number) - (a.v as number) : (a.v as number) - (b.v as number)
  );
  const idx = vals.findIndex((x) => x.iso3 === iso3);
  if (idx === -1) return null;
  return { rank: idx + 1, total: vals.length };
}

/* ═══════════════════════════════════════════════════════════════
   EXECUTIVE SUMMARY GENERATOR (2 sentences)
   ═══════════════════════════════════════════════════════════════ */
function executiveSummary(c: CountryData, vuln: number): string {
  const parts: string[] = [];
  const pop = c.demographics.population;
  const under = c.hunger.undernourishment_pct;
  const life = c.health.life_expectancy;
  const childMort = c.health.child_mortality_under5_per1k;
  const conflict = c.conflict.intensity_1to5;

  // Sentence 1 — the headline crisis framing
  const crisisBits: string[] = [];
  if (under !== null && under > 0)
    crisisBits.push(`${formatPct(under)} of ${Math.round(pop / 1e6)}M people are undernourished`);
  if (childMort !== null && childMort > 40)
    crisisBits.push(`child mortality stands at ${childMort.toFixed(0)} per 1,000`);
  if (conflict >= 3)
    crisisBits.push(`active conflict is rated ${conflict}/5`);
  if (c.is_hotspot)
    crisisBits.push(`the country is classified as a WFP hunger hotspot`);

  if (crisisBits.length === 0) {
    parts.push(
      `${c.name_en} (${c.iso3}) shows a moderate profile with a composite vulnerability score of ${vuln.toFixed(0)}/100, though structural risks persist across its ${c.region.toLowerCase()} context.`
    );
  } else {
    parts.push(
      `${c.name_en} (${c.iso3}) faces a compound crisis: ${crisisBits.join(", ")}.`
    );
  }

  // Sentence 2 — the data comparison framing
  const compBits: string[] = [];
  if (life !== null)
    compBits.push(`life expectancy is ${life.toFixed(1)} years`);
  const gdp = c.economy.gdp_per_capita_usd;
  if (gdp !== null) compBits.push(`GDP per capita is ${formatMoney(gdp)}`);
  if (compBits.length > 0) {
    parts.push(
      `Against this, ${compBits.join(" and ")} — a composite vulnerability score of ${vuln.toFixed(
        0
      )}/100 quantifies the gap between lived reality and global norms.`
    );
  } else {
    parts.push(
      `The composite vulnerability score of ${vuln.toFixed(
        0
      )}/100 quantifies the distance between current conditions and global humanitarian norms.`
    );
  }

  return parts.join(" ");
}

/* ═══════════════════════════════════════════════════════════════
   CRISIS INDICATORS (highlighted severity fields)
   ═══════════════════════════════════════════════════════════════ */
interface CrisisIndicator {
  label: string;
  value: string;
  severity: "critical" | "high" | "moderate" | "low";
}
function crisisIndicators(c: CountryData): CrisisIndicator[] {
  const out: CrisisIndicator[] = [];
  const sev = (level: number, thresholds: [number, number]): CrisisIndicator["severity"] => {
    if (level >= thresholds[0]) return "critical";
    if (level >= thresholds[1]) return "high";
    return "moderate";
  };

  if (c.hunger.undernourishment_pct !== null)
    out.push({ label: "Undernourishment", value: formatPct(c.hunger.undernourishment_pct), severity: sev(c.hunger.undernourishment_pct, [35, 15]) });
  if (c.hunger.famine_risk_1to5 !== null)
    out.push({ label: "Famine Risk", value: `${c.hunger.famine_risk_1to5}/5`, severity: sev(c.hunger.famine_risk_1to5, [4, 3]) });
  if (c.conflict.intensity_1to5 >= 2)
    out.push({ label: "Conflict Intensity", value: `${c.conflict.intensity_1to5}/5`, severity: sev(c.conflict.intensity_1to5, [4, 3]) });
  if (c.health.child_mortality_under5_per1k !== null)
    out.push({ label: "Child Mortality", value: `${c.health.child_mortality_under5_per1k.toFixed(1)}/1k`, severity: sev(c.health.child_mortality_under5_per1k, [60, 25]) });
  if (c.poverty.headcount_365_pct !== null)
    out.push({ label: "Extreme Poverty", value: formatPct(c.poverty.headcount_365_pct), severity: sev(c.poverty.headcount_365_pct, [40, 15]) });
  if (c.security.homicide_rate_per100k !== null)
    out.push({ label: "Homicide Rate", value: `${c.security.homicide_rate_per100k.toFixed(1)}/100k`, severity: sev(c.security.homicide_rate_per100k, [30, 10]) });
  if (c.environment.air_pollution_pm25_ugm3 !== null)
    out.push({ label: "Air Pollution", value: `${c.environment.air_pollution_pm25_ugm3.toFixed(0)} µg/m³`, severity: sev(c.environment.air_pollution_pm25_ugm3, [55, 35]) });
  if (c.employment.unemployment_pct !== null)
    out.push({ label: "Unemployment", value: formatPct(c.employment.unemployment_pct), severity: sev(c.employment.unemployment_pct, [25, 12]) });

  return out.sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3 };
    return order[a.severity] - order[b.severity];
  });
}

const severityBg: Record<CrisisIndicator["severity"], string> = {
  critical: "#c42b3e",
  high: "#e23856",
  moderate: "#f0a93b",
  low: "#22d3a6",
};

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function PrintableBrief({
  params,
}: {
  params: Promise<{ iso3: string }>;
}) {
  const { iso3 } = use(params);
  const country = useMemo(
    () => data.countries.find((c) => c.iso3.toLowerCase() === iso3.toLowerCase()),
    [iso3]
  );

  const vuln = useMemo(
    () => (country ? calculateVulnerability(country) : null),
    [country]
  );
  const needs = useMemo(
    () => (country ? analyzeNeeds(country, "en") : []),
    [country]
  );
  const countryDossiers = useMemo(
    () => (country ? dossiers.filter((d) => d.country_iso3 === country.iso3) : []),
    [country]
  );

  const handlePrint = useCallback(() => {
    sound.success();
    window.print();
  }, []);

  const handleDownloadHtml = useCallback(() => {
    if (typeof window === "undefined") return;
    sound.success();
    const html = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `v-for-x-brief-${iso3.toLowerCase()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, [iso3]);

  if (!country || !vuln) {
    return (
      <div className="p-10 text-center text-content-dim">
        Country not found: {iso3}
      </div>
    );
  }

  const summary = executiveSummary(country, vuln.composite);
  const indicators = crisisIndicators(country);
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const btnClass =
    "px-4 py-2 text-xs uppercase tracking-widest border transition-colors cursor-pointer";
  const sources = [
    ...new Set([
      ...(data.metadata.sources ?? []),
      "FAO", "WHO", "World Bank", "SIPRI", "UNHCR",
    ]),
  ].slice(0, 8);

  return (
    <div className="min-h-screen">
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .brief-card {
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
          }
          .brief-card * { color: black !important; }
          table { font-size: 10pt; width: 100%; border-collapse: collapse; }
          table th, table td { border: 1px solid #999 !important; padding: 4px 8px; }
          .print-keep { color: black !important; }
          .brief-section { page-break-inside: avoid; }
          @page { margin: 1.5cm; }
        }
      `}</style>

      {/* Toolbar — hidden when printing */}
      <div className="no-print sticky top-0 z-10 bg-void/95 backdrop-blur border-b border-border-dim px-4 py-3 flex flex-wrap items-center gap-3">
        <a
          href={(process.env.NODE_ENV === "production" ? "/v_for_x" : "") + "/sorrow-map/"}
          className="text-xs text-content-dim hover:text-command"
        >
          ← Back
        </a>
        <span className="text-xs text-content-secondary flex-1">
          Preview — use the buttons to export this intelligence brief.
        </span>
        <button onClick={handlePrint} className={`${btnClass} bg-blood text-white border-blood hover:bg-blood-bright`}>
          🖨 Print / Save as PDF
        </button>
        <button onClick={handleDownloadHtml} className={`${btnClass} border-command text-command hover:bg-command hover:text-void`}>
          ⬇ Download as HTML
        </button>
      </div>

      {/* Paper preview card */}
      <div className="flex justify-center p-4 sm:p-8">
        <article
          className="brief-card w-full max-w-[820px] bg-white text-black shadow-2xl"
          style={{ fontFamily: '"Inter","Segoe UI",system-ui,sans-serif', borderRadius: 4 }}
        >
          {/* ── Header ── */}
          <header
            className="border-b-4 pb-4 mb-6 flex items-start justify-between gap-4"
            style={{ borderColor: "#c42b3e" }}
          >
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-gray-500">
                V FOR X · Intelligence Brief
              </div>
              <h1 className="text-3xl font-bold mt-1">{country.name_en}</h1>
              <div className="text-sm text-gray-600 mt-1">
                {country.iso3} · {country.region} · {country.subregion}
                {country.is_hotspot && (
                  <span className="ml-2 inline-block px-2 py-0.5 text-xs font-bold text-white" style={{ background: "#c42b3e" }}>
                    HOTSPOT
                  </span>
                )}
              </div>
            </div>
            <div className="text-5xl leading-none">{flagEmoji(country.iso2)}</div>
          </header>

          {/* ── Executive Summary ── */}
          <section className="brief-section mb-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-2">
              Executive Summary
            </h2>
            <p className="text-[13px] leading-relaxed">{summary}</p>
          </section>

          {/* ── Key Metrics Table ── */}
          <section className="brief-section mb-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-2">
              Key Metrics
            </h2>
            <table>
              <thead>
                <tr style={{ background: "#f4f4f5" }}>
                  <th className="text-left">Indicator</th>
                  <th className="text-right">Value</th>
                  <th className="text-right">Global Rank</th>
                </tr>
              </thead>
              <tbody>
                {KEY_METRICS.map((m) => {
                  const val = m.extract(country);
                  const rank = globalRank(data.countries, country.iso3, m);
                  return (
                    <tr key={m.label} className="border-t border-gray-300">
                      <td className="text-[12px]">{m.label}</td>
                      <td className="text-right text-[12px] font-semibold">
                        {val !== null && val !== undefined ? m.fmt(val) : "—"}
                      </td>
                      <td className="text-right text-[12px] text-gray-600">
                        {rank ? `${rank.rank} / ${rank.total}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* ── Crisis Indicators ── */}
          {indicators.length > 0 && (
            <section className="brief-section mb-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-2">
                Crisis Indicators
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {indicators.map((ind) => (
                  <div
                    key={ind.label}
                    className="p-2 border border-gray-300"
                    style={{ borderLeft: `4px solid ${severityBg[ind.severity]}` }}
                  >
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">
                      {ind.label}
                    </div>
                    <div className="text-sm font-bold">{ind.value}</div>
                    <div
                      className="text-[9px] uppercase font-bold"
                      style={{ color: severityBg[ind.severity] }}
                    >
                      {ind.severity}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Vulnerability Score Breakdown ── */}
          <section className="brief-section mb-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-2">
              Vulnerability Score Breakdown
            </h2>
            <div className="flex items-center gap-4 mb-3">
              <div
                className="text-4xl font-extrabold"
                style={{ color: scoreColor(vuln.composite) }}
              >
                {vuln.composite.toFixed(0)}
                <span className="text-base text-gray-400">/100</span>
              </div>
              <div>
                <div
                  className="text-sm font-bold uppercase"
                  style={{ color: scoreColor(vuln.composite) }}
                >
                  {scoreLabel(vuln.composite)}
                </div>
                <div className="text-[11px] text-gray-500">
                  Composite Vulnerability Index
                </div>
              </div>
            </div>
            <table>
              <thead>
                <tr style={{ background: "#f4f4f5" }}>
                  <th className="text-left">Domain</th>
                  <th className="text-right">Score</th>
                  <th className="text-left">Raw Data</th>
                </tr>
              </thead>
              <tbody>
                {vuln.domains
                  .filter((d) => d.hasData)
                  .sort((a, b) => b.score - a.score)
                  .map((d) => (
                    <tr key={d.domain} className="border-t border-gray-300">
                      <td className="text-[12px]">{d.label}</td>
                      <td
                        className="text-right text-[12px] font-semibold"
                        style={{ color: scoreColor(d.score) }}
                      >
                        {d.score.toFixed(0)}/100
                      </td>
                      <td className="text-[11px] text-gray-600">{d.raw}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>

          {/* ── Campaign Summary ── */}
          {needs.length > 0 && (
            <section className="brief-section mb-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-2">
                Campaign Summary — Urgent Needs
              </h2>
              <ol className="list-decimal pl-5 space-y-1">
                {needs.slice(0, 5).map((n) => (
                  <li key={n.id} className="text-[12px]">
                    <span className="font-semibold">{n.headline}</span>
                    <span className="text-gray-600"> — {n.context}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* ── Dossier References ── */}
          {countryDossiers.length > 0 && (
            <section className="brief-section mb-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-2">
                Dossier References
              </h2>
              <div className="space-y-2">
                {countryDossiers.map((d) => (
                  <div key={d.id} className="border border-gray-300 p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-gray-700">{d.id}</span>
                      <span
                        className="text-[9px] uppercase font-bold px-1.5 py-0.5 text-white"
                        style={{ background: severityBg[d.severity === "critical" ? "critical" : "high"] }}
                      >
                        {d.severity}
                      </span>
                      <span className="text-[9px] uppercase text-gray-500">{d.status}</span>
                    </div>
                    <div className="text-[12px] mt-1">{d.accusation}</div>
                    {d.country_data_ref && (
                      <div className="text-[10px] text-gray-500 mt-1">
                        Data ref: {d.country_data_ref}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Footer ── */}
          <footer
            className="mt-8 pt-4 border-t-2 text-[10px] text-gray-500"
            style={{ borderColor: "#c42b3e" }}
          >
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <strong className="text-gray-700">V FOR X — Generated Intelligence Brief</strong>
              </div>
              <div>Generated: {today}</div>
            </div>
            <div className="mt-1">
              Data sources: {sources.join(" · ")} · {data.metadata.standard}
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}
