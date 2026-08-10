"use client";

/**
 * V FOR X — The Analyzer
 *
 * Drop or paste a document and get a client-side triage: red-flag terms
 * (shell companies, sanctions, corruption, human rights, environmental),
 * country mentions linked to V FOR X dossiers, a rough sentiment score,
 * and the most frequent meaningful phrases. No text leaves the browser.
 */

import { useCallback, useMemo, useState } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import {
  analyzeDocument,
  extractTextFromPDF,
  formatAnalysisReport,
  type AnalysisResult,
  type RedFlagSeverity,
} from "@/lib/doc-analyzer";
import { downloadFile } from "@/lib/export-utils";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

const SEVERITY_META: Record<
  RedFlagSeverity,
  { color: "blood" | "amber" | "green"; label: string }
> = {
  critical: { color: "blood", label: "CRITICAL" },
  warning: { color: "amber", label: "WARNING" },
  info: { color: "green", label: "INFO" },
};

function sentimentColor(score: number): string {
  if (score <= -50) return "var(--color-blood-bright)";
  if (score <= -15) return "var(--color-warning-amber)";
  if (score < 15) return "var(--color-content-secondary)";
  return "var(--color-terminal-green)";
}

function sentimentLabel(score: number): string {
  if (score <= -50) return "STRONGLY NEGATIVE";
  if (score <= -15) return "NEGATIVE";
  if (score < 15) return "NEUTRAL";
  if (score < 50) return "POSITIVE";
  return "STRONGLY POSITIVE";
}

/* ═══════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════ */

export default function TheAnalyzerPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const runAnalysis = useCallback((input: string) => {
    setNote(null);
    if (!input.trim()) {
      setResult(null);
      setNote("Nothing to analyze — paste or drop some text first.");
      return;
    }
    setResult(analyzeDocument(input));
  }, []);

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
            setResult(null);
          } else {
            runAnalysis(extracted);
          }
        } else if (
          name.endsWith(".txt") ||
          name.endsWith(".md") ||
          file.type.startsWith("text/")
        ) {
          const content = await file.text();
          setText(content);
          runAnalysis(content);
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
    () => (result ? formatAnalysisReport(result) : ""),
    [result],
  );

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* ── Header ── */}
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-blood-bright glow-blood">
          The Analyzer
        </h1>
        <p className="text-content-secondary mt-2 text-sm max-w-3xl">
          Drop a document (.txt, .md, .pdf) or paste text. Get an instant triage: red-flag
          terms, country mentions, sentiment, and key phrases. Everything runs in your
          browser — no text is uploaded anywhere.
        </p>
      </header>

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
              placeholder="Paste press releases, contracts, filings, NGO reports, leaked documents…"
              className="w-full bg-void border border-border-dim p-2 text-sm text-content-primary outline-none focus:border-command font-mono"
              style={{ height: 220, resize: "vertical" }}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-content-dim">
                {text.trim() ? text.trim().split(/\s+/).length.toLocaleString() : 0} words
              </span>
              <button
                onClick={() => runAnalysis(text)}
                disabled={busy}
                className="px-4 py-2 text-xs uppercase tracking-widest border transition-colors disabled:opacity-50"
                style={{
                  borderColor: "var(--color-blood-bright)",
                  color: "var(--color-blood-bright)",
                  background: "rgba(226,56,86,0.08)",
                }}
              >
                ▶ Analyze
              </button>
            </div>
          </TerminalCard>
        </div>

        {/* ═══ RIGHT: RESULTS ═══ */}
        <div className="space-y-4">
          {!result ? (
            <TerminalCard title="results" accent="blood">
              <div className="text-sm text-content-dim py-16 text-center">
                Results will appear here after analysis.
              </div>
            </TerminalCard>
          ) : (
            <>
              {/* Summary scorecard */}
              <TerminalCard title="summary" accent="blood">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="border border-border-dim p-2">
                    <div className="text-content-dim">Word count</div>
                    <div className="text-content-primary text-lg font-bold">
                      {result.wordCount.toLocaleString()}
                    </div>
                  </div>
                  <div className="border border-border-dim p-2">
                    <div className="text-content-dim">Sentiment</div>
                    <div
                      className="text-lg font-bold"
                      style={{ color: sentimentColor(result.sentimentScore) }}
                    >
                      {result.sentimentScore > 0 ? "+" : ""}
                      {result.sentimentScore}
                    </div>
                    <div className="text-[10px]" style={{ color: sentimentColor(result.sentimentScore) }}>
                      {sentimentLabel(result.sentimentScore)}
                    </div>
                  </div>
                  <div className="border border-border-dim p-2">
                    <div className="text-content-dim">Red flags</div>
                    <div className="text-blood-bright text-lg font-bold">
                      {result.redFlags.length}
                    </div>
                  </div>
                  <div className="border border-border-dim p-2">
                    <div className="text-content-dim">Countries</div>
                    <div className="text-command-bright text-lg font-bold">
                      {result.countryMentions.length}
                    </div>
                  </div>
                </div>

                {/* Key phrases */}
                {result.keyPhrases.length > 0 && (
                  <div className="mt-3">
                    <div className="text-content-dim text-xs mb-1">Key phrases</div>
                    <div className="flex flex-wrap gap-1.5">
                      {result.keyPhrases.map((p) => (
                        <span
                          key={p}
                          className="inline-pill text-[10px] px-2 py-0.5 border border-border-bright text-content-secondary"
                          style={{ background: "var(--color-panel-hi)" }}
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => downloadFile("vforx-analysis-report.txt", report, "text/plain")}
                  className="mt-3 w-full px-3 py-2 text-xs uppercase tracking-widest border border-command text-command-bright hover:bg-panel-hi"
                >
                  ⤓ Download Report
                </button>
              </TerminalCard>

              {/* Red flags */}
              <TerminalCard title={`red flags (${result.redFlags.length})`} accent="amber">
                {result.redFlags.length === 0 ? (
                  <p className="text-sm text-content-dim py-4 text-center">
                    No red-flag terms detected.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {(["critical", "warning", "info"] as RedFlagSeverity[]).map((sev) => {
                      const flags = result.redFlags.filter((f) => f.severity === sev);
                      if (!flags.length) return null;
                      return (
                        <div key={sev}>
                          <div className="mb-1">
                            <StatusPill color={SEVERITY_META[sev].color}>
                              {SEVERITY_META[sev].label} ({flags.length})
                            </StatusPill>
                          </div>
                          {flags.map((f, i) => (
                            <div
                              key={`${f.term}-${i}`}
                              className="text-xs border-l-2 pl-2 py-1 mb-1"
                              style={{
                                borderColor:
                                  sev === "critical"
                                    ? "var(--color-blood)"
                                    : sev === "warning"
                                      ? "var(--color-warning-amber)"
                                      : "var(--color-terminal-green)",
                              }}
                            >
                              <span className="text-content-primary font-bold">{f.term}</span>{" "}
                              <span className="text-content-dim">[{f.category}]</span>
                              <div className="text-content-secondary italic">{f.context}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TerminalCard>

              {/* Country mentions */}
              <TerminalCard
                title={`country mentions (${result.countryMentions.length})`}
                accent="green"
              >
                {result.countryMentions.length === 0 ? (
                  <p className="text-sm text-content-dim py-4 text-center">
                    No tracked countries detected.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-56 overflow-y-auto">
                    {result.countryMentions.map((cm) => (
                      <a
                        key={cm.iso3}
                        href={`${BASE}/sorrow-map/${cm.iso3.toLowerCase()}/`}
                        className="flex items-center justify-between text-xs py-1 px-2 border border-transparent hover:border-border-bright hover:bg-panel-hi"
                      >
                        <span className="text-command-bright">
                          {cm.name}{" "}
                          <span className="text-content-dim">{cm.iso3}</span>
                        </span>
                        <span className="text-content-secondary tabular-nums">×{cm.count}</span>
                      </a>
                    ))}
                  </div>
                )}
              </TerminalCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
