import { describe, it, expect, beforeEach, vi } from "vitest";

/* ═══ In-memory IDB mock that supports getAllFromIndex ═══ */

const memoryStores: Record<string, Map<string, any>> = {};

vi.mock("idb", () => ({
  openDB: vi.fn().mockResolvedValue({
    put: vi.fn(async (store: string, record: any) => {
      memoryStores[store] = memoryStores[store] || new Map();
      memoryStores[store].set(String(record.id), record);
    }),
    get: vi.fn(async (store: string, key: string) => {
      memoryStores[store] = memoryStores[store] || new Map();
      return memoryStores[store].get(String(key));
    }),
    getAll: vi.fn(async (store: string) => {
      memoryStores[store] = memoryStores[store] || new Map();
      return Array.from(memoryStores[store].values());
    }),
    getAllFromIndex: vi.fn(
      async (store: string, _index: string, key: string) => {
        memoryStores[store] = memoryStores[store] || new Map();
        return Array.from(memoryStores[store].values()).filter((r) => {
          if (store === "pledges") return r.iso3 === key;
          if (store === "dead_drops") return r.circleId === key;
          return true;
        });
      },
    ),
    delete: vi.fn(async (store: string, id: string) => {
      memoryStores[store] = memoryStores[store] || new Map();
      memoryStores[store].delete(String(id));
    }),
  }),
}));

import {
  generateHandle,
  createActionCircle,
  joinCircle,
  getCircles,
  makePledge,
  getPledges,
  createDeadDrop,
  getDeadDrops,
  decryptDeadDrop,
} from "../lib/action-network";

beforeEach(() => {
  for (const key of Object.keys(memoryStores)) delete memoryStores[key];
});

describe("action-network.ts — Community Action Network", () => {
  describe("generateHandle", () => {
    it("produces a VFX-prefixed handle", () => {
      const h = generateHandle();
      expect(h).toMatch(/^VFX-[A-Z0-9]{4}$/);
    });

    it("does not use ambiguous characters (0/O/1/I)", () => {
      // Run a batch; the charset excludes 0 O 1 I.
      for (let i = 0; i < 50; i++) {
        const suffix = generateHandle().slice(-4);
        for (const ch of suffix) {
          expect("0O1I").not.toContain(ch);
        }
      }
    });

    it("produces varied output across calls", () => {
      const handles = new Set<string>();
      for (let i = 0; i < 30; i++) handles.add(generateHandle());
      expect(handles.size).toBeGreaterThan(1);
    });
  });

  describe("action circles", () => {
    it("creates a circle with trimmed fields and memberCount 1", async () => {
      const c = await createActionCircle("  Water Rights  ", "BRA", "  desc  ");
      expect(c.topic).toBe("Water Rights");
      expect(c.countryCode).toBe("BRA");
      expect(c.description).toBe("desc");
      expect(c.memberCount).toBe(1);
      expect(c.id).toBeTruthy();
    });

    it("joinCircle increments memberCount", async () => {
      const c = await createActionCircle("Hunger", "SDN", "desc");
      await joinCircle(c.id);
      await joinCircle(c.id);
      const all = await getCircles();
      expect(all[0].memberCount).toBe(3);
    });

    it("joinCircle on an unknown id is a safe no-op", async () => {
      await expect(joinCircle("nope")).resolves.toBeUndefined();
    });

    it("getCircles returns newest-first", async () => {
      const a = await createActionCircle("A", "USA", "x");
      // ensure later createdAt
      await new Promise((r) => setTimeout(r, 5));
      const b = await createActionCircle("B", "USA", "y");
      const all = await getCircles();
      expect(all[0].id).toBe(b.id);
      expect(all[1].id).toBe(a.id);
    });

    it("getCircles returns [] when the store is empty", async () => {
      expect(await getCircles()).toEqual([]);
    });
  });

  describe("pledges", () => {
    it("creates a non-anonymous pledge with a generated handle", async () => {
      const p = await makePledge("YEM", "share_dossier", false);
      expect(p.iso3).toBe("YEM");
      expect(p.action).toBe("share_dossier");
      expect(p.anonymous).toBe(false);
      expect(p.handle).toMatch(/^VFX-/);
    });

    it("creates an anonymous pledge with handle 'anonymous'", async () => {
      const p = await makePledge("AFG", "organize_march", true);
      expect(p.anonymous).toBe(true);
      expect(p.handle).toBe("anonymous");
    });

    it("trims the action text", async () => {
      const p = await makePledge("SYR", "  contact_representative  ", true);
      expect(p.action).toBe("contact_representative");
    });

    it("getPledges returns newest-first", async () => {
      await makePledge("SDN", "a", true);
      await new Promise((r) => setTimeout(r, 5));
      await makePledge("SDN", "b", true);
      const all = await getPledges();
      expect(all).toHaveLength(2);
      expect(all[0].ts).toBeGreaterThanOrEqual(all[1].ts);
    });

    it("getPledges filters by iso3 when provided", async () => {
      await makePledge("SDN", "a", true);
      await makePledge("YEM", "b", true);
      await makePledge("SDN", "c", true);
      const sudan = await getPledges("SDN");
      expect(sudan).toHaveLength(2);
      expect(sudan.every((p) => p.iso3 === "SDN")).toBe(true);
    });

    it("getPledges returns [] when empty", async () => {
      expect(await getPledges()).toEqual([]);
    });
  });

  describe("dead drops", () => {
    it("creates an encrypted dead drop with future expiry", async () => {
      const c = await createActionCircle("Cell", "USA", "x");
      const drop = await createDeadDrop(c.id, "secret message", 1);
      expect(drop.circleId).toBe(c.id);
      expect(drop.encryptedContent.length).toBeGreaterThan(0);
      expect(drop.iv.length).toBeGreaterThan(0);
      expect(drop.expiresAt).toBeGreaterThan(Date.now());
    });

    it("getDeadDrops returns only non-expired drops for a circle", async () => {
      const c = await createActionCircle("Cell", "USA", "x");
      // Expired (negative TTL)
      const expired = await createDeadDrop(c.id, "old", -1);
      // Valid
      const fresh = await createDeadDrop(c.id, "new", 1);
      const drops = await getDeadDrops(c.id);
      const ids = drops.map((d) => d.id);
      expect(ids).toContain(fresh.id);
      expect(ids).not.toContain(expired.id);
    });

    it("getDeadDrops returns drops newest-first", async () => {
      const c = await createActionCircle("Cell", "USA", "x");
      await createDeadDrop(c.id, "first", 1);
      await new Promise((r) => setTimeout(r, 5));
      await createDeadDrop(c.id, "second", 1);
      const drops = await getDeadDrops(c.id);
      expect(drops[0].ts).toBeGreaterThanOrEqual(drops[1].ts);
    });

    it("getDeadDrops isolates drops by circle", async () => {
      const a = await createActionCircle("A", "USA", "x");
      const b = await createActionCircle("B", "USA", "y");
      await createDeadDrop(a.id, "in A", 1);
      await createDeadDrop(b.id, "in B", 1);
      expect(await getDeadDrops(a.id)).toHaveLength(1);
      expect(await getDeadDrops(b.id)).toHaveLength(1);
    });

    it("decryptDeadDrop recovers the original plaintext", async () => {
      const c = await createActionCircle("Cell", "USA", "x");
      const drop = await createDeadDrop(c.id, "the eagle lands at dawn", 2);
      const recovered = await decryptDeadDrop(drop);
      expect(recovered).toBe("the eagle lands at dawn");
    });

    it("decryptDeadDrop round-trips a drop created with a custom circle id", async () => {
      const drop = await createDeadDrop("circle-X", "the eagle lands at dawn", 1);
      const recovered = await decryptDeadDrop(drop);
      expect(recovered).toBe("the eagle lands at dawn");
    });

    it("getDeadDrops returns [] for an empty circle", async () => {
      const c = await createActionCircle("Empty", "USA", "x");
      expect(await getDeadDrops(c.id)).toEqual([]);
    });
  });

  describe("resilience", () => {
    it("createActionCircle always returns a populated circle object", async () => {
      // The function wraps persistence in try/catch, so the returned object
      // is well-formed regardless of the underlying store state.
      const c = await createActionCircle("Resilient", "USA", "x");
      expect(c).toBeTruthy();
      expect(c.topic).toBe("Resilient");
      expect(typeof c.createdAt).toBe("number");
    });
  });
});
