import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Ledger \u2014 Financing & Blockers",
  description: "5 ways to fund the end of hunger (wealth tax, Tobin tax, BEPS, debt, military). 4 structural blockers. 3-phase roadmap to end hunger by 2034.",
  alternates: { canonical: `${SITE.url}/the-ledger/` },
  openGraph: {
    title: "The Ledger \u2014 Financing & Blockers",
    description: "5 ways to fund the end of hunger (wealth tax, Tobin tax, BEPS, debt, military). 4 structural blockers. 3-phase roadmap to end hunger by 2034.",
    url: `${SITE.url}/the-ledger/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Ledger \u2014 Financing & Blockers",
    description: "5 ways to fund the end of hunger (wealth tax, Tobin tax, BEPS, debt, military). 4 structural blockers. 3-phase roadmap to end hunger by 2034.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
