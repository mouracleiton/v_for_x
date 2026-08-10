import { describe, it, expect } from "vitest";
import rosterData from "@/data/roster.json";
import {
  stableStringify,
  canonicalHelper,
  canonicalVouch,
  fingerprintOf,
  categoryMeta,
  availabilityMeta,
  trustScore,
  trustTier,
  buildView,
  filterViews,
  rosterStats,
  mergeHelpers,
  parseRoster,
  serializeRoster,
  makeRosterFile,
  generateKeyPair,
  signHelper,
  signVouch,
  verifyHelper,
  verifyVouch,
  hasCrypto,
  EMPTY_FILTER,
  type Helper,
  type Vouch,
} from "@/lib/roster";

const roster = rosterData as { version: number; label: string; helpers: Helper[] };
const helpers = roster.helpers;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

/* ═══════════════════════════════════════════════════════════════
   Canonicalization
   ═══════════════════════════════════════════════════════════════ */

describe("roster — canonicalization", () => {
  it("stableStringify is key-order independent (recursively)", () => {
    const a = { b: 2, a: 1, nested: { z: 9, a: 0 } };
    const b = { a: 1, b: 2, nested: { a: 0, z: 9 } };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it("stableStringify preserves array order", () => {
    expect(stableStringify([3, 1, 2])).toBe("[3,1,2]");
  });

  it("canonicalHelper excludes signature AND vouches", () => {
    const h = helpers[0];
    const c = canonicalHelper(h);
    const parsed = JSON.parse(c);
    expect(parsed.signature).toBeUndefined();
    expect(parsed.vouches).toBeUndefined();
    // identity + key are still bound
    expect(parsed.id).toBe(h.id);
    expect(parsed.publicKey).toBe(h.publicKey);
  });

  it("canonicalVouch excludes only signature", () => {
    const v = helpers[0].vouches[0];
    const c = canonicalVouch(v);
    const parsed = JSON.parse(c);
    expect(parsed.signature).toBeUndefined();
    expect(parsed.helperId).toBe(v.helperId);
    expect(parsed.byPublicKey).toBe(v.byPublicKey);
  });

  it("canonicalHelper is unaffected by adding/removing vouches", () => {
    const h = clone(helpers[0]);
    const before = canonicalHelper(h);
    h.vouches.push({ ...h.vouches[0], note: "extra" });
    const after = canonicalHelper(h);
    expect(before).toBe(after);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Display + trust helpers (pure)
   ═══════════════════════════════════════════════════════════════ */

describe("roster — trust + display", () => {
  it("fingerprintOf is stable and prefixed", () => {
    const fp = fingerprintOf(helpers[0].publicKey);
    expect(fp).toMatch(/^VFX-[0-9A-F]{8}$/);
    expect(fingerprintOf(helpers[0].publicKey)).toBe(fp);
    expect(fingerprintOf(helpers[1].publicKey)).not.toBe(fp);
  });

  it("trustScore weights self-attestation, vouches, and evidence", () => {
    expect(trustScore(false, 0, 0)).toBe(0);
    expect(trustScore(true, 0, 0)).toBe(2);
    expect(trustScore(true, 3, 2)).toBe(2 + 3 * 2 + 2);
    // caps: 5 vouches, 3 evidenced creds
    expect(trustScore(true, 99, 99)).toBe(2 + 5 * 2 + 3);
  });

  it("trustTier maps score to tiers", () => {
    expect(trustTier(0)).toBe("unverified");
    expect(trustTier(2)).toBe("emerging");
    expect(trustTier(6)).toBe("vetted");
    expect(trustTier(10)).toBe("trusted");
  });

  it("buildView computes score and tier from verification state", () => {
    const h = clone(helpers[0]);
    const v = buildView(h, true, 2);
    const evidenced = h.credentials.filter((c) => c.evidence).length;
    expect(v.trustScore).toBe(trustScore(true, 2, evidenced));
    expect(v.trustTier).toBe(trustTier(v.trustScore));
    expect(v.selfVerified).toBe(true);
    expect(v.verifiedVouches).toBe(2);
  });

  it("categoryMeta and availabilityMeta always resolve", () => {
    expect(categoryMeta("lawyer").label).toBe("Lawyer");
    expect(categoryMeta("nonexistent" as never).id).toBe("lawyer");
    expect(availabilityMeta("available").label).toBe("Available");
    expect(availabilityMeta("unknown").color).toBeTruthy();
  });
});

/* ═══════════════════════════════════════════════════════════════
   Filtering + stats + merge (pure)
   ═══════════════════════════════════════════════════════════════ */

describe("roster — filtering, stats, merge", () => {
  const views = helpers.map((h) =>
    buildView(h, true, h.vouches.length),
  );

  it("empty filter returns all, sorted by trust desc", () => {
    const out = filterViews(views, { ...EMPTY_FILTER });
    expect(out.length).toBe(views.length);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].trustScore).toBeLessThanOrEqual(out[i - 1].trustScore);
    }
  });

  it("filters by category", () => {
    const out = filterViews(views, {
      ...EMPTY_FILTER,
      categories: ["lawyer"],
    });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((v) => v.helper.category === "lawyer")).toBe(true);
  });

  it("filters by country", () => {
    const out = filterViews(views, {
      ...EMPTY_FILTER,
      countries: ["BRA"],
    });
    expect(out.every((v) => v.helper.country === "BRA")).toBe(true);
    expect(out.length).toBeGreaterThan(0);
  });

  it("filters by language", () => {
    const out = filterViews(views, {
      ...EMPTY_FILTER,
      languages: ["ar"],
    });
    expect(out.every((v) => v.helper.languages.includes("ar"))).toBe(true);
    expect(out.length).toBeGreaterThan(0);
  });

  it("query matches specialties and handles", () => {
    const bySpec = filterViews(views, { ...EMPTY_FILTER, query: "surgery" });
    expect(bySpec.length).toBeGreaterThan(0);
    const byHandle = filterViews(views, {
      ...EMPTY_FILTER,
      query: "lex-mira",
    });
    expect(byHandle.length).toBe(1);
  });

  it("onlyVerified / onlyVouched gates", () => {
    const verified = filterViews(views, { ...EMPTY_FILTER, onlyVerified: true });
    expect(verified.every((v) => v.selfVerified)).toBe(true);
    const vouched = filterViews(views, { ...EMPTY_FILTER, onlyVouched: true });
    expect(vouched.every((v) => v.verifiedVouches >= 1)).toBe(true);
  });

  it("rosterStats aggregates correctly", () => {
    const s = rosterStats(views);
    expect(s.total).toBe(views.length);
    expect(s.verified).toBe(views.length); // all seed helpers self-verified in setup
    expect(s.vouches).toBe(helpers.reduce((n, h) => n + h.vouches.length, 0));
    expect(s.countries).toBe(new Set(helpers.map((h) => h.country)).size);
  });

  it("mergeHelpers dedupes by id, newer ts wins", () => {
    const a = clone(helpers);
    const newer = clone(helpers[0]);
    newer.ts = helpers[0].ts + 1;
    newer.handle = "renamed";
    const merged = mergeHelpers(a, [newer]);
    expect(merged.length).toBe(helpers.length);
    const got = merged.find((h) => h.id === helpers[0].id);
    expect(got?.handle).toBe("renamed");
  });
});

/* ═══════════════════════════════════════════════════════════════
   Serialization
   ═══════════════════════════════════════════════════════════════ */

describe("roster — serialization", () => {
  it("round-trips through serialize/parse", () => {
    const file = makeRosterFile("test", helpers);
    const text = serializeRoster(file);
    const back = parseRoster(text);
    expect(back.label).toBe("test");
    expect(back.helpers.length).toBe(helpers.length);
    expect(back.helpers[0].id).toBe(helpers[0].id);
  });

  it("parseRoster rejects malformed input", () => {
    expect(() => parseRoster("not json")).toThrow();
    expect(() => parseRoster("{}")).toThrow();
    expect(() => parseRoster(JSON.stringify({ helpers: [{ id: "x" }] }))).toThrow();
  });
});

/* ═══════════════════════════════════════════════════════════════
   Cryptographic verification (Web Crypto — same API as the browser)
   ═══════════════════════════════════════════════════════════════ */

describe.skipIf(!hasCrypto())("roster — signatures (Web Crypto)", () => {
  it("verifies EVERY committed seed helper self-attestation", async () => {
    expect(helpers.length).toBeGreaterThanOrEqual(8);
    for (const h of helpers) {
      const ok = await verifyHelper(h);
      expect(ok, `helper ${h.id} (${h.handle}) failed verification`).toBe(true);
    }
  });

  it("verifies EVERY committed peer vouch", async () => {
    let count = 0;
    for (const h of helpers) {
      for (const v of h.vouches) {
        const ok = await verifyVouch(v);
        expect(ok, `vouch by ${v.byHandle} on ${h.id} failed`).toBe(true);
        count++;
      }
    }
    expect(count).toBeGreaterThanOrEqual(10);
  });

  it("detects tampering with a signed profile", async () => {
    const tampered = clone(helpers[0]);
    tampered.handle = "impostor";
    // signature unchanged → must fail
    const ok = await verifyHelper(tampered);
    expect(ok).toBe(false);
  });

  it("detects a swapped signature", async () => {
    const swapped = clone(helpers[0]);
    swapped.signature = helpers[1].signature;
    expect(await verifyHelper(swapped)).toBe(false);
  });

  it("sign/verify round-trip for a fresh helper + vouch", async () => {
    const kp = await generateKeyPair();
    const fresh: Helper = {
      id: "TEST-FRESH",
      version: 1,
      handle: "fresh-test",
      category: "translator",
      specialties: ["test"],
      country: "FRA",
      languages: ["fr", "en"],
      availability: "unknown",
      contact: {},
      credentials: [{ claim: "test credential" }],
      vouches: [],
      publicKey: kp.publicKey,
      ts: 123,
      signature: "",
    };
    fresh.signature = await signHelper(fresh, kp.privateKey);
    expect(await verifyHelper(fresh)).toBe(true);

    const vouch: Vouch = {
      helperId: fresh.id,
      byHandle: "voucher",
      byPublicKey: kp.publicKey,
      relationship: "test rel",
      note: "test note",
      ts: 456,
      signature: "",
    };
    vouch.signature = await signVouch(vouch, kp.privateKey);
    expect(await verifyVouch(vouch)).toBe(true);
  });
});
