import { describe, it, expect } from "vitest";
import backbone from "../data/world_backbone.json";
import type { WorldBackbone } from "../lib/types";
import { generateCountryNarrative } from "../lib/narrative";

const data = backbone as WorldBackbone;

describe("generateCountryNarrative", () => {
  it("produces a narrative for every country in the dataset", () => {
    for (const c of data.countries) {
      const n = generateCountryNarrative(c);
      expect(n.iso3).toBe(c.iso3);
      expect(n.dataGrounded).toBe(true);
      expect(n.sentences.length).toBeGreaterThan(0);
      expect(n.summary.length).toBeGreaterThan(0);
    }
  });

  it("always returns at least one sentence even when data is empty", () => {
    const n = generateCountryNarrative({
      iso3: "ZZZ",
      name_en: "Nowhere",
      subregion: "Unknown",
      region: "Unknown",
      population_m: null,
    } as never);
    expect(n.sentences.length).toBe(1);
    expect(n.summary).toContain("V FOR X dataset");
  });

  it("includes population in the first sentence when known", () => {
    const withPop = data.countries.find((c) => c.population_m != null);
    if (withPop) {
      const n = generateCountryNarrative(withPop);
      expect(n.sentences[0].text).toContain("million people");
    }
  });

  it("every sentence carries a dimension tag", () => {
    const c = data.countries[0];
    const n = generateCountryNarrative(c);
    for (const s of n.sentences) {
      expect(s.dimension.length).toBeGreaterThan(0);
    }
  });
});
