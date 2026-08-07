import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Trail \u2014 Resource Routing",
  description: "Aid and logistics ledger. Match needs with resources. Cryptographically signed entries stored locally. No central authority.",
  alternates: { canonical: `${SITE.url}/the-trail/` },
  openGraph: {
    title: "The Trail \u2014 Resource Routing",
    description: "Aid and logistics ledger. Match needs with resources. Cryptographically signed entries stored locally. No central authority.",
    url: `${SITE.url}/the-trail/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Trail \u2014 Resource Routing",
    description: "Aid and logistics ledger. Match needs with resources. Cryptographically signed entries stored locally. No central authority.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
