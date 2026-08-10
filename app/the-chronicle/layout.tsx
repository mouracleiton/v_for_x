import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Chronicle",
  description:
    "A crowdsourced, verified incident map — a distributed Ushahidi. Submit geolocated events, each cryptographically signed and hash-chained into a tamper-evident append-only log. Community members corroborate reports, raising verification status. No authority can silently rewrite the record. Local-first, anonymous.",
  alternates: { canonical: `${SITE.url}/the-chronicle/` },
  openGraph: {
    title: "The Chronicle — Distributed Event Mapping",
    description:
      "A distributed Ushahidi: geolocated events, signed, hash-chained, community-corroborated. A living record of incidents across a map and timeline that no single authority can forge.",
    url: `${SITE.url}/the-chronicle/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
