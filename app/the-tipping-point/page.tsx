"use client";

/**
 * V FOR X — The Tipping Point [76]
 *
 * Early warning system. How close is each country to the edge?
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import {
  analyzeTippingPoints,
  dimensionBreakdown,
  alertColor,
  alertIcon,
  alertLabel,
  THRESHOLDS,
  type AlertLevel,
  type CountryTipping,
} from "@/lib/tipping-point";
import type { WorldBackbone } from "@/lib/types";

const data = backbone as WorldBackbone;

export default function TippingPointPage() {
  const result = useMemo(() => analyzeTippingPoints(data), []);
  const dimBreakdown = useMemo(() => dimensionBreakdown(result.countries), [result]);
  const [levelFilter, setLevelFilter] = useState<AlertLevel | "all">("all");
  const [showCount, setShowCount] = useState(20);

  const filtered = useMemo(() => {
    if (levelFilter === "all") return result.countries;
    return result.countries.filter((c) => c.alertLevel === levelFilter);
  }, [result, levelFilter]);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-mono px-1.5 py-0.5 border border-blood text-blood-bright">[76]</span>
          <h1 className="text-2xl md:text-4xl font-bold text-blood-bright glow-blood tracking-widest">
            THE TIPPING POINT
          </h1>
        </div>
        <p className="text-content-secondary text-sm">
          Every country sits on a spectrum of structural stress. This module
          measures proximity to 12 internationally-recognized crisis thresholds —
          famine, conflict, health collapse, democratic breakdown — and flags
          those approaching the edge.
        </p>
      </div>

      {/* Global alert summary */}
      <TerminalCard title="GLOBAL ALERT STATUS" accent="blood" className="mb-6" glow>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AlertStat
            label="Critical"
            count={result.critical.length}
            level="critical"
            active={levelFilter === "critical"}
            onClick={() => { setLevelFilter(levelFilter === "critical" ? "all" : "critical"); sound.select(); }}
          />
          <AlertStat
            label="Severe"
            count={result.severe.length}
            level="severe"
            active={levelFilter === "severe"}
            onClick={() => { setLevelFilter(levelFilter === "severe" ? "all" : "severe"); sound.select(); }}
          />
          <AlertStat
            label="Warning"
            count={result.warning.length}
            level="warning"
            active={levelFilter === "warning"}
            onClick={() => { setLevelFilter(levelFilter === "warning" ? "all" : "warning"); sound.select(); }}
          />
          <AlertStat
            label="Population at risk"
            count={result.populationAtRiskM}
            level="critical"
            suffix="M"
            active={false}
            onClick={() => {}}
          />
        </div>
        <div className="mt-3 text-center text-xs text-content-secondary border-t border-border-dim pt-3">
          {result.thresholdsBreached} thresholds breached across {result.critical.length + result.severe.length} countries in critical or severe state
        </div>
      </TerminalCard>

      {/* Thresholds overview */}
      <TerminalCard title="THE 12 THRESHOLDS" accent="amber" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {THRESHOLDS.map((t) => (
            <div key={t.id} className="border border-border-dim p-2 text-xs">
              <div className="font-bold text-content-primary">{t.label}</div>
              <div className="text-[10px] text-content-dim">
                {t.direction === "above"
                  ? `≥ ${t.criticalValue}${t.unit}`
                  : `≤ ${t.criticalValue}${t.unit}`}{" "}
                · {t.dimension}
              </div>
            </div>
          ))}
        </div>
      </TerminalCard>

      {/* Dimension breakdown */}
      <TerminalCard title="STRESS BY DIMENSION" accent="blood" className="mb-6">
        <div className="space-y-2">
          {dimBreakdown.map((d) => (
            <div key={d.dimension} className="flex items-center gap-2">
              <div className="w-28 text-xs text-content-primary">{d.dimension}</div>
              <div className="flex-1 flex gap-1">
                {d.critical > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-blood-bright/20 text-blood-bright border border-blood-bright/40">
                    {d.critical} critical
                  </span>
                )}
                {d.severe > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-blood/20 text-blood border border-blood/40">
                    {d.severe} severe
                  </span>
                )}
                {d.warning > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-warning-amber/20 text-warning-amber border border-warning-amber/40">
                    {d.warning} warning
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </TerminalCard>

      {/* Country list */}
      {levelFilter !== "all" && (
        <button
          onClick={() => { setLevelFilter("all"); sound.nav(); }}
          className="text-[10px] text-content-secondary hover:text-blood-bright transition-colors uppercase tracking-widest mb-3"
        >
          ← Show all countries
        </button>
      )}

      <TerminalCard title="COUNTRIES NEAR THE EDGE" accent="blood" className="mb-6">
        <div className="space-y-2">
          {filtered.slice(0, showCount).map((c) => (
            <CountryCard key={c.iso3} country={c} />
          ))}
        </div>
        {showCount < filtered.length && (
          <button
            onClick={() => { setShowCount(showCount + 20); sound.select(); }}
            className="w-full mt-3 text-[10px] py-2 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors uppercase tracking-widest"
          >
            Show {Math.min(20, filtered.length - showCount)} more ({filtered.length - showCount} remaining)
          </button>
        )}
      </TerminalCard>

      {/* Methodology */}
      <TerminalCard title="METHODOLOGY" className="mb-6">
        <div className="text-xs text-content-secondary space-y-2">
          <p>
            Each threshold is based on an internationally recognized crisis standard:
            IPC famine classification (famine risk), WHO health worker density, World
            Bank poverty lines, V-Dem autocratization thresholds, and WHO air quality
            interim targets.
          </p>
          <p>
            <strong>Proximity</strong> is computed as:{" "}
            <code className="text-blood-bright">(current_value ÷ threshold) × 100</code>.
            A country at 90% proximity is close to the edge. At 100%, the threshold
            has been crossed.
          </p>
          <p>
            A country's overall alert level is determined by the number of thresholds
            breached and the worst-case proximity: 3+ thresholds crossed = CRITICAL,
            2+ = SEVERE, 1+ = WARNING.
          </p>
          <p className="text-content-dim">
            ⚠️ Proximity measures structural stress, not imminent events. A country
            can be at high proximity for years without tipping — but when it does
            tip, the conditions were already visible here.
          </p>
        </div>
      </TerminalCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

function AlertStat({
  label,
  count,
  level,
  suffix = "",
  active,
  onClick,
}: {
  label: string;
  count: number;
  level: AlertLevel;
  suffix?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={suffix !== ""}
      className={`text-center p-3 border transition-colors ${
        active ? "border-blood bg-panel" : "border-border-dim hover:border-blood"
      } ${suffix !== "" ? "cursor-default" : ""}`}
    >
      <div className="text-[10px] text-content-dim uppercase tracking-widest">{label}</div>
      <div className="text-3xl font-bold font-mono" style={{ color: alertColor(level) }}>
        {typeof count === "number" && count > 1000 ? count.toFixed(0) : count}{suffix}
      </div>
      {suffix === "" && (
        <div className="text-sm">{alertIcon(level)}</div>
      )}
    </button>
  );
}

function CountryCard({ country }: { country: CountryTipping }) {
  const [expanded, setExpanded] = useState(country.alertLevel === "critical" || country.alertLevel === "severe");
  const color = alertColor(country.alertLevel);

  return (
    <div
      className="border bg-void cursor-pointer transition-colors hover:border-blood"
      style={{ borderColor: color + "44", borderLeftWidth: 3, borderLeftColor: color }}
      onClick={() => { setExpanded(!expanded); sound.select(); }}
    >
      <div className="p-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/sorrow-map/${country.iso3.toLowerCase()}/`}
            className="text-sm font-bold text-content-primary hover:text-blood-bright"
            onClick={(e) => e.stopPropagation()}
          >
            {country.name}
          </Link>
          <StatusPill color={country.alertLevel === "critical" || country.alertLevel === "severe" ? "blood" : country.alertLevel === "warning" ? "amber" : "green"}>
            {alertIcon(country.alertLevel)} {alertLabel(country.alertLevel)}
          </StatusPill>
          <div className="flex-1" />
          <span className="text-xs text-content-dim">{country.region}</span>
          <span className="text-xs font-mono text-content-dim">{country.populationM.toFixed(0)}M</span>
        </div>

        {/* Proximity gauge */}
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-content-dim mb-1">
            <span>Proximity to tipping</span>
            <span className="font-mono font-bold" style={{ color }}>
              {country.proximityScore.toFixed(0)}/100
            </span>
          </div>
          <div className="h-2 bg-border-dim relative overflow-hidden">
            {/* Threshold markers */}
            <div className="absolute top-0 bottom-0 w-px bg-content-dim" style={{ left: "45%" }} />
            <div className="absolute top-0 bottom-0 w-px bg-content-dim" style={{ left: "65%" }} />
            <div className="absolute top-0 bottom-0 w-px bg-content-dim" style={{ left: "80%" }} />
            <div className="absolute top-0 bottom-0 w-px bg-content-dim" style={{ left: "90%" }} />
            {/* Fill */}
            <div
              className="h-full transition-all"
              style={{ width: `${country.proximityScore}%`, backgroundColor: color }}
            />
          </div>
        </div>

        {country.mostDangerous && (
          <div className="mt-2 text-[10px] text-content-secondary">
            Most dangerous:{" "}
            <span className="font-bold" style={{ color }}>
              {country.mostDangerous.threshold.label}
            </span>
            {" "}— {country.mostDangerous.threshold.consequence}
          </div>
        )}

        {expanded && country.thresholds.length > 0 && (
          <div className="mt-3 border-t border-border-dim pt-2 space-y-1">
            {country.thresholds.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span>{alertIcon(a.alertLevel)}</span>
                <span className="text-content-secondary flex-1 truncate">
                  {a.threshold.label}
                </span>
                <span className="font-mono text-content-dim">
                  {a.currentValue?.toFixed(1)}{a.threshold.unit} → {a.threshold.direction === "above" ? "≥" : "≤"}{a.threshold.criticalValue}{a.threshold.unit}
                </span>
                <span className="font-mono w-8 text-right" style={{ color: alertColor(a.alertLevel) }}>
                  {a.proximity.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
