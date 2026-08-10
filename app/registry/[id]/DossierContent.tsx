"use client";

import { use } from "react";
import Link from "next/link";
import dossiersData from "@/data/dossier-seed.json";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import DataBar from "@/components/ui/DataBar";
import { sound } from "@/lib/sound";
import { useStore } from "@/stores/useStore";
import { tc } from "@/lib/i18n-content";
import type { Lang } from "@/lib/i18n";
import { td } from "@/lib/dossiers-i18n";
import BlindedReview from "./BlindedReview";

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

const authorityLabel = (type: string | undefined, lang: Lang): string => {
  const keyMap: Record<string, string> = {
    icc_arrest_warrant: "auth.icc_arrest_warrant",
    icj_proceedings: "auth.icj_proceedings",
    un_investigation: "auth.un_investigation",
    un_sanctions: "auth.un_sanctions",
    sanctions: "auth.sanctions",
    community_submitted: "auth.community_submitted",
  };
  return tc(lang, keyMap[type ?? ""] ?? "auth.community_submitted");
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
  const { lang } = useStore();
  const d = dossiers.find((x) => x.id === id);

  if (!d) {
    return (
      <div className="p-3 sm:p-3 sm:p-6 md:p-10 max-w-3xl mx-auto text-center">
        <h1 className="text-2xl text-blood mb-4">{tc(lang, "card.dossier_not_found")}</h1>
        <Link href="/registry/" className="text-blood-bright hover:underline">
          ← Back to Registry
        </Link>
      </div>
    );
  }

  const di = td(d.id, lang);
  const validationPct = (d.peer_validations / (d.required_validations * 3)) * 100;

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/registry/" className="text-xs text-content-dim hover:text-blood">
          {tc(lang, "dossier.back_to_registry")}
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-content-dim">{d.id}</span>
          <StatusPill color={statusColor(d.status)}>
            {tc(lang, `dstat.${d.status.toLowerCase()}`)}
          </StatusPill>
          <StatusPill color={d.severity === "critical" ? "blood" : d.severity === "high" ? "amber" : "dim"}>
            {tc(lang, `dsev.${d.severity}`)}
          </StatusPill>
        </div>
        <h1 className="text-xl md:text-2xl text-blood-bright font-bold glow-blood">
          {di.subject}
        </h1>
        {d.source_provenance && (
          <div className="text-xs text-content-dim mt-2">
            <span className="text-content-secondary">{tc(lang, "dossier.source_prefix")} </span>
            <span className="text-blood-bright">{authorityLabel(d.source_provenance.authority_type, lang)}</span>
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
      <TerminalCard title={tc(lang, "card.accusation")} className="mb-6">
        <p className="text-sm text-content-primary">{di.accusation}</p>
        <div className="text-xs text-content-dim mt-3">
          {tc(lang, "dossier.category_label")} {tc(lang, `dcat.${d.category}`)} · {tc(lang, "dossier.country_label")}{" "}
          <Link
            href={`/sorrow-map/${d.country_iso3.toLowerCase()}/`}
            className="text-blood-bright hover:underline"
          >
            {d.country_iso3}
          </Link>
        </div>
      </TerminalCard>

      {/* Evidence chain */}
      <TerminalCard title={tc(lang, "card.evidence_chain")} className="mb-6">
        <div className="mb-3">
          <DataBar
            value={d.evidence_quality_score}
            max={12}
            label={tc(lang, "dossier.evidence_score")}
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
                {tc(lang, `evtype.${e.type}`)}
              </StatusPill>
              <div className="flex-1">
                <p className="text-xs text-content-primary">{di.evidence[i] ?? e.description}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-content-dim">+{e.quality_score}{tc(lang, "dossier.pts")}</span>
                  {e.source_url && (
                    <a
                      href={e.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blood-bright hover:underline"
                    >
                      {tc(lang, "dossier.source_link")}
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </TerminalCard>

      {/* Tribunal status */}
      <TerminalCard title={tc(lang, "card.tribunal_peers")} accent="green" className="mb-6">
        <DataBar
          value={d.peer_validations}
          max={d.required_validations * 3}
          label={`${tc(lang, "dossier.validations_label")} ${d.peer_validations} / ${tc(lang, "dossier.required")} ${d.required_validations}`}
          unit=""
        />
        <div className="text-xs text-content-dim mt-2">
          {tc(lang, "dossier.progress_confirmed")} ({validationPct.toFixed(0)}% {tc(lang, "dossier.of_threshold")})
        </div>
      </TerminalCard>

      {/* Blinded peer review — commit/reveal corroboration */}
      <BlindedReview dossierId={d.id} lang={lang} />

      {/* Right of response */}
      <TerminalCard title={tc(lang, "card.right_of_response")} accent="amber" className="mb-6">
        <p className="text-xs text-content-secondary">{di.rightOfResponse}</p>
      </TerminalCard>

      {/* Country data reference */}
      <TerminalCard title={tc(lang, "card.country_data")} className="mb-6">
        <p className="text-xs text-content-primary">{di.countryDataRef}</p>
        <Link
          href={`/sorrow-map/${d.country_iso3.toLowerCase()}/`}
          className="text-xs text-blood-bright hover:underline mt-2 block"
        >
          {tc(lang, "dossier.view_country_data")}
        </Link>
      </TerminalCard>

      {/* Source provenance */}
      {d.source_provenance && (
        <TerminalCard title={tc(lang, "card.source_provenance")} accent="amber" className="mb-6">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-content-dim">{tc(lang, "dossier.designating_auth")}</span>
              <span className="text-content-primary font-bold">{d.source_provenance.authority}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-content-dim">{tc(lang, "dossier.auth_type")}</span>
              <span className="text-blood-bright">{authorityLabel(d.source_provenance.authority_type, lang)}</span>
            </div>
            {d.source_provenance.case_number && (
              <div className="flex justify-between">
                <span className="text-content-dim">{tc(lang, "dossier.case_number")}</span>
                <span className="text-content-primary font-mono">{d.source_provenance.case_number}</span>
              </div>
            )}
            {d.source_provenance.source_url && (
              <div className="flex justify-between">
                <span className="text-content-dim">{tc(lang, "dossier.source_url")}</span>
                <a
                  href={d.source_provenance.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blood-bright hover:underline"
                >
                  {tc(lang, "dossier.official_source")}
                </a>
              </div>
            )}
            {d.source_provenance.auto_populated && (
              <div className="flex justify-between">
                <span className="text-content-dim">{tc(lang, "dossier.pipeline")}</span>
                <span className="text-terminal-green">{tc(lang, "dossier.auto_populated")}</span>
              </div>
            )}
          </div>
          <div className="border-t border-border-dim mt-3 pt-3">
            <p className="text-[10px] text-content-dim italic">
              {tc(lang, "dossier.disclaimer")}
            </p>
          </div>
        </TerminalCard>
      )}

      {/* Accountability actions */}
      <TerminalCard title={tc(lang, "card.accountability_actions")} accent="blood" glow className="mb-6">
        <p className="text-xs text-content-secondary mb-4">
          {tc(lang, "dossier.actions_intro")}
        </p>
        <div className="space-y-3">
          {/* ICC referral */}
          <div className="border border-border-dim bg-void p-3">
            <div className="flex items-center gap-2 mb-2">
              <StatusPill color="blood">ICC</StatusPill>
              <span className="text-xs font-bold text-content-primary">{tc(lang, "dossier.icc_comm")}</span>
            </div>
            <p className="text-[10px] text-content-dim mb-2">
              {tc(lang, "dossier.icc_desc")}
            </p>
            <div className="flex gap-2">
              <a
                href="https://www.icc-cpi.int/get-involved/communications"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] px-2 py-1 border border-blood-dim text-blood-bright hover:bg-blood hover:text-void transition-colors"
              >
                {tc(lang, "dossier.icc_portal_btn")}
              </a>
              <button
                onClick={() => {
                  const text = `ICC COMMUNICATION — Article 15, Rome Statute\n\nSubject: ${di.subject}\nCategory: ${tc(lang, `dcat.${d.category}`)}\nCountry: ${d.country_iso3}\nDossier: ${d.id}\n\nAllegation:\n${di.accusation}\n\nEvidence:\n${d.evidence.map((e, i) => `${i + 1}. [${e.type}] ${di.evidence[i] ?? e.description} (${e.quality_score}${tc(lang, "dossier.pts")})`).join("\n")}\n\nEvidence quality score: ${d.evidence_quality_score}/12\nPeer validations: ${d.peer_validations}/${d.required_validations}\n\nCountry data reference: ${di.countryDataRef}\n\nSubmitted via V FOR X — data platform (CC0)`;
                  navigator.clipboard.writeText(text);
                  sound.copy();
                }}
                className="text-[10px] px-2 py-1 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors"
              >
                {tc(lang, "dossier.copy_icc_btn")}
              </button>
            </div>
          </div>

          {/* UN Special Rapporteur */}
          <div className="border border-border-dim bg-void p-3">
            <div className="flex items-center gap-2 mb-2">
              <StatusPill color="amber">UN</StatusPill>
              <span className="text-xs font-bold text-content-primary">{tc(lang, "dossier.un_rapporteur")}</span>
            </div>
            <p className="text-[10px] text-content-dim mb-2">
              {tc(lang, "dossier.un_rapporteur_desc")}
            </p>
            <div className="flex gap-2">
              <a
                href="https://www.ohchr.org/en/special-procedures/other-mandates"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] px-2 py-1 border border-blood-dim text-blood-bright hover:bg-blood hover:text-void transition-colors"
              >
                {tc(lang, "dossier.un_procedures_btn")}
              </a>
              <button
                onClick={() => {
                  const text = `UN SPECIAL RAPPORTEUR — INDIVIDUAL COMMUNICATION\n\nMandate: Right to Food / Summary Execution / Torture (as applicable)\n\nSubject: ${di.subject}\nCountry: ${d.country_iso3}\nCategory: ${tc(lang, `dcat.${d.category}`)}\n\nDescription of violation:\n${di.accusation}\n\nSupporting evidence:\n${d.evidence.map((e, i) => `- ${di.evidence[i] ?? e.description}`).join("\n")}\n\nThis case is documented in the V FOR X accountability registry (Dossier ${d.id}).\nData sources: ${d.source_provenance?.authority ?? "community-submitted"}`;
                  navigator.clipboard.writeText(text);
                  sound.copy();
                }}
                className="text-[10px] px-2 py-1 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors"
              >
                {tc(lang, "dossier.copy_un_btn")}
              </button>
            </div>
          </div>

          {/* Share / campaign */}
          <div className="border border-terminal-green bg-terminal-green/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <StatusPill color="green">PUBLIC</StatusPill>
              <span className="text-xs font-bold text-content-primary">{tc(lang, "dossier.share_campaign")}</span>
            </div>
            <p className="text-[10px] text-content-dim mb-2">
              {tc(lang, "dossier.public_desc")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/the-act/`}
                className="text-[10px] px-2 py-1 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void transition-colors"
              >
                {tc(lang, "dossier.campaign_generator_btn")}
              </Link>
              <button
                onClick={() => {
                  const url = typeof window !== "undefined" ? window.location.href : "";
                  navigator.clipboard.writeText(url);
                  sound.copy();
                }}
                className="text-[10px] px-2 py-1 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors"
              >
                {tc(lang, "dossier.copy_link_btn")}
              </button>
            </div>
          </div>
        </div>
        <div className="text-[10px] text-content-dim italic mt-3">
          {tc(lang, "dossier.footer_disclaimer")}
        </div>
      </TerminalCard>

      {/* Version history */}
      <TerminalCard title={tc(lang, "card.version_history")}>
        <div className="text-xs text-content-secondary space-y-1">
          <div>{tc(lang, "dossier.created")} {d.created_at}</div>
          <div>{tc(lang, "dossier.last_updated")} {d.updated_at}</div>
          <div>{tc(lang, "dossier.current_version")}{d.version}</div>
        </div>
      </TerminalCard>
    </div>
  );
}
