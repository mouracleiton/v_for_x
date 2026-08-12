/**
 * V FOR X — Token linter test (todo-135)
 *
 * "PR fails if new VFX* string not in TOKEN_SPECS".
 *
 * Scans lib/, app/, components/ for literal `VFX<LETTERS><DIGITS>:` token
 * prefixes and asserts every one is registered in lib/tokens.ts TOKEN_SPECS.
 * This catches the class of bug where a new token format ships without its
 * registry entry, breaking detectToken() and the /the-tokens catalog.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

import { TOKEN_SPECS } from "../lib/tokens";

const ROOTS = ["lib", "app", "components"];
const EXTENSIONS = new Set([".ts", ".tsx"]);
const IGNORE_DIRS = new Set([
	"node_modules",
	".next",
	"out",
	".git",
	".swarm",
	".pi-subagents",
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

// Match literal VFX-prefixed token prefixes as written in source.
// e.g. VFXID1: VFXWIT1: VFXPACK1: VFXID1PUB: — the colon-terminated prefix.
const PREFIX_LITERAL = /\bVFX[A-Z0-9]{2,12}:/g;

function collectLiterals(): { file: string; prefix: string }[] {
	const found: { file: string; prefix: string }[] = [];
	for (const root of ROOTS) {
		for (const file of walk(root)) {
			let src: string;
			try {
				src = readFileSync(file, "utf-8");
			} catch {
				continue;
			}
			// Skip the registry file itself + the tokens type defs — those DEFINE prefixes.
			if (file.endsWith("lib/tokens.ts")) continue;
			for (const match of src.matchAll(PREFIX_LITERAL)) {
				found.push({ file, prefix: match[0] });
			}
		}
	}
	return found;
}

describe("token linter — every VFX* prefix in source is registered", () => {
	it("TOKEN_SPECS is non-empty", () => {
		expect(TOKEN_SPECS.length).toBeGreaterThan(5);
	});

	it("every literal VFX*: in lib/app/components is in TOKEN_SPECS", () => {
		const literals = collectLiterals();
		const registered = new Set(TOKEN_SPECS.map((s) => s.prefix));
		const unregistered = literals.filter((l) => !registered.has(l.prefix));
		if (unregistered.length > 0) {
			const detail = unregistered
				.slice(0, 20)
				.map((u) => `${u.prefix} in ${u.file}`)
				.join("\n  ");
			throw new Error(
				`${unregistered.length} unregistered VFX* prefix(es) found:\n  ${detail}\nAdd them to TOKEN_SPECS in lib/tokens.ts.`,
			);
		}
		// Sanity: the scan found at least a handful (else the linter is broken).
		expect(literals.length).toBeGreaterThan(10);
	});

	it("no two TOKEN_SPECS entries share the same id", () => {
		const ids = TOKEN_SPECS.map((s) => s.id);
		const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
		expect(dupes, `duplicate token ids: ${dupes.join(", ")}`).toEqual([]);
	});
});
