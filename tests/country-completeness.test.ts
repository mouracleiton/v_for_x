import { describe, it, expect } from "vitest";
import { countryCompleteness } from "../lib/country-completeness";
import backbone from "../data/world_backbone.json";
import type { WorldBackbone, CountryData } from "../lib/types";

const data = backbone as WorldBackbone;

describe("countryCompleteness", () => {
	it("scores real countries in 0..100", () => {
		const c = data.countries[0] as CountryData;
		const r = countryCompleteness(c);
		expect(r.score).toBeGreaterThanOrEqual(0);
		expect(r.score).toBeLessThanOrEqual(100);
		expect(r.filled).toBeLessThanOrEqual(r.total);
		expect(r.dims.length).toBe(r.total);
	});

	it("hotspots tend to have more filled crisis dims", () => {
		const hot = data.countries.find((x) => x.is_hotspot) as
			| CountryData
			| undefined;
		if (!hot) return;
		const r = countryCompleteness(hot);
		expect(r.filled).toBeGreaterThan(0);
	});
});
