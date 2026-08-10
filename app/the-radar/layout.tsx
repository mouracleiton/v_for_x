import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Radar — Corruption Database",
  description: "Interactive corruption database across 200 countries. Multi-dimensional analysis: Control of Corruption, Government Effectiveness, Rule of Law, Political Stability, Regulatory Quality, Voice & Accountability. Risk classification, ranking, trends, and CSV export. Powered by World Bank WGI.",
  alternates: { canonical: `${SITE.url}/the-radar/` },
  openGraph: {
    title: "The Radar — Corruption Database",
    description: "Multi-dimensional corruption analysis across 200 countries with 6 WGI indicators.",
    url: `${SITE.url}/the-radar/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
