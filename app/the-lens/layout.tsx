import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Lens \u2014 Compare & Correlate",
  description: "Cross-dimension correlation explorer: 200 countries plotted on any two metrics with Pearson correlation. Side-by-side comparison table + vulnerability radar overlay.",
  alternates: { canonical: `${SITE.url}/the-lens/` },
  openGraph: {
    title: "The Lens \u2014 Compare & Correlate",
    description: "Cross-dimension correlation explorer: 200 countries plotted on any two metrics with Pearson correlation. Side-by-side comparison table + vulnerability radar overlay.",
    url: `${SITE.url}/the-lens/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Lens \u2014 Compare & Correlate",
    description: "Cross-dimension correlation explorer: 200 countries plotted on any two metrics with Pearson correlation. Side-by-side comparison table + vulnerability radar overlay.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
