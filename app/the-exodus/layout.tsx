import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Exodus \u2014 Displacement Flow Map",
  description: "Interactive map of the global displacement crisis. Curved flow arcs between refugee origins and hosts. 120M+ forcibly displaced. Every arc is a human stream.",
  alternates: { canonical: `${SITE.url}/the-exodus/` },
  openGraph: {
    title: "The Exodus \u2014 Displacement Flow Map",
    description: "Interactive map of the global displacement crisis. Curved flow arcs between refugee origins and hosts. 120M+ forcibly displaced. Every arc is a human stream.",
    url: `${SITE.url}/the-exodus/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Exodus \u2014 Displacement Flow Map",
    description: "Interactive map of the global displacement crisis. Curved flow arcs between refugee origins and hosts. 120M+ forcibly displaced. Every arc is a human stream.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
