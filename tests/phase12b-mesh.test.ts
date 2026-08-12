/**
 * Phase 12b — Message receipts + sealed-sender (mesh metadata minimization)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createReceipt,
  applyReceipt,
  getState,
  emptyStore,
  canTransition,
  summarizeReceipts,
  encodeReceiptToken,
  decodeReceiptToken,
  isReceiptToken,
  loadReceipts,
  saveReceipts,
  stateGlyph,
  stateLabel,
  RECEIPT_PREFIX,
} from "@/lib/message-receipts";
import { sealSender, openSealedMail, createSealedMail, sealedToMesh } from "@/lib/mesh-store";
import { detectToken } from "@/lib/tokens";

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};
vi.stubGlobal("localStorage", localStorageMock);

beforeEach(() => localStorage.clear());

describe("message receipts state machine", () => {
  it("creates a sent receipt by default", () => {
    const r = createReceipt("m1", "peerA");
    expect(r.state).toBe("sent");
    expect(r.messageId).toBe("m1");
  });

  it("throws without messageId", () => {
    expect(() => createReceipt("", "p")).toThrow();
  });

  it("canTransition allows forward progress and sent→failed", () => {
    expect(canTransition("sent", "delivered")).toBe(true);
    expect(canTransition("delivered", "read")).toBe(true);
    expect(canTransition("sent", "failed")).toBe(true);
    expect(canTransition("read", "sent")).toBe(false); // no downgrade
    expect(canTransition("read", "delivered")).toBe(false);
    expect(canTransition("failed", "delivered")).toBe(false); // failed terminal
    expect(canTransition("sent", "sent")).toBe(false);
  });

  it("applyReceipt upgrades state monotonically", () => {
    let s = emptyStore();
    s = applyReceipt(s, createReceipt("m1", "p", "sent"));
    expect(getState(s, "m1")).toBe("sent");
    s = applyReceipt(s, createReceipt("m1", "p", "delivered"));
    expect(getState(s, "m1")).toBe("delivered");
    s = applyReceipt(s, createReceipt("m1", "p", "read"));
    expect(getState(s, "m1")).toBe("read");
    // downgrade ignored
    s = applyReceipt(s, createReceipt("m1", "p", "delivered"));
    expect(getState(s, "m1")).toBe("read");
  });

  it("getState defaults to sent for unknown", () => {
    expect(getState(emptyStore(), "nope")).toBe("sent");
  });

  it("summarizeReceipts tallies states", () => {
    let s = emptyStore();
    s = applyReceipt(s, createReceipt("m1", "p", "sent"));
    s = applyReceipt(s, createReceipt("m2", "p", "delivered"));
    s = applyReceipt(s, createReceipt("m3", "p", "read"));
    s = applyReceipt(s, createReceipt("m4", "p", "failed"));
    const sum = summarizeReceipts(s);
    expect(sum.total).toBe(4);
    expect(sum.sent).toBe(1);
    expect(sum.delivered).toBe(1);
    expect(sum.read).toBe(1);
    expect(sum.failed).toBe(1);
    expect(sum.deliveryRate).toBeCloseTo(0.5, 5);
  });

  it("encodes and decodes receipt tokens", () => {
    const r = createReceipt("m1", "peerA", "delivered");
    const token = encodeReceiptToken(r);
    expect(token.startsWith(RECEIPT_PREFIX)).toBe(true);
    expect(isReceiptToken(token)).toBe(true);
    expect(detectToken(token)?.spec.id).toBe("VFXRC1");
    const decoded = decodeReceiptToken(token);
    expect(decoded.messageId).toBe("m1");
    expect(decoded.state).toBe("delivered");
  });

  it("decode throws on malformed", () => {
    expect(() => decodeReceiptToken("nope")).toThrow();
    expect(() => decodeReceiptToken("VFXRC1:!!!")).toThrow();
  });

  it("persists to localStorage", () => {
    let s = emptyStore();
    s = applyReceipt(s, createReceipt("m1", "p", "delivered"));
    saveReceipts(s);
    const loaded = loadReceipts();
    expect(getState(loaded, "m1")).toBe("delivered");
  });

  it("loadReceipts returns empty store when nothing saved", () => {
    expect(loadReceipts().byId.size).toBe(0);
  });

  it("stateGlyph and stateLabel render", () => {
    expect(stateGlyph("sent")).toBe("✓");
    expect(stateGlyph("read")).toContain("✓✓");
    expect(stateGlyph("failed")).toBe("!");
    expect(stateLabel("delivered")).toBe("Delivered");
  });
});

describe("sealed-sender metadata minimization", () => {
  it("round-trips a sealed message with the correct secret", async () => {
    const secret = "shared-ecdh-key-abc";
    const sealed = await sealSender(
      { from: "alice", body: "meet at dawn", kind: "chat" },
      secret,
      "peerB",
    );
    // the sealed blob reveals nothing about from/body
    expect(sealed.sealed).not.toContain("alice");
    expect(sealed.sealed).not.toContain("dawn");
    expect(sealed.to).toBe("peerB");

    const opened = await openSealedMail(sealed, secret);
    expect(opened.from).toBe("alice");
    expect(opened.body).toBe("meet at dawn");
    expect(opened.kind).toBe("chat");
  });

  it("wrong secret fails to unseal", async () => {
    const sealed = await sealSender(
      { from: "alice", body: "secret", kind: "chat" },
      "right-key",
      "peerB",
    );
    await expect(openSealedMail(sealed, "wrong-key")).rejects.toThrow();
  });

  it("createSealedMail builds from mesh routing fields", async () => {
    const sealed = await createSealedMail(
      { from: "alice", to: "peerB", body: "hi", kind: "alert" },
      "secret",
    );
    expect(sealed.to).toBe("peerB");
    expect(sealed.id).toBeTruthy();
    const opened = await openSealedMail(sealed, "secret");
    expect(opened.from).toBe("alice");
    expect(opened.kind).toBe("alert");
  });

  it("sealedToMesh produces a routable mesh message", async () => {
    const sealed = await sealSender(
      { from: "alice", body: "hi", kind: "relay" },
      "secret",
      "peerB",
    );
    const mesh = sealedToMesh(sealed);
    expect(mesh.to).toBe("peerB");
    expect(mesh.from).toBe("sealed"); // sender hidden from relays
    expect(mesh.body).toBe(sealed.sealed); // opaque blob
  });
});
