"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import nexusData from "@/data/nexus.json";

/* ═══════════════════════════════════════════════════════════════
   DATA TYPES
   ═══════════════════════════════════════════════════════════════ */

interface NexusActor {
  id: string;
  name: string;
  type: "pep" | "fixer" | "shell" | "trust" | "bank";
  country: string;
  role: string;
  status: string;
  leak: string;
}
interface NexusLink {
  source: string;
  target: string;
  type: "ownership" | "control" | "flow";
  value_musd: number;
  detail: string;
  year: number;
}
interface NexusData {
  actors: NexusActor[];
  links: NexusLink[];
}

type NodeType = NexusActor["type"];
type EdgeType = NexusLink["type"];

interface SimNode {
  id: string;
  name: string;
  type: NodeType;
  country: string;
  role: string;
  status: string;
  leak: string;
  degree: number;
  flowIn: number;
  flowOut: number;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
}

const data = nexusData as unknown as NexusData;

/* ═══════════════════════════════════════════════════════════════
   VISUAL TOKENS
   ═══════════════════════════════════════════════════════════════ */

const NODE_COLOR: Record<NodeType, string> = {
  pep: "#e23856",
  fixer: "#f0a93b",
  shell: "#5b9cf6",
  trust: "#aa44ff",
  bank: "#22d3a6",
};

const NODE_LABEL: Record<NodeType, string> = {
  pep: "Politically exposed person",
  fixer: "Enabler / fixer",
  shell: "Shell company / SPV",
  trust: "Fund / trust / state entity",
  bank: "Bank",
};

const NODE_RADII: Record<NodeType, number> = {
  pep: 17,
  fixer: 15,
  bank: 16,
  trust: 14,
  shell: 11,
};

const EDGE_COLOR: Record<EdgeType, string> = {
  ownership: "#c42b3e",
  control: "#f0a93b",
  flow: "#22d3a6",
};

const EDGE_LABEL: Record<EdgeType, string> = {
  ownership: "Beneficial ownership",
  control: "Control / nominee",
  flow: "Money flow",
};

/* ═══════════════════════════════════════════════════════════════
   BUILD GRAPH
   ═══════════════════════════════════════════════════════════════ */

function buildGraph(): SimNode[] {
  const deg = new Map<string, number>();
  const flowIn = new Map<string, number>();
  const flowOut = new Map<string, number>();
  for (const l of data.links) {
    deg.set(l.source, (deg.get(l.source) ?? 0) + 1);
    deg.set(l.target, (deg.get(l.target) ?? 0) + 1);
    flowOut.set(l.source, (flowOut.get(l.source) ?? 0) + l.value_musd);
    flowIn.set(l.target, (flowIn.get(l.target) ?? 0) + l.value_musd);
  }

  const W = 920,
    H = 620;
  return data.actors.map((a, i) => {
    const d = deg.get(a.id) ?? 0;
    const angle = (i / Math.max(1, data.actors.length)) * Math.PI * 2;
    const r0 = 150 + (i % 6) * 26;
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      country: a.country,
      role: a.role,
      status: a.status,
      leak: a.leak,
      degree: d,
      flowIn: flowIn.get(a.id) ?? 0,
      flowOut: flowOut.get(a.id) ?? 0,
      radius: (NODE_RADII[a.type] ?? 12) + Math.min(8, d * 0.8),
      x: W / 2 + Math.cos(angle) * r0 + (Math.random() - 0.5) * 30,
      y: H / 2 + Math.sin(angle) * r0 + (Math.random() - 0.5) * 30,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
    };
  });
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

const W = 920;
const H = 620;
const REP = 5600;
const LINK = 96;

export default function NexusGraph() {
  const links = data.links;
  const nodesRef = useRef<SimNode[]>(buildGraph());
  const idMapRef = useRef<Map<string, SimNode>>(new Map());
  const alphaRef = useRef<number>(1);
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [, setTick] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [show, setShow] = useState<Record<EdgeType, boolean>>({
    ownership: true,
    control: true,
    flow: true,
  });

  useEffect(() => {
    idMapRef.current = new Map(nodesRef.current.map((n) => [n.id, n]));
  }, []);

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

    // springs along visible edges only
    for (const e of links) {
      if (!show[e.type]) continue;
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

  useEffect(() => {
    alphaRef.current = 1;
    start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    alphaRef.current = Math.max(alphaRef.current, 0.5);
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
    for (const e of links) {
      if (!show[e.type]) continue;
      if (e.source === focus) set.add(e.target);
      if (e.target === focus) set.add(e.source);
    }
    return set;
  }, [focus, links, show]);

  const visibleLinks = useMemo(
    () => links.filter((l) => show[l.type]),
    [links, show]
  );

  const selectedNode = selected ? idMapRef.current.get(selected) ?? null : null;
  const selectedEdges = useMemo(() => {
    if (!selected) return [];
    return links
      .filter((l) => l.source === selected || l.target === selected)
      .map((l) => {
        const other = l.source === selected ? l.target : l.source;
        const dir = l.source === selected ? "→" : "←";
        const otherNode = idMapRef.current.get(other);
        return {
          type: l.type,
          other,
          otherName: otherNode?.name ?? other,
          otherType: otherNode?.type,
          dir,
          detail: l.detail,
          value: l.value_musd,
          year: l.year,
        };
      })
      .sort((a, b) => a.type.localeCompare(b.type));
  }, [selected, links]);

  // label nodes that are high-degree or are PEPs/fixers
  const labelThreshold = useMemo(() => {
    const degrees = nodesRef.current
      .map((n) => n.degree)
      .sort((a, b) => b - a);
    return degrees[Math.min(18, degrees.length - 1)] ?? 0;
  }, []);

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
            className="px-3 py-1.5 text-xs border transition-colors"
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
          className="ml-auto px-3 py-1.5 text-xs border border-border-dim text-content-secondary hover:text-blood-bright hover:border-blood transition-colors"
        >
          ↻ Re-layout
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-4">
        {/* ── SVG canvas ── */}
        <div
          className="border border-border-dim"
          style={{ padding: 0, overflow: "hidden", background: "#080e18" }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              maxHeight: "640px",
              cursor: dragRef.current ? "grabbing" : "default",
              touchAction: "none",
            }}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
          >
            <rect x={0} y={0} width={W} height={H} fill="#080e18" />

            {/* edges */}
            <g>
              {visibleLinks.map((e, i) => {
                const a = idMapRef.current.get(e.source);
                const b = idMapRef.current.get(e.target);
                if (!a || !b) return null;
                const lit = !focus || focus === e.source || focus === e.target;
                const dashed = e.type === "ownership" ? "0" : e.type === "control" ? "4 3" : "0";
                return (
                  <line
                    key={`${e.source}-${e.target}-${e.type}-${i}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={EDGE_COLOR[e.type]}
                    strokeWidth={
                      focus
                        ? lit
                          ? 1.8
                          : 0.4
                        : Math.max(0.7, Math.min(2.6, Math.sqrt(e.value_musd) / 18))
                    }
                    strokeOpacity={focus ? (lit ? 0.9 : 0.07) : 0.45}
                    strokeDasharray={dashed}
                  />
                );
              })}
            </g>

            {/* nodes */}
            <g>
              {nodesRef.current.map((n) => {
                const lit = !focus || connected.has(n.id);
                const isFocus = focus === n.id;
                const color = NODE_COLOR[n.type] ?? "#888";
                return (
                  <g
                    key={n.id}
                    onPointerDown={onNodePointerDown(n.id)}
                    onPointerEnter={() => setHovered(n.id)}
                    onPointerLeave={() =>
                      setHovered((h) => (h === n.id ? null : h))
                    }
                    style={{ cursor: "pointer", opacity: lit ? 1 : 0.22 }}
                  >
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={n.radius}
                      fill={isFocus ? "#fff" : color}
                      stroke={isFocus ? "#fff" : color}
                      strokeWidth={isFocus ? 2.5 : 1}
                      strokeOpacity={isFocus ? 1 : 0.5}
                    />
                    {(n.degree >= labelThreshold ||
                      n.type === "pep" ||
                      n.type === "fixer" ||
                      isFocus) && (
                      <text
                        x={n.x}
                        y={n.y - n.radius - 4}
                        textAnchor="middle"
                        fontSize={9.5}
                        fill="var(--color-content-primary)"
                        style={{
                          pointerEvents: "none",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {n.name.length > 22
                          ? n.name.slice(0, 20) + "…"
                          : n.name}
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
          <div className="border border-border-dim bg-abyss p-3">
            <p className="text-xs uppercase tracking-widest text-blood-bright mb-2 pb-1 border-b border-border-dim">
              &gt; ENTITY DOSSIER
            </p>
            {selectedNode ? (
              <>
                <p className="text-sm text-content-primary font-bold">
                  {selectedNode.name}
                </p>
                <p
                  className="text-[10px] uppercase tracking-wide font-bold"
                  style={{ color: NODE_COLOR[selectedNode.type] }}
                >
                  ● {NODE_LABEL[selectedNode.type]}
                </p>
                <p className="text-[10px] text-content-dim mt-1">
                  {selectedNode.country} · {selectedNode.role}
                </p>
                <p className="text-[10px] text-content-secondary mt-0.5">
                  Status: {selectedNode.status}
                </p>
                <p className="text-[10px] text-content-dim mt-0.5">
                  Source: {selectedNode.leak}
                </p>
                <p className="text-[10px] text-content-dim mt-1">
                  {selectedNode.degree} connections · in $
                  {selectedNode.flowIn.toLocaleString()}M · out $
                  {selectedNode.flowOut.toLocaleString()}M
                </p>
                <div className="space-y-1 mt-2 max-h-56 overflow-y-auto">
                  {selectedEdges.length === 0 && (
                    <p className="text-[11px] text-content-dim">
                      No relationships match current filters.
                    </p>
                  )}
                  {selectedEdges.map((e, i) => (
                    <div
                      key={i}
                      className="text-[11px] leading-snug"
                      style={{ color: "var(--color-content-secondary)" }}
                    >
                      <span style={{ color: EDGE_COLOR[e.type] }}>●</span>{" "}
                      <span className="text-content-dim uppercase text-[9px]">
                        {e.type}
                      </span>{" "}
                      {e.dir} {e.otherName}
                      {e.value > 0 && (
                        <span style={{ color: EDGE_COLOR[e.type] }}>
                          {" "}
                          ${e.value.toLocaleString()}M
                        </span>
                      )}
                      <span className="text-content-dim block text-[9px]">
                        {e.detail}
                        {e.year ? ` · ${e.year}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-[11px] text-content-dim">
                Click any node to inspect its beneficial-ownership, control and
                money-flow links. Drag nodes to rearrange the web.
              </p>
            )}
          </div>

          {/* legend */}
          <div className="border border-border-dim bg-abyss p-3">
            <p className="text-xs uppercase tracking-widest text-content-secondary mb-2 pb-1 border-b border-border-dim">
              &gt; LEGEND
            </p>
            <div className="space-y-1.5">
              {(Object.keys(NODE_COLOR) as NodeType[]).map((t) => (
                <div
                  key={t}
                  className="flex items-center gap-2 text-[11px] text-content-secondary"
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 11,
                      height: 11,
                      borderRadius: 6,
                      background: NODE_COLOR[t],
                    }}
                  />
                  {NODE_LABEL[t]}
                </div>
              ))}
              <div className="flex items-center gap-2 text-[11px] text-content-secondary pt-1 border-t border-border-dim mt-2">
                <span
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 2,
                    background: EDGE_COLOR.ownership,
                  }}
                />
                Ownership (solid)
              </div>
              <div className="flex items-center gap-2 text-[11px] text-content-secondary">
                <span
                  style={{
                    display: "inline-block",
                    width: 14,
                    borderTop: "2px dashed",
                    borderColor: EDGE_COLOR.control,
                  }}
                />
                Control (dashed)
              </div>
              <div className="flex items-center gap-2 text-[11px] text-content-secondary">
                <span
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 2,
                    background: EDGE_COLOR.flow,
                  }}
                />
                Money flow (solid)
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-content-dim mt-2">
        Force-directed beneficial-ownership graph · {data.actors.length}{" "}
        entities · {data.links.length} relationships. Indicative values (M USD)
        for visualization (ICIJ / OCCRP / DOJ / Tax Justice Network).
      </p>
    </div>
  );
}
