"use client";

import { usePathname } from "next/navigation";
import BranchNav from "@/components/shared/BranchNav";
import GlobalSearch from "@/components/shared/GlobalSearch";
import EasterEggPopup from "@/components/shared/EasterEggPopup";

/**
 * Conditionally renders the site chrome (nav, search, easter egg, CRT
 * scanline overlay). Embeddable widget routes live under /embed and must
 * render clean — no sidebar, no overlays — so they look right inside a
 * third-party <iframe>. Every other route gets the full command center.
 */
export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isEmbed = pathname?.startsWith("/embed");

  if (isEmbed) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <>
      <div className="scanlines crt-vignette grain min-h-screen flex">
        <BranchNav />
        <main className="flex-1 min-w-0 max-w-full">{children}</main>
      </div>
      <GlobalSearch />
      <EasterEggPopup />
    </>
  );
}
