import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Choice \u2014 Military vs Health Spending",
  description: "10 countries spend more on military than health. Syria 3.1\u00d7, Qatar 2.9\u00d7. See the moral calculus per country. How many days of war spending would end your hunger?",
  alternates: { canonical: `${SITE.url}/the-choice/` },
  openGraph: {
    title: "The Choice \u2014 Military vs Health Spending",
    description: "10 countries spend more on military than health. Syria 3.1\u00d7, Qatar 2.9\u00d7. See the moral calculus per country. How many days of war spending would end your hunger?",
    url: `${SITE.url}/the-choice/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Choice \u2014 Military vs Health Spending",
    description: "10 countries spend more on military than health. Syria 3.1\u00d7, Qatar 2.9\u00d7. See the moral calculus per country. How many days of war spending would end your hunger?",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
