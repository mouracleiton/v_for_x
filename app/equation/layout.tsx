import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Equation \u2014 Model the Fix",
  description: "Ending global hunger costs $93B/year = 0.9% of military spending. 5 budget scenarios, 10-year projections, 8.7M lives saved. The math is undeniable.",
  alternates: { canonical: `${SITE.url}/equation/` },
  openGraph: {
    title: "The Equation \u2014 Model the Fix",
    description: "Ending global hunger costs $93B/year = 0.9% of military spending. 5 budget scenarios, 10-year projections, 8.7M lives saved. The math is undeniable.",
    url: `${SITE.url}/equation/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Equation \u2014 Model the Fix",
    description: "Ending global hunger costs $93B/year = 0.9% of military spending. 5 budget scenarios, 10-year projections, 8.7M lives saved. The math is undeniable.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
