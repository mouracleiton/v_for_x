import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Dashboard \u2014 World Crisis Cockpit",
  description: "One screen. The entire world's crisis. Live counters, 8 global indicators, extreme contrasts (Monaco earns 1028\u00d7 Burundi), cost-to-fix breakdown.",
  alternates: { canonical: `${SITE.url}/the-dashboard/` },
  openGraph: {
    title: "The Dashboard \u2014 World Crisis Cockpit",
    description: "One screen. The entire world's crisis. Live counters, 8 global indicators, extreme contrasts (Monaco earns 1028\u00d7 Burundi), cost-to-fix breakdown.",
    url: `${SITE.url}/the-dashboard/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Dashboard \u2014 World Crisis Cockpit",
    description: "One screen. The entire world's crisis. Live counters, 8 global indicators, extreme contrasts (Monaco earns 1028\u00d7 Burundi), cost-to-fix breakdown.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
