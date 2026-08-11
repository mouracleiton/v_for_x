import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Corrections Ledger",
  description: 'Community-verified data. Flag a wrong number, attach a source, sign the correction on-device, and export a portable correction package. A review layer on top of the authoritative backbone.',
  alternates: { canonical: `${SITE.url}/the-corrections/` },
  openGraph: {
    title: "The Corrections Ledger",
    description: 'Flag wrong numbers with sources, sign corrections on-device, and export portable correction packages.',
    url: `${SITE.url}/the-corrections/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
