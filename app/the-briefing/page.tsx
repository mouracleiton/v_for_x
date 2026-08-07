"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, CountryData } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import { formatNumber, formatPct, formatMoney } from "@/lib/format";
import { calculateVulnerability, scoreColor, scoreLabel, DOMAIN_WEIGHTS } from "@/lib/vulnerability";
import { COST_PER_MILLION_HUNGRY_B, MILITARY_PER_DAY_B } from "@/lib/choice";

const data = backbone as WorldBackbone;

/* ═══ REFERENCE COUNTRIES for comparison ═══ */
const BEST = {
  lifeExpectancy: 84.3, // Japan
  childMortality: 1.9,  // Norway
  undernourishment: 2.5, // global best
  doctors: 4.45, // WHO minimum
  literacy: 99.0,
  homicide: 0.5, // Iceland
};

export default function TheBriefingPage() {
  const [selectedIso3, setSelectedIso3] = useState<string>("BRA");
  const [searchQuery, setSearchQuery] = useState("");

  const country = useMemo(
    () => data.countries.find((c) => c.iso3 === selectedIso3),
    [selectedIso3]
  );

  const filteredCountries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    return data.countries
      .filter((c) => c.name_en.toLowerCase().includes(q) || c.iso3.toLowerCase().includes(q) || c.name_pt.toLowerCase().includes(q))
      .sort((a, b) => a.name_en.localeCompare(b.name_en))
      .slice(0, 10);
  }, [searchQuery]);

  if (!country) return null;

  // Computations
  const vuln = calculateVulnerability(country);
  const pop = country.demographics.population;
  const popM = pop / 1e6;
  const underPct = country.hunger.undernourishment_pct;
  const underM = popM * (underPct ?? 0) / 100;
  const costFixB = underM * COST_PER_MILLION_HUNGRY_B;
  const milB = (country.military.expenditure_usd ?? 0) / 1e9;
  const healthPct = country.health.expenditure_pct_gdp ?? 0;
  const gdp = country.economy.gdp_usd ?? 0;
  const healthUsd = gdp * healthPct / 100;
  const healthB = healthUsd / 1e9;
  const milHealthRatio = healthUsd > 0 ? (country.military.expenditure_usd ?? 0) / healthUsd : 0;
  const dailyMilB = milB / 365;
  const daysLocalMil = dailyMilB > 0 ? costFixB / dailyMilB : 0;
  const daysGlobalMil = costFixB / MILITARY_PER_DAY_B;

  const handlePrint = useCallback(() => {
    sound.success();
    window.print();
  }, [sound]);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4 no-print">
        <div className="text-xs text-content-dim mb-1">[21] THE BRIEFING</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood tracking-widest">
          THE BRIEFING
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // Pick a country. Get a devastating one-page report with its specific numbers.
          Print it. Share it. Make the argument undeniable.
        </p>
      </div>

      {/* Country selector */}
      <TerminalCard title="SELECT YOUR COUNTRY" className="mb-6 no-print">
        <div className="flex flex-wrap gap-2 mb-3">
          {["SDN", "BRA", "USA", "IND", "COD", "YEM", "AFG", "UKR"].map((iso3) => {
            const c = data.countries.find((x) => x.iso3 === iso3);
            return (
              <button
                key={iso3}
                onClick={() => { setSelectedIso3(iso3); sound.nav(); }}
                className={`text-[10px] px-2 py-1 border transition-colors ${
                  selectedIso3 === iso3
                    ? "border-blood text-blood-bright bg-blood/5"
                    : "border-border-dim text-content-secondary hover:border-blood"
                }`}
              >
                {c?.name_en ?? iso3}
              </button>
            );
          })}
        </div>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search any of 200 countries..."
            className="w-full bg-void border border-border-dim text-content-primary text-sm px-3 py-2 focus:border-blood focus:outline-none"
          />
          {filteredCountries.length > 0 && (
            <div className="absolute z-50 w-full mt-1 border border-border-dim bg-void max-h-48 overflow-y-auto">
              {filteredCountries.map((c) => (
                <button
                  key={c.iso3}
                  onClick={() => { setSelectedIso3(c.iso3); setSearchQuery(""); sound.nav(); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-panel border-b border-border-dim"
                >
                  <span className="font-bold text-content-secondary w-8">{c.iso3}</span>
                  <span className="text-content-primary">{c.name_en}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handlePrint}
          className="mt-3 px-4 py-2 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void font-bold"
        >
          [ 🖨 PRINT / EXPORT PDF ]
        </button>
      </TerminalCard>

      {/* ═══ PRINTABLE BRIEFING ═══ */}
      <div className="print-briefing">
        {/* Briefing header */}
        <div className="mb-6 pb-4 border-b-2 border-blood">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[10px] text-content-dim uppercase tracking-widest">V FOR X // COUNTRY BRIEFING</div>
              <h2 className="text-3xl md:text-4xl text-blood-bright font-bold mt-1">{country.name_en}</h2>
              <div className="text-sm text-content-secondary mt-1">
                {country.iso3} · {country.region} · Pop: {formatNumber(popM)}M · {country.is_hotspot ? "⚠ HUNGER HOTSPOT" : "Not classified as hotspot"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-content-dim uppercase tracking-widest">Vulnerability Score</div>
              <div className="text-5xl font-bold" style={{ color: scoreColor(vuln.composite) }}>
                {vuln.composite.toFixed(0)}
              </div>
              <div className="text-xs font-bold" style={{ color: scoreColor(vuln.composite) }}>
                {scoreLabel(vuln.composite)}
              </div>
            </div>
          </div>
        </div>

        {/* The headline stat */}
        {underPct !== null && underPct > 0 && (
          <div className="mb-6 p-4 border border-blood bg-abyss">
            <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">THE HEADLINE</div>
            <div className="text-xl text-content-primary">
              <span className="text-3xl text-blood-bright font-bold glow-blood">{underM.toFixed(1)}M</span> people
              {" "}(<span className="text-blood-bright font-bold">{underPct.toFixed(1)}%</span>) in {country.name_en}
              {" "}are undernourished right now.
            </div>
            <div className="text-sm text-content-secondary mt-2">
              It would cost{" "}
              <span className="text-terminal-green font-bold">${costFixB.toFixed(2)}B/year</span> to fix this —
              that&apos;s {" "}
              {daysLocalMil < 1
                ? <span className="text-terminal-green font-bold">{(daysLocalMil * 24).toFixed(0)} hours</span>
                : <span className="text-terminal-green font-bold">{daysLocalMil.toFixed(1)} days</span>}
              {" "}of {country.name_en}&apos;s own military spending, or{" "}
              <span className="text-terminal-green font-bold">{daysGlobalMil.toFixed(2)} days</span> of global military spending.
            </div>
          </div>
        )}

        {/* Two-column key stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatBox
            label="LIFE EXPECTANCY"
            value={country.health.life_expectancy?.toFixed(1) ?? "—"}
            unit="yrs"
            vs={`Best: ${BEST.lifeExpectancy}`}
            bad={country.health.life_expectancy !== null && country.health.life_expectancy < 65}
          />
          <StatBox
            label="CHILD MORTALITY"
            value={country.health.child_mortality_under5_per1k?.toFixed(1) ?? "—"}
            unit="/1k"
            vs={`Best: ${BEST.childMortality}`}
            bad={country.health.child_mortality_under5_per1k !== null && country.health.child_mortality_under5_per1k > 30}
          />
          <StatBox
            label="DOCTORS /1000"
            value={country.health.doctors_per_1000 != null ? country.health.doctors_per_1000.toFixed(1) : "—"}
            unit=""
            vs={`WHO min: ${BEST.doctors}`}
            bad={country.health.doctors_per_1000 != null && country.health.doctors_per_1000 < 4.45}
          />
          <StatBox
            label="LITERACY"
            value={country.education.literacy_rate_pct?.toFixed(0) ?? "—"}
            unit="%"
            vs={`Best: ${BEST.literacy}%`}
            bad={country.education.literacy_rate_pct !== null && country.education.literacy_rate_pct < 70}
          />
          <StatBox
            label="HOMICIDE RATE"
            value={country.security.homicide_rate_per100k?.toFixed(1) ?? "—"}
            unit="/100k"
            vs={`Best: ${BEST.homicide}`}
            bad={country.security.homicide_rate_per100k !== null && country.security.homicide_rate_per100k > 10}
          />
          <StatBox
            label="CORRUPTION (CPI)"
            value={country.governance.corruption_perceptions_index?.toFixed(0) ?? "—"}
            unit="/100"
            vs="Best: 90"
            bad={country.governance.corruption_perceptions_index !== null && country.governance.corruption_perceptions_index < 40}
          />
          <StatBox
            label="GDP PER CAPITA"
            value={country.economy.gdp_per_capita_usd ? `$${formatNumber(country.economy.gdp_per_capita_usd)}` : "—"}
            unit=""
            vs=""
          />
          <StatBox
            label="GINI (INEQUALITY)"
            value={country.inequality.gini?.toFixed(1) ?? "—"}
            unit=""
            vs="0=equal"
            bad={country.inequality.gini !== null && country.inequality.gini > 50}
          />
        </div>

        {/* The Choice box */}
        {milB > 0 && healthB > 0 && (
          <div className="mb-6 p-4 border border-border-dim bg-void">
            <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">THE CHOICE</div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-content-dim">MILITARY</div>
                <div className="text-xl text-blood-bright font-bold">${formatNumber(milB)}B/yr</div>
                <div className="text-[10px] text-content-dim">{country.military.pct_gdp?.toFixed(1)}% of GDP</div>
              </div>
              <div>
                <div className="text-xs text-content-dim">HEALTH</div>
                <div className="text-xl text-terminal-green font-bold">${formatNumber(healthB)}B/yr</div>
                <div className="text-[10px] text-content-dim">{healthPct.toFixed(1)}% of GDP</div>
              </div>
              <div>
                <div className="text-xs text-content-dim">RATIO</div>
                <div className="text-xl font-bold" style={{ color: milHealthRatio > 1 ? "#cc0000" : "#00ff41" }}>
                  {milHealthRatio.toFixed(2)}×
                </div>
                <div className="text-[10px] text-content-dim">
                  {milHealthRatio > 1 ? "war > health" : "health > war"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vulnerability radar */}
        <div className="mb-6">
          <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">VULNERABILITY BREAKDOWN (16 DOMAINS)</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
            {vuln.domains.map((d) => (
              <div
                key={d.domain}
                className="flex items-center gap-2 p-1.5 border border-border-dim"
                style={{ opacity: d.hasData ? 1 : 0.3 }}
              >
                <span className="inline-block w-2 h-2 shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-[10px] text-content-secondary flex-1 truncate">{d.label}</span>
                <span
                  className="text-[10px] font-bold"
                  style={{ color: d.hasData ? scoreColor(d.score) : "#444" }}
                >
                  {d.hasData ? d.score.toFixed(0) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison to world */}
        <div className="mb-6 p-4 border border-border-dim bg-void">
          <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">HOW {country.name_en.toUpperCase()} COMPARES</div>
          <div className="space-y-1 text-xs">
            {country.is_hotspot && (
              <div className="text-blood-bright font-bold">
                ⚠ {country.name_en} is one of {data.hotspots.all.length} global hunger hotspots.
              </div>
            )}
            {(() => {
              const ranked = [...data.countries].sort((a, b) => calculateVulnerability(b).composite - calculateVulnerability(a).composite);
              const rank = ranked.findIndex((c) => c.iso3 === country.iso3) + 1;
              return (
                <div className="text-content-secondary">
                  Vulnerability rank: <span className="text-blood-bright font-bold">#{rank}</span> of 200 countries
                  {" "}(top {(rank / 200 * 100).toFixed(0)}%)
                </div>
              );
            })()}
            {country.conflict.intensity_1to5 >= 3 && (
              <div className="text-blood">
                Active conflict: intensity {country.conflict.intensity_1to5}/5
                {country.conflict.displacement_m && ` · ${country.conflict.displacement_m}M displaced`}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-[9px] text-content-dim border-t border-border-dim pt-2 mt-4">
          Data: {data.metadata.sources.length} sources including FAO, WHO, World Bank, SIPRI, UNHCR · CC0 · Generated by V FOR X
          {" · "}
          <Link href={`/sorrow-map/${country.iso3.toLowerCase()}/`} className="text-blood-bright hover:underline">
            Full dossier →
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ═══ STAT BOX COMPONENT ═══ */
function StatBox({ label, value, unit, vs, bad }: {
  label: string;
  value: string;
  unit: string;
  vs: string;
  bad?: boolean;
}) {
  return (
    <div className={`p-2 border ${bad ? "border-blood/40 bg-blood/5" : "border-border-dim"}`}>
      <div className="text-[9px] text-content-dim uppercase tracking-widest">{label}</div>
      <div className={`text-lg font-bold ${bad ? "text-blood-bright" : "text-content-primary"}`}>
        {value}<span className="text-[10px] text-content-dim ml-0.5">{unit}</span>
      </div>
      {vs && <div className="text-[9px] text-content-dim">{vs}</div>}
    </div>
  );
}
