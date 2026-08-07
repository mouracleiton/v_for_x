"use client";

import { use } from "react";
import Link from "next/link";
import dossiersData from "@/data/dossier-seed.json";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import DataBar from "@/components/ui/DataBar";

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
                <span className="text-xs text-content-dim">+{e.quality_score}pts</span>
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
