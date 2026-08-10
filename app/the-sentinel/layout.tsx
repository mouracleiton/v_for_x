import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Sentinel",
  description:
    "Real-time repression and protest situational-awareness map. Drop anonymous incident markers for kettles, tear gas, mass arrests, snipers, military deployment and comms blackouts. Live heat zones, threat clustering, and escape-vector routing. Local-first, anonymous, time-decaying.",
  alternates: { canonical: `${SITE.url}/the-sentinel/` },
  openGraph: {
    title: "The Sentinel — Real-time Repression Map",
    description:
      "Map state/repressive forces during protests in real time. Anonymous incident reports, live heat zones, threat clustering, and escape routing. Nothing leaves your device.",
    url: `${SITE.url}/the-sentinel/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
