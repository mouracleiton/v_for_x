import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Network — Anonymous Action Circles",
  description:
    "Coordinate anonymous action circles, public pledges, and self-destructing encrypted dead drops. Topic-based organising by country or crisis. All data is local-first.",
  alternates: { canonical: `${SITE.url}/the-network/` },
  openGraph: {
    title: "The Network — Anonymous Action Circles",
    description:
      "Action circles, pledge wall, and self-destructing dead drops. Local-first, anonymous.",
    url: `${SITE.url}/the-network/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Network — Anonymous Action Circles",
    description: "Action circles, pledges, and self-destructing dead drops. Local-first.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
