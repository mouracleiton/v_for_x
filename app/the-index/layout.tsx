import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Index \u2014 Vulnerability Ranking",
  description: "Composite vulnerability index across 16 domains. Interactive weight sliders, regional rollups, radar charts. Which countries are most vulnerable and why.",
  alternates: { canonical: `${SITE.url}/the-index/` },
  openGraph: {
    title: "The Index \u2014 Vulnerability Ranking",
    description: "Composite vulnerability index across 16 domains. Interactive weight sliders, regional rollups, radar charts. Which countries are most vulnerable and why.",
    url: `${SITE.url}/the-index/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Index \u2014 Vulnerability Ranking",
    description: "Composite vulnerability index across 16 domains. Interactive weight sliders, regional rollups, radar charts. Which countries are most vulnerable and why.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
