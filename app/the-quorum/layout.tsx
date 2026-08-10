import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Quorum',
  description: 'Anonymous collective decision-making with zero-knowledge proofs. Vote without revealing who you are or how you voted. ZK set-membership proofs prevent double-voting.',
  alternates: { canonical: `${SITE.url}/the-quorum/` },
  openGraph: {
    title: 'The Quorum',
    description: 'Anonymous collective decision-making with zero-knowledge proofs. Vote without revealing who you are or how you voted. ZK set-membership proofs prevent double-voting.',
    url: `${SITE.url}/the-quorum/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
