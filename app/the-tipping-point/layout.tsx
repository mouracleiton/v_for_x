import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Tipping Point — Early Warning System",
  description:
    "How close is each country to famine, conflict, state collapse, or health system breakdown? 12 critical thresholds across 200 countries — flags those approaching the edge before the crisis is declared.",
  alternates: { canonical: `${SITE.url}/the-tipping-point/` },
  openGraph: {
    title: "The Tipping Point — Early Warning System",
    description:
      "12 critical thresholds across 200 countries. Who is approaching the edge?",
    url: `${SITE.url}/the-tipping-point/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Tipping Point — Early Warning System",
    description:
      "12 critical thresholds across 200 countries. Who is approaching the edge?",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
