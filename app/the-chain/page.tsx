"use client";

/**
 * V FOR X — The Chain
 *
 * Interactive relationship graph: arms transfers, sanctions, and aid flows
 * between states. Derived from SIPRI, UN/EU/US sanctions, and OECD DAC data.
 *
 * [42] THE CHAIN — Code: 42
 *
 * Visualizes 3 types of geopolitical relationships:
 *   - Arms transfers (who sells weapons to whom, and for how much)
 *   - Sanctions (who sanctions whom, and what type)
 *   - Aid flows (who donates to whom, and how much)
 *
 * Features:
 *   - Country-centric view: select a country, see all its relationships
 *   - Flow-type filter: toggle arms / sanctions / aid independently
 *   - Ranked tables: top exporters, top sanctioned, top donors
 *   - Total flow volume across each category
 */

import { useState, useMemo } from "react";
import relationshipsData from "@/data/relationships.json";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";

const data = backbone as WorldBackbone;

interface ArmsTransfer {
  source_iso3: string;
  target_iso3: string;
  value_musd: number;
  category: string;
}
interface Sanction {
  imposer_iso3: string;
  target_iso3: string;
  type: string;
}
interface AidFlow {
  donor_iso3: string;
  recipient_iso3: string;
  amount_musd: number;
}

interface Relationships {
  meta: {
    title: string;
    description: string;
    sources: string[];
  };
  arms_transfers: ArmsTransfer[];
  sanctions: Sanction[];
  aid_flows: AidFlow[];
}

const rel = relationshipsData as unknown as Relationships;

/* ═══ ISO3 → Country name ═══ */
const ISO3_NAME: Record<string, string> = {};
for (const c of data.countries) {
  ISO3_NAME[c.iso3] = c.name_en;
}
// Add non-country entities
const EXTRA_NAMES: Record<string, string> = {
  EU: "European Union",
  UN: "United Nations",
};
const ALL_NAMES = { ...ISO3_NAME, ...EXTRA_NAMES };

function nameOf(iso3: string): string {
  return ALL_NAMES[iso3] || iso3;
}

type FlowType = "arms" | "sanctions" | "aid";

/* ═══ Flow color scheme ═══ */
const FLOW_COLORS: Record<FlowType, string> = {
  arms: "var(--color-blood)",
  sanctions: "var(--color-warning-amber)",
  aid: "var(--color-terminal-green)",
};

const FLOW_LABELS: Record<FlowType, string> = {
  arms: "ARMS TRANSFERS",
  sanctions: "SANCTIONS",
  aid: "AID FLOWS",
};

interface UnifiedFlow {
  id: string;
  type: FlowType;
  source: string;
  target: string;
  value: number;
  detail: string;
}

/* ═══ Normalize all flows into unified list ═══ */
function buildFlows(): UnifiedFlow[] {
  const flows: UnifiedFlow[] = [];
  for (const a of rel.arms_transfers) {
    flows.push({
      id: `arms-${a.source_iso3}-${a.target_iso3}`,
      type: "arms",
      source: a.source_iso3,
      target: a.target_iso3,
      value: a.value_musd,
      detail: a.category,
    });
  }
  for (const s of rel.sanctions) {
    flows.push({
      id: `san-${s.imposer_iso3}-${s.target_iso3}`,
      type: "sanctions",
      source: s.imposer_iso3,
      target: s.target_iso3,
      value: 0,
      detail: s.type,
    });
  }
  for (const a of rel.aid_flows) {
    flows.push({
      id: `aid-${a.donor_iso3}-${a.recipient_iso3}`,
      type: "aid",
      source: a.donor_iso3,
      target: a.recipient_iso3,
      value: a.amount_musd,
      detail: "",
    });
  }
  return flows;
}

const ALL_FLOWS = buildFlows();

/* ═══ Country selector: all countries that appear in any flow ═══ */
const COUNTRIES_IN_GRAPH = (() => {
  const set = new Set<string>();
  for (const f of ALL_FLOWS) {
    set.add(f.source);
    set.add(f.target);
  }
  return [...set].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
})();

function formatValue(type: FlowType, value: number): string {
  if (type === "sanctions") return "";
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}B`;
  return `$${value}M`;
}

export default function TheChainPage() {
  const [activeTypes, setActiveTypes] = useState<Set<FlowType>>(
    new Set(["arms", "sanctions", "aid"])
  );
  const [selected, setSelected] = useState<string>("USA");
  const [view, setView] = useState<"country" | "global">("country");

  const toggleType = (t: FlowType) => {
    const next = new Set(activeTypes);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setActiveTypes(next);
    sound.select();
  };

  /* ═══ Filtered flows ═══ */
  const filteredFlows = useMemo(
    () => ALL_FLOWS.filter((f) => activeTypes.has(f.type)),
    [activeTypes]
  );

  /* ═══ Country-centric flows ═══ */
  const countryFlows = useMemo(() => {
    if (view !== "country") return [];
    return filteredFlows.filter(
      (f) => f.source === selected || f.target === selected
    );
  }, [filteredFlows, selected, view]);

  /* ═══ Global rankings ═══ */
  const rankings = useMemo(() => {
    const armsExport: Record<string, number> = {};
    const sanctioned: Record<string, number> = {};
    const aidDonor: Record<string, number> = {};

    for (const f of filteredFlows) {
      if (f.type === "arms") {
        armsExport[f.source] = (armsExport[f.source] || 0) + f.value;
      } else if (f.type === "sanctions") {
        sanctioned[f.target] = (sanctioned[f.target] || 0) + 1;
      } else if (f.type === "aid") {
        aidDonor[f.source] = (aidDonor[f.source] || 0) + f.value;
      }
    }

    const topArms = Object.entries(armsExport)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const topSanctioned = Object.entries(sanctioned)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const topDonors = Object.entries(aidDonor)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return { topArms, topSanctioned, topDonors };
  }, [filteredFlows]);

  /* ═══ Totals ═══ */
  const totals = useMemo(() => {
    let armsTotal = 0;
    let aidTotal = 0;
    let sanCount = 0;
    for (const f of ALL_FLOWS) {
      if (f.type === "arms") armsTotal += f.value;
      else if (f.type === "aid") aidTotal += f.value;
      else if (f.type === "sanctions") sanCount++;
    }
    return { armsTotal, aidTotal, sanCount };
  }, []);

  const maxArmsVal = Math.max(...countryFlows.filter(f=>f.type==="arms").map(f=>f.value), 1);
  const maxAidVal = Math.max(...countryFlows.filter(f=>f.type==="aid").map(f=>f.value), 1);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="text-content-dim text-xs">
          [42] GEOPOLITICAL RELATIONSHIP GRAPH
        </div>
        <h1 className="text-blood-bright text-2xl font-bold tracking-widest mt-1">
          <span className="glitch" data-text="THE CHAIN">
            THE CHAIN
          </span>
        </h1>
        <p className="text-content-secondary text-sm mt-2 max-w-2xl">
          {rel.meta.description}
        </p>
      </div>

      {/* Global totals bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-blood/40 p-3 text-center">
          <div className="text-blood-bright text-xl font-bold">
            ${(totals.armsTotal / 1000).toFixed(1)}B
          </div>
          <div className="text-content-dim text-[9px] uppercase tracking-wider">
            Total Arms Tracked
          </div>
        </div>
        <div className="border border-amber/40 p-3 text-center">
          <div className="text-amber text-xl font-bold">
            {totals.sanCount}
          </div>
          <div className="text-content-dim text-[9px] uppercase tracking-wider">
            Active Sanctions
          </div>
        </div>
        <div className="border border-terminal-green/40 p-3 text-center">
          <div className="text-terminal-green text-xl font-bold">
            ${(totals.aidTotal / 1000).toFixed(1)}B
          </div>
          <div className="text-content-dim text-[9px] uppercase tracking-wider">
            Total Aid Flows
          </div>
        </div>
      </div>

      {/* Flow type filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-content-dim text-[10px] uppercase">
          FILTER:
        </span>
        {(["arms", "sanctions", "aid"] as FlowType[]).map((t) => (
          <button
            key={t}
            onClick={() => toggleType(t)}
            className="px-3 py-1.5 text-[10px] border transition-all flex items-center gap-2"
            style={{
              borderColor: activeTypes.has(t) ? FLOW_COLORS[t] : "var(--color-border-dim)",
              color: activeTypes.has(t) ? FLOW_COLORS[t] : "var(--color-content-dim)",
              background: activeTypes.has(t) ? `${FLOW_COLORS[t]}15` : "transparent",
            }}
          >
            <span
              className="inline-block w-2 h-2"
              style={{ background: FLOW_COLORS[t] }}
            />
            {FLOW_LABELS[t]}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { setView("country"); sound.nav(); }}
            className={`px-3 py-1 text-[10px] border transition-colors ${
              view === "country"
                ? "border-blood text-blood-bright bg-blood/10"
                : "border-border-dim text-content-dim hover:border-blood"
            }`}
          >
            COUNTRY VIEW
          </button>
          <button
            onClick={() => { setView("global"); sound.nav(); }}
            className={`px-3 py-1 text-[10px] border transition-colors ${
              view === "global"
                ? "border-blood text-blood-bright bg-blood/10"
                : "border-border-dim text-content-dim hover:border-blood"
            }`}
          >
            GLOBAL RANKINGS
          </button>
        </div>
      </div>

      {/* COUNTRY VIEW */}
      {view === "country" && (
        <>
          <TerminalCard title="// SELECT A COUNTRY">
            <select
              value={selected}
              onChange={(e) => { setSelected(e.target.value); sound.select(); }}
              className="w-full bg-abyss border border-border-dim px-3 py-2 text-content-primary text-sm focus:border-blood outline-none"
            >
              {COUNTRIES_IN_GRAPH.map((iso3) => (
                <option key={iso3} value={iso3}>
                  {nameOf(iso3)} ({iso3})
                </option>
              ))}
            </select>
          </TerminalCard>

          {/* Relationship visualization */}
          <TerminalCard title={`// ${nameOf(selected).toUpperCase()} (${selected})`} glow>
            {countryFlows.length === 0 ? (
              <p className="text-content-dim text-xs">
                {`// No ${[...activeTypes].map(t => FLOW_LABELS[t].toLowerCase()).join(" / ")} flows found for this country with current filters.`}
              </p>
            ) : (
              <div className="space-y-1">
                {countryFlows.map((f) => {
                  const isSource = f.source === selected;
                  const direction = isSource ? "→" : "←";
                  const counterparty = isSource ? f.target : f.source;
                  const widthPct =
                    f.type === "arms"
                      ? (f.value / maxArmsVal) * 100
                      : f.type === "aid"
                        ? (f.value / maxAidVal) * 100
                        : 100;

                  return (
                    <div
                      key={f.id}
                      className="flex items-center gap-2 py-1.5 border-b border-border-dim/50 last:border-0 group"
                    >
                      <span
                        className="inline-block w-1.5 h-1.5 shrink-0"
                        style={{ background: FLOW_COLORS[f.type] }}
                      />
                      <span className="text-content-dim text-[10px] uppercase w-16 shrink-0">
                        {f.type === "arms" ? "ARMS" : f.type === "sanctions" ? "SANCTION" : "AID"}
                      </span>
                      <span className="text-content-secondary text-[10px] w-4 shrink-0">
                        {direction}
                      </span>
                      <span className="text-content-primary text-xs font-bold w-32 shrink-0 truncate">
                        {nameOf(counterparty)} ({counterparty})
                      </span>
                      <div className="flex-1 min-w-[60px]">
                        <div
                          className="h-2"
                          style={{
                            width: `${Math.max(widthPct, 5)}%`,
                            background: FLOW_COLORS[f.type],
                            opacity: 0.7,
                          }}
                        />
                      </div>
                      <span className="text-[10px] w-16 text-right shrink-0" style={{ color: FLOW_COLORS[f.type] }}>
                        {formatValue(f.type, f.value)}
                      </span>
                      {f.detail && (
                        <span className="text-content-dim text-[9px] truncate max-w-[120px] hidden md:block">
                          {f.detail}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TerminalCard>
        </>
      )}

      {/* GLOBAL RANKINGS VIEW */}
      {view === "global" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Top arms exporters */}
          <TerminalCard title="// TOP ARMS EXPORTERS" accent="blood">
            <div className="space-y-1">
              {rankings.topArms.length === 0 ? (
                <p className="text-content-dim text-[10px]">// No data</p>
              ) : (
                rankings.topArms.map(([iso3, val], i) => (
                  <div key={iso3} className="flex items-center gap-2 py-1">
                    <span className="text-content-dim text-[10px] w-5">{i + 1}.</span>
                    <span className="text-content-primary text-xs font-bold flex-1 truncate">
                      {nameOf(iso3)}
                    </span>
                    <span className="text-blood-bright text-xs font-bold">
                      ${(val / 1000).toFixed(1)}B
                    </span>
                  </div>
                ))
              )}
            </div>
          </TerminalCard>

          {/* Most sanctioned */}
          <TerminalCard title="// MOST SANCTIONED" accent="amber">
            <div className="space-y-1">
              {rankings.topSanctioned.length === 0 ? (
                <p className="text-content-dim text-[10px]">// No data</p>
              ) : (
                rankings.topSanctioned.map(([iso3, count], i) => (
                  <div key={iso3} className="flex items-center gap-2 py-1">
                    <span className="text-content-dim text-[10px] w-5">{i + 1}.</span>
                    <span className="text-content-primary text-xs font-bold flex-1 truncate">
                      {nameOf(iso3)}
                    </span>
                    <span className="text-amber text-xs font-bold">
                      {count}× {count === 1 ? "regime" : "regimes"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </TerminalCard>

          {/* Top aid donors */}
          <TerminalCard title="// TOP AID DONORS" accent="green">
            <div className="space-y-1">
              {rankings.topDonors.length === 0 ? (
                <p className="text-content-dim text-[10px]">// No data</p>
              ) : (
                rankings.topDonors.map(([iso3, val], i) => (
                  <div key={iso3} className="flex items-center gap-2 py-1">
                    <span className="text-content-dim text-[10px] w-5">{i + 1}.</span>
                    <span className="text-content-primary text-xs font-bold flex-1 truncate">
                      {nameOf(iso3)}
                    </span>
                    <span className="text-terminal-green text-xs font-bold">
                      ${(val / 1000).toFixed(1)}B
                    </span>
                  </div>
                ))
              )}
            </div>
          </TerminalCard>
        </div>
      )}

      {/* Sources */}
      <TerminalCard title="// SOURCES">
        <ul className="space-y-1">
          {rel.meta.sources.map((s, i) => (
            <li key={i} className="text-content-dim text-[10px]">
              [{i + 1}] {s}
            </li>
          ))}
        </ul>
      </TerminalCard>
    </div>
  );
}
