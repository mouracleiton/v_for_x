"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, Tactic } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

const data = backbone as WorldBackbone;

/* ═══ NORMALIZATION ═══
 * Convert qualitative casualty/success fields to numeric scores 0-10.
 */

interface NormalizedTactic extends Tactic {
  casualtyScore: number; // 0 = none, 10 = catastrophic
  successScore: number; // 0 = low, 10 = guaranteed
  speedScore: number; // 0 = years, 10 = immediate
  category: "humanitarian" | "political" | "military";
  summary: string;
}

const CASUALTY_MAP: Record<string, number> = {
  "0": 0,
  "~0": 0.5,
  "baixas": 2,
  "baixa": 2,
  "moderadas": 5,
  "moderada": 5,
  "altas": 8,
  "altas-cat": 9,
  "catastrof": 10,
  "catastrofica": 10,
};

const SUCCESS_MAP: Record<string, number> = {
  "high": 8,
  "53%": 5.3,
  "medium": 5,
  "variable": 4,
  "slow": 3,
  "26%": 2.6,
};

const SPEED_MAP: Record<string, number> = {
  "immediate": 10,
  "days": 8,
  "days-weeks": 7,
  "weeks": 6,
  "months": 4,
  "months-years": 2.5,
  "years": 1,
};

const CATEGORY_MAP: Record<number, NormalizedTactic["category"]> = {
  1: "humanitarian", 2: "humanitarian", 3: "humanitarian",
  4: "humanitarian", 5: "humanitarian",
  6: "political", 7: "political", 8: "political", 9: "political",
  10: "political", 11: "political", 12: "political", 13: "political",
  14: "military", 15: "military", 16: "military", 17: "military",
};

const TACTIC_SUMMARIES: Record<number, string> = {
  1: "Negotiated safe passage for aid convoys through active conflict zones. Requires ceasefire agreement or UN mandate.",
  2: "Air delivery of food, medicine, and supplies to besieged or inaccessible areas. High cost, rapid response.",
  3: "Smuggling aid across borders to populations cut off by siege or blockade. Used in Syria, Yemen, Gaza.",
  4: "Diaspora communities send money home via crypto, Hawala, or informal networks. Bypasses banking blockades.",
  5: "Community gardens, rooftop farms, urban micro-livestock. Builds resilience from within, not dependent on external aid.",
  6: "Freezing assets and travel bans on war profiteers and regime elites. Can be done unilaterally or via UN.",
  7: "Coordinated diplomatic isolation, expulsion from international bodies, public naming and shaming.",
  8: "Mass protests, boycotts, strikes, and civil disobedience. Research shows 53% success rate — double that of armed insurgency.",
  9: "Halting the economy until demands are met. The most disruptive nonviolent tactic. Requires mass participation (>3.5% of population).",
  10: "Collective refusal to eat, drawing attention to a cause. Effective as a pressure tactic, risks to participants' health.",
  11: "Systematic documentation of violations → ICC/ICJ prosecution. Slow but creates permanent legal record and accountability.",
  12: "Soldiers and police refuse orders to fire on civilians. History's most common pathway to regime collapse.",
  13: "Direct negotiation for cessation of hostilities. Often the first step toward humanitarian access.",
  14: "Military intervention under UN Responsibility to Protect doctrine. Controversial; can save lives or escalate.",
  15: "Armed rebellion against the state. Only 26% success rate historically. High civilian cost. Often leads to new authoritarianism.",
  16: "Airstrikes on military targets. Can degrade capacity but causes civilian casualties and infrastructure destruction.",
  17: "Full-scale ground invasion. Highest human cost. Rarely achieves lasting political objectives.",
};

const TIER_COLOR: Record<string, string> = {
  S: "#00ff41",
  A: "#ffaa00",
  B: "#cc0000",
};

const CATEGORY_LABEL: Record<string, string> = {
  humanitarian: "HUMANITARIAN",
  political: "POLITICAL",
  military: "MILITARY",
};

function normalizeTactics(): NormalizedTactic[] {
  return data.tactics_conflict_zones.map((t) => {
    const casualtyKey = (t.casualties || "").toLowerCase().trim();
    const successKey = (t.success || "").toLowerCase().trim();
    const speedKey = (t.speed || "").toLowerCase().trim();
    return {
      ...t,
      casualtyScore: CASUALTY_MAP[casualtyKey] ?? 3,
      successScore: SUCCESS_MAP[successKey] ?? 4,
      speedScore: SPEED_MAP[speedKey] ?? 4,
      category: CATEGORY_MAP[t.id] ?? "political",
      summary: TACTIC_SUMMARIES[t.id] ?? "",
    };
  });
}

type FilterCategory = "all" | "humanitarian" | "political" | "military";
type SortKey = "success" | "casualties" | "speed" | "tier";

export default function TheTacticsPage() {
  const tactics = useMemo(() => normalizeTactics(), []);
  const [filter, setFilter] = useState<FilterCategory>("all");
  const [sortKey, setSortKey] = useState<SortKey>("success");
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    let result = filter === "all" ? [...tactics] : tactics.filter((t) => t.category === filter);
    result.sort((a, b) => {
      switch (sortKey) {
        case "success":
          return b.successScore - a.successScore;
        case "casualties":
          return a.casualtyScore - b.casualtyScore;
        case "speed":
          return b.speedScore - a.speedScore;
        case "tier":
          return (a.tier === b.tier ? a.id - b.id : a.tier < b.tier ? -1 : 1);
      }
    });
    return result;
  }, [tactics, filter, sortKey]);

  // Scatter data: x = casualty risk, y = success rate, z = speed
  const scatterData = useMemo(() => {
    const result: Record<string, Array<NormalizedTactic & { z: number }>> = {
      S: [],
      A: [],
      B: [],
    };
    for (const t of tactics) {
      result[t.tier].push({ ...t, z: t.speedScore * 3 });
    }
    return result;
  }, [tactics]);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[17] THE TACTICS</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood tracking-widest">
          THE TACTICS
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // 17 ways to respond to crisis, ranked by what actually works. Nonviolent resistance
          succeeds 53% of the time. Armed insurgency: 26%. The data is clear.
        </p>
      </div>

      {/* The proof — Chenoweth stat */}
      <TerminalCard title="THE EVIDENCE // CHENOWETH FINDING" accent="green" glow className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-xs text-content-dim mb-1">NONVIOLENT RESISTANCE</div>
            <div className="text-5xl text-terminal-green glow-green font-bold">53%</div>
            <div className="text-xs text-content-secondary mt-1">
              Success rate across 323 campaigns (1900-2006). Erica Chenoweth / Maria Stephan, "Why Civil Resistance Works."
            </div>
          </div>
          <div>
            <div className="text-xs text-content-dim mb-1">ARMED INSURGENCY</div>
            <div className="text-5xl text-blood font-bold glow-blood">26%</div>
            <div className="text-xs text-content-secondary mt-1">
              Half the success rate. 4x the civilian casualties. And the resulting regimes are
              more likely to be authoritarian.
            </div>
          </div>
        </div>
      </TerminalCard>

      {/* Scatter plot: Casualties vs Success */}
      <TerminalCard title="CASUALTIES vs SUCCESS // THE MORAL CALCULUS" accent="amber" className="mb-6">
        <p className="text-xs text-content-dim mb-3">
          // Each dot is a tactic. X-axis: human cost (left = zero casualties, right = catastrophic).
          Y-axis: success probability. The ideal quadrant is bottom-left (high success, zero cost).
        </p>
        <div style={{ width: "100%", height: 400 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis
                type="number"
                dataKey="casualtyScore"
                domain={[0, 10]}
                name="Human Cost"
                tick={{ fill: "#888", fontSize: 10 }}
                label={{ value: "HUMAN COST →", position: "bottom", fill: "#666", fontSize: 10, offset: 10 }}
                ticks={[0, 2, 5, 8, 10]}
                tickFormatter={(v) => ["None", "", "Moderate", "", "Catastrophic"][v] || ""}
              />
              <YAxis
                type="number"
                dataKey="successScore"
                domain={[0, 10]}
                name="Success"
                tick={{ fill: "#888", fontSize: 10 }}
                label={{ value: "↑ SUCCESS RATE", angle: -90, position: "insideLeft", fill: "#666", fontSize: 10 }}
              />
              <ZAxis type="number" dataKey="z" range={[40, 400]} name="Speed" />
              <ReferenceLine x={2.5} stroke="#444" strokeDasharray="2 2" />
              <ReferenceLine y={5} stroke="#444" strokeDasharray="2 2" />
              <Tooltip
                cursor={{ strokeDasharray: "3 3", stroke: "#444" }}
                contentStyle={{ background: "#0a0a0a", border: "1px solid #444", fontSize: "11px" }}
                formatter={(value, name) => {
                  if (name === "Human Cost") {
                    const v = Number(value);
                    return [v <= 1 ? "None/Low" : v <= 3 ? "Low" : v <= 5 ? "Moderate" : v <= 8 ? "High" : "Catastrophic", name];
                  }
                  return [String(value), name];
                }}
              />
              <Scatter name="Tier S" data={scatterData.S} fill="#00ff41">
                {scatterData.S.map((t) => (
                  <Cell
                    key={t.id}
                    fill={hoveredId === t.id ? "#00ff41" : "#00aa33"}
                    stroke={hoveredId === t.id ? "#fff" : "#00ff41"}
                    strokeWidth={hoveredId === t.id ? 2 : 0.5}
                  />
                ))}
              </Scatter>
              <Scatter name="Tier A" data={scatterData.A} fill="#ffaa00">
                {scatterData.A.map((t) => (
                  <Cell
                    key={t.id}
                    fill={hoveredId === t.id ? "#ffaa00" : "#aa7700"}
                    stroke={hoveredId === t.id ? "#fff" : "#ffaa00"}
                    strokeWidth={hoveredId === t.id ? 2 : 0.5}
                  />
                ))}
              </Scatter>
              <Scatter name="Tier B" data={scatterData.B} fill="#cc0000">
                {scatterData.B.map((t) => (
                  <Cell
                    key={t.id}
                    fill={hoveredId === t.id ? "#ff0000" : "#990000"}
                    stroke={hoveredId === t.id ? "#fff" : "#cc0000"}
                    strokeWidth={hoveredId === t.id ? 2 : 0.5}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-6 mt-3 text-[10px] text-content-secondary flex-wrap">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#00aa33", border: "1px solid #00ff41" }} />
            TIER S (recommended)
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#aa7700", border: "1px solid #ffaa00" }} />
            TIER A (effective)
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#990000", border: "1px solid #cc0000" }} />
            TIER B (high cost / variable)
          </div>
          <span className="text-content-dim">Bubble size = speed of impact</span>
        </div>
      </TerminalCard>

      {/* Filter controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-content-dim uppercase tracking-widest">FILTER:</span>
          {([
            { id: "all", label: "ALL" },
            { id: "humanitarian", label: "HUMANITARIAN" },
            { id: "political", label: "POLITICAL" },
            { id: "military", label: "MILITARY" },
          ] as const).map((f) => (
            <button
              key={f.id}
              onClick={() => { setFilter(f.id); sound.select(); }}
              className={`text-[10px] px-2 py-1 border transition-colors ${
                filter === f.id
                  ? "border-blood text-blood-bright bg-blood/5"
                  : "border-border-dim text-content-secondary hover:border-blood"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-content-dim uppercase tracking-widest">SORT:</span>
          {([
            { id: "success", label: "SUCCESS" },
            { id: "casualties", label: "LOWEST COST" },
            { id: "speed", label: "FASTEST" },
            { id: "tier", label: "TIER" },
          ] as const).map((s) => (
            <button
              key={s.id}
              onClick={() => { setSortKey(s.id); sound.select(); }}
              className={`text-[10px] px-2 py-1 border transition-colors ${
                sortKey === s.id
                  ? "border-terminal-green text-terminal-green bg-terminal-green/5"
                  : "border-border-dim text-content-secondary hover:border-terminal-green"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tactic cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {filtered.map((t) => (
          <div
            key={t.id}
            className={`terminal-card p-4 transition-all ${hoveredId === t.id ? "border-blood" : ""}`}
            onMouseEnter={() => setHoveredId(t.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-mono font-bold px-2 py-1 border"
                  style={{ borderColor: TIER_COLOR[t.tier], color: TIER_COLOR[t.tier] }}
                >
                  TIER {t.tier}
                </span>
                <span className="text-[9px] text-content-dim uppercase tracking-widest">
                  {CATEGORY_LABEL[t.category]}
                </span>
              </div>
              <span className="text-[10px] text-content-dim">#{t.id}</span>
            </div>

            <h3 className="text-sm font-bold text-content-primary mb-2">{t.name}</h3>
            <p className="text-xs text-content-secondary mb-3">{t.summary}</p>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-[9px] text-content-dim uppercase">SUCCESS</div>
                <div className="text-sm font-bold text-terminal-green">{t.success}</div>
              </div>
              <div className="text-center">
                <div className="text-[9px] text-content-dim uppercase">CASUALTIES</div>
                <div
                  className="text-sm font-bold"
                  style={{ color: t.casualtyScore <= 1 ? "#00ff41" : t.casualtyScore <= 3 ? "#ffaa00" : "#cc0000" }}
                >
                  {t.casualties}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[9px] text-content-dim uppercase">SPEED</div>
                <div className="text-sm font-bold text-content-secondary">{t.speed}</div>
              </div>
            </div>

            {/* Effectiveness bar */}
            <div className="mt-3">
              <div className="h-1.5 bg-void relative overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${(t.successScore / 10) * 100}%`,
                    backgroundColor: TIER_COLOR[t.tier],
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Key insight */}
      <TerminalCard title="THE UNCOMFORTABLE TRUTH" accent="blood" className="mb-6">
        <div className="space-y-3 text-xs text-content-secondary">
          <p>
            The most effective tactics in conflict zones are <span className="text-terminal-green font-bold">not</span> the ones
            governments and media focus on. The data consistently shows:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 border border-terminal-green/30 bg-terminal-green/5">
              <div className="text-terminal-green font-bold mb-1">WORKS (Tier S-A)</div>
              <p>Humanitarian corridors, nonviolent resistance, sanctions, documentation, induced defection, negotiation. Low casualties, proven success.</p>
            </div>
            <div className="p-3 border border-blood/30 bg-blood/5">
              <div className="text-blood-bright font-bold mb-1">DOESN&apos;T (Tier B)</div>
              <p>Bombing, invasion, armed insurgency. High civilian death, low success rate, creates the next crisis. Every war proves this.</p>
            </div>
          </div>
          <p className="text-content-dim mt-3">
            Source: Erica Chenoweth &amp; Maria Stephan, &quot;Why Civil Resistance Works&quot; (Columbia University Press, 2011).
            Analysis of 323 violent and nonviolent resistance campaigns, 1900-2006.
          </p>
        </div>
      </TerminalCard>

      {/* Cross-links */}
      <div className="flex flex-wrap gap-2">
        <Link href="/protocol-x/" className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright">
          ▶ SURVIVAL BLUEPRINTS
        </Link>
        <Link href="/registry/" className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright">
          ▶ ACCOUNTABILITY DOSSIERS
        </Link>
        <Link href="/equation/" className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright">
          ▶ THE EQUATION
        </Link>
      </div>
    </div>
  );
}
