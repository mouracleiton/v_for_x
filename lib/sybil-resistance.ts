/**
 * V FOR X — Sybil resistance without KYC (todo-323)
 *
 * A censorship-resistance tool cannot demand government ID. But it can make
 * flooding expensive in three complementary, identity-free ways:
 *
 *   1. Local rate limiting — cap submissions per (actor, action, window).
 *      A burst of N reports from one handle in a minute is almost always
 *      noise or an attack, never a real signal.
 *   2. Proof-of-work (hashcash-style) — make each submission cost a few
 *      milliseconds of CPU. Trivial for one person, ruinous for a botnet.
 *   3. Vouch-circle dedupe — only count distinct (author, vouchRoot)
 *      pairs, so one identity with many handles still counts once.
 *
 * All checks are client-side and local. There is no central PoW server and
 * no vouch registry; mirrors that want to be stricter can re-run the same
 * checks on received tokens.
 *
 * No deps. Deterministic given the same clock + counter seed.
 */

export interface RateLimitConfig {
	/** Max events allowed in the window. */
	max: number;
	/** Window length in ms. */
	windowMs: number;
}

/** In-memory sliding-window rate limiter. Returns true if allowed. */
export class RateLimiter {
	private hits = new Map<string, number[]>();

	constructor(private config: RateLimitConfig) {}

	/** Record a hit and return whether it was allowed. */
	try(key: string, now = Date.now()): boolean {
		const since = now - this.config.windowMs;
		const arr = (this.hits.get(key) ?? []).filter((t) => t >= since);
		if (arr.length >= this.config.max) {
			this.hits.set(key, arr);
			return false;
		}
		arr.push(now);
		this.hits.set(key, arr);
		return true;
	}

	/** Remaining budget for a key at this moment (never mutates). */
	remaining(key: string, now = Date.now()): number {
		const since = now - this.config.windowMs;
		const arr = (this.hits.get(key) ?? []).filter((t) => t >= since);
		return Math.max(0, this.config.max - arr.length);
	}

	/** Drop stale entries to bound memory. */
	prune(now = Date.now()): void {
		const since = now - this.config.windowMs;
		for (const [key, arr] of this.hits) {
			const fresh = arr.filter((t) => t >= since);
			if (fresh.length === 0) this.hits.delete(key);
			else this.hits.set(key, fresh);
		}
	}
}

/* ═══════════════════════════════════════════════════════════
   Hashcash-style proof of work
   ═══════════════════════════════════════════════════════════ */

/** A minted proof-of-work stamp. */
export interface ProofOfWork {
	/** The resource string being protected (e.g. "heatmap:SDN:2026-08-12"). */
	resource: string;
	/** The counter that produced the win. */
	counter: number;
	/** Number of leading zero-bits required. */
	bits: number;
	/** The winning hash hex. */
	hash: string;
}

/** SHA-256 of (resource + ":" + counter). Async — uses SubtleCrypto when present. */
async function sha256Hex(input: string): Promise<string> {
	if (typeof crypto !== "undefined" && crypto.subtle) {
		const buf = await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode(input),
		);
		return [...new Uint8Array(buf)]
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
	}
	// Fallback (no SubtleCrypto): a simple non-crypto hash so the logic is testable.
	// NOT secure — only used in test envs without SubtleCrypto. Real clients use SubtleCrypto.
	let h = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(16).padStart(8, "0") + "0".repeat(56);
}

/** Count leading zero bits in a hex string. */
export function leadingZeroBits(hex: string): number {
	let bits = 0;
	for (let i = 0; i < hex.length; i++) {
		const nibble = parseInt(hex[i], 16);
		if (nibble === 0) {
			bits += 4;
			continue;
		}
		// count leading zeros in this nibble
		bits += Math.clz32(nibble) - 28;
		break;
	}
	return bits;
}

/** Mint a PoW stamp by incrementing the counter until the hash has `bits` leading zeros. */
export async function mineProof(
	resource: string,
	bits: number,
	opts: { maxAttempts?: number } = {},
): Promise<ProofOfWork | null> {
	const maxAttempts = opts.maxAttempts ?? 1_000_000;
	for (let counter = 0; counter < maxAttempts; counter++) {
		const hash = await sha256Hex(`${resource}:${counter}`);
		if (leadingZeroBits(hash) >= bits) {
			return { resource, counter, bits, hash };
		}
	}
	return null;
}

/** Verify a PoW stamp (re-derives the hash; constant-ish time per bits). */
export async function verifyProof(pow: ProofOfWork): Promise<boolean> {
	const hash = await sha256Hex(`${pow.resource}:${pow.counter}`);
	return hash === pow.hash && leadingZeroBits(hash) >= pow.bits;
}

/* ═══════════════════════════════════════════════════════════
   Vouch-circle dedupe
   ═══════════════════════════════════════════════════════════ */

/**
 * Count distinct votes, where each vote is (author, vouchRoot). Two votes
 * from the same author with different vouch roots count twice (the author
 * is vouched by two independent circles); two votes with the same root
 * count once. This makes one operator with many handles count once per
 * circle that vouches for them — not once per handle.
 */
export function dedupeByAuthorCircle(
	votes: { author: string; vouchRoot: string }[],
): number {
	const seen = new Set<string>();
	for (const v of votes) {
		seen.add(`${v.author}|${v.vouchRoot}`);
	}
	return seen.size;
}

/** Default heatmap rate limit: 6 bursts per handle per 10 minutes. */
export const HEATMAP_RATE_LIMIT: RateLimitConfig = {
	max: 6,
	windowMs: 10 * 60 * 1000,
};

/** Default PoW bits for a heatmap burst (≈ tens of ms on a phone). */
export const HEATMAP_POW_BITS = 12;
