import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Stories \u2014 Narrative Tours",
  description: "Guided data-driven stories through the world's crises. Crisis timelines for all 22 hunger hotspots. Step-by-step narrative tours connecting the dots.",
  alternates: { canonical: `${SITE.url}/the-stories/` },
  openGraph: {
    title: "The Stories \u2014 Narrative Tours",
    description: "Guided data-driven stories through the world's crises. Crisis timelines for all 22 hunger hotspots. Step-by-step narrative tours connecting the dots.",
    url: `${SITE.url}/the-stories/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Stories \u2014 Narrative Tours",
    description: "Guided data-driven stories through the world's crises. Crisis timelines for all 22 hunger hotspots. Step-by-step narrative tours connecting the dots.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
