import type { Metadata } from "next";
import { SITE, PAGE_META } from "@/lib/seo";

const meta = PAGE_META["/the-embed/"];

export const metadata: Metadata = {
  title: meta?.title ?? "The Embed — Widget Builder",
  description:
    meta?.description ??
    "Build drop-in iframe widgets from V FOR X visuals: the Sorrow Map, Lives counter, SDG countdown, and country mini-briefs. Copy-paste embed code for any blog or news site.",
  alternates: { canonical: `${SITE.url}/the-embed/` },
  openGraph: {
    title: meta?.title ?? "The Embed — Widget Builder",
    description:
      meta?.description ??
      "Drop-in iframe widgets for the strongest V FOR X visuals. Virality through syndication.",
    url: `${SITE.url}/the-embed/`,
    type: "website",
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: meta?.title ?? "The Embed — Widget Builder",
    description:
      meta?.description ??
      "Drop-in iframe widgets for the strongest V FOR X visuals.",
  },
};

export default function TheEmbedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
