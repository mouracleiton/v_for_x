import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Chain — Arms, Sanctions & Aid Relationship Graph',
  description: 'Interactive geopolitical relationship graph: who sells weapons to whom (SIPRI arms transfers), who sanctions whom (UN/EU/US regimes), and who donates aid to whom (OECD DAC). 50 countries, 79 tracked flows.',
  alternates: { canonical: `${SITE.url}/the-chain/` },
  openGraph: {
    title: 'The Chain — Arms, Sanctions & Aid Relationship Graph',
    description: 'Interactive geopolitical relationship graph: who sells weapons to whom (SIPRI arms transfers), who sanctions whom (UN/EU/US regimes), and who donates aid to whom (OECD DAC). 50 countries, 79 tracked flows.',
    url: `${SITE.url}/the-chain/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: 'The Chain — Arms, Sanctions & Aid Relationship Graph',
    description: 'Interactive geopolitical relationship graph: who sells weapons to whom (SIPRI arms transfers), who sanctions whom (UN/EU/US regimes), and who donates aid to whom (OECD DAC). 50 countries, 79 tracked flows.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
