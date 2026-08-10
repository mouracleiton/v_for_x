/**
 * V FOR X — Hreflang & multilingual SEO helpers
 *
 * Generates hreflang alternate links, Open Graph locale alternates, and
 * canonical URLs for the 12 supported languages.
 *
 * NOTE ON ARCHITECTURE:
 * V FOR X is a static export with client-side i18n (localStorage). Every
 * language is therefore served from the *same* canonical URL. The hreflang
 * tags declared here signal the multilingual nature of each page to search
 * engines (Google understands a single URL can serve several languages).
 *
 * SITE.url already includes the basePath (/v_for_x), so a canonical URL is
 * simply `SITE.url + path` — exactly how `app/sitemap.ts` builds its URLs.
 */

import type { Lang } from "./i18n";
import { LANGS } from "./i18n";
import { SITE } from "./seo";

/** ISO 639-1 (+ region where the variant matters) hreflang code per language. */
const HREFLANG_MAP: Record<Lang, string> = {
  en: "en",
  pt: "pt-BR",
  es: "es",
  fr: "fr",
  zh: "zh-CN",
  ja: "ja",
  ko: "ko",
  hi: "hi",
  ar: "ar-SA",
  ru: "ru",
  fa: "fa",
  ur: "ur",
};

/** Open Graph locale (underscore format) per language. */
const OG_LOCALE_MAP: Record<Lang, string> = {
  en: "en_US",
  pt: "pt_BR",
  es: "es_ES",
  fr: "fr_FR",
  zh: "zh_CN",
  ja: "ja_JP",
  ko: "ko_KR",
  hi: "hi_IN",
  ar: "ar_SA",
  ru: "ru_RU",
  fa: "fa_IR",
  ur: "ur_PK",
};

/** Map a V FOR X language code to its hreflang format (e.g. `pt` → `pt-BR`). */
export function langToHreflang(lang: Lang): string {
  return HREFLANG_MAP[lang];
}

/** Map a V FOR X language code to its Open Graph locale (e.g. `en` → `en_US`). */
export function ogLocale(lang: Lang): string {
  return OG_LOCALE_MAP[lang];
}

/**
 * Build the canonical (absolute) URL for a page path.
 *
 * `SITE.url` already carries the basePath (`/v_for_x`), so we only need to
 * ensure the path begins with a single leading slash.
 */
export function canonicalUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE.url}${normalized}`;
}

/**
 * Generate all hreflang alternate URLs for a page.
 *
 * Returns one entry per supported language plus a trailing `x-default`
 * that targets the English / canonical version.
 */
export function getHreflangAlternates(
  path: string,
): { hreflang: string; href: string }[] {
  const href = canonicalUrl(path);
  const alternates = LANGS.map((lang) => ({
    hreflang: langToHreflang(lang.id),
    href,
  }));
  // x-default always points at the canonical (English) version.
  alternates.push({ hreflang: "x-default", href });
  return alternates;
}

/**
 * Generate hreflang `<link rel="alternate">` tags as JSX-ready data.
 *
 * Drop the result straight into a Next.js `metadata.alternates.languages`
 * object or render `<link>` elements from it.
 */
export function hreflangLinks(
  path: string,
): { rel: "alternate"; hrefLang: string; href: string }[] {
  return getHreflangAlternates(path).map(({ hreflang, href }) => ({
    rel: "alternate",
    hrefLang: hreflang,
    href,
  }));
}

/**
 * Generate Open Graph locale alternates (`og:locale:alternate` values) for a
 * page.
 *
 * All 10 languages are supported on every page, so the list is
 * path-independent. The `path` argument is accepted for API symmetry with the
 * other helpers in this module.
 */
export function ogLocaleAlternates(_path: string): string[] {
  return LANGS.map((lang) => ogLocale(lang.id));
}
