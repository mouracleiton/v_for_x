/**
 * Phase 25 F — Adversarial realism batch
 *   - Memory-hole detector (lib/memory-hole.ts)
 *   - Impostor-handle watchlist (lib/impostor-watchlist.ts)
 *   - Device-search drill (lib/device-search-drill.ts)
 *   - Compartmented crash reports (lib/crash-reports.ts)
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
	detectMemoryHoles,
	checkMirrorAgainstSeed,
	memoryHoleBannerText,
	type ContentHashEntry,
} from "@/lib/memory-hole";
import {
	recordObservation,
	evaluate,
	observe,
	clearWatchlist,
	impostorBannerText,
} from "@/lib/impostor-watchlist";
import {
	scoreDeviceSearchDrill,
	drillBannerText,
} from "@/lib/device-search-drill";
import {
	scrubMessage,
	classifyCrash,
	recordCrash,
	loadCrashReports,
	clearCrashReports,
	crashSummary,
} from "@/lib/crash-reports";

/* ═══════════════════════════════════════════════════════════════
   Memory-hole detector
   ═══════════════════════════════════════════════════════════════ */
describe("memory-hole detector", () => {
	const seed: ContentHashEntry[] = [
		{ key: "AFG", hash: "aaa", ts: 1 },
		{ key: "BRA", hash: "bbb", ts: 1 },
		{ key: "USA", hash: "ccc", ts: 1 },
	];

	it("clean when current matches seed", () => {
		const r = detectMemoryHoles(seed, [...seed]);
		expect(r.verdict).toBe("clean");
		expect(r.missing).toEqual([]);
		expect(r.changed).toEqual([]);
	});

	it("memory-hole when a seed key is absent from current", () => {
		const current = [seed[0], seed[2]]; // drop BRA
		const r = detectMemoryHoles(seed, current);
		expect(r.verdict).toBe("memory-hole");
		expect(r.missing).toEqual(["BRA"]);
		expect(memoryHoleBannerText(r)).toContain("BRA");
	});

	it("changed when a hash drifts", () => {
		const current = [...seed];
		current[1] = { key: "BRA", hash: "CHANGED", ts: 2 };
		const r = detectMemoryHoles(seed, current);
		expect(r.verdict).toBe("changed");
		expect(r.changed).toEqual(["BRA"]);
	});

	it("returns unknown when fetcher fails", async () => {
		const r = await checkMirrorAgainstSeed(async () => {
			throw new Error("offline");
		}, seed);
		expect(r.verdict).toBe("unknown");
		expect(memoryHoleBannerText(r)).toContain("offline");
	});

	it("returns unknown when fetcher returns null/empty", async () => {
		const r = await checkMirrorAgainstSeed(async () => null, seed);
		expect(r.verdict).toBe("unknown");
	});
});

/* ═══════════════════════════════════════════════════════════════
   Impostor-handle watchlist
   ═══════════════════════════════════════════════════════════════ */
describe("impostor-handle watchlist", () => {
	beforeEach(() => {
		clearWatchlist();
	});

	it("new-handle verdict on first observation", () => {
		const r = evaluate({}, "lex-mira", "KEY-A");
		expect(r.verdict).toBe("new-handle");
	});

	it("clean when the same canonical key repeats", () => {
		let data = recordObservation({}, "lex-mira", "KEY-A", 100);
		data = recordObservation(data, "lex-mira", "KEY-A", 200);
		expect(evaluate(data, "lex-mira", "KEY-A").verdict).toBe("clean");
	});

	it("impostor-suspected when a never-before-seen key appears", () => {
		const data = recordObservation({}, "lex-mira", "KEY-A", 100);
		// observe a brand-new key without recording it first
		const report = evaluate(data, "lex-mira", "KEY-B");
		expect(report.verdict).toBe("impostor-suspected");
		expect(report.findings[0].canonicalKey).toBe("KEY-A");
		expect(report.findings[0].suspectKey).toBe("KEY-B");
	});

	it("key-rotated when a previously-seen alternate key is reused", () => {
		let data = recordObservation({}, "lex-mira", "KEY-A", 100);
		data = recordObservation(data, "lex-mira", "KEY-B", 200);
		// KEY-B was seen before, canonical is still KEY-A
		const report = evaluate(data, "lex-mira", "KEY-B");
		expect(report.verdict).toBe("key-rotated");
	});

	it("observe() persists and reports (integration, localStorage)", () => {
		// First observe() of KEY-A: no history yet → new-handle (first contact).
		const { report: first } = observe("lex-mira", "KEY-A");
		expect(first.verdict).toBe("new-handle");
		// Same key again: KEY-A is now canonical → clean.
		const { report: second } = observe("lex-mira", "KEY-A");
		expect(second.verdict).toBe("clean");
		// A different key the handle never used → impostor-suspected.
		const { report: third } = observe("lex-mira", "KEY-B");
		expect(third.verdict).toBe("impostor-suspected");
	});

	it("banner copy for impostor mentions re-verify", () => {
		const report = evaluate(
			{
				"lex-mira": [
					{ handle: "lex-mira", publicKey: "KEY-A", firstSeen: 1, lastSeen: 1 },
				],
			},
			"lex-mira",
			"KEY-B",
		);
		expect(impostorBannerText(report, "lex-mira")).toContain("IMPOSTOR");
		expect(impostorBannerText(report, "lex-mira")).toContain("re-verify");
	});
});

/* ═══════════════════════════════════════════════════════════════
   Device-search drill
   ═══════════════════════════════════════════════════════════════ */
describe("device-search drill", () => {
	it("perfect score when all sensitive wiped + decoys present + within budget", () => {
		const store: Record<string, string> = {
			decoy1: "real-looking",
			decoy2: "data",
		};
		const r = scoreDeviceSearchDrill({
			sensitiveKeys: ["id", "keys", "journal"],
			decoyKeys: ["decoy1", "decoy2"],
			readKey: (k) => store[k] ?? null,
			elapsedMs: 30_000,
			budgetMs: 60_000,
		});
		expect(r.withinBudget).toBe(true);
		expect(r.wipeCoverage).toBe(1);
		expect(r.decoyPlausibility).toBe(1);
		expect(r.score).toBe(100);
		expect(r.missedKeys).toEqual([]);
		expect(drillBannerText(r)).toContain("PASSED");
	});

	it("fails when a sensitive key survives", () => {
		const store: Record<string, string> = { id: "LEAKED", decoy1: "ok" };
		const r = scoreDeviceSearchDrill({
			sensitiveKeys: ["id", "keys"],
			decoyKeys: ["decoy1"],
			readKey: (k) => store[k] ?? null,
			elapsedMs: 10_000,
		});
		expect(r.missedKeys).toEqual(["id"]);
		expect(r.wipeCoverage).toBe(0.5);
		expect(drillBannerText(r)).toContain("FAILED");
	});

	it("penalizes over-budget runs even when wipe completed", () => {
		const r = scoreDeviceSearchDrill({
			sensitiveKeys: ["a"],
			decoyKeys: [],
			readKey: () => null,
			elapsedMs: 90_000,
			budgetMs: 60_000,
		});
		expect(r.withinBudget).toBe(false);
		expect(r.wipeCoverage).toBe(1);
		// wipeCoverage*66 = 66, decoy*34 = 0, timePenalty = 0.5*20 = 10 → 56
		expect(r.score).toBeLessThan(66);
		expect(drillBannerText(r)).toContain("slow");
	});

	it("decoy plausibility is 0 when decoy keys empty", () => {
		const r = scoreDeviceSearchDrill({
			sensitiveKeys: ["a"],
			decoyKeys: ["d1"],
			readKey: () => null,
			elapsedMs: 10_000,
		});
		expect(r.decoyPlausibility).toBe(0);
	});
});

/* ═══════════════════════════════════════════════════════════════
   Compartmented crash reports
   ═══════════════════════════════════════════════════════════════ */
describe("compartmented crash reports", () => {
	beforeEach(() => {
		clearCrashReports();
	});

	it("scrubs keys, hashes, emails, and tokens", () => {
		const raw =
			"sign failed for key abc123def456... email a@b.com token VFXID1:secret123";
		const scrubbed = scrubMessage(raw);
		expect(scrubbed).not.toContain("a@b.com");
		expect(scrubbed).not.toContain("secret123");
		expect(scrubbed).toContain("[EMAIL]");
		expect(scrubbed).toContain("[TOKEN]");
	});

	it("classifies errors into compartments", () => {
		expect(classifyCrash("signature verification failed")).toBe("crypto");
		expect(classifyCrash("IndexedDB quota exceeded")).toBe("storage");
		expect(classifyCrash("WebRTC peer disconnected")).toBe("mesh");
		expect(classifyCrash("duress persona not found")).toBe("identity");
		expect(classifyCrash("failed to render component")).toBe("ui");
		expect(classifyCrash("backbone json parse error")).toBe("data");
		expect(classifyCrash("something else")).toBe("unknown");
	});

	it("records + persists a scrubbed crash report", () => {
		const report = recordCrash(
			new Error(
				"signature verify failed for deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdead",
			),
		);
		expect(report.category).toBe("crypto");
		expect(report.message).not.toContain("deadbeef");
		const all = loadCrashReports();
		expect(all.length).toBe(1);
		expect(all[0].id).toBe(report.id);
	});

	it("crashSummary tallies by category", () => {
		recordCrash("sign failed");
		recordCrash("sign failed again");
		recordCrash("IndexedDB full");
		const summary = crashSummary(loadCrashReports());
		expect(summary.crypto).toBe(2);
		expect(summary.storage).toBe(1);
	});

	it("clearCrashReports empties the store", () => {
		recordCrash("oops");
		clearCrashReports();
		expect(loadCrashReports()).toEqual([]);
	});
});
