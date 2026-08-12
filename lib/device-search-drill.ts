/**
 * V FOR X — Device-Search Drill (Phase 25 F)
 *
 * "Device search in 60s": a timed wipe + decoy quality score. The operator
 * rehearses the panic-wipe path under time pressure; the drill scores how much
 * sensitive data was actually wiped and how plausible the decoy state is.
 *
 * Offline + local-only: no phone-home. The score is a self-assessment aid.
 */

export interface DrillResult {
	/** Drill duration budget (ms). */
	budgetMs: number;
	/** Actual elapsed (ms). */
	elapsedMs: number;
	/** True when the wipe finished within budget. */
	withinBudget: boolean;
	/** 0..1 fraction of sensitive keys wiped. */
	wipeCoverage: number;
	/** 0..1 decoy plausibility (decoy keys present + non-empty). */
	decoyPlausibility: number;
	/** Composite 0..100. */
	score: number;
	/** Keys that should have been wiped but were not. */
	missedKeys: string[];
}

export interface DrillInput {
	/** Keys flagged sensitive (should be wiped). */
	sensitiveKeys: string[];
	/** Keys flagged as decoy (should survive + look real). */
	decoyKeys: string[];
	/** A getter returning the current value (or null) for a key. */
	readKey: (key: string) => string | null;
	/** Drill time budget, default 60_000ms. */
	budgetMs?: number;
	/** Actual elapsed time. */
	elapsedMs: number;
}

const DEFAULT_BUDGET_MS = 60_000;

/**
 * Score a device-search drill run. wipeCoverage = sensitive keys now null/empty;
 * decoyPlausibility = decoy keys still present + non-empty. Composite weights
 * wipeCoverage twice as heavily as decoy (both matter, but a missed sensitive
 * key is the catastrophic failure).
 */
export function scoreDeviceSearchDrill(input: DrillInput): DrillResult {
	const budgetMs = input.budgetMs ?? DEFAULT_BUDGET_MS;
	const withinBudget = input.elapsedMs <= budgetMs;

	const missedKeys: string[] = [];
	let wipedSensitive = 0;
	for (const k of input.sensitiveKeys) {
		const v = input.readKey(k);
		if (v === null || v === "" || v === undefined) {
			wipedSensitive += 1;
		} else {
			missedKeys.push(k);
		}
	}
	const wipeCoverage =
		input.sensitiveKeys.length > 0
			? wipedSensitive / input.sensitiveKeys.length
			: 1;

	let plausibleDecoys = 0;
	for (const k of input.decoyKeys) {
		const v = input.readKey(k);
		if (v !== null && v !== "" && v !== undefined) plausibleDecoys += 1;
	}
	const decoyPlausibility =
		input.decoyKeys.length > 0 ? plausibleDecoys / input.decoyKeys.length : 0;

	// Time penalty: over-budget runs lose up to 20 points proportionally.
	const overage = withinBudget
		? 0
		: Math.min(1, (input.elapsedMs - budgetMs) / budgetMs);
	const timePenalty = overage * 20;
	const raw = wipeCoverage * 66 + decoyPlausibility * 34 - timePenalty;
	const score = Math.max(0, Math.min(100, Math.round(raw)));

	return {
		budgetMs,
		elapsedMs: input.elapsedMs,
		withinBudget,
		wipeCoverage,
		decoyPlausibility,
		score,
		missedKeys,
	};
}

/** Banner copy for a drill result. */
export function drillBannerText(r: DrillResult): string {
	if (r.missedKeys.length > 0) {
		return `Drill FAILED — ${r.missedKeys.length} sensitive key(s) not wiped: ${r.missedKeys.slice(0, 3).join(", ")}.`;
	}
	if (!r.withinBudget) {
		return `Drill slow (${(r.elapsedMs / 1000).toFixed(1)}s > ${(r.budgetMs / 1000).toFixed(0)}s budget) — wipe completed but practice speed.`;
	}
	return `Drill PASSED — score ${r.score}/100 (${(r.elapsedMs / 1000).toFixed(1)}s).`;
}
