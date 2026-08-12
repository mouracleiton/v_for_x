/**
 * V FOR X — Conflict-of-sources view (todo-098)
 *
 * When two reputable publishers disagree on the same metric for the same
 * place and period, that disagreement IS the story — hiding it behind a
 * single averaged number destroys trust. This module detects such conflicts
 * from a set of sourced figures and emits a structured comparison so a
 * dossier can render "publishers disagree" instead of a false consensus.
 *
 * Pure functions over `metric-meta`-shaped figures. No network, no averaging
 * that would erase the disagreement.
 */

export interface SourcedFigure {
	/** Canonical metric id (matches backbone key, e.g. "displacement"). */
	metric: string;
	/** ISO3 the figure is scoped to. */
	iso3: string;
	/** Year or period tag (e.g. 2024, "2024-Q3"). */
	period: string;
	/** Publisher name, e.g. "UNHCR", "IOM". */
	publisher: string;
	/** The figure value. */
	value: number;
	/** Unit (for display; not used in the diff math). */
	unit: string;
}

export type ConflictKind = "disagreement" | "approximate" | "consistent";

export interface SourceConflict {
	/** Shared identity: same metric + iso3 + period across publishers. */
	metric: string;
	iso3: string;
	period: string;
	unit: string;
	/** The distinct publishers involved. */
	publishers: string[];
	/** Their figures, in the order they appear. */
	figures: SourcedFigure[];
	/** Min and max values observed. */
	min: number;
	max: number;
	/** Relative spread: (max - min) / mean, 0..∞. */
	relativeSpread: number;
	/** Smallest signed pairwise difference (max publisher value − min publisher value). */
	delta: number;
	kind: ConflictKind;
	/** One-line human summary. */
	summary: string;
}

/** Relative spread above this ⇒ a real disagreement (not rounding noise). */
const DISAGREEMENT_THRESHOLD = 0.1;
/** Below this ⇒ consistent (within rounding). */
const CONSISTENT_THRESHOLD = 0.02;

/** Group figures by (metric, iso3, period) and find where publishers diverge. */
export function findConflicts(figures: SourcedFigure[]): SourceConflict[] {
	const groups = new Map<string, SourcedFigure[]>();
	for (const f of figures) {
		const key = `${f.metric}|${f.iso3}|${f.period}`;
		const arr = groups.get(key) ?? [];
		arr.push(f);
		groups.set(key, arr);
	}

	const out: SourceConflict[] = [];
	for (const arr of groups.values()) {
		// Need ≥ 2 distinct publishers to even have a conflict.
		const publisherSet = new Set(arr.map((f) => f.publisher));
		if (publisherSet.size < 2) continue;

		const values = arr.map((f) => f.value);
		const min = Math.min(...values);
		const max = Math.max(...values);
		const mean = values.reduce((a, b) => a + b, 0) / values.length;
		const relativeSpread =
			mean === 0
				? max - min === 0
					? 0
					: Infinity
				: (max - min) / Math.abs(mean);
		const delta = max - min;

		let kind: ConflictKind;
		if (
			relativeSpread === Infinity ||
			relativeSpread > DISAGREEMENT_THRESHOLD
		) {
			kind = "disagreement";
		} else if (relativeSpread <= CONSISTENT_THRESHOLD) {
			kind = "consistent";
		} else {
			kind = "approximate";
		}

		out.push({
			metric: arr[0].metric,
			iso3: arr[0].iso3,
			period: arr[0].period,
			unit: arr[0].unit,
			publishers: arr.map((f) => f.publisher),
			figures: arr,
			min,
			max,
			relativeSpread,
			delta,
			kind,
			summary: summaryFor(arr[0], min, max, kind, [...publisherSet]),
		});
	}
	return out;
}

function summaryFor(
	sample: SourcedFigure,
	min: number,
	max: number,
	kind: ConflictKind,
	publishers: string[],
): string {
	const who = publishers.slice().sort().join(" vs ");
	const spread =
		min === 0 && max === 0
			? "0"
			: `${min.toLocaleString()}–${max.toLocaleString()}`;
	const verdict =
		kind === "disagreement"
			? "disagree"
			: kind === "approximate"
				? "roughly agree"
				: "agree";
	return `${who} ${verdict} on ${sample.metric} (${sample.iso3}, ${sample.period}): ${spread} ${sample.unit}`;
}

/** Keep only real disagreements (drop consistent / approximate). */
export function onlyDisagreements(
	conflicts: SourceConflict[],
): SourceConflict[] {
	return conflicts.filter((c) => c.kind === "disagreement");
}

/** Worst spread first. */
export function sortBySpread(conflicts: SourceConflict[]): SourceConflict[] {
	return [...conflicts].sort((a, b) => b.relativeSpread - a.relativeSpread);
}
