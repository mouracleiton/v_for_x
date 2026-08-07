"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import DataBar from "@/components/ui/DataBar";
import { sound } from "@/lib/sound";
import { formatNumber } from "@/lib/format";
import centroidsData from "@/data/country_centroids.json";
import {
  buildFlowNodes,
  computeFlowStats,
  estimateFlows,
  type FlowEdge,
  type FlowNode,
} from "@/lib/flows";

const centroids = centroidsData as unknown as Record<string, [number, number]>;

/* ═══ LEAFLET MAP — client-only (no SSR) ═══ */
const FlowMap = dynamic(() => import("@/components/map/FlowMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-content-dim text-xs">
      <span className="cursor-blink">&gt; LOADING MAP...</span>
    </div>
  ),
});

type ViewMode = "all" | "regional" | "continental";
type LayerMode = "refugees" | "displaced" | "idps";

export default function TheExodusPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [layerMode, setLayerMode] = useState<LayerMode>("refugees");
  const [selectedOrigin, setSelectedOrigin] = useState<string | null>(null);
  const [hoveredFlow, setHoveredFlow] = useState<FlowEdge | null>(null);

  const nodes = useMemo(() => buildFlowNodes(), []);
  const stats = useMemo(() => computeFlowStats(nodes), [nodes]);
  const edges = useMemo(() => estimateFlows(nodes), [nodes]);

  const maxFlow = useMemo(() => Math.max(...edges.map((e) => e.estimatedFlow), 1), [edges]);

  const visibleEdges = useMemo(() => {
    let filtered = edges;
    if (viewMode === "regional") filtered = edges.filter((e) => e.type === "regional");
    if (viewMode === "continental") filtered = edges.filter((e) => e.type === "continental");
    if (selectedOrigin) filtered = filtered.filter((e) => e.from === selectedOrigin);
    return filtered;
  }, [edges, viewMode, selectedOrigin]);

  // Max node values for scaling
  const maxNodeValue = useMemo(() => {
    const getValue = (n: FlowNode) =>
      layerMode === "refugees" ? n.refugeesOrigin : layerMode === "displaced" ? n.forciblyDisplaced : n.idpsDisaster;
    return Math.max(...nodes.map(getValue), 1);
  }, [nodes, layerMode]);

  const maxHostValue = useMemo(() => stats.topHosts[0]?.refugeesHosted || 1, [stats]);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[16] THE EXODUS</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood tracking-widest">
          THE EXODUS
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // {formatNumber(stats.totalDisplaced)} people are forcibly displaced right now.
          Every arc on this map is a human stream fleeing violence, hunger, or disaster.
        </p>
      </div>

      {/* Global stats bar */}
      <TerminalCard title="GLOBAL DISPLACEMENT CRISIS" accent="blood" glow className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">REFUGEES</div>
            <div className="text-2xl text-blood-bright font-bold glow-blood">
              {formatNumber(stats.totalRefugees)}
            </div>
            <div className="text-[10px] text-content-dim">crossed a border</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">FORCIBLY DISPLACED</div>
            <div className="text-2xl text-blood font-bold">
              {formatNumber(stats.totalDisplaced)}
            </div>
            <div className="text-[10px] text-content-dim">total</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">IDPs (DISASTER)</div>
            <div className="text-2xl text-content-primary font-bold">
              {formatNumber(stats.totalIDPs)}
            </div>
            <div className="text-[10px] text-content-dim">displaced internally</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">ORIGIN/HOST</div>
            <div className="text-2xl text-content-primary font-bold">
              {stats.totalOrigins}/{stats.totalHosts}
            </div>
            <div className="text-[10px] text-content-dim">countries involved</div>
          </div>
        </div>
      </TerminalCard>

      {/* Map controls */}
      <TerminalCard title="FLOW MAP" accent="amber" className="mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Layer mode */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-content-dim uppercase tracking-widest">LAYER:</span>
            {([
              { id: "refugees", label: "REFUGEES" },
              { id: "displaced", label: "DISPLACED" },
              { id: "idps", label: "IDPs" },
            ] as const).map((m) => (
              <button
                key={m.id}
                onClick={() => { setLayerMode(m.id); sound.select(); }}
                className={`text-[10px] px-2 py-1 border transition-colors ${
                  layerMode === m.id
                    ? "border-blood text-blood-bright bg-blood/5"
                    : "border-border-dim text-content-secondary hover:border-blood"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Flow filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-content-dim uppercase tracking-widest">FLOWS:</span>
            {([
              { id: "all", label: "ALL" },
              { id: "regional", label: "REGIONAL" },
              { id: "continental", label: "GLOBAL" },
            ] as const).map((m) => (
              <button
                key={m.id}
                onClick={() => { setViewMode(m.id); sound.select(); }}
                className={`text-[10px] px-2 py-1 border transition-colors ${
                  viewMode === m.id
                    ? "border-terminal-green text-terminal-green bg-terminal-green/5"
                    : "border-border-dim text-content-secondary hover:border-terminal-green"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {selectedOrigin && (
            <button
              onClick={() => { setSelectedOrigin(null); sound.select(); }}
              className="text-[10px] px-2 py-1 border border-blood text-blood-bright hover:bg-blood hover:text-void"
            >
              [ CLEAR FILTER: {selectedOrigin} ]
            </button>
          )}
        </div>

        {/* Leaflet Map (client-only) */}
        <div className="border border-border-dim" style={{ height: "500px", background: "#0a0a0a" }}>
          <FlowMap
            nodes={nodes}
            edges={visibleEdges}
            maxFlow={maxFlow}
            layerMode={layerMode}
            selectedOrigin={selectedOrigin}
            onSelectOrigin={(iso3) => { setSelectedOrigin(iso3); sound.nav(); }}
            onHoverFlow={setHoveredFlow}
            centroidsData={centroids}
            maxNodeValue={maxNodeValue}
            maxHostValue={maxHostValue}
          />
        </div>

        {/* Hovered flow info */}
        {hoveredFlow && (
          <div className="mt-2 p-2 border border-border-dim bg-void text-xs">
            <span className="text-blood-bright font-bold">{hoveredFlow.fromName}</span>
            {" → "}
            <span className="text-terminal-green font-bold">{hoveredFlow.toName}</span>
            <span className="text-content-secondary ml-2">
              ~{formatNumber(hoveredFlow.estimatedFlow)} people ({hoveredFlow.type})
            </span>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-3 text-[10px] text-content-secondary">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full border border-blood" style={{ backgroundColor: "#cc0000", opacity: 0.7 }} />
            ORIGIN COUNTRY
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full border border-terminal-green" style={{ backgroundColor: "#006633", opacity: 0.6 }} />
            HOST COUNTRY
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-6 h-px bg-blood" />
            REGIONAL FLOW
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-6 h-px" style={{ backgroundColor: "#ff6600" }} />
            GLOBAL FLOW
          </div>
          <span className="text-content-dim ml-auto">
            // Flows estimated from UNHCR origin/host data · bilateral detail not available
          </span>
        </div>
      </TerminalCard>

      {/* Top origins table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <TerminalCard title={`TOP ORIGINS // ${selectedOrigin ? "FILTERED" : "WORLD"}`} accent="blood">
          {(selectedOrigin ? stats.topOrigins.filter((n) => n.iso3 === selectedOrigin) : stats.topOrigins.slice(0, 10)).map((n, i) => (
            <Link
              key={n.iso3}
              href={`/sorrow-map/${n.iso3.toLowerCase()}/`}
              className="flex items-center gap-3 p-2 terminal-card hover:border-blood mb-1 transition-colors block"
            >
              <span className="text-blood-dim font-bold text-xs w-6">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-content-primary truncate">{n.name}</span>
                  {n.isHotspot && <span className="text-blood-bright text-[9px]">⚠</span>}
                </div>
                <div className="text-[10px] text-content-dim">{n.region}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-blood-bright">{formatNumber(n.refugeesOrigin)}</div>
                <div className="text-[9px] text-content-dim">refugees</div>
              </div>
              <button
                onClick={(e) => { e.preventDefault(); setSelectedOrigin(selectedOrigin === n.iso3 ? null : n.iso3); sound.select(); }}
                className="text-[9px] px-1.5 py-0.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
              >
                TRACE
              </button>
            </Link>
          ))}
        </TerminalCard>

        <TerminalCard title="TOP HOSTS // BURDEN SHARE" accent="green">
          {stats.topHosts.slice(0, 10).map((n, i) => (
            <Link
              key={n.iso3}
              href={`/sorrow-map/${n.iso3.toLowerCase()}/`}
              className="flex items-center gap-3 p-2 terminal-card hover:border-terminal-green mb-1 transition-colors block"
            >
              <span className="text-terminal-green/50 font-bold text-xs w-6">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-content-primary truncate">{n.name}</span>
                </div>
                <div className="text-[10px] text-content-dim">{n.region}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-terminal-green">{formatNumber(n.refugeesHosted)}</div>
                <div className="text-[9px] text-content-dim">hosting</div>
              </div>
            </Link>
          ))}
        </TerminalCard>
      </div>

      {/* Displacement ratio — most affected relative to population */}
      <TerminalCard title="DISPLACEMENT AS % OF POPULATION // THE INVISIBLE CRISES" className="mb-6">
        <p className="text-xs text-content-dim mb-3">
          // These countries have the highest displaced-to-population ratio. The world doesn&apos;t talk about them.
        </p>
        <div className="space-y-2">
          {stats.worstDisplacementRatio.map((n) => {
            const ratio = n.forciblyDisplaced / (n.popM * 1_000_000);
            const pct = ratio * 100;
            return (
              <Link
                key={n.iso3}
                href={`/sorrow-map/${n.iso3.toLowerCase()}/`}
                className="flex items-center gap-3 p-2 terminal-card hover:border-blood transition-colors block"
              >
                <span className="text-xs font-bold text-content-primary w-32 truncate">{n.name}</span>
                <div className="flex-1">
                  <DataBar
                    value={pct}
                    max={100}
                    label={`${pct.toFixed(1)}% of population displaced`}
                    unit="%"
                  />
                </div>
                <span className="text-xs text-blood-bright font-bold w-24 text-right">
                  {formatNumber(n.forciblyDisplaced)}
                </span>
              </Link>
            );
          })}
        </div>
      </TerminalCard>

      {/* Cross-links */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/sorrow-map/"
          className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
        >
          ▶ SORROW MAP
        </Link>
        <Link
          href="/registry/"
          className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
        >
          ▶ ACCOUNTABILITY
        </Link>
        <Link
          href="/the-index/"
          className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
        >
          ▶ VULNERABILITY INDEX
        </Link>
      </div>
    </div>
  );
}
