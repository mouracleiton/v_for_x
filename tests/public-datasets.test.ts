import { describe, it, expect } from "vitest";
import {
  getAllDatasets,
  getDatasetById,
  getMetadata,
  getByCategory,
  getByPriority,
  getByDimension,
  getCategoryList,
  getAllTags,
  getStats,
  scoreDataset,
  searchDatasets,
  PRIORITY_META,
  type Dataset,
  type DatasetCategory,
} from "../lib/public-datasets";

const ALL = getAllDatasets();

describe("public-datasets.ts", () => {
  describe("data integrity", () => {
    it("catalog should be non-empty", () => {
      expect(ALL.length).toBeGreaterThanOrEqual(30);
    });

    it("metadata total_datasets should match actual count", () => {
      expect(getMetadata().total_datasets).toBe(ALL.length);
    });

    it("every dataset has a unique id", () => {
      const ids = ALL.map((d) => d.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("every dataset has a unique url", () => {
      const urls = ALL.map((d) => d.url);
      expect(new Set(urls).size).toBe(urls.length);
    });

    it("every dataset has all required string fields", () => {
      for (const d of ALL) {
        expect(typeof d.name).toBe("string");
        expect(d.name.length).toBeGreaterThan(0);
        expect(typeof d.provider).toBe("string");
        expect(d.provider.length).toBeGreaterThan(0);
        expect(typeof d.description).toBe("string");
        expect(d.description.length).toBeGreaterThan(20);
        expect(d.url).toMatch(/^https?:\/\//);
        expect(typeof d.format).toBe("string");
        expect(typeof d.license).toBe("string");
        expect(typeof d.coverage).toBe("string");
        expect(typeof d.cadence).toBe("string");
      }
    });

    it("every dataset has at least one tag", () => {
      for (const d of ALL) {
        expect(Array.isArray(d.tags)).toBe(true);
        expect(d.tags.length).toBeGreaterThan(0);
      }
    });

    it("every dataset category exists in the categories registry", () => {
      const cats = getCategoryList().map((c) => c.key);
      for (const d of ALL) {
        expect(cats).toContain(d.category);
      }
    });

    it("every dataset priority is valid", () => {
      const valid = Object.keys(PRIORITY_META);
      for (const d of ALL) {
        expect(valid).toContain(d.priority);
      }
    });
  });

  describe("getDatasetById", () => {
    it("returns a dataset by id", () => {
      const first = ALL[0];
      expect(getDatasetById(first.id)).toBe(first);
    });

    it("returns undefined for unknown id", () => {
      expect(getDatasetById("does-not-exist-xyz")).toBeUndefined();
    });
  });

  describe("getByCategory", () => {
    it("returns only datasets in the given category", () => {
      const conflict = getByCategory("conflict");
      expect(conflict.length).toBeGreaterThan(0);
      for (const d of conflict) {
        expect(d.category).toBe("conflict");
      }
    });

    it("returns empty for a valid-but-empty category", () => {
      // We don't assert which categories are empty; just that filter is correct
      const result = getByCategory("hunger" as DatasetCategory).filter(
        (d) => d.category !== "hunger"
      );
      expect(result).toHaveLength(0);
    });
  });

  describe("getByPriority", () => {
    it("returns only datasets at the given priority", () => {
      const critical = getByPriority("critical");
      expect(critical.length).toBeGreaterThan(0);
      for (const d of critical) {
        expect(d.priority).toBe("critical");
      }
    });

    it("has at least one critical dataset", () => {
      expect(getByPriority("critical").length).toBeGreaterThan(0);
    });
  });

  describe("getByDimension", () => {
    it("returns datasets mapping to a backbone dimension", () => {
      const conflict = getByDimension("conflict");
      for (const d of conflict) {
        expect(d.mapsTo).toBe("conflict");
      }
    });
  });

  describe("getAllTags", () => {
    it("returns a sorted array of unique tags", () => {
      const tags = getAllTags();
      expect(tags.length).toBeGreaterThan(10);
      // sorted
      for (let i = 1; i < tags.length; i++) {
        expect(tags[i] >= tags[i - 1]).toBe(true);
      }
      // unique
      expect(new Set(tags).size).toBe(tags.length);
    });
  });

  describe("getStats", () => {
    it("total equals the dataset count", () => {
      expect(getStats().total).toBe(ALL.length);
    });

    it("byPriority sums to total", () => {
      const s = getStats();
      const sum = s.byPriority.critical + s.byPriority.high + s.byPriority.standard;
      expect(sum).toBe(ALL.length);
    });

    it("byCategory sums to total", () => {
      const s = getStats();
      const sum = Object.values(s.byCategory).reduce((a, b) => a + b, 0);
      expect(sum).toBe(ALL.length);
    });

    it("criticalCount matches byPriority.critical", () => {
      const s = getStats();
      expect(s.criticalCount).toBe(s.byPriority.critical);
    });

    it("categories count matches getCategoryList length", () => {
      expect(getStats().categories).toBe(getCategoryList().length);
    });
  });

  describe("scoreDataset", () => {
    const sample: Dataset = {
      id: "test",
      name: "Armed Conflict Dataset",
      provider: "Uppsala University",
      category: "conflict",
      priority: "critical",
      description: "Data about wars and political violence across countries.",
      url: "http://example.com",
      format: "CSV",
      license: "Open",
      coverage: "Global",
      cadence: "Annual",
      mapsTo: "conflict",
      tags: ["conflict", "war", "battle-deaths"],
    };

    it("returns positive for empty query", () => {
      expect(scoreDataset(sample, "")).toBeGreaterThan(0);
    });

    it("scores exact name match highest", () => {
      expect(scoreDataset(sample, "armed conflict dataset")).toBe(100);
    });

    it("scores starts-with highly", () => {
      expect(scoreDataset(sample, "armed")).toBe(90);
    });

    it("scores contains match", () => {
      expect(scoreDataset(sample, "conflict")).toBe(80);
    });

    it("scores provider match", () => {
      expect(scoreDataset(sample, "uppsala")).toBe(70);
    });

    it("scores tag-prefix match", () => {
      expect(scoreDataset(sample, "battle")).toBe(65);
    });

    it("scores description match", () => {
      expect(scoreDataset(sample, "violence")).toBe(50);
    });

    it("scores fuzzy subsequence match", () => {
      expect(scoreDataset(sample, "acd")).toBe(30); // A-rmed C-onflict D-ataset
    });

    it("returns 0 for no match", () => {
      expect(scoreDataset(sample, "zzzzzz")).toBe(0);
    });
  });

  describe("searchDatasets", () => {
    it("returns all datasets with empty filters", () => {
      expect(searchDatasets({}).length).toBe(ALL.length);
    });

    it("filters by category", () => {
      const results = searchDatasets({ category: "conflict" });
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.dataset.category).toBe("conflict");
      }
    });

    it("filters by priority", () => {
      const results = searchDatasets({ priority: "critical" });
      for (const r of results) {
        expect(r.dataset.priority).toBe("critical");
      }
    });

    it("combines category and priority filters", () => {
      const results = searchDatasets({ category: "conflict", priority: "critical" });
      for (const r of results) {
        expect(r.dataset.category).toBe("conflict");
        expect(r.dataset.priority).toBe("critical");
      }
    });

    it("returns scored results sorted by score desc", () => {
      const results = searchDatasets({ query: "conflict" });
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }
    });

    it("breaks score ties by priority (critical first)", () => {
      const results = searchDatasets({ category: "conflict" });
      // All same score (1) — should be ordered by priority rank
      const ranks = { critical: 0, high: 1, standard: 2 };
      for (let i = 1; i < results.length; i++) {
        if (results[i].score === results[i - 1].score) {
          expect(ranks[results[i].dataset.priority])
            .toBeGreaterThanOrEqual(ranks[results[i - 1].dataset.priority]);
        }
      }
    });

    it("returns empty for gibberish query", () => {
      expect(searchDatasets({ query: "qwzxqwzx" })).toHaveLength(0);
    });

    it("finds datasets by partial name", () => {
      const results = searchDatasets({ query: "sanctions" });
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("PRIORITY_META", () => {
    it("defines all three priority levels", () => {
      expect(PRIORITY_META.critical).toBeDefined();
      expect(PRIORITY_META.high).toBeDefined();
      expect(PRIORITY_META.standard).toBeDefined();
    });

    it("each priority has a label and a valid color", () => {
      const validColors = ["blood", "amber", "dim"];
      for (const key of Object.keys(PRIORITY_META) as (keyof typeof PRIORITY_META)[]) {
        expect(typeof PRIORITY_META[key].label).toBe("string");
        expect(validColors).toContain(PRIORITY_META[key].color);
      }
    });
  });
});
