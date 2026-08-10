import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The World Data — Our World in Data Explorer",
  description: "Explore 14,000+ charts from Our World in Data. Long-run historical series: life expectancy, GDP, CO2 emissions, poverty, inequality, democracy, education, health, climate, food, and military spending. Time-series charts, rankings, and cross-country comparisons. Data from OWID (CC BY 4.0).",
  alternates: { canonical: `${SITE.url}/the-world-data/` },
  openGraph: {
    title: "The World Data — OWID Explorer",
    description: "Long-run historical data explorer powered by Our World in Data datasets.",
    url: `${SITE.url}/the-world-data/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
