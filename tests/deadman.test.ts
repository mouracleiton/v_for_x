import { describe, it, expect, vi } from "vitest";
import type { GuardianRecord, GuardianConfig, TrustedContact } from "../lib/guardian";
import {
  createGuardianSigningKey,
  buildReleasePacket,
  encodeReleasePacket,
  buildPacketUrl,
  packetFingerprint,
} from "../lib/guardian-packet";
import {
  DEADMAN_PREFIX,
  RELEASES_STORAGE_KEY,
  decideRelease,
  nextDeadline,
  msUntilRelease,
  markReleased,
  pruneReleases,
  formatReleaseNotice,
  encodeReleaseShare,
  decodeReleaseShare,
  loadReleases,
  saveReleases,
  type AutoReleaseRecord,
} from "../lib/deadman";

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

const T = 1_700_000_000_000;
const HOUR = 3_600_000;
const DEADLINE = T + 12 * HOUR; // lastCheckIn=T, checkInHours=12

const CONTACTS: TrustedContact[] = [
  { id: "c1", label: "Editor", handle: "signal-editor", escalateAfterMin: 0 },
  { id: "c2", label: "Lawyer", handle: "proton-lawyer", escalateAfterMin: 60 },
];

function makeRecord(
  overrides: Omit<Partial<GuardianRecord>, "config"> & { config?: Partial<GuardianConfig> } = {},
): GuardianRecord {
  const base: GuardianRecord = {
    id: "guardian-test-1",
    config: {
      label: "Maria — Beirut bureau",
      checkInHours: 12,
      armedAt: T,
      lastCheckIn: T,
      contacts: CONTACTS,
      escalationMessage: "I may have been detained. Contact the hotline.",
      safeCode: "sunrise",
      duressCode: "harvest",
    },
    location: null,
    salt: "c2FsdC0x",
    verifyHash: "aGVsbG8=",
    iterations: 150_000,
    status: "armed",
    panicTriggeredAt: null,
    duressFlag: false,
    escalations: [],
  };
  return {
    ...base,
    ...overrides,
    config: { ...base.config, ...(overrides.config ?? {}) },
  };
}

function makeRelease(
  overrides: Partial<AutoReleaseRecord> = {},
): AutoReleaseRecord {
  return {
    guardianId: "guardian-test-1",
    deadline: DEADLINE,
    releasedAt: DEADLINE,
    packetToken: "VFXGP1:abc123",
    packetUrl: "https://vfx.test/the-guardian#packet=VFXGP1:abc123",
    fingerprint: "a1b2c3d4e5f6",
    channel: "clipboard",
    ...overrides,
  };
}

describe("deadman.ts — decideRelease", () => {
  it("releases at the deadline", () => {
    const record = makeRecord();
    expect(decideRelease(record, { now: nextDeadline(record), releases: [] })).toBe("release");
  });

  it("releases after the deadline (overdue)", () => {
    const record = makeRecord();
    const now = nextDeadline(record) + 60_000;
    expect(decideRelease(record, { now, releases: [] })).toBe("release");
  });

  it("does not release before the deadline", () => {
    const record = makeRecord();
    const now = nextDeadline(record) - 1;
    expect(decideRelease(record, { now, releases: [] })).toBe("skip-not-due");
  });

  it("skips a safe (disarmed) record even when overdue or panicked", () => {
    const record = makeRecord({
      status: "safe",
      panicTriggeredAt: T,
      config: { lastCheckIn: T - 24 * HOUR },
    });
    expect(decideRelease(record, { now: T, releases: [] })).toBe("skip-safe");
    expect(
      decideRelease(record, { now: T, releases: [], panicOrDuress: true }),
    ).toBe("skip-safe");
  });

  it("skips an already-released pair for the same guardian and deadline", () => {
    const record = makeRecord();
    const releases = [makeRelease({ guardianId: record.id, deadline: nextDeadline(record) })];
    const now = nextDeadline(record) + 60_000;
    expect(decideRelease(record, { now, releases })).toBe("skip-already-released");
    expect(
      decideRelease(record, { now, releases, panicOrDuress: true }),
    ).toBe("skip-already-released");
  });

  it("does not treat a release for another guardian or deadline as duplicate", () => {
    const record = makeRecord();
    const releases = [makeRelease({ guardianId: "other-guardian", deadline: DEADLINE })];
    expect(decideRelease(record, { now: DEADLINE, releases })).toBe("release");
  });

  it("releases immediately on a duress flag, before the deadline", () => {
    const record = makeRecord({ duressFlag: true });
    const now = nextDeadline(record) - 5 * HOUR;
    expect(decideRelease(record, { now, releases: [], panicOrDuress: true })).toBe("release");
  });

  it("releases immediately on panic, before the deadline", () => {
    const record = makeRecord({ status: "panic", panicTriggeredAt: T - 60_000 });
    const now = nextDeadline(record) - 5 * HOUR;
    expect(decideRelease(record, { now, releases: [], panicOrDuress: true })).toBe("release");
  });
});

describe("deadman.ts — deadline math", () => {
  it("nextDeadline reuses evaluateStatus logic (lastCheckIn + checkInHours)", () => {
    const record = makeRecord({ config: { lastCheckIn: T, checkInHours: 24 } });
    expect(nextDeadline(record)).toBe(T + 24 * HOUR);
    expect(nextDeadline(record)).toBe(record.config.lastCheckIn + 24 * HOUR);
  });

  it("msUntilRelease is positive before and negative after the deadline", () => {
    const record = makeRecord();
    expect(msUntilRelease(record, nextDeadline(record) - 10_000)).toBe(10_000);
    expect(msUntilRelease(record, nextDeadline(record))).toBe(0);
    expect(msUntilRelease(record, nextDeadline(record) + 10_000)).toBe(-10_000);
  });
});

describe("deadman.ts — ledger", () => {
  it("markReleased appends a new release", () => {
    const r1 = makeRelease();
    const r2 = makeRelease({ guardianId: "guardian-test-2", deadline: T + HOUR });
    expect(markReleased([], r1)).toEqual([r1]);
    expect(markReleased([r1], r2)).toEqual([r1, r2]);
  });

  it("markReleased dedupes by guardianId+deadline, keeping the latest", () => {
    const r1 = makeRelease();
    const updated = makeRelease({ channel: "signal" });
    expect(markReleased([r1], updated)).toHaveLength(1);
    expect(markReleased([r1], updated)[0]).toEqual(updated);
  });

  it("pruneReleases drops entries older than keepMs", () => {
    const now = T + 100 * HOUR;
    const old = makeRelease({ releasedAt: now - 91 * 24 * HOUR });
    const fresh = makeRelease({ releasedAt: now - 1000 });
    expect(pruneReleases([old, fresh], 90 * 24 * HOUR, now)).toEqual([fresh]);
    expect(pruneReleases([old, fresh], 0, now)).toEqual([]);
  });
});

describe("deadman.ts — persistence", () => {
  it("loadReleases/saveReleases round-trip through localStorage", () => {
    localStorage.clear();
    expect(loadReleases()).toEqual([]);
    const releases = [makeRelease(), makeRelease({ guardianId: "g2", deadline: T + HOUR })];
    saveReleases(releases);
    expect(loadReleases()).toEqual(releases);
  });

  it("loadReleases returns [] on corrupt or invalid data, never throws", () => {
    localStorage.clear();
    localStorage.setItem(RELEASES_STORAGE_KEY, "{not json");
    expect(loadReleases()).toEqual([]);
    localStorage.setItem(RELEASES_STORAGE_KEY, JSON.stringify([{ bad: true }]));
    expect(loadReleases()).toEqual([]);
    localStorage.setItem(RELEASES_STORAGE_KEY, JSON.stringify("not-an-array"));
    expect(loadReleases()).toEqual([]);
  });
});

describe("deadman.ts — share string", () => {
  it("encodeReleaseShare/decodeReleaseShare round-trip", () => {
    const release = makeRelease({
      releasedAt: DEADLINE + 1000,
      channel: "manual",
    });
    const share = encodeReleaseShare(release);
    expect(share.startsWith(DEADMAN_PREFIX)).toBe(true);
    expect(decodeReleaseShare(share)).toEqual(release);
  });

  it("decodeReleaseShare rejects wrong prefix and corrupt payloads", () => {
    expect(() => decodeReleaseShare("nope")).toThrow(/Not a dead man's switch release share/);
    expect(() => decodeReleaseShare(DEADMAN_PREFIX + "!!!")).toThrow();
    expect(() =>
      decodeReleaseShare(
        DEADMAN_PREFIX + btoa(JSON.stringify({ guardianId: 1, deadline: "x" })),
      ),
    ).toThrow(/missing required fields/);
  });
});

describe("deadman.ts — notice", () => {
  it("formatReleaseNotice renders the release block", () => {
    const notice = formatReleaseNotice(makeRelease());
    expect(notice).toContain("▛ DEAD MAN'S SWITCH — RELEASED");
    expect(notice).toContain("guardian-test-1");
    expect(notice).toContain("a1b2c3d4e5f6");
    expect(notice).toContain("clipboard");
    expect(notice).toContain("https://vfx.test/the-guardian");
  });
});

describe("deadman.ts — end-to-end release path (guardian-packet + Web Crypto)", () => {
  it("signs, encodes, releases and shares a real packet for an armed guardian", async () => {
    const record = makeRecord({ config: { lastCheckIn: T - 12 * HOUR } });
    const key = await createGuardianSigningKey();
    const packet = await buildReleasePacket(record, key, null, DEADLINE);
    const token = encodeReleasePacket(packet);
    const url = buildPacketUrl(token, "https://vfx.test/the-guardian");

    expect(decideRelease(record, { now: DEADLINE, releases: [] })).toBe("release");

    const release: AutoReleaseRecord = {
      guardianId: record.id,
      deadline: nextDeadline(record),
      releasedAt: DEADLINE,
      packetToken: token,
      packetUrl: url,
      fingerprint: packetFingerprint(packet),
      channel: "clipboard",
    };

    const share = encodeReleaseShare(release);
    expect(decodeReleaseShare(share)).toEqual(release);

    const ledger = markReleased([], release);
    expect(ledger).toHaveLength(1);
    // Now the pair is recorded — refiring for the same deadline is skipped.
    expect(
      decideRelease(record, { now: DEADLINE + 60_000, releases: ledger }),
    ).toBe("skip-already-released");
  });
});