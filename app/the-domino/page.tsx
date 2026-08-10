"use client";

/**
 * V FOR X — The Domino [73]
 *
 * Cascading crisis simulator. Pick a shock, watch the dominoes fall.
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import {
  SHOCK_PRESETS,
  simulateDomino,
  severityColor,
  severityLabel,
  DIMENSION_LABELS,
  type ShockPreset,
  type DominoResult,
  type PropagationStep,
} from "@/lib/domino";
import type { WorldBackbone } from "@/lib/types";

const data = backbone as WorldBackbone;

export default function DominoPage() {
  const [selectedPreset, setSelectedPreset] = useState<ShockPreset>(SHOCK_PRESETS[0]);
  const [customIso3, setCustomIso3] = useState("");
  const [customSeverity, setCustomSeverity] = useState(0.8);
  const [showCustom, setShowCustom] = useState(false);

  const activePreset: ShockPreset = useMemo(() => {
    if (showCustom && customIso3) {
      return {
        id: "custom",
        label: "Custom Shock",
        description: `Severity ${customSeverity.toFixed(2)} originating in ${customIso3}`,
        epicenterIso3: customIso3.toUpperCase(),
        primaryDimension: "hunger",
        initialSeverity: customSeverity,
        icon: "💥",
      };
    }
    return selectedPreset;
  }, [showCustom, customIso3, customSeverity, selectedPreset]);

  const result = useMemo(
    () => simulateDomino(data, activePreset),
    [activePreset],
  );

  // Group steps by cascade level
  const stepsByLevel = useMemo(() => {
    const groups: Record<number, PropagationStep[]> = {};
    for (const s of result.steps) {
      if (!groups[s.step]) groups[s.step] = [];
      groups[s.step].push(s);
    }
    return groups;
  }, [result]);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-mono px-1.5 py-0.5 border border-blood text-blood-bright">[73]</span>
          <h1 className="text-2xl md:text-4xl font-bold text-blood-bright glow-blood tracking-widest">
            THE DOMINO
          </h1>
        </div>
        <p className="text-content-secondary text-sm">
          No crisis is isolated. Pick a shock and trace the cascade across countries and dimensions.
          Every pathway is transparent — every weight is explained.
        </p>
      </div>

      {/* Shock selector */}
      <TerminalCard title="SELECT SHOCK" accent="blood" className="mb-6" glow>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {SHOCK_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelectedPreset(p); setShowCustom(false); sound.select(); }}
              className={`text-left p-3 border transition-colors ${
                !showCustom && selectedPreset.id === p.id
                  ? "border-blood bg-panel"
                  : "border-border-dim hover:border-blood"
              }`}
            >
              <div className="text-2xl mb-1">{p.icon}</div>
              <div className="text-xs font-bold text-content-primary">{p.label}</div>
              <div className="text-[10px] text-content-dim mt-0.5">{p.description}</div>
              <div className="text-[10px] text-blood-bright mt-1">
                Severity: {(p.initialSeverity * 100).toFixed(0)}% · {p.epicenterIso3}
              </div>
            </button>
          ))}
        </div>

        {/* Custom shock */}
        <button
          onClick={() => { setShowCustom(!showCustom); sound.nav(); }}
          className="text-[10px] text-content-secondary hover:text-blood-bright transition-colors uppercase tracking-widest"
        >
          {showCustom ? "▲ Hide custom shock" : "▼ Define custom shock"}
        </button>
        {showCustom && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border-dim pt-3">
            <div>
              <label className="text-[10px] text-content-dim uppercase tracking-widest">
                Epicenter Country (ISO3)
              </label>
              <input
                type="text"
                maxLength={3}
                value={customIso3}
                onChange={(e) => setCustomIso3(e.target.value)}
                placeholder="e.g. BRA, YEM, ETH"
                className="w-full bg-void border border-border-dim text-content-primary px-3 py-2 text-sm mt-1 focus:border-blood outline-none uppercase"
              />
            </div>
            <div>
              <label className="text-[10px] text-content-dim uppercase tracking-widest">
                Severity: {(customSeverity * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={customSeverity}
                onChange={(e) => setCustomSeverity(parseFloat(e.target.value))}
                className="w-full mt-3 accent-blood"
              />
            </div>
          </div>
        )}
      </TerminalCard>

      {/* Summary */}
      <TerminalCard title="CASCADE SUMMARY" accent="amber" className="mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">Countries</div>
            <div className="text-3xl text-blood-bright font-bold font-mono">
              {result.countriesAffected}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">Population in path</div>
            <div className="text-3xl text-warning-amber font-bold font-mono">
              {result.populationAffectedM.toFixed(0)}M
            </div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">Cascade steps</div>
            <div className="text-3xl text-terminal-green font-bold font-mono">
              {Object.keys(stepsByLevel).length}
            </div>
          </div>
        </div>
        <div className="mt-3 text-xs text-content-secondary border-t border-border-dim pt-3">
          {result.summary}
        </div>
      </TerminalCard>

      {/* Cascade visualization */}
      <TerminalCard title="DOMINO CHAIN" accent="blood" className="mb-6">
        <div className="space-y-6">
          {Object.entries(stepsByLevel).map(([level, steps]) => (
            <CascadeLevel
              key={level}
              level={parseInt(level)}
              steps={steps}
            />
          ))}
        </div>
      </TerminalCard>

      {/* Methodology */}
      <TerminalCard title="METHODOLOGY" className="mb-6">
        <div className="text-xs text-content-secondary space-y-2">
          <p>
            Each domino step applies two multipliers: <strong>proximity</strong> (same subregion = 70%
            spillover, same region = 40%, global = 15%) and <strong>vulnerability</strong> (based on
            pre-existing hunger, conflict, governance, and poverty levels).
          </p>
          <p>
            Dimension cascades use documented crisis pathways: hunger → displacement (0.6 weight),
            conflict → displacement (0.8), economy → poverty (0.7), etc. All weights are public
            in <code className="text-blood-bright">lib/domino.ts</code>.
          </p>
          <p className="text-content-dim">
            ⚠️ This is a heuristic model showing how interconnected crises are, not a prediction
            of specific outcomes. Real-world cascades depend on policy response, international aid,
            and countless context-specific factors.
          </p>
        </div>
      </TerminalCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

function CascadeLevel({ level, steps }: { level: number; steps: PropagationStep[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-content-dim">
          {level === 0 ? "⚡ EPICENTER" : `DOMINO WAVE ${level}`}
        </span>
        <div className="flex-1 h-px bg-border-dim" />
        <span className="text-[10px] text-content-dim">{steps.length} impacts</span>
      </div>
      <div className="space-y-2">
        {steps.map((s, i) => (
          <CascadeCard key={`${s.iso3}-${s.dimension}-${i}`} step={s} />
        ))}
      </div>
    </div>
  );
}

function CascadeCard({ step }: { step: PropagationStep }) {
  const [expanded, setExpanded] = useState(false);
  const color = severityColor(step.severity);

  return (
    <div
      className="border bg-void p-3 cursor-pointer transition-colors hover:border-blood"
      style={{ borderColor: color + "44", borderLeftWidth: 3, borderLeftColor: color }}
      onClick={() => { setExpanded(!expanded); sound.select(); }}
    >
      <div className="flex items-center gap-2">
        <Link
          href={`/sorrow-map/${step.iso3.toLowerCase()}/`}
          className="text-sm font-bold text-content-primary hover:text-blood-bright"
          onClick={(e) => e.stopPropagation()}
        >
          {step.name}
        </Link>
        <StatusPill color={step.severity >= 0.4 ? "blood" : "amber"}>
          {DIMENSION_LABELS[step.dimension]}
        </StatusPill>
        <div className="flex-1" />
        <span className="text-xs font-mono font-bold" style={{ color }}>
          {severityLabel(step.severity)}
        </span>
        <span className="text-[10px] font-mono text-content-dim">
          {(step.severity * 100).toFixed(0)}%
        </span>
      </div>
      {/* Severity bar */}
      <div className="mt-2 h-1 bg-border-dim">
        <div
          className="h-full transition-all"
          style={{ width: `${step.severity * 100}%`, backgroundColor: color }}
        />
      </div>
      {expanded && (
        <div className="mt-3 border-t border-border-dim pt-2">
          <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">
            PATHWAY
          </div>
          <div className="space-y-1">
            {step.pathway.map((p, i) => (
              <div key={i} className="text-[10px] text-content-secondary">
                {i === 0 ? "💥" : "🔻"} {p}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
