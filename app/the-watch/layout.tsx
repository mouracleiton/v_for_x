import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Watch',
  description: 'Define threshold alert rules across 15 crisis metrics. "Alert me when any country\'s hunger rate exceeds 30%." Evaluated client-side on every visit. Integrates with the risk model.',
  alternates: { canonical: `${SITE.url}/the-watch/` },
  openGraph: {
    title: 'The Watch',
    description: 'Define threshold alert rules across 15 crisis metrics. "Alert me when any country\'s hunger rate exceeds 30%." Evaluated client-side on every visit. Integrates with the risk model.',
    url: `${SITE.url}/the-watch/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
