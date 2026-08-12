/**
 * V FOR X — FOIA / Records-Request Generator (Phase 25 D)
 *
 * Fills static jurisdiction templates from the backbone (data/world_backbone.json)
 * into a ready-to-send records-request body. Grounded in public-records law
 * templates; NOT legal advice. Offline + local-only.
 *
 * Storage of generated requests is the operator's choice (they are public
 * records text, not secrets). This lib only renders + lists templates.
 */

export interface FoiaTemplate {
	id: string;
	jurisdiction: string;
	label: string;
	body: string;
	placeholders: string[];
	disclaimer?: string;
}

export interface FoiaRegistry {
	meta: {
		title: string;
		description: string;
		sources: string[];
		note: string;
		last_updated: string;
	};
	templates: FoiaTemplate[];
}

export interface FoiaRequest {
	/** Template id used. */
	templateId: string;
	/** Jurisdiction of the template. */
	jurisdiction: string;
	/** Filled request body. */
	body: string;
	/** Disclaimer attached. */
	disclaimer?: string;
	/** Values that filled the placeholders. */
	values: Record<string, string>;
}

/** Default registry mirror (data/foia-templates.json) for offline/no-fetch. */
export const DEFAULT_FOIA_REGISTRY: FoiaRegistry = {
	meta: {
		title: "FOIA / Records-Request Templates",
		description:
			"Static jurisdiction templates for records-request generators.",
		sources: ["curated from public records-request guides"],
		note: "Placeholders {{...}} filled from the backbone at render time.",
		last_updated: "2026-08-12",
	},
	templates: [
		{
			id: "generic",
			jurisdiction: "*",
			label: "Generic records request (fallback)",
			body: "I respectfully request access to public records pertaining to {{topic}} ({{iso3}}). If fees apply, please notify me before processing. Preferred format: electronic.",
			placeholders: ["topic", "iso3"],
			disclaimer: "Generic fallback — adapt to local public-records law.",
		},
	],
};

let cachedRegistry: FoiaRegistry | null = null;

/** Load templates from a parsed registry object (e.g. imported JSON). */
export function loadFoiaRegistry(raw: unknown): FoiaRegistry {
	if (
		raw &&
		typeof raw === "object" &&
		Array.isArray((raw as FoiaRegistry).templates)
	) {
		cachedRegistry = raw as FoiaRegistry;
		return cachedRegistry;
	}
	cachedRegistry = DEFAULT_FOIA_REGISTRY;
	return cachedRegistry;
}

/** Get the active registry (defaults to the bundled fallback). */
export function getFoiaRegistry(): FoiaRegistry {
	return cachedRegistry ?? DEFAULT_FOIA_REGISTRY;
}

/** Find a template by jurisdiction, falling back to the generic "*" one. */
export function pickTemplate(jurisdiction: string): FoiaTemplate {
	const reg = getFoiaRegistry();
	const norm = (jurisdiction ?? "").trim().toUpperCase();
	return (
		reg.templates.find((t) => t.jurisdiction.toUpperCase() === norm) ??
		reg.templates.find((t) => t.jurisdiction === "*") ??
		reg.templates[0]
	);
}

/** Fill a single {{placeholder}} in a template body. */
export function fillBody(body: string, values: Record<string, string>): string {
	return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
		const v = values[key];
		return v !== undefined && v !== null && v !== "" ? String(v) : match;
	});
}

/**
 * Generate a records request for a jurisdiction + topic from the backbone.
 * `values` must at least include the template's placeholders.
 */
export function generateFoiaRequest(
	jurisdiction: string,
	values: Record<string, string>,
): FoiaRequest {
	const template = pickTemplate(jurisdiction);
	return {
		templateId: template.id,
		jurisdiction: template.jurisdiction,
		body: fillBody(template.body, values),
		disclaimer: template.disclaimer,
		values,
	};
}

/** List available templates (for a chooser UI). */
export function listTemplates(): Array<{
	id: string;
	jurisdiction: string;
	label: string;
}> {
	return getFoiaRegistry().templates.map((t) => ({
		id: t.id,
		jurisdiction: t.jurisdiction,
		label: t.label,
	}));
}

/** True when every placeholder has a non-empty value. */
export function isComplete(
	values: Record<string, string>,
	placeholders: string[],
): boolean {
	return placeholders.every((p) => {
		const v = values[p];
		return v !== undefined && v !== null && String(v).trim() !== "";
	});
}
