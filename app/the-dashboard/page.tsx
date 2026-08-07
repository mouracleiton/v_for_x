"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, CountryData } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { formatNumber } from "@/lib/format";
import { calculateVulnerability, scoreColor, scoreLabel } from "@/lib/vulnerability";
import { COST_PER_MILLION_HUNGRY_B, MILITARY_PER_DAY_B } from "@/lib/choice";

const data = backbone as WorldBackbone;

/* ═══ EXTREME CONTRAST FINDER ═══ */

interface Contrast {
  label: string;
  left: { name: string; iso3: string; value: string; raw: number };
  right: { name: string; iso3: string; value: string; raw: number };
  ratio: number;
  ratioLabel: string;
}

function findContrasts(countries: CountryData[]): Contrast[] {
  const withData = countries.filter((c) => c.economy.gdp_per_capita_usd && c.health.life_expectancy);

  // GDP per capita contrast
  const sortedGdp = [...withData].sort((a, b) => (b.economy.gdp_per_capita_usd ?? 0) - (a.economy.gdp_per_capita_usd ?? 0));
  const richest = sortedGdp[0];
  const poorest = sortedGdp[sortedGdp.length - 1];
  const gdpRatio = (richest.economy.gdp_per_capita_usd ?? 1) / (poorest.economy.gdp_per_capita_usd ?? 1);

  // Life expectancy contrast
  const sortedLife = [...withData].sort((a, b) => (b.health.life_expectancy ?? 0) - (a.health.life_expectancy ?? 0));
  const longest = sortedLife[0];
  const shortest = sortedLife[sortedLife.length - 1];
  const lifeGap = (longest.health.life_expectancy ?? 0) - (shortest.health.life_expectancy ?? 0);

  // CO2 contrast
  const sortedCo2 = countries.filter((c) => c.climate.co2_per_capita_t).sort((a, b) => (b.climate.co2_per_capita_t ?? 0) - (a.climate.co2_per_capita_t ?? 0));
  const mostCo2 = sortedCo2[0];
  const leastCo2 = sortedCo2[sortedCo2.length - 1];
  const co2Ratio = (mostCo2.climate.co2_per_capita_t ?? 1) / (leastCo2.climate.co2_per_capita_t ?? 1);

  // Child mortality contrast
  const sortedMort = countries.filter((c) => c.health.child_mortality_under5_per1k).sort((a, b) => (b.health.child_mortality_under5_per1k ?? 0) - (a.health.child_mortality_under5_per1k ?? 0));
  const worstMort = sortedMort[0];
  const bestMort = sortedMort[sortedMort.length - 1];
  const mortRatio = (worstMort.health.child_mortality_under5_per1k ?? 1) / (bestMort.health.child_mortality_under5_per1k ?? 1);

  return [
    {
      label: "INCOME",
      left: { name: richest.name_en, iso3: richest.iso3, value: `$${formatNumber(richest.economy.gdp_per_capita_usd)}/yr`, raw: richest.economy.gdp_per_capita_usd ?? 0 },
      right: { name: poorest.name_en, iso3: poorest.iso3, value: `$${formatNumber(poorest.economy.gdp_per_capita_usd)}/yr`, raw: poorest.economy.gdp_per_capita_usd ?? 0 },
      ratio: gdpRatio,
      ratioLabel: `${gdpRatio.toFixed(0)}× income gap`,
    },
    {
      label: "LIFE EXPECTANCY",
      left: { name: longest.name_en, iso3: longest.iso3, value: `${longest.health.life_expectancy?.toFixed(1)} yrs`, raw: longest.health.life_expectancy ?? 0 },
      right: { name: shortest.name_en, iso3: shortest.iso3, value: `${shortest.health.life_expectancy?.toFixed(1)} yrs`, raw: shortest.health.life_expectancy ?? 0 },
      ratio: lifeGap,
      ratioLabel: `${lifeGap.toFixed(1)} years apart`,
    },
    {
      label: "CO₂ EMISSIONS",
      left: { name: mostCo2.name_en, iso3: mostCo2.iso3, value: `${mostCo2.climate.co2_per_capita_t?.toFixed(1)}t/cap`, raw: mostCo2.climate.co2_per_capita_t ?? 0 },
      right: { name: leastCo2.name_en, iso3: leastCo2.iso3, value: `${leastCo2.climate.co2_per_capita_t?.toFixed(2)}t/cap`, raw: leastCo2.climate.co2_per_capita_t ?? 0 },
      ratio: co2Ratio,
      ratioLabel: `${co2Ratio.toFixed(0)}× pollution gap`,
    },
    {
      label: "CHILD SURVIVAL",
      left: { name: bestMort.name_en, iso3: bestMort.iso3, value: `${bestMort.health.child_mortality_under5_per1k?.toFixed(1)}/1k`, raw: bestMort.health.child_mortality_under5_per1k ?? 0 },
      right: { name: worstMort.name_en, iso3: worstMort.iso3, value: `${worstMort.health.child_mortality_under5_per1k?.toFixed(1)}/1k`, raw: worstMort.health.child_mortality_under5_per1k ?? 0 },
      ratio: mortRatio,
      ratioLabel: `${mortRatio.toFixed(0)}× mortality gap`,
    },
  ];
}

/* ═══ LIVE COUNTER ═══ */
function useLiveCounter(start: number, perYear: number, active: boolean) {
  const [count, setCount] = useState(start);
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() / 1000) % 1;
      setCount(start + (elapsed * perYear) / (365 * 24 * 3600));
    }, 100);
    return () => clearInterval(interval);
  }, [start, perYear, active]);
  return count;
}

export default function TheDashboardPage() {
  const [animateCounters, setAnimateCounters] = useState(false);
  const contrasts = useMemo(() => findContrasts(data.countries), []);

  // Global aggregates
  const globalStats = useMemo(() => {
    const totalPop = data.countries.reduce((s, c) => s + c.demographics.population, 0);
    const totalUndernourished = data.global_indicators.hunger.undernourished_2024_m;
    const totalDisplaced = data.countries.reduce((s, c) => s + (c.migration.forcibly_displaced ?? 0), 0);
    const totalMilitary = data.countries.reduce((s, c) => s + (c.military.expenditure_usd ?? 0), 0);
    const totalBelowWhoMin = data.countries.filter((c) => (c.health.doctors_per_1000 ?? 0) < 4.45).length;
    const totalNoElectricity = data.countries.reduce((s, c) => s + (c.energy?.no_access_electricity_m ?? 0), 0);
    const totalIlliterate = data.countries.reduce((s, c) => {
      const lit = c.education.literacy_rate_pct;
      return s + (lit !== null ? c.demographics.population * (100 - lit) / 100 : 0);
    }, 0);

    // Worst and best country
    const ranked = data.countries
      .map((c) => ({ c, score: calculateVulnerability(c).composite }))
      .sort((a, b) => b.score - a.score);

    return {
      totalPop,
      totalUndernourished,
      totalDisplaced,
      totalMilitary,
      totalBelowWhoMin,
      totalNoElectricity,
      totalIlliterate,
      worst: ranked[0],
      best: ranked[ranked.length - 1],
    };
  }, []);

  // Live counters
  const militaryCounter = useLiveCounter(0, globalStats.totalMilitary, animateCounters);
  const hungerDeathsCounter = useLiveCounter(0, 9_000_000, animateCounters); // ~9M hunger-related deaths/yr

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[25] THE DASHBOARD</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood tracking-widest">
          THE DASHBOARD
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // One screen. The entire world&apos;s crisis. Updated in real time because it is happening in real time.
        </p>
      </div>

      {/* Live counters */}
      <TerminalCard title="LIVE COUNTERS // THE WORLD RIGHT NOW" accent="blood" glow className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => { setAnimateCounters(!animateCounters); }}
            className={`text-[10px] px-3 py-1 border font-bold transition-colors ${
              animateCounters
                ? "border-terminal-green text-terminal-green"
                : "border-blood text-blood-bright hover:bg-blood hover:text-void"
            }`}
          >
            {animateCounters ? "● LIVE" : "[ START COUNTERS ]"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Military spending counter */}
          <div className="p-4 border border-blood/30 bg-blood/5">
            <div className="text-[10px] text-content-dim uppercase tracking-widest">MILITARY SPENT SINCE YOU OPENED THIS PAGE</div>
            <div className="text-3xl md:text-4xl text-blood-bright font-bold glow-blood font-mono">
              ${formatNumber(animateCounters ? militaryCounter : 0)}
            </div>
            <div className="text-[10px] text-content-dim">
              ${(globalStats.totalMilitary / 1e9 / 365 / 24 / 3600).toFixed(0)}/second globally
            </div>
          </div>

          {/* Hunger deaths counter */}
          <div className="p-4 border border-blood/30 bg-void">
            <div className="text-[10px] text-content-dim uppercase tracking-widest">HUNGER-RELATED DEATHS SINCE YOU OPENED THIS PAGE</div>
            <div className="text-3xl md:text-4xl text-blood font-bold font-mono">
              {animateCounters ? Math.floor(hungerDeathsCounter).toLocaleString() : "0"}
            </div>
            <div className="text-[10px] text-content-dim">
              ~1 death every 3.5 seconds (WHO)
            </div>
          </div>
        </div>
      </TerminalCard>

      {/* Global indicators grid */}
      <TerminalCard title="GLOBAL INDICATORS // THE STATE OF THE WORLD" accent="amber" className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Indicator label="WORLD POPULATION" value={formatNumber(globalStats.totalPop / 1e6)} unit="M" color="#999" />
          <Indicator label="UNDERNOURISHED" value={`${globalStats.totalUndernourished}`} unit="M" color="#cc0000" sub="1 in 11 humans" />
          <Indicator label="FORCIBLY DISPLACED" value={formatNumber(globalStats.totalDisplaced)} unit="" color="#ff6600" sub="UNHCR" />
          <Indicator label="NO ELECTRICITY" value={formatNumber(globalStats.totalNoElectricity)} unit="M" color="#ffaa00" sub="IEA" />
          <Indicator label="ILLITERATE ADULTS" value={formatNumber(globalStats.totalIlliterate / 1e6)} unit="M" color="#aa44ff" sub="UNESCO" />
          <Indicator label="BELOW WHO MIN. DOCTORS" value={`${globalStats.totalBelowWhoMin}`} unit="/200" color="#e10600" sub="need 4.45/1000" />
          <Indicator label="MILITARY SPENDING" value={`$${(globalStats.totalMilitary / 1e9).toFixed(0)}`} unit="B/yr" color="#cc0000" sub="SIPRI" />
          <Indicator label="HUNGER HOTSPOTS" value={`${data.hotspots.all.length}`} unit="" color="#ff0000" sub="WFP" />
        </div>
      </TerminalCard>

      {/* Extreme contrasts */}
      <TerminalCard title="EXTREME CONTRASTS // THE INEQUALITY OF EXISTENCE" accent="blood" className="mb-6">
        <p className="text-xs text-content-dim mb-4">
          // The same species, the same planet. These gaps are not natural — they are engineered.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contrasts.map((c) => (
            <div key={c.label} className="p-3 border border-border-dim bg-void">
              <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">{c.label}</div>
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/sorrow-map/${c.left.iso3.toLowerCase()}/`}
                  className="text-center flex-1"
                >
                  <div className="text-[10px] text-terminal-green">{c.left.iso3}</div>
                  <div className="text-sm font-bold text-terminal-green">{c.left.value}</div>
                  <div className="text-[9px] text-content-dim truncate">{c.left.name}</div>
                </Link>
                <div className="text-center px-2 shrink-0">
                  <div className="text-xs text-blood-bright font-bold">{c.ratioLabel}</div>
                </div>
                <Link
                  href={`/sorrow-map/${c.right.iso3.toLowerCase()}/`}
                  className="text-center flex-1"
                >
                  <div className="text-[10px] text-blood-bright">{c.right.iso3}</div>
                  <div className="text-sm font-bold text-blood-bright">{c.right.value}</div>
                  <div className="text-[9px] text-content-dim truncate">{c.right.name}</div>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </TerminalCard>

      {/* Worst and best */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <TerminalCard title="MOST VULNERABLE COUNTRY" accent="blood">
          <Link
            href={`/sorrow-map/${globalStats.worst.c.iso3.toLowerCase()}/`}
            className="block p-4 border border-blood-dim bg-abyss hover:bg-blood/5 transition-colors"
          >
            <div className="text-[10px] text-content-dim uppercase tracking-widest">VULNERABILITY SCORE</div>
            <div className="text-5xl font-bold mb-2" style={{ color: scoreColor(globalStats.worst.score) }}>
              {globalStats.worst.score.toFixed(0)}
            </div>
            <div className="text-lg font-bold text-blood-bright">{globalStats.worst.c.name_en}</div>
            <div className="text-xs text-content-secondary mt-1">{globalStats.worst.c.region}</div>
            <div className="mt-3 space-y-1 text-xs">
              {globalStats.worst.c.hunger.undernourishment_pct && (
                <div className="text-blood-bright">
                  {globalStats.worst.c.hunger.undernourishment_pct.toFixed(0)}% undernourished
                </div>
              )}
              <div className="text-content-secondary">
                Conflict: {globalStats.worst.c.conflict.intensity_1to5}/5
              </div>
              <div className="text-content-secondary">
                Life expectancy: {globalStats.worst.c.health.life_expectancy?.toFixed(0) ?? "?"} years
              </div>
            </div>
          </Link>
        </TerminalCard>

        <TerminalCard title="LEAST VULNERABLE COUNTRY" accent="green">
          <Link
            href={`/sorrow-map/${globalStats.best.c.iso3.toLowerCase()}/`}
            className="block p-4 border border-terminal-green/30 bg-abyss hover:bg-terminal-green/5 transition-colors"
          >
            <div className="text-[10px] text-content-dim uppercase tracking-widest">VULNERABILITY SCORE</div>
            <div className="text-5xl font-bold mb-2" style={{ color: scoreColor(globalStats.best.score) }}>
              {globalStats.best.score.toFixed(0)}
            </div>
            <div className="text-lg font-bold text-terminal-green">{globalStats.best.c.name_en}</div>
            <div className="text-xs text-content-secondary mt-1">{globalStats.best.c.region}</div>
            <div className="mt-3 space-y-1 text-xs">
              <div className="text-terminal-green">
                Life expectancy: {globalStats.best.c.health.life_expectancy?.toFixed(0) ?? "?"} years
              </div>
              <div className="text-content-secondary">
                Doctors: {globalStats.best.c.health.doctors_per_1000?.toFixed(1) ?? "?"}/1000
              </div>
              <div className="text-content-secondary">
                GDP/cap: ${formatNumber(globalStats.best.c.economy.gdp_per_capita_usd)}
              </div>
            </div>
          </Link>
        </TerminalCard>
      </div>

      {/* Cost to fix */}
      <TerminalCard title="THE COST // AFFORDABILITY" accent="green" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 border border-terminal-green/30 bg-terminal-green/5">
            <div className="text-[10px] text-content-dim uppercase">END HUNGER</div>
            <div className="text-2xl text-terminal-green font-bold">$93B/yr</div>
            <div className="text-[10px] text-content-dim">14 days of military</div>
          </div>
          <div className="p-3 border border-terminal-green/30 bg-terminal-green/5">
            <div className="text-[10px] text-content-dim uppercase">ALL 6 SDGs (WATER+HEALTH+ENERGY+EDUCATION+HUNGER)</div>
            <div className="text-2xl text-terminal-green font-bold">$422B/yr</div>
            <div className="text-[10px] text-content-dim">64 days of military</div>
          </div>
          <div className="p-3 border border-terminal-green/30 bg-terminal-green/5">
            <div className="text-[10px] text-content-dim uppercase">EVERYTHING (INCL. CLIMATE)</div>
            <div className="text-2xl text-terminal-green font-bold">$828B/yr</div>
            <div className="text-[10px] text-content-dim">34% of military</div>
          </div>
        </div>
        <div className="mt-4 p-3 border border-blood-dim bg-void text-xs text-blood">
          The world spends ${(globalStats.totalMilitary / 1e9).toFixed(0)}B/year on military — {" "}
          {((globalStats.totalMilitary / 1e9) / 93).toFixed(0)}× what it would cost to end hunger.
          Every year we don&apos;t act is a choice.
        </div>
      </TerminalCard>

      {/* Quick links */}
      <TerminalCard title="EXPLORE THE DATA" className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { href: "/sorrow-map/", label: "MAP" },
            { href: "/the-index/", label: "INDEX" },
            { href: "/the-fronts/", label: "REGIONS" },
            { href: "/the-choice/", label: "MILITARY" },
            { href: "/the-timeline/", label: "SCENARIOS" },
            { href: "/the-exodus/", label: "DISPLACEMENT" },
            { href: "/the-ledger/", label: "FINANCING" },
            { href: "/the-briefing/", label: "COUNTRY" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[10px] px-2 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright text-center"
            >
              ▶ {l.label}
            </Link>
          ))}
        </div>
      </TerminalCard>
    </div>
  );
}

/* ═══ INDICATOR COMPONENT ═══ */
function Indicator({ label, value, unit, color, sub }: {
  label: string;
  value: string;
  unit: string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="p-3 border border-border-dim bg-void">
      <div className="text-[9px] text-content-dim uppercase tracking-widest">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}<span className="text-sm ml-0.5">{unit}</span>
      </div>
      {sub && <div className="text-[9px] text-content-dim mt-0.5">{sub}</div>}
    </div>
  );
}
