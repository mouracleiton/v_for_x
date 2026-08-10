import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Docs — Offline-First Collaborative Documents",
  description:
    "Conflict-free collaborative text documents that sync offline. An RGA CRDT implemented from scratch — no servers, no accounts, no cloud. Documents meet when you exchange them: copy, paste, or broadcast.",
  alternates: { canonical: `${SITE.url}/the-docs/` },
  openGraph: {
    title: "The Docs — Offline-First Collaborative Documents",
    description:
      "Conflict-free collaborative documents powered by a from-scratch RGA CRDT. Pure local-first: export, import, and BroadcastChannel sync.",
    url: `${SITE.url}/the-docs/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
