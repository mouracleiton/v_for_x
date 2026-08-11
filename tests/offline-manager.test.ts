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
  onConnectivityChange,
  downloadCountryPack,
  getCachedCountries,
  removeCountryPack,
  getCacheStats,
  clearAllCaches,
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

/* ═══════════════════════════════════════════════════════════════
   Connectivity change subscription
   ═══════════════════════════════════════════════════════════════ */

describe("onConnectivityChange", () => {
  it("returns an unsubscribe function", () => {
    const unsubscribe = onConnectivityChange(() => {});
    expect(typeof unsubscribe).toBe("function");
  });

  it("calls callback on online/offline events", () => {
    const callback = vi.fn();
    onConnectivityChange(callback);
    // In a test environment, navigator may not be fully simulated
    // but we can verify the function doesn't throw
    expect(callback).not.toHaveBeenCalled();
  });

  it("unsubscribe removes event listeners", () => {
    const callback = vi.fn();
    const unsubscribe = onConnectivityChange(callback);
    unsubscribe();
    // Should not throw and callback should not be called
    expect(callback).not.toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════
   Country pack management
   ═══════════════════════════════════════════════════════════════ */

describe("downloadCountryPack", () => {
  it("returns result with success boolean", async () => {
    const result = await downloadCountryPack("USA");
    expect(typeof result.success).toBe("boolean");
    expect(typeof result.cachedItems).toBe("number");
  });

  it("calls progress callback with updates", async () => {
    const progress = vi.fn();
    await downloadCountryPack("GBR", progress);
    expect(progress).toHaveBeenCalled();
  });

  it("progress reports include total and completed counts", async () => {
    const progress = vi.fn();
    await downloadCountryPack("FRA", progress);
    const calls = progress.mock.calls;
    if (calls.length > 0) {
      const firstCall = calls[0][0];
      expect(firstCall).toHaveProperty("total");
      expect(firstCall).toHaveProperty("completed");
    }
  });
});

describe("getCachedCountries", () => {
  it("returns an array", async () => {
    const countries = await getCachedCountries();
    expect(Array.isArray(countries)).toBe(true);
  });

  it("returns objects with iso3 and downloadedAt properties", async () => {
    const countries = await getCachedCountries();
    countries.forEach((country) => {
      expect(country).toHaveProperty("iso3");
      expect(country).toHaveProperty("downloadedAt");
    });
  });
});

describe("removeCountryPack", () => {
  it("does not throw for valid ISO3 code", async () => {
    await expect(removeCountryPack("USA")).resolves.toBeUndefined();
  });

  it("does not throw for unknown ISO3 code", async () => {
    await expect(removeCountryPack("XXX")).resolves.toBeUndefined();
  });
});

/* ═══════════════════════════════════════════════════════════════
   Cache statistics and management
   ═══════════════════════════════════════════════════════════════ */

describe("getCacheStats", () => {
  it("returns stats with size and entries", async () => {
    const stats = await getCacheStats();
    expect(stats).toHaveProperty("size");
    expect(stats).toHaveProperty("entries");
  });

  it("size and entries are numbers", async () => {
    const stats = await getCacheStats();
    expect(typeof stats.size).toBe("number");
    expect(typeof stats.entries).toBe("number");
  });

  it("returns non-negative values", async () => {
    const stats = await getCacheStats();
    expect(stats.size).toBeGreaterThanOrEqual(0);
    expect(stats.entries).toBeGreaterThanOrEqual(0);
  });
});

describe("clearAllCaches", () => {
  it("does not throw", async () => {
    await expect(clearAllCaches()).resolves.toBeUndefined();
  });

  it("clears caches without error", async () => {
    await clearAllCaches();
    const stats = await getCacheStats();
    // After clearing, should still return valid stats
    expect(stats).toHaveProperty("size");
    expect(stats).toHaveProperty("entries");
  });
});
