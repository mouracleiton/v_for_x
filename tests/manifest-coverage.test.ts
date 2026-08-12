import { describe, it, expect } from "vitest";
import {
	packCoverage,
	coverageBadge,
	nextPriorityLang,
	PACK_PRIORITY_LANGS,
	type PackTranslations,
} from "../lib/manifest-coverage";
import type { CrisisManifest } from "../lib/vfxpack";

const manifest: CrisisManifest = {
	manifestVersion: 1,
	iso3: "SDN",
	crisis: "Sudan conflict",
	dataFiles: ["data/world_backbone.json"],
	dimensions: ["hunger", "conflict", "displacement"],
	generatedAt: 1700000000000,
};

describe("multilingual crisis-pack coverage meter", () => {
	it("PACK_PRIORITY_LANGS extends the hotspot set with uk + es", () => {
		expect(PACK_PRIORITY_LANGS).toEqual(
			expect.arrayContaining(["ar", "fa", "ur", "hi", "uk", "es"]),
		);
	});

	it("reports all-missing for an untranslated pack", () => {
		const r = packCoverage(manifest);
		expect(r.ratio).toBe(0);
		expect(r.complete).toBe(false);
		expect(r.present).toEqual([]);
		expect(r.missing.length).toBe(PACK_PRIORITY_LANGS.length);
		expect(coverageBadge(r)).toBe("RED");
	});

	it("counts explicit translations present", () => {
		const t: PackTranslations = {
			ar: { note: "ar note" },
			fa: { note: "fa note" },
			es: { note: "es note" },
		};
		const r = packCoverage(manifest, t);
		expect(r.present.sort()).toEqual(["ar", "es", "fa"]);
		expect(r.missing.length).toBe(PACK_PRIORITY_LANGS.length - 3);
		expect(r.ratio).toBeCloseTo(3 / PACK_PRIORITY_LANGS.length);
	});

	it("parses inline [xx] tags from the note as available langs", () => {
		const m: CrisisManifest = {
			...manifest,
			note: "Crisis note [es] nota [ar] ملاحظة [uk] примітка",
		};
		const r = packCoverage(m);
		expect(r.present.sort()).toEqual(["ar", "es", "uk"]);
	});

	it("complete when every priority lang is present", () => {
		const t: PackTranslations = Object.fromEntries(
			PACK_PRIORITY_LANGS.map((l) => [l, { note: `${l} note` }]),
		);
		const r = packCoverage(manifest, t);
		expect(r.complete).toBe(true);
		expect(r.ratio).toBe(1);
		expect(coverageBadge(r)).toBe("GREEN");
		expect(nextPriorityLang(r)).toBeNull();
	});

	it("badge is AMBER at partial coverage (>=0.5)", () => {
		const half = Math.ceil(PACK_PRIORITY_LANGS.length / 2);
		const t: PackTranslations = Object.fromEntries(
			PACK_PRIORITY_LANGS.slice(0, half).map((l) => [l, { note: l }]),
		);
		const r = packCoverage(manifest, t);
		expect(coverageBadge(r)).toBe("AMBER");
	});

	it("nextPriorityLang returns the first missing priority lang", () => {
		const t: PackTranslations = { ar: { note: "ar" } }; // only ar present
		const r = packCoverage(manifest, t);
		// PACK_PRIORITY_LANGS order is ar, fa, ur, hi, uk, es → first missing is fa.
		expect(nextPriorityLang(r)).toBe("fa");
	});

	it("meterLine renders the present-count + missing list", () => {
		const r = packCoverage(manifest); // all missing → 0/N
		expect(r.meterLine).toContain(`0/${PACK_PRIORITY_LANGS.length}`);
		expect(r.meterLine).toContain("missing");
	});
});
