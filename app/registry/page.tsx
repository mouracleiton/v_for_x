"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import dossiersData from "@/data/dossier-seed.json";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";

interface Dossier {
  id: string;
  subject: string;
  country_iso3: string;
  category: string;
  severity: string;
  status: string;
  accusation: string;
  evidence: { type: string; description: string; quality_score: number }[];
  evidence_quality_score: number;
  peer_validations: number;
  required_validations: number;
  right_of_response: string;
  created_at: string;
  updated_at: string;
  version: number;
  country_data_ref: string;
}

const dossiers = dossiersData as Dossier[];

const statusColor = (status: string): "blood" | "amber" | "green" | "dim" => {
  switch (status) {
    case "CONFIRMED": return "green";
    case "PEER_VALIDATED": return "green";
    case "UNDER_REVIEW": return "amber";
    case "ACCUSATION": return "dim";
    default: return "dim";
  }
};

const severityColor = (sev: string): "blood" | "amber" | "dim" => {
  switch (sev) {
    case "critical": return "blood";
    case "high": return "amber";
    case "moderate": return "dim";
    default: return "dim";
  }
};

const categoryLabels: Record<string, string> = {
  war_crime: "WAR CRIME",
  human_rights_violation: "HUMAN RIGHTS VIOLATION",
  corruption: "CORRUPTION",
  economic_exploitation: "ECONOMIC EXPLOITATION",
  environmental_destruction: "ENVIRONMENTAL DESTRUCTION",
};

export default function RegistroPage() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");

  const filtered = useMemo(() => {
    return dossiers.filter((d) => {
      if (statusFilter !== "ALL" && d.status !== statusFilter) return false;
      if (severityFilter !== "ALL" && d.severity !== severityFilter) return false;
      return true;
    });
  }, [statusFilter, severityFilter]);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[04] THE REGISTRY</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          THE REGISTRY
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // Accountability infrastructure. Dossiers with peer-validated evidence. No witch hunts.
        </p>
      </div>

      {/* Anti-witch-hunt safeguards */}
      <TerminalCard title="SAFEGUARDS — HOW THIS WORKS" accent="green" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="flex items-start gap-2">
            <span className="text-terminal-green">✓</span>
            <span>Minimum 5 peer validations required for public visibility</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-terminal-green">✓</span>
            <span>Evidence quality scoring (primary=3pts, secondary=1pt, testimony=0.5pt)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-terminal-green">✓</span>
            <span>Mandatory right-of-response field for accused parties</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-terminal-green">✓</span>
            <span>72-hour cooldown between creation and public visibility</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-terminal-green">✓</span>
            <span>67% supermajority required for CONFIRMED status</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-terminal-green">✓</span>
            <span>Reputation-weighted validation — trust is earned through contributions</span>
          </div>
        </div>
      </TerminalCard>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <div className="text-xs text-content-dim mb-1">STATUS:</div>
          <div className="flex gap-1">
            {["ALL", "ACCUSATION", "UNDER_REVIEW", "PEER_VALIDATED", "CONFIRMED"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2 py-1 text-xs border transition-colors ${
                  statusFilter === s
                    ? "border-blood text-blood-bright"
                    : "border-border-dim text-content-dim hover:text-content-secondary"
                }`}
              >
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-content-dim mb-1">SEVERITY:</div>
          <div className="flex gap-1">
            {["ALL", "critical", "high", "moderate"].map((s) => (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                className={`px-2 py-1 text-xs border transition-colors uppercase ${
                  severityFilter === s
                    ? "border-blood text-blood-bright"
                    : "border-border-dim text-content-dim hover:text-content-secondary"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dossier list */}
      <div className="space-y-3 mb-8">
        {filtered.map((d) => (
          <Link
            key={d.id}
            href={`/registry/${d.id}/`}
            className="terminal-card p-4 hover:border-blood transition-colors block"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-content-dim">{d.id}</span>
                  <StatusPill color={statusColor(d.status)}>
                    {d.status.replace(/_/g, " ")}
                  </StatusPill>
                  <StatusPill color={severityColor(d.severity)}>
                    {d.severity.toUpperCase()}
                  </StatusPill>
                </div>
                <h3 className="text-sm font-bold text-content-primary">{d.subject}</h3>
                <p className="text-xs text-content-secondary mt-1 line-clamp-2">{d.accusation}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-content-dim mt-2">
              <span>▸ {categoryLabels[d.category] || d.category}</span>
              <span>▸ Evidence: {d.evidence_quality_score}pts</span>
              <span>▸ Validations: {d.peer_validations}/{d.required_validations}</span>
              <span>▸ v{d.version}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
