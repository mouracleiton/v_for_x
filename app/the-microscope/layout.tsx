import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Microscope — Single-Metric Deep-Dive",
  description:
    "Pick any of 26 metrics and zoom in: full ranking, distribution, regional averages, outliers, quintile breakdown, and best/worst performers across 200 countries.",
  alternates: { canonical: `${SITE.url}/the-microscope/` },
  openGraph: {
    title: "The Microscope — Single-Metric Deep-Dive",
    description:
      "Pick any metric and get the full global statistical picture across 200 countries.",
    url: `${SITE.url}/the-microscope/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Microscope — Single-Metric Deep-Dive",
    description:
      "Pick any metric and get the full global statistical picture across 200 countries.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
