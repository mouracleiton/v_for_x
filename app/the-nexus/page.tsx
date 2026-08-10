"use client";

/**
 * V FOR X — The Nexus
 *
 * Kleptocracy & dirty-money beneficial-ownership graph.
 *
 * [62] THE NEXUS — Code: 62
 *
 * Visualizes the hidden financial architecture of kleptocracy:
 *   - PEP (politically-exposed-person) networks
 *   - Beneficial-ownership chains & nominee structures
 *   - Shell-company webs across secrecy jurisdictions
 *   - Money flows through enabler banks
 *
 * Data reconstructed from Pandora Papers, Panama Papers, FinCEN Files,
 * Suisse Secrets, OCCRP and ICIJ investigations.
 */

import { useMemo } from "react";
import nexusData from "@/data/nexus.json";
import TerminalCard from "@/components/ui/TerminalCard";
import NexusGraph from "@/components/viz/NexusGraph";

interface NexusActor {
  id: string;
  name: string;
  type: "pep" | "fixer" | "shell" | "trust" | "bank";
  country: string;
  role: string;
  status: string;
  leak: string;
}
interface NexusLink {
  source: string;
  target: string;
  type: "ownership" | "control" | "flow";
  value_musd: number;
  detail: string;
  year: number;
}
interface NexusData {
  meta: {
    title: string;
    description: string;
    sources: string[];
    note: string;
  };
  jurisdictions: {
    code: string;
    name: string;
    secrecy_score: number;
    shell_count: number;
    note: string;
  }[];
  actors: NexusActor[];
  links: NexusLink[];
}

const data = nexusData as unknown as NexusData;

const TYPE_LABEL: Record<NexusActor["type"], string> = {
  pep: "Politically Exposed Persons",
  fixer: "Enablers / Fixers",
  shell: "Shell Companies",
  trust: "Funds / Trusts",
  bank: "Banks",
};

const TYPE_COLOR: Record<NexusActor["type"], string> = {
  pep: "var(--color-blood-bright)",
  fixer: "var(--color-warning-amber)",
  shell: "var(--color-command)",
  trust: "#aa44ff",
  bank: "var(--color-terminal-green)",
};

export default function TheNexusPage() {
  /* ═══ Totals ═══ */
  const totals = useMemo(() => {
    let trackedFlow = 0;
    let ownershipLinks = 0;
    let controlLinks = 0;
    for (const l of data.links) {
      trackedFlow += l.value_musd;
      if (l.type === "ownership") ownershipLinks++;
      if (l.type === "control") controlLinks++;
    }
    const byType: Record<string, number> = {};
    for (const a of data.actors) byType[a.type] = (byType[a.type] ?? 0) + 1;
    return { trackedFlow, ownershipLinks, controlLinks, byType };
  }, []);

  /* ═══ Most-connected entities (PEP + fixer networks) ═══ */
  const topConnected = useMemo(() => {
    const deg = new Map<string, number>();
    const flow = new Map<string, number>();
    for (const l of data.links) {
      deg.set(l.source, (deg.get(l.source) ?? 0) + 1);
      deg.set(l.target, (deg.get(l.target) ?? 0) + 1);
      flow.set(l.source, (flow.get(l.source) ?? 0) + l.value_musd);
      flow.set(l.target, (flow.get(l.target) ?? 0) + l.value_musd);
    }
    return [...deg.entries()]
      .map(([id, d]) => {
        const a = data.actors.find((x) => x.id === id)!;
        return { ...a, degree: d, flow: flow.get(id) ?? 0 };
      })
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 10);
  }, []);

  /* ═══ Jurisdiction rankings by secrecy ═══ */
  const topJurisdictions = useMemo(
    () =>
      [...data.jurisdictions]
        .sort((a, b) => b.secrecy_score - a.secrecy_score)
        .slice(0, 8),
    []
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="text-content-dim text-xs">
          [62] KLEPTOCRACY & DIRTY-MONEY GRAPH
        </div>
        <h1 className="text-blood-bright text-2xl font-bold tracking-widest mt-1">
          <span className="glitch" data-text="THE NEXUS">
            THE NEXUS
          </span>
        </h1>
        <p className="text-content-secondary text-sm mt-2 max-w-2xl">
          {data.meta.description}
        </p>
        <p className="text-content-dim text-[10px] mt-1 italic">
          {data.meta.note}
        </p>
      </div>

      {/* Global totals bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border border-blood/40 p-3 text-center">
          <div className="text-blood-bright text-xl font-bold">
            ${(totals.trackedFlow / 1000).toFixed(1)}B
          </div>
          <div className="text-content-dim text-[9px] uppercase tracking-wider">
            Tracked Flows (USD)
          </div>
        </div>
        <div className="border border-blood-dim/60 p-3 text-center">
          <div className="text-blood text-xl font-bold">
            {totals.byType.pep ?? 0}
          </div>
          <div className="text-content-dim text-[9px] uppercase tracking-wider">
            Politically Exposed
          </div>
        </div>
        <div className="border border-command/40 p-3 text-center">
          <div className="text-command-bright text-xl font-bold">
            {totals.byType.shell ?? 0}
          </div>
          <div className="text-content-dim text-[9px] uppercase tracking-wider">
            Shell Companies
          </div>
        </div>
        <div className="border border-terminal-green/40 p-3 text-center">
          <div className="text-terminal-green text-xl font-bold">
            {data.jurisdictions.length}
          </div>
          <div className="text-content-dim text-[9px] uppercase tracking-wider">
            Secrecy Jurisdictions
          </div>
        </div>
      </div>

      {/* Force-directed graph */}
      <TerminalCard title="// BENEFICIAL-OWNERSHIP WEB" glow>
        <NexusGraph />
      </TerminalCard>

      {/* Network composition */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TerminalCard title="// NETWORK COMPOSITION" accent="amber">
          <div className="space-y-2">
            {(Object.keys(TYPE_LABEL) as NexusActor["type"][]).map((t) => {
              const count = totals.byType[t] ?? 0;
              const pct = Math.round((count / data.actors.length) * 100);
              return (
                <div key={t} className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 shrink-0"
                    style={{ background: TYPE_COLOR[t] }}
                  />
                  <span className="text-content-secondary text-[11px] w-40 shrink-0">
                    {TYPE_LABEL[t]}
                  </span>
                  <div className="flex-1 h-2 bg-border-dim/40">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.max(pct, 3)}%`,
                        background: TYPE_COLOR[t],
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="text-content-primary text-xs font-bold w-8 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
            <div className="flex items-center gap-2 pt-2 border-t border-border-dim mt-2">
              <span className="text-content-dim text-[11px] flex-1">
                Ownership links · Control / nominee links
              </span>
              <span className="text-blood-bright text-xs font-bold">
                {totals.ownershipLinks}
              </span>
              <span className="text-content-dim text-[10px]">·</span>
              <span className="text-amber text-xs font-bold">
                {totals.controlLinks}
              </span>
            </div>
          </div>
        </TerminalCard>

        {/* Top connected */}
        <TerminalCard title="// MOST-CONNECTED ENTITIES" accent="blood">
          <div className="space-y-1">
            {topConnected.map((a, i) => (
              <div
                key={a.id}
                className="flex items-center gap-2 py-0.5"
              >
                <span className="text-content-dim text-[10px] w-5">
                  {i + 1}.
                </span>
                <span
                  className="w-1.5 h-1.5 shrink-0"
                  style={{ background: TYPE_COLOR[a.type] }}
                />
                <span className="text-content-primary text-[11px] font-bold flex-1 truncate">
                  {a.name}
                </span>
                <span className="text-content-dim text-[9px] truncate max-w-[70px] hidden sm:block">
                  {a.country}
                </span>
                <span
                  className="text-[10px] font-bold w-12 text-right"
                  style={{ color: TYPE_COLOR[a.type] }}
                >
                  {a.degree} links
                </span>
              </div>
            ))}
          </div>
        </TerminalCard>
      </div>

      {/* Jurisdiction secrecy rankings */}
      <TerminalCard title="// SECRECY JURISDICTIONS" accent="green">
        <div className="space-y-2">
          <div className="flex text-[9px] uppercase tracking-wider text-content-dim pb-1 border-b border-border-dim">
            <span className="w-44">Jurisdiction</span>
            <span className="flex-1">Secrecy Score (0–100)</span>
            <span className="w-28 text-right">Shells (approx.)</span>
          </div>
          {topJurisdictions.map((j) => (
            <div
              key={j.code}
              className="flex items-center gap-2"
              title={j.note}
            >
              <span className="text-content-primary text-[11px] font-bold w-44 truncate">
                {j.name}
              </span>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 h-2 bg-border-dim/40">
                  <div
                    className="h-full"
                    style={{
                      width: `${j.secrecy_score}%`,
                      background:
                        j.secrecy_score >= 70
                          ? "var(--color-blood-bright)"
                          : j.secrecy_score >= 60
                            ? "var(--color-warning-amber)"
                            : "var(--color-command)",
                      opacity: 0.75,
                    }}
                  />
                </div>
                <span
                  className="text-[10px] font-bold w-7 text-right"
                  style={{
                    color:
                      j.secrecy_score >= 70
                        ? "var(--color-blood-bright)"
                        : j.secrecy_score >= 60
                          ? "var(--color-warning-amber)"
                          : "var(--color-command-bright)",
                  }}
                >
                  {j.secrecy_score}
                </span>
              </div>
              <span className="text-content-dim text-[10px] w-28 text-right">
                {(j.shell_count / 1000).toFixed(0)}k
              </span>
            </div>
          ))}
          <p className="text-[10px] text-content-dim pt-1">
            Secrecy scores approximate Tax Justice Network Financial Secrecy
            Index methodology. Shell counts are order-of-magnitude estimates of
            registered companies per haven.
          </p>
        </div>
      </TerminalCard>

      {/* Sources */}
      <TerminalCard title="// SOURCES">
        <ul className="space-y-1">
          {data.meta.sources.map((s, i) => (
            <li key={i} className="text-content-dim text-[10px]">
              [{i + 1}] {s}
            </li>
          ))}
        </ul>
      </TerminalCard>
    </div>
  );
}
