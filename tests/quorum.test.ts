import { describe, it, expect, beforeAll } from "vitest";
import {
  createPoll,
  closePoll,
  isPollOpen,
  castVote,
  verifyBallot,
  deduplicateBallots,
  tallyVotes,
  generateVoterSecret,
  pollProgress,
  formatTimeRemaining,
} from "../lib/quorum";

const ELIGIBLE_SET = ["SDN", "YEM", "AFG", "SOM", "HTI", "SYR"];

describe("quorum.ts", () => {
  let poll: ReturnType<typeof createPoll>;

  beforeAll(() => {
    poll = createPoll(
      "Should we endorse the hunger emergency declaration?",
      "Vote on whether to endorse the emergency declaration for hunger hotspots",
      [
        { id: "yes", label: "Yes, endorse" },
        { id: "no", label: "No, reject" },
        { id: "abstain", label: "Abstain" },
      ],
      ELIGIBLE_SET,
      "Hunger hotspot country members",
      72,
    );
  });

  describe("createPoll", () => {
    it("should create a poll with an id and options", () => {
      expect(poll.id).toBeDefined();
      expect(poll.question).toContain("endorse");
      expect(poll.options).toHaveLength(3);
      expect(poll.eligibleSet).toEqual(ELIGIBLE_SET);
      expect(poll.active).toBe(true);
      expect(poll.deadline).toBeGreaterThan(Date.now());
    });
  });

  describe("isPollOpen", () => {
    it("should be open for a new poll", () => {
      expect(isPollOpen(poll)).toBe(true);
    });

    it("should be closed after deadline", () => {
      const past = { ...poll, deadline: Date.now() - 1000 };
      expect(isPollOpen(past)).toBe(false);
    });

    it("should be closed after closePoll", () => {
      expect(isPollOpen(closePoll(poll))).toBe(false);
    });
  });

  describe("castVote / verifyBallot", () => {
    it("should cast a valid vote", async () => {
      const { ballot, verified } = await castVote(poll, "SDN", "yes", "voter-secret-1");
      expect(verified).toBe(true);
      expect(ballot.pollId).toBe(poll.id);
      expect(ballot.optionId).toBe("yes");
      expect(ballot.proof).toBeDefined();
      expect(ballot.nullifier).toBeDefined();
      expect(ballot.voteCommitment).toBeDefined();
    });

    it("should verify a valid ballot", async () => {
      const { ballot } = await castVote(poll, "YEM", "no", "voter-secret-2");
      const valid = await verifyBallot(ballot, poll);
      expect(valid).toBe(true);
    });

    it("should reject vote from non-eligible attribute", async () => {
      await expect(
        castVote(poll, "USA", "yes", "voter-secret-3"),
      ).rejects.toThrow("not in the valid set");
    });

    it("should reject invalid option", async () => {
      await expect(
        castVote(poll, "SDN", "invalid_option", "voter-secret-4"),
      ).rejects.toThrow("Invalid option");
    });

    it("should reject tampered ballot", async () => {
      const { ballot } = await castVote(poll, "AFG", "yes", "voter-secret-5");
      const tampered = { ...ballot, optionId: "no" };
      const valid = await verifyBallot(tampered, poll);
      expect(valid).toBe(false);
    });
  });

  describe("deduplicateBallots", () => {
    it("should remove duplicate nullifiers", async () => {
      const { ballot: b1 } = await castVote(poll, "SDN", "yes", "same-secret");
      const { ballot: b2 } = await castVote(poll, "SDN", "no", "same-secret");
      // Same voter secret → same nullifier
      const { unique, duplicates } = deduplicateBallots([b1, b2]);
      expect(duplicates).toBe(1);
      expect(unique).toHaveLength(1);
    });

    it("should keep different voters separate", async () => {
      const { ballot: b1 } = await castVote(poll, "SDN", "yes", "voter-a");
      const { ballot: b2 } = await castVote(poll, "YEM", "no", "voter-b");
      const { unique, duplicates } = deduplicateBallots([b1, b2]);
      expect(duplicates).toBe(0);
      expect(unique).toHaveLength(2);
    });
  });

  describe("tallyVotes", () => {
    it("should tally votes correctly", async () => {
      const ballots = await Promise.all([
        castVote(poll, "SDN", "yes", "v1"),
        castVote(poll, "YEM", "yes", "v2"),
        castVote(poll, "AFG", "no", "v3"),
        castVote(poll, "SOM", "abstain", "v4"),
      ]);

      const result = await tallyVotes(ballots.map((b) => b.ballot), poll);
      expect(result.totalVotes).toBe(4);
      expect(result.results.find((r) => r.optionId === "yes")!.count).toBe(2);
      expect(result.results.find((r) => r.optionId === "no")!.count).toBe(1);
      expect(result.results.find((r) => r.optionId === "abstain")!.count).toBe(1);
      expect(result.winner!.id).toBe("yes");
      expect(result.spoiledBallots).toBe(0);
    });

    it("should detect double-voting and spoil duplicates", async () => {
      const ballots = await Promise.all([
        castVote(poll, "SDN", "yes", "dup-voter"),
        castVote(poll, "SDN", "no", "dup-voter"),
      ]);

      const result = await tallyVotes(ballots.map((b) => b.ballot), poll);
      expect(result.totalVotes).toBe(1);
      expect(result.spoiledBallots).toBe(1);
    });
  });

  describe("Utilities", () => {
    it("should generate unique voter secrets", () => {
      const s1 = generateVoterSecret();
      const s2 = generateVoterSecret();
      expect(s1).toHaveLength(64);
      expect(s2).toHaveLength(64);
      expect(s1).not.toBe(s2);
    });

    it("should compute poll progress", () => {
      const progress = pollProgress(poll);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    });

    it("should format remaining time", () => {
      const time = formatTimeRemaining(poll);
      expect(time).toContain("h");
    });
  });
});
