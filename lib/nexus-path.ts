/**
 * V FOR X — Nexus Path-Finder (degrees of separation in the kleptocracy graph)
 *
 * Answers the investigator's question: "how many shells separate actor A
 * from actor B?" Runs a breadth-first search over the beneficial-
 * ownership graph in `data/nexus.json` (actors + links) to find the
 * shortest connection path, the degrees of separation, and a node's
 * neighborhood. Fully offline — the graph is static and ships with the
 * build.
 *
 * The graph is treated as undirected for "degrees of separation" (a
 * link is a connection regardless of direction), since money and
 * control flow both ways in these networks. Directed mode is available
 * for tracing specific flow paths.
 *
 * Results are exportable as evidence: a path is a citable chain of
 * named links, each carrying its own source detail.
 */

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface NexusActor {
  id: string;
  name?: string;
  type?: string;
  country?: string;
  role?: string;
  status?: string;
  leak?: string;
}

export interface NexusLink {
  source: string;
  target: string;
  type?: string;
  value_musd?: number;
  detail?: string;
  year?: number;
}

export interface NexusGraph {
  actors: NexusActor[];
  links: NexusLink[];
}

export interface PathStep {
  /** Actor id at this hop. */
  actor: string;
  /** The link that led here from the previous actor. */
  via?: NexusLink;
}

export interface PathResult {
  /** Whether a path exists. */
  found: boolean;
  /** The path as a sequence of actors + the links between them. */
  path: PathStep[];
  /** Degrees of separation (edges traversed). 0 = same actor. */
  degrees: number;
  /** Total money flow along the path (sum of value_musd, millions USD). */
  totalValueMusd: number;
}

export interface NeighborhoodResult {
  actor: string;
  /** Direct neighbors by hop distance. */
  byHop: Record<number, string[]>;
  /** All actors within `maxHops`. */
  within: string[];
}

/* ═══════════════════════════════════════════════════════════════
   Graph construction
   ═══════════════════════════════════════════════════════════════ */

/**
 * Build an adjacency map from the graph. When `directed` is false
 * (default), each link is added in both directions.
 */
export function buildAdjacency(
  graph: NexusGraph,
  directed = false,
): Map<string, { neighbor: string; link: NexusLink }[]> {
  const adj = new Map<string, { neighbor: string; link: NexusLink }[]>();
  const ensure = (id: string) => {
    if (!adj.has(id)) adj.set(id, []);
    return adj.get(id)!;
  };
  for (const l of graph.links) {
    ensure(l.source).push({ neighbor: l.target, link: l });
    if (!directed) ensure(l.target).push({ neighbor: l.source, link: l });
    else ensure(l.target);
  }
  // Ensure isolated actors appear too.
  for (const a of graph.actors) ensure(a.id);
  return adj;
}

/** Look up an actor by id (or by name, case-insensitively). */
export function findActor(graph: NexusGraph, query: string): NexusActor | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  for (const a of graph.actors) {
    if (a.id.toLowerCase() === q) return a;
  }
  for (const a of graph.actors) {
    if (a.name && a.name.toLowerCase().includes(q)) return a;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   Shortest path (BFS)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Find the shortest path between two actors by BFS.
 * Returns the path, the degrees of separation, and the total money
 * flow along the path. `maxDegrees` caps the search (default 6).
 */
export function shortestPath(
  graph: NexusGraph,
  fromId: string,
  toId: string,
  options: { directed?: boolean; maxDegrees?: number } = {},
): PathResult {
  if (fromId === toId) {
    return { found: true, path: [{ actor: fromId }], degrees: 0, totalValueMusd: 0 };
  }
  const directed = options.directed ?? false;
  const maxDegrees = options.maxDegrees ?? 6;
  const adj = buildAdjacency(graph, directed);

  // BFS with parent tracking.
  const visited = new Set<string>([fromId]);
  const parent = new Map<string, { actor: string; link: NexusLink }>();
  const queue: { id: string; dist: number }[] = [{ id: fromId, dist: 0 }];

  let found = false;
  while (queue.length > 0) {
    const { id, dist } = queue.shift()!;
    if (dist >= maxDegrees) continue;
    const neighbors = adj.get(id) ?? [];
    for (const { neighbor, link } of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      parent.set(neighbor, { actor: id, link });
      if (neighbor === toId) {
        found = true;
        queue.length = 0; // break out
        break;
      }
      queue.push({ id: neighbor, dist: dist + 1 });
    }
  }

  if (!found) return { found: false, path: [], degrees: -1, totalValueMusd: 0 };

  // Reconstruct path.
  const path: PathStep[] = [{ actor: toId }];
  let totalValueMusd = 0;
  let cur = toId;
  while (cur !== fromId) {
    const p = parent.get(cur);
    if (!p) break;
    path.unshift({ actor: p.actor, via: p.link });
    if (typeof p.link.value_musd === "number") totalValueMusd += p.link.value_musd;
    cur = p.actor;
  }

  return {
    found: true,
    path,
    degrees: path.length - 1,
    totalValueMusd,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Neighborhood
   ═══════════════════════════════════════════════════════════════ */

/**
 * Find all actors within `maxHops` of a given actor (BFS).
 * Returns neighbors bucketed by hop distance.
 */
export function neighborhood(
  graph: NexusGraph,
  actorId: string,
  maxHops = 2,
): NeighborhoodResult {
  const adj = buildAdjacency(graph, false);
  const byHop: Record<number, string[]> = {};
  const visited = new Set<string>([actorId]);
  const queue: { id: string; dist: number }[] = [{ id: actorId, dist: 0 }];

  while (queue.length > 0) {
    const { id, dist } = queue.shift()!;
    if (dist > 0) {
      (byHop[dist] ??= []).push(id);
    }
    if (dist >= maxHops) continue;
    for (const { neighbor } of adj.get(id) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ id: neighbor, dist: dist + 1 });
      }
    }
  }

  const within = Object.values(byHop).flat();
  return { actor: actorId, byHop, within };
}

/* ═══════════════════════════════════════════════════════════════
   Graph-wide utilities
   ═══════════════════════════════════════════════════════════════ */

/** Degree (number of links) for each actor. */
export function degreeCentrality(graph: NexusGraph): Record<string, number> {
  const adj = buildAdjacency(graph, false);
  const out: Record<string, number> = {};
  for (const [id, neighbors] of adj.entries()) out[id] = neighbors.length;
  return out;
}

/** Top-N most-connected actors. */
export function topHubs(graph: NexusGraph, limit = 10): { actor: string; degree: number }[] {
  const deg = degreeCentrality(graph);
  return Object.entries(deg)
    .map(([actor, degree]) => ({ actor, degree }))
    .sort((a, b) => b.degree - a.degree)
    .slice(0, limit);
}

/** Count of distinct connected components. */
export function componentCount(graph: NexusGraph): number {
  const adj = buildAdjacency(graph, false);
  const visited = new Set<string>();
  let count = 0;
  for (const id of adj.keys()) {
    if (visited.has(id)) continue;
    count++;
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const { neighbor } of adj.get(cur) ?? []) {
        if (!visited.has(neighbor)) stack.push(neighbor);
      }
    }
  }
  return count;
}

/* ═══════════════════════════════════════════════════════════════
   Evidence export
   ═══════════════════════════════════════════════════════════════ */

/**
 * Render a path as a citable evidence chain — one line per hop with
 * the link type, detail, and value. Suitable for appending to the
 * Evidence Room or Witness ledger.
 */
export function pathToEvidence(graph: NexusGraph, result: PathResult): string {
  if (!result.found) return "No path found.";
  const actorName = (id: string) => {
    const a = graph.actors.find((x) => x.id === id);
    return a?.name ?? id;
  };
  const lines: string[] = [`NEXUS PATH · ${result.degrees} degree${result.degrees === 1 ? "" : "s"} of separation`];
  for (let i = 0; i < result.path.length; i++) {
    const step = result.path[i]!;
    if (i === 0) {
      lines.push(`  ${actorName(step.actor)}`);
    } else {
      const link = step.via;
      const val = link?.value_musd ? ` · $${link.value_musd}M` : "";
      const detail = link?.detail ? ` (${link.detail})` : "";
      const type = link?.type ? ` [${link.type}]` : "";
      lines.push(`    └─${type}${detail}${val}`);
      lines.push(`  ${actorName(step.actor)}`);
    }
  }
  if (result.totalValueMusd > 0) {
    lines.push(`TOTAL TRACEABLE FLOW: $${result.totalValueMusd.toLocaleString()}M`);
  }
  return lines.join("\n");
}

/** One-line summary of a path result. */
export function summarizePath(result: PathResult): string {
  if (!result.found) return "no connection found";
  return `${result.degrees} degree${result.degrees === 1 ? "" : "s"} · ${result.path.length} actors${result.totalValueMusd > 0 ? ` · $${result.totalValueMusd}M traced` : ""}`;
}
