/**
 * V FOR X — The Skeptic (todo-322)
 *
 * An adversarial checklist that tries to break a dossier BEFORE it is
 * published. Where registry-safety.ts is about anti-witch-hunt gates on
 * already-published subjects, The Skeptic runs on the authoring side: it
 * asks the questions a hostile reviewer or a careless editor would ask,
 * and returns a verdict + the concrete weaknesses to fix. Never publishes
 * a number it cannot defend.
 *
 * Pure functions over the dossier shape from data/dossier-seed.json. No
 * network, no LLM — the checklist is deterministic so two authors running
 * it get the same verdict on the same input.
 */

export interface SkepticEvidence {
	type?: string;
	description?: string;
	quality_score?: number;
}

export interface SkepticDossier {
	id: string;
	subject?: string;
	country_iso3?: string;
	category?: string;
	severity?: string;
	status?: string;
	accusation?: string;
	evidence?: SkepticEvidence[];
	evidence_quality_score?: number;
	peer_validations?: number;
	required_validations?: number;
	right_of_response?: string;
	sources?: string[];
}

export type Severity = "critical" | "severe" | "high" | "moderate" | "low";
export type Verdict = "block" | "revise" | "publish_with_caveats" | "publish";

export interface SkepticFinding {
	/** Stable id for dedup / UI keys. */
	id: string;
	/** One-line what's wrong. */
	check: string;
	/** Why it matters. */
	detail: string;
	severity: Severity;
	/** The specific field path that triggered it, if any. */
	field?: string;
}

export interface SkepticReport {
	verdict: Verdict;
	findings: SkepticFinding[];
	/** Blocking findings (critical/severe) that forced a non-publish verdict. */
	blockers: SkepticFinding[];
	/** 0..100 confidence in the verdict. */
	confidence: number;
	summary: string;
}

const RANK: Record<Severity, number> = {
	critical: 5,
	severe: 4,
	high: 3,
	moderate: 2,
	low: 1,
};

/** A single adversarial check. Returns findings (possibly empty). */
interface Check {
	id: string;
	run: (d: SkepticDossier) => SkepticFinding[];
}

const CHECKS: Check[] = [
	{
		id: "has_accusation",
		run: (d) =>
			!d.accusation || d.accusation.trim().length < 20
				? [
						{
							id: "has_accusation",
							check: "Accusation is missing or too short",
							detail:
								"A dossier must state a specific, falsifiable accusation (>20 chars).",
							severity: "critical",
							field: "accusation",
						},
					]
				: [],
	},
	{
		id: "has_evidence",
		run: (d) =>
			!d.evidence || d.evidence.length === 0
				? [
						{
							id: "has_evidence",
							check: "No evidence attached",
							detail:
								"An accusation without at least one evidence item is a rumor, not a dossier.",
							severity: "critical",
							field: "evidence",
						},
					]
				: [],
	},
	{
		id: "primary_evidence_present",
		run: (d) => {
			if (!d.evidence || d.evidence.length === 0) return [];
			const hasPrimary = d.evidence.some((e) => e.type === "primary");
			return hasPrimary
				? []
				: [
						{
							id: "primary_evidence_present",
							check: "No primary evidence",
							detail:
								"Only secondary/tertiary sources — a hostile reviewer will ask why no primary record exists.",
							severity: "high",
							field: "evidence",
						},
					];
		},
	},
	{
		id: "evidence_quality_threshold",
		run: (d) => {
			if (typeof d.evidence_quality_score !== "number") return [];
			return d.evidence_quality_score < 5
				? [
						{
							id: "evidence_quality_threshold",
							check: `Evidence quality score ${d.evidence_quality_score} below publish threshold (5)`,
							detail:
								"A dossier below 5 cannot survive peer review; gather stronger sources first.",
							severity: "severe",
							field: "evidence_quality_score",
						},
					]
				: [];
		},
	},
	{
		id: "corroboration",
		run: (d) => {
			if (!d.evidence || d.evidence.length < 2)
				return [
					{
						id: "corroboration",
						check: "Single-source accusation",
						detail:
							"One source can be wrong or coerced. Aim for ≥2 independent sources.",
						severity: "high",
						field: "evidence",
					},
				];
			// Two sources from the same description stem are not independent.
			const descs = d.evidence.map((e) => (e.description ?? "").toLowerCase());
			const unique = new Set(descs.map((s) => s.slice(0, 40)));
			return unique.size < 2
				? [
						{
							id: "corroboration",
							check: "Evidence items appear duplicative",
							detail:
								"Multiple evidence items share the same opening text — are they truly independent?",
							severity: "moderate",
							field: "evidence",
						},
					]
				: [];
		},
	},
	{
		id: "severity_justified",
		run: (d) => {
			if (!d.severity || d.severity !== "critical") return [];
			const score = d.evidence_quality_score ?? 0;
			return score < 7
				? [
						{
							id: "severity_justified",
							check: "Critical severity not justified by evidence quality",
							detail:
								"A 'critical' severity claim needs evidence_quality_score ≥ 7; otherwise downgrade severity or strengthen evidence.",
							severity: "high",
							field: "severity",
						},
					]
				: [];
		},
	},
	{
		id: "pii_scan",
		run: (d) => {
			const haystack = `${d.subject ?? ""} ${d.accusation ?? ""} ${(
				d.evidence ?? []
			)
				.map((e) => e.description ?? "")
				.join(" ")}`;
			// Phone-ish, email-ish, and obvious full-name-of-private-individual patterns.
			const phone = /\+?\d[\d\s().-]{7,}\d/.test(haystack);
			const email = /[\w.+-]+@[\w-]+\.[\w.-]+/.test(haystack);
			const findings: SkepticFinding[] = [];
			if (phone)
				findings.push({
					id: "pii_phone",
					check: "Possible phone number in text",
					detail:
						"Strip contact details of at-risk individuals; route them through the contact field instead.",
					severity: "severe",
					field: "accusation",
				});
			if (email)
				findings.push({
					id: "pii_email",
					check: "Possible email address in text",
					detail:
						"Strip email addresses from public-facing fields; use the structured contact channel.",
					severity: "severe",
					field: "accusation",
				});
			return findings;
		},
	},
	{
		id: "right_of_response",
		run: (d) =>
			!d.right_of_response ||
			d.right_of_response.trim().toLowerCase() === "no response offered"
				? [
						{
							id: "right_of_response",
							check: "No right-of-response solicited",
							detail:
								"Documenting that the subject was offered a response protects against bias claims. Record the attempt even if refused.",
							severity: "moderate",
							field: "right_of_response",
						},
					]
				: [],
	},
	{
		id: "peer_validations",
		run: (d) => {
			if (
				typeof d.peer_validations !== "number" ||
				typeof d.required_validations !== "number"
			)
				return [];
			return d.peer_validations < d.required_validations
				? [
						{
							id: "peer_validations",
							check: `Peer validations ${d.peer_validations} < required ${d.required_validations}`,
							detail:
								"Dossier has not met its own validation threshold; do not publish until it does.",
							severity: "severe",
							field: "peer_validations",
						},
					]
				: [];
		},
	},
	{
		id: "iso3_present",
		run: (d) =>
			!d.country_iso3 || !/^[A-Z]{3}$/.test(d.country_iso3)
				? [
						{
							id: "iso3_present",
							check: "Missing or malformed country ISO3",
							detail:
								"Without a valid ISO3 the dossier cannot be cross-referenced against the backbone or flows.",
							severity: "moderate",
							field: "country_iso3",
						},
					]
				: [],
	},
];

function verdictFrom(findings: SkepticFinding[]): {
	verdict: Verdict;
	blockers: SkepticFinding[];
} {
	const blockers = findings.filter((f) => RANK[f.severity] >= RANK.severe);
	if (blockers.some((f) => f.severity === "critical")) {
		return { verdict: "block", blockers };
	}
	if (blockers.length > 0) {
		return { verdict: "revise", blockers };
	}
	const caveats = findings.filter(
		(f) => f.severity === "moderate" || f.severity === "high",
	);
	return {
		verdict: caveats.length > 0 ? "publish_with_caveats" : "publish",
		blockers,
	};
}

/** Run the full adversarial checklist. Never throws. */
export function runSkeptic(dossier: SkepticDossier): SkepticReport {
	const findings: SkepticFinding[] = [];
	for (const check of CHECKS) {
		try {
			findings.push(...check.run(dossier));
		} catch {
			// A check that throws is itself a finding — the dossier is unparseable.
			findings.push({
				id: check.id,
				check: `Check '${check.id}' could not be evaluated`,
				detail: "The skeptic failed to inspect this aspect; treat as a gap.",
				severity: "moderate",
			});
		}
	}
	findings.sort((a, b) => RANK[b.severity] - RANK[a.severity]);
	const { verdict, blockers } = verdictFrom(findings);
	const confidence = Math.max(
		0,
		Math.min(
			100,
			100 - findings.reduce((acc, f) => acc + RANK[f.severity] * 6, 0),
		),
	);
	const summary = summaryFor(verdict, findings, blockers);
	return { verdict, findings, blockers, confidence, summary };
}

function summaryFor(
	verdict: Verdict,
	findings: SkepticFinding[],
	blockers: SkepticFinding[],
): string {
	const parts = [verdict.toUpperCase()];
	if (blockers.length > 0) parts.push(`${blockers.length} blocker(s)`);
	if (findings.length > blockers.length)
		parts.push(`${findings.length - blockers.length} caveat(s)`);
	if (findings.length === 0) parts.push("no issues found");
	return parts.join(" · ");
}

/** Convenience: the top N findings to show an author first. */
export function topFindings(report: SkepticReport, n = 5): SkepticFinding[] {
	return report.findings.slice(0, n);
}
