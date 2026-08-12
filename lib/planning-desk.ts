/**
 * V FOR X — Planning Desk (one pipeline: Allocator + Monte Carlo + Trail)
 *
 * A unified "planning desk" that folds three engines into a single
 * plan object so an operator can answer one question:
 *
 *   "If we reallocate $X away from military spending and route it
 *    through our local Trail, how many people do we reach and how
 *    confident are we?"
 *
 * It is pure glue over existing, fully-tested modules:
 *   • lib/allocator.ts  — budget → people reached (deterministic)
 *   • lib/monte-carlo.ts — scenario uncertainty (probabilistic)
 *   • lib/trail-match.ts — local needs ↔ offers (offline routing)
 *
 * Nothing leaves the device. The desk runs locally and returns a
 * citable plan summary. Inputs are all optional so the desk works
 * with whatever data the operator has — partial plans are honest
 * about what's missing.
 */

import {
  calculateAllocation,
  type BudgetResult,
} from "./allocator";
import {
  runMonteCarlo,
  type MonteCarloResult,
} from "./monte-carlo";
import type { ScenarioConfig } from "./scenario-engine";
import {
  matchAll,
  summarizeMatch,
  type TrailEntry,
  type TrailMatch,
  type MatchOptions,
} from "./trail-match";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

/** Minimal country shape the Monte Carlo engine needs. */
export interface DeskCountry {
  name: string;
  iso3: string;
  population_m?: number;
  metrics?: Record<string, number>;
  [key: string]: unknown;
}

export interface PlanningDeskInput {
  /** Budget allocation map (itemId → $B). */
  allocations?: Record<string, number>;
  /** Country context for the Monte Carlo engine. */
  country?: DeskCountry;
  /** Scenario configuration for the Monte Carlo engine. */
  scenario?: ScenarioConfig;
  /** Trail entries (needs + offers) to match. */
  trailEntries?: TrailEntry[];
  /** Trail matching options. */
  matchOptions?: MatchOptions;
  /** Monte Carlo iterations (default 500). */
  iterations?: number;
  /** Operator label for the plan. */
  label?: string;
}

export interface PlanningDeskResult {
  /** Source label. */
  label: string;
  /** Epoch ms the plan was built. */
  ts: number;
  /** Allocator result (null if no allocations given). */
  allocation: BudgetResult | null;
  /** Monte Carlo result (null if country/scenario missing). */
  monteCarlo: MonteCarloResult | null;
  /** Trail matches (empty if no entries given). */
  matches: TrailMatch[];
  /** Compact one-line summaries of the top matches. */
  matchSummaries: string[];
  /** Number of unmet needs remaining after matching. */
  unmetNeeds: number;
  /** Number of unused offers remaining after matching. */
  unusedOffers: number;
  /** People reached (from allocation), if available. */
  reachMillions: number;
  /** Share of budgeted sectors fully funded (0..1). */
  coverage: number;
  /** Average match confidence (0..1) across matches. */
  avgMatchConfidence: number;
  /** Plain-language narrative summary. */
  narrative: string;
  /** Which components contributed to this plan. */
  components: ("allocator" | "monte_carlo" | "trail")[];
}

/* ═══════════════════════════════════════════════════════════════
   Core: build a unified plan
   ═══════════════════════════════════════════════════════════════ */

/**
 * Build a planning-desk plan from whatever inputs are available.
 * Missing inputs simply contribute null/empty results — the plan is
 * always honest about what it could and couldn't compute.
 */
export function buildPlan(input: PlanningDeskInput): PlanningDeskResult {
  const components: PlanningDeskResult["components"] = [];
  const ts = Date.now();

  // 1. Allocator
  let allocation: BudgetResult | null = null;
  if (input.allocations && Object.keys(input.allocations).length > 0) {
    allocation = calculateAllocation(input.allocations);
    components.push("allocator");
  }

  // 2. Monte Carlo
  let monteCarlo: MonteCarloResult | null = null;
  if (input.country && input.scenario) {
    monteCarlo = runMonteCarlo(
      input.country as never,
      input.scenario,
      input.iterations ?? 500,
    );
    components.push("monte_carlo");
  }

  // 3. Trail matching
  let matches: TrailMatch[] = [];
  if (input.trailEntries && input.trailEntries.length > 0) {
    matches = matchAll(input.trailEntries, input.matchOptions);
    components.push("trail");
  }

  // Derived metrics
  const matchSummaries = matches.slice(0, 10).map(summarizeMatch);
  const needs = (input.trailEntries ?? []).filter((e) => e.type === "need");
  const offers = (input.trailEntries ?? []).filter((e) => e.type === "offer");
  const matchedNeedIds = new Set(matches.map((m) => m.need.id));
  const matchedOfferIds = new Set(matches.map((m) => m.offer.id));
  const unmetNeeds = needs.filter((n) => !matchedNeedIds.has(n.id)).length;
  const unusedOffers = offers.filter((o) => !matchedOfferIds.has(o.id)).length;

  const reachMillions = allocation?.totalReachM ?? 0;
  const coverage = allocation
    ? allocation.fullyFundedCount / Math.max(1, allocation.allocations.length)
    : 0;
  const avgMatchConfidence =
    matches.length > 0
      ? matches.reduce((s, m) => s + m.score, 0) / matches.length
      : 0;

  const narrative = buildNarrative({
    label: input.label,
    allocation,
    monteCarlo,
    matchCount: matches.length,
    unmetNeeds,
    reachMillions,
    coverage,
  });

  return {
    label: input.label ?? "Planning Desk",
    ts,
    allocation,
    monteCarlo,
    matches,
    matchSummaries,
    unmetNeeds,
    unusedOffers,
    reachMillions,
    coverage,
    avgMatchConfidence,
    narrative,
    components,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Narrative builder
   ═══════════════════════════════════════════════════════════════ */

interface NarrativeInput {
  label?: string;
  allocation: BudgetResult | null;
  monteCarlo: MonteCarloResult | null;
  matchCount: number;
  unmetNeeds: number;
  reachMillions: number;
  coverage: number;
}

/**
 * Produce a plain-language summary of the plan, suitable for a
 * briefing card. Honest about uncertainty and gaps.
 */
export function buildNarrative(input: NarrativeInput): string {
  const parts: string[] = [];
  if (input.label) parts.push(`Plan "${input.label}".`);

  if (input.allocation) {
    const a = input.allocation;
    parts.push(
      `Reallocation reaches ~${a.totalReachM.toFixed(0)}M people ` +
        `(${Math.round(input.coverage * 100)}% of sectors fully funded) ` +
        `≈ ${a.daysOfMilitary.toFixed(1)} days of global military spending.`,
    );
  } else {
    parts.push("No budget allocation provided.");
  }

  if (input.matchCount > 0) {
    parts.push(
      `Trail routing found ${input.matchCount} need↔offer match${input.matchCount === 1 ? "" : "es"}` +
        (input.unmetNeeds > 0 ? `; ${input.unmetNeeds} need${input.unmetNeeds === 1 ? "" : "s"} still unmet.` : "."),
    );
  } else if (input.allocation) {
    parts.push("No Trail entries provided for local routing.");
  }

  if (input.monteCarlo) {
    const mc = input.monteCarlo;
    const probs = Object.values(mc.improvementProbability);
    const avgImprove = Math.round(avgImprovementProbability(probs) * 100);
    parts.push(
      `Monte Carlo over ${mc.iterations} runs: ~${avgImprove}% average improvement probability.`,
    );
  }

  return parts.join(" ");
}

/**
 * Compute the "average improvement probability" robustly.
 * Higher probability is always "better" for this aggregate, regardless
 * of whether individual metrics prefer lower or higher values.
 */
export function avgImprovementProbability(probs: number[]): number {
  if (probs.length === 0) return 0;
  return probs.reduce((s, p) => s + p, 0) / probs.length;
}
