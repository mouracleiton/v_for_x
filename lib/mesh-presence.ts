/**
 * V FOR X — Multi-Peer Mesh Presence (The Web v2)
 *
 * Tracks presence state across multiple peers in a WebRTC mesh network.
 * Provides a real-time graph of connected peers with:
 * - Online/offline status
 * - Hop count (distance through the mesh)
 * - Last-seen timestamp
 * - Connection quality metrics
 *
 * This library works alongside the existing mesh-store.ts store-and-forward
 * system and extends WebRTC from 1:1 to N-peer mesh topologies.
 *
 * VFXMESH1 token format for presence updates:
 *   VFXMESH1:base64({version, peerHash, handle, status, hopCount, lastSeen, sig})
 */

export type PeerStatus = "online" | "offline" | "away";

export interface MeshPresence {
  /** Deterministic peer identity hash (from peerHash in mesh-store.ts) */
  peerHash: string;
  /** Human-readable handle (optional, may not be known for all peers) */
  handle?: string;
  /** Current connection status */
  status: PeerStatus;
  /** Number of hops from this node (0 = direct connection) */
  hopCount: number;
  /** Last time this peer was seen (timestamp) */
  lastSeen: number;
  /** Connection quality score (0-1, based on packet loss/latency) */
  quality?: number;
  /** Public key hex (if available for signature verification) */
  publicKeyHex?: string;
}

export interface MeshGraph {
  /** Hash of the room/channel (from room code in signal-relay.ts) */
  roomHash: string;
  /** All known peers in this mesh */
  peers: Map<string, MeshPresence>;
  /** When this graph was last updated */
  lastUpdate: number;
  /** My own peer hash */
  localPeerHash: string;
}

export interface PresenceToken {
  version: 1;
  peerHash: string;
  handle?: string;
  status: PeerStatus;
  hopCount: number;
  lastSeen: number;
  /** Public key hex (if available for signature verification) */
  publicKeyHex?: string;
  /** Signature over peerHash+handle+status+hopCount+lastSeen */
  sig: string;
}

const MESH_PRESENCE_KEY = "vfx-mesh-presence";
const PRESENCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const QUALITY_WINDOW_MS = 30 * 1000; // 30 seconds for quality calculation

/* ═══════════════════════════════════════════════════════════
   Helpers
═══════════════════════════════════════════════════════════ */

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const buf = new Uint8Array(new ArrayBuffer(clean.length / 2));
  for (let i = 0; i < buf.length; i++) {
    buf[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return buf;
}

/**
 * Create a deterministic room hash from a room code.
 */
export async function roomHashFromCode(roomCode: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`vfx-mesh-room:${roomCode}`)
  );
  return bytesToHex(new Uint8Array(digest)).slice(0, 16);
}

/* ═══════════════════════════════════════════════════════════
   Presence Graph Management
═══════════════════════════════════════════════════════════ */

/**
 * Initialize a new mesh graph for a room.
 */
export async function initMeshGraph(
  roomCode: string,
  localPeerHash: string
): Promise<MeshGraph> {
  const roomHash = await roomHashFromCode(roomCode);

  // Try to load existing graph from localStorage
  const existing = loadGraph(roomHash);
  if (existing && existing.localPeerHash === localPeerHash) {
    // Prune stale peers
    pruneGraph(existing);
    saveGraph(existing); // Save after pruning
    return existing;
  }

  // Create new graph
  const graph: MeshGraph = {
    roomHash,
    peers: new Map(),
    lastUpdate: Date.now(),
    localPeerHash,
  };

  // Add self as online peer
  graph.peers.set(localPeerHash, {
    peerHash: localPeerHash,
    status: "online",
    hopCount: 0,
    lastSeen: Date.now(),
    quality: 1.0,
  });

  saveGraph(graph);
  return graph;
}

/**
 * Update or add a peer in the mesh graph.
 */
export function updatePeerPresence(
  graph: MeshGraph,
  presence: MeshPresence
): MeshGraph {
  const existing = graph.peers.get(presence.peerHash);

  // Calculate connection quality if we have previous data
  let quality = presence.quality;
  if (existing && existing.quality !== undefined) {
    // Exponential moving average for quality
    const alpha = 0.3;
    quality = presence.quality !== undefined
      ? alpha * presence.quality + (1 - alpha) * existing.quality
      : existing.quality;
  }

  graph.peers.set(presence.peerHash, {
    ...presence,
    quality,
  });

  graph.lastUpdate = Date.now();
  saveGraph(graph);
  return graph;
}

/**
 * Mark a peer as offline.
 */
export function markPeerOffline(graph: MeshGraph, peerHash: string): MeshGraph {
  const peer = graph.peers.get(peerHash);
  if (peer) {
    peer.status = "offline";
    peer.lastSeen = Date.now();
    graph.lastUpdate = Date.now();
    saveGraph(graph);
  }
  return graph;
}

/**
 * Remove peers that haven't been seen for longer than TTL.
 */
export function pruneGraph(graph: MeshGraph): MeshGraph {
  const now = Date.now();
  const toDelete: string[] = [];

  // Convert Map to array for iteration
  const peersArray = Array.from(graph.peers.entries());
  for (const [hash, peer] of peersArray) {
    if (now - peer.lastSeen > PRESENCE_TTL_MS && hash !== graph.localPeerHash) {
      toDelete.push(hash);
    }
  }

  for (const hash of toDelete) {
    graph.peers.delete(hash);
  }

  if (toDelete.length > 0) {
    graph.lastUpdate = Date.now();
    saveGraph(graph);
  }

  return graph;
}

/**
 * Get all online peers in the mesh (excluding self).
 */
export function getOnlinePeers(graph: MeshGraph): MeshPresence[] {
  return Array.from(graph.peers.values())
    .filter(p => p.status === "online" && p.peerHash !== graph.localPeerHash);
}

/**
 * Get peers sorted by hop count (closest first).
 */
export function getPeersByHopCount(graph: MeshGraph): MeshPresence[] {
  return Array.from(graph.peers.values())
    .filter(p => p.peerHash !== graph.localPeerHash)
    .sort((a, b) => a.hopCount - b.hopCount);
}

/**
 * Calculate mesh statistics.
 */
export function getMeshStats(graph: MeshGraph): {
  totalPeers: number;
  onlinePeers: number;
  directPeers: number;
  averageHopCount: number;
  averageQuality: number;
} {
  const peers = Array.from(graph.peers.values());
  const online = peers.filter(p => p.status === "online" && p.peerHash !== graph.localPeerHash);
  const direct = peers.filter(p => p.hopCount === 0 && p.peerHash !== graph.localPeerHash);

  const avgHops = online.length > 0
    ? online.reduce((sum, p) => sum + p.hopCount, 0) / online.length
    : 0;

  const withQuality = online.filter(p => p.quality !== undefined);
  const avgQuality = withQuality.length > 0
    ? withQuality.reduce((sum, p) => sum + (p.quality ?? 0), 0) / withQuality.length
    : 0;

  return {
    totalPeers: peers.length - 1, // Exclude self
    onlinePeers: online.length,
    directPeers: direct.length,
    averageHopCount: avgHops,
    averageQuality: avgQuality,
  };
}

/* ═══════════════════════════════════════════════════════════
   Presence Token Encoding/Decoding
═══════════════════════════════════════════════════════════ */

/**
 * Encode a presence update as a VFXMESH1 token.
 * Requires an identity for signing.
 */
export async function encodePresenceToken(
  presence: MeshPresence,
  identity: { privateKey: CryptoKey; publicKeyHex: string }
): Promise<string> {
  const token: PresenceToken = {
    version: 1,
    peerHash: presence.peerHash,
    handle: presence.handle,
    status: presence.status,
    hopCount: presence.hopCount,
    lastSeen: presence.lastSeen,
    sig: "", // Will be filled below
  };

  // Create canonical payload for signing
  const payload = `${token.peerHash}|${token.handle ?? ""}|${token.status}|${token.hopCount}|${token.lastSeen}`;
  const payloadBytes = new TextEncoder().encode(payload);

  // Sign with identity
  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    identity.privateKey,
    payloadBytes
  );
  token.sig = bytesToHex(new Uint8Array(sigBuf));

  // Encode as base64
  const json = JSON.stringify(token);
  const base64 = btoa(json);
  return `VFXMESH1:${base64}`;
}

/**
 * Decode and verify a VFXMESH1 presence token.
 * Returns null if signature verification fails.
 */
export async function decodePresenceToken(
  token: string
): Promise<MeshPresence | null> {
  if (!token.startsWith("VFXMESH1:")) {
    return null;
  }

  try {
    const base64 = token.slice(9); // Remove "VFXMESH1:"
    const json = atob(base64);
    const data: PresenceToken = JSON.parse(json);

    if (data.version !== 1) {
      return null;
    }

    // Verify signature if we have the public key
    if (data.publicKeyHex) {
      const payload = `${data.peerHash}|${data.handle ?? ""}|${data.status}|${data.hopCount}|${data.lastSeen}`;
      const payloadBytes = new TextEncoder().encode(payload);
      const sigBytes = hexToBytes(data.sig);
      const pubBytes = hexToBytes(data.publicKeyHex);

      const publicKey = await crypto.subtle.importKey(
        "raw",
        pubBytes.buffer as ArrayBuffer,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"]
      );

      const isValid = await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        publicKey,
        sigBytes.buffer as ArrayBuffer,
        payloadBytes
      );

      if (!isValid) {
        return null;
      }
    }

    return {
      peerHash: data.peerHash,
      handle: data.handle,
      status: data.status,
      hopCount: data.hopCount,
      lastSeen: data.lastSeen,
      publicKeyHex: data.publicKeyHex,
    };
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════
   Persistence (localStorage)
═══════════════════════════════════════════════════════════ */

function saveGraph(graph: MeshGraph): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return;
  }

  try {
    const serializable = {
      roomHash: graph.roomHash,
      peers: Array.from(graph.peers.entries()),
      lastUpdate: graph.lastUpdate,
      localPeerHash: graph.localPeerHash,
    };
    localStorage.setItem(`${MESH_PRESENCE_KEY}:${graph.roomHash}`, JSON.stringify(serializable));
  } catch {
    /* ignore */
  }
}

function loadGraph(roomHash: string): MeshGraph | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(`${MESH_PRESENCE_KEY}:${roomHash}`);
    if (!raw) return null;

    const data = JSON.parse(raw) as {
      roomHash: string;
      peers: Array<[string, MeshPresence]>;
      lastUpdate: number;
      localPeerHash: string;
    };

    return {
      roomHash: data.roomHash,
      peers: new Map(data.peers),
      lastUpdate: data.lastUpdate,
      localPeerHash: data.localPeerHash,
    };
  } catch {
    return null;
  }
}

/**
 * Delete the presence graph for a room.
 */
export function deleteGraph(roomHash: string): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(`${MESH_PRESENCE_KEY}:${roomHash}`);
  } catch {
    /* ignore */
  }
}

/**
 * Clear all mesh presence data.
 */
export function clearAllPresenceData(): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return;
  }

  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(MESH_PRESENCE_KEY)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }
}
