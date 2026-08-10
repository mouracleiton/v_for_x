import { describe, it, expect } from "vitest";
import {
  initiateCustody,
  addCustodyStep,
  verifyCustodyChain,
  exportCustodyChain,
  formatCustodyReport,
  type CustodyEntry,
} from "../lib/custody";

describe("initiateCustody", () => {
  it("creates a genesis entry linked to all-zeros", () => {
    const entry = initiateCustody("a".repeat(64), "V-TEST");
    expect(entry.action).toBe("CAPTURE");
    expect(entry.prevHash).toBe("0".repeat(64));
    expect(entry.entryHash).toMatch(/^[0-9a-f]{64}$/);
    expect(entry.actor).toBe("V-TEST");
  });

  it("stores the evidence hash in lowercase", () => {
    const entry = initiateCustody("ABCDEF1234567890", "V-TEST");
    expect(entry.evidenceHash).toBe(entry.evidenceHash.toLowerCase());
  });
});

describe("addCustodyStep", () => {
  it("chains to the previous entry", () => {
    const e1 = initiateCustody("a".repeat(64), "V-TEST");
    const e2 = addCustodyStep([e1], "HASH", "a".repeat(64), "V-TEST", "Computed SHA-256");
    expect(e2.prevHash).toBe(e1.entryHash);
    expect(e2.action).toBe("HASH");
  });

  it("stores metadata", () => {
    const e1 = initiateCustody("b".repeat(64), "V-TEST");
    const e2 = addCustodyStep([e1], "TIMESTAMP", "b".repeat(64), "V-TEST", "OTS stamp", {
      calendar: "btc.calendar.opentimestamps.org",
    });
    expect(e2.metadata?.calendar).toBe("btc.calendar.opentimestamps.org");
  });
});

describe("verifyCustodyChain", () => {
  it("returns valid for an intact chain", () => {
    const e1 = initiateCustody("c".repeat(64), "V-A");
    const e2 = addCustodyStep([e1], "HASH", "c".repeat(64), "V-A");
    const e3 = addCustodyStep([e1, e2], "VERIFY", "c".repeat(64), "V-B");
    const chain = verifyCustodyChain([e1, e2, e3]);
    expect(chain.valid).toBe(true);
    expect(chain.brokenAt).toBeNull();
  });

  it("detects tampering", () => {
    const e1 = initiateCustody("d".repeat(64), "V-A");
    const e2 = addCustodyStep([e1], "HASH", "d".repeat(64), "V-A");
    // Tamper with e2
    e2.note = "TAMPERED";
    const chain = verifyCustodyChain([e1, e2]);
    expect(chain.valid).toBe(false);
    expect(chain.brokenAt).toBe(1);
  });

  it("detects chain breakage", () => {
    const e1 = initiateCustody("e".repeat(64), "V-A");
    const e2 = addCustodyStep([e1], "HASH", "e".repeat(64), "V-A");
    // Insert a fake prevHash
    e2.prevHash = "f".repeat(64);
    const chain = verifyCustodyChain([e1, e2]);
    expect(chain.valid).toBe(false);
    expect(chain.brokenAt).toBe(1);
  });

  it("returns valid for empty chain", () => {
    const chain = verifyCustodyChain([]);
    expect(chain.valid).toBe(true);
  });
});

describe("exportCustodyChain", () => {
  it("produces valid JSON with summary", () => {
    const e1 = initiateCustody("1".repeat(64), "V-A");
    const e2 = addCustodyStep([e1], "HASH", "1".repeat(64), "V-B");
    const exported = exportCustodyChain([e1, e2]);
    const parsed = JSON.parse(exported);
    expect(parsed.version).toBe(1);
    expect(parsed.valid).toBe(true);
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.summary.steps).toBe(2);
    expect(parsed.summary.actors).toContain("V-A");
    expect(parsed.summary.actors).toContain("V-B");
  });
});

describe("formatCustodyReport", () => {
  it("produces a human-readable report", () => {
    const e1 = initiateCustody("2".repeat(64), "V-A", "Photo captured");
    const e2 = addCustodyStep([e1], "HASH", "2".repeat(64), "V-A", "SHA-256 computed");
    const report = formatCustodyReport([e1, e2]);
    expect(report).toContain("CHAIN OF CUSTODY REPORT");
    expect(report).toContain("CAPTURE");
    expect(report).toContain("HASH");
    expect(report).toContain("INTACT");
  });

  it("reports broken chains", () => {
    const e1 = initiateCustody("3".repeat(64), "V-A");
    e1.note = "TAMPERED";
    const report = formatCustodyReport([e1]);
    expect(report).toContain("BROKEN");
  });
});
