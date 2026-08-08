import { describe, it, expect } from "vitest";
import {
  buildFlowNodes,
  computeFlowStats,
  estimateFlows,
  flowWidth,
  flowColor,
  type FlowNode,
} from "../lib/flows";

/** Helper to build a mock FlowNode with sensible defaults */
function mockNode(over: Partial<FlowNode>): FlowNode {
  return {
    iso3: "ZZZ",
    name: "Testland",
    region: "Asia",
    isHotspot: false,
    refugeesOrigin: 0,
    refugeesHosted: 0,
    forciblyDisplaced: 0,
    idpsDisaster: 0,
    netMigration: 0,
    popM: 10,
    ...over,
  };
}

describe("flows.ts", () => {
  describe("buildFlowNodes", () => {
    const nodes = buildFlowNodes();

    it("should return a non-empty array", () => {
      expect(Array.isArray(nodes)).toBe(true);
      expect(nodes.length).toBeGreaterThan(0);
    });

    it("each node should have all required fields", () => {
      for (const node of nodes) {
        expect(node).toHaveProperty("iso3");
        expect(node).toHaveProperty("name");
        expect(node).toHaveProperty("region");
        expect(node).toHaveProperty("isHotspot");
        expect(node).toHaveProperty("refugeesOrigin");
        expect(node).toHaveProperty("refugeesHosted");
        expect(node).toHaveProperty("forciblyDisplaced");
        expect(node).toHaveProperty("idpsDisaster");
        expect(node).toHaveProperty("netMigration");
        expect(node).toHaveProperty("popM");
      }
    });

    it("iso3 values should be unique", () => {
      const ids = nodes.map((n) => n.iso3);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("should filter out countries with no refugee/displacement data", () => {
      // The filter keeps nodes where refugeesOrigin > 0 || refugeesHosted > 0 || forciblyDisplaced > 100000
      for (const node of nodes) {
        const hasData =
          node.refugeesOrigin > 0 ||
          node.refugeesHosted > 0 ||
          node.forciblyDisplaced > 100000;
        expect(hasData).toBe(true);
      }
    });

    it("counted numeric fields should be non-negative (fallback to 0)", () => {
      // refugees/displaced/idps use a ?? 0 fallback so are always non-negative numbers
      for (const node of nodes) {
        expect(node.refugeesOrigin).toBeGreaterThanOrEqual(0);
        expect(node.refugeesHosted).toBeGreaterThanOrEqual(0);
        expect(node.forciblyDisplaced).toBeGreaterThanOrEqual(0);
        expect(node.idpsDisaster).toBeGreaterThanOrEqual(0);
      }
    });

    it("popM should be a positive number when present", () => {
      // population_m is sourced without a fallback, so it may be undefined;
      // when present it must be a positive population figure.
      for (const node of nodes) {
        if (node.popM !== undefined && node.popM !== null) {
          expect(node.popM).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("computeFlowStats — with mock nodes", () => {
    const mockNodes: FlowNode[] = [
      mockNode({ iso3: "SYR", name: "Syria", region: "Asia", isHotspot: true, refugeesOrigin: 6800000, forciblyDisplaced: 7000000, idpsDisaster: 100000, netMigration: -1000000, popM: 21 }),
      mockNode({ iso3: "AFG", name: "Afghanistan", region: "Asia", isHotspot: true, refugeesOrigin: 6000000, forciblyDisplaced: 5000000, idpsDisaster: 200000, netMigration: -500000, popM: 40 }),
      mockNode({ iso3: "TUR", name: "Turkey", region: "Asia", refugeesHosted: 3500000, netMigration: 500000, popM: 85 }),
      mockNode({ iso3: "COL", name: "Colombia", region: "Americas", refugeesHosted: 2900000, popM: 51 }),
      mockNode({ iso3: "SSD", name: "South Sudan", region: "Africa", isHotspot: true, refugeesOrigin: 2200000, forciblyDisplaced: 4000000, idpsDisaster: 50000, popM: 11 }),
    ];

    const stats = computeFlowStats(mockNodes);

    it("totalRefugees should be the sum of all refugeesOrigin", () => {
      expect(stats.totalRefugees).toBe(6800000 + 6000000 + 0 + 0 + 2200000);
      expect(stats.totalRefugees).toBe(15000000);
    });

    it("totalDisplaced should be the sum of all forciblyDisplaced", () => {
      expect(stats.totalDisplaced).toBe(7000000 + 5000000 + 0 + 0 + 4000000);
      expect(stats.totalDisplaced).toBe(16000000);
    });

    it("totalIDPs should be the sum of all idpsDisaster", () => {
      expect(stats.totalIDPs).toBe(100000 + 200000 + 0 + 0 + 50000);
      expect(stats.totalIDPs).toBe(350000);
    });

    it("totalHosts should count nodes with refugeesHosted > 0", () => {
      expect(stats.totalHosts).toBe(2); // TUR, COL
    });

    it("totalOrigins should count nodes with refugeesOrigin > 0", () => {
      expect(stats.totalOrigins).toBe(3); // SYR, AFG, SSD
    });

    it("topOrigins should be sorted descending by refugeesOrigin", () => {
      expect(stats.topOrigins.length).toBe(3);
      expect(stats.topOrigins.map((n) => n.iso3)).toEqual(["SYR", "AFG", "SSD"]);
      // verify strictly descending
      for (let i = 1; i < stats.topOrigins.length; i++) {
        expect(stats.topOrigins[i].refugeesOrigin).toBeLessThanOrEqual(
          stats.topOrigins[i - 1].refugeesOrigin
        );
      }
    });

    it("topHosts should be sorted descending by refugeesHosted", () => {
      expect(stats.topHosts.length).toBe(2);
      expect(stats.topHosts.map((n) => n.iso3)).toEqual(["TUR", "COL"]);
      for (let i = 1; i < stats.topHosts.length; i++) {
        expect(stats.topHosts[i].refugeesHosted).toBeLessThanOrEqual(
          stats.topHosts[i - 1].refugeesHosted
        );
      }
    });

    it("worstDisplacementRatio should be sorted descending by displaced-to-population ratio", () => {
      // SSD: 4M / 11M = 0.3636, SYR: 7M / 21M = 0.3333, AFG: 5M / 40M = 0.125
      expect(stats.worstDisplacementRatio.map((n) => n.iso3)).toEqual(["SSD", "SYR", "AFG"]);
      // verify the ratio ordering directly
      const ratio = (n: FlowNode) => n.forciblyDisplaced / (n.popM * 1_000_000);
      for (let i = 1; i < stats.worstDisplacementRatio.length; i++) {
        expect(ratio(stats.worstDisplacementRatio[i])).toBeLessThanOrEqual(
          ratio(stats.worstDisplacementRatio[i - 1])
        );
      }
    });
  });

  describe("estimateFlows — with mock nodes", () => {
    // Two origins and two hosts, all in Asia so flows are regional and deterministic
    const mockNodes: FlowNode[] = [
      mockNode({ iso3: "SYR", name: "Syria", region: "Asia", refugeesOrigin: 6800000, popM: 21 }),
      mockNode({ iso3: "AFG", name: "Afghanistan", region: "Asia", refugeesOrigin: 6000000, popM: 40 }),
      mockNode({ iso3: "TUR", name: "Turkey", region: "Asia", refugeesHosted: 3500000, popM: 85 }),
      mockNode({ iso3: "IRN", name: "Iran", region: "Asia", refugeesHosted: 3400000, popM: 88 }),
    ];

    const edges = estimateFlows(mockNodes);

    it("should return a non-empty array of edges", () => {
      expect(Array.isArray(edges)).toBe(true);
      expect(edges.length).toBeGreaterThan(0);
    });

    it("each edge should have from/to/estimatedFlow/type fields", () => {
      for (const edge of edges) {
        expect(edge).toHaveProperty("from");
        expect(edge).toHaveProperty("fromName");
        expect(edge).toHaveProperty("to");
        expect(edge).toHaveProperty("toName");
        expect(edge).toHaveProperty("estimatedFlow");
        expect(edge).toHaveProperty("type");
        expect(["regional", "continental"]).toContain(edge.type);
        expect(edge.estimatedFlow).toBeGreaterThan(0);
      }
    });

    it("edges should be sorted by estimatedFlow descending", () => {
      for (let i = 1; i < edges.length; i++) {
        expect(edges[i].estimatedFlow).toBeLessThanOrEqual(edges[i - 1].estimatedFlow);
      }
    });

    it("all `from` values should be origin countries (refugeesOrigin > 50000)", () => {
      const originIsos = mockNodes.filter((n) => n.refugeesOrigin > 50000).map((n) => n.iso3);
      for (const edge of edges) {
        expect(originIsos).toContain(edge.from);
      }
    });

    it("all `to` values should be host countries (refugeesHosted > 50000)", () => {
      const hostIsos = mockNodes.filter((n) => n.refugeesHosted > 50000).map((n) => n.iso3);
      for (const edge of edges) {
        expect(hostIsos).toContain(edge.to);
      }
    });

    it("largest edge should originate from the biggest origin", () => {
      // SYR (6.8M) > AFG (6M), so the top edge must come from SYR
      expect(edges[0].from).toBe("SYR");
    });

    it("no edge should be a self-loop", () => {
      for (const edge of edges) {
        expect(edge.from).not.toBe(edge.to);
      }
    });
  });

  describe("estimateFlows — mixed regions", () => {
    it("should classify same-region flows as regional and cross-group as continental", () => {
      const mockNodes: FlowNode[] = [
        mockNode({ iso3: "SYR", name: "Syria", region: "Asia", refugeesOrigin: 6800000, popM: 21 }),
        mockNode({ iso3: "TUR", name: "Turkey", region: "Asia", refugeesHosted: 3500000, popM: 85 }),
        mockNode({ iso3: "DEU", name: "Germany", region: "Europe", refugeesHosted: 2000000, popM: 84 }),
        mockNode({ iso3: "USA", name: "United States", region: "Americas", refugeesHosted: 2000000, popM: 333 }),
      ];
      const edges = estimateFlows(mockNodes);

      // TUR (Asia) is in same region as SYR (Asia) -> regional
      const turEdge = edges.find((e) => e.to === "TUR");
      expect(turEdge).toBeDefined();
      expect(turEdge!.type).toBe("regional");

      // DEU (Europe) and USA (Americas) are different regions but nearby to Asia
      // (Europe shares "afroeurasia" group) -> continental
      const deuEdge = edges.find((e) => e.to === "DEU");
      if (deuEdge) {
        expect(deuEdge.type).toBe("continental");
      }
    });
  });

  describe("flowWidth", () => {
    const maxFlow = 1000;

    it("should return 1 for flow = 0", () => {
      expect(flowWidth(0, maxFlow)).toBe(1);
    });

    it("should return 9 for flow = maxFlow", () => {
      // 1 + (maxFlow/maxFlow)*8 = 1 + 8 = 9
      expect(flowWidth(maxFlow, maxFlow)).toBe(9);
    });

    it("should return 5 for flow = maxFlow/2", () => {
      // 1 + (0.5)*8 = 5
      expect(flowWidth(maxFlow / 2, maxFlow)).toBe(5);
    });

    it("should scale linearly within [1, 9]", () => {
      expect(flowWidth(maxFlow / 4, maxFlow)).toBeCloseTo(3, 5); // 1 + 0.25*8 = 3
      expect(flowWidth(maxFlow / 8, maxFlow)).toBeCloseTo(2, 5); // 1 + 0.125*8 = 2
    });
  });

  describe("flowColor", () => {
    it("should return #e10600 for regional", () => {
      expect(flowColor("regional")).toBe("#e10600");
    });

    it("should return #ff6600 for continental", () => {
      expect(flowColor("continental")).toBe("#ff6600");
    });

    it("should return distinct colors for each type", () => {
      expect(flowColor("regional")).not.toBe(flowColor("continental"));
    });
  });

  describe("edge cases — empty nodes array", () => {
    it("computeFlowStats on empty array should report zero totals", () => {
      const stats = computeFlowStats([]);
      expect(stats.totalRefugees).toBe(0);
      expect(stats.totalDisplaced).toBe(0);
      expect(stats.totalIDPs).toBe(0);
      expect(stats.totalHosts).toBe(0);
      expect(stats.totalOrigins).toBe(0);
      expect(stats.topOrigins).toEqual([]);
      expect(stats.topHosts).toEqual([]);
      expect(stats.worstDisplacementRatio).toEqual([]);
    });

    it("estimateFlows on empty array should return empty array", () => {
      const edges = estimateFlows([]);
      expect(Array.isArray(edges)).toBe(true);
      expect(edges).toHaveLength(0);
    });

    it("estimateFlows on nodes with no qualifying origins/hosts should return empty array", () => {
      // All values below thresholds (>50000 required)
      const lowNodes: FlowNode[] = [
        mockNode({ iso3: "AAA", name: "A", region: "Asia", refugeesOrigin: 1000, refugeesHosted: 1000 }),
        mockNode({ iso3: "BBB", name: "B", region: "Asia", refugeesOrigin: 500, refugeesHosted: 500 }),
      ];
      const edges = estimateFlows(lowNodes);
      expect(edges).toHaveLength(0);
    });
  });
});
