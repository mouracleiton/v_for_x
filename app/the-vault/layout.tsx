import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Vault — Curated Public Datasets for Accountability",
  description:
    "A vetted registry of 36 open datasets for exposing corruption, mapping conflict, and documenting human-rights abuse. Conflict, sanctions, censorship, hunger, climate, inequality — all country-keyed and free.",
  alternates: { canonical: `${SITE.url}/the-vault/` },
  openGraph: {
    title: "The Vault — Curated Public Datasets for Accountability",
    description:
      "A vetted registry of 36 open datasets for exposing corruption, mapping conflict, and documenting human-rights abuse.",
    url: `${SITE.url}/the-vault/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Vault — Curated Public Datasets for Accountability",
    description:
      "A vetted registry of 36 open datasets for exposing corruption, mapping conflict, and documenting human-rights abuse.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
