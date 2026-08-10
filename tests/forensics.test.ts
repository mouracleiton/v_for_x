/**
 * V FOR X — The Forensics library tests
 *
 * Covers the pure, environment-independent logic:
 *   • solar geometry (sunPosition) — sanity + physical correctness
 *   • inverse shadow → location round-trip (the headline capability)
 *   • elevation/shadow-length inverses
 *   • ELA verdict classification
 *   • reverse-search launchers + map URL helpers
 *   • EXIF reader early-exit on non-JPEG input
 *
 * Canvas-heavy functions (computeELA, fileToCanvas) are not unit-tested
 * here because jsdom has no real 2D canvas context; they are exercised
 * end-to-end in the browser.
 */

import { describe, it, expect } from "vitest";
import {
  sunPosition,
  shadowToLocation,
  elevationFromShadow,
  shadowLength,
  elaVerdict,
  mapsUrl,
  fmtBytes,
  readExifForensics,
  EMPTY_EXIF_REPORT,
  REVERSE_SEARCH_ENGINES,
  type ElaStats,
} from "@/lib/forensics";

const rad = Math.PI / 180;

function approx(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

describe("sunPosition — physical sanity", () => {
  it("places the sun overhead at the equator on the equinox near noon", () => {
    // 2024-03-20 ~ equinox. At equator, lng=0, ~solar noon the sun is near zenith.
    const sp = sunPosition(0, 0, new Date("2024-03-20T12:00:00Z"));
    expect(sp.elevation).toBeGreaterThan(88);
    expect(Math.abs(sp.declination)).toBeLessThan(0.5);
  });

  it("reports azimuth in [0, 360)", () => {
    const sp = sunPosition(40, -74, new Date("2024-06-21T16:00:00Z"));
    expect(sp.azimuth).toBeGreaterThanOrEqual(0);
    expect(sp.azimuth).toBeLessThan(360);
  });

  it("sun is due south at northern-hemisphere solar noon", () => {
    const sp = sunPosition(40, 0, new Date("2024-06-21T12:00:00Z"));
    // Around noon in the northern hemisphere the sun sits near south (180°).
    expect(sp.azimuth).toBeGreaterThan(170);
    expect(sp.azimuth).toBeLessThan(190);
    expect(sp.elevation).toBeGreaterThan(65);
  });

  it("reports a negative elevation at local midnight", () => {
    const sp = sunPosition(40, 0, new Date("2024-06-21T00:00:00Z"));
    expect(sp.elevation).toBeLessThan(0);
  });

  it("declination is positive at the June solstice", () => {
    const sp = sunPosition(0, 0, new Date("2024-06-21T12:00:00Z"));
    expect(sp.declination).toBeGreaterThan(23);
    expect(sp.declination).toBeLessThan(24);
  });

  it("declination is negative at the December solstice", () => {
    const sp = sunPosition(0, 0, new Date("2024-12-21T12:00:00Z"));
    expect(sp.declination).toBeLessThan(-23);
    expect(sp.declination).toBeGreaterThan(-24);
  });
});

describe("shadowToLocation — round-trip", () => {
  // The headline test: measure the sun from a known place/time, then ask
  // where on Earth that sun would be. We should recover the location.
  const cases: { name: string; lat: number; lng: number; iso: string; tol: number }[] = [
    { name: "NYC summer noon", lat: 40.71, lng: -74.0, iso: "2024-06-21T16:00:00Z", tol: 2 },
    { name: "London equinox noon", lat: 51.5, lng: -0.12, iso: "2024-03-20T12:00:00Z", tol: 2 },
    { name: "Sydney summer noon", lat: -33.87, lng: 151.21, iso: "2024-12-21T02:00:00Z", tol: 3 },
    { name: "Tokyo autumn afternoon", lat: 35.68, lng: 139.69, iso: "2024-09-22T05:00:00Z", tol: 3 },
  ];

  for (const c of cases) {
    it(`recovers ${c.name} within ${c.tol}°`, () => {
      const date = new Date(c.iso);
      const sp = sunPosition(c.lat, c.lng, date);
      expect(sp.elevation).toBeGreaterThan(5); // sun must be up
      const est = shadowToLocation(date, sp.elevation, sp.azimuth);
      expect(est).not.toBeNull();
      if (!est) return;
      // Longitude wraps at ±180, so compare on a circle.
      const lngErr = Math.min(
        Math.abs(est.lng - c.lng),
        Math.abs(est.lng - c.lng + 360),
        Math.abs(est.lng - c.lng - 360)
      );
      expect(approx(est.lat, c.lat, c.tol)).toBe(true);
      expect(lngErr).toBeLessThan(c.tol);
    });
  }

  it("returns null for an impossible (below-horizon) elevation", () => {
    const est = shadowToLocation(new Date("2024-06-21T12:00:00Z"), -10, 180);
    expect(est).toBeNull();
  });
});

describe("elevationFromShadow / shadowLength — inverses", () => {
  it("round-trips a shadow measurement", () => {
    const h = 173; // cm
    const len = 100; // cm
    const elev = elevationFromShadow(h, len);
    expect(elev).toBeGreaterThan(0);
    expect(elev).toBeLessThan(90);
    // Reconstructing the length from the derived elevation recovers the input.
    expect(shadowLength(h, elev)).toBeCloseTo(len, 1);
  });

  it("a taller shadow means a lower sun", () => {
    const e1 = elevationFromShadow(100, 50);
    const e2 = elevationFromShadow(100, 200);
    expect(e2).toBeLessThan(e1);
  });

  it("shadowLength is infinite when the sun is at/below the horizon", () => {
    expect(shadowLength(100, 0)).toBe(Infinity);
    expect(shadowLength(100, -5)).toBe(Infinity);
  });
});

describe("elaVerdict — tamper classification", () => {
  const base: ElaStats = { meanError: 3, maxError: 30, hotPixelsPct: 0.01, stdev: 4 };

  it("flags a clean image with uniform low error", () => {
    const v = elaVerdict(base);
    expect(v.level).toBe("clean");
  });

  it("flags a watch-level image with uneven error", () => {
    const v = elaVerdict({ ...base, stdev: 12, hotPixelsPct: 0.06 });
    expect(v.level).toBe("watch");
  });

  it("flags a suspicious image with high spread / hot clusters", () => {
    expect(elaVerdict({ ...base, stdev: 22 }).level).toBe("suspicious");
    expect(elaVerdict({ ...base, hotPixelsPct: 0.2 }).level).toBe("suspicious");
  });
});

describe("helpers", () => {
  it("mapsUrl produces an OpenStreetMap deep link", () => {
    const url = mapsUrl(40.7128, -74.006);
    expect(url).toContain("openstreetmap.org");
    expect(url).toContain("40.712800");
    expect(url).toContain("-74.006000");
  });

  it("fmtBytes formats across scales", () => {
    expect(fmtBytes(512)).toBe("512 B");
    expect(fmtBytes(2048)).toBe("2.0 KB");
    expect(fmtBytes(5 * 1024 * 1024)).toBe("5.00 MB");
  });

  it("exposes three reverse-search engines with valid URLs", () => {
    expect(REVERSE_SEARCH_ENGINES).toHaveLength(3);
    for (const e of REVERSE_SEARCH_ENGINES) {
      expect(e.url).toMatch(/^https:\/\//);
      expect(e.label.length).toBeGreaterThan(0);
      expect(["blood", "green", "amber"]).toContain(e.accent);
    }
    const ids = REVERSE_SEARCH_ENGINES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("readExifForensics — early exit", () => {
  it("returns an empty report for a non-JPEG file", async () => {
    const png = new File([new Uint8Array([137, 80, 78, 71])], "x.png", { type: "image/png" });
    const rep = await readExifForensics(png);
    expect(rep).toEqual(EMPTY_EXIF_REPORT);
    expect(rep.hasExif).toBe(false);
  });

  it("returns an empty report for a truncated non-image blob", async () => {
    const junk = new File([new Uint8Array([0, 0, 0])], "junk.jpg", { type: "image/jpeg" });
    const rep = await readExifForensics(junk);
    expect(rep.hasExif).toBe(false);
  });
});
