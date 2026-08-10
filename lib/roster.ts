/**
 * V FOR X — The Roster (Vetted Helper Directory)
 *
 * A crisis-response "yellow pages": lawyers, doctors, journalists,
 * digital-security trainers, and other vetted helpers who assist people
 * living through conflict, repression, and collapse.
 *
 * Trust model — a portable web of self-attestation + peer vouches:
 *
 *   • Each helper SELF-ATTESTS their profile (handle, category, country,
 *     specialties, credentials, contact) by signing it with an ECDSA P-256
 *     keypair they hold. The public key travels inside the entry.
 *   • Other helpers (or anyone with a keypair) PEER-VOUCH an entry by signing
 *     a short attestation bound to that helper's id. Vouches are independent:
 *     adding one never invalidates the helper's own signature.
 *   • Everything is a signed JSON envelope — no backend, no registry
 *     authority. A directory is just a collection of these envelopes. Any
 *     copy of this site (see /fortress) can verify the whole roster locally.
 *
 * All cryptography runs via the Web Crypto API (`crypto.subtle`), which is
 * available in browsers and in Node ≥ 19. Signatures use the IEEE P1363
 * (raw r‖s) format that Web Crypto produces and consumes for ECDSA, so a
 * signature generated in Node verifies in a browser and vice-versa.
 */

import { sha256Sync } from "./citizen-tools";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export type HelperCategory =
  | "lawyer"
  | "doctor"
  | "journalist"
  | "digital_security"
  | "translator"
  | "counselor"
  | "engineer"
  | "logistics";

export type Availability =
  | "available"
  | "limited"
  | "unavailable"
  | "unknown";

/** A self-attested credential claim on a helper's profile. */
export interface Credential {
  /** The claim, e.g. "Licensed attorney — New York Bar #4132891". */
  claim: string;
  /** Optional evidence: registry URL, verifiable reference, or description. */
  evidence?: string;
  /** Year the credential was established, if known. */
  since?: number;
}

/** A peer's signed attestation that a helper is who they claim. */
export interface Vouch {
  /** ID of the helper this vouch attests to (binds the vouch). */
  helperId: string;
  /** Pseudonymous handle of the voucher. */
  byHandle: string;
  /** SPKI (base64) public key of the voucher. */
  byPublicKey: string;
  /** Nature of the relationship, e.g. "Co-counselled 3 asylum appeals". */
  relationship: string;
  /** Free-text endorsement. */
  note: string;
  /** Epoch milliseconds when the vouch was signed. */
  ts: number;
  /** ECDSA-P256 signature (base64, IEEE P1363) over canonicalVouch. */
  signature: string;
}

/** A signed helper profile — one row in the directory. */
export interface Helper {
  id: string;
  /** Entry schema version. */
  version: number;
  /** Pseudonymous handle, e.g. "lex-mira". */
  handle: string;
  category: HelperCategory;
  /** Specific areas of expertise. */
  specialties: string[];
  /** Primary country of operation (ISO 3166-1 alpha-3). */
  country: string;
  /** Broader area / cities of operation (free text). */
  region?: string;
  /** Working languages (ISO 639-1), e.g. ["en","ar"]. */
  languages: string[];
  availability: Availability;
  /** Secure contact channels. Omitted fields stay private. */
  contact: {
    signal?: string;
    email?: string;
    pgp?: string;
    website?: string;
    other?: string;
  };
  /** Self-attested credentials. */
  credentials: Credential[];
  /** Peer vouches (not covered by the helper's own signature). */
  vouches: Vouch[];
  /** SPKI (base64) public key attesting this entry. */
  publicKey: string;
  /** Epoch ms the entry was signed. */
  ts: number;
  /** ECDSA-P256 signature (base64, IEEE P1363) over canonicalHelper. */
  signature: string;
}

/** A portable roster file: a labelled set of signed helper envelopes. */
export interface RosterFile {
  /** File format version. */
  version: number;
  /** Epoch ms the file was generated. */
  generated: number;
  /** Human-readable label for the dataset. */
  label: string;
  helpers: Helper[];
}

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

/* ═══════════════════════════════════════════════════════════════
   Canonicalization (deterministic JSON for stable signing)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Deterministic JSON serializer: object keys are sorted recursively so the
 * same logical value always produces the same byte string, regardless of
 * property insertion order. Numbers, booleans, strings, arrays, and null
 * pass through unchanged.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) out[k] = sortJson(src[k]);
    return out;
  }
  return value;
}

/**
 * The canonical byte-string a helper signs. Excludes the helper's own
 * `signature` AND the `vouches` array: vouches are independent peer
 * attestations, so adding or removing one must not invalidate the helper's
 * self-attestation. The `publicKey` and `id` are included, binding the
 * signing key and identity to the profile.
 */
export function canonicalHelper(h: Helper): string {
  const { signature, vouches, ...rest } = h;
  return stableStringify(rest);
}

/** The canonical byte-string a peer signs when vouching. Excludes `signature`. */
export function canonicalVouch(v: Vouch): string {
  const { signature, ...rest } = v;
  return stableStringify(rest);
}

/* ═══════════════════════════════════════════════════════════════
   Web Crypto helpers (browser + Node ≥ 19)
   ═══════════════════════════════════════════════════════════════ */

function subtleCrypto(): SubtleCrypto | null {
  const c = (
    typeof globalThis !== "undefined"
      ? (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto
      : undefined
  );
  return c?.subtle ?? null;
}

export function hasCrypto(): boolean {
  return subtleCrypto() !== null;
}

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
  const binary = atob(b64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

const EC_PARAMS = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGN_ALG = { name: "ECDSA", hash: "SHA-256" } as const;

/** Generate an ECDSA P-256 keypair. Returns SPKI/PKCS8 keys as base64. */
export async function generateKeyPair(): Promise<KeyPair> {
  const subtle = subtleCrypto();
  if (!subtle) throw new Error("Web Crypto unavailable (requires a secure context)");
  const kp = await subtle.generateKey(EC_PARAMS, true, ["sign", "verify"]);
  const spki = await subtle.exportKey("spki", kp.publicKey);
  const pkcs8 = await subtle.exportKey("pkcs8", kp.privateKey);
  return { publicKey: bufToB64(spki), privateKey: bufToB64(pkcs8) };
}

/** Sign a helper profile with the given PKCS8 (base64) private key. */
export async function signHelper(
  h: Helper,
  privateKeyB64: string,
): Promise<string> {
  const subtle = subtleCrypto();
  if (!subtle) throw new Error("Web Crypto unavailable");
  const key = await subtle.importKey(
    "pkcs8",
    b64ToBuf(privateKeyB64),
    EC_PARAMS,
    false,
    ["sign"],
  );
  const sig = await subtle.sign(
    SIGN_ALG,
    key,
    new TextEncoder().encode(canonicalHelper(h)),
  );
  return bufToB64(sig);
}

/**
 * Verify a helper's self-attested signature against its embedded public key.
 * Returns false (never throws) if the key or signature is missing/malformed.
 */
export async function verifyHelper(h: Helper): Promise<boolean> {
  const subtle = subtleCrypto();
  if (!subtle || !h.signature || !h.publicKey) return false;
  try {
    const key = await subtle.importKey(
      "spki",
      b64ToBuf(h.publicKey),
      EC_PARAMS,
      false,
      ["verify"],
    );
    return await subtle.verify(
      SIGN_ALG,
      key,
      b64ToBuf(h.signature),
      new TextEncoder().encode(canonicalHelper(h)),
    );
  } catch {
    return false;
  }
}

/** Sign a vouch with the voucher's PKCS8 (base64) private key. */
export async function signVouch(
  v: Vouch,
  privateKeyB64: string,
): Promise<string> {
  const subtle = subtleCrypto();
  if (!subtle) throw new Error("Web Crypto unavailable");
  const key = await subtle.importKey(
    "pkcs8",
    b64ToBuf(privateKeyB64),
    EC_PARAMS,
    false,
    ["sign"],
  );
  const sig = await subtle.sign(
    SIGN_ALG,
    key,
    new TextEncoder().encode(canonicalVouch(v)),
  );
  return bufToB64(sig);
}

/** Verify a peer vouch against the voucher's embedded public key. */
export async function verifyVouch(v: Vouch): Promise<boolean> {
  const subtle = subtleCrypto();
  if (!subtle || !v.signature || !v.byPublicKey) return false;
  try {
    const key = await subtle.importKey(
      "spki",
      b64ToBuf(v.byPublicKey),
      EC_PARAMS,
      false,
      ["verify"],
    );
    return await subtle.verify(
      SIGN_ALG,
      key,
      b64ToBuf(v.signature),
      new TextEncoder().encode(canonicalVouch(v)),
    );
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   Identity & display helpers
   ═══════════════════════════════════════════════════════════════ */

/**
 * Short, stable fingerprint for a public key (SPKI base64), e.g. "VFX-9F2A7C1D".
 * Computed from the key bytes so two entries by the same signer match.
 */
export function fingerprintOf(publicKeyB64: string): string {
  return `VFX-${sha256Sync(publicKeyB64).slice(0, 8).toUpperCase()}`;
}

export interface CategoryMeta {
  id: HelperCategory;
  label: string;
  glyph: string;
  blurb: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: "lawyer", label: "Lawyer", glyph: "§", blurb: "Legal aid & representation" },
  { id: "doctor", label: "Doctor", glyph: "✚", blurb: "Medical care & triage" },
  { id: "journalist", label: "Journalist", glyph: "✎", blurb: "Reporting & verification" },
  { id: "digital_security", label: "Digital Security", glyph: "⌖", blurb: "OpSec & secure-comms training" },
  { id: "translator", label: "Translator", glyph: "⇄", blurb: "Interpretation & translation" },
  { id: "counselor", label: "Counselor", glyph: "♥", blurb: "Trauma & mental health" },
  { id: "engineer", label: "Engineer", glyph: "⚙", blurb: "Water, power & shelter" },
  { id: "logistics", label: "Logistics", glyph: "▣", blurb: "Humanitarian supply routing" },
];

export function categoryMeta(id: HelperCategory): CategoryMeta {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}

export interface AvailabilityMeta {
  id: Availability;
  label: string;
  color: string;
}

export const AVAILABILITY: AvailabilityMeta[] = [
  { id: "available", label: "Available", color: "var(--color-terminal-green)" },
  { id: "limited", label: "Limited", color: "var(--color-warning-amber)" },
  { id: "unavailable", label: "Unavailable", color: "var(--color-blood)" },
  { id: "unknown", label: "Unknown", color: "var(--color-content-dim)" },
];

export function availabilityMeta(id: Availability): AvailabilityMeta {
  return AVAILABILITY.find((a) => a.id === id) ?? AVAILABILITY[3];
}

export const TRUST_TIERS = [
  { id: "trusted", label: "TRUSTED", color: "var(--color-terminal-green)", min: 10 },
  { id: "vetted", label: "VETTED", color: "var(--color-warning-amber)", min: 6 },
  { id: "emerging", label: "EMERGING", color: "#00ddff", min: 2 },
  { id: "unverified", label: "UNVERIFIED", color: "var(--color-content-dim)", min: 0 },
] as const;

/* ═══════════════════════════════════════════════════════════════
   Trust scoring
   ═══════════════════════════════════════════════════════════════ */

export type TrustTier = (typeof TRUST_TIERS)[number]["id"];

/**
 * Compute a transparency-weighted trust score:
 *   • self-attestation that verifies cryptographically: +2
 *   • each verified peer vouch (capped at 5): +2 each
 *   • each credential backed by evidence (capped at 3): +1 each
 * The score and its breakdown are fully disclosed in the UI — it is a
 * heuristic convenience, not an oracle.
 */
export function trustScore(
  selfVerified: boolean,
  verifiedVouches: number,
  evidencedCredentials: number,
): number {
  let s = 0;
  if (selfVerified) s += 2;
  s += Math.min(verifiedVouches, 5) * 2;
  s += Math.min(evidencedCredentials, 3);
  return s;
}

export function trustTier(score: number): TrustTier {
  for (const tier of TRUST_TIERS) if (score >= tier.min) return tier.id;
  return "unverified";
}

/** A precomputed, render-ready view of a helper with its verification state. */
export interface HelperView {
  helper: Helper;
  selfVerified: boolean;
  verifiedVouches: number;
  trustScore: number;
  trustTier: TrustTier;
}

export function buildView(
  helper: Helper,
  selfVerified: boolean,
  verifiedVouches: number,
): HelperView {
  const evidenced = helper.credentials.filter((c) => c.evidence).length;
  const score = trustScore(selfVerified, verifiedVouches, evidenced);
  return {
    helper,
    selfVerified,
    verifiedVouches,
    trustScore: score,
    trustTier: trustTier(score),
  };
}

/* ═══════════════════════════════════════════════════════════════
   Client-side filtering & sorting
   ═══════════════════════════════════════════════════════════════ */

export type RosterSort = "trust" | "recent" | "handle";

export interface RosterFilter {
  query: string;
  categories: HelperCategory[];
  countries: string[];
  languages: string[];
  availability: Availability[];
  onlyVerified: boolean;
  onlyVouched: boolean;
  sort: RosterSort;
}

export const EMPTY_FILTER: RosterFilter = {
  query: "",
  categories: [],
  countries: [],
  languages: [],
  availability: [],
  onlyVerified: false,
  onlyVouched: false,
  sort: "trust",
};

export function filterViews(views: HelperView[], f: RosterFilter): HelperView[] {
  const q = f.query.trim().toLowerCase();
  const out = views.filter((v) => {
    const h = v.helper;
    if (f.categories.length && !f.categories.includes(h.category)) return false;
    if (f.countries.length && !f.countries.includes(h.country)) return false;
    if (f.languages.length && !h.languages.some((l) => f.languages.includes(l)))
      return false;
    if (f.availability.length && !f.availability.includes(h.availability))
      return false;
    if (f.onlyVerified && !v.selfVerified) return false;
    if (f.onlyVouched && v.verifiedVouches < 1) return false;
    if (q) {
      const hay = [
        h.handle,
        h.id,
        h.country,
        h.region ?? "",
        categoryMeta(h.category).label,
        ...h.specialties,
        ...h.languages,
        ...h.credentials.map((c) => c.claim),
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...out];
  if (f.sort === "trust") {
    sorted.sort(
      (a, b) => b.trustScore - a.trustScore || b.helper.ts - a.helper.ts,
    );
  } else if (f.sort === "recent") {
    sorted.sort((a, b) => b.helper.ts - a.helper.ts);
  } else {
    sorted.sort((a, b) => a.helper.handle.localeCompare(b.helper.handle));
  }
  return sorted;
}

/** Aggregate directory statistics over a set of views. */
export function rosterStats(views: HelperView[]) {
  const verified = views.filter((v) => v.selfVerified).length;
  const vouched = views.filter((v) => v.verifiedVouches >= 1).length;
  const trusted = views.filter((v) => v.trustTier === "trusted").length;
  const countries = new Set(views.map((v) => v.helper.country));
  const categories = new Set(views.map((v) => v.helper.category));
  const vouches = views.reduce((n, v) => n + v.verifiedVouches, 0);
  return {
    total: views.length,
    verified,
    vouched,
    trusted,
    vouches,
    countries: countries.size,
    categories: categories.size,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Serialization (signed JSON import / export)
   ═══════════════════════════════════════════════════════════════ */

export const ROSTER_FILE_VERSION = 1;

export function makeRosterFile(label: string, helpers: Helper[]): RosterFile {
  return {
    version: ROSTER_FILE_VERSION,
    generated: Date.now(),
    label,
    helpers,
  };
}

export function serializeRoster(file: RosterFile): string {
  return JSON.stringify(file, null, 2);
}

export function serializeHelpers(helpers: Helper[]): string {
  return serializeRoster(makeRosterFile("V FOR X — The Roster (export)", helpers));
}

/** Parse and structurally validate a roster JSON string. */
export function parseRoster(text: string): RosterFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Not a roster file");
  }
  const obj = parsed as Partial<RosterFile>;
  if (!Array.isArray(obj.helpers)) {
    throw new Error("Missing 'helpers' array");
  }
  for (const h of obj.helpers) {
    if (!h || typeof h !== "object") throw new Error("Invalid helper entry");
    if (!h.id || !h.handle || !h.publicKey) {
      throw new Error(`Helper missing required id/handle/publicKey`);
    }
  }
  return { ...obj, helpers: obj.helpers as Helper[] } as RosterFile;
}

/**
 * Merge two helper lists, de-duplicating by id (newer `ts` wins) and by
 * signing-key fingerprint (same signer supersedes earlier entries).
 */
export function mergeHelpers(a: Helper[], b: Helper[]): Helper[] {
  const byId = new Map<string, Helper>();
  for (const h of [...a, ...b]) {
    const prev = byId.get(h.id);
    if (!prev || h.ts > prev.ts) byId.set(h.id, h);
  }
  return [...byId.values()].sort((x, y) => y.ts - x.ts);
}
