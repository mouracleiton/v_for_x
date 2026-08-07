"use client";

import "leaflet/dist/leaflet.css";

import { MapContainer, GeoJSON } from "react-leaflet";
import type { LatLngBoundsExpression, PathOptions } from "leaflet";
import { useMemo } from "react";
import type { Feature, Geometry } from "geojson";

export interface MapFeatureProperties {
  iso3: string;
  name_en: string;
  name_pt: string;
  is_hotspot: boolean;
  region: string;
  [key: string]: unknown;
}

export type MapFeature = Feature<Geometry, MapFeatureProperties>;

export interface ChoroplethMapProps {
  geoData: { type: "FeatureCollection"; features: MapFeature[] };
  dimension: string;
  onCountryClick: (iso3: string) => void;
  severityRange: [number, number];
  hotspotIso3s: Set<string>;
}

/**
 * Map a numeric value into a 5-step blood-red gradient.
 * ratio 0 = darkest, ratio 1 = brightest.
 */
function severityFillColor(ratio: number): string {
  if (ratio < 0.2) return "#2a0808";
  if (ratio < 0.4) return "#550000";
  if (ratio < 0.6) return "#880000";
  if (ratio < 0.8) return "#bb0000";
  return "#ff1a1a";
}

export default function ChoroplethMap({
  geoData,
  dimension,
  onCountryClick,
  severityRange,
  hotspotIso3s,
}: ChoroplethMapProps) {
  const [min, max] = severityRange;
  const range = max - min;

  const style = useMemo(() => {
    return (feature: MapFeature | undefined): PathOptions => {
      if (!feature) return { fillColor: "#1a1a1a", fillOpacity: 0.6 };
      const props = feature.properties;
      const raw = props[dimension];
      const value = typeof raw === "number" ? raw : null;
      const isHotspot = hotspotIso3s.has(props.iso3);

      let ratio = 0;
      if (value !== null && range > 0) {
        ratio = Math.max(0, Math.min(1, (value - min) / range));
      }

      return {
        fillColor: severityFillColor(ratio),
        weight: isHotspot ? 1.5 : 0.5,
        opacity: 1,
        color: isHotspot ? "#ff0000" : "#333333",
        fillOpacity: value === null ? 0.25 : 0.55 + ratio * 0.35,
        dashArray: isHotspot ? "3" : undefined,
      };
    };
  }, [dimension, min, range, hotspotIso3s]);

  const onEachFeature = useMemo(() => {
    return (feature: MapFeature, layer: L.Layer) => {
      const props = feature.properties;
      const raw = props[dimension];
      const value = typeof raw === "number" ? raw : null;
      const valueStr =
        value !== null ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "N/A";
      const hotspotTag = hotspotIso3s.has(props.iso3) ? "  [HOTSPOT]" : "";

      layer.bindTooltip(
        `<div style="font-family: monospace; font-size: 11px;">
          <strong style="color:#e10600;">${props.name_en}</strong> (${props.iso3})${hotspotTag}
          <br/><span style="color:#888;">${dimension}:</span>
          <span style="color:#e0e0e0;"> ${valueStr}</span>
        </div>`,
        { sticky: true, className: "vfx-tooltip", direction: "top" }
      );

      layer.on({
        click: () => onCountryClick(props.iso3),
        mouseover: (e: L.LeafletMouseEvent) => {
          e.target.setStyle({
            weight: 2.5,
            color: "#00ff41",
            fillOpacity: 0.85,
          });
        },
        mouseout: (e: L.LeafletMouseEvent) => {
          e.target.setStyle(style(feature));
        },
      });
    };
  }, [dimension, onCountryClick, style, hotspotIso3s]);

  // Key forces re-render of GeoJSON when dimension changes
  const geoKey = `${dimension}`;

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={2}
      maxZoom={7}
      scrollWheelZoom={true}
      worldCopyJump={true}
      style={{ height: "100%", width: "100%", background: "#050505" }}
      maxBounds={[
        [-85, -200],
        [85, 200],
      ] as LatLngBoundsExpression}
    >
      <GeoJSON
        key={geoKey}
        data={geoData as unknown as GeoJSON.GeoJSON}
        style={style as never}
        onEachFeature={onEachFeature as never}
      />
    </MapContainer>
  );
}
