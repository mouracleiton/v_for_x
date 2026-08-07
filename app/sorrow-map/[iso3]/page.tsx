import type { Metadata } from "next";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import { SITE } from "@/lib/seo";
import CountryDetail from "./CountryDetail";

const data = backbone as WorldBackbone;

export function generateStaticParams() {
  return data.countries.map((c) => ({ iso3: c.iso3.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ iso3: string }>;
}): Promise<Metadata> {
  const { iso3 } = await params;
  const country = data.countries.find(
    (c) => c.iso3.toLowerCase() === iso3.toLowerCase()
  );
  if (!country) return { title: "Country not found" };

  const under = country.hunger.undernourishment_pct;
  const life = country.health.life_expectancy;
  const parts: string[] = [];

  if (under !== null && under > 0) parts.push(`${under.toFixed(0)}% undernourished`);
  if (life !== null) parts.push(`life expectancy ${life.toFixed(0)} yrs`);
  if (country.is_hotspot) parts.push("hunger hotspot");

  const title = `${country.name_en} (${country.iso3}) — Country Dossier`;
  const description = parts.length > 0
    ? `${country.name_en}: ${parts.join(", ")}. Population ${Math.round(country.demographics.population / 1e6)}M. Full data across 19 dimensions from V FOR X.`
    : `${country.name_en} — full data dossier. Population ${Math.round(country.demographics.population / 1e6)}M. ${country.region}.`;

  const path = `/sorrow-map/${country.iso3.toLowerCase()}/`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE.url}${path}` },
    openGraph: {
      title,
      description,
      url: `${SITE.url}${path}`,
      type: "article",
      images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function Page({
  params,
}: {
  params: Promise<{ iso3: string }>;
}) {
  return <CountryDetail params={params} />;
}
