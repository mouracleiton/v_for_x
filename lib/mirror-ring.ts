/**
 * V FOR X — The Mirror Ring (verified mirror directory)
 *
 * A fully static, privacy-preserving mirror directory with one-click host
 * swap. Operators mint signed "I mirrored this" claims via lib/mirror.ts
 * (ECDSA P-256 over a canonical claim payload, embeddable as a compact
 * VFXM1: token). Visitors paste a token and this module merges the
 * locally-verified entry into a ring persisted in localStorage. There is
 * no central registry: the ring is a union of a small unverified seed
 * (data/mirror-ring-seed.json) plus whatever claims this browser has
 * verified locally.
 *
 * All helpers here are pure so the page stays thin and every ring rule
 * (dedupe, newest-wins, verified-first, 200-entry cap) is unit-tested in
 * tests/mirror-ring.test.ts. ringShareText / ringFingerprintRoot are the
 * only async helpers — they digest the ring with SHA-256 for the share
 * block.
 */

import {
  ALL_TRANSPORTS,
  TRANSPORT_LABELS,
  type MirrorNode,
  type MirrorTransport,
} from "@/lib/mirror";

/** Maximum number of mirrors kept in one ring (drop oldest unverified beyond this). */
export const MAX_RING_SIZE = 200;

/**
 * A single mirror in the ring. Either a seed entry (verified: false,
 * metadata only — no claim on file) or a locally-verified claim entry
 * (carries the claim id, fingerprint, public key and operator handle).
 */
export interface RingEntry {
  /** MirrorNode claim id, when derived from a signed VFXM1: claim. */
  id?: string;
  /** Reachable host — URL, .onion address, IPFS gateway URL, or a media note. */
  host: string;
  transport: MirrorTransport;
  /** Optional human region tag (e.g. "EU-WEST", "BR"). */
  region?: string;
  /** Human note describing the mirror or why it is (un)verified. */
  note?: string;
  /** ISO-8601 timestamp of the claim (or of the seed entry). */
  claimedAt: string;
  /** True only after this browser verified a signed claim for the host. */
  verified: boolean;
  /** 64-char SHA-256 claim content hash, or null when unverified. */
  fingerprint?: string | null;
  /** Signer public key (base64 SPKI) from the claim, or null when unverified. */
  publicKey?: string | null;
  /** Operator handle (V-XXXX-XXXX) from the signing key, when claimed. */
  handle?: string;
  /** buildHash from the claim ("unknown" when the operator omitted it). */
  buildHash?: string;
}

/**
 * The seed-file contract (data/mirror-ring-seed.json). Metadata shape only —
 * seeds are NEVER signed, so fingerprint/publicKey stay null and verified
 * is forced false by seedRing().
 */
export interface SeedEntry {
  host: string;
  transport: MirrorTransport;
  region?: string;
  note?: string;
  claimedAt: string;
  fingerprint?: string | null;
  verified?: boolean;
}

/** Normalise a host for dedupe: trim, lowercase, strip trailing slashes. */
export function normalizeHost(host: string): string {
  return String(host ?? "")
    .trim()
    .replace(/\/+$/, "")
    .toLowerCase();
}

/** Epoch-ms timestamp of an entry; invalid ISO strings count as epoch 0. */
function entryTs(e: RingEntry): number {
  const t = Date.parse(e?.claimedAt ?? "");
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Tag a seed array as unverified RingEntries. Seeds carry only public
 * metadata — nobody can claim a signed fingerprint without a token, so
 * fingerprint/publicKey are always null and verified is always false.
 */
export function seedRing(seed: SeedEntry[]): RingEntry[] {
  if (!Array.isArray(seed)) return [];
  return seed
    .filter(
      (e) =>
        e &&
        typeof e.host === "string" &&
        e.host.trim() &&
        ALL_TRANSPORTS.includes(e.transport),
    )
    .map((e) => ({
      host: normalizeHost(e.host),
      transport: e.transport,
      region: e.region?.trim() || undefined,
      note: e.note?.trim() || "unverified seed entry",
      claimedAt: /^\d{4}-\d{2}-\d{2}T/.test(e.claimedAt ?? "")
        ? e.claimedAt
        : new Date(0).toISOString(),
      verified: false,
      fingerprint: null,
      publicKey: null,
    }));
}

/**
 * Merge one entry into a ring: dedupe by normalised host, newest claim
 * wins (ties prefer the verified entry), then cap at MAX_RING_SIZE by
 * dropping the oldest unverified entries first.
 */
export function mergeIntoRing(ring: RingEntry[], entry: RingEntry): RingEntry[] {
  const out: RingEntry[] = [];
  const byHost = new Map<string, number>();
  for (const e of [...(ring ?? []), entry]) {
    const key = normalizeHost(e?.host ?? "");
    if (!key) continue;
    const idx = byHost.get(key);
    if (idx === undefined) {
      byHost.set(key, out.length);
      out.push(e);
      continue;
    }
    const existing = out[idx];
    const eTs = entryTs(e);
    const xTs = entryTs(existing);
    if (eTs > xTs || (eTs === xTs && e.verified && !existing.verified)) {
      out[idx] = e;
    }
  }
  return capRing(out);
}

/**
 * Enforce MAX_RING_SIZE. Drop the oldest UNVERIFIED entries first so a
 * ring of verified signatures is never evicted by raw volume of seeds or
 * unclaimed hosts.
 */
export function capRing(ring: RingEntry[]): RingEntry[] {
  if (ring.length <= MAX_RING_SIZE) return ring;
  const over = ring.length - MAX_RING_SIZE;
  const drop = new Set<number>();

  const byAge = (a: { i: number; e: RingEntry }, b: { i: number; e: RingEntry }) =>
    entryTs(a.e) - entryTs(b.e) || a.i - b.i;

  let n = 0;
  for (const { i } of ring
    .map((e, i) => ({ e, i }))
    .filter((x) => !x.e.verified)
    .sort(byAge)) {
    if (n >= over) break;
    drop.add(i);
    n++;
  }
  if (n < over) {
    for (const { i } of ring
      .map((e, i) => ({ e, i }))
      .filter((x) => !drop.has(x.i))
      .sort(byAge)) {
      if (n >= over) break;
      drop.add(i);
      n++;
    }
  }
  return ring.filter((_, i) => !drop.has(i));
}

/**
 * Display/share ordering: verified first, then newest claim, then host
 * alphabetically — fully deterministic.
 */
export function sortRing(ring: RingEntry[]): RingEntry[] {
  return [...(ring ?? [])].sort((a, b) => {
    if (a.verified !== b.verified) return a.verified ? -1 : 1;
    const d = entryTs(b) - entryTs(a);
    if (d !== 0) return d;
    return normalizeHost(a.host).localeCompare(normalizeHost(b.host));
  });
}

/**
 * Map a locally-verified MirrorNode into a ring entry. The host defaults
 * to the claim's endpoint (the signed field): pass a hostOverride when
 * the visitor wants to reach the same build at a different URL (e.g. an
 * IPFS gateway for a bare CID).
 */
export function claimToEntry(node: MirrorNode, hostOverride?: string): RingEntry {
  const host = hostOverride?.trim() || node.endpoint;
  return {
    id: node.id,
    host,
    transport: node.transport,
    region: node.region?.trim() || undefined,
    note: node.buildVersion
      ? `signed claim · build ${node.buildVersion}`
      : "signed claim",
    claimedAt: new Date(node.ts).toISOString(),
    verified: true,
    fingerprint: node.contentHash,
    publicKey: node.signerPublicKey,
    handle: node.handle,
    buildHash: node.buildHash,
  };
}

/** Compact 12-hex fingerprint for display; honest label when no claim exists. */
export function shortFingerprint(fingerprint?: string | null): string {
  return fingerprint ? fingerprint.slice(0, 12) : "no claim";
}

/** Aggregate stats for the ring line: total, verified count, transports. */
export interface RingStats {
  total: number;
  verified: number;
  byTransport: Record<MirrorTransport, number>;
}

/** Summarise a ring into display stats (pure, synchronous). */
export function ringStats(ring: RingEntry[]): RingStats {
  const byTransport = {
    clearnet: 0,
    onion: 0,
    ipfs: 0,
    mesh: 0,
    usb: 0,
  } as Record<MirrorTransport, number>;
  let total = 0;
  let verified = 0;
  for (const e of ring ?? []) {
    if (!e || !e.host) continue;
    total++;
    if (e.verified) verified++;
    if (e.transport && byTransport[e.transport] !== undefined) {
      byTransport[e.transport]++;
    }
  }
  return { total, verified, byTransport };
}

/**
 * A deterministic SHA-256 root over the whole ring (sorted canonically:
 * verified first, then host). Two rings are comparable by this hex value.
 * Falls back to a 64-bit FNV-1a hex digest when Web Crypto is unavailable
 * so the share block never fails in restricted contexts.
 */
export async function ringFingerprintRoot(ring: RingEntry[]): Promise<string> {
  const canonical = JSON.stringify(
    sortRing(ring).map((e) => ({
      host: normalizeHost(e.host),
      transport: e.transport,
      verified: e.verified,
      fingerprint: e.fingerprint ?? null,
    })),
  );
  try {
    if (typeof crypto !== "undefined" && crypto?.subtle) {
      const buf = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonical),
      );
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    /* fall through to the synchronous digest */
  }
  return fnv1a64Hex(canonical);
}

/**
 * The shareable text block of the whole ring (verified mirrors first):
 *
 *   V FOR X MIRROR RING — N mirrors
 *   <host>  (<TRANSPORT>, <region>)  [VERIFIED|UNVERIFIED]
 *   ...
 *   Fingerprint root: <sha256 hex>
 *
 * Paste this into The Web, dead drops, or anywhere people copy-paste.
 */
export async function ringShareText(ring: RingEntry[]): Promise<string> {
  const sorted = sortRing(ring);
  const root = await ringFingerprintRoot(sorted);
  const lines = sorted.map((e) => {
    const transport = TRANSPORT_LABELS[e.transport]?.split(" ")[0] ?? e.transport;
    return `${normalizeHost(e.host)}  (${transport}, ${e.region || "-"})  [${e.verified ? "VERIFIED" : "UNVERIFIED"}]`;
  });
  return [
    `V FOR X MIRROR RING — ${sorted.length} mirrors`,
    ...lines,
    `Fingerprint root: ${root}`,
  ].join("\n");
}

/** FNV-1a 64-bit hex digest — synchronous fallback when subtle is absent. */
function fnv1a64Hex(input: string): string {
  const prime = BigInt("0x100000001b3");
  const mask = BigInt("0xffffffffffffffff");
  let h = BigInt("0xcbf29ce484222325");
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i));
    h = (h * prime) & mask;
  }
  return h.toString(16).padStart(16, "0");
}