"use client";

/**
 * V FOR X — The Countdown
 *
 * SDG 2030 deadline tracker. Six parallel equations — water, health,
 * energy, education, climate, inequality — each with a gap, a cost,
 * and a ticking clock. The moral calculus made inescapable.
 *
 * [43] THE COUNTDOWN — Code: 43
 */

import { useState, useMemo } from "react";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, SdgEquation } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";

const data = backbone as WorldBackbone;

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  off_track: { color: "var(--color-blood)", label: "OFF TRACK" },
  critically_off_track: {
    color: "var(--color-blood)",
    label: "CRITICALLY OFF TRACK",
  },
  widening: { color: "var(--color-blood)", label: "WIDENING" },
  on_track: { color: "var(--color-terminal-green)", label: "ON TRACK" },
};

const SDG_ICONS: Record<string, string> = {
  droplet: "💧",
  "heart-pulse": "❤️",
  zap: "⚡",
  "book-open": "📖",
  globe: "🌍",
  scale: "⚖️",
};

function formatCost(cost: SdgEquation["cost"]): string {
  if (cost.annual_trillion) {
    return `$${cost.annual_trillion}T/yr`;
  }
  return `$${cost.annual_billion}B/yr`;
}

function formatGapValue(key: string, val: number | string): string {
  if (typeof val === "number") {
    if (key.includes("_m") && val > 1000) {
      return `${(val / 1000).toFixed(1)} billion`;
    }
    if (key.includes("_m")) {
      return `${val} million`;
    }
    if (key.includes("pct")) {
      return `${val}%`;
    }
    return val.toLocaleString();
  }
  return val;
}

export default function TheCountdownPage() {
  const [activeKey, setActiveKey] = useState<string>("sdg6_water");

  const sdgData = data.sdg_equations;
  const equationKeys = Object.keys(sdgData?.equations || {});
  const active = sdgData?.equations[activeKey];

  /* ═══ Quick wins ═══ */
  const quickWins = sdgData?.meta;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="text-content-dim text-xs">
          [43] SDG DEADLINE COUNTDOWN
        </div>
        <h1 className="text-blood-bright text-2xl font-bold tracking-widest mt-1">
          <span className="glitch" data-text="THE COUNTDOWN">
            THE COUNTDOWN
          </span>
        </h1>
        <p className="text-content-secondary text-sm mt-2 max-w-2xl">
          {
            "// Six UN Sustainable Development Goals. Six parallel equations. Each has a gap measured in human lives, a cost measured in billions, and a deadline measured in years. All off track."
          }
        </p>
      </div>

      {/* Quick wins banner */}
      {quickWins?.quick_wins_total_billion && (
        <TerminalCard title="// THE QUICK WINS" glow accent="green">
          <div className="space-y-2">
            <div className="text-terminal-green text-lg font-bold">
              {quickWins.quick_wins_label}
            </div>
            <div className="text-content-secondary text-xs">
              {`$${quickWins.quick_wins_total_billion}B/yr = ${quickWins.quick_wins_pct_military}% of global military spending = ${quickWins.quick_wins_days_military} days of war budget`}
            </div>
            <div className="text-content-dim text-[10px] mt-2">
              {
                "// Water (SDG 6) + Healthcare (SDG 3) + Energy (SDG 7) + Education (SDG 4) combined."
              }
            </div>
          </div>
        </TerminalCard>
      )}

      {/* SDG grid selector */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {equationKeys.map((key) => {
          const eq = sdgData!.equations[key];
          const isActive = key === activeKey;
          const statusStyle =
            STATUS_STYLES[eq.status] || STATUS_STYLES.off_track;
          return (
            <button
              key={key}
              onClick={() => {
                setActiveKey(key);
                sound.select();
              }}
              className={`border p-3 text-center transition-all ${
                isActive
                  ? "border-blood bg-blood/10"
                  : "border-border-dim hover:border-blood"
              }`}
            >
              <div className="text-2xl mb-1">
                {SDG_ICONS[eq.icon] || "◆"}
              </div>
              <div className="text-[9px] text-content-dim uppercase">
                SDG {eq.sdg}
              </div>
              <div
                className="text-[10px] font-bold mt-1 leading-tight"
                style={{ color: isActive ? "var(--color-blood-bright)" : "var(--color-content-primary)" }}
              >
                {eq.title}
              </div>
              <div
                className="text-[8px] mt-1 uppercase tracking-wide"
                style={{ color: statusStyle.color }}
              >
                {statusStyle.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active equation detail */}
      {active && (
        <>
          <TerminalCard
            title={`// SDG ${active.sdg} — ${active.title.toUpperCase()}`}
            glow
          >
            <div className="space-y-4">
              <div className="text-content-secondary text-sm italic">
                "{active.moral_framing}"
              </div>
              <div className="text-content-dim text-[10px] border-l-2 border-border-dim pl-3">
                <span className="text-amber">TARGET: </span>
                {active.sdg_target}
              </div>

              {/* The Gap */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-border-dim p-3">
                  <div className="text-content-dim text-[10px] uppercase mb-2">
                    THE GAP
                  </div>
                  {Object.entries(active.current_gap)
                    .filter(([k]) => !k.startsWith("label"))
                    .map(([key, val]) => (
                      <div
                        key={key}
                        className="flex items-baseline justify-between py-0.5 text-xs"
                      >
                        <span className="text-content-dim text-[10px]">
                          {key.replaceAll("_", " ")}
                        </span>
                        <span className="text-content-primary font-bold">
                          {formatGapValue(key, val)}
                        </span>
                      </div>
                    ))}
                </div>

                {/* The Cost */}
                <div className="border border-blood/40 p-3">
                  <div className="text-blood-bright text-[10px] uppercase mb-2">
                    THE COST
                  </div>
                  <div className="text-blood-bright text-2xl font-bold">
                    {formatCost(active.cost)}
                  </div>
                  <div className="text-content-dim text-[10px] mt-1">
                    {active.cost.source}
                  </div>
                </div>
              </div>

              {/* Affordability */}
              <div className="border border-border-dim p-3">
                <div className="text-content-dim text-[10px] uppercase mb-2">
                  AFFORDABILITY FRAMING
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-content-primary text-lg font-bold">
                      {active.affordability.pct_world_gdp}%
                    </div>
                    <div className="text-content-dim text-[9px]">
                      of world GDP
                    </div>
                  </div>
                  <div>
                    <div className="text-blood-bright text-lg font-bold">
                      {active.affordability.pct_military}%
                    </div>
                    <div className="text-content-dim text-[9px]">
                      of military spending
                    </div>
                  </div>
                  <div>
                    <div className="text-blood-bright text-lg font-bold">
                      {active.affordability.days_of_military}
                    </div>
                    <div className="text-content-dim text-[9px]">
                      days of war budget
                    </div>
                  </div>
                </div>
                <div className="text-content-secondary text-xs mt-3 pt-2 border-t border-border-dim">
                  {active.affordability.framing}
                </div>
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-3">
                <span className="text-content-dim text-[10px] uppercase">
                  STATUS:
                </span>
                <span
                  className="text-xs font-bold px-3 py-1 border"
                  style={{
                    color: (STATUS_STYLES[active.status] || STATUS_STYLES.off_track).color,
                    borderColor: (STATUS_STYLES[active.status] || STATUS_STYLES.off_track).color,
                  }}
                >
                  {(STATUS_STYLES[active.status] || STATUS_STYLES.off_track).label}
                </span>
              </div>
            </div>
          </TerminalCard>

          {/* Interventions */}
          <TerminalCard title="// PROVEN INTERVENTIONS" accent="amber">
            <div className="space-y-2">
              {active.interventions.map((int, i) => (
                <div
                  key={i}
                  className="border border-border-dim p-2"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-content-primary text-xs font-bold">
                      {int.name}
                    </span>
                    {int.cost_billion_yr && (
                      <span className="text-blood-bright text-[10px]">
                        ${int.cost_billion_yr}B/yr
                      </span>
                    )}
                    {int.revenue_billion_yr && (
                      <span className="text-terminal-green text-[10px]">
                        +${int.revenue_billion_yr}B/yr revenue
                      </span>
                    )}
                  </div>
                  <div className="text-content-secondary text-[10px]">
                    {int.roi_note}
                  </div>
                  <div className="text-content-dim text-[9px] mt-1">
                    Reach: {int.reach_m >= 1000 ? `${(int.reach_m / 1000).toFixed(1)} billion` : `${int.reach_m} million`} people
                  </div>
                </div>
              ))}
            </div>
          </TerminalCard>
        </>
      )}

      {/* Footer: all equations summary table */}
      <TerminalCard title="// ALL EQUATIONS — SUMMARY">
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-border-dim text-content-dim">
                <th className="text-left py-2 pr-3">SDG</th>
                <th className="text-left py-2 pr-3">TITLE</th>
                <th className="text-right py-2 pr-3">COST/YR</th>
                <th className="text-right py-2 pr-3">DAYS OF WAR</th>
                <th className="text-right py-2">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {equationKeys.map((key) => {
                const eq = sdgData!.equations[key];
                const statusStyle = STATUS_STYLES[eq.status] || STATUS_STYLES.off_track;
                return (
                  <tr
                    key={key}
                    onClick={() => {
                      setActiveKey(key);
                      sound.select();
                    }}
                    className="border-b border-border-dim/30 hover:bg-panel cursor-pointer transition-colors"
                  >
                    <td className="py-1.5 pr-3 text-content-dim">SDG {eq.sdg}</td>
                    <td className="py-1.5 pr-3 text-content-primary">{eq.title}</td>
                    <td className="py-1.5 pr-3 text-right text-blood-bright font-bold">
                      {formatCost(eq.cost)}
                    </td>
                    <td className="py-1.5 pr-3 text-right text-content-secondary">
                      {eq.affordability.days_of_military}d
                    </td>
                    <td
                      className="py-1.5 text-right"
                      style={{ color: statusStyle.color }}
                    >
                      {statusStyle.label}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </TerminalCard>

      {/* Sources */}
      <TerminalCard title="// METHODOLOGY & SOURCES">
        <p className="text-content-secondary text-[10px] mb-2">
          {sdgData?.meta.methodology}
        </p>
        <ul className="space-y-1">
          {sdgData?.meta.sources_overview.map((s, i) => (
            <li key={i} className="text-content-dim text-[10px]">
              [{i + 1}] {s}
            </li>
          ))}
        </ul>
      </TerminalCard>
    </div>
  );
}
