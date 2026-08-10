import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Promises',
  description: 'Track politician pledges versus deliveries. Record promises, update their status, and compute a transparent truth-score. Who kept their word and who lied?',
  alternates: { canonical: `${SITE.url}/the-promises/` },
  openGraph: {
    title: 'The Promises',
    description: 'Track politician pledges versus deliveries. Record promises, update their status, and compute a transparent truth-score. Who kept their word and who lied?',
    url: `${SITE.url}/the-promises/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
