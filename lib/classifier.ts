/**
 * V FOR X — The Classifier
 *
 * Document triage with on-device ML. Classifies document type (contract,
 * speech, leak, financial, legal, NGO report, press release, correspondence),
 * extracts entities (people, organizations, money, dates, locations), and
 * flags risk — all offline.
 *
 * Two classification engines, both fully on-device:
 *   • HEURISTIC — keyword/regex scoring (instant, always available).
 *   • SEMANTIC  — embeds the document and compares cosine similarity against
 *     prototype embeddings per document type, using the same transformers.js
 *     runtime as The Oracle (all-MiniLM-L6-v2, WebGPU → WASM).
 *
 * Builds on lib/doc-analyzer.ts for red-flag detection, country mentions,
 * sentiment, and key phrases — layers classification + NER + risk assessment
 * on top. Privacy by design: no text ever leaves the browser.
 */

import type { EmbedFn } from "./semantic-oracle";
import { cosineSimilarity } from "./semantic-oracle";
import {
  analyzeDocument,
  RED_FLAG_TERMS,
  type AnalysisResult,
  type RedFlag,
  type RedFlagSeverity,
  type CountryMention,
} from "./doc-analyzer";

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

export type DocumentTypeId =
  | "contract"
  | "speech_transcript"
  | "leaked_memo"
  | "financial_filing"
  | "legal_regulatory"
  | "ngo_report"
  | "press_release"
  | "personal_correspondence";

export interface DocumentTypeDef {
  id: DocumentTypeId;
  label: string;
  description: string;
  /** Representative text used to compute a prototype embedding. */
  prototypeText: string;
  /** High-signal keyword/regex triggers for the heuristic engine. */
  keywords: string[];
  /** Inherent risk weight 0..1 — some doc types are riskier by nature. */
  inherentRisk: number;
}

export interface TypeScore {
  id: DocumentTypeId;
  label: string;
  /** Raw score 0..1 (cosine sim for semantic, normalized weight for heuristic). */
  score: number;
  /** Percentage for display (0-100). */
  pct: number;
}

export interface ClassificationResult {
  /** Ranked best-first. */
  scores: TypeScore[];
  /** The top guess. */
  top: TypeScore;
  /** Which engine produced these scores. */
  engine: "semantic" | "heuristic";
  /** Confidence margin: top.score − second.score (0 if only one type). */
  margin: number;
}

export type EntityType =
  | "person"
  | "organization"
  | "money"
  | "date"
  | "percentage"
  | "country";

export interface ExtractedEntity {
  text: string;
  type: EntityType;
  /** How many times this entity surface form appears. */
  count: number;
  /** Short context snippet around the first occurrence. */
  context: string;
  /** Parsed numeric value for money / percentage entities. */
  value?: number;
}

export interface ExtractedEntities {
  people: ExtractedEntity[];
  organizations: ExtractedEntity[];
  money: ExtractedEntity[];
  dates: ExtractedEntity[];
  percentages: ExtractedEntity[];
  countries: CountryMention[];
  total: number;
}

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export interface RiskFactor {
  label: string;
  detail: string;
  /** Points contributed to the risk score. */
  points: number;
  severity: RedFlagSeverity;
}

export interface RiskAssessment {
  score: number;        // 0..100
  level: RiskLevel;
  factors: RiskFactor[];
}

export interface ClassifierResult {
  classification: ClassificationResult;
  entities: ExtractedEntities;
  risk: RiskAssessment;
  analysis: AnalysisResult;
  wordCount: number;
}

/* ═══════════════════════════════════════════════════════════
   DOCUMENT TYPE DEFINITIONS
   ═══════════════════════════════════════════════════════════ */

export const DOCUMENT_TYPES: DocumentTypeDef[] = [
  {
    id: "contract",
    label: "Contract / Agreement",
    description: "Legal agreements, procurement contracts, MOUs, service terms",
    prototypeText:
      "This Agreement is entered into by and between the Parties. The Contractor shall provide the services described in Schedule A. Payment terms net thirty days. Force majeure. Governing law and jurisdiction. Confidentiality. Representations and warranties. Indemnification and limitation of liability. Termination for convenience. Entire agreement between the parties.",
    keywords: [
      "agreement", "contractor", "contract", "parties", "force majeure",
      "indemnif", "warranties", "termination", "liability", "clause",
      "schedule a", "hereinafter", "whereas", "terms and conditions",
      "obligations", "breach", "remedies", "jurisdiction", "arbitration",
      "confidentiality", "amendments", "effective date",
    ],
    inherentRisk: 0.35,
  },
  {
    id: "speech_transcript",
    label: "Speech / Transcript",
    description: "Speeches, public statements, press conference transcripts",
    prototypeText:
      "Thank you. My fellow citizens, I want to address the nation today. We must stand together in these difficult times. Let me be clear, we will not rest until justice is served. I call upon the international community to act. Together we can build a better future for our children. God bless you and God bless our country.",
    keywords: [
      "fellow citizens", "i want to address", "let me be clear",
      "i call upon", "my friends", "together we can", "god bless",
      "thank you", "we must stand", "as i said", "the american people",
      "our nation", "fellow", "comrades", "i pledge", "we will not rest",
    ],
    inherentRisk: 0.15,
  },
  {
    id: "leaked_memo",
    label: "Leaked Memo / Cable",
    description: "Internal memos, diplomatic cables, leaked communications",
    prototypeText:
      "CONFIDENTIAL INTERNAL USE ONLY. Per our discussion the following should be kept off the record. Recommend we proceed with caution. Please destroy after reading. Do not forward or distribute. Source protection required. Background: the operation was approved at the highest level. Talking points for internal use. Not for public release.",
    keywords: [
      "confidential", "internal use only", "off the record", "do not forward",
      "destroy after reading", "not for public", "restricted", "classified",
      "source protection", "eyes only", "for official use", "fouo",
      "privileged", "do not distribute", "talking points", "background only",
      "need to know", "sensitive",
    ],
    inherentRisk: 0.65,
  },
  {
    id: "financial_filing",
    label: "Financial Filing / Report",
    description: "Financial statements, audit reports, SEC filings, budgets",
    prototypeText:
      "Revenue for the fiscal year ended December 31 was four point two billion dollars, an increase of twelve percent year over year. Net income attributable to shareholders. Earnings per share diluted. Cash and cash equivalents. Total assets and total liabilities. Net cash provided by operating activities. Independent auditor report. Subsequent events. Notes to the consolidated financial statements.",
    keywords: [
      "revenue", "fiscal year", "net income", "earnings per share",
      "cash flow", "balance sheet", "total assets", "liabilities",
      "audit", "shareholders", "operating activities", "consolidated",
      "depreciation", "amortization", "ebitda", "dividends", "equity",
      "fiscal", "quarterly", "annual report", "income statement",
      "profit margin", "capital expenditures",
    ],
    inherentRisk: 0.3,
  },
  {
    id: "legal_regulatory",
    label: "Legal / Regulatory",
    description: "Court filings, indictments, regulations, sanctions notices",
    prototypeText:
      "The defendant is charged with violations of the statute. The court finds probable cause to proceed. Pursuant to the act the commission hereby orders the following. Effective immediately the listed entities are designated as sanctioned. In accordance with the regulation. Penalty shall be a fine not exceeding or imprisonment. Appeal must be filed within thirty days of the order.",
    keywords: [
      "defendant", "plaintiff", "pursuant to", "hereby orders", "statute",
      "regulation", "penalty", "fine", "imprisonment", "appeal",
      "the court", "indictment", "charged with", "violation of",
      "designated", "sanctioned", "prohibited", "in accordance with",
      "effective date", "hereby", "enacted", "compliance",
    ],
    inherentRisk: 0.55,
  },
  {
    id: "ngo_report",
    label: "NGO / Investigative Report",
    description: "Fact-finding reports, investigations, human rights documentation",
    prototypeText:
      "Our field investigation documented systematic patterns of abuse over a six month period. Researchers interviewed witnesses across three regions. According to satellite imagery analysis the site was heavily damaged. The findings indicate widespread violations. We call on authorities to investigate. Recommendations: the government should ensure accountability. Annex: methodology, limitations, and data sources.",
    keywords: [
      "investigation", "documented", "researchers", "interviewed",
      "witnesses", "findings", "satellite imagery", "recommendations",
      "methodology", "field report", "according to our", "we call on",
      "human rights", "violations", "the government should",
      "evidence suggests", "pattern of", "monitoring", "advocacy",
    ],
    inherentRisk: 0.45,
  },
  {
    id: "press_release",
    label: "Press Release / Announcement",
    description: "Official announcements, press releases, public statements",
    prototypeText:
      "For immediate release. Contact press office for inquiries. The ministry announced today a major new initiative. This landmark agreement will benefit millions. In a statement the spokesperson said the program represents a significant step forward. For more information visit our website. Media contact details below. End of release.",
    keywords: [
      "for immediate release", "press release", "announced today",
      "spokesperson", "for more information", "media contact",
      "in a statement", "landmark", "contact:", "###",
      "press office", "news release", "official statement",
    ],
    inherentRisk: 0.1,
  },
  {
    id: "personal_correspondence",
    label: "Personal Correspondence",
    description: "Letters, emails, diary entries, private communications",
    prototypeText:
      "Dear friend, I hope this letter finds you well. I wanted to write to you about something important. Things have been very difficult here lately. Please keep this between us, I trust you completely. Let me know when you are available to meet. I worry about what comes next. With warm regards and best wishes to your family.",
    keywords: [
      "dear", "i hope this", "best regards", "warm regards", "sincerely",
      "yours truly", "please keep this", "between us", "i trust you",
      "let me know", "i wanted to", "thinking of you", "with love",
      "cheers", "take care", "miss you", "how are you",
    ],
    inherentRisk: 0.25,
  },
];

const TYPE_BY_ID = new Map(DOCUMENT_TYPES.map((t) => [t.id, t]));

/* ═══════════════════════════════════════════════════════════
   PROTOTYPE EMBEDDING (for the semantic engine)
   ═══════════════════════════════════════════════════════════ */

/**
 * Prototype embedding bundle: one vector per document type, aligned with
 * the DOCUMENT_TYPES array order.
 */
export interface PrototypeVectors {
  modelId: string;
  dim: number;
  vectors: number[][];
}

/** The prototype texts, in DOCUMENT_TYPES order, ready for batch embedding. */
export function buildPrototypeTexts(): string[] {
  return DOCUMENT_TYPES.map((t) => t.prototypeText);
}

/**
 * Embed all document-type prototypes in a single batch.
 * Call once after the model is ready; cache the result.
 */
export async function embedPrototypes(
  embed: EmbedFn,
  modelId: string,
): Promise<PrototypeVectors> {
  const texts = buildPrototypeTexts();
  const vectors = await embed(texts);
  return {
    modelId,
    dim: vectors[0]?.length ?? 0,
    vectors,
  };
}

/* ═══════════════════════════════════════════════════════════
   CLASSIFICATION — SEMANTIC (model-powered)
   ═══════════════════════════════════════════════════════════ */

/** Truncate text to the model's practical context window (first ~512 tokens ≈ 2k chars). */
function truncateForEmbedding(text: string): string {
  return text.slice(0, 2000);
}

/**
 * Classify a document via cosine similarity between the document embedding
 * and per-type prototype embeddings. Requires a loaded model.
 */
export async function classifySemantic(
  text: string,
  embed: EmbedFn,
  protos: PrototypeVectors,
): Promise<ClassificationResult> {
  const docVec = (await embed([truncateForEmbedding(text)]))[0];
  const sims = protos.vectors.map((pv) => cosineSimilarity(docVec, pv));
  return buildClassification(sims, "semantic");
}

/* ═══════════════════════════════════════════════════════════
   CLASSIFICATION — HEURISTIC (keyword scoring, no model)
   ═══════════════════════════════════════════════════════════ */

/**
 * Classify a document using keyword-frequency scoring.
 * Instant, deterministic, always available — the fallback when no model
 * is present and the initial signal before the semantic engine warms up.
 */
export function classifyHeuristic(text: string): ClassificationResult {
  const lower = (text || "").toLowerCase();
  const wordCount = lower.trim() ? lower.trim().split(/\s+/).length : 1;
  const rawScores = DOCUMENT_TYPES.map((def) => {
    let hits = 0;
    for (const kw of def.keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(escaped, "gi");
      const m = lower.match(re);
      if (m) hits += m.length;
    }
    // Normalize by keyword-set size and document length to avoid length bias.
    const density = hits / (Math.sqrt(def.keywords.length) * Math.sqrt(Math.max(wordCount, 10)));
    return density;
  });
  return buildClassification(rawScores, "heuristic");
}

/**
 * Turn raw per-type scores into a ranked ClassificationResult with
 * normalized percentages. Works for both cosine similarities (0..1) and
 * heuristic density scores (unbounded positive).
 */
function buildClassification(rawScores: number[], engine: "semantic" | "heuristic"): ClassificationResult {
  const scores: TypeScore[] = DOCUMENT_TYPES.map((def, i) => {
    const raw = rawScores[i] ?? 0;
    // Clamp negatives (cosine sim can be negative).
    const clamped = Math.max(0, raw);
    return {
      id: def.id,
      label: def.label,
      score: clamped,
      pct: 0, // filled after normalization
    };
  });

  const total = scores.reduce((sum, s) => sum + s.score, 0);
  for (const s of scores) {
    s.pct = total > 0 ? Math.round((s.score / total) * 1000) / 10 : 0;
  }

  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  const second = scores[1];
  const margin = second ? top.score - second.score : top.score;

  return { scores, top, engine, margin };
}

/* ═══════════════════════════════════════════════════════════
   ENTITY EXTRACTION (regex-based NER)
   ═══════════════════════════════════════════════════════════ */

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractContext(text: string, index: number, len: number, radius = 40): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + len + radius);
  let snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) snippet = "…" + snippet;
  if (end < text.length) snippet = snippet + "…";
  return snippet;
}

/** Collect matches into deduplicated entities with frequency counts. */
function collectMatches(
  text: string,
  re: RegExp,
  type: EntityType,
  valueParser?: (m: RegExpExecArray) => number | undefined,
): ExtractedEntity[] {
  const byKey = new Map<string, ExtractedEntity & { firstIndex: number }>();
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    const surface = m[1] ? m[1].trim() : m[0].trim();
    if (!surface) {
      if (re.lastIndex === m.index) re.lastIndex++;
      continue;
    }
    const key = surface.toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      existing.count++;
    } else {
      byKey.set(key, {
        text: surface,
        type,
        count: 1,
        context: extractContext(text, m.index, surface.length),
        value: valueParser ? valueParser(m) : undefined,
        firstIndex: m.index,
      });
    }
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return [...byKey.values()]
    .sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex)
    .map(({ firstIndex, ...rest }) => rest);
}

const PERSON_TITLE_RE =
  /\b(?:Mr|Mrs|Ms|Dr|Prof|Sir|Dame|President|Minister|General|Colonel|Major|Captain|Ambassador|Secretary|Director|Judge|Senator|Representative|Officer|Commander|Sheikh|King|Queen|Prince|Princess|Prime Minister|Chancellor|Premier|Chairman|Chairwoman|Commissioner|Prosecutor|Minister|Reverend|Father|Cardinal)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/g;

const PERSON_VERB_RE =
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s+(?:said|stated|confirmed|denied|told|wrote|announced|declared|warned|added|noted|explained|reportedly|allegedly|claimed|asserted)/g;

const ORG_SUFFIX_RE =
  /\b([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*){0,4}\s+(?:Inc\.?|Ltd\.?|Corp\.?|Corporation|LLC|LLP|GmbH|AG|S\.?A\.?|Co\.?|Group|Holdings|Foundation|Trust|Society|Association|Institute|Agency|Ministry|Department|Bank|Committee|Council|Organization|Organisation|Commission|Authority|Bureau|Office|Party|Union|Federation|Consortium|Network|Coalition|Front|Movement|Army|Forces|Brigade|Battalion|Division))\b/g;

const MONEY_RE =
  /(?:([¥€£$₹])\s?([\d,]+(?:\.\d+)?)|((?:USD|EUR|GBP|JPY|CNY|RUB|CHF)\s?([\d,]+(?:\.\d+)?))|(([\d,]+(?:\.\d+)?)\s?(million|billion|trillion|thousand)\s?(?:dollars|euros|pounds|USD|EUR|GBP)?))\s*(million|billion|trillion|thousand|M|B|K|mn|bn)?/gi;

const DATE_RE =
  /\b(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,)?\s+\d{4}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g;

const PERCENT_RE = /\b(\d+(?:\.\d+)?)\s*%/g;

/** Common false-positive words for organization matching. */
const ORG_STOPWORDS = new Set([
  "the", "this", "that", "these", "those", "our", "their", "his", "her",
  "good", "new", "high", "last", "next", "first", "second", "third",
  "north", "south", "east", "west", "central", "upper", "lower",
]);

const MONEY_MULTIPLIERS: Record<string, number> = {
  thousand: 1e3, k: 1e3,
  million: 1e6, m: 1e6, mn: 1e6,
  billion: 1e9, b: 1e9, bn: 1e9,
  trillion: 1e12,
};

function parseMoneyValue(m: RegExpExecArray): number | undefined {
  // Group layout from MONEY_RE:
  // 1:symbol  2:number   |  3:ccy  4:number  |  5:full  6:number  7:word  |  8:optional suffix word
  let numStr: string | undefined;
  let suffix: string | undefined;
  if (m[2]) {
    numStr = m[2];
    suffix = m[8];
  } else if (m[4]) {
    numStr = m[4];
    suffix = m[8];
  } else if (m[6]) {
    numStr = m[6];
    suffix = m[7] || m[8];
  }
  if (!numStr) return undefined;
  const base = parseFloat(numStr.replace(/,/g, ""));
  if (isNaN(base)) return undefined;
  const mult = suffix ? (MONEY_MULTIPLIERS[suffix.toLowerCase()] ?? 1) : 1;
  return base * mult;
}

function buildMoneyEntitySurface(m: RegExpExecArray): string {
  return m[0].replace(/\s+/g, " ").trim();
}

/**
 * Extract named entities from text using regex patterns.
 * Pure function — no I/O, deterministic, fully unit-testable.
 */
export function extractEntities(text: string): ExtractedEntities {
  const clean = (text || "").replace(/\r\n/g, "\n");

  /* ── People ── */
  const titlePeople = collectMatches(clean, PERSON_TITLE_RE, "person");
  const verbPeople = collectMatches(clean, PERSON_VERB_RE, "person");
  // Merge verb-people into title-people (title matches are higher precision).
  const seenPeople = new Set(titlePeople.map((p) => p.text.toLowerCase()));
  for (const vp of verbPeople) {
    if (!seenPeople.has(vp.text.toLowerCase()) && vp.text.length > 4) {
      titlePeople.push(vp);
      seenPeople.add(vp.text.toLowerCase());
    }
  }

  /* ── Organizations ── */
  const orgsRaw = collectMatches(clean, ORG_SUFFIX_RE, "organization");
  // Filter out false positives.
  const organizations = orgsRaw.filter((e) => {
    const firstWord = e.text.split(/\s+/)[0];
    return !ORG_STOPWORDS.has(firstWord.toLowerCase());
  });

  /* ── Money ── */
  const moneyRe = new RegExp(MONEY_RE.source, "gi");
  const moneyByValue = new Map<string, ExtractedEntity & { firstIndex: number }>();
  let mm: RegExpExecArray | null;
  moneyRe.lastIndex = 0;
  while ((mm = moneyRe.exec(clean)) !== null) {
    const surface = buildMoneyEntitySurface(mm);
    const value = parseMoneyValue(mm);
    const key = String(value ?? surface.toLowerCase());
    const existing = moneyByValue.get(key);
    if (existing) {
      existing.count++;
    } else {
      moneyByValue.set(key, {
        text: surface,
        type: "money",
        count: 1,
        context: extractContext(clean, mm.index, surface.length),
        value,
        firstIndex: mm.index,
      });
    }
    if (moneyRe.lastIndex === mm.index) moneyRe.lastIndex++;
  }
  const money = [...moneyByValue.values()]
    .sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex)
    .map(({ firstIndex, ...rest }) => rest);

  /* ── Dates ── */
  const dates = collectMatches(clean, DATE_RE, "date");

  /* ── Percentages ── */
  const percentages = collectMatches(
    clean,
    new RegExp(PERCENT_RE.source, "gi"),
    "percentage",
    (m) => parseFloat(m[1]),
  ).filter((e) => !isNaN(e.value ?? NaN));

  /* ── Countries (delegated to the analyzer) ── */
  const { countryMentions: countries } = analyzeDocument(clean);

  const total =
    titlePeople.length +
    organizations.length +
    money.length +
    dates.length +
    percentages.length +
    countries.length;

  return {
    people: titlePeople,
    organizations,
    money,
    dates,
    percentages,
    countries,
    total,
  };
}

/* ═══════════════════════════════════════════════════════════
   RISK ASSESSMENT
   ═══════════════════════════════════════════════════════════ */

/**
 * Combine classification, entities, and red-flag analysis into a single
 * 0..100 risk score with explainable contributing factors.
 */
export function assessRisk(
  classification: ClassificationResult,
  entities: ExtractedEntities,
  redFlags: RedFlag[],
): RiskAssessment {
  const factors: RiskFactor[] = [];
  let score = 0;

  /* ── Red-flag terms (highest weight) ── */
  const critical = redFlags.filter((f) => f.severity === "critical");
  const warnings = redFlags.filter((f) => f.severity === "warning");
  if (critical.length > 0) {
    const pts = Math.min(45, critical.length * 12);
    score += pts;
    factors.push({
      label: "Critical red-flag terms",
      detail: `${critical.length} critical-severity hit${critical.length > 1 ? "s" : ""} ` +
        `(${[...new Set(critical.map((c) => c.category))].join(", ")})`,
      points: pts,
      severity: "critical",
    });
  }
  if (warnings.length > 0) {
    const pts = Math.min(25, warnings.length * 5);
    score += pts;
    factors.push({
      label: "Warning red-flag terms",
      detail: `${warnings.length} warning-severity hit${warnings.length > 1 ? "s" : ""}`,
      points: pts,
      severity: "warning",
    });
  }

  /* ── Document-type inherent risk ── */
  const topDef = TYPE_BY_ID.get(classification.top.id);
  if (topDef) {
    const confidenceWeight = Math.min(1, classification.top.score * 3);
    const pts = Math.round(topDef.inherentRisk * 15 * confidenceWeight);
    if (pts > 0) {
      score += pts;
      factors.push({
        label: `Document type: ${topDef.label}`,
        detail: `${Math.round(topDef.inherentRisk * 100)}% inherent risk profile`,
        points: pts,
        severity: pts >= 10 ? "warning" : "info",
      });
    }
  }

  /* ── Large money amounts ── */
  const largeAmounts = entities.money.filter((e) => (e.value ?? 0) >= 1_000_000);
  if (largeAmounts.length > 0) {
    const pts = Math.min(15, largeAmounts.length * 5);
    score += pts;
    factors.push({
      label: "Large financial amounts",
      detail: `${largeAmounts.length} amount${largeAmounts.length > 1 ? "s" : ""} ≥ $1M detected`,
      points: pts,
      severity: "warning",
    });
  }

  /* ── Sanctioned-country exposure ── */
  const SANCTIONED_ISOS = new Set([
    "RUS", "IRN", "PRK", "SYR", "CUB", "VEN", "MMR", "BLR",
  ]);
  const sanctionedHits = entities.countries.filter((c) => SANCTIONED_ISOS.has(c.iso3));
  if (sanctionedHits.length > 0) {
    const pts = Math.min(10, sanctionedHits.length * 5);
    score += pts;
    factors.push({
      label: "Sanctioned-jurisdiction exposure",
      detail: sanctionedHits.map((c) => c.name).join(", "),
      points: pts,
      severity: "critical",
    });
  }

  /* ── Entity density (many named orgs + people signals an investigative doc) ── */
  const namedCount = entities.organizations.length + entities.people.length;
  if (namedCount >= 8) {
    const pts = Math.min(5, namedCount - 7);
    score += pts;
    factors.push({
      label: "High entity density",
      detail: `${namedCount} named entities (orgs + people)`,
      points: pts,
      severity: "info",
    });
  }

  score = Math.min(100, Math.max(0, Math.round(score)));

  const level: RiskLevel =
    score >= 70 ? "critical" :
    score >= 45 ? "high" :
    score >= 20 ? "moderate" :
    "low";

  factors.sort((a, b) => b.points - a.points);

  return { score, level, factors };
}

/* ═══════════════════════════════════════════════════════════
   FULL PIPELINE
   ═══════════════════════════════════════════════════════════ */

/**
 * Run the full heuristic pipeline: base analysis (red flags, countries,
 * sentiment, key phrases) + entity extraction + heuristic classification
 * + risk assessment. No model required.
 */
export function classifyDocumentHeuristic(text: string): ClassifierResult {
  const analysis = analyzeDocument(text);
  const entities = extractEntities(text);
  const classification = classifyHeuristic(text);
  const risk = assessRisk(classification, entities, analysis.redFlags);
  return {
    classification,
    entities,
    risk,
    analysis,
    wordCount: analysis.wordCount,
  };
}

/**
 * Run the full pipeline with the semantic engine: same as heuristic but
 * replaces the classification with model-powered cosine-similarity scoring.
 */
export async function classifyDocumentSemantic(
  text: string,
  embed: EmbedFn,
  protos: PrototypeVectors,
): Promise<ClassifierResult> {
  const analysis = analyzeDocument(text);
  const entities = extractEntities(text);
  const classification = await classifySemantic(text, embed, protos);
  const risk = assessRisk(classification, entities, analysis.redFlags);
  return {
    classification,
    entities,
    risk,
    analysis,
    wordCount: analysis.wordCount,
  };
}

/* ═══════════════════════════════════════════════════════════
   REPORT FORMATTER
   ═══════════════════════════════════════════════════════════ */

export function formatClassifierReport(result: ClassifierResult): string {
  const lines: string[] = [];
  const bar = "═".repeat(60);

  lines.push(bar);
  lines.push("V FOR X — DOCUMENT CLASSIFIER REPORT");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Engine: ${result.classification.engine.toUpperCase()}`);
  lines.push(bar);
  lines.push("");

  /* Summary */
  lines.push("SUMMARY");
  lines.push(`  Word count ............ ${result.wordCount.toLocaleString()}`);
  lines.push(`  Document type ......... ${result.classification.top.label}`);
  lines.push(`  Risk score ............ ${result.risk.score}/100 [${result.risk.level.toUpperCase()}]`);
  lines.push(`  Entities found ........ ${result.entities.total}`);
  lines.push(`  Red flags ............. ${result.analysis.redFlags.length}`);
  lines.push(`  Sentiment ............. ${result.analysis.sentimentScore}/100`);
  lines.push("");

  /* Document type scores */
  lines.push("DOCUMENT TYPE (ranked)");
  for (const s of result.classification.scores) {
    const marker = s.id === result.classification.top.id ? "▶" : " ";
    lines.push(`  ${marker} ${s.label.padEnd(34)} ${s.pct.toFixed(1)}%`);
  }
  lines.push("");

  /* Risk factors */
  lines.push("RISK ASSESSMENT");
  if (result.risk.factors.length === 0) {
    lines.push("  No significant risk factors detected.");
  } else {
    for (const f of result.risk.factors) {
      lines.push(`  [${f.severity.toUpperCase().padEnd(8)}] +${String(f.points).padStart(2)} ${f.label}`);
      lines.push(`             ${f.detail}`);
    }
  }
  lines.push("");

  /* Entities */
  const e = result.entities;
  lines.push("ENTITIES");
  lines.push(`  People (${e.people.length})`);
  for (const p of e.people.slice(0, 15)) {
    lines.push(`    • ${p.text}${p.count > 1 ? ` (×${p.count})` : ""}`);
  }
  lines.push(`  Organizations (${e.organizations.length})`);
  for (const o of e.organizations.slice(0, 15)) {
    lines.push(`    • ${o.text}${o.count > 1 ? ` (×${o.count})` : ""}`);
  }
  lines.push(`  Money / Amounts (${e.money.length})`);
  for (const m of e.money.slice(0, 15)) {
    const val = m.value ? ` [≈$${m.value.toLocaleString()}]` : "";
    lines.push(`    • ${m.text}${val}${m.count > 1 ? ` (×${m.count})` : ""}`);
  }
  lines.push(`  Dates (${e.dates.length})`);
  for (const d of e.dates.slice(0, 10)) {
    lines.push(`    • ${d.text}`);
  }
  lines.push(`  Percentages (${e.percentages.length})`);
  for (const p of e.percentages.slice(0, 10)) {
    lines.push(`    • ${p.text}`);
  }
  lines.push(`  Countries (${e.countries.length})`);
  for (const c of e.countries.slice(0, 15)) {
    lines.push(`    • ${c.name} (${c.iso3}) ×${c.count}`);
  }
  lines.push("");

  /* Red flags */
  if (result.analysis.redFlags.length > 0) {
    lines.push("RED FLAGS");
    for (const f of result.analysis.redFlags.slice(0, 20)) {
      lines.push(`  [${f.severity.toUpperCase()}] "${f.term}" [${f.category}]`);
      lines.push(`    …${f.context}…`);
    }
    lines.push("");
  }

  lines.push(bar);
  lines.push("On-device ML triage — not legal advice. Verify all findings in context.");
  lines.push("Open data, CC0. — V FOR X");
  lines.push(bar);

  return lines.join("\n");
}

/** Re-export so the UI can show the dictionary without importing doc-analyzer directly. */
export { RED_FLAG_TERMS };
