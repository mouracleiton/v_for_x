import { describe, it, expect } from "vitest";
import {
	resolveMetricMeta,
	resolveMany,
	renderFootnote,
	UNDOCUMENTED_META,
	METRIC_META,
} from "../lib/metric-meta";

describe("metric-meta resolver", () => {
	it("resolves by exact id (lowercase)", () => {
		const m = resolveMetricMeta("displacement");
		expect(m.id).toBe("displacement");
		expect(m.publisher).toBe("UNHCR");
	});

	it("resolves by the longest matching fragment (most specific wins)", () => {
		// "refugees" is a fragment on displacement; ensure it resolves there.
		const m = resolveMetricMeta("hunger.refugees.total");
		expect(m.id).toBe("displacement");
	});

	it("falls back to UNDOCUMENTED_META when nothing matches", () => {
		const m = resolveMetricMeta("totally-unknown-metric-xyz");
		expect(m).toBe(UNDOCUMENTED_META);
	});

	it("is case-insensitive on the path", () => {
		expect(resolveMetricMeta("DISPLACEMENT").id).toBe("displacement");
	});

	it("resolveMany resolves a batch and preserves keys", () => {
		const out = resolveMany(["displacement", "nope-xyz"]);
		expect(out["displacement"].id).toBe("displacement");
		expect(out["nope-xyz"]).toBe(UNDOCUMENTED_META);
	});

	it("renderFootnote includes publisher, year, license, confidence, and unit", () => {
		const m = resolveMetricMeta("displacement");
		const fn = renderFootnote(9_000_000, m);
		expect(fn).toContain("UNHCR");
		expect(fn).toContain(String(m.year));
		expect(fn).toContain(m.license);
		expect(fn).toContain("confidence");
		// Value is locale-formatted; assert on the unit + digit presence instead of a comma.
		expect(fn).toContain(m.unit);
		expect(fn).toMatch(/9/);
	});

	it("renderFootnote omits the value when null", () => {
		const fn = renderFootnote(null, resolveMetricMeta("displacement"));
		expect(fn.startsWith("UNHCR")).toBe(true);
	});

	it("METRIC_META is a non-empty seeded registry", () => {
		expect(METRIC_META.length).toBeGreaterThan(5);
		expect(METRIC_META.every((m) => m.matches.length > 0)).toBe(true);
	});
});
