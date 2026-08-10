import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Heatmap — Crowdsourced Incident Reporter",
  description: "Drop pins for witnessed incidents on an interactive map. Each report is ECDSA-signed, hash-chained, and stored locally. Export as signed JSON for distribution. Distinct from the Registry and Chronicle — this is a live, participatory map.",
  alternates: { canonical: `${SITE.url}/the-heatmap/` },
  openGraph: {
    title: "The Heatmap — Crowdsourced Incident Reporter",
    description: "ECDSA-signed, hash-chained incident map. Drop pins, attach photos (EXIF-stripped), export signed reports.",
    url: `${SITE.url}/the-heatmap/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
