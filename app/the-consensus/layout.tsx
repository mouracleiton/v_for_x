import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Consensus — Mirror Fork Detection",
  description:
    "Detect root hash forks across mirrors to identify potential censorship, data manipulation, or network partition. Collect attestations from multiple mirrors and analyze consensus vs dissent. Fully static, no backend, local verification only.",
  alternates: { canonical: `${SITE.url}/the-consensus/` },
  openGraph: {
    title: "The Consensus — Mirror Fork Detection",
    description:
      "Collect and analyze mirror root hash attestations to detect forks. Distributed, serverless, ECDSA-verified consensus monitoring.",
    url: `${SITE.url}/the-consensus/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}