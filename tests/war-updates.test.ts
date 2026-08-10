import { describe, it, expect } from "vitest";
import warDataRaw from "../data/war-updates.json";
import backbone from "../data/world_backbone.json";
import type { WorldBackbone } from "../lib/types";
import {
  SEVERITY_META,
  SOURCE_TYPE_LABELS,
  formatDate,
  freshnessLabel,
  daysAgo,
  sortTheaters,
  getTheater,
  getSource,
  allDevelopments,
  theatersByRegion,
  theatersBySource,
  severityCounts,
  countDevelopments,
  countRegions,
  theaterToCountries,
  activeSourceIds,
  type WarUpdatesData,
} from "../lib/war-updates";

const warData = warDataRaw as unknown as WarUpdatesData;
const data = backbone as WorldBackbone;

describe("war-updates.ts", () => {
  describe("data integrity", () => {
    it("should have 8 sources", () => {
      expect(warData.sources).toHaveLength(8);
      const ids = warData.sources.map((s) => s.id);
      expect(ids).toContain("isw");
      expect(ids).toContain("acled");
      expect(ids).toContain("liveuamap");
      expect(ids).toContain("war-radar");
      expect(ids).toContain("warwatch");
      expect(ids).toContain("war-monitor");
      expect(ids).toContain("war-direct");
      expect(ids).toContain("telegram-archive");
    });

    it("should have unique source ids", () => {
      const ids = warData.sources.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("should have valid source types", () => {
      for (const s of warData.sources) {
        expect(Object.keys(SOURCE_TYPE_LABELS)).toContain(s.type);
      }
    });

    it("should have valid source URLs", () => {
      for (const s of warData.sources) {
        expect(s.url).toMatch(/^https:\/\/[^/]+\//);
      }
    });

    it("should have theaters with valid severity values", () => {
      expect(warData.theaters.length).toBeGreaterThanOrEqual(6);
      for (const t of warData.theaters) {
        expect(["critical", "high", "moderate"]).toContain(t.severity);
      }
    });

    it("should have unique theater ids", () => {
      const ids = warData.theaters.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("should have a latest_report with a URL on every theater", () => {
      for (const t of warData.theaters) {
        expect(t.latest_report.url).toMatch(/^https?:\/\//);
        expect(t.latest_report.title.length).toBeGreaterThan(5);
      }
    });

    it("should have sources_tracking on every theater", () => {
      for (const t of warData.theaters) {
        expect(t.sources_tracking.length).toBeGreaterThan(0);
      }
    });
  });

  describe("formatDate", () => {
    it("should format an ISO date", () => {
      expect(formatDate("2026-08-09")).toBe("Aug 9, 2026");
    });

    it("should handle December", () => {
      expect(formatDate("2026-12-25")).toBe("Dec 25, 2026");
    });

    it("should return the raw string for bad input", () => {
      expect(formatDate("bad")).toBe("bad");
    });
  });

  describe("daysAgo / freshnessLabel", () => {
    it("should compute non-positive days for today", () => {
      const today = new Date().toISOString().slice(0, 10);
      expect(daysAgo(today)).toBeLessThanOrEqual(0);
    });

    it("should label today as today", () => {
      const today = new Date().toISOString().slice(0, 10);
      expect(freshnessLabel(today)).toBe("today");
    });

    it("should label a date 3 days ago", () => {
      const d = new Date();
      d.setDate(d.getDate() - 3);
      expect(freshnessLabel(d.toISOString().slice(0, 10))).toBe("3d ago");
    });
  });

  describe("SEVERITY_META", () => {
    it("should rank critical highest", () => {
      expect(SEVERITY_META.critical.rank).toBeGreaterThan(SEVERITY_META.high.rank);
      expect(SEVERITY_META.high.rank).toBeGreaterThan(SEVERITY_META.moderate.rank);
    });
  });

  describe("sortTheaters", () => {
    it("should sort critical before high before moderate", () => {
      const sorted = sortTheaters(warData.theaters);
      for (let i = 1; i < sorted.length; i++) {
        const prev = SEVERITY_META[sorted[i - 1].severity].rank;
        const cur = SEVERITY_META[sorted[i].severity].rank;
        expect(prev).toBeGreaterThanOrEqual(cur);
      }
    });
  });

  describe("getTheater", () => {
    it("should find a theater by id", () => {
      const t = getTheater(warData, "russia-ukraine");
      expect(t).toBeDefined();
      expect(t?.name).toBe("Russia & Ukraine");
    });

    it("should return undefined for unknown id", () => {
      expect(getTheater(warData, "nope")).toBeUndefined();
    });
  });

  describe("getSource", () => {
    it("should find a source by id", () => {
      const s = getSource(warData, "acled");
      expect(s).toBeDefined();
      expect(s?.short_name).toBe("ACLED");
    });

    it("should return undefined for unknown id", () => {
      expect(getSource(warData, "nope")).toBeUndefined();
    });
  });

  describe("allDevelopments", () => {
    it("should flatten all developments newest first", () => {
      const all = allDevelopments(warData);
      expect(all.length).toBeGreaterThan(0);
      for (let i = 1; i < all.length; i++) {
        expect(all[i - 1].date.localeCompare(all[i].date)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("theatersByRegion", () => {
    it("should find theaters in Africa", () => {
      const t = theatersByRegion(warData, "Africa");
      expect(t.length).toBeGreaterThan(0);
      expect(t.some((x) => x.id === "russia-ukraine")).toBe(true);
    });

    it("should return empty for a non-existent region", () => {
      expect(theatersByRegion(warData, "Atlantis")).toEqual([]);
    });
  });

  describe("theatersBySource", () => {
    it("should find theaters tracked by ISW", () => {
      const t = theatersBySource(warData, "isw");
      expect(t.length).toBeGreaterThan(0);
    });

    it("should find theaters tracked by ACLED", () => {
      const t = theatersBySource(warData, "acled");
      expect(t.length).toBeGreaterThan(0);
    });

    it("should return empty for unknown source", () => {
      expect(theatersBySource(warData, "nope")).toEqual([]);
    });
  });

  describe("activeSourceIds", () => {
    it("should return source ids that track at least one theater", () => {
      const ids = activeSourceIds(warData);
      expect(ids).toContain("isw");
      expect(ids).toContain("acled");
      expect(ids.length).toBeLessThanOrEqual(warData.sources.length);
    });
  });

  describe("severityCounts", () => {
    it("should sum to total theaters", () => {
      const counts = severityCounts(warData);
      const total = counts.critical + counts.high + counts.moderate;
      expect(total).toBe(warData.theaters.length);
    });

    it("should have at least some critical theaters", () => {
      const counts = severityCounts(warData);
      expect(counts.critical).toBeGreaterThan(0);
    });
  });

  describe("countDevelopments / countRegions", () => {
    it("should count all developments", () => {
      expect(countDevelopments(warData)).toBeGreaterThan(0);
    });

    it("should count unique regions", () => {
      const r = countRegions(warData.theaters);
      expect(r).toBeGreaterThanOrEqual(warData.theaters.length);
    });
  });

  describe("theaterToCountries", () => {
    it("should map theater ISO3 links to backbone countries", () => {
      const t = getTheater(warData, "russia-ukraine")!;
      const countries = theaterToCountries(t, data.countries);
      expect(countries.length).toBeGreaterThan(0);
      expect(countries.map((c) => c.iso3)).toContain("RUS");
      expect(countries.map((c) => c.iso3)).toContain("UKR");
    });

    it("should return empty for an unknown ISO3", () => {
      const t = getTheater(warData, "cognitive-warfare")!;
      const countries = theaterToCountries({ ...t, iso3_links: ["ZZZ"] }, data.countries);
      expect(countries).toEqual([]);
    });
  });

  describe("ACLED data", () => {
    it("should have 6 event types", () => {
      expect(warData.acled.event_types).toHaveLength(6);
    });

    it("should have conflict index rankings", () => {
      expect(warData.acled.conflict_index_top.length).toBeGreaterThanOrEqual(8);
      expect(warData.acled.conflict_index_top[0].rank).toBe(1);
      expect(warData.acled.conflict_index_top[0].country).toBe("Palestine");
    });

    it("should have actor types and regions", () => {
      expect(warData.acled.actor_types.length).toBe(8);
      expect(warData.acled.regions.length).toBe(6);
    });

    it("should have monitors", () => {
      expect(warData.acled.monitors.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("WarWatch data", () => {
    it("should have 112 armed conflicts", () => {
      expect(warData.warwatch.counts.total_armed_conflicts).toBe(112);
    });

    it("should have classification categories", () => {
      expect(warData.warwatch.classification_categories.length).toBe(3);
      const codes = warData.warwatch.classification_categories.map((c) => c.code);
      expect(codes).toContain("IAC");
      expect(codes).toContain("NIAC");
    });

    it("should have IHL themes and violation categories", () => {
      expect(warData.warwatch.ihl_themes.length).toBe(3);
      expect(warData.warwatch.violation_categories.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("LiveUAMap data", () => {
    it("should have event categories", () => {
      expect(warData.liveuamap.event_categories.length).toBeGreaterThan(10);
    });

    it("should have color coding", () => {
      expect(warData.liveuamap.color_coding.red).toBeDefined();
      expect(warData.liveuamap.color_coding.blue).toBeDefined();
    });

    it("should have key conflict maps", () => {
      expect(warData.liveuamap.key_conflict_maps.length).toBeGreaterThan(10);
    });
  });

  describe("War-Radar data", () => {
    it("should have 7 conflict types", () => {
      expect(warData.war_radar.conflict_types).toHaveLength(7);
    });

    it("should have 4 severity levels", () => {
      expect(warData.war_radar.severity_levels).toHaveLength(4);
    });

    it("should have RSS feeds", () => {
      expect(warData.war_radar.data_sources.rss_feeds.length).toBe(15);
    });
  });

  describe("War-Monitor data", () => {
    it("should have conflict zones", () => {
      expect(warData.war_monitor.conflict_zones.length).toBeGreaterThan(10);
    });

    it("should have event categories", () => {
      expect(warData.war_monitor.event_categories).toHaveLength(7);
    });
  });

  describe("War.Direct data", () => {
    it("should have conflict day >= 164", () => {
      expect(warData.war_direct.conflict_day).toBeGreaterThanOrEqual(164);
    });

    it("should have coalitions", () => {
      expect(warData.war_direct.coalitions.us_israel_side.members.length).toBeGreaterThan(0);
      expect(warData.war_direct.coalitions.iran_axis_side.members.length).toBeGreaterThan(0);
    });

    it("should have 12 report card sections", () => {
      expect(warData.war_direct.report_card_sections).toHaveLength(12);
    });

    it("should have public opinion data", () => {
      expect(warData.war_direct.public_opinion_us.support_war_pct).toBe(38);
      expect(warData.war_direct.public_opinion_us.oppose_war_pct).toBe(55);
    });
  });

  describe("Telegram Archive data", () => {
    it("should have 2711 items archived", () => {
      expect(warData.telegram_archive.items_archived).toBe(2711);
    });

    it("should have channels, chats, and chatbots", () => {
      expect(warData.telegram_archive.channels).toBe(1048);
      expect(warData.telegram_archive.chats).toBe(1651);
      expect(warData.telegram_archive.chatbots).toBe(12);
    });

    it("should have 27.8 TB data volume", () => {
      expect(warData.telegram_archive.data_volume_tb).toBe(27.8);
    });

    it("should have thematic datasets", () => {
      expect(warData.telegram_archive.thematic_datasets.length).toBeGreaterThanOrEqual(5);
    });

    it("should have geographic coverage of Ukrainian regions", () => {
      expect(warData.telegram_archive.geographic_coverage.length).toBe(25);
      expect(warData.telegram_archive.geographic_coverage).toContain("Kyiv");
    });
  });

  describe("global_statistics", () => {
    it("should have aggregated stats from all sources", () => {
      expect(warData.global_statistics.sources_count).toBe(8);
      expect(warData.global_statistics.acled_yearly_events).toBe(204605);
      expect(warData.global_statistics.warwatch_conflicts).toBe(112);
      expect(warData.global_statistics.telegram_archive_items).toBe(2711);
    });
  });

  describe("Iran war theater (us-israel-iran)", () => {
    it("should have a war_direct_scoreboard", () => {
      const t = getTheater(warData, "us-israel-iran");
      expect(t).toBeDefined();
      expect(t?.war_direct_scoreboard).toBeDefined();
      expect(t?.war_direct_scoreboard?.total_killed).toBe(8100);
    });

    it("should have casualties by country", () => {
      const t = getTheater(warData, "us-israel-iran");
      expect(t?.war_direct_scoreboard?.casualties_by_country.length).toBeGreaterThan(0);
    });

    it("should have ceasefire timeline", () => {
      const t = getTheater(warData, "us-israel-iran");
      expect(t?.ceasefire_timeline?.length).toBeGreaterThan(0);
    });

    it("should have global impact data", () => {
      const t = getTheater(warData, "us-israel-iran");
      expect(t?.global_impact).toBeDefined();
      expect(t?.global_impact?.oil_price_before).toBe(72);
      expect(t?.global_impact?.oil_price_after).toBe(110);
    });
  });
});
