import { describe, it, expect } from "vitest";
import {
  createCase,
  addCharge,
  addEvidence,
  linkEvidenceToCharge,
  computeCaseStrength,
  exportCase,
  LEGAL_FRAMEWORKS,
} from "../lib/tribunal";

describe("tribunal.ts", () => {
  describe("createCase", () => {
    it("should create a case with default fields", () => {
      const c = createCase("Test Case", "General Doe", "Minister of Defense", "Summary");
      expect(c.id).toBeDefined();
      expect(c.title).toBe("Test Case");
      expect(c.charges).toHaveLength(0);
      expect(c.evidence).toHaveLength(0);
      expect(c.status).toBe("draft");
      expect(c.ledger).toHaveLength(0);
    });
  });

  describe("addCharge", () => {
    it("should add a charge to a case", () => {
      const c = createCase("Test", "Doe", "Official", "Summary");
      const updated = addCharge(c, {
        category: "war_crime",
        title: "Indiscriminate bombardment of civilians",
        legalFramework: "Rome Statute Art. 8",
        description: "Artillery strikes on residential areas",
        iso3: "SDN",
      });
      expect(updated.charges).toHaveLength(1);
      expect(updated.charges[0].evidenceIds).toHaveLength(0);
    });
  });

  describe("addEvidence", () => {
    it("should add evidence and create a ledger entry", async () => {
      const c = createCase("Test", "Doe", "Official", "Summary");
      const updated = await addEvidence(c, {
        type: "document",
        title: "Bombing order document",
        description: "Signed order directing bombardment",
        source: "Leaked government document",
        date: "2024-01-15",
        strength: "corroborated",
      });
      expect(updated.evidence).toHaveLength(1);
      expect(updated.ledger).toHaveLength(1);
      expect(updated.ledger[0].action).toBe("added");
      expect(updated.ledger[0].hash).toHaveLength(64);
    });
  });

  describe("linkEvidenceToCharge", () => {
    it("should link evidence to a charge", async () => {
      let c = createCase("Test", "Doe", "Official", "Summary");
      c = addCharge(c, {
        category: "war_crime",
        title: "Test charge",
        legalFramework: "Rome Statute Art. 8",
        description: "Description",
      });
      c = await addEvidence(c, {
        type: "testimony",
        title: "Witness statement",
        description: "Saw the bombardment",
        source: "Anonymous witness",
        date: "2024-01-20",
        strength: "single_source",
      });

      const chargeId = c.charges[0].id;
      const evidenceId = c.evidence[0].id;
      const linked = linkEvidenceToCharge(c, chargeId, evidenceId);
      expect(linked.charges[0].evidenceIds).toContain(evidenceId);
    });

    it("should not duplicate evidence links", async () => {
      let c = createCase("Test", "Doe", "Official", "Summary");
      c = addCharge(c, {
        category: "corruption",
        title: "Embezzlement",
        legalFramework: "UNCAC",
        description: "Diverted aid funds",
      });
      c = await addEvidence(c, {
        type: "financial_record",
        title: "Bank transfer records",
        description: "Shows money trail",
        source: "Bank records",
        date: "2024-02-01",
        strength: "corroborated",
      });
      const chargeId = c.charges[0].id;
      const evidenceId = c.evidence[0].id;
      let linked = linkEvidenceToCharge(c, chargeId, evidenceId);
      linked = linkEvidenceToCharge(linked, chargeId, evidenceId);
      expect(linked.charges[0].evidenceIds).toHaveLength(1);
    });
  });

  describe("computeCaseStrength", () => {
    it("should return weak for empty case", () => {
      const c = createCase("Test", "Doe", "Official", "Summary");
      const strength = computeCaseStrength(c);
      expect(strength.score).toBe(0);
      expect(strength.level).toBe("weak");
      expect(strength.gaps.length).toBeGreaterThan(0);
    });

    it("should score higher with corroborated evidence", async () => {
      let c = createCase("Test", "Doe", "Official", "Summary");
      c = addCharge(c, {
        category: "war_crime",
        title: "Test charge",
        legalFramework: "Rome Statute Art. 8",
        description: "Description",
      });
      c = await addEvidence(c, {
        type: "document",
        title: "Doc 1",
        description: "Desc",
        source: "S",
        date: "2024",
        strength: "corroborated",
      });
      c = await addEvidence(c, {
        type: "testimony",
        title: "Testimony 1",
        description: "Desc",
        source: "S",
        date: "2024",
        strength: "corroborated",
      });
      const chargeId = c.charges[0].id;
      c = linkEvidenceToCharge(c, chargeId, c.evidence[0].id);
      c = linkEvidenceToCharge(c, chargeId, c.evidence[1].id);

      const strength = computeCaseStrength(c);
      expect(strength.score).toBeGreaterThan(30);
      expect(strength.chargesWithEvidence).toBe(1);
      expect(strength.corroboratedEvidence).toBe(2);
    });

    it("should identify gaps for corruption charges without financial records", async () => {
      let c = createCase("Test", "Doe", "Official", "Summary");
      c = addCharge(c, {
        category: "corruption",
        title: "Bribery",
        legalFramework: "UNCAC",
        description: "Accepted bribes",
      });
      c = await addEvidence(c, {
        type: "testimony",
        title: "Witness",
        description: "Saw the bribe",
        source: "S",
        date: "2024",
        strength: "single_source",
      });
      const strength = computeCaseStrength(c);
      expect(strength.gaps.some((g) => g.includes("financial"))).toBe(true);
    });
  });

  describe("exportCase", () => {
    it("should export as valid JSON", () => {
      const c = createCase("Test", "Doe", "Official", "Summary");
      const exported = exportCase(c);
      const parsed = JSON.parse(exported);
      expect(parsed.title).toBe("Test");
    });
  });

  describe("legal frameworks", () => {
    it("should have multiple frameworks", () => {
      expect(LEGAL_FRAMEWORKS.length).toBeGreaterThan(5);
      expect(LEGAL_FRAMEWORKS.some((f) => f.category === "war_crime")).toBe(true);
      expect(LEGAL_FRAMEWORKS.some((f) => f.category === "corruption")).toBe(true);
    });
  });
});
