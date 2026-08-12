import { describe, it, expect } from "vitest";
import {
	findConflicts,
	onlyDisagreements,
	sortBySpread,
	type SourcedFigure,
} from "../lib/source-conflict";

const base: SourcedFigure[] = [
	{
		metric: "displacement",
		iso3: "SDN",
		period: "2024",
		publisher: "UNHCR",
		value: 9_000_000,
		unit: "people",
	},
	{
		metric: "displacement",
		iso3: "SDN",
		period: "2024",
		publisher: "IOM",
		value: 12_000_000,
		unit: "people",
	},
	{
		metric: "displacement",
		iso3: "SDN",
		period: "2024",
		publisher: "OCHA",
		value: 9_100_000,
		unit: "people",
	},
	{
		metric: "hunger",
		iso3: "SDN",
		period: "2024",
		publisher: "WFP",
		value: 25_500_000,
		unit: "people",
	},
	{
		metric: "hunger",
		iso3: "SDN",
		period: "2024",
		publisher: "FAO",
		value: 25_400_000,
		unit: "people",
	},
];

describe("conflict-of-sources view", () => {
	it("groups figures by (metric, iso3, period) and only keeps groups with ≥2 publishers", () => {
		const conflicts = findConflicts([
			...base,
			{
				metric: "measles",
				iso3: "SDN",
				period: "2024",
				publisher: "WHO",
				value: 300,
				unit: "cases",
			}, // single publisher, dropped
		]);
		expect(conflicts.map((c) => c.metric).sort()).toEqual([
			"displacement",
			"hunger",
		]);
	});

	it("classifies a large spread as a disagreement", () => {
		const conflicts = findConflicts(base);
		const disp = conflicts.find((c) => c.metric === "displacement")!;
		expect(disp.kind).toBe("disagreement");
		expect(disp.min).toBe(9_000_000);
		expect(disp.max).toBe(12_000_000);
		expect(disp.delta).toBe(3_000_000);
		expect(disp.publishers).toEqual(
			expect.arrayContaining(["UNHCR", "IOM", "OCHA"]),
		);
	});

	it("classifies near-equal figures as consistent", () => {
		const conflicts = findConflicts(base);
		const hunger = conflicts.find((c) => c.metric === "hunger")!;
		expect(hunger.kind).toBe("consistent");
		expect(hunger.relativeSpread).toBeLessThan(0.02);
	});

	it("summary line names the publishers and the verdict", () => {
		const disp = findConflicts(base).find((c) => c.metric === "displacement")!;
		expect(disp.summary).toContain("disagree");
		expect(disp.summary).toContain("displacement");
		expect(disp.summary).toContain("SDN");
	});

	it("onlyDisagreements drops consistent + approximate", () => {
		const all = findConflicts(base);
		const dis = onlyDisagreements(all);
		expect(dis.map((c) => c.metric)).toEqual(["displacement"]);
	});

	it("sortBySpread ranks the biggest disagreement first", () => {
		const ranked = sortBySpread(findConflicts(base));
		expect(ranked[0].metric).toBe("displacement");
	});

	it("handles zero-mean series without throwing (all-zero figures)", () => {
		const zeros: SourcedFigure[] = [
			{
				metric: "x",
				iso3: "A",
				period: "p",
				publisher: "P1",
				value: 0,
				unit: "u",
			},
			{
				metric: "x",
				iso3: "A",
				period: "p",
				publisher: "P2",
				value: 0,
				unit: "u",
			},
		];
		expect(() => findConflicts(zeros)).not.toThrow();
		const c = findConflicts(zeros)[0];
		expect(c.relativeSpread).toBe(0);
		expect(c.kind).toBe("consistent");
	});

	it("empty input returns empty", () => {
		expect(findConflicts([])).toEqual([]);
	});

	it("a single publisher with two figures is not a conflict (no second publisher)", () => {
		const samePub: SourcedFigure[] = [
			{
				metric: "x",
				iso3: "A",
				period: "p",
				publisher: "P1",
				value: 10,
				unit: "u",
			},
			{
				metric: "x",
				iso3: "A",
				period: "p",
				publisher: "P1",
				value: 20,
				unit: "u",
			},
		];
		expect(findConflicts(samePub)).toEqual([]);
	});
});
