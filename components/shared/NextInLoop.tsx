"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { nextInLoop } from "@/lib/crosslinks";

/**
 * Compact “Next in loop” strip for every module page.
 */
export default function NextInLoop({ className = "" }: { className?: string }) {
	const pathname = usePathname();
	const { next, related } = nextInLoop(pathname);

	return (
		<div
			className={`border-b border-border-dim bg-panel/40 px-3 py-1.5 flex flex-wrap items-center gap-2 text-[10px] font-mono ${className}`}
			data-next-in-loop
		>
			<span className="text-content-dim uppercase tracking-widest">
				Next in loop
			</span>
			<Link
				href={next.href}
				className="text-terminal-green hover:text-blood-bright underline-offset-2 hover:underline"
			>
				→ {next.label}
			</Link>
			<span className="text-content-dim hidden sm:inline">·</span>
			<span className="hidden sm:flex flex-wrap gap-2 text-content-secondary">
				{related.slice(1).map((r) => (
					<Link key={r.href} href={r.href} className="hover:text-blood-bright">
						{r.label}
					</Link>
				))}
			</span>
		</div>
	);
}
