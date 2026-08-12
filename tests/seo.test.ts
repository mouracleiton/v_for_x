import { describe, it, expect } from "vitest";
import { SITE, PAGE_META, getMeta, type PageMeta } from "../lib/seo";

describe("seo.ts — centralized SEO metadata", () => {
  describe("SITE constant", () => {
    it("exposes required site-wide fields", () => {
      expect(SITE.name).toBeTruthy();
      expect(SITE.title).toBeTruthy();
      expect(SITE.description.length).toBeGreaterThan(20);
      expect(SITE.url).toMatch(/^https?:\/\//);
      expect(SITE.ogImage).toMatch(/^https?:\/\//);
      expect(SITE.locale).toBeTruthy();
      expect(SITE.twitter).toMatch(/^@/);
    });
  });

  describe("PAGE_META registry", () => {
    it("always has a home entry", () => {
      expect(PAGE_META["/"]).toBeDefined();
      expect(PAGE_META["/"].title).toContain("V FOR X");
    });

    it("every entry has title, description, and path", () => {
      for (const [key, meta] of Object.entries(PAGE_META)) {
        expect(meta.title.length, `${key} title`).toBeGreaterThan(0);
        expect(meta.description.length, `${key} description`).toBeGreaterThan(10);
        expect(meta.path, `${key} path`).toBeTruthy();
      }
    });

    it("keys match their path fields", () => {
      for (const [key, meta] of Object.entries(PAGE_META)) {
        expect(meta.path).toBe(key);
      }
    });

    it("descriptions do not leak raw template placeholders", () => {
      for (const meta of Object.values(PAGE_META)) {
        expect(meta.description).not.toMatch(/\$\{|undefined|null/);
      }
    });
  });

  describe("getMeta", () => {
    it("returns the registered metadata for a known path", () => {
      const home = getMeta("/");
      expect(home.title).toBe(PAGE_META["/"].title);
      expect(home.description).toBe(PAGE_META["/"].description);
    });

    it("falls back to site defaults for an unknown path", () => {
      const fallback = getMeta("/does/not/exist/") as PageMeta;
      expect(fallback.title).toBe(SITE.title);
      expect(fallback.description).toBe(SITE.description);
      expect(fallback.path).toBe("/does/not/exist/");
    });

    it("passes through the requested path on fallback", () => {
      expect(getMeta("/custom/").path).toBe("/custom/");
    });
  });
});
