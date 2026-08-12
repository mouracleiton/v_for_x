import { describe, it, expect } from "vitest";
import {
	createBallot,
	castVote,
	tallyVotes,
	encodeBallotToken,
	decodeBallotToken,
	type QuorumBallot,
} from "../lib/quorum-ballot";

describe("quorum ballots", () => {
	const opts = [
		{ id: "a", label: "Open safehouse" },
		{ id: "b", label: "Stay dark" },
	];

	it("creates a clean ballot", () => {
		const b = createBallot({ question: "Move now?", options: opts, deadline: Date.now() + 60_000, proposer: "p1" });
		expect(b.options).toHaveLength(2);
		expect(b.method).toBe("plurality");
		expect(b.votes).toEqual([]);
		expect(b.id.length).toBeGreaterThan(0);
	});

	it("rejects empty/invalid options defensively", () => {
		const b = createBallot({ question: "q", options: [], deadline: Date.now(), proposer: "p" });
		expect(b.options).toEqual([]);
	});

	it("casts a vote and dedupes by identity", () => {
		const b = createBallot({ question: "q", options: opts, deadline: Date.now() + 60_000, proposer: "p" });
		const v1 = castVote(b, { identity: "voter-1", optionId: "a", ts: Date.now() });
		const v2 = castVote(v1, { identity: "voter-1", optionId: "b", ts: Date.now() }); // change vote
		expect(v2.votes).toHaveLength(1);
		expect(v2.votes[0].optionId).toBe("b");
	});

	it("rejects votes for unknown options", () => {
		const b = createBallot({ question: "q", options: opts, deadline: Date.now() + 60_000, proposer: "p" });
		const v = castVote(b, { identity: "v1", optionId: "zzz", ts: Date.now() });
		expect(v.votes).toHaveLength(0);
	});

	it("rejects late votes past the deadline", () => {
		const past = createBallot({ question: "q", options: opts, deadline: 1000, proposer: "p" });
		const v = castVote(past, { identity: "v1", optionId: "a", ts: 5_000_000_000_000 });
		expect(v.votes).toHaveLength(0);
	});

	it("tallies plurality correctly", () => {
		let b: QuorumBallot = createBallot({
			question: "q",
			options: opts,
			deadline: Date.now() + 60_000,
			proposer: "p",
		});
		b = castVote(b, { identity: "v1", optionId: "a", ts: Date.now() });
		b = castVote(b, { identity: "v2", optionId: "a", ts: Date.now() });
		b = castVote(b, { identity: "v3", optionId: "b", ts: Date.now() });
		const r = tallyVotes(b);
		expect(r.counts.a).toBe(2);
		expect(r.counts.b).toBe(1);
		expect(r.total).toBe(3);
		expect(r.winner).toBe("a");
		expect(r.decisive).toBe(true);
	});

	it("supermajority requires 2/3", () => {
		let b: QuorumBallot = createBallot({
			question: "q",
			options: opts,
			method: "supermajority",
			deadline: Date.now() + 60_000,
			proposer: "p",
		});
		b = castVote(b, { identity: "v1", optionId: "a", ts: Date.now() });
		b = castVote(b, { identity: "v2", optionId: "b", ts: Date.now() });
		b = castVote(b, { identity: "v3", optionId: "a", ts: Date.now() });
		const r = tallyVotes(b);
		// 2 of 3 = exactly 2/3, ceil((3*2)/3)=2 → decisive
		expect(r.decisive).toBe(true);
	});

	it("consensus requires unanimity", () => {
		let b: QuorumBallot = createBallot({
			question: "q",
			options: opts,
			method: "consensus",
			deadline: Date.now() + 60_000,
			proposer: "p",
		});
		b = castVote(b, { identity: "v1", optionId: "a", ts: Date.now() });
		b = castVote(b, { identity: "v2", optionId: "b", ts: Date.now() });
		const r = tallyVotes(b);
		expect(r.decisive).toBe(false);
		expect(r.reason).toContain("threshold");
	});

	it("round-trips through token encode/decode", () => {
		let b: QuorumBallot = createBallot({
			question: "q",
			options: opts,
			deadline: Date.now() + 60_000,
			proposer: "p",
		});
		b = castVote(b, { identity: "v1", optionId: "a", ts: Date.now() });
		const token = encodeBallotToken(b);
		expect(token.startsWith("VFXQBT1:")).toBe(true);
		const back = decodeBallotToken(token);
		expect(back).not.toBeNull();
		expect(back?.votes).toHaveLength(1);
		expect(back?.question).toBe("q");
	});

	it("decode rejects garbage tokens", () => {
		expect(decodeBallotToken("garbage")).toBeNull();
		expect(decodeBallotToken("VFXQBT1:not-json")).toBeNull();
	});
});
