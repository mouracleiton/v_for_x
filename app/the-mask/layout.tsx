import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Mask \u2014 Identity & OpSec",
  description: "Operational security guide: threat models, duress codes, ZK identity concepts, browser fingerprinting, metadata hygiene, physical security, social engineering defense.",
  alternates: { canonical: `${SITE.url}/the-mask/` },
  openGraph: {
    title: "The Mask \u2014 Identity & OpSec",
    description: "Operational security guide: threat models, duress codes, ZK identity concepts, browser fingerprinting, metadata hygiene, physical security, social engineering defense.",
    url: `${SITE.url}/the-mask/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Mask \u2014 Identity & OpSec",
    description: "Operational security guide: threat models, duress codes, ZK identity concepts, browser fingerprinting, metadata hygiene, physical security, social engineering defense.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
