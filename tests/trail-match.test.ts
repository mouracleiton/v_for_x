import { describe, it, expect } from "vitest";
import {
	haversineKm,
	normalizeTags,
	tagIntersection,
	geoScore,
	scorePair,
	matchAll,
	summarizeMatch,
	type TrailEntry,
} from "../lib/trail-match";

const BASE = {
	category: "water",
	item: "bottled water",
	iso3: "SDN",
	ts: 1000,
};
const need = (over: Partial<TrailEntry> = {}): TrailEntry => ({
	id: "n1",
	type: "need",
	...BASE,
	tags: ["filter", "urgent"],
	lat: 15.5,
	lon: 32.5,
	...over,
});
const offer = (over: Partial<TrailEntry> = {}): TrailEntry => ({
	id: "o1",
	type: "offer",
	...BASE,
	tags: ["filter"],
	lat: 15.51,
	lon: 32.49,
	...over,
});

describe("trail-match", () => {
	it("haversineKm: 0 for identical points, ~111km per degree", () => {
		expect(haversineKm(15.5, 32.5, 15.5, 32.5)).toBeCloseTo(0, 5);
		const d = haversineKm(0, 0, 0, 1);
		expect(d).toBeGreaterThan(100);
		expect(d).toBeLessThan(120);
	});

	it("haversineKm returns 0 for non-finite coords (no NaN)", () => {
		expect(haversineKm(NaN, 0, 0, 0)).toBe(0);
	});

	it("normalizeTags lowercases, trims, dedupes", () => {
		expect(normalizeTags(["Filter", " FILTER ", "filter", "", "  "])).toEqual([
			"filter",
		]);
		expect(normalizeTags(undefined)).toEqual([]);
	});

	it("tagIntersection is order-insensitive + normalized", () => {
		expect(tagIntersection(["A", "b"], ["B", "a"]).sort()).toEqual(["a", "b"]);
		expect(tagIntersection(["x"], ["y"])).toEqual([]);
	});

	it("geoScore: 1.0 coincident, decays to 0 at maxKm, null without coords", () => {
		expect(geoScore(need(), offer(), 50)).toBeGreaterThan(0.9);
		expect(geoScore(need(), offer({ lat: 16, lon: 33 }), 50)).toBeLessThan(0.5);
		expect(
			geoScore(need({ lat: undefined, lon: undefined }), offer(), 50),
		).toBeNull();
	});

	it("scorePair returns null for type mismatch (need↔need)", () => {
		expect(scorePair(need(), need() as never)).toBeNull();
	});

	it("scorePair blends category + tag + geo into 0..1", () => {
		const m = scorePair(need(), offer());
		expect(m).not.toBeNull();
		expect(m!.score).toBeGreaterThan(0);
		expect(m!.score).toBeLessThanOrEqual(1);
	});

	it("matchAll takes a single entries array + opts; ranks best offer per need", () => {
		const entries = [
			need(),
			offer({ id: "best" }),
			offer({ id: "far", lat: 20, lon: 40 }),
		];
		const matches = matchAll(entries, { minScore: 0 });
		expect(matches.length).toBeGreaterThan(0);
		const top = [...matches].sort((a, b) => b.score - a.score)[0];
		expect(top.offer.id).toBe("best");
	});

	it("summarizeMatch renders a non-empty line", () => {
		const m = scorePair(need(), offer())!;
		expect(summarizeMatch(m).length).toBeGreaterThan(0);
	});
});
