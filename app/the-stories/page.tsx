"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import timelinesData from "@/data/crisis_timelines.json";
import type { WorldBackbone, CountryData } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import { calculateVulnerability, scoreColor } from "@/lib/vulnerability";

const data = backbone as WorldBackbone;

interface TimelineEntry {
  year: number;
  event: string;
  severity: "moderate" | "high" | "critical";
}
interface CrisisTimeline {
  iso3: string;
  name: string;
  timeline: TimelineEntry[];
}

const timelines = timelinesData as CrisisTimeline[];

/* ═══ STORY DEFINITIONS — guided narrative tours ═══ */

interface StoryStep {
  title: string;
  text: string;
  link?: { href: string; label: string };
  data?: { value: string; label: string; color?: string };
}

interface Story {
  id: string;
  title: string;
  icon: string;
  duration: string;
  steps: StoryStep[];
}

const STORIES: Story[] = [
  {
    id: "water",
    title: "The Water Crisis",
    icon: "💧",
    duration: "5 min",
    steps: [
      {
        title: "The Gap",
        text: "2 billion people lack safe water. 3.9 billion lack safely managed sanitation. That's over half of humanity without a toilet.",
        data: { value: "3.9B", label: "without safe sanitation", color: "#00ddff" },
      },
      {
        title: "The 10 Worst Countries",
        text: "In countries like South Sudan and Chad, less than 30% of the population has access to safe sanitation. Open defecation is the norm, not the exception.",
        link: { href: "/the-index/?tab=ranking", label: "→ See vulnerability ranking" },
      },
      {
        title: "The Blueprint",
        text: "Solar water purification requires nothing but clear plastic bottles and sunlight. No chemicals, no electricity, no filters. WHO-validated. Deployable today.",
        link: { href: "/protocol-x/water-solar-purification/", label: "→ Read the blueprint" },
      },
      {
        title: "The Equation",
        text: "The cost to fix this: $114 billion per year. That's 17 days of world military spending. Less than 5% of what the world spends on weapons.",
        data: { value: "$114B", label: "= 17 days of military spending", color: "#00ddff" },
        link: { href: "/equation/", label: "→ See the full equation" },
      },
      {
        title: "The Action",
        text: "Don't just read these numbers. Use them. Generate a campaign kit — tweets, emails, printable briefs — all pre-filled with real data. Copy. Send. Act.",
        link: { href: "/the-act/", label: "→ Generate campaign kit" },
      },
    ],
  },
  {
    id: "hunger",
    title: "The Hunger Equation",
    icon: "🩸",
    duration: "4 min",
    steps: [
      {
        title: "The Number",
        text: "667 million people are undernourished right now. That's 1 in 11 humans on Earth. Every single one of them is preventable.",
        data: { value: "667M", label: "undernourished in 2024", color: "#cc0000" },
      },
      {
        title: "The Worst Crises",
        text: "Sudan, South Sudan, Palestine, Yemen, Somalia — these are the front lines. In some, famine has already been declared. In others, it's imminent.",
        link: { href: "/sorrow-map/", label: "→ Explore the Sorrow Map" },
      },
      {
        title: "The Cost",
        text: "$93 billion per year. Not $93 trillion. Not even $930 billion. $93B. That's 0.9% of world military spending. 14 days.",
        data: { value: "$93B", label: "= 14 days of military spending", color: "#00ff41" },
      },
      {
        title: "The ROI",
        text: "School feeding programs return $7-35 for every $1 invested. Smallholder agriculture increases income by 34% and production by 35%. These aren't opinions — they're measured returns.",
        link: { href: "/equation/", label: "→ See the evidence" },
      },
      {
        title: "The Structural Blockers",
        text: "Armed conflict blocks aid. Corruption diverts resources. Climate change destroys harvests. The money exists — the system is designed to fail.",
        link: { href: "/registry/", label: "→ Document accountability" },
      },
    ],
  },
  {
    id: "inequality",
    title: "The Inequality Machine",
    icon: "⚖",
    duration: "5 min",
    steps: [
      {
        title: "The Gap",
        text: "The richest 1% hold more wealth than the bottom 50%. The money exists. The system redistributes it upward. This is not natural — it's designed.",
        data: { value: "15T", label: "billionaire wealth (USD)", color: "#aa44ff" },
      },
      {
        title: "The Doctor Gap",
        text: "Norway has 4.8 doctors per 1,000. The Central African Republic has 0.1. A 48x gap. The WHO minimum is 4.45. 186 of 194 countries are below it.",
        link: { href: "/the-index/?tab=comparison", label: "→ Compare countries" },
      },
      {
        title: "The Climate Injustice",
        text: "Qatar emits 41 tons of CO2 per person. The DRC emits 0.05. A 764x gap. The countries least responsible for climate change will suffer its worst consequences.",
        data: { value: "764×", label: "CO2 gap: Qatar vs DRC", color: "#cc6600" },
      },
      {
        title: "The Solution",
        text: "A 2% tax on the world's 3,000 billionaires raises $313B/year. That's enough to end extreme poverty AND fund water, electricity, and education for everyone. With $50B left over.",
        data: { value: "$313B", label: "from a 2% billionaire tax", color: "#aa44ff" },
        link: { href: "/equation/", label: "→ See the equation" },
      },
      {
        title: "The Combined Fix",
        text: "$422B/year buys safe water + healthcare + electricity + education for every human alive. That's 64 days of military spending. 17.5%. The question isn't whether we can afford it.",
        data: { value: "$422B", label: "= 64 days of military spending", color: "#00ff41" },
        link: { href: "/the-act/", label: "→ Take action" },
      },
    ],
  },
  {
    id: "accountability",
    title: "The Accountability Path",
    icon: "⚖",
    duration: "4 min",
    steps: [
      {
        title: "The Documentation",
        text: "Hunger is weaponized. Aid convoys are blocked. Food storage is destroyed. These aren't accidents — they're tactics. And they're war crimes.",
        link: { href: "/registry/", label: "→ Browse the registry" },
      },
      {
        title: "The Evidence Chain",
        text: "Each dossier documents violations with primary source evidence: UN reports, satellite imagery, witness testimony. Quality-scored, peer-validated.",
        link: { href: "/registry/REG-001/", label: "→ See a dossier" },
      },
      {
        title: "The International Bodies",
        text: "The ICC can prosecute war crimes. The ICJ adjudicates state responsibility. UN Special Rapporteurs receive individual communications. These mechanisms exist — they need evidence.",
        data: { value: "13", label: "dossiers documented" },
      },
      {
        title: "The Action",
        text: "Every dossier has pre-filled submission templates for the ICC, UN, and public campaigns. The evidence is there. The channels are open. Use them.",
        link: { href: "/the-act/", label: "→ Generate accountability kit" },
      },
    ],
  },
];

export default function StoriesPage() {
  const [activeStory, setActiveStory] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [activeTimeline, setActiveTimeline] = useState<string>("SDN");

  const story = STORIES.find((s) => s.id === activeStory);
  const timeline = timelines.find((t) => t.iso3 === activeTimeline);
  const timelineCountry = useMemo(
    () => data.countries.find((c) => c.iso3 === activeTimeline),
    [activeTimeline]
  );

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[14] STORIES</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          STORIES
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // don't just see the data — follow it. guided narrative tours connect
          the problem → the people → the solution → the action. crisis timelines
          show how we got here.
        </p>
      </div>

      {/* ═══ STORY MODES ═══ */}
      <TerminalCard title="STORY MODES — GUIDED TOURS" accent="amber" glow className="mb-6">
        {!story ? (
          <>
            <p className="text-xs text-content-secondary mb-4">
              // each story walks you through the data as a narrative — from the gap,
              to the worst-affected, to the blueprint, to the equation, to action.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {STORIES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setActiveStory(s.id); setStepIdx(0); sound.select(); }}
                  className="terminal-card p-4 hover:border-blood transition-colors text-left"
                >
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <div className="text-sm font-bold text-content-primary">{s.title}</div>
                  <div className="text-[10px] text-content-dim mt-1">
                    {s.duration} · {s.steps.length} steps
                  </div>
                  <div className="text-[10px] text-blood-bright mt-2">▶ START STORY</div>
                </button>
              ))}
            </div>
          </>
        ) : (
          /* Active story viewer */
          <div>
            {/* Story header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">{story.icon}</span>
                <span className="text-sm font-bold text-blood-bright">{story.title}</span>
              </div>
              <button
                onClick={() => { setActiveStory(null); sound.select(); }}
                className="text-xs text-content-dim hover:text-blood-bright"
              >
                ✕ EXIT
              </button>
            </div>

            {/* Progress bar */}
            <div className="flex gap-1 mb-4">
              {story.steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setStepIdx(i); sound.select(); }}
                  className="flex-1 h-1 transition-all"
                  style={{
                    backgroundColor: i <= stepIdx ? "var(--color-blood)" : "var(--color-border-dim)",
                  }}
                />
              ))}
            </div>

            {/* Current step */}
            {(() => {
              const step = story.steps[stepIdx];
              return (
                <div className="border border-border-dim bg-void p-4">
                  <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">
                    Step {stepIdx + 1} / {story.steps.length} — {step.title}
                  </div>
                  <p className="text-sm text-content-primary leading-relaxed mb-3">
                    {step.text}
                  </p>
                  {step.data && (
                    <div className="border-l-2 pl-3 mb-3" style={{ borderColor: step.data.color ?? "#cc0000" }}>
                      <div className="text-2xl font-bold" style={{ color: step.data.color ?? "#cc0000" }}>
                        {step.data.value}
                      </div>
                      <div className="text-[10px] text-content-secondary uppercase">
                        {step.data.label}
                      </div>
                    </div>
                  )}
                  {step.link && (
                    <Link
                      href={step.link.href}
                      className="inline-block text-xs px-3 py-1.5 border border-blood text-blood-bright hover:bg-blood hover:text-void transition-colors uppercase tracking-widest"
                    >
                      {step.link.label}
                    </Link>
                  )}
                </div>
              );
            })()}

            {/* Navigation */}
            <div className="flex justify-between mt-4">
              <button
                onClick={() => { setStepIdx(Math.max(0, stepIdx - 1)); sound.select(); }}
                disabled={stepIdx === 0}
                className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ◀ PREVIOUS
              </button>
              <span className="text-[10px] text-content-dim self-center">
                {stepIdx + 1} / {story.steps.length}
              </span>
              {stepIdx < story.steps.length - 1 ? (
                <button
                  onClick={() => { setStepIdx(stepIdx + 1); sound.select(); }}
                  className="text-xs px-3 py-1.5 border border-blood text-blood-bright hover:bg-blood hover:text-void transition-colors"
                >
                  NEXT ▶
                </button>
              ) : (
                <button
                  onClick={() => { setActiveStory(null); sound.success(); }}
                  className="text-xs px-3 py-1.5 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void transition-colors"
                >
                  ✓ FINISH
                </button>
              )}
            </div>
          </div>
        )}
      </TerminalCard>

      {/* ═══ CRISIS TIMELINES ═══ */}
      <TerminalCard title="CRISIS TIMELINES — HOW WE GOT HERE" accent="blood" glow>
        <p className="text-xs text-content-secondary mb-4">
          // curated timelines for the world's worst humanitarian crises. these aren't
          data points — they're a pattern of escalation, neglect, and recurrence.
        </p>

        {/* Country selector */}
        <div className="flex flex-wrap gap-2 mb-4">
          {timelines.map((t) => {
            const isActive = activeTimeline === t.iso3;
            const country = data.countries.find((c) => c.iso3 === t.iso3);
            return (
              <button
                key={t.iso3}
                onClick={() => { setActiveTimeline(t.iso3); sound.select(); }}
                className={`px-2 py-1 text-[10px] border transition-colors ${
                  isActive
                    ? "border-blood text-blood-bright bg-blood/10"
                    : "border-border-dim text-content-secondary hover:border-blood-dim"
                }`}
              >
                {t.name}
              </button>
            );
          })}
        </div>

        {/* Timeline */}
        {timeline && (
          <div>
            {/* Country header */}
            {timelineCountry && (
              <div className="flex items-center justify-between mb-4 p-3 border border-border-dim bg-void">
                <div>
                  <Link
                    href={`/sorrow-map/${timeline.iso3.toLowerCase()}/`}
                    className="text-sm font-bold text-content-primary hover:text-blood-bright"
                  >
                    {timelineCountry.name_en}
                  </Link>
                  <div className="text-[10px] text-content-dim">
                    {timelineCountry.region} · {timelineCountry.iso3}
                  </div>
                </div>
                {(() => {
                  const vuln = calculateVulnerability(timelineCountry);
                  return (
                    <div className="text-right">
                      <div className="text-lg font-bold" style={{ color: scoreColor(vuln.composite) }}>
                        {vuln.composite.toFixed(0)}
                      </div>
                      <div className="text-[9px] text-content-dim uppercase">VFX Score</div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Timeline entries */}
            <div className="relative pl-6 border-l border-border-dim">
              {timeline.timeline.map((entry, i) => {
                const dotColor =
                  entry.severity === "critical"
                    ? "var(--color-blood)"
                    : entry.severity === "high"
                      ? "var(--color-warning-amber)"
                      : "var(--color-content-dim)";
                return (
                  <div key={i} className="relative mb-4 last:mb-0">
                    {/* Dot */}
                    <div
                      className="absolute -left-[31px] top-1 w-3 h-3 border-2"
                      style={{ borderColor: dotColor, backgroundColor: dotColor }}
                    />
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-bold text-blood-bright font-mono">
                        {entry.year}
                      </span>
                      <StatusPill color={entry.severity === "critical" ? "blood" : entry.severity === "high" ? "amber" : "dim"}>
                        {entry.severity.toUpperCase()}
                      </StatusPill>
                    </div>
                    <p className="text-xs text-content-secondary">{entry.event}</p>
                  </div>
                );
              })}
            </div>

            {/* CTA */}
            <Link
              href={`/sorrow-map/${timeline.iso3.toLowerCase()}/`}
              className="block text-center text-xs py-2 mt-4 border border-blood-dim text-blood-bright hover:bg-blood hover:text-void transition-all uppercase tracking-widest"
            >
              → FULL COUNTRY DOSSIER
            </Link>
          </div>
        )}
      </TerminalCard>
    </div>
  );
}
