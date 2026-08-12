import type { CountryData } from "./types";

/**
 * V FOR X — Cross-branch link generator
 * Generates contextual links between branches based on data context.
 */

export interface CrossLink {
	href: string;
	label: string;
	description: string;
}

export function countryToEquation(iso3: string): CrossLink {
	return {
		href: `/equation/?country=${iso3}`,
		label: "MODEL THE SOLUTION",
		description: "See the cost to fix this country's hunger crisis",
	};
}

export function countryToProtocol(
	iso3: string,
	crisisProfile: {
		isHotspot: boolean;
		conflictIntensity: number;
		famineRisk: number;
		connectivity: number;
	},
): CrossLink {
	return {
		href: `/protocol-x/?country=${iso3}`,
		label: "RELEVANT BLUEPRINTS",
		description:
			crisisProfile.conflictIntensity >= 3
				? "Survival and resistance tactics for active conflict zones"
				: crisisProfile.famineRisk >= 3
					? "Food security and emergency agriculture blueprints"
					: "Resilience and preparedness guides for this region",
	};
}

/* ═══ BLUEPRINT MATCHING ═══
 * Maps a country's data profile to relevant Protocol-X blueprints.
 * Each rule checks one or more conditions on the country record.
 */

export interface BlueprintMatch {
	blueprintId: string;
	reason: string;
	priority: "critical" | "recommended" | "resilience";
}

interface BlueprintRule {
	id: string;
	match: (c: CountryData) => boolean;
	reason: (c: CountryData) => string;
	priority: "critical" | "recommended" | "resilience";
}

const BLUEPRINT_RULES: BlueprintRule[] = [
	// Water
	{
		id: "water-solar-purification",
		match: (c) =>
			(c.water_sanitation.basic_access_pct ?? 100) < 80 ||
			(c.water_sanitation.safe_sanitation_pct ?? 100) < 50,
		reason: (c) =>
			`Water access at ${c.water_sanitation.basic_access_pct ?? "?"}%. Solar purification needs no chemicals or electricity.`,
		priority: "critical",
	},
	{
		id: "water-boiling",
		match: (c) => (c.water_sanitation.basic_access_pct ?? 100) < 90,
		reason: (c) =>
			`Basic water access: ${c.water_sanitation.basic_access_pct ?? "?"}%. Boiling is the universal fallback.`,
		priority: "recommended",
	},
	// Food
	{
		id: "food-drying",
		match: (c) =>
			(c.hunger.undernourishment_pct ?? 0) > 15 ||
			(c.hunger.food_insecurity_mod_severe_pct ?? 0) > 30,
		reason: (c) =>
			`Undernourishment ${c.hunger.undernourishment_pct ?? "?"}%. Food preservation extends scarce supplies.`,
		priority: "critical",
	},
	{
		id: "food-emergency-garden",
		match: (c) =>
			(c.hunger.undernourishment_pct ?? 0) > 20 ||
			(c.hunger.famine_risk_1to5 ?? 0) >= 3,
		reason: (c) =>
			`Famine risk ${c.hunger.famine_risk_1to5 ?? "?"}/5. Self-sufficient food production reduces dependency.`,
		priority: "critical",
	},
	// Power
	{
		id: "power-micro-solar",
		match: (c) =>
			(c.energy?.no_access_electricity_m ?? 0) > 0 ||
			(c.connectivity.internet_users_pct ?? 100) < 40,
		reason: (c) =>
			c.energy?.no_access_electricity_m
				? `${c.energy.no_access_electricity_m}M without electricity. Micro-solar is decentralized power.`
				: `Internet access at ${c.connectivity.internet_users_pct ?? "?"}%. Solar power enables connectivity.`,
		priority: "recommended",
	},
	{
		id: "power-bicycle-generator",
		match: (c) => (c.energy?.no_access_electricity_m ?? 0) > 1,
		reason: (c) =>
			`${c.energy?.no_access_electricity_m}M without grid power. Human-powered generation works anywhere.`,
		priority: "resilience",
	},
	// Comms
	{
		id: "comms-mesh-network",
		match: (c) =>
			(c.connectivity.internet_users_pct ?? 100) < 50 ||
			c.conflict.intensity_1to5 >= 3,
		reason: (c) =>
			c.conflict.intensity_1to5 >= 3
				? `Conflict L${c.conflict.intensity_1to5}/5. Mesh networks survive infrastructure attacks.`
				: `Internet at ${c.connectivity.internet_users_pct ?? "?"}%. Mesh networking bypasses central control.`,
		priority: "critical",
	},
	{
		id: "comms-dead-drop",
		match: (c) => c.conflict.intensity_1to5 >= 4,
		reason: () =>
			`Severe conflict. Dead drops enable communication when all networks are monitored or destroyed.`,
		priority: "critical",
	},
	// Medical
	{
		id: "medical-field-first-aid",
		match: (c) =>
			(c.health.doctors_per_1000 ?? 5) < 1.0 ||
			(c.health.child_mortality_under5_per1k ?? 0) > 40,
		reason: (c) =>
			`Doctors: ${c.health.doctors_per_1000 ?? "?"}/1000. Field first-aid saves lives when no doctor exists.`,
		priority: "critical",
	},
	// Security
	{
		id: "security-digital-opsec",
		match: (c) =>
			(c.governance.electoral_democracy_index ?? 1) < 0.4 ||
			(c.governance.corruption_perceptions_index ?? 100) < 35,
		reason: (c) =>
			`Democracy index: ${c.governance.electoral_democracy_index ?? "?"}. OpSec is survival under authoritarian regimes.`,
		priority: "recommended",
	},
	// Organizing
	{
		id: "organizing-mutual-aid",
		match: (c) =>
			(c.hunger.undernourishment_pct ?? 0) > 15 ||
			(c.poverty.headcount_365_pct ?? 0) > 20,
		reason: (c) =>
			`Extreme poverty: ${c.poverty.headcount_365_pct ?? "?"}%. Mutual aid networks are community survival infrastructure.`,
		priority: "recommended",
	},
	{
		id: "organizing-nonviolent-resistance",
		match: (c) =>
			c.conflict.intensity_1to5 >= 3 ||
			(c.governance.electoral_democracy_index ?? 1) < 0.3,
		reason: (c) =>
			`Conflict L${c.conflict.intensity_1to5}/5. Nonviolent resistance succeeds 53% of the time vs 26% for armed.`,
		priority: "critical",
	},
];

/** Returns matching blueprints for a country, sorted by priority. */
export function countryToBlueprints(country: CountryData): BlueprintMatch[] {
	const matches = BLUEPRINT_RULES.filter((r) => r.match(country)).map((r) => ({
		blueprintId: r.id,
		reason: r.reason(country),
		priority: r.priority,
	}));
	const order = { critical: 0, recommended: 1, resilience: 2 };
	return matches.sort((a, b) => order[a.priority] - order[b.priority]);
}

/** Returns a single link object for protocol-x with contextual description. */
export function countryToBlueprintLink(country: CountryData): CrossLink {
	const matches = countryToBlueprints(country);
	const critical = matches.filter((m) => m.priority === "critical").length;
	return {
		href: `/protocol-x/?country=${country.iso3}`,
		label: `${matches.length} RELEVANT BLUEPRINTS`,
		description:
			critical > 0
				? `${critical} critical-priority survival protocols for this country's conditions`
				: matches.length > 0
					? `${matches.length} resilience guides matched to this country's profile`
					: "Browse all survival and resilience blueprints",
	};
}

export function countryToRegistry(iso3: string): CrossLink {
	return {
		href: `/registry/?country=${iso3}`,
		label: "SEE RESPONSIBLE ACTORS",
		description: "Dossiers on governance and corruption in this country",
	};
}

export function countryToTrilha(iso3: string): CrossLink {
	return {
		href: `/the-trail/?need=${iso3}`,
		label: "ROUTE RESOURCES HERE",
		description: "Connect this region to aid and logistics networks",
	};
}

/** Core product loop — used by NextInLoop strip on module pages. */
const CORE_LOOP: readonly CrossLink[] = [
	{ href: "/", label: "HOME", description: "Start / verify pack" },
	{
		href: "/the-briefing/",
		label: "BRIEFING",
		description: "Situation room numbers",
	},
	{ href: "/sorrow-map/", label: "MAP", description: "Country depth" },
	{ href: "/registry/", label: "REGISTRY", description: "Dossiers & errata" },
	{ href: "/the-trail/", label: "TRAIL", description: "Mutual aid routes" },
	{ href: "/the-web/", label: "WEB", description: "Mesh room" },
	{ href: "/the-docs/", label: "DOCS", description: "Co-authored notes" },
	{
		href: "/the-bridge/",
		label: "BRIDGE",
		description: "Import / export packs",
	},
	{
		href: "/the-missions/",
		label: "MISSIONS",
		description: "Guided next actions",
	},
] as const;

export function nextInLoop(pathname: string | null | undefined): {
	current: CrossLink;
	next: CrossLink;
	related: CrossLink[];
} {
	const path = (pathname || "/").replace(/\/+$/, "") || "/";
	let idx = CORE_LOOP.findIndex((l) => {
		const h = l.href.replace(/\/+$/, "") || "/";
		if (h === "/") return path === "/" || path === "";
		return path === h || path.startsWith(h + "/") || path.startsWith(h);
	});
	if (idx < 0) idx = 0;
	const current = CORE_LOOP[idx]!;
	const next = CORE_LOOP[(idx + 1) % CORE_LOOP.length]!;
	const related = [
		CORE_LOOP[(idx + 1) % CORE_LOOP.length]!,
		CORE_LOOP[(idx + 2) % CORE_LOOP.length]!,
		CORE_LOOP[(idx + CORE_LOOP.length - 1) % CORE_LOOP.length]!,
	];
	return { current, next, related };
}

export function equationToTrilha(): CrossLink {
	return {
		href: "/the-trail/",
		label: "FUND THE SOLUTION",
		description: "Route resources based on the financing allocation",
	};
}

export function equationToProtocol(): CrossLink {
	return {
		href: "/protocol-x/",
		label: "IMPLEMENTATION GUIDES",
		description: "How to advocate for and execute each financing mechanism",
	};
}

export function equationToRegistry(): CrossLink {
	return {
		href: "/registry/",
		label: "DOCUMENT FOR TRIBUNAL",
		description: "War crimes documentation → ICJ accountability flow",
	};
}

export const branchLinks = [
	{ href: "/", label: "BRIEFING", code: "00" },
	{ href: "/sorrow-map/", label: "SORROW MAP", code: "01" },
	{ href: "/equation/", label: "THE EQUATION", code: "02" },
	{ href: "/protocol-x/", label: "PROTOCOL X", code: "03" },
	{ href: "/registry/", label: "REGISTRY", code: "04" },
	{ href: "/the-web/", label: "THE WEB", code: "05" },
	{ href: "/the-trail/", label: "THE TRAIL", code: "06" },
	{ href: "/fortress/", label: "FORTRESS", code: "07" },
	{ href: "/the-mask/", label: "MASK", code: "08" },
	{ href: "/the-lens/", label: "THE LENS", code: "09" },
	{ href: "/the-archive/", label: "ARCHIVE", code: "10" },
	{ href: "/the-signal/", label: "SIGNAL", code: "11" },
	{ href: "/the-act/", label: "THE ACT", code: "12" },
	{ href: "/the-index/", label: "THE INDEX", code: "13" },
	{ href: "/the-stories/", label: "STORIES", code: "14" },
	{ href: "/the-allocator/", label: "ALLOCATOR", code: "15" },
	{ href: "/the-exodus/", label: "EXODUS", code: "16" },
	{ href: "/the-tactics/", label: "TACTICS", code: "17" },
	{ href: "/the-matrix/", label: "MATRIX", code: "18" },
	{ href: "/the-fronts/", label: "FRONTS", code: "19" },
	{ href: "/the-choice/", label: "CHOICE", code: "20" },
	{ href: "/the-briefing/", label: "BRIEFING", code: "21" },
	{ href: "/the-timeline/", label: "TIMELINE", code: "22" },
	{ href: "/the-api/", label: "API", code: "23" },
	{ href: "/the-ledger/", label: "LEDGER", code: "24" },
	{ href: "/the-dashboard/", label: "DASHBOARD", code: "25" },
	{ href: "/the-submit/", label: "SUBMIT", code: "26" },
	{ href: "/the-network/", label: "NETWORK", code: "27" },
	{ href: "/the-compare/", label: "COMPARE", code: "28" },
	{ href: "/the-badges/", label: "BADGES", code: "29" },
	{ href: "/the-changelog/", label: "CHANGELOG", code: "30" },
	{ href: "/the-press-kit/", label: "PRESS KIT", code: "31" },
	{ href: "/the-simulator/", label: "SIMULATOR", code: "32" },
	{ href: "/the-alerts/", label: "ALERTS", code: "33" },
	{ href: "/the-satellite/", label: "SATELLITE", code: "34" },
	{ href: "/the-vault/", label: "VAULT", code: "35" },
	{ href: "/the-chart-builder/", label: "CHARTS", code: "36" },
	{ href: "/the-digest/", label: "DIGEST", code: "37" },
	{ href: "/the-forecast/", label: "FORECAST", code: "38" },
	{ href: "/the-analyzer/", label: "ANALYZER", code: "39" },
	{ href: "/the-academy/", label: "ACADEMY", code: "40" },
	{ href: "/the-onion/", label: "ONION", code: "41" },
	{ href: "/the-safehouse/", label: "SAFEHOUSE", code: "42" },
	{ href: "/the-chain/", label: "CHAIN", code: "43" },
	{ href: "/the-countdown/", label: "COUNTDOWN", code: "44" },
	{ href: "/the-oracle/", label: "ORACLE", code: "45" },
	{ href: "/the-crucible/", label: "CRUCIBLE", code: "46" },
	{ href: "/the-cartographer/", label: "CARTOGRAPHER", code: "47" },
	{ href: "/the-canary/", label: "CANARY", code: "48" },
	{ href: "/the-cipher/", label: "CIPHER", code: "49" },
	{ href: "/the-relay/", label: "RELAY", code: "50" },
	{ href: "/the-quorum/", label: "QUORUM", code: "51" },
	{ href: "/the-tribunal/", label: "TRIBUNAL", code: "52" },
	{ href: "/the-promises/", label: "PROMISES", code: "53" },
	{ href: "/the-lives/", label: "LIVES", code: "54" },
	{ href: "/the-testimony/", label: "TESTIMONY", code: "55" },
	{ href: "/the-watch/", label: "WATCH", code: "56" },
	{ href: "/the-exchange/", label: "EXCHANGE", code: "57" },
	{ href: "/the-field-manual/", label: "FIELD MANUAL", code: "58" },
	{ href: "/the-resistance/", label: "RESISTANCE", code: "59" },
	{ href: "/the-war-room/", label: "WAR ROOM", code: "60" },
	{ href: "/the-sentinel/", label: "SENTINEL", code: "61" },
	{ href: "/the-embed/", label: "EMBED", code: "62" },
	{ href: "/the-stepping-stone/", label: "STEPPING STONE", code: "63" },
	{ href: "/the-roster/", label: "ROSTER", code: "64" },
	{ href: "/the-mirror/", label: "MIRROR", code: "65" },
	{ href: "/the-pulse/", label: "PULSE", code: "66" },
	{ href: "/the-faces/", label: "FACES", code: "67" },
	{ href: "/the-forensics/", label: "FORENSICS", code: "68" },
	{ href: "/the-nexus/", label: "NEXUS", code: "69" },
	{ href: "/the-verdict/", label: "VERDICT", code: "70" },
	{ href: "/the-classifier/", label: "CLASSIFIER", code: "71" },
	{ href: "/the-price-tag/", label: "PRICE TAG", code: "72" },
	{ href: "/the-domino/", label: "DOMINO", code: "73" },
	{ href: "/the-microscope/", label: "MICROSCOPE", code: "74" },
	{ href: "/the-scoreboard/", label: "SCOREBOARD", code: "75" },
	{ href: "/the-tipping-point/", label: "TIPPING POINT", code: "76" },
	{ href: "/the-docs/", label: "DOCS", code: "77" },
	{ href: "/the-mirror-ring/", label: "MIRROR RING", code: "78" },
	{ href: "/the-correlation-lab/", label: "CORRELATION LAB", code: "79" },
	{ href: "/the-data-health/", label: "DATA HEALTH", code: "80" },
	{ href: "/the-violence/", label: "VIOLENCE ATLAS", code: "81" },
	{ href: "/the-prison/", label: "PRISON ATLAS", code: "82" },
	{ href: "/the-corrections/", label: "CORRECTIONS", code: "83" },
] as const;
