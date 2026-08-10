import { describe, it, expect } from "vitest";
import {
  haversineKm,
  bearingDeg,
  compassLabel,
  isExpired,
  freshnessWeight,
  effectiveIntensity,
  computeHeatZone,
  generateHeatGrid,
  clusterIncidents,
  suggestEscapeRoute,
  summarize,
  liveFeed,
  purgeExpired,
  createIncident,
  seedIncidents,
  heatColor,
  INCIDENT_TYPES,
  SEVERITY_INFO,
  DEFAULT_HALF_LIFE_MS,
  type Incident,
  type LatLng,
} from "../lib/sentinel";

const NOW = 1_700_000_000_000;

function mk(
  type: Incident["type"],
  lat: number,
  lng: number,
  minsAgo: number,
  severity: Incident["severity"] = "moderate",
  extra: Partial<Incident> = {},
): Incident {
  return {
    id: `id-${lat}-${lng}-${minsAgo}`,
    type,
    severity,
    lat,
    lng,
    ts: NOW - minsAgo * 60 * 1000,
    ...extra,
  };
}

describe("sentinel.ts", () => {
  describe("geo utilities", () => {
    it("haversineKm matches a known reference distance", () => {
      // Paris → Berlin ≈ 878 km
      const paris: LatLng = { lat: 48.8566, lng: 2.3522 };
      const berlin: LatLng = { lat: 52.52, lng: 13.405 };
      expect(haversineKm(paris, berlin)).toBeGreaterThan(860);
      expect(haversineKm(paris, berlin)).toBeLessThan(895);
    });

    it("haversineKm is zero for identical points and symmetric", () => {
      const a: LatLng = { lat: 10, lng: 20 };
      expect(haversineKm(a, a)).toBeCloseTo(0, 6);
      const b: LatLng = { lat: 10.5, lng: 20.3 };
      expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 6);
    });

    it("bearingDeg: due east is ~90, due south ~180", () => {
      const a: LatLng = { lat: 0, lng: 0 };
      expect(Math.round(bearingDeg(a, { lat: 0, lng: 10 }))).toBe(90);
      expect(Math.round(bearingDeg(a, { lat: -10, lng: 0 }))).toBe(180);
    });

    it("compassLabel covers all 8 sectors", () => {
      const labels = [0, 45, 90, 135, 180, 225, 270, 315].map(compassLabel);
      expect(labels).toEqual(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
    });
  });

  describe("time decay", () => {
    it("fresh report is 1.0 and halves every half-life", () => {
      expect(freshnessWeight(NOW, NOW)).toBeCloseTo(1, 6);
      const half = freshnessWeight(NOW - DEFAULT_HALF_LIFE_MS, NOW);
      expect(half).toBeCloseTo(0.5, 2);
      const quarter = freshnessWeight(NOW - DEFAULT_HALF_LIFE_MS * 2, NOW);
      expect(quarter).toBeCloseTo(0.25, 2);
    });

    it("isExpired respects ttl", () => {
      const inc = mk("teargas", 0, 0, 0, "moderate", { ttlMs: 60_000 });
      expect(isExpired(inc, NOW)).toBe(false);
      const expired = { ...inc, ts: NOW - 120_000 };
      expect(isExpired(expired, NOW)).toBe(true);
    });

    it("effectiveIntensity is bounded 0..100 and decays with age", () => {
      const fresh = mk("live_fire", 0, 0, 0, "critical");
      const old = mk("live_fire", 0, 0, 60, "critical");
      const iFresh = effectiveIntensity(fresh, NOW);
      const iOld = effectiveIntensity(old, NOW);
      expect(iFresh).toBeGreaterThan(iOld);
      expect(iFresh).toBeLessThanOrEqual(100);
      expect(iOld).toBeGreaterThanOrEqual(0);
    });

    it("corroboration boosts but is capped", () => {
      const base = mk("teargas", 0, 0, 0, "moderate");
      const boosted = { ...base, corroboration: 50 };
      expect(effectiveIntensity(boosted, NOW)).toBeGreaterThan(
        effectiveIntensity(base, NOW),
      );
      // never exceeds 100
      expect(effectiveIntensity(boosted, NOW)).toBeLessThanOrEqual(100);
    });
  });

  describe("heat zones", () => {
    it("computeHeatZone sums nearby incidents and ignores far ones", () => {
      const incidents = [
        mk("teargas", 0, 0, 0, "moderate"),
        mk("teargas", 0.005, 0.005, 1, "moderate"), // ~0.7km away
        mk("teargas", 0.5, 0.5, 0, "moderate"), // far away
      ];
      const near = computeHeatZone(incidents, { lat: 0, lng: 0 }, 1, NOW);
      const far = computeHeatZone(incidents, { lat: 0.5, lng: 0.5 }, 1, NOW);
      expect(near.count).toBe(2);
      expect(near.intensity).toBeGreaterThan(0);
      expect(far.count).toBe(1);
      expect(near.intensity).toBeGreaterThan(far.intensity);
    });

    it("computeHeatZone ignores expired incidents", () => {
      const live = mk("teargas", 0, 0, 0, "moderate");
      const expired = mk("teargas", 0, 0, 0, "moderate", { ttlMs: 1000, ts: NOW - 5000 });
      const z = computeHeatZone([live, expired], { lat: 0, lng: 0 }, 1, NOW);
      expect(z.count).toBe(1);
    });

    it("generateHeatGrid returns cells sorted by intensity desc", () => {
      const incidents = [
        mk("live_fire", 35.71, 51.40, 0, "critical"),
        mk("teargas", 35.72, 51.42, 2, "moderate"),
      ];
      const grid = generateHeatGrid(
        incidents,
        { minLat: 35.69, maxLat: 35.74, minLng: 51.38, maxLng: 51.44 },
        0.01,
        1.5,
        NOW,
      );
      expect(grid.length).toBeGreaterThan(0);
      for (let i = 1; i < grid.length; i++) {
        expect(grid[i - 1].intensity).toBeGreaterThanOrEqual(grid[i].intensity);
      }
    });

    it("generateHeatGrid returns nothing when all expired", () => {
      const grid = generateHeatGrid(
        [mk("teargas", 0, 0, 0, "moderate", { ttlMs: 1, ts: NOW - 100 })],
        { minLat: -1, maxLat: 1, minLng: -1, maxLng: 1 },
        0.5,
        5,
        NOW,
      );
      expect(grid).toHaveLength(0);
    });
  });

  describe("clustering", () => {
    it("clusters nearby incidents and separates distant ones", () => {
      const incidents = [
        mk("teargas", 35.7100, 51.4000, 0, "moderate"),
        mk("teargas", 35.7101, 51.4001, 0, "moderate"), // ~15m
        mk("teargas", 35.8000, 51.5000, 0, "moderate"), // ~15km away
      ];
      const clusters = clusterIncidents(incidents, 0.5, NOW);
      expect(clusters).toHaveLength(2);
      const big = clusters.find((c) => c.count === 2);
      expect(big).toBeDefined();
      expect(big!.dominant).toBe("teargas");
    });

    it("cluster intensity is the aggregate of its members", () => {
      const incidents = [
        mk("live_fire", 0, 0, 0, "critical"),
        mk("teargas", 0.001, 0.001, 0, "moderate"),
      ];
      const clusters = clusterIncidents(incidents, 1, NOW);
      expect(clusters).toHaveLength(1);
      expect(clusters[0].intensity).toBeGreaterThan(0);
      expect(clusters[0].dominant).toBe("live_fire"); // highest threat
    });

    it("empty input yields no clusters", () => {
      expect(clusterIncidents([], 1, NOW)).toHaveLength(0);
    });
  });

  describe("escape routing", () => {
    it("flees away from a dense threat when none is safe", () => {
      const from: LatLng = { lat: 0, lng: 0 };
      // Threat due north
      const incidents = [mk("live_fire", 0.005, 0, 0, "critical")];
      const route = suggestEscapeRoute(from, incidents, NOW, 1.5);
      // Should head roughly south (180°)
      expect(angleClose(route.bearing, 180, 30)).toBe(true);
    });

    it("prefers a nearby safe corridor in the flee direction", () => {
      const from: LatLng = { lat: 0, lng: 0 };
      const incidents = [
        mk("live_fire", 0.005, 0, 0, "critical"), // threat north
        mk("safe_corridor", -0.005, 0, 0, "info"), // safe south
      ];
      const route = suggestEscapeRoute(from, incidents, NOW, 1.5);
      expect(angleClose(route.bearing, 180, 30)).toBe(true);
      expect(route.nearestSafe).toBeDefined();
      expect(route.label).toContain("SAFE");
    });

    it("holds when there is no acute threat", () => {
      const route = suggestEscapeRoute({ lat: 0, lng: 0 }, [], NOW, 1.5);
      expect(route.label).toBe("HOLD");
    });
  });

  describe("summaries & feed", () => {
    it("summarize counts types, forces, arrests and hot zones", () => {
      const incidents = [
        mk("arrests", 0, 0, 0, "high", { headcount: 30 }),
        mk("military", 0.001, 0.001, 0, "critical", { headcount: 50 }),
        mk("medical", 0.002, 0, 0, "moderate", { headcount: 5 }),
        mk("teargas", 5, 5, 0, "moderate", { ttlMs: 1, ts: NOW - 10 }), // expired
      ];
      const s = summarize(incidents, NOW);
      expect(s.total).toBe(4);
      expect(s.active).toBe(3);
      expect(s.expired).toBe(1);
      expect(s.byType.arrests).toBe(1);
      expect(s.forcesDeployed).toBe(80); // arrests 30 + military 50
      expect(s.arrestsReported).toBe(30);
      expect(s.injuredReported).toBe(5);
      expect(s.hottestIntensity).toBeGreaterThan(0);
    });

    it("liveFeed orders by intensity then recency", () => {
      const incidents = [
        mk("teargas", 0, 0, 0, "moderate"),
        mk("live_fire", 0.01, 0.01, 1, "critical"),
      ];
      const feed = liveFeed(incidents, NOW);
      expect(feed[0].type).toBe("live_fire");
    });

    it("purgeExpired removes only expired", () => {
      const incidents = [
        mk("teargas", 0, 0, 0, "moderate", { ttlMs: 10_000 }),
        mk("teargas", 1, 1, 0, "moderate", { ttlMs: 1, ts: NOW - 100 }),
      ];
      expect(purgeExpired(incidents, NOW)).toHaveLength(1);
    });
  });

  describe("factory + seed", () => {
    it("createIncident assigns id and ts", () => {
      const inc = createIncident({
        type: "kettle",
        severity: "high",
        lat: 1,
        lng: 2,
      });
      expect(inc.id).toBeDefined();
      expect(inc.ts).toBeGreaterThan(0);
      expect(inc.type).toBe("kettle");
    });

    it("seedIncidents returns a realistic spread across cities", () => {
      const seed = seedIncidents(NOW);
      expect(seed.length).toBeGreaterThanOrEqual(10);
      // covers multiple incident categories
      const categories = new Set(seed.map((s) => INCIDENT_TYPES[s.type].category));
      expect(categories.size).toBeGreaterThanOrEqual(3);
      // includes at least one safe corridor
      expect(seed.some((s) => s.type === "safe_corridor")).toBe(true);
    });

    it("all incident types have well-formed metadata", () => {
      for (const meta of Object.values(INCIDENT_TYPES)) {
        expect(meta.label.length).toBeGreaterThan(0);
        expect(meta.glyph.length).toBeGreaterThan(0);
        expect(meta.threat).toBeGreaterThanOrEqual(0);
        expect(meta.threat).toBeLessThanOrEqual(100);
        expect(SEVERITY_INFO[meta.defaultSeverity]).toBeDefined();
      }
    });
  });

  describe("heatColor", () => {
    it("interpolates across the green→amber→blood spectrum", () => {
      const green = heatColor(0);
      const amber = heatColor(50);
      const blood = heatColor(100);
      // green should lean green (high blue), blood should be red-dominant
      expect(rgb(green).b).toBeGreaterThan(rgb(blood).b);
      expect(rgb(blood).r).toBe(255);
      expect(amber).not.toBe(green);
      expect(amber).not.toBe(blood);
    });
  });
});

/* ── helpers ── */
function angleClose(a: number, target: number, tol: number): boolean {
  const d = Math.abs(a - target) % 360;
  const diff = d > 180 ? 360 - d : d;
  return diff <= tol;
}
function rgb(css: string): { r: number; g: number; b: number } {
  const m = css.match(/rgb\((\d+),(\d+),(\d+)\)/);
  if (!m) return { r: 0, g: 0, b: 0 };
  return { r: +m[1], g: +m[2], b: +m[3] };
}
