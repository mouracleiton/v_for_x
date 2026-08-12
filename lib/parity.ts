/**
 * V FOR X — The Parity (Phase 20 — todo-056)
 *
 * State media and independent monitors report wildly different numbers for
 * the same event (casualties, turnout, spending). The Parity lines a
 * regime *claim* up against a backbone *metric* and scores the gap, so a
 * dossier can show "state TV said 12; independent range 40–60 — gap: large"
 * without forcing the reader to do mental arithmetic under stress.
 *
 *   • scoreParity()  — compare a claim to one or more reference values
 *   • parityBadge()  — map a score to a green/amber/red badge
 *   • encodeParityToken / decode — carry one comparison as VFXPRT1
 *
 * The scoring is deliberately simple (relative gap), not a statistical
 * significance test: the point is a *honesty gradient*, not a p-value.
 * Fully offline, reads only the values handed to it.
 */

/* ═══════════════════════════════════════════════════════════════
   Token constants
   ═══════════════════════════════════════════════════════════════ */

export const PARITY_PREFIX = "VFXPRT1:";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export type ParityBadge = "match" | "minor" | "large" | "contradicts" | "unknown";

export interface ParityInput {
	/** The regime/state-TV claim. */
	claim: number;
	/** One or more independent reference values (backbone metric). */
	references: number[];
	/** Tolerance band (relative); within it = "match". Default 0.1 (±10%). */
	tolerance?: number;
	/** Beyond this relative gap = "contradicts". Default 0.5 (±50%). */
	contradictionThreshold?: number;
}

export interface ParityResult {
	/** Reference central value (median of references). */
	reference: number;
	/** Absolute difference claim − reference. */
	gap: number;
	/** Relative gap |claim − ref| / max(ref,1). 0..1+. */
	relativeGap: number;
	/** Badge label. */
	badge: ParityBadge;
	/** Human-readable summary. */
	summary: string;
}

/* ═══════════════════════════════════════════════════════════════
   Scoring
   ═══════════════════════════════════════════════════════════════ */

/** Compare a claim to reference values; never throws. */
export function scoreParity(input: ParityInput): ParityResult {
	const claim = Number(input?.claim);
	const refs = Array.isArray(input?.references) ? input.references.filter((r) => Number.isFinite(r)) : [];
	if (!Number.isFinite(claim) || refs.length === 0) {
		return {
			reference: NaN,
			gap: NaN,
			relativeGap: NaN,
			badge: "unknown",
			summary: "Insufficient data to compare.",
		};
	}
	const tol = typeof input.tolerance === "number" && input.tolerance >= 0 ? input.tolerance : 0.1;
	const contra =
		typeof input.contradictionThreshold === "number" && input.contradictionThreshold > 0
			? input.contradictionThreshold
			: 0.5;

	const ref = median(refs);
	const denom = Math.max(Math.abs(ref), 1);
	const gap = claim - ref;
	const rel = Math.abs(gap) / denom;

	let badge: ParityBadge = "minor";
	if (rel <= tol) badge = "match";
	else if (rel >= contra) badge = "contradicts";
	else if (rel > (tol + contra) / 2) badge = "large";

	const dir = gap > 0 ? "higher" : gap < 0 ? "lower" : "equal";
	const summary =
		badge === "match"
			? `Claim (${claim}) matches independent range (ref ${ref}).`
			: `Claim (${claim}) is ${dir} than independent reference (${ref}) — ${Math.round(rel * 100)}% gap.`;

	return { reference: ref, gap, relativeGap: rel, badge, summary };
}

/** Map a score to a stoplight badge string for UI. */
export function parityBadge(rel: number, tol = 0.1, contra = 0.5): ParityBadge {
	if (!Number.isFinite(rel) || rel < 0) return "unknown";
	if (rel <= tol) return "match";
	if (rel >= contra) return "contradicts";
	if (rel > (tol + contra) / 2) return "large";
	return "minor";
}

/* ═══════════════════════════════════════════════════════════════
   Token encode / decode
   ═══════════════════════════════════════════════════════════════ */

export interface ParityTokenPayload {
	claim: number;
	references: number[];
	badge: ParityBadge;
	summary: string;
	ts: number;
}

export function encodeParityToken(payload: ParityTokenPayload): string {
	return PARITY_PREFIX + toB64Url(JSON.stringify(payload));
}

export function decodeParityToken(token: string): ParityTokenPayload | null {
	if (typeof token !== "string" || !token.startsWith(PARITY_PREFIX)) return null;
	try {
		const parsed = JSON.parse(fromB64Url(token.slice(PARITY_PREFIX.length)));
		if (!parsed || typeof parsed !== "object" || typeof parsed.claim !== "number") return null;
		return parsed as ParityTokenPayload;
	} catch {
		return null;
	}
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function median(nums: number[]): number {
	const sorted = [...nums].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function toB64Url(s: string): string {
	const b64 = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, "utf8").toString("base64");
	return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): string {
	const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
	const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
	return typeof atob === "function" ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, "base64").toString("utf8");
}
