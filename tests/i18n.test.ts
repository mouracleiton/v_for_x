import { describe, it, expect } from "vitest";
import { LANGS, NAV_T, SECTION_DESC, isRTL, t } from "../lib/i18n";

describe("i18n languages", () => {
  it("ships 12 languages including fa and ur", () => {
    expect(LANGS.map((l) => l.id)).toEqual([
      "en", "pt", "es", "fr", "zh", "ja", "ko", "hi", "ar", "ru", "fa", "ur",
    ]);
    expect(new Set(LANGS.map((l) => l.id)).size).toBe(12);
  });

  it("marks ar, fa, and ur as RTL; everything else LTR", () => {
    expect(isRTL("ar")).toBe(true);
    expect(isRTL("fa")).toBe(true);
    expect(isRTL("ur")).toBe(true);
    expect(isRTL("en")).toBe(false);
    for (const l of LANGS) {
      if (["ar", "fa", "ur"].includes(l.id)) {
        expect(isRTL(l.id)).toBe(true);
      } else {
        expect(isRTL(l.id)).toBe(false);
      }
    }
  });
});

describe("t()", () => {
  it("returns fa and ur translations for nav keys", () => {
    expect(t("fa", "nav.briefing")).toBe("گزارش");
    expect(t("fa", "nav.the-docs")).toBe("اسناد");
    expect(t("ur", "nav.briefing")).toBe("بریفنگ");
    expect(t("ur", "nav.the-mirror-ring")).toBe("آئینہ حلقہ");
    expect(t("fa", "ui.search")).toBe("جستجو");
    expect(t("ur", "ui.search")).toBe("تلاش");
  });

  it("falls back to the key itself when no translation exists", () => {
    expect(t("fa", "nav.does-not-exist")).toBe("nav.does-not-exist");
    expect(t("en", "nav.does-not-exist")).toBe("nav.does-not-exist");
  });

  it("has complete fa and ur maps (every en key translated)", () => {
    const enKeys = Object.keys(NAV_T.en);
    for (const lang of ["fa", "ur"] as const) {
      expect(Object.keys(NAV_T[lang])).toEqual(enKeys);
      for (const key of enKeys) {
        expect(NAV_T[lang][key]).toBeTruthy();
        expect(NAV_T[lang][key]).not.toBe(key);
      }
    }
  });
});

describe("SECTION_DESC", () => {
  it("covers the-docs and the-mirror-ring for all 12 languages", () => {
    for (const route of ["/the-docs/", "/the-mirror-ring/"]) {
      const desc = SECTION_DESC[route];
      expect(desc).toBeDefined();
      for (const l of LANGS) {
        expect(desc[l.id]).toBeTruthy();
      }
    }
  });
});