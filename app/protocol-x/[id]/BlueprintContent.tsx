"use client";

import { use } from "react";
import Link from "next/link";
import blueprintsData from "@/data/blueprints.json";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { useStore } from "@/stores/useStore";
import { tc } from "@/lib/i18n-content";
import { tbp } from "@/lib/blueprints-i18n";

interface Blueprint {
  id: string;
  title: string;
  category: string;
  tech_level: string;
  difficulty: number;
  time_estimate: string;
  tags: string[];
  summary: string;
  requirements: string[];
  steps: string[];
  notes: string;
}

const blueprints = blueprintsData as Blueprint[];

export default function BlueprintContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { lang } = useStore();
  const bp = blueprints.find((b) => b.id === id);
  const tbpData = bp ? tbp(lang, bp.id) : null;

  if (!bp) {
    return (
      <div className="p-3 sm:p-3 sm:p-6 md:p-10 max-w-3xl mx-auto text-center">
        <h1 className="text-2xl text-blood mb-4">{tc(lang, "card.blueprint_not_found")}</h1>
        <Link href="/protocol-x/" className="text-blood-bright hover:underline">
          ← Back to Protocol X
        </Link>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          href="/protocol-x/"
          className="text-xs text-content-dim hover:text-blood"
        >
          {tc(lang, "protocol.back_to_protocol_x")}
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <StatusPill color={bp.tech_level === "HIGH" ? "amber" : "green"}>
            {bp.tech_level === "HIGH" ? tc(lang, "protocol.high_tech") : tc(lang, "protocol.low_tech")}
          </StatusPill>
          <StatusPill color="dim">{tc(lang, `bp.cat.${bp.category}`)}</StatusPill>
        </div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          {tbpData?.title ?? bp.title}
        </h1>
        <p className="text-content-secondary text-sm mt-3">{tbpData?.summary ?? bp.summary}</p>
      </div>

      <TerminalCard title={tc(lang, "card.specifications")} className="mb-6 no-print">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-content-dim">{tc(lang, "protocol.difficulty")}: </span>
            <span className="text-blood-bright">
              {"★".repeat(bp.difficulty)}{"☆".repeat(5 - bp.difficulty)}
            </span>
          </div>
          <div>
            <span className="text-content-dim">{tc(lang, "protocol.time_label")}: </span>
            <span className="text-content-primary">{tbpData?.time_estimate ?? bp.time_estimate}</span>
          </div>
        </div>
      </TerminalCard>

      <TerminalCard title={tc(lang, "card.requirements")} className="mb-6 no-print">
        <ul className="space-y-1">
          {(tbpData?.requirements ?? bp.requirements).map((r, i) => (
            <li key={i} className="text-xs text-content-primary flex items-start gap-2">
              <span className="text-blood mt-0.5">▸</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </TerminalCard>

      <TerminalCard title={tc(lang, "card.procedure")} className="mb-6 no-print">
        <ol className="space-y-3">
          {(tbpData?.steps ?? bp.steps).map((step, i) => (
            <li key={i} className="text-xs text-content-primary flex items-start gap-3">
              <span className="text-blood-bright font-bold shrink-0 w-6">
                {String(i + 1).padStart(2, "0")}.
              </span>
              <span className="flex-1">{step}</span>
            </li>
          ))}
        </ol>
      </TerminalCard>

      <TerminalCard title={tc(lang, "card.notes_sources")} accent="amber" className="mb-6 no-print">
        <p className="text-xs text-content-secondary italic">{tbpData?.notes ?? bp.notes}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          {bp.tags.map((t) => (
            <span key={t} className="text-xs text-content-dim">#{t}</span>
          ))}
        </div>
      </TerminalCard>

      <button
        onClick={() => window.print()}
        className="px-4 py-2 text-xs border border-border-dim text-content-secondary hover:border-blood hover:text-blood no-print"
      >
        {tc(lang, "protocol.print_blueprint")}
      </button>

    </div>
  );
}
