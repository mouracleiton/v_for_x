"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/stores/useStore";
import { branchLinks } from "@/lib/crosslinks";
import { sound } from "@/lib/sound";
import SoundToggle from "@/components/ui/SoundToggle";
import { useEffect, useRef } from "react";

export default function BranchNav() {
  const pathname = usePathname();
  const { navOpen, setNavOpen } = useStore();
  const drawerRef = useRef<HTMLDivElement>(null);

  const guyFawkesAscii = [
    "    .:::::::::::.",
    "  ::'  ._-___-_'  ::",
    " ::   .'       '.  ::",
    "::   /  ^     ^  \\  ::",
    "::  |  (o)   (o)  | ::",
    "::  |      o       | ::",
    " ::  \\    ___     /  ::",
    "  :::'.  - - -  .:::",
    "    ':::::::::::::::'",
  ].join("\n");

  // Close drawer on route change (pathname change)
  useEffect(() => {
    setNavOpen(false);
  }, [pathname, setNavOpen]);

  // Close drawer on Escape
  useEffect(() => {
    if (!navOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navOpen, setNavOpen]);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (navOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden md:flex flex-col gap-0 border-r border-border-dim bg-abyss h-screen sticky top-0 w-56 shrink-0">
        <Link
          href="/"
          className="block p-4 border-b border-border-dim hover:bg-panel transition-colors"
          onClick={() => sound.nav()}
        >
          <pre className="text-blood text-[8px] leading-tight">{guyFawkesAscii}</pre>
          <div className="text-blood-bright text-xs font-bold tracking-widest mt-1 flex items-center gap-1">
            🦀 V FOR X
          </div>
        </Link>

        <div className="flex-1 overflow-y-auto">
          {branchLinks.map((b) => {
            const active = pathname === b.href;
            return (
              <Link
                key={b.href}
                href={b.href}
                className={`flex items-center gap-2 px-4 py-2 text-xs border-b border-border-dim transition-colors ${
                  active
                    ? "bg-panel text-blood-bright border-l-2 border-l-blood"
                    : "text-content-secondary hover:text-content-primary hover:bg-panel"
                }`}
                onClick={() => sound.nav()}
              >
                <span className="text-content-dim">[{b.code}]</span>
                <span>{b.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="p-3 border-t border-border-dim">
          <div className="flex items-center justify-between gap-2">
            <SoundToggle />
            <button
              onClick={() => {
                // Dispatch the Cmd+K shortcut programmatically
                const evt = new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: navigator.platform.includes("Mac") });
                window.dispatchEvent(evt);
              }}
              className="text-[9px] px-2 py-1 border border-border-dim text-content-dim hover:border-blood hover:text-blood-bright transition-colors"
            >
              ⌘K SEARCH
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile nav — sticky top bar */}
      <div className="md:hidden no-print sticky top-0 z-50">
        <div
          className="flex items-center justify-between px-4 py-2 border-b border-border-dim bg-abyss"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
        >
          <Link
            href="/"
            className="text-blood-bright text-sm font-bold tracking-widest"
            onClick={() => sound.nav()}
          >
            <span className="text-blood">🦀</span> FOR X
          </Link>
          <div className="flex items-center gap-2">
            <SoundToggle />
            <button
              onClick={() => setNavOpen(!navOpen)}
              className="flex flex-col gap-1 px-3 py-2 border border-border-dim text-content-secondary active:bg-panel transition-colors"
              aria-label="Toggle navigation menu"
              aria-expanded={navOpen}
            >
              <span className="block w-4 h-px bg-current" />
              <span className="block w-4 h-px bg-current" />
              <span className="block w-4 h-px bg-current" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {navOpen && (
        <div
          className="md:hidden fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
          onClick={() => setNavOpen(false)}
        />
      )}

      {/* Mobile drawer — slide-in from right */}
      <div
        ref={drawerRef}
        className={`md:hidden no-print fixed top-0 right-0 z-[61] w-[280px] max-w-[85vw] bg-abyss border-l border-blood-dim transition-transform duration-300 ${
          navOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          height: "100dvh",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-dim">
          <span className="text-xs text-content-dim uppercase tracking-widest">
            // Navigate
          </span>
          <button
            onClick={() => setNavOpen(false)}
            className="px-3 py-1 text-xs text-content-secondary border border-border-dim active:bg-panel"
            aria-label="Close navigation"
          >
            [ ✕ CLOSE ]
          </button>
        </div>

        {/* Drawer links — large tap targets */}
        <div className="overflow-y-auto" style={{ maxHeight: "calc(100dvh - 120px)" }}>
          {branchLinks.map((b) => {
            const active = pathname === b.href;
            return (
              <Link
                key={b.href}
                href={b.href}
                className={`flex items-center gap-3 px-4 py-3 text-sm border-b border-border-dim transition-colors ${
                  active
                    ? "bg-panel text-blood-bright border-l-2 border-l-blood"
                    : "text-content-secondary active:text-blood-bright active:bg-panel"
                }`}
                onClick={() => {
                  setNavOpen(false);
                  sound.nav();
                }}
              >
                <span className="text-content-dim text-xs">[{b.code}]</span>
                <span className="font-bold">{b.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Drawer footer */}
        <div
          className="px-4 py-3 border-t border-border-dim"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
        >
          <Link
            href="/"
            className="block text-center text-xs text-content-dim"
            onClick={() => {
              setNavOpen(false);
              sound.nav();
            }}
          >
            ◆ V FOR X — the platform that refuses to die
          </Link>
        </div>
      </div>
    </>
  );
}
