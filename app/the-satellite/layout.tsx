import type { Metadata } from "next";
import { SITE, getMeta } from "@/lib/seo";

const meta = getMeta("/the-satellite/");

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  alternates: { canonical: `${SITE.url}${meta.path}` },
  openGraph: {
    title: meta.title,
    description: meta.description,
    url: `${SITE.url}${meta.path}`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: meta.title,
    description: meta.description,
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
