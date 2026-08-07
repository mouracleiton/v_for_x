"use client";

import { use } from "react";
import Link from "next/link";
import blueprintsData from "@/data/blueprints.json";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";

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
  const bp = blueprints.find((b) => b.id === id);

  if (!bp) {
    return (
      <div className="p-3 sm:p-3 sm:p-6 md:p-10 max-w-3xl mx-auto text-center">
        <h1 className="text-2xl text-blood mb-4">BLUEPRINT NOT FOUND</h1>
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
          ← BACK TO PROTOCOL X
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <StatusPill color={bp.tech_level === "HIGH" ? "amber" : "green"}>
            {bp.tech_level}-TECH
          </StatusPill>
          <StatusPill color="dim">{bp.category}</StatusPill>
        </div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          {bp.title}
        </h1>
        <p className="text-content-secondary text-sm mt-3">{bp.summary}</p>
      </div>

      <TerminalCard title="SPECIFICATIONS" className="mb-6 no-print">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-content-dim">Difficulty: </span>
            <span className="text-blood-bright">
              {"★".repeat(bp.difficulty)}{"☆".repeat(5 - bp.difficulty)}
            </span>
          </div>
          <div>
            <span className="text-content-dim">Time: </span>
            <span className="text-content-primary">{bp.time_estimate}</span>
          </div>
        </div>
      </TerminalCard>

      <TerminalCard title="REQUIREMENTS" className="mb-6 no-print">
        <ul className="space-y-1">
          {bp.requirements.map((r, i) => (
            <li key={i} className="text-xs text-content-primary flex items-start gap-2">
              <span className="text-blood mt-0.5">▸</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </TerminalCard>

      <TerminalCard title="PROCEDURE" className="mb-6 no-print">
        <ol className="space-y-3">
          {bp.steps.map((step, i) => (
            <li key={i} className="text-xs text-content-primary flex items-start gap-3">
              <span className="text-blood-bright font-bold shrink-0 w-6">
                {String(i + 1).padStart(2, "0")}.
              </span>
              <span className="flex-1">{step}</span>
            </li>
          ))}
        </ol>
      </TerminalCard>

      <TerminalCard title="NOTES & SOURCES" accent="amber" className="mb-6 no-print">
        <p className="text-xs text-content-secondary italic">{bp.notes}</p>
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
        [ PRINT THIS BLUEPRINT ]
      </button>
    </div>
  );
}
