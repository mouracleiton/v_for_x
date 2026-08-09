"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import relData from "@/data/relationships.json";

/* ═══════════════════════════════════════════════════════════════
   DATA TYPES
   ═══════════════════════════════════════════════════════════════ */

interface ArmsTransfer {
  source_iso3: string;
  target_iso3: string;
  value_musd: number;
  category: string;
}
interface SanctionRel {
  imposer_iso3: string;
  target_iso3: string;
  type: string;
}
interface AidFlow {
  donor_iso3: string;
  recipient_iso3: string;
  amount_musd: number;
}
interface Relationships {
  arms_transfers: ArmsTransfer[];
  sanctions: SanctionRel[];
  aid_flows: AidFlow[];
}

type EdgeType = "arms" | "sanctions" | "aid";

interface GraphEdge {
  source: string;
  target: string;
  type: EdgeType;
  value: number; // flow weight for sizing
  label: string;
}

interface SimNode {
  id: string;
  name: string;
  volume: number;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
}

/* ═══════════════════════════════════════════════════════════════
   ISO3 → NAME (covers every code in the dataset)
   ═══════════════════════════════════════════════════════════════ */

const NAMES: Record<string, string> = {
  USA: "United States", RUS: "Russia", FRA: "France", CHN: "China",
  DEU: "Germany", GBR: "United Kingdom", ITA: "Italy", ESP: "Spain",
  ISR: "Israel", KOR: "South Korea", EU: "European Union", UN: "United Nations",
  SAU: "Saudi Arabia", IND: "India", EGY: "Egypt", AUS: "Australia",
  JPN: "Japan", QAT: "Qatar", ARE: "UAE", TWN: "Taiwan", UKR: "Ukraine",
  DZA: "Algeria", IRN: "Iran", VNM: "Vietnam", GRC: "Greece", PAK: "Pakistan",
  BGD: "Bangladesh", MMR: "Myanmar", NGA: "Nigeria", HUN: "Hungary",
  OMN: "Oman", POL: "Poland", AZE: "Azerbaijan", PRK: "North Korea",
  CUB: "Cuba", VEN: "Venezuela", SYR: "Syria", BLR: "Belarus", SDN: "Sudan",
  AFG: "Afghanistan", CAN: "Canada", SWE: "Sweden", NOR: "Norway",
  NLD: "Netherlands", ETH: "Ethiopia", YEM: "Yemen", COL: "Colombia",
  TUR: "Türkiye", JOR: "Jordan", LBN: "Lebanon", IDN: "Indonesia",
};

const EDGE_COLOR: Record<EdgeType, string> = {
  arms: "#c42b3e",
  sanctions: "#f0a93b",
  aid: "#22d3a6",
};

const EDGE_LABEL: Record<EdgeType, string> = {
  arms: "Arms transfers",
  sanctions: "Sanctions",
  aid: "Aid flows",
};

const SANCTION_WEIGHT = 1000; // nominal weight so sanctioned hubs size visibly

/* ═══════════════════════════════════════════════════════════════
   BUILD GRAPH
   ═══════════════════════════════════════════════════════════════ */

function buildGraph(rel: Relationships): { nodes: SimNode[]; edges: GraphEdge[] } {
  const edges: GraphEdge[] = [];
  for (const a of rel.arms_transfers)
    edges.push({ source: a.source_iso3, target: a.target_iso3, type: "arms", value: a.value_musd, label: `${a.category} · $${a.value_musd.toLocaleString()}M` });
  for (const s of rel.sanctions)
    edges.push({ source: s.imposer_iso3, target: s.target_iso3, type: "sanctions", value: SANCTION_WEIGHT, label: `${s.type} sanctions` });
  for (const f of rel.aid_flows)
    edges.push({ source: f.donor_iso3, target: f.recipient_iso3, type: "aid", value: f.amount_musd, label: `Aid · $${f.amount_musd.toLocaleString()}M` });

  const vol = new Map<string, number>();
  for (const e of edges) {
    vol.set(e.source, (vol.get(e.source) ?? 0) + e.value);
    vol.set(e.target, (vol.get(e.target) ?? 0) + e.value);
  }

  const maxVol = Math.max(1, ...vol.values());
  const ids = [...vol.keys()];
  const W = 920, H = 600;
  const nodes: SimNode[] = ids.map((id, i) => {
    const angle = (i / Math.max(1, ids.length)) * Math.PI * 2;
    const r0 = 160 + (i % 5) * 18;
    return {
      id,
      name: NAMES[id] ?? id,
      volume: vol.get(id) ?? 0,
      radius: 6 + Math.sqrt(vol.get(id) ?? 1) * (18 / Math.sqrt(maxVol)),
      x: W / 2 + Math.cos(angle) * r0 + (Math.random() - 0.5) * 20,
      y: H / 2 + Math.sin(angle) * r0 + (Math.random() - 0.5) * 20,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
    };
  });

  return { nodes, edges };
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

const W = 920;
const H = 600;
const REP = 4200;
const LINK = 95;

export default function RelationshipGraph() {
  const data = relData as unknown as Relationships;
  const graph = useMemo(() => buildGraph(data), [data]);

  const nodesRef = useRef<SimNode[]>(graph.nodes);
  const idMapRef = useRef<Map<string, SimNode>>(new Map());
  const alphaRef = useRef<number>(1);
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<string | null>(null);

  const [, setTick] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [show, setShow] = useState<Record<EdgeType, boolean>>({
    arms: true,
    sanctions: true,
    aid: true,
  });

  // rebuild id map when nodes change
  useEffect(() => {
    idMapRef.current = new Map(nodesRef.current.map((n) => [n.id, n]));
  }, [graph]);

  const start = () => {
    if (rafRef.current !== null) return;
    const loop = () => {
      step();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const stop = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const step = () => {
    const nodes = nodesRef.current;
    const idMap = idMapRef.current;
    alphaRef.current *= 0.984;
    const alpha = Math.max(alphaRef.current, 0.04);
    const settled = alphaRef.current < 0.05 && dragRef.current === null;

    // repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          d2 = 1;
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
        }
        const d = Math.sqrt(d2);
        const force = REP / d2;
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // springs along every edge (full graph keeps layout connected)
    for (const e of graph.edges) {
      const a = idMap.get(e.source);
      const b = idMap.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const diff = (d - LINK) * 0.02;
      const fx = (dx / d) * diff;
      const fy = (dy / d) * diff;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // integrate + centering
    for (const n of nodes) {
      if (n.fx !== null && n.fy !== null) {
        n.x = n.fx;
        n.y = n.fy;
        n.vx = 0;
        n.vy = 0;
        continue;
      }
      n.vx += (W / 2 - n.x) * 0.002;
      n.vy += (H / 2 - n.y) * 0.002;
      n.vx *= 0.85;
      n.vy *= 0.85;
      n.x += n.vx * alpha * 2;
      n.y += n.vy * alpha * 2;
      n.x = Math.max(n.radius, Math.min(W - n.radius, n.x));
      n.y = Math.max(n.radius, Math.min(H - n.radius, n.y));
    }

    setTick((t) => (t + 1) % 1_000_000);
    if (settled) stop();
  };

  // mount: seed + start
  useEffect(() => {
    alphaRef.current = 1;
    start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // restart on filter change (keeps positions, re-seeds energy)
  useEffect(() => {
    alphaRef.current = 1;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const restart = () => {
    for (const n of nodesRef.current) {
      n.fx = null;
      n.fy = null;
    }
    alphaRef.current = 1;
    start();
  };

  /* ── pointer / drag ── */
  const toView = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  };

  const svgRef = useRef<SVGSVGElement | null>(null);

  const onNodePointerDown = (id: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = id;
    setSelected(id);
    const n = idMapRef.current.get(id);
    if (n) {
      n.fx = n.x;
      n.fy = n.y;
    }
    alphaRef.current = Math.max(alphaRef.current, 0.6);
    start();
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { x, y } = toView(e.clientX, e.clientY);
    const n = idMapRef.current.get(dragRef.current);
    if (n) {
      n.fx = x;
      n.fy = y;
    }
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  /* ── derived view ── */
  const focus = hovered ?? selected;
  const connected = useMemo(() => {
    const set = new Set<string>();
    if (!focus) return set;
    set.add(focus);
    for (const e of graph.edges) {
      if (e.source === focus) set.add(e.target);
      if (e.target === focus) set.add(e.source);
    }
    return set;
  }, [focus, graph.edges]);

  const visibleEdges = useMemo(
    () => graph.edges.filter((e) => show[e.type]),
    [graph.edges, show]
  );

  const selectedNode = selected ? idMapRef.current.get(selected) ?? null : null;
  const selectedEdges = useMemo(() => {
    if (!selected) return [];
    return graph.edges
      .filter((e) => e.source === selected || e.target === selected)
      .map((e) => {
        const other = e.source === selected ? e.target : e.source;
        const dir = e.source === selected ? "→" : "←";
        return {
          type: e.type,
          other,
          otherName: NAMES[other] ?? other,
          dir,
          label: e.label,
        };
      })
      .sort((a, b) => a.type.localeCompare(b.type));
  }, [selected, graph.edges]);

  const labelThreshold = useMemo(() => {
    const vols = nodesRef.current.map((n) => n.volume).sort((a, b) => b - a);
    return vols[Math.min(14, vols.length - 1)] ?? 0;
  }, [graph]);

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="w-full">
      {/* ── Filter + legend bar ── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {(Object.keys(EDGE_COLOR) as EdgeType[]).map((t) => (
          <button
            key={t}
            onClick={() => setShow((s) => ({ ...s, [t]: !s[t] }))}
            className="inline-pill px-3 py-1.5 text-xs border transition-colors"
            style={{
              borderColor: show[t] ? EDGE_COLOR[t] : "var(--color-border-dim)",
              color: show[t] ? EDGE_COLOR[t] : "var(--color-content-dim)",
              opacity: show[t] ? 1 : 0.5,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                background: EDGE_COLOR[t],
                marginRight: 6,
                verticalAlign: "middle",
              }}
            />
            {EDGE_LABEL[t]}
          </button>
        ))}
        <button
          onClick={restart}
          className="inline-pill px-3 py-1.5 text-xs border border-border-dim text-content-secondary hover:text-command-bright hover:border-command transition-colors ml-auto"
        >
          ↻ Re-layout
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
        {/* ── SVG canvas ── */}
        <div
          className="terminal-card"
          style={{ padding: 0, overflow: "hidden" }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ width: "100%", height: "100%", display: "block", cursor: dragRef.current ? "grabbing" : "default", touchAction: "none" }}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
          >
            <rect x={0} y={0} width={W} height={H} fill="#080e18" />

            {/* edges */}
            <g>
              {visibleEdges.map((e, i) => {
                const a = idMapRef.current.get(e.source);
                const b = idMapRef.current.get(e.target);
                if (!a || !b) return null;
                const lit = !focus || focus === e.source || focus === e.target;
                return (
                  <line
                    key={`${e.source}-${e.target}-${e.type}-${i}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={EDGE_COLOR[e.type]}
                    strokeWidth={focus ? (lit ? 1.6 : 0.4) : Math.max(0.6, Math.min(2.4, Math.sqrt(e.value) / 28))}
                    strokeOpacity={focus ? (lit ? 0.9 : 0.08) : 0.45}
                  />
                );
              })}
            </g>

            {/* nodes */}
            <g>
              {nodesRef.current.map((n) => {
                const lit = !focus || connected.has(n.id);
                const isFocus = focus === n.id;
                return (
                  <g
                    key={n.id}
                    onPointerDown={onNodePointerDown(n.id)}
                    onPointerEnter={() => setHovered(n.id)}
                    onPointerLeave={() => setHovered((h) => (h === n.id ? null : h))}
                    style={{ cursor: "pointer", opacity: lit ? 1 : 0.25 }}
                  >
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={n.radius}
                      fill={isFocus ? "var(--color-command-bright)" : "var(--color-command)"}
                      stroke={isFocus ? "#fff" : "var(--color-border-bright)"}
                      strokeWidth={isFocus ? 2 : 1}
                    />
                    {(n.volume >= labelThreshold || isFocus) && (
                      <text
                        x={n.x}
                        y={n.y - n.radius - 4}
                        textAnchor="middle"
                        fontSize={10}
                        fill="var(--color-content-primary)"
                        style={{ pointerEvents: "none", fontFamily: "var(--font-mono)" }}
                      >
                        {n.id}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* ── Detail panel ── */}
        <div className="space-y-3">
          <div className="terminal-card p-3">
            <p className="text-xs uppercase tracking-widest text-terminal-green mb-2 pb-1 border-b border-border-dim">
              &gt; NODE DETAIL
            </p>
            {selectedNode ? (
              <>
                <p className="text-sm text-content-primary font-bold">
                  {selectedNode.name}
                </p>
                <p className="text-[10px] text-content-dim mb-2">
                  {selectedNode.id} · total flow volume {selectedNode.volume.toLocaleString()}
                </p>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {selectedEdges.length === 0 && (
                    <p className="text-[11px] text-content-dim">
                      No relationships in dataset.
                    </p>
                  )}
                  {selectedEdges.map((e, i) => (
                    <div
                      key={i}
                      className="text-[11px] leading-snug"
                      style={{ color: "var(--color-content-secondary)" }}
                    >
                      <span style={{ color: EDGE_COLOR[e.type] }}>●</span>{" "}
                      {e.dir} {e.otherName}{" "}
                      <span className="text-content-dim">({e.label})</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-[11px] text-content-dim">
                Click any node to inspect its arms, sanctions and aid
                relationships. Drag nodes to rearrange.
              </p>
            )}
          </div>

          {/* legend */}
          <div className="terminal-card p-3">
            <p className="text-xs uppercase tracking-widest text-content-secondary mb-2 pb-1 border-b border-border-dim">
              &gt; LEGEND
            </p>
            <div className="space-y-1.5">
              {(Object.keys(EDGE_COLOR) as EdgeType[]).map((t) => (
                <div key={t} className="flex items-center gap-2 text-[11px] text-content-secondary">
                  <span
                    style={{
                      display: "inline-block",
                      width: 16,
                      height: 2,
                      background: EDGE_COLOR[t],
                    }}
                  />
                  {EDGE_LABEL[t]}
                </div>
              ))}
              <div className="flex items-center gap-2 text-[11px] text-content-secondary pt-1 border-t border-border-dim mt-2">
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    background: "var(--color-command)",
                  }}
                />
                Node size ∝ total flow volume
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-content-dim mt-2">
        Force-directed graph · {nodesRef.current.length} actors ·{" "}
        {graph.edges.length} relationships. Indicative values for visualization
        (SIPRI / UN / EU / US / OECD).
      </p>
    </div>
  );
}
