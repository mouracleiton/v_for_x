import { describe, it, expect } from "vitest";
import {
  parseRSS,
  parseAtom,
  parseFeed,
  stripTags,
  hashId,
  entryId,
  dedupeItems,
  matchTopics,
  detectCountries,
  buildCountryIndex,
  scoreItem,
  rankEntries,
  rankFeed,
  recencyBoost,
  regionMatches,
  topicMatches,
  keywordMatches,
  filterFeed,
  resolveProxies,
  resolveSources,
  DEFAULT_SOURCES,
  DEFAULT_PROXIES,
  TOPIC_KEYWORDS,
  type PulseItem,
  type PulseSource,
  type PulseRegion,
  type CountryIndex,
} from "../lib/pulse";

/* ═══════════════════════════════════════════════════════════════
   FIXTURES
   ═══════════════════════════════════════════════════════════════ */

const RSS_SAMPLE = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Wire</title>
    <item>
      <title>Famine declared in Sudan as acute food insecurity soars</title>
      <link>https://example.org/sudan-famine</link>
      <description>IPC Phase 5 famine confirmed; millions face starvation.</description>
      <guid>https://example.org/sudan-famine</guid>
      <pubDate>Mon, 04 Aug 2025 09:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Drone strikes hit frontline city</title>
      <link>https://example.org/strikes</link>
      <description><![CDATA[ Airstrikes and shelling reported overnight. ]]></description>
      <guid>https://example.org/strikes</guid>
      <pubDate>Tue, 05 Aug 2025 09:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM_SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Wire</title>
  <entry>
    <title>Cholera outbreak overwhelms clinic in Haiti</title>
    <link rel="alternate" href="https://example.org/haiti-cholera"/>
    <id>urn:uuid:haiti-cholera</id>
    <summary>A cholera outbreak has overwhelmed the local health system.</summary>
    <published>2025-08-03T00:00:00Z</published>
  </entry>
  <entry>
    <title>Refugees flee across the border after mass arrest</title>
    <link href="https://example.org/refugees"/>
    <id>urn:uuid:refugees</id>
    <updated>2025-08-06T00:00:00Z</updated>
  </entry>
</feed>`;

/** Minimal country index that doesn't depend on the full backbone. */
const FAKE_INDEX: CountryIndex = {
  byName: [
    { name: "sudan", iso3: "SDN" },
    { name: "haiti", iso3: "HTI" },
  ].sort((a, b) => b.name.length - a.name.length),
  vulnerability: { SDN: 80, HTI: 60 },
  region: { SDN: "Africa", HTI: "Americas" },
};

const SOURCE: PulseSource = {
  id: "test",
  title: "Test Wire",
  url: "https://example.org/feed",
  kind: "rss",
  region: "Global",
  topics: ["famine", "conflict", "health", "displacement"],
};

const NOW = new Date("2025-08-07T00:00:00Z").getTime();

/* ═══════════════════════════════════════════════════════════════
   PARSERS
   ═══════════════════════════════════════════════════════════════ */

describe("stripTags", () => {
  it("strips HTML and decodes entities", () => {
    expect(stripTags("<p>Hello &amp; goodbye</p>")).toBe("Hello & goodbye");
  });
  it("unwraps CDATA", () => {
    expect(stripTags("<![CDATA[ raw <b>text</b> ]]>")).toBe("raw text");
  });
  it("removes tags", () => {
    expect(stripTags("<a href='x'>click <b>here</b></a>")).toBe("click here");
  });
});

describe("parseRSS", () => {
  it("extracts items", () => {
    const items = parseRSS(RSS_SAMPLE);
    expect(items).toHaveLength(2);
    expect(items[0].title).toContain("Famine");
    expect(items[0].link).toBe("https://example.org/sudan-famine");
    expect(items[0].summary).toContain("IPC Phase 5");
    expect(items[0].pubDate).toContain("2025");
  });
  it("unwraps CDATA in descriptions", () => {
    const items = parseRSS(RSS_SAMPLE);
    expect(items[1].summary).toBe("Airstrikes and shelling reported overnight.");
  });
  it("returns empty on garbage", () => {
    expect(parseRSS("not xml at all")).toEqual([]);
  });
});

describe("parseAtom", () => {
  it("extracts entries and prefers alternate link", () => {
    const entries = parseAtom(ATOM_SAMPLE);
    expect(entries).toHaveLength(2);
    expect(entries[0].link).toBe("https://example.org/haiti-cholera");
    expect(entries[0].summary).toContain("cholera");
  });
  it("uses published or updated as pubDate", () => {
    const entries = parseAtom(ATOM_SAMPLE);
    expect(entries[0].pubDate).toBe("2025-08-03T00:00:00Z");
    expect(entries[1].pubDate).toBe("2025-08-06T00:00:00Z");
  });
});

describe("parseFeed (dispatch)", () => {
  it("routes rss to parseRSS", () => {
    expect(parseFeed(RSS_SAMPLE)).toHaveLength(2);
  });
  it("routes atom to parseAtom", () => {
    expect(parseFeed(ATOM_SAMPLE)).toHaveLength(2);
  });
  it("drops titleless entries", () => {
    const broken = `<rss><channel><item><title></title><link>x</link></item></channel></rss>`;
    expect(parseFeed(broken)).toEqual([]);
  });
  it("falls back when ambiguous", () => {
    const both = `<feed><item><title>x</title><link>y</link></item></feed>`;
    expect(parseFeed(both)).toHaveLength(1);
  });
});

/* ═══════════════════════════════════════════════════════════════
   HASH + DEDUP
   ═══════════════════════════════════════════════════════════════ */

describe("hashId / entryId / dedupeItems", () => {
  it("hashId is deterministic and hex", () => {
    expect(hashId("abc")).toBe(hashId("abc"));
    expect(hashId("abc")).not.toBe(hashId("abd"));
    expect(/^[0-9a-f]{8}$/.test(hashId("whatever"))).toBe(true);
  });
  it("entryId prefers guid then link", () => {
    expect(entryId({ title: "t", link: "l", summary: "", guid: "g", pubDate: "" })).toBe(hashId("g"));
    expect(entryId({ title: "t", link: "l", summary: "", guid: "", pubDate: "" })).toBe(hashId("l"));
  });
  it("dedupeItems keeps first by id", () => {
    const a: PulseItem = mkItem("x", 10);
    const b: PulseItem = mkItem("y", 5);
    const dup: PulseItem = { ...a, score: 1 };
    expect(dedupeItems([a, dup, b])).toEqual([a, b]);
  });
});

/* ═══════════════════════════════════════════════════════════════
   KEYWORD / COUNTRY DETECTION
   ═══════════════════════════════════════════════════════════════ */

describe("matchTopics", () => {
  it("matches famine + conflict keywords", () => {
    const hits = matchTopics("Famine declared; drone strikes reported");
    const topics = hits.map((h) => h.topic).sort();
    expect(topics).toEqual(["conflict", "famine"]);
  });
  it("returns one hit per topic at most", () => {
    const hits = matchTopics("starvation and starve and malnutrition");
    expect(hits.filter((h) => h.topic === "famine")).toHaveLength(1);
  });
  it("returns empty when nothing matches", () => {
    expect(matchTopics("a calm day with nice weather")).toHaveLength(0);
  });
  it("every topic has keywords", () => {
    for (const topics of Object.values(TOPIC_KEYWORDS)) expect(topics.length).toBeGreaterThan(0);
  });
});

describe("detectCountries + buildCountryIndex", () => {
  it("detects known countries case-insensitively", () => {
    expect(detectCountries("Crisis in SUDAN escalates", FAKE_INDEX)).toEqual(["SDN"]);
    expect(detectCountries("report from Haiti today", FAKE_INDEX)).toEqual(["HTI"]);
  });
  it("returns empty on no match", () => {
    expect(detectCountries("nothing here", FAKE_INDEX)).toEqual([]);
  });
  it("buildCountryIndex sorts longest name first and maps vulnerability + region", () => {
    const backbone = require("../data/world_backbone.json");
    const idx = buildCountryIndex(backbone.countries);
    expect(idx.byName.length).toBeGreaterThan(150);
    // Longest name first.
    expect(idx.byName[0].name.length).toBeGreaterThanOrEqual(idx.byName[1].name.length);
    // ISO3 region map populated for a known country.
    expect(idx.region["SDN"]).toBe("Africa");
    expect(idx.vulnerability["SDN"]).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════
   SCORING + RANKING
   ═══════════════════════════════════════════════════════════════ */

describe("recencyBoost", () => {
  it("awards max boost under 24h", () => {
    expect(recencyBoost(NOW - 3_600_000, NOW)).toBe(15);
  });
  it("decays with age", () => {
    expect(recencyBoost(NOW - 2 * 86_400_000, NOW)).toBe(10);
    expect(recencyBoost(NOW - 5 * 86_400_000, NOW)).toBe(6);
    expect(recencyBoost(NOW - 20 * 86_400_000, NOW)).toBe(3);
  });
  it("is zero beyond 30d or unknown", () => {
    expect(recencyBoost(NOW - 60 * 86_400_000, NOW)).toBe(0);
    expect(recencyBoost(0, NOW)).toBe(0);
  });
});

describe("scoreItem", () => {
  it("boosts country-linked items by vulnerability", () => {
    const fam = scoreItem(
      { title: "Famine in Sudan", link: "l", summary: "starvation", guid: "g1", pubDate: "2025-08-04" },
      SOURCE, FAKE_INDEX, NOW,
    );
    expect(fam.matchedIso3).toContain("SDN");
    expect(fam.vulnerabilityBoost).toBe(80);
    expect(fam.matchedTopics).toContain("famine");
  });
  it("anchors global wire to detected country region", () => {
    const it = scoreItem(
      { title: "Cholera in Haiti", link: "l", summary: "outbreak", guid: "g2", pubDate: "2025-08-03" },
      SOURCE, FAKE_INDEX, NOW,
    );
    expect(it.region).toBe("Americas");
  });
  it("higher-vulnerability + more keywords outranks low-signal items", () => {
    const high = scoreItem(
      { title: "Sudan famine airstrike displaces refugees", link: "a", summary: "", guid: "h", pubDate: "2025-08-06" },
      SOURCE, FAKE_INDEX, NOW,
    );
    const low = scoreItem(
      { title: "Quiet weather note", link: "b", summary: "", guid: "l", pubDate: "2025-08-01" },
      SOURCE, FAKE_INDEX, NOW,
    );
    expect(high.score).toBeGreaterThan(low.score);
  });
});

describe("rankEntries + rankFeed", () => {
  it("ranks highest score first and dedupes", () => {
    const entries = parseRSS(RSS_SAMPLE).concat(parseAtom(ATOM_SAMPLE));
    const scored = rankEntries(entries, SOURCE, FAKE_INDEX, NOW);
    const ranked = rankFeed(scored);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
    // unique ids
    expect(new Set(ranked.map((r) => r.id)).size).toBe(ranked.length);
  });
});

/* ═══════════════════════════════════════════════════════════════
   FILTERS
   ═══════════════════════════════════════════════════════════════ */

const SAMPLE_ITEMS: PulseItem[] = [
  mkItem("a", 50, "Africa", "famine", "Sudan famine crisis"),
  mkItem("b", 30, "Asia", "conflict", "Drone strikes frontline"),
  mkItem("c", 10, "Global", "health", "Cholera Haiti outbreak"),
];

describe("regionMatches / topicMatches / keywordMatches", () => {
  it("global wires always pass a region filter", () => {
    expect(regionMatches(mkItem("g", 1, "Global"), ["Africa"])).toBe(true);
  });
  it("concrete regions are filtered", () => {
    expect(regionMatches(mkItem("a", 1, "Asia"), ["Africa"])).toBe(false);
  });
  it("empty selections match all", () => {
    expect(regionMatches(SAMPLE_ITEMS[0], [])).toBe(true);
    expect(topicMatches(SAMPLE_ITEMS[0], [])).toBe(true);
    expect(keywordMatches(SAMPLE_ITEMS[0], "")).toBe(true);
  });
  it("keyword query requires all tokens", () => {
    expect(keywordMatches(SAMPLE_ITEMS[0], "sudan famine")).toBe(true);
    expect(keywordMatches(SAMPLE_ITEMS[0], "sudan nepal")).toBe(false);
  });
});

describe("filterFeed", () => {
  it("filters by region (keeping global)", () => {
    const out = filterFeed(SAMPLE_ITEMS, { regions: ["Africa"] });
    expect(out.map((i) => i.id)).toEqual(["a", "c"]); // c is global, kept
  });
  it("filters by topic", () => {
    const out = filterFeed(SAMPLE_ITEMS, { topics: ["conflict"] });
    expect(out.map((i) => i.id)).toEqual(["b"]);
  });
  it("filters by keyword", () => {
    const out = filterFeed(SAMPLE_ITEMS, { query: "cholera" });
    expect(out.map((i) => i.id)).toEqual(["c"]);
  });
  it("onlyWithCountry gate", () => {
    const items = [
      mkItem("with", 5, "Global", "famine", "Crisis in Sudan deepens"),
      mkItem("without", 5, "Global", "health", "Generic health update"),
    ];
    // mkItem doesn't set iso3; build a real scored item for the country test
    const withCountry = scoreItem(
      { title: "Crisis in Sudan deepens", link: "x", summary: "", guid: "wc", pubDate: "" },
      SOURCE, FAKE_INDEX, NOW,
    );
    const without = scoreItem(
      { title: "Generic health update", link: "y", summary: "", guid: "wo", pubDate: "" },
      SOURCE, FAKE_INDEX, NOW,
    );
    const out = filterFeed([withCountry, without], { onlyWithCountry: true });
    expect(out.map((i) => i.id)).toEqual([withCountry.id]);
  });
});

/* ═══════════════════════════════════════════════════════════════
   SOURCES + PROXIES RESOLUTION
   ═══════════════════════════════════════════════════════════════ */

describe("DEFAULT_SOURCES", () => {
  it("ships with real humanitarian feeds", () => {
    expect(DEFAULT_SOURCES.length).toBeGreaterThanOrEqual(8);
    expect(DEFAULT_SOURCES.some((s) => s.id === "reliefweb")).toBe(true);
    expect(DEFAULT_SOURCES.some((s) => s.id === "fewsnet")).toBe(true);
    for (const s of DEFAULT_SOURCES) {
      expect(s.url.startsWith("http")).toBe(true);
      expect(s.topics.length).toBeGreaterThan(0);
    }
  });
  it("includes nitter-style mirrors", () => {
    expect(DEFAULT_SOURCES.some((s) => s.kind === "nitter")).toBe(true);
  });
});

describe("resolveSources", () => {
  it("empty enabled list = all defaults", () => {
    const out = resolveSources({ enabledSources: [], customSources: [] } as any);
    expect(out.length).toBe(DEFAULT_SOURCES.length);
  });
  it("filters by enabled ids and includes custom", () => {
    const custom: PulseSource = { id: "c1", title: "C", url: "https://x", kind: "rss", region: "Africa", topics: [] };
    const out = resolveSources({ enabledSources: ["reliefweb", "c1"], customSources: [custom] } as any);
    expect(out.map((s) => s.id).sort()).toEqual(["c1", "reliefweb"]);
  });
});

describe("resolveProxies", () => {
  it("falls back to defaults when empty", () => {
    expect(resolveProxies({ proxies: [] } as any)).toEqual(DEFAULT_PROXIES);
    expect(DEFAULT_PROXIES.length).toBeGreaterThanOrEqual(2);
  });
  it("supports %s template", () => {
    const [p] = resolveProxies({ proxies: ["https://bridge/?url=%s"] } as any);
    expect(p("https://feed")).toBe("https://bridge/?url=" + encodeURIComponent("https://feed"));
  });
  it("supports append style", () => {
    const [p] = resolveProxies({ proxies: ["https://bridge/?url="] } as any);
    expect(p("https://feed")).toBe("https://bridge/?url=" + encodeURIComponent("https://feed"));
  });
});

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function mkItem(
  id: string,
  score: number,
  region: PulseRegion = "Global",
  topic: PulseItem["matchedTopics"][number] | null = null,
  text = "",
): PulseItem {
  return {
    id,
    title: text,
    link: "",
    summary: "",
    published: 0,
    publishedLabel: "",
    sourceId: "test",
    sourceTitle: "Test",
    kind: "rss",
    region,
    matchedKeywords: [],
    matchedTopics: topic ? [topic] : [],
    matchedIso3: [],
    vulnerabilityBoost: 0,
    score,
  };
}
