import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the idb module to use an in-memory store
const memoryStores: Record<string, Map<number, any>> = {};
let autoIncrement = 0;

vi.mock("idb", () => ({
  openDB: vi.fn().mockResolvedValue({
    getAll: vi.fn(async (store: string) => {
      memoryStores[store] = memoryStores[store] || new Map();
      return Array.from(memoryStores[store].values());
    }),
    put: vi.fn(async (store: string, record: any) => {
      memoryStores[store] = memoryStores[store] || new Map();
      if (record.id === undefined) {
        record.id = ++autoIncrement;
      }
      memoryStores[store].set(record.id, record);
      return record.id;
    }),
    delete: vi.fn(async (store: string, id: number) => {
      memoryStores[store] = memoryStores[store] || new Map();
      memoryStores[store].delete(id);
    }),
    get: vi.fn(async (store: string, key: string) => {
      memoryStores[store] = memoryStores[store] || new Map();
      return memoryStores[store].get(key as any);
    }),
    count: vi.fn(async (store: string) => {
      memoryStores[store] = memoryStores[store] || new Map();
      return memoryStores[store].size;
    }),
  }),
}));

import {
  queueAction,
  getQueuedActions,
  processQueue,
  isOnline,
  type QueuedAction,
} from "../lib/offline-manager";

beforeEach(() => {
  // Clear in-memory stores between tests
  for (const key of Object.keys(memoryStores)) {
    delete memoryStores[key];
  }
  autoIncrement = 0;
});

describe("queueAction", () => {
  it("adds an action to the queue store", async () => {
    await queueAction({ type: "dead_drop", data: { msg: "hello" } });
    // Allow the async put to complete
    await new Promise((r) => setTimeout(r, 50));
    const items = await getQueuedActions();
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("dead_drop");
    expect(items[0].data).toEqual({ msg: "hello" });
  });

  it("assigns a timestamp to each queued action", async () => {
    const before = Date.now();
    await queueAction({ type: "test", data: {} });
    await new Promise((r) => setTimeout(r, 50));
    const items = await getQueuedActions();
    expect(items[0].ts).toBeGreaterThanOrEqual(before);
  });
});

describe("getQueuedActions", () => {
  it("returns an empty array when nothing is queued", async () => {
    const items = await getQueuedActions();
    expect(items).toEqual([]);
  });

  it("returns items sorted by timestamp", async () => {
    await queueAction({ type: "second", data: {} });
    await new Promise((r) => setTimeout(r, 10));
    await queueAction({ type: "first", data: {} });
    await new Promise((r) => setTimeout(r, 50));
    const items = await getQueuedActions();
    expect(items).toHaveLength(2);
    expect(items[0].ts).toBeLessThanOrEqual(items[1].ts);
  });
});

describe("processQueue", () => {
  it("returns 0 when the queue is empty", async () => {
    const count = await processQueue();
    expect(count).toBe(0);
  });

  it("drains all queued actions and returns the count", async () => {
    await queueAction({ type: "a", data: {} });
    await queueAction({ type: "b", data: {} });
    await queueAction({ type: "c", data: {} });
    await new Promise((r) => setTimeout(r, 50));

    const processed = await processQueue();
    expect(processed).toBe(3);

    const remaining = await getQueuedActions();
    expect(remaining).toHaveLength(0);
  });

  it("does not attempt to POST to /api/sync (no backend exists)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await queueAction({ type: "test", data: {} });
    await new Promise((r) => setTimeout(r, 50));
    await processQueue();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("isOnline", () => {
  it("returns a boolean", () => {
    const result = isOnline();
    expect(typeof result).toBe("boolean");
  });
});
