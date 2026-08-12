import { describe, it, expect, beforeEach } from "vitest";
import {
	createAnnotation,
	normalizeBody,
	upsertAnnotation,
	removeAnnotation,
	annotationsFor,
	exportAnnotations,
	importAnnotations,
	loadAnnotations,
	saveAnnotations,
	newAnnotationId,
	MAX_BODY,
	type AnnotationStore,
	type AnnotationTarget,
} from "../lib/annotations";

// jsdom localStorage is provided by tests/setup.ts
const ls = (() => {
	try {
		return typeof localStorage !== "undefined" ? localStorage : null;
	} catch {
		return null;
	}
})();

beforeEach(() => {
	ls?.clear();
});

const dossierTarget: AnnotationTarget = { kind: "dossier", id: "SDN-military" };
const mapTarget: AnnotationTarget = {
	kind: "map",
	iso3: "SDN",
	lat: 15.5,
	lon: 32.5,
};
const metricTarget: AnnotationTarget = {
	kind: "metric",
	iso3: "SDN",
	metric: "displacement",
};

describe("user annotations", () => {
	it("newAnnotationId is unique and prefixed", () => {
		const a = newAnnotationId();
		const b = newAnnotationId();
		expect(a.startsWith("ann-")).toBe(true);
		expect(a).not.toBe(b);
	});

	it("normalizeBody clips to MAX_BODY and collapses whitespace", () => {
		const long = "a".repeat(MAX_BODY + 500);
		const out = normalizeBody(long);
		expect(out.length).toBeLessThanOrEqual(MAX_BODY);
		expect(out.endsWith("…")).toBe(true);
		expect(normalizeBody("  foo   bar  ")).toBe("foo bar");
	});

	it("createAnnotation assigns id/ts and normalizes body", () => {
		const a = createAnnotation(dossierTarget, "verified locally", {
			tone: "verify",
		});
		expect(a.id).toBeTruthy();
		expect(a.ts).toBeGreaterThan(0);
		expect(a.tone).toBe("verify");
		expect(a.body).toBe("verified locally");
	});

	it("upsert + remove return new stores (immutable)", () => {
		const empty: AnnotationStore = {};
		const a = createAnnotation(dossierTarget, "x");
		const s1 = upsertAnnotation(empty, a);
		expect(s1).not.toBe(empty);
		expect(Object.keys(s1)).toHaveLength(1);
		const s2 = removeAnnotation(s1, a.id);
		expect(Object.keys(s2)).toHaveLength(0);
	});

	it("annotationsFor filters by kind, iso3, id, metric", () => {
		const store: AnnotationStore = {
			a: createAnnotation(dossierTarget, "d1", { id: "a" }),
			b: createAnnotation(mapTarget, "m1", { id: "b" }),
			c: createAnnotation(metricTarget, "m2", { id: "c" }),
		};
		expect(annotationsFor(store, { kind: "dossier" })).toHaveLength(1);
		expect(annotationsFor(store, { kind: "map", iso3: "SDN" })).toHaveLength(1);
		expect(
			annotationsFor(store, {
				kind: "metric",
				iso3: "SDN",
				metric: "displacement",
			}),
		).toHaveLength(1);
		expect(annotationsFor(store, { iso3: "XXX" })).toHaveLength(0);
		expect(annotationsFor(store, { id: "SDN-military" })).toHaveLength(1);
	});

	it("exportAnnotations serializes to a vfx-annotations JSON token", () => {
		const store: AnnotationStore = {
			a: createAnnotation(dossierTarget, "x", { id: "a" }),
		};
		const token = exportAnnotations(store);
		expect(token).toContain("vfx-annotations");
		expect(token).toContain('"id":"a"');
	});

	it("exportAnnotations respects an explicit id list", () => {
		const store: AnnotationStore = {
			a: createAnnotation(dossierTarget, "x", { id: "a" }),
			b: createAnnotation(dossierTarget, "y", { id: "b" }),
		};
		const token = JSON.parse(exportAnnotations(store, ["a"])) as {
			items: unknown[];
		};
		expect(token.items).toHaveLength(1);
	});

	it("importAnnotations merges by id and counts imports", () => {
		const token = exportAnnotations({
			a: createAnnotation(dossierTarget, "imported", { id: "a" }),
		});
		const existing: AnnotationStore = {
			b: createAnnotation(dossierTarget, "existing", { id: "b" }),
		};
		const { store, imported } = importAnnotations(token, existing);
		expect(imported).toBe(1);
		expect(store.a.body).toBe("imported");
		expect(store.b.body).toBe("existing"); // preserved
	});

	it("importAnnotations returns 0 on malformed token (no throw)", () => {
		const { store, imported } = importAnnotations("not json", {});
		expect(imported).toBe(0);
		expect(Object.keys(store)).toHaveLength(0);
	});

	it("importAnnotations skips items missing required fields", () => {
		const malformed = JSON.stringify({
			type: "vfx-annotations",
			version: 1,
			items: [{ id: "x" }, { body: "no target" }, "string", null],
		});
		const { store, imported } = importAnnotations(malformed, {});
		expect(imported).toBe(0);
		expect(Object.keys(store)).toHaveLength(0);
	});

	it("loadAnnotations returns {} on missing/corrupt key", () => {
		expect(loadAnnotations()).toEqual({});
		ls?.setItem("vfx-annotations", "not json");
		expect(loadAnnotations()).toEqual({});
		ls?.setItem("vfx-annotations", JSON.stringify([]));
		expect(loadAnnotations()).toEqual({}); // array is not a valid store
	});

	it("saveAnnotations + loadAnnotations round-trip", () => {
		const store: AnnotationStore = {
			a: createAnnotation(dossierTarget, "round trip", { id: "a" }),
		};
		expect(saveAnnotations(store)).toBe(true);
		const loaded = loadAnnotations();
		expect(loaded.a.body).toBe("round trip");
	});
});
