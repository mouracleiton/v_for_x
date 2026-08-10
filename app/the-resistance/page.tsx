"use client";

import { useState, useMemo } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import {
  computeRipeness,
  getRipeCountries,
  strengthLabel,
  strengthColor,
  HISTORICAL_MOVEMENTS,
  RESISTANCE_TACTICS,
  MOVEMENT_TYPE_LABELS,
  STATUS_LABELS,
  type HistoricalReference,
  type TacticInfo,
} from "@/lib/resistance";

const data = backbone as WorldBackbone;

export default function TheResistancePage() {
  const [tab, setTab] = useState<"ripeness" | "history" | "tactics">("ripeness");
  const ripeCountries = useMemo(() => getRipeCountries(data, 25), []);
  const sortedTactics = useMemo(() => [...RESISTANCE_TACTICS].sort((a, b) => b.effectiveness - a.effectiveness), []);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">✊ THE RESISTANCE</h1>
      <p className="text-content-secondary text-sm mb-6">
        // civil resistance analytics — where movements are needed, what works, and why nonviolence wins
      </p>

      <TerminalCard title="THE CHENOWETH FINDING" accent="green" glow>
        <p className="text-sm text-content-primary">
          Nonviolent movements succeed <span className="text-terminal-green font-bold">53%</span> of the time.
          Armed resistance succeeds only <span className="text-blood-bright font-bold">26%</span>.
          No movement that mobilized <span className="text-warning-amber font-bold">3.5%</span> of the population has ever failed.
        </p>
      </TerminalCard>

      <div className="flex gap-1 mb-4 mt-4 border-b border-border-dim">
        {([["ripeness", "RIPENESS MAP"], ["history", "HISTORY"], ["tactics", "TACTICS"]] as [typeof tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => { setTab(t); sound.nav(); }}
            className={`px-4 py-2 text-xs font-bold ${tab === t ? "text-blood-bright border-b-2 border-blood" : "text-content-dim hover:text-content-primary"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "ripeness" && (
        <TerminalCard title="RESISTANCE RIPENESS — TOP 25 COUNTRIES" accent="blood">
          <p className="text-sm text-content-secondary mb-4">
            Structural conditions that historically correlate with civil resistance. This is NOT a prediction — it identifies where the data shows extreme grievances.
          </p>
          <div className="space-y-2">
            {ripeCountries.map((c, i) => (
              <div key={c.iso3} className="flex items-center gap-3 p-2 border border-border-dim bg-abyss">
                <span className="text-xs text-content-dim w-6">#{i + 1}</span>
                <a href={`/sorrow-map/${c.iso3.toLowerCase()}/`} className="text-sm text-content-primary hover:text-blood-bright flex-1">{c.name}</a>
                <span className="text-xs text-warning-amber hidden sm:inline">{c.topDriver}</span>
                <div className="w-20 h-2 bg-abyss border border-border-dim">
                  <div className="h-full transition-all" style={{ width: `${c.ripeScore}%`, backgroundColor: strengthColor(c.ripeScore) }} />
                </div>
                <span className="text-sm font-bold w-12 text-right" style={{ color: strengthColor(c.ripeScore) }}>{c.ripeScore}</span>
              </div>
            ))}
          </div>
        </TerminalCard>
      )}

      {tab === "history" && (
        <div className="space-y-3">
          <TerminalCard title="HISTORICAL NONVIOLENT MOVEMENTS" accent="amber">
            <p className="text-sm text-content-secondary mb-3">From the NAVCO dataset — what worked, what failed, and why.</p>
          </TerminalCard>
          {HISTORICAL_MOVEMENTS.map((m: HistoricalReference, i) => (
            <TerminalCard key={i} accent={m.outcome === "success" ? "green" : m.outcome === "failure" ? "blood" : "amber"}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-content-primary">{m.movement}</h3>
                  <div className="text-xs text-content-dim">{m.country} · {m.year} · {MOVEMENT_TYPE_LABELS[m.type]}</div>
                  <p className="text-xs text-content-secondary mt-2 italic">&ldquo;{m.lesson}&rdquo;</p>
                </div>
                <div className="text-right ml-3">
                  <span className={`text-xs font-bold ${m.outcome === "success" ? "text-terminal-green" : m.outcome === "failure" ? "text-blood-bright" : "text-warning-amber"}`}>
                    {m.outcome === "success" ? "✓ SUCCESS" : m.outcome === "failure" ? "✗ FAILED" : "◐ PARTIAL"}
                  </span>
                  {m.participants > 0 && <div className="text-xs text-content-dim mt-1">{(m.participants / 1_000_000).toFixed(1)}M participants</div>}
                </div>
              </div>
            </TerminalCard>
          ))}
        </div>
      )}

      {tab === "tactics" && (
        <div className="space-y-3">
          <TerminalCard title="GENE SHARP&apos;S METHODS — RANKED BY EFFECTIVENESS" accent="amber">
            <p className="text-sm text-content-secondary mb-3">198 methods of nonviolent action. These are the most effective tactics, ranked.</p>
          </TerminalCard>
          <div className="space-y-2">
            {sortedTactics.map((t: TacticInfo, i) => (
              <div key={i} className="flex items-center gap-3 p-3 border border-border-dim bg-abyss">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-content-primary">{t.name}</span>
                    <span className="text-xs text-content-dim">({t.category})</span>
                  </div>
                  <p className="text-xs text-content-secondary mt-1">{t.description}</p>
                  <span className={`text-xs ${t.riskLevel === "high" ? "text-blood-bright" : t.riskLevel === "medium" ? "text-warning-amber" : "text-terminal-green"}`}>
                    Risk: {t.riskLevel}
                  </span>
                </div>
                <div className="text-center w-16">
                  <div className="text-xl font-bold" style={{ color: strengthColor(t.effectiveness) }}>{t.effectiveness}</div>
                  <div className="text-xs text-content-dim">/100</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
