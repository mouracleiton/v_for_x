/**
 * V FOR X — Registry Safety Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  runSafetyChecks,
  getSafetyGate,
  getAllSafetyGates,
  setSafetyGateEnabled,
  getErrataChain,
  createErrataChain,
  addErrataEntry,
  encodeErrataToken,
  decodeErrataToken,
  type SafetyContext,
  type SafetyGateId,
  type ErrataType,
} from "../lib/registry-safety";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string): string | null => store[key] || null,
    setItem: (key: string, value: string): void => {
      store[key] = value;
    },
    removeItem: (key: string): void => {
      delete store[key];
    },
    clear: (): void => {
      store = {};
    },
  };
})();

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
});

describe("registry-safety.ts — Safety Gates", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should have all 6 safety gates defined", () => {
    const gates = getAllSafetyGates();
    expect(gates).toHaveLength(6);

    const gateIds = gates.map((g) => g.id);
    expect(gateIds).toContain("corroboration");
    expect(gateIds).toContain("verifiability");
    expect(gateIds).toContain("minimization");
    expect(gateIds).toContain("consent");
    expect(gateIds).toContain("context");
    expect(gateIds).toContain("accountability");
  });

  it("should get a specific safety gate by ID", () => {
    const gate = getSafetyGate("verifiability");
    expect(gate).not.toBeNull();
    expect(gate?.id).toBe("verifiability");
    expect(gate?.name).toBe("Cryptographic Verifiability");
  });

  it("should return null for invalid gate ID", () => {
    const gate = getSafetyGate("invalid" as SafetyGateId);
    expect(gate).toBeNull();
  });

  it("should enable and disable safety gates", () => {
    const gate = getSafetyGate("consent");
    expect(gate?.enabled).toBe(true);

    setSafetyGateEnabled("consent", false);

    const updatedGate = getSafetyGate("consent");
    expect(updatedGate?.enabled).toBe(false);

    setSafetyGateEnabled("consent", true);

    const resetGate = getSafetyGate("consent");
    expect(resetGate?.enabled).toBe(true);
  });
});

describe("registry-safety.ts — Safety Checks", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should run all safety checks", async () => {
    const context: SafetyContext = {
      dossierId: "test-dossier",
      content: "Test content with sufficient context and proper attribution.",
      sources: ["https://example1.com", "https://example2.com"],
      evidenceTokens: ["VFXWIT1:abc123"],
      authorIdentity: "V-ABCD-1234",
      subjectConsent: true,
      metadata: {
        contact: "test@example.com",
        created_at: Date.now(),
      },
    };

    const report = await runSafetyChecks(context);

    expect(report).toBeDefined();
    expect(report.results).toHaveLength(6);
    expect(report.totalIssues).toBeGreaterThanOrEqual(0);
    expect(report.riskScore).toBeGreaterThanOrEqual(0);
    expect(report.riskScore).toBeLessThanOrEqual(100);
  });

  it("should detect missing corroboration", async () => {
    const context: SafetyContext = {
      content: "Test content",
      sources: ["https://example.com"], // Only one source
    };

    const report = await runSafetyChecks(context);

    const corrobationResult = report.results.find((r) => r.gate === "corroboration");
    expect(corrobationResult?.passed).toBe(false);
    expect(corrobationResult?.issues.length).toBeGreaterThan(0);
  });

  it("should detect missing verifiability", async () => {
    const context: SafetyContext = {
      content: "Test content",
      sources: ["https://example1.com", "https://example2.com"],
    };

    const report = await runSafetyChecks(context);

    const verifiabilityResult = report.results.find((r) => r.gate === "verifiability");
    expect(verifiabilityResult?.passed).toBe(false);
  });

  it("should detect missing consent", async () => {
    const context: SafetyContext = {
      content: "Test content with personal information",
      subjectConsent: false,
      sources: ["https://example1.com", "https://example2.com"],
      evidenceTokens: ["VFXWIT1:abc123"],
    };

    const report = await runSafetyChecks(context);

    const consentResult = report.results.find((r) => r.gate === "consent");
    expect(consentResult?.passed).toBe(false);
  });

  it("should detect harmful content", async () => {
    const context: SafetyContext = {
      content: "This contains a home address: 123 Main St, and doxxing information",
      sources: ["https://example1.com", "https://example2.com"],
      evidenceTokens: ["VFXWIT1:abc123"],
    };

    const report = await runSafetyChecks(context);

    const consentResult = report.results.find((r) => r.gate === "consent");
    expect(consentResult?.passed).toBe(false);
    expect(consentResult?.issues.some((i) => i.includes("harmful"))).toBe(true);
  });

  it("should calculate risk score correctly", async () => {
    const context: SafetyContext = {
      content: "Short content without context...",
      sources: ["https://only-one-source.com"],
    };

    const report = await runSafetyChecks(context);

    expect(report.riskScore).toBeGreaterThan(0);
    expect(report.riskScore).toBeLessThanOrEqual(100);

    // High risk score should trigger blocking
    if (report.riskScore > 50) {
      expect(report.shouldBlock).toBe(true);
    }
  });

  it("should pass all checks with good context", async () => {
    const context: SafetyContext = {
      dossierId: "test-dossier",
      content: "Well-documented content with multiple sources and proper context.",
      sources: [
        "https://example1.com",
        "https://example2.com",
        "https://example3.com",
      ],
      evidenceTokens: ["VFXWIT1:abc123", "VFXEV1:def456"],
      authorIdentity: "V-ABCD-1234",
      subjectConsent: true,
      metadata: {
        contact: "test@example.com",
        created_at: Date.now(),
      },
    };

    const report = await runSafetyChecks(context);

    // Should have low risk score with good context
    expect(report.riskScore).toBeLessThan(30);
  });
});

describe("registry-safety.ts — Errata Chain", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should create a new errata chain", () => {
    const chain = createErrataChain("test-dossier");

    expect(chain).toBeDefined();
    expect(chain.dossierId).toBe("test-dossier");
    expect(chain.entries).toEqual([]);
    expect(chain.createdAt).toBeGreaterThan(0);
    expect(chain.lastUpdated).toBeGreaterThan(0);
  });

  it("should save and retrieve errata chain", () => {
    createErrataChain("test-dossier");

    const retrieved = getErrataChain("test-dossier");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.dossierId).toBe("test-dossier");
  });

  it("should return null for non-existent errata chain", () => {
    const retrieved = getErrataChain("non-existent");
    expect(retrieved).toBeNull();
  });

  it("should add errata entry to chain", () => {
    const chain = createErrataChain("test-dossier");

    const entry = addErrataEntry(
      "test-dossier",
      "correction",
      "Original incorrect text",
      "Corrected text",
      "Typo correction",
      "V-ABCD-1234"
    );

    expect(entry).toBeDefined();
    expect(entry.id).toBeTruthy();
    expect(entry.type).toBe("correction");
    expect(entry.originalContent).toBe("Original incorrect text");
    expect(entry.correctedContent).toBe("Corrected text");

    const updatedChain = getErrataChain("test-dossier");
    expect(updatedChain?.entries).toHaveLength(1);
  });

  it("should add multiple errata entries", () => {
    createErrataChain("test-dossier");

    addErrataEntry(
      "test-dossier",
      "correction",
      "Text 1",
      "Corrected 1",
      "Reason 1",
      "V-ABCD-1234"
    );

    addErrataEntry(
      "test-dossier",
      "update",
      "Text 2",
      "Updated 2",
      "Reason 2",
      "V-ABCD-1234"
    );

    const chain = getErrataChain("test-dossier");
    expect(chain?.entries).toHaveLength(2);
  });

  it("should encode and decode VFXERR1 token", () => {
    const chain = createErrataChain("test-dossier");

    const entry = addErrataEntry(
      "test-dossier",
      "correction",
      "Original text",
      "Corrected text",
      "Correction reason",
      "V-ABCD-1234"
    );

    expect(entry).toBeDefined();
    expect(entry.id).toBeTruthy();

    // Get the updated chain
    const updatedChain = getErrataChain("test-dossier");
    expect(updatedChain).not.toBeNull();
    expect(updatedChain?.entries).toHaveLength(1);

    const token = encodeErrataToken(updatedChain!);
    expect(token).toBeTruthy();
    expect(token.startsWith("VFXERR1:")).toBe(true);

    const decoded = decodeErrataToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.dossierId).toBe("test-dossier");
    expect(decoded?.entries).toHaveLength(1);
    expect(decoded?.entries[0].originalContent).toBe("Original text");
  });

  it("should handle all errata types", () => {
    const errataTypes: ErrataType[] = [
      "correction",
      "retraction",
      "update",
      "dispute",
      "clarification",
    ];

    for (const type of errataTypes) {
      const entry = addErrataEntry(
        "test-dossier",
        type,
        "Original",
        "Corrected",
        "Reason",
        "V-ABCD-1234"
      );

      expect(entry.type).toBe(type);
    }
  });

  it("should return null for invalid errata tokens", () => {
    expect(decodeErrataToken("")).toBeNull();
    expect(decodeErrataToken("invalid")).toBeNull();
    expect(decodeErrataToken("VFXWIT1:abc")).toBeNull();
  });

  it("should maintain chronological order in errata chain", () => {
    const chain = createErrataChain("test-dossier");

    const entry1 = addErrataEntry(
      "test-dossier",
      "correction",
      "First",
      "First corrected",
      "Reason 1",
      "V-ABCD-1234"
    );

    // Wait a bit to ensure different timestamps
    const startTime = Date.now();
    while (Date.now() - startTime < 10) {
      // busy wait
    }

    const entry2 = addErrataEntry(
      "test-dossier",
      "update",
      "Second",
      "Second updated",
      "Reason 2",
      "V-ABCD-1234"
    );

    const retrieved = getErrataChain("test-dossier");
    expect(retrieved?.entries).toHaveLength(2);
    expect(retrieved?.entries[0].timestamp).toBeLessThan(retrieved!.entries[1].timestamp);
  });
});