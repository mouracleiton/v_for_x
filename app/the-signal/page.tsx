"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, CountryData } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import DataBar from "@/components/ui/DataBar";
import {
  watchlistGetAll,
  watchlistAdd,
  watchlistRemove,
  type WatchlistEntry,
} from "@/lib/idb";
import { sound } from "@/lib/sound";

const data = backbone as WorldBackbone;

/* ═══ HELPERS ═══ */

type ThreatLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

const threatMeta: Record<
  ThreatLevel,
  { color: "green" | "amber" | "blood"; glow?: "green" | "amber" | "blood"; label: string }
> = {
  LOW: { color: "green", glow: "green", label: "Stable. Monitor for escalation." },
  MODERATE: { color: "amber", glow: "amber", label: "Elevated risk. Conditions deteriorating." },
  HIGH: { color: "blood", glow: "blood", label: "Severe conditions. Immediate attention required." },
  CRITICAL: { color: "blood", glow: "blood", label: "Critical. Catastrophic conditions present." },
};

/** Severity score used to rank watched countries for alerts / threat level. */
function countrySeverity(c: CountryData): number {
  let score = 0;
  const famine = c.hunger.famine_risk_1to5 ?? 0;
  const conflict = c.conflict.intensity_1to5 ?? 0;
  const under = c.hunger.undernourishment_pct ?? 0;
  score += famine * 25; // up to 125
  score += conflict * 18; // up to 90
  score += under * 0.8; // up to ~80
  if (c.hunger.ipc_phase5) score += 50;
  return score;
}

/** Derive overall threat level from the worst conditions on the watchlist. */
function computeThreat(countries: CountryData[]): ThreatLevel {
  if (countries.length === 0) return "LOW";
  let maxFamine = 0;
  let maxConflict = 0;
  let maxUnder = 0;
  let hasPhase5 = false;
  for (const c of countries) {
    maxFamine = Math.max(maxFamine, c.hunger.famine_risk_1to5 ?? 0);
    maxConflict = Math.max(maxConflict, c.conflict.intensity_1to5 ?? 0);
    maxUnder = Math.max(maxUnder, c.hunger.undernourishment_pct ?? 0);
    if (c.hunger.ipc_phase5) hasPhase5 = true;
  }
  if (hasPhase5 || maxFamine >= 4 || maxConflict >= 4 || maxUnder >= 40) return "CRITICAL";
  if (maxFamine >= 3 || maxConflict >= 3 || maxUnder >= 20) return "HIGH";
  if (maxFamine >= 2 || maxConflict >= 2 || maxUnder >= 10) return "MODERATE";
  return "LOW";
}

/* ═══ COMPONENT ═══ */

export default function TheSignalPage() {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);

  /* ── Load watchlist from IndexedDB on mount ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const entries = await watchlistGetAll();
        if (!cancelled) setWatchlist(entries);
      } catch {
        /* IndexedDB unavailable — leave empty */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Derived data: resolve watched entries to full country records ── */
  const watchedCountries = useMemo<CountryData[]>(() => {
    return watchlist
      .map((w) => data.countries.find((c) => c.iso3 === w.iso3))
      .filter((c): c is CountryData => !!c);
  }, [watchlist]);

  const watchedIsoSet = useMemo(
    () => new Set(watchlist.map((w) => w.iso3)),
    [watchlist]
  );

  /* ── Search filtering for the add-country dropdown ── */
  const searchResults = useMemo<CountryData[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return data.countries
      .filter(
        (c) =>
          c.name_en.toLowerCase().includes(q) ||
          c.iso3.toLowerCase().includes(q) ||
          c.name_pt.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [search]);

  /* ── Handlers ── */
  async function handleAdd(country: CountryData) {
    try {
      await watchlistAdd({
        iso3: country.iso3,
        name: country.name_en,
        addedAt: Date.now(),
      });
      const entries = await watchlistGetAll();
      setWatchlist(entries);
      setSearch("");
      setShowResults(false);
      sound.success();
    } catch {
      sound.error();
    }
  }

  async function handleAddByIso(iso3: string) {
    const country = data.countries.find((c) => c.iso3 === iso3);
    if (!country) {
      sound.error();
      return;
    }
    await handleAdd(country);
  }

  async function handleRemove(iso3: string) {
    try {
      await watchlistRemove(iso3);
      const entries = await watchlistGetAll();
      setWatchlist(entries);
      sound.select();
    } catch {
      sound.error();
    }
  }

  /* ── Aggregate stats for the summary dashboard ── */
  const stats = useMemo(() => {
    if (watchedCountries.length === 0) return null;
    const hotspots = watchedCountries.filter((c) => c.is_hotspot).length;
    const underVals = watchedCountries
      .map((c) => c.hunger.undernourishment_pct)
      .filter((v): v is number => v != null);
    const avgUnder =
      underVals.length > 0
        ? underVals.reduce((a, b) => a + b, 0) / underVals.length
        : null;
    const maxConflict = Math.max(
      ...watchedCountries.map((c) => c.conflict.intensity_1to5 ?? 0)
    );
    const famineRiskGte3 = watchedCountries.filter(
      (c) => (c.hunger.famine_risk_1to5 ?? 0) >= 3
    ).length;
    const phase5 = watchedCountries.filter((c) => c.hunger.ipc_phase5).length;
    return {
      total: watchedCountries.length,
      hotspots,
      avgUnder,
      maxConflict,
      famineRiskGte3,
      phase5,
    };
  }, [watchedCountries]);

  /* ── Alert summary: top 3 most critical ── */
  const topAlerts = useMemo(() => {
    return [...watchedCountries]
      .sort((a, b) => countrySeverity(b) - countrySeverity(a))
      .slice(0, 3);
  }, [watchedCountries]);

  const threat = computeThreat(watchedCountries);
  const threatInfo = threatMeta[threat];

  /* ═══ RENDER ═══ */
  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      {/* ── HEADER ── */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[11] THE SIGNAL</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          THE SIGNAL
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // Pin countries. Track conditions. Never lose sight of a crisis.
        </p>
      </div>

      {loading ? (
        <TerminalCard title="ESTABLISHING UPLINK…" glow>
          <div className="text-xs text-content-dim animate-pulse">
            {" "}
            ▒▒▒ Loading watchlist from local store… ▒▒▒{" "}
          </div>
        </TerminalCard>
      ) : (
        <>
          {/* ═══ SECTION 1 — WATCHLIST SUMMARY DASHBOARD ═══ */}
          {stats ? (
            <TerminalCard
              title="WATCHLIST SUMMARY"
              glow
              accent={threat === "LOW" ? "green" : threat === "MODERATE" ? "amber" : "blood"}
              className="mb-6"
            >
              {/* Threat level banner */}
              <div className="flex items-center gap-3 mb-4 p-3 border border-border-dim bg-void">
                <span className="text-xs text-content-dim uppercase tracking-widest">
                  Threat Level
                </span>
                <StatusPill color={threatInfo.color}>{threat}</StatusPill>
                <span className="text-xs text-content-secondary ml-auto">
                  {threatInfo.label}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatTile label="Watched" value={String(stats.total)} />
                <StatTile
                  label="Hotspots"
                  value={String(stats.hotspots)}
                  tone={stats.hotspots > 0 ? "blood" : "dim"}
                />
                <StatTile
                  label="Avg Under-nourish"
                  value={stats.avgUnder != null ? `${stats.avgUnder.toFixed(1)}%` : "N/A"}
                  tone={stats.avgUnder != null && stats.avgUnder > 20 ? "blood" : "dim"}
                />
                <StatTile
                  label="Max Conflict"
                  value={`${stats.maxConflict}/5`}
                  tone={stats.maxConflict >= 3 ? "blood" : "dim"}
                />
                <StatTile
                  label="Famine Risk ≥3"
                  value={String(stats.famineRiskGte3)}
                  tone={stats.famineRiskGte3 > 0 ? "blood" : "dim"}
                />
              </div>

              {stats.phase5 > 0 && (
                <div className="mt-3 text-xs text-blood-bright">
                  ⚠ {stats.phase5} watched {stats.phase5 === 1 ? "country" : "countries"}{" "}
                  at IPC Phase 5 (catastrophe/famine).
                </div>
              )}
            </TerminalCard>
          ) : (
            <TerminalCard
              title="WATCHLIST EMPTY"
              accent="amber"
              glow
              className="mb-6"
            >
              <div className="text-sm text-content-secondary mb-2">
                No countries pinned. Your watchlist is the early-warning layer —
                pin crisis zones to track conditions at a glance.
              </div>
              <div className="text-xs text-content-dim">
                ↓ Use the console below to add countries. Quick-add buttons for
                all 22 WFP hotspots are standing by.
              </div>
            </TerminalCard>
          )}

          {/* ═══ SECTION 2 — ADD COUNTRY ═══ */}
          <TerminalCard
            title="ADD COUNTRY"
            accent="green"
            className="mb-6"
          >
            {/* Searchable dropdown */}
            <div className="mb-4">
              <label className="text-xs text-content-dim uppercase tracking-wider block mb-2">
                Search (name or ISO3)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => setShowResults(true)}
                  onBlur={() => setTimeout(() => setShowResults(false), 150)}
                  placeholder="e.g. Sudan, SDN, Gaza…"
                  className="w-full bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-terminal-green focus:outline-none"
                />
                {showResults && searchResults.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 border border-border-dim bg-abyss max-h-72 overflow-y-auto">
                    {searchResults.map((c) => {
                      const already = watchedIsoSet.has(c.iso3);
                      return (
                        <button
                          key={c.iso3}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() =>
                            already ? sound.error() : handleAdd(c)
                          }
                          className={`w-full text-left px-3 py-2 text-xs border-b border-border-dim last:border-b-0 flex items-center justify-between ${
                            already
                              ? "opacity-40 cursor-not-allowed"
                              : "hover:bg-panel"
                          }`}
                        >
                          <span className="text-content-primary">
                            <span className="text-content-dim mr-2 font-mono">
                              {c.iso3}
                            </span>
                            {c.name_en}
                          </span>
                          {already ? (
                            <span className="text-terminal-green">✓ PINNED</span>
                          ) : c.is_hotspot ? (
                            <StatusPill color="blood">HOTSPOT</StatusPill>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
                {showResults && search.trim() && searchResults.length === 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 border border-border-dim bg-abyss px-3 py-2 text-xs text-content-dim">
                    No matches.
                  </div>
                )}
              </div>
            </div>

            {/* Quick-add hotspots */}
            <div>
              <label className="text-xs text-content-dim uppercase tracking-wider block mb-2">
                Quick-Add — 22 WFP Hotspots
              </label>
              <div className="flex flex-wrap gap-2">
                {data.hotspots.all.map((h) => {
                  const already = watchedIsoSet.has(h.iso3);
                  return (
                    <button
                      key={h.iso3}
                      onClick={() =>
                        already ? sound.error() : handleAddByIso(h.iso3)
                      }
                      className={`px-2 py-1 text-[11px] border ${
                        already
                          ? "border-border-dim text-content-dim cursor-not-allowed opacity-50"
                          : "border-blood text-blood-bright hover:bg-blood hover:text-void"
                      }`}
                    >
                      {already ? "✓ " : "+ "}
                      {h.name_en || h.name_pt}
                    </button>
                  );
                })}
              </div>
            </div>
          </TerminalCard>

          {/* ═══ SECTION 3 — WATCHED COUNTRIES ═══ */}
          <TerminalCard
            title={`WATCHED COUNTRIES (${watchedCountries.length})`}
            accent="blood"
            className="mb-6"
          >
            {watchedCountries.length === 0 ? (
              <div className="text-sm text-content-dim py-6 text-center">
                {" "}
                ▒ No countries on watchlist. Add one above to begin monitoring.
                ▒{" "}
              </div>
            ) : (
              <div className="space-y-3">
                {watchedCountries.map((c) => {
                  const entry = watchlist.find((w) => w.iso3 === c.iso3);
                  const famine = c.hunger.famine_risk_1to5 ?? 0;
                  const conflict = c.conflict.intensity_1to5 ?? 0;
                  const under = c.hunger.undernourishment_pct;
                  const cpi = c.governance.corruption_perceptions_index;
                  const severe =
                    famine >= 3 || conflict >= 3 || (under != null && under > 20);

                  return (
                    <div
                      key={c.iso3}
                      className={`border p-3 ${
                        severe
                          ? "border-blood"
                          : "border-border-dim"
                      } bg-void`}
                    >
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/sorrow-map/${c.iso3.toLowerCase()}/`}
                            className="text-sm text-content-primary font-bold hover:text-blood-bright"
                            onClick={() => sound.select()}
                          >
                            {c.name_en}
                          </Link>
                          <span className="text-xs text-content-dim font-mono">
                            {c.iso3}
                          </span>
                          {c.is_hotspot && (
                            <StatusPill color="blood">
                              HOTSPOT · {(c.hotspot_score ?? 0).toFixed(1)}
                            </StatusPill>
                          )}
                          {c.hunger.wfp_class && (
                            <StatusPill color="amber">
                              {c.hunger.wfp_class.replace(/_/g, " ").toUpperCase()}
                            </StatusPill>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemove(c.iso3)}
                          className="text-xs px-2 py-1 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
                        >
                          ✕ REMOVE
                        </button>
                      </div>

                      {/* Metric bars */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                        <DataBar
                          label="Undernourishment"
                          value={under ?? 0}
                          max={60}
                          unit="%"
                        />
                        <DataBar
                          label="Conflict Intensity"
                          value={conflict}
                          max={5}
                        />
                        <DataBar
                          label="Famine Risk"
                          value={famine}
                          max={5}
                        />
                        <DataBar
                          label="Corruption Perception (higher = cleaner)"
                          value={cpi ?? 0}
                          max={100}
                          inverse
                        />
                      </div>

                      {/* Footer: dossier link + added date */}
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border-dim text-xs text-content-dim flex-wrap gap-2">
                        <Link
                          href={`/sorrow-map/${c.iso3.toLowerCase()}/`}
                          className="text-blood-bright hover:underline"
                          onClick={() => sound.select()}
                        >
                          → FULL DOSSIER
                        </Link>
                        {entry && (
                          <span>
                            Pinned{" "}
                            {new Date(entry.addedAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TerminalCard>

          {/* ═══ SECTION 4 — ALERT SUMMARY ═══ */}
          {watchedCountries.length > 0 && (
            <TerminalCard
              title="HIGHEST PRIORITY ALERTS"
              glow={threat === "CRITICAL" || threat === "HIGH"}
              accent={threat === "LOW" ? "green" : threat === "MODERATE" ? "amber" : "blood"}
              className="mb-6"
            >
              {/* Top 3 critical */}
              <div className="space-y-2">
                {topAlerts.map((c, i) => {
                  const famine = c.hunger.famine_risk_1to5 ?? 0;
                  const conflict = c.conflict.intensity_1to5 ?? 0;
                  const under = c.hunger.undernourishment_pct;
                  const reasons: string[] = [];
                  if (c.hunger.ipc_phase5)
                    reasons.push("IPC Phase 5 (catastrophe)");
                  if (famine >= 4) reasons.push(`Famine risk ${famine}/5`);
                  if (famine === 3) reasons.push("Elevated famine risk");
                  if (conflict >= 4) reasons.push(`Active conflict ${conflict}/5`);
                  if (under != null && under > 20)
                    reasons.push(`Undernourishment ${under.toFixed(1)}%`);
                  if (reasons.length === 0) reasons.push("On watchlist");

                  return (
                    <Link
                      key={c.iso3}
                      href={`/sorrow-map/${c.iso3.toLowerCase()}/`}
                      onClick={() => sound.select()}
                      className="flex items-center justify-between p-2 border border-border-dim hover:border-blood bg-void block"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-blood-bright font-bold text-xs">
                          #{i + 1}
                        </span>
                        <span className="text-xs text-content-primary font-bold">
                          {c.name_en}
                        </span>
                        <span className="text-xs text-content-dim font-mono">
                          {c.iso3}
                        </span>
                        {reasons.map((r) => (
                          <StatusPill key={r} color="blood">
                            {r}
                          </StatusPill>
                        ))}
                      </div>
                      <span className="text-xs text-blood-bright">→ DOSSIER</span>
                    </Link>
                  );
                })}
              </div>

              {/* Threat indicator */}
              <div className="mt-4 pt-3 border-t border-border-dim">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-content-dim uppercase tracking-widest">
                    Overall Watchlist Threat
                  </span>
                  <StatusPill color={threatInfo.color}>{threat}</StatusPill>
                </div>
                {/* Threat meter */}
                <div className="w-full h-3 border border-border-dim bg-void flex">
                  {(["LOW", "MODERATE", "HIGH", "CRITICAL"] as ThreatLevel[]).map(
                    (lvl) => {
                      const active = threat === lvl;
                      const fill =
                        lvl === "LOW"
                          ? "var(--color-terminal-green)"
                          : lvl === "MODERATE"
                            ? "var(--color-warning-amber)"
                            : "var(--color-blood)";
                      const reached =
                        ["LOW", "MODERATE", "HIGH", "CRITICAL"].indexOf(lvl) <=
                        ["LOW", "MODERATE", "HIGH", "CRITICAL"].indexOf(threat);
                      return (
                        <div
                          key={lvl}
                          className="flex-1 border-r border-border-dim last:border-r-0 transition-all"
                          style={{
                            backgroundColor: reached
                              ? fill
                              : "transparent",
                            opacity: active ? 1 : reached ? 0.6 : 0.15,
                          }}
                          title={lvl}
                        />
                      );
                    }
                  )}
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-content-dim uppercase tracking-wider">
                  <span>Low</span>
                  <span>Moderate</span>
                  <span>High</span>
                  <span>Critical</span>
                </div>
                <div className="text-xs text-content-secondary mt-2">
                  {threatInfo.label}
                </div>
              </div>
            </TerminalCard>
          )}
        </>
      )}
    </div>
  );
}

/* ═══ STAT TILE (inline helper component) ═══ */

function StatTile({
  label,
  value,
  tone = "dim",
}: {
  label: string;
  value: string;
  tone?: "dim" | "blood" | "green" | "amber";
}) {
  const color =
    tone === "blood"
      ? "var(--color-blood-bright)"
      : tone === "green"
        ? "var(--color-terminal-green)"
        : tone === "amber"
          ? "var(--color-warning-amber)"
          : "var(--color-content-primary)";
  return (
    <div className="p-3 border border-border-dim bg-void">
      <div className="text-[10px] uppercase tracking-wider text-content-dim">
        {label}
      </div>
      <div className="text-lg font-bold mt-1" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
