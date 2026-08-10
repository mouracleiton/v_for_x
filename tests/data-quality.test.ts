import { describe, it, expect } from "vitest";
import backbone from "../data/world_backbone.json";
import type { WorldBackbone } from "../lib/types";
import {
  computeMetricCoverage,
  computeCountryCoverage,
  generateQualityReport,
  coverageColor,
  formatCoverage,
} from "../lib/data-quality";

const data = backbone as WorldBackbone;

describe("computeMetricCoverage", () => {
  it("returns coverage for all surveyed fields", () => {
    const metrics = computeMetricCoverage(data.countries);
    expect(metrics.length).toBeGreaterThan(10);
  });

  it("reports filled count <= total", () => {
    const metrics = computeMetricCoverage(data.countries);
    for (const m of metrics) {
      expect(m.filled).toBeLessThanOrEqual(m.total);
      expect(m.total).toBe(data.countries.length);
    }
  });

  it("computes coverage ratio correctly", () => {
    const metrics = computeMetricCoverage(data.countries);
    for (const m of metrics) {
      expect(m.coverage).toBeCloseTo(m.filled / m.total, 5);
      expect(m.coverage).toBeGreaterThanOrEqual(0);
      expect(m.coverage).toBeLessThanOrEqual(1);
    }
  });

  it("assigns coverage levels", () => {
    const metrics = computeMetricCoverage(data.countries);
    for (const m of metrics) {
      const validLevels = ["complete", "good", "partial", "sparse", "missing"];
      expect(validLevels).toContain(m.level);
    }
  });
});

describe("computeCountryCoverage", () => {
  it("returns coverage for all countries", () => {
    const countries = computeCountryCoverage(data.countries);
    expect(countries.length).toBe(data.countries.length);
  });

  it("sorts by coverage ascending (worst first)", () => {
    const countries = computeCountryCoverage(data.countries);
    for (let i = 0; i < countries.length - 1; i++) {
      expect(countries[i].coverage).toBeLessThanOrEqual(countries[i + 1].coverage);
    }
  });

  it("reports missing fields", () => {
    const countries = computeCountryCoverage(data.countries);
    for (const c of countries) {
      expect(c.missingFields.length + c.filled).toBe(c.total);
    }
  });
});

describe("generateQualityReport", () => {
  it("produces a complete report", () => {
    const report = generateQualityReport(data);
    expect(report.metrics.length).toBeGreaterThan(0);
    expect(report.countries.length).toBe(data.countries.length);
    expect(report.averageCoverage).toBeGreaterThanOrEqual(0);
    expect(report.averageCoverage).toBeLessThanOrEqual(1);
    expect(report.totalFilled).toBeGreaterThan(0);
    expect(report.totalPossible).toBeGreaterThan(0);
  });

  it("counts complete and sparse metrics correctly", () => {
    const report = generateQualityReport(data);
    const expectedComplete = report.metrics.filter((m) => m.coverage >= 0.9).length;
    const expectedSparse = report.metrics.filter((m) => m.coverage < 0.5).length;
    expect(report.completeMetrics).toBe(expectedComplete);
    expect(report.sparseMetrics).toBe(expectedSparse);
  });

  it("totalFilled equals sum of metric fills", () => {
    const report = generateQualityReport(data);
    const sum = report.metrics.reduce((acc, m) => acc + m.filled, 0);
    expect(report.totalFilled).toBe(sum);
  });
});

describe("coverageColor", () => {
  it("returns a CSS value for each level", () => {
    expect(coverageColor("complete")).toBeTruthy();
    expect(coverageColor("good")).toBeTruthy();
    expect(coverageColor("partial")).toBeTruthy();
    expect(coverageColor("sparse")).toBeTruthy();
    expect(coverageColor("missing")).toBeTruthy();
  });
});

describe("formatCoverage", () => {
  it("formats a ratio as percentage", () => {
    expect(formatCoverage(1.0)).toBe("100.0%");
    expect(formatCoverage(0.5)).toBe("50.0%");
    expect(formatCoverage(0.333)).toBe("33.3%");
  });
});
