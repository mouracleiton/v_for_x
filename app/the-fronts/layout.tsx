import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Fronts \u2014 Regional Crisis Dashboard",
  description: "Per-region deep-dives: Africa's 15 hotspots, Asia's conflict zones, Americas' invisible crises. Vulnerability radar, aggregate stats, full country rankings.",
  alternates: { canonical: `${SITE.url}/the-fronts/` },
  openGraph: {
    title: "The Fronts \u2014 Regional Crisis Dashboard",
    description: "Per-region deep-dives: Africa's 15 hotspots, Asia's conflict zones, Americas' invisible crises. Vulnerability radar, aggregate stats, full country rankings.",
    url: `${SITE.url}/the-fronts/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Fronts \u2014 Regional Crisis Dashboard",
    description: "Per-region deep-dives: Africa's 15 hotspots, Asia's conflict zones, Americas' invisible crises. Vulnerability radar, aggregate stats, full country rankings.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
