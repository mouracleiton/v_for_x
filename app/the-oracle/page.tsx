"use client";

/**
 * V FOR X — The Oracle
 *
 * Natural-language query engine over 200 countries × 24 dimensions.
 * Ask a question in plain English. Get an instant ranked answer.
 * No API calls, no AI service — pure client-side pattern matching.
 *
 * [44] THE ORACLE — Code: 44
 */

import { useState, useMemo, useCallback } from "react";
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

const data = backbone as WorldBackbone;

export default function TheOraclePage() {
  const [query, setQuery] = useState("");
  const [parsed, setParsed] = useState<ParsedQuery | null>(null);
  const [results, setResults] = useState<QueryResult[]>([]);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<string[]>([]);

  const runQuery = useCallback(
    (q: string) => {
      if (!q.trim()) return;
      setError("");

      // Special case: military vs health
      const lower = q.toLowerCase();
      if (
        (lower.includes("military") || lower.includes("defense")) &&
        (lower.includes("health") || lower.includes("healthcare")) &&
        (lower.includes("more") || lower.includes("than") || lower.includes("vs") || lower.includes("versus"))
      ) {
        const res = militaryVsHealth(data.countries);
        setResults(res);
        setParsed({
          metric: METRICS.find((m) => m.id === "military_pct_gdp")!,
          comparator: "list",
          raw: q,
          interpretation: `Countries spending more on military than healthcare (${res.length} found)`,
        });
        setHistory((h) => [q, ...h.filter((x) => x !== q)].slice(0, 5));
        setQuery(q);
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
      setHistory((h) => [q, ...h.filter((x) => x !== q)].slice(0, 5));
      setQuery(q);
      sound.success();
    },
    []
  );

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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="text-content-dim text-xs">
          [44] NATURAL-LANGUAGE QUERY ENGINE
        </div>
        <h1 className="text-blood-bright text-2xl font-bold tracking-widest mt-1">
          <span className="glitch" data-text="THE ORACLE">
            THE ORACLE
          </span>
        </h1>
        <p className="text-content-secondary text-sm mt-2 max-w-2xl">
          {
            "// Ask any question about 200 countries × 24 dimensions. No API calls. No tracking. Pure client-side parsing."
          }
        </p>
      </div>

      {/* Search bar */}
      <TerminalCard title="// ASK THE ORACLE" glow>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="// e.g. 'Top 10 countries by military spending' or 'Countries where hunger > 30%'"
              className="flex-1 bg-abyss border border-border-dim px-3 py-2 text-content-primary text-sm focus:border-blood outline-none"
              autoFocus
            />
            <button
              type="submit"
              className="px-6 py-2 border border-blood text-blood-bright hover:bg-blood hover:text-abyss transition-colors text-xs font-bold tracking-widest"
            >
              [ QUERY ]
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-content-dim text-[10px]">// TRY:</span>
            {EXAMPLE_QUERIES.slice(0, 6).map((ex) => (
              <button
                key={ex}
                onClick={() => runQuery(ex)}
                className="text-[9px] px-2 py-0.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors"
              >
                {ex}
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

      {/* Results */}
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
