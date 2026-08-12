import { describe, it, expect } from "vitest";
import { generateBroadcastToken, type Submission } from "../lib/submission";

const base: Submission = {
	id: "SUB-001",
	ts: 1700000000000,
	country: "SDN",
	category: "war_crime",
	title: "Aid convoy blockade documented",
	description: "desc",
	evidence: [],
	encrypted: false,
	status: "queued",
	riskLevel: "high",
};

describe("submission", () => {
	// Decode the VFX-DOSSIER- payload safely; failures surface a clear message.
	function decodePayload(tok: string): Record<string, unknown> {
		const b64 = tok.slice("VFX-DOSSIER-".length);
		let json: string;
		try {
			json = atob(b64);
		} catch (e) {
			throw new Error(
				`token payload is not valid base64: ${e instanceof Error ? e.message : e}`,
			);
		}
		try {
			return JSON.parse(json) as Record<string, unknown>;
		} catch (e) {
			throw new Error(
				`token payload is not valid JSON: ${e instanceof Error ? e.message : e}`,
			);
		}
	}

	it("generateBroadcastToken encodes id + country + category + title", () => {
		const tok = generateBroadcastToken(base);
		expect(tok.startsWith("VFX-DOSSIER-")).toBe(true);
		const payload = decodePayload(tok);
		expect(payload.id).toBe("SUB-001");
		expect(payload.c).toBe("SDN");
		expect(payload.k).toBe("war_crime");
		expect(payload.t).toBe("Aid convoy blockade documented");
		expect(payload.s).toBe(base.ts);
		expect(payload.sig).toBeNull(); // no signature on base
	});

	it("generateBroadcastToken truncates the title to 80 chars", () => {
		const long = "x".repeat(200);
		const tok = generateBroadcastToken({ ...base, title: long });
		const t = decodePayload(tok).t as string;
		expect(t.length).toBe(80);
		expect(long.startsWith(t)).toBe(true);
	});

	it("generateBroadcastToken includes the signature prefix when signed", () => {
		const tok = generateBroadcastToken({
			...base,
			signature: "0123456789abcdefSIGTAIL",
		});
		expect(decodePayload(tok).sig).toBe("0123456789abcdef"); // first 16 chars
	});

	it("generateBroadcastToken is deterministic for the same input", () => {
		expect(generateBroadcastToken(base)).toBe(generateBroadcastToken(base));
	});

	it("submission category + riskLevel cover the expected enums", () => {
		const cats = [
			"war_crime",
			"corruption",
			"human_rights",
			"environmental",
			"other",
		];
		const risks = ["low", "medium", "high", "critical"];
		for (const c of cats) {
			const tok = generateBroadcastToken({
				...base,
				category: c as Submission["category"],
			});
			expect(decodePayload(tok).k).toBe(c);
		}
		for (const r of risks) {
			// riskLevel isn't in the token payload; just assert the type compiles.
			const _sub: Submission = {
				...base,
				riskLevel: r as Submission["riskLevel"],
			};
			expect(_sub.riskLevel).toBe(r);
		}
	});
});
