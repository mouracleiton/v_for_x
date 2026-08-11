import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Violence Atlas',
  description: 'Ranked view of state violence against women: female homicide rates per 100k across 132 countries, male/female split, and women\'s political representation as a countervailing force.',
  alternates: { canonical: `${SITE.url}/the-violence/` },
  openGraph: {
    title: 'The Violence Atlas',
    description: 'Female homicide rates, state violence, and women\'s political representation across 132 countries.',
    url: `${SITE.url}/the-violence/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
