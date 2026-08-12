/**
 * V FOR X — Memory-Hole Detector (Phase 25 F)
 *
 * Optional online check: compares this mirror's content hashes against a
 * last-known seed list. When a previously-present dossier/page hash is
 * MISSING from the current set, flag it as a potential memory-hole (silent
 * deletion). Offline-safe: if the fetcher is absent or the call fails, the
 * detector returns `unknown` rather than guessing.
 *
 * Static-export friendly: the "current" hash set can be the built manifest;
 * the "seed" set can be a signed snapshot. No cloud account required.
 */

/** A single observed hash for a keyed resource (e.g. dossier iso3, page path). */
export interface ContentHashEntry {
	/** Stable key: iso3, page path, or token id. */
	key: string;
	/** SHA-256 hex (or content hash) of the resource. */
	hash: string;
	/** When this hash was recorded (epoch ms). */
	ts: number;
}

export type MemoryHoleVerdict = "clean" | "memory-hole" | "changed" | "unknown";

export interface MemoryHoleFinding {
	key: string;
	verdict: MemoryHoleVerdict;
	/** Seed hash (last-known-good) when available. */
	seedHash?: string;
	/** Current hash when available. */
	currentHash?: string;
	reason: string;
}

export interface MemoryHoleReport {
	findings: MemoryHoleFinding[];
	/** Keys present in seed but absent from current. */
	missing: string[];
	/** Keys present but with a different hash (content drift). */
	changed: string[];
	verdict: MemoryHoleVerdict;
}

/** Build a lookup map from a seed list. */
export function indexSeed(seed: ContentHashEntry[]): Map<string, string> {
	const m = new Map<string, string>();
	for (const e of seed) m.set(e.key, e.hash);
	return m;
}

/**
 * Compare a current hash set against a seed set. Pure + offline.
 * - missing: in seed, not in current → memory-hole candidate
 * - changed: in both, hash differs → content drift
 * - clean: in both, same hash
 */
export function detectMemoryHoles(
	seed: ContentHashEntry[],
	current: ContentHashEntry[],
): MemoryHoleReport {
	const seedMap = indexSeed(seed);
	const currentMap = indexSeed(current);
	const findings: MemoryHoleFinding[] = [];
	const missing: string[] = [];
	const changed: string[] = [];

	for (const [key, seedHash] of seedMap) {
		const cur = currentMap.get(key);
		if (cur === undefined) {
			missing.push(key);
			findings.push({
				key,
				verdict: "memory-hole",
				seedHash,
				reason: "present in seed, absent from current mirror",
			});
		} else if (cur !== seedHash) {
			changed.push(key);
			findings.push({
				key,
				verdict: "changed",
				seedHash,
				currentHash: cur,
				reason: "content hash drifted from seed",
			});
		} else {
			findings.push({
				key,
				verdict: "clean",
				seedHash,
				currentHash: cur,
				reason: "hash matches seed",
			});
		}
	}

	const verdict: MemoryHoleVerdict =
		missing.length > 0
			? "memory-hole"
			: changed.length > 0
				? "changed"
				: "clean";

	return { findings, missing, changed, verdict };
}

/**
 * Optional online check. If the fetcher throws or returns null, returns
 * `unknown` without guessing — never false-positives on a network blip.
 */
export async function checkMirrorAgainstSeed(
	fetchSeed: () => Promise<ContentHashEntry[] | null>,
	current: ContentHashEntry[],
): Promise<MemoryHoleReport> {
	let seed: ContentHashEntry[] | null = null;
	try {
		seed = await fetchSeed();
	} catch {
		return {
			findings: [],
			missing: [],
			changed: [],
			verdict: "unknown",
		};
	}
	if (!seed || seed.length === 0) {
		return {
			findings: [],
			missing: [],
			changed: [],
			verdict: "unknown",
		};
	}
	return detectMemoryHoles(seed, current);
}

/** Human banner copy for a report. */
export function memoryHoleBannerText(report: MemoryHoleReport): string {
	if (report.verdict === "unknown")
		return "Memory-hole check unavailable (offline).";
	if (report.verdict === "clean")
		return "Mirror matches seed — no deletions detected.";
	if (report.missing.length > 0) {
		return `Possible memory-hole: ${report.missing.length} key(s) missing — ${report.missing.slice(0, 3).join(", ")}.`;
	}
	return `Content drift: ${report.changed.length} key(s) changed since seed.`;
}
