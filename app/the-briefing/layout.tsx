import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Briefing \u2014 Country Report Generator",
  description: "Pick any of 200 countries. Get a devastating one-page report with its specific numbers. Printable. Shareable. The argument made personal.",
  alternates: { canonical: `${SITE.url}/the-briefing/` },
  openGraph: {
    title: "The Briefing \u2014 Country Report Generator",
    description: "Pick any of 200 countries. Get a devastating one-page report with its specific numbers. Printable. Shareable. The argument made personal.",
    url: `${SITE.url}/the-briefing/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Briefing \u2014 Country Report Generator",
    description: "Pick any of 200 countries. Get a devastating one-page report with its specific numbers. Printable. Shareable. The argument made personal.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
