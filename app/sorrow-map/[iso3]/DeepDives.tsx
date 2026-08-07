"use client";

import { useMemo } from "react";
import Link from "next/link";
import TerminalCard from "@/components/ui/TerminalCard";
import DataBar from "@/components/ui/DataBar";
import StatusPill from "@/components/ui/StatusPill";
import type { CountryData } from "@/lib/types";
import { formatNumber, formatMoney } from "@/lib/format";

/* ═══════════════════════════════════════════════════════════════
   SHARED HELPERS
   ═══════════════════════════════════════════════════════════════ */

function MiniStat({
  label,
  value,
  sub,
  accent = "primary",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "blood" | "amber" | "green" | "primary";
}) {
  const colorClass =
    accent === "blood"
      ? "text-blood-bright"
      : accent === "amber"
        ? "text-warning-amber"
        : accent === "green"
          ? "text-terminal-green"
          : "text-content-primary";
  return (
    <div className="border border-border-dim bg-void/50 p-2">
      <div className="text-[9px] text-content-dim uppercase tracking-widest">
        {label}
      </div>
      <div className={`text-base font-bold mt-0.5 ${colorClass}`}>{value}</div>
      {sub && <div className="text-[9px] text-content-secondary mt-0.5">{sub}</div>}
    </div>
  );
}

function InsightBanner({
  severity,
  children,
}: {
  severity: "critical" | "warning" | "stable" | "info";
  children: React.ReactNode;
}) {
  const styles = {
    critical: {
      border: "border-blood",
      bg: "bg-blood/5",
      pill: "blood" as const,
      label: "CRITICAL",
    },
    warning: {
      border: "border-warning-amber",
      bg: "bg-warning-amber/5",
      pill: "amber" as const,
      label: "WARNING",
    },
    stable: {
      border: "border-terminal-green",
      bg: "bg-terminal-green/5",
      pill: "green" as const,
      label: "STABLE",
    },
    info: {
      border: "border-border-bright",
      bg: "bg-panel-hi/30",
      pill: "dim" as const,
      label: "CONTEXT",
    },
  };
  const s = styles[severity];
  return (
    <div className={`border ${s.border} ${s.bg} p-2 flex items-start gap-2`}>
      <StatusPill color={s.pill}>{s.label}</StatusPill>
      <div className="text-[11px] text-content-secondary flex-1 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   1. MIGRATION & DISPLACEMENT DEEP-DIVE
   Cross-references migration fields with 22 WFP hotspots
   ═══════════════════════════════════════════════════════════════ */

export function MigrationDeepDive({
  country,
  hotspotIso3s,
}: {
  country: CountryData;
  hotspotIso3s: Set<string>;
}) {
  const m = country.migration;
  const pop = country.demographics.population;

  const derived = useMemo(() => {
    const forcedPctOfPop =
      m.forcibly_displaced !== null && pop > 0
        ? (m.forcibly_displaced / pop) * 100
        : null;
    const refugeesOutPer100k =
      m.refugees_origin !== null && pop > 0
        ? (m.refugees_origin / pop) * 100000
        : null;
    const refugeesInPer100k =
      m.refugees_hosted !== null && pop > 0
        ? (m.refugees_hosted / pop) * 100000
        : null;
    const netMigPer1k =
      m.net_migration !== null && pop > 0
        ? (m.net_migration / pop) * 1000
        : null;
    const isOriginCountry = (m.refugees_origin ?? 0) > (m.refugees_hosted ?? 0);
    const isHostCountry = (m.refugees_hosted ?? 0) > (m.refugees_origin ?? 0);
    return {
      forcedPctOfPop,
      refugeesOutPer100k,
      refugeesInPer100k,
      netMigPer1k,
      isOriginCountry,
      isHostCountry,
    };
  }, [m, pop]);

  const severity = useMemo(() => {
    if (derived.forcedPctOfPop !== null && derived.forcedPctOfPop > 20)
      return "critical" as const;
    if (derived.forcedPctOfPop !== null && derived.forcedPctOfPop > 5)
      return "warning" as const;
    if ((m.refugees_hosted ?? 0) > 500000) return "info" as const;
    return "stable" as const;
  }, [derived, m]);

  const linkedHotspots = useMemo(
    () => [...hotspotIso3s].filter((iso) => iso !== country.iso3).slice(0, 6),
    [hotspotIso3s, country.iso3]
  );

  return (
    <TerminalCard title="MIGRATION & DISPLACEMENT // DEEP DIVE" accent="amber">
      <div className="space-y-3">
        <InsightBanner severity={severity}>
          {derived.isOriginCountry && m.refugees_origin !== null && (
            <>
              This country is a major <strong className="text-blood-bright">displacement origin</strong> —{" "}
              {formatNumber(m.refugees_origin)} refugees abroad
              {derived.refugeesOutPer100k !== null && (
                <> ({derived.refugeesOutPer100k.toFixed(0)} per 100k population)</>
              )}
              .
            </>
          )}
          {derived.isHostCountry && m.refugees_hosted !== null && (
            <>
              This country is a major <strong className="text-terminal-green">refugee host</strong> — sheltering{" "}
              {formatNumber(m.refugees_hosted)} refugees
              {derived.refugeesInPer100k !== null && (
                <> ({derived.refugeesInPer100k.toFixed(0)} per 100k population)</>
              )}
              .
            </>
          )}
          {!derived.isOriginCountry && !derived.isHostCountry && (
            <>Displacement footprint is relatively limited.</>
          )}
          {derived.forcedPctOfPop !== null && derived.forcedPctOfPop > 5 && (
            <>
              {" "}
              <strong className="text-blood-bright">{derived.forcedPctOfPop.toFixed(1)}%</strong> of the total population is forcibly displaced.
            </>
          )}
        </InsightBanner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <MiniStat
            label="Forcibly Displaced"
            value={formatNumber(m.forcibly_displaced)}
            sub={
              derived.forcedPctOfPop !== null
                ? `${derived.forcedPctOfPop.toFixed(1)}% of pop.`
                : undefined
            }
            accent={derived.forcedPctOfPop !== null && derived.forcedPctOfPop > 10 ? "blood" : "amber"}
          />
          <MiniStat
            label="Refugees (Origin)"
            value={formatNumber(m.refugees_origin)}
            sub="Citizens abroad"
            accent="blood"
          />
          <MiniStat
            label="Refugees (Hosted)"
            value={formatNumber(m.refugees_hosted)}
            sub="Sheltered here"
            accent="green"
          />
          <MiniStat
            label="Net Migration"
            value={formatNumber(m.net_migration)}
            sub={
              derived.netMigPer1k !== null
                ? `${derived.netMigPer1k >= 0 ? "+" : ""}${derived.netMigPer1k.toFixed(1)} /1k pop.`
                : undefined
            }
            accent={(m.net_migration ?? 0) < 0 ? "blood" : "green"}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <DataBar
            value={m.idps_disaster_new ?? 0}
            max={Math.max(m.idps_disaster_new ?? 0, 1000000)}
            label="IDPs (Disaster, New)"
          />
          <DataBar
            value={Math.abs(m.refugees_origin ?? 0)}
            max={Math.max(Math.abs(m.refugees_origin ?? 0), Math.abs(m.refugees_hosted ?? 0), 100000)}
            label="Refugee Outflow"
          />
        </div>

        {/* Direction indicator */}
        <div className="flex items-center gap-2 p-2 border border-border-dim bg-void/50">
          <span className="text-[9px] text-content-dim uppercase">Flow direction:</span>
          {(m.net_migration ?? 0) < 0 ? (
            <span className="text-blood-bright text-xs font-bold">◀ OUTFLOW (people leaving)</span>
          ) : (m.net_migration ?? 0) > 0 ? (
            <span className="text-terminal-green text-xs font-bold">INFLOW (people arriving) ▶</span>
          ) : (
            <span className="text-content-dim text-xs">≈ BALANCED</span>
          )}
        </div>

        {/* Hotspot link */}
        {country.is_hotspot && (
          <div className="p-2 border border-blood-dim bg-blood/5">
            <div className="text-[9px] text-blood-bright uppercase tracking-widest mb-1">
              ◆ WFP-CLASSIFIED CRISIS HOTSPOT
            </div>
            <div className="text-[10px] text-content-secondary">
              This country appears in the global hunger hotspot registry.{" "}
              <Link href="/sorrow-map/" className="text-terminal-green underline">
                View all 22 hotspots →
              </Link>
            </div>
          </div>
        )}
        {!country.is_hotspot && linkedHotspots.length > 0 && (
          <div className="p-2 border border-border-dim bg-void/50">
            <div className="text-[9px] text-content-dim uppercase tracking-widest mb-1">
              Nearby crisis hotspots
            </div>
            <div className="flex flex-wrap gap-1">
              {linkedHotspots.map((iso) => (
                <Link
                  key={iso}
                  href={`/sorrow-map/${iso.toLowerCase()}/`}
                  className="text-[10px] px-1.5 py-0.5 border border-border-dim hover:border-blood text-content-secondary hover:text-blood-bright transition-all"
                >
                  {iso}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </TerminalCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   2. GOVERNANCE & CORRUPTION DEEP-DIVE
   Feeds Registry — contextualizes corruption vs democracy
   ═══════════════════════════════════════════════════════════════ */

export function GovernanceDeepDive({ country }: { country: CountryData }) {
  const g = country.governance;

  const derived = useMemo(() => {
    const cpi = g.corruption_perceptions_index;
    const cpiTier =
      cpi === null
        ? "unknown"
        : cpi >= 70
          ? "clean"
          : cpi >= 50
            ? "moderate"
            : cpi >= 30
              ? "corrupt"
              : "highly-corrupt";
    const demoIdx = g.electoral_democracy_index;
    const demoTier =
      demoIdx === null
        ? "unknown"
        : demoIdx >= 0.7
          ? "democracy"
          : demoIdx >= 0.4
            ? "hybrid"
            : "autocracy";
    const polCorr = g.political_corruption_index;
    const polCorrPct =
      polCorr !== null ? Math.round(polCorr * 100) : null;
    return { cpiTier, demoTier, polCorrPct };
  }, [g]);

  const tierLabel: Record<string, string> = {
    clean: "RELATIVELY CLEAN",
    moderate: "MODERATE CORRUPTION",
    corrupt: "HIGH CORRUPTION",
    "highly-corrupt": "EXTREME CORRUPTION",
    unknown: "NO DATA",
  };
  const demoLabel: Record<string, string> = {
    democracy: "DEMOCRATIC",
    hybrid: "HYBRID REGIME",
    autocracy: "AUTOCRATIC",
    unknown: "NO DATA",
  };

  const severity = useMemo(() => {
    if (derived.cpiTier === "highly-corrupt" || derived.demoTier === "autocracy")
      return "critical" as const;
    if (derived.cpiTier === "corrupt" || derived.demoTier === "hybrid")
      return "warning" as const;
    return "stable" as const;
  }, [derived]);

  return (
    <TerminalCard title="GOVERNANCE & CORRUPTION // DEEP DIVE" accent="blood">
      <div className="space-y-3">
        <InsightBanner severity={severity}>
          {derived.cpiTier === "highly-corrupt" && (
            <>
              CPI of <strong className="text-blood-bright">{g.corruption_perceptions_index}/100</strong> indicates extreme systemic corruption.
              Resources routed here face high risk of diversion.{" "}
              <Link href="/registry/" className="text-terminal-green underline">
                Document in Registry →
              </Link>
            </>
          )}
          {derived.cpiTier === "corrupt" && (
            <>
              CPI of <strong className="text-warning-amber">{g.corruption_perceptions_index}/100</strong> signals significant governance deficits requiring accountability mechanisms.
            </>
          )}
          {derived.cpiTier === "moderate" && (
            <>Governance is functional but with room for improvement (CPI {g.corruption_perceptions_index}/100).</>
          )}
          {derived.cpiTier === "clean" && (
            <>Strong governance framework (CPI {g.corruption_perceptions_index}/100) — low diversion risk.</>
          )}
          {derived.cpiTier === "unknown" && (
            <>Insufficient governance data for this country.</>
          )}
        </InsightBanner>

        <div className="grid grid-cols-3 gap-2">
          <div className={`border p-2 text-center ${
            derived.cpiTier === "highly-corrupt" || derived.cpiTier === "corrupt"
              ? "border-blood bg-blood/5"
              : derived.cpiTier === "clean"
                ? "border-terminal-green bg-terminal-green/5"
                : "border-border-dim bg-void/50"
          }`}>
            <div className="text-[9px] text-content-dim uppercase">CPI Tier</div>
            <div className={`text-xs font-bold mt-1 ${
              derived.cpiTier === "highly-corrupt" || derived.cpiTier === "corrupt"
                ? "text-blood-bright"
                : "text-terminal-green"
            }`}>
              {tierLabel[derived.cpiTier]}
            </div>
            <div className="text-[9px] text-content-secondary mt-0.5">
              {g.corruption_perceptions_index ?? "—"}/100
            </div>
          </div>
          <div className={`border p-2 text-center ${
            derived.demoTier === "autocracy"
              ? "border-blood bg-blood/5"
              : derived.demoTier === "democracy"
                ? "border-terminal-green bg-terminal-green/5"
                : "border-border-dim bg-void/50"
          }`}>
            <div className="text-[9px] text-content-dim uppercase">Regime Type</div>
            <div className={`text-xs font-bold mt-1 ${
              derived.demoTier === "autocracy"
                ? "text-blood-bright"
                : "text-terminal-green"
            }`}>
              {demoLabel[derived.demoTier]}
            </div>
            <div className="text-[9px] text-content-secondary mt-0.5">
              Idx: {g.electoral_democracy_index ?? "—"}
            </div>
          </div>
          <div className="border border-border-dim bg-void/50 p-2 text-center">
            <div className="text-[9px] text-content-dim uppercase">Pol. Corruption</div>
            <div className={`text-xs font-bold mt-1 ${
              derived.polCorrPct !== null && derived.polCorrPct > 60
                ? "text-blood-bright"
                : "text-warning-amber"
            }`}>
              {derived.polCorrPct !== null ? derived.polCorrPct + "%" : "—"}
            </div>
            <div className="text-[9px] text-content-secondary mt-0.5">
              V-Dem index
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <DataBar
            value={g.corruption_perceptions_index ?? 0}
            max={100}
            label="CPI (higher = cleaner)"
            unit="/100"
            inverse
          />
          <DataBar
            value={g.electoral_democracy_index ?? 0}
            max={1}
            label="Democracy Index"
            inverse
          />
        </div>

        <Link
          href="/registry/"
          className="block text-center text-xs py-2 border border-blood-dim text-blood-bright hover:bg-blood hover:text-void transition-all uppercase tracking-widest"
        >
          {">"} OPEN ACCOUNTABILITY DOSSIER
        </Link>
      </div>
    </TerminalCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   3. CLIMATE FOOTPRINT vs HUNGER VULNERABILITY
   Cross-references CO2/PM2.5 with undernourishment
   ═══════════════════════════════════════════════════════════════ */

export function ClimateHungerDeepDive({ country }: { country: CountryData }) {
  const cl = country.climate;
  const env = country.environment;
  const hunger = country.hunger;

  const derived = useMemo(() => {
    // Is this country a net emitter or a climate victim?
    const co2pc = cl.co2_per_capita_t;
    const isHighEmitter = co2pc !== null && co2pc > 5;
    const isLowEmitter = co2pc !== null && co2pc < 1;
    const isClimateVictim =
      hunger.undernourishment_pct !== null && hunger.undernourishment_pct > 10 && isLowEmitter;
    const isPolluterHungry =
      hunger.undernourishment_pct !== null &&
      hunger.undernourishment_pct > 10 &&
      isHighEmitter;
    const pm25 = env.air_pollution_pm25_ugm3;
    const pm25ExceedsWHO = pm25 !== null && pm25 > 15; // WHO 2021 guideline
    const pm25Severity =
      pm25 === null
        ? "unknown"
        : pm25 > 55
          ? "extreme"
          : pm25 > 35
            ? "high"
            : pm25 > 15
              ? "moderate"
              : "safe";
    return {
      isHighEmitter,
      isLowEmitter,
      isClimateVictim,
      isPolluterHungry,
      pm25ExceedsWHO,
      pm25Severity,
    };
  }, [cl, env, hunger]);

  const pm25Label: Record<string, string> = {
    safe: "WITHIN WHO LIMIT",
    moderate: "ABOVE WHO LIMIT",
    high: "HAZARDOUS",
    extreme: "EXTREME",
    unknown: "NO DATA",
  };

  const severity = useMemo(() => {
    if (derived.isClimateVictim || derived.pm25Severity === "extreme")
      return "critical" as const;
    if (derived.isPolluterHungry || derived.pm25Severity === "high")
      return "warning" as const;
    return "info" as const;
  }, [derived]);

  return (
    <TerminalCard title="CLIMATE FOOTPRINT vs HUNGER // DEEP DIVE" accent="green">
      <div className="space-y-3">
        <InsightBanner severity={severity}>
          {derived.isClimateVictim && (
            <>
              <strong className="text-blood-bright">Climate injustice pattern detected.</strong> This country emits minimal CO₂ ({cl.co2_per_capita_t}t/capita) yet suffers {hunger.undernourishment_pct}% undernourishment — it bears climate consequences without contributing to the cause.
            </>
          )}
          {derived.isPolluterHungry && (
            <>
              Anomalous profile: high per-capita emissions ({cl.co2_per_capita_t}t) coexist with significant hunger ({hunger.undernourishment_pct}% undernourishment) — domestic misallocation rather than climate victimhood.
            </>
          )}
          {!derived.isClimateVictim && !derived.isPolluterHungry && (
            <>
              CO₂ per capita: {cl.co2_per_capita_t ?? "—"}t.{" "}
              {derived.isHighEmitter
                ? "Above-average global emitter."
                : derived.isLowEmitter
                  ? "Low-emission country."
                  : ""}
            </>
          )}
          {derived.pm25ExceedsWHO && (
            <> Air pollution ({env.air_pollution_pm25_ugm3?.toFixed(1)} µg/m³) <strong className="text-warning-amber">exceeds WHO guidelines</strong> (15 µg/m³).</>
          )}
        </InsightBanner>

        <div className="grid grid-cols-2 gap-2">
          <MiniStat
            label="CO₂ Per Capita"
            value={cl.co2_per_capita_t !== null ? cl.co2_per_capita_t.toFixed(2) + " t" : "N/A"}
            sub={derived.isHighEmitter ? "High emitter" : derived.isLowEmitter ? "Low emitter" : undefined}
            accent={derived.isHighEmitter ? "amber" : "green"}
          />
          <MiniStat
            label="Undernourishment"
            value={hunger.undernourishment_pct !== null ? hunger.undernourishment_pct.toFixed(1) + "%" : "N/A"}
            sub="Hunger vulnerability"
            accent={hunger.undernourishment_pct !== null && hunger.undernourishment_pct > 10 ? "blood" : "primary"}
          />
        </div>

        {/* Climate justice matrix indicator */}
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className={`border p-2 ${derived.isLowEmitter ? "border-terminal-green bg-terminal-green/5" : "border-border-dim bg-void/50"}`}>
            <div className="text-[9px] text-content-dim uppercase">Emissions Role</div>
            <div className={`text-xs font-bold mt-1 ${derived.isLowEmitter ? "text-terminal-green" : derived.isHighEmitter ? "text-warning-amber" : "text-content-primary"}`}>
              {derived.isHighEmitter ? "POLLUTER" : derived.isLowEmitter ? "VICTIM" : "MODERATE"}
            </div>
          </div>
          <div className={`border p-2 ${hunger.undernourishment_pct !== null && hunger.undernourishment_pct > 10 ? "border-blood bg-blood/5" : "border-border-dim bg-void/50"}`}>
            <div className="text-[9px] text-content-dim uppercase">Hunger Status</div>
            <div className={`text-xs font-bold mt-1 ${hunger.undernourishment_pct !== null && hunger.undernourishment_pct > 10 ? "text-blood-bright" : "text-terminal-green"}`}>
              {hunger.undernourishment_pct !== null && hunger.undernourishment_pct > 10 ? "CRISIS" : "MANAGEABLE"}
            </div>
          </div>
        </div>

        {/* PM2.5 air pollution */}
        <div className={`border p-2 ${
          derived.pm25Severity === "extreme" || derived.pm25Severity === "high"
            ? "border-blood bg-blood/5"
            : derived.pm25Severity === "moderate"
              ? "border-warning-amber bg-warning-amber/5"
              : "border-border-dim bg-void/50"
        }`}>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-content-dim uppercase">Air Pollution (PM2.5)</span>
            <span className={`text-xs font-bold ${
              derived.pm25Severity === "extreme" || derived.pm25Severity === "high"
                ? "text-blood-bright"
                : derived.pm25Severity === "moderate"
                  ? "text-warning-amber"
                  : "text-terminal-green"
            }`}>
              {pm25Label[derived.pm25Severity]}
            </span>
          </div>
          {env.air_pollution_pm25_ugm3 !== null && (
            <div className="mt-1">
              <DataBar
                value={env.air_pollution_pm25_ugm3}
                max={60}
                label={`${env.air_pollution_pm25_ugm3.toFixed(1)} µg/m³ (WHO limit: 15)`}
                unit=" µg/m³"
              />
            </div>
          )}
        </div>
      </div>
    </TerminalCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   4. MILITARY vs HEALTH SPENDING RATIO
   Derives the guns-vs-butter ratio from both fields
   ═══════════════════════════════════════════════════════════════ */

export function MilitaryHealthDeepDive({ country }: { country: CountryData }) {
  const mil = country.military;
  const health = country.health;
  const econ = country.economy;

  const derived = useMemo(() => {
    const milUsd = mil.expenditure_usd;
    const healthUsd =
      health.expenditure_pct_gdp !== null && econ.gdp_usd !== null
        ? (health.expenditure_pct_gdp / 100) * econ.gdp_usd
        : null;
    const milToHealthRatio =
      milUsd !== null && healthUsd !== null && healthUsd > 0
        ? milUsd / healthUsd
        : null;
    const milPct = mil.pct_gdp;
    const healthPct = health.expenditure_pct_gdp;
    const pctRatio =
      milPct !== null && healthPct !== null && healthPct > 0
        ? milPct / healthPct
        : null;
    const gunsOverButter = milToHealthRatio !== null && milToHealthRatio > 1;
    const perCapitaMil =
      milUsd !== null && country.demographics.population > 0
        ? milUsd / country.demographics.population
        : null;
    return { milUsd, healthUsd, milToHealthRatio, pctRatio, gunsOverButter, perCapitaMil };
  }, [mil, health, econ, country.demographics.population]);

  const severity = useMemo(() => {
    if (derived.gunsOverButter) return "critical" as const;
    if (derived.milToHealthRatio !== null && derived.milToHealthRatio > 0.5)
      return "warning" as const;
    return "stable" as const;
  }, [derived]);

  return (
    <TerminalCard title="MILITARY vs HEALTH SPENDING // DEEP DIVE" accent="amber">
      <div className="space-y-3">
        <InsightBanner severity={severity}>
          {derived.milToHealthRatio !== null ? (
            derived.gunsOverButter ? (
              <>
                Military spending exceeds health spending by{" "}
                <strong className="text-blood-bright">{derived.milToHealthRatio.toFixed(2)}×</strong>.
                For every $1 on health, ${derived.milToHealthRatio.toFixed(2)} goes to military.
              </>
            ) : derived.milToHealthRatio > 0.5 ? (
              <>
                Military-to-health spending ratio is{" "}
                <strong className="text-warning-amber">{derived.milToHealthRatio.toFixed(2)}×</strong> — significant defense burden relative to healthcare investment.
              </>
            ) : (
              <>
                Health spending ({formatMoney(derived.healthUsd)}){" "}
                <strong className="text-terminal-green">outpaces</strong> military spending by{" "}
                <strong className="text-terminal-green">{(1 / derived.milToHealthRatio).toFixed(1)}×</strong>.
              </>
            )
          ) : (
            <>
              Military expenditure data {mil.expenditure_usd === null ? "unavailable" : "limited"} for this country.
              {mil.pct_gdp !== null && <> Military spending is {mil.pct_gdp.toFixed(1)}% of GDP.</>}
            </>
          )}
        </InsightBanner>

        {/* Side-by-side comparison bars */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-content-dim uppercase">Military Spending</span>
              <span className="text-warning-amber font-bold">
                {formatMoney(mil.expenditure_usd)}
                {mil.pct_gdp !== null && ` (${mil.pct_gdp.toFixed(1)}% GDP)`}
              </span>
            </div>
            <div className="w-full h-3 bg-void border border-border-dim">
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.min(100, (mil.pct_gdp ?? 0) * 5)}%`,
                  backgroundColor: "var(--color-warning-amber)",
                }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-content-dim uppercase">Health Spending</span>
              <span className="text-terminal-green font-bold">
                {derived.healthUsd !== null
                  ? formatMoney(derived.healthUsd)
                  : "N/A"}
                {health.expenditure_pct_gdp !== null && ` (${health.expenditure_pct_gdp.toFixed(1)}% GDP)`}
              </span>
            </div>
            <div className="w-full h-3 bg-void border border-border-dim">
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.min(100, (health.expenditure_pct_gdp ?? 0) * 5)}%`,
                  backgroundColor: "var(--color-terminal-green)",
                }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MiniStat
            label="Mil / Health Ratio"
            value={derived.milToHealthRatio !== null ? derived.milToHealthRatio.toFixed(2) + "×" : "N/A"}
            sub={derived.gunsOverButter ? "Military > Health" : "Health > Military"}
            accent={derived.gunsOverButter ? "blood" : "green"}
          />
          <MiniStat
            label="Military Per Capita"
            value={derived.perCapitaMil !== null ? "$" + derived.perCapitaMil.toFixed(0) : "N/A"}
            sub="Per citizen"
            accent="amber"
          />
        </div>

        {derived.gunsOverButter && (
          <Link
            href="/equation/"
            className="block text-center text-xs py-2 border border-blood-dim text-blood-bright hover:bg-blood hover:text-void transition-all uppercase tracking-widest"
          >
            {">"} REALLOCATE TO HUNGER SOLUTION
          </Link>
        )}
      </div>
    </TerminalCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   5. GENDER GAP DASHBOARD
   Analyzes female labor force and women in parliament
   ═══════════════════════════════════════════════════════════════ */

export function GenderDeepDive({ country }: { country: CountryData }) {
  const g = country.gender;

  const derived = useMemo(() => {
    const womenParl = g.women_parliament_pct;
    const parlTier =
      womenParl === null
        ? "unknown"
        : womenParl >= 40
          ? "parity"
          : womenParl >= 30
            ? "good"
            : womenParl >= 15
              ? "low"
              : "minimal";
    const femLF = g.female_labor_force_pct;
    const lfTier =
      femLF === null
        ? "unknown"
        : femLF >= 45
          ? "high"
          : femLF >= 30
            ? "moderate"
            : "low";
    const hasData = womenParl !== null || femLF !== null;
    const gapToParity = womenParl !== null ? Math.max(0, 50 - womenParl) : null;
    return { parlTier, lfTier, hasData, gapToParity };
  }, [g]);

  const parlLabel: Record<string, string> = {
    parity: "NEAR PARITY",
    good: "ABOVE AVERAGE",
    low: "UNDERREPRESENTED",
    minimal: "SEVERELY EXCLUDED",
    unknown: "NO DATA",
  };
  const lfLabel: Record<string, string> = {
    high: "HIGH PARTICIPATION",
    moderate: "MODERATE",
    low: "LOW PARTICIPATION",
    unknown: "NO DATA",
  };

  const severity = useMemo(() => {
    if (derived.parlTier === "minimal" || derived.lfTier === "low")
      return "warning" as const;
    if (derived.parlTier === "parity") return "stable" as const;
    return "info" as const;
  }, [derived]);

  if (!derived.hasData) {
    return (
      <TerminalCard title="GENDER GAP // DEEP DIVE" accent="amber">
        <div className="p-2 border border-border-dim bg-void/50 text-[11px] text-content-dim">
          {">"} Gender data unavailable for this country. Female labor force participation and parliamentary representation metrics are not reported.
        </div>
      </TerminalCard>
    );
  }

  return (
    <TerminalCard title="GENDER GAP // DEEP DIVE" accent="amber">
      <div className="space-y-3">
        <InsightBanner severity={severity}>
          {derived.parlTier === "minimal" && (
            <>
              Women hold only <strong className="text-blood-bright">{g.women_parliament_pct}%</strong> of parliamentary seats — severe political exclusion.
            </>
          )}
          {derived.parlTier === "low" && (
            <>
              Women hold {g.women_parliament_pct}% of parliamentary seats — below the 30% threshold considered minimum for meaningful representation.
            </>
          )}
          {derived.parlTier === "good" && (
            <>
              Women hold {g.women_parliament_pct}% of parliamentary seats — above the international recommended threshold.
            </>
          )}
          {derived.parlTier === "parity" && (
            <>
              Near gender parity in parliament ({g.women_parliament_pct}% women) — strong political representation.
            </>
          )}
          {derived.gapToParity !== null && derived.gapToParity > 5 && (
            <> Gap to 50% parity: {derived.gapToParity.toFixed(0)} percentage points.</>
          )}
        </InsightBanner>

        <div className="grid grid-cols-2 gap-2">
          <div className={`border p-2 text-center ${
            derived.parlTier === "minimal" || derived.parlTier === "low"
              ? "border-blood bg-blood/5"
              : derived.parlTier === "parity"
                ? "border-terminal-green bg-terminal-green/5"
                : "border-border-dim bg-void/50"
          }`}>
            <div className="text-[9px] text-content-dim uppercase">Parliament</div>
            <div className="text-lg font-bold mt-1 text-content-primary">
              {g.women_parliament_pct !== null ? g.women_parliament_pct.toFixed(1) + "%" : "—"}
            </div>
            <div className={`text-[9px] mt-0.5 ${
              derived.parlTier === "minimal" || derived.parlTier === "low"
                ? "text-blood-bright"
                : "text-terminal-green"
            }`}>
              {parlLabel[derived.parlTier]}
            </div>
          </div>
          <div className={`border p-2 text-center ${
            derived.lfTier === "low"
              ? "border-blood bg-blood/5"
              : derived.lfTier === "high"
                ? "border-terminal-green bg-terminal-green/5"
                : "border-border-dim bg-void/50"
          }`}>
            <div className="text-[9px] text-content-dim uppercase">Labor Force</div>
            <div className="text-lg font-bold mt-1 text-content-primary">
              {g.female_labor_force_pct !== null ? g.female_labor_force_pct.toFixed(1) + "%" : "—"}
            </div>
            <div className={`text-[9px] mt-0.5 ${
              derived.lfTier === "low"
                ? "text-blood-bright"
                : "text-terminal-green"
            }`}>
              {lfLabel[derived.lfTier]}
            </div>
          </div>
        </div>

        {/* Visual bars */}
        <div className="space-y-2">
          {g.women_parliament_pct !== null && (
            <DataBar
              value={g.women_parliament_pct}
              max={50}
              label="Women in Parliament"
              unit="%"
              inverse
            />
          )}
          {g.female_labor_force_pct !== null && (
            <DataBar
              value={g.female_labor_force_pct}
              max={50}
              label="Female Labor Force"
              unit="%"
              inverse
            />
          )}
        </div>

        {/* Parity target marker */}
        {g.women_parliament_pct !== null && (
          <div className="flex items-center gap-2 p-2 border border-border-dim bg-void/50">
            <span className="text-[9px] text-content-dim uppercase whitespace-nowrap">
              To 30% target:
            </span>
            <div className="flex-1 h-1.5 bg-void border border-border-dim relative">
              <div
                className="h-full"
                style={{ width: `${Math.min(100, (g.women_parliament_pct / 30) * 100)}%`, backgroundColor: "var(--color-warning-amber)" }}
              />
              <div
                className="absolute top-0 bottom-0 w-px bg-terminal-green"
                style={{ left: "100%" }}
                title="30% target"
              />
            </div>
            <span className="text-[9px] text-content-secondary">
              {g.women_parliament_pct >= 30 ? "✓ MET" : `${(30 - g.women_parliament_pct).toFixed(1)}pp gap`}
            </span>
          </div>
        )}
      </div>
    </TerminalCard>
  );
}
