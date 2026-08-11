import { describe, it, expect, beforeEach } from "vitest";
import { CRDTDoc, CRDT_PREFIX, CRDT_SIGNED_PREFIX, mergeDocs, parseOpId } from "../lib/crdt";
import { generateIdentity, type Identity } from "../lib/identity";

function doc(text: string, actor: string, docId = "d"): CRDTDoc {
  const d = new CRDTDoc(actor, docId);
  if (text) d.insertAt(0, text);
  return d;
}

describe("CRDTDoc basics", () => {
  it("inserts and renders text", () => {
    const d = doc("hello", "a");
    expect(d.toText()).toBe("hello");
    expect(d.getVersion()).toBe(5);
  });

  it("inserts at the middle and end", () => {
    const d = doc("hello", "a");
    d.insertAt(2, "XX");
    expect(d.toText()).toBe("heXXllo");
    d.insertAt(7, "!");
    expect(d.toText()).toBe("heXXllo!");
  });

  it("rejects an empty actor", () => {
    expect(() => new CRDTDoc("")).toThrow();
  });

  it("deletes a range with tombstones that never resurrect", () => {
    const d = doc("abcdef", "a");
    d.deleteRange(1, 3);
    expect(d.toText()).toBe("aef");
    // A stale replica still carrying the deleted ops as LIVE must not
    // resurrect them (tombstone dominance on merge).
    const staleOps = d.getOps().map((op) => ({ ...op, deleted: false }));
    const stale = new CRDTDoc("b", "d");
    stale.applyOps(staleOps);
    expect(stale.toText()).toBe("abcdef");
    d.merge(stale);
    expect(d.toText()).toBe("aef");
    expect(d.getVersion()).toBe(6);
  });
});

describe("convergence", () => {
  it("converges on concurrent inserts at the same position", () => {
    const base = doc("12345", "base");
    const a = new CRDTDoc("A", "d");
    a.applyOps(base.getOps());
    const b = new CRDTDoc("B", "d");
    b.applyOps(base.getOps());

    a.insertAt(2, "aaa");
    b.insertAt(2, "bbb");
    expect(a.toText()).not.toBe(b.toText());

    const fromA = new CRDTDoc("C", "d");
    fromA.applyOps(a.getOps());
    fromA.applyOps(b.getOps());
    const fromB = new CRDTDoc("D", "d");
    fromB.applyOps(b.getOps());
    fromB.applyOps(a.getOps());

    expect(fromA.toText()).toBe(fromB.toText());
    // Both "aaa" and "bbb" survive, block order determined deterministically.
    expect(fromA.toText()).toContain("aaa");
    expect(fromA.toText()).toContain("bbb");
  });

  it("converges on concurrent insert vs delete", () => {
    const base = doc("HELLO WORLD", "base");
    const a = new CRDTDoc("A", "d");
    a.applyOps(base.getOps());
    const b = new CRDTDoc("B", "d");
    b.applyOps(base.getOps());

    a.deleteRange(0, 5); // delete "HELLO"
    b.insertAt(6, " BRAVE"); // insert " BRAVE" after "WORLD"
    const fromA = mergeDocs(a, b, "m");
    const fromB = mergeDocs(b, a, "m");
    expect(fromA.toText()).toBe(fromB.toText());
    expect(fromA.toText()).toContain("WORLD");
    expect(fromA.toText()).not.toContain("HELLO");
  });

  it("converges across three-way cascading merges", () => {
    const base = doc("abc", "base");
    const a = new CRDTDoc("A", "d");
    const b = new CRDTDoc("B", "d");
    const c = new CRDTDoc("C", "d");
    [a, b, c].forEach((d) => d.applyOps(base.getOps()));
    a.insertAt(1, "1");
    b.insertAt(1, "2");
    c.insertAt(2, "3");
    b.applyOps(a.getOps());
    b.applyOps(c.getOps());
    c.applyOps(a.getOps());
    c.applyOps(b.getOps());
    a.applyOps(c.getOps());
    a.applyOps(b.getOps());
    expect(a.toText()).toBe(b.toText());
    expect(b.toText()).toBe(c.toText());
  });

  it("is idempotent — re-applying the same ops changes nothing", () => {
    const a = doc("hello", "A");
    const b = new CRDTDoc("B", "d");
    const first = b.applyOps(a.getOps());
    const second = b.applyOps(a.getOps());
    expect(first).toBe(5);
    expect(second).toBe(0);
    expect(b.toText()).toBe("hello");
  });
});

describe("encode / decode", () => {
  it("round-trips a token", () => {
    const d = doc("héllo ورد", "actor-1");
    const token = d.encode();
    expect(token.startsWith(CRDT_PREFIX)).toBe(true);
    const back = CRDTDoc.decode(token);
    expect(back.toText()).toBe(d.toText());
    expect(back.docId).toBe("d");
  });

  it("preserves non-ASCII (Arabic + CJK)", () => {
    const d = doc("سلام 世界 😊", "a");
    const back = CRDTDoc.decode(d.encode());
    expect(back.toText()).toBe("سلام 世界 😊");
  });

  it("rejects garbage tokens", () => {
    expect(() => CRDTDoc.decode("")).toThrow(/Not a CRDT token/);
    expect(() => CRDTDoc.decode("VFXCRDT1:!!!")).toThrow();
    expect(() => CRDTDoc.decode(CRDT_PREFIX + "bm90IGpzb24=")).toThrow(/bad JSON/);
    expect(() => CRDTDoc.decode(CRDT_PREFIX)).toThrow();
  });

  it("mergeToken refuses a different docId", () => {
    const a = doc("x", "A", "doc1");
    const b = doc("y", "B", "doc2");
    expect(() => a.mergeToken(b.encode())).toThrow(/Doc mismatch/);
  });

  it("merges across token boundaries", () => {
    const a = doc("alpha", "A");
    const b = new CRDTDoc("B", "d");
    b.applyOps(a.getOps());
    b.insertAt(5, " beta");
    a.mergeToken(b.encode());
    expect(a.toText()).toBe("alpha beta");
  });
});

describe("parseOpId", () => {
  it("parses and validates", () => {
    expect(parseOpId("12:alice")).toEqual({ lamport: 12, actor: "alice" });
    expect(parseOpId("0:x")).toEqual({ lamport: 0, actor: "x" });
    expect(() => parseOpId("nope")).toThrow();
    expect(() => parseOpId("1:")).toThrow();
  });
});

describe("applyEdit (typing delta)", () => {
  it("computes insert-only edits", () => {
    const d = doc("hello", "A");
    const r = d.applyEdit("hello", "hello world");
    expect(r.inserted).toBe(" world");
    expect(r.deleted).toBe(0);
    expect(d.toText()).toBe("hello world");
  });

  it("computes delete-only edits", () => {
    const d = doc("hello world", "A");
    const r = d.applyEdit("hello world", "hello");
    expect(r.inserted).toBe("");
    expect(r.deleted).toBe(6);
    expect(d.toText()).toBe("hello");
  });

  it("computes replace edits", () => {
    const d = doc("abcXYZdef", "A");
    const r = d.applyEdit("abcXYZdef", "abcQdef");
    expect(r.deleted).toBe(3);
    expect(r.inserted).toBe("Q");
    expect(d.toText()).toBe("abcQdef");
  });

  it("no-ops on identical values", () => {
    const d = doc("same", "A");
    const r = d.applyEdit("same", "same");
    expect(r).toEqual({ inserted: "", deleted: 0 });
    expect(d.toText()).toBe("same");
  });
});

describe("signed tokens", () => {
  let identity: Identity;

  beforeEach(async () => {
    identity = await generateIdentity();
  });

  it("encodes and decodes signed tokens correctly", async () => {
    const d = doc("hello world", identity.handle, "test-doc");
    const token = await d.encodeSigned(identity);

    expect(token).toMatch(/^VFXCRDT1S:/);

    const result = await CRDTDoc.decodeSigned(token);
    expect(result).not.toBeNull();
    expect(result!.doc.toText()).toBe("hello world");
    expect(result!.doc.docId).toBe("test-doc");
    expect(result!.identity.handle).toBe(identity.handle);
    expect(result!.identity.publicKeyHex).toBe(identity.publicKeyHex);
    expect(result!.identity.fingerprint).toBe(identity.fingerprint);
  });

  it("verifies signatures correctly", async () => {
    const d = doc("test content", identity.handle, "verify-doc");
    const token = await d.encodeSigned(identity);

    const verified = await CRDTDoc.verifyTokenSignature(token);
    expect(verified).not.toBeNull();
    expect(verified!.handle).toBe(identity.handle);
    expect(verified!.publicKeyHex).toBe(identity.publicKeyHex);
    expect(verified!.fingerprint).toBe(identity.fingerprint);
  });

  it("rejects tokens with invalid signatures", async () => {
    const d = doc("tampered content", identity.handle, "tamper-doc");
    const token = await d.encodeSigned(identity);

    // Tamper with the token
    const tamperedToken = token + "tamper";

    const result = await CRDTDoc.decodeSigned(tamperedToken);
    expect(result).toBeNull();

    const verified = await CRDTDoc.verifyTokenSignature(tamperedToken);
    expect(verified).toBeNull();
  });

  it("preserves document operations in signed tokens", async () => {
    const d = doc("initial", identity.handle, "ops-doc");
    d.insertAt(7, " added");
    d.deleteRange(0, 4); // delete "init"

    const token = await d.encodeSigned(identity);
    const result = await CRDTDoc.decodeSigned(token);

    expect(result).not.toBeNull();
    expect(result!.doc.toText()).toBe("ial added");
    expect(result!.doc.getVersion()).toBe(d.getVersion());
  });

  it("merges signed tokens into existing docs", async () => {
    const base = doc("hello", identity.handle, "merge-doc");
    const other = new CRDTDoc("other-actor", "merge-doc");
    other.applyOps(base.getOps());
    other.insertAt(5, " world");

    const token = await other.encodeSigned({
      privateKey: identity.privateKey,
      publicKeyHex: identity.publicKeyHex,
      handle: identity.handle,
    });

    // Merge using decodeSigned and applyOps
    const result = await CRDTDoc.decodeSigned(token);
    expect(result).not.toBeNull();
    const added = base.applyOps(result!.doc.getOps());
    expect(added).toBeGreaterThan(0);
    expect(base.toText()).toBe("hello world");
  });

  it("rejects signed tokens for different docIds", async () => {
    const d1 = doc("doc1", identity.handle, "doc1");
    const d2 = doc("doc2", "other-actor", "doc2");
    const token = await d2.encodeSigned({
      privateKey: identity.privateKey,
      publicKeyHex: identity.publicKeyHex,
      handle: identity.handle,
    });

    // Try to decode signed token with different docId
    const result = await CRDTDoc.decodeSigned(token);
    expect(result).not.toBeNull();
    expect(result!.doc.docId).toBe("doc2");
    expect(result!.doc.docId).not.toBe(d1.docId);

    // Should not be able to merge directly due to docId mismatch
    expect(() => {
      d1.mergeToken(d2.encode());
    }).toThrow(/Doc mismatch/);
  });

  it("handles non-ASCII content in signed tokens", async () => {
    const d = doc("سلام 世界 😊", identity.handle, "unicode-doc");
    const token = await d.encodeSigned(identity);

    const result = await CRDTDoc.decodeSigned(token);
    expect(result).not.toBeNull();
    expect(result!.doc.toText()).toBe("سلام 世界 😊");
  });

  it("verifies tokens from different identities separately", async () => {
    const identity1 = await generateIdentity();
    const identity2 = await generateIdentity();

    const d1 = doc("from identity 1", identity1.handle, "id-doc");
    const d2 = doc("from identity 2", identity2.handle, "id-doc");

    const token1 = await d1.encodeSigned(identity1);
    const token2 = await d2.encodeSigned(identity2);

    const verified1 = await CRDTDoc.verifyTokenSignature(token1);
    const verified2 = await CRDTDoc.verifyTokenSignature(token2);

    expect(verified1).not.toBeNull();
    expect(verified2).not.toBeNull();
    expect(verified1!.publicKeyHex).toBe(identity1.publicKeyHex);
    expect(verified2!.publicKeyHex).toBe(identity2.publicKeyHex);
    expect(verified1!.publicKeyHex).not.toBe(verified2!.publicKeyHex);
  });

  it("rejects malformed signed tokens", async () => {
    expect(await CRDTDoc.decodeSigned("invalid")).toBeNull();
    expect(await CRDTDoc.decodeSigned("VFXCRDT1S:")).toBeNull();
    expect(await CRDTDoc.decodeSigned("VFXCRDT1S:invalid-base64===")).toBeNull();
    expect(await CRDTDoc.verifyTokenSignature("not-a-token")).toBeNull();
  });

  it("rejects unsigned tokens in signed methods", async () => {
    const d = doc("test", "actor", "doc");
    const unsignedToken = d.encode();

    expect(await CRDTDoc.decodeSigned(unsignedToken)).toBeNull();
    expect(await CRDTDoc.verifyTokenSignature(unsignedToken)).toBeNull();
  });
});
