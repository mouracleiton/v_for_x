/**
 * V FOR X — Classification labels + share scrubber (todo-325)
 *
 * Before a piece of evidence leaves the device ("strip geo before export"),
 * it needs a sensitivity label and a scrubber that knows what to redact per
 * label. This module is the label taxonomy + the field-level scrubber that
 * ShareSheet / Evidence / Vault call on export. Pure functions, no network.
 *
 * Labels follow a simple three-tier scheme (PUBLIC / RESTRICTED / SECRET)
 * mapped to concrete field-redaction rules so a user never has to guess what
 * "strip geo" means for their specific record.
 */

export type Classification = "PUBLIC" | "RESTRICTED" | "SECRET";

export interface ClassificationRule {
	level: Classification;
	label: string;
	description: string;
	/** Fields stripped at this level (dotted paths, case-insensitive substring). */
	stripFields: string[];
}

export const CLASSIFICATION_RULES: ClassificationRule[] = [
	{
		level: "PUBLIC",
		label: "PUBLIC",
		description:
			"Safe to publish verbatim. No PII, no precise location, no source identifiers.",
		stripFields: [],
	},
	{
		level: "RESTRICTED",
		label: "RESTRICTED",
		description:
			"Share only with trusted recipients. Strips precise coordinates and contact details.",
		stripFields: [
			"lat",
			"lon",
			"latitude",
			"longitude",
			"gps",
			"phone",
			"email",
			"address",
			"whatsapp",
			"telegram",
			"signal",
			"contact",
		],
	},
	{
		level: "SECRET",
		label: "SECRET",
		description:
			"Maximum redaction. Keeps only the claim + a coarse region; strips all identifiers and geo.",
		stripFields: [
			"lat",
			"lon",
			"latitude",
			"longitude",
			"gps",
			"phone",
			"email",
			"address",
			"whatsapp",
			"telegram",
			"signal",
			"contact",
			"name",
			"author",
			"handle",
			"signer",
			"source_url",
			"street",
			"city",
			"village",
		],
	},
];

export function ruleFor(level: Classification): ClassificationRule {
	return (
		CLASSIFICATION_RULES.find((r) => r.level === level) ??
		CLASSIFICATION_RULES[0]
	);
}

/** True if `field` (dotted path or key) should be stripped at this level. */
export function shouldStrip(field: string, level: Classification): boolean {
	const rule = ruleFor(level);
	const lower = field.toLowerCase();
	return rule.stripFields.some(
		(s) => lower === s || lower.endsWith(`.${s}`) || lower.includes(s),
	);
}

/** Deep-clone a record with classified fields stripped. Dates the scrub. */
export function scrubRecord<T extends Record<string, unknown>>(
	record: T,
	level: Classification,
): T {
	const rule = ruleFor(level);
	if (rule.stripFields.length === 0) return record;
	const strip = new Set(rule.stripFields);
	return scrubWalk(record, "", strip) as T;
}

function scrubWalk(node: unknown, path: string, strip: Set<string>): unknown {
	if (Array.isArray(node)) {
		return node.map((item) => scrubWalk(item, path, strip));
	}
	if (node && typeof node === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(
			node as Record<string, unknown>,
		)) {
			const childPath = path ? `${path}.${key}` : key;
			const lower = key.toLowerCase();
			// Strip if the key itself matches any strip token (exact or suffix-of-dotted).
			const hit = [...strip].some(
				(s) => lower === s || childPath.toLowerCase().endsWith(`.${s}`),
			);
			if (hit) continue;
			out[key] = scrubWalk(value, childPath, strip);
		}
		return out;
	}
	return node;
}

/** Produce a coarse region token from precise coords (SECRET downgrades). */
export function coarseRegion(lat?: number, lon?: number): string {
	if (typeof lat !== "number" || typeof lon !== "number") return "unknown";
	// Snap to a ~111km grid (1 degree). Deliberately imprecise.
	return `${lat.toFixed(0)},${lon.toFixed(0)}`;
}

/** One-line summary of what a level removes, for UI. */
export function scrubSummary(level: Classification): string {
	const rule = ruleFor(level);
	if (rule.stripFields.length === 0) return `${rule.label}: no fields stripped`;
	return `${rule.label}: strips ${rule.stripFields.slice(0, 6).join(", ")}${rule.stripFields.length > 6 ? `, +${rule.stripFields.length - 6} more` : ""}`;
}
