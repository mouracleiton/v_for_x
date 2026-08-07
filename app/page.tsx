"use client";

import Link from "next/link";
import { useStore } from "@/stores/useStore";
import { useMemo } from "react";
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
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="text-center mb-12 pt-8">
        <pre className="text-blood text-[10px] md:text-xs leading-tight inline-block glow-blood" aria-hidden="true">{`
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
      <h2 className="text-sm uppercase tracking-widest text-content-secondary mb-4">
        {" "}ENTRIES
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
        {[
          { href: "/sorrow-map/", code: "01", label: "SORROW MAP", desc: "Atlas of suffering" },
          { href: "/equation/", code: "02", label: "THE EQUATION", desc: "Model the fix" },
          { href: "/protocol-x/", code: "03", label: "PROTOCOL X", desc: "Survival blueprints" },
          { href: "/registry/", code: "04", label: "REGISTRY", desc: "Accountability" },
          { href: "/the-web/", code: "05", label: "THE WEB", desc: "Anonymous comms" },
          { href: "/the-trail/", code: "06", label: "THE TRAIL", desc: "Resource routing" },
          { href: "/fortress/", code: "07", label: "FORTRESS", desc: "Infrastructure" },
          { href: "/the-mask/", code: "08", label: "MASK", desc: "Identity & OpSec" },
        ].map((b) => (
          <Link
            key={b.href}
            href={b.href}
            className="terminal-card p-4 hover:border-blood transition-colors block"
          >
            <div className="text-xs text-content-dim">[{b.code}]</div>
            <div className="text-sm font-bold text-blood mt-1">{b.label}</div>
            <div className="text-xs text-content-secondary mt-1">{b.desc}</div>
          </Link>
        ))}
      </div>

      {/* Footer */}
      <footer className="border-t border-border-dim pt-4 pb-8">
        <div className="flex flex-col md:flex-row justify-between gap-2 text-xs text-content-dim">
          <span>Data sync: {data.metadata.created} · {data.metadata.total_countries} countries</span>
          <span>Sources: {data.metadata.sources.length} official · CC0</span>
        </div>
      </footer>
    </div>
  );
}
