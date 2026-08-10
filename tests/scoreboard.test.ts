import { describe, it, expect } from "vitest";
import {
  buildScoreboard,
  regionalVelocity,
  flagEmoji,
  directionColor,
  directionIcon,
  gradeColor,
  type Direction,
} from "../lib/scoreboard";
import type { WorldBackbone } from "../lib/types";

const mockBackbone = {
  countries: [
    { iso3: "NOR", name_en: "Norway", region: "Europe", subregion: "Northern Europe", population_m: 5, iso2: "NO", hunger: { undernourishment_pct: 2.5 }, conflict: { intensity_1to5: 0 }, governance: { electoral_democracy_index: 0.9 }, poverty: { headcount_365_pct: 0.5 }, health: { child_mortality_under5_per1k: 3, life_expectancy: 83 }, military: { pct_gdp: 1.5 }, health_dup: null },
    { iso3: "YEM", name_en: "Yemen", region: "Asia", subregion: "Western Asia", population_m: 34, iso2: "YE", hunger: { undernourishment_pct: 45 }, conflict: { intensity_1to5: 4 }, governance: { electoral_democracy_index: 0.15 }, poverty: { headcount_365_pct: 65 }, health: { child_mortality_under5_per1k: 60, life_expectancy: 65 }, military: { pct_gdp: 0 } },
    { iso3: "USA", name_en: "United States", region: "Americas", subregion: "Northern America", population_m: 333, iso2: "US", hunger: { undernourishment_pct: 3 }, conflict: { intensity_1to5: 0 }, governance: { electoral_democracy_index: 0.75 }, poverty: { headcount_365_pct: 1 }, health: { child_mortality_under5_per1k: 7, life_expectancy: 78 }, military: { pct_gdp: 3.5 } },
    { iso3: "SOM", name_en: "Somalia", region: "Africa", subregion: "Eastern Africa", population_m: 17, iso2: "SO", hunger: { undernourishment_pct: 50 }, conflict: { intensity_1to5: 3 }, governance: { electoral_democracy_index: 0.1 }, poverty: { headcount_365_pct: 70 }, health: { child_mortality_under5_per1k: 90, life_expectancy: 55 }, military: { pct_gdp: 0 } },
  ],
  metadata: { schema_version: "1", title: "", description: "", created: "", standard: "", sources: [], total_countries: 4, license: "", data_layers: [], last_updated: "" },
} as unknown as WorldBackbone;

describe("scoreboard", () => {
  describe("buildScoreboard", () => {
    it("produces entries for all countries", () => {
      const result = buildScoreboard(mockBackbone);
      expect(result.entries.length).toBe(4);
    });

    it("sorts by velocity score descending", () => {
      const result = buildScoreboard(mockBackbone);
      for (let i = 1; i < result.entries.length; i++) {
        expect(result.entries[i - 1].velocityScore).toBeGreaterThanOrEqual(
          result.entries[i].velocityScore,
        );
      }
    });

    it("each entry has signals", () => {
      const result = buildScoreboard(mockBackbone);
      for (const e of result.entries) {
        expect(e.signals.length).toBeGreaterThan(0);
      }
    });

    it("each entry has a grade", () => {
      const result = buildScoreboard(mockBackbone);
      for (const e of result.entries) {
        expect(e.grade).toBeTruthy();
        expect(e.grade).toMatch(/^[A-F][+-]?$/);
      }
    });

    it("best performer has highest velocity", () => {
      const result = buildScoreboard(mockBackbone);
      expect(result.bestPerformer).toBeTruthy();
      expect(result.bestPerformer!.velocityScore).toBeGreaterThanOrEqual(
        result.entries[0].velocityScore,
      );
    });

    it("identifies improving and deteriorating groups", () => {
      const result = buildScoreboard(mockBackbone);
      // Norway should be improving, Yemen/Somalia deteriorating
      expect(result.improving.some((e) => e.iso3 === "NOR")).toBe(true);
      expect(result.deteriorating.some((e) => e.iso3 === "YEM" || e.iso3 === "SOM")).toBe(true);
    });

    it("global direction is determined", () => {
      const result = buildScoreboard(mockBackbone);
      expect(["improving", "stagnant", "deteriorating"]).toContain(result.globalDirection);
    });
  });

  describe("regionalVelocity", () => {
    it("produces regional aggregates", () => {
      const result = buildScoreboard(mockBackbone);
      const regions = regionalVelocity(result.entries);
      expect(regions.length).toBeGreaterThan(0);
      for (const r of regions) {
        expect(r.region).toBeTruthy();
        expect(typeof r.avgVelocity).toBe("number");
      }
    });
  });

  describe("flagEmoji", () => {
    it("converts ISO2 to emoji", () => {
      expect(flagEmoji("US")).toBe("🇺🇸");
      expect(flagEmoji("NO")).toBe("🇳🇴");
      expect(flagEmoji("BR")).toBe("🇧🇷");
    });

    it("returns white flag for invalid codes", () => {
      expect(flagEmoji("")).toBe("🏳️");
      expect(flagEmoji("X")).toBe("🏳️");
    });
  });

  describe("direction helpers", () => {
    it("directionColor returns CSS variables", () => {
      expect(directionColor("improving")).toContain("var(--");
      expect(directionColor("deteriorating")).toContain("var(--");
      expect(directionColor("stagnant")).toContain("var(--");
    });

    it("directionIcon returns arrows", () => {
      expect(directionIcon("improving")).toBe("▲");
      expect(directionIcon("deteriorating")).toBe("▼");
      expect(directionIcon("stagnant")).toBe("■");
    });

    it("gradeColor differentiates good and bad grades", () => {
      expect(gradeColor("A+")).not.toBe(gradeColor("F"));
      expect(gradeColor("A+")).toBe(gradeColor("B"));
    });
  });
});
