import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Pulse — Multi-source Crisis Reader",
  description:
    "Client-side RSS / nitter / Atom aggregator. Consumes public humanitarian feeds, filters them through regional crisis keyword lexicons, and ranks every story by the platform's own vulnerability scores. IndexedDB cache, fully offline-readable.",
  alternates: { canonical: `${SITE.url}/the-pulse/` },
  openGraph: {
    title: "The Pulse — Multi-source Crisis Reader",
    description:
      "Consume public RSS / Atom / nitter feeds, filter by crisis keywords across regions, ranked by vulnerability score. Cached in IndexedDB, readable offline.",
    url: `${SITE.url}/the-pulse/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
