import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Bridge — Data Import / Export Hub",
  description: "Central data sovereignty hub. Import custom datasets, signed dossiers, and mirror snapshots. Export everything you created — watchlists, testimony, pledges — as a signed, encrypted bundle. Transfer between devices. Never lose your work.",
  alternates: { canonical: `${SITE.url}/the-bridge/` },
  openGraph: {
    title: "The Bridge — Data Import / Export Hub",
    description: "Data portability as a feature. Import and export everything as signed bundles.",
    url: `${SITE.url}/the-bridge/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
