import { describe, it, expect, beforeEach } from "vitest";
import {
	acknowledgeSafety,
	clearSafetyAcks,
	formatSafetyNumber,
	isSafetyAcknowledged,
	listSafetyAcks,
	peerGateKey,
} from "../lib/safety-gate";

describe("safety-gate", () => {
	beforeEach(() => {
		clearSafetyAcks();
	});

	it("peerGateKey is order-independent", () => {
		expect(peerGateKey("a", "b")).toBe(peerGateKey("b", "a"));
	});

	it("acknowledge + isSafetyAcknowledged", () => {
		const key = peerGateKey("alice", "bob");
		expect(isSafetyAcknowledged(key)).toBe(false);
		acknowledgeSafety({ peerKey: key, safetyNumber: "abcd".repeat(16) });
		expect(isSafetyAcknowledged(key)).toBe(true);
		expect(listSafetyAcks()).toHaveLength(1);
	});

	it("skip flag is recorded", () => {
		const key = peerGateKey("x", "y");
		const row = acknowledgeSafety({
			peerKey: key,
			safetyNumber: "ff",
			skipped: true,
		});
		expect(row.skipped).toBe(true);
	});

	it("formatSafetyNumber groups hex", () => {
		expect(formatSafetyNumber("aabbccdd", 4)).toEqual(["aabb", "ccdd"]);
	});
});
