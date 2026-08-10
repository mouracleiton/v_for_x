"use client";

/**
 * V FOR X — The Classifier
 *
 * [71] THE CLASSIFIER — Code: 71
 *
 * Document triage with on-device ML. Paste or drop a document and get:
 * document-type classification (contract, speech, leak, financial, legal,
 * NGO report, press release, correspondence), entity extraction (people,
 * organizations, money, dates, countries), and a risk score with
 * explainable factors. All offline — no text leaves the browser.
 *
 * Two engines:
 *   • SEMANTIC — embeds the document and compares to per-type prototype
 *     vectors via transformers.js (WebGPU → WASM), the same runtime as
 *     The Oracle.
 *   • HEURISTIC — instant keyword + regex scoring. Always available as
 *     the fallback and the initial signal.
 */

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import { downloadFile } from "@/lib/export-utils";
import {
  classifyDocumentHeuristic,
  classifyDocumentSemantic,
  embedPrototypes,
  formatClassifierReport,
  DOCUMENT_TYPES,
  type ClassifierResult,
  type RiskLevel,
  type ExtractedEntity,
  type PrototypeVectors,
} from "@/lib/classifier";
import { extractTextFromPDF } from "@/lib/doc-analyzer";
import {
  isSemanticSupported,
  getEmbedder,
  detectBackend,
  type EmbedderBackend,
} from "@/lib/embeddings";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

const RISK_META: Record<
  RiskLevel,
  { color: "blood" | "amber" | "green" | "dim"; label: string; threshold: number }
> = {
  critical: { color: "blood", label: "CRITICAL", threshold: 70 },
  high: { color: "blood", label: "HIGH", threshold: 45 },
  moderate: { color: "amber", label: "MODERATE", threshold: 20 },
  low: { color: "green", label: "LOW", threshold: 0 },
};

const TYPE_COLORS: Record<string, string> = {
  contract: "var(--color-warning-amber)",
  speech_transcript: "var(--color-terminal-green)",
  leaked_memo: "var(--color-blood-bright)",
  financial_filing: "#00ddff",
  legal_regulatory: "#aa44ff",
  ngo_report: "var(--color-terminal-green)",
  press_release: "var(--color-command-bright)",
  personal_correspondence: "var(--color-content-secondary)",
};

type EngineState = "unsupported" | "idle" | "loading" | "ready" | "error";

/* ═══════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════ */

export default function TheClassifierPage() {
  const [text, setText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Instant heuristic result (always computed on analyze)
  const [heurResult, setHeurResult] = useState<ClassifierResult | null>(null);
  // Semantic classification result (when model is ready)
  const [semResult, setSemResult] = useState<ClassifierResult | null>(null);
  const [classifying, setClassifying] = useState(false);

  // ── Semantic engine state ──
  const supported = isSemanticSupported();
  const [engineState, setEngineState] = useState<EngineState>(
    supported ? "idle" : "unsupported",
  );
  const [progress, setProgress] = useState({ frac: 0, label: "" });
  const [backend, setBackend] = useState<EmbedderBackend | null>(null);
  const embedRef = useRef<((t: string[]) => Promise<number[][]>) | null>(null);
  const protoRef = useRef<PrototypeVectors | null>(null);

  // Which result to display (semantic if available, else heuristic)
  const displayResult = semResult ?? heurResult;

  /* ═══════════════════════════════════════════════════════════
     Engine bootstrap — download model + embed prototypes
     ═══════════════════════════════════════════════════════════ */
  const initEngine = useCallback(async () => {
    if (!supported) return;
    if (engineState === "loading" || engineState === "ready") return;
    setEngineState("loading");
    setNote(null);
    try {
      setProgress({ frac: 0.01, label: "Booting on-device inference…" });
      const result = await getEmbedder((frac, label) =>
        setProgress({ frac, label }),
      );
      if (!result) throw new Error("Inference unavailable in this browser.");
      embedRef.current = result.embed;
      setBackend(result.status.backend);

      setProgress({ frac: 0.97, label: "Embeding document-type prototypes…" });
      const protos = await embedPrototypes(result.embed, result.status.modelId);
      protoRef.current = protos;

      setEngineState("ready");
      sound.success();
    } catch (e) {
      setEngineState("error");
      setNote(`Model load failed: ${(e as Error).message}. Heuristic engine still works.`);
      sound.error();
    }
  }, [supported, engineState]);

  /* ═══════════════════════════════════════════════════════════
     Analysis pipeline
     ═══════════════════════════════════════════════════════════ */
  const runAnalysis = useCallback(
    async (input: string) => {
      setNote(null);
      if (!input.trim()) {
        setHeurResult(null);
        setSemResult(null);
        setNote("Nothing to classify — paste or drop some text first.");
        return;
      }

      // 1. Instant heuristic pipeline.
      const hr = classifyDocumentHeuristic(input);
      setHeurResult(hr);
      setSemResult(null);
      sound.select();

      // 2. Semantic classification (if model is ready).
      if (engineState === "ready" && embedRef.current && protoRef.current) {
        setClassifying(true);
        try {
          const sr = await classifyDocumentSemantic(
            input,
            embedRef.current,
            protoRef.current,
          );
          setSemResult(sr);
          sound.success();
        } catch (e) {
          // Semantic failed — heuristic result is already shown.
          setNote(`Semantic classification skipped: ${(e as Error).message}`);
        } finally {
          setClassifying(false);
        }
      }
    },
    [engineState],
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      setBusy(true);
      setNote(null);
      try {
        const name = file.name.toLowerCase();
        if (name.endsWith(".pdf") || file.type === "application/pdf") {
          const extracted = await extractTextFromPDF(file);
          setText(extracted);
          if (extracted.startsWith("[")) {
            setNote(extracted);
            setHeurResult(null);
            setSemResult(null);
          } else {
            await runAnalysis(extracted);
          }
        } else if (
          name.endsWith(".txt") ||
          name.endsWith(".md") ||
          file.type.startsWith("text/")
        ) {
          const content = await file.text();
          setText(content);
          await runAnalysis(content);
        } else {
          setNote(`Unsupported file type: ${file.name}. Use .txt, .md, or .pdf.`);
        }
      } catch (err) {
        setNote(`Could not read file: ${(err as Error).message}`);
      } finally {
        setBusy(false);
      }
    },
    [runAnalysis],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      void handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const report = useMemo(
    () => (displayResult ? formatClassifierReport(displayResult) : ""),
    [displayResult],
  );

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* ── Header ── */}
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-blood-bright glow-blood">
          The Classifier
        </h1>
        <p className="text-content-secondary mt-2 text-sm max-w-3xl">
          Drop or paste a document for on-device ML triage. Classify document
          type, extract entities (people, organizations, money, dates,
          locations), and assess risk — all offline. No text leaves your browser.
        </p>
      </header>

      {/* ── Engine status bar ── */}
      <EngineStatusBar
        supported={supported}
        engineState={engineState}
        backend={backend}
        progress={progress}
        onInit={initEngine}
        hasResult={!!displayResult}
        classifying={classifying}
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ═══ LEFT: INPUT ═══ */}
        <div className="space-y-4">
          {/* Drop zone */}
          <TerminalCard title="upload document" accent="green">
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className="block cursor-pointer border border-dashed p-6 text-center transition-colors"
              style={{
                borderColor: dragOver ? "var(--color-terminal-green)" : "var(--color-border-bright)",
                background: dragOver ? "rgba(34,211,166,0.06)" : "transparent",
              }}
            >
              <input
                type="file"
                accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
                className="hidden"
                onChange={(e) => void handleFiles(e.target.files)}
              />
              <div className="text-terminal-green text-3xl mb-1">⬇</div>
              <div className="text-sm text-content-primary">
                {busy ? "Reading file…" : "Drop a file here or click to browse"}
              </div>
              <div className="text-xs text-content-dim mt-1">.txt · .md · .pdf (via pdf.js CDN)</div>
            </label>
            {note && (
              <div className="text-xs text-warning-amber mt-2 p-2 border border-border-dim bg-panel">
                {note}
              </div>
            )}
          </TerminalCard>

          {/* Paste area */}
          <TerminalCard title="or paste text" accent="green">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste contracts, speeches, leaked memos, financial filings, legal documents, NGO reports, press releases…"
              className="w-full bg-void border border-border-dim p-2 text-sm text-content-primary outline-none focus:border-command font-mono"
              style={{ height: 220, resize: "vertical" }}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-content-dim">
                {text.trim() ? text.trim().split(/\s+/).length.toLocaleString() : 0} words
              </span>
              <button
                onClick={() => void runAnalysis(text)}
                disabled={busy || classifying}
                className="px-4 py-2 text-xs uppercase tracking-widest border transition-colors disabled:opacity-50"
                style={{
                  borderColor: "var(--color-blood-bright)",
                  color: "var(--color-blood-bright)",
                  background: "rgba(226,56,86,0.08)",
                }}
              >
                {classifying ? "⟳ Classifying…" : "▶ Classify"}
              </button>
            </div>
          </TerminalCard>
        </div>

        {/* ═══ RIGHT: RESULTS ═══ */}
        <div className="space-y-4">
          {!displayResult ? (
            <TerminalCard title="results" accent="blood">
              <div className="text-sm text-content-dim py-16 text-center">
                Results will appear here after classification.
              </div>
            </TerminalCard>
          ) : (
            <Results result={displayResult} report={report} isSemantic={!!semResult} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ENGINE STATUS BAR
   ═══════════════════════════════════════════════════════════ */

function EngineStatusBar({
  supported,
  engineState,
  backend,
  progress,
  onInit,
  hasResult,
  classifying,
}: {
  supported: boolean;
  engineState: EngineState;
  backend: EmbedderBackend | null;
  progress: { frac: number; label: string };
  onInit: () => void;
  hasResult: boolean;
  classifying: boolean;
}) {
  if (!supported) {
    return (
      <div className="text-xs text-content-dim p-2 border border-border-dim bg-panel">
        ⚠ On-device ML not available in this browser (requires WebAssembly).
        Heuristic engine (keyword + regex) is fully functional.
      </div>
    );
  }

  return (
    <TerminalCard title="classification engine" accent={engineState === "ready" ? "green" : "amber"}>
      <div className="flex flex-wrap items-center gap-3">
        {engineState === "idle" && (
          <>
            <StatusPill color="dim">HEURISTIC READY</StatusPill>
            <button
              onClick={onInit}
              className="px-3 py-1.5 text-xs uppercase tracking-widest border border-terminal-green text-terminal-green hover:bg-terminal-green/10 transition-colors"
            >
              ⚡ Load ML Model
            </button>
            <span className="text-xs text-content-dim">
              ~23 MB one-time download · cached forever · WebGPU{backend ? "" : "/WASM"}
            </span>
          </>
        )}
        {engineState === "loading" && (
          <div className="w-full space-y-2">
            <div className="flex items-center gap-2">
              <StatusPill color="amber">LOADING</StatusPill>
              <span className="text-xs text-content-secondary">{progress.label}</span>
            </div>
            <div className="h-1.5 bg-panel border border-border-dim overflow-hidden">
              <div
                className="h-full bg-terminal-green transition-all"
                style={{ width: `${Math.round(progress.frac * 100)}%` }}
              />
            </div>
          </div>
        )}
        {engineState === "ready" && (
          <>
            <StatusPill color="green">SEMANTIC READY</StatusPill>
            <span className="text-xs text-content-dim">
              {backend?.toUpperCase()} · all-MiniLM-L6-v2
            </span>
            {classifying && (
              <span className="text-xs text-warning-amber">⟳ Embedding document…</span>
            )}
          </>
        )}
        {engineState === "error" && (
          <>
            <StatusPill color="blood">MODEL ERROR</StatusPill>
            <button
              onClick={onInit}
              className="px-3 py-1.5 text-xs uppercase tracking-widest border border-blood text-blood-bright hover:bg-blood/10 transition-colors"
            >
              ↻ Retry
            </button>
            <span className="text-xs text-content-dim">Heuristic engine active</span>
          </>
        )}
      </div>
    </TerminalCard>
  );
}

/* ═══════════════════════════════════════════════════════════
   RESULTS PANELS
   ═══════════════════════════════════════════════════════════ */

function Results({
  result,
  report,
  isSemantic,
}: {
  result: ClassifierResult;
  report: string;
  isSemantic: boolean;
}) {
  const { classification, entities, risk, analysis } = result;
  const riskMeta = RISK_META[risk.level];
  const topColor = TYPE_COLORS[classification.top.id] ?? "var(--color-blood)";

  return (
    <>
      {/* ── Summary scorecard ── */}
      <TerminalCard title="summary" accent="blood">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="border border-border-dim p-2">
            <div className="text-content-dim">Word count</div>
            <div className="text-content-primary text-lg font-bold">
              {result.wordCount.toLocaleString()}
            </div>
          </div>
          <div className="border border-border-dim p-2">
            <div className="text-content-dim">Document type</div>
            <div className="text-sm font-bold leading-tight" style={{ color: topColor }}>
              {classification.top.label}
            </div>
            <div className="text-[10px] text-content-dim">
              {classification.engine} · {classification.top.pct.toFixed(0)}% confidence
            </div>
          </div>
          <div className="border border-border-dim p-2">
            <div className="text-content-dim">Risk score</div>
            <div className="text-lg font-bold" style={{ color: `var(--color-${riskMeta.color === "blood" ? "blood-bright" : riskMeta.color === "amber" ? "warning-amber" : "terminal-green"})` }}>
              {risk.score}
              <span className="text-[10px] text-content-dim">/100</span>
            </div>
            <div className="text-[10px]" style={{ color: `var(--color-${riskMeta.color === "blood" ? "blood-bright" : riskMeta.color === "amber" ? "warning-amber" : "terminal-green"})` }}>
              {riskMeta.label}
            </div>
          </div>
          <div className="border border-border-dim p-2">
            <div className="text-content-dim">Entities</div>
            <div className="text-command-bright text-lg font-bold">
              {entities.total}
            </div>
            <div className="text-[10px] text-content-dim">
              {entities.people.length} ppl · {entities.organizations.length} orgs
            </div>
          </div>
        </div>

        {/* Engine badge */}
        <div className="flex items-center gap-2 mt-3">
          <StatusPill color={isSemantic ? "green" : "dim"}>
            {isSemantic ? "SEMANTIC" : "HEURISTIC"}
          </StatusPill>
          <span className="text-[10px] text-content-dim">
            {isSemantic
              ? "Model-powered cosine-similarity classification"
              : "Keyword/regex scoring — load the ML model for precise results"}
          </span>
        </div>

        <button
          onClick={() => downloadFile("vforx-classifier-report.txt", report, "text/plain")}
          className="mt-3 w-full px-3 py-2 text-xs uppercase tracking-widest border border-command text-command-bright hover:bg-panel-hi"
        >
          ⤓ Download Report
        </button>
      </TerminalCard>

      {/* ── Document type breakdown ── */}
      <TerminalCard title={`document type — ${classification.engine}`} accent="amber">
        <div className="space-y-2">
          {classification.scores.map((s) => {
            const color = TYPE_COLORS[s.id] ?? "var(--color-content-secondary)";
            const isTop = s.id === classification.top.id;
            return (
              <div key={s.id}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className={isTop ? "text-content-primary font-bold" : "text-content-secondary"}>
                    {isTop ? "▶ " : "  "}{s.label}
                  </span>
                  <span className="text-content-dim tabular-nums">{s.pct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-panel border border-border-dim overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${Math.max(0.5, s.pct)}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-[10px] text-content-dim mt-2">
          {DOCUMENT_TYPES.find((t) => t.id === classification.top.id)?.description}
        </div>
      </TerminalCard>

      {/* ── Risk assessment ── */}
      <TerminalCard title={`risk assessment — ${risk.level}`} accent={riskMeta.color === "green" ? "green" : riskMeta.color === "amber" ? "amber" : "blood"}>
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-content-dim">Risk score</span>
            <span className="font-bold tabular-nums" style={{ color: "var(--color-blood-bright)" }}>
              {risk.score}/100
            </span>
          </div>
          <div className="h-2 bg-panel border border-border-dim overflow-hidden">
            <div
              className="h-full transition-all"
              style={{
                width: `${risk.score}%`,
                backgroundColor:
                  risk.level === "critical" || risk.level === "high"
                    ? "var(--color-blood-bright)"
                    : risk.level === "moderate"
                      ? "var(--color-warning-amber)"
                      : "var(--color-terminal-green)",
              }}
            />
          </div>
          {/* Threshold markers */}
          <div className="flex justify-between text-[8px] text-content-dim mt-0.5">
            <span>0</span>
            <span style={{ marginLeft: "20%" }}>mod</span>
            <span style={{ marginLeft: "16%" }}>high</span>
            <span style={{ marginLeft: "12%" }}>crit</span>
            <span>100</span>
          </div>
        </div>

        {risk.factors.length === 0 ? (
          <p className="text-sm text-content-dim py-2 text-center">
            No significant risk factors detected.
          </p>
        ) : (
          <div className="space-y-1.5">
            {risk.factors.map((f, i) => (
              <div
                key={i}
                className="text-xs border-l-2 pl-2 py-1"
                style={{
                  borderColor:
                    f.severity === "critical"
                      ? "var(--color-blood)"
                      : f.severity === "warning"
                        ? "var(--color-warning-amber)"
                        : "var(--color-terminal-green)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-content-primary font-bold">{f.label}</span>
                  <span className="text-content-dim tabular-nums">+{f.points}</span>
                </div>
                <div className="text-content-secondary">{f.detail}</div>
              </div>
            ))}
          </div>
        )}
      </TerminalCard>

      {/* ── Entity panels ── */}
      <EntityPanel title="people" entities={entities.people} color="green" />
      <EntityPanel title="organizations" entities={entities.organizations} color="amber" />
      <EntityPanel
        title="money & amounts"
        entities={entities.money}
        color="blood"
        renderValue={(e) => (e.value ? ` ≈$${e.value.toLocaleString()}` : "")}
      />
      <EntityPanel title="dates" entities={entities.dates} color="dim" />
      <EntityPanel title="percentages" entities={entities.percentages} color="dim" />

      {/* ── Country mentions ── */}
      {entities.countries.length > 0 && (
        <TerminalCard title={`country mentions (${entities.countries.length})`} accent="green">
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {entities.countries.map((cm) => (
              <a
                key={cm.iso3}
                href={`${BASE}/sorrow-map/${cm.iso3.toLowerCase()}/`}
                className="flex items-center justify-between text-xs py-1 px-2 border border-transparent hover:border-border-bright hover:bg-panel-hi"
              >
                <span className="text-command-bright">
                  {cm.name} <span className="text-content-dim">{cm.iso3}</span>
                </span>
                <span className="text-content-secondary tabular-nums">×{cm.count}</span>
              </a>
            ))}
          </div>
        </TerminalCard>
      )}

      {/* ── Red flags from base analysis ── */}
      {analysis.redFlags.length > 0 && (
        <TerminalCard title={`red flags (${analysis.redFlags.length})`} accent="blood">
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {analysis.redFlags.slice(0, 15).map((f, i) => (
              <div
                key={`${f.term}-${i}`}
                className="text-xs border-l-2 pl-2 py-1"
                style={{
                  borderColor:
                    f.severity === "critical"
                      ? "var(--color-blood)"
                      : "var(--color-warning-amber)",
                }}
              >
                <span className="text-content-primary font-bold">{f.term}</span>{" "}
                <span className="text-content-dim">[{f.category}]</span>
                <div className="text-content-secondary italic">{f.context}</div>
              </div>
            ))}
          </div>
        </TerminalCard>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   ENTITY PANEL
   ═══════════════════════════════════════════════════════════ */

function EntityPanel({
  title,
  entities,
  color,
  renderValue,
}: {
  title: string;
  entities: ExtractedEntity[];
  color: "blood" | "green" | "amber" | "dim";
  renderValue?: (e: ExtractedEntity) => string;
}) {
  return (
    <TerminalCard title={`${title} (${entities.length})`} accent={color === "dim" ? "blood" : color}>
      {entities.length === 0 ? (
        <p className="text-sm text-content-dim py-2 text-center">
          No {title} detected.
        </p>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {entities.slice(0, 20).map((e, i) => (
            <div
              key={`${e.text}-${i}`}
              className="text-xs py-1 px-2 border border-transparent hover:border-border-dim"
            >
              <div className="flex items-center justify-between">
                <span className="text-content-primary font-bold">{e.text}</span>
                <span className="text-content-dim tabular-nums">
                  {renderValue?.(e)}
                  {e.count > 1 ? ` ×${e.count}` : ""}
                </span>
              </div>
              {e.context && (
                <div className="text-content-secondary italic text-[11px] mt-0.5">
                  {e.context}
                </div>
              )}
            </div>
          ))}
          {entities.length > 20 && (
            <div className="text-[10px] text-content-dim text-center py-1">
              + {entities.length - 20} more…
            </div>
          )}
        </div>
      )}
    </TerminalCard>
  );
}
