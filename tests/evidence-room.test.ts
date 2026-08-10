import { describe, it, expect } from "vitest";
import {
  hashBytes,
  recordItems,
  makeEvidenceRecord,
  hashChainId,
  verifyEvidenceRecord,
  verifyEvidenceChain,
  rechainRecords,
  sealWithZK,
  exportEvidenceBundle,
  parseEvidenceBundle,
  formatEvidenceReport,
  EVIDENCE_BUNDLE_PREFIX,
  type EvidenceRecord,
} from "../lib/evidence-room";
import { verifySetMembership } from "../lib/zk";
import { GENESIS_HASH } from "../lib/dag";

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

/** SHA-256 of empty input — known vector. */
const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

async function sealChain(n: number): Promise<EvidenceRecord[]> {
  const records: EvidenceRecord[] = [];
  for (let i = 0; i < n; i++) {
    const items = await recordItems(
      [utf8(`payload-${i}`)],
      [`file-${i}.bin`],
      ["application/octet-stream"],
    );
    const rec = makeEvidenceRecord(
      {
        id: `rec-${i}`,
        iso3: "SDN",
        claim: `CLAIM ${i}`,
        subject: "SUBJECT",
        items,
        sealedAt: 1000 + i,
      },
      records.length ? records[records.length - 1].hash : GENESIS_HASH,
    );
    records.push(rec);
  }
  return records;
}

describe("hashBytes", () => {
  it("matches the known SHA-256 vector for 'abc'", async () => {
    const h = await hashBytes(utf8("abc"));
    expect(h).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("matches the known SHA-256 of empty input", async () => {
    expect(await hashBytes(new Uint8Array(0))).toBe(EMPTY_SHA256);
    expect(await hashBytes(new ArrayBuffer(0))).toBe(EMPTY_SHA256);
  });

  it("always returns 64 lowercase hex chars", async () => {
    const h = await hashBytes(utf8("anything at all"));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("recordItems", () => {
  it("hashes each byte array and captures metadata", async () => {
    const items = await recordItems(
      [utf8("one"), utf8("two")],
      ["a.txt", "b.txt"],
      ["text/plain", "text/plain"],
    );
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe("a.txt");
    expect(items[0].mime).toBe("text/plain");
    expect(items[0].size).toBe(3);
    expect(items[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(items[0].sha256).toBe(await hashBytes(utf8("one")));
    expect(items[1].sha256).toBe(await hashBytes(utf8("two")));
    expect(items[0].capturedAt).toBeGreaterThan(0);
    expect(items[0].id).not.toBe(items[1].id);
  });

  it("falls back on missing mime type", async () => {
    const items = await recordItems([utf8("x")], ["x.raw"], [""]);
    expect(items[0].mime).toBe("application/octet-stream");
  });

  it("throws on length mismatch", async () => {
    await expect(recordItems([utf8("x")], ["a", "b"], ["t"])).rejects.toThrow("length mismatch");
  });

  it("handles non-ASCII filenames and content — bytes are bytes", async () => {
    const items = await recordItems(
      [utf8("héllo 世界 🔥 עדות")],
      ["עדות מצולמת.txt", "证据.bin"].slice(0, 1),
      ["text/plain"],
    );
    expect(items[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(items[0].name).toBe("עדות מצולמת.txt");
    expect(await hashBytes(utf8("héllo 世界 🔥 עדות"))).toBe(items[0].sha256);
  });
});

describe("makeEvidenceRecord", () => {
  it("produces a deterministic hash for fixed content", async () => {
    const items = await recordItems([utf8("alpha")], ["a.txt"], ["text/plain"]);
    const make = () =>
      makeEvidenceRecord(
        { id: "rec-fixed", iso3: "SDN", claim: "CLAIM", subject: "SUBJECT", items, sealedAt: 1234 },
        GENESIS_HASH,
      );
    expect(make().hash).toBe(make().hash);
    expect(make().hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is stable across item-input order (canonical sort by id)", async () => {
    const a = await recordItems([utf8("x"), utf8("y")], ["1.txt", "2.txt"], ["text/plain", "text/plain"]);
    const ra = makeEvidenceRecord({ id: "r1", iso3: "SDN", claim: "C", subject: "S", items: a, sealedAt: 5 }, GENESIS_HASH);
    const rb = makeEvidenceRecord({ id: "r1", iso3: "SDN", claim: "C", subject: "S", items: [...a].reverse(), sealedAt: 5 }, GENESIS_HASH);
    expect(ra.hash).toBe(rb.hash);
  });

  it("seals the first record against genesis", async () => {
    const rec = (await sealChain(1))[0];
    expect(rec.prevHash).toBe(GENESIS_HASH);
    expect(verifyEvidenceRecord(rec)).toBe(true);
  });

  it("chains subsequent records to the previous hash", async () => {
    const rec = (await sealChain(2))[1];
    expect(rec.prevHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("verifyEvidenceRecord", () => {
  it("rejects tampered content after sealing", async () => {
    const [rec] = await sealChain(1);
    const tampered = { ...rec, claim: "REWRITTEN CLAIM" };
    expect(verifyEvidenceRecord(rec)).toBe(true);
    expect(verifyEvidenceRecord(tampered)).toBe(false);
  });

  it("rejects an item whose sha256 differs from a known hash", async () => {
    const [rec] = await sealChain(1);
    const known: Record<string, string> = {};
    for (const it of rec.items) known[it.id] = "f".repeat(64);
    expect(verifyEvidenceRecord(rec, known)).toBe(false);
    expect(verifyEvidenceRecord(rec, {})).toBe(true);
  });
});

describe("verifyEvidenceChain", () => {
  it("passes for a correct 3-record chain", async () => {
    const chain = await sealChain(3);
    const report = verifyEvidenceChain(chain);
    expect(report.rootOk).toBe(true);
    expect(report.links).toHaveLength(3);
    for (const link of report.links) expect(link.ok).toBe(true);
  });

  it("passes with an empty-string first prevHash (documented root)", async () => {
    const items = await recordItems([utf8("z")], ["z.txt"], ["text/plain"]);
    const rec = makeEvidenceRecord({ id: "rec-g0", iso3: "SDN", claim: "C", subject: "S", items, sealedAt: 1 }, "");
    expect(verifyEvidenceChain([rec]).rootOk).toBe(true);
  });

  it("reports the exact broken link when a middle record hash is tampered", async () => {
    const chain = await sealChain(3);
    const tampered = [...chain];
    tampered[1] = { ...tampered[1], hash: "f".repeat(64) };
    const report = verifyEvidenceChain(tampered);
    expect(report.rootOk).toBe(false);
    expect(report.links[0].ok).toBe(true);
    expect(report.links[1].ok).toBe(false);
    expect(report.links[1].id).toBe("rec-1");
    expect(report.links[1].reason).toContain("HASH MISMATCH");
    expect(report.links[2].ok).toBe(false);
  });

  it("reports a broken link when prevHash is tampered", async () => {
    const chain = await sealChain(3);
    const reSealed = makeEvidenceRecord(
      { id: chain[2].id, iso3: chain[2].iso3, claim: chain[2].claim, subject: chain[2].subject, items: chain[2].items, sealedAt: chain[2].sealedAt },
      "b".repeat(64),
    );
    const report = verifyEvidenceChain([chain[0], chain[1], reSealed]);
    expect(report.rootOk).toBe(false);
    expect(report.links[0].ok).toBe(true);
    expect(report.links[1].ok).toBe(true);
    expect(report.links[2].ok).toBe(false);
    expect(report.links[2].reason).toContain("BROKEN LINK");
  });

  it("rejects a first record that does not link to genesis", async () => {
    const chain = await sealChain(1);
    const misRooted = makeEvidenceRecord(
      { id: chain[0].id, iso3: chain[0].iso3, claim: chain[0].claim, subject: chain[0].subject, items: chain[0].items, sealedAt: chain[0].sealedAt },
      "c".repeat(64),
    );
    const report = verifyEvidenceChain([misRooted]);
    expect(report.rootOk).toBe(false);
    expect(report.links[0].reason).toContain("GENESIS");
  });

  it("treats an empty chain as intact", async () => {
    expect(verifyEvidenceChain([]).rootOk).toBe(true);
    expect(verifyEvidenceChain([]).links).toEqual([]);
  });
});

describe("hashChainId", () => {
  it("changes when any record changes (re-sealed content)", async () => {
    const chain = await sealChain(3);
    const root = hashChainId(chain);
    const altered = makeEvidenceRecord(
      { id: chain[1].id, iso3: chain[1].iso3, claim: chain[1].claim, subject: "ALTERED", items: chain[1].items, sealedAt: chain[1].sealedAt },
      chain[0].hash,
    );
    const tampered = [...chain];
    tampered[1] = altered;
    expect(hashChainId(tampered)).not.toBe(root);
  });

  it("is stable for a fixed chain", async () => {
    const chain = await sealChain(2);
    expect(hashChainId(chain)).toBe(hashChainId(chain));
  });
});

describe("rechainRecords", () => {
  it("is a no-op when records already link to the base", async () => {
    const chain = await sealChain(3);
    const re = rechainRecords(chain, GENESIS_HASH);
    expect(re.map((r) => r.hash)).toEqual(chain.map((r) => r.hash));
  });

  it("relinks an imported chain onto a new base and verifies", async () => {
    const local = await sealChain(1);
    const imported = await sealChain(2); // starts at genesis
    const merged = [...local, ...rechainRecords(imported, local[local.length - 1].hash)];
    const report = verifyEvidenceChain(merged);
    expect(report.rootOk).toBe(true);
    expect(merged[1].prevHash).toBe(local[0].hash);
  });
});

describe("exportEvidenceBundle / parseEvidenceBundle", () => {
  it("roundtrips a chain losslessly", async () => {
    const chain = await sealChain(3);
    const token = exportEvidenceBundle(chain);
    expect(token.startsWith(EVIDENCE_BUNDLE_PREFIX)).toBe(true);
    const parsed = parseEvidenceBundle(token);
    expect(parsed).toEqual(chain);
    expect(verifyEvidenceChain(parsed).rootOk).toBe(true);
  });

  it("roundtrips ZK-sealed records", async () => {
    const chain = await sealChain(1);
    const sealed = await sealWithZK(chain[0], "I CORROBORATE THE CHAIN", [chain[0].hash]);
    const parsed = parseEvidenceBundle(exportEvidenceBundle([sealed]));
    expect(parsed[0].zk).toBeDefined();
    expect(parsed[0].zk?.claim).toBe("I CORROBORATE THE CHAIN");
    expect(await verifySetMembership(parsed[0].zk!, [parsed[0].hash])).toBe(true);
  });

  it("roundtrips non-ASCII names", async () => {
    const items = await recordItems([utf8("עדות 🔥")], ["עדות מצולמת.txt"], ["text/plain"]);
    const rec = makeEvidenceRecord({ id: "rec-u", iso3: "HTI", claim: "C", subject: "S", items, sealedAt: 9 }, GENESIS_HASH);
    const parsed = parseEvidenceBundle(exportEvidenceBundle([rec]));
    expect(parsed[0].items[0].name).toBe("עדות מצולמת.txt");
    expect(parsed[0].items[0].sha256).toBe(items[0].sha256);
  });

  it("rejects a missing prefix", () => {
    expect(() => parseEvidenceBundle("not-a-bundle")).toThrow(/prefix/);
    expect(() => parseEvidenceBundle("")).toThrow(/prefix/);
  });

  it("rejects corrupt base64url", () => {
    expect(() => parseEvidenceBundle(EVIDENCE_BUNDLE_PREFIX + "%%%not base64%%%")).toThrow(/base64url/);
  });

  it("rejects corrupt JSON payload", () => {
    const b64 = Buffer.from("this is not json").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(() => parseEvidenceBundle(EVIDENCE_BUNDLE_PREFIX + b64)).toThrow(/JSON/);
  });

  it("rejects non-array payload", async () => {
    const b64 = Buffer.from('{"not":"array"}').toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(() => parseEvidenceBundle(EVIDENCE_BUNDLE_PREFIX + b64)).toThrow(/not a record array/);
  });

  it("rejects records with missing fields", async () => {
    const b64 = Buffer.from(JSON.stringify([{ id: "x" }])).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(() => parseEvidenceBundle(EVIDENCE_BUNDLE_PREFIX + b64)).toThrow(/missing required fields/);
  });
});

describe("sealWithZK", () => {
  it("creates a verifiable commitment per zk.ts semantics", async () => {
    const chain = await sealChain(2);
    const target = chain[1];
    const validSet = chain.map((r) => r.hash);
    const sealed = await sealWithZK(target, "I HOLD PRIMARY SOURCE MATERIAL", validSet);
    expect(sealed.zk).toBeDefined();
    expect(sealed.zk!.commitment).toHaveLength(64);
    expect(await verifySetMembership(sealed.zk!, validSet)).toBe(true);
    expect(sealed.hash).toBe(target.hash);
    expect(verifyEvidenceRecord(sealed)).toBe(true);
  });

  it("fails verification when the set changes", async () => {
    const [rec] = await sealChain(1);
    const sealed = await sealWithZK(rec, "I WAS PRESENT AT THE EVENT", [rec.hash]);
    expect(await verifySetMembership(sealed.zk!, ["other".repeat(8).slice(0, 64)])).toBe(false);
  });

  it("fails verification with a tampered challenge", async () => {
    const [rec] = await sealChain(1);
    const sealed = await sealWithZK(rec, "I CORROBORATE THE CHAIN", [rec.hash]);
    const tampered = { ...sealed.zk!, challenge: "0".repeat(64) };
    expect(await verifySetMembership(tampered, [rec.hash])).toBe(false);
  });

  it("throws when the record hash is not in the valid set", async () => {
    const [rec] = await sealChain(1);
    await expect(sealWithZK(rec, "I HOLD PRIMARY SOURCE MATERIAL", ["f".repeat(64)])).rejects.toThrow("not in the valid set");
  });
});

describe("formatEvidenceReport", () => {
  it("renders a monospace report with chain root and per-item lines", async () => {
    const chain = await sealChain(2);
    const report = formatEvidenceReport(chain);
    expect(report).toContain("THE EVIDENCE ROOM — CHAIN REPORT");
    expect(report).toContain("INTACT");
    expect(report).toContain("Chain Root:");
    expect(report).toContain("rec-0");
    expect(report).toContain("rec-1");
    expect(report).toContain("SHA-256");
    expect(report).toContain("GENESIS");
  });

  it("reports compromised chains", async () => {
    const chain = await sealChain(2);
    chain[1] = { ...chain[1], prevHash: "d".repeat(64) };
    expect(formatEvidenceReport(chain)).toContain("COMPROMISED");
    expect(formatEvidenceReport(chain)).toContain("BROKEN");
  });
});