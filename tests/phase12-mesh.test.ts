import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  initMeshGraph,
  updatePeerPresence,
  markPeerOffline,
  pruneGraph,
  getOnlinePeers,
  getPeersByHopCount,
  getMeshStats,
  roomHashFromCode,
  encodePresenceToken,
  decodePresenceToken,
  deleteGraph,
  clearAllPresenceData,
  type MeshPresence,
  type MeshGraph,
  type PeerStatus,
} from "../lib/mesh-presence";
import {
  initSenderKey,
  senderEncrypt,
  senderDecrypt,
  initGroupRatchet,
  addSenderKey,
  getSenderKey,
  exportSenderKey,
  importSenderKey,
  exportGroupRatchet,
  importGroupRatchet,
  type SenderKeyState,
  type GroupRatchetState,
  type GroupRatchetMessage,
} from "../lib/ratchet";
import {
  initReconnectState,
  updateConnectionState,
  calculateNextBackoff,
  incrementAttempt,
  shouldAttemptReconnect,
  isConnectionTimedOut,
  restartICE,
  needsIceRestart,
  startKeepalive,
  stopKeepalive,
  scheduleReconnect,
  cleanupReconnectState,
  getConnectionStateLabel,
  getReconnectProgress,
  saveRoomCode,
  loadRoomCode,
  clearRoomCode,
  type ConnectionState,
  type ReconnectState,
  type ReconnectConfig,
} from "../lib/webrtc-reconnect";

describe("Phase 12 - Mesh Presence", () => {
  let testRoomCode: string;
  let localPeerHash: string;
  let testGraph: MeshGraph;

  beforeEach(() => {
    testRoomCode = "test-room-" + Math.random().toString(36).slice(2, 8);
    localPeerHash = "local-" + Math.random().toString(36).slice(2, 10);
    clearAllPresenceData();
  });

  afterEach(() => {
    clearAllPresenceData();
  });

  describe("roomHashFromCode", () => {
    it("creates deterministic room hash", async () => {
      const hash1 = await roomHashFromCode("test-room");
      const hash2 = await roomHashFromCode("test-room");
      const hash3 = await roomHashFromCode("different-room");

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash1).toHaveLength(16);
    });
  });

  describe("initMeshGraph", () => {
    it("creates new graph with self as online peer", async () => {
      testGraph = await initMeshGraph(testRoomCode, localPeerHash);

      expect(testGraph.localPeerHash).toBe(localPeerHash);
      expect(testGraph.peers.has(localPeerHash)).toBe(true);
      expect(testGraph.peers.get(localPeerHash)?.status).toBe("online");
      expect(testGraph.peers.get(localPeerHash)?.hopCount).toBe(0);
    });

    it("loads existing graph from localStorage", async () => {
      const graph1 = await initMeshGraph(testRoomCode, localPeerHash);
      const peerHash = "peer-" + Math.random().toString(36).slice(2, 10);

      // Use the proper API to update peer presence (this saves to localStorage)
      const presence: MeshPresence = {
        peerHash,
        status: "online",
        hopCount: 1,
        lastSeen: Date.now(),
      };

      updatePeerPresence(graph1, presence);

      // Load same room
      const graph2 = await initMeshGraph(testRoomCode, localPeerHash);
      expect(graph2.peers.has(peerHash)).toBe(true);
    });
  });

  describe("updatePeerPresence", () => {
    it("adds new peer to graph", async () => {
      testGraph = await initMeshGraph(testRoomCode, localPeerHash);
      const peerHash = "peer-" + Math.random().toString(36).slice(2, 10);

      const presence: MeshPresence = {
        peerHash,
        handle: "TestPeer",
        status: "online",
        hopCount: 1,
        lastSeen: Date.now(),
        quality: 0.9,
      };

      testGraph = updatePeerPresence(testGraph, presence);

      expect(testGraph.peers.has(peerHash)).toBe(true);
      expect(testGraph.peers.get(peerHash)?.handle).toBe("TestPeer");
      expect(testGraph.peers.get(peerHash)?.quality).toBe(0.9);
    });

    it("updates existing peer with quality smoothing", async () => {
      testGraph = await initMeshGraph(testRoomCode, localPeerHash);
      const peerHash = "peer-" + Math.random().toString(36).slice(2, 10);

      testGraph.peers.set(peerHash, {
        peerHash,
        status: "online",
        hopCount: 1,
        lastSeen: Date.now(),
        quality: 0.8,
      });

      const updated: MeshPresence = {
        peerHash,
        status: "online",
        hopCount: 1,
        lastSeen: Date.now(),
        quality: 0.6,
      };

      testGraph = updatePeerPresence(testGraph, updated);
      const quality = testGraph.peers.get(peerHash)?.quality;

      // Should be smoothed: 0.3 * 0.6 + 0.7 * 0.8 ≈ 0.74
      expect(quality).toBeGreaterThan(0.7);
      expect(quality).toBeLessThan(0.8);
    });
  });

  describe("markPeerOffline", () => {
    it("marks peer as offline", async () => {
      testGraph = await initMeshGraph(testRoomCode, localPeerHash);
      const peerHash = "peer-" + Math.random().toString(36).slice(2, 10);

      testGraph.peers.set(peerHash, {
        peerHash,
        status: "online",
        hopCount: 1,
        lastSeen: Date.now(),
      });

      testGraph = markPeerOffline(testGraph, peerHash);

      expect(testGraph.peers.get(peerHash)?.status).toBe("offline");
    });
  });

  describe("getOnlinePeers", () => {
    it("returns only online peers excluding self", async () => {
      testGraph = await initMeshGraph(testRoomCode, localPeerHash);

      const peer1 = "peer1-" + Math.random().toString(36).slice(2, 10);
      const peer2 = "peer2-" + Math.random().toString(36).slice(2, 10);

      testGraph.peers.set(peer1, {
        peerHash: peer1,
        status: "online",
        hopCount: 1,
        lastSeen: Date.now(),
      });

      testGraph.peers.set(peer2, {
        peerHash: peer2,
        status: "offline",
        hopCount: 1,
        lastSeen: Date.now(),
      });

      const online = getOnlinePeers(testGraph);
      expect(online).toHaveLength(1);
      expect(online[0].peerHash).toBe(peer1);
    });
  });

  describe("getMeshStats", () => {
    it("calculates correct mesh statistics", async () => {
      testGraph = await initMeshGraph(testRoomCode, localPeerHash);

      const peer1 = "peer1-" + Math.random().toString(36).slice(2, 10);
      const peer2 = "peer2-" + Math.random().toString(36).slice(2, 10);

      testGraph.peers.set(peer1, {
        peerHash: peer1,
        status: "online",
        hopCount: 0,
        lastSeen: Date.now(),
        quality: 0.9,
      });

      testGraph.peers.set(peer2, {
        peerHash: peer2,
        status: "online",
        hopCount: 2,
        lastSeen: Date.now(),
        quality: 0.7,
      });

      const stats = getMeshStats(testGraph);

      expect(stats.totalPeers).toBe(2);
      expect(stats.onlinePeers).toBe(2);
      expect(stats.directPeers).toBe(1);
      expect(stats.averageHopCount).toBe(1.0);
      expect(stats.averageQuality).toBeCloseTo(0.8, 1);
    });
  });

  describe("encodePresenceToken and decodePresenceToken", () => {
    it("encodes and decodes presence token", async () => {
      const presence: MeshPresence = {
        peerHash: "peer123",
        handle: "TestPeer",
        status: "online",
        hopCount: 1,
        lastSeen: Date.now(),
        publicKeyHex: "abcd1234",
      };

      // Create a test identity
      const keyPair = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"]
      );

      const pubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
      const publicKeyHex = Array.from(new Uint8Array(pubRaw))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const identity = {
        privateKey: keyPair.privateKey,
        publicKeyHex,
      };

      const token = await encodePresenceToken(presence, identity);
      expect(token).toMatch(/^VFXMESH1:/);

      const decoded = await decodePresenceToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.peerHash).toBe("peer123");
      expect(decoded?.handle).toBe("TestPeer");
      expect(decoded?.status).toBe("online");
    });

    it("returns null for invalid token", async () => {
      const decoded = await decodePresenceToken("INVALID_TOKEN");
      expect(decoded).toBeNull();
    });
  });

  describe("pruneGraph", () => {
    it("removes stale peers", async () => {
      testGraph = await initMeshGraph(testRoomCode, localPeerHash);

      const stalePeer = "stale-" + Math.random().toString(36).slice(2, 10);
      const freshPeer = "fresh-" + Math.random().toString(36).slice(2, 10);

      testGraph.peers.set(stalePeer, {
        peerHash: stalePeer,
        status: "offline",
        hopCount: 1,
        lastSeen: Date.now() - 10 * 60 * 1000, // 10 minutes ago
      });

      testGraph.peers.set(freshPeer, {
        peerHash: freshPeer,
        status: "online",
        hopCount: 1,
        lastSeen: Date.now(),
      });

      testGraph = pruneGraph(testGraph);

      expect(testGraph.peers.has(stalePeer)).toBe(false);
      expect(testGraph.peers.has(freshPeer)).toBe(true);
      expect(testGraph.peers.has(localPeerHash)).toBe(true); // Never prune self
    });
  });
});

describe("Phase 12 - Group Ratchet", () => {
  let senderKey: SenderKeyState;
  let groupState: GroupRatchetState;
  const sharedSecret = "test-shared-secret";
  const roomHash = "test-room-hash";
  const myPeerHash = "my-peer-hash";

  describe("initSenderKey", () => {
    it("creates sender key from shared secret", async () => {
      senderKey = await initSenderKey(sharedSecret, "peer1");

      expect(senderKey.chainKey).toBeTruthy();
      expect(senderKey.chainKey).toHaveLength(64); // 32 bytes as hex
      expect(senderKey.counter).toBe(0);
      expect(senderKey.senderPeerHash).toBe("peer1");
    });

    it("creates deterministic keys for same input", async () => {
      const key1 = await initSenderKey(sharedSecret, "peer1");
      const key2 = await initSenderKey(sharedSecret, "peer1");
      const key3 = await initSenderKey(sharedSecret, "peer2");

      expect(key1.chainKey).toBe(key2.chainKey);
      expect(key1.chainKey).not.toBe(key3.chainKey);
    });
  });

  describe("senderEncrypt and senderDecrypt", () => {
    it("encrypts and decrypts messages", async () => {
      senderKey = await initSenderKey(sharedSecret, "sender");
      const plaintext = "Hello, group!";

      const { message, newSenderKey } = await senderEncrypt(senderKey, plaintext);

      expect(message.fromPeerHash).toBe("sender");
      expect(message.counter).toBe(0);
      expect(message.ciphertext).toBeTruthy();
      expect(message.iv).toHaveLength(24); // 12 bytes as hex

      // Decrypt with the same state that was used to encrypt
      // The receiver would use their copy of the sender's key state
      const receiverKey = await initSenderKey(sharedSecret, "sender");
      const result = await senderDecrypt(receiverKey, message);

      expect(result.plaintext).toBe(plaintext);
      expect(result.newSenderKey).not.toBeNull();
      expect(result.newSenderKey?.counter).toBe(1);
    });

    it("rejects messages from wrong sender", async () => {
      const senderKey1 = await initSenderKey(sharedSecret, "sender1");
      const senderKey2 = await initSenderKey(sharedSecret, "sender2");

      const { message } = await senderEncrypt(senderKey1, "test");

      await expect(senderDecrypt(senderKey2, message)).rejects.toThrow("Message sender mismatch");
    });

    it("rejects messages with wrong counter", async () => {
      senderKey = await initSenderKey(sharedSecret, "sender");

      const { message } = await senderEncrypt(senderKey, "test");

      // Manually corrupt counter
      message.counter = 999;

      await expect(senderDecrypt(senderKey, message)).rejects.toThrow("Counter mismatch");
    });
  });

  describe("initGroupRatchet", () => {
    it("creates group state with my sender key", async () => {
      groupState = await initGroupRatchet(roomHash, myPeerHash, sharedSecret);

      expect(groupState.roomHash).toBe(roomHash);
      expect(groupState.myPeerHash).toBe(myPeerHash);
      expect(groupState.senderKeys.has(myPeerHash)).toBe(true);

      const myKey = groupState.senderKeys.get(myPeerHash);
      expect(myKey?.senderPeerHash).toBe(myPeerHash);
    });
  });

  describe("addSenderKey and getSenderKey", () => {
    it("adds and retrieves peer sender keys", async () => {
      groupState = await initGroupRatchet(roomHash, myPeerHash, sharedSecret);

      const peerKey = await initSenderKey(sharedSecret, "peer1");
      groupState = addSenderKey(groupState, peerKey);

      const retrieved = getSenderKey(groupState, "peer1");
      expect(retrieved).not.toBeNull();
      expect(retrieved?.senderPeerHash).toBe("peer1");
    });
  });

  describe("exportSenderKey and importSenderKey", () => {
    it("exports and imports sender key", async () => {
      senderKey = await initSenderKey(sharedSecret, "peer1");
      const exported = exportSenderKey(senderKey);

      expect(exported).toBeTruthy();
      expect(typeof exported).toBe("string");

      const imported = importSenderKey(exported);
      expect(imported).not.toBeNull();
      expect(imported?.chainKey).toBe(senderKey.chainKey);
      expect(imported?.senderPeerHash).toBe(senderKey.senderPeerHash);
    });

    it("returns null for invalid export", () => {
      const imported = importSenderKey("invalid-json");
      expect(imported).toBeNull();
    });
  });

  describe("exportGroupRatchet and importGroupRatchet", () => {
    it("exports and imports entire group state", async () => {
      groupState = await initGroupRatchet(roomHash, myPeerHash, sharedSecret);

      const peerKey = await initSenderKey(sharedSecret, "peer1");
      groupState = addSenderKey(groupState, peerKey);

      const exported = exportGroupRatchet(groupState);
      expect(exported).toBeTruthy();

      const imported = importGroupRatchet(exported);
      expect(imported).not.toBeNull();
      expect(imported?.roomHash).toBe(roomHash);
      expect(imported?.myPeerHash).toBe(myPeerHash);
      expect(imported?.senderKeys.size).toBe(2);
    });
  });
});

describe("Phase 12 - WebRTC Reconnect", () => {
  let reconnectState: ReconnectState;
  const config: ReconnectConfig = {
    maxAttempts: 5,
    initialBackoffMs: 1000,
    maxBackoffMs: 10000,
    backoffMultiplier: 2.0,
    keepaliveIntervalMs: 5000,
    connectionTimeoutMs: 30000,
  };

  beforeEach(() => {
    reconnectState = initReconnectState();
  });

  afterEach(() => {
    cleanupReconnectState(reconnectState);
  });

  describe("initReconnectState", () => {
    it("initializes with clean state", () => {
      expect(reconnectState.state).toBe("new");
      expect(reconnectState.attempt).toBe(0);
      expect(reconnectState.currentBackoffMs).toBe(config.initialBackoffMs);
      expect(reconnectState.iceRestartInProgress).toBe(false);
    });
  });

  describe("updateConnectionState", () => {
    it("updates state and resets on successful connection", () => {
      reconnectState.attempt = 3;
      reconnectState.currentBackoffMs = 4000;

      const updated = updateConnectionState(reconnectState, "connected", null);

      expect(updated.state).toBe("connected");
      expect(updated.attempt).toBe(0);
      expect(updated.currentBackoffMs).toBe(config.initialBackoffMs);
      expect(updated.connectedAt).toBeGreaterThan(0);
    });

    it("sets lastAttemptTime when disconnected", () => {
      const updated = updateConnectionState(reconnectState, "disconnected", null);
      expect(updated.lastAttemptAt).toBeGreaterThan(0);
    });
  });

  describe("calculateNextBackoff", () => {
    it("calculates exponential backoff", () => {
      reconnectState.currentBackoffMs = 1000;
      const nextDelay = calculateNextBackoff(reconnectState, config);
      expect(nextDelay).toBe(2000); // 1000 * 2.0

      reconnectState.currentBackoffMs = 6000;
      const cappedDelay = calculateNextBackoff(reconnectState, config);
      expect(cappedDelay).toBe(config.maxBackoffMs); // Capped at max
    });
  });

  describe("incrementAttempt", () => {
    it("increments attempt and updates backoff", () => {
      reconnectState.currentBackoffMs = 1000;

      const updated = incrementAttempt(reconnectState, config);

      expect(updated.attempt).toBe(1);
      expect(updated.lastAttemptAt).toBeGreaterThan(0);
      expect(updated.currentBackoffMs).toBe(2000);
    });
  });

  describe("shouldAttemptReconnect", () => {
    it("returns true when disconnected and under max attempts", () => {
      reconnectState.state = "disconnected";
      reconnectState.attempt = 3;

      expect(shouldAttemptReconnect(reconnectState, config)).toBe(true);
    });

    it("returns false when at max attempts", () => {
      reconnectState.state = "disconnected";
      reconnectState.attempt = config.maxAttempts;

      expect(shouldAttemptReconnect(reconnectState, config)).toBe(false);
    });

    it("returns false when connected", () => {
      reconnectState.state = "connected";

      expect(shouldAttemptReconnect(reconnectState, config)).toBe(false);
    });
  });

  describe("getConnectionStateLabel", () => {
    it("returns human-readable labels", () => {
      expect(getConnectionStateLabel("connected")).toBe("Connected");
      expect(getConnectionStateLabel("reconnecting")).toBe("Reconnecting...");
      expect(getConnectionStateLabel("failed")).toBe("Connection Failed");
    });
  });

  describe("saveRoomCode and loadRoomCode", () => {
    it("saves and loads room code", () => {
      const roomCode = "TEST-ROOM-123";

      saveRoomCode(roomCode);
      const loaded = loadRoomCode();

      expect(loaded).toBe(roomCode);
    });

    it("returns null when no code saved", () => {
      clearRoomCode();
      const loaded = loadRoomCode();
      expect(loaded).toBeNull();
    });
  });

  describe("getReconnectProgress", () => {
    it("calculates progress percentage", () => {
      reconnectState.attempt = 0;
      expect(getReconnectProgress(reconnectState, config)).toBe(0);

      reconnectState.attempt = 2;
      expect(getReconnectProgress(reconnectState, config)).toBeCloseTo(40, 0); // 2/5

      reconnectState.attempt = config.maxAttempts;
      expect(getReconnectProgress(reconnectState, config)).toBe(100);
    });
  });

  describe("cleanupReconnectState", () => {
    it("clears timers and sets closed state", () => {
      reconnectState.keepaliveTimerId = 123;
      reconnectState.reconnectTimerId = 456;

      const cleaned = cleanupReconnectState(reconnectState);

      expect(cleaned.state).toBe("closed");
      expect(cleaned.keepaliveTimerId).toBeNull();
      expect(cleaned.reconnectTimerId).toBeNull();
    });
  });
});
