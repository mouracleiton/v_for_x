import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

const TITLE = "The Stepping Stone \u2014 Circumvention Live-Tester";
const DESCRIPTION =
  "Client-side tester that probes which transports work from YOUR connection right now: domain fronting, Snowflake bridges, MASQUE. Measures latency and throughput, then recommends the best path past censorship.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE.url}/the-stepping-stone/` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE.url}/the-stepping-stone/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
