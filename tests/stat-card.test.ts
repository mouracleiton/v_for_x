import { describe, it, expect } from "vitest";
import {
  layoutCard,
  fitMonoText,
  wrapMono,
  cardFileName,
  hashText,
  glitchOffsets,
  GLITCH_CARD,
  MONO_ADVANCE,
  renderGlitchCard,
  type CanvasLike,
  type MonoMeter,
} from "../lib/stat-card";

/**
 * Fake canvas context: width is font-driven, exact monospace math
 * (len * 0.6 * px), so fitMonoText's internal font bump is honored.
 */
function fakeCtx(basePx: number): CanvasLike {
  return {
    font: `${basePx}px mono`,
    measureText(this: CanvasLike, text: string) {
      const match = /(\d+)px/.exec(this.font);
      const px = match ? Number(match[1]) : basePx;
      return { width: text.length * MONO_ADVANCE * px };
    },
  };
}

/** Recording stub — counts draw calls for the renderGlitchCard contract. */
function recordCtx() {
  const calls = { fillText: 0, measureText: 0, fillRect: 0, strokeRect: 0 };
  const ctx = {
    font: "56px mono",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: "",
    textBaseline: "",
    measureText: (t: string) => {
      calls.measureText++;
      return { width: t.length * 30 };
    },
    fillText: () => {
      calls.fillText++;
    },
    fillRect: () => {
      calls.fillRect++;
    },
    strokeRect: () => {
      calls.strokeRect++;
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe("stat-card — layoutCard (pure math, no DOM)", () => {
  it("empty text yields no lines, no truncation, base px", () => {
    expect(layoutCard("")).toEqual({
      lines: [],
      truncate: false,
      px: GLITCH_CARD.basePx,
    });
  });

  it("short text stays on one line at base px", () => {
    const l = layoutCard("hello world");
    expect(l).toEqual({ lines: ["hello world"], truncate: false, px: 56 });
  });

  it("exactly fills one line at 55px-ish: 35 chars at px 56 is max", () => {
    const a35 = "A".repeat(35);
    const l = layoutCard(a35);
    expect(l.lines).toEqual([a35]);
    expect(l.truncate).toBe(false);
    expect(l.px).toBe(56);
  });

  it("char-breaks an overlong single word at the px-56 cap", () => {
    const l = layoutCard("A".repeat(36));
    expect(l.lines[0].length).toBe(35);
    expect(l.lines[1]).toBe("A");
    expect(l.truncate).toBe(false);
  });

  it("finds the largest px whose wrap fits maxLines (80 × 'wwww')", () => {
    const text = "wwww ".repeat(80).trim();
    const l = layoutCard(text);
    // px 52+: <39 chars/line => 12 lines; px 51: 39 chars/line => exactly 10
    expect(l.px).toBe(51);
    expect(l.lines.length).toBe(10);
    expect(l.truncate).toBe(false);
  });

  it("every wrapped line respects width = len * 0.6 * px", () => {
    const text = "wwww ".repeat(80).trim();
    const l = layoutCard(text);
    for (const line of l.lines) {
      expect(line.length * MONO_ADVANCE * l.px).toBeLessThanOrEqual(1200);
    }
  });

  it("long text truncates to maxLines with ellipsis on the last line", () => {
    const text = "wwww ".repeat(300).trim();
    const l = layoutCard(text);
    expect(l.truncate).toBe(true);
    expect(l.lines.length).toBe(10);
    expect(l.px).toBe(30);
    expect(l.lines[9].endsWith("…")).toBe(true);
    for (const line of l.lines) {
      expect(line.length).toBeLessThanOrEqual(66); // maxChars at px 30
      expect(line.length * MONO_ADVANCE * l.px).toBeLessThanOrEqual(1200);
    }
  });

  it("honors a custom maxLines", () => {
    const text = "wwww ".repeat(300).trim();
    const l = layoutCard(text, { maxLines: 4 });
    expect(l.lines.length).toBe(4);
    expect(l.truncate).toBe(true);
    expect(l.lines[3].endsWith("…")).toBe(true);
  });

  it("keeps px inside [minPx, basePx] for arbitrary input", () => {
    const l = layoutCard("x ".repeat(500), { width: 400, maxLines: 2 });
    expect(l.px).toBeGreaterThanOrEqual(30);
    expect(l.px).toBeLessThanOrEqual(56);
  });
});

describe("stat-card — fitMonoText (fake context)", () => {
  const TEXT40 = "A".repeat(40); // width(px) = 24 * px, exact floats

  it("returns the exact px whose width equals maxWidth", () => {
    expect(fitMonoText(fakeCtx(56), TEXT40, 1152, 56, 30)).toBe(48);
  });

  it("returns basePx when basePx already fits", () => {
    expect(fitMonoText(fakeCtx(56), TEXT40, 1344, 56, 30)).toBe(56);
  });

  it("is monotone non-decreasing in maxWidth", () => {
    const maxWidths = [500, 700, 900, 1152, 1400];
    const results = maxWidths.map((mw) =>
      fitMonoText(fakeCtx(56), TEXT40, mw, 56, 30)
    );
    expect(results).toEqual([30, 30, 37, 48, 56]);
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toBeGreaterThanOrEqual(results[i - 1]);
    }
  });

  it("is monotone non-increasing in text length", () => {
    const lens = [10, 50, 100];
    const results = lens.map((n) =>
      fitMonoText(fakeCtx(56), "A".repeat(n), 1200, 56, 30)
    );
    expect(results).toEqual([56, 40, 30]);
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toBeLessThanOrEqual(results[i - 1]);
    }
  });

  it("degrades to minPx when even the smallest size overflows", () => {
    expect(fitMonoText(fakeCtx(56), "A".repeat(1000), 300, 56, 30)).toBe(30);
  });

  it("always lands within [minPx, basePx]", () => {
    for (const n of [1, 5, 17, 64, 220]) {
      const px = fitMonoText(fakeCtx(56), "A".repeat(n), 900, 56, 30);
      expect(px).toBeGreaterThanOrEqual(30);
      expect(px).toBeLessThanOrEqual(56);
    }
  });
});

describe("stat-card — wrapMono (fake context)", () => {
  it("wraps greedily and never exceeds maxWidth", () => {
    const ctx = fakeCtx(56);
    const text = "the quick brown fox jumps over the lazy dog ".repeat(4);
    const lines = wrapMono(ctx, text, 400, 56);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(ctx.measureText(line).width).toBeLessThanOrEqual(400);
    }
  });

  it("preserves word order across line breaks", () => {
    const ctx = fakeCtx(56);
    const text = "alpha beta gamma delta epsilon zeta eta theta iota kappa";
    const lines = wrapMono(ctx, text, 350, 56);
    const joined = lines.join(" ");
    expect(joined.split(" ")).toEqual(text.split(" "));
  });

  it("char-breaks a word longer than the line", () => {
    const ctx = fakeCtx(56);
    const lines = wrapMono(ctx, "A".repeat(30), 200, 56);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe("A".repeat(30));
    for (const line of lines) {
      expect(ctx.measureText(line).width).toBeLessThanOrEqual(200);
    }
  });

  it("collapses whitespace runs and handles empty input", () => {
    const ctx = fakeCtx(56);
    expect(wrapMono(ctx, "   ", 400, 56)).toEqual([]);
    expect(wrapMono(ctx, "a   b", 400, 56)).toEqual(["a b"]);
  });

  it("falls back to 0.6em math when the meter cannot measure", () => {
    const meter: MonoMeter = {} as MonoMeter;
    const lines = wrapMono(meter, "wwww ".repeat(10), 300, 56);
    for (const line of lines) {
      expect(line.length * MONO_ADVANCE * 56).toBeLessThanOrEqual(300);
    }
  });
});

describe("stat-card — cardFileName", () => {
  it("uses the stable vfx-stat-<8 hex>.png shape", () => {
    expect(cardFileName("hello")).toMatch(/^vfx-stat-[0-9a-f]{8}\.png$/);
  });

  it("is deterministic across calls", () => {
    const a = cardFileName("hello world");
    const b = cardFileName("hello world");
    expect(a).toBe(b);
  });

  it("differs for different stats", () => {
    expect(cardFileName("A")).not.toBe(cardFileName("B"));
    expect(cardFileName("AB")).not.toBe(cardFileName("BA"));
  });

  it("exposes the first 8 hex chars of the FNV-1a hash", () => {
    const name = cardFileName("v for x");
    const hex = hashText("v for x").toString(16).padStart(8, "0");
    expect(name).toBe(`vfx-stat-${hex}.png`);
  });
});

describe("stat-card — glitchOffsets", () => {
  it("is deterministic per seed", () => {
    expect(glitchOffsets(42)).toEqual(glitchOffsets(42));
  });

  it("is stable across separate calls with the same seed", () => {
    const a = glitchOffsets(7);
    const b = glitchOffsets(7);
    expect(a).toEqual(b);
  });

  it("differs for different seeds", () => {
    expect(glitchOffsets(1)).not.toEqual(glitchOffsets(2));
  });

  it("returns 6 bounded offsets with alpha in [0.1, 0.3]", () => {
    for (const seed of [0, 1, 99, hashText("stat")]) {
      const offsets = glitchOffsets(seed);
      expect(offsets).toHaveLength(6);
      for (const o of offsets) {
        expect(Math.abs(o.x)).toBeLessThanOrEqual(12);
        expect(Math.abs(o.y)).toBeLessThanOrEqual(12);
        expect(o.alpha).toBeGreaterThanOrEqual(0.1);
        expect(o.alpha).toBeLessThanOrEqual(0.3);
      }
    }
  });
});

describe("stat-card — renderGlitchCard draw contract (recording stub)", () => {
  it("performs the full draw and measurement sequence", () => {
    const { ctx, calls } = recordCtx();
    const text = "wwww ".repeat(200).trim();
    renderGlitchCard(ctx, text, { width: 1200, height: 630, seed: 5 });

    // background + 157 scanline rows + 300 grain dots
    expect(calls.fillRect).toBeGreaterThanOrEqual(458);
    // 2px blood inset border
    expect(calls.strokeRect).toBe(1);
    // header "▮" + "V FOR X" + footer + aberration (2×10) + main copy (10)
    expect(calls.fillText).toBeGreaterThanOrEqual(33);
    // fitMonoText iterations + word-wrap probes + ellipsis check
    expect(calls.measureText).toBeGreaterThanOrEqual(10);
  });
});