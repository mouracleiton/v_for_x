"use client";

import { useEffect, useState, useCallback } from "react";
import { sound } from "@/lib/sound";

const SHOW_DELAY = 1200;

export default function EasterEggPopup() {
  const [visible, setVisible] = useState(false);

  const close = useCallback(() => {
    setVisible(false);
    sound.nav();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
      sound.success();
    }, SHOW_DELAY);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [visible, close]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Hidden transmission"
      onClick={close}
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />

      <div
        className="relative max-w-md w-full scanlines crt-vignette"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-2 border-[var(--color-blood)] bg-[var(--color-panel)] shadow-[0_0_40px_rgba(196,43,62,0.4)]">
          <div className="flex items-center justify-between px-3 py-2 bg-[var(--color-blood-dim)] border-b border-[var(--color-blood)]">
            <span className="text-[10px] sm:text-xs font-mono tracking-[0.2em] uppercase text-[var(--color-blood-bright)]">
              ▣ intercepted transmission
            </span>
            <button
              onClick={close}
              aria-label="Dismiss transmission"
              className="text-[var(--color-content-secondary)] hover:text-[var(--color-blood-bright)] text-sm font-mono transition-colors px-1"
            >
              [✕]
            </button>
          </div>

          <div className="relative">
            <img
              src="/easter-egg.png"
              alt=""
              className="w-full block select-none"
              draggable={false}
            />
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-[var(--color-void)]/60" />
          </div>

          <div className="px-3 py-2 border-t border-[var(--color-border-dim)] bg-[var(--color-abyss)]">
            <p className="text-[10px] sm:text-xs font-mono text-[var(--color-content-dim)] text-center tracking-wider">
              the signal is always there — you just have to look
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
