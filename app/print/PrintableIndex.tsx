"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, CountryData } from "@/lib/types";
import {
	calculateVulnerability,
	scoreColor,
	scoreLabel,
} from "@/lib/vulnerability";
import ShareSheet from "@/components/shared/ShareSheet";

const data = backbone as WorldBackbone;

interface Row {
	iso3: string;
	name: string;
	region: string;
	subregion: string;
	isHotspot: boolean;
	vuln: number;
	popM: number;
}

const ROWS: Row[] = data.countries.map((c: CountryData) => ({
	iso3: c.iso3,
	name: c.name_en,
	region: c.region,
	subregion: c.subregion,
	isHotspot: c.is_hotspot,
	vuln: calculateVulnerability(c).composite,
	popM: c.demographics.population / 1e6,
}));

const REGIONS = [...new Set(ROWS.map((r) => r.region))].sort();

export default function PrintableIndex() {
	const [query, setQuery] = useState("");
	const [region, setRegion] = useState<string>("all");
	const [onlyHotspots, setOnlyHotspots] = useState(false);
	const [printMode, setPrintMode] = useState(false);

	const filtered = useMemo(() => {
		const q = query.toLowerCase().trim();
		let list = ROWS;
		if (region !== "all") list = list.filter((r) => r.region === region);
		if (onlyHotspots) list = list.filter((r) => r.isHotspot);
		if (q) {
			list = list.filter(
				(r) =>
					r.name.toLowerCase().includes(q) ||
					r.iso3.toLowerCase().includes(q) ||
					r.subregion.toLowerCase().includes(q),
			);
		}
		return [...list].sort((a, b) => a.name.localeCompare(b.name));
	}, [query, region, onlyHotspots]);

	const byRegion = useMemo(() => {
		const groups = new Map<string, Row[]>();
		for (const r of filtered) {
			const list = groups.get(r.region) ?? [];
			list.push(r);
			groups.set(r.region, list);
		}
		return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
	}, [filtered]);

	return (
		<main className="min-h-dvh max-w-6xl mx-auto px-3 sm:px-5 py-8">
			<div className="no-print mb-4">
				<ShareSheet
					mode="inline"
					label="print-index"
					description="Printable country index pack"
				/>
			</div>
			{/* ── Toolbar ── */}
			<div className="no-print mb-6">
				<p className="text-xs uppercase tracking-widest text-terminal-green mb-1">
					&gt; MODULE: PRINT-READY INTELLIGENCE
				</p>
				<h1 className="text-2xl sm:text-3xl font-bold text-blood-bright mb-2">
					Printable Country Briefs
				</h1>
				<p className="text-sm text-content-secondary max-w-3xl">
					Data-dense, print-ready intelligence briefs for all{" "}
					{data.countries.length} countries. Each brief carries key metrics,
					crisis indicators, a vulnerability breakdown, campaign needs, and
					dossier references — designed to be printed or saved as PDF/HTML for
					offline field use.
				</p>
			</div>

			<TerminalCard
				title="BRIEF INDEX"
				accent="green"
				className="mb-6 no-print"
			>
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center mb-5">
					<div>
						<div className="text-3xl font-bold text-terminal-green">
							{data.countries.length}
						</div>
						<div className="text-xs text-content-dim mt-1">COUNTRIES</div>
					</div>
					<div>
						<div className="text-3xl font-bold text-blood-bright">
							{ROWS.filter((r) => r.isHotspot).length}
						</div>
						<div className="text-xs text-content-dim mt-1">HOTSPOTS</div>
					</div>
					<div>
						<div className="text-3xl font-bold text-content-primary">
							{REGIONS.length}
						</div>
						<div className="text-xs text-content-dim mt-1">REGIONS</div>
					</div>
					<div>
						<div className="text-3xl font-bold text-warning-amber">
							{ROWS.filter((r) => r.vuln >= 60).length}
						</div>
						<div className="text-xs text-content-dim mt-1">CRITICAL (≥60)</div>
					</div>
				</div>

				<div className="flex flex-col sm:flex-row gap-3 mb-4">
					<input
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search 200 countries…"
						className="flex-1 bg-void border border-border-dim text-content-primary text-sm px-3 py-2 focus:border-blood focus:outline-none"
					/>
					<select
						value={region}
						onChange={(e) => setRegion(e.target.value)}
						className="bg-void border border-border-dim text-content-secondary text-sm px-3 py-2 focus:border-blood focus:outline-none"
					>
						<option value="all">ALL REGIONS</option>
						{REGIONS.map((r) => (
							<option key={r} value={r}>
								{r.toUpperCase()}
							</option>
						))}
					</select>
					<label className="flex items-center gap-2 text-xs text-content-secondary select-none">
						<input
							type="checkbox"
							checked={onlyHotspots}
							onChange={(e) => setOnlyHotspots(e.target.checked)}
							className="accent-blood"
						/>
						HOTSPOTS ONLY
					</label>
				</div>

				<div className="flex flex-wrap items-center gap-3">
					<span className="text-xs text-content-dim">
						{filtered.length} matched · {byRegion.length} regions
					</span>
					<span className="flex-1" />
					<button
						onClick={() => {
							sound.select();
							setPrintMode(true);
						}}
						className="px-4 py-2 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void font-bold transition-colors"
					>
						[ 🖨 PRINT INDEX ]
					</button>
					<button
						onClick={() => {
							sound.success();
							window.print();
						}}
						className="px-4 py-2 text-xs border border-blood text-blood-bright hover:bg-blood hover:text-void font-bold transition-colors"
					>
						🖨 PRINT / EXPORT PDF
					</button>
				</div>
			</TerminalCard>

			{/* ── Country list grouped by region ── */}
			<div className="space-y-8">
				{byRegion.map(([regionName, rows]) => (
					<section key={regionName}>
						<h2 className="text-xs uppercase tracking-widest text-content-secondary border-b border-border-dim pb-2 mb-3">
							▸ {regionName} ·{" "}
							<span className="text-content-dim">{rows.length}</span>
						</h2>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
							{rows.map((r) => (
								<Link
									key={r.iso3}
									href={`/print/${r.iso3.toLowerCase()}/`}
									onClick={() => sound.nav()}
									className="terminal-card p-3 flex items-center gap-3 hover:border-command-dim transition-colors no-print"
								>
									<span className="text-[10px] font-bold text-content-dim w-8 flex-shrink-0">
										{r.iso3}
									</span>
									<span className="flex-1 min-w-0">
										<span className="block text-sm text-content-primary truncate">
											{r.name}
										</span>
										<span className="block text-[10px] text-content-dim">
											{r.popM.toFixed(0)}M · {r.subregion}
										</span>
									</span>
									{r.isHotspot && (
										<span className="text-[9px] px-1.5 py-0.5 text-blood-bright border border-blood/50 uppercase">
											HOT
										</span>
									)}
									<span
										className="text-sm font-bold flex-shrink-0"
										style={{ color: scoreColor(r.vuln) }}
										title={scoreLabel(r.vuln)}
									>
										{r.vuln.toFixed(0)}
									</span>
								</Link>
							))}
						</div>
					</section>
				))}
				{filtered.length === 0 && (
					<div className="text-center text-content-dim text-sm py-10">
						No countries match the current filters.
					</div>
				)}
			</div>

			{/* ── Print-only index (compact table) ── */}
			{printMode && (
				<style>{`
          @media print {
            body { background: white !important; }
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            .terminal-card { border: 1px solid #999 !important; background: white !important; color: black !important; }
            .terminal-card * { color: black !important; }
          }
          .print-only { display: none; }
        `}</style>
			)}
			<div className="print-only">
				<div className="text-center mb-4">
					<div className="text-[10px] uppercase tracking-widest text-gray-500">
						V FOR X // BRIEF INDEX
					</div>
					<h2 className="text-2xl font-bold">Printable Country Briefs</h2>
					<div className="text-xs text-gray-600 mt-1">
						{filtered.length} countries · generated{" "}
						{new Date().toLocaleDateString("en-US", {
							year: "numeric",
							month: "long",
							day: "numeric",
						})}
					</div>
				</div>
				<table className="w-full text-[10px] border-collapse">
					<thead>
						<tr className="border-b border-gray-400 text-left">
							<th className="py-1 pr-2">ISO3</th>
							<th className="py-1 pr-2">Country</th>
							<th className="py-1 pr-2">Region</th>
							<th className="py-1 pr-2 text-right">Pop (M)</th>
							<th className="py-1 pr-2 text-right">Vuln</th>
							<th className="py-1">URL</th>
						</tr>
					</thead>
					<tbody>
						{filtered.map((r) => (
							<tr key={r.iso3} className="border-b border-gray-200">
								<td className="py-0.5 pr-2 font-bold">{r.iso3}</td>
								<td className="py-0.5 pr-2">{r.name}</td>
								<td className="py-0.5 pr-2">{r.region}</td>
								<td className="py-0.5 pr-2 text-right">{r.popM.toFixed(0)}</td>
								<td className="py-0.5 pr-2 text-right">{r.vuln.toFixed(0)}</td>
								<td className="py-0.5">/print/{r.iso3.toLowerCase()}/</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</main>
	);
}
