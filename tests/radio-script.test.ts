import { describe, it, expect } from "vitest";
import {
	radioScript,
	radioScriptCard,
	speakNumber,
	estimateSeconds,
	type BriefingStat,
} from "../lib/radio-script";

describe("radio script mode", () => {
	it("speaks small numbers as words", () => {
		expect(speakNumber(0).words).toBe("zero");
		expect(speakNumber(12).words).toBe("twelve");
		expect(speakNumber(42).words).toBe("forty-two");
		expect(speakNumber(305).words).toBe("three hundred and five");
	});

	it("speaks magnitudes (thousand / million / billion)", () => {
		expect(speakNumber(2_000).words).toBe("two thousand");
		expect(speakNumber(5_000_000).words).toBe("five million");
		expect(speakNumber(342_000_000).words).toBe(
			"three hundred and forty-two million",
		);
		expect(speakNumber(8_000_000_000).words).toBe("eight billion");
	});

	it("builds a ~90s script that names the number, source, and token", () => {
		const stat: BriefingStat = {
			label: "people facing acute hunger",
			value: 342_000_000,
			unit: "people",
			iso3: "world",
			source: "WFP/FAO 2025",
			token: "VFXWIT1:abc",
		};
		const card = radioScriptCard(stat);
		expect(card.script).toContain("342 million people");
		expect(card.script).toContain("three hundred and forty-two million people");
		expect(card.script).toContain("WFP/FAO 2025");
		expect(card.script).toContain("VFXWIT1:abc");
		expect(card.script).toContain("V for X");
		// 90s target band — script should be in a plausible spoken range.
		expect(card.spokenSeconds).toBeGreaterThanOrEqual(30);
		expect(card.spokenSeconds).toBeLessThanOrEqual(150);
	});

	it("includes the iso3 when scoped to a country", () => {
		const stat: BriefingStat = {
			label: "displaced people",
			value: 9_000_000,
			unit: "people",
			iso3: "SDN",
		};
		expect(radioScript(stat)).toContain("from SDN");
	});

	it("estimateSeconds grows with script length", () => {
		const short = estimateSeconds("one two three");
		const long = estimateSeconds("word ".repeat(250).trim());
		expect(long).toBeGreaterThan(short);
	});

	it("omits source/token lines when not provided", () => {
		const stat: BriefingStat = {
			label: "x",
			value: 100,
			unit: "y",
		};
		const s = radioScript(stat);
		expect(s).not.toContain("Source:");
		expect(s).not.toContain("Token:");
	});
});
