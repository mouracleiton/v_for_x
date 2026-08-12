/**
 * V FOR X — "Explain this number" tests (Phase 21)
 */

import { describe, it, expect } from "vitest";
import {
  explainNumber,
  explainMany,
  summaryLine,
  isCitable,
  sortByConfidence,
} from "../lib/explain-number";
import { UNDOCUMENTED_META } from "../lib/metric-meta";

describe("explain-number", () => {
  it("resolves a known metric path", () => {
    const card = explainNumber(12.3, "SDN.hunger.undernourishment_pct");
    expect(card.value).toBe(12.3);
    expect(card.undocumented).toBe(false);
    expect(card.meta.publisher).toBe("FAO");
    expect(card.confidenceRank).toBeGreaterThan(0);
  });

  it("falls back to UNDOCUMENTED_META for unknown paths", () => {
    const card = explainNumber(99, "XX.unknown_metric_zzz");
    expect(card.undocumented).toBe(true);
    expect(card.meta.id).toBe(UNDOCUMENTED_META.id);
  });

  it("preserves caller displayValue when supplied", () => {
    const card = explainNumber(0.123, "global.hunger", "12.3 %");
    expect(card.displayValue).toBe("12.3 %");
  });

  it("defaults displayValue to value string", () => {
    const card = explainNumber(45, "global.conflict_deaths");
    expect(card.displayValue).toBe("45");
  });

  it("defaults displayValue to N/A when value is null", () => {
    const card = explainNumber(null, "global.displacement");
    expect(card.displayValue).toBe("N/A");
    expect(card.value).toBeNull();
  });

  it("flags anomalous values (negative, NaN, Infinity)", () => {
    expect(explainNumber(-5, "global.hunger").anomalous).toBe(true);
    expect(explainNumber(NaN, "global.hunger").anomalous).toBe(true);
    expect(explainNumber(Infinity, "global.hunger").anomalous).toBe(true);
    expect(explainNumber(0, "global.hunger").anomalous).toBe(false);
    expect(explainNumber(null, "global.hunger").anomalous).toBe(false);
  });

  it("exposes a citation and footnote string", () => {
    const card = explainNumber(1000, "global.displacement");
    expect(card.citation).toMatch(/UNHCR \(2024\)/);
    expect(card.footnote).toContain("UNHCR");
    expect(card.footnote).toContain("confidence:");
  });

  it("exposes a confidence hex color", () => {
    const card = explainNumber(1, "global.displacement");
    expect(card.confidenceHex).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("summaryLine composes head + citation + confidence", () => {
    const card = explainNumber(12.3, "SDN.hunger.undernourishment_pct", "12.3 %");
    const line = summaryLine(card);
    expect(line).toContain("12.3 %");
    expect(line).toContain("FAO");
    expect(line).toContain("confidence:");
  });

  it("isCitable is false for undocumented", () => {
    expect(isCitable(explainNumber(1, "global.displacement"))).toBe(true);
    expect(isCitable(explainNumber(1, "XX.unknown_zzz"))).toBe(false);
  });

  it("explainMany preserves order", () => {
    const cards = explainMany([
      { value: 1, metricPath: "global.displacement" },
      { value: 2, metricPath: "global.hunger" },
    ]);
    expect(cards).toHaveLength(2);
    expect(cards[0].meta.publisher).toBe("UNHCR");
    expect(cards[1].meta.publisher).toBe("FAO");
  });

  it("sortByConfidence puts high confidence first, undocumented last", () => {
    const cards = [
      explainNumber(1, "XX.unknown_zzz"),
      explainNumber(2, "global.displacement"), // high
      explainNumber(3, "global.hunger"), // medium
    ];
    const sorted = sortByConfidence(cards);
    expect(sorted[0].meta.publisher).toBe("UNHCR"); // high
    expect(sorted[sorted.length - 1].undocumented).toBe(true);
  });

  it("sortByConfidence is stable on equal confidence", () => {
    const cards = [
      explainNumber(1, "global.hunger"),
      explainNumber(2, "global.conflict_deaths"), // also medium per registry
      explainNumber(3, "global.hunger"),
    ];
    const sorted = sortByConfidence(cards);
    // Both medium-confidence rows should retain their relative order
    const idxA = sorted.findIndex((c) => c.value === 1);
    const idxB = sorted.findIndex((c) => c.value === 3);
    expect(idxA).toBeLessThan(idxB);
  });

  it("round-trips with metric-meta resolveMetricMeta (no drift)", () => {
    const card = explainNumber(42, "global.displacement");
    expect(card.meta.id).toBe("displacement");
    expect(card.meta.matches).toContain("displacement");
  });
});
