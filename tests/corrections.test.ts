import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addCorrection,
  listCorrections,
  correctionsForCountry,
  getCorrection,
  updateCorrectionStatus,
  deleteCorrection,
  clearCorrections,
  buildCorrectionPackage,
  parseCorrectionPackage,
  importCorrectionPackage,
  correctionStats,
  type DataCorrection,
} from "../lib/corrections";

const memory: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => memory[key] ?? null,
  setItem: (key: string, value: string) => { memory[key] = value; },
  removeItem: (key: string) => { delete memory[key]; },
  clear: () => { for (const k of Object.keys(memory)) delete memory[k]; },
};
vi.stubGlobal("localStorage", localStorageMock);

beforeEach(() => {
  for (const k of Object.keys(memory)) delete memory[k];
  clearCorrections();
});

type CorrectionInput = Omit<DataCorrection, "id" | "ts" | "status" | "signature" | "handle">;

function input(over: Partial<CorrectionInput> = {}): CorrectionInput {
  return {
    iso3: "BRA",
    countryName: "Brazil",
    metricPath: "hunger.prevalence_pct",
    metricLabel: "Hunger Prevalence (%)",
    reportedValue: "4.1",
    correctedValue: "5.2",
    sourceUrl: "https://example.org/source",
    note: "latest household survey disagrees",
    ...over,
  };
}

describe("corrections CRUD", () => {
  it("adds a correction with generated id, ts, and open status", async () => {
    const c = await addCorrection(input());
    expect(c.id).toMatch(/^vfx-cor-/);
    expect(typeof c.ts).toBe("number");
    expect(c.status).toBe("open");
    expect(c.sourceUrl).toBe("https://example.org/source");
    expect(c.note).toBe("latest household survey disagrees");
  });

  it("adds newest-first ordering", async () => {
    await addCorrection(input({ correctedValue: "A" }));
    await addCorrection(input({ correctedValue: "B" }));
    const list = listCorrections();
    expect(list).toHaveLength(2);
    expect(list[0].correctedValue).toBe("B");
  });

  it("filters by country (case-insensitive)", async () => {
    await addCorrection(input({ iso3: "BRA" }));
    await addCorrection(input({ iso3: "eth" }));
    expect(correctionsForCountry("bra")).toHaveLength(1);
    expect(correctionsForCountry("BRA")[0].iso3).toBe("BRA");
    expect(correctionsForCountry("ETH")[0].iso3).toBe("eth");
  });

  it("gets a correction by id", async () => {
    const c = await addCorrection(input());
    expect(getCorrection(c.id)?.correctedValue).toBe("5.2");
    expect(getCorrection("nope")).toBeNull();
  });

  it("updates status", async () => {
    const c = await addCorrection(input());
    updateCorrectionStatus(c.id, "verified");
    expect(getCorrection(c.id)?.status).toBe("verified");
    updateCorrectionStatus(c.id, "rejected");
    expect(getCorrection(c.id)?.status).toBe("rejected");
    updateCorrectionStatus("missing", "verified");
  });

  it("deletes a correction", async () => {
    const c = await addCorrection(input());
    deleteCorrection(c.id);
    expect(listCorrections()).toHaveLength(0);
  });
});

describe("signing", () => {
  const hasCrypto = typeof window !== "undefined" && !!window.crypto?.subtle;

  it("signs with an ephemeral ECDSA key when Web Crypto is available", async () => {
    const c = await addCorrection(input());
    if (!hasCrypto) {
      expect(c.signature).toBeUndefined();
      return;
    }
    expect(c.signature).toBeDefined();
    expect(c.handle).toBeDefined();
    expect(c.handle).toMatch(/^[0-9a-f]{16}$/);
    expect(c.signature).toMatch(/^[0-9a-f]+$/);
  });

  it("never produces signature without handle or handle without signature", async () => {
    const c = await addCorrection(input());
    expect((c.signature !== undefined) === (c.handle !== undefined)).toBe(true);
  });

  it("preserves optional fields when omitted", async () => {
    const c = await addCorrection(input({ sourceUrl: undefined, note: undefined }));
    expect(c.sourceUrl).toBeUndefined();
    expect(c.note).toBeUndefined();
  });
});

describe("package export/import", () => {
  it("builds a valid portable package", async () => {
    const a = await addCorrection(input({ correctedValue: "X" }));
    const b = await addCorrection(input({ correctedValue: "Y" }));
    const pkg = buildCorrectionPackage(listCorrections());
    expect(pkg.format).toBe("vfx-corrections");
    expect(pkg.version).toBe(1);
    expect(pkg.exportedAt).toBeTruthy();
    expect(pkg.corrections).toHaveLength(2);
    expect(pkg.corrections.map((c) => c.id)).toContain(a.id);
    expect(pkg.corrections.map((c) => c.id)).toContain(b.id);
  });

  it("parses valid and rejects malformed packages", () => {
    expect(parseCorrectionPackage(buildCorrectionPackage([]))).not.toBeNull();
    expect(parseCorrectionPackage(null)).toBeNull();
    expect(parseCorrectionPackage(42)).toBeNull();
    expect(parseCorrectionPackage({ format: "other", corrections: [] })).toBeNull();
    expect(parseCorrectionPackage({ format: "vfx-corrections" })).toBeNull();
    expect(
      parseCorrectionPackage({ format: "vfx-corrections", corrections: [{ junk: true }] }),
    ).toBeNull();
  });

  it("round-trips import into a fresh store", async () => {
    const c = await addCorrection(input());
    const pkg = buildCorrectionPackage([c]);
    clearCorrections();
    expect(listCorrections()).toHaveLength(0);
    const imported = importCorrectionPackage(pkg);
    expect(imported).toBe(1);
    expect(listCorrections()).toHaveLength(1);
    expect(listCorrections()[0].id).toBe(c.id);
    expect(listCorrections()[0].correctedValue).toBe("5.2");
  });

  it("dedupes by id on import", async () => {
    const a = await addCorrection(input({ correctedValue: "1" }));
    const b = await addCorrection(input({ correctedValue: "2" }));
    const pkg = buildCorrectionPackage([a, b, a]);
    const imported = importCorrectionPackage(pkg);
    expect(imported).toBe(0);
    expect(listCorrections()).toHaveLength(2);
  });

  it("merges foreign entries and skips duplicates", async () => {
    const local = await addCorrection(input({ correctedValue: "local" }));
    const foreign: DataCorrection = { ...input({ correctedValue: "foreign" }), id: "vfx-cor-from-elsewhere", ts: 1, status: "open" };
    const pkg = buildCorrectionPackage([local, foreign]);
    const imported = importCorrectionPackage(pkg);
    expect(imported).toBe(1);
    expect(listCorrections()).toHaveLength(2);
  });
});

describe("correctionStats", () => {
  it("counts totals, statuses, countries, and signed", async () => {
    const a = await addCorrection(input({ iso3: "BRA" }));
    const b = await addCorrection(input({ iso3: "ETH" }));
    await addCorrection(input({ iso3: "BRA" }));
    updateCorrectionStatus(a.id, "verified");
    updateCorrectionStatus(b.id, "rejected");
    const s = correctionStats();
    expect(s.total).toBe(3);
    expect(s.byStatus).toEqual({ open: 1, verified: 1, rejected: 1 });
    expect(s.byCountry).toBe(2);
    expect(s.signed).toBeGreaterThanOrEqual(0);
    expect(s.signed).toBeLessThanOrEqual(3);
  });
});
