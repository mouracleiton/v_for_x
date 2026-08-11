import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Missions — Guided Onboarding",
  description: "Complete guided missions to master V FOR X capabilities. Persona-relevant workflows with progress tracking via VFXMSN1 tokens.",
  alternates: { canonical: `${SITE.url}/the-missions/` },
  openGraph: {
    title: "The Missions — Guided Onboarding",
    description: "Complete guided missions to master V FOR X capabilities. Persona-relevant workflows with progress tracking via VFXMSN1 tokens.",
    url: `${SITE.url}/the-missions/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Missions — Guided Onboarding",
    description: "Complete guided missions to master V FOR X capabilities. Persona-relevant workflows with progress tracking via VFXMSN1 tokens.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}