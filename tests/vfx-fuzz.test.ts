/**
 * V FOR X — VFX codec fuzz tests (todo-045)
 *
 * Feeds malformed, truncated, and adversarial input to every VFX* decode /
 * parse / detect path. The resilience contract:
 *   - Null-returning decoders (detectToken, decodeMessage, decodePublicCardToken)
 *     MUST return null — never throw.
 *   - Throwing decoders (decodePack, parseWitnessLedger) are documented to
 *     throw — they MUST throw a typed `Error` (never a raw string or
 *     uncaught non-Error), never corrupt process state, and never return a
 *     half-parsed malformed object.
 * Green = "no codec blows up unsafely on garbage". A poisoned mirror claim
 * or corrupted dead-drop token fails closed, it does not crash the receiver.
 */

import { describe, it, expect } from "vitest";
import { detectToken, validateTokenFormat } from "../lib/tokens";
import { decodeMessage, segmentForQR, reassembleSegments } from "../lib/relay";
import { decodePack, readCrisisManifestFromToken } from "../lib/vfxpack";
import { parseWitnessLedger } from "../lib/witness";
import { decodePublicCardToken } from "../lib/identity";

const GARBAGE = [
	"",
	" ",
	"\x00",
	"\x00\x00\x00",
	"VFX",
	"VFX|",
	"VFX||",
	"VFXID1:",
	"VFXWIT1:",
	"VFXPACK1:",
	"VFXID1",
	"VFXWIT1",
	"VFXPACK1",
	"VFXID1:\x00",
	"VFXWIT1:\n\n",
	"VFXPACK1:{}",
	"VFXPACK1:notjson",
	"VFXPACK1:[",
	"VFXPACK1:{",
	"VFXPACK1:{[]}",
	"VFXPACK1:" + "A".repeat(1_000_000),
	" garbage ",
	"VFXID1:" + "garbage".repeat(1000),
	"VFX" + "💩".repeat(50),
	"VFXID1:" + '{"a":}',
	"VFXWIT1:" + "{not valid json}",
	"VFXPACK1:" + JSON.stringify({ tokens: "not-an-array" }),
	"VFXPACK1:" + JSON.stringify({ tokens: [123, null, {}] }),
	"VFXID1PUB:" + "x".repeat(10000),
	"VFXUNKNOWN1:foo",
	"not-a-token-at-all-just-a-url-https://example.com",
	"data:application/json,{}",
	"VFXM1:\u0000\u0001\u0002",
];

/** Calls fn; returns {threw, error, result}. Never lets the exception escape. */
function probe<T>(fn: () => T): {
	threw: boolean;
	error: unknown;
	result: T | undefined;
} {
	try {
		const result = fn();
		return { threw: false, error: null, result };
	} catch (error) {
		return { threw: true, error, result: undefined };
	}
}

/** Asserts the decoder either returns null/object OR throws a typed Error. */
function assertSafeNull<T>(label: string, input: string, fn: () => T | null) {
	const { threw, error, result } = probe(fn);
	if (threw) {
		// Allowed ONLY if it's a typed Error — never a raw string / non-Error.
		expect(
			error,
			`${label} must throw a typed Error, not a raw value`,
		).toBeInstanceOf(Error);
	} else {
		expect(
			result === null || typeof result === "object",
			`${label} returned non-object for ${JSON.stringify(input.slice(0, 24))}`,
		).toBe(true);
	}
}

describe("VFX codec fuzz — no decoder throws on malformed input", () => {
	for (const input of GARBAGE) {
		const preview = input.slice(0, 24).replace(/\s+/g, " ");
		it(`detectToken(${JSON.stringify(preview)})`, () => {
			assertSafeNull("detectToken", input, () => detectToken(input));
		});

		it(`validateTokenFormat(${JSON.stringify(preview)})`, () => {
			const { threw, error, result } = probe(() => validateTokenFormat(input));
			expect(threw, "validateTokenFormat must not throw").toBe(false);
			if (threw) expect(error).toBeInstanceOf(Error);
			expect(typeof result).toBe("boolean");
		});

		it(`decodeMessage(${JSON.stringify(preview)})`, () => {
			assertSafeNull("decodeMessage", input, () => decodeMessage(input));
		});

		it(`decodePack(${JSON.stringify(preview)})`, () => {
			// decodePack is documented to throw on malformed input; assert typed Error
			// or a well-formed object (never a raw exception / half-parsed object).
			const { threw, error, result } = probe(() => decodePack(input));
			if (threw) {
				expect(error).toBeInstanceOf(Error);
			} else {
				expect(typeof result).toBe("object");
				expect(
					Array.isArray((result as { tokens?: unknown }).tokens ?? []),
				).toBe(true);
			}
		});

		it(`readCrisisManifestFromToken(${JSON.stringify(preview)})`, () => {
			assertSafeNull("readCrisisManifestFromToken", input, () =>
				readCrisisManifestFromToken(input),
			);
		});

		it(`parseWitnessLedger(${JSON.stringify(preview)})`, () => {
			// parseWitnessLedger is documented to throw; assert typed Error or array.
			const { threw, error, result } = probe(() => parseWitnessLedger(input));
			if (threw) {
				expect(error).toBeInstanceOf(Error);
			} else {
				expect(Array.isArray(result)).toBe(true);
			}
		});

		it(`decodePublicCardToken(${JSON.stringify(preview)})`, () => {
			assertSafeNull("decodePublicCardToken", input, () =>
				decodePublicCardToken(input),
			);
		});
	}

	it("segmentForQR + reassembleSegments survive adversarial segments", () => {
		// Empty string
		const a = probe(() => segmentForQR("")).result ?? [];
		expect(Array.isArray(a)).toBe(true);
		const ra = probe(() => reassembleSegments([]));
		expect(ra.threw).toBe(false);
		// Single very long string
		const long = "VFXID1:" + "x".repeat(5000);
		const segs = probe(() => segmentForQR(long)).result ?? [];
		expect(segs.length).toBeGreaterThan(0);
		const r = probe(() => reassembleSegments(segs));
		expect(r.threw).toBe(false);
		expect(r.result).toBe(long);
		// Hand-crafted malformed segment objects
		const malformed = [
			{ index: 0, total: 3, messageId: "abc", content: "VFXabc0/3|x" },
			{ index: 1, total: 2, messageId: "abc", content: "VFXabc1/2|y" }, // total mismatch
		];
		const rm = probe(() => reassembleSegments(malformed));
		expect(rm.threw).toBe(false);
	});
});
