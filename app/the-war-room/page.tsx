"use client";

/**
 * V FOR X — The War Room
 *
 * Multi-source open-source war intelligence aggregator integrating 8 providers:
 * ISW, ACLED, LiveUAMap, War-Radar, WarWatch, War-Monitor, War.Direct,
 * and the Telegram Archive of the War (Lviv Center).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import { formatNumber } from "@/lib/format";
import warDataRaw from "@/data/war-updates.json";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import type {
  WarUpdatesData,
  ConflictTheater,
  TheaterSeverity,
  WarSourceMeta,
} from "@/lib/war-updates";
import {
  SEVERITY_META,
  STATUS_META,
  SOURCE_TYPE_LABELS,
  formatDate,
  freshnessLabel,
  sortTheaters,
  severityCounts,
  countDevelopments,
  countRegions,
  allDevelopments,
  theatersBySource,
  theaterToCountries,
  activeSourceIds,
} from "@/lib/war-updates";

const warData = warDataRaw as unknown as WarUpdatesData;
const data = backbone as WorldBackbone;

const PILL_COLOR: Record<TheaterSeverity, "blood" | "amber" | "green"> = {
  critical: "blood",
  high: "amber",
  moderate: "green",
};

type Tab = "overview" | "theaters" | "sources" | "acled" | "warwatch" | "liveuamap" | "wardirect" | "archive";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "OVERVIEW" },
  { id: "theaters", label: "THEATERS" },
  { id: "sources", label: "SOURCES" },
  { id: "acled", label: "ACLED" },
  { id: "warwatch", label: "WARWATCH" },
  { id: "liveuamap", label: "LIVEUAMAP" },
  { id: "wardirect", label: "WAR.DIRECT" },
  { id: "archive", label: "ARCHIVE" },
];

export default function TheWarRoomPage() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* ── Header ── */}
      <header>
        <div className="text-xs text-content-dim mb-1">
          // {warData.sources.length} SOURCES · {warData.theaters.length} THEATERS · {countRegions(warData.theaters)} REGIONS
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-blood-bright glow-blood">
          The War Room
        </h1>
        <p className="text-content-secondary text-sm mt-2 max-w-2xl">
          Multi-source open-source conflict intelligence. Aggregating data from ISW,
          ACLED, LiveUAMap, War-Radar, WarWatch, War-Monitor, War.Direct, and the
          Telegram Archive. {countDevelopments(warData)} key developments tracked.
          Updated{" "}
          <span className="text-content-primary">{freshnessLabel(warData.last_synced)}</span>.
        </p>
      </header>

      {/* ── Tab navigation ── */}
      <div className="flex flex-wrap gap-1 border-b border-border-dim">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); sound.nav(); }}
            className={`px-3 py-2 text-xs font-bold tracking-wider border-b-2 transition-colors ${
              tab === t.id
                ? "border-blood text-blood-bright"
                : "border-transparent text-content-secondary hover:text-content-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {tab === "overview" && <OverviewTab />}
      {tab === "theaters" && <TheatersTab />}
      {tab === "sources" && <SourcesTab />}
      {tab === "acled" && <AcledTab />}
      {tab === "warwatch" && <WarWatchTab />}
      {tab === "liveuamap" && <LiveUAMapTab />}
      {tab === "wardirect" && <WarDirectTab />}
      {tab === "archive" && <ArchiveTab />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   OVERVIEW TAB
   ═══════════════════════════════════════════════════════════ */

function OverviewTab() {
  const gs = warData.global_statistics;
  const sevCounts = useMemo(() => severityCounts(warData), []);
  const timeline = useMemo(() => allDevelopments(warData).slice(0, 15), []);
  const activeSrcs = useMemo(() => activeSourceIds(warData), []);

  return (
    <>
      {/* Global statistics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        <BigStat label="Active Conflicts (min)" value={gs.active_conflicts_tracked_min} color="blood" />
        <BigStat label="ACLED Events/Yr" value={gs.acled_yearly_events} color="blood" />
        <BigStat label="Est. Deaths/Yr" value={gs.acled_estimated_deaths_yearly} color="blood" />
        <BigStat label="Countries Covered" value={gs.acled_countries_covered} />
        <BigStat label="LiveUAMap Regions" value={gs.liveuamap_regions} />
        <BigStat label="WarWatch Conflicts" value={gs.warwatch_conflicts} color="amber" />
        <BigStat label="Iran War: Killed" value={gs.wardirect_total_killed} color="blood" />
        <BigStat label="Iran War: Displaced" value={`${gs.wardirect_total_displaced_m}M`} color="amber" />
        <BigStat label="Telegram Archive TB" value={`${gs.telegram_archive_tb}`} />
        <BigStat label="Telegram Items" value={gs.telegram_archive_items} />
        <BigStat label="ISW Theaters" value={gs.isw_theaters} />
        <BigStat label="Sources Integrated" value={gs.sources_count} color="green" />
      </div>

      {/* Severity breakdown */}
      <div className="grid grid-cols-3 gap-4">
        {(Object.keys(SEVERITY_META) as TheaterSeverity[]).map((sev) => (
          <div key={sev} className="terminal-card p-4 text-center">
            <div
              className="text-3xl font-bold tabular-nums"
              style={{ color: SEVERITY_META[sev].color }}
            >
              {sevCounts[sev]}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-content-dim mt-1">
              {SEVERITY_META[sev].label}
            </div>
          </div>
        ))}
      </div>

      {/* Active sources */}
      <TerminalCard title={`Active Sources — ${activeSrcs.length} of ${warData.sources.length}`} accent="green">
        <div className="flex flex-wrap gap-2">
          {warData.sources.map((s) => {
            const active = activeSrcs.includes(s.id);
            return (
              <Link
                key={s.id}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => sound.select()}
                className="flex items-center gap-2 px-3 py-1.5 border text-xs transition-colors"
                style={{
                  borderColor: active ? "var(--color-terminal-green)" : "var(--color-border-dim)",
                  opacity: active ? 1 : 0.5,
                }}
              >
                <span className={active ? "text-terminal-green" : "text-content-dim"}>
                  {active ? "●" : "○"}
                </span>
                <span className={active ? "text-content-primary" : "text-content-dim"}>
                  {s.short_name}
                </span>
              </Link>
            );
          })}
        </div>
      </TerminalCard>

      {/* Cross-theater feed */}
      <TerminalCard title="Latest Developments — Cross-Theater Feed" accent="blood">
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {timeline.map((k, i) => (
            <div key={`${k.theaterId}-${i}`} className="flex gap-3 items-start text-sm">
              <span className="text-[10px] text-content-dim tabular-nums shrink-0 w-20 pt-0.5">
                {formatDate(k.date)}
              </span>
              <span className="text-content-secondary">
                <span className="text-blood-bright">[{k.theater.split("—")[0].trim().toUpperCase()}]</span>{" "}
                <span className="text-content-dim">[{k.tag}]</span> {k.text}
              </span>
            </div>
          ))}
        </div>
      </TerminalCard>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   THEATERS TAB
   ═══════════════════════════════════════════════════════════ */

function TheatersTab() {
  const [activeFilter, setActiveFilter] = useState<TheaterSeverity | "all">("all");
  const sorted = useMemo(() => sortTheaters(warData.theaters), []);
  const sevCounts = useMemo(() => severityCounts(warData), []);

  const filtered = useMemo(
    () => activeFilter === "all" ? sorted : sorted.filter((t) => t.severity === activeFilter),
    [sorted, activeFilter],
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip label="ALL" count={warData.theaters.length} active={activeFilter === "all"} onClick={() => { setActiveFilter("all"); sound.nav(); }} />
        {(Object.keys(SEVERITY_META) as TheaterSeverity[]).map((sev) => (
          <FilterChip key={sev} label={SEVERITY_META[sev].label} count={sevCounts[sev]} color={SEVERITY_META[sev].color} active={activeFilter === sev} onClick={() => { setActiveFilter(sev); sound.nav(); }} />
        ))}
      </div>
      <div className="space-y-4">
        {filtered.map((t) => <TheaterCard key={t.id} theater={t} />)}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   SOURCES TAB
   ═══════════════════════════════════════════════════════════ */

function SourcesTab() {
  return (
    <div className="space-y-4">
      {warData.sources.map((s) => <SourceCard key={s.id} source={s} />)}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ACLED TAB
   ═══════════════════════════════════════════════════════════ */

function AcledTab() {
  const a = warData.acled;
  return (
    <>
      <TerminalCard title="ACLED — Conflict Index Top 8" accent="blood" glow>
        <div className="space-y-2">
          {a.conflict_index_top.map((r) => (
            <div key={r.rank} className="flex gap-3 items-center p-2 border border-border-dim hover:border-blood-dim transition-colors">
              <span className="text-blood-bright font-bold text-lg tabular-nums w-8">{r.rank}</span>
              <div>
                <div className="text-sm text-content-primary font-bold">{r.country}</div>
                <div className="text-[11px] text-content-secondary">{r.note}</div>
              </div>
            </div>
          ))}
        </div>
      </TerminalCard>

      <TerminalCard title="Event Types (6 categories)" accent="amber">
        <div className="grid sm:grid-cols-2 gap-3">
          {a.event_types.map((e) => (
            <div key={e.type} className="p-3 border border-border-dim">
              <div className="text-sm text-blood-bright font-bold">{e.type}</div>
              <div className="text-[10px] text-content-dim uppercase tracking-wider">{e.disorder_type}</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {e.sub_events.map((s) => (
                  <span key={s} className="text-[9px] text-content-secondary border border-border-dim px-1.5 py-0.5">{s}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </TerminalCard>

      <TerminalCard title="Conflict Categories" accent="amber">
        <div className="space-y-2">
          {a.conflict_categories.map((c) => (
            <div key={c.name} className="flex gap-3 items-start text-sm">
              <span className="text-blood-bright font-bold shrink-0 w-32">{c.name}</span>
              <span className="text-content-secondary">{c.description}</span>
            </div>
          ))}
        </div>
      </TerminalCard>

      <TerminalCard title="Actor Types & Regions" accent="green">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">Actor Types</div>
            <div className="flex flex-wrap gap-1.5">
              {a.actor_types.map((t) => (
                <span key={t} className="text-[10px] text-content-secondary border border-border-dim px-1.5 py-0.5">{t}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">Regions</div>
            <div className="flex flex-wrap gap-1.5">
              {a.regions.map((r) => (
                <span key={r} className="text-[10px] text-terminal-green border border-border-dim px-1.5 py-0.5">{r}</span>
              ))}
            </div>
          </div>
        </div>
      </TerminalCard>

      <TerminalCard title="Monitors & Update Schedule" accent="amber">
        <div className="grid sm:grid-cols-2 gap-2">
          {a.monitors.map((m) => (
            <div key={m.name} className="p-2 border border-border-dim">
              <div className="text-xs text-content-primary font-bold">{m.name}</div>
              <div className="text-[10px] text-content-secondary">{m.frequency}</div>
              {m.note && <div className="text-[10px] text-content-dim mt-0.5">{m.note}</div>}
            </div>
          ))}
        </div>
      </TerminalCard>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   WARWATCH TAB
   ═══════════════════════════════════════════════════════════ */

function WarWatchTab() {
  const w = warData.warwatch;
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <BigStat label="Total Conflicts" value={w.counts.total_armed_conflicts} color="blood" />
        <BigStat label="IACs" value={w.counts.international_armed_conflicts} color="amber" />
        <BigStat label="Occupations" value={w.counts.military_occupations} color="amber" />
        <BigStat label="NIACs" value={w.counts.non_international_armed_conflicts} />
        <BigStat label="Countries w/ IHL" value={w.counts.countries_with_ihl_analysis} color="green" />
      </div>

      <TerminalCard title={`Legal Classification — ${w.counts.total_armed_conflicts} Armed Conflicts`} accent="blood">
        <div className="space-y-3">
          {w.classification_categories.map((c) => (
            <div key={c.code} className="p-3 border border-border-dim">
              <div className="flex items-center gap-2 mb-1">
                <StatusPill color={c.code === "IAC" || c.code === "OCC" ? "amber" : "dim"}>{c.code}</StatusPill>
                <span className="text-sm text-content-primary font-bold">{c.name}</span>
              </div>
              <div className="text-[11px] text-content-secondary">{c.description}</div>
            </div>
          ))}
        </div>
      </TerminalCard>

      <TerminalCard title="IHL Compliance Themes" accent="amber">
        <div className="space-y-2">
          {w.ihl_themes.map((t) => (
            <div key={t} className="flex items-center gap-2 text-sm">
              <span className="text-blood">▸</span>
              <span className="text-content-secondary">{t}</span>
            </div>
          ))}
        </div>
      </TerminalCard>

      <TerminalCard title="Violation Categories Assessed" accent="amber">
        <div className="flex flex-wrap gap-1.5">
          {w.violation_categories.map((v) => (
            <span key={v} className="text-[10px] text-content-secondary border border-border-dim px-2 py-1">{v}</span>
          ))}
        </div>
      </TerminalCard>

      <TerminalCard title="Reporting Periods & Methodology" accent="green">
        <div className="space-y-2 text-sm">
          <div><span className="text-content-dim">Classification:</span> <span className="text-content-secondary">{w.reporting_periods.classification}</span></div>
          <div><span className="text-content-dim">IHL Compliance:</span> <span className="text-content-secondary">{w.reporting_periods.ihl_compliance}</span></div>
          <div><span className="text-content-dim">Data Cutoff:</span> <span className="text-content-secondary">{w.reporting_periods.data_cutoff}</span></div>
          <div><span className="text-content-dim">Operator:</span> <span className="text-content-secondary">{w.operator}</span></div>
          <div><span className="text-content-dim">Funded by:</span> <span className="text-content-secondary">{w.funded_by.join(", ")}</span></div>
          <div><span className="text-content-dim">Launched:</span> <span className="text-content-secondary">{w.launched}</span></div>
          <div><span className="text-content-dim">Integrates:</span> <span className="text-content-secondary">{w.integrates.join(" + ")}</span></div>
        </div>
      </TerminalCard>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   LIVEUAMAP TAB
   ═══════════════════════════════════════════════════════════ */

function LiveUAMapTab() {
  const l = warData.liveuamap;
  const wr = warData.war_radar;
  const wm = warData.war_monitor;
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <BigStat label="Regions Tracked" value={l.regions_covered} color="blood" />
        <BigStat label="Languages" value={l.languages.length} />
        <BigStat label="Founded" value={l.founded.split("-")[0]} />
        <BigStat label="Data Format" value_label="GeoJSON" />
      </div>

      <TerminalCard title="LiveUAMap — Event Categories" accent="blood">
        <div className="flex flex-wrap gap-1.5">
          {l.event_categories.map((c) => (
            <span key={c} className="text-[10px] text-content-secondary border border-border-dim px-2 py-1">{c}</span>
          ))}
        </div>
      </TerminalCard>

      <TerminalCard title="Color Coding — Reds vs Blues" accent="amber">
        <div className="space-y-2">
          {Object.entries(l.color_coding).map(([key, desc]) => (
            <div key={key} className="flex items-center gap-3 text-sm">
              <span
                className="w-4 h-4 inline-block shrink-0"
                style={{ background: key === "red" ? "#cc0000" : key === "blue" ? "#0066ff" : "#666" }}
              />
              <span className="text-content-dim capitalize w-16">{key}</span>
              <span className="text-content-secondary">{desc}</span>
            </div>
          ))}
        </div>
      </TerminalCard>

      <TerminalCard title={`Key Conflict Maps (${l.key_conflict_maps.length})`} accent="green">
        <div className="grid sm:grid-cols-2 gap-1.5">
          {l.key_conflict_maps.map((m) => (
            <span key={m} className="text-[10px] text-content-secondary">▸ {m}</span>
          ))}
        </div>
      </TerminalCard>

      {/* War-Radar */}
      <TerminalCard title="War-Radar — AI-Powered Monitor" accent="amber">
        <div className="space-y-3">
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">Conflict Types (7)</div>
            <div className="flex flex-wrap gap-1.5">
              {wr.conflict_types.map((t) => (
                <span key={t} className="text-[10px] text-blood-bright border border-border-dim px-1.5 py-0.5">{t}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">Severity Levels</div>
            <div className="space-y-1">
              {wr.severity_levels.map((s) => (
                <div key={s.level} className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 inline-block shrink-0" style={{ background: s.color }} />
                  <span className="text-content-primary font-bold w-20">{s.level}</span>
                  <span className="text-content-secondary">{s.definition}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">RSS Feeds ({wr.data_sources.rss_feeds.length})</div>
            <div className="flex flex-wrap gap-1">
              {wr.data_sources.rss_feeds.map((f) => (
                <span key={f} className="text-[9px] text-content-secondary border border-border-dim px-1 py-0.5">{f}</span>
              ))}
            </div>
          </div>
        </div>
      </TerminalCard>

      {/* War-Monitor */}
      <TerminalCard title="War-Monitor — 3D Globe Intelligence" accent="green">
        <div className="space-y-3">
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">Active Conflict Zones ({wm.conflict_zones.length})</div>
            <div className="flex flex-wrap gap-1.5">
              {wm.conflict_zones.map((z) => (
                <span key={z} className="text-[10px] text-content-secondary border border-border-dim px-1.5 py-0.5">{z}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">Event Categories</div>
            <div className="flex flex-wrap gap-1.5">
              {wm.event_categories.map((c) => (
                <span key={c} className="text-[10px] text-blood-bright border border-border-dim px-1.5 py-0.5">{c}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">Platform Features</div>
            <div className="text-[11px] text-content-secondary">{wm.features.join(" · ")}</div>
          </div>
        </div>
      </TerminalCard>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   WAR.DIRECT TAB
   ═══════════════════════════════════════════════════════════ */

function WarDirectTab() {
  const w = warData.war_direct;
  const iranTheater = warData.theaters.find((t) => t.id === "us-israel-iran");
  return (
    <>
      <TerminalCard title={`${w.conflict_name} — Day ${w.conflict_day}`} accent="blood" glow>
        <p className="text-sm text-content-secondary">{warData.sources.find((s) => s.id === "war-direct")?.description}</p>
        <div className="text-[11px] text-content-dim mt-2">
          Co-built by {w.co_built_by} · Informed {formatNumber(w.people_informed)}+ people
        </div>
      </TerminalCard>

      {iranTheater?.war_direct_scoreboard && (
        <TerminalCard title="The Scoreboard — Casualties" accent="blood">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <BigStat label="Total Killed" value={iranTheater.war_direct_scoreboard.total_killed} color="blood" />
            <BigStat label="Total Wounded" value={iranTheater.war_direct_scoreboard.total_wounded} color="blood" />
            <BigStat label="Displaced" value={`${iranTheater.war_direct_scoreboard.total_displaced_m}M`} color="amber" />
            <BigStat label="Affected" value={`${iranTheater.war_direct_scoreboard.total_affected_m}M`} color="amber" />
          </div>
          <div className="space-y-1.5">
            {iranTheater.war_direct_scoreboard.casualties_by_country.map((c) => (
              <div key={c.country} className="flex items-center gap-3 p-2 border border-border-dim text-sm">
                <span className="text-content-primary font-bold w-24 shrink-0">{c.country}</span>
                <span className="text-blood-bright tabular-nums">{c.killed.toLocaleString()} killed</span>
                {c.wounded && <span className="text-content-secondary tabular-nums">{c.wounded.toLocaleString()} wounded</span>}
                {c.displaced_m && <span className="text-amber text-content-secondary">{c.displaced_m}M displaced</span>}
              </div>
            ))}
          </div>
        </TerminalCard>
      )}

      {iranTheater?.war_direct_scoreboard && (
        <div className="grid sm:grid-cols-2 gap-4">
          <TerminalCard title="US/Israel Military" accent="amber">
            <div className="space-y-1.5 text-sm">
              <ScoreboardRow label="Targets Struck" value={iranTheater.war_direct_scoreboard.us_israel_military.targets_struck.toLocaleString()} />
              <ScoreboardRow label="Verified Strikes" value={iranTheater.war_direct_scoreboard.us_israel_military.verified_strikes.toLocaleString()} />
              <ScoreboardRow label="Bombs Dropped" value={iranTheater.war_direct_scoreboard.us_israel_military.bombs_dropped.toLocaleString()} />
              <ScoreboardRow label="Iranian Warships Sunk" value={`${iranTheater.war_direct_scoreboard.us_israel_military.iranian_warships_sunk}+`} />
              <ScoreboardRow label="Senior Leaders Killed" value={`${iranTheater.war_direct_scoreboard.us_israel_military.senior_leaders_killed}+`} />
              <ScoreboardRow label="Iran Missile Launchers" value={`${iranTheater.war_direct_scoreboard.us_israel_military.iran_missile_launchers_destroyed_pct}% destroyed`} />
              <ScoreboardRow label="War Cost" value={`$${iranTheater.war_direct_scoreboard.us_israel_military.war_cost_b}B+`} />
            </div>
          </TerminalCard>

          <TerminalCard title="Iran & Axis Military" accent="amber">
            <div className="space-y-1.5 text-sm">
              <ScoreboardRow label="Strikes on Israel/Gulf" value={iranTheater.war_direct_scoreboard.iran_axis_military.strikes_on_israel_gulf.toLocaleString()} />
              <ScoreboardRow label="Missiles Fired" value={`${iranTheater.war_direct_scoreboard.iran_axis_military.missiles_fired.toLocaleString()}+`} />
              <ScoreboardRow label="US Aircraft Downed" value={`${iranTheater.war_direct_scoreboard.iran_axis_military.us_aircraft_downed}`} />
              <ScoreboardRow label="Oil Price Surge" value={`+${iranTheater.war_direct_scoreboard.iran_axis_military.oil_price_increase_pct}%`} />
              <ScoreboardRow label="Hormuz Traffic" value={`-${iranTheater.war_direct_scoreboard.iran_axis_military.hormuz_traffic_reduction_pct}%`} />
            </div>
          </TerminalCard>
        </div>
      )}

      {iranTheater?.war_direct_scoreboard?.key_figures_eliminated && (
        <TerminalCard title="Key Figures Eliminated" accent="blood">
          <div className="space-y-1.5">
            {iranTheater.war_direct_scoreboard.key_figures_eliminated.map((f, i) => (
              <div key={i} className="flex items-center gap-3 p-2 border border-border-dim text-sm">
                <span className="text-blood-bright font-bold w-44 shrink-0">{f.name}</span>
                <span className="text-content-secondary">{f.role}</span>
                <span className="text-content-dim text-[10px] ml-auto">{formatDate(f.date)}</span>
              </div>
            ))}
          </div>
        </TerminalCard>
      )}

      {iranTheater?.global_impact && (
        <TerminalCard title="Global Ripple — Energy & Humanitarian" accent="amber">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">Energy Crisis</div>
              <div className="space-y-1 text-xs">
                <div className="text-content-secondary">Oil: <span className="text-blood-bright">${iranTheater.global_impact.oil_price_before}/bbl → ${iranTheater.global_impact.oil_price_after}+/bbl</span></div>
                <div className="text-content-secondary">Hormuz: <span className="text-blood-bright">20M bbl/day → -{iranTheater.global_impact.hormuz_traffic_reduction_pct}%</span></div>
                <div className="text-content-secondary">Qatar LNG: <span className="text-blood-bright">{iranTheater.global_impact.qatar_lng_exports}</span></div>
                <div className="text-content-secondary">Iraq oil: <span className="text-blood-bright">{iranTheater.global_impact.iraq_oil_before_mbpd}M → {iranTheater.global_impact.iraq_oil_after_mbpd}M bbl/day</span></div>
                <div className="text-content-secondary">Ships stranded: <span className="text-blood-bright">{iranTheater.global_impact.ships_stranded.toLocaleString()}+</span></div>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">Humanitarian</div>
              <div className="space-y-1 text-xs">
                <div className="text-content-secondary">People facing hunger: <span className="text-blood-bright">+{iranTheater.global_impact.people_facing_hunger_m}M globally</span></div>
                <div className="text-content-secondary">Iran internet blackout: <span className="text-blood-bright">{iranTheater.global_impact.iran_internet_blackout_days}+ days at {iranTheater.global_impact.iran_internet_connectivity_pct}% connectivity</span></div>
                <div className="text-content-secondary">Global fertilizer via Hormuz: <span className="text-blood-bright">{iranTheater.global_impact.global_fertilizer_via_hormuz_pct}%</span></div>
              </div>
            </div>
          </div>
        </TerminalCard>
      )}

      {iranTheater?.ceasefire_timeline && (
        <TerminalCard title="Ceasefire Timeline — Collapse & Escalation" accent="amber">
          <div className="space-y-1.5">
            {iranTheater.ceasefire_timeline.map((c, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="text-content-dim tabular-nums shrink-0 w-20">{formatDate(c.date)}</span>
                <span className="text-content-secondary">{c.event}</span>
              </div>
            ))}
          </div>
        </TerminalCard>
      )}

      <TerminalCard title="Coalitions" accent="green">
        <div className="space-y-3">
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">US/Israel Side</div>
            <div className="text-xs text-content-secondary">{w.coalitions.us_israel_side.members.join(" · ")}</div>
            <div className="text-[11px] text-content-dim mt-0.5">Host nations: {w.coalitions.us_israel_side.host_nations.join(", ")}</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">Iran & Axis of Resistance</div>
            <div className="text-xs text-content-secondary">{w.coalitions.iran_axis_side.members.join(" · ")}</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">Hormuz Shipping Coalition ({w.coalitions.hormuz_shipping_coalition.nations_signed} nations)</div>
            <div className="text-xs text-content-secondary">{w.coalitions.hormuz_shipping_coalition.key_members.join(" · ")}</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">Neutral / Mediating</div>
            <div className="text-xs text-content-secondary">{w.coalitions.neutral.join(" · ")}</div>
          </div>
        </div>
      </TerminalCard>

      <TerminalCard title="US Public Opinion" accent="amber">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(w.public_opinion_us).map(([key, val]) => (
            <div key={key}>
              <div className="text-2xl font-bold text-content-primary tabular-nums">{val}%</div>
              <div className="text-[9px] text-content-dim uppercase tracking-wider mt-0.5">
                {key.replace(/_/g, " ").replace(/ pct/g, "").replace(/\b\w/g, (c) => c.toUpperCase())}
              </div>
            </div>
          ))}
        </div>
      </TerminalCard>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   ARCHIVE TAB
   ═══════════════════════════════════════════════════════════ */

function ArchiveTab() {
  const t = warData.telegram_archive;
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        <BigStat label="Total Items" value={t.items_archived} color="blood" />
        <BigStat label="Channels" value={t.channels} />
        <BigStat label="Chats" value={t.chats} />
        <BigStat label="Chatbots" value={t.chatbots} />
        <BigStat label="Data Volume" value_label={`${t.data_volume_tb} TB`} color="amber" />
      </div>

      <TerminalCard title="Archive Overview" accent="blood">
        <div className="space-y-2 text-sm">
          <div><span className="text-content-dim">Operator:</span> <span className="text-content-secondary">{t.operator}</span></div>
          <div><span className="text-content-dim">Coordinator:</span> <span className="text-content-secondary">{t.coordinator}</span></div>
          <div><span className="text-content-dim">Date Range:</span> <span className="text-content-secondary">{t.date_range}</span></div>
          <div><span className="text-content-dim">Status:</span> <span className="text-amber">{t.status}</span></div>
          <div><span className="text-content-dim">Access:</span> <span className="text-content-secondary">{t.access}</span></div>
        </div>
      </TerminalCard>

      <TerminalCard title="Geographic Coverage — 25 Regions of Ukraine" accent="green">
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
          {t.geographic_coverage.map((g) => (
            <span key={g} className="text-[10px] text-content-secondary">▸ {g}</span>
          ))}
        </div>
      </TerminalCard>

      <TerminalCard title="Thematic Datasets" accent="amber">
        <div className="space-y-3">
          {t.thematic_datasets.map((d, i) => (
            <div key={i} className="p-3 border border-border-dim">
              <div className="text-sm text-blood-bright font-bold">{d.name}</div>
              <div className="flex gap-3 mt-1 text-[10px] text-content-dim">
                {d.channels && <span>{d.channels} channels</span>}
                {d.chats && <span>{d.chats} chats</span>}
                {d.units && <span>{d.units} units</span>}
                {d.collections && <span>{d.collections} collections</span>}
                {d.date && <span>{d.date}</span>}
              </div>
              {d.topics && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {d.topics.map((tp) => (
                    <span key={tp} className="text-[9px] text-content-secondary border border-border-dim px-1 py-0.5">{tp}</span>
                  ))}
                </div>
              )}
              {d.note && <div className="text-[11px] text-content-secondary mt-1">{d.note}</div>}
            </div>
          ))}
        </div>
      </TerminalCard>

      <TerminalCard title="Content Types Archived" accent="green">
        <div className="flex flex-wrap gap-1.5">
          {t.content_types.map((c) => (
            <span key={c} className="text-[10px] text-content-secondary border border-border-dim px-2 py-1">{c}</span>
          ))}
        </div>
      </TerminalCard>

      <TerminalCard title="Partners & Supporters" accent="amber">
        <div className="space-y-1">
          {t.partners.map((p) => (
            <div key={p} className="text-xs text-content-secondary">▸ {p}</div>
          ))}
        </div>
      </TerminalCard>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function BigStat({ label, value, value_label, color }: { label: string; value?: number | string; value_label?: string; color?: string }) {
  const colorVar = color === "blood" ? "var(--color-blood-bright)" : color === "amber" ? "var(--color-warning-amber)" : color === "green" ? "var(--color-terminal-green)" : "var(--color-content-primary)";
  return (
    <div>
      <div className="text-2xl font-bold tabular-nums" style={{ color: colorVar }}>
        {value_label ?? (typeof value === "number" ? formatNumber(value) : value ?? "N/A")}
      </div>
      <div className="text-[9px] text-content-dim uppercase tracking-widest mt-0.5">{label}</div>
    </div>
  );
}

function ScoreboardRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-content-secondary">{label}</span>
      <span className="text-blood-bright font-bold tabular-nums">{value}</span>
    </div>
  );
}

function FilterChip({ label, count, active, onClick, color }: { label: string; count: number; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 border text-xs font-bold transition-all"
      style={{
        borderColor: active ? (color ?? "var(--color-blood)") : "var(--color-border-dim)",
        color: active ? (color ?? "var(--color-blood-bright)") : "var(--color-content-secondary)",
        background: active ? "var(--color-panel)" : "transparent",
      }}
    >
      {label} <span className="text-[9px] opacity-70">({count})</span>
    </button>
  );
}

function SourceCard({ source }: { source: WarSourceMeta }) {
  const theatersTracking = theatersBySource(warData, source.id);
  return (
    <TerminalCard
      title={`${source.short_name} // ${SOURCE_TYPE_LABELS[source.type]}`}
      accent={source.type === "live_event_map" ? "green" : source.type === "historical_archive" ? "amber" : "blood"}
    >
      <p className="text-sm text-content-secondary leading-relaxed mb-3">{source.description}</p>
      <div className="text-xs text-content-dim italic mb-3">{source.tagline}</div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {Object.entries(source.stats).slice(0, 8).map(([key, val]) => (
          <div key={key}>
            <div className="text-lg font-bold text-content-primary tabular-nums">{formatNumber(val)}</div>
            <div className="text-[9px] text-content-dim uppercase tracking-wider">{key.replace(/_/g, " ")}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-border-dim flex-wrap">
        <Link href={source.url} target="_blank" rel="noopener noreferrer" className="text-xs text-terminal-green border border-border-dim px-3 py-1.5 hover:border-terminal-green transition-colors" onClick={() => sound.select()}>
          ↗ Visit {source.short_name}
        </Link>
        {theatersTracking.length > 0 && (
          <span className="text-[10px] text-content-dim">
            Tracking {theatersTracking.length} theater{theatersTracking.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="text-[10px] text-content-dim mt-2">{source.license_note}</div>
    </TerminalCard>
  );
}

function TheaterCard({ theater }: { theater: ConflictTheater }) {
  const sevMeta = SEVERITY_META[theater.severity];
  const statusMeta = STATUS_META[theater.status];
  const countries = useMemo(() => theaterToCountries(theater, data.countries), [theater]);
  const accent = theater.severity === "critical" ? "blood" as const : theater.severity === "high" ? "amber" as const : "green" as const;

  return (
    <TerminalCard title={`${theater.code} // ${theater.name}`} accent={accent} glow={theater.severity === "critical"}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <StatusPill color={PILL_COLOR[theater.severity]}>{sevMeta.label}</StatusPill>
        <StatusPill color="dim">{statusMeta.label}</StatusPill>
        <span className="text-[10px] text-content-dim">since {theater.start_year}</span>
        {theater.has_map && <span className="text-[10px] text-terminal-green border border-border-dim px-1.5 py-0.5">◉ MAP</span>}
        {theater.sources_tracking.map((s) => {
          const src = warData.sources.find((x) => x.id === s);
          return src ? <span key={s} className="text-[9px] text-content-dim border border-border-dim px-1 py-0.5">{src.short_name}</span> : null;
        })}
      </div>

      <p className="text-sm text-content-secondary leading-relaxed mb-4">{theater.summary}</p>

      {/* ACLED stats */}
      {theater.acled_stats && Object.keys(theater.acled_stats).length > 0 && (
        <div className="bg-void border border-border-dim p-3 mb-4">
          <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">ACLED Data</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {theater.acled_stats.weekly_events && <BigStat label="Weekly Events" value={theater.acled_stats.weekly_events} color="blood" />}
            {theater.acled_stats.civilian_targeting_events && <BigStat label="Civilian Targeting" value={theater.acled_stats.civilian_targeting_events} color="blood" />}
            {theater.acled_stats.air_drone_strikes && <BigStat label="Air/Drone Strikes" value={theater.acled_stats.air_drone_strikes} />}
            {theater.acled_stats.armed_clashes && <BigStat label="Armed Clashes" value={theater.acled_stats.armed_clashes} />}
            {theater.acled_stats.killed_since_april_2023 && <BigStat label="Killed Since Apr 2023" value={theater.acled_stats.killed_since_april_2023} color="blood" />}
            {theater.acled_stats.killed_since_2021_coup && <BigStat label="Killed Since 2021 Coup" value={theater.acled_stats.killed_since_2021_coup} color="blood" />}
            {theater.acled_stats.distinct_armed_groups && <BigStat label="Armed Groups" value={theater.acled_stats.distinct_armed_groups} />}
            {theater.acled_stats.killed_by_political_violence && <BigStat label="Political Violence Deaths" value={theater.acled_stats.killed_by_political_violence} color="blood" />}
          </div>
          {theater.acled_stats.infrastructure_breakdown && (
            <div className="mt-3 pt-2 border-t border-border-dim">
              <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">Infrastructure Attacks Breakdown</div>
              <div className="flex flex-wrap gap-2 text-[10px]">
                {Object.entries(theater.acled_stats.infrastructure_breakdown).map(([k, v]) => (
                  <span key={k} className="text-content-secondary border border-border-dim px-1.5 py-0.5">{k}: <span className="text-blood-bright">{v}</span></span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* War Monitor stats */}
      {theater.war_monitor_stats && (
        <div className="bg-void border border-border-dim p-3 mb-4">
          <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">War-Monitor Data</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {theater.war_monitor_stats.civilian_casualties_un && <BigStat label="UN Civilian Casualties" value={theater.war_monitor_stats.civilian_casualties_un} color="blood" />}
            {theater.war_monitor_stats.idp_millions && <BigStat label="IDPs" value={`${theater.war_monitor_stats.idp_millions}M`} color="amber" />}
            {theater.war_monitor_stats.refugees_millions && <BigStat label="Refugees Abroad" value={`${theater.war_monitor_stats.refugees_millions}M`} color="amber" />}
            {theater.war_monitor_stats.energy_capacity_destroyed_pct && <BigStat label="Energy Destroyed" value={`${theater.war_monitor_stats.energy_capacity_destroyed_pct}%`} />}
            {theater.war_monitor_stats.frontline_km && <BigStat label="Frontline" value={`${theater.war_monitor_stats.frontline_km} km`} />}
            {theater.war_monitor_stats.afu_personnel && <BigStat label="AFU Personnel" value={theater.war_monitor_stats.afu_personnel} />}
            {theater.war_monitor_stats.western_aid_total_b && <BigStat label="Western Aid" value={`$${theater.war_monitor_stats.western_aid_total_b}B`} />}
            {theater.war_monitor_stats.sanctions_against_russia && <BigStat label="Sanctions vs Russia" value={theater.war_monitor_stats.sanctions_against_russia} />}
          </div>
        </div>
      )}

      {/* Latest report */}
      <div className="bg-void border border-border-dim p-3 mb-4">
        <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">
          Latest Report — {freshnessLabel(theater.latest_report.date)}
        </div>
        <a href={theater.latest_report.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blood-bright hover:underline" onClick={() => sound.select()}>
          {theater.latest_report.title}
        </a>
        <div className="text-[10px] text-content-dim mt-1">{formatDate(theater.latest_report.date)}</div>
      </div>

      {/* Key developments */}
      <div className="mb-4">
        <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">
          Key Developments ({theater.key_developments.length})
        </div>
        <div className="space-y-1.5">
          {theater.key_developments.map((k, i) => (
            <div key={i} className="flex gap-2 items-start text-xs">
              <span className="text-content-dim tabular-nums shrink-0 w-20">{formatDate(k.date)}</span>
              <span className="text-content-secondary">
                <span className="text-content-dim">[{k.tag}]</span> {k.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Regions + cross-links */}
      <div className="grid sm:grid-cols-2 gap-4 pt-3 border-t border-border-dim">
        <div>
          <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">Regions Monitored</div>
          <div className="flex flex-wrap gap-1.5">
            {theater.regions.map((r) => (
              <span key={r} className="text-[10px] text-content-secondary border border-border-dim px-1.5 py-0.5">{r}</span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">Cross-Link — V FOR X Dossiers</div>
          {countries.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {countries.map((c) => (
                <Link key={c.iso3} href={`/sorrow-map/${c.iso3.toLowerCase()}/`} className="text-[10px] text-blood-bright border border-border-dim px-1.5 py-0.5 hover:border-blood transition-colors" onClick={() => sound.nav()}>
                  {c.name_en} ↗
                </Link>
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-content-dim">No country links</span>
          )}
        </div>
      </div>

      {/* Featured reports */}
      {theater.featured_reports.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border-dim">
          <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">Featured Reports</div>
          <div className="space-y-1.5">
            {theater.featured_reports.map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-terminal-green hover:underline" onClick={() => sound.select()}>
                ↗ {r.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </TerminalCard>
  );
}
