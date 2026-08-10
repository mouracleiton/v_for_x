import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Roster — Vetted Helper Directory",
  description:
    "A crisis-response yellow pages of lawyers, doctors, journalists, digital-security trainers and other vetted helpers. Self-attested + peer-vouched credentials, each signed with an ECDSA-P256 keypair. Signed JSON, client-side verification, no backend.",
  alternates: { canonical: `${SITE.url}/the-roster/` },
  openGraph: {
    title: "The Roster — Vetted Helper Directory",
    description:
      "A crisis-response yellow pages of vetted helpers. Self-attested + peer-vouched credentials, each cryptographically signed. Signed JSON + client-side filter. No backend.",
    url: `${SITE.url}/the-roster/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Roster — Vetted Helper Directory",
    description:
      "Crisis-response yellow pages of vetted helpers. Self-attested + peer-vouched credentials, cryptographically signed. Client-side verification, no backend.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
