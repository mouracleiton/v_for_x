"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import {
	diffAgainstLocal,
	slimCountries,
	topWorsened,
} from "@/lib/local-snapshot";
import { describeChange } from "@/lib/snapshot-diff";

const data = backbone as WorldBackbone;

/**
 * Home strip: what got worse since last local baseline (or seeds one).
 */
export default function WorsenedStrip() {
	const [ready, setReady] = useState(false);
	const [seeded, setSeeded] = useState(false);
	const [rows, setRows] = useState<
		Array<{ iso3: string; worsening: number; sample: string }>
	>([]);

	const slim = useMemo(() => slimCountries(data.countries), []);

	useEffect(() => {
		const { diff, seeded: justSeeded } = diffAgainstLocal(slim);
		setSeeded(justSeeded);
		if (diff) {
			const top = topWorsened(diff, 5).filter((c) => c.worsening > 0);
			setRows(
				top.map((c) => ({
					iso3: c.iso3,
					worsening: c.worsening,
					sample: c.changes[0]
						? describeChange(c.changes[0])
						: "metrics shifted",
				})),
			);
		} else {
			// First visit: show top hotspots as watch list
			const hot = [...data.hotspots.all]
				.sort((a, b) => b.score - a.score)
				.slice(0, 5)
				.map((h) => ({
					iso3: h.iso3,
					worsening: h.score,
					sample: `hotspot score ${h.score}`,
				}));
			setRows(hot);
		}
		setReady(true);
	}, [slim]);

	if (!ready) return null;

	return (
		<TerminalCard title="WHAT GOT WORSE" accent="blood" className="mb-6" glow>
			<p className="text-[10px] text-content-dim mb-3">
				{seeded
					? "Baseline captured on this device. Return later for a real diff — showing current hotspots for now."
					: "Local snapshot diff (browser baseline). CI file snapshots power Digest when present."}
			</p>
			<div className="space-y-2">
				{rows.length === 0 && (
					<div className="text-xs text-terminal-green">
						No worsening deltas vs baseline.
					</div>
				)}
				{rows.map((r) => (
					<Link
						key={r.iso3}
						href={`/sorrow-map/${r.iso3.toLowerCase()}/`}
						className="flex items-center gap-2 p-2 border border-border-dim hover:border-blood transition-colors"
					>
						<StatusPill color="blood">{r.iso3}</StatusPill>
						<span className="text-[10px] text-content-secondary flex-1 truncate">
							{r.sample}
						</span>
						<span className="text-[10px] text-blood-dim font-mono">
							Δ{r.worsening.toFixed?.(1) ?? r.worsening}
						</span>
					</Link>
				))}
			</div>
		</TerminalCard>
	);
}
