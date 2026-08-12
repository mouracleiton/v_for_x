import { describe, it, expect } from "vitest";
import {
	blueprintToSms,
	shrinkStep,
	stepToMessage,
	fitsSms,
	SMS_MAX,
	type Blueprint,
} from "../lib/blueprint-sms";
import { decodeMessage, reassembleSegments } from "../lib/relay";

const bp: Blueprint = {
	id: "water-sdn",
	iso3: "SDN",
	cls: "conflict",
	title: "Water access under blockade",
	steps: [
		{
			id: "1",
			title: "Find source",
			action: "Locate nearest verified borehole before movement",
		},
		{
			id: "2",
			title: "Boil",
			action: "Boil all surface water for 3 minutes minimum",
		},
		{
			id: "3",
			title: "Store",
			action: "Use sealed containers; label date and source",
		},
	],
};

describe("blueprint SMS segments", () => {
	it("shrinks a step to ≤SMS_MAX chars", () => {
		const long = {
			id: "x",
			title: "t",
			action: "a".repeat(500),
		};
		const s = shrinkStep(long);
		expect(s.length).toBeLessThanOrEqual(SMS_MAX);
		expect(s).toContain("…");
	});

	it("keeps short steps verbatim", () => {
		const step = { id: "1", title: "Boil", action: "3 min" };
		expect(shrinkStep(step)).toBe("1:Boil — 3 min");
	});

	it("packs a blueprint into SMS-sized relay segments", () => {
		const pack = blueprintToSms(bp);
		expect(pack.blueprintId).toBe("water-sdn");
		expect(pack.segments.length).toBeGreaterThan(0);
		expect(fitsSms(pack)).toBe(true);
		expect(pack.totalChars).toBeGreaterThan(0);
	});

	it("every segment decodes back to a relay message", () => {
		const pack = blueprintToSms(bp);
		for (const seg of pack.segments) {
			const reassembled = reassembleSegments([seg]);
			expect(reassembled).not.toBeNull();
			const msg = decodeMessage(reassembled!);
			expect(msg).not.toBeNull();
			expect(msg!.iso3).toBe("SDN");
		}
	});

	it("header segment carries the blueprint id + class + title", () => {
		const pack = blueprintToSms(bp);
		const first = reassembleSegments([pack.segments[0]])!;
		const msg = decodeMessage(first)!;
		expect(msg.body).toContain("water-sdn");
		expect(msg.body).toContain("conflict");
		expect(msg.body).toContain("Water access");
	});

	it("stepToMessage emits a supply-type relay message scoped to iso3", () => {
		const msg = stepToMessage(bp, bp.steps[1]);
		expect(msg.type).toBe("supply");
		expect(msg.iso3).toBe("SDN");
		expect(msg.body).toContain("Boil");
	});
});
