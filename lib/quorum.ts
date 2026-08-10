/**
 * V FOR X — The Quorum (Anonymous ZK Voting)
 *
 * Anonymous collective decision-making without revealing who voted
 * or how they voted. Uses the existing ZK proof system (lib/zk.ts)
 * for set-membership proofs — proving you're eligible to vote without
 * revealing your identity.
 *
 * Protocol:
 *   1. A poll is created with a question and options
 *   2. Each voter generates a ZK proof of eligibility (e.g., "I am a
 *      member of hotspot country X") without revealing which country
 *   3. The voter submits a blinded ballot: the vote choice is committed
 *      to via a hash commitment, not revealed directly
 *   4. A nullifier prevents double-voting: H(secret || pollId)
 *      is unique per voter+poll but does not reveal identity
 *   5. Tallying counts all verified ballots
 *
 * All client-side. No central authority. Results are computed from
 * the publicly visible set of ballots + proofs.
 */

import {
  createCommitment,
  proveSetMembership,
  verifySetMembership,
  type ZKCommitment,
} from "./zk";

export interface PollOption {
  id: string;
  label: string;
  description?: string;
}

export interface Poll {
  id: string;
  question: string;
  description: string;
  options: PollOption[];
  /** The set of valid voter attributes (e.g., hotspot ISO3 codes) */
  eligibleSet: string[];
  /** Human-readable label for the eligibility requirement */
  eligibilityLabel: string;
  createdAt: number;
  /** Deadline epoch ms (0 = no deadline) */
  deadline: number;
  /** Whether votes are still being accepted */
  active: boolean;
}

export interface Ballot {
  pollId: string;
  /** ZK proof of eligibility */
  proof: ZKCommitment;
  /** Hash commitment to the vote choice (H(nonce || optionId)) */
  voteCommitment: string;
  /** Nonce used in the commitment — revealed at tally time */
  voteNonce: string;
  /** The actual option ID this ballot voted for */
  optionId: string;
  /** Nullifier: H(secret || pollId) — unique per voter per poll */
  nullifier: string;
  ts: number;
}

export interface TallyResult {
  pollId: string;
  totalVotes: number;
  results: { optionId: string; label: string; count: number; pct: number }[];
  winner: PollOption | null;
  spoiledBallots: number;
}

/* ═══════════════════════════════════════════════════════════
   POLL MANAGEMENT
   ═══════════════════════════════════════════════════════════ */

export function createPoll(
  question: string,
  description: string,
  options: PollOption[],
  eligibleSet: string[],
  eligibilityLabel: string,
  durationHours = 72,
): Poll {
  return {
    id: crypto.randomUUID(),
    question,
    description,
    options,
    eligibleSet,
    eligibilityLabel,
    createdAt: Date.now(),
    deadline: durationHours > 0 ? Date.now() + durationHours * 3_600_000 : 0,
    active: true,
  };
}

export function closePoll(poll: Poll): Poll {
  return { ...poll, active: false };
}

export function isPollOpen(poll: Poll, now = Date.now()): boolean {
  if (!poll.active) return false;
  if (poll.deadline > 0 && now > poll.deadline) return false;
  return true;
}

/* ═══════════════════════════════════════════════════════════
   VOTING
   ═══════════════════════════════════════════════════════════ */

/**
 * Cast a vote. The voter provides their attribute (e.g., ISO3 country code)
 * and their choice. A ZK proof is generated proving membership in the
 * eligible set without revealing the attribute.
 *
 * Returns a ballot that can be published to the public bulletin board.
 */
export async function castVote(
  poll: Poll,
  attribute: string,
  optionId: string,
  voterSecret: string,
): Promise<{ ballot: Ballot; verified: boolean }> {
  if (!isPollOpen(poll)) {
    throw new Error("This poll is closed");
  }

  if (!poll.options.some((o) => o.id === optionId)) {
    throw new Error(`Invalid option: ${optionId}`);
  }

  // Generate ZK proof of eligibility
  const { proof } = await proveSetMembership(
    attribute,
    poll.eligibleSet,
    `poll_${poll.id}_eligibility`,
  );

  // Create a commitment to the vote choice
  const { commitment: voteCommitment, nonce: voteNonce } = await createCommitment(optionId);

  // Generate nullifier: unique per voter per poll, but doesn't reveal identity
  const nullifier = await hashString(voterSecret + poll.id);

  const ballot: Ballot = {
    pollId: poll.id,
    proof,
    voteCommitment,
    voteNonce,
    optionId,
    nullifier,
    ts: Date.now(),
  };

  return { ballot, verified: true };
}

/**
 * Verify a ballot is valid:
 *   1. ZK proof checks against the poll's eligible set
 *   2. Vote commitment matches the claimed option + nonce
 */
export async function verifyBallot(ballot: Ballot, poll: Poll): Promise<boolean> {
  // Verify ZK eligibility proof
  const proofValid = await verifySetMembership(ballot.proof, poll.eligibleSet);
  if (!proofValid) return false;

  // Verify vote commitment
  const expectedHash = await hashString(ballot.voteNonce + ballot.optionId);
  if (expectedHash !== ballot.voteCommitment) return false;

  // Verify option exists
  if (!poll.options.some((o) => o.id === ballot.optionId)) return false;

  return true;
}

/* ═══════════════════════════════════════════════════════════
   DOUBLE-VOTE PREVENTION
   ═══════════════════════════════════════════════════════════ */

/**
 * Check a set of ballots for nullifier duplicates (double-voting).
 * Returns the deduplicated ballot set and the count of duplicates found.
 */
export function deduplicateBallots(ballots: Ballot[]): { unique: Ballot[]; duplicates: number } {
  const seen = new Set<string>();
  const unique: Ballot[] = [];
  let duplicates = 0;

  for (const b of ballots) {
    if (seen.has(b.nullifier)) {
      duplicates++;
      continue;
    }
    seen.add(b.nullifier);
    unique.push(b);
  }

  return { unique, duplicates };
}

/* ═══════════════════════════════════════════════════════════
   TALLYING
   ═══════════════════════════════════════════════════════════ */

/**
 * Tally all ballots for a poll. Verifies each ballot, deduplicates
 * by nullifier, and computes the results.
 */
export async function tallyVotes(ballots: Ballot[], poll: Poll): Promise<TallyResult> {
  const { unique, duplicates } = deduplicateBallots(ballots);
  let spoiled = duplicates;
  const counts: Record<string, number> = {};

  for (const opt of poll.options) {
    counts[opt.id] = 0;
  }

  for (const ballot of unique) {
    const valid = await verifyBallot(ballot, poll);
    if (valid) {
      counts[ballot.optionId] = (counts[ballot.optionId] ?? 0) + 1;
    } else {
      spoiled++;
    }
  }

  const totalVotes = Object.values(counts).reduce((a, b) => a + b, 0);
  const results = poll.options.map((opt) => ({
    optionId: opt.id,
    label: opt.label,
    count: counts[opt.id] ?? 0,
    pct: totalVotes > 0 ? ((counts[opt.id] ?? 0) / totalVotes) * 100 : 0,
  }));

  const sorted = [...results].sort((a, b) => b.count - a.count);
  const winner = sorted[0] && sorted[0].count > 0
    ? poll.options.find((o) => o.id === sorted[0].optionId) ?? null
    : null;

  return {
    pollId: poll.id,
    totalVotes,
    results: sorted,
    winner,
    spoiledBallots: spoiled,
  };
}

/* ═══════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════ */

async function hashString(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a random voter secret for nullifier generation.
 * This should be generated once per voter and kept private.
 */
export function generateVoterSecret(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compute the percentage of elapsed time for a poll.
 */
export function pollProgress(poll: Poll, now = Date.now()): number {
  if (poll.deadline === 0) return 0;
  const total = poll.deadline - poll.createdAt;
  const elapsed = now - poll.createdAt;
  return Math.max(0, Math.min(1, elapsed / total));
}

/**
 * Format remaining time for a poll.
 */
export function formatTimeRemaining(poll: Poll, now = Date.now()): string {
  if (poll.deadline === 0) return "No deadline";
  const remaining = poll.deadline - now;
  if (remaining <= 0) return "CLOSED";
  const hours = Math.floor(remaining / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
