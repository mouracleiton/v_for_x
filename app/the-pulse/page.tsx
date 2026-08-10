"use client";

/**
 * V FOR X — The Pulse
 *
 * Client-side multi-source crisis reader. Pulls public RSS / Atom / nitter
 * feeds, filters them through regional crisis keywords, and ranks every story
 * by the platform's composite vulnerability score. Fetched items are cached in
 * IndexedDB so the feed is readable offline and under hostile connectivity.
 *
 * Where /the-digest/ *generates* feeds from internal data, /the-pulse/
 * *consumes* the open web.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import DataBar from "@/components/ui/DataBar";
import {
  DEFAULT_SOURCES,
  REGION_LABELS,
  TOPIC_LABELS,
  buildCountryIndex,
  filterFeed,
  loadPrefs,
  savePrefs,
  pulseCacheGetAll,
  pulseCacheMeta,
  pulseCacheSet,
  pulseCacheClear,
  refreshSources,
  resolveProxies,
  resolveSources,
  type PulseItem,
  type PulsePrefs,
  type PulseRegion,
  type PulseSource,
  type PulseTopic,
  type FetchResult,
} from "@/lib/pulse";
import { isOnline, onConnectivityChange } from "@/lib/offline-manager";
import { sound } from "@/lib/sound";

const data = backbone as WorldBackbone;
const ALL_REGIONS: PulseRegion[] = ["Africa", "Asia", "Americas", "Europe", "Oceania", "Global"];
const ALL_TOPICS: PulseTopic[] = [
  "famine", "conflict", "displacement", "health", "climate", "governance", "protest", "humanitarian",
];

/* ═══ HELPERS ═══ */

function relativeTime(ts: number): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function regionColor(region: PulseRegion): "blood" | "amber" | "green" | "dim" {
  switch (region) {
    case "Africa": return "blood";
    case "Asia": return "amber";
    case "Americas": return "green";
    case "Europe": return "dim";
    case "Oceania": return "dim";
    default: return "dim";
  }
}

/* ═══ SMALL UI PRIMITIVES ═══ */

function Chip({
  active,
  onClick,
  children,
  color = "command",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: "command" | "green" | "blood";
}) {
  const border =
    color === "green" ? "var(--color-terminal-green)"
    : color === "blood" ? "var(--color-blood)"
    : "var(--color-command)";
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 text-[10px] uppercase tracking-widest border transition-colors"
      style={{
        borderColor: active ? border : "var(--color-border-dim)",
        color: active ? border : "var(--color-content-secondary)",
        background: active ? "rgba(255,255,255,0.04)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-pill px-2.5 py-1 text-[10px] uppercase tracking-widest border transition-colors"
      style={{
        borderColor: active ? "var(--color-terminal-green)" : "var(--color-border-dim)",
        color: active ? "var(--color-terminal-green)" : "var(--color-content-secondary)",
        background: active ? "rgba(34,211,166,0.08)" : "transparent",
      }}
    >
      {active ? "● ON" : "○ OFF"}
      <span className="ml-1.5">{children}</span>
    </button>
  );
}

/* ═══ PAGE ═══ */

export default function ThePulsePage() {
  const index = useMemo(() => buildCountryIndex(data.countries), []);

  const [prefs, setPrefs] = useState<PulsePrefs>(() => loadPrefs());
  const [items, setItems] = useState<PulseItem[]>([]);
  const [results, setResults] = useState<FetchResult[]>([]);
  const [meta, setMeta] = useState<{ ts: number; count: number } | null>(null);
  const [online, setOnline] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");
  const [showSources, setShowSources] = useState<boolean>(false);
  const [showProxies, setShowProxies] = useState<boolean>(false);

  // Hydrate from cache on mount.
  useEffect(() => {
    let alive = true;
    setOnline(isOnline());
    (async () => {
      const [cached, m] = await Promise.all([pulseCacheGetAll(), pulseCacheMeta()]);
      if (!alive) return;
      if (cached.length) setItems(cached);
      if (m) setMeta({ ts: m.ts, count: m.count });
    })();
    const unsub = onConnectivityChange((next) => setOnline(next));
    return () => { alive = false; unsub(); };
  }, []);

  // Persist prefs on change.
  useEffect(() => { savePrefs(prefs); }, [prefs]);

  const sources = useMemo(() => resolveSources(prefs), [prefs]);
  const proxies = useMemo(() => resolveProxies(prefs), [prefs]);

  const filtered = useMemo(
    () => filterFeed(items, {
      regions: prefs.regions,
      topics: prefs.topics,
      query,
      onlyWithCountry: prefs.onlyWithCountry,
    }),
    [items, prefs.regions, prefs.topics, prefs.onlyWithCountry, query],
  );

  const handleRefresh = useCallback(async () => {
    if (loading || sources.length === 0) return;
    setLoading(true);
    sound.select();
    try {
      const { items: fresh, results: res } = await refreshSources(sources, index, {
        proxies,
      });
      setItems(fresh);
      setResults(res);
      const ids = sources.map((s) => s.id);
      await pulseCacheSet(fresh, ids);
      const m = await pulseCacheMeta();
      if (m) setMeta({ ts: m.ts, count: m.count });
    } finally {
      setLoading(false);
    }
  }, [loading, sources, index, proxies]);

  const handleClearCache = useCallback(async () => {
    await pulseCacheClear();
    setItems([]);
    setMeta(null);
    setResults([]);
  }, []);

  const toggleRegion = (r: PulseRegion) => {
    setPrefs((p) => ({
      ...p,
      regions: p.regions.includes(r) ? p.regions.filter((x) => x !== r) : [...p.regions, r],
    }));
  };
  const toggleTopic = (t: PulseTopic) => {
    setPrefs((p) => ({
      ...p,
      topics: p.topics.includes(t) ? p.topics.filter((x) => x !== t) : [...p.topics, t],
    }));
  };

  const okCount = results.filter((r) => r.ok).length;
  const maxScore = filtered[0]?.score ?? 1;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* ── Header ── */}
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-blood-bright glow-blood">
          The Pulse
        </h1>
        <p className="text-content-secondary text-sm mt-2 max-w-2xl">
          A client-side crisis reader. It consumes public RSS / Atom / nitter
          feeds, filters them through regional crisis keyword lexicons, and
          ranks every story by the platform&apos;s own vulnerability scores.
          Cached in IndexedDB — fully offline-readable.
        </p>
        <p className="text-[11px] text-content-dim mt-1">
          Distinct from <code className="text-command">/the-digest/</code> (which{" "}
          <em>generates</em> feeds from internal data) — The Pulse{" "}
          <em>consumes</em> the open web.
        </p>
      </header>

      {/* ── Status bar ── */}
      <TerminalCard title="Feed Status" accent={online ? "green" : "amber"}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <Stat label="Mode" value={online ? "LIVE" : "OFFLINE"} color={online ? "green" : "amber"} />
          <Stat label="Items" value={String(filtered.length)} sub={`${items.length} cached`} />
          <Stat label="Sources OK" value={`${okCount}/${sources.length}`} sub={loading ? "fetching…" : undefined} />
          <Stat label="Last Refresh" value={meta ? relativeTime(meta.ts) : "never"} sub={meta ? `${meta.count} items` : undefined} />
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={handleRefresh}
            disabled={loading || !online}
            className="inline-pill px-3 py-2 text-xs uppercase tracking-widest border border-blood text-blood-bright hover:bg-blood/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "▮▮ FETCHING…" : "↻ REFRESH FEEDS"}
          </button>
          <button
            onClick={() => setShowSources((v) => !v)}
            className="inline-pill px-3 py-2 text-xs uppercase tracking-widest border border-border-dim text-content-secondary hover:text-content-primary transition-colors"
          >
            {showSources ? "▾" : "▸"} Sources ({sources.length})
          </button>
          <button
            onClick={() => setShowProxies((v) => !v)}
            className="inline-pill px-3 py-2 text-xs uppercase tracking-widest border border-border-dim text-content-secondary hover:text-content-primary transition-colors"
          >
            {showProxies ? "▾" : "▸"} CORS Proxy
          </button>
          {items.length > 0 && (
            <button
              onClick={handleClearCache}
              className="inline-pill px-3 py-2 text-xs uppercase tracking-widest border border-border-dim text-content-dim hover:text-blood-bright hover:border-blood transition-colors ml-auto"
            >
              ✕ Clear Cache
            </button>
          )}
        </div>
      </TerminalCard>

      {/* ── Filters ── */}
      <TerminalCard title="Filters" accent="blood">
        <FilterRow label="Region">
          {ALL_REGIONS.map((r) => (
            <Chip key={r} active={prefs.regions.includes(r)} onClick={() => toggleRegion(r)} color="blood">
              {REGION_LABELS[r]}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Topic">
          {ALL_TOPICS.map((t) => (
            <Chip key={t} active={prefs.topics.includes(t)} onClick={() => toggleTopic(t)} color="command">
              {TOPIC_LABELS[t]}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="keyword, country, event…"
            className="flex-1 min-w-[180px] bg-void border border-border-dim text-content-primary text-xs px-3 py-1.5 focus:border-command focus:outline-none"
          />
        </FilterRow>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <ToggleBtn active={prefs.onlyWithCountry} onClick={() => setPrefs((p) => ({ ...p, onlyWithCountry: !p.onlyWithCountry }))}>
            Only country-linked
          </ToggleBtn>
          {(prefs.regions.length > 0 || prefs.topics.length > 0 || query || prefs.onlyWithCountry) && (
            <button
              onClick={() => { setQuery(""); setPrefs((p) => ({ ...p, regions: [], topics: [], onlyWithCountry: false })); }}
              className="text-[10px] uppercase tracking-widest text-content-dim hover:text-blood-bright transition-colors"
            >
              reset
            </button>
          )}
        </div>
      </TerminalCard>

      {/* ── Source manager ── */}
      {showSources && (
        <SourceManager
          prefs={prefs}
          setPrefs={setPrefs}
          results={results}
        />
      )}

      {/* ── Proxy settings ── */}
      {showProxies && (
        <ProxySettings prefs={prefs} setPrefs={setPrefs} proxies={proxies.length ? proxies.length : 3} />
      )}

      {/* ── Ranked feed ── */}
      <TerminalCard title={`Ranked Feed — ${filtered.length}`} accent="blood">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-content-dim text-sm">
            {items.length === 0 ? (
              <>
                <p className="mb-2">No feed cached yet.</p>
                <p>Press <span className="text-blood-bright">↻ REFRESH FEEDS</span> to pull public crisis sources.</p>
                {!online && <p className="mt-2 text-warning-amber">You are offline — connect to fetch.</p>}
              </>
            ) : (
              <p>No items match the current filters. Reset filters or refresh.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {filtered.slice(0, 200).map((it, i) => (
              <FeedRow key={it.id} item={it} rank={i + 1} maxScore={maxScore} />
            ))}
          </div>
        )}
      </TerminalCard>

      <p className="text-[10px] text-content-dim text-center pb-4">
        Public feeds via configurable CORS proxies. Nothing is tracked; every item is cached
        locally and survives offline use. Add a self-hosted RSS-Bridge instance for full privacy.
      </p>
    </div>
  );
}

/* ═══ SUB-COMPONENTS ═══ */

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: "green" | "amber" }) {
  const c = color === "green" ? "var(--color-terminal-green)" : color === "amber" ? "var(--color-warning-amber)" : "var(--color-content-primary)";
  return (
    <div className="border border-border-dim p-2">
      <div className="text-[9px] uppercase tracking-widest text-content-dim">{label}</div>
      <div className="text-lg font-bold tabular-nums" style={{ color: c }}>{value}</div>
      {sub && <div className="text-[9px] text-content-dim">{sub}</div>}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
      <span className="text-[10px] uppercase tracking-widest text-content-dim w-16 shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1.5 flex-1">{children}</div>
    </div>
  );
}

function FeedRow({ item, rank, maxScore }: { item: PulseItem; rank: number; maxScore: number }) {
  const pct = Math.round((item.score / (maxScore || 1)) * 100);
  return (
    <a
      href={item.link || undefined}
      target={item.link ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="block p-2.5 border border-border-dim hover:border-command-dim transition-colors group"
      style={{ background: item.vulnerabilityBoost > 50 ? "rgba(196,43,62,0.06)" : "transparent" }}
    >
      <div className="flex items-start gap-2">
        <span className="text-[10px] text-content-dim tabular-nums w-7 shrink-0 pt-0.5">
          {String(rank).padStart(3, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <span className="text-sm text-content-primary group-hover:text-command-bright transition-colors">
              {item.title}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <StatusPill color={regionColor(item.region)}>{REGION_LABELS[item.region]}</StatusPill>
              {item.vulnerabilityBoost > 0 && (
                <span
                  className="inline-pill text-[9px] px-1.5 py-0.5 border tabular-nums"
                  style={{
                    borderColor: "var(--color-blood)",
                    color: "var(--color-blood-bright)",
                    background: "rgba(196,43,62,0.10)",
                  }}
                  title="Max composite vulnerability of matched countries"
                >
                  V:{item.vulnerabilityBoost.toFixed(0)}
                </span>
              )}
            </div>
          </div>
          {item.summary && (
            <p className="text-[11px] text-content-secondary mt-1 line-clamp-2">{item.summary}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="text-[9px] text-content-dim">
              {item.sourceTitle} · {relativeTime(item.published)}
            </span>
            {item.matchedTopics.slice(0, 3).map((t) => (
              <span key={t} className="text-[9px] uppercase tracking-wider text-command/80">
                #{t}
              </span>
            ))}
            {item.matchedIso3.slice(0, 4).map((iso3) => (
              <span key={iso3} className="text-[9px] uppercase tracking-wider text-blood-bright/80">
                {iso3}
              </span>
            ))}
          </div>
          <div className="mt-1.5">
            <DataBar value={pct} max={100} label="rank" />
          </div>
        </div>
      </div>
    </a>
  );
}

function SourceManager({
  prefs,
  setPrefs,
  results,
}: {
  prefs: PulsePrefs;
  setPrefs: React.Dispatch<React.SetStateAction<PulsePrefs>>;
  results: FetchResult[];
}) {
  const allSources = useMemo(() => [...DEFAULT_SOURCES, ...prefs.customSources], [prefs.customSources]);
  const [customUrl, setCustomUrl] = useState("");
  const [customTitle, setCustomTitle] = useState("");

  const isEnabled = (id: string) => prefs.enabledSources.length === 0 || prefs.enabledSources.includes(id);

  const toggle = (id: string) => {
    setPrefs((p) => {
      const base = p.enabledSources.length === 0 ? allSources.map((s) => s.id) : p.enabledSources;
      const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
      // If everything ends up enabled, collapse back to "all" (empty).
      return { ...p, enabledSources: next.length === allSources.length ? [] : next };
    });
  };

  const addCustom = () => {
    const url = customUrl.trim();
    if (!url) return;
    const title = customTitle.trim() || url;
    const id = `custom-${Date.now().toString(36)}`;
    setPrefs((p) => ({
      ...p,
      customSources: [
        ...p.customSources,
        { id, title, url, kind: "rss", region: "Global", topics: [] } satisfies PulseSource,
      ],
    }));
    setCustomUrl("");
    setCustomTitle("");
  };

  const removeCustom = (id: string) => {
    setPrefs((p) => ({
      ...p,
      customSources: p.customSources.filter((s) => s.id !== id),
      enabledSources: p.enabledSources.filter((x) => x !== id),
    }));
  };

  const resultMap = useMemo(() => Object.fromEntries(results.map((r) => [r.sourceId, r])), [results]);

  return (
    <TerminalCard title="Source Manager" accent="green">
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {allSources.map((s) => {
          const enabled = isEnabled(s.id);
          const res = resultMap[s.id];
          return (
            <div key={s.id} className="flex items-center gap-2 p-2 border border-border-dim">
              <button
                onClick={() => toggle(s.id)}
                className="inline-pill w-16 shrink-0 text-[9px] uppercase tracking-widest border px-1.5 py-1 transition-colors"
                style={{
                  borderColor: enabled ? "var(--color-terminal-green)" : "var(--color-border-dim)",
                  color: enabled ? "var(--color-terminal-green)" : "var(--content-dim, #555)",
                }}
              >
                {enabled ? "● ON" : "○ OFF"}
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-content-primary truncate">
                  {s.title} <span className="text-content-dim">— {s.org ?? s.kind}</span>
                </div>
                {s.note && <div className="text-[10px] text-content-dim truncate">{s.note}</div>}
                <code className="text-[9px] text-command/60 break-all">{s.url}</code>
              </div>
              {res && (
                <span
                  className="inline-pill text-[9px] px-1.5 py-0.5 border shrink-0"
                  style={{
                    borderColor: res.ok ? "var(--color-terminal-green)" : "var(--color-blood)",
                    color: res.ok ? "var(--color-terminal-green)" : "var(--color-blood-bright)",
                  }}
                  title={res.error}
                >
                  {res.ok ? `${res.items.length}` : "ERR"}
                </span>
              )}
              {prefs.customSources.some((c) => c.id === s.id) && (
                <button
                  onClick={() => removeCustom(s.id)}
                  className="text-content-dim hover:text-blood-bright text-xs shrink-0"
                  aria-label={`Remove ${s.title}`}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add custom feed */}
      <div className="mt-3 pt-3 border-t border-border-dim">
        <div className="text-[10px] uppercase tracking-widest text-content-dim mb-2">+ Add custom feed (RSS / Atom / nitter)</div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="title (optional)"
            className="bg-void border border-border-dim text-content-primary text-xs px-2 py-1.5 w-40 focus:border-command focus:outline-none"
          />
          <input
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://example.org/feed.xml"
            className="flex-1 min-w-[200px] bg-void border border-border-dim text-content-primary text-xs px-2 py-1.5 focus:border-command focus:outline-none"
          />
          <button
            onClick={addCustom}
            disabled={!customUrl.trim()}
            className="px-3 py-1.5 text-xs uppercase tracking-widest border border-command text-command hover:bg-command/10 transition-colors disabled:opacity-40"
          >
            Add
          </button>
        </div>
        <p className="text-[10px] text-content-dim mt-1.5">
          {allSources.filter((s) => isEnabled(s.id)).length} active of {allSources.length} total.
        </p>
      </div>
    </TerminalCard>
  );
}

function ProxySettings({
  prefs,
  setPrefs,
  proxies,
}: {
  prefs: PulsePrefs;
  setPrefs: React.Dispatch<React.SetStateAction<PulsePrefs>>;
  proxies: number;
}) {
  const [text, setText] = useState(prefs.proxies.join("\n"));
  useEffect(() => setText(prefs.proxies.join("\n")), [prefs.proxies]);

  const apply = () => {
    const list = text.split("\n").map((s) => s.trim()).filter(Boolean);
    setPrefs((p) => ({ ...p, proxies: list }));
  };
  const reset = () => {
    setText("");
    setPrefs((p) => ({ ...p, proxies: [] }));
  };

  return (
    <TerminalCard title="CORS Proxy Chain" accent="amber">
      <p className="text-[11px] text-content-secondary mb-2">
        Browsers block cross-origin feed fetches. We try a direct request, then walk this proxy
        chain. One URL per line; use <code className="text-command">%s</code> for the encoded URL.
        Empty = use the public defaults ({proxies} built-in).
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={"https://my-rss-bridge.example/?url=%s\nhttps://api.allorigins.win/raw?url=%s"}
        className="w-full bg-void border border-border-dim text-content-primary text-[11px] px-2 py-1.5 font-mono focus:border-command focus:outline-none"
      />
      <div className="flex gap-2 mt-2">
        <button onClick={apply} className="px-3 py-1.5 text-xs uppercase tracking-widest border border-command text-command hover:bg-command/10 transition-colors">
          Apply
        </button>
        <button onClick={reset} className="px-3 py-1.5 text-xs uppercase tracking-widest border border-border-dim text-content-secondary hover:text-content-primary transition-colors">
          Reset to defaults
        </button>
      </div>
      <p className="text-[10px] text-content-dim mt-2">
        For full privacy + reliability, self-host RSS-Bridge and put its URL above as the only entry.
      </p>
    </TerminalCard>
  );
}
