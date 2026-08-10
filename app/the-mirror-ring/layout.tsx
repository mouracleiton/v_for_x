import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Mirror Ring — Verified Mirror Directory",
  description:
    "A verified mirror directory with one-click host swap. Open any mirror, swap hosts, or paste a signed VFXM1: claim token to make a mirror join the ring. Fully static, privacy-preserving, local ECDSA verification, no backend.",
  alternates: { canonical: `${SITE.url}/the-mirror-ring/` },
  openGraph: {
    title: "The Mirror Ring — Verified Mirror Directory",
    description:
      "Paste a signed VFXM1: claim token, verify it locally, and swap to any mirror in the ring. Distributed, serverless, no central registry.",
    url: `${SITE.url}/the-mirror-ring/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}