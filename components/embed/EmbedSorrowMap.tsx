"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import { MAP_METRICS } from "@/lib/embed-widgets";
import type { EmbedTheme } from "@/lib/embed-widgets";
import { themeStyle } from "./EmbedShell";

const ChoroplethMap = dynamic(() => import("@/components/map/ChoroplethMap"), {
  ssr: false,
  loading: () => null,
});

const data = backbone as WorldBackbone;

type GeoFeatureCollection = {
  type: "FeatureCollection";
  features: { properties: Record<string, unknown> }[];
};

function computeRange(dimKey: string, geo: GeoFeatureCollection | null): [number, number] {
  if (!geo) return [0, 1];
  let min = Infinity;
  let max = -Infinity;
  for (const f of geo.features) {
    const raw = f.properties[dimKey];
    if (typeof raw === "number" && !isNaN(raw) && isFinite(raw)) {
      if (raw < min) min = raw;
      if (raw > max) max = raw;
    }
  }
  if (min === Infinity || max === -Infinity) return [0, 1];
  if (min === max) return [min, min + 1];
  return [min, max];
}

export default function EmbedSorrowMap({
  metric = "hunger_undernourishment_pct",
  theme = "dark",
}: {
  metric?: string;
  theme?: EmbedTheme;
}) {
  const [geoData, setGeoData] = useState<GeoFeatureCollection | null>(null);
  const basePath = process.env.NODE_ENV === "production" ? "/v_for_x" : "";

  useEffect(() => {
    let active = true;
    fetch(`${basePath}/data/world_backbone_geo.json`)
      .then((r) => r.json())
      .then((d: GeoFeatureCollection) => {
        if (active) setGeoData(d);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [basePath]);

  const metricDef = useMemo(
    () => MAP_METRICS.find((m) => m.value === metric) ?? MAP_METRICS[0],
    [metric]
  );
  const severityRange = useMemo(() => computeRange(metric, geoData), [metric, geoData]);
  const hotspotIso3s = useMemo(
    () => new Set(data.hotspots.all.map((h) => h.iso3)),
    []
  );

  const [min, max] = severityRange;

  return (
    <div
      className="h-full w-full flex flex-col"
      style={{ ...themeStyle(theme) }}
    >
      {/* Metric label */}
      <div
        className="flex items-baseline justify-between px-3 py-1.5 border-b shrink-0"
        style={{ borderColor: "var(--color-border-dim)" }}
      >
        <span className="text-xs font-bold" style={{ color: "var(--color-content-primary)" }}>
          {metricDef.label}
        </span>
        <span className="text-[9px]" style={{ color: "var(--color-content-dim)" }}>
          {metricDef.description}
        </span>
      </div>

      {/* Map */}
      <div className="relative flex-1 min-h-0 bg-abyss">
        {geoData ? (
          <ChoroplethMap
            geoData={geoData as never}
            dimension={metric}
            onCountryClick={() => {}}
            severityRange={severityRange}
            hotspotIso3s={hotspotIso3s}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-[11px]"
            style={{ color: "var(--color-blood-bright)" }}
          >
            <span className="cursor-blink">&gt; LOADING ATLAS…</span>
          </div>
        )}
      </div>

      {/* Compact legend */}
      <div
        className="flex items-center gap-1 px-3 py-1 border-t shrink-0"
        style={{ borderColor: "var(--color-border-dim)" }}
      >
        <span className="text-[9px] mr-1" style={{ color: "var(--color-content-dim)" }}>
          {min.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        </span>
        {["#1a2a44", "#3d3520", "#7a4a1a", "#9a3030", "#c42b3e"].map((c) => (
          <span key={c} className="h-2 flex-1" style={{ backgroundColor: c }} />
        ))}
        <span className="text-[9px] ml-1" style={{ color: "var(--color-content-dim)" }}>
          {max.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        </span>
      </div>
    </div>
  );
}
