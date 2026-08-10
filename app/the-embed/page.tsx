"use client";

/**
 * V FOR X — The Embed
 *
 * A dedicated widget builder that promotes the iframe generator out of the
 * export utils into a first-class syndication tool. Pick a visual, configure
 * it, preview it live, and copy drop-in embed code for any blog or news site.
 *
 * Virality through syndication: every embedded widget carries a V FOR X
 * attribution back-link, turning third-party coverage into distribution.
 */

import { useMemo, useState } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import GlitchText from "@/components/ui/GlitchText";
import { sound } from "@/lib/sound";
import { useStore } from "@/stores/useStore";
import { t } from "@/lib/i18n";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import {
  WIDGETS,
  WIDGET_ORDER,
  generateWidgetIframe,
  generateWidgetScript,
  generateDirectLink,
  buildEmbedSrc,
  resolveParams,
  type WidgetType,
  type EmbedTheme,
  type EmbedOptions,
  type WidgetOption,
} from "@/lib/embed-widgets";

const data = backbone as WorldBackbone;

/** All 200 countries as options for the brief widget. */
const ALL_COUNTRIES: WidgetOption[] = [...data.countries]
  .sort((a, b) => a.name_en.localeCompare(b.name_en))
  .map((c) => ({
    value: c.iso3,
    label: c.name_en,
    description: c.is_hotspot ? `${c.region} · hotspot` : c.region,
  }));

type SnippetTab = "iframe" | "script" | "link";

export default function TheEmbedPage() {
  const { lang } = useStore();
  const [widgetType, setWidgetType] = useState<WidgetType>("sorrow-map");
  const [params, setParams] = useState<Record<WidgetType, Record<string, string>>>(() => ({
    "sorrow-map": resolveParams("sorrow-map"),
    lives: resolveParams("lives"),
    countdown: resolveParams("countdown"),
    brief: resolveParams("brief"),
  }));
  const [theme, setTheme] = useState<EmbedTheme>("dark");
  const [height, setHeight] = useState<number>(WIDGETS["sorrow-map"].defaultHeight);
  const [width, setWidth] = useState<string>("100%");
  const [snippetTab, setSnippetTab] = useState<SnippetTab>("iframe");
  const [copied, setCopied] = useState<string | null>(null);

  const spec = WIDGETS[widgetType];

  const options: EmbedOptions = useMemo(
    () => ({
      type: widgetType,
      params: params[widgetType],
      theme,
      height,
      width,
    }),
    [widgetType, params, theme, height, width]
  );

  const previewSrc = useMemo(
    () => buildEmbedSrc(options, false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [widgetType, params, theme]
  );

  const snippets = useMemo(
    () => ({
      iframe: generateWidgetIframe(options),
      script: generateWidgetScript(options),
      link: generateDirectLink(options),
    }),
    [options]
  );

  const currentSnippet = snippets[snippetTab];

  const selectWidget = (type: WidgetType) => {
    setWidgetType(type);
    setHeight(WIDGETS[type].defaultHeight);
    sound.select();
  };

  const setParam = (key: string, value: string) => {
    setParams((prev) => ({ ...prev, [widgetType]: { ...prev[widgetType], [key]: value } }));
    sound.select();
  };

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      sound.copy();
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {
      sound.error();
    }
  };

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 border-b border-border-dim pb-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <GlitchText
            text="THE EMBED"
            as="h1"
            className="text-2xl md:text-3xl font-bold text-blood-bright glow-blood tracking-widest"
          />
          <span className="text-[10px] px-2 py-0.5 border border-terminal-green text-terminal-green uppercase tracking-widest">
            syndication
          </span>
        </div>
        <p className="text-sm text-content-secondary mt-2 max-w-2xl">
          <span className="text-content-dim">{">"}</span> Turn the strongest visuals into
          drop-in widgets. Configure, preview, copy. Every embed carries a V FOR X
          attribution — virality through syndication.
        </p>
      </div>

      {/* Step 1 — pick a widget */}
      <div className="text-[10px] uppercase tracking-widest text-content-dim mb-2">
        // 01 · choose a widget
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-6">
        {WIDGET_ORDER.map((type) => {
          const w = WIDGETS[type];
          const active = type === widgetType;
          return (
            <button
              key={type}
              onClick={() => selectWidget(type)}
              className={`border p-3 text-left transition-all ${
                active
                  ? "border-blood bg-blood/10 pulse-blood"
                  : "border-border-dim hover:border-blood"
              }`}
            >
              <div className="text-2xl mb-1">{w.glyph}</div>
              <div
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: active ? "var(--color-blood-bright)" : "var(--color-content-primary)" }}
              >
                {w.name}
              </div>
              <div className="text-[10px] text-content-dim mt-1 leading-snug">
                {w.blurb}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Step 2 — configure */}
        <div className="space-y-4">
          <TerminalCard title="02 · configure" accent="amber">
            <div className="space-y-3">
              {spec.params.map((p) => (
                <div key={p.key}>
                  <label className="text-[10px] uppercase tracking-widest text-content-dim block mb-1">
                    {p.label}
                  </label>
                  {p.key === "country" ? (
                    <select
                      value={params[widgetType][p.key]}
                      onChange={(e) => setParam(p.key, e.target.value)}
                      className="w-full bg-void border border-border-dim px-2 py-1.5 text-xs text-content-primary focus:border-blood focus:outline-none"
                    >
                      <optgroup label="Featured crises">
                        {p.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label} — {o.description}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="All countries (200)">
                        {ALL_COUNTRIES.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  ) : (
                    <select
                      value={params[widgetType][p.key]}
                      onChange={(e) => setParam(p.key, e.target.value)}
                      className="w-full bg-void border border-border-dim px-2 py-1.5 text-xs text-content-primary focus:border-blood focus:outline-none"
                    >
                      {p.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                          {o.description ? ` — ${o.description}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}

              {/* Theme */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-content-dim block mb-1">
                  Theme
                </label>
                <div className="flex gap-1">
                  {(["dark", "light"] as EmbedTheme[]).map((th) => (
                    <button
                      key={th}
                      onClick={() => { setTheme(th); sound.select(); }}
                      className={`flex-1 py-1.5 text-[10px] uppercase border transition-colors ${
                        theme === th
                          ? "border-blood text-blood-bright bg-blood/10"
                          : "border-border-dim text-content-secondary hover:border-blood"
                      }`}
                    >
                      {th === "dark" ? "◼ dark" : "◻ light"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Height */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-content-dim flex justify-between mb-1">
                  <span>Height</span>
                  <span className="text-blood-bright">{height}px</span>
                </label>
                <input
                  type="range"
                  min={spec.heightRange[0]}
                  max={spec.heightRange[1]}
                  step={10}
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="w-full accent-[var(--color-blood)]"
                />
              </div>

              {/* Width */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-content-dim block mb-1">
                  Width
                </label>
                <input
                  type="text"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder="100% or 480px"
                  className="w-full bg-void border border-border-dim px-2 py-1.5 text-xs text-content-primary focus:border-blood focus:outline-none"
                />
              </div>
            </div>
          </TerminalCard>

          {/* How-to */}
          <TerminalCard title="how to embed" accent="green">
            <ol className="text-[11px] text-content-secondary space-y-1.5 list-decimal list-inside">
              <li>Configure your widget.</li>
              <li>Copy the snippet.</li>
              <li>Paste into your CMS, blog, or article HTML.</li>
            </ol>
            <div className="text-[10px] text-content-dim mt-2 italic">
              ▸ Works with WordPress, Ghost, Substack (custom), Medium (via embed URL),
              and any HTML page. No API key, no tracking, CC0 data.
            </div>
          </TerminalCard>
        </div>

        {/* Step 3 — preview & copy */}
        <div className="space-y-4">
          <TerminalCard title="03 · live preview" glow>
            <div
              className="border border-border-dim bg-void p-2"
              style={{ backgroundColor: theme === "light" ? "#f5f7fa" : "#060b14" }}
            >
              <div
                className="mx-auto transition-all"
                style={{
                  width: width === "100%" ? "100%" : width,
                  height: `${height}px`,
                  maxWidth: "100%",
                }}
              >
                <iframe
                  key={previewSrc}
                  src={previewSrc}
                  title={`${spec.name} preview`}
                  width="100%"
                  height={height}
                  frameBorder={0}
                  scrolling="no"
                  loading="lazy"
                  style={{
                    border: "1px solid var(--color-border-dim)",
                    borderRadius: 4,
                    width: "100%",
                    height: "100%",
                  }}
                />
              </div>
            </div>
          </TerminalCard>

          {/* Snippet */}
          <TerminalCard title="04 · copy embed code" accent="amber">
            {/* Tabs */}
            <div className="flex gap-1 mb-2">
              {([
                ["iframe", "</> iframe"],
                ["script", "⌗ script"],
                ["link", "↗ link"],
              ] as [SnippetTab, string][]).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => { setSnippetTab(tab); sound.select(); }}
                  className={`flex-1 py-1.5 text-[10px] uppercase border transition-colors ${
                    snippetTab === tab
                      ? "border-blood text-blood-bright bg-blood/10"
                      : "border-border-dim text-content-secondary hover:border-blood"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Code block */}
            <div className="relative">
              <pre className="text-[10px] text-content-secondary bg-void border border-border-dim p-3 overflow-x-auto max-h-56 overflow-y-auto whitespace-pre-wrap break-all font-mono">
                {currentSnippet}
              </pre>
              <button
                onClick={() => copy(snippetTab, currentSnippet)}
                className={`absolute top-2 right-2 text-[9px] px-2 py-1 border uppercase transition-colors ${
                  copied === snippetTab
                    ? "border-terminal-green text-terminal-green"
                    : "border-border-dim text-content-dim hover:border-blood hover:text-blood-bright bg-void"
                }`}
              >
                {copied === snippetTab ? "✓ copied" : "⧉ copy"}
              </button>
            </div>

            <div className="text-[10px] text-content-dim mt-2">
              {snippetTab === "iframe" && "▸ Standard <iframe> — paste into any HTML."}
              {snippetTab === "script" && "▸ Self-contained block with a stable container ID."}
              {snippetTab === "link" && "▸ Direct URL — use in platforms that accept embed URLs."}
            </div>
          </TerminalCard>

          {/* Syndication note */}
          <div className="border border-terminal-green/40 bg-terminal-green/5 p-3">
            <div className="text-[10px] uppercase tracking-widest text-terminal-green mb-1">
              ▸ syndication built-in
            </div>
            <p className="text-[11px] text-content-secondary">
              Every widget renders a <span className="text-terminal-green">V FOR X</span> attribution
              link back to the platform. Each embed on a blog or news site becomes a distribution
              node — spreading the argument and driving readers to the full data. The more it
              spreads, the harder it is to ignore.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
