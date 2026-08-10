import type { Metadata } from "next";

/**
 * Embeddable widget routes. These are designed to live inside third-party
 * <iframe>s, so they are excluded from search indexing to avoid
 * fragmenting the canonical pages' rankings.
 */
export const metadata: Metadata = {
  title: "V FOR X — Embeddable Widget",
  description:
    "Embeddable V FOR X crisis widget. Drop-in iframe for blogs and news sites.",
  robots: { index: false, follow: true },
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
