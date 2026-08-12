/**
 * V FOR X — Multilingual crisis-pack coverage meter (todo-417)
 *
 * "Multilingual crisis packs prioritized ar/fa/ur/hi/uk/es with coverage meter
 * on every pack."
 *
 * A crisis pack (VFXPACK1 kind=manifest) is only as useful as the languages its
 * embedded note + referenced data files cover. This module reads a
 * CrisisManifest and reports translation coverage across the priority
 * hotspot languages, plus an overall ratio + a one-line "coverage meter"
 * string suitable for rendering on every pack.
 *
 * Reuses PRIORITY_LANGS from lib/i18n-coverage.ts so the meter and the
 * i18n-coverage kit agree on what "priority" means.
 */

import { PRIORITY_LANGS } from "./i18n-coverage";
import type { Lang } from "./i18n";
import type { CrisisManifest } from "./vfxpack";

/** Crisis-pack priority languages: the hotspot set plus Ukrainian + Spanish. */
export type PackLang = Lang | "uk";
export const PACK_PRIORITY_LANGS: PackLang[] = [...PRIORITY_LANGS, "uk", "es"];

/** A translation entry a pack author attaches to a manifest's note. */
export interface PackTranslations {
	/** Maps a lang code to the localized crisis note (and optional title). */
	[lang: string]: { note?: string; title?: string };
}

export interface LangPackCoverage {
	lang: PackLang;
	present: boolean;
}

export interface PackCoverageReport {
	/** 0..1 fraction of PACK_PRIORITY_LANGS present. */
	ratio: number;
	present: PackLang[];
	missing: PackLang[];
	perLang: LangPackCoverage[];
	/** "5/8 priority langs (ar fa ur hi uk · missing es)" */
	meterLine: string;
	/** True when every priority lang is present. */
	complete: boolean;
}

/**
 * Compute coverage for a pack. Translations may be carried two ways:
 *   1. Explicit `translations` map (preferred).
 *   2. Fallback: parse the manifest `note` for inline lang tags like
 *      "[es] Nota" / "[ar] ملاحظة" (loose, best-effort).
 */
export function packCoverage(
	manifest: CrisisManifest,
	translations?: PackTranslations,
): PackCoverageReport {
	const available = collectAvailableLangs(manifest, translations);
	const present: PackLang[] = [];
	const missing: PackLang[] = [];
	const perLang: LangPackCoverage[] = PACK_PRIORITY_LANGS.map((lang) => {
		const isPresent = available.has(lang);
		if (isPresent) present.push(lang);
		else missing.push(lang);
		return { lang, present: isPresent };
	});

	const ratio =
		PACK_PRIORITY_LANGS.length === 0
			? 1
			: present.length / PACK_PRIORITY_LANGS.length;
	const complete = missing.length === 0;
	const meterLine = renderMeter(present, missing);
	return { ratio, present, missing, perLang, meterLine, complete };
}

function collectAvailableLangs(
	manifest: CrisisManifest,
	translations?: PackTranslations,
): Set<string> {
	const out = new Set<string>();
	if (translations) {
		for (const lang of Object.keys(translations)) out.add(lang.toLowerCase());
	}
	// Loose note-tag scan: "[es] ...", "[ar] ...".
	const note = manifest.note ?? "";
	const tagRe = /\[([a-z]{2})\]/gi;
	for (const m of note.matchAll(tagRe)) out.add(m[1].toLowerCase());
	return out;
}

function renderMeter(present: PackLang[], missing: PackLang[]): string {
	if (missing.length === 0) {
		return `${present.length}/${PACK_PRIORITY_LANGS.length} priority langs (complete)`;
	}
	const pres = present.length > 0 ? `${present.join(" ")} · ` : "";
	return `${present.length}/${PACK_PRIORITY_LANGS.length} priority langs (${pres}missing ${missing.join(" ")})`;
}

/** Human verdict for a badge: GREEN / AMBER / RED by ratio band. */
export function coverageBadge(
	report: PackCoverageReport,
): "GREEN" | "AMBER" | "RED" {
	if (report.ratio >= 1) return "GREEN";
	if (report.ratio >= 0.5) return "AMBER";
	return "RED";
}

/** Suggest the single highest-impact missing language to add next. */
export function nextPriorityLang(report: PackCoverageReport): PackLang | null {
	// PRIORITY_LANGS order is the hotspot priority; pick the first missing one.
	for (const lang of PACK_PRIORITY_LANGS) {
		if (report.missing.includes(lang)) return lang;
	}
	return null;
}
