"use client";

import { useState, useMemo } from "react";
import dossiersData from "@/data/dossier-seed.json";

interface DossierEntry {
  id: string;
  subject: string;
  accusation: string;
  category: string;
  evidence: { description: string; type?: string }[];
}

interface Entity {
  id: string;
  name: string;
  type: "person" | "org" | "country";
  dossierId: string;
}

interface Edge {
  source: string;
  target: string;
  label: string;
}

const TYPE_COLORS: Record<string, string> = {
  person: "#e23856",
  org: "#f0a93b",
  country: "#5b9cf6",
};

const TYPE_RADII: Record<string, number> = {
  person: 16,
  org: 20,
  country: 24,
};

function extractEntities(dossiers: DossierEntry[]): { entities: Entity[]; edges: Edge[] } {
  const entities: Entity[] = [];
  const edges: Edge[] = [];
  const seen = new Map<string, Entity>();

  for (const d of dossiers) {
    const parts = d.subject.split(/[,;]/);
    for (const part of parts) {
      const name = part.trim();
      if (!name || name.length < 3) continue;

      let type: Entity["type"] = "person";
      const lower = name.toLowerCase();
      if (/regime|party|military|army|government|ministry|force|group|militia|council|authority|commission|battalion|brigade/.test(lower)) {
        type = "org";
      }
      if (/\b(syria|sudan|myanmar|north korea|russia|china|iran|ethiopia|eritrea|afghanistan|burma|drc|congo)\b/.test(lower)) {
        type = "country";
      }

      const key = name.toLowerCase();
      if (!seen.has(key)) {
        const e: Entity = {
          id: `${key.replace(/\s+/g, "_")}`,
          name: name.length > 28 ? name.slice(0, 26) + "…" : name,
          type,
          dossierId: d.id,
        };
        seen.set(key, e);
        entities.push(e);
      }
    }

    // Connect entities within the same dossier
    const dEntities = parts
      .map((p) => p.trim().toLowerCase().replace(/\s+/g, "_"))
      .filter((k) => seen.has(k));
    for (let i = 0; i < dEntities.length; i++) {
      for (let j = i + 1; j < dEntities.length; j++) {
        const s = dEntities[i];
        const t = dEntities[j];
        if (s !== t) {
          edges.push({ source: s, target: t, label: d.category });
        }
      }
    }
  }

  return { entities, edges };
}

function layoutEntities(entities: Entity[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const cx = 400;
  const cy = 300;

  // Ring layout by type
  const byType: Record<string, Entity[]> = { person: [], org: [], country: [] };
  entities.forEach((e) => byType[e.type]?.push(e));

  const ringRadii = { country: 100, org: 200, person: 280 };
  const ringKeys: Entity["type"][] = ["country", "org", "person"];

  for (const type of ringKeys) {
    const group = byType[type] ?? [];
    const r = ringRadii[type];
    group.forEach((e, i) => {
      const angle = (i / Math.max(group.length, 1)) * Math.PI * 2 - Math.PI / 2;
      positions.set(e.id, {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      });
    });
  }

  return positions;
}

export default function NetworkGraph() {
  const [hovered, setHovered] = useState<string | null>(null);

  const { entities, edges, positions } = useMemo(() => {
    const dossiers = (Array.isArray(dossiersData) ? dossiersData : []) as DossierEntry[];
    const { entities: ents, edges: eds } = extractEntities(dossiers);
    const pos = layoutEntities(ents);
    return { entities: ents, edges: eds, positions: pos };
  }, []);

  if (entities.length === 0) {
    return (
      <div className="text-center py-12 text-content-dim font-mono text-sm">
        No network data available
      </div>
    );
  }

  // Determine connected nodes for hover highlighting
  const connections = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!map.has(e.source)) map.set(e.source, new Set());
      if (!map.has(e.target)) map.set(e.target, new Set());
      map.get(e.source)!.add(e.target);
      map.get(e.target)!.add(e.source);
    }
    return map;
  }, [edges]);

  const isHighlighted = (id: string) => {
    if (!hovered) return true;
    if (id === hovered) return true;
    return connections.get(hovered)?.has(id) ?? false;
  };

  return (
    <div className="border border-border-dim bg-abyss overflow-hidden">
      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border-dim text-[10px]">
        <span className="text-content-dim">NETWORK LEGEND:</span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: TYPE_COLORS.person }} />
          <span className="text-content-secondary">Person</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: TYPE_COLORS.org }} />
          <span className="text-content-secondary">Organization</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: TYPE_COLORS.country }} />
          <span className="text-content-secondary">State/Regime</span>
        </span>
        <span className="text-content-dim ml-auto">{entities.length} nodes · {edges.length} connections</span>
      </div>

      <svg viewBox="0 0 800 600" className="w-full" style={{ maxHeight: "500px", background: "#080e18" }}>
        {/* Edges */}
        {edges.map((e, i) => {
          const s = positions.get(e.source);
          const t = positions.get(e.target);
          if (!s || !t) return null;
          const dim = hovered && e.source !== hovered && e.target !== hovered;
          return (
            <line
              key={i}
              x1={s.x}
              y1={s.y}
              x2={t.x}
              y2={t.y}
              stroke={dim ? "#1a2a44" : "#3a5070"}
              strokeWidth={dim ? 0.5 : 1}
              opacity={dim ? 0.3 : 0.6}
            />
          );
        })}

        {/* Nodes */}
        {entities.map((e) => {
          const pos = positions.get(e.id);
          if (!pos) return null;
          const highlighted = isHighlighted(e.id);
          const r = TYPE_RADII[e.type] ?? 14;
          const color = TYPE_COLORS[e.type] ?? "#888";
          return (
            <g
              key={e.id}
              transform={`translate(${pos.x},${pos.y})`}
              onMouseEnter={() => setHovered(e.id)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer", opacity: highlighted ? 1 : 0.2, transition: "opacity 0.2s" }}
            >
              <circle
                r={r}
                fill={color}
                fillOpacity={0.3}
                stroke={color}
                strokeWidth={hovered === e.id ? 2.5 : 1}
              />
              <circle r={3} fill={color} />
              <text
                y={r + 10}
                textAnchor="middle"
                fill={highlighted ? "#dfe7f5" : "#4a5d7a"}
                fontSize="9"
                fontFamily="monospace"
              >
                {e.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover detail */}
      <div className="px-4 py-2 border-t border-border-dim text-[10px] text-content-dim font-mono min-h-[28px]">
        {hovered ? (
          <span>
            <span style={{ color: TYPE_COLORS[entities.find((e) => e.id === hovered)?.type ?? "person"] }}>
              ● {entities.find((e) => e.id === hovered)?.name}
            </span>
            <span className="text-content-dim ml-2">
              → Dossier: {entities.find((e) => e.id === hovered)?.dossierId}
              {" · "}
              {connections.get(hovered)?.size ?? 0} connections
            </span>
          </span>
        ) : (
          <span>Hover a node to see connections. Lines connect entities that appear in the same dossier.</span>
        )}
      </div>
    </div>
  );
}
