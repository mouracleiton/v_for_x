/**
 * V FOR X — Relationships Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  loadRelationshipsData,
  clearRelationshipsCache,
  getArmsTransfersForCountry,
  getArmsSupplied,
  getArmsReceived,
  getTotalArmsSupplied,
  getTotalArmsReceived,
  getTopArmsSuppliers,
  getTopArmsRecipients,
  getSanctionsForCountry,
  getSanctionsImposed,
  getSanctionsReceived,
  getMostSanctioned,
  hasSanction,
  getAidFlowsForCountry,
  getAidProvided,
  getAidReceived,
  getTotalAidProvided,
  getTotalAidReceived,
  getTopAidDonors,
  getTopAidRecipients,
  computeCountryFlows,
  getAllFlowCorridors,
  generateRelationshipsStats,
  formatMusd,
  getFlowColor,
  getFlowIcon,
  type RelationshipsData,
} from "../lib/relationships";

// Mock fetch
const mockData: RelationshipsData = {
  meta: {
    title: "Test Relationships",
    description: "Test data",
    sources: ["Test"],
    note: "Test only",
  },
  arms_transfers: [
    { source_iso3: "USA", target_iso3: "SAU", value_musd: 11500, category: "aircraft" },
    { source_iso3: "USA", target_iso3: "UKR", value_musd: 3500, category: "missiles" },
    { source_iso3: "RUS", target_iso3: "IND", value_musd: 6800, category: "air defense" },
    { source_iso3: "RUS", target_iso3: "IRN", value_musd: 1500, category: "fighters" },
    { source_iso3: "CHN", target_iso3: "PAK", value_musd: 6500, category: "frigates" },
  ],
  sanctions: [
    { imposer_iso3: "USA", target_iso3: "IRN", type: "comprehensive" },
    { imposer_iso3: "USA", target_iso3: "RUS", type: "sectoral" },
    { imposer_iso3: "EU", target_iso3: "RUS", type: "sectoral" },
    { imposer_iso3: "UN", target_iso3: "PRK", type: "nuclear / missile" },
  ],
  aid_flows: [
    { donor_iso3: "USA", recipient_iso3: "UKR", amount_musd: 8000 },
    { donor_iso3: "USA", recipient_iso3: "ETH", amount_musd: 1800 },
    { donor_iso3: "DEU", recipient_iso3: "UKR", amount_musd: 3000 },
    { donor_iso3: "GBR", recipient_iso3: "YEM", amount_musd: 500 },
  ],
};

describe("relationships.ts — Arms Transfers", () => {
  beforeEach(() => {
    clearRelationshipsCache();
    global.fetch = async () =>
      Promise.resolve({
        ok: true,
        json: async () => mockData,
      } as Response);
  });

  afterEach(() => {
    clearRelationshipsCache();
  });

  it("should load relationships data", async () => {
    const data = await loadRelationshipsData();
    expect(data).toBeDefined();
    expect(data.arms_transfers).toHaveLength(5);
    expect(data.sanctions).toHaveLength(4);
    expect(data.aid_flows).toHaveLength(4);
  });

  it("should get arms transfers for a country", async () => {
    const data = await loadRelationshipsData();
    const usaArms = getArmsTransfersForCountry(data, "USA");
    expect(usaArms).toHaveLength(2);
    expect(usaArms[0].source_iso3).toBe("USA");
  });

  it("should get arms supplied by a country", async () => {
    const data = await loadRelationshipsData();
    const usaSupplied = getArmsSupplied(data, "USA");
    expect(usaSupplied).toHaveLength(2);
    expect(usaSupplied.every((t) => t.source_iso3 === "USA")).toBe(true);
  });

  it("should get arms received by a country", async () => {
    const data = await loadRelationshipsData();
    const ukrReceived = getArmsReceived(data, "UKR");
    expect(ukrReceived).toHaveLength(1);
    expect(ukrReceived[0].target_iso3).toBe("UKR");
    expect(ukrReceived[0].value_musd).toBe(3500);
  });

  it("should calculate total arms supplied", async () => {
    const data = await loadRelationshipsData();
    const usaTotal = getTotalArmsSupplied(data, "USA");
    expect(usaTotal).toBe(11500 + 3500); // 15000
  });

  it("should calculate total arms received", async () => {
    const data = await loadRelationshipsData();
    const ukrTotal = getTotalArmsReceived(data, "UKR");
    expect(ukrTotal).toBe(3500);
  });

  it("should get top arms suppliers", async () => {
    const data = await loadRelationshipsData();
    const topSuppliers = getTopArmsSuppliers(data, 3);
    expect(topSuppliers).toHaveLength(3);
    expect(topSuppliers[0].iso3).toBe("USA"); // 11500 + 3500 = 15000
    expect(topSuppliers[0].value).toBe(15000);
  });

  it("should get top arms recipients", async () => {
    const data = await loadRelationshipsData();
    const topRecipients = getTopArmsRecipients(data, 3);
    expect(topRecipients).toHaveLength(3);
    expect(topRecipients[0].iso3).toBe("SAU"); // 11500
  });
});

describe("relationships.ts — Sanctions", () => {
  beforeEach(() => {
    clearRelationshipsCache();
    global.fetch = async () =>
      Promise.resolve({
        ok: true,
        json: async () => mockData,
      } as Response);
  });

  it("should get sanctions for a country", async () => {
    const data = await loadRelationshipsData();
    const rusSanctions = getSanctionsForCountry(data, "RUS");
    expect(rusSanctions).toHaveLength(2); // USA and EU impose on RUS
  });

  it("should get sanctions imposed by a country", async () => {
    const data = await loadRelationshipsData();
    const usaImposed = getSanctionsImposed(data, "USA");
    expect(usaImposed).toHaveLength(2); // IRN and RUS
    expect(usaImposed.every((s) => s.imposer_iso3 === "USA")).toBe(true);
  });

  it("should get sanctions received by a country", async () => {
    const data = await loadRelationshipsData();
    const rusReceived = getSanctionsReceived(data, "RUS");
    expect(rusReceived).toHaveLength(2);
    expect(rusReceived.every((s) => s.target_iso3 === "RUS")).toBe(true);
  });

  it("should get most sanctioned countries", async () => {
    const data = await loadRelationshipsData();
    const mostSanctioned = getMostSanctioned(data, 5);
    expect(mostSanctioned.length).toBeGreaterThan(0); // RUS (2), IRN (1), PRK (1) = 3 unique targets
    expect(mostSanctioned[0].iso3).toBe("RUS");
    expect(mostSanctioned[0].count).toBe(2);
  });

  it("should check if specific sanction exists", async () => {
    const data = await loadRelationshipsData();
    expect(hasSanction(data, "USA", "IRN")).toBe(true);
    expect(hasSanction(data, "USA", "RUS")).toBe(true);
    expect(hasSanction(data, "USA", "CHN")).toBe(false);
  });
});

describe("relationships.ts — Aid Flows", () => {
  beforeEach(() => {
    clearRelationshipsCache();
    global.fetch = async () =>
      Promise.resolve({
        ok: true,
        json: async () => mockData,
      } as Response);
  });

  it("should get aid flows for a country", async () => {
    const data = await loadRelationshipsData();
    const usaAid = getAidFlowsForCountry(data, "USA");
    expect(usaAid).toHaveLength(2); // UKR and ETH
  });

  it("should get aid provided by a country", async () => {
    const data = await loadRelationshipsData();
    const usaProvided = getAidProvided(data, "USA");
    expect(usaProvided).toHaveLength(2);
    expect(usaProvided.every((f) => f.donor_iso3 === "USA")).toBe(true);
  });

  it("should get aid received by a country", async () => {
    const data = await loadRelationshipsData();
    const ukrReceived = getAidReceived(data, "UKR");
    expect(ukrReceived).toHaveLength(2); // USA and DEU
    expect(ukrReceived.every((f) => f.recipient_iso3 === "UKR")).toBe(true);
  });

  it("should calculate total aid provided", async () => {
    const data = await loadRelationshipsData();
    const usaTotal = getTotalAidProvided(data, "USA");
    expect(usaTotal).toBe(8000 + 1800); // 9800
  });

  it("should calculate total aid received", async () => {
    const data = await loadRelationshipsData();
    const ukrTotal = getTotalAidReceived(data, "UKR");
    expect(ukrTotal).toBe(8000 + 3000); // 11000
  });

  it("should get top aid donors", async () => {
    const data = await loadRelationshipsData();
    const topDonors = getTopAidDonors(data, 3);
    expect(topDonors).toHaveLength(3);
    expect(topDonors[0].iso3).toBe("USA"); // 9800
    expect(topDonors[0].value).toBe(9800);
  });

  it("should get top aid recipients", async () => {
    const data = await loadRelationshipsData();
    const topRecipients = getTopAidRecipients(data, 3);
    expect(topRecipients).toHaveLength(3);
    expect(topRecipients[0].iso3).toBe("UKR"); // 11000
    expect(topRecipients[0].value).toBe(11000);
  });
});

describe("relationships.ts — Composite Analysis", () => {
  beforeEach(() => {
    clearRelationshipsCache();
    global.fetch = async () =>
      Promise.resolve({
        ok: true,
        json: async () => mockData,
      } as Response);
  });

  it("should compute country flows", async () => {
    const data = await loadRelationshipsData();
    const countryNames: Record<string, string> = {
      USA: "United States",
      RUS: "Russia",
      UKR: "Ukraine",
      SAU: "Saudi Arabia",
      IND: "India",
    };
    const flows = computeCountryFlows(data, countryNames);
    expect(flows.length).toBeGreaterThan(0);

    const usaFlows = flows.find((f) => f.iso3 === "USA");
    expect(usaFlows).toBeDefined();
    expect(usaFlows?.armsSupplied).toBe(15000);
    expect(usaFlows?.aidProvided).toBe(9800);
    expect(usaFlows?.sanctionsImposed).toBe(2);
  });

  it("should compute net flows correctly", async () => {
    const data = await loadRelationshipsData();
    const countryNames: Record<string, string> = {
      USA: "United States",
      UKR: "Ukraine",
    };
    const flows = computeCountryFlows(data, countryNames);

    const usaFlows = flows.find((f) => f.iso3 === "USA");
    expect(usaFlows?.netArmsFlow).toBeLessThan(0); // USA exports more than imports
    expect(usaFlows?.netAidFlow).toBeLessThan(0); // USA gives more than receives

    const ukrFlows = flows.find((f) => f.iso3 === "UKR");
    expect(ukrFlows?.netArmsFlow).toBeGreaterThan(0); // UKR receives more than exports
    expect(ukrFlows?.netAidFlow).toBeGreaterThan(0); // UKR receives more than gives
  });

  it("should get all flow corridors", async () => {
    const data = await loadRelationshipsData();
    const corridors = getAllFlowCorridors(data);
    expect(corridors.length).toBe(5 + 4 + 4); // arms + sanctions + aid

    const armsCorridors = corridors.filter((c) => c.type === "arms");
    expect(armsCorridors.length).toBe(5);

    const sanctionsCorridors = corridors.filter((c) => c.type === "sanctions");
    expect(sanctionsCorridors.length).toBe(4);

    const aidCorridors = corridors.filter((c) => c.type === "aid");
    expect(aidCorridors.length).toBe(4);
  });

  it("should generate relationships stats", async () => {
    const data = await loadRelationshipsData();
    const stats = generateRelationshipsStats(data);

    expect(stats.totalArmsTransfers).toBe(5);
    expect(stats.totalArmsValue).toBe(29800); // Sum of all arms values
    expect(stats.totalSanctions).toBe(4);
    expect(stats.totalAidFlows).toBe(4);
    expect(stats.totalAidValue).toBe(13300); // Sum of all aid values
    expect(stats.topArmsSuppliers.length).toBeGreaterThan(0); // 3 suppliers in mock data
    expect(stats.topAidDonors.length).toBeGreaterThan(0);
    expect(stats.mostSanctioned.length).toBeGreaterThan(0);
  });
});

describe("relationships.ts — Formatting & Display", () => {
  it("should format millions USD correctly", () => {
    expect(formatMusd(100)).toBe("$100M");
    expect(formatMusd(999)).toBe("$999M");
    expect(formatMusd(1000)).toBe("$1.0B");
    expect(formatMusd(1500)).toBe("$1.5B");
    expect(formatMusd(10000)).toBe("$10.0B");
  });

  it("should get flow colors", () => {
    expect(getFlowColor("arms")).toContain("var(--color-blood");
    expect(getFlowColor("sanctions")).toContain("var(--color-warning");
    expect(getFlowColor("aid")).toContain("var(--color-terminal-green");
  });

  it("should get flow icons", () => {
    expect(getFlowIcon("arms")).toBe("🔫");
    expect(getFlowIcon("sanctions")).toBe("⚖️");
    expect(getFlowIcon("aid")).toBe("🏥");
  });
});

describe("relationships.ts — Error Handling", () => {
  beforeEach(() => {
    clearRelationshipsCache();
  });

  it("should return empty structure on fetch error", async () => {
    global.fetch = async () =>
      Promise.reject(new Error("Network error"));

    const data = await loadRelationshipsData();
    expect(data).toBeDefined();
    expect(data.arms_transfers).toHaveLength(0);
    expect(data.sanctions).toHaveLength(0);
    expect(data.aid_flows).toHaveLength(0);
  });

  it("should return empty structure on non-OK response", async () => {
    global.fetch = async () =>
      Promise.resolve({
        ok: false,
        statusText: "Not Found",
      } as Response);

    const data = await loadRelationshipsData();
    expect(data).toBeDefined();
    expect(data.arms_transfers).toHaveLength(0);
  });

  it("should return empty arrays for non-existent countries", async () => {
    global.fetch = async () =>
      Promise.resolve({
        ok: true,
        json: async () => mockData,
      } as Response);

    const data = await loadRelationshipsData();
    const xyzArms = getArmsTransfersForCountry(data, "XYZ");
    expect(xyzArms).toHaveLength(0);

    const xyzSanctions = getSanctionsForCountry(data, "XYZ");
    expect(xyzSanctions).toHaveLength(0);

    const xyzAid = getAidFlowsForCountry(data, "XYZ");
    expect(xyzAid).toHaveLength(0);
  });

  it("should return zero totals for non-existent countries", async () => {
    global.fetch = async () =>
      Promise.resolve({
        ok: true,
        json: async () => mockData,
      } as Response);

    const data = await loadRelationshipsData();
    expect(getTotalArmsSupplied(data, "XYZ")).toBe(0);
    expect(getTotalArmsReceived(data, "XYZ")).toBe(0);
    expect(getTotalAidProvided(data, "XYZ")).toBe(0);
    expect(getTotalAidReceived(data, "XYZ")).toBe(0);
  });

  it("should handle empty data gracefully", async () => {
    const emptyData: RelationshipsData = {
      meta: {
        title: "Empty",
        description: "",
        sources: [],
        note: "",
      },
      arms_transfers: [],
      sanctions: [],
      aid_flows: [],
    };

    global.fetch = async () =>
      Promise.resolve({
        ok: true,
        json: async () => emptyData,
      } as Response);

    const data = await loadRelationshipsData();
    const stats = generateRelationshipsStats(data);

    expect(stats.totalArmsTransfers).toBe(0);
    expect(stats.totalArmsValue).toBe(0);
    expect(stats.totalSanctions).toBe(0);
    expect(stats.totalAidFlows).toBe(0);
    expect(stats.totalAidValue).toBe(0);
  });
});
