import { describe, it, expect, vi } from "vitest";
import {
	buildWitness,
	buildWitnessChain,
	verifyWitness,
	verifyWitnessChain,
	canonicalWitnessContent,
	hashWitness,
	encodeWitnessLedger,
	parseWitnessLedger,
	redactForPublic,
	zkProofForWitness,
	createEphemeralSigner,
	loadWitnessLedger,
	saveWitnessLedger,
	LEDGER_PREFIX,
	MAX_WITNESS_TEXT,
	type SignedWitness,
} from "../lib/witness";
import { GENESIS_HASH } from "../lib/dag";
import { verifySetMembership } from "../lib/zk";

// localStorage is not provided by this jsdom build — stub it like other tests.
const store: Record<string, string> = {};
const localStorageMock = {
	getItem: (key: string) => store[key] ?? null,
	setItem: (key: string, value: string) => {
		store[key] = value;
	},
	removeItem: (key: string) => {
		delete store[key];
	},
	clear: () => {
		for (const k of Object.keys(store)) delete store[k];
	},
};
vi.stubGlobal("localStorage", localStorageMock);

describe("canonicalWitnessContent / hashWitness", () => {
	it("serializes fields in the canonical order with iso3 as empty string", () => {
		const stmt = {
			id: "abc",
			text: "hello",
			ts: 42,
			prevHash: "0".repeat(64),
		};
		expect(canonicalWitnessContent(stmt)).toBe(
			'{"id":"abc","text":"hello","iso3":"","ts":42,"prevHash":"' +
				"0".repeat(64) +
				'"}',
		);
	});

	it("hashes the canonical content with SHA-256", async () => {
		const text = "witness one";
		const id = "wit-1";
		const ts = 1234;
		const prevHash = "0".repeat(64);
		const stmt = { id, text, ts, prevHash };
		const expected = await hashWitness(stmt);
		const digest = await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode(canonicalWitnessContent(stmt)),
		);
		const hex = Array.from(new Uint8Array(digest))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
		expect(expected).toBe(hex);
		expect(expected).toMatch(/^[0-9a-f]{64}$/);
	});
});

describe("buildWitness", () => {
	it("produces a deterministic hash for identical content", async () => {
		const input = {
			text: "deterministic",
			iso3: "SDN",
			ts: 1000,
			prevHash: "0".repeat(64),
		};
		const a = await buildWitness(input);
		expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
		// The same canonical content must hash to the same value, no matter
		// which object instance carries it.
		const manual = {
			id: a.id,
			text: a.text,
			iso3: a.iso3,
			ts: a.ts,
			prevHash: a.prevHash,
		};
		expect(await hashWitness(manual)).toBe(a.hash);
		expect(canonicalWitnessContent(manual)).toBe(canonicalWitnessContent(a));
	});

	it("builds an unsigned statement when no signFn is injected", async () => {
		const stmt = await buildWitness({ text: "anonymous witness", iso3: "SDN" });
		expect(stmt.signature).toBeUndefined();
		expect(stmt.signerPublicKey).toBeUndefined();
		expect(stmt.contentHash).toBeUndefined();
		expect(stmt.hash).toMatch(/^[0-9a-f]{64}$/);
		const v = await verifyWitness(stmt);
		expect(v.ok).toBe(true);
	});

	it("normalizes iso3 to uppercase and stores it", async () => {
		const stmt = await buildWitness({ text: "lowercase iso3", iso3: "sdn" });
		expect(stmt.iso3).toBe("SDN");
	});

	it("rejects empty text, over-long text, and malformed iso3", async () => {
		await expect(buildWitness({ text: "   " })).rejects.toThrow(
			"must not be empty",
		);
		await expect(
			buildWitness({ text: "x".repeat(MAX_WITNESS_TEXT + 1) }),
		).rejects.toThrow("exceeds");
		await expect(buildWitness({ text: "ok", iso3: "US" })).rejects.toThrow(
			"3-letter",
		);
		await expect(buildWitness({ text: "ok", iso3: "US1" })).rejects.toThrow(
			"3-letter",
		);
	});

	it("chains to GENESIS_HASH by default", async () => {
		const stmt = await buildWitness({ text: "genesis" });
		expect(stmt.prevHash).toBe(GENESIS_HASH);
	});
});

describe("signFn path", () => {
	it("produces a verifiable signature, anonymous by design", async () => {
		const signFn = await createEphemeralSigner();
		const stmt = await buildWitness(
			{ text: "signed witness", iso3: "YEM" },
			signFn,
		);
		expect(stmt.signature).toBeDefined();
		expect(stmt.signerPublicKey).toBeDefined();
		expect(stmt.contentHash).toBe(stmt.hash);

		const v = await verifyWitness(stmt);
		expect(v.ok).toBe(true);

		const unsigned = await verifyWitness({
			...stmt,
			signature: undefined,
			signerPublicKey: undefined,
			contentHash: undefined,
		});
		expect(unsigned.ok).toBe(true);
	});

	it("fails verification when the signature is tampered", async () => {
		const signFn = await createEphemeralSigner();
		const stmt = await buildWitness({ text: "i said this" }, signFn);
		// Deterministic corruption: flip the last char so the signature is
		// guaranteed to change regardless of its base64url content (a plain
		// .replace(/A/,"B") no-ops when the signature contains no "A").
		const sig = stmt.signature!;
		const last = sig.charAt(sig.length - 1);
		const flip = last === "A" ? "B" : "A";
		const bad = { ...stmt, signature: sig.slice(0, -1) + flip };
		const v = await verifyWitness(bad);
		expect(v.ok).toBe(false);
		expect(v.reason).toMatch(/signature/i);
	});

	it("fails verification when contentHash is tampered", async () => {
		const signFn = await createEphemeralSigner();
		const stmt = await buildWitness({ text: "hash pinned" }, signFn);
		const bad = { ...stmt, contentHash: "0".repeat(64) };
		const v = await verifyWitness(bad);
		expect(v.ok).toBe(false);
		expect(v.reason).toMatch(/contentHash/i);
	});

	it("fails verification when a public key is present but signature is missing", async () => {
		const signFn = await createEphemeralSigner();
		const stmt = await buildWitness({ text: "half signed" }, signFn);
		const bad = { ...stmt, signature: undefined };
		const v = await verifyWitness(bad);
		expect(v.ok).toBe(false);
		expect(v.reason).toMatch(/signature missing/i);
	});
});

describe("verifyWitness", () => {
	it("rejects a tampered statement text", async () => {
		const stmt = await buildWitness({ text: "the truth" });
		const tampered = { ...stmt, text: "the lie" };
		const v = await verifyWitness(tampered);
		expect(v.ok).toBe(false);
		expect(v.reason).toMatch(/tampered/i);
	});

	it("rejects a tampered iso3", async () => {
		const stmt = await buildWitness({ text: "country matters", iso3: "SDN" });
		const tampered = { ...stmt, iso3: "USA" };
		const v = await verifyWitness(tampered);
		expect(v.ok).toBe(false);
	});

	it("rejects a malformed prevHash", async () => {
		const stmt = await buildWitness({ text: "bad link" });
		const tampered = { ...stmt, prevHash: "zz".repeat(32) };
		const v = await verifyWitness(tampered);
		expect(v.ok).toBe(false);
		expect(v.reason).toMatch(/prevHash/i);
	});

	it("accepts GENESIS_HASH as the first prevHash", async () => {
		const stmt = await buildWitness({ text: "first entry" });
		expect(stmt.prevHash).toBe(GENESIS_HASH);
		const v = await verifyWitness(stmt);
		expect(v.ok).toBe(true);
	});
});

describe("buildWitnessChain / verifyWitnessChain", () => {
	it("sorts by ts and links each statement to its predecessor", async () => {
		const late = await buildWitness({ text: "late", ts: 3000 });
		const early = await buildWitness({ text: "early", ts: 1000 });
		const middle = await buildWitness({ text: "middle", ts: 2000 });

		const chain = await buildWitnessChain([late, early, middle]);
		expect(chain.map((s) => s.text)).toEqual(["early", "middle", "late"]);
		expect(chain[0].prevHash).toBe(GENESIS_HASH);
		expect(chain[1].prevHash).toBe(chain[0].hash);
		expect(chain[2].prevHash).toBe(chain[1].hash);

		const res = await verifyWitnessChain(chain);
		expect(res.rootOk).toBe(true);
		expect(res.root).toBe(chain[2].hash);
		expect(res.links.every((l) => l.ok)).toBe(true);
		expect(res.links).toHaveLength(3);
	});

	it("breaks exactly the tampered link and the root", async () => {
		const a = await buildWitness({ text: "a", ts: 1000 });
		const b = await buildWitness({ text: "b", ts: 2000 });
		const c = await buildWitness({ text: "c", ts: 3000 });
		const chain = await buildWitnessChain([a, b, c]);

		const tampered = [...chain];
		tampered[1] = { ...tampered[1], text: tampered[1].text + " TAMPERED" };

		const res = await verifyWitnessChain(tampered);
		expect(res.rootOk).toBe(false);
		expect(res.links.map((l) => l.ok)).toEqual([true, false, true]);
		expect(res.links[1].ok).toBe(false);
		expect(res.links[1].reason).toMatch(/tampered/i);
	});

	it("detects a broken prevHash link in the middle", async () => {
		const a = await buildWitness({ text: "a", ts: 1000 });
		const b = await buildWitness({ text: "b", ts: 2000 });
		const c = await buildWitness({ text: "c", ts: 3000 });
		const chain = await buildWitnessChain([a, b, c]);

		// Re-link b to a forged predecessor AND recompute its hash — a real
		// attacker would do this so only the linkage can catch them.
		const forgedPrev = "f".repeat(64);
		const forged = {
			...chain[1],
			prevHash: forgedPrev,
			hash: await hashWitness({
				id: chain[1].id,
				text: chain[1].text,
				iso3: chain[1].iso3,
				ts: chain[1].ts,
				prevHash: forgedPrev,
			}),
		};
		const tampered = [...chain];
		tampered[1] = forged;

		const res = await verifyWitnessChain(tampered);
		expect(res.rootOk).toBe(false);
		// b fails on its own content (forged prevHash is part of the content),
		// and c fails on linkage — the break propagates forward.
		expect(res.links.map((l) => l.ok)).toEqual([true, false, false]);
		expect(res.links[1].reason).toMatch(/prevHash/i);
		expect(res.links[2].reason).toMatch(/prevHash/i);
	});

	it("treats an empty chain as valid with a genesis root", async () => {
		const res = await verifyWitnessChain([]);
		expect(res.rootOk).toBe(true);
		expect(res.root).toBe(GENESIS_HASH);
		expect(res.links).toHaveLength(0);
	});

	it("is idempotent — re-building preserves statements, hashes and signatures", async () => {
		const signFn = await createEphemeralSigner();
		const a = await buildWitness({ text: "a", ts: 1000 });
		const b = await buildWitness({ text: "b", ts: 2000 }, signFn);
		const c = await buildWitness({ text: "c", ts: 3000 });

		const chain = await buildWitnessChain([c, a, b], signFn);
		const rebuilt = await buildWitnessChain(chain);

		expect(rebuilt).toEqual(chain);
		expect(rebuilt[1].signature).toBeDefined();
		for (const s of rebuilt) {
			const v = await verifyWitness(s);
			expect(v.ok).toBe(true);
		}
		const res = await verifyWitnessChain(rebuilt);
		expect(res.rootOk).toBe(true);
	});

	it("drops stale signatures when re-linking changes content", async () => {
		const signFn = await createEphemeralSigner();
		const a = await buildWitness({ text: "a", ts: 1000 }, signFn);
		const b = await buildWitness({ text: "b", ts: 2000 }, signFn);

		// Rebuild with b now first — b's content (prevHash) changes, so its
		// old signature must not survive.
		const chain = await buildWitnessChain([a, b], signFn);
		const res = await verifyWitnessChain(chain);
		expect(res.rootOk).toBe(true);
		for (const s of chain) expect(s.signature).toBeDefined();
	});
});

describe("encode / parse ledger", () => {
	it("round-trips a chain including signatures", async () => {
		const signFn = await createEphemeralSigner();
		const a = await buildWitness(
			{ text: "round", iso3: "SDN", ts: 1000 },
			signFn,
		);
		const b = await buildWitness({ text: "trip", ts: 2000 });
		const chain = await buildWitnessChain([a, b]);

		const token = encodeWitnessLedger(chain);
		expect(token.startsWith(LEDGER_PREFIX)).toBe(true);
		const parsed = parseWitnessLedger(token);
		expect(parsed).toEqual(chain);

		for (const s of parsed) {
			const v = await verifyWitness(s);
			expect(v.ok).toBe(true);
		}
	});

	it("rejects garbage tokens", () => {
		expect(() => parseWitnessLedger("hello")).toThrow(/prefix/i);
		expect(() =>
			parseWitnessLedger(LEDGER_PREFIX + "!!!not-base64!!!"),
		).toThrow(/base64/i);
		expect(() => parseWitnessLedger(LEDGER_PREFIX + "e30")).toThrow(/array/i); // "{}"
		const junkB64 = Buffer.from("not-json", "utf8").toString("base64url");
		expect(() => parseWitnessLedger(LEDGER_PREFIX + junkB64)).toThrow(/JSON/i);
	});

	it("rejects entries with missing required fields", () => {
		const json = JSON.stringify([{ id: "x", text: "y" }]);
		const b64 = Buffer.from(json, "utf8").toString("base64url");
		expect(() => parseWitnessLedger(LEDGER_PREFIX + b64)).toThrow(
			/required fields/i,
		);
	});

	it("loads and saves the ledger via localStorage", async () => {
		const chain = await buildWitnessChain([
			await buildWitness({ text: "persist one", ts: 1000 }),
			await buildWitness({ text: "persist two", ts: 2000 }),
		]);
		expect(saveWitnessLedger(chain)).toBe(true);
		expect(loadWitnessLedger()).toEqual(chain);
		expect(loadWitnessLedger()).not.toBe(chain);
	});

	it("returns an empty ledger when storage is empty or corrupt", () => {
		localStorage.removeItem("vfx-witness-ledger");
		expect(loadWitnessLedger()).toEqual([]);
		localStorage.setItem("vfx-witness-ledger", "not-json");
		expect(loadWitnessLedger()).toEqual([]);
	});
});

describe("privacy helpers", () => {
	it("redactForPublic strips nothing — hashes are public", async () => {
		const signFn = await createEphemeralSigner();
		const stmt = await buildWitness(
			{ text: "public by design", iso3: "HTI" },
			signFn,
		);
		const redacted = redactForPublic(stmt) as SignedWitness;
		expect(redacted).toEqual(stmt);
		expect(redacted).not.toBe(stmt);
		const v = await verifyWitness(redacted);
		expect(v.ok).toBe(true);
	});

	it("produces a ZK blur proof that hides the member", async () => {
		const set = ["SDN", "YEM", "AFG", "SOM", "HTI", "SYR"];
		const stmt = await buildWitness({ text: "hunger somewhere", iso3: "SDN" });
		const { proof, verified } = await zkProofForWitness(
			stmt,
			"hunger_hotspot",
			set,
		);
		expect(verified).toBe(true);
		expect(proof.commitment).toHaveLength(64);
		expect(proof.challenge).toHaveLength(64);
		expect(proof.response).toHaveLength(64);
		expect(await verifySetMembership(proof, set)).toBe(true);
		expect(await verifySetMembership(proof, ["USA", "CAN", "MEX"])).toBe(false);
	});

	it("refuses to blur statements without a country or outside the set", async () => {
		const noCountry = await buildWitness({ text: "no country" });
		await expect(
			zkProofForWitness(noCountry, "claim", ["SDN"]),
		).rejects.toThrow(/no iso3/i);

		const usa = await buildWitness({ text: "usa", iso3: "USA" });
		await expect(
			zkProofForWitness(usa, "claim", ["SDN", "YEM", "AFG"]),
		).rejects.toThrow(/not in the valid set/i);
	});
});

describe("re-verification idempotence", () => {
	it("reports the same result on every pass", async () => {
		const chain = await buildWitnessChain([
			await buildWitness({ text: "x", ts: 1000 }),
			await buildWitness({ text: "y", ts: 2000 }),
		]);
		const first = await verifyWitnessChain(chain);
		const second = await verifyWitnessChain(chain);
		expect(second).toEqual(first);
		const s = chain[0];
		expect(await verifyWitness(s)).toEqual(await verifyWitness(s));
	});

	it("verifies an encoded→parsed chain identically", async () => {
		const chain = await buildWitnessChain([
			await buildWitness({ text: "encoded", iso3: "SOM", ts: 1000 }),
			await buildWitness({ text: "and parsed", ts: 2000 }),
		]);
		const parsed = parseWitnessLedger(encodeWitnessLedger(chain));
		expect(await verifyWitnessChain(parsed)).toEqual(
			await verifyWitnessChain(chain),
		);
	});
});
