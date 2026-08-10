import { describe, it, expect } from "vitest";
import {
  generateECDHIdentity,
  importPublicKey,
  deriveSharedKey,
  encryptWithSharedKey,
  decryptWithSharedKey,
  exportECDHIdentity,
  parseECDHIdentity,
} from "../lib/ecdh";

describe("generateECDHIdentity", () => {
  it("produces an identity with a handle and public key", async () => {
    const km = await generateECDHIdentity();
    expect(km.identity.handle).toMatch(/^V-/);
    expect(km.identity.publicKeyHex).toMatch(/^[0-9a-f]{130}$/);
    expect(km.identity.createdAt).toBeGreaterThan(0);
  });

  it("generates unique keypairs", async () => {
    const a = await generateECDHIdentity();
    const b = await generateECDHIdentity();
    expect(a.identity.publicKeyHex).not.toBe(b.identity.publicKeyHex);
  });
});

describe("importPublicKey", () => {
  it("imports a valid hex public key", async () => {
    const km = await generateECDHIdentity();
    const key = await importPublicKey(km.identity.publicKeyHex);
    expect(key).toBeDefined();
    expect(key.type).toBe("public");
  });
});

describe("deriveSharedKey", () => {
  it("produces the same shared key for both parties", async () => {
    const alice = await generateECDHIdentity();
    const bob = await generateECDHIdentity();

    const aliceChannel = await deriveSharedKey(alice.privateKey, bob.identity.publicKeyHex);
    const bobChannel = await deriveSharedKey(bob.privateKey, alice.identity.publicKeyHex);

    expect(aliceChannel.fingerprint).toBe(bobChannel.fingerprint);
  });

  it("produces a 32-char fingerprint", async () => {
    const alice = await generateECDHIdentity();
    const bob = await generateECDHIdentity();
    const channel = await deriveSharedKey(alice.privateKey, bob.identity.publicKeyHex);
    expect(channel.fingerprint).toMatch(/^[0-9a-f]{32}$/);
  });

  it("produces different channels for different pairs", async () => {
    const alice = await generateECDHIdentity();
    const bob = await generateECDHIdentity();
    const carol = await generateECDHIdentity();

    const ab = await deriveSharedKey(alice.privateKey, bob.identity.publicKeyHex);
    const ac = await deriveSharedKey(alice.privateKey, carol.identity.publicKeyHex);
    expect(ab.fingerprint).not.toBe(ac.fingerprint);
  });
});

describe("encryptWithSharedKey + decryptWithSharedKey", () => {
  it("round-trips a message between two parties", async () => {
    const alice = await generateECDHIdentity();
    const bob = await generateECDHIdentity();

    const aliceChannel = await deriveSharedKey(alice.privateKey, bob.identity.publicKeyHex);
    const bobChannel = await deriveSharedKey(bob.privateKey, alice.identity.publicKeyHex);

    const { ciphertext, iv } = await encryptWithSharedKey(aliceChannel, "Secret dead drop message");
    const plaintext = await decryptWithSharedKey(bobChannel, ciphertext, iv);

    expect(plaintext).toBe("Secret dead drop message");
  });

  it("produces different ciphertexts for the same plaintext (random IV)", async () => {
    const alice = await generateECDHIdentity();
    const bob = await generateECDHIdentity();
    const channel = await deriveSharedKey(alice.privateKey, bob.identity.publicKeyHex);

    const a = await encryptWithSharedKey(channel, "same");
    const b = await encryptWithSharedKey(channel, "same");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("handles unicode", async () => {
    const alice = await generateECDHIdentity();
    const bob = await generateECDHIdentity();
    const aCh = await deriveSharedKey(alice.privateKey, bob.identity.publicKeyHex);
    const bCh = await deriveSharedKey(bob.privateKey, alice.identity.publicKeyHex);
    const { ciphertext, iv } = await encryptWithSharedKey(aCh, "مرحبا 🌍");
    expect(await decryptWithSharedKey(bCh, ciphertext, iv)).toBe("مرحبا 🌍");
  });
});

describe("exportECDHIdentity + parseECDHIdentity", () => {
  it("round-trips through JSON", async () => {
    const km = await generateECDHIdentity();
    const exported = exportECDHIdentity(km.identity);
    const parsed = parseECDHIdentity(exported);
    expect(parsed).not.toBeNull();
    expect(parsed!.handle).toBe(km.identity.handle);
    expect(parsed!.publicKeyHex).toBe(km.identity.publicKeyHex);
  });

  it("returns null for invalid input", () => {
    expect(parseECDHIdentity("not json")).toBeNull();
    expect(parseECDHIdentity("{}")).toBeNull();
  });
});
