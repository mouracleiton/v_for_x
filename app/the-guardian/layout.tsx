import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Guardian — People's Dead Man's Switch",
  description:
    "Scheduled check-ins, trusted-contact escalation, encrypted last-known-location, and panic-triggered broadcast. A life-safety net for activists, journalists, and organizers. AES-GCM encryption, PBKDF2 key derivation, duress codes, zero data leaves your device.",
  alternates: { canonical: `${SITE.url}/the-guardian/` },
  openGraph: {
    title: "The Guardian — People's Dead Man's Switch",
    description:
      "Scheduled check-ins, trusted-contact escalation, encrypted last-known-location, and panic-triggered broadcast. A life-safety net for activists and journalists.",
    url: `${SITE.url}/the-guardian/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
