import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Data Health Monitor',
  description: 'Radical transparency about data limitations. Coverage scores for every metric and country across the 200×19 dataset — see which numbers are well-supported and which are sparse estimates.',
  alternates: { canonical: `${SITE.url}/the-data-health/` },
  openGraph: {
    title: 'The Data Health Monitor',
    description: 'Coverage scores for every metric and country across the 200×19 dataset — see which numbers are well-supported and which are sparse estimates.',
    url: `${SITE.url}/the-data-health/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
