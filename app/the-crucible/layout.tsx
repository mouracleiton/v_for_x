import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Crucible — Cascading Crisis Simulator',
  description: 'Apply crisis shocks to any country — GDP collapse, conflict onset, climate disaster, food system failure — and watch domino effects cascade across every dimension. Heuristic multipliers from real crisis data.',
  alternates: { canonical: `${SITE.url}/the-crucible/` },
  openGraph: {
    title: 'The Crucible — Cascading Crisis Simulator',
    description: 'Apply crisis shocks to any country — GDP collapse, conflict onset, climate disaster, food system failure — and watch domino effects cascade across every dimension. Heuristic multipliers from real crisis data.',
    url: `${SITE.url}/the-crucible/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: 'The Crucible — Cascading Crisis Simulator',
    description: 'Apply crisis shocks to any country — GDP collapse, conflict onset, climate disaster, food system failure — and watch domino effects cascade across every dimension. Heuristic multipliers from real crisis data.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
