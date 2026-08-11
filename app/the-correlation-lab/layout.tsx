import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Correlation Lab',
  description: 'Guided statistical explorer across 200 countries. Pick any two of 87 data fields and see Pearson R, Spearman R, R², and p-values computed live in your browser — transparent data-journalism grade analysis.',
  alternates: { canonical: `${SITE.url}/the-correlation-lab/` },
  openGraph: {
    title: 'The Correlation Lab',
    description: 'Guided statistical explorer across 200 countries. Pick any two of 87 data fields and see Pearson R, Spearman R, R², and p-values computed live in your browser.',
    url: `${SITE.url}/the-correlation-lab/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
