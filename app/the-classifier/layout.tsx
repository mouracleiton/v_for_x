import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Classifier — On-device Document Triage with Local ML",
  description:
    "Classify document type (contract, speech, leak, financial, legal, NGO report), extract entities (people, companies, amounts, locations), and flag risk — all offline with a small in-browser transformer model. No text leaves your device.",
  alternates: { canonical: `${SITE.url}/the-classifier/` },
  openGraph: {
    title: "The Classifier — On-device Document Triage with Local ML",
    description:
      "Classify document type, extract entities, and flag risk with a small in-browser transformer model. WebGPU/WASM, fully offline.",
    url: `${SITE.url}/the-classifier/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
