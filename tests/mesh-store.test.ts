import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  MESH_MAX_HOPS,
  MeshMessage,
  dequeueFor,
  depositFromPeers,
  enqueue,
  expireAll,
  formatMeshMail,
  forward,
  markSeen,
  newMeshId,
  peerHash,
  pendingFor,
  seen,
} from "../lib/mesh-store";

// localStorage is not provided by this jsdom build — stub it like other tests.
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};
vi.stubGlobal("localStorage", localStorageMock);

beforeEach(() => {
  localStorageMock.clear();
});

function msg(overrides: Partial<MeshMessage> = {}): MeshMessage {
  return {
    id: newMeshId(),
    from: "a1b2",
    to: "c3d4",
    body: "rendezvous at the bridge",
    kind: "chat",
    createdAt: 1_000_000,
    ttlMs: 60_000,
    hops: 0,
    via: [],
    ...overrides,
  };
}

describe("peerHash", () => {
  it("returns a deterministic 8-hex hash", async () => {
    const h1 = await peerHash("V-ABCD");
    const h2 = await peerHash("V-ABCD");
    const h3 = await peerHash("V-ABCE");
    expect(h1).toHaveLength(8);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });
});

describe("mailbox lifecycle", () => {
  it("deposits and claims mail for a peer", async () => {
    await enqueue(msg({ id: "m1", to: "peerA" }));
    await enqueue(msg({ id: "m2", to: "peerB" }));
    const forA = await dequeueFor("peerA", 1_010_000);
    expect(forA.map((m) => m.id)).toEqual(["m1"]);
    expect((await pendingFor("peerA", 1_020_000)).length).toBe(0);
    expect((await pendingFor("peerB", 1_020_000)).length).toBe(1);
  });

  it("expires mail past its TTL", async () => {
    await enqueue(msg({ id: "old", createdAt: 1_000_000, ttlMs: 10_000 }));
    await enqueue(msg({ id: "fresh", createdAt: 1_050_000, ttlMs: 60_000 }));
    const removed = await expireAll(1_020_000);
    expect(removed).toBe(1);
    expect((await pendingFor("c3d4", 1_020_000)).map((m) => m.id)).toEqual(["fresh"]);
  });

  it("never claims expired mail", async () => {
    await enqueue(msg({ id: "stale", createdAt: 1_000_000, ttlMs: 10_000 }));
    const got = await dequeueFor("c3d4", 1_100_000);
    expect(got.length).toBe(0);
  });

  it("is idempotent on duplicate ids", async () => {
    const m = msg({ id: "dup" });
    await enqueue(m);
    await enqueue(m);
    expect((await pendingFor("c3d4", 1_010_000)).length).toBe(1);
  });
});

describe("forward / hop cap", () => {
  it("increments hops and records the relay", () => {
    const m = msg({ hops: 0 });
    const f1 = forward(m, "relay1");
    expect(f1?.hops).toBe(1);
    expect(f1?.via).toEqual(["relay1"]);
    const f2 = forward(f1!, "relay2");
    expect(f2?.hops).toBe(2);
  });

  it("drops a message at the hop cap", () => {
    let m = msg({ hops: 0 });
    for (let i = 0; i < MESH_MAX_HOPS; i++) {
      const next = forward(m, "relay");
      expect(next).not.toBeNull();
      m = next!;
    }
    expect(forward(m, "relay")).toBeNull();
  });
});

describe("seen / dedupe ring", () => {
  it("marks and recalls ids", () => {
    markSeen("packet-1");
    expect(seen("packet-1")).toBe(true);
    expect(seen("packet-2")).toBe(false);
  });

  it("deposit skips duplicates", async () => {
    const m = msg({ id: "carried" });
    const first = await depositFromPeers([m], 1_010_000);
    const second = await depositFromPeers([m], 1_020_000);
    expect(first).toBe(1);
    expect(second).toBe(0);
    expect((await pendingFor(m.to, 1_030_000)).length).toBe(1);
  });

  it("deposit drops expired packets without storing them", async () => {
    const m = msg({ id: "long-dead", createdAt: 1_000_000, ttlMs: 1000 });
    const added = await depositFromPeers([m], 1_100_000);
    expect(added).toBe(0);
    expect(seen(m.id)).toBe(false);
  });
});

describe("formatMeshMail", () => {
  it("renders a compact line", () => {
    const line = formatMeshMail(msg({ kind: "alert", hops: 2 }));
    expect(line).toContain("ALERT");
    expect(line).toContain("2 hops");
  });
});
