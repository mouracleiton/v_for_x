import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The Forensics — OSINT Image & Video Verification",
  description:
    "Verify before you publish. Drop an image for error-level analysis (tamper detection), EXIF timeline forensics, reverse-search launchers, frame-by-frame video comparison, and shadow-angle geolocation. Pure client-side canvas work — nothing leaves your browser.",
  alternates: { canonical: `${SITE.url}/the-forensics/` },
  openGraph: {
    title: "The Forensics — OSINT Image & Video Verification",
    description:
      "Verify before you publish. Error-level analysis, EXIF timeline forensics, reverse-search launchers, video frame comparison, and shadow-angle geolocation. Pure client-side canvas work.",
    url: `${SITE.url}/the-forensics/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Forensics — OSINT Image & Video Verification",
    description:
      "Verify before you publish. ELA tamper detection, EXIF timeline, reverse-search launchers, video frame comparison, shadow-angle geolocation. Client-side only.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
