"use client";

import { use } from "react";
import Link from "next/link";
import dossiersData from "@/data/dossier-seed.json";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import DataBar from "@/components/ui/DataBar";
import { sound } from "@/lib/sound";

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

const authorityLabel = (type?: string): string => {
  switch (type) {
    case "icc_arrest_warrant": return "ICC ARREST WARRANT";
    case "icj_proceedings": return "ICJ PROCEEDINGS";
    case "un_investigation": return "UN SECURITY COUNCIL FINDING";
    case "un_sanctions": return "UN SANCTIONS DESIGNATION";
    case "sanctions": return "SANCTIONS DESIGNATION";
    case "community_submitted": return "COMMUNITY SUBMISSION";
    default: return "COMMUNITY SUBMISSION";
  }
};

const statusColor = (status: string): "blood" | "amber" | "green" | "dim" => {
  switch (status) {
    case "CONFIRMED":
    case "PEER_VALIDATED":
      return "green";
    case "UNDER_REVIEW":
      return "amber";
    default:
      return "dim";
  }
};

export default function DossierContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const d = dossiers.find((x) => x.id === id);

  if (!d) {
    return (
      <div className="p-3 sm:p-3 sm:p-6 md:p-10 max-w-3xl mx-auto text-center">
        <h1 className="text-2xl text-blood mb-4">DOSSIER NOT FOUND</h1>
        <Link href="/registry/" className="text-blood-bright hover:underline">
          ← Back to Registry
        </Link>
      </div>
    );
  }

  const validationPct = (d.peer_validations / (d.required_validations * 3)) * 100;

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/registry/" className="text-xs text-content-dim hover:text-blood">
          ← BACK TO REGISTRY
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-content-dim">{d.id}</span>
          <StatusPill color={statusColor(d.status)}>
            {d.status.replace(/_/g, " ")}
          </StatusPill>
          <StatusPill color={d.severity === "critical" ? "blood" : d.severity === "high" ? "amber" : "dim"}>
            {d.severity.toUpperCase()}
          </StatusPill>
        </div>
        <h1 className="text-xl md:text-2xl text-blood-bright font-bold glow-blood">
          {d.subject}
        </h1>
        {d.source_provenance && (
          <div className="text-xs text-content-dim mt-2">
            <span className="text-content-secondary">Source: </span>
            <span className="text-blood-bright">{authorityLabel(d.source_provenance.authority_type)}</span>
            {d.source_provenance.case_number && (
              <span> · Case: {d.source_provenance.case_number}</span>
            )}
            {d.source_provenance.authority && (
              <span> · {d.source_provenance.authority}</span>
            )}
          </div>
        )}
      </div>

      {/* Accusation */}
      <TerminalCard title="ACCUSATION" className="mb-6">
        <p className="text-sm text-content-primary">{d.accusation}</p>
        <div className="text-xs text-content-dim mt-3">
          Category: {d.category.replace(/_/g, " ").toUpperCase()} · Country:{" "}
          <Link
            href={`/sorrow-map/${d.country_iso3.toLowerCase()}/`}
            className="text-blood-bright hover:underline"
          >
            {d.country_iso3}
          </Link>
        </div>
      </TerminalCard>

      {/* Evidence chain */}
      <TerminalCard title="EVIDENCE CHAIN" className="mb-6">
        <div className="mb-3">
          <DataBar
            value={d.evidence_quality_score}
            max={12}
            label="Evidence quality score"
            unit="/12"
          />
        </div>
        <div className="space-y-2">
          {d.evidence.map((e, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-2 terminal-card"
            >
              <StatusPill
                color={
                  e.type === "primary"
                    ? "green"
                    : e.type === "secondary"
                      ? "amber"
                      : "dim"
                }
              >
                {e.type.toUpperCase()}
              </StatusPill>
              <div className="flex-1">
                <p className="text-xs text-content-primary">{e.description}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-content-dim">+{e.quality_score}pts</span>
                  {e.source_url && (
                    <a
                      href={e.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blood-bright hover:underline"
                    >
                      ↗ source
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </TerminalCard>

      {/* Tribunal status */}
      <TerminalCard title="TRIBUNAL DOS PARES — PEER VALIDATION" accent="green" className="mb-6">
        <DataBar
          value={d.peer_validations}
          max={d.required_validations * 3}
          label={`Validations: ${d.peer_validations} / required ${d.required_validations}`}
          unit=""
        />
        <div className="text-xs text-content-dim mt-2">
          Progress toward CONFIRMED status ({validationPct.toFixed(0)}% of threshold)
        </div>
      </TerminalCard>

      {/* Right of response */}
      <TerminalCard title="RIGHT OF RESPONSE" accent="amber" className="mb-6">
        <p className="text-xs text-content-secondary">{d.right_of_response}</p>
      </TerminalCard>

      {/* Country data reference */}
      <TerminalCard title="COUNTRY DATA REFERENCE" className="mb-6">
        <p className="text-xs text-content-primary">{d.country_data_ref}</p>
        <Link
          href={`/sorrow-map/${d.country_iso3.toLowerCase()}/`}
          className="text-xs text-blood-bright hover:underline mt-2 block"
        >
          → View full country data in Mapa da Dor
        </Link>
      </TerminalCard>

      {/* Source provenance */}
      {d.source_provenance && (
        <TerminalCard title="SOURCE PROVENANCE — LEGAL CHAIN OF CUSTODY" accent="amber" className="mb-6">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-content-dim">Designating authority:</span>
              <span className="text-content-primary font-bold">{d.source_provenance.authority}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-content-dim">Authority type:</span>
              <span className="text-blood-bright">{authorityLabel(d.source_provenance.authority_type)}</span>
            </div>
            {d.source_provenance.case_number && (
              <div className="flex justify-between">
                <span className="text-content-dim">Case / listing number:</span>
                <span className="text-content-primary font-mono">{d.source_provenance.case_number}</span>
              </div>
            )}
            {d.source_provenance.source_url && (
              <div className="flex justify-between">
                <span className="text-content-dim">Source URL:</span>
                <a
                  href={d.source_provenance.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blood-bright hover:underline"
                >
                  ↗ official source
                </a>
              </div>
            )}
            {d.source_provenance.auto_populated && (
              <div className="flex justify-between">
                <span className="text-content-dim">Pipeline:</span>
                <span className="text-terminal-green">auto-populated from OpenSanctions</span>
              </div>
            )}
          </div>
          <div className="border-t border-border-dim mt-3 pt-3">
            <p className="text-[10px] text-content-dim italic">
              This dossier is not an independent accusation by V FOR X. It surfaces a finding
              already made by the designating authority — a court, treaty body, or sanctions
              regime with legal jurisdiction. The original authority is solely responsible for
              the legal determination.
            </p>
          </div>
        </TerminalCard>
      )}

      {/* Accountability actions */}
      <TerminalCard title="ACCOUNTABILITY ACTIONS" accent="blood" glow className="mb-6">
        <p className="text-xs text-content-secondary mb-4">
          // this dossier documents violations. here's what you can do with it —
          templates pre-filled with this case's data for submission to international bodies.
        </p>
        <div className="space-y-3">
          {/* ICC referral */}
          <div className="border border-border-dim bg-void p-3">
            <div className="flex items-center gap-2 mb-2">
              <StatusPill color="blood">ICC</StatusPill>
              <span className="text-xs font-bold text-content-primary">International Criminal Court — Communication</span>
            </div>
            <p className="text-[10px] text-content-dim mb-2">
              Submit a communication under Article 15 of the Rome Statute. The ICC Prosecutor can receive information from any source.
            </p>
            <div className="flex gap-2">
              <a
                href="https://www.icc-cpi.int/get-involved/communications"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] px-2 py-1 border border-blood-dim text-blood-bright hover:bg-blood hover:text-void transition-colors"
              >
                ↗ ICC COMMUNICATIONS PORTAL
              </a>
              <button
                onClick={() => {
                  const text = `ICC COMMUNICATION — Article 15, Rome Statute\n\nSubject: ${d.subject}\nCategory: ${d.category.replace(/_/g, " ")}\nCountry: ${d.country_iso3}\nDossier: ${d.id}\n\nAllegation:\n${d.accusation}\n\nEvidence:\n${d.evidence.map((e, i) => `${i + 1}. [${e.type}] ${e.description} (${e.quality_score}pts)`).join("\n")}\n\nEvidence quality score: ${d.evidence_quality_score}/12\nPeer validations: ${d.peer_validations}/${d.required_validations}\n\nCountry data reference: ${d.country_data_ref}\n\nSubmitted via V FOR X — data platform (CC0)`;
                  navigator.clipboard.writeText(text);
                  sound.copy();
                }}
                className="text-[10px] px-2 py-1 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors"
              >
                [ COPY ICC TEMPLATE ]
              </button>
            </div>
          </div>

          {/* UN Special Rapporteur */}
          <div className="border border-border-dim bg-void p-3">
            <div className="flex items-center gap-2 mb-2">
              <StatusPill color="amber">UN</StatusPill>
              <span className="text-xs font-bold text-content-primary">UN Special Rapporteur — Submission</span>
            </div>
            <p className="text-[10px] text-content-dim mb-2">
              The UN Special Rapporteur on the Right to Food (and other mandates) accepts individual communications about human rights violations.
            </p>
            <div className="flex gap-2">
              <a
                href="https://www.ohchr.org/en/special-procedures/other-mandates"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] px-2 py-1 border border-blood-dim text-blood-bright hover:bg-blood hover:text-void transition-colors"
              >
                ↗ UN SPECIAL PROCEDURES
              </a>
              <button
                onClick={() => {
                  const text = `UN SPECIAL RAPPORTEUR — INDIVIDUAL COMMUNICATION\n\nMandate: Right to Food / Summary Execution / Torture (as applicable)\n\nSubject: ${d.subject}\nCountry: ${d.country_iso3}\nCategory: ${d.category.replace(/_/g, " ")}\n\nDescription of violation:\n${d.accusation}\n\nSupporting evidence:\n${d.evidence.map((e) => `- ${e.description}`).join("\n")}\n\nThis case is documented in the V FOR X accountability registry (Dossier ${d.id}).\nData sources: ${d.source_provenance?.authority ?? "community-submitted"}`;
                  navigator.clipboard.writeText(text);
                  sound.copy();
                }}
                className="text-[10px] px-2 py-1 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors"
              >
                [ COPY UN TEMPLATE ]
              </button>
            </div>
          </div>

          {/* Share / campaign */}
          <div className="border border-terminal-green bg-terminal-green/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <StatusPill color="green">PUBLIC</StatusPill>
              <span className="text-xs font-bold text-content-primary">Share & Campaign</span>
            </div>
            <p className="text-[10px] text-content-dim mb-2">
              Surface this case publicly. Generate a campaign kit or share the dossier link.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/the-act/`}
                className="text-[10px] px-2 py-1 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void transition-colors"
              >
                → CAMPAIGN GENERATOR
              </Link>
              <button
                onClick={() => {
                  const url = typeof window !== "undefined" ? window.location.href : "";
                  navigator.clipboard.writeText(url);
                  sound.copy();
                }}
                className="text-[10px] px-2 py-1 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors"
              >
                [ COPY DOSSIER LINK ]
              </button>
            </div>
          </div>
        </div>
        <div className="text-[10px] text-content-dim italic mt-3">
          ▸ V FOR X is a data platform, not a legal authority. Templates are starting points —
          consult the official submission guidelines of each body before filing.
        </div>
      </TerminalCard>

      {/* Version history */}
      <TerminalCard title="VERSION HISTORY">
        <div className="text-xs text-content-secondary space-y-1">
          <div>Created: {d.created_at}</div>
          <div>Last updated: {d.updated_at}</div>
          <div>Current version: v{d.version}</div>
        </div>
      </TerminalCard>
    </div>
  );
}
