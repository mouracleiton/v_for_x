/**
 * Phase 25 D — Institutional / money-without-accounts
 *   - Court bundle exporter (lib/court-bundle.ts)
 *   - Reparations / seized-asset tracker (lib/reparations.ts)
 *   - FOIA / records-request generator (lib/foia-generator.ts)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderCourtBundle, countBundleEvidence } from "@/lib/court-bundle";
import {
	buildReparationsClaim,
	verifyReparationsClaim,
	encodeReparationsClaim,
	parseReparationsClaim,
	appendReparationsClaim,
	loadReparationsLedger,
	canonicalReparationsClaim,
	hashReparationsClaim,
	sumEstimatedValue,
	REPARATIONS_PREFIX,
} from "@/lib/reparations";
import {
	pickTemplate,
	fillBody,
	generateFoiaRequest,
	listTemplates,
	isComplete,
	loadFoiaRegistry,
} from "@/lib/foia-generator";
import foiaData from "@/data/foia-templates.json";

/* ═══════════════════════════════════════════════════════════════
   Court bundle exporter
   ═══════════════════════════════════════════════════════════════ */
describe("court bundle exporter", () => {
	it("renders a self-contained HTML document with the caption", () => {
		const html = renderCourtBundle({ caption: "Re: events in SDN" });
		expect(html).toContain("<!doctype html>");
		expect(html).toContain("Court Bundle");
		expect(html).toContain("Re: events in SDN");
		// Empty bundle shows the None marker, not a table.
		expect(html).toContain("<em>None.</em>");
	});

	it("includes witness + fulfillment rows when provided", () => {
		const html = renderCourtBundle({
			caption: "Test",
			witness: [
				{
					hash: "a".repeat(64),
					handle: "lex",
					text: "I saw it",
					ts: 1,
					prevHash: undefined,
					signature: "sig",
				},
			],
			fulfillments: [
				{
					id: "f1",
					matchId: "m1",
					status: "delivered",
					note: "handoff",
					ts: 2,
					signature: "sig2",
				},
			],
		});
		expect(html).toContain("I saw it");
		expect(html).toContain("handoff");
		expect(html).toContain("Witness Statements (1)");
		expect(html).toContain("Fulfillment Receipts (1)");
	});

	it("escapes HTML in user content (no injection)", () => {
		const html = renderCourtBundle({
			caption: "x",
			witness: [{ hash: "h", text: "<script>alert(1)</script>", ts: 1 }],
		});
		expect(html).not.toContain("<script>alert(1)</script>");
		expect(html).toContain("&lt;script&gt;");
	});

	it("shows empty markers when no evidence", () => {
		const html = renderCourtBundle({ caption: "Empty" });
		expect(html).toContain("<em>None.</em>");
	});

	it("countBundleEvidence sums all sections", () => {
		expect(
			countBundleEvidence({
				caption: "c",
				witness: [{ hash: "h", text: "t", ts: 1 }],
				fulfillments: [{ id: "f", ts: 1 }],
				errata: [{ kind: "correction", ref: "r", summary: "s", ts: 1 }],
			}),
		).toBe(3);
	});
});

/* ═══════════════════════════════════════════════════════════════
   Reparations claims ledger
   ═══════════════════════════════════════════════════════════════ */
describe("reparations claims ledger", () => {
	function makeSigner() {
		return async (content: string) => ({
			publicKey: `PUB-${content.slice(0, 4)}`,
			signature: `SIG-${content.slice(0, 8)}`,
		});
	}
	function makeVerifier(ok: boolean) {
		return async (_canonical: string, _pub: string, _sig: string) => ok;
	}

	it("buildReparationsClaim signs + hashes the claim", async () => {
		const signed = await buildReparationsClaim(
			{
				claimant: "lex",
				iso3: "sdn",
				assetClass: "land",
				description: "Seized 10ha",
				estimatedValueUsd: 5000,
				occurredAt: 1_000,
				filedAt: 2_000,
			},
			makeSigner(),
		);
		expect(signed.id).toBeTruthy();
		expect(signed.hash).toMatch(/^[0-9a-f]{64}$/);
		expect(signed.publicKey).toContain("PUB-");
		expect(signed.signature).toContain("SIG-");
	});

	it("verifyReparationsClaim passes on consistent claim + good signature", async () => {
		const signed = await buildReparationsClaim(
			{
				claimant: "a",
				iso3: "usa",
				assetClass: "funds",
				description: "d",
				occurredAt: 1,
				filedAt: 2,
			},
			makeSigner(),
		);
		const res = await verifyReparationsClaim(signed, makeVerifier(true));
		expect(res.valid).toBe(true);
		expect(res.claim?.id).toBe(signed.id);
	});

	it("verifyReparationsClaim fails on hash tamper", async () => {
		const signed = await buildReparationsClaim(
			{
				claimant: "a",
				iso3: "usa",
				assetClass: "funds",
				description: "d",
				occurredAt: 1,
				filedAt: 2,
			},
			makeSigner(),
		);
		const tampered = { ...signed, description: "CHANGED" };
		const res = await verifyReparationsClaim(tampered, makeVerifier(true));
		expect(res.valid).toBe(false);
		expect(res.reason).toContain("hash mismatch");
	});

	it("verifyReparationsClaim fails on bad signature", async () => {
		const signed = await buildReparationsClaim(
			{
				claimant: "a",
				iso3: "usa",
				assetClass: "funds",
				description: "d",
				occurredAt: 1,
				filedAt: 2,
			},
			makeSigner(),
		);
		const res = await verifyReparationsClaim(signed, makeVerifier(false));
		expect(res.valid).toBe(false);
		expect(res.reason).toContain("signature");
	});

	it("VFXRPR1 token round-trips", async () => {
		const signed = await buildReparationsClaim(
			{
				claimant: "a",
				iso3: "usa",
				assetClass: "funds",
				description: "d",
				occurredAt: 1,
				filedAt: 2,
			},
			makeSigner(),
		);
		const token = encodeReparationsClaim(signed);
		expect(token.startsWith(REPARATIONS_PREFIX)).toBe(true);
		const parsed = parseReparationsClaim(token);
		expect(parsed?.id).toBe(signed.id);
		expect(parseReparationsClaim("not a token")).toBeNull();
	});

	it("appendReparationsClaim de-dupes by hash", async () => {
		const signed = await buildReparationsClaim(
			{
				claimant: "a",
				iso3: "usa",
				assetClass: "funds",
				description: "d",
				occurredAt: 1,
				filedAt: 2,
			},
			makeSigner(),
		);
		appendReparationsClaim(signed);
		appendReparationsClaim(signed); // dup
		expect(loadReparationsLedger().length).toBe(1);
	});

	it("sumEstimatedValue aggregates", () => {
		const claims = [
			{
				id: "1",
				claimant: "a",
				iso3: "USA",
				assetClass: "funds",
				description: "d",
				occurredAt: 1,
				filedAt: 2,
				hash: "h1",
				publicKey: "p",
				signature: "s",
				estimatedValueUsd: 100,
			} as never,
			{
				id: "2",
				claimant: "a",
				iso3: "USA",
				assetClass: "land",
				description: "d",
				occurredAt: 1,
				filedAt: 2,
				hash: "h2",
				publicKey: "p",
				signature: "s",
				estimatedValueUsd: 250,
			} as never,
		];
		expect(sumEstimatedValue(claims)).toBe(350);
	});

	it("canonicalReparationsClaim is stable", async () => {
		const c = {
			id: "x",
			claimant: "a",
			iso3: "USA",
			assetClass: "funds" as const,
			description: "d",
			occurredAt: 1,
			filedAt: 2,
		};
		expect(canonicalReparationsClaim(c)).toBe(canonicalReparationsClaim(c));
		expect(await hashReparationsClaim(c)).toBe(await hashReparationsClaim(c));
	});
});

/* ═══════════════════════════════════════════════════════════════
   FOIA generator
   ═══════════════════════════════════════════════════════════════ */
describe("FOIA / records-request generator", () => {
	beforeEach(() => {
		loadFoiaRegistry(foiaData);
	});

	it("loads the curated registry from data/foia-templates.json", () => {
		expect(listTemplates().length).toBeGreaterThanOrEqual(4);
		expect(listTemplates().some((t) => t.id === "us-federal-foia")).toBe(true);
	});

	it("pickTemplate prefers an exact jurisdiction match, else generic", () => {
		expect(pickTemplate("USA").id).toBe("us-federal-foia");
		expect(pickTemplate("BRA").id).toBe("br-lai");
		expect(pickTemplate("ZZZ").id).toBe("generic");
	});

	it("fillBody replaces {{placeholders}}", () => {
		expect(fillBody("Hello {{name}}!", { name: "world" })).toBe("Hello world!");
		// missing value leaves the placeholder intact
		expect(fillBody("Hello {{name}}!", {})).toBe("Hello {{name}}!");
	});

	it("generateFoiaRequest fills a complete request", () => {
		const req = generateFoiaRequest("USA", {
			topic: "border records",
			iso3: "MEX",
		});
		expect(req.body).toContain("border records");
		expect(req.body).toContain("MEX");
		expect(req.templateId).toBe("us-federal-foia");
	});

	it("isComplete true only when all placeholders filled", () => {
		const t = pickTemplate("USA");
		expect(isComplete({ topic: "x" }, t.placeholders)).toBe(false);
		expect(isComplete({ topic: "x", iso3: "MEX" }, t.placeholders)).toBe(true);
	});
});
