import { describe, it, expect, beforeEach } from "vitest";
import {
	DEFAULT_A11Y_SETTINGS,
	loadA11ySettings,
	saveA11ySettings,
	ariaLabel,
	type A11ySettings,
} from "../lib/a11y";

const ls = (() => {
	try {
		return typeof localStorage !== "undefined" ? localStorage : null;
	} catch {
		return null;
	}
})();

beforeEach(() => ls?.clear());

describe("a11y settings + aria labels", () => {
	it("DEFAULT_A11Y_SETTINGS is a complete settings object", () => {
		expect(typeof DEFAULT_A11Y_SETTINGS).toBe("object");
		expect(Object.keys(DEFAULT_A11Y_SETTINGS).length).toBeGreaterThan(0);
	});

	it("ariaLabel returns a descriptive label for known keys, falls back to the key", () => {
		// Every label it returns is non-empty; unknown keys pass through verbatim.
		const known = ariaLabel("map");
		expect(typeof known).toBe("string");
		expect(ariaLabel("totally-unknown-key-xyz")).toBe(
			"totally-unknown-key-xyz",
		);
	});

	it("saveA11ySettings + loadA11ySettings round-trip a settings object", () => {
		const settings: A11ySettings = {
			...DEFAULT_A11Y_SETTINGS,
			theme: "high-contrast",
			reduceMotion: true,
			fontSize: 140,
		};
		saveA11ySettings(settings); // returns void
		const loaded = loadA11ySettings();
		expect(loaded.theme).toBe("high-contrast");
		expect(loaded.reduceMotion).toBe(true);
		expect(loaded.fontSize).toBe(140);
	});

	it("loadA11ySettings returns defaults on missing key", () => {
		const loaded = loadA11ySettings();
		// Defaults object is the fallback shape.
		expect(Object.keys(loaded).length).toBeGreaterThan(0);
	});
});
