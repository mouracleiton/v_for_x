"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import backbone from "@/data/world_backbone.json";
import TerminalCard from "@/components/ui/TerminalCard";
import GlitchText from "@/components/ui/GlitchText";
import StatusPill from "@/components/ui/StatusPill";
import { useStore } from "@/stores/useStore";
import { t, type Lang } from "@/lib/i18n";
import { tc } from "@/lib/i18n-content";
import { severityColor, formatNumber, wfpClassLabel } from "@/lib/format";
import type { WorldBackbone } from "@/lib/types";
import { getCountryConflictSummary } from "@/lib/ejatlas";

const ChoroplethMap = dynamic(
  () => import("@/components/map/SubnationalChoroplethMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center text-blood-bright text-xs">
        <span className="cursor-blink">&gt; {tc(useStore().lang, "sorrow.loading_geospatial")}</span>
      </div>
    ),
  }
);

const data = backbone as WorldBackbone;

/* GeoJSON type — loaded lazily at runtime to avoid 2.5MB bundle bloat */
type GeoFeatureCollection = { type: "FeatureCollection"; features: { properties: Record<string, unknown> }[] };

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
  { key: "hunger_undernourishment_pct", label: "label.undernourishment", category: "cat.hunger", unit: "%" },
  { key: "hunger_prevalence_pct", label: "label.acute_food_insecurity", category: "cat.hunger", unit: "%" },
  { key: "hunger_child_stunting_pct", label: "label.child_stunting", category: "cat.hunger", unit: "%" },
  { key: "hunger_child_wasting_pct", label: "label.child_wasting", category: "cat.hunger", unit: "%" },
  { key: "hunger_famine_risk_1to5", label: "label.famine_risk", category: "cat.hunger", unit: "/5" },
  { key: "food_security_severe_food_insecurity_m", label: "label.severe_food_insecurity", category: "cat.hunger", unit: "M" },
  { key: "conflict_intensity_1to5", label: "label.conflict_intensity", category: "cat.conflict", unit: "/5" },
  { key: "conflict_displacement_m", label: "label.displacement", category: "cat.conflict", unit: "M" },
  { key: "poverty_headcount_365_pct", label: "label.extreme_poverty", category: "cat.poverty", unit: "%" },
  { key: "poverty_headcount_685_pct", label: "label.poverty", category: "cat.poverty", unit: "%" },
  { key: "health_life_expectancy", label: "label.life_expectancy", category: "cat.health", unit: "yrs", inverse: true },
  { key: "health_child_mortality_under5_per1k", label: "label.child_mortality", category: "cat.health", unit: "/1k" },
  { key: "health_maternal_mortality_per100k", label: "label.maternal_mortality", category: "cat.health", unit: "/100k" },
  { key: "health_doctors_per_1000", label: "label.doctors", category: "cat.health", unit: "", inverse: true },
  { key: "health_hospital_beds_per_1000", label: "label.hospital_beds", category: "cat.health", unit: "", inverse: true },
  { key: "governance_corruption_perceptions_index", label: "label.corruption_cpi", category: "cat.governance", unit: "", inverse: true },
  { key: "governance_political_corruption_index", label: "label.political_corruption", category: "cat.governance", unit: "" },
  { key: "inequality_gini", label: "label.inequality_gini", category: "cat.inequality", unit: "" },
  { key: "security_homicide_rate_per100k", label: "label.homicide_rate", category: "cat.security", unit: "/100k" },
  { key: "justice_prison_rate_per_100k", label: "label.incarceration_rate", category: "cat.justice", unit: "/100k" },
  { key: "environment_air_pollution_pm25_ugm3", label: "label.air_pollution", category: "cat.environment", unit: "µg/m³" },
  { key: "energy_renewable_electric_pct", label: "label.renewable_electricity", category: "cat.energy", unit: "%", inverse: true },
  { key: "energy_no_access_electricity_m", label: "label.no_electricity", category: "cat.energy", unit: "M" },
  { key: "taxation_tax_burden_pct_gdp", label: "label.tax_burden", category: "cat.economy", unit: "%" },
  { key: "education_pisa_score", label: "label.pisa_score", category: "cat.education", unit: "", inverse: true },
  { key: "connectivity_internet_users_pct", label: "label.internet_access", category: "cat.connectivity", unit: "%", inverse: true },
  { key: "water_sanitation_basic_access_pct", label: "label.water_access", category: "cat.water", unit: "%", inverse: true },
  // ── Extended dimensions (round 4) ──
  { key: "human_development_hdi", label: "label.hdi", category: "cat.development", unit: "", inverse: true },
  { key: "economy_gdp_per_capita_usd", label: "label.gdp_per_capita", category: "cat.economy", unit: "$", inverse: true },
  { key: "economy_gdp_usd", label: "label.gdp_total", category: "cat.economy", unit: "$", inverse: true },
  { key: "military_pct_gdp", label: "label.military_pct_gdp", category: "cat.military", unit: "%" },
  { key: "military_expenditure_usd", label: "label.military_expenditure", category: "cat.military", unit: "$" },
  { key: "health_expenditure_pct_gdp", label: "label.health_pct_gdp", category: "cat.health", unit: "%", inverse: true },
  { key: "climate_co2_per_capita_t", label: "label.co2_per_capita", category: "cat.climate", unit: "t" },
  { key: "climate_ghg_total_mt", label: "label.ghg_total", category: "cat.climate", unit: "Mt" },
  { key: "education_literacy_rate_pct", label: "label.literacy_rate", category: "cat.education", unit: "%", inverse: true },
  { key: "education_primary_enrollment_pct", label: "label.primary_enrollment", category: "cat.education", unit: "%", inverse: true },
  { key: "gender_women_parliament_pct", label: "label.women_parliament", category: "cat.gender", unit: "%", inverse: true },
  { key: "migration_forcibly_displaced", label: "label.forcibly_displaced", category: "cat.migration", unit: "" },
  { key: "migration_refugees_origin", label: "label.refugees_origin", category: "cat.migration", unit: "" },
  { key: "migration_refugees_hosted", label: "label.refugees_hosted", category: "cat.migration", unit: "" },
  { key: "employment_unemployment_pct", label: "label.unemployment", category: "cat.employment", unit: "%" },
  { key: "employment_youth_unemployment_pct", label: "label.youth_unemployment", category: "cat.employment", unit: "%" },
  { key: "environment_forest_area_pct", label: "label.forest_area", category: "cat.environment", unit: "%", inverse: true },
  { key: "environment_renewable_energy_pct", label: "label.renewable_energy", category: "cat.environment", unit: "%", inverse: true },
  { key: "connectivity_broadband_per100", label: "label.broadband", category: "cat.connectivity", unit: "/100", inverse: true },
  { key: "demographics_population", label: "label.population", category: "cat.demographics", unit: "" },
  // ── Mental Health ──
  { key: "mental_health_suicide_rate_per100k", label: "label.suicide_rate", category: "cat.mental_health", unit: "/100k" },
  { key: "mental_health_suicide_rate_male_per100k", label: "label.suicide_rate_male", category: "cat.mental_health", unit: "/100k" },
  { key: "mental_health_suicide_rate_female_per100k", label: "label.suicide_rate_female", category: "cat.mental_health", unit: "/100k" },
  { key: "mental_health_psychiatrists_per100k", label: "label.psychiatrists", category: "cat.mental_health", unit: "/100k", inverse: true },
  { key: "mental_health_psychologists_per100k", label: "label.psychologists", category: "cat.mental_health", unit: "/100k", inverse: true },
  { key: "mental_health_mental_health_nurses_per100k", label: "label.mh_nurses", category: "cat.mental_health", unit: "/100k", inverse: true },
  { key: "mental_health_mh_beds_general_hospital_per100k", label: "label.mh_beds_hospital", category: "cat.mental_health", unit: "/100k", inverse: true },
  { key: "mental_health_mh_beds_mental_hospital_per100k", label: "label.mh_beds_mental", category: "cat.mental_health", unit: "/100k", inverse: true },
  { key: "mental_health_alcohol_per_capita_liters", label: "label.alcohol_per_capita", category: "cat.mental_health", unit: "L" },
  { key: "mental_health_alcohol_use_disorders_pct", label: "label.alcohol_disorders", category: "cat.mental_health", unit: "%" },
  { key: "mental_health_govt_mh_expenditure_pct", label: "label.govt_mh_expenditure", category: "cat.mental_health", unit: "%", inverse: true },
  // ── Environmental Justice (EJAtlas) ──
  { key: "ejatlas_conflicts", label: "label.ejatlas_conflicts", category: "cat.environmental_justice", unit: "" },
];

/**
 * Compute min/max of a dimension from the GeoJSON feature properties.
 */
function computeRange(dimKey: string, geoData: GeoFeatureCollection | null): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  if (!geoData) return [0, 1];
  const features = geoData.features;
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
  const { lang } = useStore();
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
            // {tc(lang, cat)}
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
                {tc(lang, d.label)}
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
  const { lang } = useStore();
  const hotspots = useMemo(
    () => [...data.hotspots.all].sort((a, b) => b.score - a.score),
    []
  );

  return (
    <TerminalCard title={tc(lang, "sorrow.active_crisis_zones")} accent="blood" glow>
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
  const { setCurrentCountry, lang, currentCountry } = useStore();
  const [activeDimKey, setActiveDimKey] = useState(DIMENSIONS[0].key);
  const [geoData, setGeoData] = useState<GeoFeatureCollection | null>(null);
  const [showSubnational, setShowSubnational] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const basePath = process.env.NODE_ENV === "production" ? "/v_for_x" : "";

  // Lazy-load 2.5MB GeoJSON at runtime instead of bundling into JS
  useEffect(() => {
    fetch(`${basePath}/data/world_backbone_geo.json`)
      .then((r) => r.json() as Promise<GeoFeatureCollection>)
      .then((d) => {
        // Inject EJAtlas environmental-conflict counts per country
        for (const f of d.features) {
          const iso3 = String(f.properties.iso3 ?? "").toUpperCase();
          const summary = getCountryConflictSummary(iso3);
          f.properties["ejatlas_conflicts"] = summary?.total ?? 0;
        }
        setGeoData(d);
      })
      .catch(() => { /* offline fallback handled by null check */ });
  }, [basePath]);

  const activeDim = useMemo(
    () => DIMENSIONS.find((d) => d.key === activeDimKey) ?? DIMENSIONS[0],
    [activeDimKey]
  );

  const severityRange = useMemo(() => computeRange(activeDimKey, geoData), [activeDimKey, geoData]);

  const hotspotIso3s = useMemo(() => {
    return new Set(data.hotspots.all.map((h) => h.iso3));
  }, []);

  const handleCountryClick = useCallback(
    (iso3: string) => {
      setCurrentCountry(iso3);
      setSelectedCountry(iso3);

      if (showSubnational) {
        // In subnational mode, stay on the main map and show subdivisions
        // Don't navigate away
      } else {
        // In normal mode, navigate to country detail page
        router.push(`/sorrow-map/${iso3.toLowerCase()}/`);
      }
    },
    [router, setCurrentCountry, showSubnational]
  );

  const handleSubnationalToggle = useCallback((enabled: boolean) => {
    setShowSubnational(enabled);
    if (!enabled) {
      setSelectedCountry(null);
    }
  }, []);

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-6 border-b border-border-dim pb-4">
        <div className="flex items-baseline gap-4 flex-wrap">
          <GlitchText text={t(lang, "nav.sorrow-map")} as="h1" className="text-2xl md:text-3xl font-bold text-blood-bright glow-blood tracking-widest" />
          <StatusPill color="blood">LIVE</StatusPill>
          <span className="text-xs text-content-dim">{tc(lang, "subtitle.sorrow_map")}</span>
        </div>
        <div className="text-sm text-content-secondary mt-2">
          <span className="text-content-dim">{">"}</span> {tc(lang, "sorrow.mapping")}:{" "}
          <span className="text-blood-bright">{tc(lang, activeDim.label)}</span>
          <span className="text-content-dim"> ({tc(lang, activeDim.category)})</span>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_260px] gap-4">
        {/* Left sidebar — dimension switcher */}
        <div className="space-y-3">
          <div className="text-xs text-content-dim uppercase tracking-widest mb-2">
            // {tc(lang, "sorrow.select_metric")}
          </div>
          <DimensionSidebar activeKey={activeDimKey} onSelect={setActiveDimKey} />
          <div className="mt-4">
            <Legend dim={activeDim} range={severityRange} />
          </div>

          {/* Subnational Toggle */}
          <div className="border border-border-dim p-3 bg-abyss mt-4">
            <div className="text-xs text-content-dim uppercase tracking-widest mb-2">
              // VIEW MODE
            </div>
            <button
              onClick={() => handleSubnationalToggle(!showSubnational)}
              className={`w-full px-3 py-2 border transition-all text-xs ${
                showSubnational
                  ? "bg-terminal-green/20 border-terminal-green text-terminal-green"
                  : "border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green"
              }`}
            >
              {showSubnational ? "🗺️ SUBNATIONAL ON" : "🌍 COUNTRY LEVEL"}
            </button>
            {showSubnational && (
              <div className="mt-2 text-[10px] text-content-dim">
                {selectedCountry ? (
                  <div>
                    <span className="text-terminal-green">▶</span> {selectedCountry}
                    <div className="text-[9px] mt-1 text-content-dim">
                      Click other countries to switch focus
                    </div>
                  </div>
                ) : (
                  <div className="text-content-dim">
                    Click a country to view subnational regions
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Center — map */}
        <div className="border border-border-dim h-[50vh] sm:h-[60vh] lg:h-[70vh] bg-abyss">
          {geoData ? (
            <ChoroplethMap
              geoData={geoData as never}
              dimension={activeDimKey}
              onCountryClick={handleCountryClick}
              severityRange={severityRange}
              hotspotIso3s={hotspotIso3s}
              selectedCountry={selectedCountry}
              showSubnational={showSubnational}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-blood-bright text-xs">
              <span className="cursor-blink">&gt; FETCHING 2.5MB GEOSPATIAL DATA...</span>
            </div>
          )}
        </div>

        {/* Right sidebar — hotspot list */}
        <div className="space-y-4">
          <HotspotList onSelect={handleCountryClick} />
          <div className="border border-border-dim p-3 bg-abyss text-[10px] text-content-dim space-y-1">
            <div className="text-blood-bright uppercase tracking-widest mb-1">// {tc(lang, "sorrow.legend")}</div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-blood-bright" style={{ backgroundColor: "#550000" }} />
              HOTSPOT COUNTRY (pulsing border)
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-0.5 bg-border-dim" />
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
