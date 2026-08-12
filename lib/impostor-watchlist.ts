/**
 * V FOR X — Impostor-Handle Watchlist (Phase 25 F)
 *
 * Key-transparency lite: record the public keys observed for a handle over
 * time. When a handle that previously used key A is suddenly seen using key B
 * (and A is still the "canonical" key), flag it as a possible impostor handle.
 * Offline + local-only: no phone-home, no global log.
 *
 * The watchlist does NOT decide who is right — it surfaces the change so the
 * operator can re-verify out-of-band. Matches the "detect, don't assume"
 * principle from the threat model.
 */

export interface HandleKeyObservation {
	/** The handle (e.g. identity handle "lex-mira"). */
	handle: string;
	/** Public key (SPKI base64 or hex). */
	publicKey: string;
	/** First time this key was seen for this handle (epoch ms). */
	firstSeen: number;
	/** Last time this key was seen for this handle. */
	lastSeen: number;
}

export interface ImpostorFinding {
	handle: string;
	/** The previously-canonical key for this handle. */
	canonicalKey: string;
	/** The newly-seen key that differs. */
	suspectKey: string;
	/** When the suspect key was first observed. */
	suspectFirstSeen: number;
	reason: string;
}

export type WatchlistVerdict =
	| "clean"
	| "new-handle"
	| "key-rotated"
	| "impostor-suspected";

export interface WatchlistReport {
	findings: ImpostorFinding[];
	verdict: WatchlistVerdict;
}

const WATCHLIST_KEY = "vfx-impostor-watchlist";

/** Load the local watchlist (handle → list of observations). */
export function loadWatchlist(): Record<string, HandleKeyObservation[]> {
	if (typeof window === "undefined" || typeof localStorage === "undefined")
		return {};
	try {
		const raw = localStorage.getItem(WATCHLIST_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
}

/** Persist the watchlist. */
export function saveWatchlist(
	data: Record<string, HandleKeyObservation[]>,
): void {
	if (typeof window === "undefined" || typeof localStorage === "undefined")
		return;
	try {
		localStorage.setItem(WATCHLIST_KEY, JSON.stringify(data));
	} catch {
		/* ignore quota errors */
	}
}

/**
 * Record an observation of (handle, publicKey). Updates lastSeen if known,
 * otherwise adds a new observation. Returns the resulting per-handle list.
 * Pure over the input map; persistence is the caller's job (see observe()).
 */
export function recordObservation(
	data: Record<string, HandleKeyObservation[]>,
	handle: string,
	publicKey: string,
	now = Date.now(),
): Record<string, HandleKeyObservation[]> {
	const next: Record<string, HandleKeyObservation[]> = { ...data };
	const list = next[handle] ? [...next[handle]] : [];
	const existing = list.find((o) => o.publicKey === publicKey);
	if (existing) {
		existing.lastSeen = now;
	} else {
		list.push({ handle, publicKey, firstSeen: now, lastSeen: now });
	}
	// Keep oldest-first so the canonical key (index 0) is stable.
	list.sort((a, b) => a.firstSeen - b.firstSeen);
	next[handle] = list;
	return next;
}

/**
 * Observe a (handle, publicKey) pair: record it, persist, and return a report.
 * Evaluate the incoming (handle, publicKey) against EXISTING history, THEN
 * record it. Detecting-before-recording matters: if we recorded first, the
 * key would be known by the time we evaluate and we could never surface an
 * impostor at observation time (only post-hoc). Recording still happens so
 * the canonical key stays stable across calls.
 */
export function observe(
	handle: string,
	publicKey: string,
	now = Date.now(),
): { data: Record<string, HandleKeyObservation[]>; report: WatchlistReport } {
	const before = loadWatchlist();
	const report = evaluate(before, handle, publicKey);
	const data = recordObservation(before, handle, publicKey, now);
	saveWatchlist(data);
	return { data, report };
}

/**
 * Evaluate whether the given (handle, publicKey) is suspicious given history.
 * The canonical key is the FIRST key ever seen for a handle (oldest wins).
 */
export function evaluate(
	data: Record<string, HandleKeyObservation[]>,
	handle: string,
	publicKey: string,
): WatchlistReport {
	const list = data[handle] ?? [];
	if (list.length === 0) {
		return { findings: [], verdict: "new-handle" };
	}
	const canonical = list[0]; // oldest = canonical (sorted in recordObservation)
	if (canonical.publicKey === publicKey) {
		return { findings: [], verdict: "clean" };
	}
	// Different key from canonical. If this key was seen before and is the most
	// recent, treat as a rotation; if it is brand-new, suspect impostor.
	const known = list.find((o) => o.publicKey === publicKey);
	if (known) {
		return {
			verdict: "key-rotated",
			findings: [
				{
					handle,
					canonicalKey: canonical.publicKey,
					suspectKey: publicKey,
					suspectFirstSeen: known.firstSeen,
					reason:
						"handle now uses a previously-seen alternate key (possible rotation)",
				},
			],
		};
	}
	return {
		verdict: "impostor-suspected",
		findings: [
			{
				handle,
				canonicalKey: canonical.publicKey,
				suspectKey: publicKey,
				suspectFirstSeen: Date.now(),
				reason:
					"handle presented a never-before-seen key; canonical key differs",
			},
		],
	};
}

/** Clear all watchlist data (panic wipe / reset). */
export function clearWatchlist(): void {
	if (typeof window === "undefined" || typeof localStorage === "undefined")
		return;
	try {
		localStorage.removeItem(WATCHLIST_KEY);
	} catch {
		/* ignore */
	}
}

/** Banner copy for a report. */
export function impostorBannerText(
	report: WatchlistReport,
	handle?: string,
): string {
	const where = handle ? ` for ${handle}` : "";
	switch (report.verdict) {
		case "clean":
			return `Identity key matches canonical${where}.`;
		case "new-handle":
			return `First contact${where} — no key history yet.`;
		case "key-rotated":
			return `Identity key rotated${where} — re-verify out-of-band.`;
		case "impostor-suspected":
			return `IMPOSTOR SUSPECTED${where} — handle presented a never-before-seen key. re-verify before trusting.`;
	}
}
