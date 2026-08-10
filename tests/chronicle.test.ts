import { describe, it, expect } from "vitest";
import {
  createEvent,
  computeEventHash,
  verifyEvent,
  verifyChain,
  getLastHash,
  shortHash,
  GENESIS_HASH,
  verificationStatus,
  addCorroboration,
  haversineKm,
  geoHash,
  clusterEvents,
  timelineBuckets,
  summarize,
  heatColor,
  effectiveIntensity,
  exportChain,
  importChain,
  seedChain,
  generateKey,
  signEvent,
  verifySignature,
  EVENT_TYPES,
  ALL_EVENT_TYPES,
  SEVERITY_ORDER,
  type ChronicleEvent,
  type EventType,
  type Severity,
} from "../lib/chronicle";

// crypto.subtle is available in Node 20+ global scope (per dag.test.ts).
const GENESIS = GENESIS_HASH;

/** Build a single hash-chained event for tests. */
async function mkEvent(
  overrides: Partial<Omit<ChronicleEvent, "id" | "hash" | "prevHash" | "corroborations">> & {
    prevHash?: string;
  } = {},
): Promise<ChronicleEvent> {
  const base = {
    ts: 1_700_000_000_000,
    lat: 15.6,
    lng: 32.5,
    type: "killing" as EventType,
    severity: "critical" as Severity,
    title: "Test event",
    source: "self" as const,
    signerHandle: "V-TEST-0001",
  };
  const prevHash = overrides.prevHash ?? GENESIS;
  // Strip prevHash so we don't double-pass it into createEvent.
  const { prevHash: _omit, ...rest } = overrides;
  return createEvent({ ...base, ...rest }, prevHash);
}

/** Build a valid chain of N events. */
async function mkChain(n: number): Promise<ChronicleEvent[]> {
  const chain: ChronicleEvent[] = [];
  let prev = GENESIS;
  for (let i = 0; i < n; i++) {
    const e = await mkEvent({ ts: 1000 * (i + 1), title: `Event ${i}`, prevHash: prev });
    chain.push(e);
    prev = e.hash;
  }
  return chain;
}

describe("chronicle.ts", () => {
  /* ════════════════════════════════════════════════════════════
     HASH-CHAIN CORE
     ════════════════════════════════════════════════════════════ */
  describe("computeEventHash", () => {
    it("should return a 64-char hex digest", async () => {
      const hash = await computeEventHash({
        prevHash: GENESIS,
        ts: 1000,
        lat: 1,
        lng: 2,
        type: "protest",
        severity: "low",
        title: "x",
        description: "",
        location: "",
        iso3: "",
        source: "self",
        signerHandle: "A",
        publicKey: "",
      });
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it("should produce different hashes for different prevHash (chain linkage)", async () => {
      const base = {
        ts: 1000, lat: 1, lng: 2, type: "protest" as EventType, severity: "low" as Severity,
        title: "x", description: "", location: "", iso3: "", source: "self" as const,
        signerHandle: "A", publicKey: "",
      };
      const h1 = await computeEventHash({ ...base, prevHash: GENESIS });
      const h2 = await computeEventHash({ ...base, prevHash: "a".repeat(64) });
      expect(h1).not.toBe(h2);
    });

    it("should be deterministic for identical content", async () => {
      const content = {
        prevHash: GENESIS, ts: 7, lat: 10, lng: -10, type: "killing" as EventType,
        severity: "critical" as Severity, title: "same", description: "d", location: "L",
        iso3: "SDN", source: "self" as const, signerHandle: "X", publicKey: "pk",
      };
      expect(await computeEventHash(content)).toBe(await computeEventHash(content));
    });
  });

  describe("createEvent", () => {
    it("should chain to genesis when first", async () => {
      const e = await mkEvent();
      expect(e.prevHash).toBe(GENESIS);
      expect(e.hash).toHaveLength(64);
      expect(e.hash).not.toBe(GENESIS);
    });

    it("should chain to the previous event's hash", async () => {
      const e1 = await mkEvent({ ts: 1000 });
      const e2 = await mkEvent({ ts: 2000, prevHash: e1.hash });
      expect(e2.prevHash).toBe(e1.hash);
      expect(e2.hash).not.toBe(e1.hash);
    });

    it("should start with empty corroborations and an id", async () => {
      const e = await mkEvent();
      expect(e.corroborations).toEqual([]);
      expect(typeof e.id).toBe("string");
      expect(e.id.length).toBeGreaterThan(0);
    });
  });

  describe("verifyEvent", () => {
    it("should return true for an untampered event", async () => {
      const e = await mkEvent();
      expect(await verifyEvent(e)).toBe(true);
    });

    it("should return false when title is tampered", async () => {
      const e = await mkEvent();
      e.title = "tampered";
      expect(await verifyEvent(e)).toBe(false);
    });

    it("should return false when severity is tampered", async () => {
      const e = await mkEvent();
      e.severity = "low";
      expect(await verifyEvent(e)).toBe(false);
    });

    it("should return false when prevHash is tampered", async () => {
      const e = await mkEvent();
      e.prevHash = "f".repeat(64);
      expect(await verifyEvent(e)).toBe(false);
    });
  });

  describe("verifyChain", () => {
    it("should accept an empty chain", async () => {
      const r = await verifyChain([]);
      expect(r.valid).toBe(true);
      expect(r.totalEvents).toBe(0);
    });

    it("should accept a valid multi-event chain", async () => {
      const chain = await mkChain(5);
      const r = await verifyChain(chain);
      expect(r.valid).toBe(true);
      expect(r.totalEvents).toBe(5);
    });

    it("should reject a chain with tampered content", async () => {
      const chain = await mkChain(3);
      chain[1].title = "hacked";
      const r = await verifyChain(chain);
      expect(r.valid).toBe(false);
      expect(r.brokenAt).toBe(1);
    });

    it("should reject a chain with broken linkage", async () => {
      const chain = await mkChain(3);
      // Re-hash event 2 against a wrong prev so its own hash is valid but
      // linkage to event 1 is broken.
      const e2content = {
        prevHash: "deadbeef".repeat(8), ts: chain[2].ts, lat: chain[2].lat,
        lng: chain[2].lng, type: chain[2].type, severity: chain[2].severity,
        title: chain[2].title, description: "", location: "", iso3: "",
        source: chain[2].source, signerHandle: chain[2].signerHandle, publicKey: "",
      };
      chain[2].prevHash = "deadbeef".repeat(8);
      chain[2].hash = await computeEventHash(e2content);
      const r = await verifyChain(chain);
      expect(r.valid).toBe(false);
      expect(r.brokenAt).toBe(2);
      expect(r.message).toContain("prevHash");
    });

    it("should reject a reordered chain", async () => {
      const chain = await mkChain(3);
      const reordered = [chain[0], chain[2], chain[1]];
      const r = await verifyChain(reordered);
      expect(r.valid).toBe(false);
    });
  });

  describe("getLastHash / shortHash", () => {
    it("should return genesis for an empty chain", () => {
      expect(getLastHash([])).toBe(GENESIS);
    });

    it("should return the last event's hash", async () => {
      const chain = await mkChain(3);
      expect(getLastHash(chain)).toBe(chain[2].hash);
    });

    it("shortHash returns the first 12 chars", () => {
      const h = "abcdef1234567890".repeat(4);
      expect(shortHash(h)).toBe("abcdef123456");
    });
  });

  /* ════════════════════════════════════════════════════════════
     CORROBORATION & VERIFICATION STATUS
     ════════════════════════════════════════════════════════════ */
  describe("verificationStatus", () => {
    it("should be UNVERIFIED with no signature and no corroborations", async () => {
      const e = await mkEvent();
      expect(verificationStatus(e)).toBe("UNVERIFIED");
    });

    it("should be SIGNED when a signature + publicKey are present", async () => {
      const e = await mkEvent({ signature: "sig", publicKey: "pk" });
      expect(verificationStatus(e)).toBe("SIGNED");
    });

    it("should be CORROBORATED with one attestation", async () => {
      const e = await mkEvent({ signature: "sig", publicKey: "pk" });
      const c = addCorroboration(e, { handle: "X", ts: 1, proofType: "witness" });
      expect(verificationStatus(c)).toBe("CORROBORATED");
    });

    it("should be VERIFIED at threshold with strong proof", async () => {
      let e = await mkEvent({ signature: "sig", publicKey: "pk" });
      for (let i = 0; i < 3; i++) {
        e = addCorroboration(e, {
          handle: `H${i}`, ts: i,
          proofType: i === 0 ? "expert" : "witness",
        });
      }
      expect(verificationStatus(e)).toBe("VERIFIED");
    });
  });

  describe("addCorroboration", () => {
    it("should append immutably without mutating the original", async () => {
      const e = await mkEvent();
      const c = addCorroboration(e, { handle: "X", ts: 1, proofType: "witness" });
      expect(e.corroborations).toHaveLength(0);
      expect(c.corroborations).toHaveLength(1);
      expect(c.corroborations[0].handle).toBe("X");
    });
  });

  /* ════════════════════════════════════════════════════════════
     SPATIAL / TEMPORAL
     ════════════════════════════════════════════════════════════ */
  describe("haversineKm", () => {
    it("should be ~0 for the same point", () => {
      expect(haversineKm({ lat: 10, lng: 20 }, { lat: 10, lng: 20 })).toBeCloseTo(0, 5);
    });

    it("should compute a known distance (Paris–Berlin ≈ 878km)", () => {
      const d = haversineKm({ lat: 48.8566, lng: 2.3522 }, { lat: 52.52, lng: 13.405 });
      expect(d).toBeGreaterThan(870);
      expect(d).toBeLessThan(890);
    });
  });

  describe("geoHash", () => {
    it("should quantize nearby points to the same cell", () => {
      expect(geoHash(15.61, 32.53)).toBe(geoHash(15.62, 32.54));
    });

    it("should separate distant points", () => {
      expect(geoHash(15.6, 32.5)).not.toBe(geoHash(50.45, 30.52));
    });
  });

  describe("clusterEvents", () => {
    it("should group nearby events", async () => {
      const near1 = await mkEvent({ lat: 15.6, lng: 32.5 });
      const near2 = await mkEvent({ lat: 15.601, lng: 32.501 });
      const far = await mkEvent({ lat: 50.45, lng: 30.52 });
      const clusters = clusterEvents([near1, near2, far], 100);
      expect(clusters).toHaveLength(2);
      const big = clusters[0];
      expect(big.count).toBe(2);
    });

    it("should return an empty array for no events", () => {
      expect(clusterEvents([], 50)).toEqual([]);
    });
  });

  describe("timelineBuckets", () => {
    it("should bucket events by day", async () => {
      const day = 86_400_000;
      const e1 = await mkEvent({ ts: 0 });
      const e2 = await mkEvent({ ts: day });
      const e3 = await mkEvent({ ts: day + 1000 });
      const buckets = timelineBuckets([e1, e2, e3], day);
      expect(buckets.length).toBe(2);
      expect(buckets[0].events).toHaveLength(1);
      expect(buckets[1].events).toHaveLength(2);
    });

    it("should return an empty array for no events", () => {
      expect(timelineBuckets([])).toEqual([]);
    });

    it("should sort events within a bucket by time", async () => {
      const day = 86_400_000;
      const late = await mkEvent({ ts: 5000 });
      const early = await mkEvent({ ts: 1000 });
      const buckets = timelineBuckets([late, early], day);
      expect(buckets[0].events[0].ts).toBe(1000);
      expect(buckets[0].events[1].ts).toBe(5000);
    });
  });

  describe("summarize", () => {
    it("should report correct totals and tallies", async () => {
      const chain = await mkChain(3);
      chain[0].severity = "critical";
      chain[1].severity = "high";
      chain[2].severity = "low";
      const s = summarize(chain);
      expect(s.total).toBe(3);
      expect(s.activeCells).toBeGreaterThanOrEqual(1);
      expect(s.earliest).toBeLessThanOrEqual(s.latest ?? 0);
    });

    it("should count signed and verified events", async () => {
      const chain = await mkChain(2);
      chain[0].signature = "sig";
      chain[0].publicKey = "pk";
      // Add enough corroborations for VERIFIED.
      chain[1] = addCorroboration(chain[1], { handle: "a", ts: 1, proofType: "expert" });
      chain[1] = addCorroboration(chain[1], { handle: "b", ts: 2, proofType: "witness" });
      chain[1] = addCorroboration(chain[1], { handle: "c", ts: 3, proofType: "witness" });
      const s = summarize(chain);
      expect(s.signed).toBe(1);
      expect(s.verified).toBe(1);
    });

    it("should handle an empty chain", () => {
      const s = summarize([]);
      expect(s.total).toBe(0);
      expect(s.earliest).toBeNull();
      expect(s.latest).toBeNull();
    });
  });

  describe("heatColor / effectiveIntensity", () => {
    it("heatColor should clamp outside 0..100", () => {
      expect(heatColor(-10)).toBe(heatColor(0));
      expect(heatColor(150)).toBe(heatColor(100));
    });

    it("effectiveIntensity should be a weighted blend in 0..100", async () => {
      const e = await mkEvent({ type: "protest", severity: "info" });
      const intensity = effectiveIntensity(e);
      expect(intensity).toBeGreaterThanOrEqual(0);
      expect(intensity).toBeLessThanOrEqual(100);
    });
  });

  /* ════════════════════════════════════════════════════════════
     EXPORT / IMPORT
     ════════════════════════════════════════════════════════════ */
  describe("exportChain / importChain", () => {
    it("should round-trip a chain through export + import", async () => {
      const chain = await mkChain(3);
      const exported = exportChain(chain);
      const json = JSON.stringify(exported);
      const imported = importChain(json);
      expect(imported).toHaveLength(3);
      // Verify the re-imported chain is still valid.
      const r = await verifyChain(imported);
      expect(r.valid).toBe(true);
    });

    it("should throw on malformed input", () => {
      expect(() => importChain("{ not json")).toThrow();
      expect(() => importChain(JSON.stringify({ v: 1 }))).toThrow();
    });

    it("should throw when an event is missing required fields", () => {
      const bad = JSON.stringify({
        v: 1, exportedAt: 1, genesis: GENESIS,
        events: [{ id: "x", ts: 1 }],
      });
      expect(() => importChain(bad)).toThrow();
    });
  });

  /* ════════════════════════════════════════════════════════════
     SEED DATA
     ════════════════════════════════════════════════════════════ */
  describe("seedChain", () => {
    it("should produce a valid, fully-chained set of events", async () => {
      const chain = await seedChain();
      expect(chain.length).toBeGreaterThan(5);
      const r = await verifyChain(chain);
      expect(r.valid).toBe(true);
      // First event links to genesis.
      expect(chain[0].prevHash).toBe(GENESIS);
      // Every event's prevHash matches its predecessor's hash.
      for (let i = 1; i < chain.length; i++) {
        expect(chain[i].prevHash).toBe(chain[i - 1].hash);
      }
    });
  });

  /* ════════════════════════════════════════════════════════════
     ECDSA SIGNING (requires crypto.subtle — Node 20+ provides it)
     ════════════════════════════════════════════════════════════ */
  describe("signing", () => {
    it("generateKey should yield a usable ECDSA keypair", async () => {
      // Node exposes crypto.subtle globally; emulate window.crypto if needed.
      if (typeof globalThis.crypto?.subtle === "undefined") {
        console.warn("crypto.subtle unavailable — skipping signing test");
        return;
      }
      const g = (globalThis as unknown as { crypto: Crypto }).crypto;
      const origWindow = (globalThis as unknown as { window?: unknown }).window;
      (globalThis as unknown as { window: unknown }).window = { crypto: g };
      try {
        const kp = await generateKey();
        expect(kp.publicKey.length).toBeGreaterThan(0);
        expect(kp.privateKey.length).toBeGreaterThan(0);

        const hash = "a".repeat(64);
        const sig = await signEvent(hash, kp.privateKey);
        expect(sig.length).toBeGreaterThan(0);

        // verifySignature needs the event shape.
        const ok = await verifySignature({ hash, signature: sig, publicKey: kp.publicKey } as ChronicleEvent);
        expect(ok).toBe(true);

        // Tampered hash should fail verification.
        const bad = await verifySignature({ hash: "b".repeat(64), signature: sig, publicKey: kp.publicKey } as ChronicleEvent);
        expect(bad).toBe(false);
      } finally {
        (globalThis as unknown as { window?: unknown }).window = origWindow;
      }
    });
  });

  /* ════════════════════════════════════════════════════════════
     CATALOG
     ════════════════════════════════════════════════════════════ */
  describe("catalog", () => {
    it("should expose every EventType in EVENT_TYPES", () => {
      for (const m of ALL_EVENT_TYPES) {
        expect(EVENT_TYPES[m.type]).toBeDefined();
        expect(m.glyph.length).toBeGreaterThan(0);
      }
    });

    it("should order SEVERITY from info to critical", () => {
      expect(SEVERITY_ORDER[0]).toBe("info");
      expect(SEVERITY_ORDER[SEVERITY_ORDER.length - 1]).toBe("critical");
    });
  });
});
