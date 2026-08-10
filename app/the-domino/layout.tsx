import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Domino — Cascading Crisis Simulator",
  description:
    "Pick a shock and watch it propagate through 24 dimensions across countries via trade, migration, and conflict spillover. Hunger → displacement → poverty → conflict. No crisis is isolated.",
  alternates: { canonical: `${SITE.url}/the-domino/` },
  openGraph: {
    title: "The Domino — Cascading Crisis Simulator",
    description:
      "Pick a shock and watch it propagate through countries and dimensions. No crisis is isolated.",
    url: `${SITE.url}/the-domino/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Domino — Cascading Crisis Simulator",
    description:
      "Pick a shock and watch it propagate through countries and dimensions. No crisis is isolated.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
