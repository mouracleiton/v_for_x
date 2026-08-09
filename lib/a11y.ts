/**
 * V FOR X — Accessibility Utilities
 *
 * Central accessibility state shape, persistence, and application logic.
 * Settings are persisted to localStorage under the key "vfx-a11y" and
 * applied to <html> as data-attributes + an inline CSS variable so the whole
 * UI can react without edits to globals.css.
 *
 * NOTE (future i18n): the human-readable strings in this file (SkipLink label,
 * ariaLabel dictionary) are hard-coded English for now. When the platform's
 * translation layer is extended to cover accessibility copy, swap these for
 * `t(lang, ...)` lookups. // i18n: TODO
 */

import { createElement } from "react";
import type { JSX } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   TYPES & DEFAULTS
   ═══════════════════════════════════════════════════════════════════════ */

export interface A11ySettings {
  /** Visual theme preset. "default" = Command Center (dark). */
  theme: "default" | "high-contrast" | "large-text";
  /** Disable all CSS animations/transitions. */
  reduceMotion: boolean;
  /** Add extra ARIA descriptions to interactive widgets. */
  screenReaderHints: boolean;
  /** Base font size as a percentage (90–150). 100 = platform default. */
  fontSize: number;
}

export const DEFAULT_A11Y_SETTINGS: A11ySettings = {
  theme: "default",
  reduceMotion: false,
  screenReaderHints: false,
  fontSize: 100,
};

const STORAGE_KEY = "vfx-a11y";
const RUNTIME_STYLE_ID = "vfx-a11y-runtime";
const MIN_FONT = 90;
const MAX_FONT = 150;

/* ═══════════════════════════════════════════════════════════════════════
   RUNTIME STYLESHEET
   Injected at runtime (never edits globals.css). Provides the visual
   behaviour for the data-attributes we set on <html>, plus the skip-link.
   ═══════════════════════════════════════════════════════════════════════ */

const RUNTIME_CSS = `
:root { --vfx-font-scale: 1; }
body { font-size: calc(14px * var(--vfx-font-scale, 1)) !important; }

/* ── Skip-to-content link ── */
.vfx-skip-link {
  position: fixed;
  top: -120px;
  left: 0;
  z-index: 10000;
  padding: 10px 16px;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  background: var(--color-void);
  color: var(--color-terminal-green) !important;
  border: 1px solid var(--color-terminal-green);
  border-top: none;
  transition: top 0.15s ease-in-out;
}
.vfx-skip-link:focus {
  top: 0;
  outline: 2px solid var(--color-terminal-green);
  outline-offset: 2px;
}

/* ── High-contrast theme: bright white background, black text ── */
[data-a11y-theme="high-contrast"] body,
[data-a11y-theme="high-contrast"] nav,
[data-a11y-theme="high-contrast"] main,
[data-a11y-theme="high-contrast"] aside,
[data-a11y-theme="high-contrast"] section,
[data-a11y-theme="high-contrast"] .terminal-card {
  background: #ffffff !important;
  color: #000000 !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border-color: #000000 !important;
  box-shadow: none !important;
}
[data-a11y-theme="high-contrast"] a,
[data-a11y-theme="high-contrast"] a:hover,
[data-a11y-theme="high-contrast"] button,
[data-a11y-theme="high-contrast"] input,
[data-a11y-theme="high-contrast"] select,
[data-a11y-theme="high-contrast"] textarea,
[data-a11y-theme="high-contrast"] th,
[data-a11y-theme="high-contrast"] td,
[data-a11y-theme="high-contrast"] label,
[data-a11y-theme="high-contrast"] span,
[data-a11y-theme="high-contrast"] div,
[data-a11y-theme="high-contrast"] p {
  color: #000000 !important;
  text-shadow: none !important;
}
[data-a11y-theme="high-contrast"] .scanlines::before,
[data-a11y-theme="high-contrast"] .grain::before,
[data-a11y-theme="high-contrast"] .crt-vignette::after {
  display: none !important;
}

/* ── Reduce motion: neutralise all animations/transitions ── */
[data-reduce-motion="true"] *,
[data-reduce-motion="true"] *::before,
[data-reduce-motion="true"] *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}
[data-reduce-motion="true"] html {
  scroll-behavior: auto !important;
}
`;

function ensureRuntimeStyle(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(RUNTIME_STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = RUNTIME_STYLE_ID;
  el.textContent = RUNTIME_CSS;
  document.head.appendChild(el);
}

/* ═══════════════════════════════════════════════════════════════════════
   PERSISTENCE
   ═══════════════════════════════════════════════════════════════════════ */

/** SSR- and privacy-safe localStorage accessor. */
function safeLocalStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Defensively normalise an unknown blob into a valid A11ySettings object. */
function normalize(raw: unknown): A11ySettings {
  const d = DEFAULT_A11Y_SETTINGS;
  if (!raw || typeof raw !== "object") return { ...d };
  const o = raw as Record<string, unknown>;

  const theme: A11ySettings["theme"] =
    o.theme === "high-contrast" || o.theme === "large-text" ? o.theme : "default";

  const reduceMotion = o.reduceMotion === true;
  const screenReaderHints = o.screenReaderHints === true;

  let fontSize = typeof o.fontSize === "number" ? o.fontSize : d.fontSize;
  if (!Number.isFinite(fontSize)) fontSize = d.fontSize;
  fontSize = Math.max(MIN_FONT, Math.min(MAX_FONT, Math.round(fontSize)));

  return { theme, reduceMotion, screenReaderHints, fontSize };
}

/** Load persisted accessibility settings, falling back to defaults. */
export function loadA11ySettings(): A11ySettings {
  const ls = safeLocalStorage();
  if (!ls) return { ...DEFAULT_A11Y_SETTINGS };
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_A11Y_SETTINGS };
    return normalize(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_A11Y_SETTINGS };
  }
}

/** Persist accessibility settings to localStorage ("vfx-a11y"). */
export function saveA11ySettings(settings: A11ySettings): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* Storage disabled or quota exceeded — settings stay session-only. */
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   APPLICATION
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Apply accessibility settings to document.documentElement as data-attributes
 * and an inline CSS variable. Safe to call on every change; idempotent.
 */
export function applyA11ySettings(settings: A11ySettings): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.dataset.a11yTheme = settings.theme;
  root.dataset.reduceMotion = String(settings.reduceMotion);
  root.dataset.srHints = String(settings.screenReaderHints);

  // Effective font scale = slider value × (large-text theme adds 1.3×).
  const sliderScale = settings.fontSize / 100;
  const themeScale = settings.theme === "large-text" ? 1.3 : 1;
  root.style.setProperty("--vfx-font-scale", String(sliderScale * themeScale));

  ensureRuntimeStyle();
}

/* ═══════════════════════════════════════════════════════════════════════
   SKIP-LINK COMPONENT
   Visually hidden until focused — lets keyboard users jump past navigation.
   (i18n: TODO — label is English for now.)
   ═══════════════════════════════════════════════════════════════════════ */

export function SkipLink({ targetId }: { targetId: string }): JSX.Element {
  // Make sure the skip-link CSS is present whenever the link renders.
  ensureRuntimeStyle();
  return createElement(
    "a",
    {
      href: `#${targetId}`,
      className: "vfx-skip-link",
    },
    "Skip to main content",
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ARIA LABEL DICTIONARY
   (i18n: TODO — English copy for now.)
   ═══════════════════════════════════════════════════════════════════════ */

const ARIA_LABELS: Record<string, string> = {
  map: "Interactive crisis map. Pan by dragging or using arrow keys. Markers mark documented conflict and crisis zones; activate a marker to read its description.",
  chart: "Data visualization chart. All values are also available in the adjacent data table for screen-reader users.",
  counter: "Live statistics counter. The current figure is shown in large type.",
  search: "Search field. Type to filter results, then press Enter to open the top match.",
  slider: "Adjustable slider. Use the left and right arrow keys to change the value.",
  panel: "Accessibility settings panel. Adjust colour theme, motion, screen-reader hints, and text size.",
  dropdown: "Dropdown selector. Open it and choose an option with the arrow keys.",
};

/**
 * Return a descriptive ARIA label for a common UI element key
 * (map, chart, counter, search, slider, panel, dropdown). Falls back to the
 * raw key when no match is found.
 */
export function ariaLabel(key: string): string {
  return ARIA_LABELS[key] ?? key;
}
