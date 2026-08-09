"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useStore } from "@/stores/useStore";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, CountryData } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import { formatNumber, formatPct, formatMoney } from "@/lib/format";
import {
  getProgress,
  getAllBadges,
  getBadgeProgress,
  levelFromXP,
  xpForLevel,
  xpForNextLevel,
  resetProgress,
  TIER_COLORS,
  TIER_LABELS,
  type Badge,
  type ProgressState,
} from "@/lib/gamification";
import { generateInfographicData } from "@/lib/campaign-tools";
import InfographicCard from "@/components/campaign/InfographicCard";

const data = backbone as WorldBackbone;

/* ═══════════════════════════════════════════════════════════════
 *  QUIZ LOGIC
 * ═══════════════════════════════════════════════════════════════ */

interface QuizQuestion {
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

function buildQuiz(): QuizQuestion[] {
  const cs = data.countries;
  const pick = <T,>(arr: T[], n: number): T[] => {
    const copy = [...arr];
    const out: T[] = [];
    for (let i = 0; i < n && copy.length > 0; i++) {
      out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    }
    return out;
  };

  const questions: QuizQuestion[] = [];

  // Q1: Which country has the highest child mortality?
  const withChildMort = cs.filter((c) => c.health.child_mortality_under5_per1k != null);
  if (withChildMort.length > 4) {
    const sorted = [...withChildMort].sort(
      (a, b) => (b.health.child_mortality_under5_per1k ?? 0) - (a.health.child_mortality_under5_per1k ?? 0),
    );
    const correct = sorted[0];
    const wrong = pick(sorted.slice(1, 50), 3);
    const opts = pick([correct, ...wrong], 4);
    questions.push({
      prompt: "Which country has the HIGHEST under-5 child mortality rate?",
      options: opts.map((c) => c.name_en),
      answerIndex: opts.indexOf(correct),
      explanation: `${correct.name_en}: ${correct.health.child_mortality_under5_per1k?.toFixed(0)} per 1,000 live births. Source: UN IGME / WHO.`,
    });
  }

  // Q2: Which country has the highest military spending as % of GDP?
  const withMil = cs.filter((c) => c.military.pct_gdp != null);
  if (withMil.length > 4) {
    const sorted = [...withMil].sort((a, b) => (b.military.pct_gdp ?? 0) - (a.military.pct_gdp ?? 0));
    const correct = sorted[0];
    const wrong = pick(sorted.slice(1, 50), 3);
    const opts = pick([correct, ...wrong], 4);
    questions.push({
      prompt: "Which country spends the HIGHEST share of GDP on the military?",
      options: opts.map((c) => c.name_en),
      answerIndex: opts.indexOf(correct),
      explanation: `${correct.name_en}: ${correct.military.pct_gdp?.toFixed(1)}% of GDP. Source: SIPRI ${correct.military.year}.`,
    });
  }

  // Q3: Which country has the lowest life expectancy?
  const withLifeExp = cs.filter((c) => c.health.life_expectancy != null);
  if (withLifeExp.length > 4) {
    const sorted = [...withLifeExp].sort(
      (a, b) => (a.health.life_expectancy ?? 999) - (b.health.life_expectancy ?? 999),
    );
    const correct = sorted[0];
    const wrong = pick(sorted.slice(1, 50), 3);
    const opts = pick([correct, ...wrong], 4);
    questions.push({
      prompt: "Which country has the LOWEST life expectancy?",
      options: opts.map((c) => c.name_en),
      answerIndex: opts.indexOf(correct),
      explanation: `${correct.name_en}: ${correct.health.life_expectancy?.toFixed(1)} years. Source: WHO.`,
    });
  }

  // Q4: Which country has the highest undernourishment?
  const withUnder = cs.filter((c) => c.hunger.undernourishment_pct != null);
  if (withUnder.length > 4) {
    const sorted = [...withUnder].sort(
      (a, b) => (b.hunger.undernourishment_pct ?? 0) - (a.hunger.undernourishment_pct ?? 0),
    );
    const correct = sorted[0];
    const wrong = pick(sorted.slice(1, 50), 3);
    const opts = pick([correct, ...wrong], 4);
    questions.push({
      prompt: "Which country has the HIGHEST undernourishment rate?",
      options: opts.map((c) => c.name_en),
      answerIndex: opts.indexOf(correct),
      explanation: `${correct.name_en}: ${correct.hunger.undernourishment_pct?.toFixed(1)}% of the population. Source: FAO SOFI.`,
    });
  }

  // Q5: Which country has the worst corruption (lowest CPI)?
  const withCpi = cs.filter((c) => c.governance.corruption_perceptions_index != null);
  if (withCpi.length > 4) {
    const sorted = [...withCpi].sort(
      (a, b) => (a.governance.corruption_perceptions_index ?? 999) - (b.governance.corruption_perceptions_index ?? 999),
    );
    const correct = sorted[0];
    const wrong = pick(sorted.slice(1, 50), 3);
    const opts = pick([correct, ...wrong], 4);
    questions.push({
      prompt: "Which country scores WORST on the Corruption Perceptions Index?",
      options: opts.map((c) => c.name_en),
      answerIndex: opts.indexOf(correct),
      explanation: `${correct.name_en}: CPI score of ${correct.governance.corruption_perceptions_index?.toFixed(0)} (0 = highly corrupt). Source: Transparency International.`,
    });
  }

  return questions.slice(0, 5);
}

/* ═══════════════════════════════════════════════════════════════
 *  PROGRESS BAR COMPONENT
 * ═══════════════════════════════════════════════════════════════ */

function ProgressBar({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-content-secondary">{label}</span>
        <span style={{ color }}>{value} / {max}</span>
      </div>
      <div className="w-full h-3 bg-void border border-border-dim overflow-hidden">
        <div
          className="h-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  BADGE CARD COMPONENT
 * ═══════════════════════════════════════════════════════════════ */

function BadgeCard({ badge, earned }: { badge: Badge; earned: boolean }) {
  const tierColor = TIER_COLORS[badge.tier];
  const prog = getBadgeProgress(badge.id);

  return (
    <div
      className={`terminal-card p-3 text-center transition-all ${
        earned ? "opacity-100" : "opacity-40"
      }`}
      style={earned ? { borderColor: tierColor } : {}}
      title={badge.description}
    >
      <div className="text-3xl mb-1" style={{ filter: earned ? "none" : "grayscale(1)" }}>
        {badge.emoji}
      </div>
      <div
        className="text-xs font-bold mb-1"
        style={{ color: earned ? tierColor : "var(--color-content-dim)" }}
      >
        {badge.name}
      </div>
      <div className="text-[10px] text-content-dim leading-tight mb-1">
        {badge.description}
      </div>
      <div
        className="text-[9px] uppercase tracking-wider"
        style={{ color: earned ? tierColor : "var(--color-content-dim)" }}
      >
        {TIER_LABELS[badge.tier]}
      </div>
      {!earned && prog.target > 1 && (
        <div className="mt-1 text-[9px] text-content-dim">
          {prog.progress}/{prog.target}
        </div>
      )}
      {earned && badge.earnedAt && (
        <div className="mt-1 text-[9px] text-terminal-green">
          ✓ EARNED
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  QUIZ COMPONENT
 * ═══════════════════════════════════════════════════════════════ */

function QuizSection() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    setQuestions(buildQuiz());
  }, []);

  const handleAnswer = useCallback((idx: number) => {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    if (idx === questions[current].answerIndex) {
      setScore((s) => s + 1);
      sound.success();
    } else {
      sound.error();
    }
  }, [answered, questions, current]);

  const handleNext = useCallback(() => {
    if (current + 1 >= questions.length) {
      setFinished(true);
      sound.nav();
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
      setAnswered(false);
      sound.nav();
    }
  }, [current, questions.length]);

  const handleRestart = useCallback(() => {
    setQuestions(buildQuiz());
    setCurrent(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
    setAnswered(false);
    sound.nav();
  }, []);

  if (questions.length === 0) {
    return <div className="text-content-dim text-xs">Loading quiz…</div>;
  }

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-3">{pct >= 80 ? "🏆" : pct >= 60 ? "🥈" : pct >= 40 ? "🥉" : "📚"}</div>
        <div className="text-2xl font-bold text-blood-bright mb-2">
          {score} / {questions.length}
        </div>
        <div className="text-content-secondary text-sm mb-4">
          {pct >= 80
            ? "Outstanding! You know the data."
            : pct >= 60
              ? "Solid. Keep exploring."
              : pct >= 40
                ? "Room to grow. Visit more countries."
                : "Time to explore the Sorrow Map."}
        </div>
        <button
          onClick={handleRestart}
          className="text-xs px-4 py-2 border border-blood text-blood-bright hover:bg-blood/10 transition-colors"
        >
          ↻ RETAKE QUIZ
        </button>
      </div>
    );
  }

  const q = questions[current];

  return (
    <div>
      {/* Progress dots */}
      <div className="flex gap-1 mb-4">
        {questions.map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1"
            style={{
              backgroundColor: i < current ? "var(--color-terminal-green)" : i === current ? "var(--color-blood)" : "var(--color-border-dim)",
            }}
          />
        ))}
      </div>

      <div className="text-[10px] text-content-dim mb-2">
        QUESTION {current + 1} / {questions.length}
      </div>
      <p className="text-sm text-content-primary mb-4 font-bold">{q.prompt}</p>

      <div className="grid gap-2">
        {q.options.map((opt, idx) => {
          const isCorrect = idx === q.answerIndex;
          const isSelected = idx === selected;
          let cls = "border-border-dim text-content-secondary hover:border-blood";
          if (answered) {
            if (isCorrect) cls = "border-terminal-green text-terminal-green";
            else if (isSelected) cls = "border-blood text-blood-bright bg-blood/5";
            else cls = "border-border-dim text-content-dim opacity-50";
          }
          return (
            <button
              key={idx}
              onClick={() => handleAnswer(idx)}
              disabled={answered}
              className={`text-left text-xs px-3 py-2 border transition-colors ${cls}`}
            >
              <span className="text-content-dim mr-2">[{String.fromCharCode(65 + idx)}]</span>
              {opt}
              {answered && isCorrect && " ✓"}
              {answered && isSelected && !isCorrect && " ✗"}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="mt-4 border border-border-dim p-3 bg-void">
          <div className="text-[10px] text-content-dim mb-1">EXPLANATION</div>
          <p className="text-xs text-content-secondary">{q.explanation}</p>
          <button
            onClick={handleNext}
            className="mt-3 text-xs px-4 py-2 border border-command text-command hover:bg-command/10 transition-colors"
          >
            {current + 1 >= questions.length ? "→ SEE RESULTS" : "→ NEXT QUESTION"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  REPORT CARD COMPONENT
 * ═══════════════════════════════════════════════════════════════ */

function ReportCardGenerator() {
  const [selectedIso3, setSelectedIso3] = useState("BRA");
  const [searchQ, setSearchQ] = useState("");

  const country = useMemo(
    () => data.countries.find((c) => c.iso3 === selectedIso3),
    [selectedIso3],
  );

  const filtered = useMemo(() => {
    const q = searchQ.toLowerCase().trim();
    if (!q) return [];
    return data.countries
      .filter((c) =>
        c.name_en.toLowerCase().includes(q) ||
        c.iso3.toLowerCase().includes(q) ||
        c.name_pt.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [searchQ]);

  if (!country) return null;

  const info = generateInfographicData(country);

  return (
    <div>
      {/* Quick picks */}
      <div className="flex flex-wrap gap-2 mb-3">
        {["SDN", "BRA", "USA", "IND", "COD", "YEM", "AFG", "UKR"].map((iso3) => {
          const c = data.countries.find((x) => x.iso3 === iso3);
          return (
            <button
              key={iso3}
              onClick={() => { setSelectedIso3(iso3); setSearchQ(""); sound.nav(); }}
              className={`text-[10px] px-2 py-1 border transition-colors ${
                selectedIso3 === iso3
                  ? "border-blood text-blood-bright bg-blood/5"
                  : "border-border-dim text-content-secondary hover:border-blood"
              }`}
            >
              {c?.name_en ?? iso3}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search 200 countries…"
          className="w-full bg-void border border-border-dim text-content-primary text-sm px-3 py-2 focus:border-blood focus:outline-none"
        />
        {filtered.length > 0 && (
          <div className="absolute z-50 w-full mt-1 border border-border-dim bg-void max-h-40 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.iso3}
                onClick={() => { setSelectedIso3(c.iso3); setSearchQ(""); sound.nav(); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-panel border-b border-border-dim"
              >
                <span className="text-content-dim">{c.iso3}</span>
                <span>{c.name_en}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Infographic card */}
      <InfographicCard country={country} template="crisis" size="square" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  MAIN PAGE
 * ═══════════════════════════════════════════════════════════════ */

export default function TheBadgesPage() {
  const { lang } = useStore();
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setProgress(getProgress());
    setAllBadges(getAllBadges());
  }, []);

  // SSR-safe placeholder
  if (!mounted || !progress) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="text-content-dim text-sm animate-pulse">
          // INITIALIZING BADGE SYSTEM…
        </div>
      </div>
    );
  }

  const earnedIds = new Set(progress.badges.map((b) => b.id));
  const earnedBadges = progress.badges;
  const lockedBadges = allBadges.filter((b) => !earnedIds.has(b.id));

  // Sort earned by date (most recent first)
  const recentBadges = [...earnedBadges]
    .sort((a, b) => (b.earnedAt ?? 0) - (a.earnedAt ?? 0))
    .slice(0, 6);

  // Level progress
  const currentLevelXP = xpForLevel(progress.level);
  const nextLevelXP = xpForLevel(progress.level + 1);
  const levelProgress = nextLevelXP - currentLevelXP;
  const xpInLevel = progress.xp - currentLevelXP;
  const levelPct = Math.round((xpInLevel / levelProgress) * 100);

  const handleReset = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.confirm("Reset ALL progress? This cannot be undone.")) {
      resetProgress();
      setProgress(getProgress());
      setAllBadges(getAllBadges());
      sound.error();
    }
  }, []);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">// GAMIFICATION</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood tracking-widest">
          THE BADGES
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          Knowledge &amp; Action Tracker. Every country you visit, every dossier you read,
          every campaign you build — tracked. Earn badges. Climb levels. Deepen the argument.
        </p>
      </div>

      {/* XP / Level bar */}
      <TerminalCard title="EXPLORER LEVEL" className="mb-6">
        <div className="flex items-center gap-4 mb-3">
          <div
            className="text-4xl font-black"
            style={{ color: TIER_COLORS.platinum }}
          >
            {progress.level}
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-content-secondary">LEVEL {progress.level}</span>
              <span className="text-content-dim">
                {xpInLevel} / {levelProgress} XP → LEVEL {progress.level + 1}
              </span>
            </div>
            <div className="w-full h-4 bg-void border border-border-dim overflow-hidden">
              <div
                className="h-full transition-all duration-700 flex items-center justify-end pr-2"
                style={{
                  width: `${Math.max(levelPct, 3)}%`,
                  background: `linear-gradient(90deg, ${TIER_COLORS.bronze}, ${TIER_COLORS.gold})`,
                }}
              >
                <span className="text-[9px] text-void font-bold">{levelPct}%</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-content-dim">
          <span>TOTAL XP: {progress.xp}</span>
          <span>
            {progress.badges.length} / {allBadges.length} BADGES EARNED
          </span>
        </div>
      </TerminalCard>

      {/* Progress bars */}
      <TerminalCard title="EXPLORATION PROGRESS" className="mb-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <ProgressBar
            label="Countries Visited"
            value={progress.countriesVisited.length}
            max={200}
            color="var(--color-blood)"
          />
          <ProgressBar
            label="Dossiers Read"
            value={progress.dossiersRead.length}
            max={13}
            color="var(--color-warning-amber)"
          />
          <ProgressBar
            label="Stories Completed"
            value={progress.storiesCompleted.length}
            max={10}
            color="var(--color-terminal-green)"
          />
          <ProgressBar
            label="Campaigns Generated"
            value={progress.campaignsGenerated}
            max={20}
            color="var(--color-command)"
          />
        </div>
      </TerminalCard>

      {/* Recently earned */}
      {recentBadges.length > 0 && (
        <TerminalCard title="RECENTLY EARNED" accent="green" className="mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {recentBadges.map((b) => (
              <div
                key={b.id}
                className="terminal-card p-3 text-center"
                style={{ borderColor: TIER_COLORS[b.tier] }}
              >
                <div className="text-3xl mb-1">{b.emoji}</div>
                <div
                  className="text-xs font-bold"
                  style={{ color: TIER_COLORS[b.tier] }}
                >
                  {b.name}
                </div>
                {b.earnedAt && (
                  <div className="text-[9px] text-content-dim mt-1">
                    {new Date(b.earnedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </TerminalCard>
      )}

      {/* Badge grid — all badges */}
      <TerminalCard title={`BADGE COLLECTION (${earnedBadges.length}/${allBadges.length})`} className="mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {allBadges.map((badge) => (
            <BadgeCard
              key={badge.id}
              badge={badge}
              earned={earnedIds.has(badge.id)}
            />
          ))}
        </div>
      </TerminalCard>

      {/* Quiz */}
      <TerminalCard title="COUNTRY QUIZ — TEST YOUR KNOWLEDGE" accent="amber" className="mb-6">
        <p className="text-xs text-content-secondary mb-4">
          5 questions pulled from real data across 200 countries. Can you identify the crisis
          hotspots?
        </p>
        <QuizSection />
      </TerminalCard>

      {/* Report card generator */}
      <TerminalCard title="COUNTRY REPORT CARD GENERATOR" className="mb-6">
        <p className="text-xs text-content-secondary mb-4">
          Pick a country. Generate a downloadable infographic card with its most devastating stat.
        </p>
        <ReportCardGenerator />
      </TerminalCard>

      {/* Reset */}
      <div className="text-center mt-8 mb-4">
        <button
          onClick={handleReset}
          className="text-[10px] px-3 py-1 border border-border-dim text-content-dim hover:border-blood hover:text-blood-bright transition-colors"
        >
          ⚠ RESET ALL PROGRESS
        </button>
        <p className="text-[10px] text-content-dim mt-2">
          All data is stored locally in your browser. Nothing leaves this device.
        </p>
      </div>
    </div>
  );
}
