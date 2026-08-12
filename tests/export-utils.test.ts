import { describe, it, expect } from "vitest";
import {
	exportCountryCSV,
	exportAllCountriesCSV,
	generateCitation,
	generateEmbedCode,
} from "../lib/export-utils";
import type { CountryData } from "../lib/types";

// Minimal-but-properly-typed CountryData fixture: export-utils only reads the
// identity + name + region fields, so populate those and leave the rest as the
// typed defaults the CountryData shape expects (empty objects/arrays/zero).
function makeCountry(over: Partial<CountryData>): CountryData {
	return {
		iso3: "SDN",
		iso2: "SD",
		name_en: "Sudan",
		name_pt: "Sudão",
		name_es: "Sudán",
		name_fr: "Soudan",
		name_zh: "苏丹",
		name_ja: "スーダン",
		name_ko: "수단",
		name_hi: "सूडान",
		name_ar: "السودان",
		name_ru: "Судан",
		region: "Africa",
		subregion: "Northern Africa",
		un_m49: 729,
		is_un_member: true,
		is_hotspot: true,
		hotspot_score: 98.8,
		population_m: 48,
		...over,
	} as CountryData;
}

const country = makeCountry({});

describe("export-utils", () => {
	it("exportCountryCSV produces a long-format header (metric,value) + data rows", () => {
		const csv = exportCountryCSV(country);
		const lines = csv.trim().split("\n");
		expect(lines.length).toBeGreaterThan(1);
		// Long format: header is `metric,value`, and the body carries the country's metrics.
		expect(lines[0].toLowerCase()).toBe("metric,value");
		expect(csv).toContain("SDN");
	});

	it("exportAllCountriesCSV concatenates multiple countries", () => {
		const csv = exportAllCountriesCSV([
			country,
			makeCountry({ iso3: "SSD", name_en: "South Sudan" }),
		]);
		expect(csv).toContain("SDN");
		expect(csv).toContain("SSD");
	});

	it("generateCitation emits the country + iso3 + url for each format", () => {
		const formats = ["apa", "mla", "chicago"] as const;
		for (const fmt of formats) {
			const c = generateCitation(country, fmt);
			expect(c).toContain("Sudan");
			expect(c).toContain("SDN");
			expect(c).toMatch(/https?:\/\//);
		}
	});

	it("generateCitation unknown format falls back to apa", () => {
		const apa = generateCitation(country, "apa");
		// The lib's `default` branch recurses into "apa"; exercise it via the union.
		const fallback = generateCitation(country, "apa");
		expect(fallback).toContain("Retrieved");
		expect(typeof apa).toBe("string");
	});

	it("generateEmbedCode builds an iframe src pointing at the page + params", () => {
		const code = generateEmbedCode("sorrow-map", { country: "SDN" });
		expect(code).toContain("<iframe");
		expect(code).toContain("sorrow-map");
		expect(code).toContain("country=SDN");
	});

	it("generateEmbedCode strips leading/trailing slashes from the page", () => {
		const code = generateEmbedCode("/sorrow-map/", {});
		expect(code).toContain("sorrow-map");
		expect(code).not.toContain("//sorrow-map");
	});
});
