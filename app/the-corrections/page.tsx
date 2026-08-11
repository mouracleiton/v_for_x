"use client";

import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, CountryData } from "@/lib/types";
import {
  addCorrection,
  listCorrections,
  updateCorrectionStatus,
  deleteCorrection,
  clearCorrections,
  buildCorrectionPackage,
  parseCorrectionPackage,
  importCorrectionPackage,
  correctionStats,
  type DataCorrection,
  type CorrectionPackage,
} from "@/lib/corrections";

const data = backbone as WorldBackbone;

/* ═══ METRIC FIELDS — dotted paths + labels for the dropdown ═══ */

interface MetricField {
  path: string;
  label: string;
}

const METRIC_FIELDS: MetricField[] = [
  // Hunger
  { path: "hunger.prevalence_pct", label: "Hunger Prevalence (%)" },
  { path: "hunger.undernourishment_pct", label: "Undernourishment (%)" },
  { path: "hunger.child_stunting_pct", label: "Child Stunting (%)" },
  { path: "hunger.child_wasting_pct", label: "Child Wasting (%)" },
  { path: "hunger.famine_risk_1to5", label: "Famine Risk (1-5)" },
  { path: "hunger.pop_acute_fi_m", label: "Acute Food Insecurity (M)" },
  // Conflict
  { path: "conflict.intensity_1to5", label: "Conflict Intensity (1-5)" },
  { path: "conflict.displacement_m", label: "Conflict Displacement (M)" },
  { path: "conflict.armed_clashes", label: "Armed Clashes (count)" },
  { path: "conflict.internationalized", label: "Internationalized Conflict (bool)" },
  { path: "conflict.terror_attacks", label: "Terror Attacks (count)" },
  // Military
  { path: "military.expenditure_usd", label: "Military Expenditure (USD)" },
  { path: "military.pct_gdp", label: "Military % of GDP" },
  // Economy
  { path: "economy.gdp_usd", label: "GDP (USD)" },
  { path: "economy.gdp_per_capita_usd", label: "GDP per Capita (USD)" },
  { path: "economy.gdp_growth_pct", label: "GDP Growth (%)" },
  // Inequality
  { path: "inequality.gini", label: "Gini Coefficient" },
  { path: "inequality.top10_share_pct", label: "Top 10% Income Share (%)" },
  // Health
  { path: "health.life_expectancy", label: "Life Expectancy (yrs)" },
  { path: "health.child_mortality_under5_per1k", label: "Child Mortality U5 (/1k)" },
  { path: "health.doctors_per_1000", label: "Doctors (/1000)" },
  { path: "health.hospital_beds_per_1000", label: "Hospital Beds (/1000)" },
  { path: "health.expenditure_pct_gdp", label: "Health Expenditure (% GDP)" },
  // Governance
  { path: "governance.corruption_perceptions_index", label: "Corruption Index (0-100)" },
  { path: "governance.electoral_democracy_index", label: "Electoral Democracy Index" },
  { path: "governance.vdem_index", label: "V-Dem Index" },
  { path: "governance.press_freedom_index", label: "Press Freedom Index" },
  // Poverty
  { path: "poverty.headcount_365_pct", label: "Extreme Poverty $3.65 (%)" },
  { path: "poverty.headcount_685_pct", label: "Poverty $6.85 (%)" },
  // Water
  { path: "water_sanitation.basic_access_pct", label: "Basic Water Access (%)" },
  { path: "water_sanitation.safe_sanitation_pct", label: "Safe Sanitation (%)" },
  // Education
  { path: "education.literacy_rate_pct", label: "Literacy Rate (%)" },
  { path: "education.primary_enrollment_pct", label: "Primary Enrollment (%)" },
  // Climate & environment
  { path: "climate.co2_per_capita_t", label: "CO₂ per Capita (t)" },
  { path: "climate.co2_mt", label: "CO₂ Emissions (Mt)" },
  { path: "environment.air_pollution_pm25_ugm3", label: "Air Pollution PM2.5 (µg/m³)" },
  { path: "environment.forest_area_pct", label: "Forest Area (%)" },
  // Migration
  { path: "migration.forcibly_displaced", label: "Forcibly Displaced (M)" },
  { path: "migration.refugees_hosted", label: "Refugees Hosted (M)" },
  { path: "migration.idps_conflict", label: "Conflict IDPs (M)" },
  { path: "migration.idps_disaster_new", label: "Disaster IDPs (new, M)" },
  // Security
  { path: "security.homicide_rate_per100k", label: "Homicide Rate (/100k)" },
  { path: "security.homicide_female_per100k", label: "Female Homicide Rate (/100k)" },
  { path: "security.homicide_male_per100k", label: "Male Homicide Rate (/100k)" },
  { path: "security.femicides_per_year", label: "Femicides (per year)" },
  { path: "security.killings_by_police", label: "Killings by Police" },
  // Justice
  { path: "justice.prison_rate_per_100k", label: "Prison Rate (/100k)" },
  { path: "justice.prison_population", label: "Prison Population" },
  { path: "justice.pre_trial_pct", label: "Pre-Trial Detention (%)" },
  { path: "justice.prison_overcrowding_pct", label: "Prison Overcrowding (%)" },
  { path: "justice.rule_of_law_index", label: "Rule of Law Index" },
  // Demographics
  { path: "demographics.population", label: "Population" },
  { path: "demographics.urban_pct", label: "Urban Population (%)" },
  { path: "demographics.median_age", label: "Median Age" },
  { path: "demographics.youth_unemployment_pct", label: "Youth Unemployment (%)" },
  // Gender
  { path: "gender.women_parliament_pct", label: "Women in Parliament (%)" },
  { path: "gender.female_labor_force_pct", label: "Female Labor Force (%)" },
  // Mental health
  { path: "mental_health.suicide_rate_per100k", label: "Suicide Rate (/100k)" },
  { path: "mental_health.psychiatrists_per100k", label: "Psychiatrists (/100k)" },
];

/** Resolve a dotted path from a CountryData record. */
function readPath(c: CountryData, path: string): unknown {
  let node: unknown = c;
  for (const part of path.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

const STATUS_COLOR: Record<DataCorrection["status"], string> = {
  open: "var(--color-warning-amber)",
  verified: "var(--color-terminal-green)",
  rejected: "var(--color-blood-bright)",
};

export default function TheCorrectionsPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-blood-bright text-xs animate-pulse">// LOADING...</div>}>
      <CorrectionsLedger />
    </React.Suspense>
  );
}

function CorrectionsLedger() {
  const searchParams = useSearchParams();
  const urlIso3 = searchParams.get("iso3") ?? "";
  const urlMetric = searchParams.get("metric") ?? "";

  const [query, setQuery] = useState("");
  const [iso3, setIso3] = useState<string>(() =>
    data.countries.some((c) => c.iso3.toUpperCase() === urlIso3.toUpperCase())
      ? urlIso3.toUpperCase()
      : "BRA",
  );
  const [metricPath, setMetricPath] = useState<string>(() =>
    METRIC_FIELDS.some((m) => m.path === urlMetric) ? urlMetric : "hunger.prevalence_pct",
  );
  const [correctedValue, setCorrectedValue] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [note, setNote] = useState("");
  const [version, setVersion] = useState(0);
  const [statusFilter, setStatusFilter] = useState<"all" | DataCorrection["status"]>("all");
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (urlIso3 && data.countries.some((c) => c.iso3.toUpperCase() === urlIso3.toUpperCase())) {
      setIso3(urlIso3.toUpperCase());
    }
    if (urlMetric && METRIC_FIELDS.some((m) => m.path === urlMetric)) {
      setMetricPath(urlMetric);
    }
  }, [urlIso3, urlMetric]);

  const country = data.countries.find((c) => c.iso3 === iso3) ?? null;
  const metric = METRIC_FIELDS.find((m) => m.path === metricPath) ?? null;
  const reported = country && metric ? readPath(country, metric.path) : undefined;
  const reportedStr =
    reported === undefined || reported === null
      ? "—"
      : typeof reported === "number"
        ? String(reported)
        : String(reported);

  const filteredCountries = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return data.countries
      .filter(
        (c) =>
          c.name_en.toLowerCase().includes(q) ||
          c.name_pt.toLowerCase().includes(q) ||
          c.iso3.toLowerCase().includes(q),
      )
      .sort((a, b) => a.name_en.localeCompare(b.name_en))
      .slice(0, 10);
  }, [query]);

  const corrections = useMemo(() => {
    void version;
    let list = listCorrections();
    if (statusFilter !== "all") list = list.filter((c) => c.status === statusFilter);
    if (countryFilter !== "all") list = list.filter((c) => c.iso3 === countryFilter);
    return list;
  }, [version, statusFilter, countryFilter]);

  const stats = useMemo(() => {
    void version;
    return correctionStats();
  }, [version]);

  const handleSubmit = useCallback(async () => {
    if (!country || !metric || !correctedValue.trim()) {
      sound.error();
      return;
    }
    await addCorrection({
      iso3: country.iso3,
      countryName: country.name_en,
      metricPath: metric.path,
      metricLabel: metric.label,
      reportedValue: reportedStr,
      correctedValue: correctedValue.trim(),
      sourceUrl: sourceUrl.trim() || undefined,
      note: note.trim() || undefined,
    });
    sound.success();
    setCorrectedValue("");
    setSourceUrl("");
    setNote("");
    setCountryFilter("all");
    setStatusFilter("all");
    refresh();
  }, [country, metric, correctedValue, sourceUrl, note, reportedStr, refresh]);

  const handleExport = useCallback(() => {
    if (typeof window === "undefined") return;
    sound.success();
    const pkg = buildCorrectionPackage(listCorrections());
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vforx-corrections-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, []);

  const handleImport = useCallback(() => {
    let parsed: CorrectionPackage | null = null;
    try {
      parsed = parseCorrectionPackage(JSON.parse(importText.trim()));
    } catch {
      parsed = null;
    }
    if (!parsed) {
      sound.error();
      setImportMsg("INVALID PACKAGE — expected format: vfx-corrections v1");
      return;
    }
    const n = importCorrectionPackage(parsed);
    sound.success();
    setImportMsg(`IMPORTED ${n} NEW CORRECTION${n === 1 ? "" : "S"} (duplicates skipped)`);
    setImportText("");
    refresh();
  }, [importText, refresh]);

  return (
    <main className="min-h-dvh max-w-6xl mx-auto px-3 sm:px-5 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-terminal-green mb-1">
          &gt; MODULE: COMMUNITY-VERIFIED DATA
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-blood-bright mb-2">
          The Corrections Ledger
        </h1>
        <p className="text-sm text-content-secondary max-w-3xl">
          Spot a number that does not match ground truth? Flag it. Corrections
          are stored on-device, signed with an ephemeral key (authenticity
          without identity), and exportable as a portable package for editors,
          mirrors, or the mesh. The backbone stays authoritative — this is a
          review layer on top.
        </p>
      </header>

      {/* ── Stats ── */}
      <TerminalCard title="LEDGER STATE" accent="green" className="mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold text-content-primary">{stats.total}</div>
            <div className="text-xs text-content-dim mt-1">TOTAL CORRECTIONS</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-warning-amber">{stats.byStatus.open}</div>
            <div className="text-xs text-content-dim mt-1">OPEN</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-terminal-green">{stats.byStatus.verified}</div>
            <div className="text-xs text-content-dim mt-1">VERIFIED</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blood-bright">{stats.byStatus.rejected}</div>
            <div className="text-xs text-content-dim mt-1">REJECTED</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4 text-[11px] text-content-dim">
          <span>COVERING {stats.byCountry} COUNTRIES</span>
          <span>·</span>
          <span>{stats.signed}/{stats.total} SIGNED</span>
          <span className="flex-1" />
          <Link href="/the-data-health/" className="text-command-bright hover:underline">
            → cross-ref DATA HEALTH coverage
          </Link>
        </div>
      </TerminalCard>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── SUBMIT FORM ── */}
        <TerminalCard title="[ FLAG A DATA POINT ]" accent="amber">
          <div className="space-y-4">
            {/* Country */}
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-content-dim mb-1">
                COUNTRY
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search 200 countries…"
                  className="w-full bg-void border border-border-dim text-content-primary text-sm px-3 py-2 focus:border-blood focus:outline-none"
                />
                {filteredCountries.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 border border-border-dim bg-void max-h-48 overflow-y-auto">
                    {filteredCountries.map((c) => (
                      <button
                        key={c.iso3}
                        onClick={() => {
                          setIso3(c.iso3);
                          setQuery("");
                          sound.select();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-panel border-b border-border-dim"
                      >
                        <span className="font-bold text-content-secondary w-8">{c.iso3}</span>
                        <span className="text-content-primary">{c.name_en}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-[10px] text-content-dim mt-1">
                {country ? `${country.name_en} (${country.iso3}) · ${country.region}` : "—"}
              </div>
            </div>

            {/* Metric */}
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-content-dim mb-1">
                METRIC
              </label>
              <select
                value={metricPath}
                onChange={(e) => setMetricPath(e.target.value)}
                className="w-full bg-void border border-border-dim text-content-secondary text-sm px-3 py-2 focus:border-blood focus:outline-none"
              >
                {METRIC_FIELDS.map((m) => (
                  <option key={m.path} value={m.path}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Reported vs corrected */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-widest text-content-dim mb-1">
                  CURRENT VALUE (READ-ONLY)
                </label>
                <div className="w-full bg-abyss border border-border-dim text-content-secondary text-sm px-3 py-2">
                  {reportedStr}
                </div>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-widest text-content-dim mb-1">
                  PROPOSED VALUE *
                </label>
                <input
                  type="text"
                  value={correctedValue}
                  onChange={(e) => setCorrectedValue(e.target.value)}
                  placeholder="e.g. 38.7"
                  className="w-full bg-void border border-border-dim text-content-primary text-sm px-3 py-2 focus:border-blood focus:outline-none"
                />
              </div>
            </div>

            {/* Source */}
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-content-dim mb-1">
                SOURCE URL
              </label>
              <input
                type="text"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://… (supporting evidence)"
                className="w-full bg-void border border-border-dim text-content-primary text-sm px-3 py-2 focus:border-blood focus:outline-none"
              />
            </div>

            {/* Note */}
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-content-dim mb-1">
                NOTE
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why is the current figure wrong?"
                rows={2}
                className="w-full bg-void border border-border-dim text-content-primary text-sm px-3 py-2 focus:border-blood focus:outline-none resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!country || !metric || !correctedValue.trim()}
              className="w-full px-4 py-2.5 text-sm font-bold border border-warning-amber text-warning-amber hover:bg-warning-amber hover:text-void transition-colors disabled:opacity-40"
            >
              ⚠ SUBMIT CORRECTION
            </button>
            <p className="text-[10px] text-content-dim">
              Corrections are signed on-device with an ephemeral ECDSA key. Nothing leaves
              your browser until you export.
            </p>
          </div>
        </TerminalCard>

        {/* ── EXPORT / IMPORT ── */}
        <TerminalCard title="[ DISTRIBUTE PACKAGE ]" accent="green">
          <div className="space-y-4">
            <div>
              <p className="text-xs text-content-secondary leading-relaxed mb-3">
                Export every stored correction as a portable, pull-request-style JSON
                package. Import packages from peers, mirrors, or the mesh — entries are
                deduped by id and merged into the local ledger.
              </p>
              <button
                onClick={handleExport}
                disabled={stats.total === 0}
                className="w-full px-4 py-2.5 text-sm font-bold border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void transition-colors disabled:opacity-40"
              >
                ⬇ EXPORT LEDGER ({stats.total})
              </button>
            </div>
            <div>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='Paste a {"format":"vfx-corrections",...} package…'
                rows={4}
                className="w-full bg-void border border-border-dim text-content-primary text-sm px-3 py-2 focus:border-terminal-green focus:outline-none resize-none"
              />
              <button
                onClick={handleImport}
                disabled={!importText.trim()}
                className="w-full px-4 py-2.5 text-sm font-bold border border-command text-command hover:bg-command hover:text-void transition-colors disabled:opacity-40 mt-2"
              >
                ⇩ IMPORT PACKAGE
              </button>
              {importMsg && (
                <p className="text-[11px] mt-2 text-terminal-green">{importMsg}</p>
              )}
            </div>
            <button
              onClick={() => {
                if (confirm("Delete ALL stored corrections? This cannot be undone.")) {
                  clearCorrections();
                  sound.error();
                  refresh();
                }
              }}
              className="text-[10px] text-content-dim hover:text-blood-bright transition-colors"
            >
              [ clear local ledger ]
            </button>
          </div>
        </TerminalCard>
      </div>

      {/* ── LEDGER LIST ── */}
      <TerminalCard title={`LEDGER — ${corrections.length} ENTRIES`} accent="blood" className="mt-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-1 text-xs">
            {(["all", "open", "verified", "rejected"] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s);
                  sound.select();
                }}
                className="px-2.5 py-1 border transition-colors uppercase tracking-widest"
                style={{
                  borderColor: s === statusFilter ? "var(--color-blood)" : "var(--color-border-dim)",
                  color: s === statusFilter ? "var(--color-blood-bright)" : "var(--color-content-secondary)",
                  background: s === statusFilter ? "rgba(196,43,62,0.08)" : "transparent",
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="bg-void border border-border-dim text-content-secondary text-xs px-2 py-1 focus:border-blood focus:outline-none"
          >
            <option value="all">ALL COUNTRIES</option>
            {[...new Set(listCorrections().map((c) => c.iso3))]
              .sort()
              .map((iso) => (
                <option key={iso} value={iso}>
                  {iso}
                </option>
              ))}
          </select>
        </div>

        {corrections.length === 0 ? (
          <div className="text-center text-content-dim text-sm py-8">
            No corrections stored yet. Flag a data point above.
          </div>
        ) : (
          <div className="space-y-2">
            {corrections.map((c) => (
              <div key={c.id} className="border border-border-dim p-3">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-content-dim">{c.iso3}</span>
                  <span className="text-xs font-bold text-content-primary">{c.metricLabel}</span>
                  <span className="text-[9px] px-1.5 py-0.5 uppercase border"
                    style={{ color: STATUS_COLOR[c.status], borderColor: STATUS_COLOR[c.status] }}>
                    {c.status}
                  </span>
                  {c.signature && c.handle && (
                    <span className="text-[9px] text-terminal-green" title="Ephemeral ECDSA signature present">
                      ✓ SIGNED · {c.handle}
                    </span>
                  )}
                  <span className="flex-1" />
                  <span className="text-[9px] text-content-dim">
                    {new Date(c.ts).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-[11px] text-content-secondary">
                  <span className="text-content-dim">reported:</span>{" "}
                  <span className="line-through opacity-70">{c.reportedValue}</span>
                  {"  →  "}
                  <span className="font-bold text-content-primary">{c.correctedValue}</span>
                </div>
                {(c.sourceUrl || c.note) && (
                  <div className="text-[10px] text-content-dim mt-1 space-y-0.5">
                    {c.sourceUrl && (
                      <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer"
                        className="text-command-bright hover:underline block truncate">
                        {c.sourceUrl}
                      </a>
                    )}
                    {c.note && <div>{c.note}</div>}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => { updateCorrectionStatus(c.id, "verified"); sound.success(); refresh(); }}
                    disabled={c.status === "verified"}
                    className="text-[10px] px-2 py-0.5 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void disabled:opacity-30"
                  >
                    ✓ VERIFY
                  </button>
                  <button
                    onClick={() => { updateCorrectionStatus(c.id, "rejected"); sound.error(); refresh(); }}
                    disabled={c.status === "rejected"}
                    className="text-[10px] px-2 py-0.5 border border-blood text-blood-bright hover:bg-blood hover:text-void disabled:opacity-30"
                  >
                    ✗ REJECT
                  </button>
                  <button
                    onClick={() => { updateCorrectionStatus(c.id, "open"); sound.select(); refresh(); }}
                    disabled={c.status === "open"}
                    className="text-[10px] px-2 py-0.5 border border-warning-amber text-warning-amber hover:bg-warning-amber hover:text-void disabled:opacity-30"
                  >
                    ↺ REOPEN
                  </button>
                  <span className="flex-1" />
                  <button
                    onClick={() => { deleteCorrection(c.id); sound.error(); refresh(); }}
                    className="text-[10px] text-content-dim hover:text-blood-bright"
                  >
                    [ delete ]
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </TerminalCard>
    </main>
  );
}
