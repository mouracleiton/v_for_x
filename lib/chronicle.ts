/**
 * V FOR X — The Chronicle (Distributed Event Mapping)
 *
 * A crowdsourced, verified incident map — a distributed Ushahidi. Citizens
 * submit geolocated events; each event is cryptographically signed and
 * hash-chained to the one before it, forming a tamper-evident append-only
 * log. Community members corroborate events, raising their verification
 * status. The result is a living record of incidents plotted across a map
 * and a timeline that no single authority can silently rewrite.
 *
 * How the chain works:
 *   • Every event carries a `hash` = SHA-256 over its canonical content,
 *     which INCLUDES the previous event's hash (`prevHash`).
 *   • The first event links to the genesis hash (all zeros).
 *   • Tampering with any past event invalidates its own hash and therefore
 *     every hash downstream of it.
 *   • The `signature` field (ECDSA P-256 over the hash) is NOT part of the
 *     hashed content, so authenticity can be verified independently of the
 *     chain while the chain still proves content integrity + ordering.
 *
 * This is a client-side only chain — no external consensus. For
 * multi-device verification, export the chain and compare hashes head-to-head.
 *
 * Used by /the-chronicle. Pure functions throughout so every computation
 * is independently unit-tested in tests/chronicle.test.ts.
 */

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

export interface LatLng {
  lat: number;
  lng: number;
}

/** The kind of incident being recorded. */
export type EventType =
  | "civilian_harm"
  | "killing"
  | "arbitrary_arrest"
  | "detention"
  | "forced_displacement"
  | "indiscriminate_attack"
  | "infrastructure_damage"
  | "aid_blockade"
  | "censorship"
  | "surveillance"
  | "environmental"
  | "forced_eviction"
  | "protest"
  | "other";

export type Severity = "info" | "low" | "moderate" | "high" | "critical";

export type VerificationStatus = "UNVERIFIED" | "SIGNED" | "CORROBORATED" | "VERIFIED";

/** How a corroborator vouches for an event's credibility. */
export type ProofType = "witness" | "documentary" | "expert";

/**
 * A single community attestation. Lightweight and append-only.
 * Not part of the chain hash — corroboration is a second-order signal
 * layered on top of the signed, chained event record.
 */
export interface Corroboration {
  /** Anonymous handle or public-key fingerprint of the corroborator. */
  handle: string;
  /** When the attestation was made. */
  ts: number;
  /** How the corroborator can vouch. */
  proofType: ProofType;
  /** Optional note. */
  note?: string;
}

/**
 * A geolocated event in the Chronicle chain.
 * `hash` + `prevHash` form the tamper-evident chain; `signature` proves
 * authorship without identity.
 */
export interface ChronicleEvent extends LatLng {
  /** Stable unique id (not part of the hash — purely an index key). */
  id: string;
  /** SHA-256 hex of this event's canonical content (includes prevHash). */
  hash: string;
  /** SHA-256 hex of the previous event in the chain (genesis = zeros). */
  prevHash: string;
  /** Epoch milliseconds the event occurred / was recorded. */
  ts: number;
  type: EventType;
  severity: Severity;
  /** Short headline (<= 120 chars). */
  title: string;
  /** Longer description (optional). */
  description?: string;
  /** Free-text location label, e.g. "Khartoum, Sudan". */
  location?: string;
  /** ISO-3 country code when known (for cross-linking). */
  iso3?: string;
  /** Provenance of the report. */
  source: "self" | "crowd" | "verified";
  /** Anonymous handle of the author. */
  signerHandle: string;
  /** Author's SPKI public key (base64), present when signed. */
  publicKey?: string;
  /** ECDSA signature over `hash` (base64), present when signed. */
  signature?: string;
  /** Community attestations layered on this event. */
  corroborations: Corroboration[];
}

export interface EventTypeMeta {
  type: EventType;
  label: string;
  glyph: string;
  /** Intrinsic severity weight 0..100 — how grave this kind of event is. */
  gravity: number;
  defaultSeverity: Severity;
  description: string;
}

export interface ChainVerification {
  valid: boolean;
  brokenAt: number | null;
  totalEvents: number;
  brokenHash: string | null;
  message: string;
}

export interface ChronicleSummary {
  total: number;
  signed: number;
  verified: number;
  corroborated: number;
  byType: Partial<Record<EventType, number>>;
  bySeverity: Partial<Record<Severity, number>>;
  /** Number of distinct 0.5° grid cells containing events. */
  activeCells: number;
  /** Earliest event ts in the chain. */
  earliest: number | null;
  /** Latest event ts in the chain. */
  latest: number | null;
}

/** A bucket on the timeline axis. */
export interface TimelineBucket {
  /** Bucket start epoch ms. */
  start: number;
  /** Bucket end epoch ms (exclusive). */
  end: number;
  label: string;
  events: ChronicleEvent[];
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

/** The genesis hash — all zeros. First event links to this. */
export const GENESIS_HASH = "0".repeat(64);

/** Thresholds (in corroborations) for verification tiers. */
export const CORROBORATED_THRESHOLD = 1;
export const VERIFIED_THRESHOLD = 3;

/* ═══════════════════════════════════════════════════════════════
   EVENT CATALOG
   ═══════════════════════════════════════════════════════════════ */

export const EVENT_TYPES: Record<EventType, EventTypeMeta> = {
  killing: {
    type: "killing",
    label: "Killing / Death",
    glyph: "⚰️",
    gravity: 100,
    defaultSeverity: "critical",
    description: "Death of a civilian or named individual.",
  },
  indiscriminate_attack: {
    type: "indiscriminate_attack",
    label: "Indiscriminate Attack",
    glyph: "🎯",
    gravity: 95,
    defaultSeverity: "critical",
    description: "Weapons used without distinction on civilians.",
  },
  civilian_harm: {
    type: "civilian_harm",
    label: "Civilian Harm",
    glyph: "💥",
    gravity: 85,
    defaultSeverity: "high",
    description: "Injury or harm to non-combatants.",
  },
  arbitrary_arrest: {
    type: "arbitrary_arrest",
    label: "Arbitrary Arrest",
    glyph: "⛓️",
    gravity: 75,
    defaultSeverity: "high",
    description: "Arrest without lawful basis or due process.",
  },
  detention: {
    type: "detention",
    label: "Disappearance / Detention",
    glyph: "🔒",
    gravity: 80,
    defaultSeverity: "high",
    description: "Holding, disappearance, or incommunicado detention.",
  },
  forced_displacement: {
    type: "forced_displacement",
    label: "Forced Displacement",
    glyph: "🚶",
    gravity: 70,
    defaultSeverity: "high",
    description: "People forced to flee their homes.",
  },
  forced_eviction: {
    type: "forced_eviction",
    label: "Forced Eviction",
    glyph: "🏚️",
    gravity: 60,
    defaultSeverity: "moderate",
    description: "Destruction or seizure of homes and land.",
  },
  aid_blockade: {
    type: "aid_blockade",
    label: "Aid Blockade",
    glyph: "🚧",
    gravity: 78,
    defaultSeverity: "high",
    description: "Humanitarian access deliberately blocked.",
  },
  infrastructure_damage: {
    type: "infrastructure_damage",
    label: "Infrastructure Damage",
    glyph: "🏗️",
    gravity: 55,
    defaultSeverity: "moderate",
    description: "Hospitals, schools, water/power, homes struck.",
  },
  censorship: {
    type: "censorship",
    label: "Censorship / Blackout",
    glyph: "🔇",
    gravity: 45,
    defaultSeverity: "moderate",
    description: "Comms blackout, internet shutdown, press suppression.",
  },
  surveillance: {
    type: "surveillance",
    label: "Surveillance",
    glyph: "👁️",
    gravity: 35,
    defaultSeverity: "low",
    description: "Targeted monitoring or spyware deployment.",
  },
  environmental: {
    type: "environmental",
    label: "Environmental Harm",
    glyph: "🏭",
    gravity: 50,
    defaultSeverity: "moderate",
    description: "Pollution, deforestation, resource plunder.",
  },
  protest: {
    type: "protest",
    label: "Protest / Mobilization",
    glyph: "✊",
    gravity: 25,
    defaultSeverity: "low",
    description: "Peaceful assembly or mass mobilization.",
  },
  other: {
    type: "other",
    label: "Other Incident",
    glyph: "📌",
    gravity: 20,
    defaultSeverity: "info",
    description: "Uncategorized event requiring documentation.",
  },
};

export const ALL_EVENT_TYPES = Object.values(EVENT_TYPES).sort(
  (a, b) => b.gravity - a.gravity,
);

export const SEVERITY_INFO: Record<
  Severity,
  { label: string; color: string; weight: number }
> = {
  critical: { label: "CRITICAL", color: "#ff0033", weight: 100 },
  high: { label: "HIGH", color: "#ff6600", weight: 75 },
  moderate: { label: "MODERATE", color: "#ffaa00", weight: 50 },
  low: { label: "LOW", color: "#5588ff", weight: 25 },
  info: { label: "INFO", color: "#22d3a6", weight: 10 },
};

export const SEVERITY_ORDER: Severity[] = ["info", "low", "moderate", "high", "critical"];

/* ═══════════════════════════════════════════════════════════════
   HASH-CHAIN CORE
   ═══════════════════════════════════════════════════════════════ */

/** The subset of fields that participate in the canonical hash. */
interface HashableContent {
  prevHash: string;
  ts: number;
  lat: number;
  lng: number;
  type: EventType;
  severity: Severity;
  title: string;
  description: string;
  location: string;
  iso3: string;
  source: string;
  signerHandle: string;
  publicKey: string;
}

/**
 * Canonical JSON of an event. Deterministic key order. The `id`, `hash`,
 * `signature`, and `corroborations` fields are deliberately excluded —
 * `id` is an index, `hash` is the output, `signature` is verified
 * separately, and corroboration is a layered attestation, not part of the
 * immovable record.
 */
function canonicalize(content: HashableContent): string {
  return JSON.stringify({
    prevHash: content.prevHash,
    ts: content.ts,
    lat: content.lat,
    lng: content.lng,
    type: content.type,
    severity: content.severity,
    title: content.title,
    description: content.description ?? "",
    location: content.location ?? "",
    iso3: content.iso3 ?? "",
    source: content.source,
    signerHandle: content.signerHandle,
    publicKey: content.publicKey ?? "",
  });
}

/** Extract the hashable content from a full event. */
function toContent(e: ChronicleEvent): HashableContent {
  return {
    prevHash: e.prevHash,
    ts: e.ts,
    lat: e.lat,
    lng: e.lng,
    type: e.type,
    severity: e.severity,
    title: e.title,
    description: e.description ?? "",
    location: e.location ?? "",
    iso3: e.iso3 ?? "",
    source: e.source,
    signerHandle: e.signerHandle,
    publicKey: e.publicKey ?? "",
  };
}

/** Compute the SHA-256 chain hash for an event's canonical content. */
export async function computeEventHash(content: HashableContent): Promise<string> {
  const data = new TextEncoder().encode(canonicalize(content));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Append a new event to the chain, linking it to the previous event's hash.
 * The returned event is fully hash-chained; a signature can be attached
 * separately via `attachSignature`.
 */
export async function createEvent(
  input: Omit<
    ChronicleEvent,
    "id" | "hash" | "prevHash" | "corroborations" | "signature"
  > & { id?: string; signature?: string },
  prevHash: string,
): Promise<ChronicleEvent> {
  const content: HashableContent = {
    prevHash,
    ts: input.ts,
    lat: input.lat,
    lng: input.lng,
    type: input.type,
    severity: input.severity,
    title: (input.title ?? "").slice(0, 120),
    description: input.description ?? "",
    location: input.location ?? "",
    iso3: input.iso3 ?? "",
    source: input.source,
    signerHandle: input.signerHandle,
    publicKey: input.publicKey ?? "",
  };
  const hash = await computeEventHash(content);
  return {
    id: input.id ?? uuid(),
    hash,
    prevHash,
    ts: input.ts,
    lat: input.lat,
    lng: input.lng,
    type: input.type,
    severity: input.severity,
    title: content.title,
    description: input.description,
    location: input.location,
    iso3: input.iso3,
    source: input.source,
    signerHandle: input.signerHandle,
    publicKey: input.publicKey,
    signature: input.signature,
    corroborations: [],
  };
}

/** Recompute an event's hash and confirm it matches the stored hash. */
export async function verifyEvent(event: ChronicleEvent): Promise<boolean> {
  const expected = await computeEventHash(toContent(event));
  return expected === event.hash;
}

/**
 * Verify the integrity of an entire chain.
 * Checks that, for every event:
 *   1. Its hash matches its content.
 *   2. Its prevHash matches the previous event's hash.
 *   3. The chain starts at the genesis hash (all zeros).
 * Any tampering with a past event breaks the chain at that point.
 */
export async function verifyChain(events: ChronicleEvent[]): Promise<ChainVerification> {
  if (events.length === 0) {
    return {
      valid: true,
      brokenAt: null,
      totalEvents: 0,
      brokenHash: null,
      message: "Empty chain is valid",
    };
  }

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    const recomputed = await computeEventHash(toContent(event));
    if (recomputed !== event.hash) {
      return {
        valid: false,
        brokenAt: i,
        totalEvents: events.length,
        brokenHash: event.hash,
        message: `Event ${i} hash mismatch — content was tampered after hashing`,
      };
    }

    const expectedPrev = i === 0 ? GENESIS_HASH : events[i - 1].hash;
    if (event.prevHash !== expectedPrev) {
      return {
        valid: false,
        brokenAt: i,
        totalEvents: events.length,
        brokenHash: event.prevHash,
        message: `Event ${i} prevHash does not match event ${i - 1}'s hash — chain broken or events reordered`,
      };
    }
  }

  return {
    valid: true,
    brokenAt: null,
    totalEvents: events.length,
    brokenHash: null,
    message: `Chain valid — ${events.length} events verified`,
  };
}

/** Hash of the last event in a chain (the tip new events link to). */
export function getLastHash(events: ChronicleEvent[]): string {
  if (events.length === 0) return GENESIS_HASH;
  return events[events.length - 1].hash;
}

/** Truncate a hash for display. */
export function shortHash(hash: string): string {
  return hash.slice(0, 12);
}

/* ═══════════════════════════════════════════════════════════════
   SIGNING (ECDSA P-256) — authenticity without identity
   ═══════════════════════════════════════════════════════════════ */

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function hasSubtle(): boolean {
  return typeof window !== "undefined" && !!window.crypto?.subtle;
}

/**
 * Generate an anonymous ECDSA P-256 keypair.
 * Returns SPKI (public) and PKCS8 (private) keys as base64.
 */
export async function generateKey(): Promise<{ publicKey: string; privateKey: string }> {
  if (!hasSubtle()) {
    throw new Error("Web Crypto API unavailable (requires a secure context)");
  }
  const keyPair = await window.crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const pub = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const priv = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  return { publicKey: bufToB64(pub), privateKey: bufToB64(priv) };
}

/** Sign an event's hash with a PKCS8 base64 private key. Returns base64. */
export async function signEvent(hash: string, privateKey: string): Promise<string> {
  if (!hasSubtle()) {
    throw new Error("Web Crypto API unavailable");
  }
  const key = await window.crypto.subtle.importKey(
    "pkcs8",
    b64ToBuf(privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = await window.crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(hash),
  );
  return bufToB64(sig);
}

/**
 * Verify an event's signature against its hash using the stored public key.
 * Returns false if unsigned or unverifiable.
 */
export async function verifySignature(event: ChronicleEvent): Promise<boolean> {
  if (!event.signature || !event.publicKey) return false;
  try {
    const key = await window.crypto.subtle.importKey(
      "spki",
      b64ToBuf(event.publicKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const ok = await window.crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      b64ToBuf(event.signature),
      new TextEncoder().encode(event.hash),
    );
    return ok;
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   CORROBORATION & VERIFICATION STATUS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Verification tier for an event, derived from its signature and the
 * number/quality of community corroborations.
 *   UNVERIFIED  — no signature, no corroborations
 *   SIGNED      — cryptographically signed but not yet corroborated
 *   CORROBORATED — signed (or crowd) + ≥1 independent attestation
 *   VERIFIED    — ≥ VERIFIED_THRESHOLD attestations (≥1 expert/documentary)
 */
export function verificationStatus(event: ChronicleEvent): VerificationStatus {
  const count = event.corroborations.length;
  const hasStrongProof = event.corroborations.some(
    (c) => c.proofType === "expert" || c.proofType === "documentary",
  );
  const isSigned = !!(event.signature && event.publicKey);

  if (count >= VERIFIED_THRESHOLD && (hasStrongProof || isSigned)) return "VERIFIED";
  if (count >= CORROBORATED_THRESHOLD) return "CORROBORATED";
  if (isSigned) return "SIGNED";
  return "UNVERIFIED";
}

/** Append a corroboration to an event (immutable update). */
export function addCorroboration(
  event: ChronicleEvent,
  corroboration: Corroboration,
): ChronicleEvent {
  return {
    ...event,
    corroborations: [...event.corroborations, corroboration],
  };
}

/* ═══════════════════════════════════════════════════════════════
   SPATIAL / TEMPORAL ANALYSIS
   ═══════════════════════════════════════════════════════════════ */

/** Haversine distance in km between two coordinates. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Quantize a coordinate to a grid cell key at a given resolution (degrees). */
export function geoHash(lat: number, lng: number, resolution = 0.5): string {
  const qlat = Math.round(lat / resolution) * resolution;
  const qlng = Math.round(lng / resolution) * resolution;
  return `${qlat.toFixed(2)},${qlng.toFixed(2)}`;
}

/** Cluster events within a radius (km) by proximity to the densest neighbour. */
export function clusterEvents(
  events: ChronicleEvent[],
  radiusKm: number,
): Array<{ center: LatLng; events: ChronicleEvent[]; count: number }> {
  const used = new Set<string>();
  const clusters: Array<{ center: LatLng; events: ChronicleEvent[]; count: number }> = [];
  for (const e of events) {
    if (used.has(e.id)) continue;
    const members = events.filter(
      (o) => !used.has(o.id) && haversineKm(e, o) <= radiusKm,
    );
    members.forEach((m) => used.add(m.id));
    if (members.length === 0) continue;
    const center = {
      lat: members.reduce((s, m) => s + m.lat, 0) / members.length,
      lng: members.reduce((s, m) => s + m.lng, 0) / members.length,
    };
    clusters.push({ center, events: members, count: members.length });
  }
  return clusters.sort((a, b) => b.count - a.count);
}

/**
 * Group events into timeline buckets of a fixed span.
 * `bucketMs` defaults to 1 day. Buckets span the chain's full range.
 */
export function timelineBuckets(
  events: ChronicleEvent[],
  bucketMs: number = 24 * 60 * 60 * 1000,
): TimelineBucket[] {
  if (events.length === 0) return [];
  const times = events.map((e) => e.ts);
  const min = Math.min(...times);
  const max = Math.max(...times);
  // Round the start down to the bucket boundary at/under the earliest event.
  const start = Math.floor(min / bucketMs) * bucketMs;
  const end = Math.ceil((max + 1) / bucketMs) * bucketMs;
  const buckets: TimelineBucket[] = [];
  for (let b = start; b < end; b += bucketMs) {
    const members = events.filter((e) => e.ts >= b && e.ts < b + bucketMs);
    buckets.push({
      start: b,
      end: b + bucketMs,
      label: bucketLabel(b, bucketMs),
      events: members.sort((x, y) => x.ts - y.ts),
    });
  }
  return buckets;
}

function bucketLabel(startMs: number, bucketMs: number): string {
  const d = new Date(startMs);
  if (bucketMs >= 24 * 60 * 60 * 1000) {
    return d.toISOString().slice(0, 10);
  }
  if (bucketMs >= 60 * 60 * 1000) {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
  return new Date(startMs).toISOString().slice(0, 19).replace("T", " ");
}

/** Chain-wide summary statistics. */
export function summarize(events: ChronicleEvent[]): ChronicleSummary {
  const byType: Partial<Record<EventType, number>> = {};
  const bySeverity: Partial<Record<Severity, number>> = {};
  const cells = new Set<string>();
  let signed = 0;
  let verified = 0;
  let corroborated = 0;
  let earliest: number | null = null;
  let latest: number | null = null;

  for (const e of events) {
    byType[e.type] = (byType[e.type] ?? 0) + 1;
    bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1;
    cells.add(geoHash(e.lat, e.lng));
    const status = verificationStatus(e);
    if (e.signature && e.publicKey) signed++;
    if (status === "CORROBORATED" || status === "VERIFIED") corroborated++;
    if (status === "VERIFIED") verified++;
    if (earliest === null || e.ts < earliest) earliest = e.ts;
    if (latest === null || e.ts > latest) latest = e.ts;
  }

  return {
    total: events.length,
    signed,
    verified,
    corroborated,
    byType,
    bySeverity,
    activeCells: cells.size,
    earliest,
    latest,
  };
}

/** Heat color for a 0..100 intensity (green → amber → blood). */
export function heatColor(intensity: number): string {
  const v = Math.max(0, Math.min(100, intensity)) / 100;
  if (v < 0.5) {
    const t = v / 0.5;
    const r = Math.round(0x55 + (0xff - 0x55) * t);
    const g = Math.round(0x88 + (0xaa - 0x88) * t);
    const b = Math.round(0xff - 0xff * t);
    return `rgb(${r},${g},${b})`;
  }
  const t = (v - 0.5) / 0.5;
  const r = 0xff;
  const g = Math.round(0xaa - 0xaa * t * 0.4);
  const b = Math.round(0x00 + 0x33 * t);
  return `rgb(${r},${g},${b})`;
}

/** Effective intensity 0..100 of an event from severity + gravity. */
export function effectiveIntensity(event: ChronicleEvent): number {
  const sev = SEVERITY_INFO[event.severity].weight;
  const grav = EVENT_TYPES[event.type].gravity;
  return Math.round(sev * 0.6 + grav * 0.4);
}

/* ═══════════════════════════════════════════════════════════════
   EXPORT / IMPORT — multi-device chain comparison
   ═══════════════════════════════════════════════════════════════ */

export interface ChronicleExport {
  v: 1;
  exportedAt: number;
  genesis: string;
  events: ChronicleEvent[];
}

/** Serialize a chain to a portable JSON envelope. */
export function exportChain(events: ChronicleEvent[]): ChronicleExport {
  return {
    v: 1,
    exportedAt: Date.now(),
    genesis: GENESIS_HASH,
    events,
  };
}

/** Parse an exported envelope, validating its shape. Throws on malformed input. */
export function importChain(raw: string): ChronicleEvent[] {
  const parsed = JSON.parse(raw) as ChronicleExport;
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.events)) {
    throw new Error("Invalid Chronicle export: missing events array");
  }
  for (const e of parsed.events) {
    if (!e.hash || !e.prevHash || typeof e.ts !== "number") {
      throw new Error("Invalid Chronicle event: missing hash/prevHash/ts");
    }
  }
  return parsed.events as ChronicleEvent[];
}

/* ═══════════════════════════════════════════════════════════════
   SEED DATA & HELPERS
   ═══════════════════════════════════════════════════════════════ */

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Build a realistic demo chain across documented conflict cities. Each
 * event is properly hash-chained to its predecessor. Timestamps are
 * relative to `nowMs` so the timeline always reads as recent.
 *
 * Because the chain is async, this returns a Promise.
 */
export async function seedChain(nowMs: number = Date.now()): Promise<ChronicleEvent[]> {
  const day = 24 * 60 * 60 * 1000;
  const ago = (d: number) => nowMs - d * day;

  type Seed = Omit<
    ChronicleEvent,
    "id" | "hash" | "prevHash" | "corroborations"
  >;
  const seeds: Seed[] = [
    {
      ts: ago(6),
      lat: 15.6,
      lng: 32.5,
      iso3: "SDN",
      location: "Khartoum, Sudan",
      type: "indiscriminate_attack",
      severity: "critical",
      title: "Artillery strikes on residential district",
      description: "Heavy shelling reported across a civilian neighbourhood overnight.",
      source: "crowd",
      signerHandle: "V-7Q2K-9MRX",
      publicKey: "",
    },
    {
      ts: ago(5),
      lat: 15.61,
      lng: 32.53,
      iso3: "SDN",
      location: "Khartoum, Sudan",
      type: "aid_blockade",
      severity: "high",
      title: "Humanitarian convoy turned back at checkpoint",
      description: "Aid trucks carrying food and medical supplies denied entry.",
      source: "verified",
      signerHandle: "V-7Q2K-9MRX",
      publicKey: "",
    },
    {
      ts: ago(5),
      lat: 31.95,
      lng: 35.23,
      iso3: "PSE",
      location: "Gaza Strip",
      type: "infrastructure_damage",
      severity: "critical",
      title: "Hospital power infrastructure struck",
      description: "Main generator knocked offline; patients evacuated.",
      source: "crowd",
      signerHandle: "V-3F8A-2LPC",
      publicKey: "",
    },
    {
      ts: ago(4),
      lat: 16.84,
      lng: 96.17,
      iso3: "MMR",
      location: "Yangon, Myanmar",
      type: "arbitrary_arrest",
      severity: "high",
      title: "Overnight raids detain dozens of activists",
      description: "Coordinated arrests across several townships.",
      source: "crowd",
      signerHandle: "V-5D1Z-7TQB",
      publicKey: "",
    },
    {
      ts: ago(3),
      lat: 50.45,
      lng: 30.52,
      iso3: "UKR",
      location: "Kyiv, Ukraine",
      type: "infrastructure_damage",
      severity: "high",
      title: "Missile strike cuts power to 200k households",
      description: "Substation hit during overnight barrage; rolling outages.",
      source: "verified",
      signerHandle: "V-9X2W-4KDR",
      publicKey: "",
    },
    {
      ts: ago(3),
      lat: 15.5,
      lng: 32.4,
      iso3: "SDN",
      location: "Omdurman, Sudan",
      type: "forced_displacement",
      severity: "high",
      title: "Families flee across the Nile",
      description: "Thousands displaced by advancing front line.",
      source: "crowd",
      signerHandle: "V-7Q2K-9MRX",
      publicKey: "",
    },
    {
      ts: ago(2),
      lat: 19.43,
      lng: -99.13,
      iso3: "MEX",
      location: "Mexico City, Mexico",
      type: "forced_eviction",
      severity: "moderate",
      title: "Homes demolished in informal settlement",
      description: "Residents report no prior notice or relocation offer.",
      source: "crowd",
      signerHandle: "V-4G6H-1VNM",
      publicKey: "",
    },
    {
      ts: ago(2),
      lat: 22.32,
      lng: 114.17,
      iso3: "HKG",
      location: "Hong Kong",
      type: "censorship",
      severity: "moderate",
      title: "Messaging apps throttled during protest",
      description: "Connectivity to several platforms degraded.",
      source: "crowd",
      signerHandle: "V-8J3F-6PLK",
      publicKey: "",
    },
    {
      ts: ago(1),
      lat: 35.7,
      lng: 51.4,
      iso3: "IRN",
      location: "Tehran, Iran",
      type: "protest",
      severity: "low",
      title: "Peaceful march held despite ban",
      description: "Thousands gathered peacefully; no confrontation reported.",
      source: "crowd",
      signerHandle: "V-2B5C-8RXP",
      publicKey: "",
    },
    {
      ts: ago(0),
      lat: -1.29,
      lng: 36.82,
      iso3: "KEN",
      location: "Nairobi, Kenya",
      type: "environmental",
      severity: "moderate",
      title: "Untreated effluent released into river",
      description: "Community reports foul discharge upstream of intake.",
      source: "self",
      signerHandle: "V-6H9D-3WQT",
      publicKey: "",
    },
  ];

  // Chain them together.
  const chain: ChronicleEvent[] = [];
  let prev = GENESIS_HASH;
  for (const s of seeds) {
    const event = await createEvent(s, prev);
    // Seed a couple of corroborations on the gravest events.
    if (event.severity === "critical" || event.severity === "high") {
      const n = Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        event.corroborations.push({
          handle: `V-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random()
            .toString(36)
            .slice(2, 6)
            .toUpperCase()}`,
          ts: event.ts + i * 3600_000,
          proofType: i === 0 ? "witness" : i === 1 ? "documentary" : "expert",
        });
      }
    }
    chain.push(event);
    prev = event.hash;
  }
  return chain;
}
