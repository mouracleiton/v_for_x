import { describe, it, expect } from "vitest";
import {
	coverage,
	flattenDicts,
	summaryLine,
	topMissingKeys,
	PRIORITY_LANGS,
	type FlatDict,
	type PerLangDict,
} from "../lib/i18n-coverage";

const dict: FlatDict = {
	"a.one": { en: "one", es: "uno", ar: "واحد" },
	"a.two": { en: "two", es: "dos", fa: "دو" },
	"a.three": { en: "three" }, // en-only key → everyone else misses it
};

describe("i18n coverage meter", () => {
	it("counts present/missing per language with en as baseline denominator", () => {
		const r = coverage(dict);
		expect(r.totalKeys).toBe(3);
		const es = r.byLang.find((l) => l.lang === "es")!;
		expect(es.present).toBe(2);
		expect(es.missing).toBe(1);
		expect(es.ratio).toBeCloseTo(2 / 3);
	});

	it("flags en as fully covered when all keys have en", () => {
		const r = coverage(dict);
		const en = r.byLang.find((l) => l.lang === "en")!;
		expect(en.ratio).toBe(1);
		expect(en.missingKeys).toEqual([]);
	});

	it("prioritizes hotspot languages (ar/fa/ur/hi) ahead of others by ratio", () => {
		const r = coverage(dict);
		// ar has 1/3, fa has 1/3 — both priority. es (2/3) is not priority.
		const firstFourLangs = r.priorityGaps
			.slice(0, PRIORITY_LANGS.length)
			.map((l) => l.lang);
		expect(firstFourLangs.sort()).toEqual([...PRIORITY_LANGS].sort());
	});

	it("overallRatio is the mean of per-lang ratios", () => {
		const r = coverage(dict);
		const mean = r.byLang.reduce((a, l) => a + l.ratio, 0) / r.byLang.length;
		expect(r.overallRatio).toBeCloseTo(mean);
	});

	it("summaryLine includes the four hotspot langs + overall", () => {
		const line = summaryLine(coverage(dict));
		for (const lang of PRIORITY_LANGS) expect(line).toContain(`${lang} `);
		expect(line).toContain("overall");
	});

	it("topMissingKeys returns the priority-language gaps", () => {
		const r = coverage(dict);
		const missing = topMissingKeys(r, "ur", 10);
		expect(missing).toContain("a.one");
		expect(missing).toContain("a.two");
		expect(missing).toContain("a.three");
	});

	it("flattenDicts merges a flat dict with a per-lang Record<Lang,Record<string,string>>", () => {
		const perLang: Partial<PerLangDict> = {
			en: { "nav.x": "X" },
			ar: { "nav.x": "كس" },
		};
		const flat = flattenDicts(undefined, perLang);
		expect(flat["nav.x"].en).toBe("X");
		expect(flat["nav.x"].ar).toBe("كس");
	});

	it("handles empty dict without dividing by zero", () => {
		const r = coverage({});
		expect(r.totalKeys).toBe(0);
		expect(r.overallRatio).toBe(1);
		expect(r.byLang.every((l) => l.ratio === 1)).toBe(true);
	});

	it("treats empty-string values as missing (whitespace-only)", () => {
		const d: FlatDict = { "k.x": { en: "  ", es: "x" } };
		const r = coverage(d);
		expect(r.byLang.find((l) => l.lang === "en")!.present).toBe(0);
		expect(r.byLang.find((l) => l.lang === "es")!.present).toBe(1);
	});
});
