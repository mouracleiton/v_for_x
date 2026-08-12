"use client";

/**
 * V FOR X — Fusion Redirect
 *
 * Static-export-safe client redirect used by the 14 route fusions in
 * lib/station-map.ts (fusedInto). Each fused route's page.tsx renders this,
 * which immediately replaces the URL with the canonical target and exposes a
 * visible manual link as a no-JS fallback. The original page content stays in
 * git history so any unique feature can be ported into the target later.
 *
 * Why client-side: Next's server redirect() throws under output:"export".
 * Why replace (not push): the old route must not linger in history.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function FusionRedirect({ to }: { to: string }) {
	const router = useRouter();
	useEffect(() => {
		router.replace(to);
	}, [router, to]);
	return (
		<div className="p-6 max-w-md mx-auto text-center min-h-[50vh] flex flex-col justify-center">
			<div className="text-blood-bright text-xs uppercase tracking-widest mb-2">
				// consolidated
			</div>
			<p className="text-content-secondary text-sm mb-4">
				This tool merged into another station. Redirecting…
			</p>
			<Link
				href={to}
				className="text-blood-bright text-sm underline hover:text-blood"
			>
				Go to {to} →
			</Link>
		</div>
	);
}
