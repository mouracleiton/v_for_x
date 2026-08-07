import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Signal \u2014 Watchlist & Alerts",
  description: "Monitor countries for crisis escalation. Custom alert rules across 33 metrics. Multi-dimensional threat assessment with shareable configurations.",
  alternates: { canonical: `${SITE.url}/the-signal/` },
  openGraph: {
    title: "The Signal \u2014 Watchlist & Alerts",
    description: "Monitor countries for crisis escalation. Custom alert rules across 33 metrics. Multi-dimensional threat assessment with shareable configurations.",
    url: `${SITE.url}/the-signal/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Signal \u2014 Watchlist & Alerts",
    description: "Monitor countries for crisis escalation. Custom alert rules across 33 metrics. Multi-dimensional threat assessment with shareable configurations.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
