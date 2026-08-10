/**
 * V FOR X — The Verdict (Structured Fact-Checking Engine)
 *
 * A rapid-response misinformation counter. Take a claim made by a regime,
 * official, or outlet, attach verified sources whose content is hashed
 * (SHA-256), and let the engine render a verdict with a confidence score.
 *
 * Flow: CLAIM → SOURCES (hashed) → VERDICT (+ confidence)
 *
 * Distinct from:
 *   - The Tribunal  (legal cases → ICC-style charges & frameworks)
 *   - The Registry  (entity accountability dossiers)
 * The Verdict is a *rapid* check of a single assertion: "Regime says X —
 * here's the verified truth, with 3 hashed sources."
 *
 * Each source's excerpt is hashed so the cited evidence can be re-verified
 * later: if the outlet silently edits the article, the hash no longer
 * matches the snapshot recorded here.
 *
 * All client-side. No data leaves the device unless exported.
 */

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

/** Where / how the claim was made. */
export type ClaimMedium =
  | "official_statement"
  | "broadcast"
  | "social_media"
  | "press_release"
  | "speech"
  | "document"
  | "other";

/**
 * The verdict the engine renders. Values are kept as plain strings so they
 * serialize cleanly to JSON.
 */
export type Verdict =
  | "true"
  | "false"
  | "misleading"
  | "mixed"
  | "unverified";

/** How a given source relates to the claim under inspection. */
export type SourceStance =
  | "supports_claim"
  | "refutes_claim"
  | "contextual";

/**
 * Editorial credibility of the publisher. This is a coarse heuristic, not a
 * judgement of any individual journalist — it weights the verdict math.
 */
export type CredibilityTier =
  | "high" // wire service, peer-reviewed, official primary record
  | "established" // major outlet of record, established NGO/IGO
  | "medium" // regional press, specialist outlet
  | "low" // partisan / single-author / unverified blog
  | "unverified"; // anonymous, no editorial process

export interface Claim {
  /** The exact assertion being checked, ideally a direct quote. */
  text: string;
  /** Who made it (person, agency, outlet, regime). */
  claimant: string;
  /** Their role / title (e.g., "Information Minister", "State TV"). */
  claimantRole?: string;
  /** ISO date the claim was made (YYYY-MM-DD). */
  madeOn?: string;
  medium: ClaimMedium;
  /** Channel / location / link where it appeared. */
  context?: string;
  /** ISO3 of the country the claim concerns, if applicable. */
  iso3?: string;
}

export interface VerifiedSource {
  id: string;
  title: string;
  publisher: string;
  /** Direct URL or durable reference (archive link preferred). */
  url?: string;
  /** ISO date the source was published (YYYY-MM-DD). */
  publishedDate?: string;
  /** ISO date the source was retrieved / snapshotted. */
  accessedDate: string;
  stance: SourceStance;
  credibility: CredibilityTier;
  /** SHA-256 hex (64 chars) of `excerpt` — tamper-evident snapshot. */
  contentHash: string;
  /** The excerpt / quote being cited. This is what is hashed. */
  excerpt: string;
}

export interface FactCheck {
  id: string;
  title: string;
  claim: Claim;
  sources: VerifiedSource[];
  createdAt: number;
  updatedAt: number;
  /** Optional analyst override of the computed verdict. */
  manualVerdict?: Verdict | null;
  /** Tags for grouping (e.g., "election", "casualties", "aid"). */
  tags: string[];
  status: "open" | "published" | "archived";
  /** True for bundled example sheets (not user-created). */
  seed?: boolean;
}

export interface VerdictReport {
  /** The verdict that should be shown (manual override wins). */
  verdict: Verdict;
  /** The engine's recommendation, ignoring any manual override. */
  recommendedVerdict: Verdict;
  /** 0-100. */
  confidence: number;
  level: "high" | "moderate" | "low" | "minimal";
  sourcesTotal: number;
  independentPublishers: number;
  /** Distinct publishers whose stance aligns with the verdict. */
  corroboratingSources: number;
  refutingSources: number;
  supportingSources: number;
  contextualSources: number;
  /** Highest credibility tier present among sources. */
  strongestTier: CredibilityTier | null;
  reasoning: string[];
  gaps: string[];
  recommendations: string[];
}

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */

/** Weight contributed by each credibility tier to the verdict math. */
export const CREDIBILITY_WEIGHTS: Record<CredibilityTier, number> = {
  high: 4,
  established: 3,
  medium: 2,
  low: 1,
  unverified: 0.5,
};

/** A source counts as "recent" if published within this many months. */
export const RECENCY_WINDOW_MONTHS = 18;

/* ═══════════════════════════════════════════════════════════
   HASHING — tamper-evident source snapshots
   ═══════════════════════════════════════════════════════════ */

/**
 * Compute a SHA-256 hex digest of a source's excerpt. This is the
 * "source hash" — re-run it later to detect silent edits to the cited text.
 */
export async function hashSourceContent(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Recompute the hash of a source's excerpt and compare to the stored value.
 * Returns true if the snapshot is intact.
 */
export async function verifySource(source: VerifiedSource): Promise<boolean> {
  const recomputed = await hashSourceContent(source.excerpt);
  return recomputed === source.contentHash;
}

/* ═══════════════════════════════════════════════════════════
   FACT-CHECK CREATION
   ═══════════════════════════════════════════════════════════ */

export function createFactCheck(
  claim: Omit<Claim, never>,
  title?: string,
): FactCheck {
  const now = Date.now();
  const autoTitle =
    title ||
    (claim.text.length > 70 ? claim.text.slice(0, 67) + "…" : claim.text);
  return {
    id: crypto.randomUUID(),
    title: autoTitle,
    claim,
    sources: [],
    createdAt: now,
    updatedAt: now,
    manualVerdict: null,
    tags: [],
    status: "open",
  };
}

/* ═══════════════════════════════════════════════════════════
   SOURCE MANAGEMENT
   ═══════════════════════════════════════════════════════════ */

/**
 * Add a source to a fact check. The excerpt is hashed (SHA-256) so the
 * cited evidence can be re-verified later.
 */
export async function addSource(
  factCheck: FactCheck,
  source: Omit<VerifiedSource, "id" | "contentHash"> & { contentHash?: string },
): Promise<FactCheck> {
  const contentHash =
    source.contentHash ?? (await hashSourceContent(source.excerpt));
  const newSource: VerifiedSource = {
    id: crypto.randomUUID(),
    title: source.title,
    publisher: source.publisher,
    url: source.url,
    publishedDate: source.publishedDate,
    accessedDate: source.accessedDate,
    stance: source.stance,
    credibility: source.credibility,
    contentHash,
    excerpt: source.excerpt,
  };
  return {
    ...factCheck,
    sources: [...factCheck.sources, newSource],
    updatedAt: Date.now(),
  };
}

/** Remove a source by id. */
export function removeSource(
  factCheck: FactCheck,
  sourceId: string,
): FactCheck {
  return {
    ...factCheck,
    sources: factCheck.sources.filter((s) => s.id !== sourceId),
    updatedAt: Date.now(),
  };
}

/** Set / clear the analyst's manual verdict override. */
export function setManualVerdict(
  factCheck: FactCheck,
  verdict: Verdict | null,
): FactCheck {
  return { ...factCheck, manualVerdict: verdict, updatedAt: Date.now() };
}

/* ═══════════════════════════════════════════════════════════
   VERDICT COMPUTATION
   ═══════════════════════════════════════════════════════════ */

function isRecent(dateStr: string | undefined, now = Date.now()): boolean {
  if (!dateStr) return false;
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return false;
  const months = (now - t) / (1000 * 60 * 60 * 24 * 30);
  return months <= RECENCY_WINDOW_MONTHS;
}

interface Tallies {
  supportW: number;
  refuteW: number;
  contextW: number;
  totalW: number;
  supporting: number;
  refuting: number;
  contextual: number;
}

function tallySources(sources: VerifiedSource[]): Tallies {
  let supportW = 0;
  let refuteW = 0;
  let contextW = 0;
  let supporting = 0;
  let refuting = 0;
  let contextual = 0;
  for (const s of sources) {
    const w = CREDIBILITY_WEIGHTS[s.credibility];
    if (s.stance === "supports_claim") {
      supportW += w;
      supporting++;
    } else if (s.stance === "refutes_claim") {
      refuteW += w;
      refuting++;
    } else {
      contextW += w;
      contextual++;
    }
  }
  return {
    supportW,
    refuteW,
    contextW,
    totalW: supportW + refuteW + contextW,
    supporting,
    refuting,
    contextual,
  };
}

/**
 * The engine's recommended verdict, derived only from the sources.
 *
 * Uses a signed "truth score" in [-1, 1]:
 *   (supporting weight − refuting weight) / total weight
 * combined with the share of sources that are merely contextual.
 */
export function recommendVerdict(sources: VerifiedSource[]): Verdict {
  const t = tallySources(sources);
  if (t.totalW === 0) return "unverified";

  const truthScore = (t.supportW - t.refuteW) / t.totalW;
  const contextRatio = t.contextW / t.totalW;

  if (truthScore >= 0.5) return "true";
  if (truthScore <= -0.5) return "false";
  if (contextRatio >= 0.4) return "misleading";
  return "mixed";
}

/* ═══════════════════════════════════════════════════════════
   CONFIDENCE SCORING
   ═══════════════════════════════════════════════════════════ */

const TIER_RANK: Record<CredibilityTier, number> = {
  high: 4,
  established: 3,
  medium: 2,
  low: 1,
  unverified: 0,
};

function distinctPublishers(
  sources: VerifiedSource[],
  stance?: SourceStance,
): number {
  const names = new Set<string>();
  for (const s of sources) {
    if (stance && s.stance !== stance) continue;
    const key = s.publisher.trim().toLowerCase();
    if (key) names.add(key);
  }
  return names.size;
}

/**
 * Compute the full verdict report: recommendation, confidence, gaps, and
 * actionable recommendations. This is the analytical core of The Verdict.
 */
export function computeVerdictReport(factCheck: FactCheck): VerdictReport {
  const gaps: string[] = [];
  const recommendations: string[] = [];
  const reasoning: string[] = [];

  const sources = factCheck.sources;
  const t = tallySources(sources);
  const recommended = recommendVerdict(sources);
  const verdict: Verdict = factCheck.manualVerdict ?? recommended;

  const totalCredWeight = sources.reduce(
    (sum, s) => sum + CREDIBILITY_WEIGHTS[s.credibility],
    0,
  );
  const independentPublishers = distinctPublishers(sources);
  const recentCount = sources.filter((s) => isRecent(s.publishedDate)).length;

  // Strongest tier present
  let strongestTier: CredibilityTier | null = null;
  let strongestRank = -1;
  for (const s of sources) {
    if (TIER_RANK[s.credibility] > strongestRank) {
      strongestRank = TIER_RANK[s.credibility];
      strongestTier = s.credibility;
    }
  }

  // Dominant stance (for corroboration count)
  let dominantStance: SourceStance;
  if (verdict === "true") dominantStance = "supports_claim";
  else if (verdict === "false") dominantStance = "refutes_claim";
  else if (t.supportW >= t.refuteW) dominantStance = "supports_claim";
  else dominantStance = "refutes_claim";
  const corroboratingSources = sources.length
    ? distinctPublishers(sources, dominantStance)
    : 0;

  // ── Confidence score (0-100) ──
  // 1. Source volume — up to 25 pts (5 per source, cap 5 sources)
  const volumeScore = Math.min(25, sources.length * 5);

  // 2. Aggregate credibility — up to 30 pts
  const credibilityScore = Math.min(30, totalCredWeight * 2.5);

  // 3. Independence — distinct publishers, up to 20 pts (~3 = full)
  const independenceScore = Math.min(20, independentPublishers * 6.5);

  // 4. Corroboration — independent outlets on the dominant side, up to 15 pts
  const agreementScore = Math.min(15, corroboratingSources * 5);

  // 5. Recency — sources published within the window, up to 10 pts
  const recencyScore = Math.min(10, recentCount * 3);

  let confidence = Math.round(
    volumeScore + credibilityScore + independenceScore + agreementScore + recencyScore,
  );
  if (sources.length === 0) confidence = 0;
  confidence = Math.max(0, Math.min(100, confidence));

  let level: VerdictReport["level"];
  if (confidence >= 80) level = "high";
  else if (confidence >= 55) level = "moderate";
  else if (confidence >= 30) level = "low";
  else level = "minimal";

  // ── Reasoning narrative ──
  if (sources.length === 0) {
    reasoning.push("No sources attached — no verdict can be rendered.");
  } else {
    reasoning.push(
      `${sources.length} source(s): ${t.supporting} support, ${t.refuting} refute, ${t.contextual} contextual.`,
    );
    if (t.totalW > 0) {
      const truthScore = (t.supportW - t.refuteW) / t.totalW;
      reasoning.push(
        `Weighted truth score: ${truthScore >= 0 ? "+" : ""}${truthScore.toFixed(2)} (−1 = false, +1 = true).`,
      );
    }
    reasoning.push(
      `${independentPublishers} independent publisher(s); strongest tier: ${strongestTier ?? "none"}.`,
    );
    if (factCheck.manualVerdict && factCheck.manualVerdict !== recommended) {
      reasoning.push(
        `Analyst overrode the recommendation (${VERDICT_LABELS[recommended]}) → ${VERDICT_LABELS[verdict]}.`,
      );
    }
  }

  // ── Gaps & recommendations ──
  if (sources.length === 0) {
    gaps.push("No sources have been attached.");
    recommendations.push("Attach at least 3 independent sources before publishing.");
  } else {
    if (sources.length < 3) {
      gaps.push(`Only ${sources.length} source(s) — below the 3-source minimum.`);
      recommendations.push("Add sources until at least 3 independent outlets are cited.");
    }
    if (independentPublishers < 2) {
      gaps.push("Sources are not independent — same publisher across the board.");
      recommendations.push("Cite at least 2 distinct publishers to establish independence.");
    }
    if (!sources.some((s) => s.credibility === "high" || s.credibility === "established")) {
      gaps.push("No high-credibility sources (wire service, peer-reviewed, or official record).");
      recommendations.push("Add a high- or established-credibility primary source.");
    }
    if (corroboratingSources < 2 && verdict !== "unverified") {
      gaps.push(`No independent corroboration of the ${VERDICT_LABELS[verdict].toLowerCase()} verdict.`);
      recommendations.push("Find a second independent outlet confirming the same stance.");
    }
    if (!sources.some((s) => s.url)) {
      gaps.push("No source carries a durable URL (archive link preferred).");
      recommendations.push("Add archive.org / archive.today links so sources remain reachable.");
    }
  }

  return {
    verdict,
    recommendedVerdict: recommended,
    confidence,
    level,
    sourcesTotal: sources.length,
    independentPublishers,
    corroboratingSources,
    refutingSources: t.refuting,
    supportingSources: t.supporting,
    contextualSources: t.contextual,
    strongestTier,
    reasoning,
    gaps,
    recommendations,
  };
}

/** Convenience: the verdict to display for a fact check. */
export function getVerdict(factCheck: FactCheck): Verdict {
  return factCheck.manualVerdict ?? recommendVerdict(factCheck.sources);
}

/* ═══════════════════════════════════════════════════════════
   EXPORT
   ═══════════════════════════════════════════════════════════ */

/** Export a fact check as a structured, shareable JSON package. */
export function exportFactCheck(factCheck: FactCheck): string {
  const report = computeVerdictReport(factCheck);
  const pkg = {
    schema: "vfx-verdict/1",
    id: factCheck.id,
    title: factCheck.title,
    status: factCheck.status,
    tags: factCheck.tags,
    createdAt: factCheck.createdAt,
    updatedAt: factCheck.updatedAt,
    claim: factCheck.claim,
    sources: factCheck.sources.map((s) => ({
      title: s.title,
      publisher: s.publisher,
      url: s.url,
      publishedDate: s.publishedDate,
      accessedDate: s.accessedDate,
      stance: s.stance,
      credibility: s.credibility,
      contentHash: s.contentHash,
      excerpt: s.excerpt,
    })),
    verdict: {
      final: report.verdict,
      recommended: report.recommendedVerdict,
      confidence: report.confidence,
      level: report.level,
      independentPublishers: report.independentPublishers,
      corroboratingSources: report.corroboratingSources,
      reasoning: report.reasoning,
    },
  };
  return JSON.stringify(pkg, null, 2);
}

/* ═══════════════════════════════════════════════════════════
   LABEL METADATA
   ═══════════════════════════════════════════════════════════ */

export const VERDICT_LABELS: Record<Verdict, string> = {
  true: "TRUE",
  false: "FALSE",
  misleading: "MISLEADING",
  mixed: "MIXED",
  unverified: "UNVERIFIED",
};

/** Short, plain-language summary of each verdict. */
export const VERDICT_DESCRIPTIONS: Record<Verdict, string> = {
  true: "The claim is accurate, corroborated by credible independent sources.",
  false: "The claim is contradicted by credible independent evidence.",
  misleading: "Not strictly false, but materially distorts or omits essential context.",
  mixed: "Evidence is split — parts of the claim hold, parts do not.",
  unverified: "Insufficient credible evidence to render a verdict either way.",
};

export const STANCE_LABELS: Record<SourceStance, string> = {
  supports_claim: "Supports claim",
  refutes_claim: "Refutes claim",
  contextual: "Contextual",
};

export const CREDIBILITY_LABELS: Record<CredibilityTier, string> = {
  high: "High — wire / peer-reviewed / official",
  established: "Established — outlet of record / IGO / NGO",
  medium: "Medium — regional / specialist",
  low: "Low — partisan / single-author",
  unverified: "Unverified — anonymous",
};

export const MEDIUM_LABELS: Record<ClaimMedium, string> = {
  official_statement: "Official statement",
  broadcast: "Broadcast / TV / radio",
  social_media: "Social media",
  press_release: "Press release",
  speech: "Speech / remarks",
  document: "Document",
  other: "Other",
};

export const VERDICT_OPTIONS: Verdict[] = ["true", "false", "misleading", "mixed", "unverified"];

/* ═══════════════════════════════════════════════════════════
   SEED — example rapid-response verdicts
   Defined as plain inputs; hashes are computed via addSource so they
   remain genuine SHA-256 snapshots of the excerpt text.
   ═══════════════════════════════════════════════════════════ */

interface SeedInput {
  title: string;
  tags: string[];
  claim: Claim;
  sources: Omit<VerifiedSource, "id" | "contentHash">[];
  manualVerdict?: Verdict;
}

const SEED_INPUTS: SeedInput[] = [
  {
    title: "“Zero civilian casualties” in the market district strike",
    tags: ["casualties", "airstrike"],
    claim: {
      text: "The strike on the market district caused zero civilian casualties — the target was a military depot.",
      claimant: "Ministry of Defence (State TV)",
      claimantRole: "Defence spokesperson",
      madeOn: "2025-03-14",
      medium: "broadcast",
      context: "Evening news bulletin, State TV Channel 1",
      iso3: "SDN",
    },
    sources: [
      {
        title: "Field hospital casualty log — Market District, 14 March",
        publisher: "International Medical Corps",
        url: "https://archive.example.org/imc-market-log",
        publishedDate: "2025-03-15",
        accessedDate: "2025-03-16",
        stance: "refutes_claim",
        credibility: "high",
        excerpt:
          "Field hospital logs record 47 admissions (12 fatal) within 90 minutes of the 14 March market-district detonation. Injuries are consistent with air-delivered munitions, not an internal depot blast.",
      },
      {
        title: "Satellite damage assessment: Market District, 15 March",
        publisher: "Center for Strategic & International Studies",
        url: "https://archive.example.org/csis-sat-market",
        publishedDate: "2025-03-17",
        accessedDate: "2025-03-18",
        stance: "refutes_claim",
        credibility: "established",
        excerpt:
          "Sub-metre satellite imagery shows impact craters across a civilian market block, with blast patterns radiating outward — inconsistent with a single munitions depot. No intact military structure is visible at the cited target coordinates.",
      },
      {
        title: "Open-source geolocation of strike footage",
        publisher: "Bellingcat",
        url: "https://archive.example.org/bellingcat-market",
        publishedDate: "2025-03-16",
        accessedDate: "2025-03-18",
        stance: "refutes_claim",
        credibility: "established",
        excerpt:
          "Frame-by-frame geolocation of 11 independently uploaded videos places the detonation at the central market square, 1.4 km from the depot cited by state media. Exit wounds and crater orientation indicate an inbound airstrike.",
      },
    ],
    manualVerdict: "false",
  },
  {
    title: "“Aid delivered to 100% of affected regions”",
    tags: ["aid", "humanitarian"],
    claim: {
      text: "Humanitarian aid has been delivered to 100% of the regions affected by the floods.",
      claimant: "Relief & Resettlement Authority",
      claimantRole: "Press office",
      madeOn: "2025-05-02",
      medium: "press_release",
      context: "Official press release, carried by national wire",
      iso3: "PAK",
    },
    sources: [
      {
        title: "Relief convoy dispatch manifest (official)",
        publisher: "Relief & Resettlement Authority",
        url: "https://archive.example.org/rra-manifest",
        publishedDate: "2025-05-02",
        accessedDate: "2025-05-03",
        stance: "supports_claim",
        credibility: "low",
        excerpt:
          "Convoys dispatched to 18 of 18 listed districts between 28 April and 1 May, carrying food, water purification tablets, and tarpaulins, per the Authority's own dispatch manifest.",
      },
      {
        title: "Situation report #6 — flood response",
        publisher: "OCHA (United Nations)",
        url: "https://archive.example.org/ocha-sitrep-6",
        publishedDate: "2025-05-06",
        accessedDate: "2025-05-07",
        stance: "contextual",
        credibility: "high",
        excerpt:
          "Aid reached the 18 district capitals listed by the Authority. However, OCHA assessments find 41% of affected sub-district villages remain unreached due to severed roads. '100% of affected regions' conflates district capitals with the actual flood-affected population.",
      },
      {
        title: "Logistics cluster access map — week 1 May",
        publisher: "WFP Logistics Cluster",
        url: "https://archive.example.org/wfp-access-map",
        publishedDate: "2025-05-05",
        accessedDate: "2025-05-07",
        stance: "contextual",
        credibility: "high",
        excerpt:
          "The inter-agency access map records 23 cut-off sub-districts with no confirmed delivery as of 5 May. The 'affected regions' in the official figure are defined at district level, masking substantial sub-district gaps.",
      },
    ],
    manualVerdict: "misleading",
  },
  {
    title: "“The protest was entirely peaceful”",
    tags: ["protest", "unrest"],
    claim: {
      text: "The protest in the capital was entirely peaceful; no property was damaged.",
      claimant: "Opposition coalition (social media post)",
      claimantRole: "Official account",
      madeOn: "2025-06-09",
      medium: "social_media",
      context: "Verified opposition handle, reposted 12k times",
      iso3: "KEN",
    },
    sources: [
      {
        title: "Verified footage: arson at transit station",
        publisher: "Reuters",
        url: "https://archive.example.org/reuters-transit",
        publishedDate: "2025-06-10",
        accessedDate: "2025-06-11",
        stance: "refutes_claim",
        credibility: "high",
        excerpt:
          "Reuters-verified footage shows a small group setting fire to a transit station ticketing hall during the 9 June march. Fire service confirmed one structure fire at that location.",
      },
      {
        title: "Organizer statement: march was largely peaceful",
        publisher: "Civil Rights Forum",
        url: "https://archive.example.org/crf-statement",
        publishedDate: "2025-06-10",
        accessedDate: "2025-06-11",
        stance: "supports_claim",
        credibility: "medium",
        excerpt:
          "The march organisers stated the route was peaceful for its entirety, attributing the transit-station incident to a small breakaway group unaffiliated with the coalition.",
      },
    ],
    manualVerdict: "mixed",
  },
];

/**
 * Build the seed fact checks with genuine SHA-256 content hashes.
 * Called once on first page load; results can be cached.
 */
export async function buildSeedFactChecks(): Promise<FactCheck[]> {
  const out: FactCheck[] = [];
  for (const input of SEED_INPUTS) {
    let fc = createFactCheck(input.claim, input.title);
    fc.tags = [...input.tags];
    fc.seed = true;
    fc.status = "published";
    for (const s of input.sources) {
      fc = await addSource(fc, s);
    }
    if (input.manualVerdict) fc = setManualVerdict(fc, input.manualVerdict);
    out.push(fc);
  }
  return out;
}
