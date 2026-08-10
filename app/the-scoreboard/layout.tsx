import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Scoreboard — Accountability Velocity",
  description:
    "Who is actually improving and who is backsliding? A composite velocity score ranks 200 countries by the direction and speed of change across hunger, conflict, democracy, health, and poverty.",
  alternates: { canonical: `${SITE.url}/the-scoreboard/` },
  openGraph: {
    title: "The Scoreboard — Accountability Velocity",
    description:
      "Who is actually improving and who is backsliding? Composite velocity scores for 200 countries.",
    url: `${SITE.url}/the-scoreboard/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Scoreboard — Accountability Velocity",
    description:
      "Who is actually improving and who is backsliding? Composite velocity scores for 200 countries.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
