/**
 * V FOR X — Station Map (cognitive-load reduction layer)
 *
 * The platform grew to 84 routes (codes 00–83) in lib/crosslinks.ts#branchLinks.
 * That is the canonical route list the nav, search, and persona systems consume.
 * This module annotates those codes with a STATION (top-level workstation) and a
 * TAB (panel within that station), so nav/search can group 84 routes under 8
 * stations + a SERVICES bucket, and so route fusions can be expressed as a
 * `fusedInto` pointer instead of a code change.
 *
 * It is pure data + pure helpers. No JSX, no I/O, no state. One source of
 * truth: `ROUTES` is derived from `branchLinks`, never duplicated.
 *
 * Consumers:
 *   - BranchNav: render stations as collapsible groups instead of a flat list.
 *   - GlobalSearch: derive its page index from `flatForSearch()` and drop its
 *     hand-maintained STATIC_PAGES array.
 *   - Mission Briefing home: read `routesInStation("briefing")`.
 *   - Fusion work (task #5): set `fusedInto` on a code; nav/search then redirect.
 */

import { branchLinks } from "./crosslinks";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

/** The 8 user-facing workstations + the SERVICES bucket (infra, not a destination). */
export type StationId =
	| "briefing"
	| "intelligence"
	| "war_room"
	| "registry"
	| "simulator"
	| "the_web"
	| "fortress"
	| "press"
	| "services";

export interface StationMeta {
	id: StationId;
	/** Short uppercase label for the nav. */
	label: string;
	/** One-line job-to-be-done. */
	tagline: string;
	emoji: string;
	/** CSS accent — reused from the cyberpunk palette. */
	accent: string;
	/** Canonical route to land on when the station itself is opened. */
	home: string;
}

/**
 * Per-route annotation. `tab` is the panel within the station the route
 * belongs to. `fusedInto` (optional) names the code this route collapses
 * into during a fusion — consumers hide/redirect fused routes.
 */
export interface RouteMeta {
	/** The branchLinks code this annotation applies to ("00".."83"). */
	code: string;
	station: StationId;
	tab: string;
	/** If set, this route is a fusion candidate → it merges into this code. */
	fusedInto?: string;
	/** Optional human note surfaced in tooltips / palette. */
	note?: string;
}

/** A fully-resolved route: branchLink fields + station annotation. */
export interface ResolvedRoute {
	code: string;
	href: string;
	label: string;
	station: StationId;
	tab: string;
	fusedInto?: string;
	note?: string;
}

/* ═══════════════════════════════════════════════════════════════
   Stations
   ═══════════════════════════════════════════════════════════════ */

export const STATIONS: StationMeta[] = [
	{
		id: "briefing",
		label: "BRIEFING",
		tagline: "What is happening right now",
		emoji: "📡",
		accent: "var(--color-blood-bright)",
		home: "/the-briefing/",
	},
	{
		id: "intelligence",
		label: "INTELLIGENCE",
		tagline: "Understand the data — 200 countries × 19 dimensions",
		emoji: "🧠",
		accent: "#00ddff",
		home: "/sorrow-map/",
	},
	{
		id: "war_room",
		label: "WAR ROOM",
		tagline: "Live conflict intelligence",
		emoji: "🎯",
		accent: "var(--color-warning-amber)",
		home: "/the-war-room/",
	},
	{
		id: "registry",
		label: "REGISTRY",
		tagline: "Accountability, evidence, verification",
		emoji: "⚖",
		accent: "var(--color-terminal-green)",
		home: "/registry/",
	},
	{
		id: "simulator",
		label: "SIMULATOR",
		tagline: "What-if modeling — scenarios, cascades, forecasts",
		emoji: "∑",
		accent: "#aa44ff",
		home: "/equation/",
	},
	{
		id: "the_web",
		label: "THE WEB",
		tagline: "Coordinate and act — P2P, missions, governance",
		emoji: "🕸",
		accent: "#10b981",
		home: "/the-web/",
	},
	{
		id: "fortress",
		label: "FORTRESS",
		tagline: "Protect, survive, resist censorship",
		emoji: "🛡",
		accent: "#f59e0b",
		home: "/fortress/",
	},
	{
		id: "press",
		label: "PRESS",
		tagline: "Communicate, syndicate, narrate",
		emoji: "📣",
		accent: "#ec4899",
		home: "/the-embed/",
	},
	{
		id: "services",
		label: "SERVICES",
		tagline: "Infrastructure (mirrors, data health, API, docs)",
		emoji: "⚙",
		accent: "var(--color-content-dim)",
		home: "/the-mirror/",
	},
];

export const STATION_BY_ID: Record<StationId, StationMeta> = Object.fromEntries(
	STATIONS.map((s) => [s.id, s]),
) as Record<StationId, StationMeta>;

/* ═══════════════════════════════════════════════════════════════
   Code → station/tab annotation map
   ═══════════════════════════════════════════════════════════════ */

/**
 * The single annotation table. Every code in branchLinks (00–83) gets one
 * entry. `fusedInto` marks the 9 high-value fusions from the consolidation
 * plan — consumers treat a fused route as a redirect to its target.
 *
 * Fusions (verified against the 95→8 mapping table):
 *   09 the-lens      → 28 the-compare      (compare & correlate)
 *   11 the-signal    → 33 the-alerts        (alerts inbox)
 *   20 the-choice    → 02 the-equation      (budget tradeoff tab)
 *   24 the-ledger    → 02 the-equation      (financing tab)
 *   35 the-vault     → 42 the-safehouse     (crypto store)
 *   47 the-cartographer → 01 sorrow-map     (custom layer = map mode)
 *   48 the-canary    → 49 the-guardian is WRONG; canary is data DMS,
 *      guardian is people DMS — both fuse into one "dead man's switch" panel.
 *      Keep the people's switch (guardian, 49) as the landing route and point
 *      canary at it.
 *   52 the-tribunal  → 70 the-verdict        (dispute adjudication)
 *   56 the-watch     → 33 the-alerts         (watchlist feeds alerts)
 *   58 the-field-manual → 03 protocol-x      (survival guides)
 *   61 the-sentinel  → 66 the-pulse          (crisis feed)
 *   73 the-domino    → 46 the-crucible       (cascading crisis sim)
 *   76 the-tipping-point → 38 the-forecast   (early warning)
 *   79 the-correlation-lab → 28 the-compare
 */
const ROUTE_META: Record<string, Omit<RouteMeta, "code">> = {
	// BRIEFING — "what is happening now"
	"00": {
		station: "briefing",
		tab: "home",
		note: "Daily landing / Mission Briefing",
	},
	"21": { station: "briefing", tab: "home", note: "Country report generator" },
	"33": { station: "briefing", tab: "alerts", note: "Live crisis feed" },
	"37": {
		station: "briefing",
		tab: "digest",
		note: "Personalized digest builder",
	},
	"54": {
		station: "briefing",
		tab: "counters",
		note: "Running memorial counter",
	},
	"66": {
		station: "briefing",
		tab: "feed",
		note: "Multi-source crisis reader (fused with the-sentinel)",
	},
	"72": {
		station: "briefing",
		tab: "counters",
		note: "Live cost of inaction meter",
	},

	// INTELLIGENCE — understand the data
	"01": { station: "intelligence", tab: "map", note: "Choropleth world map" },
	"13": {
		station: "intelligence",
		tab: "explore",
		note: "Vulnerability ranking",
	},
	"16": { station: "intelligence", tab: "data", note: "Displacement flows" },
	"18": { station: "intelligence", tab: "data", note: "Data transparency" },
	"25": { station: "intelligence", tab: "data", note: "World crisis cockpit" },
	"28": {
		station: "intelligence",
		tab: "compare",
		note: "Side-by-side country analysis",
	},
	"45": {
		station: "intelligence",
		tab: "ask",
		note: "Natural-language query engine",
	},
	"59": {
		station: "intelligence",
		tab: "data",
		note: "Civil resistance analytics",
	},
	"74": {
		station: "intelligence",
		tab: "explore",
		note: "Single-metric deep-dive",
	},
	"75": {
		station: "intelligence",
		tab: "explore",
		note: "Improvement velocity leaderboard",
	},
	"81": { station: "intelligence", tab: "explore", note: "Violence atlas" },
	"82": { station: "intelligence", tab: "explore", note: "Prison atlas" },

	// WAR ROOM — live conflict intel
	"19": { station: "war_room", tab: "fronts", note: "Regional crises" },
	"43": {
		station: "war_room",
		tab: "chain",
		note: "Arms, sanctions & aid graph",
	},
	"60": {
		station: "war_room",
		tab: "live",
		note: "Multi-source war aggregator",
	},
	"34": {
		station: "war_room",
		tab: "satellite",
		note: "Open imagery of conflict",
	},

	// REGISTRY — accountability + evidence
	"04": {
		station: "registry",
		tab: "dossiers",
		note: "Accountability dossiers",
	},
	"26": {
		station: "registry",
		tab: "dossiers",
		note: "Anonymous dossier submission",
	},
	"39": {
		station: "registry",
		tab: "tools",
		note: "Document triage (red-flag terms)",
	},
	"42": {
		station: "registry",
		tab: "evidence",
		note: "Encrypted evidence store",
	},
	"53": {
		station: "registry",
		tab: "pledges",
		note: "Politician pledge tracker",
	},
	"55": {
		station: "registry",
		tab: "verify",
		note: "Signed witness statements",
	},
	"68": {
		station: "registry",
		tab: "evidence",
		note: "OSINT image & video verification",
	},
	"69": {
		station: "registry",
		tab: "graph",
		note: "Kleptocracy ownership graph",
	},
	"70": {
		station: "registry",
		tab: "verify",
		note: "Evidence-backed accountability cases",
	},
	"71": {
		station: "registry",
		tab: "tools",
		note: "On-device document triage (ML)",
	},

	// SIMULATOR — what-if
	"02": { station: "simulator", tab: "equation", note: "Scenario + ROI model" },
	"15": {
		station: "simulator",
		tab: "cascades",
		note: "Budget allocator under scenarios",
	},
	"32": {
		station: "simulator",
		tab: "cascades",
		note: "Scenario impact model",
	},
	"38": {
		station: "simulator",
		tab: "forecast",
		note: "Transparent crisis risk model",
	},
	"44": {
		station: "simulator",
		tab: "forecast",
		note: "SDG 2030 deadline tracker",
	},
	"46": {
		station: "simulator",
		tab: "cascades",
		note: "Cascading crisis simulator",
	},

	// THE WEB — coordinate + act
	"05": { station: "the_web", tab: "comms", note: "Anonymous P2P BBS" },
	"06": { station: "the_web", tab: "ledger", note: "Resource routing" },
	"12": { station: "the_web", tab: "missions", note: "Campaign generator" },
	"17": { station: "the_web", tab: "playbooks", note: "Resistance tactics" },
	"27": {
		station: "the_web",
		tab: "organize",
		note: "Anonymous action circles",
	},
	"40": {
		station: "the_web",
		tab: "onboard",
		note: "Interactive crisis education",
	},
	"50": {
		station: "the_web",
		tab: "comms",
		note: "Offline burst message format",
	},
	"51": { station: "the_web", tab: "vote", note: "Anonymous ZK voting" },
	"57": { station: "the_web", tab: "missions", note: "Mutual-aid matching" },
	"63": { station: "the_web", tab: "onboard", note: "First-step onboarding" },
	"64": {
		station: "the_web",
		tab: "organize",
		note: "Vetted helper directory",
	},

	// FORTRESS — protect + survive
	"03": { station: "fortress", tab: "survival", note: "Survival blueprints" },
	"07": {
		station: "fortress",
		tab: "survival",
		note: "Infrastructure / anti-censorship",
	},
	"08": { station: "fortress", tab: "opsec", note: "Identity & OpSec" },
	"41": {
		station: "fortress",
		tab: "mirror",
		note: "Tor hidden service mirror guide",
	},
	"49": { station: "fortress", tab: "crypto", note: "Steganography & OTP" },

	// PRESS — communicate + syndicate
	"14": { station: "press", tab: "narrate", note: "Narrative tours" },
	"29": {
		station: "press",
		tab: "syndicate",
		note: "Knowledge & action tracker",
	},
	"31": { station: "press", tab: "build", note: "Citizen journalist toolkit" },
	"36": { station: "press", tab: "build", note: "Custom data visualizer" },
	"62": { station: "press", tab: "build", note: "Widget / iframe builder" },
	"67": { station: "press", tab: "narrate", note: "Faces — victims / heroes" },
	"22": { station: "press", tab: "narrate", note: "Scenario timeline" },

	// SERVICES — infra (not a user destination)
	"10": { station: "services", tab: "archive", note: "Sources & methods" },
	"23": { station: "services", tab: "api", note: "Public data API docs" },
	"30": { station: "services", tab: "data", note: "Data evolution tracker" },
	"65": { station: "services", tab: "mirror", note: "One-command mirror kit" },
	"77": { station: "services", tab: "docs", note: "Collaborative CRDT docs" },
	"78": {
		station: "services",
		tab: "mirror",
		note: "Verified mirror directory",
	},
	"80": { station: "services", tab: "data", note: "Data quality monitor" },
	"83": {
		station: "services",
		tab: "data",
		note: "Data corrections / patches",
	},

	// ── FUSION TARGETS (fusedInto set) ──────────────────────────
	"09": {
		station: "intelligence",
		tab: "compare",
		fusedInto: "28",
		note: "Compare & correlate → THE COMPARE",
	},
	"11": {
		station: "briefing",
		tab: "alerts",
		fusedInto: "33",
		note: "Watchlist alerts → THE ALERTS",
	},
	"20": {
		station: "simulator",
		tab: "equation",
		fusedInto: "02",
		note: "Military vs health → EQUATION tab",
	},
	"24": {
		station: "simulator",
		tab: "equation",
		fusedInto: "02",
		note: "Financing & blockers → EQUATION tab",
	},
	"35": {
		station: "registry",
		tab: "evidence",
		fusedInto: "42",
		note: "Datasets catalog → SAFEHOUSE store",
	},
	"47": {
		station: "intelligence",
		tab: "map",
		fusedInto: "01",
		note: "Custom choropleth → MAP mode",
	},
	"48": {
		station: "fortress",
		tab: "crypto",
		fusedInto: "49",
		note: "Data DMS → people DMS (one switch UI)",
	},
	"52": {
		station: "registry",
		tab: "verify",
		fusedInto: "70",
		note: "Tribunal → VERDICT (dispute adjudication)",
	},
	"56": {
		station: "briefing",
		tab: "alerts",
		fusedInto: "33",
		note: "Threshold rules → THE ALERTS",
	},
	"58": {
		station: "fortress",
		tab: "survival",
		fusedInto: "03",
		note: "Printable guides → PROTOCOL X",
	},
	"61": {
		station: "briefing",
		tab: "feed",
		fusedInto: "66",
		note: "Repression/protest map → THE PULSE",
	},
	"73": {
		station: "simulator",
		tab: "cascades",
		fusedInto: "46",
		note: "Cascading sim → THE CRUCIBLE",
	},
	"76": {
		station: "simulator",
		tab: "forecast",
		fusedInto: "38",
		note: "Early warning → THE FORECAST",
	},
	"79": {
		station: "intelligence",
		tab: "compare",
		fusedInto: "28",
		note: "Correlation lab → THE COMPARE",
	},
};

/* ═══════════════════════════════════════════════════════════════
   Resolved routes + helpers
   ═══════════════════════════════════════════════════════════════ */

/** Resolve a single branchLink code to its full annotation. Unknown → SERVICES/misc. */
function resolve(code: string): ResolvedRoute {
	const base = branchLinks.find((b) => b.code === code);
	const meta = ROUTE_META[code] ?? {
		station: "services" as StationId,
		tab: "misc",
	};
	if (!base) {
		// Defensive: a code in ROUTE_META but not in branchLinks should never happen,
		// but never throw from a nav helper — fall back to a synthetic entry.
		return {
			code,
			href: "/",
			label: `CODE ${code}`,
			station: meta.station,
			tab: meta.tab,
			fusedInto: meta.fusedInto,
			note: meta.note,
		};
	}
	return {
		code: base.code,
		href: base.href,
		label: base.label,
		station: meta.station,
		tab: meta.tab,
		fusedInto: meta.fusedInto,
		note: meta.note,
	};
}

/** All routes, resolved, in branchLinks order. */
export const ROUTES: ResolvedRoute[] = branchLinks.map((b) => resolve(b.code));

/** All non-fused routes (fusions collapse the fused ones out). */
export const ROUTES_ACTIVE: ResolvedRoute[] = ROUTES.filter(
	(r) => !r.fusedInto,
);

/** Look up the resolved route by code. */
export function routeByCode(code: string): ResolvedRoute | undefined {
	return ROUTES.find((r) => r.code === code);
}

/** Resolve an href (e.g. "/the-alerts/") to its route annotation. Trailing-slash tolerant. */
export function routeByHref(href: string): ResolvedRoute | undefined {
	const norm = href.replace(/\/+$/, "") + "/";
	return ROUTES.find((r) => r.href.replace(/\/+$/, "") + "/" === norm);
}

/** Which station does a code/href belong to? */
export function stationOf(id: string): StationMeta {
	const byCode = ROUTE_META[id]?.station;
	if (byCode) return STATION_BY_ID[byCode];
	const byHref = routeByHref(id)?.station;
	return byHref ? STATION_BY_ID[byHref] : STATION_BY_ID.services;
}

/**
 * If a route is a fusion source, return the target route it collapses into.
 * Used by nav/search to redirect or hide. Returns undefined for standalone routes.
 */
export function fusionTarget(code: string): ResolvedRoute | undefined {
	const meta = ROUTE_META[code];
	if (!meta?.fusedInto) return undefined;
	return routeByCode(meta.fusedInto);
}

/** All routes in a station (non-fused by default; pass false to include fused sources). */
export function routesInStation(
	id: StationId,
	activeOnly = true,
): ResolvedRoute[] {
	const pool = activeOnly ? ROUTES_ACTIVE : ROUTES;
	return pool.filter((r) => r.station === id);
}

/** Routes in a station grouped by tab. Stable order: branchLinks order within each tab. */
export function tabsInStation(
	id: StationId,
): { tab: string; routes: ResolvedRoute[] }[] {
	const routes = routesInStation(id);
	const order: string[] = [];
	const byTab: Record<string, ResolvedRoute[]> = {};
	for (const r of routes) {
		if (!byTab[r.tab]) {
			byTab[r.tab] = [];
			order.push(r.tab);
		}
		byTab[r.tab].push(r);
	}
	return order.map((tab) => ({ tab, routes: byTab[tab]! }));
}

/**
 * Nav tree: one entry per station, each with its tab groups.
 * Fused routes are collapsed out by default (they live as `fusedInto` on the
 * source, not as standalone nav rows).
 */
export interface StationNavNode {
	station: StationMeta;
	tabs: { tab: string; routes: ResolvedRoute[] }[];
}

export function navTree(activeOnly = true): StationNavNode[] {
	return STATIONS.map((station) => ({
		station,
		tabs: tabsInStation(station.id)
			.map((t) => ({
				tab: t.tab,
				routes: activeOnly ? t.routes.filter((r) => !r.fusedInto) : t.routes,
			}))
			.filter((t) => t.routes.length > 0),
	})).filter((n) => n.tabs.length > 0);
}

/**
 * Flat list for the search palette. Replaces GlobalSearch's hand-maintained
 * STATIC_PAGES. Each entry carries its station so the palette can group by
 * station instead of by ad-hoc type.
 */
export interface SearchRouteEntry {
	code: string;
	href: string;
	label: string;
	desc: string;
	station: StationMeta;
}

export function flatForSearch(activeOnly = true): SearchRouteEntry[] {
	const pool = activeOnly ? ROUTES_ACTIVE : ROUTES;
	return pool.map((r) => ({
		code: r.code,
		href: r.href,
		label: r.label,
		desc: r.note ?? "",
		station: STATION_BY_ID[r.station],
	}));
}
