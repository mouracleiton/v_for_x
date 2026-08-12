import { describe, it, expect, beforeEach } from "vitest";
import {
	diffAgainstLocal,
	loadLocalSnapshot,
	saveLocalSnapshot,
	slimCountries,
} from "../lib/local-snapshot";

describe("local-snapshot", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("seeds then diffs", () => {
		const a = slimCountries([
			{
				iso3: "SDN",
				conflict: { intensity_1to5: 3, displacement_m: 1 },
				hunger: { undernourishment_pct: 20, famine_risk_1to5: 3 },
			},
		]);
		const first = diffAgainstLocal(a);
		expect(first.seeded).toBe(true);
		expect(loadLocalSnapshot()?.countries[0]?.iso3).toBe("SDN");

		const b = slimCountries([
			{
				iso3: "SDN",
				conflict: { intensity_1to5: 4, displacement_m: 2 },
				hunger: { undernourishment_pct: 25, famine_risk_1to5: 4 },
			},
		]);
		// Force baseline age so we don't rewrite immediately — just overwrite storage
		saveLocalSnapshot(a);
		const second = diffAgainstLocal(b);
		expect(second.seeded).toBe(false);
		expect(second.diff?.totalChanges).toBeGreaterThan(0);
	});
});
