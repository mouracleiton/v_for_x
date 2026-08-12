import { describe, it, expect } from "vitest";
import {
	langToHreflang,
	ogLocale,
	canonicalUrl,
	getHreflangAlternates,
} from "../lib/hreflang";
import type { Lang } from "../lib/i18n";
import { LANGS } from "../lib/i18n";

describe("hreflang + multilingual SEO helpers", () => {
	it("langToHreflang maps every supported language to a non-empty code", () => {
		for (const l of LANGS) {
			const h = langToHreflang(l.id);
			expect(h.length).toBeGreaterThan(0);
		}
	});

	it("langToHreflang uses region variants where they matter", () => {
		expect(langToHreflang("pt" as Lang)).toBe("pt-BR");
		expect(langToHreflang("zh" as Lang)).toBe("zh-CN");
		expect(langToHreflang("ar" as Lang)).toBe("ar-SA");
		expect(langToHreflang("en" as Lang)).toBe("en");
	});

	it("ogLocale uses the Open Graph underscore format", () => {
		expect(ogLocale("en" as Lang)).toBe("en_US");
		expect(ogLocale("pt" as Lang)).toBe("pt_BR");
		expect(ogLocale("fa" as Lang)).toBe("fa_IR");
	});

	it("canonicalUrl normalizes a leading slash", () => {
		const withSlash = canonicalUrl("/the-briefing");
		const without = canonicalUrl("the-briefing");
		expect(withSlash).toBe(without);
		expect(withSlash).toContain("/the-briefing");
	});

	it("getHreflangAlternates returns an entry per supported language plus x-default", () => {
		const alts = getHreflangAlternates("/the-briefing");
		// One per supported language (12) + an x-default catch-all → 13.
		expect(alts.length).toBe(LANGS.length + 1);
		for (const a of alts) {
			expect(a.hreflang.length).toBeGreaterThan(0);
			expect(a.href).toContain("/the-briefing");
		}
	});

	it("ogLocale + langToHreflang agree on language stem", () => {
		for (const l of LANGS) {
			const h = langToHreflang(l.id).split("-")[0];
			const og = ogLocale(l.id).split("_")[0];
			expect(h).toBe(og);
		}
	});
});
