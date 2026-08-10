import type { Metadata } from "next";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import { SITE } from "@/lib/seo";
import PrintableBrief from "./PrintableBrief";

const data = backbone as WorldBackbone;

/** Pre-render a printable page for every country at build time. */
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

  const title = `${country.name_en} (${country.iso3}) — Intelligence Brief`;
  const description = `Print-ready data brief for ${country.name_en}: key metrics, crisis indicators, vulnerability score, and dossier references. Export to PDF.`;
  const path = `/print/${country.iso3.toLowerCase()}/`;

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

export default function PrintPage({
  params,
}: {
  params: Promise<{ iso3: string }>;
}) {
  return <PrintableBrief params={params} />;
}
