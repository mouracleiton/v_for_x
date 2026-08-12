import { describe, it, expect } from "vitest";
import { runSkeptic, topFindings, type SkepticDossier } from "../lib/skeptic";

const strong: SkepticDossier = {
	id: "REG-001",
	subject: "[REDACTED] — Former Minister of Defense, [COUNTRY]",
	country_iso3: "SDN",
	category: "war_crime",
	severity: "critical",
	accusation:
		"Ordered systematic blockade of humanitarian aid to contested regions during active famine conditions.",
	evidence: [
		{
			type: "primary",
			description:
				"UN Panel of Experts report documenting aid convoy blockades (2024)",
			quality_score: 3,
		},
		{
			type: "primary",
			description:
				"Satellite imagery showing destroyed food storage facilities",
			quality_score: 3,
		},
		{
			type: "secondary",
			description: "Amnesty International investigation — witness testimonies",
			quality_score: 1,
		},
	],
	evidence_quality_score: 7,
	peer_validations: 8,
	required_validations: 5,
	right_of_response:
		"Response solicited 2025-04-01; no reply received (documented).",
};

describe("The Skeptic — adversarial dossier checker", () => {
	it("publishes a well-sourced, well-validated dossier", () => {
		const r = runSkeptic(strong);
		expect(["publish", "publish_with_caveats"]).toContain(r.verdict);
		expect(r.blockers).toHaveLength(0);
	});

	it("blocks a dossier with no accusation", () => {
		const r = runSkeptic({ ...strong, accusation: "x" });
		expect(r.verdict).toBe("block");
		expect(r.blockers.some((f) => f.id === "has_accusation")).toBe(true);
	});

	it("blocks a dossier with no evidence", () => {
		const r = runSkeptic({
			...strong,
			evidence: [],
			evidence_quality_score: 0,
		});
		expect(r.verdict).toBe("block");
		expect(r.blockers.some((f) => f.id === "has_evidence")).toBe(true);
	});

	it("flags low evidence quality as a revise blocker", () => {
		const r = runSkeptic({ ...strong, evidence_quality_score: 3 });
		expect(r.verdict).toBe("revise");
		expect(r.blockers.some((f) => f.id === "evidence_quality_threshold")).toBe(
			true,
		);
	});

	it("flags critical severity not justified by evidence quality", () => {
		const r = runSkeptic({ ...strong, evidence_quality_score: 6 });
		expect(r.findings.some((f) => f.id === "severity_justified")).toBe(true);
	});

	it("flags single-source accusations", () => {
		const r = runSkeptic({
			...strong,
			evidence: [
				{ type: "secondary", description: "one news report", quality_score: 1 },
			],
			evidence_quality_score: 5,
		});
		expect(r.findings.some((f) => f.id === "corroboration")).toBe(true);
	});

	it("flags duplicative evidence descriptions as not-independent", () => {
		const dup = "UN Panel of Experts report on aid convoy blockades (2024)";
		const r = runSkeptic({
			...strong,
			evidence: [
				{ type: "primary", description: dup, quality_score: 3 },
				{ type: "primary", description: dup, quality_score: 3 },
			],
			evidence_quality_score: 6,
		});
		expect(r.findings.some((f) => f.id === "corroboration")).toBe(true);
	});

	it("detects phone numbers and emails as PII", () => {
		const r = runSkeptic({
			...strong,
			accusation: `Contact the witness at +249 123 456 789 or witness@example.org for details.`,
		});
		const ids = r.findings.map((f) => f.id);
		expect(ids).toContain("pii_phone");
		expect(ids).toContain("pii_email");
	});

	it("flags missing right-of-response", () => {
		const r = runSkeptic({
			...strong,
			right_of_response: "No response offered",
		});
		expect(r.findings.some((f) => f.id === "right_of_response")).toBe(true);
	});

	it("flags peer validations below required", () => {
		const r = runSkeptic({
			...strong,
			peer_validations: 2,
			required_validations: 5,
		});
		expect(r.verdict).toBe("revise");
		expect(r.blockers.some((f) => f.id === "peer_validations")).toBe(true);
	});

	it("flags malformed ISO3", () => {
		const r = runSkeptic({ ...strong, country_iso3: "SD" });
		expect(r.findings.some((f) => f.id === "iso3_present")).toBe(true);
	});

	it("findings are sorted by severity descending", () => {
		const r = runSkeptic({
			...strong,
			accusation: "x",
			country_iso3: "SD",
			right_of_response: "No response offered",
		});
		const ranks = r.findings.map(
			(f) =>
				({ critical: 5, severe: 4, high: 3, moderate: 2, low: 1 })[
					f.severity
				] ?? 0,
		);
		const sorted = [...ranks].sort((a, b) => b - a);
		expect(ranks).toEqual(sorted);
	});

	it("confidence is 0..100 and drops with more findings", () => {
		const clean = runSkeptic(strong).confidence;
		const dirty = runSkeptic({ ...strong, accusation: "x" }).confidence;
		expect(clean).toBeGreaterThan(dirty);
		expect(dirty).toBeGreaterThanOrEqual(0);
		expect(clean).toBeLessThanOrEqual(100);
	});

	it("summary line names the verdict + counts", () => {
		const r = runSkeptic({ ...strong, accusation: "x" });
		expect(r.summary).toContain("BLOCK");
		expect(r.summary).toContain("blocker");
	});

	it("never throws on a minimal/empty dossier", () => {
		expect(() => runSkeptic({ id: "x" })).not.toThrow();
		const r = runSkeptic({ id: "x" });
		expect(r.verdict).toBe("block");
	});

	it("topFindings returns the N most severe", () => {
		const r = runSkeptic({ ...strong, accusation: "x", country_iso3: "Z" });
		expect(topFindings(r, 2).length).toBeLessThanOrEqual(2);
	});
});
