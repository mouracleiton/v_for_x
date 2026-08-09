"use client";

/**
 * V FOR X — The Alerts
 *
 * Live crisis cockpit: animated death/displacement counters, an RSS feed
 * preview, subscription instructions (Telegram / Signal / RSS), a
 * color-coded country alert board, and a bot integration guide.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, CountryData } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import DataBar from "@/components/ui/DataBar";
import { LiveCounterGrid } from "@/components/shared/LiveCounter";
import { SITE } from "@/lib/seo";
import { formatNumber } from "@/lib/format";
import {
  generateCrisisRSS,
  generateTelegramAlert,
  crisisScore,
  getAlertSeverity,
  getCrisisCategory,
  describeCountry,
  ALERT_CATEGORIES,
  type AlertSeverity,
} from "@/lib/alert-feeds";

const data = backbone as WorldBackbone;

/* ═══ HELPERS ═══ */

const SEVERITY_META: Record<
  AlertSeverity,
  { color: "blood" | "amber" | "green"; label: string; bg: string }
> = {
  critical: { color: "blood", label: "CRITICAL", bg: "rgba(196,43,62,0.15)" },
  severe: { color: "amber", label: "SEVERE", bg: "rgba(240,169,59,0.12)" },
  moderate: { color: "green", label: "MODERATE", bg: "rgba(34,211,166,0.10)" },
};

const FEED_URL = `${SITE.url}/crisis-alerts.xml`;

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    try {
      navigator.clipboard?.writeText(text);
    } catch {
      /* clipboard unavailable (non-secure context) — ignore */
    }
    setCopied(key);
    window.setTimeout(() => setCopied(null), 2000);
  };
  return { copied, copy };
}

/* ═══ PAGE ═══ */

export default function TheAlertsPage() {
  const { copied, copy } = useCopy();
  const [showXml, setShowXml] = useState(false);
  const [previewIso, setPreviewIso] = useState<string | null>(null);

  const top20 = useMemo(
    () =>
      [...data.countries]
        .sort((a, b) => crisisScore(b) - crisisScore(a))
        .slice(0, 20),
    [],
  );

  const rssXml = useMemo(() => generateCrisisRSS(data.countries), []);

  const telegramPreview = useMemo(() => {
    const c = top20.find((x) => x.iso3 === previewIso) ?? top20[0];
    return c ? generateTelegramAlert(c) : "";
  }, [previewIso, top20]);

  const maxScore = crisisScore(top20[0] ?? { hunger: {}, conflict: {} } as CountryData) || 1;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* ── Header ── */}
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-blood-bright glow-blood">
          The Alerts
        </h1>
        <p className="text-content-secondary text-sm mt-2 max-w-2xl">
          Machine-readable crisis intelligence. Subscribe via RSS, Telegram, or
          Signal and let the data break through the noise. Every alert is
          traceable to open sources (CC0).
        </p>
      </header>

      {/* ── Live Counters ── */}
      <LiveCounterGrid />

      {/* ── Live Crisis Feed (preview) ── */}
      <TerminalCard title="Live Crisis Feed — Top 20" accent="blood">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-[10px] uppercase tracking-widest text-content-dim">
            Endpoint:
          </span>
          <code className="text-[11px] text-terminal-green bg-void px-2 py-0.5 border border-border-dim">
            {FEED_URL}
          </code>
          <button
            onClick={() => copy(FEED_URL, "feed")}
            className="inline-pill text-[10px] uppercase tracking-wider px-2 py-1 border border-command-dim text-command hover:bg-command-dim/20 transition-colors"
          >
            {copied === "feed" ? "✓ Copied" : "Copy URL"}
          </button>
          <button
            onClick={() => setShowXml((v) => !v)}
            className="inline-pill text-[10px] uppercase tracking-wider px-2 py-1 border border-border-dim text-content-secondary hover:text-content-primary transition-colors"
          >
            {showXml ? "Hide raw XML" : "View raw XML"}
          </button>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {top20.map((c, i) => {
            const sev = getAlertSeverity(c);
            const meta = SEVERITY_META[sev];
            const cat = getCrisisCategory(c);
            return (
              <Link
                key={c.iso3}
                href={`/sorrow-map/${c.iso3.toLowerCase()}/`}
                className="block p-2 border border-border-dim hover:border-command-dim transition-colors group"
                style={{ background: meta.bg }}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] text-content-dim tabular-nums w-5 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm text-content-primary group-hover:text-command-bright transition-colors truncate">
                      {c.name_en}
                    </span>
                    <StatusPill color={meta.color}>{meta.label}</StatusPill>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-content-dim shrink-0">
                    {ALERT_CATEGORIES[cat]}
                  </span>
                </div>
                <div className="text-[11px] text-content-secondary mt-1 pl-7">
                  {describeCountry(c)}
                </div>
              </Link>
            );
          })}
        </div>

        {showXml && (
          <pre className="mt-3 p-3 bg-void border border-border-dim text-[10px] leading-relaxed text-terminal-green overflow-x-auto max-h-72">
            {rssXml}
          </pre>
        )}
      </TerminalCard>

      {/* ── Subscribe ── */}
      <TerminalCard title="Subscribe — Get The Signal" accent="green">
        <div className="grid md:grid-cols-3 gap-4">
          <SubscribeCard
            emoji="📨"
            title="RSS Reader"
            steps={[
              "Open your RSS reader (Feedly, Inoreader, NetNewsWire).",
              "Add a new subscription.",
              "Paste the crisis-alerts.xml URL.",
            ]}
            onCopy={() => copy(FEED_URL, "rss")}
            copied={copied === "rss"}
          />
          <SubscribeCard
            emoji="✈️"
            title="Telegram"
            steps={[
              "Message @BotFather → /newbot.",
              "Deploy a bot that polls the feed (see guide below).",
              "Add the bot to your crisis channel.",
            ]}
            onCopy={() => copy(FEED_URL, "tg")}
            copied={copied === "tg"}
          />
          <SubscribeCard
            emoji="🟢"
            title="Signal"
            steps={[
              "Use signal-cli or a self-hosted relay.",
              "Poll the RSS feed on an interval.",
              "Forward formatted alerts to your group.",
            ]}
            onCopy={() => copy(FEED_URL, "sig")}
            copied={copied === "sig"}
          />
        </div>
      </TerminalCard>

      {/* ── Country Alert Board ── */}
      <TerminalCard title="Country Alert Board" accent="amber">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-content-dim border-b border-border-dim">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Country</th>
                <th className="py-2 pr-2">Severity</th>
                <th className="py-2 pr-2 hidden sm:table-cell">Type</th>
                <th className="py-2 pr-2 text-right">Score</th>
                <th className="py-2 pl-2 w-28 hidden md:table-cell">Crisis index</th>
              </tr>
            </thead>
            <tbody>
              {top20.map((c, i) => {
                const sev = getAlertSeverity(c);
                const meta = SEVERITY_META[sev];
                const score = crisisScore(c);
                const cat = getCrisisCategory(c);
                return (
                  <tr
                    key={c.iso3}
                    className="border-b border-border-dim/50 hover:bg-panel-hi/40"
                  >
                    <td className="py-1.5 pr-2 text-content-dim tabular-nums">
                      {i + 1}
                    </td>
                    <td className="py-1.5 pr-2">
                      <Link
                        href={`/sorrow-map/${c.iso3.toLowerCase()}/`}
                        className="text-content-primary hover:text-command-bright"
                      >
                        {c.name_en}
                      </Link>
                    </td>
                    <td className="py-1.5 pr-2">
                      <StatusPill color={meta.color}>{meta.label}</StatusPill>
                    </td>
                    <td className="py-1.5 pr-2 text-content-secondary hidden sm:table-cell">
                      {ALERT_CATEGORIES[cat]}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-blood-bright">
                      {score.toFixed(0)}
                    </td>
                    <td className="py-1.5 pl-2 hidden md:table-cell w-28">
                      <DataBar value={score} max={maxScore} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </TerminalCard>

      {/* ── Telegram Alert Preview ── */}
      <TerminalCard title="Telegram Alert Preview" accent="blood">
        <div className="flex flex-wrap gap-2 mb-3">
          {top20.slice(0, 8).map((c) => (
            <button
              key={c.iso3}
              onClick={() => setPreviewIso(c.iso3)}
              className="inline-pill text-[10px] uppercase tracking-wider px-2 py-1 border transition-colors"
              style={{
                borderColor:
                  previewIso === c.iso3
                    ? "var(--color-command)"
                    : "var(--color-border-dim)",
                color:
                  previewIso === c.iso3
                    ? "var(--color-command-bright)"
                    : "var(--color-content-secondary)",
              }}
            >
              {c.iso3}
            </button>
          ))}
        </div>
        <pre className="p-3 bg-void border border-border-dim text-[11px] leading-relaxed text-content-primary whitespace-pre-wrap">
          {telegramPreview}
        </pre>
        <button
          onClick={() => copy(telegramPreview, "alert")}
          className="mt-2 inline-pill text-[10px] uppercase tracking-wider px-2 py-1 border border-command-dim text-command hover:bg-command-dim/20 transition-colors"
        >
          {copied === "alert" ? "✓ Copied alert" : "Copy alert text"}
        </button>
      </TerminalCard>

      {/* ── Bot Setup Guide ── */}
      <TerminalCard title="Bot Integration Guide" accent="green">
        <div className="space-y-5">
          <div>
            <h3 className="text-sm text-terminal-green mb-2">
              {"//"} 1 · Telegram Bot (Node.js)
            </h3>
            <p className="text-[11px] text-content-secondary mb-2">
              Create a bot with <code className="text-command-bright">@BotFather</code>,
              then poll the feed and broadcast formatted alerts.
            </p>
            <CodeBlock
              code={`import { Telegraf } from "telegraf";
import Parser from "rss-parser";

const bot = new Telegraf(process.env.BOT_TOKEN);
const parser = new Parser();
const CHANNEL = "@your_crisis_channel";
const FEED = "${FEED_URL}";
const seen = new Set();

async function tick() {
  const feed = await parser.parseURL(FEED);
  for (const item of feed.items) {
    if (seen.has(item.guid)) continue;
    seen.add(item.guid);
    await bot.telegram.sendMessage(
      CHANNEL,
      \`\\u26a0\\ufe0f *\${item.title}*\n\n\${item.content}\n\n\${item.link}\`,
      { parse_mode: "Markdown", disable_web_page_preview: false }
    );
  }
}
setInterval(tick, 5 * 60 * 1000); // every 5 min
bot.launch();`}
              onCopy={() => copy("telegram-bot", "code-tg")}
              copied={copied === "code-tg"}
            />
          </div>

          <div>
            <h3 className="text-sm text-terminal-green mb-2">
              {"//"} 2 · Signal Relay (signal-cli)
            </h3>
            <p className="text-[11px] text-content-secondary mb-2">
              Use <code className="text-command-bright">signal-cli</code> in daemon mode
              and forward RSS items to a group.
            </p>
            <CodeBlock
              code={`#!/usr/bin/env bash
# Requires signal-cli registered + daemon running
FEED="${FEED_URL}"
GROUP="+group-uuid-here"

# Parse feed with xmllint, send each new item
items=$(curl -s "$FEED" | xmllint --xpath \\
  '//*[local-name()="item"]/*[local-name()="title"]/text()' -)

for title in $items; do
  signal-cli -u "+YOUR_NUMBER" send -g "$GROUP" -m "$title"
done`}
              onCopy={() => copy("signal-relay", "code-sig")}
              copied={copied === "code-sig"}
            />
          </div>

          <div>
            <h3 className="text-sm text-terminal-green mb-2">
              {"//"} 3 · Generic RSS Poller (Python)
            </h3>
            <CodeBlock
              code={`import feedparser, time

FEED = "${FEED_URL}"
seen = set()

while True:
    feed = feedparser.parse(FEED)
    for entry in feed.entries:
        if entry.id in seen:
            continue
        seen.add(entry.id)
        print(f"[ALERT] {entry.title}")
        print(f"  {entry.summary}")
        print(f"  {entry.link}\\n")
    time.sleep(300)  # 5 min`}
              onCopy={() => copy("python-poller", "code-py")}
              copied={copied === "code-py"}
            />
          </div>
        </div>
      </TerminalCard>

      {/* ── Footer ── */}
      <footer className="text-[10px] text-content-dim pt-4 border-t border-border-dim">
        Feed auto-generated from <code>{formatNumber(data.countries.length)}</code>{" "}
        countries × open data. License: CC0. The static feed is rebuilt on each
        deploy — point readers at <code>{FEED_URL}</code>.
      </footer>
    </div>
  );
}

/* ═══ SUB-COMPONENTS ═══ */

function SubscribeCard({
  emoji,
  title,
  steps,
  onCopy,
  copied,
}: {
  emoji: string;
  title: string;
  steps: string[];
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="p-3 border border-border-dim bg-void/50 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-base">
          {emoji}
        </span>
        <span className="text-sm text-content-primary font-bold">{title}</span>
      </div>
      <ol className="text-[11px] text-content-secondary space-y-1 list-decimal list-inside">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <button
        onClick={onCopy}
        className="inline-pill mt-auto text-[10px] uppercase tracking-wider px-2 py-1 border border-command-dim text-command hover:bg-command-dim/20 transition-colors self-start"
      >
        {copied ? "✓ Copied feed URL" : "Copy feed URL"}
      </button>
    </div>
  );
}

function CodeBlock({
  code,
  onCopy,
  copied,
}: {
  code: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="relative">
      <pre className="p-3 bg-void border border-border-dim text-[10.5px] leading-relaxed text-terminal-green overflow-x-auto">
        {code}
      </pre>
      <button
        onClick={onCopy}
        className="absolute top-2 right-2 inline-pill text-[10px] uppercase tracking-wider px-2 py-1 border border-border-dim bg-abyss text-content-secondary hover:text-command-bright transition-colors"
      >
        {copied ? "✓" : "Copy"}
      </button>
    </div>
  );
}
