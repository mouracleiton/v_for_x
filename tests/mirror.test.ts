import { describe, it, expect } from "vitest";
import {
  MIRROR_KIT_VERSION,
  CLAIM_TOKEN_PREFIX,
  generateMirrorKey,
  createMirrorClaim,
  verifyMirrorClaim,
  canonicalClaimContent,
  encodeClaim,
  decodeClaim,
  mergeNodeLists,
  summarizeNetwork,
  verifyNodeList,
  exportNodeList,
  parseNodeList,
  computeManifestRoot,
  isValidSha256,
  shortHash,
  sameClaim,
  TRANSPORT_LABELS,
} from "../lib/mirror";
import type { MirrorKeyPair, MirrorNode } from "../lib/mirror";

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

async function makeClaim(
  transport: MirrorNode["transport"] = "onion",
  endpoint = "vfx7q2zabcdefghijklmnopqrstuvwxycdefghi567890.onion",
): Promise<{ key: MirrorKeyPair; node: MirrorNode }> {
  const key = await generateMirrorKey();
  const node = await createMirrorClaim(key, {
    transport,
    endpoint,
    region: "EU-WEST",
    buildHash: "a".repeat(64),
    buildVersion: "v1.0.0",
  });
  return { key, node };
}

describe("mirror.ts", () => {
  describe("generateMirrorKey", () => {
    it("should generate a keypair with a V-XXXX-XXXX handle", async () => {
      const key = await generateMirrorKey();
      expect(key.publicKey).toBeTruthy();
      expect(key.privateKey).toBeTruthy();
      expect(key.handle).toMatch(/^V-[a-f0-9]{4}-[a-f0-9]{4}$/);
    });

    it("should generate unique handles", async () => {
      const a = await generateMirrorKey();
      const b = await generateMirrorKey();
      expect(a.handle).not.toBe(b.handle);
      expect(a.privateKey).not.toBe(b.privateKey);
    });
  });

  describe("createMirrorClaim", () => {
    it("should mint a signed claim bound to the operator key", async () => {
      const { key, node } = await makeClaim();
      expect(node.id).toBeTruthy();
      expect(node.handle).toBe(key.handle);
      expect(node.transport).toBe("onion");
      expect(node.kitVersion).toBe(MIRROR_KIT_VERSION);
      expect(node.contentHash).toHaveLength(64);
      expect(node.signature).toBeTruthy();
      expect(node.signerPublicKey).toBe(key.publicKey);
    });

    it("should reject unknown transports", async () => {
      const key = await generateMirrorKey();
      await expect(
        createMirrorClaim(key, { transport: "carrier-pigeon" as any, endpoint: "x" }),
      ).rejects.toThrow(/transport/i);
    });

    it("should reject too-short endpoints", async () => {
      const key = await generateMirrorKey();
      await expect(
        createMirrorClaim(key, { transport: "ipfs", endpoint: "ab" }),
      ).rejects.toThrow(/endpoint/i);
    });

    it("should default buildHash to 'unknown' when omitted", async () => {
      const key = await generateMirrorKey();
      const node = await createMirrorClaim(key, {
        transport: "usb",
        endpoint: "Kingston DT100 32GB",
      });
      expect(node.buildHash).toBe("unknown");
    });
  });

  describe("verifyMirrorClaim", () => {
    it("should verify a freshly signed claim", async () => {
      const { node } = await makeClaim();
      expect(await verifyMirrorClaim(node)).toBe(true);
    });

    it("should fail when the endpoint is tampered with", async () => {
      const { node } = await makeClaim();
      const tampered: MirrorNode = {
        ...node,
        endpoint: "evil-operator.onion",
      };
      expect(await verifyMirrorClaim(tampered)).toBe(false);
    });

    it("should fail when the buildHash is tampered with", async () => {
      const { node } = await makeClaim();
      const tampered: MirrorNode = {
        ...node,
        buildHash: "f".repeat(64),
      };
      expect(await verifyMirrorClaim(tampered)).toBe(false);
    });

    it("should fail when the signature is swapped from another key", async () => {
      const { node } = await makeClaim();
      const other = await makeClaim();
      const franken: MirrorNode = {
        ...node,
        signature: other.node.signature,
        signerPublicKey: other.node.signerPublicKey,
      };
      expect(await verifyMirrorClaim(franken)).toBe(false);
    });

    it("should return false (not throw) on malformed input", async () => {
      expect(await verifyMirrorClaim(null as any)).toBe(false);
      expect(await verifyMirrorClaim({} as any)).toBe(false);
      expect(
        await verifyMirrorClaim({ ...({} as any), transport: "nope" }),
      ).toBe(false);
    });
  });

  describe("canonicalClaimContent", () => {
    it("should be deterministic regardless of field insertion order", () => {
      const base = {
        id: "abc",
        handle: "V-1234-5678",
        transport: "ipfs" as const,
        endpoint: "bafy…",
        buildHash: "deadbeef",
        kitVersion: "1.0.0",
        ts: 12345,
      };
      const a = canonicalClaimContent(base);
      const b = canonicalClaimContent({
        ts: 12345,
        kitVersion: "1.0.0",
        buildHash: "deadbeef",
        endpoint: "bafy…",
        transport: "ipfs",
        handle: "V-1234-5678",
        id: "abc",
      });
      expect(a).toBe(b);
    });
  });

  describe("encodeClaim / decodeClaim", () => {
    it("should round-trip a signed claim", async () => {
      const { node } = await makeClaim();
      const token = encodeClaim(node);
      expect(token.startsWith(CLAIM_TOKEN_PREFIX)).toBe(true);
      const decoded = decodeClaim(token);
      expect(decoded).toEqual(node);
      expect(await verifyMirrorClaim(decoded)).toBe(true);
    });

    it("should reject tokens without the prefix", () => {
      expect(() => decodeClaim("notatoken")).toThrow(/mirror claim/i);
    });

    it("should reject corrupt base64", () => {
      expect(() => decodeClaim(CLAIM_TOKEN_PREFIX + "@@@notbase64@@@")).toThrow();
    });

    it("should reject valid JSON missing required fields", async () => {
      const bad = Buffer.from(JSON.stringify({ foo: "bar" })).toString("base64");
      expect(() => decodeClaim(CLAIM_TOKEN_PREFIX + bad)).toThrow(/missing|required/i);
    });
  });

  describe("mergeNodeLists", () => {
    it("should dedupe identical claim ids", async () => {
      const { node } = await makeClaim();
      const merged = mergeNodeLists([node], [node]);
      expect(merged).toHaveLength(1);
    });

    it("should keep distinct claims from different operators", async () => {
      const a = (await makeClaim("onion", "aaa.onion")).node;
      const b = (await makeClaim("ipfs", "bafycid")).node;
      const merged = mergeNodeLists([a], [b]);
      expect(merged).toHaveLength(2);
    });

    it("should replace a stale claim for the same operator+endpoint with the newest", async () => {
      const key = await generateMirrorKey();
      const old = await createMirrorClaim(key, {
        transport: "onion",
        endpoint: "same.onion",
      });
      // force a later timestamp on the re-sign
      const newer = await createMirrorClaim(key, {
        transport: "onion",
        endpoint: "same.onion",
      });
      newer.ts = old.ts + 10000;
      newer.contentHash = "x".repeat(64); // still structurally a node

      const merged = mergeNodeLists([old], [newer]);
      expect(merged).toHaveLength(1);
      expect(merged[0].ts).toBe(newer.ts);
    });
  });

  describe("summarizeNetwork", () => {
    it("should count nodes by transport and unique operators", async () => {
      const k1 = await generateMirrorKey();
      const k2 = await generateMirrorKey();
      const nodes = [
        await createMirrorClaim(k1, { transport: "onion", endpoint: "a.onion" }),
        await createMirrorClaim(k1, { transport: "ipfs", endpoint: "cid1" }),
        await createMirrorClaim(k2, { transport: "onion", endpoint: "b.onion" }),
      ];
      const s = summarizeNetwork(nodes);
      expect(s.total).toBe(3);
      expect(s.byTransport.onion).toBe(2);
      expect(s.byTransport.ipfs).toBe(1);
      expect(s.uniqueOperators).toBe(2);
    });

    it("should handle an empty list", () => {
      const s = summarizeNetwork([]);
      expect(s.total).toBe(0);
      expect(s.uniqueOperators).toBe(0);
      expect(s.oldestTs).toBeNull();
    });
  });

  describe("verifyNodeList", () => {
    it("should report per-node validity", async () => {
      const good = (await makeClaim()).node;
      const tampered: MirrorNode = { ...good, endpoint: "hacked.onion" };
      const results = await verifyNodeList([good, tampered]);
      expect(results).toHaveLength(2);
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
    });
  });

  describe("exportNodeList / parseNodeList", () => {
    it("should round-trip a node list", async () => {
      const nodes = [(await makeClaim()).node, (await makeClaim("ipfs", "bafy123")).node];
      const json = exportNodeList(nodes);
      const parsed = parseNodeList(json);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual(nodes[0]);
    });

    it("should reject non-list documents", () => {
      expect(() => parseNodeList(JSON.stringify({ nope: true }))).toThrow();
    });
  });

  describe("computeManifestRoot", () => {
    it("should be order-independent", async () => {
      const entries = [
        { path: "z.html", size: 10, sha256: "a".repeat(64) },
        { path: "a.html", size: 20, sha256: "b".repeat(64) },
      ];
      const rootA = await computeManifestRoot(entries);
      const rootB = await computeManifestRoot([...entries].reverse());
      expect(rootA).toBe(rootB);
      expect(isValidSha256(rootA)).toBe(true);
    });
  });

  describe("helpers", () => {
    it("isValidSha256 / shortHash", () => {
      expect(isValidSha256("a".repeat(64))).toBe(true);
      expect(isValidSha256("nope")).toBe(false);
      expect(shortHash("abcdef1234567890")).toBe("abcdef12");
    });

    it("sameClaim compares id + contentHash", async () => {
      const { node } = await makeClaim();
      expect(sameClaim(node, { ...node })).toBe(true);
      expect(sameClaim(node, { ...node, contentHash: "z".repeat(64) })).toBe(false);
    });

    it("TRANSPORT_LABELS covers all transports", () => {
      for (const t of ["clearnet", "onion", "ipfs", "mesh", "usb"] as const) {
        expect(TRANSPORT_LABELS[t]).toBeTruthy();
      }
    });
  });
});
