"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/stores/useStore";
import { tc } from "@/lib/i18n-content";
import type { Lang } from "@/lib/i18n";
import { td } from "@/lib/dossiers-i18n";
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
  evidence: { type: string; description: string; quality_score: number; source_url?: string }[];
  evidence_quality_score: number;
  peer_validations: number;
  required_validations: number;
  right_of_response: string;
  created_at: string;
  updated_at: string;
  version: number;
  country_data_ref: string;
  source_provenance?: {
    authority: string;
    authority_type: string;
    source_dataset?: string;
    source_url?: string;
    case_number?: string;
    opensanctions_id?: string;
    auto_populated?: boolean;
    fetched_at?: string;
  };
}

const dossiers = dossiersData as Dossier[];

const authorityBadge = (type: string | undefined, lang: Lang): { label: string; color: "blood" | "amber" | "green" | "dim" } => {
  switch (type) {
    case "icc_arrest_warrant": return { label: tc(lang, "authbadge.icc"), color: "blood" };
    case "icj_proceedings": return { label: tc(lang, "authbadge.icj"), color: "amber" };
    case "un_investigation":
    case "un_sanctions": return { label: tc(lang, "authbadge.un"), color: "blood" };
    case "sanctions": return { label: tc(lang, "authbadge.sanctions"), color: "amber" };
    case "community_submitted": return { label: tc(lang, "authbadge.community"), color: "dim" };
    default: return { label: tc(lang, "authbadge.community"), color: "dim" };
  }
};

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
  war_crime: "dcat.war_crime",
  human_rights_violation: "dcat.human_rights_violation",
  corruption: "dcat.corruption",
  economic_exploitation: "dcat.economic_exploitation",
  environmental_destruction: "dcat.environmental_destruction",
};

export default function RegistroPage() {
  const { lang } = useStore();
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
        <div className="text-xs text-content-dim mb-1">{tc(lang, "registry.tag")}</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          {tc(lang, "registry.title")}
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // {tc(lang, "registry.subtitle_extra")} {dossiers.length} {tc(lang, "registry.dossiers")} — {dossiers.filter(d => d.source_provenance?.authority_type?.includes("icc") || d.source_provenance?.authority_type?.includes("icj") || d.source_provenance?.authority_type?.includes("un")).length} {tc(lang, "registry.from_courts")}, {dossiers.filter(d => !d.source_provenance).length} {tc(lang, "registry.community_validated")}. {tc(lang, "registry.legal_finding")}
        </p>
      </div>

      {/* Provenance breakdown */}
      <TerminalCard title={tc(lang, "registry.evidence_pipeline")} accent="green" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="flex items-start gap-2">
            <span className="text-blood-bright">■</span>
            <div>
              <div className="font-bold text-blood-bright">{tc(lang, "registry.icc_warrants")}</div>
              <div className="text-content-dim">{tc(lang, "registry.icc_desc")}</div>
              <div className="text-content-dim mt-1">→ {dossiers.filter(d => d.source_provenance?.authority_type === "icc_arrest_warrant").length} {tc(lang, "registry.dossiers")}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-warning-amber">■</span>
            <div>
              <div className="font-bold text-warning-amber">{tc(lang, "registry.icj_proceedings")}</div>
              <div className="text-content-dim">{tc(lang, "registry.icj_desc")}</div>
              <div className="text-content-dim mt-1">→ {dossiers.filter(d => d.source_provenance?.authority_type === "icj_proceedings").length} {tc(lang, "registry.dossiers")}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blood">■</span>
            <div>
              <div className="font-bold text-blood">{tc(lang, "registry.un_findings")}</div>
              <div className="text-content-dim">{tc(lang, "registry.un_desc")}</div>
              <div className="text-content-dim mt-1">→ {dossiers.filter(d => d.source_provenance?.authority_type === "un_investigation" || d.source_provenance?.authority_type === "un_sanctions").length} {tc(lang, "registry.dossiers")}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-content-dim">■</span>
            <div>
              <div className="font-bold text-content-secondary">{tc(lang, "registry.community_dossiers")}</div>
              <div className="text-content-dim">{tc(lang, "registry.community_desc")}</div>
              <div className="text-content-dim mt-1">→ {dossiers.filter(d => !d.source_provenance).length} {tc(lang, "registry.dossiers")}</div>
            </div>
          </div>
        </div>
        <div className="border-t border-border-dim mt-4 pt-3">
          <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">
            {tc(lang, "registry.auto_pipeline")}
          </div>
          <p className="text-xs text-content-secondary">
            {tc(lang, "registry.run")} <code className="text-blood-bright bg-void px-1 py-0.5 border border-border-dim">python3 scripts/fetch_sanctions_dossiers.py</code> {tc(lang, "registry.pull_desc")}
          </p>
        </div>
      </TerminalCard>

      {/* Anti-witch-hunt safeguards */}
      <TerminalCard title={tc(lang, "registry.safeguards")} accent="green" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="flex items-start gap-2">
            <span className="text-terminal-green">✓</span>
            <span>{tc(lang, "registry.sg_5_validations")}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-terminal-green">✓</span>
            <span>{tc(lang, "registry.sg_evidence_scoring")}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-terminal-green">✓</span>
            <span>{tc(lang, "registry.sg_right_response")}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-terminal-green">✓</span>
            <span>{tc(lang, "registry.sg_cooldown")}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-terminal-green">✓</span>
            <span>{tc(lang, "registry.sg_supermajority")}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-terminal-green">✓</span>
            <span>{tc(lang, "registry.sg_reputation")}</span>
          </div>
        </div>
      </TerminalCard>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <div className="text-xs text-content-dim mb-1">{tc(lang, "registry.status_label")}:</div>
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
                {s === "ALL" ? tc(lang, "search.all") : tc(lang, `dstat.${s.toLowerCase()}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-content-dim mb-1">{tc(lang, "registry.severity_label")}:</div>
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
                {s === "ALL" ? tc(lang, "search.all") : tc(lang, `dsev.${s}`)}
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
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs text-content-dim">{d.id}</span>
                  <StatusPill color={statusColor(d.status)}>
                    {tc(lang, `dstat.${d.status.toLowerCase()}`)}
                  </StatusPill>
                  <StatusPill color={severityColor(d.severity)}>
                    {tc(lang, `dsev.${d.severity}`)}
                  </StatusPill>
                  {d.source_provenance && (() => {
                    const badge = authorityBadge(d.source_provenance.authority_type, lang);
                    return <StatusPill color={badge.color}>{badge.label}</StatusPill>;
                  })()}
                </div>
                <h3 className="text-sm font-bold text-content-primary">{td(d.id, lang).subject}</h3>
                <p className="text-xs text-content-secondary mt-1 line-clamp-2">{td(d.id, lang).accusation}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-content-dim mt-2">
              <span>▸ {tc(lang, categoryLabels[d.category] || d.category)}</span>
              <span>▸ {tc(lang, "registry.evidence")}: {d.evidence_quality_score}{tc(lang, "registry.pts")}</span>
              <span>▸ {tc(lang, "registry.validations")}: {d.peer_validations}/{d.required_validations}</span>
              {d.source_provenance?.case_number && (
                <span>▸ {d.source_provenance.case_number}</span>
              )}
              <span>▸ v{d.version}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
