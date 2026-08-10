import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Lives',
  description: 'The statistics represent real human lives. A running memorial counter for every person lost to preventable causes — hunger, conflict, disease, lack of clean water. Names, not numbers.',
  alternates: { canonical: `${SITE.url}/the-lives/` },
  openGraph: {
    title: 'The Lives',
    description: 'The statistics represent real human lives. A running memorial counter for every person lost to preventable causes — hunger, conflict, disease, lack of clean water. Names, not numbers.',
    url: `${SITE.url}/the-lives/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
