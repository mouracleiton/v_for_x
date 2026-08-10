/**
 * V FOR X — Client-side Document Analyzer
 *
 * Scans pasted text or uploaded documents (txt/md; PDF via pdf.js from CDN)
 * for high-risk terms, extracts country mentions, estimates a rough
 * sentiment, and surfaces the most frequent meaningful phrases.
 *
 * 100% client-side. No text ever leaves the browser. Useful for triaging
 * leaked filings, contracts, press releases, and NGO reports against the
 * V FOR X country dossier set.
 */

import type { CountryData } from "./types";
import backbone from "@/data/world_backbone.json";

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

export type RedFlagSeverity = "info" | "warning" | "critical";

export interface RedFlag {
  term: string;
  context: string;
  category: string;
  severity: RedFlagSeverity;
}

export interface CountryMention {
  name: string;
  iso3: string;
  count: number;
}

export interface AnalysisResult {
  redFlags: RedFlag[];
  countryMentions: CountryMention[];
  sentimentScore: number;
  wordCount: number;
  keyPhrases: string[];
}

/* ═══════════════════════════════════════════════════════════
   RED-FLAG TERM DICTIONARY
   ═══════════════════════════════════════════════════════════ */

export const RED_FLAG_TERMS: Record<
  string,
  { terms: string[]; category: string; severity: RedFlagSeverity }
> = {
  shell_companies: {
    category: "Shell Companies & Tax Havens",
    severity: "warning",
    terms: [
      "offshore",
      "tax haven",
      "shell company",
      "shell companies",
      "bearer shares",
      "bearer share",
      "nominee director",
      "brass-plate",
      "letterbox company",
      "secrecy jurisdiction",
    ],
  },
  sanctioned_entities: {
    category: "Sanctioned Entities",
    severity: "critical",
    terms: [
      "sanctioned",
      "designated",
      "sdn",
      "ofac",
      "eu sanctions",
      "un sanctions",
      "entity list",
      "denied persons",
      "blocked person",
      "specially designated national",
    ],
  },
  corruption_patterns: {
    category: "Corruption Patterns",
    severity: "critical",
    terms: [
      "bribe",
      "bribery",
      "kickback",
      "kickbacks",
      "embezzlement",
      "embezzle",
      "money laundering",
      "laundering",
      "procurement fraud",
      "extortion",
      "misappropriation",
      "conflict of interest",
    ],
  },
  human_rights: {
    category: "Human Rights Violations",
    severity: "critical",
    terms: [
      "torture",
      "disappearance",
      "enforced disappearance",
      "extrajudicial",
      "extrajudicial killing",
      "forced labor",
      "forced labour",
      "arbitrary detention",
      "genocide",
      "crimes against humanity",
      "ethnic cleansing",
    ],
  },
  environmental: {
    category: "Environmental Crimes",
    severity: "warning",
    terms: [
      "deforestation",
      "illegal mining",
      "illegal logging",
      "toxic dump",
      "toxic dumping",
      "hazardous waste",
      "pollution violation",
      "oil spill",
      "wildlife trafficking",
      "poaching",
    ],
  },
};

/* ═══════════════════════════════════════════════════════════
   COUNTRY PATTERN REGEX (built once from the 200-country set)
   ═══════════════════════════════════════════════════════════ */

interface CountryRef {
  name: string;
  iso3: string;
}

const COUNTRY_REFS: CountryRef[] = (backbone as { countries: CountryData[] }).countries
  .map((c) => ({ name: c.name_en, iso3: c.iso3 }))
  // Longest names first so e.g. "South Sudan" matches before "Sudan".
  .sort((a, b) => b.name.length - a.name.length);

/**
 * A single case-insensitive, word-bounded regex that matches any tracked
 * country name. Capturing group 1 = the matched country name.
 */
export const COUNTRY_PATTERNS: RegExp = new RegExp(
  `\\b(${COUNTRY_REFS.map((c) => escapeRegex(c.name)).join("|")})\\b`,
  "gi",
);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ═══════════════════════════════════════════════════════════
   SENTIMENT LEXICON (small, transparent)
   ═══════════════════════════════════════════════════════════ */

const POSITIVE_WORDS = new Set([
  "stable", "growth", "improve", "improved", "improvement", "progress",
  "recovery", "recover", "peace", "agreement", "aid", "support", "relief",
  "investment", "reform", "transparent", "accountable", "success", "decline",
]);
const NEGATIVE_WORDS = new Set([
  "crisis", "collapse", "corruption", "fraud", "death", "deaths", "killed",
  "starvation", "famine", "conflict", "war", "attack", "violation", "abuse",
  "exploitation", "collapse", "surge", "displacement", "sanctioned", "bribe",
]);

/* ═══════════════════════════════════════════════════════════
   STOPWORDS (for key-phrase extraction)
   ═══════════════════════════════════════════════════════════ */

const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "any", "can",
  "her", "was", "one", "our", "out", "his", "has", "had", "how", "its",
  "who", "the", "this", "that", "with", "from", "they", "have", "were",
  "been", "their", "said", "each", "which", "will", "about", "into",
  "than", "them", "these", "also", "more", "such", "some", "what", "when",
  "where", "would", "there", "could", "other", "after", "before", "during",
  "between", "under", "over", "then", "upon", "shall", "may", "per", "via",
]);

/* ═══════════════════════════════════════════════════════════
   CORE: analyzeDocument
   ═══════════════════════════════════════════════════════════ */

/** Extract ~`radius` characters of context around a match index. */
function extractContext(text: string, index: number, termLen: number, radius = 45): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + termLen + radius);
  let snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) snippet = "…" + snippet;
  if (end < text.length) snippet = snippet + "…";
  return snippet;
}

/**
 * Scan `text` for red-flag terms, country mentions, sentiment, and key
 * phrases. Pure function — no I/O.
 */
export function analyzeDocument(text: string): AnalysisResult {
  const cleanText = (text || "").replace(/\r\n/g, "\n");
  const wordCount = cleanText.trim() ? cleanText.trim().split(/\s+/).length : 0;

  /* ── Red flags ── */
  const redFlags: RedFlag[] = [];
  for (const [, def] of Object.entries(RED_FLAG_TERMS)) {
    for (const term of def.terms) {
      const re = new RegExp(escapeRegex(term), "gi");
      let match: RegExpExecArray | null;
      let hits = 0;
      while ((match = re.exec(cleanText)) !== null && hits < 5) {
        redFlags.push({
          term,
          context: extractContext(cleanText, match.index, term.length),
          category: def.category,
          severity: def.severity,
        });
        hits++;
      }
    }
  }

  /* ── Country mentions ── */
  const counts = new Map<string, CountryMention>();
  const nameToRef = new Map<string, CountryRef>();
  for (const ref of COUNTRY_REFS) nameToRef.set(ref.name.toLowerCase(), ref);
  const countryRe = new RegExp(COUNTRY_PATTERNS.source, "gi");
  let cm: RegExpExecArray | null;
  while ((cm = countryRe.exec(cleanText)) !== null) {
    const ref = nameToRef.get(cm[1].toLowerCase());
    if (!ref) continue;
    const existing = counts.get(ref.iso3);
    if (existing) existing.count++;
    else counts.set(ref.iso3, { name: ref.name, iso3: ref.iso3, count: 1 });
  }
  const countryMentions = [...counts.values()].sort((a, b) => b.count - a.count);

  /* ── Sentiment heuristic ── */
  const tokens = cleanText.toLowerCase().match(/[a-z']+/g) || [];
  let pos = 0;
  let neg = 0;
  for (const tok of tokens) {
    if (POSITIVE_WORDS.has(tok)) pos++;
    else if (NEGATIVE_WORDS.has(tok)) neg++;
  }
  // Critical red flags pull sentiment down regardless of word balance.
  const criticalPenalty = redFlags.filter((f) => f.severity === "critical").length * 1.5;
  const net = neg + criticalPenalty - pos;
  const total = pos + neg + criticalPenalty || 1;
  // Scale to -100..100.
  const sentimentScore = Math.max(-100, Math.min(100, Math.round((net / total) * 100)));

  /* ── Key phrases (top 10 most frequent meaningful words) ── */
  const freq = new Map<string, number>();
  for (const tok of tokens) {
    if (tok.length < 4) continue;
    if (STOPWORDS.has(tok)) continue;
    if (/^\d+$/.test(tok)) continue;
    freq.set(tok, (freq.get(tok) || 0) + 1);
  }
  const keyPhrases = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  return { redFlags, countryMentions, sentimentScore, wordCount, keyPhrases };
}

/* ═══════════════════════════════════════════════════════════
   PDF EXTRACTION (pdf.js from CDN, lazy)
   ═══════════════════════════════════════════════════════════ */

const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";

interface PdfJsLib {
  getDocument: (params: { data: ArrayBuffer }) => { promise: Promise<PdfDoc> };
  GlobalWorkerOptions?: { workerSrc: string };
}
interface PdfDoc {
  numPages: number;
  getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str: string }[] }> }>;
}

/** Inject pdf.js from the CDN onto window, if not already present. */
async function ensurePdfJs(): Promise<PdfJsLib | null> {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { pdfjsLib?: PdfJsLib };
  if (w.pdfjsLib) return w.pdfjsLib;
  try {
    const mod = await import(/* @vite-ignore */ PDFJS_CDN);
    const lib = (mod?.default ?? mod) as PdfJsLib;
    if (lib && typeof lib.getDocument === "function") {
      w.pdfjsLib = lib;
      if (lib.GlobalWorkerOptions) {
        lib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";
      }
      return lib;
    }
  } catch {
    /* network blocked or module unavailable — fall through */
  }
  return null;
}

/**
 * Extract plain text from a PDF file using pdf.js loaded from CDN.
 * Returns a short explanatory note if pdf.js cannot be loaded, so callers
 * always get a usable string.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const lib = await ensurePdfJs();
  if (!lib) {
    return "[PDF text extraction unavailable — pdf.js could not be loaded from CDN. " +
      "Open the PDF, copy the text, and paste it into the analyzer.]";
  }
  try {
    const buf = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data: buf }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((it) => it.str).join(" "));
    }
    return pages.join("\n\n");
  } catch (err) {
    return `[PDF text extraction failed: ${(err as Error).message}]`;
  }
}

/* ═══════════════════════════════════════════════════════════
   REPORT FORMATTER
   ═══════════════════════════════════════════════════════════ */

/** Generate a plain-text analysis report suitable for download / clipboard. */
export function formatAnalysisReport(result: AnalysisResult): string {
  const lines: string[] = [];
  const bar = "═".repeat(60);

  lines.push(bar);
  lines.push("V FOR X — DOCUMENT ANALYSIS REPORT");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(bar);
  lines.push("");
  lines.push("SUMMARY");
  lines.push(`  Word count ............ ${result.wordCount.toLocaleString()}`);
  lines.push(`  Sentiment score ....... ${result.sentimentScore} / 100`);
  lines.push(`  Red flags found ....... ${result.redFlags.length}`);
  lines.push(`  Countries mentioned ... ${result.countryMentions.length}`);
  lines.push("");

  lines.push("RED FLAGS (by severity)");
  const order: RedFlagSeverity[] = ["critical", "warning", "info"];
  for (const sev of order) {
    const flags = result.redFlags.filter((f) => f.severity === sev);
    if (!flags.length) continue;
    lines.push(`  [${sev.toUpperCase()}] (${flags.length})`);
    for (const f of flags) {
      lines.push(`    • "${f.term}" [${f.category}]`);
      lines.push(`        …${f.context}…`);
    }
  }
  lines.push("");

  lines.push("COUNTRY MENTIONS");
  if (result.countryMentions.length === 0) {
    lines.push("  (none detected)");
  } else {
    for (const cm of result.countryMentions) {
      lines.push(`  ${cm.name.padEnd(34)} ${cm.iso3}  ×${cm.count}`);
    }
  }
  lines.push("");

  lines.push("KEY PHRASES");
  lines.push(`  ${result.keyPhrases.join(" · ") || "(none)"}`);
  lines.push("");
  lines.push(bar);
  lines.push("Heuristic analysis — not legal advice. Verify all flags in context.");
  lines.push("Open data, CC0. — V FOR X");
  lines.push(bar);

  return lines.join("\n");
}
