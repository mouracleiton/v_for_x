import { describe, it, expect } from "vitest";
import {
  pearsonR,
  spearmanR,
  linearRegression,
  correlationPValue,
  interpretR,
  formatPValue,
  significanceStars,
  analyzeCorrelation,
  correlationMatrix,
  strongestCorrelations,
  type MetricDef,
} from "../lib/correlation";
import type { CountryData } from "../lib/types";

/* ═══════════════════════════════════════════════════════════════
   Pearson R
   ═══════════════════════════════════════════════════════════════ */

describe("pearsonR", () => {
  it("returns 1 for perfect positive correlation", () => {
    const pairs = [
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 6 },
      { x: 4, y: 8 },
    ];
    expect(pearsonR(pairs)).toBeCloseTo(1, 5);
  });

  it("returns -1 for perfect negative correlation", () => {
    const pairs = [
      { x: 1, y: 8 },
      { x: 2, y: 6 },
      { x: 3, y: 4 },
      { x: 4, y: 2 },
    ];
    expect(pearsonR(pairs)).toBeCloseTo(-1, 5);
  });

  it("returns 0 for no correlation", () => {
    const pairs = [
      { x: 1, y: 1 },
      { x: 2, y: -1 },
      { x: -1, y: 2 },
      { x: -2, y: -2 },
    ];
    expect(Math.abs(pearsonR(pairs))).toBeLessThan(0.5);
  });

  it("returns 0 for fewer than 2 pairs", () => {
    expect(pearsonR([{ x: 1, y: 1 }])).toBe(0);
    expect(pearsonR([])).toBe(0);
  });

  it("handles constant data (denominator zero)", () => {
    expect(pearsonR([{ x: 5, y: 1 }, { x: 5, y: 2 }])).toBe(0);
  });

  it("computes a known correlation correctly", () => {
    const pairs = [
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 6 },
      { x: 4, y: 8 },
      { x: 5, y: 10 },
    ];
    // Known r ≈ 0.9949
    expect(pearsonR(pairs)).toBeCloseTo(0.9949, 3);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Spearman R
   ═══════════════════════════════════════════════════════════════ */

describe("spearmanR", () => {
  it("returns 1 for monotonic data", () => {
    const pairs = [
      { x: 1, y: 1 },
      { x: 2, y: 4 },
      { x: 3, y: 9 },
      { x: 4, y: 16 },
    ];
    // Monotonic increasing (even though non-linear) → Spearman = 1
    expect(spearmanR(pairs)).toBeCloseTo(1, 5);
  });

  it("returns -1 for monotonic decreasing data", () => {
    const pairs = [
      { x: 1, y: 10 },
      { x: 2, y: 5 },
      { x: 3, y: 1 },
    ];
    expect(spearmanR(pairs)).toBeCloseTo(-1, 5);
  });

  it("handles ties with average ranks", () => {
    const pairs = [
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 3 },
    ];
    const r = spearmanR(pairs);
    expect(r).toBeGreaterThanOrEqual(-1);
    expect(r).toBeLessThanOrEqual(1);
  });

  it("returns 0 for fewer than 2 pairs", () => {
    expect(spearmanR([])).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Linear Regression
   ═══════════════════════════════════════════════════════════════ */

describe("linearRegression", () => {
  it("fits a perfect linear relationship", () => {
    const pairs = [
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
    ];
    const reg = linearRegression(pairs);
    expect(reg.slope).toBeCloseTo(2, 5);
    expect(reg.intercept).toBeCloseTo(1, 5);
    expect(reg.rSquared).toBeCloseTo(1, 5);
  });

  it("returns zero slope for constant x", () => {
    const pairs = [
      { x: 5, y: 1 },
      { x: 5, y: 2 },
    ];
    const reg = linearRegression(pairs);
    expect(reg.slope).toBe(0);
  });

  it("returns zero rSquared for fewer than 2 points", () => {
    expect(linearRegression([{ x: 1, y: 1 }]).rSquared).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════
   P-value
   ═══════════════════════════════════════════════════════════════ */

describe("correlationPValue", () => {
  it("returns very small p-value for strong correlation with large n", () => {
    const p = correlationPValue(0.9, 100);
    expect(p).toBeLessThan(0.001);
  });

  it("returns large p-value for weak correlation", () => {
    const p = correlationPValue(0.01, 50);
    expect(p).toBeGreaterThan(0.5);
  });

  it("returns 1 for n < 3", () => {
    expect(correlationPValue(0.9, 2)).toBe(1);
  });

  it("decreases as |r| increases (holding n constant)", () => {
    const pWeak = correlationPValue(0.3, 50);
    const pStrong = correlationPValue(0.8, 50);
    expect(pStrong).toBeLessThan(pWeak);
  });

  it("decreases as n increases (holding r constant)", () => {
    const pSmallN = correlationPValue(0.5, 10);
    const pLargeN = correlationPValue(0.5, 200);
    expect(pLargeN).toBeLessThan(pSmallN);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Interpretation helpers
   ═══════════════════════════════════════════════════════════════ */

describe("interpretR", () => {
  it("classifies strong positive", () => {
    const i = interpretR(0.85);
    expect(i.strength).toBe("strong");
    expect(i.direction).toBe("positive");
  });

  it("classifies strong negative", () => {
    const i = interpretR(-0.75);
    expect(i.strength).toBe("strong");
    expect(i.direction).toBe("negative");
  });

  it("classifies moderate", () => {
    expect(interpretR(0.55).strength).toBe("moderate");
  });

  it("classifies weak", () => {
    expect(interpretR(0.35).strength).toBe("weak");
  });

  it("classifies negligible", () => {
    expect(interpretR(0.15).strength).toBe("negligible");
  });

  it("classifies none", () => {
    expect(interpretR(0.05).strength).toBe("none");
  });
});

describe("formatPValue", () => {
  it("formats values below 0.001", () => {
    expect(formatPValue(0.0001)).toBe("< 0.001");
  });

  it("formats values between 0.001 and 0.01", () => {
    expect(formatPValue(0.005)).toBe("0.005");
  });

  it("formats values above 0.01", () => {
    expect(formatPValue(0.123)).toBe("0.123");
  });
});

describe("significanceStars", () => {
  it("returns *** for p < 0.001", () => {
    expect(significanceStars(0.0005)).toBe("***");
  });

  it("returns ** for p < 0.01", () => {
    expect(significanceStars(0.005)).toBe("**");
  });

  it("returns * for p < 0.05", () => {
    expect(significanceStars(0.03)).toBe("*");
  });

  it("returns empty string for p >= 0.05", () => {
    expect(significanceStars(0.1)).toBe("");
  });
});

/* ═══════════════════════════════════════════════════════════════
   High-level API with mock country data
   ═══════════════════════════════════════════════════════════════ */

const mockMetrics: MetricDef[] = [
  { id: "a", label: "Metric A", unit: "", extract: (c) => (c as any).a ?? null },
  { id: "b", label: "Metric B", unit: "", extract: (c) => (c as any).b ?? null },
  { id: "c", label: "Metric C", unit: "", extract: (c) => (c as any).c ?? null },
];

function mockCountries(n: number): CountryData[] {
  const out: any[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ a: i, b: i * 2 + 1, c: n - i, iso3: `T${i}` });
  }
  return out as CountryData[];
}

describe("analyzeCorrelation", () => {
  it("returns full result object with all fields", () => {
    const result = analyzeCorrelation(mockCountries(50), mockMetrics[0], mockMetrics[1]);
    expect(result).toHaveProperty("pearsonR");
    expect(result).toHaveProperty("rSquared");
    expect(result).toHaveProperty("spearmanR");
    expect(result).toHaveProperty("pValue");
    expect(result).toHaveProperty("n");
    expect(result).toHaveProperty("significant");
  });

  it("detects strong positive correlation between a and b (linear)", () => {
    const result = analyzeCorrelation(mockCountries(50), mockMetrics[0], mockMetrics[1]);
    expect(result.pearsonR).toBeGreaterThan(0.95);
    expect(result.significant).toBe(true);
  });

  it("detects strong negative correlation between a and c", () => {
    const result = analyzeCorrelation(mockCountries(50), mockMetrics[0], mockMetrics[2]);
    expect(result.pearsonR).toBeLessThan(-0.95);
  });

  it("reports correct sample size", () => {
    const result = analyzeCorrelation(mockCountries(30), mockMetrics[0], mockMetrics[1]);
    expect(result.n).toBe(30);
  });

  it("skips countries with null values", () => {
    const countries: any[] = [
      { a: 1, b: 2 },
      { a: 2, b: null },
      { a: 3, b: 6 },
    ];
    const result = analyzeCorrelation(countries as CountryData[], mockMetrics[0], mockMetrics[1]);
    expect(result.n).toBe(2);
  });
});

describe("correlationMatrix", () => {
  it("returns entries for all unique metric pairs", () => {
    const entries = correlationMatrix(mockCountries(20), mockMetrics);
    // 3 metrics → C(3,2) = 3 pairs
    expect(entries).toHaveLength(3);
  });

  it("sorts by absolute correlation strength (descending)", () => {
    const entries = correlationMatrix(mockCountries(20), mockMetrics);
    for (let i = 0; i < entries.length - 1; i++) {
      expect(Math.abs(entries[i].result.pearsonR)).toBeGreaterThanOrEqual(
        Math.abs(entries[i + 1].result.pearsonR),
      );
    }
  });
});

describe("strongestCorrelations", () => {
  it("excludes the target metric itself", () => {
    const entries = strongestCorrelations(
      mockCountries(20),
      mockMetrics[0],
      mockMetrics,
    );
    expect(entries.every((e) => e.metricB !== mockMetrics[0].id)).toBe(true);
  });

  it("returns sorted by absolute correlation", () => {
    const entries = strongestCorrelations(
      mockCountries(20),
      mockMetrics[0],
      mockMetrics,
    );
    for (let i = 0; i < entries.length - 1; i++) {
      expect(Math.abs(entries[i].result.pearsonR)).toBeGreaterThanOrEqual(
        Math.abs(entries[i + 1].result.pearsonR),
      );
    }
  });

  it("respects minimum sample size", () => {
    const entries = strongestCorrelations(
      mockCountries(5),
      mockMetrics[0],
      mockMetrics,
      10,
    );
    expect(entries).toHaveLength(0);
  });
});
