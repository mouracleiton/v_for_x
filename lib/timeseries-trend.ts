/**
 * V FOR X — Time-series trend classifier (todo-011)
 *
 * Answers the simplest question a human asks of a number over time:
 * "is it getting worse?" Backbone metrics grow a numeric series; this module
 * classifies the series into a direction + a confidence band, so Forecast /
 * Domino / Oracle can all show the same verdict without each reimplementing
 * trend math.
 *
 * Direction is policy-aware: callers say whether "up" means "worse" (e.g.
 * casualties, hunger) or "better" (e.g. school enrolment). The classifier
 * never hard-codes the moral direction of a metric.
 *
 * Pure functions, no deps, no network. Deterministic given the same series.
 */

/** A single time-series point (oldest first). */
export interface TrendPoint {
	/** Epoch ms or epoch s — the classifier only uses order, never the unit. */
	ts: number;
	value: number;
}

export type Direction =
	| "worsening"
	| "improving"
	| "stable"
	| "volatile"
	| "insufficient";

/** When the raw metric goes UP, is that bad or good? */
export type Polarity = "up_is_worse" | "up_is_better";

export interface TrendResult {
	direction: Direction;
	/** Linear-regression slope (Δvalue per point). NaN if < 2 points. */
	slope: number;
	/** Relative slope as a fraction of the mean magnitude (robust to scale). */
	relativeSlope: number;
	/** Latest − first delta, in the metric's own units. */
	delta: number;
	/** First and last values for callers that want to render them. */
	first: number | null;
	latest: number | null;
	/** Number of points the verdict is based on. */
	n: number;
}

/** Smallest relative slope (fraction of mean) counted as a real trend. */
const STABLE_THRESHOLD = 0.02;
/** Volatility: if the mean absolute per-step change > 25% of mean, call it volatile. */
const VOLATILE_THRESHOLD = 0.25;

/** Least-squares slope of the series (Δy per index step). */
export function regressionSlope(points: TrendPoint[]): number {
	const n = points.length;
	if (n < 2) return NaN;
	// x = 0..n-1 (index), y = value.
	const xs = points.map((_, i) => i);
	const ys = points.map((p) => p.value);
	const meanX = xs.reduce((a, b) => a + b, 0) / n;
	const meanY = ys.reduce((a, b) => a + b, 0) / n;
	let num = 0;
	let den = 0;
	for (let i = 0; i < n; i++) {
		num += (xs[i] - meanX) * (ys[i] - meanY);
		den += (xs[i] - meanX) ** 2;
	}
	if (den === 0) return 0;
	return num / den;
}

/** Mean absolute per-step change as a fraction of |mean|. High ⇒ volatile. */
export function volatility(points: TrendPoint[]): number {
	const n = points.length;
	if (n < 2) return 0;
	const mean = points.reduce((a, p) => a + p.value, 0) / n;
	if (mean === 0) {
		// all-near-zero series: use absolute step mean instead, guard /0
		let absSum = 0;
		for (let i = 1; i < n; i++)
			absSum += Math.abs(points[i].value - points[i - 1].value);
		const absMean = absSum / (n - 1);
		return absMean === 0 ? 0 : Infinity;
	}
	let absStepSum = 0;
	for (let i = 1; i < n; i++)
		absStepSum += Math.abs(points[i].value - points[i - 1].value);
	return absStepSum / (n - 1) / Math.abs(mean);
}

/** Classify a numeric time series into a direction verdict. */
export function classifyTrend(
	points: TrendPoint[],
	polarity: Polarity = "up_is_worse",
): TrendResult {
	const n = points.length;
	const first = n > 0 ? points[0].value : null;
	const latest = n > 0 ? points[n - 1].value : null;
	const delta = n > 0 ? latest! - first! : NaN;

	if (n < 3) {
		return {
			direction: "insufficient",
			slope: regressionSlope(points),
			relativeSlope: NaN,
			delta,
			first,
			latest,
			n,
		};
	}

	const slope = regressionSlope(points);
	const mean = points.reduce((a, p) => a + p.value, 0) / n;
	const relativeSlope =
		mean === 0 ? (slope === 0 ? 0 : Infinity) : slope / Math.abs(mean);
	const vol = volatility(points);

	// Volatility dominates: a noisy series isn't a trustworthy trend either way.
	if (vol > VOLATILE_THRESHOLD && Math.abs(relativeSlope) < STABLE_THRESHOLD) {
		return {
			direction: "volatile",
			slope,
			relativeSlope,
			delta,
			first,
			latest,
			n,
		};
	}

	// Map raw slope sign → moral direction via polarity.
	const sign = Math.sign(relativeSlope);
	const isFlat = Math.abs(relativeSlope) < STABLE_THRESHOLD;
	if (isFlat) {
		return {
			direction: "stable",
			slope,
			relativeSlope,
			delta,
			first,
			latest,
			n,
		};
	}
	const rawWorsening = sign > 0; // up
	const worsening = polarity === "up_is_worse" ? rawWorsening : !rawWorsening;
	return {
		direction: worsening ? "worsening" : "improving",
		slope,
		relativeSlope,
		delta,
		first,
		latest,
		n,
	};
}

/** One-line human summary, e.g. "worsening +3.4%/step (n=8)". */
export function trendSummary(r: TrendResult): string {
	if (r.direction === "insufficient") return `insufficient (n=${r.n})`;
	const pct = Number.isFinite(r.relativeSlope)
		? `${(r.relativeSlope * 100).toFixed(1)}%/step`
		: "—";
	return `${r.direction} ${pct} (n=${r.n})`;
}
