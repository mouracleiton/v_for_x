import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  levelFromXP,
  xpForLevel,
  xpForNextLevel,
  trackCountryVisit,
  trackDossierRead,
  trackStoryComplete,
  trackCampaignGenerated,
  trackDimensionExplored,
  checkBadges,
  getBadgeProgress,
  getAllBadges,
  getBadgesByTier,
  getProgress,
  resetProgress,
  generateCertificate,
  verifyCertificate,
  exportCertificate,
} from "../lib/gamification";

const memory: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => memory[key] ?? null,
  setItem: (key: string, value: string) => { memory[key] = value; },
  removeItem: (key: string) => { delete memory[key]; },
  clear: () => { for (const k of Object.keys(memory)) delete memory[k]; },
};
vi.stubGlobal("localStorage", localStorageMock);

beforeEach(() => {
  for (const k of Object.keys(memory)) delete memory[k];
  resetProgress();
});

describe("gamification — XP / level math", () => {
  it("starts at level 1 with 0 XP", () => {
    expect(levelFromXP(0)).toBe(1);
    expect(xpForLevel(1)).toBe(0);
  });

  it("requires 100 XP for level 2 and grows monotonically", () => {
    expect(xpForLevel(2)).toBe(100);
    expect(levelFromXP(99)).toBe(1);
    expect(levelFromXP(100)).toBe(2);
    for (let lvl = 2; lvl < 30; lvl++) {
      expect(xpForLevel(lvl)).toBeLessThan(xpForLevel(lvl + 1));
    }
  });

  it("computes a positive XP gap to the next level", () => {
    expect(xpForNextLevel(1)).toBe(100);
    expect(xpForNextLevel(2)).toBeGreaterThan(0);
  });
});

describe("gamification — tracking", () => {
  it("awards XP only once per country", () => {
    trackCountryVisit("BRA");
    expect(getProgress().xp).toBe(5);
    expect(getProgress().countriesVisited).toHaveLength(1);
    trackCountryVisit("BRA");
    expect(getProgress().xp).toBe(5);
    expect(getProgress().countriesVisited).toHaveLength(1);
  });

  it("tracks dossiers, stories, and dimensions with dedup", () => {
    trackDossierRead("bashar");
    trackDossierRead("bashar");
    trackStoryComplete("s1");
    trackStoryComplete("s1");
    trackDimensionExplored("hunger");
    trackDimensionExplored("hunger");
    const p = getProgress();
    expect(p.dossiersRead).toHaveLength(1);
    expect(p.storiesCompleted).toHaveLength(1);
    expect(p.dimensionsExplored).toHaveLength(1);
    expect(p.xp).toBe(15 + 20 + 3);
  });

  it("always awards XP for campaign generation", () => {
    trackCampaignGenerated();
    trackCampaignGenerated();
    const p = getProgress();
    expect(p.campaignsGenerated).toBe(2);
    expect(p.xp).toBe(50);
  });
});

describe("gamification — badges", () => {
  it("awards first-steps after one visit", () => {
    trackCountryVisit("BRA");
    const earned = checkBadges();
    expect(earned.map((b) => b.id)).toContain("first-steps");
    expect(earned[0].earnedAt).toBeTypeOf("number");
  });

  it("does not re-award an earned badge", () => {
    trackCountryVisit("BRA");
    checkBadges();
    const second = checkBadges();
    expect(second).toHaveLength(0);
  });

  it("awards explorer at 10 visits", () => {
    for (let i = 0; i < 10; i++) trackCountryVisit(`C${i}`);
    const earned = checkBadges();
    expect(earned.map((b) => b.id)).toContain("explorer");
  });

  it("reports badge progress percentages", () => {
    expect(getBadgeProgress("explorer")).toEqual({ progress: 0, target: 10, pct: 0 });
    for (let i = 0; i < 5; i++) trackCountryVisit(`D${i}`);
    expect(getBadgeProgress("explorer")).toEqual({ progress: 5, target: 10, pct: 50 });
  });

  it("exposes 21 badge definitions with unique ids", () => {
    const all = getAllBadges();
    expect(all).toHaveLength(21);
    const ids = all.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(all.some((b) => b.earnedAt)).toBe(false);
  });

  it("groups badges by tier", () => {
    const byTier = getBadgesByTier();
    expect(Object.keys(byTier)).toEqual(["bronze", "silver", "gold", "platinum"]);
    expect(byTier.bronze.map((b) => b.id)).toContain("first-steps");
  });
});

describe("gamification — certificates", () => {
  it("returns null when the badge was never earned", async () => {
    const cert = await generateCertificate("explorer");
    expect(cert).toBeNull();
  });

  it("generates a tamper-evident certificate for an earned badge", async () => {
    trackCountryVisit("BRA");
    checkBadges();
    const cert = await generateCertificate("first-steps");
    expect(cert).not.toBeNull();
    expect(cert!.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(cert!.xp).toBe(5);
    expect(cert!.countriesVisited).toBe(1);
    expect(await verifyCertificate(cert!)).toBe(true);
  });

  it("detects tampering", async () => {
    trackCountryVisit("BRA");
    checkBadges();
    const cert = await generateCertificate("first-steps");
    const tampered = { ...cert!, xp: 99999 };
    expect(await verifyCertificate(tampered)).toBe(false);
  });

  it("exports as JSON", async () => {
    trackCountryVisit("BRA");
    checkBadges();
    const cert = await generateCertificate("first-steps");
    const json = exportCertificate(cert!);
    expect(JSON.parse(json).badgeId).toBe("first-steps");
  });
});
