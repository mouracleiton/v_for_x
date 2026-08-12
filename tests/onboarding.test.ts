import { describe, it, expect, beforeEach } from "vitest";
import {
	nextOnboardPhase,
	dismissOnboard,
	isOnboardDismissed,
	clearOnboardDismiss,
	ONBOARD_STORAGE_KEY,
	DEFAULT_ONBOARD_WITNESS,
} from "@/lib/onboarding";

describe("nextOnboardPhase", () => {
	it("starts at persona", () => {
		expect(
			nextOnboardPhase({
				persona: null,
				hasIdentity: false,
				hasWitness: false,
				hasPackExport: false,
			}),
		).toBe("persona");
	});

	it("advances identity → witness → pack → done", () => {
		expect(
			nextOnboardPhase({
				persona: "journalist",
				hasIdentity: false,
				hasWitness: false,
				hasPackExport: false,
			}),
		).toBe("identity");
		expect(
			nextOnboardPhase({
				persona: "journalist",
				hasIdentity: true,
				hasWitness: false,
				hasPackExport: false,
			}),
		).toBe("witness");
		expect(
			nextOnboardPhase({
				persona: "civilian",
				hasIdentity: true,
				hasWitness: true,
				hasPackExport: false,
			}),
		).toBe("pack");
		expect(
			nextOnboardPhase({
				persona: "civilian",
				hasIdentity: true,
				hasWitness: true,
				hasPackExport: true,
			}),
		).toBe("done");
	});

	it("does not skip earlier gates", () => {
		expect(
			nextOnboardPhase({
				persona: null,
				hasIdentity: true,
				hasWitness: true,
				hasPackExport: true,
			}),
		).toBe("persona");
	});
});

describe("onboard dismiss flag", () => {
	beforeEach(() => {
		clearOnboardDismiss();
	});

	it("round-trips localStorage", () => {
		expect(isOnboardDismissed()).toBe(false);
		dismissOnboard();
		expect(isOnboardDismissed()).toBe(true);
		expect(localStorage.getItem(ONBOARD_STORAGE_KEY)).toBe("1");
		clearOnboardDismiss();
		expect(isOnboardDismissed()).toBe(false);
	});
});

describe("defaults", () => {
	it("has non-empty default witness text under limit", () => {
		expect(DEFAULT_ONBOARD_WITNESS.length).toBeGreaterThan(10);
		expect(DEFAULT_ONBOARD_WITNESS.length).toBeLessThanOrEqual(500);
	});
});
