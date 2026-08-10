import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Countdown — SDG 2030 Deadline Tracker',
  description: 'Six UN Sustainable Development Goals. Six parallel equations — water, health, energy, education, climate, inequality. Each with a gap in human lives, a cost in billions, and a ticking clock.',
  alternates: { canonical: `${SITE.url}/the-countdown/` },
  openGraph: {
    title: 'The Countdown — SDG 2030 Deadline Tracker',
    description: 'Six UN Sustainable Development Goals. Six parallel equations — water, health, energy, education, climate, inequality. Each with a gap in human lives, a cost in billions, and a ticking clock.',
    url: `${SITE.url}/the-countdown/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: 'The Countdown — SDG 2030 Deadline Tracker',
    description: 'Six UN Sustainable Development Goals. Six parallel equations — water, health, energy, education, climate, inequality. Each with a gap in human lives, a cost in billions, and a ticking clock.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
