import { describe, it, expect } from "vitest";
import {
	classifyTrend,
	regressionSlope,
	volatility,
	trendSummary,
	type TrendPoint,
} from "../lib/timeseries-trend";

function series(values: number[]): TrendPoint[] {
	return values.map((value, i) => ({ ts: i, value }));
}

describe("timeseries trend classifier", () => {
	it("regression slope is positive for rising series, negative for falling", () => {
		expect(regressionSlope(series([1, 2, 3, 4, 5]))).toBeCloseTo(1);
		expect(regressionSlope(series([5, 4, 3, 2, 1]))).toBeCloseTo(-1);
	});

	it("returns NaN slope for <2 points", () => {
		expect(Number.isNaN(regressionSlope(series([1])))).toBe(true);
	});

	it("classifies a rising series as worsening when up_is_worse", () => {
		const r = classifyTrend(series([100, 110, 120, 130, 140]), "up_is_worse");
		expect(r.direction).toBe("worsening");
		expect(r.delta).toBe(40);
		expect(r.n).toBe(5);
	});

	it("classifies the same rising series as improving when up_is_better", () => {
		const r = classifyTrend(series([100, 110, 120, 130, 140]), "up_is_better");
		expect(r.direction).toBe("improving");
	});

	it("classifies a falling up_is_worse series as improving", () => {
		const r = classifyTrend(series([140, 130, 120, 110, 100]), "up_is_worse");
		expect(r.direction).toBe("improving");
	});

	it("returns stable for a flat series", () => {
		const r = classifyTrend(series([50, 50, 50, 50]), "up_is_worse");
		expect(r.direction).toBe("stable");
		expect(r.slope).toBe(0);
	});

	it("returns volatile for a noisy non-trending series", () => {
		const r = classifyTrend(series([100, 200, 50, 250, 80]), "up_is_worse");
		expect(r.direction).toBe("volatile");
	});

	it("returns insufficient for <3 points", () => {
		const r = classifyTrend(series([1, 2]), "up_is_worse");
		expect(r.direction).toBe("insufficient");
		expect(r.n).toBe(2);
	});

	it("returns insufficient + nulls for empty series", () => {
		const r = classifyTrend([], "up_is_worse");
		expect(r.direction).toBe("insufficient");
		expect(r.first).toBeNull();
		expect(r.latest).toBeNull();
		expect(r.n).toBe(0);
	});

	it("volatility is 0 for a flat series", () => {
		expect(volatility(series([7, 7, 7, 7]))).toBe(0);
	});

	it("trendSummary formats direction and percent", () => {
		const r = classifyTrend(series([100, 110, 120, 130]), "up_is_worse");
		const s = trendSummary(r);
		expect(s).toContain("worsening");
		expect(s).toContain("%/step");
		expect(s).toContain("(n=4)");
	});

	it("trendSummary handles insufficient case", () => {
		const s = trendSummary(classifyTrend(series([1]), "up_is_worse"));
		expect(s).toBe("insufficient (n=1)");
	});

	it("relativeSlope is scale-invariant", () => {
		const big = classifyTrend(series([10000, 11000, 12000]), "up_is_worse");
		const small = classifyTrend(series([1, 1.1, 1.2]), "up_is_worse");
		expect(big.relativeSlope).toBeCloseTo(small.relativeSlope, 5);
	});
});
