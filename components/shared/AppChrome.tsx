"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import BranchNav from "@/components/shared/BranchNav";
import GlobalSearch from "@/components/shared/GlobalSearch";
import EasterEggPopup from "@/components/shared/EasterEggPopup";
import ResumeSessionStrip from "@/components/shared/ResumeSessionStrip";
import ActivityDrawer from "@/components/shared/ActivityDrawer";
import NextInLoop from "@/components/shared/NextInLoop";
import ShareSheet from "@/components/shared/ShareSheet";
import { logPageVisited } from "@/lib/ops-journal";
import { entryFromRoute, recordVisit } from "@/lib/resume-session";

/**
 * Conditionally renders the site chrome (nav, search, easter egg, CRT
 * scanline overlay). Embeddable widget routes live under /embed and must
 * render clean — no sidebar, no overlays — so they look right inside a
 * third-party <iframe>. Every other route gets the full command center.
 */
export default function AppChrome({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const isEmbed = pathname?.startsWith("/embed");

	useEffect(() => {
		if (!pathname || isEmbed) return;
		void logPageVisited(pathname);
		recordVisit(entryFromRoute(pathname));
	}, [pathname, isEmbed]);

	if (isEmbed) {
		return <div className="min-h-screen">{children}</div>;
	}

	return (
		<>
			<div className="scanlines crt-vignette grain min-h-screen flex">
				<BranchNav />
				<main className="flex-1 min-w-0 max-w-full">
					<ResumeSessionStrip />
					<NextInLoop />
					{children}
				</main>
			</div>
			<GlobalSearch />
			<EasterEggPopup />
			<ActivityDrawer />
			<ShareSheet mode="fab" />
		</>
	);
}
