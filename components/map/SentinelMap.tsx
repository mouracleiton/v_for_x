"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import {
  INCIDENT_TYPES,
  SEVERITY_INFO,
  heatColor,
  compassLabel,
  type Incident,
  type HeatCell,
  type EscapeRoute,
  type LatLng,
} from "@/lib/sentinel";

export interface SentinelMapProps {
  incidents: Incident[];
  heatCells: HeatCell[];
  escapeRoute: EscapeRoute | null;
  userLocation: LatLng | null;
  /** Centre the map on these coordinates (initial view only). */
  center: [number, number];
  onMapClick: (lat: number, lng: number) => void;
  onSelectIncident: (id: string | null) => void;
  selectedId: string | null;
}

/** Component that captures map clicks and forwards coordinates. */
function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Pans the map to target when it changes. */
function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.panTo(target, { animate: true });
  }, [map, target]);
  return null;
}

/** Build a DivIcon glyph marker for an incident. */
function incidentIcon(inc: Incident, selected: boolean): L.DivIcon {
  const meta = INCIDENT_TYPES[inc.type];
  const sev = SEVERITY_INFO[inc.severity];
  const ring = selected ? "ring-2 ring-white" : "";
  return L.divIcon({
    className: "",
    html: `<div style="font-size:${selected ? 22 : 17}px;line-height:1;filter:drop-shadow(0 0 4px ${sev.color});${selected ? "transform:scale(1.25);" : ""}">${meta.glyph}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export default function SentinelMap({
  incidents,
  heatCells,
  escapeRoute,
  userLocation,
  center,
  onMapClick,
  onSelectIncident,
  selectedId,
}: SentinelMapProps) {
  const flyTarget: [number, number] | null =
    userLocation ? [userLocation.lat, userLocation.lng] : null;

  return (
    <MapContainer
      center={center}
      zoom={5}
      minZoom={2}
      maxZoom={18}
      style={{ width: "100%", height: "100%", background: "var(--color-abyss)" }}
      worldCopyJump
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
      />
      <ClickHandler onClick={onMapClick} />
      <FlyTo target={flyTarget} />

      {/* Heat blobs — overlapping translucent circles sorted weakest-first so hot ones sit on top */}
      {[...heatCells].reverse().map((cell, i) => (
        <CircleMarker
          key={`heat-${i}-${cell.lat.toFixed(3)}-${cell.lng.toFixed(3)}`}
          center={[cell.lat, cell.lng]}
          radius={6 + (cell.intensity / 100) * 26}
          pathOptions={{
            color: heatColor(cell.intensity),
            fillColor: heatColor(cell.intensity),
            fillOpacity: 0.18 + (cell.intensity / 100) * 0.32,
            weight: 0,
          }}
        />
      ))}

      {/* Escape bearing arrow — drawn from the user location */}
      {escapeRoute && userLocation && (
        <EscapeArrow route={escapeRoute} origin={userLocation} />
      )}

      {/* Incident markers */}
      {incidents.map((inc) => {
        const meta = INCIDENT_TYPES[inc.type];
        const sev = SEVERITY_INFO[inc.severity];
        const selected = inc.id === selectedId;
        return (
          <Marker
            key={inc.id}
            position={[inc.lat, inc.lng]}
            icon={incidentIcon(inc, selected)}
            eventHandlers={{
              click: () => onSelectIncident(selected ? null : inc.id),
            }}
          >
            <LeafletTooltip>
              <div className="text-xs" style={{ minWidth: 160 }}>
                <div className="font-bold" style={{ color: sev.color }}>
                  {meta.glyph} {meta.label}
                </div>
                <div className="text-content-dim mt-0.5">
                  Severity: <span style={{ color: sev.color }}>{sev.label}</span>
                </div>
                {inc.note && <div className="mt-0.5">{inc.note}</div>}
                {inc.headcount != null && inc.headcount > 0 && (
                  <div>Est. involved: {inc.headcount}</div>
                )}
                <div className="text-content-dim mt-0.5">
                  {inc.corroboration ? `${inc.corroboration} corroborations · ` : ""}
                  {timeAgo(inc.ts)}
                </div>
              </div>
            </LeafletTooltip>
          </Marker>
        );
      })}

      {/* User / origin marker */}
      {userLocation && (
        <CircleMarker
          center={[userLocation.lat, userLocation.lng]}
          radius={8}
          pathOptions={{
            color: "#ffffff",
            fillColor: "#ffffff",
            fillOpacity: 0.9,
            weight: 2,
          }}
        >
          <LeafletTooltip direction="top">
            <div className="text-xs font-bold">YOU ARE HERE</div>
          </LeafletTooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}

/** Draws an escape vector as a dashed line + compass label at its tip. */
function EscapeArrow({ route, origin }: { route: EscapeRoute; origin: LatLng }) {
  // length of the arrow on screen ≈ 0.4° for visibility
  const len = 0.6;
  const brg = (route.bearing * Math.PI) / 180;
  const dLat = len * Math.cos(brg);
  const dLng =
    (len * Math.sin(brg)) /
    Math.max(0.2, Math.cos((origin.lat * Math.PI) / 180));
  const tip: [number, number] = [origin.lat + dLat, origin.lng + dLng];
  return (
    <>
      <Polyline
        positions={[[origin.lat, origin.lng], tip]}
        pathOptions={{
          color: "#ffffff",
          weight: 3,
          opacity: 0.85,
          dashArray: "6 8",
        }}
      />
      <CircleMarker
        center={tip}
        radius={7}
        pathOptions={{
          color: "#ffffff",
          fillColor: "var(--color-terminal-green)",
          fillOpacity: 0.9,
          weight: 2,
        }}
      >
        <LeafletTooltip permanent direction="top">
          <div className="text-xs font-bold" style={{ color: "var(--color-terminal-green)" }}>
            ESCAPE {route.label} ↗
          </div>
        </LeafletTooltip>
      </CircleMarker>
    </>
  );
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}
