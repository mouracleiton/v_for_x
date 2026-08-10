import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Faces — Humanizing the Data",
  description: "Consented, anonymized first-person stories, photo essays, and audio testimony from the front lines of preventable suffering. Statistics inform; stories move. The editorial layer behind every number.",
  alternates: { canonical: `${SITE.url}/the-faces/` },
  openGraph: {
    title: "The Faces — Humanizing the Data",
    description: "Consented, anonymized first-person stories, photo essays, and audio testimony from the front lines of preventable suffering. Statistics inform; stories move.",
    url: `${SITE.url}/the-faces/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Faces — Humanizing the Data",
    description: "Consented, anonymized first-person stories, photo essays, and audio testimony. Statistics inform; stories move.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
