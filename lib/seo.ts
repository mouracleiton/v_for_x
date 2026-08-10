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
  "/the-stepping-stone/": {
    title: "The Stepping Stone — Circumvention Live-Tester",
    description: "Don't trust the docs — test the wire. Client-side tester that probes which transports work from YOUR connection (domain fronting, Snowflake bridges, MASQUE), measures latency and throughput, and recommends the best path right now.",
    path: "/the-stepping-stone/",
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
  "/the-onion/": {
    title: "The Onion — Tor Hidden Service Mirror Guide",
    description: "Step-by-step guide to mirror V FOR X as a Tor .onion hidden service. Censorship-resistant hosting on a Linux server with hardened Nginx, zero JS logging, and full security checklist.",
    path: "/the-onion/",
  },
  "/the-academy/": {
    title: "The Academy — Interactive Crisis Education",
    description: "4 free interactive courses on global hunger, the economics of war, corruption, and the climate-displacement crisis. Data-driven modules, quizzes, certificates. Learn the numbers that change minds.",
    path: "/the-academy/",
  },
  "/print/": {
    title: "Printable Country Briefs — V FOR X",
    description:
      "Data-dense, print-ready intelligence briefs for any of 200 countries. Key metrics, crisis indicators, vulnerability breakdown, and dossier references. Export to PDF or HTML.",
    path: "/print/",
  },
  "/the-chart-builder/": {
    title: "The Chart Builder — Custom Data Visualizer",
    description:
      "Build custom charts from 200 countries × 40 metrics. Multi-metric bar, line, and scatter plots. Filter by region, sort, export as PNG/CSV, and share via encoded URL.",
    path: "/the-chart-builder/",
  },
  "/the-digest/": {
    title: "The Digest — Personalized Crisis Email Feed",
    description:
      "Build a personalized crisis digest: pick countries and topics, choose a cadence, and deliver it to your inbox via RSS-to-email (follow.it / Blogtrottr). Styled HTML email, RSS feed, and QR share — all generated live.",
    path: "/the-digest/",
  },
  "/the-forecast/": {
    title: "The Forecast — Transparent Crisis Risk Model",
    description:
      "A transparent, weighted 10-factor risk model ranks the most stressed countries on a 0-100 scale. Fully disclosed weights, factor breakdowns, and a momentum forecast. Heuristic scoring — not predictive AI.",
    path: "/the-forecast/",
  },
  "/the-analyzer/": {
    title: "The Analyzer — Client-side Document Triage",
    description:
      "Drop or paste a document and get an instant client-side triage: red-flag terms (shell companies, sanctions, corruption, human rights, environmental), country mentions linked to dossiers, sentiment, and key phrases. No text leaves your browser.",
    path: "/the-analyzer/",
  },

  "/the-vault/": {
    title: "The Vault — Curated Public Datasets for Accountability",
    description:
      "A vetted registry of 36 open datasets for exposing corruption, mapping conflict, and documenting human-rights abuse. Conflict, sanctions, censorship, hunger, climate, inequality — all country-keyed and free.",
    path: "/the-vault/",
  },
  "/the-safehouse/": {
    title: "The Safehouse — Encrypted Evidence Store",
    description:
      "AES-GCM encrypted client-side evidence and notes store for citizen journalists. Zero data leaves your device. PBKDF2 passphrase-derived keys, duress-wipe integration, encrypted export. Store observations, source notes, and evidence securely offline.",
    path: "/the-safehouse/",
  },

  "/the-chain/": {
    title: "The Chain — Arms, Sanctions & Aid Relationship Graph",
    description:
      "Interactive geopolitical relationship graph: who sells weapons to whom (SIPRI arms transfers), who sanctions whom (UN/EU/US regimes), and who donates aid to whom (OECD DAC). 50 countries, 79 tracked flows. Country-centric and global ranking views.",
    path: "/the-chain/",
  },

  "/the-countdown/": {
    title: "The Countdown — SDG 2030 Deadline Tracker",
    description:
      "Six UN Sustainable Development Goals. Six parallel equations — water (SDG 6), health (SDG 3), energy (SDG 7), education (SDG 4), climate (SDG 13), inequality (SDG 10). Each with a gap in human lives, a cost in billions, and a ticking clock. All off track.",
    path: "/the-countdown/",
  },

  "/the-oracle/": {
    title: "The Oracle — Natural-Language Data Query Engine",
    description:
      "Ask any question about 200 countries × 24 dimensions in plain English. 'Which countries spend more on military than healthcare?' 'Top 10 by hunger in Africa.' Instant ranked answers. No API calls, no AI service — pure client-side pattern matching.",
    path: "/the-oracle/",
  },

  "/the-crucible/": {
    title: "The Crucible — Cascading Crisis Simulator",
    description:
      "Apply crisis shocks to any country — GDP collapse, conflict onset, climate disaster, food system failure, health emergency — and watch domino effects cascade across every dimension. Compound effects, heuristic multipliers from real crisis data (Syria, Yemen, Lebanon).",
    path: "/the-crucible/",
  },

  "/the-cartographer/": {
    title: "The Cartographer — Custom Choropleth Map Builder",
    description:
      "Build custom world map visualizations from 26 metrics across 200 countries. Choose from 6 color scales (Blood Red, Inferno, Matrix, Amber, Ice, Mono), set custom breakpoints, and generate bespoke choropleth maps. Different from Chart Builder and Sorrow Map.",
    path: "/the-cartographer/",
  },

  "/the-canary/": {
    title: "The Canary — Dead Man's Switch",
    description:
      "Encrypt a payload with AES-GCM. Arm a timer. If you stop checking in, it releases. A whistleblower's insurance policy. PBKDF2 key derivation, release tokens, zero data leaves your device.",
    path: "/the-canary/",
  },

  "/the-guardian/": {
    title: "The Guardian — People's Dead Man's Switch",
    description:
      "Scheduled check-ins, trusted-contact escalation, encrypted last-known-location, and panic-triggered broadcast. A life-safety net for activists and journalists. AES-GCM encryption, PBKDF2 key derivation, duress codes, zero data leaves your device.",
    path: "/the-guardian/",
  },

  "/the-cipher/": {
    title: "The Cipher — Steganography & One-Time Pad",
    description:
      "Hide messages in images (LSB steganography, 2 bits per RGB channel), encrypt with information-theoretically secure one-time pads, and encode burst messages with a 20-entry field codebook. All client-side, all anonymous.",
    path: "/the-cipher/",
  },

  "/the-relay/": {
    title: "The Relay — Offline Burst Message Format",
    description:
      "Compact message envelope for QR codes, LoRa packets, and dead drops when the internet is cut. Encode, segment into QR-sized chunks, and relay messages offline. Message templates for alerts, coordinates, and supply requests.",
    path: "/the-relay/",
  },

  "/the-quorum/": {
    title: "The Quorum — Anonymous ZK Voting",
    description:
      "Anonymous collective decision-making with zero-knowledge proofs. Vote without revealing who you are or how you voted. ZK set-membership proofs prevent double-voting without exposing identity. Prove eligibility without revealing which country you're from.",
    path: "/the-quorum/",
  },

  "/the-tribunal/": {
    title: "The Tribunal — Citizen Case Builder",
    description:
      "Build evidence-backed accountability cases against officials and regimes. Hash-chained evidence ledger, 11 legal framework templates (Rome Statute, UDHR, UNCAC, Geneva Conventions), case strength scoring. A citizen-run ICC case preparation tool.",
    path: "/the-tribunal/",
  },

  "/the-promises/": {
    title: "The Promises — Politician Truth Score",
    description:
      "Track politician pledges versus deliveries. Record promises, update their status, and compute a transparent weighted truth-score. Who kept their word and who lied? Importance-weighted scoring, overdue tracking, politician rankings.",
    path: "/the-promises/",
  },

  "/the-lives/": {
    title: "The Lives — Memorial Counter",
    description:
      "The statistics represent real human lives. A running memorial counter for every person lost to preventable causes — hunger (9M/yr), conflict, disease, lack of clean water. Real-time toll since your visit. Add names to the memorial wall.",
    path: "/the-lives/",
  },

  "/the-testimony/": {
    title: "The Testimony — Signed Witness Statements",
    description:
      "Collect timestamped, ECDSA-signed witness statements. Hash-chained into a tamper-evident append-only log. Anonymous signing with P-256 keypairs. For Tribunal cases, ICC submissions, media reports.",
    path: "/the-testimony/",
  },

  "/the-watch/": {
    title: "The Watch — Threshold Alert Rules",
    description:
      "Define threshold alert rules across 15 crisis metrics for 200 countries. 'Alert me when any country's hunger rate exceeds 30%.' Evaluated client-side on every visit. Integrates with the risk model. 5 preset rules included.",
    path: "/the-watch/",
  },

  "/the-exchange/": {
    title: "The Exchange — Decentralized Mutual-Aid Matching",
    description:
      "Post what you have and what you need. The matching engine connects complementary offers and requests across 13 resource categories. No registration, no tracking, no central authority. Scored matching with geographic proximity.",
    path: "/the-exchange/",
  },

  "/the-field-manual/": {
    title: "The Field Manual — Scenario Survival Guides",
    description:
      "10 printable, scenario-specific survival guides: grid failure, arrest, natural disaster, active conflict, medical emergency, digital breach, civil unrest, border crossing, communication blackout, and emergency evacuation. Each with phased actions, checklists, and warnings.",
    path: "/the-field-manual/",
  },

  "/the-resistance/": {
    title: "The Resistance — Civil Movement Analytics",
    description:
      "Resistance ripeness scoring from structural conditions for 200 countries. Historical nonviolent movements from the NAVCO dataset (Chenoweth). 18 resistance tactics from Gene Sharp's methods, ranked by effectiveness. Nonviolence wins 53% vs 26%.",
    path: "/the-resistance/",
  },

  "/the-war-room/": {
    title: "The War Room — Live Conflict Intelligence (ISW)",
    description:
      "Live open-source war assessments from the Institute for the Study of War. 6 active conflict theaters — Russia-Ukraine, Middle East/Iran, China-Taiwan, the adversary entente, cognitive warfare, and the future of war. Daily updates, key developments, featured reports.",
    path: "/the-war-room/",
  },

  "/the-sentinel/": {
    title: "The Sentinel — Real-time Repression Map",
    description:
      "Map state and repressive forces during protests in real time. Drop anonymous incident markers (kettles, tear gas, mass arrests, snipers, military deployment, comms blackouts). Live heat zones, threat clustering, escape-vector routing. Local-first, anonymous, time-decaying — nothing leaves your device.",
    path: "/the-sentinel/",
  },
  "/the-embed/": {
    title: "The Embed — Widget Builder",
    description:
      "Turn the strongest V FOR X visuals into drop-in iframe widgets: the Sorrow Map, Lives counter, SDG countdown, and country mini-briefs. Configure, preview, and copy embed code for any blog or news site. Virality through syndication.",
    path: "/the-embed/",
  },

  "/the-roster/": {
    title: "The Roster — Vetted Helper Directory",
    description:
      "A crisis-response yellow pages of vetted helpers — lawyers, doctors, journalists, digital-security trainers. Each entry is self-attested and peer-vouched with cryptographically signed credentials (ECDSA-P256). Signed JSON, client-side verification, no backend. Any copy of the site verifies the whole roster offline.",
    path: "/the-roster/",
  },

  "/the-mirror/": {
    title: "The Mirror — One-Command Deployment Kit",
    description:
      "One command pulls the latest static build, pins it to IPFS, and stands up a censorship-resistant V FOR X mirror in under five minutes. Docker, cloud-init, Raspberry Pi, and Tor paths. Mint a signed 'I mirrored this' badge that feeds a distributed, serverless node list.",
    path: "/the-mirror/",
  },

  "/the-chronicle/": {
    title: "The Chronicle — Distributed Event Mapping",
    description:
      "A crowdsourced, verified incident map — a distributed Ushahidi. Submit geolocated events; each is cryptographically signed and hash-chained into a tamper-evident append-only log. Community members corroborate reports, raising verification status. No authority can silently rewrite the record. Plotted across a map and timeline.",
    path: "/the-chronicle/",
  },

  "/the-pulse/": {
    title: "The Pulse — Multi-source Crisis Reader",
    description:
      "Client-side RSS / nitter / Atom aggregator. Consumes public humanitarian feeds (ReliefWeb, FEWS NET, WFP, UNHCR, ICRC, MSF, Crisis Group, Amnesty, HRW), filters them through regional crisis keyword lexicons, and ranks every story by the platform's own vulnerability scores. IndexedDB cache, fully offline-readable.",
    path: "/the-pulse/",
  },

  "/the-forensics/": {
    title: "The Forensics — OSINT Image & Video Verification",
    description:
      "Verify before you publish. Drop an image for error-level analysis (tamper detection), EXIF timeline forensics, reverse-search launchers (TinEye/Yandex/Google), frame-by-frame video comparison, and shadow-angle geolocation. Pure client-side canvas work — nothing leaves your browser.",
    path: "/the-forensics/",
  },

  "/the-verdict/": {
    title: "The Verdict — Structured Fact-Checking Engine",
    description:
      "Rapid-response misinformation counter. Take any regime or official claim, attach 3 SHA-256-verified sources, and render a structured verdict (true / false / misleading / mixed) with a confidence score. Distinct from The Tribunal (legal cases) and The Registry (dossiers).",
    path: "/the-verdict/",
  },

  "/the-classifier/": {
    title: "The Classifier — On-device Document Triage with Local ML",
    description:
      "Classify document type (contract, speech, leak, financial, legal, NGO report), extract entities (people, companies, amounts, locations), and flag risk — all offline with a small in-browser transformer model (WebGPU/WASM). No text leaves your device.",
    path: "/the-classifier/",
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
