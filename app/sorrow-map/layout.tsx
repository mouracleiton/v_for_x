import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Sorrow Map \u2014 World Crisis Atlas",
  description: "Interactive choropleth of 200 countries colored by 48 dimensions: hunger, conflict, poverty, health, climate, inequality. Click any country for a full dossier.",
  alternates: { canonical: `${SITE.url}/sorrow-map/` },
  openGraph: {
    title: "Sorrow Map \u2014 World Crisis Atlas",
    description: "Interactive choropleth of 200 countries colored by 48 dimensions: hunger, conflict, poverty, health, climate, inequality. Click any country for a full dossier.",
    url: `${SITE.url}/sorrow-map/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sorrow Map \u2014 World Crisis Atlas",
    description: "Interactive choropleth of 200 countries colored by 48 dimensions: hunger, conflict, poverty, health, climate, inequality. Click any country for a full dossier.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
