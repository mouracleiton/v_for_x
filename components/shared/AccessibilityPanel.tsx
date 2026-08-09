"use client";

/**
 * V FOR X — AccessibilityPanel
 *
 * A compact, always-available pill button (bottom-right) that expands into a
 * full accessibility control panel:
 *   • Theme preset: Command Center (default dark) / High Contrast / Large Text
 *   • Reduce Motion toggle
 *   • Screen Reader Hints toggle
 *   • Font-size slider (90%–150%)
 *   • Reset to Default
 *
 * State persists to localStorage ("vfx-a11y") and is applied live via the
 * helpers in @/lib/a11y (data-attributes + CSS variables on <html>).
 *
 * (i18n: TODO — all visible copy is English for now; swap for t(lang, ...)
 * when the translation dictionary covers accessibility strings.)
 */

import { useEffect, useState } from "react";
import { sound } from "@/lib/sound";
import {
  type A11ySettings,
  DEFAULT_A11Y_SETTINGS,
  loadA11ySettings,
  saveA11ySettings,
  applyA11ySettings,
  ariaLabel,
} from "@/lib/a11y";

type ThemeId = A11ySettings["theme"];

const THEMES: { id: ThemeId; label: string; hint: string }[] = [
  { id: "default", label: "Command Center", hint: "Dark command-center theme" },
  { id: "high-contrast", label: "High Contrast", hint: "White background, black text" },
  { id: "large-text", label: "Large Text", hint: "Scale all text 1.3×" },
];

export default function AccessibilityPanel() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<A11ySettings>(DEFAULT_A11Y_SETTINGS);

  // Load persisted settings on mount and apply them immediately.
  useEffect(() => {
    const loaded = loadA11ySettings();
    setSettings(loaded);
    applyA11ySettings(loaded);
    setMounted(true);
  }, []);

  // Persist + apply whenever settings change (after initial mount).
  useEffect(() => {
    if (!mounted) return;
    saveA11ySettings(settings);
    applyA11ySettings(settings);
  }, [settings, mounted]);

  const patch = (partial: Partial<A11ySettings>) =>
    setSettings((prev) => ({ ...prev, ...partial }));

  const reset = () => {
    sound.select();
    setSettings({ ...DEFAULT_A11Y_SETTINGS });
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] no-print"
      role="region"
      aria-label={ariaLabel("panel")}
    >
      {/* ── Pill toggle button ── */}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          sound.select();
        }}
        aria-expanded={open}
        aria-controls="vfx-a11y-panel"
        className="inline-flex items-center gap-2 px-3 py-2 text-[11px] tracking-widest uppercase border bg-abyss/90 backdrop-blur border-border-bright text-terminal-green hover:border-terminal-green transition-colors shadow-lg"
      >
        <span aria-hidden="true">♿</span>
        <span>A11Y</span>
        <span className="text-content-dim" aria-hidden="true">
          {open ? "▾" : "▴"}
        </span>
      </button>

      {/* ── Expanded panel ── */}
      {open && (
        <div
          id="vfx-a11y-panel"
          className="terminal-card mt-2 p-4 w-[280px] max-w-[calc(100vw-2rem)]"
        >
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-border-dim">
            <span className="text-[11px] uppercase tracking-widest text-terminal-green font-bold">
              {"> "}Accessibility
            </span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                sound.select();
              }}
              className="text-[10px] text-content-dim hover:text-blood-bright"
              aria-label="Close accessibility panel"
            >
              [ ✕ ]
            </button>
          </div>

          {/* ── Theme ── */}
          <fieldset className="mb-4">
            <legend className="text-[10px] uppercase tracking-widest text-content-dim mb-2">
              Theme
            </legend>
            <div className="grid grid-cols-1 gap-1">
              {THEMES.map((th) => {
                const active = settings.theme === th.id;
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => {
                      patch({ theme: th.id });
                      sound.select();
                    }}
                    aria-pressed={active}
                    title={th.hint}
                    className={`text-left text-[11px] px-2 py-1.5 border transition-colors ${
                      active
                        ? "border-terminal-green text-terminal-green bg-terminal-green/5"
                        : "border-border-dim text-content-secondary hover:border-terminal-green"
                    }`}
                  >
                    {active ? "◉" : "○"} {th.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* ── Reduce motion ── */}
          <label className="flex items-center justify-between gap-2 mb-3 text-[11px] text-content-secondary">
            <span>Reduce Motion</span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.reduceMotion}
              aria-label="Reduce motion"
              onClick={() => {
                patch({ reduceMotion: !settings.reduceMotion });
                sound.select();
              }}
              className={`relative w-10 h-5 border transition-colors ${
                settings.reduceMotion
                  ? "border-terminal-green bg-terminal-green/20"
                  : "border-border-bright bg-void"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 transition-transform ${
                  settings.reduceMotion
                    ? "translate-x-5 bg-terminal-green"
                    : "bg-content-dim"
                }`}
              />
            </button>
          </label>

          {/* ── Screen reader hints ── */}
          <label className="flex items-center justify-between gap-2 mb-4 text-[11px] text-content-secondary">
            <span>Screen Reader Hints</span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.screenReaderHints}
              aria-label="Screen reader hints"
              onClick={() => {
                patch({ screenReaderHints: !settings.screenReaderHints });
                sound.select();
              }}
              className={`relative w-10 h-5 border transition-colors ${
                settings.screenReaderHints
                  ? "border-terminal-green bg-terminal-green/20"
                  : "border-border-bright bg-void"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 transition-transform ${
                  settings.screenReaderHints
                    ? "translate-x-5 bg-terminal-green"
                    : "bg-content-dim"
                }`}
              />
            </button>
          </label>

          {/* ── Font size slider ── */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="vfx-a11y-fontsize"
                className="text-[10px] uppercase tracking-widest text-content-dim"
              >
                Font Size
              </label>
              <span className="text-[11px] text-terminal-green font-bold">
                {settings.fontSize}%
              </span>
            </div>
            <input
              id="vfx-a11y-fontsize"
              type="range"
              min={90}
              max={150}
              step={5}
              value={settings.fontSize}
              onChange={(e) => patch({ fontSize: Number(e.target.value) })}
              aria-label={ariaLabel("slider")}
              className="allocator-slider w-full"
            />
            <div className="flex justify-between text-[9px] text-content-dim mt-0.5">
              <span>90%</span>
              <span>150%</span>
            </div>
          </div>

          {/* ── Reset ── */}
          <button
            type="button"
            onClick={reset}
            className="w-full text-[11px] tracking-widest uppercase px-2 py-1.5 border border-blood-dim text-blood-bright hover:border-blood hover:bg-blood hover:text-void transition-colors"
          >
            ↺ Reset to Default
          </button>
        </div>
      )}
    </div>
  );
}
