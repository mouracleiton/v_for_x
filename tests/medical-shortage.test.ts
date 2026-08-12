import { describe, it, expect } from "vitest";
import {
	warningFor,
	warningsFor,
	findRule,
	severityFromDays,
	sortBySeverity,
	MED_SAFETY_RULES,
	GENERIC_WARNING,
	type ShortageEntry,
} from "../lib/medical-shortage";

describe("medical shortage safety warnings", () => {
	it("matches insulin and emits the critical insulin warning", () => {
		const w = warningFor({
			item: "Insulin (rapid-acting)",
			iso3: "SDN",
			daysRemaining: 0,
		});
		expect(w.matched).toBe(true);
		expect(w.label).toBe("Insulin");
		expect(w.severity).toBe("critical");
		expect(w.warning).toContain("ration");
	});

	it("uses generic warning when no rule matches", () => {
		const w = warningFor({ item: "bandages", iso3: "SDN", daysRemaining: 5 });
		expect(w.matched).toBe(false);
		expect(w.warning).toBe(GENERIC_WARNING);
	});

	it("findRule is case-insensitive on match tokens", () => {
		expect(findRule("INSULIN")?.label).toBe("Insulin");
		expect(findRule("EpiPen")?.label).toBe("Adrenaline / Epinephrine");
		expect(findRule("Amoxicillin 500mg")?.label).toBe("Antibiotics");
		expect(findRule("unrelated item")).toBeNull();
	});

	it("severityFromDays maps stock levels correctly", () => {
		expect(severityFromDays(0)).toBe("critical");
		expect(severityFromDays(2)).toBe("severe");
		expect(severityFromDays(5)).toBe("moderate");
		expect(severityFromDays(14)).toBe("low");
		expect(severityFromDays(undefined)).toBe("moderate");
	});

	it("final severity = max(stock severity, rule severity)", () => {
		// Insulin with 14 days left: stock=low, rule=critical → critical.
		const w = warningFor({ item: "insulin", iso3: "X", daysRemaining: 14 });
		expect(w.severity).toBe("critical");
	});

	it("never throws on empty/garbage item", () => {
		expect(() => warningFor({ item: "", iso3: "" })).not.toThrow();
		expect(() => warningFor({ item: "???###", iso3: "X" })).not.toThrow();
	});

	it("preserves the reporter note", () => {
		const w = warningFor({
			item: "insulin",
			iso3: "X",
			note: "last vial broken",
		});
		expect(w.note).toBe("last vial broken");
	});

	it("warningsFor maps over entries", () => {
		const entries: ShortageEntry[] = [
			{ item: "insulin", iso3: "X", daysRemaining: 1 },
			{ item: "bandages", iso3: "X", daysRemaining: 10 },
		];
		const ws = warningsFor(entries);
		expect(ws).toHaveLength(2);
		expect(ws[0].matched).toBe(true);
		expect(ws[1].matched).toBe(false);
	});

	it("sortBySeverity puts critical first", () => {
		const ws = sortBySeverity([
			{ item: "x", label: "x", severity: "low", warning: "w", matched: false },
			{
				item: "y",
				label: "y",
				severity: "critical",
				warning: "w",
				matched: true,
			},
			{
				item: "z",
				label: "z",
				severity: "severe",
				warning: "w",
				matched: true,
			},
		]);
		expect(ws[0].severity).toBe("critical");
		expect(ws[1].severity).toBe("severe");
		expect(ws[2].severity).toBe("low");
	});

	it("MED_SAFETY_RULES covers the named critical-med families", () => {
		const labels = MED_SAFETY_RULES.map((r) => r.label);
		expect(labels).toEqual(
			expect.arrayContaining([
				"Insulin",
				"Adrenaline / Epinephrine",
				"Antibiotics",
				"Medical oxygen",
				"Dialysis supplies",
			]),
		);
	});
});
