"use client";

/**
 * V FOR X — The Digest
 *
 * Build a personalized crisis digest: pick countries and topics, choose a
 * cadence, then get a shareable URL, an RSS feed (for follow.it /
 * Blogtrottr), a styled HTML email, and a QR code — all generated live.
 */

import { useEffect, useMemo, useState } from "react";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, CountryData } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import {
  getTopicFilters,
  generateDigestURL,
  generateDigestHTML,
  generateDigestRSS,
  generateFollowItURL,
  generateBlogtrotrURL,
  encodeDigestConfig,
} from "@/lib/digest-builder";

const data = backbone as WorldBackbone;

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

const TOPICS = getTopicFilters();

/** Group countries by region, sorted by name, for the multi-selector. */
const REGION_GROUPS = (() => {
  const map = new Map<string, CountryData[]>();
  for (const c of data.countries) {
    if (!map.has(c.region)) map.set(c.region, []);
    map.get(c.region)!.push(c);
  }
  for (const list of map.values()) list.sort((a, b) => a.name_en.localeCompare(b.name_en));
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
})();

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    try {
      navigator.clipboard?.writeText(text);
    } catch {
      /* clipboard unavailable — ignore */
    }
    setCopied(key);
    window.setTimeout(() => setCopied(null), 2000);
  };
  return { copied, copy };
}

/* ── Pseudo-QR: deterministic visual matrix from the digest URL ── */

/** Cheap, deterministic 32-bit string hash (FNV-1a variant). */
function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A seeded PRNG so each URL yields a stable but varied fill pattern. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build a SIZE×SIZE boolean matrix that *looks* like a QR code (not scannable). */
function buildQrMatrix(content: string, size = 25): boolean[][] {
  const rng = mulberry32(hash32(content));
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => rng() > 0.55),
  );
  // Finder patterns (7×7) in three corners — the classic QR look.
  const stampFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const edge = r === 0 || r === 6 || c === 0 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[r0 + r][c0 + c] = edge || core;
      }
    }
    // Quiet separator ring (clear the 1-cell border around the finder).
    for (let i = -1; i <= 7; i++) {
      for (let j = -1; j <= 7; j++) {
        const rr = r0 + i;
        const cc = c0 + j;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        if (i === -1 || i === 7 || j === -1 || j === 7) grid[rr][cc] = false;
      }
    }
  };
  stampFinder(0, 0);
  stampFinder(0, size - 7);
  stampFinder(size - 7, 0);
  return grid;
}

function QrCode({ content, size = 192 }: { content: string; size?: number }) {
  const cells = 25;
  const matrix = useMemo(() => buildQrMatrix(content, cells), [content]);
  const unit = size / cells;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Digest URL QR-style code"
      style={{ background: "#dfe7f5", display: "block" }}
    >
      {matrix.flatMap((row, r) =>
        row.map((on, c) =>
          on ? (
            <rect
              key={`${r}-${c}`}
              x={c * unit}
              y={r * unit}
              width={unit}
              height={unit}
              fill="#060b14"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

/* ── Small UI primitives ── */

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-xs uppercase tracking-widest border transition-colors"
      style={{
        borderColor: active ? "var(--color-terminal-green)" : "var(--color-border-dim)",
        color: active ? "var(--color-terminal-green)" : "var(--color-content-secondary)",
        background: active ? "rgba(34,211,166,0.08)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

function ActionBtn({
  onClick,
  href,
  children,
  accent = "command",
}: {
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
  accent?: "command" | "green" | "blood";
}) {
  const color =
    accent === "green"
      ? "var(--color-terminal-green)"
      : accent === "blood"
        ? "var(--color-blood-bright)"
        : "var(--color-command-bright)";
  const common =
    "inline-flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-widest border transition-colors";
  const style = {
    borderColor: color,
    color,
    background: "transparent",
  };
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={common} style={style}>
        {children}
      </a>
    );
  }
  return (
    <button onClick={onClick} className={common} style={style}>
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════ */

export default function TheDigestPage() {
  const { copied, copy } = useCopy();

  const [selected, setSelected] = useState<Set<string>>(
    new Set(["SDN", "YEM", "AFG", "SYR", "HTI"]),
  );
  const [topics, setTopics] = useState<Set<string>>(new Set(["hunger", "conflict", "displacement"]));
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [query, setQuery] = useState("");
  const [collapsedRegions, setCollapsedRegions] = useState<Set<string>>(new Set());

  // Hydrate selection from a shared ?cfg= link on first load.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cfg = new URLSearchParams(window.location.search).get("cfg");
    if (!cfg) return;
    try {
      const decoded = JSON.parse(atob(cfg));
      if (Array.isArray(decoded.iso3s)) {
        setSelected(new Set(decoded.iso3s));
        if (Array.isArray(decoded.topics)) setTopics(new Set(decoded.topics));
        if (decoded.frequency === "weekly") setFrequency("weekly");
      }
    } catch {
      /* malformed cfg — ignore */
    }
  }, []);

  const config = useMemo(
    () => ({
      iso3s: [...selected],
      topics: [...topics],
      frequency,
    }),
    [selected, topics, frequency],
  );

  const selectedCountries = useMemo(
    () =>
      data.countries
        .filter((c) => selected.has(c.iso3))
        .sort((a, b) => a.name_en.localeCompare(b.name_en)),
    [selected],
  );

  const digestUrl = useMemo(() => generateDigestURL(config), [config]);
  const rssUrl = useMemo(
    () => `${digestUrl.replace("/the-digest/?cfg=", "/the-digest/feed.xml?cfg=")}`,
    [digestUrl],
  );
  const rssXml = useMemo(
    () => generateDigestRSS(selectedCountries, config),
    [selectedCountries, config],
  );
  const htmlEmail = useMemo(
    () => generateDigestHTML(selectedCountries, config),
    [selectedCountries, config],
  );

  const toggleCountry = (iso3: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(iso3) ? next.delete(iso3) : next.add(iso3);
      return next;
    });

  const toggleTopic = (key: string) =>
    setTopics((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const toggleRegion = (region: string) =>
    setCollapsedRegions((prev) => {
      const next = new Set(prev);
      next.has(region) ? next.delete(region) : next.add(region);
      return next;
    });

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return REGION_GROUPS;
    return REGION_GROUPS.map(([region, list]) => [
      region,
      list.filter((c) => c.name_en.toLowerCase().includes(q) || c.iso3.toLowerCase().includes(q)),
    ]).filter(([, list]) => (list as CountryData[]).length > 0) as [string, CountryData[]][];
  }, [query]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* ── Header ── */}
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-blood-bright glow-blood">
          The Digest
        </h1>
        <p className="text-content-secondary mt-2 text-sm max-w-2xl">
          Build a personalized crisis feed. Choose countries and topics, pick a cadence,
          then deliver it to your inbox via RSS-to-email or share the link.
        </p>
      </header>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ═══ LEFT: CONFIGURATION ═══ */}
        <div className="space-y-6">
          {/* Country selector */}
          <TerminalCard title="select countries" accent="green">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="search country or ISO3…"
                className="flex-1 min-w-[120px] bg-void border border-border-dim px-2 py-1 text-sm text-content-primary outline-none focus:border-command"
                style={{ minWidth: 0 }}
              />
              <span className="text-xs text-content-dim">
                {selected.size} selected
              </span>
            </div>

            <div className="max-h-[320px] overflow-y-auto pr-1 space-y-2">
              {filteredGroups.map(([region, list]) => {
                const collapsed = collapsedRegions.has(region);
                const regionSel = list.filter((c) => selected.has(c.iso3)).length;
                return (
                  <div key={region} className="border border-border-dim">
                    <button
                      onClick={() => toggleRegion(region)}
                      className="w-full flex items-center justify-between px-2 py-1.5 text-xs uppercase tracking-widest text-content-secondary hover:text-command"
                    >
                      <span>
                        {collapsed ? "▸" : "▾"} {region}
                      </span>
                      <span className="text-content-dim">{regionSel}/{list.length}</span>
                    </button>
                    {!collapsed && (
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 px-2 pb-2">
                        {list.map((c) => {
                          const on = selected.has(c.iso3);
                          return (
                            <label
                              key={c.iso3}
                              className="flex items-center gap-2 text-xs py-0.5 cursor-pointer hover:text-command"
                              style={{ color: on ? "var(--color-content-primary)" : undefined }}
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => toggleCountry(c.iso3)}
                                className="accent-[var(--color-terminal-green)]"
                              />
                              <span className="truncate">{c.name_en}</span>
                              <span className="text-content-dim ml-auto">{c.iso3}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </TerminalCard>

          {/* Topic selector */}
          <TerminalCard title="select topics" accent="green">
            <div className="space-y-1.5">
              {TOPICS.map((t) => {
                const on = topics.has(t.key);
                return (
                  <label
                    key={t.key}
                    className="flex items-start gap-2 text-sm cursor-pointer p-1.5 border border-transparent hover:border-border-dim"
                    style={{ background: on ? "rgba(34,211,166,0.05)" : undefined }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleTopic(t.key)}
                      className="mt-1 accent-[var(--color-terminal-green)]"
                    />
                    <span>
                      <span
                        className="font-bold"
                        style={{ color: on ? "var(--color-terminal-green)" : "var(--color-content-primary)" }}
                      >
                        {t.label}
                      </span>
                      <span className="block text-xs text-content-dim">{t.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </TerminalCard>

          {/* Frequency */}
          <TerminalCard title="cadence" accent="green">
            <div className="flex gap-2">
              <ToggleBtn active={frequency === "daily"} onClick={() => setFrequency("daily")}>
                Daily
              </ToggleBtn>
              <ToggleBtn active={frequency === "weekly"} onClick={() => setFrequency("weekly")}>
                Weekly
              </ToggleBtn>
            </div>
            <p className="text-xs text-content-dim mt-2">
              The cadence label is baked into the feed title; the actual delivery frequency is
              controlled by your RSS-to-email provider.
            </p>
          </TerminalCard>
        </div>

        {/* ═══ RIGHT: OUTPUT ═══ */}
        <div className="space-y-6">
          {/* Live preview */}
          <TerminalCard title="live email preview" accent="blood">
            <div className="text-xs text-content-dim mb-2">
              {selectedCountries.length} countries · {topics.size || "all"} topics ·{" "}
              {frequency}
            </div>
            <iframe
              title="Digest email preview"
              srcDoc={htmlEmail}
              className="w-full bg-void border border-border-dim"
              style={{ height: 340 }}
            />
          </TerminalCard>

          {/* QR + share */}
          <TerminalCard title="share & subscribe" accent="blood">
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="shrink-0">
                <QrCode content={digestUrl} />
                <p className="text-[10px] text-content-dim mt-1 max-w-[192px]">
                  QR-style visual of the digest link (deterministic, not a scan code).
                </p>
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="text-xs text-content-secondary break-all bg-panel border border-border-dim p-2">
                  {digestUrl}
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionBtn onClick={() => copy(rssUrl, "rss")}>
                    {copied === "rss" ? "✓ Copied" : "Copy RSS URL"}
                  </ActionBtn>
                  <ActionBtn onClick={() => copy(htmlEmail, "html")}>
                    {copied === "html" ? "✓ Copied" : "Copy Email HTML"}
                  </ActionBtn>
                  <ActionBtn onClick={() => copy(digestUrl, "url")}>
                    {copied === "url" ? "✓ Copied" : "Copy Link"}
                  </ActionBtn>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <ActionBtn href={generateFollowItURL(config)} accent="green">
                    Subscribe via follow.it ↗
                  </ActionBtn>
                  <ActionBtn href={generateBlogtrotrURL(config)} accent="green">
                    Subscribe via Blogtrottr ↗
                  </ActionBtn>
                </div>
              </div>
            </div>
          </TerminalCard>

          {/* Raw RSS */}
          <TerminalCard title="raw rss feed (preview)" accent="amber">
            <pre className="text-[10px] leading-relaxed text-content-secondary max-h-48 overflow-auto whitespace-pre-wrap break-all">
              {rssXml.slice(0, 1400)}
              {rssXml.length > 1400 ? "\n…[truncated]" : ""}
            </pre>
            <div className="text-[10px] text-content-dim mt-1">
              cfg token: <code className="text-content-secondary">{encodeDigestConfig(config)}</code>
            </div>
          </TerminalCard>
        </div>
      </div>
    </div>
  );
}
