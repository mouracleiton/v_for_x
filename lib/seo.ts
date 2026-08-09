/**
 * V FOR X — Centralized SEO metadata configuration
 *
 * All pages import from here to get consistent OG tags, Twitter cards,
 * and per-page titles/descriptions.
 */

export const SITE = {
  name: "V FOR X",
  url: "https://mouracleiton.github.io/v_for_x",
  title: "V FOR X — the platform that refuses to die",
  description:
    "Open data platform: 200 countries × 19 dimensions. Hunger, water, health, energy, education, climate, inequality, governance. The equation writes itself.",
  ogImage: "https://mouracleiton.github.io/v_for_x/og-default.png",
  locale: "en_US",
  twitter: "@vforx",
} as const;

export interface PageMeta {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
}

/* ═══ PER-PAGE METADATA ═══ */
/* Each section gets its own title + description for search + social sharing */

export const PAGE_META: Record<string, PageMeta> = {
  "/": {
    title: "V FOR X — Open Data Against Hunger",
    description: "200 countries × 19 dimensions. The cost to end hunger: $93B/yr = 14 days of military spending. Explore the data. Build the argument.",
    path: "/",
  },
  "/sorrow-map/": {
    title: "Sorrow Map — World Crisis Atlas",
    description: "Interactive choropleth of 200 countries colored by 48 dimensions: hunger, conflict, poverty, health, climate, inequality. Click any country for a full dossier.",
    path: "/sorrow-map/",
  },
  "/equation/": {
    title: "The Equation — Model the Fix",
    description: "Ending global hunger costs $93B/year = 0.9% of military spending. 5 budget scenarios, 10-year projections, 8.7M lives saved. The math is undeniable.",
    path: "/equation/",
  },
  "/protocol-x/": {
    title: "Protocol X — Survival Blueprints",
    description: "12 field-tested survival guides: water purification, emergency food, off-grid power, secure communications, nonviolent resistance. Open-source, low-tech, high-impact.",
    path: "/protocol-x/",
  },
  "/registry/": {
    title: "Registry — Accountability Dossiers",
    description: "13 evidence-based dossiers on war crimes, corruption, and human rights violations. ICC/ICJ accountability templates with source provenance.",
    path: "/registry/",
  },
  "/the-web/": {
    title: "The Web — Anonymous Communication",
    description: "Peer-to-peer encrypted messaging. No registration, no server, no tracking. WebRTC with manual signaling. Dead drops. Anonymous identity generation.",
    path: "/the-web/",
  },
  "/the-trail/": {
    title: "The Trail — Resource Routing",
    description: "Aid and logistics ledger. Match needs with resources. Cryptographically signed entries stored locally. No central authority.",
    path: "/the-trail/",
  },
  "/fortress/": {
    title: "Fortress — Distributed Infrastructure",
    description: "This platform is a static export. Any copy is a fully functional node. No databases, no servers, no single point of failure. Self-hosting instructions.",
    path: "/fortress/",
  },
  "/the-mask/": {
    title: "The Mask — Identity & OpSec",
    description: "Operational security guide: threat models, duress codes, ZK identity concepts, browser fingerprinting, metadata hygiene, physical security, social engineering defense.",
    path: "/the-mask/",
  },
  "/the-lens/": {
    title: "The Lens — Compare & Correlate",
    description: "Cross-dimension correlation explorer: 200 countries plotted on any two metrics with Pearson correlation. Side-by-side comparison table + vulnerability radar overlay.",
    path: "/the-lens/",
  },
  "/the-archive/": {
    title: "The Archive — Sources & Methods",
    description: "Full provenance: 16 primary sources (FAO, WHO, World Bank, SIPRI, UNHCR, V-Dem, more). Methodology, data freshness, and version history.",
    path: "/the-archive/",
  },
  "/the-signal/": {
    title: "The Signal — Watchlist & Alerts",
    description: "Monitor countries for crisis escalation. Custom alert rules across 33 metrics. Multi-dimensional threat assessment with shareable configurations.",
    path: "/the-signal/",
  },
  "/the-act/": {
    title: "The Act — Campaign Generator",
    description: "Transform country data into action-ready campaign kits: tweet threads, email templates, one-page briefs. Devastating framing backed by real numbers.",
    path: "/the-act/",
  },
  "/the-index/": {
    title: "The Index — Vulnerability Ranking",
    description: "Composite vulnerability index across 16 domains. Interactive weight sliders, regional rollups, radar charts. Which countries are most vulnerable and why.",
    path: "/the-index/",
  },
  "/the-stories/": {
    title: "The Stories — Narrative Tours",
    description: "Guided data-driven stories through the world's crises. Crisis timelines for all 22 hunger hotspots. Step-by-step narrative tours connecting the dots.",
    path: "/the-stories/",
  },
  "/the-allocator/": {
    title: "The Allocator — Budget Simulator",
    description: "You have the world's military budget. Drag sliders across 6 SDG goals. See how many lives you save. Every dollar is a choice between war and humanity.",
    path: "/the-allocator/",
  },
  "/the-exodus/": {
    title: "The Exodus — Displacement Flow Map",
    description: "Interactive map of the global displacement crisis. Curved flow arcs between refugee origins and hosts. 120M+ forcibly displaced. Every arc is a human stream.",
    path: "/the-exodus/",
  },
  "/the-tactics/": {
    title: "The Tactics — Resistance Decision Matrix",
    description: "17 ways to respond to crisis, ranked by effectiveness. Nonviolent resistance: 53% success. Armed insurgency: 26%. The Chenoweth data is clear.",
    path: "/the-tactics/",
  },
  "/the-matrix/": {
    title: "The Matrix — Data Transparency",
    description: "Which countries have the most missing data? Per-country completeness scores across 20 dimensions. The blind spots of international measurement.",
    path: "/the-matrix/",
  },
  "/the-fronts/": {
    title: "The Fronts — Regional Crisis Dashboard",
    description: "Per-region deep-dives: Africa's 15 hotspots, Asia's conflict zones, Americas' invisible crises. Vulnerability radar, aggregate stats, full country rankings.",
    path: "/the-fronts/",
  },
  "/the-choice/": {
    title: "The Choice — Military vs Health Spending",
    description: "10 countries spend more on military than health. Syria 3.1×, Qatar 2.9×. See the moral calculus per country. How many days of war spending would end your hunger?",
    path: "/the-choice/",
  },
  "/the-briefing/": {
    title: "The Briefing — Country Report Generator",
    description: "Pick any of 200 countries. Get a devastating one-page report with its specific numbers. Printable. Shareable. The argument made personal.",
    path: "/the-briefing/",
  },
  "/the-timeline/": {
    title: "The Timeline — 10-Year Scenario Model",
    description: "5 budget scenarios, 10 years, 8.7M lives in the balance. Interactive hunger trajectory, deaths-avoided chart, regional impact, per-intervention ROI breakdown.",
    path: "/the-timeline/",
  },
  "/the-api/": {
    title: "The API — Public Data API",
    description: "200 countries, 23 dimensions, ~87 fields per country. CC0 license. No auth, no rate limits. Interactive explorer with live queries and code samples.",
    path: "/the-api/",
  },
  "/the-ledger/": {
    title: "The Ledger — Financing & Blockers",
    description: "5 ways to fund the end of hunger (wealth tax, Tobin tax, BEPS, debt, military). 4 structural blockers. 3-phase roadmap to end hunger by 2034.",
    path: "/the-ledger/",
  },
  "/the-dashboard/": {
    title: "The Dashboard — World Crisis Cockpit",
    description: "One screen. The entire world's crisis. Live counters, 8 global indicators, extreme contrasts (Monaco earns 1028× Burundi), cost-to-fix breakdown.",
    path: "/the-dashboard/",
  },
  "/the-submit/": {
    title: "The Submit — Anonymous Dossier Submission",
    description: "Submit corruption and human rights reports anonymously. Client-side encryption, ECDSA signing, zero data leaves your device. Become a whistleblower safely.",
    path: "/the-submit/",
  },
  "/the-network/": {
    title: "The Network — Anonymous Action Circles",
    description: "Connect with activists without compromising anonymity. Action circles, public pledges, self-destructing dead drops. No registration, no tracking.",
    path: "/the-network/",
  },
  "/the-press-kit/": {
    title: "The Press Kit — Citizen Journalist Toolkit",
    description: "Strip EXIF metadata, redact faces, verify file integrity, notarize evidence on the blockchain. All client-side, all anonymous.",
    path: "/the-press-kit/",
  },
  "/the-compare/": {
    title: "The Compare — Side-by-Side Country Analysis",
    description: "Compare 2-4 countries side by side. Vulnerability radar overlay, 19-dimension data table, key metric bar charts, auto-generated narrative, and crisis timeline comparison.",
    path: "/the-compare/",
  },
  "/the-changelog/": {
    title: "The Changelog — Data Evolution Tracker",
    description: "Track every data update. Latest changes, version history, methodology, and a freshness report across all 19 dimensions. See exactly what moved and when.",
    path: "/the-changelog/",
  },
  "/the-badges/": {
    title: "The Badges — Knowledge & Action Tracker",
    description: "Track your exploration of 200 countries, earn badges, climb levels, and test your knowledge with the country quiz. Every visit deepens the argument.",
    path: "/the-badges/",
  },
  "/the-simulator/": {
    title: "The Simulator — Scenario Impact Model",
    description: "Pick any country. Redirect military spending into health, food, education and climate. Watch child mortality, hunger, life expectancy and GDP update live. Model the fix.",
    path: "/the-simulator/",
  },
  "/the-alerts/": {
    title: "The Alerts — Live Crisis Feed & Bot Dispatch",
    description: "Live crisis counters, machine-readable RSS/Atom feeds, and Telegram/Signal bot dispatch for the top 20 crisis countries. Subscribe to famine, conflict, and displacement alerts.",
    path: "/the-alerts/",
  },
  "/the-satellite/": {
    title: "The Satellite — Open Imagery of Conflict & Destruction",
    description: "Free, open satellite imagery makes destruction undeniable. Inspect documented conflict and crisis zones from orbit across monitored countries — the evidence regimes cannot censor.",
    path: "/the-satellite/",
  },
};

/** Get metadata for a page path, falling back to site defaults */
export function getMeta(path: string): PageMeta {
  return PAGE_META[path] ?? {
    title: SITE.title,
    description: SITE.description,
    path,
  };
}
