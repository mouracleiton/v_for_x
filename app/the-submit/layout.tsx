import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Submit — Anonymous Dossier Submission",
  description:
    "Submit anonymous dossiers of war crimes, corruption, and human rights violations. Encrypted at rest, ECDSA-signed, broadcast tokens. No data leaves your device unless you choose to broadcast.",
  alternates: { canonical: `${SITE.url}/the-submit/` },
  openGraph: {
    title: "The Submit — Anonymous Dossier Submission",
    description:
      "Submit anonymous dossiers. Encrypted, signed, local-only. Your identity never leaves your device.",
    url: `${SITE.url}/the-submit/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Submit — Anonymous Dossier Submission",
    description: "Submit anonymous dossiers. Encrypted, signed, local-only.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
