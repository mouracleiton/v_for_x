/**
 * Phase 26 B — Sovereignty friction matrix (lib/relationships.ts)
 *
 * sovereigntyFriction() turns sanctions + arms-corridor asymmetry + a static
 * override table into a clean/risk/blocked verdict that DAMPS a roster/mesh
 * weight (never hard-fails). Tests cover: sanction-derived blocked, arms-
 * asymmetry risk, override precedence, and the damping multipliers.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  sovereigntyFriction,
  hasSanction,
  loadFrictionOverrides,
  clearFrictionOverrides,
  FRICTION_MULTIPLIER,
  DEFAULT_FRICTION_OVERRIDES,
  type RelationshipsData,
} from "@/lib/relationships";

function makeData(overrides: Partial<RelationshipsData> = {}): RelationshipsData {
  return {
    meta: { title: "t", description: "t", sources: [], note: "" },
    arms_transfers: [],
    sanctions: [],
    aid_flows: [],
    ...overrides,
  };
}

describe("sovereignty friction matrix", () => {
  beforeEach(() => {
    clearFrictionOverrides();
  });

  it("returns clean (multiplier 1) when no friction signal exists", () => {
    const data = makeData();
    const f = sovereigntyFriction(data, "BRA", "ARG");
    expect(f.level).toBe("clean");
    expect(f.multiplier).toBe(FRICTION_MULTIPLIER.clean);
    expect(f.multiplier).toBe(1);
    expect(f.overridden).toBe(false);
  });

  it("is case-insensitive and trims ISO3 codes", () => {
    const data = makeData();
    const f = sovereigntyFriction(data, " bra ", "arg");
    expect(f.from).toBe("BRA");
    expect(f.to).toBe("ARG");
    expect(f.level).toBe("clean");
  });

  it("treats the same country as clean (no self-friction)", () => {
    const f = sovereigntyFriction(makeData(), "USA", "usa");
    expect(f.level).toBe("clean");
    expect(f.multiplier).toBe(1);
  });

  it("treats a missing ISO3 as clean rather than throwing", () => {
    const f = sovereigntyFriction(makeData(), "", "USA");
    expect(f.level).toBe("clean");
    expect(f.reasons).toContain("missing iso3");
  });

  it("marks a corridor blocked when a sanction exists either direction", () => {
    // Z01/Z02 are synthetic and NOT in the curated default override table,
    // so this exercises the derived sanction path (not the override path).
    const data = makeData({
      sanctions: [
        { imposer_iso3: "Z01", target_iso3: "Z02", type: "comprehensive" },
      ],
    });
    const f = sovereigntyFriction(data, "z01", "z02");
    expect(f.level).toBe("blocked");
    expect(f.multiplier).toBe(FRICTION_MULTIPLIER.blocked);
    expect(f.multiplier).toBe(0);
    expect(hasSanction(data, "Z01", "Z02")).toBe(true);
    expect(f.overridden).toBe(false);
  });

  it("marks blocked on the reverse direction too", () => {
    const data = makeData({
      sanctions: [
        { imposer_iso3: "Z01", target_iso3: "Z02", type: "comprehensive" },
      ],
    });
    const f = sovereigntyFriction(data, "Z02", "Z01");
    expect(f.level).toBe("blocked");
    expect(f.multiplier).toBe(0);
  });

  it("marks risk on a heavy one-way arms-corridor asymmetry", () => {
    const data = makeData({
      // 800 M USD A→B, only 10 M USD B→A → asymmetry
      arms_transfers: [
        { source_iso3: "AAA", target_iso3: "BBB", value_musd: 800, category: "air" },
        { source_iso3: "BBB", target_iso3: "AAA", value_musd: 10, category: "small" },
      ],
    });
    const f = sovereigntyFriction(data, "AAA", "BBB");
    expect(f.level).toBe("risk");
    expect(f.multiplier).toBe(FRICTION_MULTIPLIER.risk);
    expect(f.multiplier).toBe(0.5);
    expect(f.reasons.some((r) => r.includes("asymmetry"))).toBe(true);
  });

  it("override precedence beats the derived sanctions verdict", () => {
    // Sanction says blocked, override says clean → override wins.
    loadFrictionOverrides({ overrides: { "Z01>Z02": { level: "clean", reason: "aid-only waiver" } } });
    const data = makeData({
      sanctions: [{ imposer_iso3: "Z01", target_iso3: "Z02", type: "comprehensive" }],
    });
    const f = sovereigntyFriction(data, "Z01", "Z02");
    expect(f.level).toBe("clean");
    expect(f.overridden).toBe(true);
    expect(f.reasons).toContain("aid-only waiver");
  });

  it("default override table blocks the USA>IRN corridor", () => {
    loadFrictionOverrides(DEFAULT_FRICTION_OVERRIDES);
    const f = sovereigntyFriction(makeData(), "USA", "IRN");
    expect(f.level).toBe("blocked");
    expect(f.multiplier).toBe(0);
    expect(f.overridden).toBe(true);
  });

  it("multipliers are monotonic clean > risk > blocked", () => {
    expect(FRICTION_MULTIPLIER.clean).toBeGreaterThan(FRICTION_MULTIPLIER.risk);
    expect(FRICTION_MULTIPLIER.risk).toBeGreaterThan(FRICTION_MULTIPLIER.blocked);
  });
});
