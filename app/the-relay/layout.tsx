import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Relay',
  description: 'Offline burst message format for QR codes, LoRa, and dead drops. Encode, segment, and relay messages when the internet is cut. Compact envelope format with QR segmentation.',
  alternates: { canonical: `${SITE.url}/the-relay/` },
  openGraph: {
    title: 'The Relay',
    description: 'Offline burst message format for QR codes, LoRa, and dead drops. Encode, segment, and relay messages when the internet is cut. Compact envelope format with QR segmentation.',
    url: `${SITE.url}/the-relay/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
