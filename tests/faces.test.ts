import { describe, it, expect } from "vitest";
import {
  SEED_STORIES,
  getAllStories,
  getStoryById,
  getStoriesByCause,
  getStoriesByFormat,
  getStoriesByRegion,
  getVerifiedStories,
  getAudioStories,
  getPhotoEssays,
  filterStories,
  computeStats,
  formatAudioDuration,
  getConsentBadge,
  getAnonymizationBadge,
  createStorySubmission,
  validateSubmission,
  suggestPseudonym,
  causeToLivesKey,
  FORMAT_LABELS,
  CAUSE_LABELS,
  CONSENT_LABELS,
  ANONYMIZATION_LABELS,
  type StoryCause,
  type StoryFormat,
  type ConsentLevel,
  type AnonymizationLevel,
} from "../lib/faces";

describe("faces.ts", () => {
  describe("seed data integrity", () => {
    it("should have at least 8 seed stories", () => {
      expect(SEED_STORIES.length).toBeGreaterThanOrEqual(8);
    });

    it("should have unique ids", () => {
      const ids = SEED_STORIES.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("should have all required fields on every story", () => {
      for (const s of SEED_STORIES) {
        expect(s.format).toBeDefined();
        expect(s.cause).toBeDefined();
        expect(s.region.length).toBeGreaterThan(0);
        expect(s.pseudonym.length).toBeGreaterThan(0);
        expect(s.role.length).toBeGreaterThan(0);
        expect(s.title.length).toBeGreaterThan(0);
        expect(s.body.length).toBeGreaterThan(20);
        expect(s.consent).toBeDefined();
        expect(s.anonymization).toBeDefined();
        expect(s.source.length).toBeGreaterThan(0);
      }
    });

    it("should have body text with multiple paragraphs", () => {
      for (const s of SEED_STORIES) {
        expect(s.body.split("\n\n").length).toBeGreaterThanOrEqual(2);
      }
    });

    it("should mark all seed stories as verified", () => {
      for (const s of SEED_STORIES) {
        expect(s.verified).toBe(true);
      }
    });

    it("should have audio duration for audio stories", () => {
      const audioStories = SEED_STORIES.filter((s) => s.format === "audio");
      for (const s of audioStories) {
        expect(s.audioDurationSec).toBeGreaterThan(0);
      }
    });

    it("should have photo captions for photo essays", () => {
      const photoStories = SEED_STORIES.filter((s) => s.format === "photo_essay");
      for (const s of photoStories) {
        expect(s.photoCaptions).toBeDefined();
        expect(s.photoCaptions!.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe("getAllStories", () => {
    it("should return all seed stories", () => {
      expect(getAllStories()).toEqual(SEED_STORIES);
    });
  });

  describe("getStoryById", () => {
    it("should find a story by id", () => {
      const story = getStoryById("FACE-001");
      expect(story).toBeDefined();
      expect(story!.id).toBe("FACE-001");
    });

    it("should return undefined for unknown id", () => {
      expect(getStoryById("DOES-NOT-EXIST")).toBeUndefined();
    });
  });

  describe("getStoriesByCause", () => {
    it("should filter by hunger", () => {
      const stories = getStoriesByCause("hunger");
      expect(stories.length).toBeGreaterThan(0);
      for (const s of stories) expect(s.cause).toBe("hunger");
    });

    it("should filter by conflict", () => {
      const stories = getStoriesByCause("conflict");
      expect(stories.length).toBeGreaterThan(0);
      for (const s of stories) expect(s.cause).toBe("conflict");
    });
  });

  describe("getStoriesByFormat", () => {
    it("should return text stories", () => {
      const stories = getStoriesByFormat("text");
      expect(stories.length).toBeGreaterThan(0);
      for (const s of stories) expect(s.format).toBe("text");
    });

    it("should return audio stories", () => {
      const stories = getStoriesByFormat("audio");
      expect(stories.length).toBeGreaterThan(0);
      for (const s of stories) expect(s.format).toBe("audio");
    });

    it("should return photo essays", () => {
      const stories = getStoriesByFormat("photo_essay");
      expect(stories.length).toBeGreaterThan(0);
      for (const s of stories) expect(s.format).toBe("photo_essay");
    });
  });

  describe("getStoriesByRegion", () => {
    it("should filter by ISO3 code", () => {
      const stories = getStoriesByRegion("SDN");
      for (const s of stories) expect(s.iso3).toBe("SDN");
    });
  });

  describe("getVerifiedStories", () => {
    it("should return only verified stories", () => {
      const stories = getVerifiedStories();
      expect(stories.length).toBe(SEED_STORIES.length);
    });
  });

  describe("getAudioStories", () => {
    it("should return only audio format stories", () => {
      const stories = getAudioStories();
      for (const s of stories) expect(s.format).toBe("audio");
    });
  });

  describe("getPhotoEssays", () => {
    it("should return only photo essay format stories", () => {
      const stories = getPhotoEssays();
      for (const s of stories) expect(s.format).toBe("photo_essay");
    });
  });

  describe("filterStories", () => {
    it("should return all when filter is all", () => {
      expect(filterStories(SEED_STORIES, { cause: "all", format: "all" }).length).toBe(SEED_STORIES.length);
    });

    it("should filter by cause", () => {
      const filtered = filterStories(SEED_STORIES, { cause: "hunger" });
      for (const s of filtered) expect(s.cause).toBe("hunger");
    });

    it("should filter by format", () => {
      const filtered = filterStories(SEED_STORIES, { format: "audio" });
      for (const s of filtered) expect(s.format).toBe("audio");
    });

    it("should filter by both cause and format", () => {
      const filtered = filterStories(SEED_STORIES, { cause: "conflict", format: "audio" });
      for (const s of filtered) {
        expect(s.cause).toBe("conflict");
        expect(s.format).toBe("audio");
      }
    });

    it("should return empty when no match", () => {
      const filtered = filterStories(SEED_STORIES, { cause: "water", format: "photo_essay" });
      const waterPhoto = SEED_STORIES.filter((s) => s.cause === "water" && s.format === "photo_essay");
      expect(filtered.length).toBe(waterPhoto.length);
    });
  });

  describe("computeStats", () => {
    it("should compute correct totals", () => {
      const stats = computeStats();
      expect(stats.total).toBe(SEED_STORIES.length);
    });

    it("should count by format", () => {
      const stats = computeStats();
      expect(stats.byFormat.text + stats.byFormat.audio + stats.byFormat.photo_essay).toBe(SEED_STORIES.length);
    });

    it("should count by cause", () => {
      const stats = computeStats();
      const totalByCause = Object.values(stats.byCause).reduce((a, b) => a + b, 0);
      expect(totalByCause).toBe(SEED_STORIES.length);
    });

    it("should count verified", () => {
      const stats = computeStats();
      expect(stats.verified).toBe(SEED_STORIES.length);
    });

    it("should count countries", () => {
      const stats = computeStats();
      const expectedCountries = new Set(SEED_STORIES.map((s) => s.iso3)).size;
      expect(stats.countries).toBe(expectedCountries);
    });

    it("should compute audio hours", () => {
      const stats = computeStats();
      const expectedHours = SEED_STORIES
        .filter((s) => s.format === "audio" && s.audioDurationSec)
        .reduce((sum, s) => sum + (s.audioDurationSec || 0), 0) / 3600;
      expect(stats.audioHours).toBe(+expectedHours.toFixed(1));
    });
  });

  describe("formatAudioDuration", () => {
    it("should format seconds as m:ss", () => {
      expect(formatAudioDuration(184)).toContain("3:04");
    });

    it("should format under a minute", () => {
      expect(formatAudioDuration(45)).toContain("0:45");
    });
  });

  describe("getConsentBadge", () => {
    it("should return badge for each consent level", () => {
      const levels: ConsentLevel[] = ["full_consent", "consented_pseudonym", "consented_composite", "family_consent"];
      for (const level of levels) {
        const story = SEED_STORIES.find((s) => s.consent === level);
        if (story) {
          const badge = getConsentBadge(story);
          expect(badge.length).toBeGreaterThan(0);
          expect(badge).toContain("✓");
        }
      }
    });
  });

  describe("getAnonymizationBadge", () => {
    it("should return badge for each anonymization level", () => {
      const levels: AnonymizationLevel[] = ["first_name_only", "pseudonym", "fully_anonymized"];
      for (const level of levels) {
        const story = SEED_STORIES.find((s) => s.anonymization === level);
        if (story) {
          const badge = getAnonymizationBadge(story);
          expect(badge.length).toBeGreaterThan(0);
          expect(badge).toContain("◆");
        }
      }
    });
  });

  describe("createStorySubmission", () => {
    it("should create a submission with id and timestamp", () => {
      const sub = createStorySubmission({
        format: "text",
        cause: "hunger",
        region: "Unknown",
        pseudonym: "Test User",
        role: "Survivor",
        title: "My Test Story",
        body: "This is a test body that is long enough to pass.",
        consent: "consented_pseudonym",
        anonymization: "pseudonym",
        contactBack: false,
      });
      expect(sub.id).toContain("SUB-");
      expect(sub.submittedAt).toBeGreaterThan(0);
      expect(sub.pseudonym).toBe("Test User");
    });
  });

  describe("validateSubmission", () => {
    it("should reject short title", () => {
      const err = validateSubmission({ title: "ab", body: "long enough body text", pseudonym: "Name", consent: "full_consent" });
      expect(err).toContain("Title");
    });

    it("should reject short body", () => {
      const err = validateSubmission({ title: "Valid Title", body: "short", pseudonym: "Name", consent: "full_consent" });
      expect(err).toContain("50");
    });

    it("should reject empty pseudonym", () => {
      const err = validateSubmission({ title: "Valid Title", body: "x".repeat(60), pseudonym: "a", consent: "full_consent" });
      expect(err).toContain("name");
    });

    it("should return null for valid input", () => {
      const err = validateSubmission({ title: "Valid Title", body: "x".repeat(60), pseudonym: "Valid Name", consent: "full_consent" });
      expect(err).toBeNull();
    });
  });

  describe("suggestPseudonym", () => {
    it("should return a non-empty string", () => {
      const name = suggestPseudonym();
      expect(name.length).toBeGreaterThan(3);
      expect(name).toContain(" ");
    });

    it("should be random", () => {
      const names = new Set<string>();
      for (let i = 0; i < 20; i++) names.add(suggestPseudonym());
      expect(names.size).toBeGreaterThan(1);
    });
  });

  describe("causeToLivesKey", () => {
    it("should map hunger to hunger", () => {
      expect(causeToLivesKey("hunger")).toBe("hunger");
    });

    it("should map displacement to conflict", () => {
      expect(causeToLivesKey("displacement")).toBe("conflict");
    });

    it("should map poverty to hunger", () => {
      expect(causeToLivesKey("poverty")).toBe("hunger");
    });

    it("should map all causes to valid keys", () => {
      const causes: StoryCause[] = ["hunger", "conflict", "water", "disease", "displacement", "poverty"];
      for (const c of causes) {
        const key = causeToLivesKey(c);
        expect(["hunger", "conflict", "water", "disease", "child_mortality"].includes(key)).toBe(true);
      }
    });
  });

  describe("label maps completeness", () => {
    it("FORMAT_LABELS should cover all formats", () => {
      const formats: StoryFormat[] = ["text", "audio", "photo_essay"];
      for (const f of formats) expect(FORMAT_LABELS[f]).toBeDefined();
    });

    it("CAUSE_LABELS should cover all causes", () => {
      const causes: StoryCause[] = ["hunger", "conflict", "water", "disease", "displacement", "poverty"];
      for (const c of causes) expect(CAUSE_LABELS[c]).toBeDefined();
    });

    it("CONSENT_LABELS should cover all consent levels", () => {
      const levels: ConsentLevel[] = ["full_consent", "consented_pseudonym", "consented_composite", "family_consent"];
      for (const l of levels) expect(CONSENT_LABELS[l]).toBeDefined();
    });

    it("ANONYMIZATION_LABELS should cover all anonymization levels", () => {
      const levels: AnonymizationLevel[] = ["first_name_only", "pseudonym", "fully_anonymized"];
      for (const l of levels) expect(ANONYMIZATION_LABELS[l]).toBeDefined();
    });
  });
});
