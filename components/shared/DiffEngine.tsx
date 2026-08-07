"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import { computeDiff, type DiffResult } from "@/lib/diff";

const currentData = backbone as WorldBackbone;

export default function DiffEngine() {
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "worse" | "better">("all");
  const [minSeverity, setMinSeverity] = useState<"all" | "notable" | "critical">("all");

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const text = await file.text();
      const oldBackbone = JSON.parse(text);
      const result = computeDiff(oldBackbone, {
        metadata: currentData.metadata,
        countries: currentData.countries as unknown as Record<string, unknown>[],
      } as unknown as Parameters<typeof computeDiff>[1]);
      setDiff(result);
      sound.success();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse file");
      sound.error();
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredChanges = (() => {
    if (!diff) return [];
    let result = diff.topChanges;
    if (filter !== "all") result = result.filter((c) => c.direction === filter);
    if (minSeverity === "notable") result = result.filter((c) => c.severity === "notable" || c.severity === "critical");
    if (minSeverity === "critical") result = result.filter((c) => c.severity === "critical");
    return result.slice(0, 50);
  })();

  return (
    <TerminalCard title="DATA DIFF ENGINE — WHAT CHANGED" accent="blood" glow className="mb-6">
      <p className="text-xs text-content-secondary mb-4">
        // upload a previous data snapshot (world_backbone_*.json) to see exactly
        what changed. which countries got worse. which improved. who crossed a famine threshold.
      </p>

      {!diff && !loading && (
        <div
          className="border-2 border-dashed border-border-dim p-8 text-center hover:border-blood transition-colors cursor-pointer"
          onClick={() => {
            const input = document.getElementById("diff-file-input") as HTMLInputElement | null;
            input?.click();
          }}
        >
          <div className="text-2xl mb-2 text-content-dim">📂</div>
          <div className="text-xs text-content-secondary mb-1">
            Click to upload a snapshot JSON file
          </div>
          <div className="text-[10px] text-content-dim">
            or drag and drop a world_backbone_*.json file here
          </div>
          <input
            id="diff-file-input"
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      )}

      {loading && (
        <div className="text-xs text-content-dim animate-pulse text-center py-6">
          ▒▒▒ Computing diff across {currentData.metadata.total_countries} countries… ▒▒▒
        </div>
      )}

      {error && (
        <div className="text-xs text-blood-bright border border-blood p-3">
          ERROR: {error}
        </div>
      )}

      {diff && (
        <div className="space-y-4">
          {/* Summary banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="border border-border-dim bg-void p-3 text-center">
              <div className="text-2xl font-bold text-content-primary">
                {diff.totalChanges}
              </div>
              <div className="text-[10px] text-content-dim uppercase">Total Changes</div>
            </div>
            <div className="border border-blood bg-blood/5 p-3 text-center">
              <div className="text-2xl font-bold text-blood-bright">
                {diff.worsened}
              </div>
              <div className="text-[10px] text-content-dim uppercase">Worsened</div>
            </div>
            <div className="border border-terminal-green bg-terminal-green/5 p-3 text-center">
              <div className="text-2xl font-bold text-terminal-green">
                {diff.improved}
              </div>
              <div className="text-[10px] text-content-dim uppercase">Improved</div>
            </div>
            <div className="border border-warning-amber bg-warning-amber/5 p-3 text-center">
              <div className="text-2xl font-bold text-warning-amber">
                {diff.thresholdCrossings.length}
              </div>
              <div className="text-[10px] text-content-dim uppercase">Threshold Crossed</div>
            </div>
          </div>

          {/* Date range */}
          <div className="text-[10px] text-content-dim text-center">
            Comparing {diff.oldDate} → {diff.newDate} · {diff.summary.oldTotalCountries} → {diff.summary.newTotalCountries} countries
          </div>

          {/* Threshold crossings — the most alarming changes */}
          {diff.thresholdCrossings.length > 0 && (
            <div>
              <div className="text-[10px] text-blood-bright uppercase tracking-widest mb-2">
                ⚠ THRESHOLD CROSSINGS
              </div>
              <div className="space-y-1">
                {diff.thresholdCrossings.slice(0, 15).map((c, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 p-2 border ${
                      c.direction === "worse" ? "border-blood bg-blood/5" : "border-terminal-green bg-terminal-green/5"
                    }`}
                  >
                    <StatusPill color={c.direction === "worse" ? "blood" : "green"}>
                      {c.direction === "worse" ? "↓ WORSE" : "↑ BETTER"}
                    </StatusPill>
                    <Link
                      href={`/sorrow-map/${c.iso3.toLowerCase()}/`}
                      className="text-xs text-content-primary font-bold hover:text-blood-bright"
                    >
                      {c.countryName}
                    </Link>
                    <span className="text-[10px] text-content-secondary flex-1">
                      {c.label}: <span className="font-mono">{c.oldValue}</span> → <span className="font-mono">{c.newValue}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New/removed countries */}
          {(diff.newCountries.length > 0 || diff.removedCountries.length > 0) && (
            <div className="flex gap-4 flex-wrap">
              {diff.newCountries.length > 0 && (
                <div>
                  <span className="text-[10px] text-terminal-green uppercase">Added:</span>
                  <span className="text-xs text-content-secondary ml-2">
                    {diff.newCountries.map((c) => c.iso3).join(", ")}
                  </span>
                </div>
              )}
              {diff.removedCountries.length > 0 && (
                <div>
                  <span className="text-[10px] text-blood-bright uppercase">Removed:</span>
                  <span className="text-xs text-content-secondary ml-2">
                    {diff.removedCountries.map((c) => c.iso3).join(", ")}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-dim">
            <span className="text-[10px] text-content-dim uppercase">Filter:</span>
            {([
              { key: "all", label: "ALL" },
              { key: "worse", label: "↓ WORSENED" },
              { key: "better", label: "↑ IMPROVED" },
            ] as const).map((f) => (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); sound.select(); }}
                className={`text-[10px] px-2 py-0.5 border transition-colors ${
                  filter === f.key
                    ? f.key === "worse"
                      ? "border-blood text-blood-bright"
                      : f.key === "better"
                        ? "border-terminal-green text-terminal-green"
                        : "border-content-primary text-content-primary"
                    : "border-border-dim text-content-dim hover:border-blood-dim"
                }`}
              >
                {f.label}
              </button>
            ))}
            <span className="text-[10px] text-content-dim uppercase ml-2">Severity:</span>
            {([
              { key: "all", label: "ALL" },
              { key: "notable", label: "NOTABLE+" },
              { key: "critical", label: "CRITICAL ONLY" },
            ] as const).map((s) => (
              <button
                key={s.key}
                onClick={() => { setMinSeverity(s.key); sound.select(); }}
                className={`text-[10px] px-2 py-0.5 border transition-colors ${
                  minSeverity === s.key
                    ? "border-blood text-blood-bright"
                    : "border-border-dim text-content-dim hover:border-blood-dim"
                }`}
              >
                {s.label}
              </button>
            ))}
            <button
              onClick={() => { setDiff(null); sound.select(); }}
              className="text-[10px] px-2 py-0.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright ml-auto"
            >
              ✕ NEW DIFF
            </button>
          </div>

          {/* Changes list */}
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {filteredChanges.length === 0 ? (
              <div className="text-xs text-content-dim text-center py-4">
                No changes match the current filter.
              </div>
            ) : (
              filteredChanges.map((c, i) => {
                const sevColor =
                  c.direction === "worse"
                    ? c.severity === "critical" ? "var(--color-blood)" : "var(--color-warning-amber)"
                    : "var(--color-terminal-green)";
                return (
                  <div key={i} className="flex items-center gap-2 p-1.5 border border-border-dim/50 hover:bg-panel/30">
                    <Link
                      href={`/sorrow-map/${c.iso3.toLowerCase()}/`}
                      className="text-[10px] text-content-dim font-mono hover:text-blood-bright w-10"
                    >
                      {c.iso3}
                    </Link>
                    <span className="text-[10px] text-content-primary w-28 truncate">{c.countryName}</span>
                    <span className="text-[10px] text-content-secondary w-32 truncate hidden sm:inline">{c.label}</span>
                    <span className="text-[10px] font-mono text-content-dim">
                      {c.oldValue ?? "—"} → {c.newValue ?? "—"}
                    </span>
                    {c.delta !== null && (
                      <span className="text-[10px] font-mono font-bold" style={{ color: sevColor }}>
                        {c.delta > 0 ? "+" : ""}{c.delta.toFixed(c.path.includes("famine") || c.path.includes("conflict") ? 1 : 2)}
                        {c.pctChange !== null && (
                          <span className="text-content-dim ml-1">
                            ({c.pctChange > 0 ? "+" : ""}{c.pctChange.toFixed(0)}%)
                          </span>
                        )}
                      </span>
                    )}
                    <StatusPill color={c.direction === "worse" ? (c.severity === "critical" ? "blood" : "amber") : "green"}>
                      {c.direction === "worse" ? "↓" : "↑"} {c.severity.toUpperCase()}
                    </StatusPill>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* How to create snapshots */}
      <div className="mt-4 border-t border-border-dim pt-3 text-[10px] text-content-dim">
        <div className="text-content-dim uppercase tracking-widest mb-1">HOW TO USE:</div>
        <div>1. Before a data update, save a snapshot: <code className="text-blood-bright">python3 scripts/snapshot.py save</code></div>
        <div>2. Update the backbone data</div>
        <div>3. Upload the old snapshot above to see what changed</div>
        <div>List snapshots: <code className="text-blood-bright">python3 scripts/snapshot.py list</code></div>
      </div>
    </TerminalCard>
  );
}
