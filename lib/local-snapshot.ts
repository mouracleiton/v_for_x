/**
 * Browser-side metric snapshot for the home “what got worse” strip
 * when data/snapshots/ is empty (no CI snapshots yet).
 */

import {
	diffBackbone,
	topWorsened,
	type SnapshotDiffResult,
} from "./snapshot-diff";

const KEY = "vfx_local_backbone_snap_v1";

export type LocalSnap = {
	ts: number;
	countries: Array<{
		iso3: string;
		displacement?: number | null;
		undernourishment?: number | null;
		conflict?: number | null;
		famine?: number | null;
	}>;
};

export function slimCountries(
	countries: Array<{
		iso3: string;
		conflict?: { intensity_1to5?: number; displacement_m?: number | null };
		hunger?: {
			undernourishment_pct?: number | null;
			famine_risk_1to5?: number | null;
		};
	}>,
): LocalSnap["countries"] {
	return countries.map((c) => ({
		iso3: c.iso3,
		displacement: c.conflict?.displacement_m ?? null,
		undernourishment: c.hunger?.undernourishment_pct ?? null,
		conflict: c.conflict?.intensity_1to5 ?? null,
		famine: c.hunger?.famine_risk_1to5 ?? null,
	}));
}

export function loadLocalSnapshot(): LocalSnap | null {
	if (typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return null;
		return JSON.parse(raw) as LocalSnap;
	} catch {
		return null;
	}
}

export function saveLocalSnapshot(
	countries: LocalSnap["countries"],
): LocalSnap {
	const snap: LocalSnap = { ts: Date.now(), countries };
	if (typeof localStorage !== "undefined") {
		localStorage.setItem(KEY, JSON.stringify(snap));
	}
	return snap;
}

export function diffAgainstLocal(currentCountries: LocalSnap["countries"]): {
	diff: SnapshotDiffResult | null;
	baselineTs: number | null;
	seeded: boolean;
} {
	const prev = loadLocalSnapshot();
	if (!prev) {
		saveLocalSnapshot(currentCountries);
		return { diff: null, baselineTs: null, seeded: true };
	}
	const diff = diffBackbone(
		{ countries: prev.countries },
		{ countries: currentCountries },
	);
	// Refresh baseline weekly so the strip stays meaningful
	if (Date.now() - prev.ts > 7 * 24 * 3600 * 1000) {
		saveLocalSnapshot(currentCountries);
	}
	return { diff, baselineTs: prev.ts, seeded: false };
}

export { topWorsened };
