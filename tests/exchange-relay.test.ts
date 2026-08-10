import { describe, it, expect } from "vitest";
import { matchToRelay, matchesToRelays, unmatchedToAlert, exportExchangeBatch } from "../lib/exchange-relay";
import type { Match, AidPost } from "../lib/exchange";

function mockOffer(): AidPost {
  return {
    id: "offer-1",
    type: "offer",
    category: "food",
    resource: "rice",
    quantity: "50kg",
    iso3: "YEM",
    countryName: "Yemen",
    urgency: 3,
    ts: Date.now(),
    active: true,
    handle: "V-ABCD",
  };
}

function mockRequest(): AidPost {
  return {
    id: "request-1",
    type: "request",
    category: "food",
    resource: "rice",
    quantity: "30kg",
    iso3: "YEM",
    countryName: "Yemen",
    urgency: 4,
    ts: Date.now(),
    active: true,
    handle: "V-EFGH",
  };
}

function mockMatch(): Match {
  return {
    offer: mockOffer(),
    request: mockRequest(),
    score: 85,
    reason: "Category match + same country",
    sameCountry: true,
    sameRegion: true,
  };
}

describe("matchToRelay", () => {
  it("produces a bundle with encoded relay messages", () => {
    const bundle = matchToRelay(mockMatch());
    expect(bundle.offerRelay).toBeTruthy();
    expect(bundle.requestRelay).toBeTruthy();
    expect(bundle.offerRelay).toMatch(/^VFX\|/);
    expect(bundle.requestRelay).toMatch(/^VFX\|/);
  });

  it("generates a match ID", () => {
    const bundle = matchToRelay(mockMatch());
    expect(bundle.matchId).toMatch(/^M-/);
  });

  it("encodes different messages for each side", () => {
    const bundle = matchToRelay(mockMatch());
    expect(bundle.offerRelay).not.toBe(bundle.requestRelay);
  });
});

describe("matchesToRelays", () => {
  it("converts all matches to bundles", () => {
    const matches = [mockMatch(), mockMatch(), mockMatch()];
    const bundles = matchesToRelays(matches);
    expect(bundles).toHaveLength(3);
  });
});

describe("unmatchedToAlert", () => {
  it("returns encoded alert for urgent requests", () => {
    const post = mockRequest();
    post.urgency = 5;
    const alert = unmatchedToAlert(post);
    expect(alert).toMatch(/^VFX\|/);
  });

  it("returns empty string for offers", () => {
    const post = mockOffer();
    expect(unmatchedToAlert(post)).toBe("");
  });

  it("encodes lower priority for non-urgent requests", () => {
    const post = mockRequest();
    post.urgency = 2;
    const alert = unmatchedToAlert(post);
    expect(alert).toMatch(/^VFX\|/);
  });
});

describe("exportExchangeBatch", () => {
  it("encodes all active posts", () => {
    const posts = [mockOffer(), mockRequest()];
    const batch = exportExchangeBatch(posts);
    expect(batch).toContain("VFX|");
    expect(batch.split("\n")).toHaveLength(2);
  });

  it("skips inactive posts", () => {
    const post = mockOffer();
    post.active = false;
    const batch = exportExchangeBatch([post]);
    expect(batch).toBe("");
  });
});
