/**
 * V FOR X — The Greenhouse (Phase 20 — todo-061)
 *
 * "What should we actually *do* here?" The Greenhouse keeps a library of
 * local intervention playbooks — each a sequence of steps with a micro
 * cost model (people, hours, money, risk). A planner feeds it the local
 * context (population, budget, risk level) and it projects per-step and
 * total cost so a cell can compare "mutual aid kitchen" vs "documentary
 * screening" vs "legal-aid clinic" before committing.
 *
 *   • scorePlaybook()  — run a playbook's cost model against context
 *   • rankPlaybooks()  — sort available playbooks by fit/affordability
 *   • encode/decode    — VFXGRN1 token carrying one scored playbook
 *
 * The cost models are intentionally crude (linear heuristics). They exist
 * so a volunteer doesn't have to do spreadsheet math at 2am; they are NOT
 * financial advice. Fully offline; reads only the inputs handed to it.
 */

/* ═══════════════════════════════════════════════════════════════
   Token constants
   ═══════════════════════════════════════════════════════════════ */

export const GREENHOUSE_PREFIX = "VFXGRN1:";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface GreenhouseStep {
	/** Step label. */
	label: string;
	/** People-hours this step typically needs (baseline). */
	hours: number;
	/** People required (baseline). */
	people: number;
	/** Up-front money cost (baseline currency units). */
	money: number;
	/** Risk weight 0..1 (0 = safe, 1 = arrest-likely). */
	risk: number;
}

export interface GreenhousePlaybook {
	/** Playbook id. */
	id: string;
	/** Human name. */
	name: string;
	/** When to use it. */
	when: string;
	/** Ordered steps. */
	steps: GreenhouseStep[];
}

export interface GreenhouseContext {
	/** Population scale factor (1 = default). */
	populationScale?: number;
	/** Available budget (money cap). */
	budget?: number;
	/** Max risk the cell will accept (0..1). */
	riskTolerance?: number;
}

export interface ScoredPlaybook {
	id: string;
	name: string;
	totalHours: number;
	totalPeople: number;
	totalMoney: number;
	maxRisk: number;
	affordable: boolean;
	acceptableRisk: boolean;
	fitScore: number; // higher = better fit
}

/* ═══════════════════════════════════════════════════════════════
   Scoring
   ═══════════════════════════════════════════════════════════════ */

/** Project a playbook's cost against local context. Never throws. */
export function scorePlaybook(playbook: GreenhousePlaybook, ctx: GreenhouseContext = {}): ScoredPlaybook {
	const scale = Number(ctx.populationScale) > 0 ? Number(ctx.populationScale) : 1;
	let totalHours = 0;
	let totalPeople = 0;
	let totalMoney = 0;
	let maxRisk = 0;
	for (const s of playbook?.steps ?? []) {
		totalHours += Number(s.hours) || 0;
		totalPeople = Math.max(totalPeople, Number(s.people) || 0);
		totalMoney += Number(s.money) || 0;
		maxRisk = Math.max(maxRisk, clamp01(Number(s.risk)));
	}
	totalHours *= scale;
	totalMoney *= scale;
	totalPeople = Math.ceil(totalPeople * Math.sqrt(scale));

	const budget = typeof ctx.budget === "number" ? ctx.budget : Infinity;
	const tolerance = typeof ctx.riskTolerance === "number" ? clamp01(ctx.riskTolerance) : 1;
	const affordable = totalMoney <= budget;
	const acceptableRisk = maxRisk <= tolerance;

	// fit: cheaper + lower-risk + fewer people = better. Range ~ 0..100.
	const moneyScore = budget > 0 ? Math.max(0, 1 - totalMoney / budget) : 0.5;
	const riskScore = 1 - maxRisk;
	const peopleScore = 1 / (1 + totalPeople / 10);
	const fitScore = Math.round(((moneyScore + riskScore + peopleScore) / 3) * 100);

	return {
		id: playbook.id,
		name: playbook.name,
		totalHours,
		totalPeople,
		totalMoney,
		maxRisk,
		affordable,
		acceptableRisk,
		fitScore,
	};
}

/** Rank a set of playbooks by fit score (desc), filtered to affordable+acceptable. */
export function rankPlaybooks(playbooks: GreenhousePlaybook[], ctx: GreenhouseContext = {}): ScoredPlaybook[] {
	return (Array.isArray(playbooks) ? playbooks : [])
		.map((p) => scorePlaybook(p, ctx))
		.filter((s) => s.affordable && s.acceptableRisk)
		.sort((a, b) => b.fitScore - a.fitScore || a.totalMoney - b.totalMoney);
}

/* ═══════════════════════════════════════════════════════════════
   Token encode / decode
   ═══════════════════════════════════════════════════════════════ */

export function encodeGreenhouseToken(scored: ScoredPlaybook): string {
	return GREENHOUSE_PREFIX + toB64Url(JSON.stringify(scored));
}

export function decodeGreenhouseToken(token: string): ScoredPlaybook | null {
	if (typeof token !== "string" || !token.startsWith(GREENHOUSE_PREFIX)) return null;
	try {
		const parsed = JSON.parse(fromB64Url(token.slice(GREENHOUSE_PREFIX.length)));
		if (!parsed || typeof parsed !== "object" || typeof parsed.id !== "string") return null;
		return parsed as ScoredPlaybook;
	} catch {
		return null;
	}
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function clamp01(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.max(0, Math.min(1, n));
}

function toB64Url(s: string): string {
	const b64 = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, "utf8").toString("base64");
	return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): string {
	const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
	const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
	return typeof atob === "function" ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, "base64").toString("utf8");
}
