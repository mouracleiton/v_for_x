import { describe, it, expect } from "vitest";
import { buildManifest, peelLeg, verifyLegToken } from "../lib/courier";

describe("courier multi-stop manifests", () => {
	const legs = [
		{ stop: "Stop A", gate: "gate-1" },
		{ stop: "Stop B", gate: "gate-2" },
		{ stop: "Stop C", gate: "gate-3" },
	];

	it("builds a manifest token for leg 1", () => {
		const token = buildManifest(legs);
		expect(token).not.toBeNull();
		expect(token?.startsWith("VFXCUR1:")).toBe(true);
	});

	it("requires at least 2 legs", () => {
		expect(buildManifest([])).toBeNull();
		expect(buildManifest([{ stop: "only", gate: "g" }])).toBeNull();
	});

	it("peels each leg in sequence with the right gate, hiding later stops", () => {
		const token = buildManifest(legs)!;
		// Leg 1: must see Stop A, not B or C
		const p1 = peelLeg(token, "gate-1");
		expect(p1.layer).not.toBeNull();
		expect(p1.layer?.leg).toBe(1);
		expect(p1.layer?.stop).toBe("Stop A");
		expect(p1.layer?.total).toBe(3);
		// The leg-1 token body must NOT leak later stops in plaintext
		expect(token.includes("Stop B")).toBe(false);
		expect(token.includes("Stop C")).toBe(false);

		// Wrong gate: no next token revealed
		expect(peelLeg(token, "wrong").nextToken).toBeNull();

		// Leg 2
		const p2 = peelLeg(p1.nextToken!, "gate-2");
		expect(p2.layer?.leg).toBe(2);
		expect(p2.layer?.stop).toBe("Stop B");

		// Leg 3 (final)
		const p3 = peelLeg(p2.nextToken!, "gate-3");
		expect(p3.layer?.leg).toBe(3);
		expect(p3.layer?.stop).toBe("Stop C");
		expect(p3.nextToken).toBeNull(); // no next on final leg
	});

	it("wrong gate at any leg stops the chain", () => {
		const token = buildManifest(legs)!;
		const p1 = peelLeg(token, "gate-1");
		const p2 = peelLeg(p1.nextToken!, "wrong-gate");
		expect(p2.layer).not.toBeNull(); // we can decode the layer shape
		expect(p2.nextToken).toBeNull(); // but we can't peel further
	});

	it("handles malformed input defensively", () => {
		expect(peelLeg("garbage", "gate").layer).toBeNull();
		expect(peelLeg("VFXCUR1:not-json", "gate").layer).toBeNull();
		expect(verifyLegToken("nope")).toBe(false);
		expect(verifyLegToken(buildManifest(legs)!)).toBe(true);
	});

	it("manifests with the same id and legs are deterministic", () => {
		const t1 = buildManifest(legs, "fixed-id");
		const t2 = buildManifest(legs, "fixed-id");
		expect(t1).toBe(t2);
	});
});
