import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Allocator \u2014 Budget Simulator",
  description: "You have the world's military budget. Drag sliders across 6 SDG goals. See how many lives you save. Every dollar is a choice between war and humanity.",
  alternates: { canonical: `${SITE.url}/the-allocator/` },
  openGraph: {
    title: "The Allocator \u2014 Budget Simulator",
    description: "You have the world's military budget. Drag sliders across 6 SDG goals. See how many lives you save. Every dollar is a choice between war and humanity.",
    url: `${SITE.url}/the-allocator/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Allocator \u2014 Budget Simulator",
    description: "You have the world's military budget. Drag sliders across 6 SDG goals. See how many lives you save. Every dollar is a choice between war and humanity.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
