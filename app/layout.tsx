import type { Metadata, Viewport } from "next";
import "./globals.css";
import BranchNav from "@/components/shared/BranchNav";
import ServiceWorkerRegister from "@/components/shared/ServiceWorkerRegister";
import GlobalSearch from "@/components/shared/GlobalSearch";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    default: SITE.title,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  manifest: "/manifest.json",
  keywords: [
    "hunger", "food security", "SDG2", "zero hunger", "global crisis",
    "humanitarian", "conflict", "displacement", "refugees", "poverty",
    "inequality", "military spending", "climate", "open data", "CC0",
    "world statistics", "country comparison", "vulnerability index",
  ],
  authors: [{ name: "V FOR X" }],
  creator: SITE.name,
  publisher: SITE.name,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE.url,
  },
  openGraph: {
    type: "website",
    locale: SITE.locale,
    url: SITE.url,
    siteName: SITE.name,
    title: SITE.title,
    description: SITE.description,
    images: [
      {
        url: SITE.ogImage,
        width: 1200,
        height: 630,
        alt: "V FOR X — 200 countries × 19 dimensions. The equation writes itself.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.title,
    description: SITE.description,
    images: [SITE.ogImage],
    creator: SITE.twitter,
  },
  appleWebApp: {
    capable: true,
    title: SITE.name,
    statusBarStyle: "black-translucent",
  },
  category: "education",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#cc0000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flicker">
        <ServiceWorkerRegister />
        <div className="scanlines crt-vignette grain min-h-screen flex">
          <BranchNav />
          <main className="flex-1 min-w-0 max-w-full">{children}</main>
        </div>
        <GlobalSearch />
      </body>
    </html>
  );
}
