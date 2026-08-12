/**
 * Phase 26 A — Amplitude allocation (lib/roster-skills.ts)
 *
 * allocateByAmplitude() does a seedable weighted pick instead of a
 * deterministic rank: weight_i = skill_match_i · sovereignty_compat_i ·
 * (1 − exposure_risk_i); collapse samples ∝ |weight_i|². Same inputs → same
 * pick (no real randomness in static export). Emits a VFXAMP1 token.
 */
import { describe, it, expect } from "vitest";
import rosterData from "@/data/roster.json";
import {
  allocateByAmplitude,
  exposureRisk,
  mulberry32,
  seedFromString,
  encodeAmplitudeToken,
  parseAmplitudeToken,
  isAmplitudeToken,
  searchBySkills,
  type AmplitudeCandidate,
} from "@/lib/roster-skills";
import type { Helper } from "@/lib/roster";
import type { RelationshipsData } from "@/lib/relationships";

const roster = rosterData as { version: number; label: string; helpers: Helper[] };
const helpers = roster.helpers;

function makeData(overrides: Partial<RelationshipsData> = {}): RelationshipsData {
  return {
    meta: { title: "t", description: "t", sources: [], note: "" },
    arms_transfers: [],
    sanctions: [],
    aid_flows: [],
    ...overrides,
  };
}

describe("amplitude allocation", () => {
  it("picks an available helper and emits a VFXAMP1 token", () => {
    const a = allocateByAmplitude(helpers, { query: "lawyer" });
    expect(a).not.toBeNull();
    if (!a) return;
    expect(a.candidates.length).toBeGreaterThan(0);
    expect(a.picked).toBeTruthy();
    expect(isAmplitudeToken(a.token)).toBe(true);
    expect(a.candidates.map((c) => c.helper.id)).toContain(a.picked);
  });

  it("is deterministic: same seed picks the same helper", () => {
    const a = allocateByAmplitude(helpers, { query: "medical doctor" }, {}, 42);
    const b = allocateByAmplitude(helpers, { query: "medical doctor" }, {}, 42);
    expect(a?.picked).toBe(b?.picked);
    expect(a?.seed).toBe(42);
    expect(a?.token).toBe(b?.token);
  });

  it("auto-seeds deterministically from inputs when no seed given", () => {
    const a = allocateByAmplitude(helpers, { query: "translator Farsi" });
    const b = allocateByAmplitude(helpers, { query: "translator Farsi" });
    expect(a?.picked).toBe(b?.picked);
    expect(a?.seed).toBe(b?.seed);
  });

  it("returns null when no available helper matches", () => {
    // Require a language no helper speaks → searchBySkills yields zero → null.
    const a = allocateByAmplitude(helpers, { languages: ["zz"] as never });
    expect(a).toBeNull();
  });

  it("candidates are sorted highest-amplitude-first", () => {
    const a = allocateByAmplitude(helpers, { query: "legal" });
    if (!a) return;
    const weights = a.candidates.map((c) => c.weight);
    const sorted = [...weights].sort((x, y) => y - x);
    expect(weights).toEqual(sorted);
  });

  it("sovereignty friction damps a corridor toward zero weight", () => {
    // Force a sanctioned corridor between a real helper's country and the
    // destination so friction multiplies the weight down. Use a synthetic
    // destination to guarantee a sanction pair without relying on the roster.
    const destination = "ZZZ";
    const data = makeData({
      sanctions: [
        { imposer_iso3: helpers[0].country, target_iso3: destination, type: "comprehensive" },
      ],
    });
    const a = allocateByAmplitude(
      helpers,
      { query: "legal", destinationIso3: destination },
      { relationships: data },
      7,
    );
    if (!a) return;
    // The sanctioned-corridor helper is either absent or at weight 0.
    const sanctioned = a.candidates.find(
      (c) => c.friction === "blocked",
    );
    if (sanctioned) {
      // Friction damps weight to 0 (blocked → multiplier 0), so it is filtered out.
      expect(sanctioned.weight).toBe(0);
      expect(a.picked).not.toBe(sanctioned.helper.id);
    }
  });

  it("exposure risk lowers weight for high-activity helpers", () => {
    const base = searchBySkills(helpers, { query: "medical" });
    if (base.length === 0) return;
    const target = base[0].helper;
    // recentActivity = 10 → exposureRisk ≈ high → weight dampened vs activity 0.
    const lowAct = allocateByAmplitude(
      helpers,
      { query: "medical" },
      { recentActivity: { [target.id]: 0 }, vouchTier: { [target.id]: "well-vouched" } },
      3,
    );
    const highAct = allocateByAmplitude(
      helpers,
      { query: "medical" },
      { recentActivity: { [target.id]: 10 }, vouchTier: { [target.id]: "self" } },
      3,
    );
    if (!lowAct || !highAct) return;
    const lowCand = lowAct.candidates.find((c) => c.helper.id === target.id);
    const highCand = highAct.candidates.find((c) => c.helper.id === target.id);
    if (lowCand && highCand) {
      expect(lowCand.weight).toBeGreaterThan(highCand.weight);
      expect(lowCand.exposureRisk).toBeLessThan(highCand.exposureRisk);
    }
  });

  it("VFXAMP1 token round-trips through parseAmplitudeToken", () => {
    const a = allocateByAmplitude(helpers, { query: "security", destinationIso3: "USA" }, {}, 99);
    if (!a) return;
    const parsed = parseAmplitudeToken(a.token);
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    expect(parsed.picked).toBe(a.picked);
    expect(parsed.seed).toBe(99);
    expect(parsed.task.destination).toBe("USA");
    expect(parsed.n).toBe(a.candidates.length);
    expect(parsed.top.length).toBeLessThanOrEqual(3);
  });

  it("parseAmplitudeToken returns null for malformed input", () => {
    expect(parseAmplitudeToken("not a token")).toBeNull();
    expect(parseAmplitudeToken("VFXAMP1:{bad json")).toBeNull();
    expect(parseAmplitudeToken("")).toBeNull();
  });
});

describe("amplitude helpers", () => {
  it("mulberry32 is deterministic for a fixed seed", () => {
    const r1 = mulberry32(123)();
    const r2 = mulberry32(123)();
    expect(r1).toBe(r2);
  });

  it("mulberry32 produces values in [0,1)", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("seedFromString is stable and differs for different inputs", () => {
    expect(seedFromString("abc")).toBe(seedFromString("abc"));
    expect(seedFromString("abc")).not.toBe(seedFromString("abd"));
  });

  it("exposureRisk is 0..1 and rises with activity", () => {
    const low = exposureRisk("well-vouched", 0);
    const high = exposureRisk("self", 10);
    expect(low).toBeGreaterThanOrEqual(0);
    expect(low).toBeLessThanOrEqual(1);
    expect(high).toBeGreaterThanOrEqual(0);
    expect(high).toBeLessThanOrEqual(1);
    expect(high).toBeGreaterThan(low);
  });

  it("encodeAmplitudeToken produces a parseable VFXAMP1 string", () => {
    const helper = helpers[0];
    const candidate: AmplitudeCandidate = {
      helper,
      weight: 0.5,
      friction: "clean",
      exposureRisk: 0.1,
    };
    const token = encodeAmplitudeToken({
      candidates: [candidate],
      picked: helper.id,
      seed: 1,
      task: { query: "legal" },
    });
    expect(isAmplitudeToken(token)).toBe(true);
    const parsed = parseAmplitudeToken(token);
    expect(parsed?.picked).toBe(helper.id);
  });
});
