"use client";

/**
 * V FOR X — The Cartographer
 *
 * Custom choropleth map layer builder. Pick any metric from 48 available
 * fields, choose a color scale, set custom breakpoints, and generate
 * a bespoke world map visualization. Different from Chart Builder
 * (tabular) and Sorrow Map (fixed dimensions).
 *
 * [46] THE CARTOGRAPHER — Code: 46
 */

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import backbone from "@/data/world_backbone.json";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import { formatNumber } from "@/lib/format";
import type { WorldBackbone, CountryData } from "@/lib/types";

const ChoroplethMap = dynamic(
  () => import("@/components/map/ChoroplethMap"),
  { ssr: false }
);

const data = backbone as WorldBackbone;

/* ═══════════════════════════════════════════════════════════════
   Available fields for custom mapping
   ═══════════════════════════════════════════════════════════════ */

interface CartoField {
  key: string;
  label: string;
  category: string;
  unit: string;
  inverse?: boolean;
  extract: (c: CountryData) => number | null;
}

const FIELDS: CartoField[] = [
  // Hunger
  { key: "hunger_undernourishment_pct", label: "Undernourishment %", category: "Hunger", unit: "%", extract: c => c.hunger.undernourishment_pct },
  { key: "hunger_child_stunting_pct", label: "Child Stunting %", category: "Hunger", unit: "%", extract: c => c.hunger.child_stunting_pct },
  { key: "hunger_prevalence_pct", label: "Acute Food Insecurity %", category: "Hunger", unit: "%", extract: c => c.hunger.prevalence_pct },
  { key: "hunger_pop_acute_fi_m", label: "Acute Hunger (M people)", category: "Hunger", unit: "M", extract: c => c.hunger.pop_acute_fi_m },
  // Conflict
  { key: "conflict_intensity", label: "Conflict Intensity", category: "Conflict", unit: "/5", extract: c => c.conflict.intensity_1to5 },
  { key: "conflict_displacement_m", label: "Displacement (M)", category: "Conflict", unit: "M", extract: c => c.conflict.displacement_m },
  // Military
  { key: "military_expenditure_usd", label: "Military Spending", category: "Military", unit: "USD", extract: c => c.military.expenditure_usd },
  { key: "military_pct_gdp", label: "Military % GDP", category: "Military", unit: "%", extract: c => c.military.pct_gdp },
  // Health
  { key: "health_life_expectancy", label: "Life Expectancy", category: "Health", unit: "yrs", inverse: true, extract: c => c.health.life_expectancy },
  { key: "health_child_mortality", label: "Child Mortality /1k", category: "Health", unit: "/1k", extract: c => c.health.child_mortality_under5_per1k },
  { key: "health_doctors", label: "Doctors /1k", category: "Health", unit: "/1k", inverse: true, extract: c => c.health.doctors_per_1000 ?? null },
  { key: "health_spending_pct_gdp", label: "Health Spending % GDP", category: "Health", unit: "%", inverse: true, extract: c => c.health.expenditure_pct_gdp },
  // Poverty
  { key: "poverty_365", label: "Extreme Poverty %", category: "Poverty", unit: "%", extract: c => c.poverty.headcount_365_pct },
  // Economy
  { key: "gdp_per_capita", label: "GDP per Capita", category: "Economy", unit: "USD", inverse: true, extract: c => c.economy.gdp_per_capita_usd },
  { key: "unemployment", label: "Unemployment %", category: "Economy", unit: "%", extract: c => c.employment.unemployment_pct },
  // Inequality
  { key: "gini", label: "Gini Coefficient", category: "Inequality", unit: "", extract: c => c.inequality.gini },
  // Water
  { key: "water_access", label: "Water Access %", category: "Water", unit: "%", inverse: true, extract: c => c.water_sanitation.basic_access_pct },
  // Education
  { key: "literacy", label: "Literacy Rate %", category: "Education", unit: "%", inverse: true, extract: c => c.education.literacy_rate_pct },
  // Climate
  { key: "co2_per_capita", label: "CO₂ per Capita (t)", category: "Climate", unit: "t", extract: c => c.climate.co2_per_capita_t },
  { key: "air_pollution", label: "Air Pollution PM2.5", category: "Climate", unit: "µg/m³", extract: c => c.environment.air_pollution_pm25_ugm3 },
  // Governance
  { key: "corruption_cpi", label: "Corruption Index", category: "Governance", unit: "", inverse: true, extract: c => c.governance.corruption_perceptions_index },
  { key: "democracy", label: "Democracy Index", category: "Governance", unit: "0-1", inverse: true, extract: c => c.governance.electoral_democracy_index },
  // Security
  { key: "homicide", label: "Homicide Rate /100k", category: "Security", unit: "/100k", extract: c => c.security.homicide_rate_per100k },
  // Energy
  { key: "no_electricity", label: "No Electricity (M)", category: "Energy", unit: "M", extract: c => c.energy?.no_access_electricity_m ?? null },
  // Connectivity
  { key: "internet", label: "Internet Access %", category: "Connectivity", unit: "%", inverse: true, extract: c => c.connectivity.internet_users_pct },
];

/* ═══════════════════════════════════════════════════════════════
   Color scale presets
   ═══════════════════════════════════════════════════════════════ */

const COLOR_SCALES: Record<string, { label: string; colors: string[] }> = {
  blood: {
    label: "Blood Red",
    colors: ["#1a1a2e", "#3d1520", "#6b1a2a", "#9a2030", "#cc0000"],
  },
  inferno: {
    label: "Inferno",
    colors: ["#0a0a0a", "#3d1515", "#7a2a15", "#cc5500", "#ff8800"],
  },
  matrix: {
    label: "Matrix Green",
    colors: ["#001a0a", "#003311", "#006622", "#00aa33", "#00ff41"],
  },
  amber: {
    label: "Amber Alert",
    colors: ["#1a1a00", "#3d3500", "#7a6a00", "#ccaa00", "#ffdd00"],
  },
  ice: {
    label: "Ice Blue",
    colors: ["#0a0a1a", "#15203d", "#1a3a6b", "#205a9a", "#00aaff"],
  },
  mono: {
    label: "Monochrome",
    colors: ["#0a0a0a", "#2a2a2a", "#555555", "#888888", "#cccccc"],
  },
};

const SCALE_KEYS = Object.keys(COLOR_SCALES);

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */

export default function TheCartographerPage() {
  const router = useRouter();
  const [selectedField, setSelectedField] = useState(FIELDS[0].key);
  const [selectedScale, setSelectedScale] = useState("blood");
  const [numBreaks, setNumBreaks] = useState(5);
  const [customMin, setCustomMin] = useState<string>("");
  const [customMax, setCustomMax] = useState<string>("");
  const [geoData, setGeoData] = useState<{ type: "FeatureCollection"; features: any[] } | null>(null);

  const field = useMemo(
    () => FIELDS.find((f) => f.key === selectedField)!,
    [selectedField]
  );

  /* ═══ Load GeoJSON lazily ═══ */
  useEffect(() => {
    import("@/data/world_backbone_geo.json").then((mod) => {
      setGeoData(mod.default as any);
    });
  }, []);

  /* ═══ Compute data range ═══ */
  const dataRange = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const c of data.countries) {
      const val = field.extract(c);
      if (val !== null && val !== undefined && !isNaN(val) && isFinite(val)) {
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }
    if (min === Infinity) return [0, 1] as [number, number];
    return [min, max] as [number, number];
  }, [field]);

  /* ═══ Effective range (custom or auto) ═══ */
  const effectiveRange: [number, number] = useMemo(() => {
    const cMin = customMin !== "" ? parseFloat(customMin) : dataRange[0];
    const cMax = customMax !== "" ? parseFloat(customMax) : dataRange[1];
    if (isNaN(cMin) || isNaN(cMax) || cMin >= cMax) return dataRange;
    return [cMin, cMax];
  }, [customMin, customMax, dataRange]);

  /* ═══ Build the color function ═══ */
  const colorForValue = useMemo(() => {
    const scale = COLOR_SCALES[selectedScale].colors;
    const [min, max] = effectiveRange;
    const range = max - min;
    return (value: number | null): string => {
      if (value === null || value === undefined || isNaN(value)) {
        return "#1a1a1a";
      }
      let ratio = range > 0 ? (value - min) / range : 0;
      ratio = Math.max(0, Math.min(1, ratio));
      // Invert if higher = better
      if (field.inverse) ratio = 1 - ratio;
      const idx = Math.min(Math.floor(ratio * scale.length), scale.length - 1);
      return scale[idx];
    };
  }, [selectedScale, effectiveRange, field.inverse]);

  /* ═══ Inject custom colors into GeoJSON properties ═══ */
  const styledGeoData = useMemo(() => {
    if (!geoData) return null;
    return {
      ...geoData,
      features: geoData.features.map((f: any) => {
        const iso3 = f.properties?.iso3;
        if (!iso3) return f;
        const country = data.countries.find((c) => c.iso3 === iso3);
        if (!country) return f;
        const val = field.extract(country);
        return {
          ...f,
          properties: {
            ...f.properties,
            [field.key]: val,
            _cartoColor: colorForValue(val),
          },
        };
      }),
    };
  }, [geoData, field, colorForValue]);

  /* ═══ Ranked country list ═══ */
  const rankedCountries = useMemo(() => {
    return data.countries
      .map((c) => ({ country: c, value: field.extract(c) }))
      .filter((r) => r.value !== null && r.value !== undefined)
      .sort((a, b) => (field.inverse ? (a.value! - b.value!) : (b.value! - a.value!)))
      .slice(0, 20) as { country: CountryData; value: number }[];
  }, [field]);

  /* ═══ Statistics ═══ */
  const stats = useMemo(() => {
    const values = data.countries
      .map((c) => field.extract(c))
      .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
    if (values.length === 0) return null;
    const sorted = values.sort((a, b) => a - b);
    const sum = values.reduce((s, v) => s + v, 0);
    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)],
      mean: sum / values.length,
    };
  }, [field]);

  /* ═══ Breakpoints ═══ */
  const breakpoints = useMemo(() => {
    const [min, max] = effectiveRange;
    const step = (max - min) / numBreaks;
    return Array.from({ length: numBreaks + 1 }, (_, i) => min + step * i);
  }, [effectiveRange, numBreaks]);

  /* ═══ Grouped fields by category ═══ */
  const fieldGroups = useMemo(() => {
    const groups: Record<string, CartoField[]> = {};
    for (const f of FIELDS) {
      if (!groups[f.category]) groups[f.category] = [];
      groups[f.category].push(f);
    }
    return groups;
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="text-content-dim text-xs">
          [46] CUSTOM CHOROPLETH BUILDER
        </div>
        <h1 className="text-blood-bright text-2xl font-bold tracking-widest mt-1">
          <span className="glitch" data-text="THE CARTOGRAPHER">
            THE CARTOGRAPHER
          </span>
        </h1>
        <p className="text-content-secondary text-sm mt-2 max-w-2xl">
          {
            "// Pick any metric, choose a color scale, set custom breakpoints. Generate a bespoke world map. Export the configuration. Share the URL."
          }
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* LEFT: Controls */}
        <div className="space-y-4">
          {/* Field selector */}
          <TerminalCard title="// METRIC">
            <select
              value={selectedField}
              onChange={(e) => {
                setSelectedField(e.target.value);
                setCustomMin("");
                setCustomMax("");
                sound.select();
              }}
              className="w-full bg-abyss border border-border-dim px-2 py-2 text-content-primary text-xs focus:border-blood outline-none"
            >
              {Object.entries(fieldGroups).map(([cat, fields]) => (
                <optgroup key={cat} label={cat.toUpperCase()}>
                  {fields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="text-content-dim text-[9px] mt-2">
              {field.inverse
                ? "// Note: Higher values = BETTER (inverted scale)"
                : "// Higher values = WORSE"}
            </div>
          </TerminalCard>

          {/* Color scale */}
          <TerminalCard title="// COLOR SCALE">
            <div className="space-y-2">
              {SCALE_KEYS.map((key) => {
                const scale = COLOR_SCALES[key];
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedScale(key);
                      sound.select();
                    }}
                    className={`w-full p-2 border transition-all ${
                      selectedScale === key
                        ? "border-blood bg-blood/10"
                        : "border-border-dim hover:border-blood"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold flex-1 text-left">
                        {scale.label}
                      </span>
                      <div className="flex">
                        {scale.colors.map((c, i) => (
                          <div
                            key={i}
                            className="w-4 h-4"
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </TerminalCard>

          {/* Breakpoints */}
          <TerminalCard title="// BREAKPOINTS">
            <div className="space-y-3">
              <div>
                <label className="text-content-dim text-[10px] uppercase">
                  Number of breaks: {numBreaks}
                </label>
                <input
                  type="range"
                  min={3}
                  max={9}
                  step={1}
                  value={numBreaks}
                  onChange={(e) => {
                    setNumBreaks(parseInt(e.target.value));
                    sound.keystroke();
                  }}
                  className="w-full accent-blood mt-1"
                />
              </div>
              <div>
                <label className="text-content-dim text-[10px] uppercase">
                  Custom min (blank = auto)
                </label>
                <input
                  type="number"
                  value={customMin}
                  onChange={(e) => setCustomMin(e.target.value)}
                  placeholder={dataRange[0].toFixed(2)}
                  className="w-full bg-abyss border border-border-dim px-2 py-1 text-content-primary text-xs focus:border-blood outline-none mt-1"
                />
              </div>
              <div>
                <label className="text-content-dim text-[10px] uppercase">
                  Custom max (blank = auto)
                </label>
                <input
                  type="number"
                  value={customMax}
                  onChange={(e) => setCustomMax(e.target.value)}
                  placeholder={dataRange[1].toFixed(2)}
                  className="w-full bg-abyss border border-border-dim px-2 py-1 text-content-primary text-xs focus:border-blood outline-none mt-1"
                />
              </div>
            </div>
          </TerminalCard>

          {/* Stats */}
          {stats && (
            <TerminalCard title="// STATISTICS">
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-content-dim">Countries with data:</span>
                  <span className="text-content-primary">{stats.count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-dim">Min:</span>
                  <span className="text-content-primary">{stats.min < 100 ? stats.min.toFixed(2) : formatNumber(stats.min)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-dim">Max:</span>
                  <span className="text-content-primary">{stats.max < 100 ? stats.max.toFixed(2) : formatNumber(stats.max)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-dim">Median:</span>
                  <span className="text-content-primary">{stats.median < 100 ? stats.median.toFixed(2) : formatNumber(stats.median)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-dim">Mean:</span>
                  <span className="text-content-primary">{stats.mean < 100 ? stats.mean.toFixed(2) : formatNumber(stats.mean)}</span>
                </div>
              </div>
            </TerminalCard>
          )}
        </div>

        {/* RIGHT: Map + legend + ranked list */}
        <div className="space-y-4">
          {/* Map */}
          <TerminalCard title={`// ${field.label.toUpperCase()}`} glow>
            {styledGeoData ? (
              <div className="h-[400px] border border-border-dim">
                <CartoMapWrapper
                  geoData={styledGeoData}
                  fieldKey={field.key}
                  colorFn={colorForValue}
                  onCountryClick={(iso3) => {
                    router.push(`/sorrow-map/${iso3.toLowerCase()}/`);
                  }}
                />
              </div>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-blood-bright text-xs animate-pulse">
                {"// LOADING GEOSPATIAL DATA..."}
              </div>
            )}
          </TerminalCard>

          {/* Legend */}
          <div className="border border-border-dim p-3 bg-abyss">
            <div className="text-xs text-content-secondary uppercase tracking-widest mb-2">
              COLOR GRADIENT — {COLOR_SCALES[selectedScale].label}
            </div>
            <div className="flex items-end gap-0">
              {breakpoints.slice(0, -1).map((bp, i) => {
                const nextBp = breakpoints[i + 1];
                const colors = COLOR_SCALES[selectedScale].colors;
                const numColors = colors.length;
                const ratio = i / (breakpoints.length - 1);
                const colorIdx = Math.min(
                  Math.floor(ratio * numColors),
                  numColors - 1
                );
                const color = field.inverse
                  ? colors[numColors - 1 - colorIdx]
                  : colors[colorIdx];
                return (
                  <div key={i} className="flex-1">
                    <div
                      className="h-5 w-full"
                      style={{ background: color }}
                    />
                    <div className="text-[9px] text-content-dim mt-1 text-center">
                      {bp < 100 ? bp.toFixed(1) : formatNumber(bp)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-[9px] text-content-dim mt-1 flex justify-between">
              <span>{field.inverse ? "BETTER" : "LOW"}</span>
              <span>{field.inverse ? "WORSE" : "HIGH"}</span>
            </div>
          </div>

          {/* Top 20 ranked */}
          <TerminalCard title="// TOP 20 RANKED" accent="amber">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
              {rankedCountries.map((r, i) => (
                <div
                  key={r.country.iso3}
                  className="flex items-center gap-1.5 p-1 border border-border-dim/50 hover:bg-panel transition-colors cursor-pointer"
                  onClick={() => router.push(`/sorrow-map/${r.country.iso3.toLowerCase()}/`)}
                >
                  <span className="text-content-dim text-[9px] w-4">{i + 1}.</span>
                  <span
                    className="inline-block w-2 h-2 shrink-0"
                    style={{ background: colorForValue(r.value) }}
                  />
                  <span className="text-content-primary text-[10px] font-bold flex-1 truncate">
                    {r.country.iso3}
                  </span>
                  <span className="text-content-secondary text-[9px]">
                    {r.value < 100 ? r.value.toFixed(1) : formatNumber(r.value)}
                  </span>
                </div>
              ))}
            </div>
          </TerminalCard>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Custom map wrapper — injects our color function into Leaflet styling
   ═══════════════════════════════════════════════════════════════ */

function CartoMapWrapper({
  geoData,
  fieldKey,
  colorFn,
  onCountryClick,
}: {
  geoData: { type: "FeatureCollection"; features: any[] };
  fieldKey: string;
  colorFn: (val: number | null) => string;
  onCountryClick: (iso3: string) => void;
}) {
  const { MapContainer, GeoJSON } = require("react-leaflet");

  const styleFn = (feature: any) => {
    const val = feature?.properties?.[fieldKey];
    const color = colorFn(val ?? null);
    return {
      fillColor: color,
      weight: 0.5,
      opacity: 1,
      color: "var(--color-border-bright)",
      fillOpacity: val === null || val === undefined ? 0.25 : 0.8,
    };
  };

  const onEachFeature = (feature: any, layer: any) => {
    const props = feature.properties;
    const val = props[fieldKey];
    const valStr =
      typeof val === "number"
        ? val.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : "N/A";

    layer.bindTooltip(
      `<div style="font-family: monospace; font-size: 11px;">
        <strong style="color:var(--color-blood-bright);">${props.name_en || props.iso3}</strong> (${props.iso3})
        <br/><span style="color:var(--color-content-secondary);">${fieldKey}:</span>
        <span style="color:var(--color-content-primary);"> ${valStr}</span>
      </div>`,
      { sticky: true, className: "vfx-tooltip", direction: "top" }
    );

    layer.on({
      click: () => onCountryClick(props.iso3),
      mouseover: (e: any) => {
        e.target.setStyle({ weight: 2.5, color: "var(--color-terminal-green)" });
      },
      mouseout: (e: any) => {
        e.target.setStyle(styleFn(feature));
      },
    });
  };

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={2}
      maxZoom={7}
      scrollWheelZoom={true}
      worldCopyJump={true}
      style={{ height: "100%", width: "100%", background: "#080e18" }}
    >
      <GeoJSON
        key={`${fieldKey}-${Date.now()}`}
        data={geoData}
        style={styleFn}
        onEachFeature={onEachFeature}
      />
    </MapContainer>
  );
}
