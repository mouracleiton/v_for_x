import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: 'The Field Manual',
  description: '10 printable, scenario-specific survival guides: blackout, arrest, natural disaster, active conflict, medical emergency, digital breach, civil unrest, border crossing, comms blackout, evacuation.',
  alternates: { canonical: `${SITE.url}/the-field-manual/` },
  openGraph: {
    title: 'The Field Manual',
    description: '10 printable, scenario-specific survival guides: blackout, arrest, natural disaster, active conflict, medical emergency, digital breach, civil unrest, border crossing, comms blackout, evacuation.',
    url: `${SITE.url}/the-field-manual/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
