/**
 * Phase 24 — Local-only perf marks (lib/perf-marks.ts)
 *
 * "Telemetry that isn't surveillance": marks/measures never leave the device.
 * Off by default; opt-in enable; capped local ring buffer; manual JSON export.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
	enablePerf,
	disablePerf,
	perfEnabled,
	mark,
	measure,
	trace,
	readPerfBuffer,
	exportPerfJson,
	clearPerfBuffer,
} from "@/lib/perf-marks";

describe("perf-marks (local-only)", () => {
	beforeEach(() => {
		disablePerf();
		clearPerfBuffer();
	});

	it("is off by default and a no-op until enabled", () => {
		expect(perfEnabled()).toBe(false);
		mark("x");
		expect(readPerfBuffer().length).toBe(0);
	});

	it("records marks into the local buffer once enabled", () => {
		enablePerf();
		expect(perfEnabled()).toBe(true);
		mark("oracle.search.start");
		mark("oracle.search.end");
		const buf = readPerfBuffer();
		expect(buf.length).toBe(2);
		expect(buf[0].name).toBe("oracle.search.start");
	});

	it("measure returns duration between two marks", () => {
		enablePerf();
		mark("a.start", { phase: 1 });
		mark("a.end");
		const m = measure("a.span", "a.start", "a.end");
		expect(m).not.toBeNull();
		expect(m?.durationMs).toBeGreaterThanOrEqual(0);
		expect(m?.startName).toBe("a.start");
		expect(m?.endName).toBe("a.end");
	});

	it("measure returns null when a mark is missing", () => {
		enablePerf();
		mark("only.start");
		expect(measure("x", "only.start", "missing.end")).toBeNull();
	});

	it("trace runs fn and records start/end + measure", async () => {
		enablePerf();
		const result = await trace("compute", async () => 42);
		expect(result).toBe(42);
		const names = readPerfBuffer().map((m) => m.name);
		expect(names).toContain("compute.start");
		expect(names).toContain("compute.end");
		expect(names).toContain("compute");
	});

	it("buffer is capped (drops oldest past MAX_ENTRIES)", () => {
		enablePerf();
		// Flood well past the cap to verify the tail is kept.
		for (let i = 0; i < 250; i++) mark(`m${i}`);
		const buf = readPerfBuffer();
		expect(buf.length).toBeLessThanOrEqual(200);
		// Newest retained, oldest dropped.
		expect(buf.some((m) => m.name === "m249")).toBe(true);
		expect(buf.some((m) => m.name === "m0")).toBe(false);
	});

	it("exportPerfJson produces a parseable JSON string", () => {
		enablePerf();
		mark("x");
		const json = exportPerfJson();
		let parsed: { exportedAt?: number; marks?: unknown[] } = {};
		try {
			parsed = JSON.parse(json);
		} catch (e) {
			throw new Error(
				`exportPerfJson did not produce valid JSON: ${(e as Error).message}`,
			);
		}
		expect(parsed.exportedAt).toBeGreaterThan(0);
		expect(Array.isArray(parsed.marks)).toBe(true);
	});

	it("clearPerfBuffer empties the store", () => {
		enablePerf();
		mark("x");
		expect(readPerfBuffer().length).toBe(1);
		clearPerfBuffer();
		expect(readPerfBuffer()).toEqual([]);
	});

	it("disablePerf stops recording", () => {
		enablePerf();
		mark("a");
		disablePerf();
		mark("b"); // ignored
		const names = readPerfBuffer().map((m) => m.name);
		expect(names).toContain("a");
		expect(names).not.toContain("b");
	});
});
