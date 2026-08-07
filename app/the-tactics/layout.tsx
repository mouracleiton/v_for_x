import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Tactics \u2014 Resistance Decision Matrix",
  description: "17 ways to respond to crisis, ranked by effectiveness. Nonviolent resistance: 53% success. Armed insurgency: 26%. The Chenoweth data is clear.",
  alternates: { canonical: `${SITE.url}/the-tactics/` },
  openGraph: {
    title: "The Tactics \u2014 Resistance Decision Matrix",
    description: "17 ways to respond to crisis, ranked by effectiveness. Nonviolent resistance: 53% success. Armed insurgency: 26%. The Chenoweth data is clear.",
    url: `${SITE.url}/the-tactics/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Tactics \u2014 Resistance Decision Matrix",
    description: "17 ways to respond to crisis, ranked by effectiveness. Nonviolent resistance: 53% success. Armed insurgency: 26%. The Chenoweth data is clear.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
