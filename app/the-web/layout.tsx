import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Web \u2014 Anonymous Communication",
  description: "Peer-to-peer encrypted messaging. No registration, no server, no tracking. WebRTC with manual signaling. Dead drops. Anonymous identity generation.",
  alternates: { canonical: `${SITE.url}/the-web/` },
  openGraph: {
    title: "The Web \u2014 Anonymous Communication",
    description: "Peer-to-peer encrypted messaging. No registration, no server, no tracking. WebRTC with manual signaling. Dead drops. Anonymous identity generation.",
    url: `${SITE.url}/the-web/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Web \u2014 Anonymous Communication",
    description: "Peer-to-peer encrypted messaging. No registration, no server, no tracking. WebRTC with manual signaling. Dead drops. Anonymous identity generation.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
