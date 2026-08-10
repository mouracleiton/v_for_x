"use client";

import Link from "next/link";
import type { EmbedTheme } from "@/lib/embed-widgets";

/**
 * Theme variable overrides for the light palette. Applied as inline CSS
 * custom properties on the embed root so all child `var(--color-*)`
 * references cascade correctly inside a third-party iframe.
 */
const LIGHT_VARS: React.CSSProperties = {
  // Inline style typed as CSSProperties won't accept custom properties, so
  // we cast through the React style merge at runtime below.
  ...({
    "--color-void": "#ffffff",
    "--color-abyss": "#f5f7fa",
    "--color-panel": "#eef2f7",
    "--color-panel-hi": "#e7edf4",
    "--color-border-dim": "#dde3ec",
    "--color-border-bright": "#c4cdda",
    "--color-content-primary": "#1a2233",
    "--color-content-secondary": "#5a6b85",
    "--color-content-dim": "#9aa8bd",
  }) as React.CSSProperties,
};

const DARK_VARS: React.CSSProperties = {
  ...({
    "--color-void": "#060b14",
    "--color-abyss": "#0a1220",
  }) as React.CSSProperties,
};

export function themeStyle(theme: EmbedTheme): React.CSSProperties {
  return theme === "light" ? LIGHT_VARS : DARK_VARS;
}

interface EmbedShellProps {
  theme: EmbedTheme;
  /** The widget label shown in the top bar. */
  label: string;
  children: React.ReactNode;
  /** Show the "powered by V FOR X" syndication back-link. Default true. */
  showAttribution?: boolean;
}

/**
 * Frames every embeddable widget: a slim header label, the widget body, and
 * a persistent "powered by V FOR X" attribution that turns every embed into
 * a syndication vector back to the platform.
 */
export default function EmbedShell({
  theme,
  label,
  children,
  showAttribution = true,
}: EmbedShellProps) {
  const isLight = theme === "light";
  return (
    <div
      className="w-full h-full min-h-screen flex flex-col"
      style={{
        ...themeStyle(theme),
        backgroundColor: "var(--color-void)",
        color: "var(--color-content-primary)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {/* Slim header */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b shrink-0"
        style={{
          borderColor: "var(--color-border-dim)",
          backgroundColor: "var(--color-abyss)",
        }}
      >
        <span
          className="text-[9px] uppercase tracking-widest truncate"
          style={{ color: "var(--color-content-dim)" }}
        >
          ▶ {label}
        </span>
        <span
          className="text-[8px] uppercase tracking-wider shrink-0 ml-2"
          style={{ color: isLight ? "var(--color-blood)" : "var(--color-blood-bright)" }}
        >
          LIVE
        </span>
      </div>

      {/* Widget body */}
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>

      {/* Attribution — the syndication vector */}
      {showAttribution && (
        <div
          className="flex items-center justify-between px-3 py-1 border-t shrink-0"
          style={{
            borderColor: "var(--color-border-dim)",
            backgroundColor: "var(--color-abyss)",
          }}
        >
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] font-bold uppercase tracking-widest no-underline transition-opacity hover:opacity-80"
            style={{ color: isLight ? "var(--color-blood)" : "var(--color-blood-bright)" }}
          >
            🦀 V FOR X
          </Link>
          <span className="text-[8px]" style={{ color: "var(--color-content-dim)" }}>
            open data against hunger
          </span>
        </div>
      )}
    </div>
  );
}
