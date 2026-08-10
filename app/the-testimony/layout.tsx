import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Testimony',
  description: 'Collect timestamped, ECDSA-signed witness statements. Hash-chained into a tamper-evident append-only log. Anonymous signing with P-256 keypairs. For Tribunal cases, ICC submissions, media reports.',
  alternates: { canonical: `${SITE.url}/the-testimony/` },
  openGraph: {
    title: 'The Testimony',
    description: 'Collect timestamped, ECDSA-signed witness statements. Hash-chained into a tamper-evident append-only log. Anonymous signing with P-256 keypairs. For Tribunal cases, ICC submissions, media reports.',
    url: `${SITE.url}/the-testimony/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
