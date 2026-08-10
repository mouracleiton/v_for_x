"use client";

import Link from "next/link";
import { tc } from "@/lib/i18n-content";
import { t } from "@/lib/i18n";
import { useStore } from "@/stores/useStore";
import { useMemo, useState, useEffect } from "react";
import backbone from "@/data/world_backbone.json";
import Typewriter from "@/components/ui/Typewriter";
import TerminalCard from "@/components/ui/TerminalCard";
import ShareableStat from "@/components/shared/ShareableStat";
import DataBar from "@/components/ui/DataBar";
import StatusPill from "@/components/ui/StatusPill";
import { wfpClassColor, wfpClassLabel, wfpClassLabelLocalized, formatNumber } from "@/lib/format";
import type { WorldBackbone } from "@/lib/types";
import type { Lang } from "@/lib/i18n";
import { getEjatlasSummary } from "@/lib/ejatlas";

const data = backbone as WorldBackbone;

const shareableStatKeys = ["share.0", "share.1", "share.2", "share.3", "share.4", "share.5", "share.6", "share.7", "share.8", "share.9", "share.10", "share.11", "share.12", "share.13"];

const rotatingNumberKeys = [
  { value: "$93B", labelKey: "rn.93b_label", comparisonKey: "rn.93b_comparison" },
  { value: "667M", labelKey: "rn.667m_label", comparisonKey: "rn.667m_comparison" },
  { value: "2.8B", labelKey: "rn.2_8b_label", comparisonKey: "rn.2_8b_comparison" },
  { value: "140M", labelKey: "rn.140m_label", comparisonKey: "rn.140m_comparison" },
];

/* ═══ SDG ROTATING COUNTER ═══
 * Cycles through the 6 cross-domain SDG equations, surfacing the most
 * devastating framings from /equation directly on the home page.
 */

const sdgCounterItems: {
  sdg: string;
  titleKey: string;
  bigValue: string;
  labelKey: string;
  comparisonKey: string;
  color: string;
  moralKey: string;
}[] = [
  {
    sdg: "SDG 7",
    titleKey: "cat.energy",
    bigValue: "$35B",
    labelKey: "sdg.energy_label",
    comparisonKey: "sdg.energy_comparison",
    color: "var(--color-warning-amber)",
    moralKey: "sdg.energy_moral",
  },
  {
    sdg: "SDG 6",
    titleKey: "cat.water",
    bigValue: "$114B",
    labelKey: "sdg.water_label",
    comparisonKey: "sdg.water_comparison",
    color: "#00ddff",
    moralKey: "sdg.water_moral",
  },
  {
    sdg: "SDG 3",
    titleKey: "cat.health",
    bigValue: "$176B",
    labelKey: "sdg.health_label",
    comparisonKey: "sdg.health_comparison",
    color: "var(--color-blood-bright)",
    moralKey: "sdg.health_moral",
  },
  {
    sdg: "SDG 4",
    titleKey: "cat.education",
    bigValue: "$97B",
    labelKey: "sdg.education_label",
    comparisonKey: "sdg.education_comparison",
    color: "var(--color-terminal-green)",
    moralKey: "sdg.education_moral",
  },
  {
    sdg: "SDG 10",
    titleKey: "cat.inequality",
    bigValue: "$313B",
    labelKey: "sdg.inequality_label",
    comparisonKey: "sdg.inequality_comparison",
    color: "#aa44ff",
    moralKey: "sdg.inequality_moral",
  },
  {
    sdg: "SDG 13",
    titleKey: "cat.climate",
    bigValue: "764×",
    labelKey: "sdg.climate_label",
    comparisonKey: "sdg.climate_comparison",
    color: "#cc6600",
    moralKey: "sdg.climate_moral",
  },
];

function SdgRotatingCounter({ lang }: { lang: Lang }) {
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
      title={tc(lang, "home.the_6_equations")}
      accent="amber"
      glow
      className="mb-6"
    >
      <p className="text-xs text-content-dim mb-4">
        {tc(lang, "home.6_eq_sub")}
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
            {tc(lang, item.titleKey)}
          </span>
        </div>
        <div className="flex items-baseline gap-3 mb-2">
          <span className="text-4xl font-bold glow-blood" style={{ color: item.color }}>
            {item.bigValue}
          </span>
          <span className="text-sm text-content-primary flex-1">
            {tc(lang, item.labelKey)}
          </span>
        </div>
        <div className="text-xs text-content-secondary italic">
          {tc(lang, item.moralKey)}
        </div>
        <div className="text-[10px] text-content-dim mt-1">
          = {tc(lang, item.comparisonKey)}
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
              aria-label={`Go to ${tc(lang, s.titleKey)}`}
            />
          ))}
        </div>
        <Link
          href="/equation/"
          className="text-[10px] text-blood-bright hover:underline uppercase tracking-widest"
        >
          {tc(lang, "home.all_equations")}
        </Link>
      </div>

      {data.sdg_equations?.meta.quick_wins_total_billion && (
        <div className="mt-3 border border-terminal-green bg-terminal-green/5 p-2 text-center">
          <span className="text-[10px] text-content-dim uppercase tracking-widest">
            {tc(lang, "home.combined_label")} ${data.sdg_equations.meta.quick_wins_total_billion}B/yr ={" "}
            {data.sdg_equations.meta.quick_wins_pct_military}% {tc(lang, "home.of_military")} ({" "}
            {data.sdg_equations.meta.quick_wins_days_military} {tc(lang, "home.days")})
          </span>
        </div>
      )}
    </TerminalCard>
  );
}

export default function HomePage() {
  const { setCurrentCountry, lang } = useStore();

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
      :::'   ._-___-_'  \`:   ${tc(lang, "home.hero_quote_1")}
     ::    .'         '.  ::   ${tc(lang, "home.hero_quote_2")}
    ::    /   ^     ^   \\  ::   ${tc(lang, "home.hero_quote_3")}
   ::   |    (*)   (*)   |  ::   ${tc(lang, "home.hero_quote_4")}
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
            text={tc(lang, "home.platform_refuses")}
            speed={25}
            cursor={false}
          />
        </p>
      </div>

      {/* SDG2 Status */}
      <TerminalCard
        title={tc(lang, "home.sdg2_status")}
        accent={data.global_indicators.sdg2.status === "off_track" ? "blood" : "green"}
        className="mb-6"
      >
        <div className="flex items-center gap-4 mb-3">
          <StatusPill color="blood">{tc(lang, "label.off_track")}</StatusPill>
          <span className="text-content-secondary text-xs">
            {tc(lang, "home.target_label")} {data.global_indicators.sdg2.target}
          </span>
        </div>
        <DataBar
          value={currentHunger}
          max={currentHunger}
          label={`${tc(lang, "home.current_label")} ${formatNumber(currentHunger)}M ${tc(lang, "home.current_undernourished")}`}
          unit="M"
        />
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <div className="text-xs text-content-dim mb-1">{tc(lang, "label.bau_trajectory")}</div>
            <div className="text-lg text-blood">
              {formatNumber(data.global_indicators.sdg2.projected_2030_bau_m)}M
            </div>
            <div className="text-xs text-content-dim">{tc(lang, "label.status_quo_failure")}</div>
          </div>
          <div>
            <div className="text-xs text-content-dim mb-1">{tc(lang, "label.ambitious_scenario")}</div>
            <div className="text-lg text-terminal-green glow-green">
              {formatNumber(data.global_indicators.sdg2.projected_2034_ambitious_m)}M
            </div>
            <div className="text-xs text-content-dim">{tc(lang, "home.below_threshold").replace("{n}", String(targetHunger))}</div>
          </div>
        </div>
      </TerminalCard>

      {/* The Number */}
      <TerminalCard title={tc(lang, "card.the_number")} className="mb-6">
        <div className="space-y-3">
          {rotatingNumberKeys.map((n, i) => (
            <div
              key={i}
              className={`flex items-baseline gap-3 ${
                i === 0 ? "text-lg" : "text-base"
              }`}
            >
              <span className="text-blood-bright font-bold glow-blood">
                {n.value}
              </span>
              <span className="text-content-primary">{tc(lang, n.labelKey)}</span>
              <span className="text-content-dim text-xs">({tc(lang, n.comparisonKey)})</span>
            </div>
          ))}
        </div>
      </TerminalCard>

      {/* SDG Rotating Counter — 6 equations surfaced from /equation */}
      <SdgRotatingCounter lang={lang} />

      {/* Top 3 Crises */}
      <TerminalCard title={tc(lang, "card.worst_crises")} className="mb-6" glow>
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
                      {wfpClassLabelLocalized(c.wfp_class, lang)}
                    </StatusPill>
                  </div>
                  <div className="text-xs text-content-secondary mt-1">
                    {tc(lang, "home.hotspot_score")} {c.score} ·{" "}
                    {country?.hunger.undernourishment_pct
                      ? `${country.hunger.undernourishment_pct.toFixed(1)}% ${tc(lang, "home.current_undernourished")}`
                      : tc(lang, "home.data_limited")}
                    {country?.conflict.intensity_1to5
                      ? ` · ${tc(lang, "home.conflict_l")}${country.conflict.intensity_1to5}`
                      : ""}
                    {country?.conflict.displacement_m
                      ? ` · ${country.conflict.displacement_m}M ${tc(lang, "home.displaced_m")}`
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
      <TerminalCard title={tc(lang, "card.shareable_ammo")} className="mb-6">
        <p className="text-xs text-content-dim mb-3">
          {tc(lang, "home.viral_sub")}
        </p>
        <div className="space-y-2">
          {shareableStatKeys.map((k, i) => (
            <ShareableStat key={i} text={tc(lang, k)} lang={lang} />
          ))}
        </div>
      </TerminalCard>

      {/* Environmental Justice Front (EJAtlas) */}
      <EnvironmentalJusticeStrip />

      {/* Branch Portals */}
      {/* ═══ SECTION DIRECTORY — CLUSTERED ═══ */}
      <h2 className="text-sm uppercase tracking-widest text-content-secondary mb-4">
        {" "}{tc(lang, "home.entries")}
      </h2>

      {/* EXPLORE — understand the crisis */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] text-blood-bright font-bold uppercase tracking-widest">{tc(lang, "home.explore")}</span>
          <span className="text-[10px] text-content-dim">{tc(lang, "home.explore_sub")}</span>
          <div className="flex-1 h-px bg-border-dim" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { href: "/sorrow-map/", code: "01", label: t(lang, "nav.sorrow-map"), desc: tc(lang, "branch.sorrow_map"), primary: true },
            { href: "/the-dashboard/", code: "25", label: t(lang, "nav.the-dashboard"), desc: tc(lang, "branch.dashboard") },
            { href: "/the-exodus/", code: "16", label: t(lang, "nav.the-exodus"), desc: tc(lang, "branch.exodus") },
            { href: "/the-fronts/", code: "19", label: t(lang, "nav.the-fronts"), desc: tc(lang, "branch.fronts") },
            { href: "/the-stories/", code: "14", label: t(lang, "nav.the-stories"), desc: tc(lang, "branch.stories") },
            { href: "/the-archive/", code: "10", label: t(lang, "nav.the-archive"), desc: tc(lang, "branch.archive") },
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
          <span className="text-[10px] text-terminal-green font-bold uppercase tracking-widest">{tc(lang, "home.analyze")}</span>
          <span className="text-[10px] text-content-dim">{tc(lang, "home.analyze_sub")}</span>
          <div className="flex-1 h-px bg-border-dim" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { href: "/equation/", code: "02", label: t(lang, "nav.equation"), desc: tc(lang, "branch.equation"), primary: true },
            { href: "/the-choice/", code: "20", label: t(lang, "nav.the-choice"), desc: tc(lang, "branch.choice") },
            { href: "/the-allocator/", code: "15", label: t(lang, "nav.the-allocator"), desc: tc(lang, "branch.allocator") },
            { href: "/the-timeline/", code: "22", label: t(lang, "nav.the-timeline"), desc: tc(lang, "branch.timeline") },
            { href: "/the-index/", code: "13", label: t(lang, "nav.the-index"), desc: tc(lang, "branch.index") },
            { href: "/the-lens/", code: "09", label: t(lang, "nav.the-lens"), desc: tc(lang, "branch.lens") },
            { href: "/the-ledger/", code: "24", label: t(lang, "nav.the-ledger"), desc: tc(lang, "branch.ledger") },
            { href: "/the-tactics/", code: "17", label: t(lang, "nav.the-tactics"), desc: tc(lang, "branch.tactics") },
            { href: "/the-matrix/", code: "18", label: t(lang, "nav.the-matrix"), desc: tc(lang, "branch.matrix") },
            { href: "/the-briefing/", code: "21", label: t(lang, "nav.the-briefing"), desc: tc(lang, "branch.briefing") },
            { href: "/the-api/", code: "23", label: t(lang, "nav.the-api"), desc: tc(lang, "branch.api") },
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
          <span className="text-[10px] text-warning-amber font-bold uppercase tracking-widest">{tc(lang, "home.act")}</span>
          <span className="text-[10px] text-content-dim">{tc(lang, "home.act_sub")}</span>
          <div className="flex-1 h-px bg-border-dim" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { href: "/the-act/", code: "12", label: t(lang, "nav.the-act"), desc: tc(lang, "branch.act"), primary: true },
            { href: "/protocol-x/", code: "03", label: t(lang, "nav.protocol-x"), desc: tc(lang, "branch.protocol") },
            { href: "/registry/", code: "04", label: t(lang, "nav.registry"), desc: tc(lang, "branch.registry") },
            { href: "/the-signal/", code: "11", label: t(lang, "nav.the-signal"), desc: tc(lang, "branch.signal") },
            { href: "/the-trail/", code: "06", label: t(lang, "nav.the-trail"), desc: tc(lang, "branch.trail") },
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
          <span className="text-[10px] text-content-dim font-bold uppercase tracking-widest">{tc(lang, "home.infra")}</span>
          <span className="text-[10px] text-content-dim">{tc(lang, "home.infra_sub")}</span>
          <div className="flex-1 h-px bg-border-dim" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { href: "/the-web/", code: "05", label: t(lang, "nav.the-web"), desc: tc(lang, "branch.web") },
            { href: "/the-mask/", code: "08", label: t(lang, "nav.the-mask"), desc: tc(lang, "branch.mask") },
            { href: "/fortress/", code: "07", label: t(lang, "nav.fortress"), desc: tc(lang, "branch.fortress") },
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
          <span>{tc(lang, "home.data_sync")} {data.metadata.created} · {data.metadata.total_countries} {tc(lang, "home.countries_count")}</span>
          <span>{tc(lang, "home.sources_count")} {data.metadata.sources.length} {tc(lang, "home.official_cc0")}</span>
        </div>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ENVIRONMENTAL JUSTICE FRONT
   Compact stat strip from EJAtlas data
   ═══════════════════════════════════════════════════════════════ */
function EnvironmentalJusticeStrip() {
  const { lang } = useStore();
  const eja = useMemo(() => getEjatlasSummary(), []);
  const stopped = eja.summary.by_status.find((s) => s.name === "stopped")?.count ?? 0;
  const topCountries = useMemo(
    () => Object.entries(eja.country_summaries)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 6),
    [eja]
  );

  return (
    <TerminalCard title="ENVIRONMENTAL JUSTICE FRONT" accent="green" className="mb-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div>
          <div className="text-[10px] text-content-dim uppercase tracking-widest">Conflicts Mapped</div>
          <div className="text-2xl text-blood-bright font-bold">{formatNumber(eja.metadata.total_conflicts)}</div>
        </div>
        <div>
          <div className="text-[10px] text-content-dim uppercase tracking-widest">Companies Named</div>
          <div className="text-2xl text-warning-amber font-bold">{formatNumber(eja.metadata.total_companies)}</div>
        </div>
        <div>
          <div className="text-[10px] text-content-dim uppercase tracking-widest">Projects Stopped</div>
          <div className="text-2xl text-terminal-green font-bold">{formatNumber(stopped)}</div>
        </div>
        <div>
          <div className="text-[10px] text-content-dim uppercase tracking-widest">Countries</div>
          <div className="text-2xl text-content-primary font-bold">{eja.metadata.total_countries}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {topCountries.map(([iso3, d]) => {
          const c = data.countries.find((co) => co.iso3 === iso3);
          return (
            <Link
              key={iso3}
              href={`/sorrow-map/${iso3.toLowerCase()}/`}
              className="text-[10px] px-2 py-0.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors"
            >
              {c?.name_en ?? iso3} <span className="text-blood-bright">{d.total}</span>
            </Link>
          );
        })}
      </div>
      <div className="text-[10px] text-content-dim pt-2 border-t border-border-dim">
        Source:{" "}
        <a href="https://ejatlas.org" target="_blank" rel="noopener noreferrer" className="text-terminal-green hover:underline">
          EJAtlas
        </a>{" "}
        (ICTA-UAB) · CC BY-NC-SA 3.0 ·{" "}
        <Link href="/the-fronts/" className="text-blood-bright hover:underline">Explore all →</Link>
      </div>
    </TerminalCard>
  );
}
