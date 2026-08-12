/**
 * V FOR X — Ledger Bridge (budget text → Price-Tag narratives)
 *
 * A stub classifier that turns pasted public-budget text into human
 * "Price-Tag" narratives: how many people could be fed, given clean
 * water, or vaccinated for the same money a budget line spends on
 * something else. No network — the operator pastes the text (from a
 * PDF, a press release, a treasury table); the bridge extracts dollar
 * amounts and maps them onto the allocator's cost-per-unit catalogue.
 *
 * This is the "import public budget PDFs → Classifier → Price-Tag
 * narratives" item, deliberately a stub: paste text, no PDF fetch.
 *
 * Pipeline:
 *   1. extractBudgetLines(text)     → raw {amount, unit, label, line}
 *   2. classifyBudgetLines(lines)   → tagged lines with matched SDG item
 *   3. priceTagNarratives(lines)    → {"$X could..."} strings
 *   4. buildLedgerBrief(text)       → the whole pipeline in one call
 *
 * The dollar figures come from BUDGET_ITEMS in lib/allocator.ts, which
 * are themselves sourced (see that file). Everything stays on-device.
 */

import {
  BUDGET_ITEMS,
  MILITARY_PER_DAY_B,
  WORLD_MILITARY_TRILLION,
} from "./allocator";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export type BudgetUnit = "B" | "M" | "K" | "T";

export interface BudgetLine {
  /** Raw dollar amount in the parsed unit. */
  amount: number;
  /** Unit of the amount. */
  unit: BudgetUnit;
  /** Amount normalized to billions of USD ($B). */
  amountB: number;
  /** Source text span that matched. */
  line: string;
  /** Human label guessed from surrounding keywords. */
  label: string;
}

export type BudgetTag =
  | "military"
  | "security"
  | "weapons"
  | "defense"
  | "hunger"
  | "water"
  | "health"
  | "energy"
  | "education"
  | "inequality"
  | "subsidy"
  | "infrastructure"
  | "other";

export interface ClassifiedLine extends BudgetLine {
  tag: BudgetTag;
  /** Matched SDG allocator item id (if any). */
  sdgItem?: string;
}

export interface PriceTagNarrative {
  /** The originating line. */
  line: ClassifiedLine;
  /** Narrative strings ("For $X, ..."). */
  narratives: string[];
  /** Equivalent days of global military spending. */
  daysOfMilitary: number;
}

export interface LedgerBrief {
  lines: ClassifiedLine[];
  narratives: PriceTagNarrative[];
  totalSpendingB: number;
  militaryEquivalentB: number;
  topLine: ClassifiedLine | null;
  summary: string;
}

/* ═══════════════════════════════════════════════════════════════
   Amount extraction
   ═══════════════════════════════════════════════════════════════ */

/**
 * Match dollar amounts with optional unit suffixes. Accepts:
 *   $1.2 trillion / $1.2T / $1.2t
 *   $93 billion  / $93B / $93bn / $93 b
 *   $500 million / $500M / $500m
 *   $1.5 million ($1,500,000)
 * Also accepts bare "$93B", "93 billion", "$1,200".
 */
const AMOUNT_RE =
  /(\$?\s?\d[\d,]*(?:\.\d+)?)\s*(trillion|t\b|billion|bn\b|b\b|million|mn\b|m\b|thousand|k\b)?/gi;

const UNIT_MAP: Record<string, BudgetUnit> = {
  trillion: "T",
  t: "T",
  billion: "B",
  bn: "B",
  b: "B",
  million: "M",
  mn: "M",
  m: "M",
  thousand: "K",
  k: "K",
};

/** Convert an amount+unit into billions of USD. */
export function toBillions(amount: number, unit: BudgetUnit | undefined): number {
  switch (unit ?? "B") {
    case "T":
      return amount * 1000;
    case "B":
      return amount;
    case "M":
      return amount / 1000;
    case "K":
      return amount / 1_000_000;
    default:
      return amount;
  }
}

/** Parse a number string that may contain commas. */
function parseAmount(raw: string): number {
  return Number.parseFloat(raw.replace(/[$,\s]/g, ""));
}

/**
 * Extract every dollar line from pasted budget text. Ignores lines
 * with no recognizable currency amount.
 */
export function extractBudgetLines(text: string): BudgetLine[] {
  if (typeof text !== "string" || text.length === 0) return [];
  const lines = text.split(/\r?\n/);
  const out: BudgetLine[] = [];

  for (const src of lines) {
    const trimmed = src.trim();
    if (!trimmed) continue;
    // Must contain a currency indicator or a unit word to count.
    if (!/\$|\b(trillion|billion|million|thousand)\b/i.test(trimmed)) continue;

    const matches = [...trimmed.matchAll(AMOUNT_RE)];
    for (const m of matches) {
      const amount = parseAmount(m[1]);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const unitWord = (m[2] ?? "").toLowerCase().trim();
      const unit: BudgetUnit = unitWord ? UNIT_MAP[unitWord] ?? "B" : "B";
      const amountB = toBillions(amount, unit);
      if (amountB <= 0) continue;
      out.push({
        amount,
        unit,
        amountB,
        line: trimmed,
        label: guessLabel(trimmed),
      });
    }
  }
  return out;
}

/** Guess a short label from keywords near the amount. */
function guessLabel(line: string): string {
  const lower = line.toLowerCase();
  for (const [kw, label] of Object.entries(KEYWORD_LABELS)) {
    if (lower.includes(kw)) return label;
  }
  // Fallback: first few words
  const words = line.split(/\s+/).slice(0, 4).join(" ");
  return words.length > 60 ? words.slice(0, 57) + "…" : words;
}

const KEYWORD_LABELS: Record<string, string> = {
  "defense": "Defense",
  "defence": "Defense",
  "military": "Military",
  "army": "Military",
  "navy": "Military",
  "air force": "Military",
  "weapons": "Weapons procurement",
  "arms": "Arms",
  "ammunition": "Ammunition",
  "nuclear": "Nuclear program",
  "security": "Security",
  "police": "Police",
  "prison": "Prisons",
  "hunger": "Hunger relief",
  "food": "Food aid",
  "agriculture": "Agriculture",
  "water": "Water & sanitation",
  "sanitation": "Water & sanitation",
  "health": "Healthcare",
  "hospital": "Healthcare",
  "medical": "Healthcare",
  "vaccine": "Vaccination",
  "energy": "Clean energy",
  "electricity": "Electricity",
  "solar": "Solar power",
  "education": "Education",
  "school": "Schools",
  "teacher": "Education",
  "inequality": "Inequality reduction",
  "subsidy": "Subsidy",
  "fossil": "Fossil-fuel subsidy",
  "infrastructure": "Infrastructure",
  "road": "Infrastructure",
  "rail": "Infrastructure",
};

/* ═══════════════════════════════════════════════════════════════
   Classification → SDG mapping
   ═══════════════════════════════════════════════════════════════ */

const TAG_KEYWORDS: Record<BudgetTag, string[]> = {
  military: ["military", "defense", "defence", "army", "navy", "air force", "pentagon"],
  security: ["security", "police", "intelligence", "border"],
  weapons: ["weapons", "arms", "ammunition", "missile", "nuclear weapon", "procurement"],
  defense: ["defense", "defence"],
  hunger: ["hunger", "food", "famine", "nutrition"],
  water: ["water", "sanitation", "wastewater", "sewer"],
  health: ["health", "hospital", "medical", "vaccine", "clinic", "medicare"],
  energy: ["energy", "electricity", "solar", "grid", "power plant"],
  education: ["education", "school", "teacher", "literacy", "tuition"],
  inequality: ["inequality", "welfare", "social safety", "redistribution"],
  subsidy: ["subsidy", "subsidies", "bailout"],
  infrastructure: ["infrastructure", "road", "bridge", "rail", "port", "airport"],
  other: [],
};

/** Tag a line with a budget category and matched SDG allocator item. */
export function classifyBudgetLines(lines: BudgetLine[]): ClassifiedLine[] {
  return lines.map((line) => {
    const lower = line.label.toLowerCase() + " " + line.line.toLowerCase();
    let tag: BudgetTag = "other";
    for (const [t, kws] of Object.entries(TAG_KEYWORDS)) {
      if ((kws as string[]).some((k) => lower.includes(k))) {
        tag = t as BudgetTag;
        break;
      }
    }
    const sdgItem = matchSdgItem(tag);
    return { ...line, tag, sdgItem };
  });
}

/** Map a tag to the closest allocator SDG item id. */
function matchSdgItem(tag: BudgetTag): string | undefined {
  const map: Partial<Record<BudgetTag, string>> = {
    hunger: "sdg2_hunger",
    water: "sdg6_water",
    health: "sdg3_health",
    energy: "sdg7_energy",
    education: "sdg4_education",
    inequality: "sdg10_inequality",
  };
  return map[tag];
}

/* ═══════════════════════════════════════════════════════════════
   Price-Tag narratives
   ═══════════════════════════════════════════════════════════════ */

/**
 * For a single classified line, generate human narratives comparing
 * the spend to what the same money would buy in the allocator's
 * humanitarian catalogue.
 */
export function priceTagNarratives(line: ClassifiedLine): PriceTagNarrative {
  const narratives: string[] = [];
  const daysOfMilitary = line.amountB / MILITARY_PER_DAY_B;

  narratives.push(
    `${fmtMoney(line)} ≈ ${daysOfMilitary.toFixed(2)} days of global military spending.`,
  );

  // For non-military lines, compare to the full humanitarian catalogue.
  const items = line.sdgItem
    ? BUDGET_ITEMS.filter((i) => i.id === line.sdgItem)
    : BUDGET_ITEMS;

  for (const item of items) {
    if (item.fullCostB <= 0) continue;
    const fraction = line.amountB / item.fullCostB;
    if (fraction <= 0) continue;
    const reachM = fraction * item.reachFullM;
    const pct = Math.min(100, fraction * 100);
    if (fraction >= 1) {
      narratives.push(
        `Would fully fund ${item.label} for ${Math.round(reachM).toLocaleString()}M people (${pct.toFixed(0)}%).`,
      );
    } else if (fraction >= 0.01) {
      narratives.push(
        `Could fund ${pct.toFixed(0)}% of ${item.label} — reaching ${Math.round(reachM).toLocaleString()}M people.`,
      );
    } else {
      narratives.push(
        `≈ ${pct.toFixed(2)}% of full ${item.label} funding.`,
      );
    }
  }

  // Share of world military spending.
  const pctMil = (line.amountB / (WORLD_MILITARY_TRILLION * 1000)) * 100;
  if (pctMil > 0.001) {
    narratives.push(`${pctMil.toFixed(2)}% of total world military spending.`);
  }

  return { line, narratives, daysOfMilitary };
}

function fmtMoney(line: BudgetLine): string {
  const sym = "$";
  switch (line.unit) {
    case "T":
      return `${sym}${line.amount.toFixed(2)}T`;
    case "B":
      return `${sym}${line.amountB.toFixed(1)}B`;
    case "M":
      return `${sym}${(line.amountB * 1000).toFixed(0)}M`;
    case "K":
      return `${sym}${(line.amountB * 1_000_000).toFixed(0)}K`;
    default:
      return `${sym}${line.amountB.toFixed(2)}B`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   Full pipeline
   ═══════════════════════════════════════════════════════════════ */

/**
 * Run the whole ledger bridge: text → lines → classification → narratives.
 * This is the main entry point for the paste-text UI.
 */
export function buildLedgerBrief(text: string): LedgerBrief {
  const raw = extractBudgetLines(text);
  const lines = classifyBudgetLines(raw);
  const narratives = lines
    .filter((l) => l.amountB >= 0.001) // ignore dust
    .map(priceTagNarratives);
  const totalSpendingB = lines.reduce((s, l) => s + l.amountB, 0);
  const militaryEquivalentB = lines
    .filter((l) => ["military", "weapons", "defense", "security"].includes(l.tag))
    .reduce((s, l) => s + l.amountB, 0);
  const topLine = lines.length > 0
    ? [...lines].sort((a, b) => b.amountB - a.amountB)[0]!
    : null;

  const summary = buildSummary(lines, totalSpendingB, militaryEquivalentB, topLine);

  return {
    lines,
    narratives,
    totalSpendingB,
    militaryEquivalentB,
    topLine,
    summary,
  };
}

function buildSummary(
  lines: ClassifiedLine[],
  totalB: number,
  milB: number,
  top: ClassifiedLine | null,
): string {
  if (lines.length === 0) return "No budget amounts found in the pasted text.";
  const parts: string[] = [];
  parts.push(`Parsed ${lines.length} budget line${lines.length === 1 ? "" : "s"} totaling $${totalB.toFixed(1)}B.`);
  if (milB > 0) parts.push(`Military/security share: $${milB.toFixed(1)}B (${Math.round((milB / Math.max(totalB, 0.0001)) * 100)}%).`);
  if (top) parts.push(`Largest line: ${top.label} ($${top.amountB.toFixed(1)}B).`);
  return parts.join(" ");
}
