import { describe, it, expect } from "vitest";
import {
  WIDGETS,
  WIDGET_ORDER,
  widgetRoute,
  resolveParams,
  buildEmbedSrc,
  generateWidgetIframe,
  generateWidgetScript,
  generateDirectLink,
  parseWidgetConfig,
  type WidgetType,
} from "../lib/embed-widgets";

const ALL_TYPES: WidgetType[] = ["sorrow-map", "lives", "countdown", "brief"];

describe("embed-widgets — catalog", () => {
  it("exposes the four syndication widgets in a stable order", () => {
    expect(WIDGET_ORDER).toEqual(ALL_TYPES);
  });

  it("every widget has a unique glyph, sensible heights, and at least one param", () => {
    const glyphs = new Set<string>();
    for (const t of ALL_TYPES) {
      const w = WIDGETS[t];
      expect(w.glyph.length).toBeGreaterThan(0);
      expect(glyphs.has(w.glyph)).toBe(false);
      glyphs.add(w.glyph);
      expect(w.defaultHeight).toBeGreaterThanOrEqual(w.heightRange[0]);
      expect(w.defaultHeight).toBeLessThanOrEqual(w.heightRange[1]);
      expect(w.params.length).toBeGreaterThan(0);
      // every param has a default that exists among its options
      for (const p of w.params) {
        const values = p.options.map((o) => o.value);
        expect(values).toContain(p.defaultValue);
      }
    }
  });
});

describe("embed-widgets — routes & params", () => {
  it("widgetRoute maps to the /embed segment", () => {
    expect(widgetRoute("sorrow-map")).toBe("/embed/sorrow-map/");
    expect(widgetRoute("brief")).toBe("/embed/brief/");
  });

  it("resolveParams fills defaults and applies overrides", () => {
    expect(resolveParams("sorrow-map")).toEqual({
      metric: "hunger_undernourishment_pct",
    });
    expect(resolveParams("lives", { cause: "hunger" })).toEqual({ cause: "hunger" });
    expect(resolveParams("countdown", { sdg: "6" })).toEqual({ sdg: "6" });
    expect(resolveParams("brief", { country: "SDN" })).toEqual({ country: "SDN" });
  });
});

describe("embed-widgets — buildEmbedSrc", () => {
  it("absolute src points at the canonical SITE url with theme + params", () => {
    const src = buildEmbedSrc({ type: "lives", params: { cause: "hunger" }, theme: "dark" });
    expect(src.startsWith("https://")).toBe(true);
    expect(src).toContain("/embed/lives/");
    expect(src).toContain("cause=hunger");
    expect(src).toContain("theme=dark");
  });

  it("absolute src is the default", () => {
    const a = buildEmbedSrc({ type: "brief", params: { country: "SDN" } });
    expect(a.startsWith("https://")).toBe(true);
  });

  it("relative src is returned when absolute=false (and is SSR-safe)", () => {
    // On the server (no window) the basePath resolves to "".
    const src = buildEmbedSrc({ type: "countdown" }, false);
    expect(src.startsWith("/embed/countdown/")).toBe(true);
    expect(src).not.toContain("https://");
  });

  it("theme=light is serialized into the src", () => {
    const src = buildEmbedSrc({ type: "sorrow-map", theme: "light" });
    expect(src).toContain("theme=light");
  });
});

describe("embed-widgets — generateWidgetIframe", () => {
  it("produces a valid iframe tag with src, width, height, title", () => {
    const html = generateWidgetIframe({ type: "lives", height: 240, width: "100%" });
    expect(html).toContain("<iframe");
    expect(html).toContain("</iframe>");
    expect(html).toContain('width="100%"');
    expect(html).toContain('height="240"');
    expect(html).toContain("loading=\"lazy\"");
    expect(html).toContain("title=\"V FOR X — Lives Counter\"");
    expect(html).toContain("/embed/lives/");
  });

  it("respects a custom numeric width and title", () => {
    const html = generateWidgetIframe({
      type: "brief",
      params: { country: "SDN" },
      width: 480,
      title: "Sudan brief",
    });
    expect(html).toContain('width="480px"');
    expect(html).toContain('title="Sudan brief"');
    expect(html).toContain("country=SDN");
  });

  it("uses the spec default height when none provided", () => {
    const html = generateWidgetIframe({ type: "countdown" });
    expect(html).toContain(`height="${WIDGETS.countdown.defaultHeight}"`);
  });

  it("light theme uses a light frame style", () => {
    const dark = generateWidgetIframe({ type: "lives", theme: "dark" });
    const light = generateWidgetIframe({ type: "lives", theme: "light" });
    expect(dark).toContain("#060b14");
    expect(light).toContain("#ffffff");
  });
});

describe("embed-widgets — generateWidgetScript", () => {
  it("is deterministic: same options => same container ID", () => {
    const a = generateWidgetScript({ type: "lives", params: { cause: "hunger" } });
    const b = generateWidgetScript({ type: "lives", params: { cause: "hunger" } });
    expect(a).toBe(b);
    expect(a).toContain("id=\"vfx-lives-");
  });

  it("different params => different container ID", () => {
    const a = generateWidgetScript({ type: "lives", params: { cause: "hunger" } });
    const b = generateWidgetScript({ type: "lives", params: { cause: "conflict" } });
    expect(a).not.toBe(b);
  });
});

describe("embed-widgets — generateDirectLink", () => {
  it("returns the bare canonical URL", () => {
    const link = generateDirectLink({ type: "brief", params: { country: "SDN" } });
    expect(link).toContain("/embed/brief/");
    expect(link).toContain("country=SDN");
    expect(link).toContain("theme=dark");
    expect(link.startsWith("<")).toBe(false);
  });
});

describe("embed-widgets — parseWidgetConfig", () => {
  it("reads valid params from a URLSearchParams", () => {
    const s = new URLSearchParams("cause=conflict&theme=light");
    const cfg = parseWidgetConfig("lives", s);
    expect(cfg.params.cause).toBe("conflict");
    expect(cfg.theme).toBe("light");
  });

  it("falls back to defaults for missing params", () => {
    const cfg = parseWidgetConfig("sorrow-map", new URLSearchParams(""));
    expect(cfg.params.metric).toBe("hunger_undernourishment_pct");
    expect(cfg.theme).toBe("dark");
  });

  it("falls back to defaults for invalid param values", () => {
    const cfg = parseWidgetConfig("countdown", new URLSearchParams("sdg=999"));
    expect(cfg.params.sdg).toBe("all");
  });

  it("accepts a Next.js searchParams record shape", () => {
    const cfg = parseWidgetConfig("brief", { country: "SDN", theme: "light" });
    expect(cfg.params.country).toBe("SDN");
    expect(cfg.theme).toBe("light");
  });

  it("handles array-valued params", () => {
    const cfg = parseWidgetConfig("brief", { country: ["YEM", "SDN"] });
    expect(cfg.params.country).toBe("YEM");
  });

  it("treats unknown theme as dark", () => {
    const cfg = parseWidgetConfig("lives", new URLSearchParams("theme=cyan"));
    expect(cfg.theme).toBe("dark");
  });
});
