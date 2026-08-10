import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Cipher — Steganography & One-Time Pad',
  description: 'Hide messages in images (LSB steganography), encrypt with information-theoretically secure one-time pads, and encode burst messages with a field codebook. All client-side, all anonymous.',
  alternates: { canonical: `${SITE.url}/the-cipher/` },
  openGraph: {
    title: 'The Cipher — Steganography & One-Time Pad',
    description: 'Hide messages in images, encrypt with one-time pads, use field codebooks for burst communication.',
    url: `${SITE.url}/the-cipher/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
