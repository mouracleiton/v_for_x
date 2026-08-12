import { describe, it, expect } from "vitest";
import {
	classifyJurisdiction,
	flagsForLevel,
	jurisdictionRisk,
	riskBannerText,
	type GovernanceScores,
} from "../lib/jurisdiction-risk";

describe("jurisdiction risk classification", () => {
	it("classifies a strong-democracy / low-corruption country as low", () => {
		const g: GovernanceScores = {
			electoral_democracy_index: 0.9,
			corruption_perceptions_index: 85,
		};
		expect(classifyJurisdiction(g).level).toBe("low");
	});

	it("classifies a closed-autocracy as severe", () => {
		const g: GovernanceScores = { electoral_democracy_index: 0.15 };
		expect(classifyJurisdiction(g).level).toBe("severe");
	});

	it("takes the worst-of across signals (good democracy but very low CPI)", () => {
		const g: GovernanceScores = {
			electoral_democracy_index: 0.8,
			corruption_perceptions_index: 18,
		};
		expect(classifyJurisdiction(g).level).toBe("severe");
	});

	it("defaults to moderate when no governance signal is present", () => {
		const { level, reason } = classifyJurisdiction({});
		expect(level).toBe("moderate");
		expect(reason).toContain("no governance");
	});

	it("flagsForLevel tightens defaults as risk rises", () => {
		expect(flagsForLevel("low").locationMode).toBe("auto");
		expect(flagsForLevel("moderate").shareConfirm).toBe(true);
		expect(flagsForLevel("moderate").stripGeoOnExport).toBe(true);
		expect(flagsForLevel("high").showRiskBanner).toBe(true);
		expect(flagsForLevel("severe").locationMode).toBe("off");
		expect(flagsForLevel("severe").quietHoursDefault).toBe(true);
	});

	it("jurisdictionRisk composes level + flags + reason", () => {
		const r = jurisdictionRisk("SDN", {
			electoral_democracy_index: 0.2,
			corruption_perceptions_index: 22,
		});
		expect(r.iso3).toBe("SDN");
		expect(r.level).toBe("severe");
		expect(r.flags.locationMode).toBe("off");
		expect(r.reason).toContain("democracy");
	});

	it("riskBannerText names the level + the tightened defaults", () => {
		const r = jurisdictionRisk("SDN", { electoral_democracy_index: 0.2 });
		const t = riskBannerText(r);
		expect(t).toContain("SEVERE RISK in SDN");
		expect(t).toContain("location off");
		expect(t).toContain("share asks first");
		expect(t).toContain("network quiet");
	});

	it("low risk produces a banner with no tightened tail", () => {
		const r = jurisdictionRisk("NOR", {
			electoral_democracy_index: 0.9,
			corruption_perceptions_index: 84,
		});
		const t = riskBannerText(r);
		expect(t).toBe("LOW RISK in NOR");
	});

	it("ignores NaN governance fields (treats as absent)", () => {
		expect(classifyJurisdiction({ electoral_democracy_index: NaN }).level).toBe(
			"moderate",
		);
	});

	it("score is 0..100 and rises with severity", () => {
		const low = classifyJurisdiction({ electoral_democracy_index: 0.9 }).score;
		const sev = classifyJurisdiction({ electoral_democracy_index: 0.1 }).score;
		expect(low).toBeLessThan(sev);
		expect(low).toBeGreaterThanOrEqual(0);
		expect(sev).toBeLessThanOrEqual(100);
	});
});
