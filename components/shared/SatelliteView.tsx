"use client";

/**
 * V FOR X — SatelliteView
 *
 * A Leaflet-based satellite imagery viewer. Renders free Esri World Imagery
 * tiles with a before/after toggle against a dark reference (labels) layer,
 * plots documented conflict/crisis zones as markers with descriptive popups,
 * and shows a live lat/lng readout that follows the cursor.
 *
 * Designed to match the Command Center aesthetic: dark container, monospace
 * corner labels, crimson markers.
 */

import "leaflet/dist/leaflet.css";

import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { useEffect, useState } from "react";
import type { LeafletMouseEvent } from "leaflet";
import centroidsData from "@/data/country_centroids.json";
import { ariaLabel } from "@/lib/a11y";

const CENTROIDS = centroidsData as unknown as Record<string, [number, number]>;

/** Free satellite imagery (Esri World Imagery — z/y/x tile order). */
const IMAGERY_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

/** Dark reference / labels layer (CartoDB — free, x/y/z order). */
const REFERENCE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

export interface ConflictZone {
  lat: number;
  lng: number;
  label: string;
}

export interface SatelliteViewProps {
  /** ISO 3166-1 alpha-3 country code — used to centre the map. */
  iso3: string;
  /** Known conflict/crisis zones to plot. */
  conflictZones?: ConflictZone[];
  /** Container height in pixels. */
  height?: number;
}

/* ── Child: re-centre the map when the selected country changes ── */
function MapController({ iso3 }: { iso3: string }) {
  const map = useMap();
  useEffect(() => {
    const center = CENTROIDS[iso3];
    if (center) {
      map.flyTo(center, 6, { duration: 1.2 });
    }
  }, [iso3, map]);
  return null;
}

/* ── Child: stream cursor coordinates to the readout ── */
function MouseCoords({
  onMove,
}: {
  onMove: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  useEffect(() => {
    const handler = (e: LeafletMouseEvent) => onMove(e.latlng.lat, e.latlng.lng);
    map.on("mousemove", handler);
    return () => {
      map.off("mousemove", handler);
    };
  }, [map, onMove]);
  return null;
}

export default function SatelliteView({
  iso3,
  conflictZones = [],
  height = 520,
}: SatelliteViewProps) {
  const [showImagery, setShowImagery] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: 0,
    lng: 0,
  });

  const initial = CENTROIDS[iso3] ?? ([20, 0] as [number, number]);
  const initialZoom = CENTROIDS[iso3] ? 6 : 2;

  const zones = conflictZones;

  return (
    <div
      className="relative w-full border border-border-bright"
      style={{ height }}
      role="region"
      aria-label={ariaLabel("map")}
    >
      {/* ── HUD: corner labels ── */}
      <div className="pointer-events-none absolute top-2 left-3 z-[1000] text-[9px] tracking-[0.25em] text-terminal-green/80 font-bold">
        ◤ SAT-VIEW // LIVE
      </div>
      <div className="pointer-events-none absolute bottom-2 right-3 z-[1000] text-[9px] tracking-[0.2em] text-content-dim">
        ESRI WORLD IMAGERY ◢
      </div>

      {/* ── HUD: cursor coordinates readout ── */}
      <div className="absolute bottom-2 left-3 z-[1000] text-[10px] tracking-widest text-terminal-green bg-void/80 px-2 py-1 border border-border-dim">
        COORD: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
      </div>

      {/* ── HUD: before / after tile toggle ── */}
      <button
        type="button"
        onClick={() => setShowImagery((v) => !v)}
        className="absolute top-2 right-3 z-[1000] inline-flex items-center gap-1.5 text-[10px] tracking-widest px-2 py-1 bg-void/80 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green transition-colors"
        aria-pressed={showImagery}
        aria-label={
          showImagery
            ? "Showing satellite imagery. Activate to switch to the reference map layer."
            : "Showing reference map layer. Activate to switch to satellite imagery."
        }
      >
        {showImagery ? "▦ REFERENCE" : "🛰 IMAGERY"}
      </button>

      <MapContainer
        center={initial}
        zoom={initialZoom}
        minZoom={2}
        maxZoom={16}
        scrollWheelZoom
        worldCopyJump
        attributionControl={false}
        style={{ height: "100%", width: "100%", background: "#080e18" }}
      >
        {showImagery ? (
          <TileLayer url={IMAGERY_URL} maxZoom={16} />
        ) : (
          <TileLayer url={REFERENCE_URL} subdomains="abcd" maxZoom={16} />
        )}

        <MapController iso3={iso3} />
        <MouseCoords onMove={(lat, lng) => setCoords({ lat, lng })} />

        {zones.map((z, i) => (
          <CircleMarker
            key={`${z.label}-${i}`}
            center={[z.lat, z.lng]}
            radius={8}
            pathOptions={{
              color: "#c42b3e",
              fillColor: "#e23856",
              fillOpacity: 0.75,
              weight: 1.5,
            }}
          >
            <Popup>
              <div className="text-xs" style={{ fontFamily: "var(--font-mono)" }}>
                <div className="font-bold text-blood-bright mb-1">⚠ {z.label}</div>
                <div className="text-content-secondary">
                  {z.lat.toFixed(4)}°, {z.lng.toFixed(4)}°
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
