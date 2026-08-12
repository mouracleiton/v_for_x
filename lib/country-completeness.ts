import type { CountryData } from "./types";

/** Simple filled-dimension score for country pages. */
export function countryCompleteness(c: CountryData): {
	score: number;
	filled: number;
	total: number;
	agedSources: number;
	dims: Array<{ id: string; ok: boolean }>;
} {
	const dims: Array<{ id: string; ok: boolean }> = [
		{ id: "hunger", ok: c.hunger?.undernourishment_pct != null },
		{ id: "conflict", ok: c.conflict?.intensity_1to5 != null },
		{ id: "displacement", ok: c.conflict?.displacement_m != null },
		{ id: "water", ok: c.water_sanitation?.basic_access_pct != null },
		{ id: "connectivity", ok: c.connectivity?.internet_users_pct != null },
		{
			id: "governance",
			ok: c.governance?.corruption_perceptions_index != null,
		},
		{ id: "energy", ok: c.energy?.no_access_electricity_m != null },
		{ id: "famine_risk", ok: c.hunger?.famine_risk_1to5 != null },
		{ id: "population", ok: c.population_m != null },
		{ id: "hotspot_flag", ok: typeof c.is_hotspot === "boolean" },
	];
	const filled = dims.filter((d) => d.ok).length;
	const total = dims.length;
	// Aged sources: proxy via missing optional deep fields
	const agedSources = dims.filter((d) => !d.ok).length;
	return {
		score: total ? Math.round((filled / total) * 100) : 0,
		filled,
		total,
		agedSources,
		dims,
	};
}
