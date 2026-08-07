"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip as LeafletTooltip } from "react-leaflet";
import { formatNumber } from "@/lib/format";
import { flowWidth, flowColor, type FlowEdge, type FlowNode } from "@/lib/flows";

export interface FlowMapProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  maxFlow: number;
  layerMode: "refugees" | "displaced" | "idps";
  selectedOrigin: string | null;
  onSelectOrigin: (iso3: string | null) => void;
  onHoverFlow: (edge: FlowEdge | null) => void;
  centroidsData: Record<string, [number, number]>;
  maxNodeValue: number;
  maxHostValue: number;
}

/** Build arc coordinates (quadratic bezier approximated with intermediate points) */
function arcPoints(from: [number, number], to: [number, number]): [number, number][] {
  const [lat1, lng1] = from;
  const [lat2, lng2] = to;
  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;
  const dx = lng2 - lng1;
  const dy = lat2 - lat1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const offset = Math.min(dist * 0.2, 15);
  const curveLat = midLat + (dy / dist) * offset;
  const curveLng = midLng - (dx / dist) * offset;

  const points: [number, number][] = [];
  const steps = 32;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const oneMinusT = 1 - t;
    const lat = oneMinusT * oneMinusT * lat1 + 2 * oneMinusT * t * curveLat + t * t * lat2;
    const lng = oneMinusT * oneMinusT * lng1 + 2 * oneMinusT * t * curveLng + t * t * lng2;
    points.push([lat, lng]);
  }
  return points;
}

export default function FlowMap({
  nodes,
  edges,
  maxFlow,
  layerMode,
  selectedOrigin,
  onSelectOrigin,
  onHoverFlow,
  centroidsData,
  maxNodeValue,
  maxHostValue,
}: FlowMapProps) {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={2}
      maxZoom={6}
      style={{ width: "100%", height: "100%", background: "#0a0a0a" }}
      worldCopyJump
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
      />

      {/* Flow arcs */}
      {edges.map((edge, i) => {
        const from = centroidsData[edge.from];
        const to = centroidsData[edge.to];
        if (!from || !to) return null;
        const points = arcPoints(from, to);
        return (
          <Polyline
            key={`${edge.from}-${edge.to}-${i}`}
            positions={points}
            pathOptions={{
              color: flowColor(edge.type),
              weight: flowWidth(edge.estimatedFlow, maxFlow),
              opacity: selectedOrigin ? 0.8 : 0.4,
            }}
            eventHandlers={{
              mouseover: () => onHoverFlow(edge),
              mouseout: () => onHoverFlow(null),
            }}
          />
        );
      })}

      {/* Origin nodes (red) */}
      {nodes.filter((n) => {
        const v = layerMode === "refugees" ? n.refugeesOrigin : layerMode === "displaced" ? n.forciblyDisplaced : n.idpsDisaster;
        return v > 0;
      }).map((n) => {
        const pos = centroidsData[n.iso3];
        if (!pos) return null;
        const v = layerMode === "refugees" ? n.refugeesOrigin : layerMode === "displaced" ? n.forciblyDisplaced : n.idpsDisaster;
        const radius = 3 + Math.sqrt(v / (maxNodeValue || 1)) * 12;
        return (
          <CircleMarker
            key={n.iso3}
            center={pos}
            radius={radius}
            pathOptions={{
              color: "#ff0000",
              fillColor: "#cc0000",
              fillOpacity: 0.7,
              weight: 1,
            }}
            eventHandlers={{
              click: () => {
                onSelectOrigin(selectedOrigin === n.iso3 ? null : n.iso3);
              },
            }}
          >
            <LeafletTooltip>
              <div className="text-xs">
                <div className="font-bold">{n.name} ({n.iso3})</div>
                <div>Origin: {formatNumber(n.refugeesOrigin)} refugees</div>
                {n.forciblyDisplaced > 0 && <div>Displaced: {formatNumber(n.forciblyDisplaced)}</div>}
                {n.idpsDisaster > 0 && <div>IDPs: {formatNumber(n.idpsDisaster)}</div>}
                <div className="text-content-dim mt-1">Click to trace flows</div>
              </div>
            </LeafletTooltip>
          </CircleMarker>
        );
      })}

      {/* Host nodes (green) */}
      {nodes.filter((n) => n.refugeesHosted > 50000).map((n) => {
        const pos = centroidsData[n.iso3];
        if (!pos) return null;
        const radius = 3 + Math.sqrt(n.refugeesHosted / (maxHostValue || 1)) * 10;
        return (
          <CircleMarker
            key={`host-${n.iso3}`}
            center={pos}
            radius={radius}
            pathOptions={{
              color: "#00ff41",
              fillColor: "#006633",
              fillOpacity: 0.6,
              weight: 1,
              dashArray: "3",
            }}
          >
            <LeafletTooltip>
              <div className="text-xs">
                <div className="font-bold">{n.name} ({n.iso3})</div>
                <div>Hosting: {formatNumber(n.refugeesHosted)} refugees</div>
              </div>
            </LeafletTooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
