"use client";

import { useMemo } from "react";
import Link from "next/link";
import TerminalCard from "@/components/ui/TerminalCard";
import DataBar from "@/components/ui/DataBar";
import StatusPill from "@/components/ui/StatusPill";
import type { CountryData } from "@/lib/types";
import { formatNumber, formatMoney } from "@/lib/format";
import { countryToBlueprints } from "@/lib/crosslinks";
import backbone from "@/data/world_backbone.json";
import blueprintsData from "@/data/blueprints.json";
import type { WorldBackbone } from "@/lib/types";

interface BlueprintDef {
  id: string;
  title: string;
  category: string;
}

const sdgData = backbone as WorldBackbone;

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

/* ═══════════════════════════════════════════════════════════════
   6. SDG SCORECARD — WHERE THIS COUNTRY SITS ON THE 6 EQUATIONS
   Cross-references country data with the 6 cross-domain SDG equations
   from /equation (water, health, energy, education, climate, inequality)
   ═══════════════════════════════════════════════════════════════ */

interface SdgRow {
  key: string;
  sdg: string;
  title: string;
  color: string;
  icon: string;
  /** the country's value for the key metric in this domain */
  countryValue: number | null;
  /** human-readable formatted value */
  countryDisplay: string;
  /** what the value means in plain language */
  context: string;
  /** severity of this domain for the country */
  severity: "critical" | "warning" | "stable" | "nodata";
  /** global equation cost + affordability */
  globalCost: string;
  globalPctMilitary: number;
  globalDays: number;
  /** the global gap label from the equation */
  globalGap: string;
  moral: string;
}

function buildSdgRows(country: CountryData): SdgRow[] {
  const rows: SdgRow[] = [];

  // ── SDG 6: Water ──
  const safeSan = country.water_sanitation.safe_sanitation_pct;
  const basicWater = country.water_sanitation.basic_access_pct;
  const waterVal = safeSan ?? basicWater;
  rows.push({
    key: "sdg6_water",
    sdg: "SDG 6",
    title: "Water & Sanitation",
    color: "#00ddff",
    icon: "💧",
    countryValue: waterVal,
    countryDisplay: safeSan !== null ? `${safeSan.toFixed(0)}% safe sanitation` : basicWater !== null ? `${basicWater.toFixed(0)}% basic water` : "N/A",
    context:
      safeSan !== null
        ? safeSan < 50
          ? "Critical — majority lacks safely managed sanitation"
          : safeSan < 75
            ? "Below global target"
            : "Near or above target"
        : basicWater !== null
          ? basicWater < 80
            ? "Critical — many lack even basic water"
            : "Basic water widely available"
          : "No data",
    severity:
      waterVal === null ? "nodata"
        : (safeSan ?? basicWater ?? 100) < 50 ? "critical"
        : (safeSan ?? basicWater ?? 100) < 75 ? "warning"
        : "stable",
    globalCost: "$114B/yr",
    globalPctMilitary: 4.7,
    globalDays: 17,
    globalGap: "3.9B without safe sanitation globally",
    moral: "Less than 5% of world military spending buys safe water for every human alive.",
  });

  // ── SDG 3: Health ──
  const docs = country.health.doctors_per_1000 ?? undefined;
  const whoThreshold = 4.45;
  const childMort = country.health.child_mortality_under5_per1k;
  rows.push({
    key: "sdg3_health",
    sdg: "SDG 3",
    title: "Healthcare Access",
    color: "#e10600",
    icon: "⚕",
    countryValue: docs ?? null,
    countryDisplay:
      docs !== undefined
        ? `${docs.toFixed(2)} doctors/1000`
        : childMort !== null
          ? `${childMort.toFixed(1)} child deaths/1k`
          : "N/A",
    context:
      docs !== undefined
        ? docs < whoThreshold
          ? `Below WHO threshold (${whoThreshold}/1000) — staffing crisis`
          : "Meets WHO staffing threshold"
        : childMort !== null
          ? childMort > 40
            ? "Critical child mortality"
            : childMort > 20
              ? "Elevated child mortality"
              : "Within healthy range"
          : "No data",
    severity:
      docs === undefined && childMort === null ? "nodata"
        : (docs ?? 0) < 1 || (childMort ?? 0) > 40 ? "critical"
        : (docs ?? 0) < whoThreshold || (childMort ?? 0) > 20 ? "warning"
        : "stable",
    globalCost: "$176B/yr",
    globalPctMilitary: 7.3,
    globalDays: 27,
    globalGap: "186 of 194 countries below WHO doctor threshold",
    moral: "For the cost of 27 days of global military spending, every person in the poorest countries could have healthcare.",
  });

  // ── SDG 7: Energy ──
  const noElec = country.energy?.no_access_electricity_m ?? null;
  const renewable = country.energy?.renewable_electric_pct ?? country.environment?.renewable_energy_pct ?? null;
  const energyVal = noElec !== null && noElec > 0 ? noElec : renewable;
  rows.push({
    key: "sdg7_energy",
    sdg: "SDG 7",
    title: "Energy Access",
    color: "#ffaa00",
    icon: "⚡",
    countryValue: energyVal,
    countryDisplay:
      noElec !== null && noElec > 0
        ? `${noElec}M without electricity`
        : renewable !== null
          ? `${renewable.toFixed(0)}% renewable`
          : "N/A",
    context:
      noElec !== null && noElec > 0
        ? `${noElec}M people in darkness`
        : renewable !== null
          ? renewable < 20
            ? "Low renewable share"
            : renewable > 60
              ? "Strong renewable transition"
              : "Moderate renewable mix"
          : "Universal or near-universal access",
    severity:
      noElec !== null && noElec > 0 ? "critical"
        : renewable !== null && renewable < 20 ? "warning"
        : "stable",
    globalCost: "$35B/yr",
    globalPctMilitary: 1.45,
    globalDays: 5,
    globalGap: "524M without electricity globally",
    moral: "5 days of world military spending would electrify the planet.",
  });

  // ── SDG 4: Education ──
  const literacy = country.education.literacy_rate_pct;
  const funcIllit = country.education.functional_illiteracy_pct;
  const eduVal = literacy;
  rows.push({
    key: "sdg4_education",
    sdg: "SDG 4",
    title: "Education",
    color: "#00ff41",
    icon: "📚",
    countryValue: eduVal,
    countryDisplay:
      literacy !== null
        ? `${literacy.toFixed(1)}% literacy`
        : funcIllit != null
          ? `${funcIllit.toFixed(0)}% functional illiteracy`
          : "N/A",
    context:
      literacy !== null
        ? literacy < 50
          ? "Critical — majority illiterate"
          : literacy < 80
            ? "Below global average"
            : "Near or above target"
        : funcIllit != null
          ? funcIllit > 30
            ? "High functional illiteracy"
            : "Moderate functional illiteracy"
          : "No data",
    severity:
      literacy === null && funcIllit == null ? "nodata"
        : (literacy ?? 0) < 50 || (funcIllit ?? 0) > 40 ? "critical"
        : (literacy ?? 100) < 80 ? "warning"
        : "stable",
    globalCost: "$97B/yr",
    globalPctMilitary: 4,
    globalDays: 15,
    globalGap: "1.1B illiterate adults globally",
    moral: "15 days of military spending covers a year of quality education for every child.",
  });

  // ── SDG 13: Climate ──
  const co2pc = country.climate.co2_per_capita_t;
  rows.push({
    key: "sdg13_climate",
    sdg: "SDG 13",
    title: "Climate",
    color: "#cc6600",
    icon: "🌍",
    countryValue: co2pc,
    countryDisplay:
      co2pc !== null ? `${co2pc.toFixed(2)} t CO₂/capita` : "N/A",
    context:
      co2pc === null ? "No data"
        : co2pc > 10 ? "Major emitter — high responsibility"
        : co2pc > 5 ? "Above global average emitter"
        : co2pc < 1 ? "Climate victim — minimal emissions"
        : "Moderate emitter",
    severity:
      co2pc === null ? "nodata"
        : co2pc > 10 ? "critical"
        : co2pc < 1 ? "stable"
        : "warning",
    globalCost: "$4.3T/yr",
    globalPctMilitary: 178,
    globalDays: 651,
    globalGap: "37.4 Gt CO₂/year — must reach net zero by 2050",
    moral: "The climate transition costs 1.8 years of total military spending. Inaction costs 10–100x more.",
  });

  // ── SDG 10: Inequality ──
  const gini = country.inequality.gini;
  const poverty = country.poverty.headcount_365_pct;
  rows.push({
    key: "sdg10_inequality",
    sdg: "SDG 10",
    title: "Inequality",
    color: "#aa44ff",
    icon: "⚖",
    countryValue: gini,
    countryDisplay:
      gini !== null
        ? `Gini ${gini.toFixed(1)}`
        : poverty !== null
          ? `${poverty.toFixed(0)}% in extreme poverty`
          : "N/A",
    context:
      gini === null && poverty === null ? "No data"
        : gini !== null
          ? gini > 50 ? "Extreme inequality"
          : gini > 40 ? "High inequality"
          : gini > 30 ? "Moderate inequality"
          : "Low inequality"
        : poverty != null && poverty > 30 ? "High extreme poverty"
        : "Lower poverty",
    severity:
      gini === null && poverty === null ? "nodata"
        : (gini ?? 0) > 50 || (poverty ?? 0) > 30 ? "critical"
        : (gini ?? 0) > 40 || (poverty ?? 0) > 15 ? "warning"
        : "stable",
    globalCost: "$313B/yr",
    globalPctMilitary: 13,
    globalDays: 47,
    globalGap: "1.5B in extreme poverty; richest 1% > bottom 50%",
    moral: "A 2% tax on the world's billionaires alone would fund water, electricity, AND education for everyone.",
  });

  return rows;
}

export function SdgScorecardDeepDive({ country }: { country: CountryData }) {
  const rows = useMemo(() => buildSdgRows(country), [country]);
  const eqMeta = sdgData.sdg_equations?.meta;

  // Count severity breakdown
  const severityCount = useMemo(() => {
    const counts = { critical: 0, warning: 0, stable: 0, nodata: 0 };
    for (const r of rows) counts[r.severity]++;
    return counts;
  }, [rows]);

  // Overall scorecard verdict
  const verdict = useMemo(() => {
    if (severityCount.critical >= 3) return { label: "MULTI-DIMENSIONAL CRISIS", severity: "critical" as const };
    if (severityCount.critical >= 1) return { label: "URGENT GAPS", severity: "critical" as const };
    if (severityCount.warning >= 3) return { label: "DEVELOPING CHALLENGES", severity: "warning" as const };
    if (severityCount.warning >= 1) return { label: "MINOR GAPS", severity: "warning" as const };
    return { label: "ON TARGET", severity: "stable" as const };
  }, [severityCount]);

  return (
    <TerminalCard title="SDG SCORECARD // 6 EQUATIONS" accent="green" glow>
      <div className="space-y-3">
        {/* Verdict banner */}
        <InsightBanner severity={verdict.severity === "critical" ? "critical" : verdict.severity === "warning" ? "warning" : "stable"}>
          <strong className={verdict.severity === "critical" ? "text-blood-bright" : verdict.severity === "warning" ? "text-warning-amber" : "text-terminal-green"}>
            {verdict.label}.
          </strong>{" "}
          {severityCount.critical > 0 && `${severityCount.critical} critical gap${severityCount.critical > 1 ? "s" : ""}`}
          {severityCount.critical > 0 && severityCount.warning > 0 && ", "}
          {severityCount.warning > 0 && `${severityCount.warning} warning${severityCount.warning > 1 ? "s" : ""}`}
          {(severityCount.critical > 0 || severityCount.warning > 0) && " across "}
          {(severityCount.critical > 0 || severityCount.warning > 0) && "the 6 SDG domains. "}
          Each domain below is fixable for less than a fraction of world military spending.
        </InsightBanner>

        {/* 6 domain scorecard rows */}
        <div className="space-y-2">
          {rows.map((row) => {
            const sevColor =
              row.severity === "critical" ? "var(--color-blood)"
              : row.severity === "warning" ? "var(--color-warning-amber)"
              : row.severity === "stable" ? "var(--color-terminal-green)"
              : "var(--color-content-dim)";
            const sevBg =
              row.severity === "critical" ? "bg-blood/5"
              : row.severity === "warning" ? "bg-warning-amber/5"
              : row.severity === "stable" ? "bg-terminal-green/5"
              : "bg-void/50";
            return (
              <div
                key={row.key}
                className={`border ${sevBg} p-2`}
                style={{ borderColor: row.severity === "nodata" ? "var(--color-border-dim)" : sevColor + "66" }}
              >
                {/* Row header */}
                <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{row.icon}</span>
                    <span className="text-[10px] font-mono px-1 py-0.5 border" style={{ borderColor: row.color, color: row.color }}>
                      {row.sdg}
                    </span>
                    <span className="text-xs font-bold text-content-primary">{row.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono" style={{ color: sevColor }}>
                      {row.countryDisplay}
                    </span>
                    <StatusPill color={row.severity === "critical" ? "blood" : row.severity === "warning" ? "amber" : row.severity === "stable" ? "green" : "dim"}>
                      {row.severity === "critical" ? "CRITICAL" : row.severity === "warning" ? "WARNING" : row.severity === "stable" ? "OK" : "N/A"}
                    </StatusPill>
                  </div>
                </div>
                {/* Context line */}
                <div className="text-[10px] text-content-secondary mb-1.5">{row.context}</div>
                {/* Global equation mini-bar */}
                <div className="flex items-center gap-2 text-[9px] text-content-dim">
                  <span className="text-blood-bright font-bold">{row.globalCost}</span>
                  <span>·</span>
                  <span>{row.globalPctMilitary}% military</span>
                  <span>·</span>
                  <span>{row.globalDays} days</span>
                  <span className="ml-auto italic truncate hidden sm:inline">{row.globalGap}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Global context */}
        {eqMeta?.quick_wins_total_billion && (
          <div className="border border-terminal-green bg-terminal-green/5 p-2 text-center">
            <div className="text-[10px] text-content-dim uppercase tracking-widest mb-0.5">
              THE GLOBAL EQUATION
            </div>
            <div className="text-sm text-terminal-green font-bold">
              ${eqMeta.quick_wins_total_billion}B/year
            </div>
            <div className="text-[10px] text-content-secondary">
              {eqMeta.quick_wins_label} = {eqMeta.quick_wins_pct_military}% of military ({eqMeta.quick_wins_days_military} days)
            </div>
          </div>
        )}

        {/* CTA */}
        <Link
          href="/equation/"
          className="block text-center text-xs py-2 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void transition-all uppercase tracking-widest"
        >
          {">"} EXPLORE ALL 6 EQUATIONS
        </Link>

        {/* Matched blueprints */}
        <BlueprintLinks country={country} />
      </div>
    </TerminalCard>
  );
}

/* Blueprint surfacing — data-to-blueprint bridge */
function BlueprintLinks({ country }: { country: CountryData }) {
  const matches = useMemo(() => countryToBlueprints(country), [country]);
  if (matches.length === 0) return null;

  const bpData = (blueprintsData as BlueprintDef[]);
  return (
    <div className="border border-border-dim bg-void/50 p-2">
      <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">
        MATCHED SURVIVAL BLUEPRINTS ({matches.length})
      </div>
      <div className="space-y-1">
        {matches.map((m) => {
          const bp = bpData.find((b) => b.id === m.blueprintId);
          const color =
            m.priority === "critical"
              ? "var(--color-blood)"
              : m.priority === "recommended"
                ? "var(--color-warning-amber)"
                : "var(--color-terminal-green)";
          return (
            <Link
              key={m.blueprintId}
              href={`/protocol-x/${m.blueprintId}/`}
              className="block p-1.5 border-l-2 hover:bg-panel transition-colors"
              style={{ borderColor: color }}
              onClick={() => undefined}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-[9px] font-bold uppercase px-1"
                  style={{ color }}
                >
                  {m.priority === "critical" ? "CRITICAL" : m.priority === "recommended" ? "REC" : "RES"}
                </span>
                <span className="text-xs text-content-primary font-bold">
                  {bp?.title ?? m.blueprintId}
                </span>
              </div>
              <div className="text-[10px] text-content-secondary mt-0.5">
                {m.reason}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
