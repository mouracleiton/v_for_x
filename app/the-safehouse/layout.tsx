import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Safehouse — Encrypted Evidence Store',
  description: 'AES-GCM encrypted client-side evidence and notes store for citizen journalists. Zero data leaves your device. PBKDF2 passphrase-derived keys, duress-wipe integration, encrypted export.',
  alternates: { canonical: `${SITE.url}/the-safehouse/` },
  openGraph: {
    title: 'The Safehouse — Encrypted Evidence Store',
    description: 'AES-GCM encrypted client-side evidence and notes store for citizen journalists. Zero data leaves your device. PBKDF2 passphrase-derived keys, duress-wipe integration, encrypted export.',
    url: `${SITE.url}/the-safehouse/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: 'The Safehouse — Encrypted Evidence Store',
    description: 'AES-GCM encrypted client-side evidence and notes store for citizen journalists. Zero data leaves your device. PBKDF2 passphrase-derived keys, duress-wipe integration, encrypted export.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
