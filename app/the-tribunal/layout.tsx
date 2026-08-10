import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Tribunal',
  description: 'Build evidence-backed accountability cases against officials and regimes. Hash-chained evidence ledger, legal framework templates, case strength scoring. A citizen-run ICC case preparation tool.',
  alternates: { canonical: `${SITE.url}/the-tribunal/` },
  openGraph: {
    title: 'The Tribunal',
    description: 'Build evidence-backed accountability cases against officials and regimes. Hash-chained evidence ledger, legal framework templates, case strength scoring. A citizen-run ICC case preparation tool.',
    url: `${SITE.url}/the-tribunal/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
