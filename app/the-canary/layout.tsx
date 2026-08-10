import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Canary — Dead Man\'s Switch',
  description: 'Encrypt a payload. Arm a timer. If you stop checking in, it releases. A whistleblower\'s insurance policy. AES-GCM encryption, PBKDF2 key derivation, zero data leaves your device.',
  alternates: { canonical: `${SITE.url}/the-canary/` },
  openGraph: {
    title: 'The Canary — Dead Man\'s Switch',
    description: 'Encrypt a payload. Arm a timer. If you stop checking in, it releases. A whistleblower\'s insurance policy.',
    url: `${SITE.url}/the-canary/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
