import { describe, it, expect, beforeEach } from "vitest";
import {
	THREAT_MODELS,
	getThreatModel,
	blendFlags,
	effectiveThreatModel,
	loadPersona,
	savePersona,
	type ThreatPersona,
} from "../lib/threat-model";
import type { FeatureFlags } from "../lib/jurisdiction-risk";

const ls = (() => {
	try {
		return typeof localStorage !== "undefined" ? localStorage : null;
	} catch {
		return null;
	}
})();

beforeEach(() => ls?.clear());

const PER: FeatureFlags = {
	locationMode: "manual",
	shareConfirm: true,
	quietHoursDefault: false,
	stripGeoOnExport: true,
	showRiskBanner: false,
};

describe("threat-model picker", () => {
	it("THREAT_MODELS exposes the named personas", () => {
		const ids = THREAT_MODELS.map((m) => m.id);
		expect(ids).toEqual(
			expect.arrayContaining([
				"journalist",
				"protester",
				"aid",
				"observer",
				"custom",
			]),
		);
	});

	it("getThreatModel returns the matching preset, falls back to custom", () => {
		expect(getThreatModel("protester").label).toBe("Protester");
		expect(getThreatModel("custom").id).toBe("custom");
		expect(getThreatModel("nope" as ThreatPersona).id).toBe("custom");
	});

	it("journalist + protester default locationMode to off", () => {
		expect(getThreatModel("journalist").flags.locationMode).toBe("off");
		expect(getThreatModel("protester").flags.locationMode).toBe("off");
	});

	it("blendFlags takes the stricter value per flag", () => {
		const strict: FeatureFlags = {
			locationMode: "off",
			shareConfirm: true,
			quietHoursDefault: true,
			stripGeoOnExport: true,
			showRiskBanner: true,
		};
		const lax: FeatureFlags = {
			locationMode: "auto",
			shareConfirm: false,
			quietHoursDefault: false,
			stripGeoOnExport: false,
			showRiskBanner: false,
		};
		const blended = blendFlags(lax, strict);
		expect(blended.locationMode).toBe("off");
		expect(blended.shareConfirm).toBe(true);
		expect(blended.quietHoursDefault).toBe(true);
		expect(blended.showRiskBanner).toBe(true);
	});

	it("blendFlags is commutative (order doesn't matter)", () => {
		const a = blendFlags(PER, getThreatModel("protester").flags);
		const b = blendFlags(getThreatModel("protester").flags, PER);
		expect(a).toEqual(b);
	});

	it("effectiveThreatModel blends persona with jurisdiction (worst-of)", () => {
		const jurFlags: FeatureFlags = {
			locationMode: "off",
			shareConfirm: true,
			quietHoursDefault: true,
			stripGeoOnExport: true,
			showRiskBanner: true,
		};
		const eff = effectiveThreatModel("aid", jurFlags, "severe");
		// aid defaults locationMode manual, jurisdiction says off → off wins.
		expect(eff.flags.locationMode).toBe("off");
		expect(eff.jurisdictionLevel).toBe("severe");
		expect(eff.summary).toContain("Aid operator");
		expect(eff.summary).toContain("severe");
	});

	it("effectiveThreatModel without jurisdiction returns raw persona flags", () => {
		const eff = effectiveThreatModel("journalist");
		expect(eff.flags.locationMode).toBe("off");
		expect(eff.jurisdictionLevel).toBe("low");
	});

	it("journalist + protester set wipeOnIdle + sealedSender", () => {
		expect(getThreatModel("journalist").wipeOnIdle).toBe(true);
		expect(getThreatModel("journalist").sealedSender).toBe(true);
		expect(getThreatModel("protester").wipeOnIdle).toBe(true);
		expect(getThreatModel("aid").wipeOnIdle).toBe(false);
	});

	it("savePersona + loadPersona round-trip", () => {
		expect(savePersona("protester")).toBe(true);
		expect(loadPersona()).toBe("protester");
	});

	it("loadPersona returns custom on missing/corrupt key", () => {
		expect(loadPersona()).toBe("custom");
		ls?.setItem("vfx-threat-model", "not json");
		expect(loadPersona()).toBe("custom");
	});
});
