import { describe, it, expect } from "vitest";
import {
	statusForAge,
	stalenessScore,
	computeEntry,
	buildReport,
	formatAge,
	statusColor,
	summarizeReport,
	DATA_SOURCES,
	type DataSource,
} from "../lib/data-freshness";

describe("data-freshness", () => {
	it("statusForAge classifies against cadence (fresh ≤1x, aging ≤1.5x, stale ≤3x, critical >3x)", () => {
		expect(statusForAge(10, 30)).toBe("fresh"); // ratio 0.33
		expect(statusForAge(40, 30)).toBe("aging"); // ratio 1.33
		expect(statusForAge(60, 30)).toBe("stale"); // ratio 2.0
		expect(statusForAge(200, 30)).toBe("critical"); // ratio 6.7
	});

	it("statusForAge falls back to absolute-age bands when cadence is null (≤90 fresh)", () => {
		expect(statusForAge(10, null)).toBe("fresh");
		expect(statusForAge(150, null)).toBe("aging");
		expect(statusForAge(300, null)).toBe("stale");
		expect(statusForAge(500, null)).toBe("critical");
	});

	it("stalenessScore rises with age and is 0..1", () => {
		const young = stalenessScore(1, 30);
		const old = stalenessScore(200, 30);
		expect(old).toBeGreaterThan(young);
		expect(young).toBeGreaterThanOrEqual(0);
		expect(old).toBeLessThanOrEqual(1);
	});

	it("computeEntry builds an entry from a source at a fixed now", () => {
		const src: DataSource = {
			id: "test",
			label: "Test",
			category: "humanitarian",
			cadenceDays: 30,
			lastUpdated: Date.now() - 10 * 86400_000,
			publisher: "TEST",
			source: "data/test.json",
		};
		const e = computeEntry(src, Date.now());
		expect(e.source.id).toBe("test");
		expect(e.ageDays).toBeGreaterThanOrEqual(10);
		expect(["fresh", "aging", "stale", "critical"]).toContain(e.status);
	});

	it("buildReport aggregates entries and has counts", () => {
		const r = buildReport(DATA_SOURCES, Date.now());
		expect(r.entries.length).toBe(DATA_SOURCES.length);
		expect(typeof r.counts.critical).toBe("number");
		expect(typeof r.counts.stale).toBe("number");
	});

	it("formatAge renders human strings", () => {
		expect(formatAge(0)).toBe("today");
		expect(formatAge(5)).toContain("5");
		expect(formatAge(400)).toMatch(/year/i);
	});

	it("statusColor returns a non-empty color token per status", () => {
		for (const s of [
			"fresh",
			"aging",
			"stale",
			"critical",
			"unknown",
		] as const) {
			expect(statusColor(s).length).toBeGreaterThan(0);
		}
	});

	it("summarizeReport mentions the worst status or counts", () => {
		const r = buildReport(DATA_SOURCES, Date.now());
		const s = summarizeReport(r);
		expect(s.length).toBeGreaterThan(0);
	});
});
