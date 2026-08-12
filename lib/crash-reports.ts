/**
 * V FOR X — Compartmented Crash Reports (Phase 25 F)
 *
 * Local-only panic reason codes for after-action. A crash report never leaves
 * the device and is compartmentalized: sensitive identifiers are redacted to
 * short category codes so an operator can debug a failure mode without leaking
 * PII, keys, or peer handles into a copy-pasted log.
 *
 * Storage: localStorage at vfx-crash-reports (wipeOnPanic = true via storage-map).
 */

export type CrashCategory =
	| "crypto"
	| "storage"
	| "mesh"
	| "identity"
	| "ui"
	| "data"
	| "unknown";

export interface CrashReport {
	/** Monotonic id (timestamp + random suffix). */
	id: string;
	/** When the crash was recorded (epoch ms). */
	ts: number;
	/** Compartmented category code (no PII). */
	category: CrashCategory;
	/** Short redacted message (PII stripped). */
	message: string;
	/** Optional non-sensitive context (route name, schema version). */
	context?: Record<string, string | number | boolean>;
}

const CRASH_KEY = "vfx-crash-reports";
const MAX_REPORTS = 50;

/** PII / secret scrubbers. Keys/handles/emails replaced with category tokens. */
const SCRUB_PATTERNS: Array<{ re: RegExp; replacement: string }> = [
	{ re: /[A-Za-z0-9+/]{86}==/g, replacement: "[KEY]" }, // base64 SPKI-ish
	{ re: /[0-9a-fA-F]{64}/g, replacement: "[HASH]" }, // sha-256 / priv key hex
	{ re: /[\w.+-]+@[\w-]+\.[\w.-]+/g, replacement: "[EMAIL]" },
	{ re: /VFX[A-Z0-9]+:[^\s]*/g, replacement: "[TOKEN]" },
];

/** Scrub a raw message down to category tokens. */
export function scrubMessage(raw: string): string {
	let out = raw ?? "";
	for (const { re, replacement } of SCRUB_PATTERNS) {
		out = out.replace(re, replacement);
	}
	// Collapse long identifiers that survived.
	out = out.replace(/\b[A-Za-z0-9_-]{20,}\b/g, "[ID]");
	return out.slice(0, 240);
}

/** Classify an error into a compartmented category. */
export function classifyCrash(errorOrMessage: unknown): CrashCategory {
	const msg =
		typeof errorOrMessage === "string"
			? errorOrMessage
			: errorOrMessage instanceof Error
				? errorOrMessage.message
				: String(errorOrMessage ?? "");
	const lower = msg.toLowerCase();
	if (/sign|verify|crypto|subtle|key|signature|ratchet/.test(lower))
		return "crypto";
	if (/storage|idb|indexeddb|localstorage|quota/.test(lower)) return "storage";
	if (/mesh|webrtc|peer|relay|signal/.test(lower)) return "mesh";
	if (/identity|handle|duress|persona/.test(lower)) return "identity";
	if (/render|component|dom|hydrate/.test(lower)) return "ui";
	if (/json|parse|schema|backbone|data/.test(lower)) return "data";
	return "unknown";
}

/** Load local crash reports (newest first). */
export function loadCrashReports(): CrashReport[] {
	if (typeof window === "undefined" || typeof localStorage === "undefined")
		return [];
	try {
		const raw = localStorage.getItem(CRASH_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

/** Persist crash reports (capped to MAX_REPORTS). */
export function saveCrashReports(reports: CrashReport[]): void {
	if (typeof window === "undefined" || typeof localStorage === "undefined")
		return;
	try {
		const capped = reports.slice(0, MAX_REPORTS);
		localStorage.setItem(CRASH_KEY, JSON.stringify(capped));
	} catch {
		/* ignore quota */
	}
}

/**
 * Record a crash locally. Returns the stored report. Never throws.
 * Compartmentalized: the raw message is scrubbed before persistence.
 */
export function recordCrash(
	errorOrMessage: unknown,
	context?: Record<string, string | number | boolean>,
	now = Date.now(),
): CrashReport {
	const category = classifyCrash(errorOrMessage);
	const raw =
		typeof errorOrMessage === "string"
			? errorOrMessage
			: errorOrMessage instanceof Error
				? errorOrMessage.message
				: String(errorOrMessage ?? "");
	const message = scrubMessage(raw);
	const id = `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	const report: CrashReport = { id, ts: now, category, message, context };
	const existing = loadCrashReports();
	saveCrashReports([report, ...existing]);
	return report;
}

/** Clear all crash reports (panic wipe). */
export function clearCrashReports(): void {
	if (typeof window === "undefined" || typeof localStorage === "undefined")
		return;
	try {
		localStorage.removeItem(CRASH_KEY);
	} catch {
		/* ignore */
	}
}

/** Summarize crash counts by category (for an after-action dashboard). */
export function crashSummary(
	reports: CrashReport[],
): Record<CrashCategory, number> {
	const summary: Record<CrashCategory, number> = {
		crypto: 0,
		storage: 0,
		mesh: 0,
		identity: 0,
		ui: 0,
		data: 0,
		unknown: 0,
	};
	for (const r of reports) {
		summary[r.category] = (summary[r.category] ?? 0) + 1;
	}
	return summary;
}
