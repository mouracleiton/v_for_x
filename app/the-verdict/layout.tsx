import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Verdict',
  description: 'Rapid-response misinformation counter. Claim → hashed sources → verdict with confidence scoring. Take any regime or official assertion, attach 3 SHA-256-verified sources, and render a structured verdict you can share.',
  alternates: { canonical: `${SITE.url}/the-verdict/` },
  openGraph: {
    title: 'The Verdict — Structured Fact-Checking Engine',
    description: 'Rapid-response misinformation counter. Claim → hashed sources → verdict with confidence scoring. "Regime says X — here\'s the verified truth, with 3 hashed sources."',
    url: `${SITE.url}/the-verdict/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
