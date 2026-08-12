import { describe, it, expect } from "vitest";
import {
	scrubRecord,
	shouldStrip,
	ruleFor,
	coarseRegion,
	scrubSummary,
	CLASSIFICATION_RULES,
	type Classification,
} from "../lib/classification";

describe("classification labels + share scrubber", () => {
	const record = {
		name: "Source A",
		lat: 15.5333,
		lon: 32.5556,
		phone: "+249123",
		body: "incident at market",
		nested: { author: "x", email: "a@b.co", city: "Khartoum", note: "ok" },
		tags: ["conflict", "market"],
	};

	it("PUBLIC leaves the record untouched", () => {
		const out = scrubRecord(record, "PUBLIC");
		expect(out).toEqual(record);
	});

	it("RESTRICTED strips geo + contact but keeps name + body", () => {
		const out = scrubRecord(record, "RESTRICTED");
		expect(out).not.toHaveProperty("lat");
		expect(out).not.toHaveProperty("lon");
		expect(out).not.toHaveProperty("phone");
		expect(out).toHaveProperty("name", "Source A");
		expect(out).toHaveProperty("body", "incident at market");
		expect(out.nested).not.toHaveProperty("email");
		expect(out.nested).toHaveProperty("note", "ok");
	});

	it("SECRET additionally strips name/author/city identifiers", () => {
		const out = scrubRecord(record, "SECRET");
		expect(out).not.toHaveProperty("name");
		expect(out.nested).not.toHaveProperty("author");
		expect(out.nested).not.toHaveProperty("city");
		expect(out).toHaveProperty("body"); // claim preserved
		expect(out.tags).toEqual(["conflict", "market"]); // non-id arrays preserved
	});

	it("shouldStrip is substring/dot-path aware", () => {
		expect(shouldStrip("lat", "RESTRICTED")).toBe(true);
		expect(shouldStrip("coords.lat", "RESTRICTED")).toBe(true);
		expect(shouldStrip("latitude", "RESTRICTED")).toBe(true);
		expect(shouldStrip("body", "SECRET")).toBe(false);
	});

	it("coarseRegion snaps to 1-degree grid", () => {
		expect(coarseRegion(15.5333, 32.5556)).toBe("16,33");
		expect(coarseRegion()).toBe("unknown");
	});

	it("scrubSummary describes what each level removes", () => {
		expect(scrubSummary("PUBLIC")).toContain("no fields stripped");
		expect(scrubSummary("RESTRICTED")).toContain("lat");
		expect(scrubSummary("SECRET")).toContain("+");
	});

	it("ruleFor falls back to PUBLIC for unknown level", () => {
		expect(ruleFor("NOPE" as Classification).level).toBe("PUBLIC");
	});

	it("does not mutate the input record", () => {
		const snapshot = JSON.stringify(record);
		scrubRecord(record, "SECRET");
		expect(JSON.stringify(record)).toBe(snapshot);
	});

	it("CLASSIFICATION_RULES has exactly three levels", () => {
		expect(CLASSIFICATION_RULES.map((r) => r.level).sort()).toEqual([
			"PUBLIC",
			"RESTRICTED",
			"SECRET",
		]);
	});
});
