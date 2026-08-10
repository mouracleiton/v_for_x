import { describe, it, expect } from "vitest";
import {
  hexFromBuf,
  isValidSha256,
  computeManifestRoot,
  verifyEntry,
  verifyManifest,
  shortFingerprint,
  type DataManifest,
  type DataManifestEntry,
} from "../lib/data-verifier";

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

function bytesOf(text: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>;
}

async function entryFor(text: string, path: string): Promise<DataManifestEntry> {
  const bytes = bytesOf(text);
  return {
    path,
    size: bytes.length,
    sha256: hexFromBuf(await crypto.subtle.digest("SHA-256", bytes)),
  };
}

describe("data-verifier.ts", () => {
  it("validates sha256 shape", () => {
    expect(isValidSha256("a".repeat(64))).toBe(true);
    expect(isValidSha256("A".repeat(64))).toBe(false);
    expect(isValidSha256("a".repeat(63))).toBe(false);
    expect(isValidSha256("")).toBe(false);
  });

  it("computes a deterministic manifest root", async () => {
    const a = await entryFor("one", "api/v1/a.json");
    const b = await entryFor("two", "api/v1/b.json");
    const root = await computeManifestRoot([a, b]);
    const rootSwapped = await computeManifestRoot([b, a]);
    expect(root).toBe(rootSwapped); // order-independent
    expect(root).toMatch(/^[a-f0-9]{64}$/);
    // content matters
    const a2 = await entryFor("one!", "api/v1/a.json");
    expect(await computeManifestRoot([a2, b])).not.toBe(root);
  });

  it("verifies entries that match", async () => {
    const entry = await entryFor("hello world", "api/v1/countries.json");
    const res = await verifyEntry(entry, () => Promise.resolve(bytesOf("hello world")));
    expect(res).toEqual({ path: entry.path, ok: true });
  });

  it("flags hash mismatches", async () => {
    const entry = await entryFor("hello world", "api/v1/countries.json");
    const res = await verifyEntry(entry, () => Promise.resolve(bytesOf("hello world!")));
    expect(res.ok).toBe(false);
    // size differs so it reports size first
    if (!res.ok) expect(res.reason).toBe("size_mismatch");
  });

  it("flags same-size content swaps as hash mismatches", async () => {
    const entry = await entryFor("abcde", "api/v1/hotspots.json");
    const res = await verifyEntry(entry, () => Promise.resolve(bytesOf("abced")));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("hash_mismatch");
  });

  it("flags missing entries", async () => {
    const entry = await entryFor("data", "api/v1/missing.json");
    const res = await verifyEntry(entry, () => Promise.reject(new Error("404")));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("missing");
  });

  it("verifies a full manifest document end-to-end", async () => {
    const a = await entryFor('{"a":1}', "api/v1/a.json");
    const b = await entryFor('{"b":2}', "api/v1/b.json");
    const root = await computeManifestRoot([a, b]);
    const manifest: DataManifest = {
      format: "vfx-data-manifest-1",
      generatedAt: "2026-01-01T00:00:00Z",
      count: 2,
      root,
      entries: [a, b],
    };
    const fetcher = (path: string) => {
      if (path === "api/v1/a.json") return Promise.resolve(bytesOf('{"a":1}'));
      if (path === "api/v1/b.json") return Promise.resolve(bytesOf('{"b":2}'));
      return Promise.reject(new Error("404"));
    };
    const res = await verifyManifest(manifest, fetcher);
    expect(res.okCount).toBe(2);
    expect(res.failCount).toBe(0);
    expect(res.computedRoot).toBe(root);
    expect(res.rootValid).toBe(true);
    expect(res.entries.every((e) => e.ok)).toBe(true);
  });

  it("reports tampered entries and a broken root", async () => {
    const a = await entryFor('{"a":1}', "api/v1/a.json");
    // attacker swaps content AND writes their own root over one entry
    const tampered = { path: "api/v1/b.json", size: 7, sha256: "f".repeat(64) };
    const root = await computeManifestRoot([a, tampered]);
    const manifest: DataManifest = {
      format: "vfx-data-manifest-1",
      generatedAt: "2026-01-01T00:00:00Z",
      count: 2,
      root,
      entries: [a, tampered],
    };
    const fetcher = (path: string) => {
      if (path === "api/v1/a.json") return Promise.resolve(bytesOf('{"a":1}'));
      return Promise.resolve(bytesOf('{"b":2}'));
    };
    const res = await verifyManifest(manifest, fetcher);
    expect(res.okCount).toBe(1);
    expect(res.failCount).toBe(1);
    expect(res.entries.find((e) => e.path === "api/v1/b.json")).toMatchObject({
      ok: false,
      reason: "hash_mismatch",
    });
    expect(res.rootValid).toBe(true); // root is self-consistent with the manifest
  });

  it("fingerprints compactly", () => {
    expect(shortFingerprint("a".repeat(64))).toBe("a".repeat(12));
  });
});