"use client";

import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip as LeafletTooltip,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import {
  EVENT_TYPES,
  SEVERITY_INFO,
  verificationStatus,
  effectiveIntensity,
  heatColor,
  type ChronicleEvent,
  type LatLng,
} from "@/lib/chronicle";

export interface ChronicleMapProps {
  events: ChronicleEvent[];
  /** Centre the map on these coordinates (initial view only). */
  center: [number, number];
  onMapClick: (lat: number, lng: number) => void;
  onSelectEvent: (id: string | null) => void;
  selectedId: string | null;
  /** A draft pin being placed by the user before filing. */
  draft: LatLng | null;
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.panTo(target, { animate: true });
  }, [map, target]);
  return null;
}

/** Status → ring color for the marker halo. */
function statusColor(status: string): string {
  switch (status) {
    case "VERIFIED":
      return "#22d3a6";
    case "CORROBORATED":
      return "#f0a93b";
    case "SIGNED":
      return "#5588ff";
    default:
      return "#e23856";
  }
}

function eventIcon(event: ChronicleEvent, selected: boolean): L.DivIcon {
  const meta = EVENT_TYPES[event.type];
  const sev = SEVERITY_INFO[event.severity];
  const status = verificationStatus(event);
  const halo = statusColor(status);
  const scale = selected ? 1.3 : 1;
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:26px;height:26px;transform:scale(${scale});">
      <div style="position:absolute;inset:0;border-radius:50%;background:${halo}33;border:2px solid ${halo};box-shadow:0 0 6px ${sev.color};"></div>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:15px;line-height:1;">${meta.glyph}</div>
    </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export default function ChronicleMap({
  events,
  center,
  onMapClick,
  onSelectEvent,
  selectedId,
  draft,
}: ChronicleMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={3}
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
      <FlyTo target={draft ? [draft.lat, draft.lng] : null} />

      {/* Heat halos under markers — translucent severity-tinted discs */}
      {events.map((event) => {
        const intensity = effectiveIntensity(event);
        return (
          <CircleMarker
            key={`halo-${event.id}`}
            center={[event.lat, event.lng]}
            radius={6 + (intensity / 100) * 22}
            pathOptions={{
              color: heatColor(intensity),
              fillColor: heatColor(intensity),
              fillOpacity: 0.12 + (intensity / 100) * 0.22,
              weight: 0,
            }}
          />
        );
      })}

      {/* Event markers */}
      {events.map((event) => {
        const meta = EVENT_TYPES[event.type];
        const sev = SEVERITY_INFO[event.severity];
        const status = verificationStatus(event);
        const selected = event.id === selectedId;
        const corr = event.corroborations.length;
        return (
          <Marker
            key={event.id}
            position={[event.lat, event.lng]}
            icon={eventIcon(event, selected)}
            eventHandlers={{
              click: () => onSelectEvent(selected ? null : event.id),
            }}
          >
            <LeafletTooltip>
              <div className="text-xs" style={{ minWidth: 170 }}>
                <div className="font-bold" style={{ color: sev.color }}>
                  {meta.glyph} {event.title}
                </div>
                <div className="text-content-dim mt-0.5">
                  {meta.label} · <span style={{ color: sev.color }}>{sev.label}</span>
                </div>
                {event.location && (
                  <div className="text-content-secondary mt-0.5">📍 {event.location}</div>
                )}
                {event.description && (
                  <div className="mt-0.5">{event.description}</div>
                )}
                <div className="text-content-dim mt-0.5">
                  {corr > 0 ? `${corr} corroborations · ` : ""}
                  {status}
                </div>
                <div className="text-content-dim" style={{ fontFamily: "monospace", fontSize: 10 }}>
                  {event.hash.slice(0, 16)}…
                </div>
              </div>
            </LeafletTooltip>
          </Marker>
        );
      })}

      {/* Draft pin (event being placed) */}
      {draft && (
        <CircleMarker
          center={[draft.lat, draft.lng]}
          radius={9}
          pathOptions={{
            color: "#ffffff",
            fillColor: "#e23856",
            fillOpacity: 0.9,
            weight: 2,
            dashArray: "4 4",
          }}
        >
          <LeafletTooltip permanent direction="top">
            <div className="text-xs font-bold">NEW EVENT</div>
          </LeafletTooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
