/**
 * V FOR X — Operator Wellbeing (Phase 25 C)
 *
 * "Human cost of running the tool": secondary-trauma / shift timers, after-
 * action notes, and burnout-aware mission shortening. All local-only nudges —
 * no phone-home, no content analysis, no surveillance.
 *
 * Reuses: lib/quiet-hours.ts (NetworkBlockError, loadConfig), lib/missions.ts
 * (MissionId / MissionProgress), lib/ops-journal.ts (logEvent).
 */

import { loadConfig as loadQuietHoursConfig } from "./quiet-hours";

const WELLBEING_KEY = "vfx-wellbeing";

export interface ShiftSession {
	/** When the shift started (epoch ms). */
	startedAt: number;
	/** When the shift ended (epoch ms, null if ongoing). */
	endedAt: number | null;
	/** Reason the shift ended, if any. */
	endReason?: "manual" | "quiet-hours" | "break-reached";
}

export interface AfterActionNote {
	/** Monotonic id. */
	id: string;
	/** When the note was recorded. */
	ts: number;
	/** Free-text operator reflection (stays on device, never analyzed). */
	text: string;
	/** Optional bound: mission id or route the note refers to. */
	ref?: string;
}

export interface WellbeingState {
	/** Current/last shift session. */
	shift: ShiftSession | null;
	/** Accumulated active-ms since last reset of the day bucket. */
	activeMs: number;
	/** Epoch ms when activeMs was last normalized (day boundary). */
	dayBucket: number;
	/** Private after-action notes (most-recent first). */
	notes: AfterActionNote[];
}

/** Shift length beyond which a break is recommended (ms). */
export const BREAK_THRESHOLD_MS = 90 * 60 * 1000; // 90 min
/** Daily active-time beyond which burnout shortening kicks in (ms). */
export const DAILY_BURNOUT_MS = 6 * 60 * 60 * 1000; // 6h
const MAX_NOTES = 100;

function emptyState(now: number): WellbeingState {
	return { shift: null, activeMs: 0, dayBucket: startOfDay(now), notes: [] };
}

function startOfDay(ts: number): number {
	const d = new Date(ts);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

/** Load persisted wellbeing state. */
export function loadWellbeing(now: number = Date.now()): WellbeingState {
	if (typeof window === "undefined" || typeof localStorage === "undefined") {
		return emptyState(now);
	}
	try {
		const raw = localStorage.getItem(WELLBEING_KEY);
		if (!raw) return emptyState(now);
		const parsed = JSON.parse(raw) as Partial<WellbeingState>;
		const base = emptyState(now);
		const state: WellbeingState = {
			shift: parsed.shift ?? base.shift,
			activeMs: parsed.activeMs ?? 0,
			dayBucket: parsed.dayBucket ?? base.dayBucket,
			notes: Array.isArray(parsed.notes)
				? parsed.notes.slice(0, MAX_NOTES)
				: [],
		};
		return rolloverDay(state, now);
	} catch {
		return emptyState(Date.now());
	}
}

/** Persist wellbeing state. */
export function saveWellbeing(state: WellbeingState): void {
	if (typeof window === "undefined" || typeof localStorage === "undefined")
		return;
	try {
		localStorage.setItem(WELLBEING_KEY, JSON.stringify(state));
	} catch {
		/* ignore quota */
	}
}

/** Roll the daily bucket over at the local day boundary. */
export function rolloverDay(
	state: WellbeingState,
	now = Date.now(),
): WellbeingState {
	const today = startOfDay(now);
	if (state.dayBucket === today) return state;
	return { ...state, activeMs: 0, dayBucket: today };
}

/** Start a shift session (no-op if one is already ongoing). */
export function startShift(now = Date.now()): WellbeingState {
	const state = rolloverDay(loadWellbeing(now), now);
	if (state.shift && state.shift.endedAt === null) return state;
	const next: WellbeingState = {
		...state,
		shift: { startedAt: now, endedAt: null },
	};
	saveWellbeing(next);
	return next;
}

/** End the current shift, folding elapsed time into activeMs. */
export function endShift(
	reason: ShiftSession["endReason"] = "manual",
	now = Date.now(),
): WellbeingState {
	const state = rolloverDay(loadWellbeing(now), now);
	if (!state.shift || state.shift.endedAt !== null) return state;
	const elapsed = now - state.shift.startedAt;
	const next: WellbeingState = {
		...state,
		shift: { ...state.shift, endedAt: now, endReason: reason },
		activeMs: state.activeMs + Math.max(0, elapsed),
	};
	saveWellbeing(next);
	return next;
}

/** Elapsed ms of the current ongoing shift (0 if none). */
export function currentShiftElapsed(now = Date.now()): number {
	const state = loadWellbeing(now);
	if (!state.shift || state.shift.endedAt !== null) return 0;
	return Math.max(0, now - state.shift.startedAt);
}

/** True when the current shift has run long enough to recommend a break. */
export function shouldRecommendBreak(now = Date.now()): boolean {
	return currentShiftElapsed(now) >= BREAK_THRESHOLD_MS;
}

/** Total active ms today (ongoing shift + accumulated). */
export function activeMsToday(now = Date.now()): number {
	const state = rolloverDay(loadWellbeing(now), now);
	return state.activeMs + currentShiftElapsed(now);
}

/** True when daily active time crosses the burnout threshold. */
export function burnoutActive(now = Date.now()): boolean {
	return activeMsToday(now) >= DAILY_BURNOUT_MS;
}

/** Add a private after-action note (stays on device, never analyzed). */
export function addAfterActionNote(
	text: string,
	ref?: string,
	now = Date.now(),
): WellbeingState {
	const state = rolloverDay(loadWellbeing(now), now);
	const trimmed = (text ?? "").trim();
	if (!trimmed) return state;
	const note: AfterActionNote = {
		id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
		ts: now,
		text: trimmed.slice(0, 2000),
		ref: ref ? String(ref).slice(0, 80) : undefined,
	};
	const next: WellbeingState = {
		...state,
		notes: [note, ...state.notes].slice(0, MAX_NOTES),
	};
	saveWellbeing(next);
	return next;
}

/** Clear all after-action notes. */
export function clearAfterActionNotes(): WellbeingState {
	const state = loadWellbeing();
	const next = { ...state, notes: [] };
	saveWellbeing(next);
	return next;
}

/**
 * Burnout-aware mission shortening: when duress or quiet-hours or daily-
 * burnout is active, suggest a SHORTER mission path (fewer steps). This is a
 * pure suggestion function over an input path — it does not mutate missions.
 *
 * "Shorter" = drop optional tail steps. `optionalStep` marks a step droppable.
 */
export interface ShortenInput<TStep> {
	/** Ordered mission steps. */
	steps: TStep[];
	/** True when a step is optional and may be dropped to shorten the path. */
	optionalStep: (step: TStep, index: number) => boolean;
	/** True when duress mode is currently active. */
	duressActive?: boolean;
}

/**
 * Returns the (possibly shortened) step list + why. When no shortening is
 * needed, returns the input steps unchanged with reason "full".
 */
export function shortenMissionPath<TStep>(
	input: ShortenInput<TStep>,
	now = Date.now(),
): { steps: TStep[]; reason: "full" | "duress" | "quiet-hours" | "burnout" } {
	const quiet = loadQuietHoursConfig().enabled;
	const burnout = burnoutActive(now);
	if (!input.duressActive && !quiet && !burnout) {
		return { steps: input.steps, reason: "full" };
	}
	const reason = input.duressActive
		? "duress"
		: quiet
			? "quiet-hours"
			: "burnout";
	// Keep all non-optional steps; drop optional ones to shorten.
	const kept = input.steps.filter((s, i) => !input.optionalStep(s, i));
	// Never return an empty path — if everything was optional, keep the first.
	const steps = kept.length > 0 ? kept : input.steps.slice(0, 1);
	return { steps, reason };
}

/** Reset all wellbeing data (panic wipe). */
export function resetWellbeing(): void {
	if (typeof window === "undefined" || typeof localStorage === "undefined")
		return;
	try {
		localStorage.removeItem(WELLBEING_KEY);
	} catch {
		/* ignore */
	}
}
