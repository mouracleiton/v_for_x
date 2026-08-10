/**
 * V FOR X — GLITCH CARD ENGINE
 * Zero-dependency, off-screen <canvas> renderer that exports a stat as a
 * 1200×630 PNG "glitch card" (OG-card aspect). No server, no libraries:
 * monospace layout math, an FNV-1a hash for file names, and a tiny LCG for
 * deterministic film grain / glitch offsets within a single render.
 *
 * Monospace advance assumption: a mono glyph is ≈ 0.6em wide on average
 * (JetBrains Mono / Fira Code advance ≈ 0.6 — measured against real
 * ctx.measureText in browsers). layoutCard uses width ≈ len * 0.6 * px and
 * is therefore pure math, testable without a DOM. The canvas renderer
 * re-measures with the real context via fitMonoText / wrapMono.
 */

/** Shared font stack — mirrors app/globals.css `--font-mono`. */
export const MONO_FONT =
  '"JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code", "Menlo", "Consolas", monospace';

/** Approx monospace advance ratio (see header note). */
export const MONO_ADVANCE = 0.6;

/** Card geometry + palette constants (blood-red on pure black). */
export const GLITCH_CARD = {
  width: 1200,
  height: 630,
  maxLines: 10,
  basePx: 56,
  minPx: 30,
  padX: 96,
  bg: "#000000",
  blood: "#c42b3e",
  ink: "#dfe7f5",
  dim: "#4a5d7a",
} as const;

/** Structural subset of CanvasRenderingContext2D needed for text math. */
export interface MonoMeter {
  measureText(text: string): { width: number };
}

/** A meter that exposes the active font (set before measuring). */
export interface CanvasLike extends MonoMeter {
  font: string;
}

export interface LayoutOptions {
  width?: number;
  height?: number;
  maxLines?: number;
  basePx?: number;
  minPx?: number;
}

export interface StatLayout {
  lines: string[];
  truncate: boolean;
  px: number;
}

export interface RenderOptions extends LayoutOptions {
  seed?: number;
}

export interface GlitchOffset {
  x: number;
  y: number;
  alpha: number;
}

/**
 * FNV-1a 32-bit hash of a string.
 * Deliberately NOT Web Crypto: hashing here only names a file (determinism
 * and sync execution matter, not collision resistance). Web Crypto is
 * async and unavailable in some jsdom/node test environments — FNV-1a runs
 * anywhere and is stable across platforms.
 */
export function hashText(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * "vfx-stat-<8 hex>.png" — the first 8 hex chars of the FNV-1a hash of the
 * stat text. Stable across sessions and machines (pure string math).
 */
export function cardFileName(text: string): string {
  const hex = hashText(text).toString(16).padStart(8, "0");
  return `vfx-stat-${hex}.png`;
}

/**
 * Small linear congruential generator (LCG) — glibc constants.
 * Deterministic per seed; used for film-grain placement so a given stat
 * renders pixel-identically on every download.
 */
function lcgFactory(seed: number): () => number {
  let s = seed >>> 0;
  if (s === 0) s = 0x9e3779b9;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * Deterministic pseudo-random list of 6 RGB-channel draw offsets for the
 * chromatic-aberration passes. Bounded: |x|, |y| ≤ 12px; alpha ∈ [0.1, 0.3].
 */
export function glitchOffsets(seed: number): GlitchOffset[] {
  const next = lcgFactory(seed);
  const offsets: GlitchOffset[] = [];
  for (let i = 0; i < 6; i++) {
    offsets.push({
      x: Math.round(next() * 24 - 12),
      y: Math.round(next() * 24 - 12),
      alpha: 0.1 + next() * 0.2,
    });
  }
  return offsets;
}

/** Binary-search the largest integer px in [minPx, basePx] whose single
 *  line-width fits maxWidth (measured live via ctx.measureText). Degrades
 *  to minPx when even the smallest size overflows. */
export function fitMonoText(
  ctx: CanvasLike,
  text: string,
  maxWidth: number,
  basePx: number,
  minPx: number
): number {
  const lo = Math.max(1, minPx);
  const hi = Math.max(lo, basePx);
  const widthAt = (px: number): number => {
    ctx.font = `${px}px ${MONO_FONT}`;
    return ctx.measureText(text).width;
  };
  if (widthAt(hi) <= maxWidth) return hi;
  let low = lo;
  let high = hi;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (widthAt(mid) <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** Largest k in [1, word.length] such that word.slice(0, k) fits maxWidth. */
function largestFit(meter: MonoMeter, word: string, maxWidth: number): number {
  if (meter.measureText(word).width <= maxWidth) return word.length;
  let lo = 1;
  let hi = word.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (meter.measureText(word.slice(0, mid)).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Greedy word-wrap into lines whose measured width ≤ maxWidth. Overlong
 *  words are char-broken. Whitespace runs collapse to single spaces. */
function wrapCore(meter: MonoMeter, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const candidate = cur === "" ? word : `${cur} ${word}`;
    if (meter.measureText(candidate).width <= maxWidth) {
      cur = candidate;
      continue;
    }
    if (cur !== "") {
      lines.push(cur);
      cur = "";
    }
    if (meter.measureText(word).width <= maxWidth) {
      cur = word;
      continue;
    }
    let rest = word;
    while (rest.length > 0) {
      const take = Math.max(1, largestFit(meter, rest, maxWidth));
      lines.push(rest.slice(0, take));
      rest = rest.slice(take);
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

/**
 * Greedy word-wrap honoring monospace width via ctx.measureText.
 * The px argument is only used as a math fallback when the context cannot
 * measure (defensive — kept for API symmetry).
 */
export function wrapMono(
  ctx: MonoMeter,
  text: string,
  maxWidth: number,
  px: number
): string[] {
  if (typeof ctx.measureText !== "function") {
    return wrapCore(
      { measureText: (s) => ({ width: s.length * MONO_ADVANCE * px }) },
      text,
      maxWidth
    );
  }
  return wrapCore(ctx, text, maxWidth);
}

/** Append "…" to the last kept line if truncation drops any lines. */
function truncateLines(
  meter: MonoMeter,
  lines: string[],
  maxLines: number,
  maxWidth: number
): { lines: string[]; truncate: boolean } {
  if (lines.length <= maxLines) return { lines, truncate: false };
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  if (meter.measureText(`${last}…`).width <= maxWidth) {
    kept[maxLines - 1] = `${last}…`;
  } else {
    const k = largestFit(meter, last, maxWidth - meter.measureText("…").width);
    kept[maxLines - 1] = `${last.slice(0, k)}…`;
  }
  return { lines: kept, truncate: true };
}

/**
 * Deterministic, canvas-free card layout. Approximates monospace advance as
 * 0.6em (0.6 * px per char) and finds the largest px in [minPx, basePx]
 * whose greedy wrap fits within maxLines; still overlong texts are truncated
 * with an ellipsis "…" on the last line. Pure math — no DOM required.
 */
export function layoutCard(text: string, opts: LayoutOptions = {}): StatLayout {
  const width = opts.width ?? GLITCH_CARD.width;
  const maxLines = opts.maxLines ?? GLITCH_CARD.maxLines;
  const basePx = opts.basePx ?? GLITCH_CARD.basePx;
  const minPx = opts.minPx ?? GLITCH_CARD.minPx;

  const meterFor = (px: number): MonoMeter => ({
    measureText: (s) => ({ width: s.length * MONO_ADVANCE * px }),
  });

  const clampedBase = Math.max(minPx, basePx);
  for (let px = clampedBase; px >= minPx; px--) {
    const lines = wrapCore(meterFor(px), text, width);
    if (lines.length <= maxLines) return { lines, truncate: false, px };
  }
  const px = minPx;
  const meter = meterFor(px);
  const wrapped = truncateLines(
    meter,
    wrapCore(meter, text, width),
    maxLines,
    width
  );
  return { lines: wrapped.lines, truncate: wrapped.truncate, px };
}

/**
 * Full glitch-card draw routine — pure side-effect function over a
 * CanvasRenderingContext2D (1200×630 px, off-screen, zero DOM in itself).
 * Order: void-black fill → 2px blood inset border → CRT scanlines every 4px
 * → seeded film grain (300 dots, alpha 0.05–0.12) → header/footer →
 * centered stat block with blood chromatic aberration (x±4, alpha 0.25) →
 * ink main copy → 1-2 seeded vertical glitch bands redrawn at x±8, alpha 0.3.
 */
export function renderGlitchCard(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: RenderOptions = {}
): void {
  const width = opts.width ?? GLITCH_CARD.width;
  const height = opts.height ?? GLITCH_CARD.height;
  const maxLines = opts.maxLines ?? GLITCH_CARD.maxLines;
  const basePx = opts.basePx ?? GLITCH_CARD.basePx;
  const minPx = opts.minPx ?? GLITCH_CARD.minPx;
  const seed = opts.seed ?? hashText(text);
  const padX = GLITCH_CARD.padX;
  const statMaxWidth = width - padX * 2;

  ctx.fillStyle = GLITCH_CARD.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = GLITCH_CARD.blood;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  ctx.fillStyle = "rgba(255,255,255,0.02)";
  for (let y = 0; y < height; y += 4) {
    ctx.fillRect(0, y, width, 1);
  }

  const grain = lcgFactory(seed ^ 0x51ab3eed);
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 300; i++) {
    ctx.globalAlpha = 0.05 + grain() * 0.07;
    ctx.fillRect(Math.floor(grain() * width), Math.floor(grain() * height), 1, 1);
  }
  ctx.globalAlpha = 1;

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `42px ${MONO_FONT}`;
  ctx.fillStyle = GLITCH_CARD.blood;
  ctx.fillText("▮", 48, 46);
  ctx.fillStyle = GLITCH_CARD.ink;
  ctx.fillText("V FOR X", 82, 46);

  ctx.font = `30px ${MONO_FONT}`;
  ctx.fillStyle = GLITCH_CARD.dim;
  ctx.fillText("vforx.org — 200 countries × 19 dimensions", padX, height - 50);

  const layout = layoutCard(text, { width, height, maxLines });
  if (layout.lines.length === 0) return;

  const longest = layout.lines.reduce((acc, l) =>
    l.length > acc.length ? l : acc, "");
  const px = fitMonoText(ctx, longest, statMaxWidth, basePx, minPx);

  ctx.font = `${px}px ${MONO_FONT}`;
  ctx.textAlign = "center";
  const wrapped = truncateLines(
    ctx,
    wrapMono(ctx, text, statMaxWidth, px),
    maxLines,
    statMaxWidth
  ).lines;

  const lineH = px * 1.35;
  const top = 150;
  const bottom = height - 130;
  const blockH = wrapped.length * lineH;
  const y0 = top + Math.max(0, (bottom - top - blockH) / 2);
  const x = width / 2;

  ctx.globalAlpha = 0.25;
  ctx.fillStyle = GLITCH_CARD.blood;
  wrapped.forEach((line, i) => {
    const ly = y0 + i * lineH + lineH / 2;
    ctx.fillText(line, x - 4, ly);
    ctx.fillText(line, x + 4, ly);
  });

  ctx.globalAlpha = 1;
  ctx.fillStyle = GLITCH_CARD.ink;
  wrapped.forEach((line, i) => {
    ctx.fillText(line, x, y0 + i * lineH + lineH / 2);
  });

  const offsets = glitchOffsets(seed);
  const bandCount = offsets[3].y > 0 ? 2 : 1;
  ctx.fillStyle = GLITCH_CARD.blood;
  ctx.globalAlpha = 0.3;
  for (let b = 0; b < bandCount; b++) {
    const t = (offsets[b].y + 12) / 24;
    const bandY = y0 + t * Math.max(blockH, lineH);
    wrapped.forEach((line, i) => {
      const ly = y0 + i * lineH;
      if (ly + lineH >= bandY && ly <= bandY + 2) {
        ctx.fillText(line, x + 8, ly + lineH / 2);
        ctx.fillText(line, x - 8, ly + lineH / 2);
      }
    });
  }
  ctx.globalAlpha = 1;
}