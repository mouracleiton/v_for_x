"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import {
  COURSES,
  getCourseProgress,
  saveProgress,
  getCertificate,
  type Course,
  type Module,
  type QuizQuestion,
} from "@/lib/education";

/* ═══════════════════════════════════════════════════════════
   V FOR X — The Academy
   Interactive, data-driven courses on global crises.
   Progress persists to localStorage; certificates are
   generated entirely on the client (canvas download).
   ═══════════════════════════════════════════════════════════ */

const DIFFICULTY_COLOR: Record<Course["difficulty"], string> = {
  beginner: "var(--color-terminal-green)",
  intermediate: "var(--color-warning-amber)",
  advanced: "var(--color-blood-bright)",
};

// Map a data-exploration metric to the most relevant platform page + label
const EXPLORATION_LINKS: Record<string, { href: string; label: string }> = {
  "hunger.prevalence_pct": { href: "/sorrow-map/", label: "Sorrow Map" },
  "conflict.displacement_m": { href: "/sorrow-map/", label: "Sorrow Map" },
  "military.pct_gdp": { href: "/the-choice/", label: "The Choice" },
  "military.expenditure_usd": { href: "/the-choice/", label: "The Choice" },
  "governance.corruption_perceptions_index": { href: "/the-index/", label: "The Index" },
  "governance.political_corruption_index": { href: "/the-index/", label: "The Index" },
  "climate.co2_per_capita_t": { href: "/sorrow-map/", label: "Sorrow Map" },
  "climate.co2_mt": { href: "/sorrow-map/", label: "Sorrow Map" },
  "migration.idps_disaster_new": { href: "/the-exodus/", label: "The Exodus" },
  "migration.refugees_hosted": { href: "/the-exodus/", label: "The Exodus" },
  "health.life_expectancy": { href: "/the-compare/", label: "The Compare" },
  "global_indicators.hunger.cost_to_eradicate_billion_yr": { href: "/equation/", label: "The Equation" },
};

export default function TheAcademyPage() {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [progressVersion, setProgressVersion] = useState(0);

  // Re-read progress whenever it changes
  const selectedCourse = COURSES.find((c) => c.id === selectedCourseId) ?? null;
  const activeModule =
    selectedCourse?.modules.find((m) => m.id === activeModuleId) ?? null;

  const selectCourse = useCallback((id: string) => {
    sound.select();
    setSelectedCourseId(id);
    setActiveModuleId(null);
  }, []);

  const backToCatalog = useCallback(() => {
    sound.select();
    setSelectedCourseId(null);
    setActiveModuleId(null);
  }, []);

  const refreshProgress = useCallback(() => {
    setProgressVersion((v) => v + 1);
  }, []);

  // ── Catalog view ──
  if (!selectedCourse) {
    return (
      <CatalogView
        onSelect={selectCourse}
        progressVersion={progressVersion}
      />
    );
  }

  // ── Module reader view ──
  if (activeModule) {
    return (
      <ModuleReader
        course={selectedCourse}
        module={activeModule}
        onBack={() => {
          sound.select();
          setActiveModuleId(null);
        }}
        onSelectModule={setActiveModuleId}
        onProgress={refreshProgress}
        progressVersion={progressVersion}
      />
    );
  }

  // ── Course detail view ──
  return (
    <CourseDetail
      course={selectedCourse}
      onBack={backToCatalog}
      onOpenModule={(mid) => {
        sound.select();
        setActiveModuleId(mid);
      }}
      progressVersion={progressVersion}
      onProgress={refreshProgress}
    />
  );
}

/* ═══ Catalog ═══ */

function CatalogView({
  onSelect,
  progressVersion,
}: {
  onSelect: (id: string) => void;
  progressVersion: number;
}) {
  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <div className="text-xs uppercase tracking-widest" style={{ color: "var(--color-terminal-green)" }}>
          {"} learn the numbers that change minds"}
        </div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-content-primary)" }}>
          <span className="glitch" data-text="THE ACADEMY">
            THE ACADEMY
          </span>
        </h1>
        <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
          Four free, interactive courses built on real data from 200 countries. Each module ends
          with a quiz and a data-exploration prompt pointing you to live numbers. Complete all
          modules to earn a certificate. Everything runs offline — your progress is saved locally.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {COURSES.map((course) => (
          <CourseCard key={course.id} course={course} progressVersion={progressVersion} onOpen={() => onSelect(course.id)} />
        ))}
      </div>
    </main>
  );
}

function CourseCard({
  course,
  onOpen,
  progressVersion,
}: {
  course: Course;
  onOpen: () => void;
  progressVersion: number;
}) {
  // progressVersion referenced to force re-read on mount / change
  void progressVersion;
  const [progress, setProgress] = useState({ completedModules: [] as string[], quizScores: {} as Record<string, number> });

  useEffect(() => {
    setProgress(getCourseProgress(course.id));
  }, [course.id, progressVersion]);

  const completed = progress.completedModules.length;
  const total = course.modules.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const done = completed === total;

  return (
    <TerminalCard className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h2 className="text-base font-bold" style={{ color: "var(--color-content-primary)" }}>
          {course.title}
        </h2>
        <span
          className="inline-pill text-[10px] uppercase tracking-wider px-2 py-0.5 rounded flex-shrink-0"
          style={{
            color: DIFFICULTY_COLOR[course.difficulty],
            border: `1px solid ${DIFFICULTY_COLOR[course.difficulty]}`,
          }}
        >
          {course.difficulty}
        </span>
      </div>
      <p className="text-xs leading-relaxed mb-3 flex-1" style={{ color: "var(--color-content-secondary)" }}>
        {course.description}
      </p>
      <div className="flex items-center gap-3 text-[11px] mb-3" style={{ color: "var(--color-content-dim)" }}>
        <span>⏱ {course.duration}</span>
        <span>📚 {course.modules.length} modules</span>
        {done && <span style={{ color: "var(--color-terminal-green)" }}>✓ completed</span>}
      </div>
      {/* Progress bar */}
      <div className="w-full h-1.5 rounded mb-3 overflow-hidden" style={{ background: "var(--color-abyss)" }}>
        <div
          className="h-full transition-all"
          style={{
            width: `${pct}%`,
            background: done ? "var(--color-terminal-green)" : "var(--color-command)",
          }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px]" style={{ color: "var(--color-content-dim)" }}>
          {completed}/{total} modules
        </span>
        <button
          onClick={onOpen}
          className="inline-pill px-3 py-1.5 rounded text-xs font-bold transition-colors"
          style={{
            color: "var(--color-content-primary)",
            border: "1px solid var(--color-border-bright)",
            background: "var(--color-panel-hi)",
          }}
        >
          {pct > 0 ? "continue →" : "start →"}
        </button>
      </div>
    </TerminalCard>
  );
}

/* ═══ Course detail ═══ */

function CourseDetail({
  course,
  onBack,
  onOpenModule,
  progressVersion,
  onProgress,
}: {
  course: Course;
  onBack: () => void;
  onOpenModule: (moduleId: string) => void;
  progressVersion: number;
  onProgress: () => void;
}) {
  const [progress, setProgress] = useState({ completedModules: [] as string[], quizScores: {} as Record<string, number> });

  useEffect(() => {
    setProgress(getCourseProgress(course.id));
  }, [course.id, progressVersion]);

  const completed = progress.completedModules.length;
  const total = course.modules.length;
  const pct = Math.round((completed / total) * 100);
  const cert = completed === total ? getCertificate(course.id) : null;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <button
        onClick={onBack}
        className="inline-pill text-xs transition-colors"
        style={{ color: "var(--color-command-bright)" }}
      >
        ← all courses
      </button>

      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <span
            className="inline-pill text-[10px] uppercase tracking-wider px-2 py-0.5 rounded"
            style={{
              color: DIFFICULTY_COLOR[course.difficulty],
              border: `1px solid ${DIFFICULTY_COLOR[course.difficulty]}`,
            }}
          >
            {course.difficulty}
          </span>
          <span className="text-xs" style={{ color: "var(--color-content-dim)" }}>⏱ {course.duration}</span>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-content-primary)" }}>
          {course.title}
        </h1>
        <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
          {course.description}
        </p>
      </header>

      {/* Progress overview */}
      <TerminalCard title="your progress" accent="green">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="w-full h-2 rounded overflow-hidden mb-1" style={{ background: "var(--color-abyss)" }}>
              <div
                className="h-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: completed === total ? "var(--color-terminal-green)" : "var(--color-command)",
                }}
              />
            </div>
            <span className="text-xs" style={{ color: "var(--color-content-dim)" }}>
              {completed}/{total} modules complete{pct === 100 ? " — certificate unlocked!" : ""}
            </span>
          </div>
          <span className="text-2xl font-bold" style={{ color: completed === total ? "var(--color-terminal-green)" : "var(--color-command-bright)" }}>
            {pct}%
          </span>
        </div>
      </TerminalCard>

      {/* Certificate (only if complete) */}
      {cert && <CertificatePanel cert={cert} />}

      {/* Module list */}
      <div className="space-y-3">
        {course.modules.map((m, i) => {
          const isDone = progress.completedModules.includes(m.id);
          return (
            <button
              key={m.id}
              onClick={() => onOpenModule(m.id)}
              className="terminal-card p-4 w-full text-left transition-colors hover:border-[var(--color-command-dim)] block"
            >
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold flex-shrink-0"
                  style={{
                    background: isDone ? "var(--color-terminal-green)" : "var(--color-panel-hi)",
                    color: isDone ? "var(--color-void)" : "var(--color-content-secondary)",
                    border: `1px solid ${isDone ? "var(--color-terminal-green)" : "var(--color-border-bright)"}`,
                  }}
                >
                  {isDone ? "✓" : i + 1}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-bold" style={{ color: "var(--color-content-primary)" }}>
                    {m.title}
                  </div>
                  {m.quiz && (
                    <div className="text-[11px]" style={{ color: "var(--color-content-dim)" }}>
                      {m.quiz.length} quiz questions
                      {progress.quizScores[m.id] !== undefined
                        ? ` · last score ${progress.quizScores[m.id]}%`
                        : ""}
                    </div>
                  )}
                </div>
                <span className="text-xs" style={{ color: "var(--color-command-bright)" }}>
                  {isDone ? "review →" : "open →"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </main>
  );
}

/* ═══ Module reader + quiz ═══ */

function ModuleReader({
  course,
  module: currentModule,
  onBack,
  onSelectModule,
  onProgress,
  progressVersion,
}: {
  course: Course;
  module: Module;
  onBack: () => void;
  onSelectModule: (id: string) => void;
  onProgress: () => void;
  progressVersion: number;
}) {
  void progressVersion;
  const moduleIndex = course.modules.findIndex((m) => m.id === currentModule.id);
  const nextModule = course.modules[moduleIndex + 1] ?? null;
  const prevModule = course.modules[moduleIndex - 1] ?? null;
  const certRef = useRef<HTMLDivElement>(null);

  // ── Quiz state ──
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  // Reset quiz state when module changes
  useEffect(() => {
    setAnswers({});
    setRevealed({});
  }, [currentModule.id]);

  const answerQuestion = useCallback((qi: number, optionIndex: number) => {
    if (revealed[qi]) return; // locked after reveal
    sound.select();
    setAnswers((prev) => ({ ...prev, [qi]: optionIndex }));
  }, [revealed]);

  const revealQuestion = useCallback((qi: number) => {
    if (answers[qi] === undefined) return;
    setRevealed((prev) => ({ ...prev, [qi]: true }));
    const correct = currentModule.quiz?.[qi].correctIndex === answers[qi];
    if (correct) sound.success();
    else sound.error();
  }, [answers, currentModule.quiz]);

  const allQuizzesDone =
    !currentModule.quiz ||
    currentModule.quiz.every((_, qi) => revealed[qi]);

  const completeModule = useCallback(() => {
    sound.success();
    // Compute score if quiz exists
    let score: number | undefined;
    if (currentModule.quiz && currentModule.quiz.length > 0) {
      const correctCount = currentModule.quiz.filter(
        (q, qi) => answers[qi] === q.correctIndex,
      ).length;
      score = Math.round((correctCount / currentModule.quiz.length) * 100);
    }
    saveProgress(course.id, currentModule.id, score);
    onProgress();
    if (nextModule) {
      onSelectModule(nextModule.id);
    } else {
      onBack();
    }
  }, [currentModule, course.id, answers, onProgress, nextModule, onSelectModule, onBack]);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-content-dim)" }}>
        <button onClick={onBack} className="inline-pill transition-colors" style={{ color: "var(--color-command-bright)" }}>
          {course.title}
        </button>
        <span>/</span>
        <span style={{ color: "var(--color-content-secondary)" }}>module {moduleIndex + 1}</span>
      </div>

      {/* Content */}
      <TerminalCard title={currentModule.title} accent="green">
        <article className="text-sm leading-relaxed space-y-3" style={{ color: "var(--color-content-primary)" }}>
          {currentModule.content.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </article>
      </TerminalCard>

      {/* Data exploration prompt */}
      {currentModule.dataExploration && (
        <DataExplorationPanel exploration={currentModule.dataExploration} />
      )}

      {/* Quiz */}
      {currentModule.quiz && currentModule.quiz.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs uppercase tracking-widest" style={{ color: "var(--color-warning-amber)" }}>
            {"> "}knowledge check
          </h3>
          {currentModule.quiz.map((q, qi) => (
            <QuizPanel
              key={qi}
              index={qi}
              question={q}
              selected={answers[qi]}
              revealed={revealed[qi]}
              onAnswer={(opt) => answerQuestion(qi, opt)}
              onReveal={() => revealQuestion(qi)}
            />
          ))}
        </div>
      )}

      {/* Complete + navigate */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {prevModule && (
          <button
            onClick={() => {
              sound.select();
              onSelectModule(prevModule.id);
            }}
            className="inline-pill flex-1 px-4 py-2.5 rounded text-sm transition-colors"
            style={{ color: "var(--color-content-secondary)", border: "1px solid var(--color-border-bright)" }}
          >
            ← previous
          </button>
        )}
        <button
          onClick={completeModule}
          disabled={currentModule.quiz ? !allQuizzesDone : false}
          className="inline-pill flex-1 px-4 py-2.5 rounded text-sm font-bold transition-colors disabled:opacity-40"
          style={{
            color: "var(--color-void)",
            background: "var(--color-terminal-green)",
          }}
        >
          {nextModule ? "complete & next →" : "complete course ✓"}
        </button>
      </div>
      {currentModule.quiz && !allQuizzesDone && (
        <p className="text-xs text-center" style={{ color: "var(--color-content-dim)" }}>
          Answer and check all questions to unlock completion.
        </p>
      )}
      <div ref={certRef} />
    </main>
  );
}

function DataExplorationPanel({ exploration }: { exploration: NonNullable<Module["dataExploration"]> }) {
  const link = EXPLORATION_LINKS[exploration.metricKey] ?? { href: "/sorrow-map/", label: "Sorrow Map" };
  return (
    <TerminalCard title="data exploration" accent="amber">
      <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--color-content-primary)" }}>
        {exploration.prompt}
      </p>
      <a
        href={link.href}
        className="inline-pill inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors"
        style={{
          color: "var(--color-command-bright)",
          border: "1px solid var(--color-command-dim)",
          background: "var(--color-panel-hi)",
        }}
      >
        go to {link.label} →
      </a>
    </TerminalCard>
  );
}

function QuizPanel({
  index,
  question,
  selected,
  revealed,
  onAnswer,
  onReveal,
}: {
  index: number;
  question: QuizQuestion;
  selected: number | undefined;
  revealed: boolean;
  onAnswer: (optionIndex: number) => void;
  onReveal: () => void;
}) {
  const isCorrect = revealed && selected === question.correctIndex;
  return (
    <TerminalCard>
      <p className="text-sm font-bold mb-3" style={{ color: "var(--color-content-primary)" }}>
        <span style={{ color: "var(--color-content-dim)" }}>Q{index + 1}.</span> {question.question}
      </p>
      <div className="space-y-2 mb-3">
        {question.options.map((opt, oi) => {
          const isSelected = selected === oi;
          const isAnswer = oi === question.correctIndex;
          let borderColor = "var(--color-border-dim)";
          let bgColor = "transparent";
          let textColor = "var(--color-content-secondary)";
          if (revealed) {
            if (isAnswer) {
              borderColor = "var(--color-terminal-green)";
              bgColor = "rgba(34,211,166,0.1)";
              textColor = "var(--color-terminal-green)";
            } else if (isSelected) {
              borderColor = "var(--color-blood)";
              bgColor = "rgba(196,43,62,0.1)";
              textColor = "var(--color-blood-bright)";
            }
          } else if (isSelected) {
            borderColor = "var(--color-command)";
            bgColor = "var(--color-panel-hi)";
            textColor = "var(--color-content-primary)";
          }
          return (
            <button
              key={oi}
              onClick={() => onAnswer(oi)}
              disabled={revealed}
              className="inline-pill flex w-full items-center gap-2 px-3 py-2 rounded text-left text-xs transition-colors disabled:cursor-default"
              style={{ border: `1px solid ${borderColor}`, background: bgColor, color: textColor }}
            >
              <span className="font-bold">{String.fromCharCode(65 + oi)}.</span>
              <span>{opt}</span>
              {revealed && isAnswer && <span className="ml-auto">✓</span>}
              {revealed && isSelected && !isAnswer && <span className="ml-auto">✗</span>}
            </button>
          );
        })}
      </div>
      {!revealed ? (
        <button
          onClick={onReveal}
          disabled={selected === undefined}
          className="inline-pill px-3 py-1 rounded text-xs transition-colors disabled:opacity-40"
          style={{ color: "var(--color-warning-amber)", border: "1px solid var(--color-warning-amber)" }}
        >
          check answer
        </button>
      ) : (
        <div
          className="text-xs p-2 rounded mt-2"
          style={{
            borderLeft: `2px solid ${isCorrect ? "var(--color-terminal-green)" : "var(--color-blood)"}`,
            color: "var(--color-content-secondary)",
            background: "var(--color-void)",
          }}
        >
          <span style={{ color: isCorrect ? "var(--color-terminal-green)" : "var(--color-blood-bright)" }}>
            {isCorrect ? "✓ Correct. " : "✗ Not quite. "}
          </span>
          {question.explanation}
        </div>
      )}
    </TerminalCard>
  );
}

/* ═══ Certificate ═══ */

interface CertData {
  courseTitle: string;
  date: string;
  score: number;
}

function CertificatePanel({ cert }: { cert: CertData }) {
  const certificateRef = useRef<HTMLDivElement>(null);

  const download = useCallback(() => {
    // Render the certificate to a PNG via canvas (fully client-side)
    const canvas = document.createElement("canvas");
    const W = 1000;
    const H = 700;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#060b14";
    ctx.fillRect(0, 0, W, H);

    // Outer border
    ctx.strokeStyle = "#22d3a6";
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, W - 60, H - 60);
    ctx.strokeStyle = "#1a2a44";
    ctx.lineWidth = 1;
    ctx.strokeRect(44, 44, W - 88, H - 88);

    // Header
    ctx.fillStyle = "#8da3c4";
    ctx.font = "16px monospace";
    ctx.textAlign = "center";
    ctx.fillText("V FOR X — THE ACADEMY", W / 2, 110);

    ctx.fillStyle = "#dfe7f5";
    ctx.font = "bold 40px monospace";
    ctx.fillText("CERTIFICATE", W / 2, 165);

    ctx.fillStyle = "#8da3c4";
    ctx.font = "14px monospace";
    ctx.fillText("OF COMPLETION", W / 2, 190);

    // Body
    ctx.fillStyle = "#8da3c4";
    ctx.font = "14px monospace";
    ctx.fillText("This certifies that the bearer has completed all modules of", W / 2, 280);

    ctx.fillStyle = "#5b9cf6";
    ctx.font = "bold 26px monospace";
    wrapText(ctx, cert.courseTitle, W / 2, 330, W - 200, 32);

    // Score
    ctx.fillStyle = "#dfe7f5";
    ctx.font = "16px monospace";
    ctx.fillText(`with an average score of ${cert.score}%`, W / 2, 410);

    // Date
    ctx.fillStyle = "#8da3c4";
    ctx.font = "13px monospace";
    const dateStr = new Date(cert.date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    ctx.fillText(`Issued ${dateStr}`, W / 2, 480);

    // Seal
    ctx.strokeStyle = "#c42b3e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, 560, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#c42b3e";
    ctx.font = "bold 12px monospace";
    ctx.fillText("V FOR X", W / 2, 555);
    ctx.font = "10px monospace";
    ctx.fillText("VERIFIED", W / 2, 572);

    // Footer
    ctx.fillStyle = "#4a5d7a";
    ctx.font = "11px monospace";
    ctx.fillText("Open data against hunger · The platform that refuses to die", W / 2, H - 60);

    // Download
    const link = document.createElement("a");
    link.download = `vforx-certificate-${cert.courseTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    sound.success();
  }, [cert]);

  return (
    <div ref={certificateRef}>
      <TerminalCard title="certificate earned" accent="green" glow>
        <div
          className="p-6 rounded text-center mb-4"
          style={{ border: "2px solid var(--color-terminal-green)", background: "var(--color-void)" }}
        >
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--color-content-dim)" }}>
            V FOR X — The Academy
          </div>
          <div className="text-xl font-bold mb-3" style={{ color: "var(--color-content-primary)" }}>
            CERTIFICATE OF COMPLETION
          </div>
          <div className="text-sm mb-2" style={{ color: "var(--color-content-secondary)" }}>
            {cert.courseTitle}
          </div>
          <div className="text-3xl font-bold my-3" style={{ color: "var(--color-terminal-green)" }}>
            {cert.score}%
          </div>
          <div className="text-xs" style={{ color: "var(--color-content-dim)" }}>
            Issued {new Date(cert.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>
        <button
          onClick={download}
          className="inline-pill w-full px-4 py-2.5 rounded text-sm font-bold transition-colors"
          style={{ color: "var(--color-void)", background: "var(--color-terminal-green)" }}
        >
          ⬇ download certificate as image
        </button>
      </TerminalCard>
    </div>
  );
}

/* ── Canvas text-wrap helper ────────────────────────────── */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth && line !== "") {
      ctx.fillText(line.trim(), x, yy);
      line = word + " ";
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, yy);
}
