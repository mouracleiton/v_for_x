/**
 * V FOR X — Alert & Feed Generation
 *
 * Generates RSS 2.0 and Atom 1.0 feeds of crisis alerts for
 * Telegram / Signal bots, RSS readers, and aggregator ingestion.
 * Also produces ready-to-send plain-text alerts optimized for
 * instant-messaging clients.
 *
 * Pure functions — safe for both server (build-time export) and
 * client (live preview) use. No runtime dependencies.
 */

import type { CountryData } from "./types";
import { SITE } from "./seo";

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

export interface FeedItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  category?: string;
}

export type AlertSeverity = "critical" | "severe" | "moderate";

/** Alert categories used for filtering feeds and dispatching to bots. */
export const ALERT_CATEGORIES = {
  famine: "Famine / Acute Hunger",
  conflict: "Armed Conflict",
  displacement: "Forced Displacement",
  child_mortality: "Child Mortality",
  poverty: "Extreme Poverty",
  corruption: "Corruption / Governance",
} as const;

export type AlertCategoryKey = keyof typeof ALERT_CATEGORIES;

/* ═══════════════════════════════════════════════════════════
   DATE HELPERS
   ═══════════════════════════════════════════════════════════ */

/** RFC-822 date for RSS 2.0 — e.g. "Sat, 09 Aug 2026 13:12:00 GMT" */
export function toRFC822(d: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const pad = (n: number): string => String(n).padStart(2, "0");
  return (
    `${days[d.getUTCDay()]}, ` +
    `${pad(d.getUTCDate())} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} GMT`
  );
}

/** ISO-8601 date for Atom 1.0 */
export function toISO8601(d: Date): string {
  return d.toISOString();
}

/* ═══════════════════════════════════════════════════════════
   XML ESCAPE
   ═══════════════════════════════════════════════════════════ */

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* ═══════════════════════════════════════════════════════════
   SCORING / SEVERITY
   ═══════════════════════════════════════════════════════════ */

/**
 * Composite crisis score (roughly 0–270) used to rank countries
 * for alert dispatch. Combines famine risk, conflict intensity,
 * undernourishment, acute food-insecure population and displacement.
 */
export function crisisScore(c: CountryData): number {
  const famine = c.hunger.famine_risk_1to5 ?? 0;
  const conflict = c.conflict.intensity_1to5 ?? 0;
  const under = c.hunger.undernourishment_pct ?? 0;
  const acute = c.hunger.pop_acute_fi_m ?? 0;
  const disp = c.conflict.displacement_m ?? 0;
  return (
    famine * 20 + // up to 100
    conflict * 18 + // up to 90
    (under / 100) * 30 + // up to 30
    Math.min(acute, 30) + // up to 30
    Math.min(disp, 20) // up to 20
  );
}

/** Classify a country's alert severity from its core metrics. */
export function getAlertSeverity(country: CountryData): AlertSeverity {
  const famine = country.hunger.famine_risk_1to5 ?? 0;
  const conflict = country.conflict.intensity_1to5 ?? 0;
  const under = country.hunger.undernourishment_pct ?? 0;
  if (famine >= 4 || conflict >= 5) return "critical";
  if (famine >= 3 || conflict >= 4 || under >= 30) return "severe";
  return "moderate";
}

/** Determine the dominant crisis category for a country. */
export function getCrisisCategory(country: CountryData): AlertCategoryKey {
  const famine = country.hunger.famine_risk_1to5 ?? 0;
  const conflict = country.conflict.intensity_1to5 ?? 0;
  const disp = country.conflict.displacement_m ?? 0;
  const acute = country.hunger.pop_acute_fi_m ?? 0;
  const childMort = country.health.child_mortality_under5_per1k ?? 0;
  const poverty = country.poverty.headcount_365_pct ?? 0;
  if (famine >= 3 || acute >= 5) return "famine";
  if (conflict >= 3) return "conflict";
  if (disp >= 3) return "displacement";
  if (childMort >= 60) return "child_mortality";
  if (poverty >= 30) return "poverty";
  return "conflict";
}

/* ═══════════════════════════════════════════════════════════
   URL HELPERS
   ═══════════════════════════════════════════════════════════ */

function countryUrl(iso3: string): string {
  return `${SITE.url}/sorrow-map/${iso3.toLowerCase()}/`;
}

/* ═══════════════════════════════════════════════════════════
   COUNTRY → FEED ITEM
   ═══════════════════════════════════════════════════════════ */

/** Build a human-readable one-line description of a country's key stats. */
export function describeCountry(c: CountryData): string {
  const parts: string[] = [];
  const acute = c.hunger.pop_acute_fi_m;
  if (acute) parts.push(`${acute}M acutely food-insecure`);
  const under = c.hunger.undernourishment_pct;
  if (under) parts.push(`${under}% undernourished`);
  const disp = c.conflict.displacement_m;
  if (disp) parts.push(`${disp}M displaced`);
  const childMort = c.health.child_mortality_under5_per1k;
  if (childMort) parts.push(`${childMort.toFixed(0)} child deaths / 1k`);
  if (parts.length === 0) parts.push("Crisis conditions active");
  return parts.join(" · ");
}

/** Format the crisis-type title fragment from the dominant category. */
function crisisTypeLabel(c: CountryData): string {
  return ALERT_CATEGORIES[getCrisisCategory(c)];
}

/** Convert a single country into a structured FeedItem. */
export function countryToFeedItem(c: CountryData, date: Date): FeedItem {
  const sev = getAlertSeverity(c).toUpperCase();
  return {
    title: `${c.name_en} — ${crisisTypeLabel(c)} [${sev}]`,
    description: describeCountry(c),
    link: countryUrl(c.iso3),
    pubDate: toRFC822(date),
    category: getCrisisCategory(c),
  };
}

/* ═══════════════════════════════════════════════════════════
   CRISIS RSS 2.0
   ═══════════════════════════════════════════════════════════ */

/**
 * Generate an RSS 2.0 feed of the top 20 crisis countries
 * (sorted descending by composite crisis score).
 */
export function generateCrisisRSS(countries: CountryData[]): string {
  const now = new Date();
  const items = [...countries]
    .sort((a, b) => crisisScore(b) - crisisScore(a))
    .slice(0, 20)
    .map((c) => countryToFeedItem(c, now));

  const itemXml = items
    .map((it) => {
      const cat = it.category
        ? `      <category>${escapeXml(it.category)}</category>\n`
        : "";
      return (
        `    <item>\n` +
        `      <title>${escapeXml(it.title)}</title>\n` +
        `      <description>${escapeXml(it.description)}</description>\n` +
        `      <link>${escapeXml(it.link)}</link>\n` +
        `      <guid isPermaLink="true">${escapeXml(it.link)}</guid>\n` +
        `      <pubDate>${it.pubDate}</pubDate>\n` +
        cat +
        `    </item>`
      );
    })
    .join("\n");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `  <channel>\n` +
    `    <title>V FOR X Crisis Alerts</title>\n` +
    `    <link>${escapeXml(SITE.url)}/the-alerts/</link>\n` +
    `    <description>Top 20 crisis countries ranked by composite vulnerability — famine, conflict, displacement, child mortality. Updated continuously from open data (CC0).</description>\n` +
    `    <language>en</language>\n` +
    `    <lastBuildDate>${toRFC822(now)}</lastBuildDate>\n` +
    `    <pubDate>${toRFC822(now)}</pubDate>\n` +
    `    <ttl>30</ttl>\n` +
    `    <atom:link href="${escapeXml(SITE.url)}/crisis-alerts.xml" rel="self" type="application/rss+xml" />\n` +
    `    <image>\n` +
    `      <url>${escapeXml(SITE.ogImage)}</url>\n` +
    `      <title>V FOR X Crisis Alerts</title>\n` +
    `      <link>${escapeXml(SITE.url)}/the-alerts/</link>\n` +
    `    </image>\n` +
    `${itemXml}\n` +
    `  </channel>\n` +
    `</rss>\n`
  );
}

/* ═══════════════════════════════════════════════════════════
   DOSSIER RSS 2.0
   ═══════════════════════════════════════════════════════════ */

/**
 * Generate an RSS 2.0 feed of the latest accountability dossiers.
 *
 * Each dossier is expected to expose: `id`, `subject`, `accusation`,
 * `category`, `severity`, `status`, `created_at` and optionally `country_iso3`.
 */
export function generateDossierRSS(dossiers: any[]): string {
  const now = new Date();
  const items = [...dossiers]
    .sort((a, b) => {
      const da = a?.updated_at ?? a?.created_at ?? "";
      const db = b?.updated_at ?? b?.created_at ?? "";
      return String(db).localeCompare(String(da));
    })
    .slice(0, 20)
    .map((d): FeedItem => {
      const link = `${SITE.url}/registry/${d.id}/`;
      const dateStr = d.updated_at ?? d.created_at;
      let pubDate: string;
      try {
        pubDate = dateStr ? toRFC822(new Date(dateStr)) : toRFC822(now);
      } catch {
        pubDate = toRFC822(now);
      }
      const sev = d.severity ? ` [${String(d.severity).toUpperCase()}]` : "";
      return {
        title: `${d.id} — ${d.subject ?? "Accountability Dossier"}${sev}`,
        description: d.accusation ?? d.country_data_ref ?? "Evidence-based dossier.",
        link,
        pubDate,
        category: d.category,
      };
    });

  const itemXml = items
    .map((it) => {
      const cat = it.category
        ? `      <category>${escapeXml(String(it.category))}</category>\n`
        : "";
      return (
        `    <item>\n` +
        `      <title>${escapeXml(it.title)}</title>\n` +
        `      <description>${escapeXml(it.description)}</description>\n` +
        `      <link>${escapeXml(it.link)}</link>\n` +
        `      <guid isPermaLink="true">${escapeXml(it.link)}</guid>\n` +
        `      <pubDate>${it.pubDate}</pubDate>\n` +
        cat +
        `    </item>`
      );
    })
    .join("\n");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `  <channel>\n` +
    `    <title>V FOR X Dossier Feed</title>\n` +
    `    <link>${escapeXml(SITE.url)}/registry/</link>\n` +
    `    <description>Latest accountability dossiers — war crimes, corruption, human rights violations. Peer-validated, evidence-based, open provenance.</description>\n` +
    `    <language>en</language>\n` +
    `    <lastBuildDate>${toRFC822(now)}</lastBuildDate>\n` +
    `    <pubDate>${toRFC822(now)}</pubDate>\n` +
    `    <ttl>60</ttl>\n` +
    `    <atom:link href="${escapeXml(SITE.url)}/dossiers.xml" rel="self" type="application/rss+xml" />\n` +
    `${itemXml}\n` +
    `  </channel>\n` +
    `</rss>\n`
  );
}

/* ═══════════════════════════════════════════════════════════
   ATOM 1.0 (generic)
   ═══════════════════════════════════════════════════════════ */

/** Generate a generic Atom 1.0 feed from arbitrary FeedItems. */
export function generateAtomFeed(items: FeedItem[], channelTitle: string): string {
  const now = new Date();
  const id = `${SITE.url}/the-alerts/atom`;

  const entries = items
    .map((it) => {
      const updated = it.pubDate ? safeISO(it.pubDate) : toISO8601(now);
      const cat = it.category
        ? `    <category term="${escapeXml(it.category)}" />\n`
        : "";
      return (
        `  <entry>\n` +
        `    <title>${escapeXml(it.title)}</title>\n` +
        `    <link href="${escapeXml(it.link)}" />\n` +
        `    <id>${escapeXml(it.link)}</id>\n` +
        `    <updated>${updated}</updated>\n` +
        cat +
        `    <summary>${escapeXml(it.description)}</summary>\n` +
        `  </entry>`
      );
    })
    .join("\n");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<feed xmlns="http://www.w3.org/2005/Atom">\n` +
    `  <title>${escapeXml(channelTitle)}</title>\n` +
    `  <link href="${escapeXml(SITE.url)}/the-alerts/" />\n` +
    `  <link href="${escapeXml(SITE.url)}/crisis-alerts.atom" rel="self" type="application/atom+xml" />\n` +
    `  <id>${escapeXml(id)}</id>\n` +
    `  <updated>${toISO8601(now)}</updated>\n` +
    `  <author>\n` +
    `    <name>V FOR X</name>\n` +
    `  </author>\n` +
    `${entries}\n` +
    `</feed>\n`
  );
}

/** Best-effort conversion of an RFC-822 or ISO date string to ISO-8601. */
function safeISO(dateStr: string): string {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? toISO8601(new Date()) : toISO8601(d);
}

/* ═══════════════════════════════════════════════════════════
   TELEGRAM / SIGNAL ALERT
   ═══════════════════════════════════════════════════════════ */

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  critical: "🔴",
  severe: "🟠",
  moderate: "🟡",
};

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  critical: "CRITICAL",
  severe: "SEVERE",
  moderate: "MODERATE",
};

/**
 * Generate a formatted plain-text alert message optimized for
 * Telegram / Signal. Uses Markdown-style **bold** markers (Telegram)
 * and hashtags for discoverability.
 */
export function generateTelegramAlert(country: CountryData): string {
  const sev = getAlertSeverity(country);
  const cat = getCrisisCategory(country);
  const lines: string[] = [];

  lines.push(`${SEVERITY_EMOJI[sev]} *CRISIS ALERT — V FOR X*`);
  lines.push(`━━━━━━━━━━━━━━━━━━━`);
  lines.push(`📍 *${country.name_en}* (${country.iso3})`);
  lines.push(`⚡ Severity: *${SEVERITY_LABEL[sev]}*`);
  lines.push(`🗂 Type: ${ALERT_CATEGORIES[cat]}`);
  lines.push("");

  if (country.hunger.pop_acute_fi_m) {
    lines.push(`🔥 Acute food insecurity: *${country.hunger.pop_acute_fi_m}M* people`);
  }
  if (country.hunger.undernourishment_pct) {
    lines.push(`📉 Undernourished: *${country.hunger.undernourishment_pct}%*`);
  }
  if (country.conflict.intensity_1to5) {
    lines.push(`⚔️ Conflict intensity: *${country.conflict.intensity_1to5}/5*`);
  }
  if (country.hunger.famine_risk_1to5) {
    lines.push(`🚨 Famine risk: *${country.hunger.famine_risk_1to5}/5*`);
  }
  if (country.conflict.displacement_m) {
    lines.push(`🏃 Displacement: *${country.conflict.displacement_m}M*`);
  }
  const childMort = country.health.child_mortality_under5_per1k;
  if (childMort) {
    lines.push(`👶 Child mortality: *${childMort.toFixed(0)}/1k*`);
  }

  lines.push("");
  lines.push(`🔗 ${countryUrl(country.iso3)}`);
  lines.push("");
  lines.push(`*Source:* V FOR X open data (CC0)`);
  lines.push("");
  const tags = ["#VFORX", "#CrisisAlert", `#${country.iso3}`, `#${ALERT_CATEGORIES[cat].split(/[\s/]/)[0]}`];
  lines.push(tags.join(" "));

  return lines.join("\n");
}
