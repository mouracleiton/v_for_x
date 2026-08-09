"use client";

/**
 * V FOR X — JSON-LD structured-data component + generators
 *
 * Renders a `<script type="application/ld+json">` tag so search engines and
 * social platforms understand each page's content (Dataset, Article,
 * BreadcrumbList, FAQPage, Organization, WebSite).
 *
 * Usage:
 *   <JsonLd {...websiteJsonLd()} />
 *   <JsonLd {...datasetJsonLd(country)} />
 *   <JsonLd {...breadcrumbJsonLd([{ name: "Home", path: "/" }])} />
 *
 * Each generator returns a `{ type, data }` pair (`JsonLdEntry`) that can be
 * spread directly into `<JsonLd>`, so the schema @type is never duplicated or
 * mistyped by the caller.
 */

import { SITE } from "@/lib/seo";
import { LANGS } from "@/lib/i18n";
import { canonicalUrl } from "@/lib/hreflang";
import type { CountryData } from "@/lib/types";

/** Schema.org types this component knows how to inject. */
export type JsonLdType =
  | "Dataset"
  | "Article"
  | "BreadcrumbList"
  | "FAQPage"
  | "Organization"
  | "WebSite";

interface JsonLdProps {
  type: JsonLdType;
  /** Structured-data fields (without @context / @type — those are added here). */
  data: Record<string, unknown>;
}

/** A self-contained JSON-LD entry; spread into `<JsonLd {...entry} />`. */
export interface JsonLdEntry {
  type: JsonLdType;
  data: Record<string, unknown>;
}

/**
 * Inject JSON-LD structured data into the page via an inline
 * `<script type="application/ld+json">` tag. Renders nothing visible.
 */
export default function JsonLd({ type, data }: JsonLdProps) {
  const payload = { "@context": "https://schema.org", "@type": type, ...data };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  GENERATORS                                                     */
/* ═══════════════════════════════════════════════════════════════ */

/**
 * Schema.org `Organization` for V FOR X as a whole.
 * Use once per layout (typically the root).
 */
export function organizationJsonLd(): JsonLdEntry {
  return {
    type: "Organization",
    data: {
      name: SITE.name,
      alternateName: "VFORX",
      url: SITE.url,
      logo: SITE.ogImage,
      description: SITE.description,
      sameAs: ["https://github.com/mouracleiton/v_for_x", SITE.url],
    },
  };
}

/**
 * Schema.org `WebSite` with a `SearchAction` (enables Google sitelinks
 * search box). Use once on the home page.
 */
export function websiteJsonLd(): JsonLdEntry {
  return {
    type: "WebSite",
    data: {
      name: SITE.name,
      alternateName: "the platform that refuses to die",
      url: SITE.url,
      description: SITE.description,
      inLanguage: LANGS.map((l) => l.id),
      publisher: { "@type": "Organization", name: SITE.name },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE.url}/?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  };
}

/**
 * Schema.org `Article` for a section / topic page.
 */
export function articleJsonLd(
  title: string,
  description: string,
  path: string,
): JsonLdEntry {
  const url = canonicalUrl(path);
  return {
    type: "Article",
    data: {
      headline: title,
      description,
      url,
      mainEntityOfPage: url,
      image: SITE.ogImage,
      inLanguage: "en",
      author: { "@type": "Organization", name: SITE.name },
      publisher: {
        "@type": "Organization",
        name: SITE.name,
        logo: { "@type": "ImageObject", url: SITE.ogImage },
      },
    },
  };
}

/**
 * Schema.org `Dataset` describing a single country's open data.
 */
export function datasetJsonLd(country: CountryData): JsonLdEntry {
  const url = canonicalUrl(`/sorrow-map/${country.iso3.toLowerCase()}/`);
  const pop = country.population_m;
  const description =
    `Open dataset for ${country.name_en} (${country.iso3}) — ` +
    `population ${pop.toFixed(1)}M, ${country.region} / ${country.subregion}. ` +
    `Hunger, conflict, health, economy, military spending, and human ` +
    `development indicators. CC0 licensed. Part of V FOR X.`;

  return {
    type: "Dataset",
    data: {
      name: `${country.name_en} — Crisis & Development Dataset`,
      description,
      url,
      isAccessibleForFree: true,
      license: "https://creativecommons.org/publicdomain/zero/1.0/",
      keywords: [
        country.name_en,
        country.iso3,
        country.region,
        "hunger",
        "crisis",
        "open data",
        "CC0",
        "V FOR X",
      ].join(", "),
      creator: { "@type": "Organization", name: SITE.name, url: SITE.url },
      publisher: { "@type": "Organization", name: SITE.name },
      inLanguage: "en",
      measurementTechnique:
        "Aggregated from FAO, WHO, World Bank, SIPRI, UNHCR, and V-Dem",
      spatialCoverage: {
        "@type": "Place",
        name: country.name_en,
      },
      variableMeasured: [
        "Population",
        "Hunger prevalence (%)",
        "Conflict intensity",
        "GDP",
        "GDP per capita",
        "Life expectancy",
        "Child mortality",
        "Military expenditure",
        "Human Development Index",
      ],
    },
  };
}

/**
 * Schema.org `BreadcrumbList` for navigation context.
 * The first item should usually be the home page.
 */
export function breadcrumbJsonLd(
  items: { name: string; path: string }[],
): JsonLdEntry {
  return {
    type: "BreadcrumbList",
    data: {
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: canonicalUrl(item.path),
      })),
    },
  };
}

/**
 * Schema.org `FAQPage` with common questions about V FOR X.
 * Useful on the home page or an about/FAQ section.
 */
export function faqJsonLd(): JsonLdEntry {
  const faqs: { q: string; a: string }[] = [
    {
      q: "What is V FOR X?",
      a: "V FOR X is an open data platform covering 200 countries across 19 dimensions — hunger, water, health, energy, education, climate, inequality, and governance — built to expose the real cost of ending global crises compared with military spending.",
    },
    {
      q: "How much would it cost to end world hunger?",
      a: "According to the data aggregated by V FOR X, ending global hunger costs roughly $93 billion per year — about 0.9% of annual global military spending, or just 14 days of it.",
    },
    {
      q: "Is the V FOR X data free to use?",
      a: "Yes. All data is published under a CC0 (public domain) license with no authentication and no rate limits. Primary sources include FAO, WHO, the World Bank, SIPRI, UNHCR, and V-Dem.",
    },
    {
      q: "Is V FOR X a static website?",
      a: "Yes. V FOR X is a static export: any copy of the site is a fully functional node with no databases or servers. It can be self-hosted or mirrored as a distributed, censorship-resistant resource.",
    },
    {
      q: "How many countries and metrics does V FOR X cover?",
      a: "V FOR X covers 200 countries and territories across roughly 87 fields spanning 23 dimensions, from acute hunger prevalence to military expenditure and the Human Development Index.",
    },
  ];

  return {
    type: "FAQPage",
    data: {
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  };
}
