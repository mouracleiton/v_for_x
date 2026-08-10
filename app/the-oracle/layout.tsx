import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Oracle — Natural-Language Data Query Engine',
  description: 'Ask any question about 200 countries × 24 dimensions in plain English. Instant ranked answers. No API calls, no AI service — pure client-side pattern matching.',
  alternates: { canonical: `${SITE.url}/the-oracle/` },
  openGraph: {
    title: 'The Oracle — Natural-Language Data Query Engine',
    description: 'Ask any question about 200 countries × 24 dimensions in plain English. Instant ranked answers. No API calls, no AI service — pure client-side pattern matching.',
    url: `${SITE.url}/the-oracle/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: 'The Oracle — Natural-Language Data Query Engine',
    description: 'Ask any question about 200 countries × 24 dimensions in plain English. Instant ranked answers. No API calls, no AI service — pure client-side pattern matching.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
