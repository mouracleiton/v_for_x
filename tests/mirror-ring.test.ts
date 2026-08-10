import { describe, it, expect } from "vitest";
import {
  seedRing,
  mergeIntoRing,
  capRing,
  sortRing,
  claimToEntry,
  shortFingerprint,
  ringStats,
  ringFingerprintRoot,
  ringShareText,
  MAX_RING_SIZE,
  type RingEntry,
  type SeedEntry,
} from "../lib/mirror-ring";
import { generateMirrorKey, createMirrorClaim } from "../lib/mirror";

// crypto.subtle is available in Node 20+ global scope
if (!globalThis.crypto?.randomUUID) {
  (globalThis.crypto as any) = {
    ...(globalThis.crypto || {}),
    randomUUID: () => "test-" + Math.random().toString(36).slice(2),
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    },
    subtle: (globalThis.crypto as any)?.subtle,
  };
}

function entry(
  host: string,
  over: Partial<RingEntry> = {},
): RingEntry {
  return {
    host,
    transport: "clearnet",
    claimedAt: "2025-01-01T00:00:00Z",
    verified: false,
    fingerprint: null,
    ...over,
  };
}

const SEED: SeedEntry[] = [
  {
    host: "https://mouracleiton.github.io/v_for_x",
    transport: "clearnet",
    region: "US",
    note: "primary origin",
    claimedAt: "2025-11-01T00:00:00Z",
    fingerprint: null,
  },
  {
    host: "https://vforx.org/",
    transport: "clearnet",
    claimedAt: "2025-11-01T00:00:00Z",
    fingerprint: null,
  },
  {
    host: "https://ipfs.io/ipfs/",
    transport: "ipfs",
    claimedAt: "2025-11-01T00:00:00Z",
    fingerprint: null,
  },
];

describe("mirror-ring.ts", () => {
  describe("seedRing", () => {
    it("tags every seed as unverified with a null fingerprint", () => {
      const ring = seedRing(SEED);
      expect(ring).toHaveLength(3);
      for (const e of ring) {
        expect(e.verified).toBe(false);
        expect(e.fingerprint).toBeNull();
        expect(e.publicKey).toBeNull();
      }
    });

    it("preserves host, transport, region and note metadata", () => {
      const ring = seedRing(SEED);
      expect(ring[0]).toMatchObject({
        host: "https://mouracleiton.github.io/v_for_x",
        transport: "clearnet",
        region: "US",
        note: "primary origin",
        claimedAt: "2025-11-01T00:00:00Z",
      });
    });

    it("normalises hosts and skips junk entries", () => {
      const ring = seedRing([
        { host: "https://Example.org/", transport: "clearnet", claimedAt: "2025-11-01T00:00:00Z" },
        { host: "", transport: "clearnet", claimedAt: "2025-11-01T00:00:00Z" },
        { host: "https://bad.example", transport: "carrier-pigeon" as any, claimedAt: "2025-11-01T00:00:00Z" },
      ]);
      expect(ring).toHaveLength(1);
      expect(ring[0].host).toBe("https://example.org");
    });

    it("handles a missing claimedAt honestly", () => {
      const ring = seedRing([{ host: "https://x.example", transport: "clearnet" } as SeedEntry]);
      expect(Date.parse(ring[0].claimedAt)).not.toBeNaN();
    });
  });

  describe("mergeIntoRing", () => {
    it("appends a new host", () => {
      const out = mergeIntoRing([entry("https://a.example")], entry("https://b.example"));
      expect(out).toHaveLength(2);
      expect(out.map((e) => e.host)).toContain("https://b.example");
    });

    it("dedupes by host ignoring trailing slash and case", () => {
      const out = mergeIntoRing(
        [entry("https://A.example/")],
        entry("https://a.example"),
      );
      expect(out).toHaveLength(1);
    });

    it("keeps the newest claim for the same host (newest wins)", () => {
      const old = entry("https://a.example", { claimedAt: "2025-01-01T00:00:00Z" });
      const fresh = entry("https://a.example", { claimedAt: "2025-06-01T00:00:00Z" });
      expect(mergeIntoRing([old], fresh)[0].claimedAt).toBe(fresh.claimedAt);
      expect(mergeIntoRing([], old).length).toBe(1);
    });

    it("lets a verified claim replace an unverified seed for the same host", () => {
      const seed = entry("https://a.example", { verified: false });
      const claim = entry("https://a.example", {
        verified: true,
        fingerprint: "f".repeat(64),
        handle: "V-abcd-1234",
      });
      const merged = mergeIntoRing([seed], claim);
      expect(merged).toHaveLength(1);
      expect(merged[0].verified).toBe(true);
      expect(merged[0].fingerprint).toBe("f".repeat(64));
    });

    it("prefers the verified entry on a claimedAt tie", () => {
      const seed = entry("https://a.example", { verified: false, claimedAt: "2025-01-01T00:00:00Z" });
      const claim = entry("https://a.example", { verified: true, claimedAt: "2025-01-01T00:00:00Z" });
      expect(mergeIntoRing([seed], claim)[0].verified).toBe(true);
    });
  });

  describe("capRing (MAX_RING_SIZE)", () => {
    it("enforces the 200-entry cap by dropping the oldest unverified entries", () => {
      const many: RingEntry[] = [];
      for (let i = 0; i < MAX_RING_SIZE + 30; i++) {
        many.push(entry(`https://m${i}.example`, {
          claimedAt: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(),
        }));
      }
      const capped = capRing(many);
      expect(capped).toHaveLength(MAX_RING_SIZE);
      // the 30 oldest (m0..m29) must be gone, the rest retained
      expect(capped.some((e) => e.host === "https://m0.example")).toBe(false);
      expect(capped.some((e) => e.host === "https://m29.example")).toBe(false);
      expect(capped.some((e) => e.host === "https://m30.example")).toBe(true);
      expect(capped[capped.length - 1].host).toBe("https://m229.example");
    });

    it("keeps verified entries even when they are the oldest", () => {
      const oldVerified = entry("https://keep.example", {
        verified: true,
        claimedAt: "2020-01-01T00:00:00Z",
      });
      const many: RingEntry[] = [];
      for (let i = 0; i < MAX_RING_SIZE; i++) {
        many.push(entry(`https://m${i}.example`, {
          claimedAt: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(),
        }));
      }
      const capped = capRing([...many, oldVerified]);
      expect(capped).toHaveLength(MAX_RING_SIZE);
      expect(capped.some((e) => e.host === "https://keep.example")).toBe(true);
    });

    it("mergeIntoRing applies the cap end-to-end", () => {
      let ring: RingEntry[] = [];
      for (let i = 0; i < MAX_RING_SIZE + 5; i++) {
        ring = mergeIntoRing(ring, entry(`https://m${i}.example`, {
          claimedAt: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(),
        }));
      }
      expect(ring).toHaveLength(MAX_RING_SIZE);
      expect(ring[ring.length - 1].host).toBe(`https://m${MAX_RING_SIZE + 4}.example`);
    });
  });

  describe("sortRing", () => {
    it("orders verified mirrors first, newest first within each group", () => {
      const ring = [
        entry("https://z.example", { verified: false, claimedAt: "2025-06-01T00:00:00Z" }),
        entry("https://a.example", { verified: true, claimedAt: "2025-01-01T00:00:00Z" }),
        entry("https://b.example", { verified: true, claimedAt: "2025-09-01T00:00:00Z" }),
      ];
      const sorted = sortRing(ring);
      expect(sorted.map((e) => e.host)).toEqual([
        "https://b.example",
        "https://a.example",
        "https://z.example",
      ]);
    });
  });

  describe("claimToEntry", () => {
    it("maps a real signed claim into a verified ring entry", async () => {
      const key = await generateMirrorKey();
      const node = await createMirrorClaim(key, {
        transport: "onion",
        endpoint: "vfx7q2zabcdefghijklmnopqrstuvwxycdefghi567890.onion",
        region: "EU-WEST",
        buildHash: "a".repeat(64),
      });
      const e = claimToEntry(node);
      expect(e).toMatchObject({
        id: node.id,
        host: node.endpoint,
        transport: "onion",
        region: "EU-WEST",
        verified: true,
        fingerprint: node.contentHash,
        publicKey: node.signerPublicKey,
        handle: node.handle,
        buildHash: "a".repeat(64),
      });
      expect(new Date(e.claimedAt).getTime()).toBe(node.ts);
    });

    it("honours a host override (e.g. an IPFS gateway for a bare CID)", async () => {
      const key = await generateMirrorKey();
      const node = await createMirrorClaim(key, { transport: "ipfs", endpoint: "bafybeiCID" });
      const e = claimToEntry(node, "https://ipfs.io/ipfs/bafybeiCID");
      expect(e.host).toBe("https://ipfs.io/ipfs/bafybeiCID");
    });
  });

  describe("shortFingerprint", () => {
    it("shows 12 hex chars for a claim fingerprint", () => {
      expect(shortFingerprint("f".repeat(64))).toBe("f".repeat(12));
      expect(shortFingerprint()).toBe("no claim");
      expect(shortFingerprint(null)).toBe("no claim");
    });
  });

  describe("ringStats", () => {
    it("counts total, verified and transports breakdown", () => {
      const s = ringStats([
        entry("https://a.example", { verified: true, transport: "clearnet" }),
        entry("https://b.example", { verified: true, transport: "onion" }),
        entry("https://c.example", { transport: "ipfs" }),
      ]);
      expect(s.total).toBe(3);
      expect(s.verified).toBe(2);
      expect(s.byTransport.clearnet).toBe(1);
      expect(s.byTransport.onion).toBe(1);
      expect(s.byTransport.ipfs).toBe(1);
    });
  });

  describe("ringFingerprintRoot / ringShareText", () => {
    it("computes a 64-hex deterministic root", async () => {
      const ring = [
        entry("https://a.example", { verified: true, fingerprint: "a".repeat(64) }),
        entry("https://b.example", { fingerprint: null }),
      ];
      const root = await ringFingerprintRoot(ring);
      expect(root).toMatch(/^[a-f0-9]{64}$/);
      expect(await ringFingerprintRoot([...ring].reverse())).toBe(root);
    });

    it("formats the ring text block exactly: header, verified first, footer", async () => {
      const ring = [
        entry("https://unverified.example", { claimedAt: "2025-01-01T00:00:00Z" }),
        entry("https://good.example", {
          verified: true,
          transport: "onion",
          region: "EU",
          claimedAt: "2025-02-01T00:00:00Z",
          fingerprint: "b".repeat(64),
        }),
      ];
      const text = await ringShareText(ring);
      const root = await ringFingerprintRoot(ring);
      expect(text).toBe(
        [
          "V FOR X MIRROR RING — 2 mirrors",
          "https://good.example  (TOR, EU)  [VERIFIED]",
          "https://unverified.example  (CLEARNET, -)  [UNVERIFIED]",
          `Fingerprint root: ${root}`,
        ].join("\n"),
      );
    });

    it("shows the missing region as a dash", async () => {
      const text = await ringShareText([entry("https://x.example")]);
      expect(text).toContain("(CLEARNET, -)  [UNVERIFIED]");
    });
  });

  describe("full claim loop", () => {
    it("mint → verify → ring → share text, end to end", async () => {
      const key = await generateMirrorKey();
      const node = await createMirrorClaim(key, {
        transport: "onion",
        endpoint: "vfxringtest1234567890abcdef.onion",
        region: "BR",
      });
      // signature is genuine — this is the exact verify path the page uses
      const { verifyMirrorClaim } = await import("../lib/mirror");
      expect(await verifyMirrorClaim(node)).toBe(true);

      const ring = seedRing(SEED);
      const merged = mergeIntoRing(ring, claimToEntry(node));
      expect(merged).toHaveLength(SEED.length + 1);
      expect(merged.find((e) => e.host === node.endpoint)?.verified).toBe(true);

      const text = await ringShareText(merged);
      expect(text.startsWith("V FOR X MIRROR RING — 4 mirrors")).toBe(true);
      // verified entry sorts first and is marked
      expect(text.split("\n")[1]).toBe(
        `${node.endpoint}  (TOR, BR)  [VERIFIED]`,
      );
      expect(text.split("\n").pop()).toMatch(/^Fingerprint root: [a-f0-9]{64}$/);
    });
  });
});