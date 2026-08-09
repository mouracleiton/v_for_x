"use client";

import "leaflet/dist/leaflet.css";

import { MapContainer, GeoJSON, TileLayer } from "react-leaflet";
import type { PathOptions } from "leaflet";
import { useMemo, useState, useEffect } from "react";

export interface SubnationalMapProps {
  countryIso3: string;
  onBack: () => void;
  dimension?: string;
}

interface SubFeatureProps {
  code: string;
  name_en: string;
  vulnerability_score: number;
  [key: string]: unknown;
}

function vulnColor(score: number): string {
  if (score < 0.3) return "#1a2a44";
  if (score < 0.4) return "#3d3520";
  if (score < 0.5) return "#5a4020";
  if (score < 0.6) return "#7a4a1a";
  if (score < 0.7) return "#9a3030";
  return "#c42b3e";
}

export default function SubnationalMap({ countryIso3, onBack }: SubnationalMapProps) {
  const [subData, setSubData] = useState<{
    type: "FeatureCollection";
    features: GeoJSON.Feature[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countryName, setCountryName] = useState("");

  useEffect(() => {
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const mod = await import("@/data/subnational_boundaries.json");
        const data = mod.default as {
          countries: Record<string, {
            name_en: string;
            subdivisions: {
              code: string;
              name_en: string;
              centroid: number[];
              polygon: number[][];
              vulnerability_score: number;
            }[];
          }>;
        };
        const country = data.countries[countryIso3];
        if (!country) {
          setError(`No subnational data for ${countryIso3}`);
          setLoading(false);
          return;
        }
        setCountryName(country.name_en);

        const features: GeoJSON.Feature[] = country.subdivisions.map((sub) => ({
          type: "Feature" as const,
          geometry: {
            type: "Polygon" as const,
            coordinates: [sub.polygon],
          },
          properties: {
            code: sub.code,
            name_en: sub.name_en,
            vulnerability_score: sub.vulnerability_score,
          } as SubFeatureProps,
        }));

        setSubData({ type: "FeatureCollection", features });
        setLoading(false);
      } catch (e) {
        setError("Failed to load subnational data");
        setLoading(false);
      }
    })();
  }, [countryIso3]);

  const center = useMemo<[number, number]>(() => {
    if (!subData || subData.features.length === 0) return [0, 0];
    const first = subData.features[0].properties as SubFeatureProps;
    const coords = (subData.features[0].geometry as GeoJSON.Polygon).coordinates[0];
    const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
    const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
    return [lat, lng];
  }, [subData]);

  const styleFn = useMemo(() => {
    return (feature: GeoJSON.Feature | undefined): PathOptions => {
      if (!feature) return { fillColor: "#1a2a44", fillOpacity: 0.5 };
      const props = feature.properties as SubFeatureProps;
      const score = props.vulnerability_score ?? 0;
      return {
        fillColor: vulnColor(score),
        weight: 1,
        opacity: 1,
        color: "#2a4264",
        fillOpacity: 0.65,
      };
    };
  }, []);

  const onEachFeature = useMemo(() => {
    return (feature: GeoJSON.Feature, layer: L.Layer) => {
      const props = feature.properties as SubFeatureProps;
      const score = props.vulnerability_score ?? 0;
      const scorePct = Math.round(score * 100);
      layer.bindTooltip(
        `<div style="font-family: monospace; font-size: 11px;">
          <strong style="color:#e23856;">${props.name_en}</strong>
          <br/><span style="color:#8da3c4;">Code: ${props.code}</span>
          <br/><span style="color:#8da3c4;">Vulnerability:</span>
          <span style="color:#e23856;"> ${scorePct}%</span>
        </div>`,
        { sticky: true, className: "vfx-tooltip", direction: "top" }
      );
      layer.on({
        mouseover: (e: L.LeafletMouseEvent) => {
          e.target.setStyle({ weight: 2.5, color: "#22d3a6", fillOpacity: 0.85 });
        },
        mouseout: (e: L.LeafletMouseEvent) => {
          e.target.setStyle(styleFn(feature));
        },
      });
    };
  }, [styleFn]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-content-secondary font-mono text-sm">
        <div className="text-center">
          <div className="text-blood-bright text-lg mb-2 animate-pulse">▮▮▮</div>
          <p>Loading subnational data for {countryIso3}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[40vh] text-content-dim font-mono">
        <div className="text-center">
          <p className="text-blood mb-3">⚠ {error}</p>
          <button
            onClick={onBack}
            className="px-4 py-2 border border-border-bright text-content-secondary hover:text-blood-bright hover:border-blood transition-colors"
          >
            ◄ BACK TO WORLD MAP
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[60vh] border border-border-dim">
      <div className="absolute top-3 left-3 z-[1000] bg-abyss/90 backdrop-blur-sm border border-border-dim px-3 py-2">
        <div className="text-blood-bright text-sm font-bold tracking-widest">
          {countryName.toUpperCase()} — SUBNATIONAL DRILL-DOWN
        </div>
        <div className="text-content-dim text-[10px] mt-1">
          {subData?.features.length ?? 0} subdivisions · vulnerability index
        </div>
        <button
          onClick={onBack}
          className="mt-2 text-[10px] px-2 py-1 border border-border-bright text-command hover:text-command-bright hover:border-command transition-colors"
        >
          ◄ BACK TO WORLD MAP
        </button>
      </div>
      <div className="absolute bottom-3 right-3 z-[1000] bg-abyss/90 backdrop-blur-sm border border-border-dim px-3 py-2">
        <div className="text-[9px] text-content-dim mb-1">VULNERABILITY</div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-content-secondary">LOW</span>
          {["#1a2a44", "#3d3520", "#5a4020", "#7a4a1a", "#9a3030", "#c42b3e"].map((c) => (
            <span key={c} className="w-4 h-3 inline-block" style={{ background: c }} />
          ))}
          <span className="text-[9px] text-content-secondary">CRITICAL</span>
        </div>
      </div>
      <MapContainer
        center={center}
        zoom={5}
        minZoom={3}
        maxZoom={10}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", background: "#080e18" }}
      >
        <GeoJSON
          key={countryIso3}
          data={subData as GeoJSON.GeoJSON}
          style={styleFn as never}
          onEachFeature={onEachFeature as never}
        />
      </MapContainer>
    </div>
  );
}
