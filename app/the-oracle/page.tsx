"use client";

/**
 * V FOR X — The Oracle
 *
 * Natural-language query engine over 200 countries × 28 dimensions.
 * Ask a question in plain English. Get an instant ranked answer.
 *
 * Two engines, both fully on-device:
 *   • EXACT  — heuristic pattern matching (instant, keyword + threshold).
 *   • SEMANTIC — a small transformer model (transformers.js, WASM/WebGPU)
 *     that embeds the 200×N matrix into a vector index and answers
 *     conceptual questions keyword matching cannot, e.g.
 *     "Which countries are most likely to tip into famine next year?"
 *
 * Privacy: your questions never leave this device. The model is a public
 * open-source artifact downloaded once and cached locally forever after.
 *
 * [44] THE ORACLE — Code: 44
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import {
  parseQuery,
  executeQuery,
  computeAverage,
  militaryVsHealth,
  EXAMPLE_QUERIES,
  METRICS,
  type ParsedQuery,
  type QueryResult,
} from "@/lib/oracle";
import {
  buildSemanticIndex,
  semanticSearch,
  semanticMetricThreshold,
  isConceptualQuery,
  SEMANTIC_EXAMPLE_QUERIES,
  type SemanticIndex,
  type SemanticSearchResult,
} from "@/lib/semantic-oracle";
import {
  isSemanticSupported,
  getEmbedder,
  detectBackend,
  resolveModel,
  SEMANTIC_MODELS,
  SEMANTIC_MODEL_ID,
  type EmbedderBackend,
  type SemanticModelInfo,
} from "@/lib/embeddings";
import { semanticIndexGet, semanticIndexPut } from "@/lib/idb";

const data = backbone as WorldBackbone;

type EngineState =
  | "unsupported"
  | "idle"
  | "loading"
  | "ready"
  | "error";

export default function TheOraclePage() {
  const [query, setQuery] = useState("");
  const [parsed, setParsed] = useState<ParsedQuery | null>(null);
  const [results, setResults] = useState<QueryResult[]>([]);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<string[]>([]);

  // ── Semantic engine state ──
  const [engineState, setEngineState] = useState<EngineState>(
    isSemanticSupported() ? "idle" : "unsupported"
  );
  const [progress, setProgress] = useState({ frac: 0, label: "" });
  const [backend, setBackend] = useState<EmbedderBackend | null>(null);
  const [semanticOn, setSemanticOn] = useState(true);
  const [semanticResult, setSemanticResult] = useState<SemanticSearchResult | null>(null);
  const [querying, setQuerying] = useState(false);
  const indexRef = useRef<SemanticIndex | null>(null);
  const embedRef = useRef<((t: string[]) => Promise<number[][]>) | null>(null);
  const initInFlight = useRef(false);

  // ── Embedding model (polyglot) ──
  // Default = English (fast, 23MB). Persisted so repeat visitors keep
  // their language choice; resolves through the registry, so an unknown
  // stored id degrades to the default without throwing.
  const [model, setModel] = useState<SemanticModelInfo>(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = window.localStorage.getItem("vfx-oracle-model");
        if (saved) return resolveModel(saved);
      }
    } catch {
      /* ignore */
    }
    return SEMANTIC_MODELS[0];
  });

  const supported = isSemanticSupported();
  const semanticReady = engineState === "ready" && indexRef.current && embedRef.current;

  // The multilingual model — its langs drive the language-hint line.
  const multilingual = SEMANTIC_MODELS.find((m) => m.id !== SEMANTIC_MODEL_ID)!;

  /* ═══════════════════════════════════════════════════════════════
     Engine bootstrap — download model + build (or load) the index
     ═══════════════════════════════════════════════════════════════ */
  const initEngine = useCallback(
    async (target: SemanticModelInfo = model) => {
      if (!supported || initInFlight.current) return;
      initInFlight.current = true;
      setEngineState("loading");
      setError("");
      try {
        setProgress({ frac: 0.01, label: "Booting on-device inference…" });
        const result = await getEmbedder((frac, label) =>
          setProgress({ frac, label }),
          target
        );
        if (!result) throw new Error("Inference unavailable in this browser.");
      const { embed, status } = result;
      embedRef.current = embed;
      setBackend(status.backend);

      const schemaVersion = data.metadata.schema_version;
      const lastUpdated = data.metadata.last_updated ?? data.metadata.created;
      // Cache key mirrors lib/semantic-oracle.indexCacheKey.
      const isoSig = data.countries.map((c) => c.iso3).join(",");
      const cacheKey = `${status.modelId}|${schemaVersion}|${lastUpdated}|${isoSig}`;

      // 1. Try the persisted vector cache (instant ready on repeat visits).
      const cached = await semanticIndexGet(cacheKey);
      if (
        cached &&
        cached.countryVectors.length === data.countries.length &&
        cached.metricVectors.length === METRICS.length
      ) {
        indexRef.current = {
          modelId: cached.modelId,
          dim: cached.dim,
          cacheKey,
          metrics: METRICS,
          countries: data.countries,
          metricVectors: cached.metricVectors,
          countryVectors: cached.countryVectors,
          metricStats: cached.metricStats,
        };
        setProgress({ frac: 1, label: "Semantic index loaded from cache." });
        setEngineState("ready");
        sound.success();
        return;
      }

      // 2. Build the index on-device (embed every country + metric).
      setProgress({ frac: 0.05, label: "Building semantic index…" });
      const index = await buildSemanticIndex(data.countries, METRICS, embed, {
        modelId: status.modelId,
        schemaVersion,
        lastUpdated,
        chunkSize: 24,
        onProgress: (frac, label) => setProgress({ frac, label }),
      });
      indexRef.current = index;

      // Persist for instant reuse.
      await semanticIndexPut({
        cacheKey,
        modelId: index.modelId,
        dim: index.dim,
        builtAt: Date.now(),
        metricVectors: index.metricVectors,
        countryVectors: index.countryVectors,
        metricStats: index.metricStats,
        metricIds: METRICS.map((m) => m.id),
        iso3s: data.countries.map((c) => c.iso3),
      });

      setEngineState("ready");
      sound.success();
    } catch (err) {
      setEngineState("error");
      setError(
        `// SEMANTIC ENGINE FAILED: ${err instanceof Error ? err.message : "unknown error"}. Falling back to exact keyword matching.` +
          (target.id !== SEMANTIC_MODEL_ID
            ? " // The multilingual model could not load in this browser — try the EN model."
            : "")
      );
      sound.error();
    } finally {
      initInFlight.current = false;
    }
  },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [supported, model]
);

  /** Switch embedding model: tear down the current embedder/index, then boot the new one. */
  const switchModel = useCallback(
    (m: SemanticModelInfo) => {
      if (m.id === model.id || initInFlight.current) return;
      embedRef.current = null;
      indexRef.current = null;
      setSemanticResult(null);
      setResults([]);
      setParsed(null);
      setError("");
      try {
        window.localStorage.setItem("vfx-oracle-model", m.id);
      } catch {
        /* ignore */
      }
      setModel(m);
      setEngineState("idle");
      initEngine(m);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, initEngine]
  );

  /* ═══════════════════════════════════════════════════════════════
     Query execution — routes between semantic and exact engines
     ═══════════════════════════════════════════════════════════════ */
  const runQuery = useCallback(
    async (q: string) => {
      if (!q.trim()) return;
      setError("");
      setSemanticResult(null);
      setQuery(q);
      sound.nav();

      // ── Semantic path ──
      if (semanticOn && semanticReady) {
        const embed = embedRef.current!;
        const index = indexRef.current!;
        setQuerying(true);
        try {
          const [queryVec] = await embed([q]);

          if (isConceptualQuery(q)) {
            // Conceptual/composite ranking.
            const res = semanticSearch(queryVec, index, { topK: 20 });
            if (res.results.length === 0) {
              setError("// NO COUNTRIES MATCH THIS QUERY.");
              sound.error();
            } else {
              setSemanticResult(res);
              setParsed(null);
              setResults([]);
              sound.success();
            }
          } else {
            // Threshold/rank query: semantic metric ID + exact numeric math.
            const hybrid = semanticMetricThreshold(queryVec, index, q);
            if (hybrid) {
              setParsed(hybrid.parsed);
              setResults(hybrid.results);
              sound.success();
            } else {
              runHeuristic(q);
            }
          }
        } catch {
          runHeuristic(q);
        } finally {
          setQuerying(false);
        }
        return;
      }

      runHeuristic(q);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [semanticOn, semanticReady]
  );

  /** The original keyword/threshold engine — always available. */
  const runHeuristic = (q: string) => {
    const lower = q.toLowerCase();
    if (
      (lower.includes("military") || lower.includes("defense")) &&
      (lower.includes("health") || lower.includes("healthcare")) &&
      (lower.includes("more") || lower.includes("than") || lower.includes("vs") || lower.includes("versus"))
    ) {
      const res = militaryVsHealth(data.countries);
      setResults(res);
      setSemanticResult(null);
      setParsed({
        metric: METRICS.find((m) => m.id === "military_pct_gdp")!,
        comparator: "list",
        raw: q,
        interpretation: `Countries spending more on military than healthcare (${res.length} found)`,
      });
      setHistory((h) => [q, ...h.filter((x) => x !== q)].slice(0, 5));
      sound.success();
      return;
    }

    const p = parseQuery(q);
    if (!p) {
      setError(
        "// COULD NOT PARSE QUERY. Try keywords like: hunger, military, poverty, life expectancy, child mortality, corruption..."
      );
      sound.error();
      return;
    }

    const res = executeQuery(p, data.countries);
    if (res.length === 0) {
      setError("// NO COUNTRIES MATCH THIS QUERY. Try different thresholds.");
      sound.error();
      return;
    }

    setParsed(p);
    setResults(res);
    setSemanticResult(null);
    setHistory((h) => [q, ...h.filter((x) => x !== q)].slice(0, 5));
    sound.success();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runQuery(query);
  };

  const formatValue = (val: number, metricId: string): string => {
    const metric = METRICS.find((m) => m.id === metricId);
    const unit = metric?.unit || "";
    if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B${unit ? ` ${unit}` : ""}`;
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M${unit ? ` ${unit}` : ""}`;
    if (val >= 1000 && !unit.includes("%") && metricId !== "gini")
      return `${val.toLocaleString()}${unit ? ` ${unit}` : ""}`;
    if (unit === "%") return `${val.toFixed(1)}%`;
    return `${val.toLocaleString()}${unit ? ` ${unit}` : ""}`;
  };

  const avg = useMemo(
    () => (parsed?.comparator === "avg" ? computeAverage(results) : null),
    [parsed, results]
  );

  const maxVal = useMemo(
    () => (results.length > 0 ? Math.max(...results.map((r) => r.value)) : 1),
    [results]
  );

  const examples = semanticReady ? SEMANTIC_EXAMPLE_QUERIES.slice(0, 6) : EXAMPLE_QUERIES.slice(0, 6);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="text-content-dim text-xs">
          [44] ON-DEVICE SEMANTIC QUERY ENGINE
        </div>
        <h1 className="text-blood-bright text-2xl font-bold tracking-widest mt-1">
          <span className="glitch" data-text="THE ORACLE">
            THE ORACLE
          </span>
        </h1>
        <p className="text-content-secondary text-sm mt-2 max-w-2xl">
          {
            "// Ask any question about 200 countries × 28 dimensions. On-device transformer model understands real language — your queries never leave this browser."
          }
        </p>
      </div>

      {/* Semantic engine control panel */}
      <TerminalCard
        title="// SEMANTIC ENGINE"
        accent={engineState === "ready" ? "green" : engineState === "error" ? "blood" : "amber"}
      >
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill state={engineState} backend={backend} />
          {engineState === "ready" && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-1 border text-[10px] font-bold tracking-widest"
              style={{
                borderColor: "var(--color-terminal-green)",
                color: "var(--color-terminal-green)",
              }}
            >
              INDEX READY — {model.label} ({model.dim}D)
            </span>
          )}
          {engineState === "idle" && (
            <button
              onClick={() => initEngine(model)}
              className="px-4 py-1.5 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-abyss transition-colors text-[10px] font-bold tracking-widest"
            >
              [ INITIALIZE ON-DEVICE MODEL ]
            </button>
          )}
          {engineState === "ready" && (
            <label className="flex items-center gap-2 cursor-pointer text-[10px] text-content-secondary select-none">
              <input
                type="checkbox"
                checked={semanticOn}
                onChange={(e) => setSemanticOn(e.target.checked)}
                className="accent-blood w-3 h-3"
              />
              <span className="tracking-widest uppercase">Semantic mode</span>
            </label>
          )}
          {engineState === "error" && (
            <button
              onClick={() => initEngine(model)}
              className="px-3 py-1 border border-blood text-blood-bright hover:bg-blood hover:text-abyss transition-colors text-[10px] font-bold tracking-widest"
            >
              [ RETRY ]
            </button>
          )}
          {engineState === "error" && model.id !== SEMANTIC_MODEL_ID && (
            <button
              onClick={() => switchModel(resolveModel(SEMANTIC_MODEL_ID))}
              className="px-3 py-1 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-abyss transition-colors text-[10px] font-bold tracking-widest"
            >
              [ TRY EN MODEL ]
            </button>
          )}
        </div>

        {engineState === "loading" && (
          <div className="mt-3">
            <div className="h-1.5 w-full bg-panel border border-border-dim overflow-hidden">
              <div
                className="h-full bg-terminal-green transition-all duration-200"
                style={{ width: `${Math.round(progress.frac * 100)}%` }}
              />
            </div>
            <div className="text-content-dim text-[10px] mt-1 font-mono">
              {Math.round(progress.frac * 100)}% — {progress.label}
            </div>
          </div>
        )}

        <div className="text-content-dim text-[10px] mt-3 leading-relaxed">
          {engineState === "unsupported"
            ? "// This browser cannot run on-device inference. Exact keyword matching is fully available."
            : "// A ~23MB open-source model (all-MiniLM-L6-v2) runs locally via " +
              (supported ? (detectBackend() === "webgpu" ? "WebGPU" : "WASM") : "—") +
              ". It downloads once, then is cached forever. Your questions are embedded on-device and compared against a local vector index — nothing is ever transmitted. This is the platform's privacy keystone."}
          {engineState !== "unsupported" && (
            <div className="mt-2">
              {
                "// The multilingual model ships the same privacy guarantee — inference and indexing stay in this browser. It is larger (~4-500MB downloaded once, cached forever)."
              }
            </div>
          )}
        </div>

        {/* Embedding model selector (polyglot) */}
        <div className="mt-3 pt-3 border-t border-border-dim/40">
          <div className="text-content-dim text-[10px] uppercase mb-1.5">
            EMBEDDING MODEL
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {SEMANTIC_MODELS.map((m) => {
              const active = m.id === model.id;
              return (
                <button
                  key={m.id}
                  onClick={() => switchModel(m)}
                  disabled={engineState === "loading" || initInFlight.current}
                  title={m.note}
                  className={
                    "px-3 py-1.5 border text-[10px] font-bold tracking-widest transition-colors disabled:opacity-40 " +
                    (active
                      ? "border-terminal-green text-terminal-green bg-terminal-green/10"
                      : "border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green")
                  }
                >
                  {m.label} · {m.sizeMB}MB · {m.dim}D
                </button>
              );
            })}
          </div>
          <div className="text-content-dim text-[10px] mt-2 leading-relaxed">
            {`Queries in: EN default • ${multilingual.langs
              .map((l) => l.toUpperCase())
              .join(" • ")} supported by the ML model`}
          </div>
        </div>
      </TerminalCard>

      {/* Search bar */}
      <TerminalCard title="// ASK THE ORACLE" glow>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                semanticReady
                  ? "// e.g. 'Which countries are most likely to tip into famine next year?'"
                  : "// e.g. 'Top 10 countries by military spending' or 'Countries where hunger > 30%'"
              }
              className="flex-1 bg-abyss border border-border-dim px-3 py-2 text-content-primary text-sm focus:border-blood outline-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={querying}
              className="px-6 py-2 border border-blood text-blood-bright hover:bg-blood hover:text-abyss transition-colors text-xs font-bold tracking-widest disabled:opacity-40"
            >
              {querying ? "[ … ]" : "[ QUERY ]"}
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-content-dim text-[10px]">
              {semanticReady ? "// TRY (SEMANTIC):" : "// TRY:"}
            </span>
            {examples.map((ex) => (
              <button
                key={ex}
                onClick={() => runQuery(ex)}
                className="text-[9px] px-2 py-0.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors"
              >
                {ex.length > 42 ? ex.slice(0, 42) + "…" : ex}
              </button>
            ))}
          </div>
        </form>
      </TerminalCard>

      {error && (
        <div className="border border-blood bg-blood/10 p-3 text-blood-bright text-xs">
          {error}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-content-dim text-[10px] uppercase">
            RECENT:
          </span>
          {history.map((h, i) => (
            <button
              key={i}
              onClick={() => runQuery(h)}
              className="text-[9px] text-content-dim hover:text-blood-bright transition-colors truncate max-w-[200px]"
            >
              [{i + 1}] {h.length > 30 ? h.slice(0, 30) + "…" : h}
            </button>
          ))}
        </div>
      )}

      {/* Semantic results */}
      {semanticResult && <SemanticResults result={semanticResult} />}

      {/* Heuristic / exact results */}
      {parsed && results.length > 0 && (
        <TerminalCard title={`// ${parsed.interpretation.toUpperCase()}`} glow>
          {avg !== null && (
            <div className="mb-4 p-3 border border-amber/40 bg-amber/5 text-center">
              <div className="text-content-dim text-[10px] uppercase">
                GLOBAL AVERAGE
              </div>
              <div className="text-amber text-xl font-bold">
                {formatValue(avg, parsed.metric.id)}
              </div>
            </div>
          )}

          <div className="space-y-1">
            {(parsed.comparator === "avg" ? results.slice(0, 50) : results).map(
              (r, i) => {
                const barPct =
                  parsed.comparator === "list"
                    ? Math.min((r.value / maxVal) * 100, 100)
                    : Math.min((r.value / maxVal) * 100, 100);
                return (
                  <div
                    key={r.country.iso3}
                    className="flex items-center gap-2 py-1 border-b border-border-dim/30 last:border-0 hover:bg-panel/50 transition-colors"
                  >
                    <span className="text-content-dim text-[10px] w-6 text-right shrink-0">
                      {r.rank || i + 1}.
                    </span>
                    <span className="text-content-primary text-xs font-bold w-28 shrink-0 truncate">
                      {r.country.name_en}
                    </span>
                    <span className="text-content-dim text-[9px] w-8 shrink-0">
                      {r.country.iso3}
                    </span>
                    <div className="flex-1 min-w-[40px]">
                      <div
                        className="h-2"
                        style={{
                          width: `${Math.max(barPct, 2)}%`,
                          background:
                            parsed.comparator === "list"
                              ? "var(--color-blood)"
                              : parsed.metric.higherIsCrisis
                                ? "var(--color-blood)"
                                : "var(--color-terminal-green)",
                          opacity: 0.7,
                        }}
                      />
                    </div>
                    <span
                      className="text-xs font-bold w-24 text-right shrink-0"
                      style={{
                        color:
                          parsed.comparator === "list"
                            ? "var(--color-blood-bright)"
                            : parsed.metric.higherIsCrisis
                              ? "var(--color-blood-bright)"
                              : "var(--color-terminal-green)",
                      }}
                    >
                      {parsed.comparator === "list"
                        ? `${r.value.toFixed(1)}×`
                        : formatValue(r.value, parsed.metric.id)}
                    </span>
                  </div>
                );
              }
            )}
          </div>

          {parsed.comparator === "list" && (
            <div className="text-content-dim text-[10px] mt-3 pt-2 border-t border-border-dim">
              {
                "// Ratio = military expenditure ÷ total healthcare expenditure. Values > 1× mean the country spends more on weapons than health."
              }
            </div>
          )}
        </TerminalCard>
      )}

      {/* Available metrics */}
      <TerminalCard title="// QUERYABLE METRICS" accent="amber">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {METRICS.map((m) => (
            <div
              key={m.id}
              className="border border-border-dim p-2 text-center"
            >
              <div className="text-content-primary text-[10px] font-bold">
                {m.label}
              </div>
              <div className="text-content-dim text-[9px]">{m.unit}</div>
            </div>
          ))}
        </div>
        <div className="text-content-dim text-[10px] mt-3">
          {`// ${METRICS.length} metrics available across ${data.countries.length} countries.`}
        </div>
      </TerminalCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════ */

function StatusPill({
  state,
  backend,
}: {
  state: EngineState;
  backend: EmbedderBackend | null;
}) {
  const map: Record<EngineState, { label: string; color: string }> = {
    unsupported: { label: "UNAVAILABLE", color: "var(--color-content-dim)" },
    idle: { label: "OFF", color: "var(--color-content-dim)" },
    loading: { label: "LOADING", color: "var(--color-warning-amber)" },
    ready: {
      label: `READY · ${(backend ?? "wasm").toUpperCase()}`,
      color: "var(--color-terminal-green)",
    },
    error: { label: "ERROR", color: "var(--color-blood-bright)" },
  };
  const s = map[state];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 border text-[10px] font-bold tracking-widest"
      style={{ borderColor: s.color, color: s.color }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: s.color }}
      />
      {s.label}
    </span>
  );
}

function SemanticResults({ result }: { result: SemanticSearchResult }) {
  const maxScore = result.results[0]?.score || 1;
  return (
    <TerminalCard
      title={`// ${result.interpretation.toUpperCase()}`}
      glow
      accent="green"
    >
      {/* Metric explainability */}
      <div className="mb-4 pb-3 border-b border-border-dim">
        <div className="text-content-dim text-[10px] uppercase mb-2">
          Relevance across {result.metricWeights.length} dimensions
        </div>
        <div className="flex flex-wrap gap-1.5">
          {result.metricWeights.slice(0, 6).map((c) => (
            <span
              key={c.metric.id}
              className="text-[9px] px-1.5 py-0.5 border"
              style={{
                borderColor: "var(--color-terminal-green)",
                color: "var(--color-terminal-green)",
                opacity: 0.4 + 0.6 * c.weight,
              }}
              title={`${c.metric.label} — ${(c.weight * 100).toFixed(0)}% weight`}
            >
              {c.metric.label}
            </span>
          ))}
        </div>
      </div>

      {/* Ranked countries */}
      <div className="space-y-1">
        {result.results.map((r) => {
          const pct = Math.min((r.score / maxScore) * 100, 100);
          return (
            <div
              key={r.country.iso3}
              className="py-1.5 border-b border-border-dim/30 last:border-0 hover:bg-panel/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-content-dim text-[10px] w-6 text-right shrink-0">
                  {r.rank}.
                </span>
                <span className="text-content-primary text-xs font-bold w-28 shrink-0 truncate">
                  {r.country.name_en}
                </span>
                <span className="text-content-dim text-[9px] w-8 shrink-0">
                  {r.country.iso3}
                </span>
                <div className="flex-1 min-w-[40px]">
                  <div
                    className="h-2"
                    style={{
                      width: `${Math.max(pct, 2)}%`,
                      background: "var(--color-terminal-green)",
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span
                  className="text-xs font-bold w-16 text-right shrink-0"
                  style={{ color: "var(--color-terminal-green)" }}
                >
                  {(r.score * 100).toFixed(0)}
                </span>
              </div>
              {/* Per-country contributing metrics */}
              {r.topMetrics.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1 ml-[36px]">
                  {r.topMetrics.map((m, i) => (
                    <span
                      key={i}
                      className="text-[8px] text-content-dim"
                      title={`${m.metric.label}: ${m.rawValue.toFixed(1)}${m.metric.unit}`}
                    >
                      {m.metric.label.split(" ")[0]}·
                      <span style={{ color: "var(--color-blood-bright)" }}>
                        {(m.normalizedValue * 100).toFixed(0)}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-content-dim text-[10px] mt-3 pt-2 border-t border-border-dim leading-relaxed">
        {
          "// Score blends a direction-normalized composite across the query's most relevant metrics (80%) with direct query↔country semantic similarity (20%). Each row shows its strongest contributing dimensions. Computed entirely on-device."
        }
      </div>
    </TerminalCard>
  );
}
