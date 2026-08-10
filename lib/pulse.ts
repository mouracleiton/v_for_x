/**
 * V FOR X — The Pulse
 *
 * Client-side multi-source crisis reader. Consumes public RSS 2.0 / Atom 1.0
 * feeds (and nitter-style RSS mirrors), filters them through regional crisis
 * keyword lexicons, and ranks every item by the platform's own composite
 * vulnerability score — so the most urgent human stories surface first.
 *
 * Where The Digest *generates* feeds from internal data, The Pulse *consumes*
 * the open web. Everything fetched is cached in IndexedDB so the reader works
 * offline and under hostile connectivity.
 *
 * Pure functions (parsers, scorers, rankers) are exported separately so they
 * can run on both the server (build) and the client (live) and are unit-tested.
 * The fetch + IndexedDB layer only runs in the browser.
 */

import type { CountryData } from "./types";
import { calculateVulnerability } from "./vulnerability";
import { openDB, type IDBPDatabase } from "idb";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

export type PulseRegion =
  | "Africa"
  | "Asia"
  | "Americas"
  | "Europe"
  | "Oceania"
  | "Global";

export type PulseTopic =
  | "famine"
  | "conflict"
  | "displacement"
  | "health"
  | "climate"
  | "governance"
  | "protest"
  | "humanitarian";

export type FeedKind = "rss" | "atom" | "nitter";

/** A public feed source. Region "Global" is always shown regardless of filter. */
export interface PulseSource {
  id: string;
  title: string;
  /** Publishing organization, for display. */
  org?: string;
  /** The feed URL (RSS 2.0, Atom 1.0, or a nitter RSS mirror). */
  url: string;
  kind: FeedKind;
  /** Primary region this source covers. "Global" = worldwide wire. */
  region: PulseRegion;
  /** Topics this source tends to publish on (used as a relevance prior). */
  topics: PulseTopic[];
  /** Short human note shown in the source manager. */
  note?: string;
}

/** Raw entry extracted from a feed, before scoring. */
export interface ParsedEntry {
  title: string;
  link: string;
  summary: string;
  guid: string;
  pubDate: string;
}

/** A fully scored, ranked feed item. */
export interface PulseItem {
  /** Stable id = hash of guid/link, used for dedup + IndexedDB key. */
  id: string;
  title: string;
  link: string;
  summary: string;
  published: number;
  publishedLabel: string;
  sourceId: string;
  sourceTitle: string;
  kind: FeedKind;
  /** Source region, possibly overridden by detected country region. */
  region: PulseRegion;
  matchedKeywords: string[];
  matchedTopics: PulseTopic[];
  /** ISO3 codes of countries detected in the title/summary. */
  matchedIso3: string[];
  /** Max composite vulnerability (0-100) among matched countries. */
  vulnerabilityBoost: number;
  /** Composite rank score. */
  score: number;
}

/* ═══════════════════════════════════════════════════════════════
   CRISIS KEYWORD LEXICONS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Per-topic crisis keyword lexicons. Matched case-insensitively as substrings
 * of the title+summary blob. Kept deliberately broad to recall fast-moving
 * situations; ranking + vulnerability boost handle precision.
 */
export const TOPIC_KEYWORDS: Record<PulseTopic, string[]> = {
  famine: [
    "famine", "starvation", "starv", "food insecurity", "food-insecure",
    "acute food", "ipc phase", "malnutrition", "undernourish", "wasting",
    "stunting", "hunger", "food crisis", "food emergency", "lean season",
  ],
  conflict: [
    "airstrike", "airstrikes", "shelling", "artillery", "ceasefire",
    "cease-fire", "offensive", "missile strike", "drone strike", "airstrike",
    "front line", "frontline", "troops", "militia", "armed group", "bombing",
    "casualt", "siege", "incursion", "invasion", "coup", "massacre",
    "extrajudicial", "war crime", "cluster munition", "landmine",
  ],
  displacement: [
    "displac", "refugee", "internally displaced", "idp", "idps",
    "asylum", "evacuee", "evacuation", "fled", "uprooted", "deport",
    "border crossing", "migration crisis", "stateless",
  ],
  health: [
    "cholera", "measles", "outbreak", "epidemic", "pandemic", "ebola",
    "polio", "malaria", "child mortality", "maternal death", "clinic",
    "hospital attack", "medical", "vaccin", "malnutrition", "dengue",
    "mpox", "health system collapse",
  ],
  climate: [
    "drought", "flood", "flooding", "cyclone", "hurricane", "typhoon",
    "wildfire", "heatwave", "landslide", "sea level", "desertification",
    "el ni\u00f1o", "la ni\u00f1a", "extreme weather", "food security",
  ],
  governance: [
    "corruption", "authoritarian", "crackdown", "censor", "press freedom",
    "journalist", "arbitrary arrest", "detention", "torture", "sanction",
    "election", "coup", "regime", "impunity", "state of emergency",
  ],
  protest: [
    "protest", "demonstration", "rally", "general strike", "labor strike",
    "hunger strike", "unrest", "uprising", "revolt", "riot",
    "civil disobedience", "sit-in", "march on", "curfew",
    "tear gas", "kettle", "mass arrest", "crackdown on protesters",
  ],
  humanitarian: [
    "humanitarian", "aid convoy", "aid worker", "relief", "ngo",
    "un agency", "ocha", "wfp", "unicef", "unhcr", "ifrc", "red cross",
    "red crescent", "appeal", "funding gap", "access denied", "lifesaving",
  ],
};

export const TOPIC_LABELS: Record<PulseTopic, string> = {
  famine: "Famine / Hunger",
  conflict: "Armed Conflict",
  displacement: "Displacement",
  health: "Health / Outbreak",
  climate: "Climate Disaster",
  governance: "Governance / Rights",
  protest: "Protest / Unrest",
  humanitarian: "Humanitarian Aid",
};

/** Relative weight of each topic in the composite rank. */
export const TOPIC_WEIGHT: Record<PulseTopic, number> = {
  famine: 1.5,
  conflict: 1.3,
  displacement: 1.2,
  protest: 1.1,
  health: 1.0,
  governance: 1.0,
  climate: 1.0,
  humanitarian: 0.9,
};

export const REGION_LABELS: Record<PulseRegion, string> = {
  Africa: "Africa",
  Asia: "Asia",
  Americas: "Americas",
  Europe: "Europe",
  Oceania: "Oceania",
  Global: "Global / Wire",
};

/* ═══════════════════════════════════════════════════════════════
   PUBLIC FEED SOURCES

   Real open RSS/Atom feeds from humanitarian + human-rights publishers.
   Most do not send CORS headers, so fetchFeedText() falls back through a
   list of public CORS proxies. Users can disable any source and add their
   own (e.g. a self-hosted nitter or RSS-Bridge instance).
   ═══════════════════════════════════════════════════════════════ */

export const DEFAULT_SOURCES: PulseSource[] = [
  {
    id: "reliefweb",
    title: "ReliefWeb",
    org: "UN OCHA",
    url: "https://reliefweb.int/rss",
    kind: "rss",
    region: "Global",
    topics: ["humanitarian", "conflict", "displacement", "famine"],
    note: "Global humanitarian updates from UN OCHA.",
  },
  {
    id: "thenewhumanitarian",
    title: "The New Humanitarian",
    org: "Independent",
    url: "https://www.thenewhumanitarian.org/rss.xml",
    kind: "rss",
    region: "Global",
    topics: ["humanitarian", "conflict", "health"],
    note: "Field reporting from crisis zones.",
  },
  {
    id: "fewsnet",
    title: "FEWS NET",
    org: "USAID",
    url: "https://fews.net/rss.xml",
    kind: "rss",
    region: "Global",
    topics: ["famine", "climate"],
    note: "Famine Early Warning Systems Network.",
  },
  {
    id: "wfp",
    title: "World Food Programme",
    org: "UN",
    url: "https://www.wfp.org/rss/news.xml",
    kind: "rss",
    region: "Global",
    topics: ["famine", "humanitarian", "displacement"],
    note: "Food assistance + hunger tracking.",
  },
  {
    id: "unhcr",
    title: "UNHCR",
    org: "UN",
    url: "https://www.unhcr.org/rss/news.xml",
    kind: "rss",
    region: "Global",
    topics: ["displacement", "humanitarian"],
    note: "Refugee + displacement wire.",
  },
  {
    id: "icrc",
    title: "ICRC",
    org: "Red Cross",
    url: "https://www.icrc.org/en/rss/news",
    kind: "rss",
    region: "Global",
    topics: ["conflict", "health", "humanitarian"],
    note: "International Committee of the Red Cross.",
  },
  {
    id: "msf",
    title: "Doctors Without Borders",
    org: "MSF",
    url: "https://www.msf.org/rss",
    kind: "rss",
    region: "Global",
    topics: ["health", "humanitarian", "conflict"],
    note: "Medical humanitarian reporting.",
  },
  {
    id: "crisisgroup",
    title: "International Crisis Group",
    org: "ICG",
    url: "https://www.crisisgroup.org/rss",
    kind: "rss",
    region: "Global",
    topics: ["conflict", "governance"],
    note: "Conflict analysis + early warning.",
  },
  {
    id: "acaps",
    title: "ACAPS",
    org: "Independent",
    url: "https://www.acaps.org/rss.xml",
    kind: "rss",
    region: "Global",
    topics: ["humanitarian", "conflict", "displacement"],
    note: "Needs-assessment + crisis overviews.",
  },
  {
    id: "amnesty",
    title: "Amnesty International",
    org: "Amnesty",
    url: "https://www.amnesty.org/en/feed/latest/news/",
    kind: "rss",
    region: "Global",
    topics: ["governance", "protest", "conflict"],
    note: "Human rights investigations.",
  },
  {
    id: "hrw",
    title: "Human Rights Watch",
    org: "HRW",
    url: "https://www.hrw.org/rss/news",
    kind: "rss",
    region: "Global",
    topics: ["governance", "conflict", "protest"],
    note: "Rights investigations + reporting.",
  },
  /* ── Nitter (community-hosted Twitter/X RSS mirrors) ──
   * Nitter instances rotate frequently; these are templates the operator
   * can enable. Replace the host with any live instance. */
  {
    id: "nitter-aurora",
    title: "Aurora Intel (nitter)",
    org: "Community mirror",
    url: "https://nitter.privacydev.net/aurora_intel/rss",
    kind: "nitter",
    region: "Asia",
    topics: ["conflict"],
    note: "OSINT Middle East conflict tracking. Nitter mirror — enable + edit host.",
  },
  {
    id: "nitter-intelcrab",
    title: "The Intel Crab (nitter)",
    org: "Community mirror",
    url: "https://nitter.privacydev.net/intelcrab/rss",
    kind: "nitter",
    region: "Europe",
    topics: ["conflict"],
    note: "OSINT Ukraine/Russia theater. Nitter mirror — enable + edit host.",
  },
];

/* ═══════════════════════════════════════════════════════════════
   CORS PROXY FALLBACK CHAIN

   Browsers block cross-origin feed fetches without CORS headers. We try a
   direct request first (some feeds are CORS-enabled), then walk a list of
   public read-only proxies. The chain is configurable from the UI; for
   privacy-sensitive deployments, self-host a proxy (e.g. rss-bridge) and
   set it as the only entry.
   ═══════════════════════════════════════════════════════════════ */

export type ProxyBuilder = (url: string) => string;

export const DEFAULT_PROXIES: ProxyBuilder[] = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u) => `https://r.jina.ai/${u}`,
];

/* ═══════════════════════════════════════════════════════════════
   XML PARSING (RSS 2.0 + Atom 1.0)

   Uses DOMParser when available (browser + jsdom). Falls back to a
   lightweight tag extractor so the parsers remain functional everywhere.
   ═══════════════════════════════════════════════════════════════ */

/** Parse an XML string into a Document, or null when no parser is available. */
function parseXml(xml: string): Document | null {
  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      // DOMParser may return a document containing a <parsererror> on failure.
      const err = doc.getElementsByTagName("parsererror")[0];
      if (!err) return doc;
    } catch {
      /* fall through to regex */
    }
  }
  return null;
}

function textOf(parent: Element | null | undefined, tag: string): string {
  if (!parent) return "";
  const el = parent.getElementsByTagName(tag)[0];
  return el?.textContent?.trim() ?? "";
}

/** Extract the first <link> href (Atom) from an entry. */
function atomLink(entry: Element | null): string {
  if (!entry) return "";
  const links = entry.getElementsByTagName("link");
  let fallback = "";
  for (let i = 0; i < links.length; i++) {
    const l = links[i];
    const rel = l.getAttribute("rel");
    const href = l.getAttribute("href") ?? "";
    if (!href) continue;
    if (!fallback) fallback = href;
    if (!rel || rel === "alternate") return href;
  }
  return fallback;
}

/** Regex-based fallback used when DOMParser is unavailable or errors. */
function extractBlocks(xml: string, tag: "item" | "entry"): ParsedEntry[] {
  const out: ParsedEntry[] = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const field = (blk: string, name: string): string => {
    const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i").exec(blk);
    return m ? m[1].trim() : "";
  };
  const attr = (blk: string, name: string): string => {
    const m = new RegExp(`<link[^>]*href="([^"]+)"[^>]*>`, "i").exec(blk);
    return m ? m[1] : "";
  };
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const blk = m[1];
    const link = tag === "entry" ? attr(blk, "link") : field(blk, "link");
    out.push({
      title: stripTags(field(blk, "title")),
      link,
      summary: stripTags(field(blk, "description") || field(blk, "summary") || field(blk, "content")),
      guid: field(blk, "guid") || field(blk, "id") || link,
      pubDate: field(blk, "pubDate") || field(blk, "updated") || field(blk, "published") || field(blk, "date"),
    });
  }
  return out;
}

/** Collapse HTML entities + tags to plain text for matching + display. */
export function stripTags(html: string): string {
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

/** Parse an RSS 2.0 feed document into raw entries. */
export function parseRSS(xml: string): ParsedEntry[] {
  const doc = parseXml(xml);
  if (!doc) return extractBlocks(xml, "item");
  const items = doc.getElementsByTagName("item");
  const out: ParsedEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const link = textOf(it, "link");
    out.push({
      title: stripTags(textOf(it, "title")),
      link,
      summary: stripTags(textOf(it, "description")),
      guid: textOf(it, "guid") || link,
      pubDate: textOf(it, "pubDate") || textOf(it, "date") || textOf(it, "dc:date"),
    });
  }
  return out;
}

/** Parse an Atom 1.0 feed document into raw entries. */
export function parseAtom(xml: string): ParsedEntry[] {
  const doc = parseXml(xml);
  if (!doc) return extractBlocks(xml, "entry");
  const entries = doc.getElementsByTagName("entry");
  const out: ParsedEntry[] = [];
  for (let i = 0; i < entries.length; i++) {
    const en = entries[i];
    const link = atomLink(en);
    out.push({
      title: stripTags(textOf(en, "title")),
      link,
      summary: stripTags(textOf(en, "summary") || textOf(en, "content")),
      guid: textOf(en, "id") || link,
      pubDate: textOf(en, "updated") || textOf(en, "published"),
    });
  }
  return out;
}

/** Detect feed flavor and parse. Items with no title are dropped. */
export function parseFeed(xml: string): ParsedEntry[] {
  const hasEntry = /<entry[\s>]/i.test(xml);
  const hasItem = /<item[\s>]/i.test(xml);
  let raw: ParsedEntry[];
  if (hasEntry && !hasItem) raw = parseAtom(xml);
  else if (hasItem && !hasEntry) raw = parseRSS(xml);
  else {
    // Ambiguous or broken: try RSS then Atom, keep whichever yields items.
    raw = parseRSS(xml);
    if (raw.length === 0) raw = parseAtom(xml);
  }
  return raw.filter((e) => e.title.length > 0);
}

/* ═══════════════════════════════════════════════════════════════
   COUNTRY DETECTION + VULNERABILITY INDEX

   Builds a lookup from the world backbone so feed items can be tied to the
   countries they describe, and boosted by those countries' composite
   vulnerability score (the same index that powers /the-index/).
   ═══════════════════════════════════════════════════════════════ */

export interface CountryIndex {
  /** Country names lowercased, longest first to avoid prefix collisions. */
  byName: { name: string; iso3: string }[];
  /** ISO3 → composite vulnerability 0-100. */
  vulnerability: Record<string, number>;
  /** ISO3 → region. */
  region: Record<string, string>;
}

/** Build the country index from the world backbone. Pure + idempotent. */
export function buildCountryIndex(countries: CountryData[]): CountryIndex {
  const byName = countries
    .map((c) => ({ name: c.name_en.toLowerCase(), iso3: c.iso3 }))
    .sort((a, b) => b.name.length - a.name.length);
  const vulnerability: Record<string, number> = {};
  const region: Record<string, string> = {};
  for (const c of countries) {
    vulnerability[c.iso3] = calculateVulnerability(c).composite;
    region[c.iso3] = c.region;
  }
  return { byName, vulnerability, region };
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if a country name appears as a standalone token in the text blob. */
function matchesCountry(text: string, name: string): boolean {
  if (name.length <= 4) {
    return new RegExp(`\\b${escapeReg(name)}\\b`).test(text);
  }
  return text.includes(name);
}

/** Detect which countries a piece of text references. */
export function detectCountries(text: string, index: CountryIndex): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const { name, iso3 } of index.byName) {
    if (matchesCountry(lower, name) && !found.includes(iso3)) {
      found.push(iso3);
    }
  }
  return found;
}

/** Match a text blob against the topic lexicons. */
export function matchTopics(text: string): { topic: PulseTopic; keyword: string }[] {
  const lower = text.toLowerCase();
  const hits: { topic: PulseTopic; keyword: string }[] = [];
  for (const topic of Object.keys(TOPIC_KEYWORDS) as PulseTopic[]) {
    for (const kw of TOPIC_KEYWORDS[topic]) {
      if (lower.includes(kw)) {
        hits.push({ topic, keyword: kw });
        break; // one keyword per topic is enough signal
      }
    }
  }
  return hits;
}

/* ═══════════════════════════════════════════════════════════════
   HASHING + DEDUP
   ═══════════════════════════════════════════════════════════════ */

/** Cheap, deterministic FNV-1a 32-bit string hash. */
export function hashId(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Stable id for a parsed entry, preferring guid then link then title. */
export function entryId(e: ParsedEntry): string {
  return hashId(e.guid || e.link || e.title);
}

/** Remove duplicate items by id, keeping the first (highest-scored) copy. */
export function dedupeItems(items: PulseItem[]): PulseItem[] {
  const seen = new Set<string>();
  const out: PulseItem[] = [];
  for (const it of items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════
   SCORING + RANKING

   Composite rank =
     keyword density        (4 × matched keyword count)
   + topic weight           (Σ topic weight × 8)
   + vulnerability boost    (max country vulnerability × 0.4  → 0–40)
   + source-topic prior     (+3 per source.topic already matched)
   + recency boost          (0–15 by age)
   ═══════════════════════════════════════════════════════════════ */

/** Recency boost: 15 if <24h, 10 if <3d, 6 if <7d, 3 if <30d, else 0. */
export function recencyBoost(publishedMs: number, now: number = Date.now()): number {
  if (!publishedMs || !Number.isFinite(publishedMs)) return 0;
  const ageDays = (now - publishedMs) / 86_400_000;
  if (ageDays < 0) return 15; // future-dated = treat as fresh
  if (ageDays < 1) return 15;
  if (ageDays < 3) return 10;
  if (ageDays < 7) return 6;
  if (ageDays < 30) return 3;
  return 0;
}

/**
 * Score a single parsed entry into a fully-ranked PulseItem.
 * Pure: given the same entry + source + index it always returns the same item.
 */
export function scoreItem(
  entry: ParsedEntry,
  source: PulseSource,
  index: CountryIndex,
  now: number = Date.now(),
): PulseItem {
  const blob = `${entry.title} ${entry.summary}`;
  const topicHits = matchTopics(blob);
  const matchedTopics = topicHits.map((h) => h.topic);
  const matchedKeywords = topicHits.map((h) => h.keyword);

  const matchedIso3 = detectCountries(blob, index);
  let vulnerabilityBoost = 0;
  let region: PulseRegion = source.region;
  for (const iso3 of matchedIso3) {
    const v = index.vulnerability[iso3];
    if (typeof v === "number" && Number.isFinite(v)) {
      vulnerabilityBoost = Math.max(vulnerabilityBoost, v);
    }
    // If the source is a global wire, anchor the item to a detected region.
    if (region === "Global") {
      const r = index.region[iso3];
      if (r === "Africa" || r === "Asia" || r === "Americas" || r === "Europe" || r === "Oceania") {
        region = r as PulseRegion;
      }
    }
  }
  // If no region detected from countries, fall back to source region (may be Global).
  if (region === "Global" && source.region !== "Global") region = source.region;

  const published = Date.parse(entry.pubDate) || 0;

  const keywordDensity = matchedKeywords.length * 4;
  const topicSum = matchedTopics.reduce((acc, t) => acc + (TOPIC_WEIGHT[t] ?? 1) * 8, 0);
  // Prior: a source whose declared topics overlap the item's matched topics.
  const prior = matchedTopics.filter((t) => source.topics.includes(t)).length * 3;
  const vuln = vulnerabilityBoost * 0.4;
  const recency = recencyBoost(published, now);
  const score = keywordDensity + topicSum + vuln + prior + recency;

  return {
    id: entryId(entry),
    title: entry.title,
    link: entry.link,
    summary: entry.summary.slice(0, 600),
    published,
    publishedLabel: entry.pubDate,
    sourceId: source.id,
    sourceTitle: source.title,
    kind: source.kind,
    region,
    matchedKeywords,
    matchedTopics,
    matchedIso3,
    vulnerabilityBoost,
    score,
  };
}

/** Rank a batch of parsed entries from one source into scored items. */
export function rankEntries(
  entries: ParsedEntry[],
  source: PulseSource,
  index: CountryIndex,
  now: number = Date.now(),
): PulseItem[] {
  return entries.map((e) => scoreItem(e, source, index, now));
}

/**
 * Merge + dedupe + sort items from many sources, highest score first.
 * Ties broken by recency then alphabetical title for stable output.
 */
export function rankFeed(items: PulseItem[]): PulseItem[] {
  return dedupeItems(
    items.slice().sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.published !== a.published) return b.published - a.published;
      return a.title.localeCompare(b.title);
    }),
  );
}

/* ═══════════════════════════════════════════════════════════════
   FILTERS

   Pure predicates used by the UI layer. A region filter hides items that
   are neither in that region nor global wires. A topic filter keeps items
   that matched at least one selected topic.
   ═══════════════════════════════════════════════════════════════ */

export function regionMatches(item: PulseItem, selected: PulseRegion[]): boolean {
  if (selected.length === 0) return true;
  if (selected.includes("Global")) return true;
  if (item.region === "Global") return true; // global wires always shown
  return selected.includes(item.region);
}

export function topicMatches(item: PulseItem, selected: PulseTopic[]): boolean {
  if (selected.length === 0) return true;
  return item.matchedTopics.some((t) => selected.includes(t));
}

export function keywordMatches(item: PulseItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${item.title} ${item.summary}`.toLowerCase();
  return q
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => hay.includes(token));
}

/** Combined filter chain for the ranked feed. */
export function filterFeed(
  items: PulseItem[],
  opts: {
    regions?: PulseRegion[];
    topics?: PulseTopic[];
    query?: string;
    minScore?: number;
    onlyWithCountry?: boolean;
  },
): PulseItem[] {
  const { regions = [], topics = [], query = "", minScore = 0, onlyWithCountry = false } = opts;
  return items.filter(
    (it) =>
      it.score >= minScore &&
      regionMatches(it, regions) &&
      topicMatches(it, topics) &&
      keywordMatches(it, query) &&
      (!onlyWithCountry || it.matchedIso3.length > 0),
  );
}

/* ═══════════════════════════════════════════════════════════════
   FETCH LAYER (browser only)

   Tries a direct request, then walks the proxy chain. Returns the first
   body that looks like a feed. Never throws on a single source failure —
   the caller aggregates per-source outcomes.
   ═══════════════════════════════════════════════════════════════ */

export interface FetchResult {
  sourceId: string;
  ok: boolean;
  items: PulseItem[];
  /** Which transport succeeded: "direct" | proxy index | "cache" | "none". */
  via: string;
  error?: string;
}

function looksLikeFeed(body: string): boolean {
  return /<(rss|feed|item|entry)[\s>]/i.test(body);
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch a single source's feed text, walking direct → proxy chain.
 * Returns the raw body string, or null if every attempt failed.
 */
export async function fetchFeedText(
  url: string,
  proxies: ProxyBuilder[] = DEFAULT_PROXIES,
  timeoutMs = 15_000,
): Promise<{ body: string; via: string } | null> {
  const candidates: { url: string; via: string }[] = [{ url, via: "direct" }];
  for (let i = 0; i < proxies.length; i++) {
    candidates.push({ url: proxies[i](url), via: `proxy-${i + 1}` });
  }

  for (const cand of candidates) {
    try {
      const res = await fetchWithTimeout(cand.url, timeoutMs);
      if (!res.ok) continue;
      const body = await res.text();
      if (body && looksLikeFeed(body)) return { body, via: cand.via };
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

/**
 * Refresh a set of sources: fetch, parse, score, rank. Per-source failures
 * are swallowed and reported in the result. Never rejects.
 */
export async function refreshSources(
  sources: PulseSource[],
  index: CountryIndex,
  opts: {
    proxies?: ProxyBuilder[];
    timeoutMs?: number;
    now?: number;
  } = {},
): Promise<{ items: PulseItem[]; results: FetchResult[] }> {
  const { proxies = DEFAULT_PROXIES, timeoutMs = 15_000, now = Date.now() } = opts;
  const results = await Promise.all(
    sources.map(async (src): Promise<FetchResult> => {
      try {
        const fetched = await fetchFeedText(src.url, proxies, timeoutMs);
        if (!fetched) {
          return { sourceId: src.id, ok: false, items: [], via: "none", error: "No transport succeeded (network/CORS)" };
        }
        const entries = parseFeed(fetched.body);
        const items = rankEntries(entries, src, index, now);
        return { sourceId: src.id, ok: true, items, via: fetched.via };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { sourceId: src.id, ok: false, items: [], via: "none", error: msg };
      }
    }),
  );
  const all = results.flatMap((r) => r.items);
  return { items: rankFeed(all), results };
}

/* ═══════════════════════════════════════════════════════════════
   INDEXEDDB CACHE (offline-readable)

   Dedicated DB "vfx-pulse" so The Pulse never touches the shared store.
   All items are upserted keyed by stable id; last-refresh metadata is kept
   alongside so the UI can show "cached N items, refreshed at …".
   ═══════════════════════════════════════════════════════════════ */

const PULSE_DB = "vfx-pulse";
const PULSE_DB_VERSION = 1;
const ITEM_STORE = "pulse-items";
const META_STORE = "pulse-meta";

export interface PulseMeta {
  key: "last-refresh";
  ts: number;
  count: number;
  sourceIds: string[];
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB not available on server"));
  }
  if (!dbPromise) {
    dbPromise = openDB(PULSE_DB, PULSE_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(ITEM_STORE)) {
          db.createObjectStore(ITEM_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

/** Replace the entire cached feed with a fresh batch. */
export async function pulseCacheSet(items: PulseItem[], sourceIds: string[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction([ITEM_STORE, META_STORE], "readwrite");
    await tx.objectStore(ITEM_STORE).clear();
    for (const it of items) {
      await tx.objectStore(ITEM_STORE).put(it);
    }
    await tx.objectStore(META_STORE).put({
      key: "last-refresh",
      ts: Date.now(),
      count: items.length,
      sourceIds,
    } satisfies PulseMeta);
    await tx.done;
  } catch {
    /* cache is best-effort; UI degrades to in-memory */
  }
}

/** Read every cached item, highest score first. */
export async function pulseCacheGetAll(): Promise<PulseItem[]> {
  try {
    const db = await getDB();
    const all = (await db.getAll(ITEM_STORE)) as PulseItem[];
    return rankFeed(all);
  } catch {
    return [];
  }
}

/** Last refresh metadata, or null when never cached. */
export async function pulseCacheMeta(): Promise<PulseMeta | null> {
  try {
    const db = await getDB();
    return ((await db.get(META_STORE, "last-refresh")) as PulseMeta) ?? null;
  } catch {
    return null;
  }
}

/** Wipe the cached feed + metadata. */
export async function pulseCacheClear(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear(ITEM_STORE);
    await db.clear(META_STORE);
  } catch {
    /* ignore */
  }
}

/* ═══════════════════════════════════════════════════════════════
   PERSISTED PREFERENCES (localStorage)

   Kept tiny and defensive so the page boots even when storage is blocked.
   ═══════════════════════════════════════════════════════════════ */

export interface PulsePrefs {
  /** Enabled source ids. Missing = all defaults enabled. */
  enabledSources: string[];
  /** User-added custom sources. */
  customSources: PulseSource[];
  /** Selected region filters. Empty = all. */
  regions: PulseRegion[];
  /** Selected topic filters. Empty = all. */
  topics: PulseTopic[];
  /** Custom proxy URL templates (%s = encoded url), or empty for defaults. */
  proxies: string[];
  onlyWithCountry: boolean;
}

export const DEFAULT_PREFS: PulsePrefs = {
  enabledSources: [],
  customSources: [],
  regions: [],
  topics: [],
  proxies: [],
  onlyWithCountry: false,
};

const PREFS_KEY = "vfx-pulse-prefs";

export function loadPrefs(): PulsePrefs {
  if (typeof window === "undefined") return { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<PulsePrefs>) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: PulsePrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage blocked — ignore */
  }
}

/** Resolve the effective proxy chain from user prefs (with %s template support). */
export function resolveProxies(prefs: PulsePrefs): ProxyBuilder[] {
  if (!prefs.proxies || prefs.proxies.length === 0) return DEFAULT_PROXIES;
  return prefs.proxies
    .map((tpl): ProxyBuilder | null => {
      if (!tpl) return null;
      // Support both "%s"-templated and "append-encoded" styles.
      if (tpl.includes("%s")) return (u) => tpl.replace("%s", encodeURIComponent(u));
      if (tpl.endsWith("=") || /[=/?]$/.test(tpl)) return (u) => tpl + encodeURIComponent(u);
      return (u) => tpl + encodeURIComponent(u);
    })
    .filter((x): x is ProxyBuilder => x !== null);
}

/** Merge default + custom sources, filtered by enabled ids. */
export function resolveSources(prefs: PulsePrefs): PulseSource[] {
  const all = [...DEFAULT_SOURCES, ...prefs.customSources];
  if (prefs.enabledSources.length === 0) return all;
  return all.filter((s) => prefs.enabledSources.includes(s.id));
}
