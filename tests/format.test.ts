import { describe, it, expect } from "vitest";
import {
  formatNumber,
  formatPct,
  formatMoney,
  severityColor,
  tierColor,
  wfpClassColor,
  wfpClassLabel,
} from "../lib/format";

describe("format.ts", () => {
  describe("formatNumber", () => {
    it("should return N/A for null", () => {
      expect(formatNumber(null)).toBe("N/A");
    });

    it("should return N/A for undefined", () => {
      expect(formatNumber(undefined)).toBe("N/A");
    });

    it("should format zero as 0.0", () => {
      expect(formatNumber(0)).toBe("0.0");
    });

    it("should format small numbers with one decimal", () => {
      expect(formatNumber(42.555)).toBe("42.6");
      expect(formatNumber(999.9)).toBe("999.9");
      expect(formatNumber(7)).toBe("7.0");
    });

    it("should format exactly 1e3 with K suffix", () => {
      expect(formatNumber(1e3)).toBe("1.0K");
    });

    it("should format thousands with K suffix", () => {
      expect(formatNumber(1500)).toBe("1.5K");
      expect(formatNumber(999999)).toBe("1000.0K");
    });

    it("should format exactly 1e6 with M suffix", () => {
      expect(formatNumber(1e6)).toBe("1.00M");
    });

    it("should format millions with M suffix", () => {
      expect(formatNumber(1234567)).toBe("1.23M");
    });

    it("should format exactly 1e9 with B suffix", () => {
      expect(formatNumber(1e9)).toBe("1.00B");
    });

    it("should format billions with B suffix", () => {
      expect(formatNumber(2.5e9)).toBe("2.50B");
    });

    it("should format exactly 1e12 with T suffix", () => {
      expect(formatNumber(1e12)).toBe("1.00T");
    });

    it("should format trillions with T suffix", () => {
      expect(formatNumber(3.7e12)).toBe("3.70T");
    });

    it("should handle negative numbers by absolute value tiers", () => {
      expect(formatNumber(-1500)).toBe("-1.5K");
      expect(formatNumber(-1e6)).toBe("-1.00M");
      expect(formatNumber(-1e9)).toBe("-1.00B");
      expect(formatNumber(-1e12)).toBe("-1.00T");
      expect(formatNumber(-42)).toBe("-42.0");
    });
  });

  describe("formatPct", () => {
    it("should return N/A for null", () => {
      expect(formatPct(null)).toBe("N/A");
    });

    it("should return N/A for undefined", () => {
      expect(formatPct(undefined)).toBe("N/A");
    });

    it("should format zero percent", () => {
      expect(formatPct(0)).toBe("0.0%");
    });

    it("should append a percent sign with one decimal", () => {
      expect(formatPct(42.555)).toBe("42.6%");
      expect(formatPct(100)).toBe("100.0%");
    });

    it("should handle negative percentages", () => {
      expect(formatPct(-5)).toBe("-5.0%");
    });
  });

  describe("formatMoney", () => {
    it("should return N/A for null", () => {
      expect(formatMoney(null)).toBe("N/A");
    });

    it("should return N/A for undefined", () => {
      expect(formatMoney(undefined)).toBe("N/A");
    });

    it("should format zero as $0.00", () => {
      expect(formatMoney(0)).toBe("$0.00");
    });

    it("should format small amounts with $ and two decimals", () => {
      expect(formatMoney(999.9)).toBe("$999.90");
      expect(formatMoney(42)).toBe("$42.00");
    });

    it("should format exactly 1e3 with $K suffix", () => {
      expect(formatMoney(1e3)).toBe("$1.0K");
    });

    it("should format exactly 1e6 with $M suffix", () => {
      expect(formatMoney(1e6)).toBe("$1.0M");
    });

    it("should format exactly 1e9 with $B suffix", () => {
      expect(formatMoney(1e9)).toBe("$1.00B");
    });

    it("should format exactly 1e12 with $T suffix", () => {
      expect(formatMoney(1e12)).toBe("$1.00T");
    });

    it("should handle negative amounts", () => {
      expect(formatMoney(-1500)).toBe("$-1.5K");
      expect(formatMoney(-1e6)).toBe("$-1.0M");
    });
  });

  describe("severityColor", () => {
    it("should return #1a1a1a for NaN", () => {
      expect(severityColor(NaN, 0, 10)).toBe("#1a1a1a");
    });

    it("should return #1a1a1a for null value", () => {
      expect(severityColor(null as unknown as number, 0, 10)).toBe("#1a1a1a");
    });

    it("should return #1a1a1a for undefined value", () => {
      expect(severityColor(undefined as unknown as number, 0, 10)).toBe(
        "#1a1a1a"
      );
    });

    it("should return #3a0a0a for ratio below 0.2", () => {
      // min=0, max=5; value 0.5 → ratio 0.1
      expect(severityColor(0.5, 0, 5)).toBe("#3a0a0a");
    });

    it("should return #660000 at exactly ratio 0.2", () => {
      // value 1.0 / 5 = 0.2 (not < 0.2, but < 0.4)
      expect(severityColor(1, 0, 5)).toBe("#660000");
    });

    it("should return #990000 at exactly ratio 0.4", () => {
      expect(severityColor(2, 0, 5)).toBe("#990000");
    });

    it("should return #cc0000 at exactly ratio 0.6", () => {
      expect(severityColor(3, 0, 5)).toBe("#cc0000");
    });

    it("should return #ff0000 at exactly ratio 0.8", () => {
      expect(severityColor(4, 0, 5)).toBe("#ff0000");
    });

    it("should return #ff0000 for ratio above 0.8", () => {
      expect(severityColor(4.5, 0, 5)).toBe("#ff0000");
      expect(severityColor(5, 0, 5)).toBe("#ff0000");
    });

    it("should clamp value below min to lowest band", () => {
      // value below min → ratio clamped to 0 → #3a0a0a
      expect(severityColor(-5, 0, 10)).toBe("#3a0a0a");
    });

    it("should clamp value above max to highest band", () => {
      // value above max → ratio clamped to 1 → #ff0000
      expect(severityColor(15, 0, 10)).toBe("#ff0000");
    });

    it("should compute ratio relative to non-zero min", () => {
      // min=10, max=20; value=14 → ratio 0.4 → #990000
      expect(severityColor(14, 10, 20)).toBe("#990000");
    });
  });

  describe("tierColor", () => {
    it("should return #00ff41 for S", () => {
      expect(tierColor("S")).toBe("#00ff41");
    });

    it("should return #ffaa00 for A", () => {
      expect(tierColor("A")).toBe("#ffaa00");
    });

    it("should return #cc0000 for B", () => {
      expect(tierColor("B")).toBe("#cc0000");
    });

    it("should be case-insensitive", () => {
      expect(tierColor("s")).toBe("#00ff41");
      expect(tierColor("a")).toBe("#ffaa00");
      expect(tierColor("b")).toBe("#cc0000");
    });

    it("should return #444444 for unknown tiers", () => {
      expect(tierColor("C")).toBe("#444444");
      expect(tierColor("X")).toBe("#444444");
      expect(tierColor("")).toBe("#444444");
    });
  });

  describe("wfpClassColor", () => {
    it("should map highest_concern to #ff0000", () => {
      expect(wfpClassColor("highest_concern")).toBe("#ff0000");
    });

    it("should map very_high_concern to #cc0000", () => {
      expect(wfpClassColor("very_high_concern")).toBe("#cc0000");
    });

    it("should map high_concern to #990000", () => {
      expect(wfpClassColor("high_concern")).toBe("#990000");
    });

    it("should map concern to #660000", () => {
      expect(wfpClassColor("concern")).toBe("#660000");
    });

    it("should return #333333 for unknown classes", () => {
      expect(wfpClassColor("unknown")).toBe("#333333");
      expect(wfpClassColor("")).toBe("#333333");
    });

    it("should be case-sensitive (uppercase variant is unknown)", () => {
      expect(wfpClassColor("Highest_Concern")).toBe("#333333");
    });
  });

  describe("wfpClassLabel", () => {
    it("should map highest_concern to HIGHEST CONCERN", () => {
      expect(wfpClassLabel("highest_concern")).toBe("HIGHEST CONCERN");
    });

    it("should map very_high_concern to VERY HIGH", () => {
      expect(wfpClassLabel("very_high_concern")).toBe("VERY HIGH");
    });

    it("should map high_concern to HIGH", () => {
      expect(wfpClassLabel("high_concern")).toBe("HIGH");
    });

    it("should map concern to CONCERN", () => {
      expect(wfpClassLabel("concern")).toBe("CONCERN");
    });

    it("should return em-dash for unknown classes", () => {
      expect(wfpClassLabel("unknown")).toBe("—");
      expect(wfpClassLabel("")).toBe("—");
    });
  });
});
