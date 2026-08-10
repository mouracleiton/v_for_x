import { describe, it, expect } from "vitest";
import {
  classifyHeuristic,
  classifyDocumentHeuristic,
  classifyDocumentSemantic,
  classifySemantic,
  embedPrototypes,
  buildPrototypeTexts,
  extractEntities,
  assessRisk,
  formatClassifierReport,
  DOCUMENT_TYPES,
  type DocumentTypeId,
  type ClassificationResult,
} from "../lib/classifier";
import type { EmbedFn } from "../lib/semantic-oracle";

/* ═══════════════════════════════════════════════════════════
   SAMPLE DOCUMENTS
   ═══════════════════════════════════════════════════════════ */

const CONTRACT_SAMPLE = `
SERVICE AGREEMENT

This Agreement is entered into by and between the Parties on this date.
The Contractor shall provide the services described in Schedule A.
Payment terms: net thirty days from invoice. Force majeure provisions apply.
The Contractor makes representations and warranties regarding the services.
Indemnification and limitation of liability clauses are set forth herein.
Termination for convenience requires thirty days written notice.
This constitutes the entire agreement between the parties.
Governing law and jurisdiction: as specified in the contract.
Confidentiality obligations survive termination of this agreement.
`;

const LEAKED_MEMO_SAMPLE = `
CONFIDENTIAL — INTERNAL USE ONLY
Eyes Only: Director

Per our discussion, the following should be kept off the record.
Recommend we proceed with caution. Please destroy after reading.
Do not forward or distribute this document.

Background: the operation was approved at the highest level.
Source protection is required for all mentions herein.
This is not for public release. Talking points for internal use only.

The OFAC sanctioned entity was identified through a shell company
registered in a secrecy jurisdiction. Money laundering patterns
were documented. Bribery and kickback schemes involved offshore accounts.
`;

const FINANCIAL_SAMPLE = `
ANNUAL REPORT — FISCAL YEAR ENDED DECEMBER 31

Revenue for the fiscal year was $4.2 billion, an increase of 12% year over year.
Net income attributable to shareholders was $890 million.
Earnings per share diluted: $3.45. Cash flow from operating activities: $1.2 billion.
Total assets: $15.6 billion. Total liabilities: $9.8 billion.

The independent auditor issued an unqualified opinion.
Depreciation and amortization expense was $340 million.
Capital expenditures totaled $560 million. Net income margin: 21%.
Dividends declared: $1.20 per share.
`;

const SPEECH_SAMPLE = `
My fellow citizens, I want to address the nation today.

Thank you for being here. We must stand together in these difficult times.
Let me be clear, we will not rest until justice is served.
I call upon the international community to act with urgency.
Together we can build a better future for our children.

As I said before, this is a defining moment. God bless you,
and God bless our great nation.
`;

const NGO_REPORT_SAMPLE = `
FIELD INVESTIGATION REPORT

Our field investigation documented systematic patterns of abuse
over a six month period. Researchers interviewed 47 witnesses
across three regions. According to satellite imagery analysis,
the site was heavily damaged.

The findings indicate widespread human rights violations.
We call on authorities to investigate these abuses immediately.

Recommendations: the government should ensure accountability
and provide reparations to victims. Torture and enforced disappearance
were documented in multiple facilities. Extrajudicial killings
were also confirmed.
`;

/* ═══════════════════════════════════════════════════════════
   MOCK EMBED FUNCTION (deterministic for unit tests)
   ═══════════════════════════════════════════════════════════ */

/**
 * A deterministic mock embedder. Maps text to a 4-dim vector by counting
 * keyword families. Enough to test that classifySemantic correctly ranks
 * prototypes — not a real embedding, but structurally valid.
 */
function makeMockEmbedder(): EmbedFn {
  const families: { words: string[]; dim: number }[] = [
    { words: ["agreement", "contractor", "liability", "indemnif", "force majeure", "termination", "parties", "warranties", "arbitration", "clause"], dim: 0 },
    { words: ["citizens", "nation", "together", "god bless", "fellow", "clear", "call upon", "stand"], dim: 1 },
    { words: ["confidential", "internal", "destroy", "off the record", "do not forward", "classified", "eyes only"], dim: 2 },
    { words: ["revenue", "fiscal", "net income", "earnings", "assets", "liabilities", "audit", "shareholders", "cash flow"], dim: 3 },
    { words: ["defendant", "statute", "pursuant", "court", "penalty", "appeal", "charged", "violation"], dim: 4 },
    { words: ["investigation", "witnesses", "satellite", "findings", "recommendations", "methodology", "documented", "human rights"], dim: 5 },
    { words: ["immediate release", "spokesperson", "announced", "media contact", "statement", "press"], dim: 6 },
    { words: ["dear", "regards", "sincerely", "friend", "hope", "trust", "miss", "love"], dim: 7 },
  ];

  return async (texts: string[]) => {
    return texts.map((t) => {
      const lower = t.toLowerCase();
      const vec = new Array(families.length).fill(0);
      for (const f of families) {
        for (const w of f.words) {
          if (lower.includes(w)) vec[f.dim] += 1;
        }
      }
      // L2-normalize
      const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
      return vec.map((v) => v / norm);
    });
  };
}

/* ═══════════════════════════════════════════════════════════
   TESTS
   ═══════════════════════════════════════════════════════════ */

describe("classifier.ts", () => {
  /* ── Prototype infrastructure ── */
  describe("buildPrototypeTexts", () => {
    it("should return one text per document type", () => {
      const texts = buildPrototypeTexts();
      expect(texts).toHaveLength(DOCUMENT_TYPES.length);
      for (const t of texts) {
        expect(t.length).toBeGreaterThan(50);
      }
    });
  });

  describe("embedPrototypes", () => {
    it("should embed all prototypes with correct dimensions", async () => {
      const embed = makeMockEmbedder();
      const protos = await embedPrototypes(embed, "test-model");
      expect(protos.modelId).toBe("test-model");
      expect(protos.vectors).toHaveLength(DOCUMENT_TYPES.length);
      expect(protos.dim).toBeGreaterThan(0);
      // Each vector should be unit length (normalized).
      for (const v of protos.vectors) {
        const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
        expect(norm).toBeCloseTo(1, 4);
      }
    });
  });

  /* ── Heuristic classification ── */
  describe("classifyHeuristic", () => {
    it("should classify a contract as contract type", () => {
      const result = classifyHeuristic(CONTRACT_SAMPLE);
      expect(result.engine).toBe("heuristic");
      expect(result.top.id).toBe("contract");
      expect(result.scores).toHaveLength(DOCUMENT_TYPES.length);
    });

    it("should classify a leaked memo as leaked_memo type", () => {
      const result = classifyHeuristic(LEAKED_MEMO_SAMPLE);
      expect(result.top.id).toBe("leaked_memo");
    });

    it("should classify a financial report as financial_filing type", () => {
      const result = classifyHeuristic(FINANCIAL_SAMPLE);
      expect(result.top.id).toBe("financial_filing");
    });

    it("should classify a speech as speech_transcript type", () => {
      const result = classifyHeuristic(SPEECH_SAMPLE);
      expect(result.top.id).toBe("speech_transcript");
    });

    it("should classify an NGO report as ngo_report type", () => {
      const result = classifyHeuristic(NGO_REPORT_SAMPLE);
      expect(result.top.id).toBe("ngo_report");
    });

    it("should handle empty text without crashing", () => {
      const result = classifyHeuristic("");
      expect(result.scores).toHaveLength(DOCUMENT_TYPES.length);
      expect(result.top).toBeDefined();
    });

    it("should produce valid percentages that sum to ~100", () => {
      const result = classifyHeuristic(FINANCIAL_SAMPLE);
      const sum = result.scores.reduce((s, r) => s + r.pct, 0);
      expect(sum).toBeCloseTo(100, 0);
    });

    it("should have a non-negative margin", () => {
      const result = classifyHeuristic(CONTRACT_SAMPLE);
      expect(result.margin).toBeGreaterThanOrEqual(0);
    });
  });

  /* ── Semantic classification ── */
  describe("classifySemantic", () => {
    it("should classify via cosine similarity to prototypes", async () => {
      const embed = makeMockEmbedder();
      const protos = await embedPrototypes(embed, "mock");
      const result = await classifySemantic(CONTRACT_SAMPLE, embed, protos);
      expect(result.engine).toBe("semantic");
      expect(result.top.id).toBe("contract");
    });

    it("should rank financial sample as financial_filing", async () => {
      const embed = makeMockEmbedder();
      const protos = await embedPrototypes(embed, "mock");
      const result = await classifySemantic(FINANCIAL_SAMPLE, embed, protos);
      expect(result.top.id).toBe("financial_filing");
    });
  });

  /* ── Entity extraction ── */
  describe("extractEntities", () => {
    it("should extract people with titles", () => {
      const text = "President Smith announced the policy. Minister Jane Doe confirmed the details later.";
      const entities = extractEntities(text);
      expect(entities.people.length).toBeGreaterThanOrEqual(1);
      const names = entities.people.map((p) => p.text);
      expect(names.some((n) => n.includes("Smith"))).toBe(true);
    });

    it("should extract people via verb patterns", () => {
      const text = "John Carter said the deal was done. Maria Lopez stated otherwise.";
      const entities = extractEntities(text);
      expect(entities.people.some((p) => p.text.includes("Carter"))).toBe(true);
    });

    it("should extract organizations with suffixes", () => {
      const text = "Acme Corp won the bid. Global Holdings Inc and the Ford Foundation contributed.";
      const entities = extractEntities(text);
      const orgNames = entities.organizations.map((o) => o.text);
      expect(orgNames.some((o) => o.includes("Acme"))).toBe(true);
      expect(orgNames.some((o) => o.includes("Holdings"))).toBe(true);
      expect(orgNames.some((o) => o.includes("Foundation"))).toBe(true);
    });

    it("should filter organization false positives", () => {
      const text = "The good Bank is there. This Ministry was old.";
      const entities = extractEntities(text);
      // "good" and "This" should be filtered as stopword starts.
      const orgNames = entities.organizations.map((o) => o.text.toLowerCase());
      expect(orgNames.some((o) => o.startsWith("good"))).toBe(false);
    });

    it("should extract money amounts with values", () => {
      const text = "Revenue was $4.2 billion. The contract is worth $1,500,000. Costs reached 50 million dollars.";
      const entities = extractEntities(text);
      expect(entities.money.length).toBeGreaterThanOrEqual(2);
      // Check that at least one has a parsed value ≥ 1M.
      const largeAmounts = entities.money.filter((m) => (m.value ?? 0) >= 1_000_000);
      expect(largeAmounts.length).toBeGreaterThanOrEqual(1);
    });

    it("should parse currency-prefixed amounts", () => {
      const text = "The fine was EUR 5 million. Payment of USD 3,200,000 was made.";
      const entities = extractEntities(text);
      expect(entities.money.length).toBeGreaterThanOrEqual(1);
    });

    it("should extract dates in multiple formats", () => {
      const text = "Signed on January 15, 2024. Effective 2024-03-01. Published 5 February 2024.";
      const entities = extractEntities(text);
      expect(entities.dates.length).toBeGreaterThanOrEqual(2);
    });

    it("should extract percentages with values", () => {
      const text = "Growth of 12.5% was reported. Unemployment fell to 4.2%. Inflation at 8%.";
      const entities = extractEntities(text);
      expect(entities.percentages.length).toBeGreaterThanOrEqual(2);
      for (const p of entities.percentages) {
        expect(p.value).not.toBeNaN();
      }
    });

    it("should extract country mentions", () => {
      const text = "Operations in Sudan and Yemen expanded. Reports from Syria and Myanmar.";
      const entities = extractEntities(text);
      expect(entities.countries.length).toBeGreaterThanOrEqual(2);
      const isos = entities.countries.map((c) => c.iso3);
      expect(isos).toContain("SDN");
      expect(isos).toContain("YEM");
    });

    it("should count entity frequency", () => {
      const text = "Acme Corp appeared. Acme Corp was mentioned again. Third reference to Acme Corp.";
      const entities = extractEntities(text);
      const acme = entities.organizations.find((o) => o.text.includes("Acme"));
      expect(acme).toBeDefined();
      expect(acme!.count).toBe(3);
    });

    it("should provide context snippets", () => {
      const text = "The prosecutor General Williams ordered the investigation immediately.";
      const entities = extractEntities(text);
      const person = entities.people.find((p) => p.text.includes("Williams"));
      expect(person).toBeDefined();
      expect(person!.context.length).toBeGreaterThan(0);
    });

    it("should compute a total entity count", () => {
      const entities = extractEntities(LEAKED_MEMO_SAMPLE);
      expect(entities.total).toBe(
        entities.people.length +
        entities.organizations.length +
        entities.money.length +
        entities.dates.length +
        entities.percentages.length +
        entities.countries.length,
      );
    });

    it("should handle empty text", () => {
      const entities = extractEntities("");
      expect(entities.people).toHaveLength(0);
      expect(entities.total).toBe(0);
    });
  });

  /* ── Risk assessment ── */
  describe("assessRisk", () => {
    function makeClassification(topId: DocumentTypeId): ClassificationResult {
      return {
        scores: [{ id: topId, label: topId, score: 1, pct: 100 }],
        top: { id: topId, label: topId, score: 1, pct: 100 },
        engine: "heuristic",
        margin: 1,
      };
    }

    it("should return a score between 0 and 100", () => {
      const risk = assessRisk(makeClassification("contract"), { people: [], organizations: [], money: [], dates: [], percentages: [], countries: [], total: 0 }, []);
      expect(risk.score).toBeGreaterThanOrEqual(0);
      expect(risk.score).toBeLessThanOrEqual(100);
    });

    it("should escalate with critical red flags", () => {
      const risk = assessRisk(
        makeClassification("leaked_memo"),
        { people: [], organizations: [], money: [], dates: [], percentages: [], countries: [], total: 0 },
        [
          { term: "bribery", context: "…bribery…", category: "Corruption", severity: "critical" },
          { term: "torture", context: "…torture…", category: "Human Rights", severity: "critical" },
        ],
      );
      expect(risk.score).toBeGreaterThanOrEqual(20);
      expect(risk.factors.some((f) => f.severity === "critical")).toBe(true);
    });

    it("should account for large money amounts", () => {
      const risk = assessRisk(
        makeClassification("financial_filing"),
        {
          people: [], organizations: [], dates: [], percentages: [], countries: [], total: 1,
          money: [{ text: "$5 billion", type: "money", count: 1, context: "", value: 5_000_000_000 }],
        },
        [],
      );
      expect(risk.factors.some((f) => f.label.includes("financial"))).toBe(true);
    });

    it("should flag sanctioned-jurisdiction exposure", () => {
      const risk = assessRisk(
        makeClassification("leaked_memo"),
        {
          people: [], organizations: [], money: [], dates: [], percentages: [], total: 1,
          countries: [
            { name: "Russia", iso3: "RUS", count: 3 },
            { name: "Iran", iso3: "IRN", count: 1 },
          ],
        },
        [],
      );
      expect(risk.factors.some((f) => f.label.toLowerCase().includes("sanctioned"))).toBe(true);
    });

    it("should assign correct risk levels", () => {
      const lowRisk = assessRisk(makeClassification("personal_correspondence"), { people: [], organizations: [], money: [], dates: [], percentages: [], countries: [], total: 0 }, []);
      expect(lowRisk.score).toBeLessThan(20);

      const highRisk = assessRisk(
        makeClassification("leaked_memo"),
        { people: [], organizations: [], money: [], dates: [], percentages: [], countries: [{ name: "Syria", iso3: "SYR", count: 5 }], total: 1 },
        Array.from({ length: 6 }, (_, i) => ({ term: `t${i}`, context: "", category: "X", severity: "critical" as const })),
      );
      expect(highRisk.level === "high" || highRisk.level === "critical").toBe(true);
    });

    it("should sort factors by points descending", () => {
      const risk = assessRisk(
        makeClassification("leaked_memo"),
        {
          people: [], organizations: [], money: [{ text: "$2M", type: "money", count: 1, context: "", value: 2_000_000 }], dates: [], percentages: [], countries: [], total: 1,
        },
        [{ term: "bribery", context: "", category: "Corruption", severity: "critical" as const }],
      );
      const points = risk.factors.map((f) => f.points);
      const sorted = [...points].sort((a, b) => b - a);
      expect(points).toEqual(sorted);
    });
  });

  /* ── Full heuristic pipeline ── */
  describe("classifyDocumentHeuristic", () => {
    it("should return a complete result with all fields", () => {
      const result = classifyDocumentHeuristic(LEAKED_MEMO_SAMPLE);
      expect(result.classification).toBeDefined();
      expect(result.entities).toBeDefined();
      expect(result.risk).toBeDefined();
      expect(result.analysis).toBeDefined();
      expect(result.wordCount).toBeGreaterThan(0);
    });

    it("should correctly identify a leaked memo with high risk", () => {
      const result = classifyDocumentHeuristic(LEAKED_MEMO_SAMPLE);
      expect(result.classification.top.id).toBe("leaked_memo");
      expect(result.risk.level === "high" || result.risk.level === "critical" || result.risk.level === "moderate").toBe(true);
    });
  });

  /* ── Full semantic pipeline ── */
  describe("classifyDocumentSemantic", () => {
    it("should return a complete result using the semantic engine", async () => {
      const embed = makeMockEmbedder();
      const protos = await embedPrototypes(embed, "mock");
      const result = await classifyDocumentSemantic(CONTRACT_SAMPLE, embed, protos);
      expect(result.classification.engine).toBe("semantic");
      expect(result.entities).toBeDefined();
      expect(result.risk).toBeDefined();
      expect(result.wordCount).toBeGreaterThan(0);
    });
  });

  /* ── Report formatting ── */
  describe("formatClassifierReport", () => {
    it("should produce a readable text report", () => {
      const result = classifyDocumentHeuristic(FINANCIAL_SAMPLE);
      const report = formatClassifierReport(result);
      expect(report).toContain("V FOR X — DOCUMENT CLASSIFIER REPORT");
      expect(report).toContain("DOCUMENT TYPE");
      expect(report).toContain("RISK ASSESSMENT");
      expect(report).toContain("ENTITIES");
      expect(report).toContain(result.classification.top.label);
    });

    it("should include the engine type in the report", () => {
      const result = classifyDocumentHeuristic(CONTRACT_SAMPLE);
      const report = formatClassifierReport(result);
      expect(report).toContain("HEURISTIC");
    });

    it("should handle documents with no entities gracefully", () => {
      const result = classifyDocumentHeuristic("hello world this is a test");
      const report = formatClassifierReport(result);
      expect(report).toContain("DOCUMENT CLASSIFIER REPORT");
    });
  });

  /* ── Document type definitions ── */
  describe("DOCUMENT_TYPES", () => {
    it("should have 8 document types", () => {
      expect(DOCUMENT_TYPES).toHaveLength(8);
    });

    it("should have unique ids", () => {
      const ids = DOCUMENT_TYPES.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("should have keywords for each type", () => {
      for (const t of DOCUMENT_TYPES) {
        expect(t.keywords.length).toBeGreaterThanOrEqual(10);
      }
    });

    it("should have inherent risk between 0 and 1", () => {
      for (const t of DOCUMENT_TYPES) {
        expect(t.inherentRisk).toBeGreaterThanOrEqual(0);
        expect(t.inherentRisk).toBeLessThanOrEqual(1);
      }
    });

    it("should have non-empty prototype texts", () => {
      for (const t of DOCUMENT_TYPES) {
        expect(t.prototypeText.length).toBeGreaterThan(100);
      }
    });
  });
});
