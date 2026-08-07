"use client";

import Link from "next/link";
import { useStore } from "@/stores/useStore";
import { useMemo, useState, useEffect } from "react";
import backbone from "@/data/world_backbone.json";
import Typewriter from "@/components/ui/Typewriter";
import TerminalCard from "@/components/ui/TerminalCard";
import ShareableStat from "@/components/shared/ShareableStat";
import DataBar from "@/components/ui/DataBar";
import StatusPill from "@/components/ui/StatusPill";
import { wfpClassColor, wfpClassLabel, formatNumber } from "@/lib/format";
import type { WorldBackbone } from "@/lib/types";

const data = backbone as WorldBackbone;

const shareableStats = [
  "Ending global hunger costs $93B/year. World military spending: $2.4T/year. That's 0.9%. [Source: SIPRI/FAO]",
  "667 million people are undernourished right now. That's 1 in 11 humans. [Source: FAO SOFI 2024]",
  "School feeding programs return $7-35 for every $1 invested. We reach 400M children. 73M are still left out. [Source: World Bank]",
  "Nonviolent resistance succeeds 53% of the time. Armed insurgency succeeds 26%. [Source: Chenoweth]",
  "Investing in smallholder agriculture increases income by 34% and production by 35%. 70M farmers are reachable. [Source: IFAD]",
  "2.8 billion people cannot afford a healthy diet. [Source: FAO]",
  "The world spends more on military in 14 days than it would cost to end hunger for a year. [Source: SIPRI/FAO]",
  // ── SDG equation stats ──
  "5 days of world military spending would electrify the planet. 524M people still live in darkness. [Source: IEA/SIPRI]",
  "186 of 194 countries are below the WHO minimum of 4.45 doctors per 1000. 27 days of military spending fixes it. [Source: WHO/SIPRI]",
  "2 billion people lack safe water. 17 days of military spending buys clean water for every human alive. [Source: WHO/UN-Water/SIPRI]",
  "1.1 billion adults are illiterate. 15 days of military spending covers a year of quality education for every child. [Source: UNESCO/SIPRI]",
  "A 2% tax on the world's 3,000 billionaires would raise $313B/year — enough to end extreme poverty AND fund water, electricity, and education. [Source: Oxfam/G20]",
  "$422B/year buys safe water + healthcare + electricity + education for everyone. That's 64 days of military spending. [Source: WHO/IEA/UNESCO/SIPRI]",
  "Qatar emits 41 tons of CO2 per person. The DRC emits 0.05. A 764x gap. The countries least responsible will suffer first. [Source: Global Carbon Project]",
];

const rotatingNumbers = [
  {
    value: "$93B",
    label: "annual cost to end global hunger",
    comparison: "0.9% of world military spending",
  },
  {
    value: "667M",
    label: "people undernourished in 2024",
    comparison: "1 in 11 humans on Earth",
  },
  {
    value: "2.8B",
    label: "people who cannot afford a healthy diet",
    comparison: "over a third of humanity",
  },
  {
    value: "140M",
    label: "people trapped in active conflict zones",
    comparison: "where aid cannot reach them",
  },
];

/* ═══ SDG ROTATING COUNTER ═══
 * Cycles through the 6 cross-domain SDG equations, surfacing the most
 * devastating framings from /equation directly on the home page.
 */

const sdgCounterItems: {
  sdg: string;
  title: string;
  bigValue: string;
  label: string;
  comparison: string;
  color: string;
  moral: string;
}[] = [
  {
    sdg: "SDG 7",
    title: "ENERGY",
    bigValue: "$35B",
    label: "to electrify the planet for 524M people in darkness",
    comparison: "5 days of world military spending",
    color: "#ffaa00",
    moral: "5 days of world military spending would electrify the planet.",
  },
  {
    sdg: "SDG 6",
    title: "WATER",
    bigValue: "$114B",
    label: "for safe water + sanitation for every human alive",
    comparison: "17 days of world military spending",
    color: "#00ddff",
    moral: "Less than 5% of world military spending buys safe water for every human alive.",
  },
  {
    sdg: "SDG 3",
    title: "HEALTH",
    bigValue: "$176B",
    label: "for healthcare in the world's 54 poorest countries",
    comparison: "27 days of world military spending",
    color: "#e10600",
    moral: "186 of 194 countries are below the WHO minimum doctor threshold.",
  },
  {
    sdg: "SDG 4",
    title: "EDUCATION",
    bigValue: "$97B",
    label: "for quality education for every child on Earth",
    comparison: "15 days of world military spending",
    color: "#00ff41",
    moral: "1.1 billion adults are illiterate. 15 days of military spending fixes it.",
  },
  {
    sdg: "SDG 10",
    title: "INEQUALITY",
    bigValue: "$313B",
    label: "from a 2% tax on the world's 3,000 billionaires",
    comparison: "47 days of world military spending",
    color: "#aa44ff",
    moral: "A 2% billionaire tax funds water, electricity, AND education — with $50B left over.",
  },
  {
    sdg: "SDG 13",
    title: "CLIMATE",
    bigValue: "764×",
    label: "CO2 gap: Qatar emits 41t/person, DRC emits 0.05t",
    comparison: "the countries least responsible suffer first",
    color: "#cc6600",
    moral: "The climate transition costs 1.8 years of military spending. Inaction costs 10–100x more.",
  },
];

function SdgRotatingCounter() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const timer = setInterval(() => {
      setIdx((prev) => (prev + 1) % sdgCounterItems.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [paused]);

  const item = sdgCounterItems[idx];

  return (
    <TerminalCard
      title="THE 6 EQUATIONS // ONE PATTERN"
      accent="amber"
      glow
      className="mb-6"
    >
      <p className="text-xs text-content-dim mb-4">
        // hunger is the proof of concept. every solvable crisis costs less than military spending.
      </p>
      <div
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="border bg-void p-4 transition-colors"
        style={{ borderColor: item.color + "44" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-mono px-1.5 py-0.5 border" style={{ borderColor: item.color, color: item.color }}>
            {item.sdg}
          </span>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: item.color }}>
            {item.title}
          </span>
        </div>
        <div className="flex items-baseline gap-3 mb-2">
          <span className="text-4xl font-bold glow-blood" style={{ color: item.color }}>
            {item.bigValue}
          </span>
          <span className="text-sm text-content-primary flex-1">
            {item.label}
          </span>
        </div>
        <div className="text-xs text-content-secondary italic">
          {item.moral}
        </div>
        <div className="text-[10px] text-content-dim mt-1">
          = {item.comparison}
        </div>
      </div>

      {/* Progress dots + quick-wins aggregate */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex gap-1.5">
          {sdgCounterItems.map((s, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className="h-1.5 transition-all"
              style={{
                width: i === idx ? 24 : 8,
                backgroundColor: i === idx ? item.color : "var(--color-border-dim)",
              }}
              aria-label={`Go to ${s.title}`}
            />
          ))}
        </div>
        <Link
          href="/equation/"
          className="text-[10px] text-blood-bright hover:underline uppercase tracking-widest"
        >
          ALL 6 EQUATIONS →
        </Link>
      </div>

      {data.sdg_equations?.meta.quick_wins_total_billion && (
        <div className="mt-3 border border-terminal-green bg-terminal-green/5 p-2 text-center">
          <span className="text-[10px] text-content-dim uppercase tracking-widest">
            COMBINED: ${data.sdg_equations.meta.quick_wins_total_billion}B/yr ={" "}
            {data.sdg_equations.meta.quick_wins_pct_military}% of military spending ({" "}
            {data.sdg_equations.meta.quick_wins_days_military} days)
          </span>
        </div>
      )}
    </TerminalCard>
  );
}

export default function HomePage() {
  const { setCurrentCountry } = useStore();

  const topCrises = useMemo(
    () => [...data.hotspots.all].sort((a, b) => b.score - a.score).slice(0, 3),
    []
  );

  const bauHunger = data.scenarios.bau;
  const ambiciosoHunger = data.scenarios.ambicioso;
  const currentHunger = data.global_indicators.hunger.undernourished_2024_m;
  const targetHunger = data.global_indicators.sdg2.threshold_m;

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="text-center mb-12 pt-8">
        <div className="text-5xl md:text-7xl mb-2 animate-pulse">🦀</div>
        <pre data-ascii-hero className="text-blood text-[6px] sm:text-[10px] md:text-xs leading-tight inline-block glow-blood" aria-hidden="true">{`
        .:::::::::::::::.
      :::'   ._-___-_'  \`:   PEOPLE SHOULD NOT BE
     ::    .'         '.  ::   AFRAID OF THEIR GOVERNMENTS.
    ::    /   ^     ^   \\  ::   GOVERNMENTS SHOULD BE
   ::   |    (*)   (*)   |  ::   AFRAID OF THEIR PEOPLE.
   ::   |       o         | ::
    ::   \\     ___       /  ::
     ::   '.           .'  ::
      :::'. \` - - - - ' .:::
        ':::::::::::::::::'
`}</pre>
        <h1 className="text-3xl md:text-5xl font-bold text-blood-bright glow-blood mt-4 tracking-widest">
          <Typewriter text="V FOR X" speed={100} />
        </h1>
        <p className="text-content-secondary mt-3 text-sm">
          <Typewriter
            text="// the platform that refuses to die"
            speed={25}
            cursor={false}
          />
        </p>
      </div>

      {/* SDG2 Status */}
      <TerminalCard
        title="SDG2 STATUS // ZERO HUNGER BY 2030"
        accent={data.global_indicators.sdg2.status === "off_track" ? "blood" : "green"}
        className="mb-6"
      >
        <div className="flex items-center gap-4 mb-3">
          <StatusPill color="blood">OFF TRACK</StatusPill>
          <span className="text-content-secondary text-xs">
            Target: {data.global_indicators.sdg2.target}
          </span>
        </div>
        <DataBar
          value={currentHunger}
          max={currentHunger}
          label={`Current: ${formatNumber(currentHunger)}M undernourished`}
          unit="M"
        />
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <div className="text-xs text-content-dim mb-1">BAU trajectory (2030)</div>
            <div className="text-lg text-blood">
              {formatNumber(data.global_indicators.sdg2.projected_2030_bau_m)}M
            </div>
            <div className="text-xs text-content-dim">Status quo = failure</div>
          </div>
          <div>
            <div className="text-xs text-content-dim mb-1">Ambitious scenario (2034)</div>
            <div className="text-lg text-terminal-green glow-green">
              {formatNumber(data.global_indicators.sdg2.projected_2034_ambitious_m)}M
            </div>
            <div className="text-xs text-content-dim">Below {targetHunger}M threshold</div>
          </div>
        </div>
      </TerminalCard>

      {/* The Number */}
      <TerminalCard title="THE NUMBER" className="mb-6">
        <div className="space-y-3">
          {rotatingNumbers.map((n, i) => (
            <div
              key={i}
              className={`flex items-baseline gap-3 ${
                i === 0 ? "text-lg" : "text-base"
              }`}
            >
              <span className="text-blood-bright font-bold glow-blood">
                {n.value}
              </span>
              <span className="text-content-primary">{n.label}</span>
              <span className="text-content-dim text-xs">({n.comparison})</span>
            </div>
          ))}
        </div>
      </TerminalCard>

      {/* SDG Rotating Counter — 6 equations surfaced from /equation */}
      <SdgRotatingCounter />

      {/* Top 3 Crises */}
      <TerminalCard title="TODAY'S 3 WORST CRISES" className="mb-6" glow>
        <div className="space-y-3">
          {topCrises.map((c, i) => {
            const country = data.countries.find((x) => x.iso3 === c.iso3);
            return (
              <Link
                key={c.iso3}
                href={`/sorrow-map/${c.iso3.toLowerCase()}/`}
                onClick={() => {
                  setCurrentCountry(c.iso3);
                }}
                className="flex items-center gap-3 p-3 terminal-card hover:border-blood transition-colors block"
              >
                <span className="text-2xl text-blood-dim font-bold">
                  #{i + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-content-primary font-bold">
                      {country?.name_en || c.name_pt}
                    </span>
                    <StatusPill color="blood">
                      {wfpClassLabel(c.wfp_class)}
                    </StatusPill>
                  </div>
                  <div className="text-xs text-content-secondary mt-1">
                    Hotspot score: {c.score} ·{" "}
                    {country?.hunger.undernourishment_pct
                      ? `${country.hunger.undernourishment_pct.toFixed(1)}% undernourished`
                      : "data limited"}
                    {country?.conflict.intensity_1to5
                      ? ` · conflict L${country.conflict.intensity_1to5}`
                      : ""}
                    {country?.conflict.displacement_m
                      ? ` · ${country.conflict.displacement_m}M displaced`
                      : ""}
                  </div>
                </div>
                <div
                  className="w-2 h-12 pulse-blood"
                  style={{ backgroundColor: wfpClassColor(c.wfp_class) }}
                />
              </Link>
            );
          })}
        </div>
      </TerminalCard>

      {/* Shareable Ammunition */}
      <TerminalCard title="SHAREABLE AMMUNITION" className="mb-6">
        <p className="text-xs text-content-dim mb-3">
          // viral data points with source attribution — one click to copy
        </p>
        <div className="space-y-2">
          {shareableStats.map((s, i) => (
            <ShareableStat key={i} text={s} />
          ))}
        </div>
      </TerminalCard>

      {/* Branch Portals */}
      {/* ═══ SECTION DIRECTORY — CLUSTERED ═══ */}
      <h2 className="text-sm uppercase tracking-widest text-content-secondary mb-4">
        {" "}ENTRIES // 25 SECTIONS
      </h2>

      {/* EXPLORE — understand the crisis */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] text-blood-bright font-bold uppercase tracking-widest">[ EXPLORE ]</span>
          <span className="text-[10px] text-content-dim">// understand the crisis</span>
          <div className="flex-1 h-px bg-border-dim" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { href: "/sorrow-map/", code: "01", label: "SORROW MAP", desc: "Atlas of suffering", primary: true },
            { href: "/the-dashboard/", code: "25", label: "DASHBOARD", desc: "World cockpit" },
            { href: "/the-exodus/", code: "16", label: "EXODUS", desc: "Displacement flows" },
            { href: "/the-fronts/", code: "19", label: "FRONTS", desc: "Regional crises" },
            { href: "/the-stories/", code: "14", label: "STORIES", desc: "Narrative tours" },
            { href: "/the-archive/", code: "10", label: "ARCHIVE", desc: "Sources & methods" },
          ].map((b) => (
            <Link key={b.href} href={b.href} className={`terminal-card p-3 hover:border-blood transition-colors block ${b.primary ? "border-blood-dim" : ""}`}>
              <div className="text-[10px] text-content-dim">[{b.code}]</div>
              <div className="text-xs font-bold text-blood mt-1">{b.label}</div>
              <div className="text-[10px] text-content-secondary mt-0.5">{b.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* ANALYZE — make the argument */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] text-terminal-green font-bold uppercase tracking-widest">[ ANALYZE ]</span>
          <span className="text-[10px] text-content-dim">// make the argument</span>
          <div className="flex-1 h-px bg-border-dim" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { href: "/equation/", code: "02", label: "THE EQUATION", desc: "Model the fix", primary: true },
            { href: "/the-choice/", code: "20", label: "THE CHOICE", desc: "Military vs health" },
            { href: "/the-allocator/", code: "15", label: "ALLOCATOR", desc: "Budget simulator" },
            { href: "/the-timeline/", code: "22", label: "TIMELINE", desc: "10-year model" },
            { href: "/the-index/", code: "13", label: "THE INDEX", desc: "Vulnerability ranking" },
            { href: "/the-lens/", code: "09", label: "THE LENS", desc: "Compare & correlate" },
            { href: "/the-ledger/", code: "24", label: "THE LEDGER", desc: "Financing & blockers" },
            { href: "/the-tactics/", code: "17", label: "THE TACTICS", desc: "Resistance tactics" },
            { href: "/the-matrix/", code: "18", label: "THE MATRIX", desc: "Data transparency" },
            { href: "/the-briefing/", code: "21", label: "THE BRIEFING", desc: "Country report" },
            { href: "/the-api/", code: "23", label: "THE API", desc: "Public data API" },
          ].map((b) => (
            <Link key={b.href} href={b.href} className={`terminal-card p-3 hover:border-blood transition-colors block ${b.primary ? "border-blood-dim" : ""}`}>
              <div className="text-[10px] text-content-dim">[{b.code}]</div>
              <div className="text-xs font-bold text-blood mt-1">{b.label}</div>
              <div className="text-[10px] text-content-secondary mt-0.5">{b.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* ACT — take action */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] text-warning-amber font-bold uppercase tracking-widest">[ ACT ]</span>
          <span className="text-[10px] text-content-dim">// take action</span>
          <div className="flex-1 h-px bg-border-dim" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { href: "/the-act/", code: "12", label: "THE ACT", desc: "Campaign generator", primary: true },
            { href: "/protocol-x/", code: "03", label: "PROTOCOL X", desc: "Survival blueprints" },
            { href: "/registry/", code: "04", label: "REGISTRY", desc: "Accountability" },
            { href: "/the-signal/", code: "11", label: "THE SIGNAL", desc: "Watchlist alerts" },
            { href: "/the-trail/", code: "06", label: "THE TRAIL", desc: "Resource routing" },
          ].map((b) => (
            <Link key={b.href} href={b.href} className={`terminal-card p-3 hover:border-blood transition-colors block ${b.primary ? "border-blood-dim" : ""}`}>
              <div className="text-[10px] text-content-dim">[{b.code}]</div>
              <div className="text-xs font-bold text-blood mt-1">{b.label}</div>
              <div className="text-[10px] text-content-secondary mt-0.5">{b.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* INFRASTRUCTURE — tools & security */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] text-content-dim font-bold uppercase tracking-widest">[ INFRASTRUCTURE ]</span>
          <span className="text-[10px] text-content-dim">// tools & security</span>
          <div className="flex-1 h-px bg-border-dim" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { href: "/the-web/", code: "05", label: "THE WEB", desc: "Anonymous comms" },
            { href: "/the-mask/", code: "08", label: "MASK", desc: "Identity & OpSec" },
            { href: "/fortress/", code: "07", label: "FORTRESS", desc: "Infrastructure" },
          ].map((b) => (
            <Link key={b.href} href={b.href} className="terminal-card p-3 hover:border-blood transition-colors block">
              <div className="text-[10px] text-content-dim">[{b.code}]</div>
              <div className="text-xs font-bold text-blood mt-1">{b.label}</div>
              <div className="text-[10px] text-content-secondary mt-0.5">{b.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border-dim pt-4 pb-8">
        <div className="text-center text-3xl mb-3">🦀</div>
        <div className="flex flex-col md:flex-row justify-between gap-2 text-xs text-content-dim">
          <span>Data sync: {data.metadata.created} · {data.metadata.total_countries} countries</span>
          <span>Sources: {data.metadata.sources.length} official · CC0</span>
        </div>
      </footer>
    </div>
  );
}
