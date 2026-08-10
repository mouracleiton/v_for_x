/**
 * V FOR X — Personalized Digest Feed Generator
 *
 * Builds shareable, personalized crisis digests for any subset of the
 * 200 tracked countries. Produces three consumable formats:
 *
 *   1. A styled HTML email digest (for newsletters / paste-into-mail).
 *   2. An RSS 2.0 feed (for Blogtrottr / follow.it / Feedly).
 *   3. A shareable URL with a Base64-encoded config (the-digest?cfg=...).
 *
 * Plus ready-made subscription URLs for the two most popular
 * RSS-to-email bridges (follow.it, Blogtrottr).
 *
 * Pure functions — safe for both build-time export and client preview.
 */

import type { CountryData } from "./types";
import { SITE } from "./seo";
import { formatNumber, formatPct } from "./format";

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

export interface DigestConfig {
  iso3s: string[];
  topics: string[];
  frequency: "daily" | "weekly";
}

/* ═══════════════════════════════════════════════════════════
   TOPIC FILTERS
   ═══════════════════════════════════════════════════════════ */

export interface TopicFilter {
  key: string;
  label: string;
  description: string;
}

/**
 * The seven crisis dimensions a digest can be filtered to. Each topic
 * maps to a slice of the CountryData dossier so the digest can surface
 * the right numbers per country.
 */
export function getTopicFilters(): TopicFilter[] {
  return [
    {
      key: "hunger",
      label: "Hunger & Food Security",
      description:
        "Acute food insecurity, undernourishment, famine risk, child wasting.",
    },
    {
      key: "conflict",
      label: "Armed Conflict",
      description:
        "Conflict intensity, battle deaths, access denial, displacement drivers.",
    },
    {
      key: "health",
      label: "Health & Mortality",
      description:
        "Child & maternal mortality, life expectancy, disease burden, health spend.",
    },
    {
      key: "economy",
      label: "Economy & Poverty",
      description:
        "GDP per capita, extreme poverty, unemployment, inequality (Gini).",
    },
    {
      key: "climate",
      label: "Climate & Environment",
      description:
        "CO₂ emissions, air pollution, forest loss, renewable energy share.",
    },
    {
      key: "governance",
      label: "Governance & Rights",
      description:
        "Democracy index, corruption perceptions, political corruption.",
    },
    {
      key: "displacement",
      label: "Displacement & Refugees",
      description:
        "Refugees, IDPs, asylum seekers, forced displacement totals.",
    },
  ];
}

/* ═══════════════════════════════════════════════════════════
   BASE64 HELPERS (SSR + browser safe)
   ═══════════════════════════════════════════════════════════ */

type GlobalLike = {
  btoa?: (s: string) => string;
  atob?: (s: string) => string;
  Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } };
};

function toBase64(str: string): string {
  const g = globalThis as GlobalLike;
  if (typeof g.btoa === "function") return g.btoa(unescape(encodeURIComponent(str)));
  if (g.Buffer) return g.Buffer.from(str, "utf8").toString("base64");
  // Last-resort manual fallback (ASCII only) — config is ASCII-safe.
  let out = "";
  for (let i = 0; i < str.length; i += 3) {
    const b1 = str.charCodeAt(i) & 0xff;
    const b2 = i + 1 < str.length ? str.charCodeAt(i + 1) & 0xff : NaN;
    const b3 = i + 2 < str.length ? str.charCodeAt(i + 2) & 0xff : NaN;
    out += B64_CHARS[b1 >> 2];
    out += B64_CHARS[((b1 & 0x3) << 4) | (isNaN(b2) ? 0 : b2 >> 4)];
    out += isNaN(b2) ? "=" : B64_CHARS[((b2 & 0xf) << 2) | (isNaN(b3) ? 0 : b3 >> 6)];
    out += isNaN(b3) ? "=" : B64_CHARS[b3 & 0x3f];
  }
  return out;
}

function fromBase64(b64: string): string {
  const g = globalThis as GlobalLike;
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, "");
  if (typeof g.atob === "function") {
    try {
      return decodeURIComponent(escape(g.atob(clean)));
    } catch {
      return g.atob(clean);
    }
  }
  if (g.Buffer) return g.Buffer.from(clean, "base64").toString("utf8");
  return "";
}

const B64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/* ═══════════════════════════════════════════════════════════
   URL GENERATION
   ═══════════════════════════════════════════════════════════ */

/** Encode a digest config into a compact query string. */
export function encodeDigestConfig(config: DigestConfig): string {
  return toBase64(JSON.stringify(config));
}

/** Decode a `cfg=` query param back into a DigestConfig (best-effort). */
export function decodeDigestConfig(cfg: string): DigestConfig | null {
  try {
    const parsed = JSON.parse(fromBase64(cfg)) as Partial<DigestConfig>;
    if (!Array.isArray(parsed.iso3s)) return null;
    return {
      iso3s: parsed.iso3s.filter((x) => typeof x === "string"),
      topics: Array.isArray(parsed.topics)
        ? parsed.topics.filter((x) => typeof x === "string")
        : [],
      frequency: parsed.frequency === "weekly" ? "weekly" : "daily",
    };
  } catch {
    return null;
  }
}

/**
 * Generate a shareable URL pointing to the digest builder with the
 * config Base64-encoded as the `cfg` query parameter.
 */
export function generateDigestURL(config: DigestConfig): string {
  return `${SITE.url}/the-digest/?cfg=${encodeDigestConfig(config)}`;
}

/**
 * RSS-to-email bridge: follow.it. Subscribing to the generated RSS feed
 * delivers it to the subscriber's inbox on the chosen cadence.
 */
export function generateFollowItURL(config: DigestConfig): string {
  const feedUrl = encodeURIComponent(
    `${SITE.url}/the-digest/feed.xml?cfg=${encodeDigestConfig(config)}`,
  );
  return `https://follow.it/subscribe?lang=en&topic=feed&url=${feedUrl}&title=${encodeURIComponent(
    `V FOR X ${config.frequency === "weekly" ? "Weekly" : "Daily"} Digest`,
  )}`;
}

/**
 * RSS-to-email bridge: Blogtrottr. Paste the RSS feed URL to receive
 * email digests on the selected frequency.
 */
export function generateBlogtrotrURL(config: DigestConfig): string {
  const feedUrl = encodeURIComponent(
    `${SITE.url}/the-digest/feed.xml?cfg=${encodeDigestConfig(config)}`,
  );
  return `https://www.blogtrottr.com/?receive=${feedUrl}`;
}

/* ═══════════════════════════════════════════════════════════
   COUNTRY SUMMARY (per-topic)
   ═══════════════════════════════════════════════════════════ */

/** One-paragraph crisis summary for a country, filtered to active topics. */
export function summarizeCountry(
  country: CountryData,
  topics: string[],
): string {
  const t = new Set(topics.length ? topics : getTopicFilters().map((f) => f.key));
  const parts: string[] = [];

  if (t.has("hunger")) {
    const acute = country.hunger.pop_acute_fi_m;
    const prev = country.hunger.prevalence_pct;
    const famine = country.hunger.famine_risk_1to5;
    parts.push(
      `Acute food insecurity: ${formatNumber(acute)}M people` +
        (prev != null ? ` (${formatPct(prev)} prevalence)` : "") +
        (famine != null ? `, famine risk ${famine}/5` : "") + ".",
    );
  }
  if (t.has("conflict")) {
    parts.push(
      `Conflict intensity ${country.conflict.intensity_1to5}/5; ` +
        `${formatNumber(country.conflict.battle_deaths_total)} battle-related deaths tracked.`,
    );
  }
  if (t.has("health")) {
    const cm = country.health.child_mortality_under5_per1k;
    parts.push(
      `Under-5 mortality ${formatNumber(cm)}/1,000` +
        (country.health.life_expectancy != null
          ? `, life expectancy ${country.health.life_expectancy.toFixed(1)} yrs`
          : "") + ".",
    );
  }
  if (t.has("economy")) {
    parts.push(
      `GDP/capita ${country.economy.gdp_per_capita_usd != null ? "$" + formatNumber(country.economy.gdp_per_capita_usd) : "N/A"}` +
        `, extreme poverty ${formatPct(country.poverty.headcount_365_pct)}.`,
    );
  }
  if (t.has("climate")) {
    parts.push(
      `CO₂/capita ${formatNumber(country.climate.co2_per_capita_t)}t` +
        (country.environment.air_pollution_pm25_ugm3 != null
          ? `, PM2.5 ${country.environment.air_pollution_pm25_ugm3.toFixed(1)} µg/m³`
          : "") + ".",
    );
  }
  if (t.has("governance")) {
    parts.push(
      `Democracy index ${country.governance.electoral_democracy_index != null ? country.governance.electoral_democracy_index.toFixed(2) : "N/A"}` +
        `, CPI ${country.governance.corruption_perceptions_index ?? "N/A"}/100.`,
    );
  }
  if (t.has("displacement")) {
    parts.push(
      `${formatNumber(country.migration.forcibly_displaced)} forcibly displaced` +
        (country.migration.refugees_origin != null
          ? `, ${formatNumber(country.migration.refugees_origin)} refugees abroad`
          : "") + ".",
    );
  }

  return parts.length ? parts.join(" ") : "No data points for the selected topics.";
}

/* ═══════════════════════════════════════════════════════════
   HTML EMAIL DIGEST
   ═══════════════════════════════════════════════════════════ */

const STYLES = {
  body: "background:#060b14;color:#dfe7f5;font-family:'JetBrains Mono','Fira Code','Courier New',monospace;margin:0;padding:24px;",
  wrap: "max-width:640px;margin:0 auto;",
  header:
    "border-bottom:2px solid #c42b3e;padding-bottom:16px;margin-bottom:24px;",
  title: "font-size:22px;font-weight:bold;color:#e23856;margin:0;letter-spacing:0.05em;",
  meta: "color:#8da3c4;font-size:12px;margin-top:6px;",
  card:
    "background:#0f1a2e;border:1px solid #1a2a44;padding:16px;margin-bottom:14px;",
  cardTitle: "color:#22d3a6;font-size:14px;font-weight:bold;margin:0 0 8px 0;",
  iso: "color:#5b9cf6;font-size:11px;margin-left:8px;",
  summary: "color:#dfe7f5;font-size:13px;line-height:1.6;margin:0;",
  topic: "display:inline-block;background:#142238;color:#8da3c4;font-size:10px;padding:2px 6px;margin:2px 4px 2px 0;border:1px solid #2a4264;",
  footer:
    "border-top:1px solid #1a2a44;margin-top:24px;padding-top:16px;color:#4a5d7a;font-size:11px;text-align:center;",
  link: "color:#5b9cf6;",
};

function styleStr(s: string): string {
  return s;
}

/**
 * Generate a self-contained, styled HTML email digest. Inline styles so
 * it renders correctly in Gmail / Outlook / Apple Mail. Each selected
 * country becomes a "card" with its per-topic crisis summary.
 */
export function generateDigestHTML(
  countries: CountryData[],
  config: DigestConfig,
): string {
  const topicFilters = getTopicFilters();
  const activeTopics = topicFilters.filter((t) =>
    config.topics.length ? config.topics.includes(t.key) : true,
  );

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const cards = countries
    .map((c) => {
      const summary = summarizeCountry(c, config.topics);
      const tags = activeTopics
        .map((t) => `<span style="${styleStr(STYLES.topic)}">${t.label}</span>`)
        .join("");
      return `
    <tr><td>
      <div style="${styleStr(STYLES.card)}">
        <p style="${styleStr(STYLES.cardTitle)}">${c.name_en}<span style="${styleStr(STYLES.iso)}">${c.iso3} · ${c.region}</span></p>
        <p style="${styleStr(STYLES.summary)}">${summary}</p>
        <div style="margin-top:10px;">${tags}</div>
      </div>
    </td></tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>V FOR X — ${config.frequency === "weekly" ? "Weekly" : "Daily"} Digest</title>
</head>
<body style="${styleStr(STYLES.body)}">
  <div style="${styleStr(STYLES.wrap)}">
    <div style="${styleStr(STYLES.header)}">
      <h1 style="${styleStr(STYLES.title)}">V FOR X // CRISIS DIGEST</h1>
      <p style="${styleStr(STYLES.meta)}">${config.frequency.toUpperCase()} · ${dateLabel} · ${countries.length} countries · ${activeTopics.length} topics</p>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cards}
    </table>
    <div style="${styleStr(STYLES.footer)}">
      Open data against hunger · 200 countries × 19 dimensions · CC0<br>
      <a href="${SITE.url}" style="${styleStr(STYLES.link)}">${SITE.url.replace("https://", "")}</a><br>
      Generated by V FOR X digest builder. Data is heuristic, not a forecast.
    </div>
  </div>
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════════
   RSS 2.0 FEED
   ═══════════════════════════════════════════════════════════ */

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generate an RSS 2.0 feed of the selected countries' crisis summaries.
 * Paste the resulting URL into Blogtrottr / follow.it to receive it as
 * email on the configured cadence.
 */
export function generateDigestRSS(
  countries: CountryData[],
  config: DigestConfig,
): string {
  const now = new Date().toUTCString();
  const feedTitle = `V FOR X — ${config.frequency === "weekly" ? "Weekly" : "Daily"} Crisis Digest`;
  const feedDesc = `${countries.length} countries tracked across ${config.topics.length || "all"} topics. Open data, CC0.`;
  const selfUrl = `${SITE.url}/the-digest/feed.xml?cfg=${encodeDigestConfig(config)}`;

  const items = countries
    .map((c) => {
      const summary = summarizeCountry(c, config.topics);
      const link = `${SITE.url}/sorrow-map/${c.iso3.toLowerCase()}/`;
      return `    <item>
      <title>${escapeXml(c.name_en)} (${c.iso3}) — ${c.region}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${escapeXml(summary)}</description>
      <category>${escapeXml(c.region)}</category>
      <pubDate>${now}</pubDate>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${SITE.url}/the-digest/</link>
    <description>${escapeXml(feedDesc)}</description>
    <language>en</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${escapeXml(selfUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}
