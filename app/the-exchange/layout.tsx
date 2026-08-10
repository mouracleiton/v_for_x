import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Exchange',
  description: 'Decentralized mutual-aid matching. Post what you have and what you need. The matching engine connects complementary offers and requests. No registration, no tracking, no central authority.',
  alternates: { canonical: `${SITE.url}/the-exchange/` },
  openGraph: {
    title: 'The Exchange',
    description: 'Decentralized mutual-aid matching. Post what you have and what you need. The matching engine connects complementary offers and requests. No registration, no tracking, no central authority.',
    url: `${SITE.url}/the-exchange/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
