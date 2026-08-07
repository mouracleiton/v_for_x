import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Timeline \u2014 10-Year Scenario Model",
  description: "5 budget scenarios, 10 years, 8.7M lives in the balance. Interactive hunger trajectory, deaths-avoided chart, regional impact, per-intervention ROI breakdown.",
  alternates: { canonical: `${SITE.url}/the-timeline/` },
  openGraph: {
    title: "The Timeline \u2014 10-Year Scenario Model",
    description: "5 budget scenarios, 10 years, 8.7M lives in the balance. Interactive hunger trajectory, deaths-avoided chart, regional impact, per-intervention ROI breakdown.",
    url: `${SITE.url}/the-timeline/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Timeline \u2014 10-Year Scenario Model",
    description: "5 budget scenarios, 10 years, 8.7M lives in the balance. Interactive hunger trajectory, deaths-avoided chart, regional impact, per-intervention ROI breakdown.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
