"use client";

/**
 * V FOR X — Live Crisis Counters
 *
 * Animated real-time counters that tick up at statistically-derived
 * global rates. Each counter starts from a base computed from the
 * current time of day (for variety) and increments via requestAnimationFrame
 * with eased interpolation for a smooth "count-up" transition.
 *
 * Multiple counters compose into LiveCounterGrid.
 */

import { useEffect, useRef, useState } from "react";
import TerminalCard from "@/components/ui/TerminalCard";

/* ═══════════════════════════════════════════════════════════
   STATISTICAL RATES
   ═══════════════════════════════════════════════════════════ */

export type CounterType =
  | "hunger"
  | "conflict"
  | "displacement"
  | "child_mortality"
  | "poverty";

export interface CounterRate {
  /** Short label shown above the number. */
  label: string;
  /** Descriptive text shown below the number. */
  description: string;
  /** Seconds between each increment (the statistical rate). */
  secondsPerIncrement: number;
  /** Human-readable rate string, e.g. "1 every 4s". */
  rate: string;
  /** Accent color (CSS variable reference). */
  color: string;
  /** Emoji glyph. */
  emoji: string;
}

/**
 * Global statistical rates. Derived from widely-cited figures:
 *  - Hunger:        ~1 death every 4 seconds (~7.9M/yr)
 *  - Child mortality: ~1 death every 3.2 seconds (~9.9M/yr)
 *  - Displacement:    ~1 person every 2 seconds (~15.8M/yr)
 *  - Conflict:        ~1 every 5 minutes (battle-related + indirect)
 *  - Poverty:         ~1 person pushed into extreme poverty every 1s
 */
export const COUNTER_RATES: Record<CounterType, CounterRate> = {
  hunger: {
    label: "Hunger Deaths",
    description: "People who have died of hunger-related causes today.",
    secondsPerIncrement: 4,
    rate: "1 every 4s",
    color: "var(--color-blood-bright)",
    emoji: "🍲",
  },
  conflict: {
    label: "Conflict Deaths",
    description: "Deaths from armed conflict — direct and indirect — today.",
    secondsPerIncrement: 300,
    rate: "1 every 5m",
    color: "var(--color-blood)",
    emoji: "⚔️",
  },
  displacement: {
    label: "Forcibly Displaced",
    description: "People newly forced from their homes today.",
    secondsPerIncrement: 2,
    rate: "1 every 2s",
    color: "var(--color-warning-amber)",
    emoji: "🏃",
  },
  child_mortality: {
    label: "Child Deaths (Under-5)",
    description: "Children under 5 who have died today — mostly preventable.",
    secondsPerIncrement: 3.2,
    rate: "1 every 3.2s",
    color: "var(--color-blood-bright)",
    emoji: "👶",
  },
  poverty: {
    label: "Pushed Into Poverty",
    description: "People pushed into extreme poverty ($2.15/day) today.",
    secondsPerIncrement: 1,
    rate: "1 every 1s",
    color: "var(--color-command-bright)",
    emoji: "💸",
  },
};

/** The canonical grid order for all five counters. */
export const COUNTER_ORDER: CounterType[] = [
  "hunger",
  "child_mortality",
  "conflict",
  "displacement",
  "poverty",
];

/* ═══════════════════════════════════════════════════════════
   HOOK — animated live counter
   ═══════════════════════════════════════════════════════════ */

function useLiveCounter(secondsPerIncrement: number, intervalMs?: number) {
  // Base = approximate count since midnight (gives variety by time of day).
  const baseRef = useRef(0);
  if (baseRef.current === 0) {
    const now = new Date();
    const secSinceMidnight =
      now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    baseRef.current = Math.floor(secSinceMidnight / secondsPerIncrement);
  }

  const [display, setDisplay] = useState(baseRef.current);
  const targetRef = useRef(baseRef.current);
  const lastTickRef = useRef(Date.now());

  // Increment the target at the statistical rate.
  useEffect(() => {
    const tickMs = intervalMs ?? secondsPerIncrement * 1000;
    const id = window.setInterval(() => {
      const elapsed = (Date.now() - lastTickRef.current) / 1000;
      lastTickRef.current = Date.now();
      targetRef.current += elapsed / secondsPerIncrement;
    }, Math.min(tickMs, 1000));
    return () => window.clearInterval(id);
  }, [secondsPerIncrement, intervalMs]);

  // Ease the displayed number toward the target (smooth count-up).
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setDisplay((d) => {
        const target = targetRef.current;
        const diff = target - d;
        if (Math.abs(diff) < 0.5) return Math.round(target);
        return d + diff * 0.16;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return display;
}

/* ═══════════════════════════════════════════════════════════
   COMPONENT — single counter
   ═══════════════════════════════════════════════════════════ */

interface LiveCounterProps {
  counterType: CounterType;
  label?: string;
  intervalMs?: number;
}

export default function LiveCounter({
  counterType,
  label,
  intervalMs,
}: LiveCounterProps) {
  const rate = COUNTER_RATES[counterType];
  const display = useLiveCounter(rate.secondsPerIncrement, intervalMs);
  const shown = Math.floor(display);
  // Localized, grouped integer (e.g. 1,234,567).
  const formatted = shown.toLocaleString("en-US");

  return (
    <div className="flex flex-col gap-1">
      <div
        className="text-[10px] uppercase tracking-widest text-content-dim flex items-center gap-1.5"
      >
        <span aria-hidden>{rate.emoji}</span>
        <span>{label ?? rate.label}</span>
      </div>
      <div
        className="font-mono text-3xl sm:text-4xl font-bold tabular-nums glow-blood"
        style={{ color: rate.color, lineHeight: 1.1 }}
        aria-live="polite"
      >
        {formatted}
      </div>
      <div className="text-[10px] text-content-secondary leading-snug">
        {rate.description}
      </div>
      <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: rate.color }}>
        ▲ {rate.rate} · live estimate
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMPONENT — responsive grid of all five counters
   ═══════════════════════════════════════════════════════════ */

export function LiveCounterGrid() {
  return (
    <TerminalCard title="Live Crisis Counters" accent="blood" glow>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {COUNTER_ORDER.map((ct) => (
          <LiveCounter key={ct} counterType={ct} />
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-border-dim text-[10px] text-content-dim leading-relaxed">
        Counters derive from peer-reviewed global rates and are extrapolated live for
        illustration. They are not real-time verified counts. Source methodology:{" "}
        <span className="text-content-secondary">FAO · WHO · UNHCR · UCDP</span>.
      </div>
    </TerminalCard>
  );
}
