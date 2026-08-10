import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Cartographer — Custom Choropleth Map Builder',
  description: 'Build custom world map visualizations from 26 metrics across 200 countries. Choose from 6 color scales, set custom breakpoints, and generate bespoke choropleth maps.',
  alternates: { canonical: `${SITE.url}/the-cartographer/` },
  openGraph: {
    title: 'The Cartographer — Custom Choropleth Map Builder',
    description: 'Build custom world map visualizations from 26 metrics across 200 countries. Choose from 6 color scales, set custom breakpoints, and generate bespoke choropleth maps.',
    url: `${SITE.url}/the-cartographer/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: 'The Cartographer — Custom Choropleth Map Builder',
    description: 'Build custom world map visualizations from 26 metrics across 200 countries. Choose from 6 color scales, set custom breakpoints, and generate bespoke choropleth maps.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
