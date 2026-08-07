import type { Metadata } from "next";
import "./globals.css";
import BranchNav from "@/components/shared/BranchNav";

export const metadata: Metadata = {
  title: "V FOR X",
  description:
    "An indestructible, decentralized infrastructure for exposing corruption, routing resources, and sharing survival knowledge.",
  robots: "noindex, nofollow",
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
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
