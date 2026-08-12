/**
 * Phase 26 C — Self-healing mesh on peer loss (lib/mesh-presence.ts)
 *
 * reSuperposeOnLoss(): on markPeerOffline, recompute presence/amplitude over
 * the surviving subgraph via an injectable weighting fn (seam for item A's
 * amplitude applied to peers). collapseCoordinator(): pick a transient
 * relay-coordinator peer for one tick via a seeded RNG, decoheres on next
 * presence tick. No-amplitude fallback = current behavior (closest by hop).
 */
import { describe, it, expect } from "vitest";
import {
  reSuperposeOnLoss,
  collapseCoordinator,
  defaultPeerWeight,
  markPeerOffline,
  getOnlinePeers,
  type MeshGraph,
  type MeshPresence,
} from "@/lib/mesh-presence";

function makePeer(hash: string, opts: Partial<MeshPresence> = {}): MeshPresence {
  return {
    peerHash: hash,
    status: "online",
    hopCount: 0,
    lastSeen: Date.now(),
    quality: 0.8,
    ...opts,
  };
}

function makeGraph(local: string, peers: MeshPresence[]): MeshGraph {
  const map = new Map<string, MeshPresence>();
  for (const p of peers) map.set(p.peerHash, p);
  return {
    roomHash: "room-test",
    peers: map,
    lastUpdate: Date.now(),
    localPeerHash: local,
  };
}

describe("reSuperposeOnLoss", () => {
  it("marks the lost peer offline and recomputes distribution over survivors", () => {
    const g = makeGraph("self", [
      makePeer("self", { hopCount: 0 }),
      makePeer("p1", { hopCount: 1, quality: 0.9 }),
      makePeer("p2", { hopCount: 1, quality: 0.6 }),
      makePeer("lost", { hopCount: 2, quality: 0.5 }),
    ]);
    const res = reSuperposeOnLoss(g, "lost");
    expect(res.lostPeer).toBe("lost");
    expect(g.peers.get("lost")?.status).toBe("offline");
    expect(res.survivors).not.toContain("lost");
    // Distribution sums to 1 across survivors
    const sum = Object.values(res.distribution).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it("higher-quality survivor carries more weight", () => {
    const g = makeGraph("self", [
      makePeer("self", { hopCount: 0 }),
      makePeer("hi", { hopCount: 1, quality: 1.0 }),
      makePeer("lo", { hopCount: 1, quality: 0.1 }),
      makePeer("lost", { hopCount: 2 }),
    ]);
    const res = reSuperposeOnLoss(g, "lost");
    expect(res.distribution["hi"]).toBeGreaterThan(res.distribution["lo"]);
  });

  it("defaultPeerWeight = quality × (1/(1+hopCount))", () => {
    expect(defaultPeerWeight(makePeer("x", { quality: 1, hopCount: 0 }))).toBe(1);
    expect(defaultPeerWeight(makePeer("x", { quality: 0.5, hopCount: 1 }))).toBe(0.25);
    // Missing quality defaults to 0.5
    expect(defaultPeerWeight(makePeer("x", { quality: undefined, hopCount: 0 }))).toBe(0.5);
  });

  it("injectable weighting fn is honored (custom: hop-only)", () => {
    const g = makeGraph("self", [
      makePeer("self", { hopCount: 0 }),
      makePeer("a", { hopCount: 1, quality: 0.99 }),
      makePeer("b", { hopCount: 2, quality: 0.01 }),
      makePeer("lost", { hopCount: 2 }),
    ]);
    const res = reSuperposeOnLoss(g, "lost", (peer) => 1 / (1 + peer.hopCount));
    // hop-1 'a' (weight 0.5) outweighs hop-2 'b' (weight 0.333)
    expect(res.distribution["a"]).toBeGreaterThan(res.distribution["b"]);
  });

  it("excludes offline peers from survivors", () => {
    const g = makeGraph("self", [
      makePeer("self", { hopCount: 0 }),
      makePeer("online1", { hopCount: 1 }),
      makePeer("lost", { hopCount: 2 }),
    ]);
    const res = reSuperposeOnLoss(g, "lost");
    expect(getOnlinePeers(res.graph).map((p) => p.peerHash)).toContain("online1");
    expect(getOnlinePeers(res.graph).map((p) => p.peerHash)).not.toContain("lost");
  });
});

describe("collapseCoordinator", () => {
  it("returns null when no online peers", () => {
    const g = makeGraph("self", [makePeer("self")]);
    expect(collapseCoordinator(g, 1)).toBeNull();
  });

  it("is deterministic for a fixed seed", () => {
    const peers = [
      makePeer("self", { hopCount: 0 }),
      makePeer("a", { hopCount: 1, quality: 0.9 }),
      makePeer("b", { hopCount: 1, quality: 0.6 }),
      makePeer("c", { hopCount: 2, quality: 0.4 }),
    ];
    const g1 = makeGraph("self", peers.map((p) => ({ ...p })));
    const g2 = makeGraph("self", peers.map((p) => ({ ...p })));
    expect(collapseCoordinator(g1, 42)).toBe(collapseCoordinator(g2, 42));
  });

  it("no-amplitude fallback picks closest by hop count when all weights are 0", () => {
    const g = makeGraph("self", [
      makePeer("self", { hopCount: 0 }),
      makePeer("far", { hopCount: 3, quality: 0 }),
      makePeer("near", { hopCount: 1, quality: 0 }),
    ]);
    // weightFn always returns 0 → fallback to closest-by-hop
    const coord = collapseCoordinator(g, 5, () => 0);
    expect(coord).toBe("near");
  });

  it("never returns the local peer as coordinator", () => {
    const g = makeGraph("me", [
      makePeer("me", { hopCount: 0 }),
      makePeer("p1", { hopCount: 1 }),
      makePeer("p2", { hopCount: 1 }),
    ]);
    for (let s = 0; s < 20; s++) {
      const coord = collapseCoordinator(g, s);
      expect(coord).not.toBe("me");
      expect(coord).not.toBeNull();
    }
  });

  it("coordinator picks only from online peers", () => {
    const g = makeGraph("self", [
      makePeer("self", { hopCount: 0 }),
      makePeer("online", { hopCount: 1 }),
    ]);
    markPeerOffline(g, "online");
    // After marking online offline, only self remains → null
    expect(collapseCoordinator(g, 7)).toBeNull();
  });
});
