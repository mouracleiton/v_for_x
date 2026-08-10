import { describe, it, expect } from "vitest";
import {
  TRANSPORTS,
  TRANSPORT_ORDER,
  baseScore,
  latencyScore,
  throughputScore,
  scoreResult,
  statusPriority,
  rankTransports,
  recommend,
  emptyResult,
  latencyRating,
  throughputRating,
  statusColor,
  statusLabel,
  formatThroughput,
  formatLatency,
  runAllProbes,
  type ProbeMap,
  type ProbeResult,
  type TransportId,
} from "../lib/stepping-stone";

function result(transport: TransportId, over: Partial<ProbeResult> = {}): ProbeResult {
  return {
    transport,
    status: "unknown",
    latencyMs: null,
    throughputKbps: null,
    detail: "",
    evidence: [],
    measuredAt: 0,
    ...over,
  };
}

describe("stepping-stone.ts", () => {
  describe("baseScore", () => {
    it("awards points by status in the expected order", () => {
      expect(baseScore("working")).toBeGreaterThan(baseScore("degraded"));
      expect(baseScore("degraded")).toBeGreaterThan(baseScore("unknown"));
      expect(baseScore("unknown")).toBeGreaterThan(baseScore("blocked"));
      expect(baseScore("blocked")).toBe(0);
    });
  });

  describe("latencyScore", () => {
    it("gives full marks at or below the floor", () => {
      expect(latencyScore(0)).toBe(25);
      expect(latencyScore(50)).toBe(25);
    });
    it("gives zero at or above the ceiling", () => {
      expect(latencyScore(800)).toBe(0);
      expect(latencyScore(5000)).toBe(0);
    });
    it("is monotonically decreasing in between", () => {
      const a = latencyScore(100);
      const b = latencyScore(300);
      const c = latencyScore(600);
      expect(a).toBeGreaterThan(b);
      expect(b).toBeGreaterThan(c);
      expect(c).toBeGreaterThan(0);
    });
    it("handles null / invalid input", () => {
      expect(latencyScore(null)).toBe(0);
      expect(latencyScore(undefined as unknown as number)).toBe(0);
      expect(latencyScore(NaN)).toBe(0);
      expect(latencyScore(-10)).toBe(0);
    });
  });

  describe("throughputScore", () => {
    it("gives full marks at the ceiling", () => {
      expect(throughputScore(1000, 1000)).toBe(25);
      expect(throughputScore(2000, 1000)).toBe(25); // capped
    });
    it("gives zero for null / non-positive", () => {
      expect(throughputScore(null, 1000)).toBe(0);
      expect(throughputScore(0, 1000)).toBe(0);
      expect(throughputScore(-5, 1000)).toBe(0);
      expect(throughputScore(500, 0)).toBe(0);
    });
    it("uses a sqrt curve so low bandwidth still scores", () => {
      // At 25% of ceiling, sqrt(0.25) = 0.5 → ~12-13 points
      const score = throughputScore(250, 1000);
      expect(score).toBeGreaterThan(10);
      expect(score).toBeLessThan(15);
    });
  });

  describe("scoreResult", () => {
    it("never exceeds 100 or drops below 0", () => {
      const def = TRANSPORTS.direct;
      const perfect = scoreResult(result("direct", { status: "working", latencyMs: 5, throughputKbps: 50000 }), def);
      const worst = scoreResult(result("direct", { status: "blocked", latencyMs: 5000, throughputKbps: 0 }), def);
      expect(perfect).toBeLessThanOrEqual(100);
      expect(worst).toBeGreaterThanOrEqual(0);
    });
    it("ranks a working fast fat path above a blocked one", () => {
      const def = TRANSPORTS.snowflake;
      const good = scoreResult(result("snowflake", { status: "working", latencyMs: 60, throughputKbps: 3000 }), def);
      const bad = scoreResult(result("snowflake", { status: "blocked", latencyMs: null, throughputKbps: null }), def);
      expect(good).toBeGreaterThan(bad);
    });
    it("applies reliability weight (direct > domain_fronting at equal raw)", () => {
      const direct = TRANSPORTS.direct;
      const front = TRANSPORTS.domain_fronting;
      const base = { status: "working" as const, latencyMs: 60, throughputKbps: 1000 };
      const sDirect = scoreResult(result("direct", base), direct);
      const sFront = scoreResult(result("domain_fronting", base), front);
      expect(sDirect).toBeGreaterThan(sFront); // front has lower reliability weight
    });
  });

  describe("statusPriority / statusColor / statusLabel", () => {
    it("orders statuses for sorting", () => {
      expect(statusPriority("working")).toBeLessThan(statusPriority("degraded"));
      expect(statusPriority("degraded")).toBeLessThan(statusPriority("unknown"));
      expect(statusPriority("unknown")).toBeLessThan(statusPriority("blocked"));
    });
    it("maps statuses to pill colors", () => {
      expect(statusColor("working")).toBe("green");
      expect(statusColor("degraded")).toBe("amber");
      expect(statusColor("blocked")).toBe("blood");
      expect(statusColor("unknown")).toBe("dim");
    });
    it("uppercases status labels", () => {
      expect(statusLabel("working")).toBe("WORKING");
      expect(statusLabel("unknown")).toBe("UNKNOWN");
    });
  });

  describe("rankTransports", () => {
    it("returns all transports, ranked, with stable 1-based ranks", () => {
      const ranked = rankTransports({});
      expect(ranked).toHaveLength(TRANSPORT_ORDER.length);
      expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
      ranked.forEach((r) => expect(r.result.status).toBe("unknown"));
    });
    it("puts the best working transport first", () => {
      const map: ProbeMap = {
        direct: result("direct", { status: "working", latencyMs: 30, throughputKbps: 10000 }),
        snowflake: result("snowflake", { status: "working", latencyMs: 120, throughputKbps: 1500 }),
        domain_fronting: result("domain_fronting", { status: "blocked", latencyMs: null, throughputKbps: null }),
        masque: result("masque", { status: "degraded", latencyMs: 300, throughputKbps: 400 }),
      };
      const ranked = rankTransports(map);
      expect(ranked[0].def.id).toBe("direct");
      expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
      expect(ranked.at(-1)!.def.id).toBe("domain_fronting");
    });
    it("is stable: equal scores keep definition order", () => {
      const map: ProbeMap = {
        direct: result("direct", { status: "blocked", latencyMs: null, throughputKbps: null }),
        domain_fronting: result("domain_fronting", { status: "blocked", latencyMs: null, throughputKbps: null }),
        snowflake: result("snowflake", { status: "blocked", latencyMs: null, throughputKbps: null }),
        masque: result("masque", { status: "blocked", latencyMs: null, throughputKbps: null }),
      };
      const ranked = rankTransports(map);
      expect(ranked.map((r) => r.def.id)).toEqual(TRANSPORT_ORDER);
    });
  });

  describe("recommend — verdicts", () => {
    it("returns 'unknown' when nothing has been probed", () => {
      const rec = recommend({});
      expect(rec.verdict).toBe("unknown");
      expect(rec.summary).toMatch(/NOT TESTED/i);
      // Untested transports still carry the "unknown" base score.
      expect(rec.bestScore).toBeLessThanOrEqual(baseScore("unknown"));
    });

    it("returns 'clear' when the direct baseline works", () => {
      const rec = recommend({
        direct: result("direct", { status: "working", latencyMs: 40, throughputKbps: 12000 }),
        snowflake: result("snowflake", { status: "working", latencyMs: 150, throughputKbps: 2000 }),
      });
      expect(rec.verdict).toBe("clear");
      // On a clear network, direct (fastest) is recommended.
      expect(rec.bestTransport).toBe("direct");
      expect(rec.rationale).toContain("open");
    });

    it("returns 'partial' when direct is blocked but a bypass transport works", () => {
      const rec = recommend({
        direct: result("direct", { status: "blocked", latencyMs: null, throughputKbps: null }),
        domain_fronting: result("domain_fronting", { status: "blocked", latencyMs: null, throughputKbps: null }),
        snowflake: result("snowflake", { status: "working", latencyMs: 180, throughputKbps: 1200 }),
        masque: result("masque", { status: "degraded", latencyMs: 400, throughputKbps: 300 }),
      });
      expect(rec.verdict).toBe("partial");
      expect(rec.bestTransport).toBe("snowflake"); // the working bypass
      expect(rec.summary).toMatch(/CENSORSHIP/i);
      expect(rec.fallbackChain.some((f) => f.transport === "masque")).toBe(true);
    });

    it("returns 'blocked' when every transport is blocked", () => {
      const rec = recommend({
        direct: result("direct", { status: "blocked" }),
        domain_fronting: result("domain_fronting", { status: "blocked" }),
        snowflake: result("snowflake", { status: "blocked" }),
        masque: result("masque", { status: "blocked" }),
      });
      expect(rec.verdict).toBe("blocked");
      expect(rec.summary).toMatch(/HARD BLOCK|OFFLINE/i);
    });

    it("prefers a working bypass over a degraded direct on a partial network", () => {
      const rec = recommend({
        direct: result("direct", { status: "degraded", latencyMs: 700, throughputKbps: 200 }),
        masque: result("masque", { status: "working", latencyMs: 200, throughputKbps: 900 }),
      });
      expect(rec.verdict).toBe("partial");
      expect(rec.bestTransport).toBe("masque");
    });
  });

  describe("display helpers", () => {
    it("rates latency bands", () => {
      expect(latencyRating(50).label).toBe("FAST");
      expect(latencyRating(150).label).toBe("OK");
      expect(latencyRating(300).label).toBe("SLOW");
      expect(latencyRating(900).label).toBe("POOR");
      expect(latencyRating(null).label).toBe("—");
    });
    it("rates throughput bands", () => {
      expect(throughputRating(8000).label).toBe("FAT");
      expect(throughputRating(2000).label).toBe("GOOD");
      expect(throughputRating(500).label).toBe("THIN");
      expect(throughputRating(100).label).toBe("STARVED");
      expect(throughputRating(null).label).toBe("—");
    });
    it("formats values", () => {
      expect(formatThroughput(1500)).toBe("1.5 Mbps");
      expect(formatThroughput(800)).toBe("800 kbps");
      expect(formatThroughput(null)).toBe("—");
      expect(formatLatency(123.6)).toBe("124 ms");
      expect(formatLatency(null)).toBe("—");
    });
  });

  describe("emptyResult", () => {
    it("produces an unknown result for any transport", () => {
      const e = emptyResult("masque");
      expect(e.transport).toBe("masque");
      expect(e.status).toBe("unknown");
      expect(e.latencyMs).toBeNull();
    });
  });

  describe("runAllProbes (non-browser)", () => {
    it("returns an empty map when fetch is unavailable", async () => {
      const w = window as unknown as { fetch?: unknown };
      const origFetch = w.fetch;
      // Simulate SSR / non-browser: remove fetch so the guard short-circuits.
      delete w.fetch;
      try {
        const map = await runAllProbes();
        expect(Object.keys(map)).toHaveLength(0);
      } finally {
        w.fetch = origFetch;
      }
    });
  });
});
