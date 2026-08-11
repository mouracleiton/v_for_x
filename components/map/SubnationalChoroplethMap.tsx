"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { MapContainer, GeoJSON } from "react-leaflet";
import type { LatLngBoundsExpression, PathOptions } from "leaflet";
import type { Feature, Geometry, FeatureCollection } from "geojson";
import {
  loadSubnationalData,
  getSubdivisionsForCountry,
  getVulnerabilityColor,
  formatVulnerabilityScore,
  type SubnationalData,
  type Subdivision,
} from "@/lib/subnational";

export interface MapFeatureProperties {
  iso3: string;
  name_en: string;
  name_pt: string;
  is_hotspot: boolean;
  region: string;
  [key: string]: unknown;
}

export type MapFeature = Feature<Geometry, MapFeatureProperties>;

export interface SubnationalChoroplethMapProps {
  geoData: { type: "FeatureCollection"; features: MapFeature[] };
  dimension: string;
  onCountryClick: (iso3: string) => void;
  severityRange: [number, number];
  hotspotIso3s: Set<string>;
  selectedCountry?: string | null;
  showSubnational?: boolean;
}

/**
 * Map a numeric value into a 5-step blood-red gradient.
 * ratio 0 = darkest, ratio 1 = brightest.
 */
function severityFillColor(ratio: number): string {
  // Command center severity scale: dim navy → amber → crimson
  if (ratio < 0.2) return "#1a2a44";
  if (ratio < 0.4) return "#3d3520";
  if (ratio < 0.6) return "#7a4a1a";
  if (ratio < 0.8) return "#9a3030";
  return "#c42b3e";
}

/**
 * Convert subnational subdivision to GeoJSON feature.
 */
function subdivisionToFeature(subdivision: Subdivision, countryIso3: string): Feature {
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [subdivision.polygon.map((point) => [point[1], point[0]])],
    },
    properties: {
      iso3: countryIso3,
      subdivision_code: subdivision.code,
      subdivision_name: subdivision.name_en,
      vulnerability_score: subdivision.vulnerability_score,
      centroid: subdivision.centroid,
    },
  };
}

export default function SubnationalChoroplethMap({
  geoData,
  dimension,
  onCountryClick,
  severityRange,
  hotspotIso3s,
  selectedCountry,
  showSubnational = false,
}: SubnationalChoroplethMapProps) {
  const [subnationalData, setSubnationalData] = useState<SubnationalData | null>(null);
  const [subnationalFeatures, setSubnationalFeatures] = useState<FeatureCollection | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([20, 0]);
  const [mapZoom, setMapZoom] = useState(2);

  // Load subnational data when subnational view is enabled
  useEffect(() => {
    if (showSubnational && !subnationalData) {
      loadSubnationalData()
        .then(setSubnationalData)
        .catch((error) => console.error("Failed to load subnational data:", error));
    }
  }, [showSubnational, subnationalData]);

  // Convert subnational data to GeoJSON when country is selected
  useEffect(() => {
    if (showSubnational && selectedCountry && subnationalData) {
      const subdivisions = getSubdivisionsForCountry(subnationalData, selectedCountry);

      if (subdivisions.length > 0) {
        // Calculate bounds for the selected country
        const allLats = subdivisions.flatMap((s) =>
          s.polygon.map((p) => p[0])
        );
        const allLons = subdivisions.flatMap((s) =>
          s.polygon.map((p) => p[1])
        );

        const minLat = Math.min(...allLats);
        const maxLat = Math.max(...allLats);
        const minLon = Math.min(...allLons);
        const maxLon = Math.max(...allLons);

        const centerLat = (minLat + maxLat) / 2;
        const centerLon = (minLon + maxLon) / 2;

        setMapCenter([centerLat, centerLon]);
        setMapZoom(5);

        const features: Feature[] = subdivisions.map((subdivision) =>
          subdivisionToFeature(subdivision, selectedCountry)
        );

        setSubnationalFeatures({
          type: "FeatureCollection",
          features,
        });
      } else {
        setSubnationalFeatures(null);
        // Reset to world view if no subdivisions found
        setMapCenter([20, 0]);
        setMapZoom(2);
      }
    } else if (!showSubnational) {
      setSubnationalFeatures(null);
      setMapCenter([20, 0]);
      setMapZoom(2);
    }
  }, [showSubnational, selectedCountry, subnationalData]);

  const [min, max] = severityRange;
  const range = max - min;

  // Country-level style
  const countryStyle = useMemo(() => {
    return (feature: MapFeature | undefined): PathOptions => {
      if (!feature) return { fillColor: "var(--color-border-dim)", fillOpacity: 0.6 };
      const props = feature.properties;
      const raw = props[dimension];
      const value = typeof raw === "number" ? raw : null;
      const isHotspot = hotspotIso3s.has(props.iso3);
      const isSelected = selectedCountry === props.iso3;

      let ratio = 0;
      if (value !== null && range > 0) {
        ratio = Math.max(0, Math.min(1, (value - min) / range));
      }

      return {
        fillColor: severityFillColor(ratio),
        weight: isSelected ? 2 : isHotspot ? 1.5 : 0.5,
        opacity: 1,
        color: isSelected ? "var(--color-terminal-green)" :
                (isHotspot ? "var(--color-blood-bright)" : "var(--color-border-bright)"),
        fillOpacity: showSubnational && isSelected ? 0.1 :
                     (value === null ? 0.25 : 0.55 + ratio * 0.35),
        dashArray: isHotspot ? "3" : undefined,
      };
    };
  }, [dimension, min, range, hotspotIso3s, selectedCountry, showSubnational]);

  // Subnational-level style
  const subnationalStyle = useMemo(() => {
    return (feature: Feature | undefined): PathOptions => {
      if (!feature) return { fillColor: "var(--color-border-dim)", fillOpacity: 0.6 };
      const props = feature.properties as { vulnerability_score?: number };
      const vulnerability = props.vulnerability_score ?? 0;

      return {
        fillColor: getVulnerabilityColor(vulnerability),
        weight: 1,
        opacity: 1,
        color: "var(--color-border-bright)",
        fillOpacity: 0.6,
      };
    };
  }, []);

  const onEachCountryFeature = useMemo(() => {
    return (feature: MapFeature, layer: L.Layer) => {
      const props = feature.properties;
      const raw = props[dimension];
      const value = typeof raw === "number" ? raw : null;
      const valueStr =
        value !== null ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "N/A";
      const hotspotTag = hotspotIso3s.has(props.iso3) ? "  [HOTSPOT]" : "";

      layer.bindTooltip(
        `<div style="font-family: monospace; font-size: 11px;">
          <strong style="color:var(--color-blood-bright);">${props.name_en}</strong> (${props.iso3})${hotspotTag}
          <br/><span style="color:var(--color-content-secondary);">${dimension}:</span>
          <span style="color:var(--color-content-primary);"> ${valueStr}</span>
          ${showSubnational ? "<br/><em>Click to view subnational regions</em>" : ""}
        </div>`,
        { sticky: true, className: "vfx-tooltip", direction: "top" }
      );

      layer.on({
        click: () => onCountryClick(props.iso3),
        mouseover: (e: L.LeafletMouseEvent) => {
          e.target.setStyle({
            weight: 2.5,
            color: "var(--color-terminal-green)",
            fillOpacity: 0.85,
          });
        },
        mouseout: (e: L.LeafletMouseEvent) => {
          e.target.setStyle(countryStyle(feature));
        },
      });
    };
  }, [dimension, onCountryClick, countryStyle, hotspotIso3s, showSubnational]);

  const onEachSubnationalFeature = useMemo(() => {
    return (feature: Feature, layer: L.Layer) => {
      const props = feature.properties as {
        subdivision_name?: string;
        subdivision_code?: string;
        vulnerability_score?: number;
      };

      const vulnerability = props.vulnerability_score ?? 0;
      const vulnerabilityStr = formatVulnerabilityScore(vulnerability);

      layer.bindTooltip(
        `<div style="font-family: monospace; font-size: 11px;">
          <strong style="color:var(--color-terminal-green);">${props.subdivision_name}</strong>
          <br/>Code: <span style="color:var(--color-content-primary);">${props.subdivision_code}</span>
          <br/>Vulnerability: <span style="color:${getVulnerabilityColor(vulnerability)};">${vulnerabilityStr}</span>
        </div>`,
        { sticky: true, className: "vfx-tooltip", direction: "top" }
      );

      layer.on({
        mouseover: (e: L.LeafletMouseEvent) => {
          e.target.setStyle({
            weight: 2,
            color: "var(--color-blood-bright)",
            fillOpacity: 0.8,
          });
        },
        mouseout: (e: L.LeafletMouseEvent) => {
          e.target.setStyle(subnationalStyle(feature));
        },
      });
    };
  }, [subnationalStyle]);

  // Key forces re-render when dimension or subnational mode changes
  const geoKey = `${dimension}-${showSubnational}-${selectedCountry}`;

  return (
    <MapContainer
      key={geoKey}
      center={mapCenter}
      zoom={mapZoom}
      minZoom={2}
      maxZoom={10}
      scrollWheelZoom={true}
      worldCopyJump={true}
      style={{ height: "100%", width: "100%", background: "#080e18" }}
      maxBounds={[
        [-85, -200],
        [85, 200],
      ] as LatLngBoundsExpression}
    >
      {/* Country-level GeoJSON (always rendered as base layer) */}
      <GeoJSON
        data={geoData as unknown as GeoJSON.GeoJSON}
        style={countryStyle as never}
        onEachFeature={onEachCountryFeature as never}
      />

      {/* Subnational GeoJSON overlay (when enabled) */}
      {showSubnational && subnationalFeatures && (
        <GeoJSON
          data={subnationalFeatures}
          style={subnationalStyle as never}
          onEachFeature={onEachSubnationalFeature as never}
        />
      )}
    </MapContainer>
  );
}