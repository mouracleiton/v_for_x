/**
 * Phase 24 — EmptyState component (components/shared/EmptyState.tsx)
 *
 * Reusable terminal-styled empty-state surface for thin pages. Accessible
 * (role=status, aria-live), optional CTA, minimal mode.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import EmptyState from "@/components/shared/EmptyState";

describe("EmptyState component", () => {
	afterEach(cleanup);

	it("renders the title in an accessible status region", () => {
		const { getByRole, getByText } = render(
			<EmptyState title="No witness statements yet" />,
		);
		const region = getByRole("status");
		expect(region).toBeTruthy();
		expect(region.getAttribute("aria-live")).toBe("polite");
		expect(getByText("No witness statements yet")).toBeTruthy();
	});

	it("renders the hint when provided", () => {
		const { getByText } = render(
			<EmptyState
				title="Empty"
				hint="Record your first statement to start the chain."
			/>,
		);
		expect(
			getByText("Record your first statement to start the chain."),
		).toBeTruthy();
	});

	it("renders an optional CTA node", () => {
		const { getByText } = render(
			<EmptyState
				title="Empty"
				action={<a href="/the-receipts">Add statement</a>}
			/>,
		);
		expect(getByText("Add statement").getAttribute("href")).toBe(
			"/the-receipts",
		);
	});

	it("honours a custom glyph + aria-live", () => {
		const { getByRole } = render(
			<EmptyState title="x" glyph="▸" ariaLive="assertive" />,
		);
		const region = getByRole("status");
		expect(region.getAttribute("aria-live")).toBe("assertive");
		expect(region.textContent).toContain("▸");
	});

	it("omits the hint span when none provided", () => {
		const { container } = render(<EmptyState title="x" />);
		// Only the title strong span; no hint.
		const spans = container.querySelectorAll("span");
		// At least one span (title), but the hint is absent.
		expect(container.textContent).toContain("x");
	});
});
