import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Price Tag — Live Cost of Inaction",
  description:
    "A real-time meter showing the human, economic, and environmental cost of inaction — every second, every minute, every hour. Hunger, poverty, conflict, displacement, military waste, deforestation. The meter never stops.",
  alternates: { canonical: `${SITE.url}/the-price-tag/` },
  openGraph: {
    title: "The Price Tag — Live Cost of Inaction",
    description:
      "A real-time meter showing the human, economic, and environmental cost of inaction. The meter never stops.",
    url: `${SITE.url}/the-price-tag/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Price Tag — Live Cost of Inaction",
    description:
      "A real-time meter showing the human, economic, and environmental cost of inaction. The meter never stops.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
