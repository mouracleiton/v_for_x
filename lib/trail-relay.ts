/**
 * V FOR X — Trail Relay (QR handoff of Trail entries, VFXTRL1)
 *
 * Lets a Trail need/offer travel on paper. A poster encodes their entry
 * into a single VFXTRL1 token, then `segmentForQR` splits that token
 * into printable QR segments (reusing `lib/relay.ts`). A recipient scans
 * the segments, reassembles the token, decodes it, and the entry appears
 * in their local Trail — no network required.
 *
 * This is how The Trail works under blackout: a volunteer prints QR
 * codes of open needs/offers; a courier carries the paper; recipients
 * scan and rebuild the entry offline. The segments are self-describing
 * and ordered, so partial scans still progress.
 *
 * Token format: VFXTRL1:base64url(JSON(TrailEntry))
 */

import { segmentForQR, reassembleSegments, type QRSegment } from "./relay";
import type { TrailEntry } from "./trail-match";

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

export const TRAIL_RELAY_PREFIX = "VFXTRL1:";

/** Max QR payload per segment (kept conservative for cheap scanners). */
export const TRAIL_QR_MAX = 180;

/* ═══════════════════════════════════════════════════════════════
   Encoding helpers
   ═══════════════════════════════════════════════════════════════ */

function bufToB64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    for (let j = 0; j < Math.min(chunk, bytes.length - i); j++) {
      binary += String.fromCharCode(bytes[i + j]);
    }
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* ═══════════════════════════════════════════════════════════════
   Validation
   ═══════════════════════════════════════════════════════════════ */

/**
 * Validate the shape of a TrailEntry for relay. Returns a reason if
 * the entry is unusable.
 */
export function validateTrailEntry(entry: unknown): { ok: boolean; reason?: string } {
  if (!entry || typeof entry !== "object") return { ok: false, reason: "not_an_object" };
  const e = entry as Record<string, unknown>;
  if (typeof e.id !== "string" || !e.id) return { ok: false, reason: "missing_id" };
  if (e.type !== "need" && e.type !== "offer") return { ok: false, reason: "bad_type" };
  if (typeof e.category !== "string" || !e.category) return { ok: false, reason: "missing_category" };
  if (typeof e.iso3 !== "string" || !/^[A-Z]{3}$/.test(e.iso3)) {
    return { ok: false, reason: "bad_iso3" };
  }
  if (typeof e.ts !== "number" || !Number.isFinite(e.ts)) return { ok: false, reason: "bad_ts" };
  if (e.lat != null && typeof e.lat !== "number") return { ok: false, reason: "bad_lat" };
  if (e.lon != null && typeof e.lon !== "number") return { ok: false, reason: "bad_lon" };
  return { ok: true };
}

/* ═══════════════════════════════════════════════════════════════
   Token encoding
   ═══════════════════════════════════════════════════════════════ */

/** Encode a TrailEntry as a VFXTRL1 token. */
export function encodeTrailEntry(entry: TrailEntry): string {
  const check = validateTrailEntry(entry);
  if (!check.ok) throw new Error(`Invalid TrailEntry: ${check.reason}`);
  const json = JSON.stringify(entry);
  return TRAIL_RELAY_PREFIX + bufToB64url(new TextEncoder().encode(json));
}

/** Decode a VFXTRL1 token into a TrailEntry. Throws on malformed input. */
export function decodeTrailEntry(token: string): TrailEntry {
  const raw = (token ?? "").trim();
  if (!raw.startsWith(TRAIL_RELAY_PREFIX)) {
    throw new Error(`Not a trail-relay token (expected ${TRAIL_RELAY_PREFIX})`);
  }
  let json: string;
  try {
    json = new TextDecoder().decode(b64urlToBytes(raw.slice(TRAIL_RELAY_PREFIX.length)));
  } catch {
    throw new Error("Malformed trail-relay token (bad base64url)");
  }
  let entry: TrailEntry;
  try {
    entry = JSON.parse(json) as TrailEntry;
  } catch {
    throw new Error("Malformed trail-relay token (bad JSON)");
  }
  const check = validateTrailEntry(entry);
  if (!check.ok) throw new Error(`Invalid TrailEntry in token: ${check.reason}`);
  return entry;
}

/** Detect a trail-relay token. */
export function isTrailRelayToken(token: string): boolean {
  return typeof token === "string" && token.trim().startsWith(TRAIL_RELAY_PREFIX);
}

/* ═══════════════════════════════════════════════════════════════
   QR segmentation (the handoff)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Split a TrailEntry into ordered QR segments for paper handoff.
 * Each segment is a self-describing QR payload; scan order doesn't
 * matter (they carry index/total).
 */
export function segmentTrailForQR(
  entry: TrailEntry,
  maxLen = TRAIL_QR_MAX,
): QRSegment[] {
  const token = encodeTrailEntry(entry);
  return segmentForQR(token, maxLen);
}

/**
 * Split a raw token string into QR segments (for re-segmenting an
 * already-encoded token).
 */
export function segmentTokenForQR(
  token: string,
  maxLen = TRAIL_QR_MAX,
): QRSegment[] {
  return segmentForQR(token, maxLen);
}

/**
 * Reassemble QR segments back into a TrailEntry. Returns null if the
 * segments are incomplete or corrupt.
 */
export function reassembleTrailFromSegments(segments: QRSegment[]): TrailEntry | null {
  const token = reassembleSegments(segments);
  if (token === null) return null;
  try {
    return decodeTrailEntry(token);
  } catch {
    return null;
  }
}

/** Reassemble segments into the raw token string (without decoding). */
export function reassembleTokenFromSegments(segments: QRSegment[]): string | null {
  return reassembleSegments(segments);
}

/* ═══════════════════════════════════════════════════════════════
   Display helpers
   ═══════════════════════════════════════════════════════════════ */

/** Human-readable label for an entry (e.g. "NEED · insulin · SDN"). */
export function describeTrailEntry(entry: TrailEntry): string {
  const item = entry.item || entry.category;
  return `${entry.type.toUpperCase()} · ${item} · ${entry.iso3}`;
}

/** One-line summary of how many QR segments an entry produces. */
export function segmentSummary(segments: QRSegment[]): string {
  if (segments.length === 0) return "no segments";
  const first = segments[0];
  return `${segments.length} QR segment${segments.length === 1 ? "" : "s"} (${first.index + 1}/${first.total})`;
}
