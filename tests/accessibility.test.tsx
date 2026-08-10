import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import axe from "axe-core";
import HomePage from "@/app/page";

describe("Homepage accessibility (axe-core)", () => {
  afterEach(cleanup);

  it("has no critical or serious axe violations", async () => {
    const { container } = render(<HomePage />);
    const results = await axe.run(container, {
      runOnly: {
        type: "tag",
        values: ["critical", "serious"],
      },
    });
    const issues = results.violations.map(
      (v) => `${v.id}: ${v.description} (${v.nodes.length} elements)`
    );
    expect(issues, `axe violations:\n${issues.join("\n")}`).toHaveLength(0);
  }, 30000);
});
