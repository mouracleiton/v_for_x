import { describe, it, expect } from "vitest";
import {
  createPost,
  findMatches,
  scoreMatch,
  computeStats,
  generateSeedPosts,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
} from "../lib/exchange";
import backbone from "../data/world_backbone.json";
import type { WorldBackbone } from "../lib/types";

const data = backbone as WorldBackbone;

describe("exchange.ts", () => {
  describe("createPost", () => {
    it("should create a post with id and handle", () => {
      const post = createPost("offer", "food", "Rice", "50kg", "SDN", "Sudan", 3);
      expect(post.id).toBeDefined();
      expect(post.type).toBe("offer");
      expect(post.resource).toBe("Rice");
      expect(post.handle).toMatch(/^X-/);
      expect(post.active).toBe(true);
    });
  });

  describe("scoreMatch", () => {
    it("should score high for matching category + resource + country", () => {
      const offer = createPost("offer", "food", "rice", "50kg", "SDN", "Sudan");
      const request = createPost("request", "food", "rice", "50kg", "SDN", "Sudan", 5);
      const match = scoreMatch(offer, request);
      expect(match.score).toBeGreaterThan(70);
      expect(match.sameCountry).toBe(true);
      expect(match.reason).toContain("same category");
    });

    it("should score low for different categories", () => {
      const offer = createPost("offer", "medical", "bandages", "20", "SDN", "Sudan");
      const request = createPost("request", "food", "rice", "50kg", "SDN", "Sudan");
      const match = scoreMatch(offer, request);
      expect(match.score).toBeLessThan(40);
    });

    it("should score higher for same country", () => {
      const offer1 = createPost("offer", "food", "rice", "50kg", "SDN", "Sudan");
      const offer2 = createPost("offer", "food", "rice", "50kg", "YEM", "Yemen");
      const request = createPost("request", "food", "rice", "50kg", "SDN", "Sudan", 5);

      const match1 = scoreMatch(offer1, request);
      const match2 = scoreMatch(offer2, request);
      expect(match1.score).toBeGreaterThan(match2.score);
    });
  });

  describe("findMatches", () => {
    it("should find all matches above threshold", () => {
      const offers = [
        createPost("offer", "food", "rice", "50kg", "SDN", "Sudan"),
        createPost("offer", "medical", "bandages", "20", "YEM", "Yemen"),
      ];
      const requests = [
        createPost("request", "food", "rice", "50kg", "SDN", "Sudan", 5),
        createPost("request", "water", "clean water", "100L", "AFG", "Afghanistan", 5),
      ];

      const matches = findMatches(offers, requests);
      expect(matches.length).toBeGreaterThan(0);
      // First match should be the food-for-food match
      expect(matches[0].score).toBeGreaterThanOrEqual(matches[matches.length - 1].score);
    });

    it("should exclude inactive posts", () => {
      const offer = createPost("offer", "food", "rice", "50kg", "SDN", "Sudan");
      offer.active = false;
      const request = createPost("request", "food", "rice", "50kg", "SDN", "Sudan", 5);

      const matches = findMatches([offer], [request]);
      expect(matches).toHaveLength(0);
    });
  });

  describe("computeStats", () => {
    it("should compute correct stats", () => {
      const posts = [
        createPost("offer", "food", "rice", "50kg", "SDN", "Sudan"),
        createPost("request", "food", "rice", "50kg", "SDN", "Sudan", 5),
        createPost("request", "medical", "bandages", "10", "YEM", "Yemen", 5),
      ];
      const stats = computeStats(posts);
      expect(stats.totalOffers).toBe(1);
      expect(stats.totalRequests).toBe(2);
      expect(stats.topCategories.length).toBeGreaterThan(0);
    });
  });

  describe("generateSeedPosts", () => {
    it("should generate seed posts from hotspot data", () => {
      const posts = generateSeedPosts(data);
      expect(posts.length).toBeGreaterThan(0);
      expect(posts.every((p) => p.handle)).toBe(true);
      expect(posts.every((p) => p.iso3)).toBe(true);
    });
  });

  describe("metadata", () => {
    it("should have labels and icons for all categories", () => {
      expect(Object.keys(CATEGORY_LABELS).length).toBeGreaterThanOrEqual(10);
      expect(Object.keys(CATEGORY_ICONS).length).toBe(Object.keys(CATEGORY_LABELS).length);
    });
  });
});
