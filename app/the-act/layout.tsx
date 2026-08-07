import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Act \u2014 Campaign Generator",
  description: "Transform country data into action-ready campaign kits: tweet threads, email templates, one-page briefs. Devastating framing backed by real numbers.",
  alternates: { canonical: `${SITE.url}/the-act/` },
  openGraph: {
    title: "The Act \u2014 Campaign Generator",
    description: "Transform country data into action-ready campaign kits: tweet threads, email templates, one-page briefs. Devastating framing backed by real numbers.",
    url: `${SITE.url}/the-act/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Act \u2014 Campaign Generator",
    description: "Transform country data into action-ready campaign kits: tweet threads, email templates, one-page briefs. Devastating framing backed by real numbers.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
