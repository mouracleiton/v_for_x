import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Playbooks — Situation Response Guides",
  description: "7 crisis response playbooks with checklist UI for arrest, internet shutdown, displacement, medical crisis, surveillance, violent crackdown, and document emergencies",
  alternates: { canonical: `${SITE.url}/the-playbooks/` },
  openGraph: {
    title: "The Playbooks — Situation Response Guides",
    description: "7 crisis response playbooks with checklist UI for arrest, internet shutdown, displacement, medical crisis, surveillance, violent crackdown, and document emergencies",
    url: `${SITE.url}/the-playbooks/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Playbooks — Situation Response Guides",
    description: "7 crisis response playbooks with checklist UI for arrest, internet shutdown, displacement, medical crisis, surveillance, violent crackdown, and document emergencies",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
