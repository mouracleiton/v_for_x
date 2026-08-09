"use client";

/**
 * V FOR X — The Satellite
 *
 * Satellite imagery branch: select a country and inspect free, open satellite
 * basemaps overlaid with documented destruction / conflict zones. Includes an
 * accessibility panel and a skip link so the whole branch is keyboard-friendly.
 *
 * (i18n: TODO — copy is English for now.)
 */

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import TerminalCard from "@/components/ui/TerminalCard";
import AccessibilityPanel from "@/components/shared/AccessibilityPanel";
import { SkipLink, ariaLabel } from "@/lib/a11y";
import { sound } from "@/lib/sound";
import countriesData from "@/data/countries_en.json";

/* SatelliteView is client-only (Leaflet needs window). */
const SatelliteView = dynamic(() => import("@/components/shared/SatelliteView"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full min-h-[520px] text-content-dim text-xs">
      <span className="cursor-blink">&gt; ACQUIRING SATELLITE LINK...</span>
    </div>
  ),
});

type CountryRow = { name_en: string; iso3: string; region: string };

const ALL_COUNTRIES = (
  countriesData as { countries: CountryRow[] }
).countries
  .slice()
  .sort((a, b) => a.name_en.localeCompare(b.name_en));

/* ═══════════════════════════════════════════════════════════════════════
   CURATED DESTRUCTION / CONFLICT ZONES VISIBLE IN OPEN SATELLITE IMAGERY
   Coordinates are approximate centroids of documented damage footprints.
   Sources: UNOSAT, UNITAR, Amnesty Crisis Evidence Lab, Bellingcat, Sentinel-2
   change-detection analyses. // i18n: TODO
   ═══════════════════════════════════════════════════════════════════════ */

const CONFLICT_ZONES: Record<string, { lat: number; lng: number; label: string }[]> = {
  UKR: [
    { lat: 47.0971, lng: 37.5434, label: "Mariupol — widespread urban destruction (2022)" },
    { lat: 48.5949, lng: 38.0029, label: "Bakhmut — leveled after months of siege" },
    { lat: 50.5376, lng: 30.2258, label: "Bucha / Irpin — damaged Kyiv suburbs" },
  ],
  PSE: [
    { lat: 31.5017, lng: 34.4667, label: "Gaza City — dense urban damage footprint" },
    { lat: 31.3463, lng: 34.3036, label: "Khan Younis — extensive structural damage" },
    { lat: 31.2936, lng: 34.2459, label: "Rafah — southern Gaza damage extent" },
  ],
  SDN: [
    { lat: 15.5007, lng: 32.5599, label: "Khartoum — urban combat damage" },
    { lat: 13.4868, lng: 22.4489, label: "El Geneina — burned neighborhoods (Darfur)" },
    { lat: 15.6444, lng: 32.4778, label: "Omdurman — conflict damage" },
  ],
  SYR: [
    { lat: 36.2021, lng: 37.1343, label: "Aleppo — historic city destruction" },
    { lat: 35.9467, lng: 39.0094, label: "Raqqa — post-conflict rubble" },
    { lat: 33.5138, lng: 36.2966, label: "Eastern Ghouta — devastated suburbs" },
  ],
  YEM: [
    { lat: 15.3694, lng: 44.191, label: "Sana'a — airstrikes on infrastructure" },
    { lat: 14.7937, lng: 42.9515, label: "Hodeidah — port &amp; city damage" },
    { lat: 31.2936, lng: 34.2459, label: "Aden — conflict-affected districts" },
  ],
  ETH: [
    { lat: 13.4967, lng: 39.4702, label: "Mekelle — Tigray conflict damage" },
    { lat: 14.0333, lng: 38.3, label: "Western Tigray — destroyed settlements" },
  ],
  MMR: [
    { lat: 21.9588, lng: 96.0891, label: "Mandalay — post-coup urban damage" },
    { lat: 20.15, lng: 92.9, label: "Rakhine — burned villages (Sittwe area)" },
  ],
  AFG: [
    { lat: 34.5553, lng: 69.2075, label: "Kabul — decades of conflict scarring" },
    { lat: 31.583, lng: 64.3607, label: "Lashkar Gah / Helmand — frontline damage" },
  ],
};

const MONITORED = new Set(Object.keys(CONFLICT_ZONES));

/* Satellite imagery sources info panel content. */
const SATELLITE_SOURCES = [
  {
    name: "Sentinel-2",
    operator: "ESA / Copernicus",
    resolution: "10 m",
    note: "Free, open multispectral imagery with 5-day revisit. Powers automated building-damage and fire-scar change detection.",
  },
  {
    name: "Landsat 8/9",
    operator: "USGS / NASA",
    resolution: "30 m",
    note: "The longest open archive on Earth (since 1972). Ideal for long-term before/after comparison.",
  },
  {
    name: "Esri World Imagery",
    operator: "Esri (curated)",
    resolution: "~1 m (varies)",
    note: "The basemap shown here — a curated mosaic used for visual orientation, not change analysis.",
  },
];

export default function TheSatellitePage() {
  const [iso3, setIso3] = useState<string>("UKR");

  const selected = ALL_COUNTRIES.find((c) => c.iso3 === iso3);
  const zones = CONFLICT_ZONES[iso3] ?? [];
  const isMonitored = MONITORED.has(iso3);

  const monitoredCountries = useMemo(
    () =>
      ALL_COUNTRIES.filter((c) => MONITORED.has(c.iso3)).sort((a, b) =>
        a.name_en.localeCompare(b.name_en),
      ),
    [],
  );

  return (
    <>
      <SkipLink targetId="sat-main" />
      <AccessibilityPanel />

      <main
        id="sat-main"
        className="p-3 sm:p-6 md:p-10 max-w-7xl mx-auto"
      >
        {/* Header */}
        <div className="mb-8 pt-4">
          <div className="text-xs text-content-dim mb-1">// SATELLITE INTELLIGENCE</div>
          <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood tracking-widest">
            THE SATELLITE
          </h1>
          <p className="text-content-secondary text-sm mt-2">
            // Open satellite imagery makes destruction undeniable. Select a
            country and inspect documented conflict &amp; crisis zones from
            orbit — the evidence regimes cannot censor.
          </p>
        </div>

        {/* Country selector */}
        <TerminalCard title="Target Acquisition" accent="amber" className="mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[220px]">
              <label
                htmlFor="sat-country"
                className="block text-[10px] uppercase tracking-widest text-content-dim mb-1"
              >
                Country
              </label>
              <select
                id="sat-country"
                value={iso3}
                onChange={(e) => {
                  setIso3(e.target.value);
                  sound.nav();
                }}
                aria-label={ariaLabel("dropdown")}
                className="w-full bg-void border border-border-dim text-content-primary text-sm px-3 py-2 focus:border-terminal-green focus:outline-none"
              >
                {ALL_COUNTRIES.map((c) => (
                  <option key={c.iso3} value={c.iso3}>
                    {c.name_en} ({c.iso3}){MONITORED.has(c.iso3) ? "  ⚠" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-[11px] text-content-secondary">
              {isMonitored ? (
                <span className="text-blood-bright">
                  ⚠ {zones.length} documented zone{zones.length === 1 ? "" : "s"} for{" "}
                  {selected?.name_en ?? iso3}
                </span>
              ) : (
                <span className="text-content-dim">
                  No destruction zones catalogued for{" "}
                  {selected?.name_en ?? iso3}. Try a monitored conflict country.
                </span>
              )}
            </div>
          </div>
        </TerminalCard>

        {/* Map */}
        <TerminalCard title="Live Satellite Feed" accent="green" className="mb-6">
          <div style={{ height: 520 }} className="border border-border-dim">
            <SatelliteView iso3={iso3} conflictZones={zones} height={520} />
          </div>
          <p className="text-[10px] text-content-dim mt-2">
            // Basemap: Esri World Imagery (orientation only). Toggle the
            reference layer for labels &amp; context. Markers indicate
            documented damage — open one for coordinates &amp; description.
          </p>
        </TerminalCard>

        {/* Zones + Sources grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Documented zones for the selected country */}
          <TerminalCard
            title={`Documented Zones // ${selected?.name_en ?? iso3}`}
            accent="blood"
          >
            {zones.length > 0 ? (
              <ol className="space-y-2">
                {zones.map((z, i) => (
                  <li
                    key={`${z.label}-${i}`}
                    className="flex items-start gap-3 p-2 terminal-card hover:border-blood transition-colors"
                  >
                    <span className="text-blood-dim font-bold text-xs mt-0.5">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-content-primary">
                        {z.label}
                      </div>
                      <div className="text-[10px] text-content-dim">
                        {z.lat.toFixed(4)}°, {z.lng.toFixed(4)}°
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-content-dim">
                No satellite-confirmed destruction zones in our database for{" "}
                {selected?.name_en ?? iso3}. Select a monitored conflict
                country to see documented damage.
              </p>
            )}
          </TerminalCard>

          {/* Imagery sources */}
          <TerminalCard title="Imagery Sources &amp; Methods" accent="amber">
            <ul className="space-y-3">
              {SATELLITE_SOURCES.map((s) => (
                <li key={s.name} className="text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold text-terminal-green">{s.name}</span>
                    <span className="text-content-dim text-[10px]">
                      {s.operator} · {s.resolution}
                    </span>
                  </div>
                  <p className="text-content-secondary mt-0.5">{s.note}</p>
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-content-dim mt-3 pt-2 border-t border-border-dim">
              // Real change detection compares two timestamps — not the single
              basemap shown here. Sentinel-2 &amp; Landsat are free; anyone can
              reproduce this analysis.
            </p>
          </TerminalCard>
        </div>

        {/* Monitored countries index */}
        <TerminalCard title="Monitored Conflict Countries" className="mb-6">
          <div className="flex flex-wrap gap-2">
            {monitoredCountries.map((c) => (
              <button
                key={c.iso3}
                type="button"
                onClick={() => {
                  setIso3(c.iso3);
                  sound.nav();
                }}
                className={`text-[11px] px-2 py-1 border transition-colors ${
                  iso3 === c.iso3
                    ? "border-blood text-blood-bright bg-blood/5"
                    : "border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
                }`}
              >
                ⚠ {c.name_en}
              </button>
            ))}
          </div>
        </TerminalCard>

        {/* Cross-link note */}
        <div className="flex flex-wrap gap-2">
          <a
            href="/sorrow-map/"
            className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
          >
            ▶ SORROW MAP
          </a>
          <a
            href="/registry/"
            className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
          >
            ▶ ACCOUNTABILITY REGISTRY
          </a>
        </div>
      </main>
    </>
  );
}
