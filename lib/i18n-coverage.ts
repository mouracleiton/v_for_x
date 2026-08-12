/**
 * V FOR X — i18n coverage meter (Translation Swarm Kit, todo-055)
 *
 * Walks the live translation dictionaries and reports per-key × per-language
 * coverage. Hotspot languages (ar/fa/ur/hi) are prioritized so a translator
 * swarm can focus on the strings that matter most for at-risk audiences.
 *
 * Static / offline / zero deps. Reads only in-repo dictionaries passed in —
 * it never imports them itself, so tests can feed fixtures.
 */

import type { Lang } from "./i18n";
import { LANGS } from "./i18n";

/** Languages spoken in the highest-risk current hotspots. */
export const PRIORITY_LANGS: Lang[] = ["ar", "fa", "ur", "hi"];

/** A flat translation table: key -> Partial<Record<Lang,string>>. */
export type FlatDict = Record<string, Partial<Record<Lang, string>>>;

/** A per-language table: Record<Lang, Record<string,string>>. */
export type PerLangDict = Record<Lang, Record<string, string>>;

export interface LangCoverage {
	lang: Lang;
	/** 0..1 fraction of keys present for this language. */
	ratio: number;
	present: number;
	missing: number;
	missingKeys: string[];
}

export interface CoverageReport {
	totalKeys: number;
	byLang: LangCoverage[];
	/** Languages below this ratio are surfaced first (priority sort). */
	priorityGaps: LangCoverage[];
	/** Overall coverage ratio across all langs × all keys. */
	overallRatio: number;
}

/**
 * Merge a flat dict (CONTENT_T style) with optional per-lang dicts
 * (NAV_T / SECTION_DESC style) into a single flat key→lang→value map.
 */
export function flattenDicts(
	flat?: FlatDict,
	perLang?: Partial<PerLangDict>,
): FlatDict {
	const out: FlatDict = { ...(flat ?? {}) };
	if (perLang) {
		for (const [langStr, table] of Object.entries(perLang)) {
			const lang = langStr as Lang;
			if (!table) continue;
			for (const [key, value] of Object.entries(table)) {
				if (!out[key]) out[key] = {};
				out[key][lang] = value;
			}
		}
	}
	return out;
}

function isPresent(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

/**
 * Compute coverage for every supported language.
 * `en` is treated as the source-of-truth: keys only present in `en`
 * (and missing everywhere else) still count toward the denominator.
 */
export function coverage(dict: FlatDict): CoverageReport {
	const keys = Object.keys(dict);
	const totalKeys = keys.length;
	const byLang: LangCoverage[] = LANGS.map((l) => {
		const missingKeys: string[] = [];
		let present = 0;
		for (const key of keys) {
			if (isPresent(dict[key]?.[l.id])) {
				present++;
			} else {
				missingKeys.push(key);
			}
		}
		const ratio = totalKeys === 0 ? 1 : present / totalKeys;
		return {
			lang: l.id,
			ratio,
			present,
			missing: missingKeys.length,
			missingKeys,
		};
	});

	const overallRatio =
		byLang.length === 0 || totalKeys === 0
			? 1
			: byLang.reduce((acc, l) => acc + l.ratio, 0) / byLang.length;

	// Priority gaps: hotspot languages first, then worst coverage, then alpha.
	const priorityGaps = [...byLang].sort((a, b) => {
		const aPri = PRIORITY_LANGS.includes(a.lang) ? 0 : 1;
		const bPri = PRIORITY_LANGS.includes(b.lang) ? 0 : 1;
		if (aPri !== bPri) return aPri - bPri;
		if (a.ratio !== b.ratio) return a.ratio - b.ratio;
		return a.lang.localeCompare(b.lang);
	});

	return { totalKeys, byLang, priorityGaps, overallRatio };
}

/** A one-line human summary, e.g. "ar 42% · fa 38% · ur 51% · hi 60% · overall 71%". */
export function summaryLine(report: CoverageReport): string {
	const focus = report.priorityGaps.slice(0, PRIORITY_LANGS.length);
	const parts = focus.map((l) => `${l.lang} ${Math.round(l.ratio * 100)}%`);
	parts.push(`overall ${Math.round(report.overallRatio * 100)}%`);
	return parts.join(" · ");
}

/** Return the N worst-covered priority keys for a given language. */
export function topMissingKeys(
	report: CoverageReport,
	lang: Lang,
	limit = 20,
): string[] {
	const entry = report.byLang.find((l) => l.lang === lang);
	return entry ? entry.missingKeys.slice(0, limit) : [];
}
