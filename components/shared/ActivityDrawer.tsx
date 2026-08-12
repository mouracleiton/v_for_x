"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
	getRecentEvents,
	getOpsStats,
	type OpsEvent,
	type OpsStats,
} from "@/lib/ops-journal";

/**
 * Toggle + panel listing recent local ops-journal events.
 */
export default function ActivityDrawer() {
	const [open, setOpen] = useState(false);
	const [events, setEvents] = useState<OpsEvent[]>([]);
	const [stats, setStats] = useState<OpsStats | null>(null);

	const refresh = useCallback(() => {
		setEvents(getRecentEvents(20));
		try {
			setStats(getOpsStats());
		} catch {
			setStats(null);
		}
	}, []);

	useEffect(() => {
		if (open) refresh();
	}, [open, refresh]);

	return (
		<div className="fixed bottom-3 right-3 z-40 no-print font-mono">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="px-2.5 py-1.5 text-[10px] border border-border-dim bg-abyss text-content-secondary hover:border-blood hover:text-blood-bright transition-colors shadow-lg"
				aria-expanded={open}
				aria-controls="activity-drawer-panel"
			>
				{open ? "[ ✕ ACTIVITY ]" : "[ ACTIVITY ]"}
			</button>

			{open && (
				<div
					id="activity-drawer-panel"
					className="absolute bottom-full right-0 mb-2 w-[min(320px,90vw)] max-h-[50vh] overflow-y-auto border border-border-bright bg-abyss p-3 shadow-xl"
					role="dialog"
					aria-label="Recent activity"
				>
					<div className="text-[10px] text-blood-bright uppercase tracking-widest mb-2 border-b border-border-dim pb-1">
						{"> "}ops journal
					</div>
					{stats && (
						<div className="text-[9px] text-content-dim mb-2">
							{stats.totalEvents} events · {stats.missionsCompleted} missions
							done
							{stats.currentPersona ? ` · persona ${stats.currentPersona}` : ""}
						</div>
					)}
					{events.length === 0 ? (
						<div className="text-[10px] text-content-dim">No events yet.</div>
					) : (
						<ul className="space-y-1.5">
							{events.map((e) => (
								<li
									key={e.id}
									className="text-[10px] border-b border-border-dim/50 pb-1"
								>
									<div className="flex items-start gap-1.5">
										<span className="text-content-dim shrink-0 uppercase">
											{e.type.replace(/_/g, " ")}
										</span>
										{e.route ? (
											<Link
												href={e.route}
												className="text-blood-bright hover:underline truncate"
											>
												{e.title}
											</Link>
										) : (
											<span className="text-content-primary truncate">
												{e.title}
											</span>
										)}
									</div>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</div>
	);
}
