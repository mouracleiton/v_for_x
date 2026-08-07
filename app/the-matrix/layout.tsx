import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Matrix \u2014 Data Transparency",
  description: "Which countries have the most missing data? Per-country completeness scores across 20 dimensions. The blind spots of international measurement.",
  alternates: { canonical: `${SITE.url}/the-matrix/` },
  openGraph: {
    title: "The Matrix \u2014 Data Transparency",
    description: "Which countries have the most missing data? Per-country completeness scores across 20 dimensions. The blind spots of international measurement.",
    url: `${SITE.url}/the-matrix/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Matrix \u2014 Data Transparency",
    description: "Which countries have the most missing data? Per-country completeness scores across 20 dimensions. The blind spots of international measurement.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
