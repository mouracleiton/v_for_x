"use client";

/**
 * V FOR X — Mission Briefing strip
 *
 * The cognitive-load reducer: instead of 84 routes, the user sees ONE row of
 * "what matters to ME right now" — their watchlist countries, active alert
 * rules, in-progress guided missions, and current country context — each
 * deep-linking into the relevant station via lib/station-map.
 *
 * Mounted at the top of the home page (`/`). Self-hides on first visit (no
 * watchlist, no alerts, no missions, no persona) so the existing Daily
 * Briefing experience is preserved for new users. Zero network access, pure
 * client-side, reads IndexedDB + localStorage + the Zustand store.
 *
 * Design note: this is a *navigator*, not a dashboard. It deliberately has no
 * charts or heavy viz — its only job is to route the user to the right station
 * with the right context in one click. The actual data lives in each station.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/stores/useStore";
import {
	watchlistGetAll,
	alertRulesGetAll,
	type WatchlistEntry,
	type AlertRule,
} from "@/lib/idb";
import {
	getMissionsForPersona,
	getInProgressMissions,
	getTotalCompletion,
	type Mission,
} from "@/lib/missions";
import { stationOf, STATION_BY_ID, type StationMeta } from "@/lib/station-map";
import { sound } from "@/lib/sound";

/* ═══════════════════════════════════════════════════════════════
   Loaders
   ═══════════════════════════════════════════════════════════════ */

interface BriefingData {
	watchlist: WatchlistEntry[];
	alertRules: AlertRule[];
	inProgress: Mission[];
	totalCompletion: number; // 0..1
	personaMissionsCount: number;
}

const EMPTY: BriefingData = {
	watchlist: [],
	alertRules: [],
	inProgress: [],
	totalCompletion: 0,
	personaMissionsCount: 0,
};

async function loadBriefing(personaId: string | null): Promise<BriefingData> {
	const [watchlist, alertRules] = await Promise.all([
		watchlistGetAll(),
		alertRulesGetAll(),
	]);
	const inProgress = getInProgressMissions();
	const totalCompletion = getTotalCompletion();
	const personaMissions = personaId ? getMissionsForPersona(personaId) : [];
	return {
		watchlist,
		alertRules,
		inProgress,
		totalCompletion,
		personaMissionsCount: personaMissions.length,
	};
}

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */

export default function MissionBriefing() {
	const { persona, currentCountry } = useStore();
	const [data, setData] = useState<BriefingData>(EMPTY);
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		let cancelled = false;
		loadBriefing(persona).then((d) => {
			if (!cancelled) {
				setData(d);
				setLoaded(true);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [persona]);

	// Self-hide on first visit: nothing personal yet → let Daily Briefing own the page.
	const hasPersonalData =
		data.watchlist.length > 0 ||
		data.alertRules.length > 0 ||
		data.inProgress.length > 0 ||
		!!currentCountry;
	if (loaded && !hasPersonalData) return null;
	// While loading, render nothing (avoids a flash of the empty-state shell).
	if (!loaded) return null;

	return (
		<section
			className="border-b border-blood-dim bg-panel/60 mb-6"
			aria-label="Mission Briefing"
		>
			<div className="px-4 py-3 flex items-center gap-2 border-b border-border-dim">
				<span className="text-blood-bright text-xs">{"//"}</span>
				<span className="text-[10px] uppercase tracking-widest text-content-dim">
					Mission Briefing
				</span>
				<span className="ml-auto text-[9px] text-content-dim">
					{persona ? `${persona} session` : "no persona set"} · personalized
				</span>
			</div>

			<div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border-dim">
				<BriefingTile
					station={STATION_BY_ID.briefing}
					href="/the-alerts/"
					blink={data.alertRules.length > 0}
					headline={String(data.alertRules.length)}
					sub={`${data.alertRules.length === 1 ? "rule" : "rules"} watching`}
					hint="open alerts"
				/>
				<BriefingTile
					station={STATION_BY_ID.intelligence}
					href="/sorrow-map/"
					headline={String(data.watchlist.length)}
					sub={`${data.watchlist.length === 1 ? "country" : "countries"} watched`}
					hint="open map"
					chips={data.watchlist
						.slice(0, 3)
						.map((w) => `/sorrow-map/${w.iso3.toLowerCase()}/`)}
					chipLabels={data.watchlist.slice(0, 3).map((w) => w.iso3)}
				/>
				<BriefingTile
					station={STATION_BY_ID.the_web}
					href="/the-missions/"
					headline={String(data.inProgress.length)}
					sub={`${data.inProgress.length === 1 ? "mission" : "missions"} in progress`}
					hint="resume"
				/>
				<BriefingTile
					station={STATION_BY_ID.intelligence}
					href={
						currentCountry
							? `/sorrow-map/${currentCountry.toLowerCase()}/`
							: "/sorrow-map/"
					}
					headline={currentCountry ?? "—"}
					sub="current focus"
					hint="dossier"
				/>
			</div>

			{/* One-line station quicknav — the 8 workstations, in station-map order. */}
			<div className="flex flex-wrap gap-1 px-4 py-2 border-t border-border-dim">
				{Object.values(STATION_BY_ID)
					.filter((s) => s.id !== "services")
					.map((s) => (
						<Link
							key={s.id}
							href={s.home}
							onClick={() => sound.nav()}
							className="text-[9px] px-2 py-1 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors flex items-center gap-1"
							title={s.tagline}
						>
							<span>{s.emoji}</span>
							<span>{s.label}</span>
						</Link>
					))}
			</div>
		</section>
	);
}

/* ═══════════════════════════════════════════════════════════════
   Tile
   ═══════════════════════════════════════════════════════════════ */

function BriefingTile({
	station,
	href,
	headline,
	sub,
	hint,
	blink,
	chips,
	chipLabels,
}: {
	station: StationMeta;
	href: string;
	headline: string;
	sub: string;
	hint: string;
	blink?: boolean;
	chips?: string[];
	chipLabels?: string[];
}) {
	return (
		<div className="bg-abyss p-3 flex flex-col gap-1">
			<Link
				href={href}
				onClick={() => sound.nav()}
				className="flex items-baseline gap-2 group"
			>
				<span
					className={`text-2xl font-bold ${blink ? "text-blood-bright animate-pulse" : "text-content-primary"}`}
					style={{ color: !blink ? station.accent : undefined }}
				>
					{headline}
				</span>
				<span className="text-[10px] text-content-dim">{sub}</span>
			</Link>
			<div className="flex items-center gap-2">
				<span className="text-[10px]" style={{ color: station.accent }}>
					{station.emoji}
				</span>
				<span className="text-[9px] uppercase tracking-widest text-content-dim">
					{station.label} · {hint}
				</span>
			</div>
			{chips && chips.length > 0 && (
				<div className="flex flex-wrap gap-1 mt-0.5">
					{chips.map((c, i) => (
						<Link
							key={c}
							href={c}
							onClick={() => sound.nav()}
							className="text-[9px] px-1.5 py-0.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors font-mono"
						>
							{chipLabels?.[i] ?? c}
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
