import { describe, it, expect } from "vitest";
import {
  initRatchet,
  ratchetEncrypt,
  ratchetDecrypt,
  exportRatchetState,
  importRatchetState,
} from "../lib/ratchet";

describe("initRatchet", () => {
  it("produces a state with a 64-char chain key", async () => {
    const state = await initRatchet("shared-secret-123");
    expect(state.chainKey).toMatch(/^[0-9a-f]{64}$/);
    expect(state.counter).toBe(0);
    expect(state.totalMessages).toBe(0);
  });

  it("produces different states for different secrets", async () => {
    const a = await initRatchet("secret-a");
    const b = await initRatchet("secret-b");
    expect(a.chainKey).not.toBe(b.chainKey);
  });

  it("produces the same state for the same secret", async () => {
    const a = await initRatchet("same-secret");
    const b = await initRatchet("same-secret");
    expect(a.chainKey).toBe(b.chainKey);
  });
});

describe("ratchetEncrypt + ratchetDecrypt", () => {
  it("encrypts and decrypts a message round-trip", async () => {
    const secret = "test-shared-secret";
    const senderState = await initRatchet(secret);
    const receiverState = await initRatchet(secret);

    const { message, newState: senderNew } = await ratchetEncrypt(senderState, "Hello, world!");
    const { plaintext, newState: receiverNew } = await ratchetDecrypt(receiverState, message);

    expect(plaintext).toBe("Hello, world!");
    expect(senderNew.counter).toBe(1);
    expect(receiverNew.counter).toBe(1);
  });

  it("handles multiple sequential messages", async () => {
    const secret = "multi-message-test";
    let senderState = await initRatchet(secret);
    let receiverState = await initRatchet(secret);

    for (let i = 0; i < 5; i++) {
      const msg = `Message ${i}`;
      const { message, newState: sNew } = await ratchetEncrypt(senderState, msg);
      const { plaintext, newState: rNew } = await ratchetDecrypt(receiverState, message);
      expect(plaintext).toBe(msg);
      senderState = sNew;
      receiverState = rNew;
    }

    expect(senderState.totalMessages).toBe(5);
    expect(receiverState.totalMessages).toBe(5);
  });

  it("produces different ciphertexts for the same plaintext", async () => {
    const state = await initRatchet("unique-test");
    const { message: msg1 } = await ratchetEncrypt(state, "same text");
    const state2 = await initRatchet("unique-test");
    const { message: msg2 } = await ratchetEncrypt(state2, "same text");
    // Different IVs should produce different ciphertexts
    expect(msg1.iv).not.toBe(msg2.iv);
    expect(msg1.ciphertext).not.toBe(msg2.ciphertext);
  });

  it("advances the chain key after each message", async () => {
    let state = await initRatchet("chain-test");
    const key1 = state.chainKey;
    const { newState } = await ratchetEncrypt(state, "test");
    expect(newState.chainKey).not.toBe(key1);
  });

  it("handles empty plaintext", async () => {
    const sender = await initRatchet("empty-test");
    const receiver = await initRatchet("empty-test");
    const { message } = await ratchetEncrypt(sender, "");
    const { plaintext } = await ratchetDecrypt(receiver, message);
    expect(plaintext).toBe("");
  });

  it("handles unicode and special characters", async () => {
    const sender = await initRatchet("unicode-test");
    const receiver = await initRatchet("unicode-test");
    const text = "Привет мир 🌍 مرحبا";
    const { message } = await ratchetEncrypt(sender, text);
    const { plaintext } = await ratchetDecrypt(receiver, message);
    expect(plaintext).toBe(text);
  });
});

describe("export/import ratchet state", () => {
  it("round-trips through export and import", async () => {
    const state = await initRatchet("export-test");
    state.counter = 5;
    state.totalMessages = 5;
    const exported = exportRatchetState(state);
    const imported = importRatchetState(exported);
    expect(imported).not.toBeNull();
    expect(imported!.chainKey).toBe(state.chainKey);
    expect(imported!.counter).toBe(5);
    expect(imported!.totalMessages).toBe(5);
  });

  it("returns null for invalid input", () => {
    expect(importRatchetState("not json")).toBeNull();
    expect(importRatchetState("{}")).toBeNull();
    expect(importRatchetState('{"chainKey":"abc"}')).toBeNull();
  });
});
