/**
 * V FOR X — The Evidence Room (evidence-chain workbench)
 *
 * A fully client-side evidence chain mounted into every Registry
 * dossier. Files are dropped, SHA-256 hashed, and folded into an
 * append-only hash chain. Each "sealed record" commits to a set of
 * items plus a prevHash, so any post-seal alteration of content,
 * claim, items, or linkage is detectable by anyone who holds the
 * exported bundle — no server, no authority, no trust required.
 *
 * Protocol:
 *   1. CAPTURE — each file is read as bytes and SHA-256 hashed
 *      (Web Crypto). The digest is the item's identity.
 *   2. SEAL — makeEvidenceRecord folds {id, iso3, claim, subject,
 *      items, prevHash, sealedAt} into a canonical JSON string and
 *      hashes it. Item ordering is canonicalized (sorted by id) so
 *      the hash is deterministic for a given record content.
 *   3. CHAIN — every record links to the previous record's hash via
 *      prevHash. The first record links to GENESIS ("0"x64) or "".
 *   4. ZK SEAL — a Fiat-Shamir commitment over the record hash proves
 *      knowledge of one member of a set without revealing which
 *      (see sealWithZK and lib/zk.ts).
 *   5. EXPORT — the chain serializes to "VFXEV1:" + base64url(JSON).
 *      Anyone can paste it back and re-run verifyEvidenceChain.
 *
 * Honesty boundary: hashes prove the record was not altered after
 * sealing. They do NOT prove the source material is true. An
 * evidence chain vouches for integrity, not veracity.
 *
 * Browser API surface: Web Crypto (crypto.subtle, crypto.getRandomValues)
 * and btoa/atob only. Importable in vitest (jsdom).
 */

import { sha256Sync } from "./citizen-tools";
import { GENESIS_HASH } from "./dag";
import { proveSetMembership, type ZKCommitment } from "./zk";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface EvidenceItem {
  /** Unique item ID (generated at capture) */
  id: string;
  /** Original file name (any encoding — bytes are bytes) */
  name: string;
  /** MIME type (falls back to application/octet-stream) */
  mime: string;
  /** Size in bytes */
  size: number;
  /** SHA-256 hex of the file's full contents */
  sha256: string;
  /** Epoch ms when the file was hashed/captured */
  capturedAt: number;
  /** Optional free-text note */
  note?: string;
}

export interface EvidenceRecord {
  /** Unique record ID */
  id: string;
  /** Country ISO3 the dossier belongs to */
  iso3: string;
  /** The claim being evidenced (e.g. dossier title) */
  claim: string;
  /** Subject line of the record */
  subject: string;
  /** Sealed items, canonicalized by id when hashed */
  items: EvidenceItem[];
  /** Hash of the previous record (GENESIS_HASH or "" for the first) */
  prevHash: string;
  /** SHA-256 of this record's canonical JSON */
  hash: string;
  /** Epoch ms when the record was sealed */
  sealedAt: number;
  /** Optional zero-knowledge commitment over the record hash */
  zk?: ZKCommitment;
}

export interface EvidenceChainLink {
  id: string;
  ok: boolean;
  reason: string;
}

export interface EvidenceChainReport {
  /** True iff every link is intact */
  rootOk: boolean;
  /** Per-record link verdicts, in chain order */
  links: EvidenceChainLink[];
}

/** Input shape for makeEvidenceRecord. id/sealedAt are determinism hooks. */
export interface MakeEvidenceRecordInput {
  id?: string;
  iso3: string;
  claim: string;
  subject: string;
  items: EvidenceItem[];
  sealedAt?: number;
}

/** Wire prefix for exported bundles. */
export const EVIDENCE_BUNDLE_PREFIX = "VFXEV1:";

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function hexDigest(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function canonicalItem(item: EvidenceItem): Record<string, unknown> {
  return {
    id: item.id,
    name: item.name,
    mime: item.mime,
    size: item.size,
    sha256: item.sha256,
    capturedAt: item.capturedAt,
    note: item.note ?? "",
  };
}

function canonicalRecordBody(record: Pick<EvidenceRecord, "id" | "iso3" | "claim" | "subject" | "items" | "prevHash" | "sealedAt">): Record<string, unknown> {
  return {
    id: record.id,
    iso3: record.iso3,
    claim: record.claim,
    subject: record.subject,
    items: [...record.items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map(canonicalItem),
    prevHash: record.prevHash,
    sealedAt: record.sealedAt,
  };
}

function isEvidenceItem(v: unknown): v is EvidenceItem {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.mime === "string" &&
    typeof o.size === "number" &&
    typeof o.sha256 === "string" &&
    typeof o.capturedAt === "number"
  );
}

function isEvidenceRecord(v: unknown): v is EvidenceRecord {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.iso3 === "string" &&
    typeof o.claim === "string" &&
    typeof o.subject === "string" &&
    Array.isArray(o.items) &&
    o.items.every(isEvidenceItem) &&
    typeof o.prevHash === "string" &&
    typeof o.hash === "string" &&
    typeof o.sealedAt === "number"
  );
}

/* ═══════════════════════════════════════════════════════════════
   Public API
   ═══════════════════════════════════════════════════════════════ */

/**
 * SHA-256 of raw bytes, returned as 64-char lowercase hex.
 * Uses Web Crypto; the single hash primitive of the Evidence Room.
 * hashBytes(new Uint8Array(0)) === e3b0c442...b852b855 (SHA-256 of empty).
 */
export async function hashBytes(bytes: Uint8Array | ArrayBuffer): Promise<string> {
  const buf = bytes instanceof Uint8Array ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer : bytes;
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return hexDigest(digest);
}

/**
 * Hash a batch of raw byte arrays into EvidenceItems.
 * Arrays are positionally aligned: bytes[i] hashed and named names[i],
 * mime mimes[i]. Every item gets a fresh id + capturedAt timestamp.
 * Throws if the three arrays differ in length.
 */
export async function recordItems(
  bytes: Uint8Array[],
  names: string[],
  mimes: string[],
): Promise<EvidenceItem[]> {
  if (bytes.length !== names.length || bytes.length !== mimes.length) {
    throw new Error("recordItems: bytes/names/mimes length mismatch");
  }
  const now = Date.now();
  const items: EvidenceItem[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const sha256 = await hashBytes(bytes[i]);
    items.push({
      id: generateId(),
      name: names[i],
      mime: mimes[i] || "application/octet-stream",
      size: bytes[i].length,
      sha256,
      capturedAt: now,
    });
  }
  return items;
}

/**
 * Seal a record: compute its own hash over the canonical JSON
 * {id, iso3, claim, subject, items (sorted by id), prevHash, sealedAt}.
 * Deterministic — the same body and prevHash always yield the same hash
 * (provide fixed id/sealedAt to exploit this in tests).
 * Returns a NEW record object; input is not mutated.
 */
export function makeEvidenceRecord(input: MakeEvidenceRecordInput, prevHash: string): EvidenceRecord {
  const record: EvidenceRecord = {
    id: input.id ?? generateId(),
    iso3: input.iso3,
    claim: input.claim,
    subject: input.subject,
    items: input.items,
    prevHash,
    sealedAt: input.sealedAt ?? Date.now(),
    hash: "",
  };
  record.hash = sha256Sync(JSON.stringify(canonicalRecordBody(record)));
  return record;
}

/**
 * Chain root hash: fold acc = sha256(acc + record.hash) across records
 * in order, starting from GENESIS_HASH. The empty chain roots to
 * sha256(GENESIS_HASH). Any change to any record changes the root.
 */
export function hashChainId(records: EvidenceRecord[]): string {
  let acc = GENESIS_HASH;
  for (const r of records) {
    acc = sha256Sync(acc + r.hash);
  }
  return acc;
}

/**
 * Verify one record against its own canonical JSON.
 * When knownItems is supplied, every item id present in it must also
 * match the caller's known-good sha256 (external integrity check);
 * unknown ids are ignored.
 */
export function verifyEvidenceRecord(
  record: EvidenceRecord,
  knownItems?: Record<string, string>,
): boolean {
  const recomputed = sha256Sync(JSON.stringify(canonicalRecordBody(record)));
  if (recomputed !== record.hash) return false;
  if (knownItems) {
    for (const item of record.items) {
      const known = knownItems[item.id];
      if (known && known.toLowerCase() !== item.sha256.toLowerCase()) return false;
    }
  }
  return true;
}

/**
 * Verify the whole chain. For each record, in order:
 *   1. recomputed canonical hash must equal record.hash,
 *   2. prevHash must link to the previous record's hash, and
 *   3. the first record's prevHash must be GENESIS_HASH or "".
 * rootOk is true iff every link is intact.
 */
export function verifyEvidenceChain(records: EvidenceRecord[]): EvidenceChainReport {
  const links: EvidenceChainLink[] = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const recomputed = sha256Sync(JSON.stringify(canonicalRecordBody(r)));
    if (recomputed !== r.hash) {
      links.push({ id: r.id, ok: false, reason: "HASH MISMATCH — content tampered after sealing" });
      continue;
    }
    if (i === 0) {
      if (r.prevHash === GENESIS_HASH || r.prevHash === "") {
        links.push({ id: r.id, ok: true, reason: "intact (genesis)" });
      } else {
        links.push({ id: r.id, ok: false, reason: "FIRST RECORD DOES NOT LINK TO GENESIS" });
      }
      continue;
    }
    if (r.prevHash !== records[i - 1].hash) {
      links.push({ id: r.id, ok: false, reason: "BROKEN LINK — prevHash does not match previous record hash" });
    } else {
      links.push({ id: r.id, ok: true, reason: "intact" });
    }
  }
  return { rootOk: links.every((l) => l.ok), links };
}

/**
 * Re-chain a set of records onto a new base hash, recomputing each
 * record's hash so the sequence links correctly (used when merging an
 * imported bundle into an existing local chain). Deterministic: if the
 * records already chain to baseHash, this is a no-op. ZK proofs are
 * dropped — they were bound to the old hash and cannot be ported.
 */
export function rechainRecords(records: EvidenceRecord[], baseHash: string = GENESIS_HASH): EvidenceRecord[] {
  let prev = baseHash;
  return records.map((r) => {
    const re = makeEvidenceRecord(
      { id: r.id, iso3: r.iso3, claim: r.claim, subject: r.subject, items: r.items, sealedAt: r.sealedAt },
      prev,
    );
    prev = re.hash;
    return re;
  });
}

/**
 * Seal a record with a zero-knowledge commitment via lib/zk.ts's
 * Fiat-Shamir set-membership proof. The secret attribute is the record
 * hash itself; validSet must contain record.hash (else zk.ts throws).
 * The resulting proof convinces a verifier the prover knows one of the
 * valid set's hashes WITHOUT revealing which — i.e. it proves
 * knowledge of one specific sealed record without naming it.
 * Returns a NEW record; input is not mutated.
 */
export async function sealWithZK(
  record: EvidenceRecord,
  claim: string,
  validSet: string[],
): Promise<EvidenceRecord> {
  const { proof } = await proveSetMembership(record.hash, validSet, claim);
  return { ...record, zk: proof };
}

/**
 * Serialize a chain to the portable bundle format:
 * "VFXEV1:" + base64url(UTF-8 JSON). URL-safe, copy/paste friendly,
 * verifiable offline by anyone with parseEvidenceBundle.
 */
export function exportEvidenceBundle(records: EvidenceRecord[]): string {
  const json = JSON.stringify(records);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return EVIDENCE_BUNDLE_PREFIX + btoa(bin)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Deserialize a bundle back into records. Throws on:
 *   - missing "VFXEV1:" prefix
 *   - malformed base64url payload
 *   - corrupt JSON
 *   - records/items missing required fields
 */
export function parseEvidenceBundle(str: string): EvidenceRecord[] {
  const trimmed = str.trim();
  if (!trimmed.startsWith(EVIDENCE_BUNDLE_PREFIX)) {
    throw new Error(`Invalid evidence bundle: missing "${EVIDENCE_BUNDLE_PREFIX}" prefix`);
  }
  const b64 = trimmed.slice(EVIDENCE_BUNDLE_PREFIX.length).replace(/-/g, "+").replace(/_/g, "/");
  let bin: string;
  try {
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    bin = atob(padded);
  } catch {
    throw new Error("Invalid evidence bundle: corrupt base64url payload");
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("Invalid evidence bundle: corrupt JSON payload");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid evidence bundle: payload is not a record array");
  }
  for (let i = 0; i < parsed.length; i++) {
    if (!isEvidenceRecord(parsed[i])) {
      throw new Error(`Invalid evidence bundle: record ${i} missing required fields`);
    }
  }
  return parsed as EvidenceRecord[];
}

/**
 * Human-readable monospace chain report, mirroring formatCustodyReport.
 */
export function formatEvidenceReport(records: EvidenceRecord[]): string {
  const chain = verifyEvidenceChain(records);
  const lines: string[] = [];
  lines.push("THE EVIDENCE ROOM — CHAIN REPORT");
  lines.push("=".repeat(50));
  lines.push(`Status: ${chain.rootOk ? "✓ INTACT" : "✗ COMPROMISED"}`);
  lines.push(`Records: ${records.length}`);
  lines.push(`Chain Root: ${hashChainId(records).slice(0, 32)}…`);
  lines.push("");

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const link = chain.links[i];
    lines.push(`[${i + 1}] ${r.id} — ${link ? (link.ok ? "OK" : `BROKEN: ${link.reason}`) : "?"}`);
    lines.push(`    ${r.claim}`);
    lines.push(`    Sealed: ${new Date(r.sealedAt).toISOString()}`);
    lines.push(`    Hash: ${r.hash.slice(0, 16)}… · Prev: ${r.prevHash === GENESIS_HASH ? "GENESIS" : r.prevHash === "" ? "GENESIS" : r.prevHash.slice(0, 16) + "…"}`);
    for (const it of r.items) {
      lines.push(`    ▸ ${it.name} (${it.mime}, ${it.size} B)`);
      lines.push(`      SHA-256 ${it.sha256.slice(0, 16)}…`);
    }
    if (r.zk) {
      lines.push(`    ZK: ${r.zk.claim} — commitment ${r.zk.commitment.slice(0, 16)}…`);
    }
    lines.push("");
  }

  return lines.join("\n");
}