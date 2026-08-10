import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  armCanary,
  checkIn,
  evaluateStatus,
  formatDuration,
  generateReleaseToken,
  decodeReleaseToken,
  disarmCanary,
  markReleased,
} from "../lib/canary";

// crypto.subtle is available in Node 20+ global scope
// crypto.randomUUID may need polyfill in test env
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

const TEST_PASS = "test-passphrase-123";
const TEST_PAYLOAD = "This is the secret payload for the canary.";

describe("canary.ts", () => {
  describe("armCanary", () => {
    it("should arm a canary and return a record", async () => {
      const record = await armCanary(TEST_PASS, TEST_PAYLOAD, {
        label: "Test Canary",
        checkInHours: 24,
        contactHandle: "V-ABCD",
        releaseInstructions: "Contact media",
      });

      expect(record.id).toBeDefined();
      expect(record.config.label).toBe("Test Canary");
      expect(record.config.checkInHours).toBe(24);
      expect(record.config.armedAt).toBeGreaterThan(0);
      expect(record.config.lastCheckIn).toBe(record.config.armedAt);
      expect(record.ciphertext).toBeDefined();
      expect(record.iv).toBeDefined();
      expect(record.salt).toBeDefined();
      expect(record.verifyHash).toBeDefined();
      expect(record.iterations).toBe(150_000);
      expect(record.status).toBe("armed");
    });

    it("should reject short passphrases", async () => {
      await expect(
        armCanary("short", TEST_PAYLOAD, {
          label: "Test",
          checkInHours: 24,
          releaseInstructions: "test",
        }),
      ).rejects.toThrow("at least 8 characters");
    });

    it("should reject invalid check-in intervals", async () => {
      await expect(
        armCanary(TEST_PASS, TEST_PAYLOAD, {
          label: "Test",
          checkInHours: 0,
          releaseInstructions: "test",
        }),
      ).rejects.toThrow("at least 1 hour");
    });
  });

  describe("checkIn", () => {
    it("should reset lastCheckIn with correct passphrase", async () => {
      const record = await armCanary(TEST_PASS, TEST_PAYLOAD, {
        label: "Test",
        checkInHours: 1,
        releaseInstructions: "test",
      });

      await new Promise((r) => setTimeout(r, 50));
      const updated = await checkIn(record, TEST_PASS);
      expect(updated.config.lastCheckIn).toBeGreaterThan(record.config.lastCheckIn);
    });

    it("should reject wrong passphrase", async () => {
      const record = await armCanary(TEST_PASS, TEST_PAYLOAD, {
        label: "Test",
        checkInHours: 1,
        releaseInstructions: "test",
      });

      await expect(checkIn(record, "wrong-pass")).rejects.toThrow("Wrong passphrase");
    });
  });

  describe("evaluateStatus", () => {
    it("should return armed when within interval", async () => {
      const record = await armCanary(TEST_PASS, TEST_PAYLOAD, {
        label: "Test",
        checkInHours: 24,
        releaseInstructions: "test",
      });

      const status = evaluateStatus(record, record.config.armedAt + 1000);
      expect(status.status).toBe("armed");
      expect(status.msRemaining).toBeGreaterThan(0);
      expect(status.fractionElapsed).toBeLessThan(1);
    });

    it("should return overdue when past deadline", async () => {
      const record = await armCanary(TEST_PASS, TEST_PAYLOAD, {
        label: "Test",
        checkInHours: 1,
        releaseInstructions: "test",
      });

      const status = evaluateStatus(record, record.config.lastCheckIn + 2 * 3_600_000);
      expect(status.status).toBe("overdue");
      expect(status.msRemaining).toBeLessThan(0);
    });

    it("should return disarmed for disarmed canaries", async () => {
      const record = await armCanary(TEST_PASS, TEST_PAYLOAD, {
        label: "Test",
        checkInHours: 24,
        releaseInstructions: "test",
      });

      const disarmed = disarmCanary(record);
      const status = evaluateStatus(disarmed);
      expect(status.status).toBe("disarmed");
    });

    it("should show warning at 75% elapsed", async () => {
      const record = await armCanary(TEST_PASS, TEST_PAYLOAD, {
        label: "Test",
        checkInHours: 4,
        releaseInstructions: "test",
      });

      const threeHoursLater = record.config.lastCheckIn + 3 * 3_600_000;
      const status = evaluateStatus(record, threeHoursLater);
      expect(status.fractionElapsed).toBeGreaterThan(0.7);
      expect(status.message).toContain("WARNING");
    });
  });

  describe("disarmCanary / markReleased", () => {
    it("should set status to disarmed", async () => {
      const record = await armCanary(TEST_PASS, TEST_PAYLOAD, {
        label: "Test",
        checkInHours: 24,
        releaseInstructions: "test",
      });
      expect(disarmCanary(record).status).toBe("disarmed");
    });

    it("should set status to released", async () => {
      const record = await armCanary(TEST_PASS, TEST_PAYLOAD, {
        label: "Test",
        checkInHours: 24,
        releaseInstructions: "test",
      });
      expect(markReleased(record).status).toBe("released");
    });
  });

  describe("release token", () => {
    it("should generate and decode a release token", async () => {
      const record = await armCanary(TEST_PASS, TEST_PAYLOAD, {
        label: "My Evidence Vault",
        checkInHours: 24,
        releaseInstructions: "test",
      });

      const token = generateReleaseToken(record);
      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(10);

      const decoded = decodeReleaseToken(token);
      expect(decoded.id).toBe(record.id);
      expect(decoded.label).toBe("My Evidence Vault");
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
});
