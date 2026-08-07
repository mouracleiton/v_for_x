import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The API \u2014 Public Data API",
  description: "200 countries, 23 dimensions, ~87 fields per country. CC0 license. No auth, no rate limits. Interactive explorer with live queries and code samples.",
  alternates: { canonical: `${SITE.url}/the-api/` },
  openGraph: {
    title: "The API \u2014 Public Data API",
    description: "200 countries, 23 dimensions, ~87 fields per country. CC0 license. No auth, no rate limits. Interactive explorer with live queries and code samples.",
    url: `${SITE.url}/the-api/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The API \u2014 Public Data API",
    description: "200 countries, 23 dimensions, ~87 fields per country. CC0 license. No auth, no rate limits. Interactive explorer with live queries and code samples.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
