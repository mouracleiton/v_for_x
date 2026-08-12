import { describe, it, expect } from "vitest";
import {
	allHarmChecksPassed,
	emptyHarmState,
	HARM_CHECKS,
} from "../lib/share-pack";

describe("share-pack harm checklist", () => {
	it("blocks export until all checks pass", () => {
		const s = emptyHarmState();
		expect(allHarmChecksPassed(s)).toBe(false);
		for (const c of HARM_CHECKS) s[c.id] = true;
		expect(allHarmChecksPassed(s)).toBe(true);
	});
});
