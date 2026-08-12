/**
 * Phase 15 — Trail mutual-aid (fulfillment, relay, convoy, planning desk, ledger bridge)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createFulfillment,
  signFulfillment,
  verifyFulfillment,
  encodeFulfillmentToken,
  decodeFulfillmentToken,
  isFulfillmentToken,
  toWitnessText,
  summarizeFulfillments,
  hashMatchIds,
  loadLocalFulfillments,
  saveLocalFulfillments,
  addLocalFulfillment,
  type FulfillmentReceipt,
} from "@/lib/fulfillment";
import {
  encodeTrailEntry,
  decodeTrailEntry,
  isTrailRelayToken,
  segmentTrailForQR,
  reassembleTrailFromSegments,
  validateTrailEntry,
  describeTrailEntry,
} from "@/lib/trail-relay";
import {
  splitSecret,
  combineShares,
  createConvoyShares,
  recoverConvoySecret,
  encodeConvoyShare,
  decodeConvoyShare,
  isConvoyToken,
  verifyShareSet,
  gfMul,
  gfInv,
  gfDiv,
  gfEval,
  gfInterpolateZero,
  describeShare,
  type ConvoyShare,
} from "@/lib/convoy";
import { buildPlan, avgImprovementProbability } from "@/lib/planning-desk";
import {
  extractBudgetLines,
  classifyBudgetLines,
  priceTagNarratives,
  buildLedgerBrief,
  toBillions,
} from "@/lib/ledger-bridge";
import { detectToken } from "@/lib/tokens";
import type { TrailEntry, TrailMatch } from "@/lib/trail-match";

if (!globalThis.crypto?.randomUUID) {
  (globalThis.crypto as any) = {
    ...(globalThis.crypto || {}),
    randomUUID: () => "test-" + Math.random().toString(36).slice(2),
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    },
    subtle: (globalThis.crypto as any)?.subtle,
  };
}

// localStorage is not provided by this jsdom build — stub it like other tests.
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};
vi.stubGlobal("localStorage", localStorageMock);

beforeEach(() => {
  localStorage.clear();
});

/* ═══════════════════════════════════════════════════════════════
   Fulfillment (VFXFUL1)
   ═══════════════════════════════════════════════════════════════ */

describe("fulfillment receipts", () => {
  async function makeKey() {
    return crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );
  }

  function makeMatch(): TrailMatch {
    const need: TrailEntry = { id: "need1", type: "need", category: "medical", item: "insulin", iso3: "SDN", ts: 1, qty: "10 vials", tags: ["insulin", "diabetes"] };
    const offer: TrailEntry = { id: "offer1", type: "offer", category: "medical", item: "insulin", iso3: "SDN", ts: 2, qty: "20 vials", tags: ["insulin"] };
    return {
      need,
      offer,
      score: 0.9,
      distanceKm: 5,
      tagOverlap: ["insulin"],
      categoryMatch: true,
      reason: "category match",
    };
  }

  it("creates a receipt from a match and hashes it", async () => {
    const r = await createFulfillment({ match: makeMatch() });
    expect(r.id).toBeTruthy();
    expect(r.needId).toBe("need1");
    expect(r.offerId).toBe("offer1");
    expect(r.status).toBe("delivered");
    expect(r.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.matchHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("creates a receipt from raw ids", async () => {
    const r = await createFulfillment({ needId: "n1", offerId: "o1", item: "water" });
    expect(r.needId).toBe("n1");
    expect(r.offerId).toBe("o1");
    expect(r.item).toBe("water");
    expect(r.matchHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws without a match or ids", async () => {
    await expect(createFulfillment({})).rejects.toThrow();
  });

  it("hashes the same match deterministically via hashMatchIds", async () => {
    const a = await hashMatchIds("n1", "o1");
    const b = await hashMatchIds("n1", "o1");
    expect(a).toBe(b);
    const c = await hashMatchIds("o1", "n1");
    expect(a).not.toBe(c);
  });

  it("signs and verifies a receipt", async () => {
    const kp = await makeKey();
    const r = await createFulfillment({ match: makeMatch() });
    const signed = await signFulfillment(r, kp);
    expect(signed.signature).toBeTruthy();
    expect(signed.signerPublicKey).toBeTruthy();
    expect(signed.contentHash).toBe(r.hash);
    const res = await verifyFulfillment(signed);
    expect(res.ok).toBe(true);
  });

  it("detects a tampered receipt", async () => {
    const kp = await makeKey();
    const r = await createFulfillment({ match: makeMatch() });
    const signed = await signFulfillment(r, kp);
    signed.item = "weapons"; // tamper
    const res = await verifyFulfillment(signed);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("hash_mismatch");
  });

  it("encodes and decodes tokens round-trip", async () => {
    const kp = await makeKey();
    const r = await createFulfillment({ match: makeMatch() });
    const signed = await signFulfillment(r, kp);
    const token = encodeFulfillmentToken(signed);
    expect(token.startsWith("VFXFUL1:")).toBe(true);
    expect(isFulfillmentToken(token)).toBe(true);
    const decoded = decodeFulfillmentToken(token);
    expect(decoded.id).toBe(signed.id);
    expect(decoded.hash).toBe(signed.hash);
  });

  it("detects token type via tokens registry", async () => {
    const kp = await makeKey();
    const r = await createFulfillment({ needId: "n", offerId: "o", item: "x" });
    const signed = await signFulfillment(r, kp);
    const detected = detectToken(encodeFulfillmentToken(signed));
    expect(detected?.spec.id).toBe("VFXFUL1");
  });

  it("renders witness text", async () => {
    const r = await createFulfillment({ match: makeMatch(), fulfilledQty: "10 vials" });
    const text = toWitnessText(r);
    expect(text).toContain("FULFILLED");
    expect(text).toContain("delivered");
    expect(text).toContain("insulin");
    expect(text).toContain("SDN");
  });

  it("summarizes a collection of receipts", async () => {
    const r1 = await createFulfillment({ needId: "n1", offerId: "o1", item: "a", status: "delivered" });
    const r2 = await createFulfillment({ needId: "n2", offerId: "o2", item: "b", status: "partial" });
    const sum = summarizeFulfillments([r1, r2]);
    expect(sum.total).toBe(2);
    expect(sum.delivered).toBe(1);
    expect(sum.partial).toBe(1);
    expect(sum.distinctNeeds).toBe(2);
  });

  it("persists receipts to localStorage deduped by id", async () => {
    const r = await createFulfillment({ needId: "n1", offerId: "o1", item: "a" });
    addLocalFulfillment(r);
    addLocalFulfillment(r);
    const loaded = loadLocalFulfillments();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.id).toBe(r.id);
  });

  it("decode throws on malformed token", () => {
    expect(() => decodeFulfillmentToken("not a token")).toThrow();
    expect(() => decodeFulfillmentToken("VFXFUL1:!!!")).toThrow();
  });
});

/* ═══════════════════════════════════════════════════════════════
   Trail Relay (VFXTRL1)
   ═══════════════════════════════════════════════════════════════ */

describe("trail relay QR handoff", () => {
  const entry: TrailEntry = {
    id: "entry1",
    type: "need",
    category: "water",
    item: "bottled water",
    iso3: "YEM",
    tags: ["water", "emergency"],
    qty: "1000 L",
    lat: 15.5,
    lon: 44.2,
    ts: 1700000000000,
  };

  it("validates entries", () => {
    expect(validateTrailEntry(entry).ok).toBe(true);
    expect(validateTrailEntry({ ...entry, type: "x" }).ok).toBe(false);
    expect(validateTrailEntry({ ...entry, iso3: "xx" }).ok).toBe(false);
    expect(validateTrailEntry(null).ok).toBe(false);
  });

  it("encodes and decodes a trail entry token", () => {
    const token = encodeTrailEntry(entry);
    expect(token.startsWith("VFXTRL1:")).toBe(true);
    expect(isTrailRelayToken(token)).toBe(true);
    const decoded = decodeTrailEntry(token);
    expect(decoded.id).toBe(entry.id);
    expect(decoded.tags).toEqual(entry.tags);
  });

  it("detects via tokens registry", () => {
    expect(detectToken(encodeTrailEntry(entry))?.spec.id).toBe("VFXTRL1");
  });

  it("segments for QR and reassembles round-trip", () => {
    const segs = segmentTrailForQR(entry, 60);
    expect(segs.length).toBeGreaterThan(1);
    expect(segs[0]!.total).toBe(segs.length);
    const reassembled = reassembleTrailFromSegments(segs);
    expect(reassembled).not.toBeNull();
    expect(reassembled!.id).toBe(entry.id);
  });

  it("short entries fit in one segment", () => {
    const segs = segmentTrailForQR(entry, 400);
    expect(segs).toHaveLength(1);
  });

  it("reassemble of incomplete segments returns null", () => {
    const segs = segmentTrailForQR(entry, 30);
    const partial = segs.slice(0, 1);
    expect(reassembleTrailFromSegments(partial)).toBeNull();
  });

  it("describes an entry", () => {
    expect(describeTrailEntry(entry)).toBe("NEED · bottled water · YEM");
  });

  it("throws on bad token", () => {
    expect(() => decodeTrailEntry("nope")).toThrow();
    expect(isTrailRelayToken("VFXPACK1:x")).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Convoy Shamir GF(256) (VFXCNV1)
   ═══════════════════════════════════════════════════════════════ */

describe("convoy Shamir secret sharing", () => {
  it("GF(256) multiply identities", () => {
    expect(gfMul(0, 5)).toBe(0);
    expect(gfMul(1, 5)).toBe(5);
    expect(gfMul(5, 1)).toBe(5);
  });

  it("GF(256) inverse is self-cancelling", () => {
    for (const a of [1, 2, 5, 17, 128, 255]) {
      const inv = gfInv(a);
      expect(gfMul(a, inv)).toBe(1);
    }
    expect(gfInv(0)).toBe(0);
  });

  it("GF(256) divide throws on zero", () => {
    expect(() => gfDiv(5, 0)).toThrow();
  });

  it("gfEval returns constant term at x=0", () => {
    expect(gfEval([42, 7, 3], 0)).toBe(42);
  });

  it("splits and combines recovers the secret (3-of-5)", () => {
    const secret = new TextEncoder().encode("drop:15.55,44.20");
    const shares = splitSecret(secret, { n: 5, k: 3 });
    expect(shares).toHaveLength(5);
    // any 3 reconstruct
    const recovered = combineShares([shares[0]!, shares[2]!, shares[4]!]);
    expect(new TextDecoder().decode(recovered)).toBe("drop:15.55,44.20");
    // a different 3 also work
    const recovered2 = combineShares([shares[1]!, shares[3]!, shares[4]!]);
    expect(new TextDecoder().decode(recovered2)).toBe("drop:15.55,44.20");
  });

  it("K-1 shares do NOT recover the secret", () => {
    const secret = new TextEncoder().encode("secret-coords");
    const shares = splitSecret(secret, { n: 4, k: 3 });
    // combineShares refuses to run with fewer than K shares — so K-1
    // shares provably cannot recover the secret (threshold security).
    expect(() => combineShares([shares[0]!, shares[1]!])).toThrow();
  });

  it("throws when fewer than K shares", () => {
    const secret = new Uint8Array([1, 2, 3]);
    const shares = splitSecret(secret, { n: 3, k: 2 });
    expect(() => combineShares([shares[0]!])).toThrow();
  });

  it("rejects invalid n/k", () => {
    expect(() => splitSecret(new Uint8Array([1]), { n: 3, k: 5 })).toThrow();
    expect(() => splitSecret(new Uint8Array([1]), { n: 0, k: 0 })).toThrow();
    expect(() => splitSecret(new Uint8Array([]), { n: 3, k: 2 })).toThrow();
  });

  it("encodes and decodes share tokens", () => {
    const shares = splitSecret(new TextEncoder().encode("loc"), { n: 3, k: 2 });
    const token = encodeConvoyShare(shares[0]!);
    expect(token.startsWith("VFXCNV1:")).toBe(true);
    expect(isConvoyToken(token)).toBe(true);
    expect(detectToken(token)?.spec.id).toBe("VFXCNV1");
    const decoded = decodeConvoyShare(token);
    expect(decoded.x).toBe(shares[0]!.x);
    expect(decoded.y).toEqual(shares[0]!.y);
  });

  it("createConvoyShares + recoverConvoySecret round-trip via tokens", () => {
    const tokens = createConvoyShares("35.123,12.456", { n: 5, k: 3, iso3: "SDN" });
    expect(tokens).toHaveLength(5);
    const res = recoverConvoySecret(tokens.slice(0, 3));
    expect(res.ok).toBe(true);
    expect(res.secret).toBe("35.123,12.456");
    expect(res.sharesUsed).toBe(3);
  });

  it("recover fails gracefully with too few shares", () => {
    const tokens = createConvoyShares("loc", { n: 5, k: 3 });
    const res = recoverConvoySecret(tokens.slice(0, 2));
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("at least 3");
  });

  it("verifyShareSet validates a share bundle", () => {
    const tokens = createConvoyShares("x", { n: 3, k: 2 });
    const v = verifyShareSet(tokens);
    expect(v.ok).toBe(true);
    expect(v.count).toBe(3);
    expect(v.k).toBe(2);
    const partial = verifyShareSet(tokens.slice(0, 1));
    expect(partial.ok).toBe(false);
  });

  it("detects duplicate shares in a set", () => {
    const tokens = createConvoyShares("x", { n: 3, k: 2 });
    const v = verifyShareSet([tokens[0]!, tokens[0]!]);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("duplicate_share");
  });

  it("describes a share", () => {
    const shares = splitSecret(new Uint8Array([1]), { n: 4, k: 2, iso3: "AFG" });
    expect(describeShare(shares[2]!)).toBe("share 3 of 4 · K=2 · AFG");
  });

  it("decodes throw on malformed", () => {
    expect(() => decodeConvoyShare("nope")).toThrow();
    expect(() => decodeConvoyShare("VFXCNV1:!!!")).toThrow();
  });

  it("gfInterpolateZero of identity points returns secret", () => {
    // secret=123, k=2: polynomial 123 + a*x, point (1, 123^a)
    const secret = 123;
    const a = 200;
    const y1 = gfEval([secret, a], 1);
    const y2 = gfEval([secret, a], 2);
    expect(gfInterpolateZero([{ x: 1, y: y1 }, { x: 2, y: y2 }])).toBe(secret);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Planning Desk
   ═══════════════════════════════════════════════════════════════ */

describe("planning desk", () => {
  it("builds a plan from allocations only", () => {
    const plan = buildPlan({
      allocations: { sdg2_hunger: 93, sdg6_water: 114 },
      label: "Test plan",
    });
    expect(plan.allocation).not.toBeNull();
    expect(plan.components).toContain("allocator");
    expect(plan.reachMillions).toBeGreaterThan(0);
    expect(plan.coverage).toBeGreaterThan(0);
    expect(plan.narrative).toContain("Test plan");
    expect(plan.monteCarlo).toBeNull();
    expect(plan.matches).toHaveLength(0);
  });

  it("builds a plan from trail entries only", () => {
    const entries: TrailEntry[] = [
      { id: "n1", type: "need", category: "water", item: "water", iso3: "YEM", ts: 1, tags: ["water"] },
      { id: "o1", type: "offer", category: "water", item: "water", iso3: "YEM", ts: 2, tags: ["water"] },
      { id: "n2", type: "need", category: "medical", item: "insulin", iso3: "YEM", ts: 3, tags: ["insulin"] },
    ];
    const plan = buildPlan({ trailEntries: entries });
    expect(plan.matches.length).toBeGreaterThan(0);
    expect(plan.unmetNeeds).toBe(1); // the medical need is unmatched
    expect(plan.avgMatchConfidence).toBeGreaterThan(0);
    expect(plan.components).toContain("trail");
  });

  it("empty input returns an empty-but-honest plan", () => {
    const plan = buildPlan({});
    expect(plan.allocation).toBeNull();
    expect(plan.matches).toHaveLength(0);
    expect(plan.components).toHaveLength(0);
    expect(plan.narrative).toBeTruthy();
  });

  it("avgImprovementProbability averages a list", () => {
    expect(avgImprovementProbability([0.5, 0.7, 0.9])).toBeCloseTo(0.7, 5);
    expect(avgImprovementProbability([])).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Ledger Bridge
   ═══════════════════════════════════════════════════════════════ */

describe("ledger bridge", () => {
  it("toBillions converts units correctly", () => {
    expect(toBillions(1, "T")).toBe(1000);
    expect(toBillions(93, "B")).toBe(93);
    expect(toBillions(500, "M")).toBe(0.5);
    expect(toBillions(1000, "K")).toBe(0.001);
  });

  it("extracts dollar lines from budget text", () => {
    const text = `
      Department of Defense: $886 billion
      Education spending: $97B
      Foreign military aid: $3.2 billion
      Clean water programs: $500 million
    `;
    const lines = extractBudgetLines(text);
    expect(lines.length).toBeGreaterThanOrEqual(4);
    const defense = lines.find((l) => l.label.toLowerCase().includes("defense"));
    expect(defense).toBeTruthy();
    expect(defense!.amountB).toBeCloseTo(886, 0);
  });

  it("classifies lines into tags and SDG items", () => {
    const lines = extractBudgetLines("Military: $100B\nSchools: $97B");
    const classified = classifyBudgetLines(lines);
    const mil = classified.find((l) => l.label.toLowerCase().includes("military"));
    expect(mil!.tag).toBe("military");
    const edu = classified.find((l) => l.label.toLowerCase().includes("school"));
    expect(edu!.tag).toBe("education");
    expect(edu!.sdgItem).toBe("sdg4_education");
  });

  it("generates price-tag narratives", () => {
    const lines = classifyBudgetLines(extractBudgetLines("Defense: $93 billion"));
    const nar = priceTagNarratives(lines[0]!);
    expect(nar.narratives.length).toBeGreaterThan(0);
    expect(nar.narratives.some((n) => n.includes("military spending"))).toBe(true);
    expect(nar.daysOfMilitary).toBeGreaterThan(0);
  });

  it("buildLedgerBrief runs the full pipeline", () => {
    const brief = buildLedgerBrief(
      "Pentagon: $886 billion\nHunger relief: $50B\nSolar: $35B",
    );
    expect(brief.lines.length).toBeGreaterThanOrEqual(3);
    expect(brief.narratives.length).toBeGreaterThanOrEqual(3);
    expect(brief.totalSpendingB).toBeGreaterThan(900);
    expect(brief.militaryEquivalentB).toBeGreaterThan(800);
    expect(brief.topLine).not.toBeNull();
    expect(brief.summary).toContain("budget line");
  });

  it("handles empty / no-amount text", () => {
    const brief = buildLedgerBrief("nothing here");
    expect(brief.lines).toHaveLength(0);
    expect(brief.summary).toContain("No budget amounts");
  });
});
