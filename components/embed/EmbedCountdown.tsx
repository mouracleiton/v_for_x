"use client";

import { useEffect, useMemo, useState } from "react";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, SdgEquation } from "@/lib/types";
import type { EmbedTheme } from "@/lib/embed-widgets";
import { themeStyle } from "./EmbedShell";

const data = backbone as WorldBackbone;

const SDG_ICONS: Record<string, string> = {
  droplet: "💧",
  "heart-pulse": "❤️",
  zap: "⚡",
  "book-open": "📖",
  globe: "🌍",
  scale: "⚖️",
};

function formatCost(cost: SdgEquation["cost"]): string {
  return cost.annual_trillion ? `$${cost.annual_trillion}T/yr` : `$${cost.annual_billion}B/yr`;
}

const TARGET_YEAR = 2030;

function yearsLeft(): number {
  return Math.max(0, TARGET_YEAR - new Date().getFullYear());
}

export default function EmbedCountdown({
  sdg = "all",
  theme = "dark",
}: {
  sdg?: string;
  theme?: EmbedTheme;
}) {
  const equations = data.sdg_equations?.equations ?? {};
  const allKeys = useMemo(() => Object.keys(equations), [equations]);

  // Resolve the active key(s)
  const targetKeys = useMemo(() => {
    if (sdg === "all") return allKeys;
    const match = allKeys.find((k) => k.includes(`sdg${sdg}_`));
    return match ? [match] : allKeys;
  }, [sdg, allKeys]);

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (targetKeys.length <= 1) return;
    setIdx(0);
    const id = setInterval(() => setIdx((i) => (i + 1) % targetKeys.length), 4500);
    return () => clearInterval(id);
  }, [targetKeys.length]);

  const activeKey = targetKeys[idx % targetKeys.length];
  const eq = equations[activeKey];

  if (!eq) {
    return (
      <div
        className="h-full w-full flex items-center justify-center text-xs"
        style={{ ...themeStyle(theme), color: "var(--color-content-dim)" }}
      >
        No SDG data
      </div>
    );
  }

  const left = yearsLeft();
  const pctMilitary = eq.affordability?.pct_military ?? 0;
  const daysMilitary = eq.affordability?.days_of_military ?? 0;

  return (
    <div
      className="h-full w-full flex flex-col justify-center px-4 py-4"
      style={{ ...themeStyle(theme) }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{SDG_ICONS[eq.icon] ?? "◆"}</span>
        <span
          className="text-[10px] font-mono px-1.5 py-0.5 border"
          style={{ borderColor: "var(--color-blood)", color: "var(--color-blood-bright)" }}
        >
          SDG {eq.sdg}
        </span>
        <span
          className="text-[9px] uppercase tracking-wide"
          style={{ color: "var(--color-content-dim)" }}
        >
          {left} yrs to 2030
        </span>
      </div>

      <div
        className="text-lg font-bold leading-tight mb-0.5"
        style={{ color: "var(--color-content-primary)" }}
      >
        {eq.title}
      </div>
      <div className="text-[11px] italic mb-2" style={{ color: "var(--color-content-secondary)" }}>
        &ldquo;{eq.moral_framing}&rdquo;
      </div>

      <div className="flex items-end gap-3 mb-2">
        <div>
          <div className="text-[9px] uppercase tracking-widest" style={{ color: "var(--color-content-dim)" }}>
            the cost
          </div>
          <div
            className="text-3xl font-bold leading-none"
            style={{ color: "var(--color-blood-bright)" }}
          >
            {formatCost(eq.cost)}
          </div>
        </div>
        <div className="pb-0.5 text-[10px]" style={{ color: "var(--color-content-dim)" }}>
          = <b style={{ color: "var(--color-blood-bright)" }}>{pctMilitary}%</b> of military
          <br />
          = <b style={{ color: "var(--color-blood-bright)" }}>{daysMilitary}</b> days of war budget
        </div>
      </div>

      {/* Deadline bar */}
      <div
        className="h-1.5 w-full border"
        style={{ borderColor: "var(--color-border-dim)", backgroundColor: "var(--color-abyss)" }}
      >
        <div
          className="h-full"
          style={{
            width: `${Math.max(4, Math.min(100, ((10 - left) / 10) * 100))}%`,
            backgroundColor: "var(--color-blood-bright)",
          }}
        />
      </div>
      <div className="flex justify-between text-[8px] mt-0.5" style={{ color: "var(--color-content-dim)" }}>
        <span>2015</span>
        <span>DEADLINE 2030</span>
      </div>

      {targetKeys.length > 1 && (
        <div className="flex gap-1 justify-center mt-2">
          {targetKeys.map((_, i) => (
            <span
              key={i}
              className="h-1 transition-all"
              style={{
                width: i === idx ? 18 : 6,
                backgroundColor:
                  i === idx ? "var(--color-blood-bright)" : "var(--color-border-dim)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
