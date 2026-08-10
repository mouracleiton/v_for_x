import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Resistance',
  description: 'Global civil resistance movement tracker. Resistance ripeness scoring from structural conditions. Historical nonviolent movements (Chenoweth data). 18 tactics from Gene Sharp\'s methods.',
  alternates: { canonical: `${SITE.url}/the-resistance/` },
  openGraph: {
    title: 'The Resistance',
    description: 'Global civil resistance movement tracker. Resistance ripeness scoring from structural conditions. Historical nonviolent movements (Chenoweth data). 18 tactics from Gene Sharp\'s methods.',
    url: `${SITE.url}/the-resistance/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
