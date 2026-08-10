"use client";

import { useEffect, useMemo, useState } from "react";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import {
  computeGlobalToll,
  computeRealTimeToll,
  formatNumber,
  type TollBreakdown,
} from "@/lib/lives";
import type { EmbedTheme } from "@/lib/embed-widgets";
import { themeStyle } from "./EmbedShell";

const data = backbone as WorldBackbone;
const ALL_TOLL = computeGlobalToll(data);

const CAUSE_KEYS: Record<string, string> = {
  all: "all",
  hunger: "hunger",
  child_mortality: "child_mortality",
  conflict: "conflict",
  displacement: "displacement",
  poverty: "poverty",
};

function tollForCause(cause: string): TollBreakdown[] {
  if (cause === "all") return ALL_TOLL;
  return ALL_TOLL.filter((t) => t.causeKey === cause);
}

export default function EmbedLives({
  cause = "all",
  theme = "dark",
}: {
  cause?: string;
  theme?: EmbedTheme;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [startedAt] = useState(() => Date.now());
  const [cycleIdx, setCycleIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const toll = useMemo(() => tollForCause(CAUSE_KEYS[cause] ?? "all"), [cause]);
  const realTime = useMemo(
    () => computeRealTimeToll(toll, startedAt, now),
    [toll, startedAt, now]
  );

  const totalAnnual = toll.reduce((s, t) => s + t.annualDeaths, 0);

  // Cycle the breakdown caption when cause === all
  useEffect(() => {
    if (toll.length <= 1) return;
    const id = setInterval(() => setCycleIdx((i) => (i + 1) % toll.length), 3500);
    return () => clearInterval(id);
  }, [toll.length]);

  const current = toll[cycleIdx % toll.length];

  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center text-center px-4 py-6"
      style={{ ...themeStyle(theme) }}
    >
      <div
        className="text-[10px] uppercase tracking-widest mb-1"
        style={{ color: "var(--color-content-dim)" }}
      >
        {current?.icon} {cause === "all" ? "preventable deaths" : current?.cause}
      </div>

      <div
        className="font-mono tabular-nums font-bold leading-none glow-blood"
        style={{
          color: "var(--color-blood-bright)",
          fontSize: "clamp(2.5rem, 9vw, 4.5rem)",
        }}
        aria-live="polite"
      >
        {realTime.sinceVisit.toLocaleString()}
      </div>

      <div
        className="text-[11px] mt-2 max-w-[90%]"
        style={{ color: "var(--color-content-secondary)" }}
      >
        lives lost since this widget loaded
      </div>

      <div className="flex items-center gap-4 mt-3 text-[10px]" style={{ color: "var(--color-content-dim)" }}>
        <span>
          <b style={{ color: "var(--color-blood-bright)" }}>{realTime.perSecond}</b> /sec
        </span>
        <span>
          <b style={{ color: "var(--color-blood-bright)" }}>{formatNumber(realTime.today)}</b> today
        </span>
        <span>
          <b style={{ color: "var(--color-blood-bright)" }}>{formatNumber(totalAnnual)}</b> /yr
        </span>
      </div>

      {current?.preventionNote && (
        <div
          className="mt-3 text-[10px] px-2 py-1 border max-w-[90%]"
          style={{
            borderColor: "var(--color-terminal-green)",
            color: "var(--color-terminal-green)",
            backgroundColor: "transparent",
            opacity: 0.9,
          }}
        >
          {current.preventionCostBillion
            ? `Preventable for $${current.preventionCostBillion}B/yr · `
            : ""}
          {current.preventionNote}
        </div>
      )}
    </div>
  );
}
