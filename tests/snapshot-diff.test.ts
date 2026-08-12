import { describe, it, expect } from "vitest";
import {
	diffNumeric,
	describeChange,
	topWorsened,
	DEFAULT_WORSE_IS_UP,
	BETTER_IS_UP,
	type MetricChange,
} from "../lib/snapshot-diff";

describe("snapshot-diff", () => {
	it("diffNumeric detects up/down/added/removed (keys tracked in `path`)", () => {
		const before = { a: 10, b: 20, c: 5 };
		const after = { a: 15, b: 15, d: 7 };
		const changes = diffNumeric(before, after);
		const byPath = new Map(changes.map((c) => [c.path, c]));
		expect(byPath.get("a")?.direction).toBe("up");
		expect(byPath.get("b")?.direction).toBe("down");
		// `c` removed (present before, absent after)
		expect(byPath.get("c")?.direction).toBe("removed");
		// `d` added (absent before, present after)
		expect(byPath.get("d")?.direction).toBe("added");
	});

	it("diffNumeric returns empty for identical objects", () => {
		expect(diffNumeric({ a: 1 }, { a: 1 })).toEqual([]);
	});

	it("describeChange renders a human line with path + direction arrow", () => {
		const c: MetricChange = {
			path: "hunger",
			old: 100,
			now: 130,
			delta: 30,
			relDelta: 0.3,
			direction: "up",
		};
		const s = describeChange(c);
		expect(s).toContain("hunger");
		expect(s).toContain("↑"); // up arrow
	});

	it("DEFAULT_WORSE_IS_UP includes canonical worsening metrics", () => {
		expect(DEFAULT_WORSE_IS_UP.length).toBeGreaterThan(0);
	});

	it("BETTER_IS_UP is distinct from DEFAULT_WORSE_IS_UP", () => {
		expect(BETTER_IS_UP).not.toEqual(DEFAULT_WORSE_IS_UP);
	});

	it("topWorsened returns the worst-N countries sorted by `worsening`", () => {
		const result = {
			root: "x",
			generatedAt: 0,
			countries: [
				{ iso3: "A", changes: [], worsening: 4, improving: 0 },
				{ iso3: "B", changes: [], worsening: 49, improving: 0 },
			],
		};
		const top = topWorsened(result as never, 1);
		expect(top[0].iso3).toBe("B");
	});
});
