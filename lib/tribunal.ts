/**
 * V FOR X — The Tribunal (Citizen Case Builder)
 *
 * A structured framework for citizens to assemble evidence-backed
 * accountability cases against officials, corporations, and regimes.
 * Think of it as a citizen-run ICC case preparation tool.
 *
 * Each case consists of:
 *   - Charges (legal framework violations)
 *   - Evidence items (documents, testimony, data points)
 *   - A hash-chained evidence ledger (tamper-evident via lib/dag.ts)
 *   - A computed case strength score
 *
 * Cases can be exported as structured JSON packages suitable for
 * submission to the ICC, human rights organizations, or media.
 *
 * All client-side. No data leaves the device unless exported.
 */

import { computeEntryHash, GENESIS_HASH, type DagEntry } from "./dag";

export type ChargeCategory =
  | "war_crime"
  | "crime_against_humanity"
  | "genocide"
  | "corruption"
  | "environmental"
  | "human_rights"
  | "economic";

export type EvidenceType =
  | "document"
  | "testimony"
  | "data_point"
  | "media"
  | "official_record"
  | "satellite_imagery"
  | "financial_record";

export type EvidenceStrength = "corroborated" | "single_source" | "circumstantial" | "weak";

export interface Charge {
  id: string;
  category: ChargeCategory;
  title: string;
  /** The legal framework being invoked (e.g., "Rome Statute Art. 7") */
  legalFramework: string;
  description: string;
  /** ISO3 of the country where the violation occurred */
  iso3?: string;
  evidenceIds: string[];
}

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  title: string;
  description: string;
  source: string;
  date: string;
  strength: EvidenceStrength;
  /** Hash of the underlying content (for verification) */
  contentHash?: string;
  /** URL or reference to the source */
  reference?: string;
}

export interface TribunalCase {
  id: string;
  title: string;
  subject: string;
  /** The entity being accused (official, corporation, regime) */
  accusedEntity: string;
  accusedRole: string;
  summary: string;
  charges: Charge[];
  evidence: EvidenceItem[];
  createdAt: number;
  updatedAt: number;
  /** Hash-chained evidence ledger entries */
  ledger: EvidenceLedgerEntry[];
  status: "draft" | "active" | "submitted" | "archived";
}

export interface EvidenceLedgerEntry {
  ts: number;
  evidenceId: string;
  action: "added" | "verified" | "challenged" | "removed";
  note: string;
  hash: string;
  prevHash: string;
}

export interface CaseStrength {
  /** 0-100 overall score */
  score: number;
  level: "weak" | "moderate" | "strong" | "compelling";
  totalEvidence: number;
  corroboratedEvidence: number;
  chargesWithEvidence: number;
  chargesTotal: number;
  gaps: string[];
  recommendations: string[];
}

/* ═══════════════════════════════════════════════════════════
   CASE CREATION
   ═══════════════════════════════════════════════════════════ */

export function createCase(
  title: string,
  accusedEntity: string,
  accusedRole: string,
  summary: string,
): TribunalCase {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title,
    subject: accusedEntity,
    accusedEntity,
    accusedRole,
    summary,
    charges: [],
    evidence: [],
    createdAt: now,
    updatedAt: now,
    ledger: [],
    status: "draft",
  };
}

/* ═══════════════════════════════════════════════════════════
   CHARGE MANAGEMENT
   ═══════════════════════════════════════════════════════════ */

export function addCharge(
  tribunalCase: TribunalCase,
  charge: Omit<Charge, "id" | "evidenceIds">,
): TribunalCase {
  const newCharge: Charge = {
    ...charge,
    id: crypto.randomUUID(),
    evidenceIds: [],
  };
  return {
    ...tribunalCase,
    charges: [...tribunalCase.charges, newCharge],
    updatedAt: Date.now(),
  };
}

export function linkEvidenceToCharge(
  tribunalCase: TribunalCase,
  chargeId: string,
  evidenceId: string,
): TribunalCase {
  return {
    ...tribunalCase,
    charges: tribunalCase.charges.map((c) =>
      c.id === chargeId && !c.evidenceIds.includes(evidenceId)
        ? { ...c, evidenceIds: [...c.evidenceIds, evidenceId] }
        : c,
    ),
    updatedAt: Date.now(),
  };
}

/* ═══════════════════════════════════════════════════════════
   EVIDENCE MANAGEMENT
   ═══════════════════════════════════════════════════════════ */

export async function addEvidence(
  tribunalCase: TribunalCase,
  item: Omit<EvidenceItem, "id">,
): Promise<TribunalCase> {
  const evidenceId = crypto.randomUUID();
  const newItem: EvidenceItem = { ...item, id: evidenceId };

  const prevHash = tribunalCase.ledger.length > 0
    ? tribunalCase.ledger[tribunalCase.ledger.length - 1].hash
    : GENESIS_HASH;

  const ledgerEntry = await createLedgerEntry(
    evidenceId,
    "added",
    `Evidence added: ${item.title}`,
    prevHash,
  );

  return {
    ...tribunalCase,
    evidence: [...tribunalCase.evidence, newItem],
    ledger: [...tribunalCase.ledger, ledgerEntry],
    updatedAt: Date.now(),
  };
}

async function createLedgerEntry(
  evidenceId: string,
  action: EvidenceLedgerEntry["action"],
  note: string,
  prevHash: string,
): Promise<EvidenceLedgerEntry> {
  const ts = Date.now();
  const hash = await computeEntryHash({
    prevHash,
    ts,
    source: evidenceId,
    destination: action,
    amount: note,
    purpose: "evidence_ledger",
    status: action.toUpperCase(),
    signerHandle: undefined,
  });
  return { ts, evidenceId, action, note, hash, prevHash };
}

/* ═══════════════════════════════════════════════════════════
   CASE STRENGTH SCORING
   ═══════════════════════════════════════════════════════════ */

const STRENGTH_WEIGHTS: Record<EvidenceStrength, number> = {
  corroborated: 4,
  single_source: 2,
  circumstantial: 1,
  weak: 0.5,
};

export function computeCaseStrength(tribunalCase: TribunalCase): CaseStrength {
  const gaps: string[] = [];
  const recommendations: string[] = [];

  const totalEvidence = tribunalCase.evidence.length;
  if (totalEvidence === 0) {
    gaps.push("No evidence has been added to this case.");
    recommendations.push("Begin by adding primary evidence: documents, testimony, or data points.");
    return {
      score: 0,
      level: "weak",
      totalEvidence: 0,
      corroboratedEvidence: 0,
      chargesWithEvidence: 0,
      chargesTotal: tribunalCase.charges.length,
      gaps,
      recommendations,
    };
  }

  const corroboratedEvidence = tribunalCase.evidence.filter(
    (e) => e.strength === "corroborated",
  ).length;

  const chargesWithEvidence = tribunalCase.charges.filter(
    (c) => c.evidenceIds.length > 0,
  ).length;

  // Score components:
  // 1. Evidence volume (0-30 points)
  const volumeScore = Math.min(30, totalEvidence * 3);

  // 2. Evidence quality (0-30 points)
  let qualitySum = 0;
  for (const e of tribunalCase.evidence) {
    qualitySum += STRENGTH_WEIGHTS[e.strength];
  }
  const qualityScore = Math.min(30, qualitySum * 2);

  // 3. Charge coverage (0-20 points)
  const coverageScore = tribunalCase.charges.length > 0
    ? Math.min(20, (chargesWithEvidence / tribunalCase.charges.length) * 20)
    : 0;

  // 4. Evidence diversity (0-10 points) — different types of evidence
  const uniqueTypes = new Set(tribunalCase.evidence.map((e) => e.type));
  const diversityScore = Math.min(10, uniqueTypes.size * 2.5);

  // 5. Legal framework specificity (0-10 points)
  const frameworkScore = tribunalCase.charges.filter(
    (c) => c.legalFramework && c.legalFramework.length > 5,
  ).length * 2;
  const cappedFrameworkScore = Math.min(10, frameworkScore);

  const score = Math.round(volumeScore + qualityScore + coverageScore + diversityScore + cappedFrameworkScore);

  let level: CaseStrength["level"];
  if (score >= 80) level = "compelling";
  else if (score >= 55) level = "strong";
  else if (score >= 30) level = "moderate";
  else level = "weak";

  // Identify gaps
  if (corroboratedEvidence === 0) {
    gaps.push("No corroborated evidence — all items are single-source or weaker.");
    recommendations.push("Seek a second independent source for at least one key claim.");
  }
  if (chargesWithEvidence < tribunalCase.charges.length) {
    const unsupported = tribunalCase.charges.length - chargesWithEvidence;
    gaps.push(`${unsupported} charge(s) have no linked evidence.`);
    recommendations.push("Link evidence to every charge, or remove unsupported charges.");
  }
  if (!tribunalCase.evidence.some((e) => e.type === "official_record" || e.type === "document")) {
    gaps.push("No official records or primary documents.");
    recommendations.push("Obtain official records, court filings, or government documents.");
  }
  if (!tribunalCase.evidence.some((e) => e.type === "testimony")) {
    gaps.push("No witness testimony.");
    recommendations.push("Collect signed witness statements (see The Testimony).");
  }
  if (!tribunalCase.evidence.some((e) => e.type === "financial_record") && tribunalCase.charges.some((c) => c.category === "corruption" || c.category === "economic")) {
    gaps.push("No financial records for a corruption/economic charge.");
    recommendations.push("Obtain bank records, audit reports, or procurement data.");
  }

  return {
    score,
    level,
    totalEvidence,
    corroboratedEvidence,
    chargesWithEvidence,
    chargesTotal: tribunalCase.charges.length,
    gaps,
    recommendations,
  };
}

/* ═══════════════════════════════════════════════════════════
   EXPORT
   ═══════════════════════════════════════════════════════════ */

export function exportCase(tribunalCase: TribunalCase): string {
  return JSON.stringify(tribunalCase, null, 2);
}

/* ═══════════════════════════════════════════════════════════
   CATEGORY METADATA
   ═══════════════════════════════════════════════════════════ */

export const CATEGORY_LABELS: Record<ChargeCategory, string> = {
  war_crime: "War Crime",
  crime_against_humanity: "Crime Against Humanity",
  genocide: "Genocide",
  corruption: "Corruption",
  environmental: "Environmental Crime",
  human_rights: "Human Rights Violation",
  economic: "Economic Crime",
};

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  document: "Document",
  testimony: "Witness Testimony",
  data_point: "Data Point",
  media: "Media (Photo/Video)",
  official_record: "Official Record",
  satellite_imagery: "Satellite Imagery",
  financial_record: "Financial Record",
};

export const STRENGTH_LABELS: Record<EvidenceStrength, string> = {
  corroborated: "Corroborated",
  single_source: "Single Source",
  circumstantial: "Circumstantial",
  weak: "Weak / Unverified",
};

export const LEGAL_FRAMEWORKS: { code: string; title: string; category: ChargeCategory }[] = [
  { code: "Rome Statute Art. 5", title: "Genocide", category: "genocide" },
  { code: "Rome Statute Art. 6", title: "Crimes Against Humanity", category: "crime_against_humanity" },
  { code: "Rome Statute Art. 7", title: "War Crimes", category: "war_crime" },
  { code: "Rome Statute Art. 8", title: "Crime of Aggression", category: "war_crime" },
  { code: "UDHR Art. 5", title: "No Torture", category: "human_rights" },
  { code: "UDHR Art. 9", title: "No Arbitrary Arrest", category: "human_rights" },
  { code: "ICCPR Art. 6", title: "Right to Life", category: "human_rights" },
  { code: "UNCAC", title: "Convention Against Corruption", category: "corruption" },
  { code: "Geneva Conv. IV", title: "Protection of Civilians", category: "war_crime" },
  { code: "Paris Agreement", title: "Climate Obligations", category: "environmental" },
  { code: "Ruggie Framework", title: "Business & Human Rights", category: "human_rights" },
];
