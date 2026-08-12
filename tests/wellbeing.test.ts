/**
 * Phase 25 C — Operator wellbeing (lib/wellbeing.ts)
 *
 * Local-only: shift/break timers, after-action notes, burnout-aware mission
 * shortening. No phone-home, no content analysis.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
	startShift,
	endShift,
	currentShiftElapsed,
	shouldRecommendBreak,
	activeMsToday,
	burnoutActive,
	addAfterActionNote,
	clearAfterActionNotes,
	loadWellbeing,
	shortenMissionPath,
	resetWellbeing,
	BREAK_THRESHOLD_MS,
	DAILY_BURNOUT_MS,
} from "@/lib/wellbeing";

const SHIFT_STEP = 1000;

describe("wellbeing shift timers", () => {
	beforeEach(() => {
		resetWellbeing();
	});

	it("startShift begins an ongoing session; endShift folds elapsed into activeMs", () => {
		const base = 1_000_000;
		const a = startShift(base);
		expect(a.shift).not.toBeNull();
		expect(a.shift?.endedAt).toBeNull();
		expect(currentShiftElapsed(base + SHIFT_STEP)).toBe(SHIFT_STEP);
		const b = endShift("manual", base + SHIFT_STEP * 5);
		expect(b.shift?.endedAt).toBe(base + SHIFT_STEP * 5);
		expect(b.activeMs).toBe(SHIFT_STEP * 5);
		// After ending, current elapsed is 0.
		expect(currentShiftElapsed(base + SHIFT_STEP * 10)).toBe(0);
	});

	it("startShift is idempotent while a session is ongoing", () => {
		const a = startShift(1_000);
		const b = startShift(2_000);
		expect(b.shift?.startedAt).toBe(a.shift?.startedAt);
	});

	it("endShift is a no-op when no session is ongoing", () => {
		const now = 5_000;
		const before = loadWellbeing(now);
		const after = endShift("manual", now);
		expect(after).toEqual(before);
	});

	it("shouldRecommendBreak fires after BREAK_THRESHOLD_MS", () => {
		startShift(1_000);
		expect(shouldRecommendBreak(1_000 + BREAK_THRESHOLD_MS - 1)).toBe(false);
		expect(shouldRecommendBreak(1_000 + BREAK_THRESHOLD_MS)).toBe(true);
	});

	it("activeMsToday sums accumulated + ongoing", () => {
		startShift(1_000);
		const t = 1_000 + 60_000;
		expect(activeMsToday(t)).toBe(60_000);
	});

	it("burnoutActive fires after DAILY_BURNOUT_MS of active time", () => {
		startShift(1_000);
		expect(burnoutActive(1_000 + DAILY_BURNOUT_MS - 1)).toBe(false);
		expect(burnoutActive(1_000 + DAILY_BURNOUT_MS)).toBe(true);
	});
});

describe("after-action notes", () => {
	beforeEach(() => {
		resetWellbeing();
	});

	it("addAfterActionNote stores a trimmed, capped note", () => {
		const state = addAfterActionNote(
			"  Reflect on the op  ",
			"mission-1",
			1_000,
		);
		expect(state.notes.length).toBe(1);
		expect(state.notes[0].text).toBe("Reflect on the op");
		expect(state.notes[0].ref).toBe("mission-1");
	});

	it("addAfterActionNote ignores empty/whitespace text", () => {
		const state = addAfterActionNote("   ", undefined, 1_000);
		expect(state.notes.length).toBe(0);
	});

	it("notes are most-recent-first and capped", () => {
		for (let i = 0; i < 5; i++)
			addAfterActionNote(`note ${i}`, undefined, 1_000 + i);
		const state = loadWellbeing();
		expect(state.notes[0].text).toBe("note 4");
		expect(state.notes.length).toBe(5);
	});

	it("clearAfterActionNotes empties the list", () => {
		addAfterActionNote("x", undefined, 1_000);
		const state = clearAfterActionNotes();
		expect(state.notes).toEqual([]);
	});
});

describe("shortenMissionPath", () => {
	it("returns full path when no stressor active", () => {
		const steps = ["a", "b", "c"];
		const out = shortenMissionPath(
			{ steps, optionalStep: (_s, i) => i === 2 },
			1_000,
		);
		expect(out.reason).toBe("full");
		expect(out.steps).toEqual(steps);
	});

	it("drops optional steps when duress active", () => {
		const steps = ["a", "b", "c"];
		const out = shortenMissionPath(
			{ steps, optionalStep: (_s, i) => i === 2, duressActive: true },
			1_000,
		);
		expect(out.reason).toBe("duress");
		expect(out.steps).toEqual(["a", "b"]);
	});

	it("keeps at least one step even if all are optional", () => {
		const steps = ["a", "b"];
		const out = shortenMissionPath(
			{ steps, optionalStep: () => true, duressActive: true },
			1_000,
		);
		expect(out.steps.length).toBe(1);
		expect(out.reason).toBe("duress");
	});
});
