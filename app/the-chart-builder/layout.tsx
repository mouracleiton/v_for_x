import type { Metadata } from "next";
import { SITE, getMeta } from "@/lib/seo";

const m = getMeta("/the-chart-builder/");

export const metadata: Metadata = {
  title: m.title,
  description: m.description,
  alternates: { canonical: `${SITE.url}${m.path}` },
  openGraph: {
    title: m.title,
    description: m.description,
    url: `${SITE.url}${m.path}`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: m.title,
    description: m.description,
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
