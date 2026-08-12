/**
 * V FOR X — Quorum Ballots in Web rooms (Phase 12 — todo-005)
 *
 * A room is more than chat: a group that shares a room code can also
 * share a *decision*. This lib encodes a ballot as a self-contained
 * token that rides the same Web room bus as chat messages — no central
 * tally server, no account.
 *
 *   • createBallot() — a proposer mints a question + options + deadline
 *   • castVote()    — a voter picks an option, signs with their identity
 *   • tallyVotes()  — anyone with the ballot + all votes counts the result
 *   • verifyVote()  — one vote = one identity; dedupe by identity fingerprint
 *
 * Token format: VFXQBT1:base64url(JSON({ ...ballot }))
 * A whole ballot (with all received votes) ships as one token, so it
 * round-trips through dead-drops, packs, and QR exactly like other VFX.
 *
 * Threat model: this is *sybil-soft*. One identity = one vote, and votes
 * are signed, but a determined adversary can mint many identities. Pair
 * with lib/sybil-resistance.ts (vouch circles) where that matters.
 *
 * Fully offline. The room bus carries the bytes; this lib gives them
 * meaning.
 */

/* ═══════════════════════════════════════════════════════════════
   Token constants
   ═══════════════════════════════════════════════════════════════ */

export const QUORUM_BALLOT_PREFIX = "VFXQBT1:";

export const QUORUM_BALLOT_STORAGE_KEY = "vfx-quorum-ballots";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export type VotingMethod = "plurality" | "supermajority" | "consensus";

export interface QuorumOption {
	/** Stable id, e.g. "opt-a". */
	id: string;
	/** Human label, e.g. "Open the safehouse". */
	label: string;
}

export interface QuorumVote {
	/** Voter identity fingerprint (hex hash of the public key). */
	identity: string;
	/** Option id this voter chose. */
	optionId: string;
	/** Epoch ms the vote was cast. */
	ts: number;
	/** Optional detached signature over `${ballotId}:${optionId}:${ts}`. */
	signature?: string;
}

export interface QuorumBallot {
	/** Stable ballot id (random). */
	id: string;
	/** The question being decided. */
	question: string;
	/** Options to choose among. */
	options: QuorumOption[];
	/** Voting method (default plurality). */
	method: VotingMethod;
	/** Deadline epoch ms; votes after this are rejected. */
	deadline: number;
	/** Proposer identity fingerprint. */
	proposer: string;
	/** Votes collected so far. */
	votes: QuorumVote[];
	/** Epoch ms the ballot was created. */
	createdAt: number;
}

/* ═══════════════════════════════════════════════════════════════
   Ballot lifecycle
   ═══════════════════════════════════════════════════════════════ */

/** Create a fresh ballot. Never throws; bad input yields an empty ballot. */
export function createBallot(params: {
	id?: string;
	question: string;
	options: QuorumOption[];
	method?: VotingMethod;
	deadline: number;
	proposer: string;
	now?: number;
}): QuorumBallot {
	const now = params.now ?? Date.now();
	const cleanOptions = (params.options ?? []).filter((o) => o && o.id && o.label).slice(0, 20);
	return {
		id: params.id ?? randomId(),
		question: String(params.question ?? "").slice(0, 500),
		options: cleanOptions,
		method: params.method === "supermajority" || params.method === "consensus" ? params.method : "plurality",
		deadline: Number.isFinite(params.deadline) ? params.deadline : now + 86_400_000,
		proposer: String(params.proposer ?? "").slice(0, 128),
		votes: [],
		createdAt: now,
	};
}

/**
 * Cast a vote onto a ballot. Returns a NEW ballot with the vote added
 * (or the original if the vote was rejected). Dedupes by identity:
 * a second vote from the same identity replaces the first.
 */
export function castVote(ballot: QuorumBallot, vote: QuorumVote): QuorumBallot {
	if (!ballot || !vote || !vote.identity || !vote.optionId) return ballot;
	const validIds = new Set(ballot.options.map((o) => o.id));
	if (!validIds.has(vote.optionId)) return ballot;
	const ts = Number.isFinite(vote.ts) ? vote.ts : Date.now();
	if (ts > ballot.deadline) return ballot; // late vote rejected
	const cleaned: QuorumVote = {
		identity: String(vote.identity).slice(0, 128),
		optionId: vote.optionId,
		ts,
		...(vote.signature ? { signature: String(vote.signature).slice(0, 256) } : {}),
	};
	// dedupe by identity: drop any prior vote from this voter, then append
	const votes = ballot.votes.filter((v) => v.identity !== cleaned.identity);
	votes.push(cleaned);
	return { ...ballot, votes };
}

/** Verify a single vote's signature against a message (identity.verifyMessage). */
export function verifyVote(vote: QuorumVote, ballotId: string, verify: (identity: string, msg: string, sig: string) => boolean): boolean {
	if (!vote || !vote.signature) return false;
	const msg = `${ballotId}:${vote.optionId}:${vote.ts}`;
	try {
		return verify(vote.identity, msg, vote.signature) === true;
	} catch {
		return false;
	}
}

/* ═══════════════════════════════════════════════════════════════
   Tally
   ═══════════════════════════════════════════════════════════════ */

export interface TallyResult {
	/** Option id that won (or null if no quorum / tie). */
	winner: string | null;
	/** Votes per option id. */
	counts: Record<string, number>;
	/** Total valid votes counted. */
	total: number;
	/** True if the method's threshold was met. */
	decisive: boolean;
	/** Reason if not decisive. */
	reason?: string;
}

/** Count votes and decide a winner by the ballot's method. */
export function tallyVotes(ballot: QuorumBallot): TallyResult {
	const counts: Record<string, number> = {};
	for (const o of ballot.options) counts[o.id] = 0;
	const seen = new Set<string>();
	let total = 0;
	for (const v of ballot.votes) {
		// defensive: dedupe again in case two votes slipped in with same identity
		if (seen.has(v.identity)) continue;
		seen.add(v.identity);
		if (typeof counts[v.optionId] === "number") {
			counts[v.optionId] += 1;
			total += 1;
		}
	}

	if (total === 0) {
		return { winner: null, counts, total: 0, decisive: false, reason: "no-votes" };
	}

	// pick the top option(s)
	let bestId: string | null = null;
	let bestCount = -1;
	let tie = false;
	for (const o of ballot.options) {
		if (counts[o.id] > bestCount) {
			bestCount = counts[o.id];
			bestId = o.id;
			tie = false;
		} else if (counts[o.id] === bestCount) {
			tie = true;
		}
	}

	const threshold = (() => {
		if (ballot.method === "supermajority") return Math.ceil((total * 2) / 3);
		if (ballot.method === "consensus") return total; // everyone must agree
		return 1; // plurality: most votes wins
	})();

	if (bestCount < threshold) {
		return { winner: bestId, counts, total, decisive: false, reason: `below-${ballot.method}-threshold` };
	}
	if (tie && ballot.method !== "plurality") {
		return { winner: null, counts, total, decisive: false, reason: "tie" };
	}
	return { winner: bestId, counts, total, decisive: true };
}

/* ═══════════════════════════════════════════════════════════════
   Token encode / decode (base64url JSON)
   ═══════════════════════════════════════════════════════════════ */

export function encodeBallotToken(ballot: QuorumBallot): string {
	const json = JSON.stringify(ballot);
	return QUORUM_BALLOT_PREFIX + toB64Url(json);
}

export function decodeBallotToken(token: string): QuorumBallot | null {
	if (typeof token !== "string" || !token.startsWith(QUORUM_BALLOT_PREFIX)) return null;
	try {
		const json = fromB64Url(token.slice(QUORUM_BALLOT_PREFIX.length));
		const parsed = JSON.parse(json);
		if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.options) || !Array.isArray(parsed.votes)) {
			return null;
		}
		return parsed as QuorumBallot;
	} catch {
		return null;
	}
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function randomId(): string {
	try {
		if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
			return crypto.randomUUID();
		}
	} catch {
		/* fall through */
	}
	return "qb-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function toB64Url(s: string): string {
	const b64 = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, "utf8").toString("base64");
	return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): string {
	const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
	const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
	if (typeof atob === "function") {
		return decodeURIComponent(escape(atob(b64)));
	}
	return Buffer.from(b64, "base64").toString("utf8");
}
