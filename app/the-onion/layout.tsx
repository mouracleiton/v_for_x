import type { Metadata } from "next";
import { getMeta } from "@/lib/seo";

const meta = getMeta("/the-onion/");

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  alternates: { canonical: `https://mouracleiton.github.io/v_for_x${meta.path}` },
  openGraph: {
    title: meta.title,
    description: meta.description,
    url: `https://mouracleiton.github.io/v_for_x${meta.path}`,
    images: [{ url: "https://mouracleiton.github.io/v_for_x/og-default.png", width: 1200, height: 630 }],
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
