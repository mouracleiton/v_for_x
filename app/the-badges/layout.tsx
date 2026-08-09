import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Badges — Knowledge & Action Tracker",
  description:
    "Track your exploration of 200 countries, earn badges, climb levels, and test your knowledge with the country quiz. Every visit deepens the argument.",
  alternates: { canonical: `${SITE.url}/the-badges/` },
  openGraph: {
    title: "The Badges — Knowledge & Action Tracker",
    description:
      "Track your exploration of 200 countries, earn badges, climb levels, and test your knowledge with the country quiz.",
    url: `${SITE.url}/the-badges/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Badges — Knowledge & Action Tracker",
    description:
      "Track your exploration of 200 countries, earn badges, climb levels, and test your knowledge with the country quiz.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
