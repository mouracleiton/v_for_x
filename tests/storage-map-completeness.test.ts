/**
 * V FOR X — Storage-map completeness test (todo-136)
 *
 * "grep localStorage/IDB keys vs lib/storage-map.ts".
 *
 * Static check: scans lib/, app/, components/ for literal string keys passed
 * to localStorage.setItem / getItem / removeItem and asserts each is registered
 * in LOCAL_STORAGE_KEYS (or matches a registered prefix). Catches the class of
 * bug where a feature writes to an unregistered key, breaking panic-wipe,
 * duress-decoy restore, and the storage health report.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

import { LOCAL_STORAGE_KEYS } from "../lib/storage-map";

const ROOTS = ["lib", "app", "components"];
const EXTENSIONS = new Set([".ts", ".tsx"]);
const IGNORE_DIRS = new Set([
	"node_modules",
	".next",
	"out",
	".git",
	".swarm",
	".pi-subagents",
	".codemachine",
]);

function walk(dir: string, out: string[] = []): string[] {
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return out;
	}
	for (const entry of entries) {
		const full = join(dir, entry);
		let st: ReturnType<typeof statSync>;
		try {
			st = statSync(full);
		} catch {
			continue;
		}
		if (st.isDirectory()) {
			if (!IGNORE_DIRS.has(entry)) walk(full, out);
		} else if (EXTENSIONS.has(extname(full))) {
			out.push(full);
		}
	}
	return out;
}

// localStorage.setItem("KEY", ...) / getItem("KEY") / removeItem("KEY")
const STORAGE_CALL =
	/localStorage\.(?:setItem|getItem|removeItem)\(\s*["'`]([^"'`]+)["'`]/g;

function collectStorageKeys(): { file: string; key: string }[] {
	const found: { file: string; key: string }[] = [];
	for (const root of ROOTS) {
		for (const file of walk(root)) {
			let src: string;
			try {
				src = readFileSync(file, "utf-8");
			} catch {
				continue;
			}
			// Skip the registry itself — it legitimately references every key.
			if (file.endsWith("lib/storage-map.ts")) continue;
			for (const match of src.matchAll(STORAGE_CALL)) {
				found.push({ file, key: match[1] });
			}
		}
	}
	return found;
}

function isRegistered(
	key: string,
	knownKeys: Set<string>,
	knownPrefixes: string[],
): boolean {
	if (knownKeys.has(key)) return true;
	// Dynamic / namespaced keys (e.g. vfx-errata-${id}) are registered as a base
	// prefix; accept any literal key that a registered prefix is a stem of.
	return knownPrefixes.some((p) => key.startsWith(p));
}

describe("storage-map completeness — every localStorage key is registered", () => {
	it("LOCAL_STORAGE_KEYS is non-empty", () => {
		expect(LOCAL_STORAGE_KEYS.length).toBeGreaterThan(10);
	});

	it("every literal localStorage key in source is in LOCAL_STORAGE_KEYS", () => {
		const knownKeys = new Set(LOCAL_STORAGE_KEYS.map((k) => k.key));
		// Treat registered keys whose description mentions "prefix" as namespace stems.
		const knownPrefixes = LOCAL_STORAGE_KEYS.filter(
			(k) => k.key.endsWith(":") || /prefix/i.test(k.description),
		).map((k) => k.key);

		const calls = collectStorageKeys();
		// Filter out obviously dynamic keys (contain ${...} or template placeholders).
		const literals = calls.filter((c) => !/[${}]/.test(c.key));
		const unregistered = literals.filter(
			(c) => !isRegistered(c.key, knownKeys, knownPrefixes),
		);

		if (unregistered.length > 0) {
			const detail = unregistered
				.slice(0, 20)
				.map((u) => `"${u.key}" in ${u.file}`)
				.join("\n  ");
			throw new Error(
				`${unregistered.length} unregistered localStorage key(s):\n  ${detail}\nRegister them in LOCAL_STORAGE_KEYS (lib/storage-map.ts) so panic-wipe + duress restore cover them.`,
			);
		}
		// Sanity: the scan found at least a handful of literal storage calls.
		expect(literals.length).toBeGreaterThan(10);
	});

	it("every registered key has a unique storage key string", () => {
		const keys = LOCAL_STORAGE_KEYS.map((k) => k.key);
		const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
		expect(dupes, `duplicate storage keys: ${dupes.join(", ")}`).toEqual([]);
	});
});
