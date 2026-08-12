/**
 * V FOR X — Jurisdiction risk + feature-flag auto-config (todo-324, todo-447)
 *
 * "This feature raises risk here." A governance score is the cleanest signal
 * for how much operational risk a feature adds in a jurisdiction. This module
 * maps a country's governance block into a RiskLevel and a set of defensive
 * FeatureFlags, so the Mask / Web / Heatmap surfaces can reconfigure defaults
 * the moment a user selects a high-risk country — no manual threat-model
 * picker required (though it can be overridden).
 *
 * Pure functions over the backbone governance shape. No network.
 *
 * Heuristic, not predictive: the bands below are policy choices, not
 * measurements of any specific regime's behavior. Override at the UI layer.
 */

export type RiskLevel = "low" | "moderate" | "high" | "severe";

/** Governance block as it appears in data/world_backbone.json. */
export interface GovernanceScores {
	/** V-Dem electoral democracy index, 0..1 (higher = more democratic). */
	electoral_democracy_index?: number;
	/** TI Corruption Perceptions Index, 0..100 (higher = less corrupt). */
	corruption_perceptions_index?: number;
	/** V-Dem political corruption index, 0..1 (higher = MORE corrupt). */
	political_corruption_index?: number;
}

/** Feature flags derived from jurisdiction risk. */
export interface FeatureFlags {
	/** Location capture defaults to manual (never auto) above low risk. */
	locationMode: "auto" | "manual" | "off";
	/** Require explicit confirm before any share above low risk. */
	shareConfirm: boolean;
	/** Quiet-hours network kill-switch on by default at severe risk. */
	quietHoursDefault: boolean;
	/** Strip precise geo from exports above moderate risk. */
	stripGeoOnExport: boolean;
	/** Show a visible "this feature raises risk here" banner. */
	showRiskBanner: boolean;
}

/** A combined risk verdict for display. */
export interface JurisdictionRisk {
	iso3: string;
	level: RiskLevel;
	/** 0..100 composite (for sorting / badges). */
	score: number;
	flags: FeatureFlags;
	/** One-line reason the band was chosen. */
	reason: string;
}

const DEMOCRACY_BANDS: { max: number; level: RiskLevel }[] = [
	{ max: 0.3, level: "severe" },
	{ max: 0.45, level: "high" },
	{ max: 0.6, level: "moderate" },
	{ max: 1.01, level: "low" },
];

/** Map raw governance scores → a single RiskLevel (worst-of across signals). */
export function classifyJurisdiction(g: GovernanceScores): {
	level: RiskLevel;
	score: number;
	reason: string;
} {
	const rank: Record<RiskLevel, number> = {
		low: 1,
		moderate: 2,
		high: 3,
		severe: 4,
	};

	const signals: { level: RiskLevel; label: string }[] = [];

	if (
		typeof g.electoral_democracy_index === "number" &&
		!Number.isNaN(g.electoral_democracy_index)
	) {
		const band = DEMOCRACY_BANDS.find(
			(b) => g.electoral_democracy_index! < b.max,
		);
		signals.push({
			level: band?.level ?? "low",
			label: `democracy ${g.electoral_democracy_index.toFixed(2)}`,
		});
	}
	// CPI: low score = high corruption = high risk.
	if (
		typeof g.corruption_perceptions_index === "number" &&
		!Number.isNaN(g.corruption_perceptions_index)
	) {
		const cpi = g.corruption_perceptions_index;
		const level: RiskLevel =
			cpi < 25 ? "severe" : cpi < 40 ? "high" : cpi < 55 ? "moderate" : "low";
		signals.push({ level, label: `CPI ${cpi}` });
	}
	// Political corruption index: high = high risk.
	if (
		typeof g.political_corruption_index === "number" &&
		!Number.isNaN(g.political_corruption_index)
	) {
		const pci = g.political_corruption_index;
		const level: RiskLevel =
			pci > 0.75
				? "severe"
				: pci > 0.6
					? "high"
					: pci > 0.45
						? "moderate"
						: "low";
		signals.push({ level, label: `corruption ${pci.toFixed(2)}` });
	}

	if (signals.length === 0) {
		// No governance signal at all → treat as unknown/moderate (don't silently assume safe).
		return {
			level: "moderate",
			score: 50,
			reason: "no governance signal — defaulting to moderate",
		};
	}

	const worst = signals.reduce(
		(acc, s) => (rank[s.level] > rank[acc.level] ? s : acc),
		signals[0],
	);
	// Composite 0..100: scale the worst rank across the band, plus a small blend of signal count.
	const score = Math.min(100, Math.round((rank[worst.level] / 4) * 100));
	return {
		level: worst.level,
		score,
		reason: `${worst.label} → ${worst.level}`,
	};
}

/** Derive defensive feature flags from a risk level. */
export function flagsForLevel(level: RiskLevel): FeatureFlags {
	switch (level) {
		case "low":
			return {
				locationMode: "auto",
				shareConfirm: false,
				quietHoursDefault: false,
				stripGeoOnExport: false,
				showRiskBanner: false,
			};
		case "moderate":
			return {
				locationMode: "manual",
				shareConfirm: true,
				quietHoursDefault: false,
				stripGeoOnExport: true,
				showRiskBanner: false,
			};
		case "high":
			return {
				locationMode: "manual",
				shareConfirm: true,
				quietHoursDefault: false,
				stripGeoOnExport: true,
				showRiskBanner: true,
			};
		case "severe":
		default:
			return {
				locationMode: "off",
				shareConfirm: true,
				quietHoursDefault: true,
				stripGeoOnExport: true,
				showRiskBanner: true,
			};
	}
}

/** Full verdict for a country: classify + derive flags. */
export function jurisdictionRisk(
	iso3: string,
	g: GovernanceScores,
): JurisdictionRisk {
	const { level, score, reason } = classifyJurisdiction(g);
	return { iso3, level, score, flags: flagsForLevel(level), reason };
}

/** One-line banner copy, e.g. "HIGH RISK in SDN — location off, share asks first." */
export function riskBannerText(r: JurisdictionRisk): string {
	const parts: string[] = [];
	if (r.flags.locationMode !== "auto")
		parts.push(`location ${r.flags.locationMode}`);
	if (r.flags.shareConfirm) parts.push("share asks first");
	if (r.flags.quietHoursDefault) parts.push("network quiet by default");
	const tail = parts.length > 0 ? ` — ${parts.join(", ")}` : "";
	return `${r.level.toUpperCase()} RISK in ${r.iso3}${tail}`;
}
