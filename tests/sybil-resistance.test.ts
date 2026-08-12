import { describe, it, expect } from "vitest";
import {
	RateLimiter,
	leadingZeroBits,
	mineProof,
	verifyProof,
	dedupeByAuthorCircle,
	HEATMAP_RATE_LIMIT,
	HEATMAP_POW_BITS,
} from "../lib/sybil-resistance";

describe("sybil resistance", () => {
	describe("RateLimiter", () => {
		it("allows up to max hits per window, then blocks", () => {
			const rl = new RateLimiter({ max: 3, windowMs: 1000 });
			expect(rl.try("a")).toBe(true);
			expect(rl.try("a")).toBe(true);
			expect(rl.try("a")).toBe(true);
			expect(rl.try("a")).toBe(false);
		});

		it("tracks keys independently", () => {
			const rl = new RateLimiter({ max: 1, windowMs: 1000 });
			expect(rl.try("a")).toBe(true);
			expect(rl.try("b")).toBe(true);
			expect(rl.try("a")).toBe(false);
			expect(rl.try("b")).toBe(false);
		});

		it("refills after the window passes", () => {
			const rl = new RateLimiter({ max: 1, windowMs: 50 });
			const now = 1000;
			expect(rl.try("a", now)).toBe(true);
			expect(rl.try("a", now)).toBe(false);
			expect(rl.try("a", now + 60)).toBe(true); // window elapsed
		});

		it("remaining reports budget without mutating", () => {
			const rl = new RateLimiter({ max: 3, windowMs: 1000 });
			expect(rl.remaining("a")).toBe(3);
			rl.try("a");
			expect(rl.remaining("a")).toBe(2);
		});

		it("prune drops stale keys", () => {
			const rl = new RateLimiter({ max: 1, windowMs: 10 });
			rl.try("a", 0);
			rl.prune(100);
			// After prune, budget is back (stale hits removed).
			expect(rl.remaining("a", 100)).toBe(1);
		});
	});

	describe("proof of work", () => {
		it("leadingZeroBits counts leading zero nibbles + bits", () => {
			expect(leadingZeroBits("000f")).toBe(12); // 3 zero nibbles (0000|0000|0000|1111)
			expect(leadingZeroBits("00ff")).toBe(8); // 2 zero nibbles
			expect(leadingZeroBits("0000")).toBe(16); // 4 zero nibbles
			expect(leadingZeroBits("1000")).toBe(3); // 0x1 = 0001 → 3 leading zero bits
			expect(leadingZeroBits("f000")).toBe(0); // 0xf = 1111 → no leading zeros
		});

		it("mines a verifiable proof at low bits (test-friendly)", async () => {
			const pow = await mineProof("heatmap:SDN", 4);
			expect(pow).not.toBeNull();
			expect(await verifyProof(pow!)).toBe(true);
		});

		it("rejects a tampered proof", async () => {
			const pow = await mineProof("heatmap:SDN", 4);
			const bad = { ...pow!, counter: pow!.counter + 1 };
			expect(await verifyProof(bad)).toBe(false);
		});

		it("verifies a real-protocol PoW stamp at HEATMAP_POW_BITS", async () => {
			// Lower bits to keep the test fast but exercise the real path.
			const pow = await mineProof("r", 6);
			expect(pow!.bits).toBeGreaterThanOrEqual(6);
			expect(await verifyProof(pow!)).toBe(true);
		});
	});

	describe("vouch-circle dedupe", () => {
		it("counts distinct (author, vouchRoot) pairs", () => {
			const votes = [
				{ author: "A", vouchRoot: "R1" },
				{ author: "A", vouchRoot: "R1" }, // dup
				{ author: "A", vouchRoot: "R2" }, // same author, different circle
				{ author: "B", vouchRoot: "R1" },
			];
			expect(dedupeByAuthorCircle(votes)).toBe(3);
		});

		it("empty input → 0", () => {
			expect(dedupeByAuthorCircle([])).toBe(0);
		});
	});

	it("exports sane defaults", () => {
		expect(HEATMAP_RATE_LIMIT.max).toBeGreaterThan(0);
		expect(HEATMAP_RATE_LIMIT.windowMs).toBeGreaterThan(0);
		expect(HEATMAP_POW_BITS).toBeGreaterThanOrEqual(8);
	});
});
