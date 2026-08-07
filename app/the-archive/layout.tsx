import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Archive \u2014 Sources & Methods",
  description: "Full provenance: 16 primary sources (FAO, WHO, World Bank, SIPRI, UNHCR, V-Dem, more). Methodology, data freshness, and version history.",
  alternates: { canonical: `${SITE.url}/the-archive/` },
  openGraph: {
    title: "The Archive \u2014 Sources & Methods",
    description: "Full provenance: 16 primary sources (FAO, WHO, World Bank, SIPRI, UNHCR, V-Dem, more). Methodology, data freshness, and version history.",
    url: `${SITE.url}/the-archive/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Archive \u2014 Sources & Methods",
    description: "Full provenance: 16 primary sources (FAO, WHO, World Bank, SIPRI, UNHCR, V-Dem, more). Methodology, data freshness, and version history.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
