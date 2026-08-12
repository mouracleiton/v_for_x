/**
 * V FOR X — Medical shortage board safety warnings (todo-014)
 *
 * A shortage list alone is dangerous: "insulin: none" without the warning
 * "do not ration; switch clinics before switching insulins" can get someone
 * killed. This module maps a shortage entry to severity-tuned, pre-harm
 * safety guidance so /the-trail's MEDICAL SHORTAGE BOARD always renders the
 * warning next to the number.
 *
 * Static / offline / no network. Pure functions over a seeded critical-meds
 * table; callers can extend it.
 */

export type ShortageSeverity = "critical" | "severe" | "moderate" | "low";

export interface ShortageEntry {
	/** Free-text item name, e.g. "insulin (rapid-acting)". */
	item: string;
	/** ISO3 the shortage is scoped to. */
	iso3: string;
	/** Days of stock remaining (0 = out, undefined = unknown). */
	daysRemaining?: number;
	/** Optional reporter note (verbatim). */
	note?: string;
}

export interface MedSafetyRule {
	/** Lowercase match tokens — if any appears in item, the rule fires. */
	match: string[];
	/** Short label. */
	label: string;
	/** The safety warning the board MUST show next to this shortage. */
	warning: string;
	/** Severity when stock is out or near-out. */
	severity: ShortageSeverity;
}

/**
 * Seed table of medications where rationing or abrupt substitution is
 * life-threatening. Extend by pushing to MED_SAFETY_RULES.
 */
export const MED_SAFETY_RULES: MedSafetyRule[] = [
	{
		match: ["insulin"],
		label: "Insulin",
		warning:
			"Do not ration insulin. Switch clinics or seek emergency supply before changing dose. Abrupt stop causes diabetic ketoacidosis within hours.",
		severity: "critical",
	},
	{
		match: ["adrenaline", "epinephrine", "epipen"],
		label: "Adrenaline / Epinephrine",
		warning:
			"Anaphylaxis is fatal without adrenaline. Carry an unexpired auto-injector; if supply is out, identify the nearest hospital with injectable adrenaline now.",
		severity: "critical",
	},
	{
		match: [
			"antibiotic",
			"amoxicillin",
			"penicillin",
			"ceftriaxone",
			"azithromycin",
		],
		label: "Antibiotics",
		warning:
			"Do not split or share antibiotic courses — incomplete courses breed resistance. Seek the same-class equivalent from a pharmacist before the course ends.",
		severity: "severe",
	},
	{
		match: ["oxygen", "o2"],
		label: "Medical oxygen",
		warning:
			"Oxygen-dependent patients decompensate fast. Prioritise concentrators over cylinders; never use industrial oxygen for medical use.",
		severity: "critical",
	},
	{
		match: ["dialysis", "haemodialysis", "hemodialysis"],
		label: "Dialysis supplies",
		warning:
			"Missed dialysis is life-threatening within days. Coordinate transfer to a functioning unit; do not delay more than 48h.",
		severity: "critical",
	},
	{
		match: ["vaccine", "vaccination"],
		label: "Vaccines",
		warning:
			"A gap in cold-chain or supply breaks the immunity schedule. Record the missed dose; do not restart a course — resume from where it stopped.",
		severity: "moderate",
	},
	{
		match: ["analgesic", "paracetamol", "ibuprofen", "morphine"],
		label: "Analgesics",
		warning:
			"Severe-pain analgesia (e.g. morphine) must not be stopped abruptly after sustained use — taper under guidance. Over-the-counter analgesics are substitutable.",
		severity: "moderate",
	},
];

/** Default warning when no rule matches: a safe, generic shortage notice. */
export const GENERIC_WARNING =
	"Verify substitution safety with a pharmacist before switching brand or dose. Do not share prescribed medication.";

/** Find the first safety rule whose match tokens appear in the item name. */
export function findRule(item: string): MedSafetyRule | null {
	const lower = item.toLowerCase();
	for (const rule of MED_SAFETY_RULES) {
		if (rule.match.some((tok) => lower.includes(tok))) return rule;
	}
	return null;
}

/** Severity derived from days of stock remaining. */
export function severityFromDays(
	daysRemaining: number | undefined,
): ShortageSeverity {
	if (daysRemaining === undefined) return "moderate";
	if (daysRemaining <= 0) return "critical";
	if (daysRemaining <= 3) return "severe";
	if (daysRemaining <= 7) return "moderate";
	return "low";
}

export interface ShortageWarning {
	item: string;
	label: string;
	/** Final severity = max(item-severity, rule-severity). */
	severity: ShortageSeverity;
	warning: string;
	/** True if a specific critical-med rule matched (vs. generic fallback). */
	matched: boolean;
	/** The original note, echoed back for display. */
	note?: string;
}

const SEVERITY_RANK: Record<ShortageSeverity, number> = {
	critical: 4,
	severe: 3,
	moderate: 2,
	low: 1,
};

function maxSeverity(
	a: ShortageSeverity,
	b: ShortageSeverity,
): ShortageSeverity {
	return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

/** Build the safety warning for a shortage entry. Never throws. */
export function warningFor(entry: ShortageEntry): ShortageWarning {
	const rule = findRule(entry.item);
	const stockSeverity = severityFromDays(entry.daysRemaining);
	const severity = rule
		? maxSeverity(stockSeverity, rule.severity)
		: stockSeverity;
	return {
		item: entry.item,
		label: rule?.label ?? entry.item,
		severity,
		warning: rule?.warning ?? GENERIC_WARNING,
		matched: rule !== null,
		note: entry.note,
	};
}

/** Build warnings for a batch of entries. */
export function warningsFor(entries: ShortageEntry[]): ShortageWarning[] {
	return entries.map(warningFor);
}

/** Sort so the most severe warnings render first. */
export function sortBySeverity(warnings: ShortageWarning[]): ShortageWarning[] {
	return [...warnings].sort(
		(a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
	);
}
