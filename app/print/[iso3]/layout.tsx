import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Printable Country Brief — V FOR X",
  description:
    "Data-dense, print-ready intelligence brief for any of 200 countries. Key metrics, crisis indicators, vulnerability breakdown, and dossier references. Export to PDF or HTML.",
  alternates: { canonical: `${SITE.url}/print/` },
  openGraph: {
    title: "Printable Country Brief — V FOR X",
    description:
      "Data-dense, print-ready intelligence brief for any of 200 countries. Export to PDF or HTML.",
    url: `${SITE.url}/print/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Printable Country Brief — V FOR X",
    description:
      "Data-dense, print-ready intelligence brief for any of 200 countries.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
