/**
 * V FOR X — Build Attestation Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  verifyBuild,
  getBuildStatusBadge,
  formatBuildId,
  formatBuildTimestamp,
  getVerificationReport,
  getCurrentBuildStatus,
  ATTESTATION_PATH,
  MANIFEST_PATH,
  TRUSTED_PUBLIC_KEY,
  type BuildAttestation,
  type BuildVerifyResult,
} from "../lib/build-attest";

// Mock attestation for testing
const createMockAttestation = (
  overrides: Partial<BuildAttestation> = {},
): BuildAttestation => ({
  buildId: "abc123-1234567890",
  gitCommit: "a".repeat(64),
  timestamp: Math.floor(Date.now() / 1000),
  manifestHash: "b".repeat(64),
  signature: "c".repeat(128),
  publicKey: TRUSTED_PUBLIC_KEY,
  format: "vfx-build-attestation-1",
  ...overrides,
});

describe("Build Attestation", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("verifyBuild", () => {
    it("verifies valid attestation with matching manifest", async () => {
      const attestation = createMockAttestation();

      // Mock manifest fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ root: attestation.manifestHash }),
      });

      const result = await verifyBuild(attestation);

      expect(result.status.ok).toBe("valid");
      expect(result.manifestMatch).toBe(true);
      expect(result.signatureValid).toBe(true);
      expect(result.keyTrusted).toBe(true);
      expect(result.status.reason).toContain("authentic and untampered");
    });

    it("detects manifest hash mismatch", async () => {
      const attestation = createMockAttestation();

      // Mock manifest with different hash
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ root: "x".repeat(64) }),
      });

      const result = await verifyBuild(attestation);

      expect(result.status.ok).toBe("invalid");
      expect(result.manifestMatch).toBe(false);
      expect(result.status.reason).toContain("Build manifest hash does not match");
    });

    it("handles manifest fetch failure", async () => {
      const attestation = createMockAttestation();

      // Mock manifest fetch failure
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await verifyBuild(attestation);

      // Should still verify signature and key, just manifestMatch=false
      expect(result.manifestMatch).toBe(false);
      expect(result.signatureValid).toBe(true);
      expect(result.keyTrusted).toBe(true);
    });

    it("rejects invalid signature format", async () => {
      const attestation = createMockAttestation({ signature: "too-short" });

      const result = await verifyBuild(attestation);

      expect(result.status.ok).toBe("invalid");
      expect(result.signatureValid).toBe(false);
      expect(result.status.reason).toContain("Invalid signature format");
    });

    it("detects untrusted key", async () => {
      const attestation = createMockAttestation({
        publicKey: "x".repeat(TRUSTED_PUBLIC_KEY.length),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ root: attestation.manifestHash }),
      });

      const result = await verifyBuild(attestation);

      expect(result.status.ok).toBe("valid"); // Valid but untrusted
      expect(result.manifestMatch).toBe(true);
      expect(result.keyTrusted).toBe(false);
      expect(result.status.reason).toContain("untrusted key");
    });

    it("handles missing attestation file", async () => {
      mockFetch.mockRejectedValueOnce(new Error("404 Not Found"));

      const result = await verifyBuild();

      expect(result.status.ok).toBe("unknown");
      expect(result.status.reason).toContain("not found");
    });
  });

  describe("getBuildStatusBadge", () => {
    it("returns green badge for valid trusted build", () => {
      const result: BuildVerifyResult = {
        status: { ok: "valid", attestation: createMockAttestation(), reason: "Valid" },
        manifestMatch: true,
        signatureValid: true,
        keyTrusted: true,
        attestation: createMockAttestation(),
      };

      const badge = getBuildStatusBadge(result);
      expect(badge.color).toBe("green");
      expect(badge.text).toBe("AUTHENTIC");
    });

    it("returns amber badge for untrusted key", () => {
      const result: BuildVerifyResult = {
        status: { ok: "valid", attestation: createMockAttestation(), reason: "Untrusted" },
        manifestMatch: true,
        signatureValid: true,
        keyTrusted: false,
        attestation: createMockAttestation(),
      };

      const badge = getBuildStatusBadge(result);
      expect(badge.color).toBe("amber");
      expect(badge.text).toBe("UNTRUSTED KEY");
    });

    it("returns red badge for tampered build", () => {
      const result: BuildVerifyResult = {
        status: { ok: "invalid", attestation: createMockAttestation(), reason: "Tampered" },
        manifestMatch: false,
        signatureValid: true,
        keyTrusted: true,
        attestation: createMockAttestation(),
      };

      const badge = getBuildStatusBadge(result);
      expect(badge.color).toBe("blood");
      expect(badge.text).toBe("TAMPERED");
    });

    it("returns red badge for invalid signature", () => {
      const result: BuildVerifyResult = {
        status: { ok: "invalid", attestation: createMockAttestation(), reason: "Invalid sig" },
        manifestMatch: true,
        signatureValid: false,
        keyTrusted: true,
        attestation: createMockAttestation(),
      };

      const badge = getBuildStatusBadge(result);
      expect(badge.color).toBe("blood");
      expect(badge.text).toBe("INVALID SIG");
    });

    it("returns amber badge for unknown status", () => {
      const result: BuildVerifyResult = {
        status: { ok: "unknown", attestation: null, reason: "Not found" },
        manifestMatch: false,
        signatureValid: false,
        keyTrusted: false,
        attestation: null,
      };

      const badge = getBuildStatusBadge(result);
      expect(badge.color).toBe("amber");
      expect(badge.text).toBe("UNKNOWN");
    });
  });

  describe("formatBuildId", () => {
    it("shortens long build IDs", () => {
      const longId = "abc123def456-1234567890";
      expect(formatBuildId(longId)).toHaveLength(12);
    });

    it("returns short IDs as-is", () => {
      const shortId = "abc";
      expect(formatBuildId(shortId)).toBe(shortId);
    });
  });

  describe("formatBuildTimestamp", () => {
    it("formats timestamp as YYYY-MM-DD", () => {
      const timestamp = 1609459200; // 2021-01-01 00:00:00 UTC
      expect(formatBuildTimestamp(timestamp)).toBe("2021-01-01");
    });
  });

  describe("getVerificationReport", () => {
    it("generates detailed report for valid build", () => {
      const attestation = createMockAttestation();
      const result: BuildVerifyResult = {
        status: { ok: "valid", attestation, reason: "Valid" },
        manifestMatch: true,
        signatureValid: true,
        keyTrusted: true,
        attestation,
      };

      const report = getVerificationReport(result);

      expect(report.some(line => line.includes("Build ID:"))).toBe(true);
      expect(report.some(line => line.includes("Git commit:"))).toBe(true);
      expect(report.some(line => line.includes("Built:"))).toBe(true);
      expect(report.some(line => line.includes("Manifest hash matches served data"))).toBe(true);
      expect(report.some(line => line.includes("Signature is valid"))).toBe(true);
      expect(report.some(line => line.includes("Signed by trusted key"))).toBe(true);
      expect(report.some(line => line.includes("✓ This build is authentic and untampered."))).toBe(true);
    });

    it("generates report for untrusted build", () => {
      const attestation = createMockAttestation();
      const result: BuildVerifyResult = {
        status: { ok: "valid", attestation, reason: "Untrusted" },
        manifestMatch: true,
        signatureValid: true,
        keyTrusted: false,
        attestation,
      };

      const report = getVerificationReport(result);

      expect(report.some(line => line.includes("⚠️  This build is signed, but not by the trusted V FOR X key."))).toBe(true);
    });

    it("generates report for unknown status", () => {
      const result: BuildVerifyResult = {
        status: { ok: "unknown", attestation: null, reason: "Build attestation not found" },
        manifestMatch: false,
        signatureValid: false,
        keyTrusted: false,
        attestation: null,
      };

      const report = getVerificationReport(result);

      expect(report.some(line => line.includes("⚠️"))).toBe(true);
      expect(report.some(line => line.includes("Build attestation not found"))).toBe(true);
      expect(report.some(line => line.includes("This build appears to be unsigned"))).toBe(true);
    });
  });

  describe("getCurrentBuildStatus", () => {
    it("returns build status on success", async () => {
      const attestation = createMockAttestation();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => attestation,
      }).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ root: attestation.manifestHash }),
      });

      const result = await getCurrentBuildStatus();

      expect(result.status.ok).toBe("valid");
      expect(result.attestation).toBeDefined();
    });

    it("returns unknown status on error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await getCurrentBuildStatus();

      expect(result.status.ok).toBe("unknown");
      expect(result.status.reason).toContain("Build attestation not found");
    });
  });

  describe("edge cases", () => {
    it("handles attestation with missing required fields", async () => {
      const invalidAttestation = { format: "vfx-build-attestation-1" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => invalidAttestation,
      });

      const result = await verifyBuild();

      expect(result.status.ok).toBe("unknown");
      expect(result.status.reason).toContain("Failed to fetch build attestation");
    });

    it("handles malformed JSON response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      const result = await verifyBuild();

      expect(result.status.ok).toBe("unknown");
    });

    it("handles missing manifest in served data", async () => {
      const attestation = createMockAttestation();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => attestation,
      }).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ /* no root field */ }),
      });

      const result = await verifyBuild();

      expect(result.manifestMatch).toBe(false);
    });
  });
});
