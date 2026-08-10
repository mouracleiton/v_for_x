import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  armGuardian,
  checkIn,
  evaluateStatus,
  getEscalationState,
  updateEscalationLog,
  captureLocation,
  decryptLocation,
  triggerPanic,
  clearPanic,
  disarmGuardian,
  generateGuardianToken,
  decodeGuardianToken,
  buildPanicBroadcast,
  buildEscalationNotice,
  formatDuration,
  sortedContacts,
  type TrustedContact,
} from "../lib/guardian";

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

const PASS = "guardian-pass-123";
const SAFE = "sunrise";
const DURESS = "nightfall";

function baseConfig() {
  return {
    label: "Maria — Beirut bureau",
    checkInHours: 12,
    contacts: [
      { id: "c1", label: "Editor", handle: "Signal +1", escalateAfterMin: 0 },
      { id: "c2", label: "Lawyer", handle: "protonmail", escalateAfterMin: 60 },
    ] as TrustedContact[],
    escalationMessage: "If you receive this, I may be detained. Contact [legal aid].",
    safeCode: SAFE,
    duressCode: DURESS,
  };
}

describe("guardian.ts", () => {
  describe("armGuardian", () => {
    it("should arm a guardian and return a record", async () => {
      const r = await armGuardian(PASS, baseConfig());
      expect(r.id).toBeDefined();
      expect(r.config.label).toBe("Maria — Beirut bureau");
      expect(r.config.checkInHours).toBe(12);
      expect(r.config.armedAt).toBeGreaterThan(0);
      expect(r.config.lastCheckIn).toBe(r.config.armedAt);
      expect(r.salt).toBeDefined();
      expect(r.verifyHash).toBeDefined();
      expect(r.iterations).toBe(150_000);
      expect(r.status).toBe("armed");
      expect(r.location).toBeNull();
      expect(r.panicTriggeredAt).toBeNull();
      expect(r.duressFlag).toBe(false);
      expect(r.escalations).toEqual([]);
    });

    it("should reject short passphrases", async () => {
      await expect(armGuardian("short", baseConfig())).rejects.toThrow("at least 8 characters");
    });

    it("should reject invalid check-in intervals", async () => {
      const c = baseConfig();
      c.checkInHours = 0;
      await expect(armGuardian(PASS, c)).rejects.toThrow("at least 1 hour");
    });

    it("should require a safe word of at least 3 chars", async () => {
      const c = baseConfig();
      c.safeCode = "ab";
      await expect(armGuardian(PASS, c)).rejects.toThrow("Safe word");
    });

    it("should require a duress word of at least 3 chars", async () => {
      const c = baseConfig();
      c.duressCode = "ab";
      await expect(armGuardian(PASS, c)).rejects.toThrow("Duress word");
    });

    it("should reject identical safe and duress words", async () => {
      const c = baseConfig();
      c.safeCode = "same";
      c.duressCode = "same";
      await expect(armGuardian(PASS, c)).rejects.toThrow("must be different");
    });

    it("should require at least one trusted contact", async () => {
      const c = baseConfig();
      c.contacts = [];
      await expect(armGuardian(PASS, c)).rejects.toThrow("trusted contact");
    });
  });

  describe("checkIn", () => {
    it("should reset lastCheckIn with the safe word", async () => {
      const r = await armGuardian(PASS, baseConfig());
      await new Promise((res) => setTimeout(res, 20));
      const { record, result } = await checkIn(r, PASS, SAFE);
      expect(result).toBe("safe");
      expect(record.config.lastCheckIn).toBeGreaterThan(r.config.lastCheckIn);
      expect(record.duressFlag).toBe(false);
      expect(record.status).toBe("armed");
    });

    it("should silently flag escalation on the duress word while looking normal", async () => {
      const r = await armGuardian(PASS, baseConfig());
      await new Promise((res) => setTimeout(res, 20));
      const { record, result } = await checkIn(r, PASS, DURESS);
      expect(result).toBe("duress");
      // Looks healthy to an observer:
      expect(record.status).toBe("armed");
      expect(record.config.lastCheckIn).toBeGreaterThan(r.config.lastCheckIn);
      // But the hidden flag is set:
      expect(record.duressFlag).toBe(true);
    });

    it("should reject wrong passphrase", async () => {
      const r = await armGuardian(PASS, baseConfig());
      await expect(checkIn(r, "wrong-pass", SAFE)).rejects.toThrow("Wrong passphrase");
    });

    it("should reject unrecognized check-in word", async () => {
      const r = await armGuardian(PASS, baseConfig());
      await expect(checkIn(r, PASS, "nonsense")).rejects.toThrow("not recognized");
    });

    it("a safe check-in after a duress check-in should clear the flag", async () => {
      const r = await armGuardian(PASS, baseConfig());
      const d = (await checkIn(r, PASS, DURESS)).record;
      expect(d.duressFlag).toBe(true);
      const s = (await checkIn(d, PASS, SAFE)).record;
      expect(s.duressFlag).toBe(false);
    });
  });

  describe("evaluateStatus", () => {
    it("should be armed within the interval", async () => {
      const r = await armGuardian(PASS, baseConfig());
      const s = evaluateStatus(r, r.config.armedAt + 1000);
      expect(s.status).toBe("armed");
      expect(s.msRemaining).toBeGreaterThan(0);
    });

    it("should warn at >= 75% elapsed", async () => {
      const r = await armGuardian(PASS, baseConfig());
      const later = r.config.lastCheckIn + 0.8 * 12 * 3_600_000;
      const s = evaluateStatus(r, later);
      expect(s.status).toBe("warning");
      expect(s.message).toContain("WARNING");
    });

    it("should be overdue past the deadline", async () => {
      const r = await armGuardian(PASS, baseConfig());
      const later = r.config.lastCheckIn + 13 * 3_600_000;
      const s = evaluateStatus(r, later);
      expect(s.status).toBe("overdue");
      expect(s.msRemaining).toBeLessThan(0);
    });

    it("should report panic when panic triggered", async () => {
      const r = await armGuardian(PASS, baseConfig());
      const p = triggerPanic(r);
      const s = evaluateStatus(p);
      expect(s.status).toBe("panic");
    });

    it("should report escalated on a duress flag", async () => {
      const r = await armGuardian(PASS, baseConfig());
      const d = (await checkIn(r, PASS, DURESS)).record;
      const s = evaluateStatus(d);
      expect(s.status).toBe("escalated");
    });

    it("should report safe when disarmed", async () => {
      const r = await armGuardian(PASS, baseConfig());
      const s = evaluateStatus(disarmGuardian(r));
      expect(s.status).toBe("safe");
    });
  });

  describe("getEscalationState", () => {
    it("should be inactive before the deadline", async () => {
      const r = await armGuardian(PASS, baseConfig());
      const st = getEscalationState(r, r.config.lastCheckIn + 1000);
      expect(st.active).toBe(false);
      expect(st.dueNow).toHaveLength(0);
    });

    it("should activate tier-0 immediately on overdue", async () => {
      const r = await armGuardian(PASS, baseConfig());
      const justOverdue = r.config.lastCheckIn + 12 * 3_600_000 + 1;
      const st = getEscalationState(r, justOverdue);
      expect(st.active).toBe(true);
      expect(st.dueNow.map((c) => c.label)).toEqual(["Editor"]);
      expect(st.highestTier).toBe(1);
    });

    it("should activate tier-1 after its delay", async () => {
      const r = await armGuardian(PASS, baseConfig());
      const oneHourOver = r.config.lastCheckIn + 12 * 3_600_000 + 61 * 60_000;
      const st = getEscalationState(r, oneHourOver);
      expect(st.dueNow.map((c) => c.label).sort()).toEqual(["Editor", "Lawyer"]);
      expect(st.highestTier).toBe(2);
    });

    it("should force-activate on a duress flag even before the deadline", async () => {
      const r = await armGuardian(PASS, baseConfig());
      const d = (await checkIn(r, PASS, DURESS)).record;
      const st = getEscalationState(d, d.config.lastCheckIn + 1000);
      expect(st.active).toBe(true);
      expect(st.dueNow.length).toBeGreaterThan(0);
    });

    it("should force-activate on panic", async () => {
      const r = await armGuardian(PASS, baseConfig());
      const p = triggerPanic(r);
      const st = getEscalationState(p);
      expect(st.active).toBe(true);
    });
  });

  describe("updateEscalationLog", () => {
    it("should append newly-due contacts only", async () => {
      const r = await armGuardian(PASS, baseConfig());
      const overdue = r.config.lastCheckIn + 12 * 3_600_000 + 1;
      const log1 = updateEscalationLog(r, overdue);
      expect(log1).toHaveLength(1);
      expect(log1[0].contactId).toBe("c1");
      // Second call at same time should not duplicate.
      const log2 = updateEscalationLog({ ...r, escalations: log1 }, overdue);
      expect(log2).toHaveLength(1);
    });
  });

  describe("captureLocation / decryptLocation", () => {
    it("should encrypt and decrypt a location round-trip", async () => {
      const r = await armGuardian(PASS, baseConfig());
      const loc = { lat: 33.8938, lng: 35.5018, accuracy: 25, note: "cafe near safehouse" };
      const captured = await captureLocation(r, PASS, loc);
      expect(captured.location).not.toBeNull();
      expect(captured.location!.ciphertext).toBeDefined();
      expect(captured.location!.iv).toBeDefined();
      expect(captured.location!.capturedAt).toBeGreaterThan(0);

      const back = await decryptLocation(captured, PASS);
      expect(back.lat).toBeCloseTo(33.8938, 4);
      expect(back.lng).toBeCloseTo(35.5018, 4);
      expect(back.accuracy).toBe(25);
      expect(back.note).toBe("cafe near safehouse");
    });

    it("should reject decryption with wrong passphrase", async () => {
      const r = await armGuardian(PASS, baseConfig());
      const captured = await captureLocation(r, PASS, { lat: 1, lng: 2 });
      await expect(decryptLocation(captured, "wrong-pass")).rejects.toThrow("Wrong passphrase");
    });

    it("should throw if no location captured", async () => {
      const r = await armGuardian(PASS, baseConfig());
      await expect(decryptLocation(r, PASS)).rejects.toThrow("No last-known-location");
    });
  });

  describe("panic + messaging", () => {
    it("triggerPanic then clearPanic", async () => {
      const r = await armGuardian(PASS, baseConfig());
      const p = triggerPanic(r);
      expect(p.status).toBe("panic");
      expect(p.panicTriggeredAt).not.toBeNull();
      const cleared = clearPanic(p);
      expect(cleared.status).toBe("armed");
      expect(cleared.panicTriggeredAt).toBeNull();
    });

    it("buildPanicBroadcast includes label, location, and message", async () => {
      const r = await armGuardian(PASS, baseConfig());
      const loc = { lat: 33.8938, lng: 35.5018, accuracy: 25 };
      const msg = buildPanicBroadcast(triggerPanic(r), loc);
      expect(msg).toContain("GUARDIAN PANIC ALERT");
      expect(msg).toContain("Maria — Beirut bureau");
      expect(msg).toContain("33.89380");
      expect(msg).toContain("detained");
    });

    it("buildPanicBroadcast handles missing location", async () => {
      const r = await armGuardian(PASS, baseConfig());
      const msg = buildPanicBroadcast(triggerPanic(r), null);
      expect(msg).toContain("none captured");
    });

    it("buildEscalationNotice addresses a contact and includes overdue", async () => {
      const r = await armGuardian(PASS, baseConfig());
      const overdue = r.config.lastCheckIn + 13 * 3_600_000;
      const contact = r.config.contacts[1];
      const notice = buildEscalationNotice(r, contact, null, overdue);
      expect(notice).toContain("Lawyer");
      expect(notice).toContain("missed a scheduled check-in");
      expect(notice).toContain("Overdue by");
    });
  });

  describe("disarmGuardian", () => {
    it("should stand the guardian down", async () => {
      const r = await armGuardian(PASS, baseConfig());
      const d = disarmGuardian(triggerPanic(r));
      expect(d.status).toBe("safe");
      expect(d.panicTriggeredAt).toBeNull();
      expect(d.duressFlag).toBe(false);
    });
  });

  describe("guardian token", () => {
    it("should generate and decode a token", async () => {
      const r = await armGuardian(PASS, baseConfig());
      const token = generateGuardianToken(r);
      expect(token.length).toBeGreaterThan(10);
      const decoded = decodeGuardianToken(token);
      expect(decoded.id).toBe(r.id);
      expect(decoded.label).toBe("Maria — Beirut bureau");
    });
  });

  describe("formatDuration", () => {
    it("should format milliseconds", () => {
      expect(formatDuration(30_000)).toBe("0m");
      expect(formatDuration(3_600_000)).toBe("1h 0m");
      expect(formatDuration(90_000)).toBe("1m");
      expect(formatDuration(86_400_000 + 3_600_000)).toBe("1d 1h");
    });

    it("should format negative durations", () => {
      const result = formatDuration(-3_600_000);
      expect(result).toContain("1h");
      expect(result.startsWith("-")).toBe(true);
    });
  });

  describe("sortedContacts", () => {
    it("should sort by escalateAfterMin ascending", () => {
      const contacts = [
        { id: "a", label: "Late", handle: "h", escalateAfterMin: 120 },
        { id: "b", label: "First", handle: "h", escalateAfterMin: 0 },
        { id: "c", label: "Mid", handle: "h", escalateAfterMin: 60 },
      ];
      const sorted = sortedContacts(contacts);
      expect(sorted.map((c) => c.id)).toEqual(["b", "c", "a"]);
    });
  });
});
