/**
 * Harm checklist + pack export helpers for ShareSheet.
 */

export const HARM_CHECKS = [
	{
		id: "no_pii",
		label: "No unconsented PII / faces / exact locations of at-risk people",
	},
	{
		id: "source_ok",
		label: "Sources are citable or marked unverified",
	},
	{
		id: "context",
		label: "Recipient context is safe (not forced share under coercion)",
	},
] as const;

export type HarmCheckId = (typeof HARM_CHECKS)[number]["id"];

export function allHarmChecksPassed(
	state: Partial<Record<HarmCheckId, boolean>>,
): boolean {
	return HARM_CHECKS.every((c) => state[c.id] === true);
}

export function emptyHarmState(): Record<HarmCheckId, boolean> {
	return { no_pii: false, source_ok: false, context: false };
}
