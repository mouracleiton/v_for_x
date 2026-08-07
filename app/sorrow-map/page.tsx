"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import geoDataRaw from "@/data/world_backbone_geo.json";
import backbone from "@/data/world_backbone.json";
import TerminalCard from "@/components/ui/TerminalCard";
import GlitchText from "@/components/ui/GlitchText";
import StatusPill from "@/components/ui/StatusPill";
import { useStore } from "@/stores/useStore";
import { severityColor, formatNumber, wfpClassLabel } from "@/lib/format";
import type { WorldBackbone } from "@/lib/types";

const ChoroplethMap = dynamic(
  () => import("@/components/map/ChoroplethMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center text-blood-bright text-xs">
        <span className="cursor-blink">&gt; LOADING GEOSPATIAL DATA...</span>
      </div>
    ),
  }
);

const data = backbone as WorldBackbone;
const geoData = geoDataRaw as { type: "FeatureCollection"; features: unknown[] };

/* ═══════════════════════════════════════════════════════════════
   DIMENSION CONFIGURATION
   Each maps a human label to a flat property key in the GeoJSON
   features' properties (which use underscore-flattened names).
   inverse=true means higher is BETTER (life expectancy, literacy).
   ═══════════════════════════════════════════════════════════════ */

export interface DimensionDef {
  key: string;
  label: string;
  category: string;
  unit: string;
  inverse?: boolean;
}

const DIMENSIONS: DimensionDef[] = [
  { key: "hunger_undernourishment_pct", label: "UNDERNOURISHMENT", category: "HUNGER", unit: "%" },
  { key: "hunger_prevalence_pct", label: "ACUTE FOOD INSECURITY", category: "HUNGER", unit: "%" },
  { key: "hunger_child_stunting_pct", label: "CHILD STUNTING", category: "HUNGER", unit: "%" },
  { key: "hunger_child_wasting_pct", label: "CHILD WASTING", category: "HUNGER", unit: "%" },
  { key: "hunger_famine_risk_1to5", label: "FAMINE RISK", category: "HUNGER", unit: "/5" },
  { key: "conflict_intensity_1to5", label: "CONFLICT INTENSITY", category: "CONFLICT", unit: "/5" },
  { key: "conflict_displacement_m", label: "DISPLACEMENT", category: "CONFLICT", unit: "M" },
  { key: "poverty_headcount_365_pct", label: "EXTREME POVERTY ($3.65)", category: "POVERTY", unit: "%" },
  { key: "poverty_headcount_685_pct", label: "POVERTY ($6.85)", category: "POVERTY", unit: "%" },
  { key: "health_life_expectancy", label: "LIFE EXPECTANCY", category: "HEALTH", unit: "yrs", inverse: true },
  { key: "health_child_mortality_under5_per1k", label: "CHILD MORTALITY (U5)", category: "HEALTH", unit: "/1k" },
  { key: "health_maternal_mortality_per100k", label: "MATERNAL MORTALITY", category: "HEALTH", unit: "/100k" },
  { key: "governance_corruption_perceptions_index", label: "CORRUPTION (CPI)", category: "GOVERNANCE", unit: "", inverse: true },
  { key: "governance_political_corruption_index", label: "POLITICAL CORRUPTION", category: "GOVERNANCE", unit: "" },
  { key: "inequality_gini", label: "INEQUALITY (GINI)", category: "INEQUALITY", unit: "" },
  { key: "security_homicide_rate_per100k", label: "HOMICIDE RATE", category: "SECURITY", unit: "/100k" },
  { key: "environment_air_pollution_pm25_ugm3", label: "AIR POLLUTION (PM2.5)", category: "ENVIRONMENT", unit: "µg/m³" },
  { key: "connectivity_internet_users_pct", label: "INTERNET ACCESS", category: "CONNECTIVITY", unit: "%", inverse: true },
  { key: "water_sanitation_basic_access_pct", label: "WATER ACCESS", category: "WATER", unit: "%", inverse: true },
];

/**
 * Compute min/max of a dimension from the GeoJSON feature properties.
 */
function computeRange(dimKey: string): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  const features = (geoData as { features: { properties: Record<string, unknown> }[] }).features;
  for (const f of features) {
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

/**
 * Format a value for display in legend / list.
 */
function formatDimValue(val: unknown, dim: DimensionDef): string {
  if (typeof val !== "number" || isNaN(val)) return "N/A";
  if (dim.unit === "%") return val.toFixed(1) + "%";
  if (dim.unit === "/5") return val.toFixed(1) + "/5";
  if (dim.unit === "M") return formatNumber(val) + "M";
  if (dim.unit === "yrs") return val.toFixed(1);
  return val.toFixed(2);
}

/* ═══════════════════════════════════════════════════════════════
   LEGEND BAR
   ═══════════════════════════════════════════════════════════════ */

function Legend({ dim, range }: { dim: DimensionDef; range: [number, number] }) {
  const [min, max] = range;
  const steps = 5;
  const stepSize = (max - min) / (steps - 1);
  return (
    <div className="border border-border-dim p-3 bg-abyss">
      <div className="text-xs text-content-secondary uppercase tracking-widest mb-2">
        SEVERITY GRADIENT
      </div>
      <div className="flex items-end gap-0">
        {Array.from({ length: steps }, (_, i) => {
          const val = min + stepSize * i;
          const ratio = i / (steps - 1);
          const color = severityColor(dim.inverse ? 1 - ratio : ratio, 0, 1);
          return (
            <div key={i} className="flex-1">
              <div
                className="h-4 w-full"
                style={{ backgroundColor: color }}
                title={formatDimValue(val, dim)}
              />
              <div className="text-[9px] text-content-dim mt-1 text-center">
                {formatDimValue(val, dim)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[9px] text-content-dim mt-1 flex justify-between">
        <span>{dim.inverse ? "WORSE" : "LOW"}</span>
        <span>{dim.inverse ? "BETTER" : "HIGH"}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DIMENSION SIDEBAR
   ═══════════════════════════════════════════════════════════════ */

function DimensionSidebar({
  activeKey,
  onSelect,
}: {
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  const categories = useMemo(() => {
    const map: Record<string, DimensionDef[]> = {};
    for (const d of DIMENSIONS) {
      if (!map[d.category]) map[d.category] = [];
      map[d.category].push(d);
    }
    return map;
  }, []);

  return (
    <div className="space-y-4">
      {Object.entries(categories).map(([cat, dims]) => (
        <div key={cat}>
          <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1 px-1">
            // {cat}
          </div>
          <div className="space-y-0.5">
            {dims.map((d) => (
              <button
                key={d.key}
                onClick={() => onSelect(d.key)}
                className={`w-full text-left px-2 py-1.5 text-xs border transition-all ${
                  activeKey === d.key
                    ? "border-blood bg-blood/10 text-blood-bright glow-blood"
                    : "border-transparent text-content-secondary hover:border-border-dim hover:text-content-primary"
                }`}
              >
                <span className={activeKey === d.key ? "text-blood-bright" : "text-content-dim"}>
                  {activeKey === d.key ? "▶" : "·"}{" "}
                </span>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HOTSPOT LIST
   ═══════════════════════════════════════════════════════════════ */

function HotspotList({ onSelect }: { onSelect: (iso3: string) => void }) {
  const hotspots = useMemo(
    () => [...data.hotspots.all].sort((a, b) => b.score - a.score),
    []
  );

  return (
    <TerminalCard title="ACTIVE CRISIS ZONES" accent="blood" glow>
      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {hotspots.map((h) => (
          <button
            key={h.iso3}
            onClick={() => onSelect(h.iso3)}
            className="w-full flex items-center justify-between text-left px-2 py-1 text-xs hover:bg-blood/10 border border-transparent hover:border-blood-dim transition-all"
          >
            <div className="flex items-center gap-2">
              <span className="text-blood-bright font-bold">{h.iso3}</span>
              <span className="text-content-primary truncate max-w-[140px]">
                {h.name_en || h.name_pt}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className="text-[9px] px-1 py-0.5 border"
                style={{
                  borderColor: "var(--color-border-dim)",
                  color: "var(--color-content-dim)",
                }}
              >
                {wfpClassLabel(h.wfp_class)}
              </span>
              <span className="text-blood-bright font-bold">{h.score}</span>
            </div>
          </button>
        ))}
      </div>
    </TerminalCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function MapaDaDorPage() {
  const router = useRouter();
  const { setCurrentCountry } = useStore();
  const [activeDimKey, setActiveDimKey] = useState(DIMENSIONS[0].key);

  const activeDim = useMemo(
    () => DIMENSIONS.find((d) => d.key === activeDimKey) ?? DIMENSIONS[0],
    [activeDimKey]
  );

  const severityRange = useMemo(() => computeRange(activeDimKey), [activeDimKey]);

  const hotspotIso3s = useMemo(() => {
    return new Set(data.hotspots.all.map((h) => h.iso3));
  }, []);

  const handleCountryClick = useCallback(
    (iso3: string) => {
      setCurrentCountry(iso3);
      router.push(`/sorrow-map/${iso3.toLowerCase()}/`);
    },
    [router, setCurrentCountry]
  );

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-6 border-b border-border-dim pb-4">
        <div className="flex items-baseline gap-4 flex-wrap">
          <GlitchText text="SORROW MAP" as="h1" className="text-2xl md:text-3xl font-bold text-blood-bright glow-blood tracking-widest" />
          <StatusPill color="blood">LIVE</StatusPill>
          <span className="text-xs text-content-dim">// BRANCH 01 — GLOBAL SUFFERING MAP</span>
        </div>
        <div className="text-sm text-content-secondary mt-2">
          <span className="text-content-dim">{">"}</span> MAPPING:{" "}
          <span className="text-blood-bright">{activeDim.label}</span>
          <span className="text-content-dim"> ({activeDim.category})</span>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_260px] gap-4">
        {/* Left sidebar — dimension switcher */}
        <div className="space-y-3">
          <div className="text-xs text-content-dim uppercase tracking-widest mb-2">
            // SELECT METRIC
          </div>
          <DimensionSidebar activeKey={activeDimKey} onSelect={setActiveDimKey} />
          <div className="mt-4">
            <Legend dim={activeDim} range={severityRange} />
          </div>
        </div>

        {/* Center — map */}
        <div className="border border-border-dim h-[60vh] lg:h-[70vh] bg-abyss">
          <ChoroplethMap
            geoData={geoData as never}
            dimension={activeDimKey}
            onCountryClick={handleCountryClick}
            severityRange={severityRange}
            hotspotIso3s={hotspotIso3s}
          />
        </div>

        {/* Right sidebar — hotspot list */}
        <div className="space-y-4">
          <HotspotList onSelect={handleCountryClick} />
          <div className="border border-border-dim p-3 bg-abyss text-[10px] text-content-dim space-y-1">
            <div className="text-blood-bright uppercase tracking-widest mb-1">// LEGEND</div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-blood-bright" style={{ backgroundColor: "#550000" }} />
              HOTSPOT COUNTRY (pulsing border)
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-0.5 bg-[#333]" />
              STANDARD BORDER
            </div>
            <div className="text-[9px] mt-2">
              CLICK ANY COUNTRY TO VIEW FULL DOSSIER
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
