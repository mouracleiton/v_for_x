import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import HomePage from "@/app/page";

describe("Homepage smoke test", () => {
  afterEach(cleanup);

  it("renders without crashing", () => {
    const { container } = render(<HomePage />);
    expect(container).toBeTruthy();
  });

  it("displays the hero title", () => {
    const { container } = render(<HomePage />);
    expect(container.textContent).toContain("V FOR X");
  });

  it("renders the section directory with all 58 entries", () => {
    const { container } = render(<HomePage />);
    const sectionLinks = Array.from(
      container.querySelectorAll<HTMLAnchorElement>("a[href]")
    ).filter((a) => {
      const href = a.getAttribute("href") || "";
      return (
        href.startsWith("/the-") ||
        href.startsWith("/sorrow") ||
        href.startsWith("/equation") ||
        href.startsWith("/protocol") ||
        href.startsWith("/registry") ||
        href.startsWith("/fortress")
      );
    });
    expect(sectionLinks.length).toBeGreaterThanOrEqual(50);
  });

  it("includes newly added sections that were missing before", () => {
    const { container } = render(<HomePage />);
    const hrefs = Array.from(container.querySelectorAll<HTMLAnchorElement>("a"))
      .map((a) => (a.getAttribute("href") || "").replace(/\/$/, ""));
    const mustHave = [
      "/the-oracle",
      "/the-resistance",
      "/the-tribunal",
      "/the-canary",
      "/the-academy",
      "/the-safehouse",
      "/the-quorum",
      "/the-digest",
      "/the-onion",
      "/the-changelog",
    ];
    for (const href of mustHave) {
      expect(hrefs, `expected directory to link to ${href}`).toContain(href);
    }
  });
});
