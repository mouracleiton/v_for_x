/**
 * V FOR X — The Parliament (Phase 20 — todo-060)
 *
 * A single mirror's quorum is easy to game; a *federated* tally across
 * many mirrors is harder. Parliament merges per-mirror cause-priority
 * tallies into one fork-aware result: each mirror reports its votes,
 * Parliament de-duplicates cross-mirror double-votes, detects forks
 * (mirrors that disagree on the tally root), and returns a merged
 * ranking that a cause board can display without trusting any one host.
 *
 *   • mergeTallies()  — combine N mirror tallies, dedupe by vote id
 *   • detectForks()   — flag mirrors whose reported root diverges
 *   • rankCauses()    — produce a ranked list from a merged tally
 *   • encode/decode   — VFXPAR1 token for the federated result
 *
 * Fully offline. The merge is deterministic so every honest mirror
 * computes the same ranking from the same inputs.
 */

/* ═══════════════════════════════════════════════════════════════
   Token constants
   ═══════════════════════════════════════════════════════════════ */

export const PARLIAMENT_PREFIX = "VFXPAR1:";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface MirrorTally {
	/** Mirror id / fingerprint. */
	mirrorId: string;
	/** Root hash this mirror computed over its tally (for fork detection). */
	root: string;
	/** Votes this mirror is reporting. */
	votes: ParliamentVote[];
}

export interface ParliamentVote {
	/** Stable, globally-unique vote id (used for cross-mirror dedupe). */
	voteId: string;
	/** Cause being voted for. */
	causeId: string;
	/** Voter identity fingerprint. */
	voter: string;
	/** Vote weight (default 1). */
	weight?: number;
}

export interface MergedTally {
	/** Deduplicated votes across all mirrors. */
	votes: ParliamentVote[];
	/** Total votes counted after dedupe. */
	total: number;
	/** Causes ranked by total weight. */
	ranking: { causeId: string; weight: number; count: number }[];
	/** Mirrors that reported roots diverging from the majority. */
	forkedMirrors: string[];
}

/* ═══════════════════════════════════════════════════════════════
   Merge + fork detection + ranking
   ═══════════════════════════════════════════════════════════════ */

/** Merge mirror tallies, dedupe by voteId, detect forks. Never throws. */
export function mergeTallies(tallies: MirrorTally[]): MergedTally {
	const clean = (Array.isArray(tallies) ? tallies : []).filter((t) => t && t.mirrorId && Array.isArray(t.votes));
	const seen = new Set<string>();
	const votes: ParliamentVote[] = [];
	for (const t of clean) {
		for (const v of t.votes) {
			if (!v || !v.voteId || seen.has(v.voteId)) continue;
			seen.add(v.voteId);
			votes.push({
				voteId: v.voteId,
				causeId: String(v.causeId),
				voter: String(v.voter),
				weight: Number.isFinite(v.weight) ? (v.weight as number) : 1,
			});
		}
	}
	const ranking = rankCauses(votes);
	const forkedMirrors = detectForks(clean);
	return { votes, total: votes.length, ranking, forkedMirrors };
}

/** Rank causes by total weight, then count. Deterministic order. */
export function rankCauses(votes: ParliamentVote[]): { causeId: string; weight: number; count: number }[] {
	const map = new Map<string, { weight: number; count: number }>();
	for (const v of votes) {
		const entry = map.get(v.causeId) ?? { weight: 0, count: 0 };
		entry.weight += Number.isFinite(v.weight) ? (v.weight as number) : 1;
		entry.count += 1;
		map.set(v.causeId, entry);
	}
	return [...map.entries()]
		.map(([causeId, e]) => ({ causeId, weight: e.weight, count: e.count }))
		.sort((a, b) => b.weight - a.weight || b.count - a.count || a.causeId.localeCompare(b.causeId));
}

/** Flag mirrors whose reported root disagrees with the majority root. */
export function detectForks(tallies: MirrorTally[]): string[] {
	if (tallies.length === 0) return [];
	// majority root = the root reported by the most mirrors
	const counts = new Map<string, number>();
	for (const t of tallies) {
		counts.set(t.root, (counts.get(t.root) ?? 0) + 1);
	}
	let majorityRoot = "";
	let majorityCount = 0;
	for (const [root, count] of counts) {
		if (count > majorityCount) {
			majorityRoot = root;
			majorityCount = count;
		}
	}
	if (majorityRoot === "") return [];
	return tallies.filter((t) => t.root !== majorityRoot).map((t) => t.mirrorId);
}

/* ═══════════════════════════════════════════════════════════════
   Token encode / decode
   ═══════════════════════════════════════════════════════════════ */

export function encodeParliamentToken(merged: MergedTally): string {
	return PARLIAMENT_PREFIX + toB64Url(JSON.stringify(merged));
}

export function decodeParliamentToken(token: string): MergedTally | null {
	if (typeof token !== "string" || !token.startsWith(PARLIAMENT_PREFIX)) return null;
	try {
		const parsed = JSON.parse(fromB64Url(token.slice(PARLIAMENT_PREFIX.length)));
		if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.votes)) return null;
		return parsed as MergedTally;
	} catch {
		return null;
	}
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function toB64Url(s: string): string {
	const b64 = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, "utf8").toString("base64");
	return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): string {
	const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
	const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
	return typeof atob === "function" ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, "base64").toString("utf8");
}
