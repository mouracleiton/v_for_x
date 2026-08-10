import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Receipts — Blockchain Evidence Timestamps",
  description: "Anchor any file to the Bitcoin blockchain via OpenTimestamps. Get a SHA-256 hash, a calendar timestamp, and a .ots proof receipt. Verify any previously stamped file. Export a proof package. Tamper-evident, court-admissible, free.",
  alternates: { canonical: `${SITE.url}/the-receipts/` },
  openGraph: {
    title: "The Receipts — Blockchain Evidence Timestamps",
    description: "Anchor any file to the Bitcoin blockchain via OpenTimestamps. Tamper-evident, court-admissible proof that evidence existed at a specific moment.",
    url: `${SITE.url}/the-receipts/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
