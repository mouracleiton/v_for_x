import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Oracle — On-device Semantic Query Engine',
  description: 'Ask any question about 200 countries × 28 dimensions in plain English. A small transformer model runs locally in your browser (WebGPU/WASM) and understands real language — "which countries are most likely to tip into famine next year". Your queries never leave this device. 100% on-device, privacy-first.',
  alternates: { canonical: `${SITE.url}/the-oracle/` },
  openGraph: {
    title: 'The Oracle — On-device Semantic Query Engine',
    description: 'Ask any question about 200 countries × 28 dimensions in plain English. A small transformer model runs locally in your browser (WebGPU/WASM) and understands real language. Your queries never leave this device.',
    url: `${SITE.url}/the-oracle/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: 'The Oracle — On-device Semantic Query Engine',
    description: 'Ask any question about 200 countries × 28 dimensions in plain English. A small transformer model runs locally in your browser (WebGPU/WASM) and understands real language. Your queries never leave this device.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
