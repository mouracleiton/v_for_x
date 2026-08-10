"use client";

import { useMemo } from "react";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, CountryData } from "@/lib/types";
import { formatNumber, formatMoney, formatPct, wfpClassLabel } from "@/lib/format";
import type { EmbedTheme } from "@/lib/embed-widgets";
import { themeStyle } from "./EmbedShell";

const data = backbone as WorldBackbone;

interface Row {
  label: string;
  value: string;
  accent?: boolean;
}

function buildRows(c: CountryData): Row[] {
  return [
    { label: "Population", value: `${formatNumber(c.demographics.population)} (${c.population_m.toFixed(1)}M)` },
    { label: "Undernourishment", value: formatPct(c.hunger.undernourishment_pct), accent: true },
    { label: "Famine risk", value: c.hunger.famine_risk_1to5 != null ? `${c.hunger.famine_risk_1to5}/5` : "N/A", accent: (c.hunger.famine_risk_1to5 ?? 0) >= 3 },
    { label: "Conflict intensity", value: `${c.conflict.intensity_1to5}/5`, accent: c.conflict.intensity_1to5 >= 3 },
    { label: "Child mortality (U5)", value: c.health.child_mortality_under5_per1k != null ? `${c.health.child_mortality_under5_per1k.toFixed(1)}/1k` : "N/A" },
    { label: "Life expectancy", value: c.health.life_expectancy != null ? `${c.health.life_expectancy.toFixed(1)} yrs` : "N/A" },
    { label: "Extreme poverty", value: formatPct(c.poverty.headcount_365_pct) },
    { label: "GDP per capita", value: formatMoney(c.economy.gdp_per_capita_usd) },
    { label: "Water access", value: formatPct(c.water_sanitation.basic_access_pct) },
    { label: "Military spending", value: c.military.pct_gdp != null ? `${c.military.pct_gdp.toFixed(1)}% GDP` : "N/A" },
  ];
}

export default function EmbedBrief({
  country = "SDN",
  theme = "dark",
}: {
  country?: string;
  theme?: EmbedTheme;
}) {
  const c = useMemo(
    () =>
      data.countries.find(
        (x) => x.iso3.toLowerCase() === country.toLowerCase()
      ),
    [country]
  );

  if (!c) {
    return (
      <div
        className="h-full w-full flex items-center justify-center text-xs p-4 text-center"
        style={{ ...themeStyle(theme), color: "var(--color-content-dim)" }}
      >
        Country &ldquo;{country}&rdquo; not found.
      </div>
    );
  }

  const rows = buildRows(c);
  const hotspot = c.is_hotspot;

  return (
    <div
      className="h-full w-full flex flex-col overflow-hidden"
      style={{ ...themeStyle(theme) }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 border-b shrink-0"
        style={{ borderColor: "var(--color-border-dim)" }}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-lg font-bold leading-none" style={{ color: "var(--color-content-primary)" }}>
            {c.name_en}
          </span>
          <span className="text-[10px]" style={{ color: "var(--color-content-dim)" }}>
            {c.iso3} · {c.region}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          {hotspot && (
            <span
              className="text-[8px] px-1 py-0.5 uppercase tracking-wider border"
              style={{ borderColor: "var(--color-blood)", color: "var(--color-blood-bright)" }}
            >
              ● HOTSPOT
            </span>
          )}
          {c.hunger.wfp_class && (
            <span
              className="text-[8px] px-1 py-0.5 uppercase tracking-wider border"
              style={{ borderColor: "var(--color-border-bright)", color: "var(--color-content-secondary)" }}
            >
              {wfpClassLabel(c.hunger.wfp_class)}
            </span>
          )}
        </div>
      </div>

      {/* Data grid */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="text-[9px] uppercase tracking-wide" style={{ color: "var(--color-content-dim)" }}>
                {r.label}
              </div>
              <div
                className="text-sm font-bold leading-tight"
                style={{
                  color: r.accent ? "var(--color-blood-bright)" : "var(--color-content-primary)",
                }}
              >
                {r.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer framing */}
      <Link
        href={`/sorrow-map/${c.iso3.toLowerCase()}/`}
        target="_blank"
        rel="noopener noreferrer"
        className="block px-3 py-1.5 border-t text-[10px] no-underline shrink-0 transition-opacity hover:opacity-80"
        style={{
          borderColor: "var(--color-border-dim)",
          color: "var(--color-blood-bright)",
          backgroundColor: "var(--color-abyss)",
        }}
      >
        ▶ Full dossier — {c.name_en} →
      </Link>
    </div>
  );
}
