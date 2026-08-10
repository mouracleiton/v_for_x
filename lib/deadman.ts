/**
 * V FOR X — Auto-Release layer for The Guardian (dead man's switch)
 *
 * guardian.ts PREPARES messages and guardian-packet.ts SIGNS release
 * packets. This module is the firing pin: a pure, deterministic
 * scheduler that watches a GuardianRecord, decides when a signed
 * release packet must be emitted, and keeps a small append-only
 * ledger (AutoReleaseRecord) of what left this device, when, and
 * through which channel.
 *
 * DESIGN
 *  ─ Pure and timer-free. Every function takes `now` (epoch ms)
 *    explicitly, or defaults to Date.now() exactly like evaluateStatus
 *    in guardian.ts does. The React page owns setInterval; this module
 *    only decides and records. Fully unit-testable with fake clocks.
 *  ─ Decision ladder (see decideRelease):
 *       1. already released (same guardianId + deadline)  → skip
 *       2. record is "safe" (disarmed)                    → skip
 *       3. duress flag / panic active (opts.panicOrDuress) → RELEASE now
 *       4. deadline not reached                           → skip
 *       5. otherwise                                      → RELEASE
 *    The deadline is the Guardian's own: lastCheckIn +
 *    checkInHours * 3.6e6 (reused from evaluateStatus).
 *  ─ Duress and panic do NOT wait for the deadline: the moment the
 *    operator is under coercion or pressed PANIC, the switch fires on
 *    the next tick. Safe / disarmed is final — nothing releases it.
 *  ─ The packet itself (ECDSA signing, token encoding, mirror URL)
 *    lives in guardian-packet.ts. The page signs it and hands the
 *    result here as an AutoReleaseRecord; this module renders the
 *    human notice and offers a compact VFXDM1: share string so the
 *    released packet can travel through clipboards and hash links the
 *    same way VFXGP1: tokens do.
 *  ─ Ledger persistence is localStorage under "vfx-deadman-releases",
 *    with an optional prune window (90 days is the default the page
 *    uses). Every storage access is guarded and never throws.
 *
 * LIMITS (honest): this fires only while the device is powered on and
 * the page is open. There is no backend. When it fires it broadcasts
 * locally (clipboard / share sheet / on-screen) — the human courier
 * still carries the packet the last mile.
 */

import { evaluateStatus, type GuardianRecord } from "@/lib/guardian";

/** Prefix for the compact release-share string (VFXDM1:). */
export const DEADMAN_PREFIX = "VFXDM1:";

/** localStorage key for the auto-release ledger. */
export const RELEASES_STORAGE_KEY = "vfx-deadman-releases";

export interface AutoReleaseRecord {
  /** GuardianRecord.id the release belongs to. */
  guardianId: string;
  /** Epoch ms of the missed deadline that triggered this release. */
  deadline: number;
  /** Epoch ms when the release fired. */
  releasedAt: number;
  /** Encoded release packet (VFXGP1:...), ready to hand over. */
  packetToken: string;
  /** Mirror URL (#packet=...) that delivers the packet on any copy of the platform. */
  packetUrl: string;
  /** Short content-hash fingerprint of the signed packet. */
  fingerprint: string;
  /** How the packet left this device. */
  channel: "clipboard" | "signal" | "datachannel" | "manual";
}

export type ReleaseDecision =
  | "release"
  | "skip-already-released"
  | "skip-safe"
  | "skip-not-due";

/* ═══════════════════════════════════════════════════════════
   DECISION CORE
   ═══════════════════════════════════════════════════════════ */

/**
 * Decide whether a guardian should release right now.
 *
 * Ladder: already-released beats everything (a release is fire-once
 * per guardian+deadline pair, even during panic); then safe/disarmed
 * stands down permanently; then duress/panic fires immediately; then
 * the deadline gates a normal release.
 */
export function decideRelease(
  record: GuardianRecord,
  opts: {
    now: number;
    releases: AutoReleaseRecord[];
    /** Duress flag or panic active — release without waiting for the deadline. */
    panicOrDuress?: boolean;
  },
): ReleaseDecision {
  const deadline = nextDeadline(record);

  const alreadyReleased = opts.releases.some(
    (r) => r.guardianId === record.id && r.deadline === deadline,
  );
  if (alreadyReleased) return "skip-already-released";

  if (record.status === "safe") return "skip-safe";

  if (opts.panicOrDuress) return "release";

  if (opts.now < deadline) return "skip-not-due";

  return "release";
}

/** The epoch-ms deadline of the next scheduled check-in (never changes with `now`). */
export function nextDeadline(record: GuardianRecord): number {
  return evaluateStatus(record).deadline;
}

/** Milliseconds until the release fires; negative once the deadline has passed. */
export function msUntilRelease(record: GuardianRecord, now: number): number {
  return nextDeadline(record) - now;
}

/* ═══════════════════════════════════════════════════════════
   RELEASE LEDGER
   ═══════════════════════════════════════════════════════════ */

/**
 * Append a release to the ledger. Dedupes on the guardianId+deadline
 * pair: a re-release for the same pair replaces the older entry in
 * place (latest channel/URL wins, count stays constant).
 */
export function markReleased(
  releases: AutoReleaseRecord[],
  release: AutoReleaseRecord,
): AutoReleaseRecord[] {
  return [
    ...releases.filter(
      (r) => !(r.guardianId === release.guardianId && r.deadline === release.deadline),
    ),
    release,
  ];
}

/** Drop releases older than keepMs (relative to `now`). */
export function pruneReleases(
  releases: AutoReleaseRecord[],
  keepMs: number,
  now = Date.now(),
): AutoReleaseRecord[] {
  return releases.filter((r) => now - r.releasedAt < keepMs);
}

/* ═══════════════════════════════════════════════════════════
   HUMAN NOTICE
   ═══════════════════════════════════════════════════════════ */

function fmtTimestamp(ms: number): string {
  try {
    return new Date(ms).toISOString();
  } catch {
    return String(ms);
  }
}

/** Human-readable release block for the card and logs (buildPanicBroadcast-style). */
export function formatReleaseNotice(release: AutoReleaseRecord): string {
  const tokenPreview = `${release.packetToken.slice(0, 24)}…${release.packetToken.slice(-8)} (${release.packetToken.length} chars)`;
  return [
    "▛ DEAD MAN'S SWITCH — RELEASED",
    `Guardian: ${release.guardianId}`,
    `Fingerprint: ${release.fingerprint}`,
    `Deadline: ${fmtTimestamp(release.deadline)}`,
    `Released: ${fmtTimestamp(release.releasedAt)}`,
    `Channel: ${release.channel}`,
    `Packet: ${tokenPreview}`,
    `URL: ${release.packetUrl}`,
  ].join("\n");
}

/* ═══════════════════════════════════════════════════════════
   SHARE STRING (VFXDM1: — compact, base64url JSON)
   ═══════════════════════════════════════════════════════════ */

function bufToB64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBuf(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function isAutoReleaseRecord(v: unknown): v is AutoReleaseRecord {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.guardianId === "string" &&
    typeof r.deadline === "number" &&
    typeof r.releasedAt === "number" &&
    typeof r.packetToken === "string" &&
    typeof r.packetUrl === "string" &&
    typeof r.fingerprint === "string" &&
    (r.channel === "clipboard" ||
      r.channel === "signal" ||
      r.channel === "datachannel" ||
      r.channel === "manual")
  );
}

/** Encode a release as a compact VFXDM1: share string (base64url of JSON). */
export function encodeReleaseShare(release: AutoReleaseRecord): string {
  return DEADMAN_PREFIX + bufToB64url(new TextEncoder().encode(JSON.stringify(release)));
}

/** Decode a VFXDM1: share string back into a release record. Throws on malformed input. */
export function decodeReleaseShare(share: string): AutoReleaseRecord {
  const raw = (share ?? "").trim();
  if (!raw.startsWith(DEADMAN_PREFIX)) {
    throw new Error("Not a dead man's switch release share");
  }
  let json: string;
  try {
    json = new TextDecoder().decode(b64urlToBuf(raw.slice(DEADMAN_PREFIX.length)));
  } catch {
    throw new Error("Corrupt release share (bad base64)");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Corrupt release share (bad JSON)");
  }
  if (!isAutoReleaseRecord(parsed)) {
    throw new Error("Corrupt release share — missing required fields");
  }
  return parsed;
}

/* ═══════════════════════════════════════════════════════════
   PERSISTENCE (guarded, never throws)
   ═══════════════════════════════════════════════════════════ */

/** Load the release ledger from localStorage; empty array on any failure. */
export function loadReleases(): AutoReleaseRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RELEASES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAutoReleaseRecord);
  } catch {
    return [];
  }
}

/** Persist the release ledger; silently ignores quota/privacy-mode failures. */
export function saveReleases(releases: AutoReleaseRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RELEASES_STORAGE_KEY, JSON.stringify(releases));
  } catch {
    /* private mode / quota — the release still stands in memory */
  }
}