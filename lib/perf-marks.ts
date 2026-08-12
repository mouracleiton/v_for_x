/**
 * V FOR X — Local-only Performance Marks (Phase 24)
 *
 * "Telemetry that isn't surveillance": optional local perf marks that NEVER
 * leave the device. Uses the Performance API (marks + measures) when available
 * and mirrors into a capped local ring buffer for an operator dashboard.
 *
 * No network, no aggregation server, no phone-home. Export is opt-in and only
 * ever writes a local JSON the operator pastes into a bug report themselves.
 */

export interface PerfMark {
	/** Mark name (e.g. "oracle.search.start"). */
	name: string;
	/** epoch ms. */
	ts: number;
	/** Optional payload (numbers/booleans only — no PII). */
	detail?: Record<string, number | boolean | string>;
}

export interface PerfMeasure {
	/** Measure name. */
	name: string;
	/** Duration in ms. */
	durationMs: number;
	/** Start mark name. */
	startName: string;
	/** End mark name. */
	endName: string;
	/** When the measure was recorded. */
	ts: number;
}

const BUFFER_KEY = "vfx-perf-marks";
const MAX_ENTRIES = 200;

let enabled = false;
const marks = new Map<string, number>();

/** Enable local perf collection (off by default). */
export function enablePerf(): void {
	enabled = true;
}

/** Disable + clear in-memory marks. */
export function disablePerf(): void {
	enabled = false;
	marks.clear();
}

/** Is collection currently enabled? */
export function perfEnabled(): boolean {
	return enabled;
}

/**
 * Record a mark. Uses the native Performance API when present so the browser
 * DevTools timeline shows it too, then mirrors into the local map.
 */
export function mark(name: string, detail?: PerfMark["detail"]): void {
	if (!enabled) return;
	const ts = Date.now();
	marks.set(name, ts);
	if (
		typeof performance !== "undefined" &&
		typeof performance.mark === "function"
	) {
		try {
			performance.mark(name, { detail });
		} catch {
			/* name collisions / unsupported — ignore, the local map is the source of truth */
		}
	}
	appendBuffer({ name, ts, detail });
}

/**
 * Measure between two prior marks. Returns the duration or null if either mark
 * is missing. Also records into the native Performance API.
 */
export function measure(
	name: string,
	startName: string,
	endName: string,
): PerfMeasure | null {
	if (!enabled) return null;
	const start = marks.get(startName);
	const end = marks.get(endName);
	if (start === undefined || end === undefined) return null;
	const durationMs = Math.max(0, end - start);
	const m: PerfMeasure = {
		name,
		durationMs,
		startName,
		endName,
		ts: Date.now(),
	};
	if (
		typeof performance !== "undefined" &&
		typeof performance.measure === "function"
	) {
		try {
			performance.measure(name, startName, endName);
		} catch {
			/* ignore — local record is authoritative */
		}
	}
	appendBuffer(m as unknown as PerfMark);
	return m;
}

/** Convenience: run fn() between start/end marks, return the result. */
export async function trace<T>(
	name: string,
	fn: () => Promise<T> | T,
): Promise<T> {
	const start = `${name}.start`;
	const end = `${name}.end`;
	mark(start);
	try {
		return await fn();
	} finally {
		mark(end);
		measure(name, start, end);
	}
}

function appendBuffer(entry: PerfMark): void {
	if (typeof window === "undefined" || typeof localStorage === "undefined")
		return;
	try {
		const raw = localStorage.getItem(BUFFER_KEY);
		const list = raw ? (JSON.parse(raw) as PerfMark[]) : [];
		list.push(entry);
		// Cap to MAX_ENTRIES, drop oldest.
		const capped =
			list.length > MAX_ENTRIES ? list.slice(list.length - MAX_ENTRIES) : list;
		localStorage.setItem(BUFFER_KEY, JSON.stringify(capped));
	} catch {
		/* ignore quota */
	}
}

/** Read the local ring buffer (newest last). */
export function readPerfBuffer(): PerfMark[] {
	if (typeof window === "undefined" || typeof localStorage === "undefined")
		return [];
	try {
		const raw = localStorage.getItem(BUFFER_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

/** Export the buffer as a JSON string for an operator to paste into a bug report. */
export function exportPerfJson(): string {
	return JSON.stringify(
		{ exportedAt: Date.now(), marks: readPerfBuffer() },
		null,
		2,
	);
}

/** Clear the local perf buffer (opt-out / reset). */
export function clearPerfBuffer(): void {
	marks.clear();
	if (typeof window === "undefined" || typeof localStorage === "undefined")
		return;
	try {
		localStorage.removeItem(BUFFER_KEY);
	} catch {
		/* ignore */
	}
}
