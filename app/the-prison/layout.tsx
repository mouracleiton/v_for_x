import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Prison Atlas',
  description: 'Incarceration across 191 countries: prison population and incarceration rate per 100,000, ranked and filterable. Who locks people up the most — and what it says about justice.',
  alternates: { canonical: `${SITE.url}/the-prison/` },
  openGraph: {
    title: 'The Prison Atlas',
    description: 'Incarceration rates per 100,000 across 191 countries — ranked, region-filterable, transparent about gaps.',
    url: `${SITE.url}/the-prison/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
