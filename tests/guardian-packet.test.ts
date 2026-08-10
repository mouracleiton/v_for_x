import { describe, it, expect } from "vitest";
import {
  armGuardian,
  checkIn,
  triggerPanic,
  type GuardianRecord,
  type TrustedContact,
  type LocationData,
} from "../lib/guardian";
import {
  GUARDIAN_PACKET_PREFIX,
  createGuardianSigningKey,
  buildReleasePacket,
  verifyReleasePacket,
  encodeReleasePacket,
  decodeReleasePacket,
  buildPacketUrl,
  parseHashPacket,
  packetFingerprint,
  type GuardianSigningKey,
} from "../lib/guardian-packet";

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

const CONTACTS: TrustedContact[] = [
  { id: "c1", label: "Editor", handle: "signal-editor", escalateAfterMin: 0 },
  { id: "c2", label: "Lawyer", handle: "proton-lawyer", escalateAfterMin: 60 },
];

const LOC: LocationData = { lat: -33.8688, lng: 151.2093, accuracy: 25, note: "safehouse 3" };

async function armed(): Promise<GuardianRecord> {
  return armGuardian("correct-horse-battery", {
    label: "Maria — Beirut bureau",
    checkInHours: 12,
    contacts: CONTACTS,
    escalationMessage: "I may have been detained. Contact the hotline.",
    safeCode: "sunrise",
    duressCode: "harvest",
  });
}

describe("guardian-packet.ts", () => {
  it("creates a signing key", async () => {
    const key = await createGuardianSigningKey();
    expect(key.publicKey).toBeTruthy();
    expect(key.privateKey).toBeTruthy();
    expect(key.publicKey).not.toBe(key.privateKey);
  });

  it("builds a signed packet for an armed guardian", async () => {
    const record = await armed();
    const key = await createGuardianSigningKey();
    const packet = await buildReleasePacket(record, key, LOC, Date.now());

    expect(packet.format).toBe("vfx-guardian-release-1");
    expect(packet.id).toBe(record.id);
    expect(packet.label).toBe("Maria — Beirut bureau");
    expect(packet.status).toBe("armed");
    expect(packet.escalations).toEqual([]);
    // Location stays encrypted — never plaintext in the packet
    expect(packet.location).toBe(record.location);
    expect(packet.location).toBeNull();
    expect(packet.message).toContain("Maria — Beirut bureau");
    expect(packet.signature).toBeTruthy();
    expect(packet.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verifies a genuine packet", async () => {
    const record = await armed();
    const key = await createGuardianSigningKey();
    const packet = await buildReleasePacket(record, key, LOC);
    expect(await verifyReleasePacket(packet)).toBe(true);
    expect(await verifyReleasePacket(packet, key.publicKey)).toBe(true);
  });

  it("rejects packets signed by a different key", async () => {
    const record = await armed();
    const key = await createGuardianSigningKey();
    const otherKey = await createGuardianSigningKey();
    const packet = await buildReleasePacket(record, key, LOC);
    expect(await verifyReleasePacket(packet, otherKey.publicKey)).toBe(false);
  });

  it("rejects tampered packets", async () => {
    const record = await armed();
    const key = await createGuardianSigningKey();
    const packet = await buildReleasePacket(record, key, LOC);
    const tampered = { ...packet, label: "Somebody else" };
    expect(await verifyReleasePacket(tampered)).toBe(false);
  });

  it("records due escalations on an overdue guardian", async () => {
    const record = await armed();
    // simulate an elapsed check-in: lastCheckIn in the past
    const overdue: GuardianRecord = {
      ...record,
      config: {
        ...record.config,
        lastCheckIn: Date.now() - record.config.checkInHours * 3_600_000 - 60_000,
      },
    };
    const key = await createGuardianSigningKey();
    const packet = await buildReleasePacket(overdue, key, null);
    expect(packet.status).toBe("overdue");
    expect(packet.escalations.length).toBeGreaterThanOrEqual(1);
    expect(packet.escalations[0].label).toBe("Editor");
    expect(packet.deadline).toBeGreaterThan(0);
  });

  it("produces a panic message on panic state", async () => {
    let record = await armed();
    record = await checkIn(record, "correct-horse-battery", "sunrise").then((r) => r.record);
    record = triggerPanic(record);
    const key = await createGuardianSigningKey();
    const packet = await buildReleasePacket(record, key, LOC);
    expect(packet.status).toBe("panic");
    expect(packet.message).toContain("GUARDIAN PANIC ALERT");
    expect(packet.message).toContain("-33.8688");
  });

  it("round-trips tokens", async () => {
    const record = await armed();
    const key = await createGuardianSigningKey();
    const packet = await buildReleasePacket(record, key, LOC);
    const token = encodeReleasePacket(packet);
    expect(token.startsWith(GUARDIAN_PACKET_PREFIX)).toBe(true);
    const decoded = decodeReleasePacket(token);
    expect(decoded.id).toBe(record.id);
    expect(decoded.contentHash).toBe(packet.contentHash);
    expect(await verifyReleasePacket(decoded)).toBe(true);
  });

  it("rejects malformed tokens", () => {
    expect(() => decodeReleasePacket("nope")).toThrow(/Not a guardian release token/);
    expect(() => decodeReleasePacket(GUARDIAN_PACKET_PREFIX + "!!!")).toThrow();
    const token = encodeReleasePacket({} as never);
    void token;
  });

  it("builds hash-link URLs for mirror delivery", async () => {
    const record = await armed();
    const key = await createGuardianSigningKey();
    const packet = await buildReleasePacket(record, key, LOC);
    const token = encodeReleasePacket(packet);
    const url = buildPacketUrl(token, "https://example.org/the-guardian");
    expect(url.startsWith("https://example.org/the-guardian#packet=")).toBe(true);
    expect(parseHashPacket(url.split("#")[1])).toBe(token);
    expect(parseHashPacket("#other=1")).toBeNull();
  });

  it("fingerprints packets compactly", async () => {
    const record = await armed();
    const key = await createGuardianSigningKey();
    const packet = await buildReleasePacket(record, key, LOC);
    expect(packetFingerprint(packet)).toMatch(/^[a-f0-9]{12}$/);
  });

  it("verifies against a signing key type", async () => {
    const key: GuardianSigningKey = { publicKey: "x", privateKey: "y" };
    expect(key.publicKey).toBeTruthy();
  });
});