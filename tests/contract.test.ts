/**
 * V FOR X — Contract tests: data spine ↔ api/v1 ↔ lib readers (todo-046)
 *
 * `api/v1/*.json` is generated at build time from `data/world_backbone.json`
 * (see scripts/generate_api.py). `out/` is gitignored and api/v1 is empty in
 * a fresh clone, so this contract test asserts against the SOURCE OF TRUTH
 * (`data/world_backbone.json`) — the exact shape that:
 *   - generate_api.py reads, and
 *   - every lib reader (metrics, dossiers, forecast, domino, oracle) consumes.
 *
 * If the backbone schema drifts, generate_api.py silently produces broken JSON
 * and half the libs break at runtime. This test fails closed on that drift.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BACKBONE_PATH = join(process.cwd(), "data", "world_backbone.json");

// Reading + parsing a known fixture: if it's missing or malformed the test
// must fail loud with a clear message. Wrapped so the failure is explicit
// rather than a raw node:fs / JSON.parse stack trace.
function loadBackbone(): {
	metadata?: Record<string, unknown>;
	countries?: unknown[];
} {
	let raw: string;
	try {
		raw = readFileSync(BACKBONE_PATH, "utf-8");
	} catch (e) {
		throw new Error(
			`contract test could not read data/world_backbone.json: ${e instanceof Error ? e.message : e}`,
		);
	}
	try {
		return JSON.parse(raw) as {
			metadata?: Record<string, unknown>;
			countries?: unknown[];
		};
	} catch (e) {
		throw new Error(
			`contract test could not parse data/world_backbone.json as JSON: ${e instanceof Error ? e.message : e}`,
		);
	}
}

const backbone = loadBackbone();

/** A backbone country row, typed for the fields libs actually read. */
interface BackboneCountry {
	iso3?: string;
	iso2?: string;
	region?: string;
	subregion?: string;
	un_m49?: string | number;
	name_en?: string;
	is_hotspot?: boolean;
	is_un_member?: boolean;
	hotspot_score?: number;
	// Dimensions are top-level keys, not nested under a `metrics` object:
	// hunger, conflict, health, demographics, economy, climate, etc.
	[k: string]: unknown;
}

const countries = (backbone.countries ?? []) as BackboneCountry[];

describe("backbone ↔ api/v1 ↔ lib contract", () => {
	it("data/world_backbone.json parses as the expected envelope", () => {
		expect(backbone).toHaveProperty("metadata");
		expect(backbone).toHaveProperty("countries");
		expect(Array.isArray(backbone.countries)).toBe(true);
	});

	it("metadata declares schema_version and total_countries", () => {
		const meta = backbone.metadata ?? {};
		expect(typeof meta.schema_version).toBe("string");
		expect(String(meta.schema_version).length).toBeGreaterThan(0);
		expect(typeof meta.total_countries).toBe("number");
	});

	it("metadata.total_countries matches the actual countries[] length", () => {
		expect(backbone.metadata?.total_countries).toBe(countries.length);
	});

	it("every country has a unique 3-letter uppercase iso3", () => {
		const seen = new Set<string>();
		for (const c of countries) {
			expect(typeof c.iso3).toBe("string");
			expect(c.iso3).toMatch(/^[A-Z]{3}$/);
			expect(seen.has(c.iso3!), `duplicate iso3 ${c.iso3}`).toBe(false);
			seen.add(c.iso3!);
		}
		expect(seen.size).toBe(countries.length);
	});

	it("every country has a non-empty English name (name_en)", () => {
		for (const c of countries) {
			expect(typeof c.name_en).toBe("string");
			expect((c.name_en ?? "").trim().length).toBeGreaterThan(0);
		}
	});

	it("every country carries iso2, region, subregion; un_m49 where assigned", () => {
		// Kosovo (XKX) and a few partial-recognition territories are not in UN
		// M49 statistics, so un_m49 is optional — but when present must be a
		// string/number. iso2 / region / subregion are universal join keys.
		for (const c of countries) {
			expect(c.iso2, `${c.iso3} missing iso2`).toMatch(/^[A-Z]{2}$/);
			expect(typeof c.region).toBe("string");
			expect((c.region ?? "").length).toBeGreaterThan(0);
			expect(typeof c.subregion).toBe("string");
			if (c.un_m49 !== undefined && c.un_m49 !== null) {
				expect(["string", "number"], `${c.iso3} un_m49 wrong type`).toContain(
					typeof c.un_m49,
				);
			}
		}
	});

	it("regions are drawn from the UN M49 macro-region set", () => {
		const allowed = new Set([
			"Africa",
			"Americas",
			"Asia",
			"Europe",
			"Oceania",
			"Antarctica",
			"World",
			"",
		]);
		for (const c of countries) {
			const region = (c.region ?? "").toString();
			// allow lowercase variants from upstream; normalize for the check.
			const norm = region.charAt(0).toUpperCase() + region.slice(1);
			expect(
				allowed.has(region) || allowed.has(norm),
				`unexpected region "${region}" for ${c.iso3}`,
			).toBe(true);
		}
	});

	it("a representative country (BRA) carries the dimension blocks libs read", () => {
		// Dimensions are top-level keys (hunger, conflict, health, demographics,
		// economy, climate, ...), not nested under `metrics`. generate_api.py and
		// every dossier / forecast / domino / oracle reader consumes these directly.
		const bra = countries.find((c) => c.iso3 === "BRA");
		expect(bra, "BRA must exist in the backbone").toBeDefined();
		const dimensionKeys = [
			"hunger",
			"conflict",
			"health",
			"demographics",
			"economy",
			"climate",
		];
		for (const dk of dimensionKeys) {
			expect(bra![dk], `BRA missing dimension ${dk}`).toBeDefined();
			expect(typeof bra![dk]).toBe("object");
		}
	});

	it("the backbone is round-trippable through JSON (stable wire format)", () => {
		// generate_api.py re-emits this exact structure. If JSON.stringify can't
		// reproduce it byte-for-byte-ish, the manifest drift detector will lie.
		let re: { metadata?: Record<string, unknown>; countries?: unknown[] };
		try {
			re = JSON.parse(JSON.stringify(backbone)) as typeof backbone;
		} catch (e) {
			throw new Error(
				`backbone failed JSON round-trip: ${e instanceof Error ? e.message : e}`,
			);
		}
		expect(re.metadata?.schema_version).toBe(backbone.metadata?.schema_version);
		expect(re.countries?.length).toBe(countries.length);
	});
});
