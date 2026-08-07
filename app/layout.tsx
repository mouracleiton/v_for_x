import type { Metadata, Viewport } from "next";
import "./globals.css";
import BranchNav from "@/components/shared/BranchNav";

export const metadata: Metadata = {
  title: "V FOR X",
  description:
    "An indestructible, decentralized infrastructure for exposing corruption, routing resources, and sharing survival knowledge.",
  robots: "noindex, nofollow",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flicker">
        <div className="scanlines crt-vignette grain min-h-screen flex">
          <BranchNav />
          <main className="flex-1 min-w-0 max-w-full">{children}</main>
        </div>
      </body>
    </html>
  );
}
