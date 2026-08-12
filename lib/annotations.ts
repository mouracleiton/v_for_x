/**
 * V FOR X — User annotations (todo-097)
 *
 * A reader annotating a dossier or a spot on the map — "I verified this
 * locally", "this figure looks stale", a private contact note — is the most
 * personal data in the tool. It must be:
 *   - local-only (never leaves the device by default),
 *   - exportable (into VFXPACK1 so the reader can carry or share it), and
 *   - panic-wipe aware (registered so panic wipe clears it, duress decoy
 *     drops it).
 *
 * Storage key: `vfx-annotations` (registered in lib/storage-map.ts).
 * Pure functions over an in-memory map; the page owns load/save.
 */

/** Where the annotation is pinned. */
export type AnnotationTarget =
	| { kind: "dossier"; id: string }
	| { kind: "map"; iso3: string; lat: number; lon: number }
	| { kind: "metric"; iso3: string; metric: string };

export type AnnotationTone = "note" | "verify" | "dispute" | "corroborate";

export interface Annotation {
	/** Stable id (callers generate via newAnnotationId). */
	id: string;
	target: AnnotationTarget;
	/** Free-text body, max 2000 chars. */
	body: string;
	tone: AnnotationTone;
	/** Epoch ms. */
	ts: number;
	/** Optional author handle (VFXID1) for export provenance. */
	author?: string;
}

export const STORAGE_KEY = "vfx-annotations";
export const MAX_BODY = 2000;

/** Generate a collision-resistant id without crypto.randomUUID dependency. */
export function newAnnotationId(): string {
	const r =
		typeof crypto !== "undefined" && "randomUUID" in crypto
			? crypto.randomUUID()
			: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
	return `ann-${r}`;
}

/** Validate + clip a raw annotation body into a safe stored value. */
export function normalizeBody(raw: string): string {
	const trimmed = (raw ?? "").replace(/\s+/g, " ").trim();
	if (trimmed.length <= MAX_BODY) return trimmed;
	return trimmed.slice(0, MAX_BODY - 1) + "…";
}

/** Build an annotation (normalizes body + assigns id/ts). Never throws. */
export function createAnnotation(
	target: AnnotationTarget,
	body: string,
	opts: {
		tone?: AnnotationTone;
		author?: string;
		ts?: number;
		id?: string;
	} = {},
): Annotation {
	return {
		id: opts.id ?? newAnnotationId(),
		target,
		body: normalizeBody(body),
		tone: opts.tone ?? "note",
		ts: opts.ts ?? Date.now(),
		author: opts.author,
	};
}

/** In-memory annotation store (a serialized map keyed by id). */
export type AnnotationStore = Record<string, Annotation>;

/** Load the store from localStorage; never throws (returns {} on any error). */
export function loadAnnotations(): AnnotationStore {
	if (typeof localStorage === "undefined") return {};
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as AnnotationStore;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
			return {};
		return parsed;
	} catch {
		return {};
	}
}

/** Persist the store. Returns false on failure (quota/disabled). Never throws. */
export function saveAnnotations(store: AnnotationStore): boolean {
	if (typeof localStorage === "undefined") return false;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
		return true;
	} catch {
		return false;
	}
}

/** Upsert a single annotation into the store (returns a NEW store). */
export function upsertAnnotation(
	store: AnnotationStore,
	ann: Annotation,
): AnnotationStore {
	return { ...store, [ann.id]: ann };
}

/** Remove an annotation by id (returns a NEW store). */
export function removeAnnotation(
	store: AnnotationStore,
	id: string,
): AnnotationStore {
	const next = { ...store };
	delete next[id];
	return next;
}

/** Filter by target kind / id / iso3 / metric. */
export function annotationsFor(
	store: AnnotationStore,
	filter: { kind?: string; iso3?: string; id?: string; metric?: string },
): Annotation[] {
	const list = Object.values(store);
	return list
		.filter((a) => {
			if (filter.kind && a.target.kind !== filter.kind) return false;
			if (filter.id) {
				// Only dossier targets carry a free-form id.
				if (a.target.kind !== "dossier" || a.target.id !== filter.id)
					return false;
			}
			if (filter.iso3) {
				// Only map + metric targets carry an iso3; dossier annotations have none,
				// so an iso3 filter excludes them.
				if (a.target.kind === "dossier") return false;
				if (a.target.iso3 !== filter.iso3) return false;
			}
			if (filter.metric) {
				if (a.target.kind !== "metric" || a.target.metric !== filter.metric)
					return false;
			}
			return true;
		})
		.sort((a, b) => b.ts - a.ts);
}

/** Export an array of annotations as a JSON token suitable for VFXPACK1. */
export function exportAnnotations(
	store: AnnotationStore,
	ids?: string[],
): string {
	const list = ids
		? ids.map((id) => store[id]).filter(Boolean)
		: Object.values(store);
	return JSON.stringify({ type: "vfx-annotations", version: 1, items: list });
}

/** Import an exported token back into a store (merge by id; returns NEW store). */
export function importAnnotations(
	token: string,
	into: AnnotationStore,
): {
	store: AnnotationStore;
	imported: number;
} {
	let parsed: { items?: unknown };
	try {
		parsed = JSON.parse(token);
	} catch {
		return { store: into, imported: 0 };
	}
	const items = Array.isArray(parsed.items) ? parsed.items : [];
	let imported = 0;
	const next = { ...into };
	for (const item of items) {
		if (!item || typeof item !== "object") continue;
		const a = item as Partial<Annotation>;
		if (!a.id || !a.target || typeof a.body !== "string") continue;
		next[a.id] = a as Annotation;
		imported++;
	}
	return { store: next, imported };
}
