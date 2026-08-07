import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Registry \u2014 Accountability Dossiers",
  description: "13 evidence-based dossiers on war crimes, corruption, and human rights violations. ICC/ICJ accountability templates with source provenance.",
  alternates: { canonical: `${SITE.url}/registry/` },
  openGraph: {
    title: "Registry \u2014 Accountability Dossiers",
    description: "13 evidence-based dossiers on war crimes, corruption, and human rights violations. ICC/ICJ accountability templates with source provenance.",
    url: `${SITE.url}/registry/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Registry \u2014 Accountability Dossiers",
    description: "13 evidence-based dossiers on war crimes, corruption, and human rights violations. ICC/ICJ accountability templates with source provenance.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
