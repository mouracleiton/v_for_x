/**
 * V FOR X — Threat-model picker (todo-321)
 *
 * "Threat-model picker on Mask reconfigures defaults (journalist / protester / aid)".
 *
 * A journalist under a libel regime, a protester at a kettle, and an aid
 * operator in a war zone face genuinely different risks. This module maps a
 * chosen persona to a bundle of defensive defaults (FeatureFlags), and blends
 * them with the user's jurisdiction risk so the final config is the worst-of
 * the two — a high-risk persona in a low-risk country is still treated as
 * high-risk, and vice-versa.
 *
 * Reuses FeatureFlags from lib/jurisdiction-risk.ts so a Mask threat-model
 * picker and a jurisdiction banner agree on the same flag vocabulary. No
 * duplication, no drift.
 *
 * Pure functions, no network.
 */

import type { FeatureFlags, RiskLevel } from "./jurisdiction-risk";

export type ThreatPersona =
	| "journalist"
	| "protester"
	| "aid"
	| "observer"
	| "custom";

export interface ThreatModelPreset {
	id: ThreatPersona;
	label: string;
	description: string;
	flags: FeatureFlags;
	/** Default storage/identity posture. */
	wipeOnIdle: boolean;
	/** Default to sealed-sender / metadata minimization on mesh. */
	sealedSender: boolean;
}

/**
 * Persona presets. These are starting points — a user can override any flag.
 * Defaults err toward safety: when in doubt, ask before a side-effect.
 */
export const THREAT_MODELS: ThreatModelPreset[] = [
	{
		id: "journalist",
		label: "Journalist",
		description: "Protecting sources under a libel or surveillance regime.",
		flags: {
			locationMode: "off",
			shareConfirm: true,
			quietHoursDefault: false,
			stripGeoOnExport: true,
			showRiskBanner: true,
		},
		wipeOnIdle: true,
		sealedSender: true,
	},
	{
		id: "protester",
		label: "Protester",
		description: "At a demonstration; device may be seized or searched.",
		flags: {
			locationMode: "off",
			shareConfirm: true,
			quietHoursDefault: true,
			stripGeoOnExport: true,
			showRiskBanner: true,
		},
		wipeOnIdle: true,
		sealedSender: true,
	},
	{
		id: "aid",
		label: "Aid operator",
		description:
			"Coordinating relief; needs reach but cannot endanger beneficiaries.",
		flags: {
			locationMode: "manual",
			shareConfirm: true,
			quietHoursDefault: false,
			stripGeoOnExport: true,
			showRiskBanner: false,
		},
		wipeOnIdle: false,
		sealedSender: false,
	},
	{
		id: "observer",
		label: "Election / human-rights observer",
		description: "Documenting events; evidence chain must survive device loss.",
		flags: {
			locationMode: "manual",
			shareConfirm: true,
			quietHoursDefault: false,
			stripGeoOnExport: true,
			showRiskBanner: true,
		},
		wipeOnIdle: false,
		sealedSender: true,
	},
	{
		id: "custom",
		label: "Custom",
		description: "User-tuned; no preset applied.",
		flags: {
			locationMode: "manual",
			shareConfirm: true,
			quietHoursDefault: false,
			stripGeoOnExport: false,
			showRiskBanner: false,
		},
		wipeOnIdle: false,
		sealedSender: false,
	},
];

/** Look up a preset by id (falls back to the safe "custom" defaults). */
export function getThreatModel(id: ThreatPersona): ThreatModelPreset {
	return (
		THREAT_MODELS.find((m) => m.id === id) ??
		THREAT_MODELS[THREAT_MODELS.length - 1]
	);
}

function locationRank(mode: string): number {
	// More restrictive (off) wins over manual wins over auto.
	return mode === "off" ? 2 : mode === "manual" ? 1 : 0;
}

/**
 * Blend two flag sets by taking the stricter value per flag.
 * Used to combine a persona preset with jurisdiction-derived flags.
 *
 * Per-flag logic is explicit (not a generic index) because FeatureFlags
 * mixes booleans and a locationMode enum — a type-erased lookup collapses
 * the union to `never`. Explicitness also documents the strictness rule.
 */
export function blendFlags(a: FeatureFlags, b: FeatureFlags): FeatureFlags {
	return {
		locationMode:
			locationRank(b.locationMode) > locationRank(a.locationMode)
				? b.locationMode
				: a.locationMode,
		shareConfirm: a.shareConfirm || b.shareConfirm,
		quietHoursDefault: a.quietHoursDefault || b.quietHoursDefault,
		stripGeoOnExport: a.stripGeoOnExport || b.stripGeoOnExport,
		showRiskBanner: a.showRiskBanner || b.showRiskBanner,
	};
}

/** A persona × jurisdiction verdict: the final effective config. */
export interface EffectiveThreatModel {
	persona: ThreatPersona;
	personaLabel: string;
	/** The jurisdiction risk level that was blended in (or "low" if none). */
	jurisdictionLevel: RiskLevel;
	flags: FeatureFlags;
	wipeOnIdle: boolean;
	sealedSender: boolean;
	summary: string;
}

/**
 * Compute the effective threat model: persona defaults blended (worst-of) with
 * jurisdiction-derived flags. Passing no jurisdiction flags returns the raw
 * persona preset.
 */
export function effectiveThreatModel(
	persona: ThreatPersona,
	jurisdictionFlags?: FeatureFlags,
	jurisdictionLevel: RiskLevel = "low",
): EffectiveThreatModel {
	const preset = getThreatModel(persona);
	const flags = jurisdictionFlags
		? blendFlags(preset.flags, jurisdictionFlags)
		: preset.flags;
	return {
		persona: preset.id,
		personaLabel: preset.label,
		jurisdictionLevel,
		flags,
		wipeOnIdle: preset.wipeOnIdle,
		sealedSender: preset.sealedSender,
		summary: `${preset.label} · jurisdiction ${jurisdictionLevel}`,
	};
}

/** Persisted user selection (localStorage key registered in lib/storage-map.ts). */
export const STORAGE_KEY = "vfx-threat-model";

export function loadPersona(): ThreatPersona {
	if (typeof localStorage === "undefined") return "custom";
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return "custom";
		const parsed = JSON.parse(raw) as { persona?: ThreatPersona };
		return parsed.persona ?? "custom";
	} catch {
		return "custom";
	}
}

export function savePersona(persona: ThreatPersona): boolean {
	if (typeof localStorage === "undefined") return false;
	try {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ persona, ts: Date.now() }),
		);
		return true;
	} catch {
		return false;
	}
}
