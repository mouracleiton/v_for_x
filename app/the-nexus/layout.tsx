import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Nexus — Kleptocracy & Dirty-Money Beneficial-Ownership Graph",
  description:
    "Force-directed graph of beneficial-ownership webs, shell companies and PEP (politically-exposed-person) networks. Reconstructed from Pandora Papers, Panama Papers, FinCEN Files, OCCRP and ICIJ investigations. 46 entities, 68 tracked relationships.",
  alternates: { canonical: `${SITE.url}/the-nexus/` },
  openGraph: {
    title:
      "The Nexus — Kleptocracy & Dirty-Money Beneficial-Ownership Graph",
    description:
      "Force-directed graph of beneficial-ownership webs, shell companies and PEP networks. Reconstructed from Pandora Papers, FinCEN Files, OCCRP and ICIJ investigations.",
    url: `${SITE.url}/the-nexus/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "The Nexus — Kleptocracy & Dirty-Money Beneficial-Ownership Graph",
    description:
      "Force-directed graph of beneficial-ownership webs, shell companies and PEP networks. Pandora Papers, FinCEN Files, OCCRP, ICIJ.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
