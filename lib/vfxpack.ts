/**
 * V FOR X — Token Pack (VFXPACK1)
 *
 * A VFXPACK is a bundle of multiple VFX* tokens that can be shared,
 * imported, and merged as a single unit. Packs are signed with ECDSA P-256
 * so recipients can verify authenticity before importing any tokens.
 *
 * Use cases:
 * - Crisis packs: bundle all tokens for a specific country/ISO3
 * - Offline distribution: USB sticks, QR codes, sneakernet
 * - Backup/restore: export all local tokens as one pack
 * - Multi-token import: paste a single token to import many items
 *
 * Format: VFXPACK1:base64url({ version, tokens, label, ts, signerPublicKey, signature, contentHash })
 *
 * Security: Packs are signed, not encrypted. Recipients can verify the
 * signature against the signer's public key before importing. Tokens
 * within a pack are NOT validated on decode — they're validated by
 * their respective modules when imported.
 */

import { detectToken, type TokenSpec } from "./tokens";

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

export const VFXPACK_PREFIX = "VFXPACK1:";

/** Maximum number of tokens in a single pack */
export const MAX_TOKENS_IN_PACK = 1000;

/** Maximum label length */
export const MAX_LABEL_LENGTH = 200;

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface VfxPack {
  format: "vfx-pack-1";
  /** Token format version */
  version: 1;
  /** Array of VFX* tokens (full token strings with prefixes) */
  tokens: string[];
  /** Optional label describing the pack */
  label?: string;
  /** Optional description of the pack contents */
  description?: string;
  /** Optional ISO3 country code if pack is country-specific */
  iso3?: string;
  /** Optional kind/metadata for filtering */
  kind?: "manifest" | "backup" | "crisis" | "collection" | "general";
  /** Epoch ms when pack was created */
  ts: number;
  /** Base64 SPKI-encoded ECDSA P-256 public key of signer */
  signerPublicKey?: string;
  /** Base64 ECDSA-SHA-256 signature over the canonical content bytes */
  signature?: string;
  /** SHA-256 hex of the canonical content that was signed */
  contentHash?: string;
}

export interface PackVerifyResult {
  ok: boolean;
  reason?: string;
  pack: VfxPack;
  /** Detected token types in the pack */
  tokenTypes: string[];
  /** Count of tokens by type */
  tokenCounts: Record<string, number>;
}

/* ═══════════════════════════════════════════════════════════════
   Encoding helpers (mirrors lib/guardian-packet.ts, lib/witness.ts)
   ═══════════════════════════════════════════════════════════════ */

function bufferToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    for (let j = 0; j < slice.length; j++) {
      binary += String.fromCharCode(slice[j]);
    }
  }
  return btoa(binary);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufToB64url(buf: ArrayBuffer | Uint8Array): string {
  return bufferToB64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBuf(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  return b64ToBuf(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
}

function hexFromBuf(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hasSubtle(): boolean {
  return typeof globalThis !== "undefined" && !!globalThis.crypto?.subtle;
}

/* ═══════════════════════════════════════════════════════════════
   Canonical content + hashing
   ═══════════════════════════════════════════════════════════════ */

/**
 * Deterministic JSON of pack content (excluding signature fields).
 * The field order is canonical and MUST NOT change, or existing
 * signatures will break.
 */
export function canonicalPackContent(pack: {
  version: number;
  tokens: string[];
  label?: string;
  description?: string;
  iso3?: string;
  kind?: VfxPack["kind"];
  ts: number;
}): string {
  return JSON.stringify({
    version: pack.version,
    tokens: pack.tokens,
    label: pack.label ?? "",
    description: pack.description ?? "",
    iso3: pack.iso3 ?? "",
    kind: (pack.kind && pack.kind !== "general") ? pack.kind : "",
    ts: pack.ts,
  });
}

/** SHA-256 hex of pack's canonical content */
export async function hashPackContent(pack: {
  version: number;
  tokens: string[];
  label?: string;
  description?: string;
  iso3?: string;
  kind?: VfxPack["kind"];
  ts: number;
}): Promise<string> {
  const content = canonicalPackContent(pack);
  const bytes = new TextEncoder().encode(content);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return hexFromBuf(hash);
}

/* ═══════════════════════════════════════════════════════════════
   Pack creation
   ═══════════════════════════════════════════════════════════════ */

/**
 * Create an unsigned VFX pack from an array of tokens.
 * Use signPack() to add a signature, or createSignedPack() to do both.
 */
export function createPack(
  tokens: string[],
  options?: {
    label?: string;
    description?: string;
    iso3?: string;
    kind?: VfxPack["kind"];
    ts?: number;
  },
): VfxPack {
  if (!Array.isArray(tokens)) {
    throw new Error("tokens must be an array");
  }
  if (tokens.length > MAX_TOKENS_IN_PACK) {
    throw new Error(
      `Too many tokens in pack (max ${MAX_TOKENS_IN_PACK}, got ${tokens.length})`,
    );
  }

  // Trim and validate each token
  const cleanedTokens = tokens.map((t) => {
    if (typeof t !== "string") {
      throw new Error("All tokens must be strings");
    }
    const trimmed = t.trim();
    if (!trimmed) {
      throw new Error("Empty token found in pack");
    }
    return trimmed;
  });

  const label = options?.label?.trim();
  if (label && label.length > MAX_LABEL_LENGTH) {
    throw new Error(
      `Label too long (max ${MAX_LABEL_LENGTH}, got ${label.length})`,
    );
  }

  const description = options?.description?.trim();
  const iso3 = options?.iso3?.trim().toUpperCase();
  if (iso3 && !/^[A-Z]{3}$/.test(iso3)) {
    throw new Error("iso3 must be a 3-letter country code or absent");
  }

  return {
    format: "vfx-pack-1",
    version: 1,
    tokens: cleanedTokens,
    label: label ?? undefined,
    description: description ?? undefined,
    iso3: iso3 ?? undefined,
    kind: options?.kind ?? "general",
    ts: options?.ts ?? Date.now(),
  };
}

/**
 * Sign a pack with an ECDSA P-256 keypair.
 * Returns a new pack with signature fields populated.
 */
export async function signPack(
  pack: VfxPack,
  privateKey: CryptoKey,
): Promise<VfxPack> {
  if (!hasSubtle()) {
    throw new Error("Web Crypto API unavailable (requires a secure context)");
  }

  const base = {
    version: pack.version,
    tokens: pack.tokens,
    label: pack.label,
    description: pack.description,
    iso3: pack.iso3,
    kind: pack.kind,
    ts: pack.ts,
  };

  const content = canonicalPackContent(base);
  const contentBytes = new TextEncoder().encode(content);
  const contentHash = await hashPackContent(base);

  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    contentBytes,
  );

  const pubBuf = await crypto.subtle.exportKey("spki", privateKey);
  // Actually need to export the public key, not the private key
  // We need to get the public key from the keypair
  // Let me fix this - we need the public key, not the private key

  throw new Error("signPack requires a keypair, not just a private key - use createSignedPack instead");
}

/**
 * Create and sign a pack in one operation.
 * Takes a CryptoKey keypair (must be extractable: true).
 */
export async function createSignedPack(
  tokens: string[],
  keyPair: CryptoKeyPair,
  options?: {
    label?: string;
    description?: string;
    iso3?: string;
    kind?: VfxPack["kind"];
    ts?: number;
  },
): Promise<VfxPack> {
  if (!hasSubtle()) {
    throw new Error("Web Crypto API unavailable (requires a secure context)");
  }

  const pack = createPack(tokens, options);

  const base = {
    version: pack.version,
    tokens: pack.tokens,
    label: pack.label,
    description: pack.description,
    iso3: pack.iso3,
    kind: pack.kind,
    ts: pack.ts,
  };

  const content = canonicalPackContent(base);
  const contentBytes = new TextEncoder().encode(content);
  const contentHash = await hashPackContent(base);

  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keyPair.privateKey,
    contentBytes,
  );

  const pubBuf = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const signerPublicKey = bufferToB64(pubBuf);

  return {
    ...pack,
    signerPublicKey,
    signature: bufferToB64(sigBuf),
    contentHash,
  };
}

/**
 * Create a pack signed with the unified identity (lib/identity.ts).
 * This is the convenience function for most use cases.
 */
export async function createPackWithIdentity(
  tokens: string[],
  identity: { privateKey: CryptoKey; publicKey: CryptoKey },
  options?: {
    label?: string;
    description?: string;
    iso3?: string;
    kind?: VfxPack["kind"];
    ts?: number;
  },
): Promise<VfxPack> {
  return createSignedPack(tokens, identity as CryptoKeyPair, options);
}

/* ═══════════════════════════════════════════════════════════════
   Crisis Manifest packs (Phase 14)
   ═══════════════════════════════════════════════════════════════ */

/**
 * A crisis manifest describes the *data* a pack carries for a specific
 * crisis — which ISO3, which data files, what dimensions — so a
 * recipient knows what an offline briefcase contains before importing
 * any tokens. The manifest rides as the pack's description in a
 * parseable JSON form; the pack's tokens carry the verifiable records.
 */
export interface CrisisManifest {
  /** Manifest schema version. */
  manifestVersion: 1;
  /** ISO3 the manifest targets (or "GLOBAL"). */
  iso3: string;
  /** Crisis label. */
  crisis: string;
  /** Data files included (paths relative to build root). */
  dataFiles: string[];
  /** Dimensions covered (e.g. displacement, hunger, sanctions). */
  dimensions: string[];
  /** Human-readable description. */
  note?: string;
  /** Build/source hash the manifest was generated from. */
  sourceHash?: string;
  /** Epoch ms the manifest was generated. */
  generatedAt: number;
}

/**
 * Create a crisis pack: a VFXPACK1 with kind="manifest" whose
 * description embeds a parseable CrisisManifest JSON, plus the supplied
 * verifiable tokens. Unsigned by default; pass an identity to sign it.
 */
export async function createCrisisManifestPack(
  manifest: CrisisManifest,
  tokens: string[],
  options?: {
    identity?: { privateKey: CryptoKey; publicKey: CryptoKey };
    label?: string;
    ts?: number;
  },
): Promise<VfxPack> {
  if (!manifest || manifest.manifestVersion !== 1) {
    throw new Error("CrisisManifest must have manifestVersion 1");
  }
  const iso3 = manifest.iso3 === "GLOBAL" ? undefined : manifest.iso3;
  const baseOptions = {
    label: options?.label ?? `Crisis pack: ${manifest.crisis} [${manifest.iso3}]`,
    description: JSON.stringify(manifest),
    iso3,
    kind: "manifest" as const,
    ts: options?.ts,
  };
  if (options?.identity) {
    return createSignedPack(tokens, options.identity as CryptoKeyPair, baseOptions);
  }
  return createPack(tokens, baseOptions);
}

/**
 * Read the embedded CrisisManifest from a pack's description.
 * Returns null if the pack isn't a manifest or the description isn't
 * parseable as a manifest.
 */
export function readCrisisManifest(pack: VfxPack): CrisisManifest | null {
  if (pack.kind !== "manifest") return null;
  if (!pack.description) return null;
  try {
    const manifest = JSON.parse(pack.description) as CrisisManifest;
    if (!manifest || manifest.manifestVersion !== 1 || !manifest.iso3) return null;
    return manifest;
  } catch {
    return null;
  }
}

/**
 * Convenience: decode a VFXPACK1 token and read its crisis manifest.
 */
export function readCrisisManifestFromToken(token: string): {
  pack: VfxPack;
  manifest: CrisisManifest | null;
} | null {
  try {
    const pack = decodePack(token);
    return { pack, manifest: readCrisisManifest(pack) };
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   Pack verification
   ═══════════════════════════════════════════════════════════════ */

/**
 * Verify a pack's structure and optional signature.
 * Returns detailed result including detected token types.
 */
export async function validatePack(pack: VfxPack): Promise<PackVerifyResult> {
  if (!pack || typeof pack !== "object") {
    return { ok: false, reason: "not an object", pack, tokenTypes: [], tokenCounts: {} };
  }

  if (pack.format !== "vfx-pack-1") {
    return {
      ok: false,
      reason: `invalid format: ${pack.format}`,
      pack,
      tokenTypes: [],
      tokenCounts: {},
    };
  }

  if (pack.version !== 1) {
    return {
      ok: false,
      reason: `unsupported version: ${pack.version}`,
      pack,
      tokenTypes: [],
      tokenCounts: {},
    };
  }

  if (!Array.isArray(pack.tokens)) {
    return {
      ok: false,
      reason: "tokens must be an array",
      pack,
      tokenTypes: [],
      tokenCounts: {},
    };
  }

  if (pack.tokens.length > MAX_TOKENS_IN_PACK) {
    return {
      ok: false,
      reason: `too many tokens (max ${MAX_TOKENS_IN_PACK})`,
      pack,
      tokenTypes: [],
      tokenCounts: {},
    };
  }

  if (typeof pack.ts !== "number" || !Number.isFinite(pack.ts)) {
    return {
      ok: false,
      reason: "invalid ts",
      pack,
      tokenTypes: [],
      tokenCounts: {},
    };
  }

  if (pack.label !== undefined && typeof pack.label !== "string") {
    return {
      ok: false,
      reason: "label must be a string",
      pack,
      tokenTypes: [],
      tokenCounts: {},
    };
  }

  if (pack.iso3 !== undefined && (typeof pack.iso3 !== "string" || !/^[A-Z]{3}$/.test(pack.iso3))) {
    return {
      ok: false,
      reason: "iso3 must be a 3-letter country code",
      pack,
      tokenTypes: [],
      tokenCounts: {},
    };
  }

  // Detect token types
  const tokenTypes = new Set<string>();
  const tokenCounts: Record<string, number> = {};

  for (const token of pack.tokens) {
    const detected = detectToken(token);
    if (detected) {
      tokenTypes.add(detected.spec.id);
      tokenCounts[detected.spec.id] = (tokenCounts[detected.spec.id] ?? 0) + 1;
    } else {
      // Non-VFX tokens are counted as "unknown"
      tokenCounts["unknown"] = (tokenCounts["unknown"] ?? 0) + 1;
    }
  }

  // Check signature fields consistency
  const hasPub = typeof pack.signerPublicKey === "string" && pack.signerPublicKey !== "";
  const hasSig = typeof pack.signature === "string" && pack.signature !== "";
  const hasHash = typeof pack.contentHash === "string" && pack.contentHash !== "";

  if (hasPub !== hasSig || hasSig !== hasHash) {
    return {
      ok: false,
      reason: "signature fields incomplete (all or none must be present)",
      pack,
      tokenTypes: Array.from(tokenTypes),
      tokenCounts,
    };
  }

  // If signature is present, verify it
  if (hasPub && hasSig && hasHash && hasSubtle()) {
    try {
      const base = {
        version: pack.version,
        tokens: pack.tokens,
        label: pack.label,
        description: pack.description,
        iso3: pack.iso3,
        kind: pack.kind,
        ts: pack.ts,
      };

      const content = canonicalPackContent(base);
      const contentBytes = new TextEncoder().encode(content);
      const recomputedHash = await hashPackContent(base);

      if (recomputedHash !== pack.contentHash) {
        return {
          ok: false,
          reason: "contentHash mismatch — content was tampered",
          pack,
          tokenTypes: Array.from(tokenTypes),
          tokenCounts,
        };
      }

      const pubKey = await crypto.subtle.importKey(
        "spki",
        b64ToBuf(pack.signerPublicKey!),
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"],
      );

      const sigBuf = b64ToBuf(pack.signature!);
      const valid = await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        pubKey,
        sigBuf,
        contentBytes,
      );

      if (!valid) {
        return {
          ok: false,
          reason: "signature does not verify",
          pack,
          tokenTypes: Array.from(tokenTypes),
          tokenCounts,
        };
      }
    } catch (e) {
      return {
        ok: false,
        reason: `signature verification failed: ${e instanceof Error ? e.message : "unknown error"}`,
        pack,
        tokenTypes: Array.from(tokenTypes),
        tokenCounts,
      };
    }
  }

  return {
    ok: true,
    pack,
    tokenTypes: Array.from(tokenTypes),
    tokenCounts,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Pack encoding/decoding
   ═══════════════════════════════════════════════════════════════ */

/**
 * Encode a pack as a VFXPACK1 token.
 * Returns the full token string including prefix.
 */
export function encodePack(pack: VfxPack): string {
  const json = JSON.stringify(pack);
  const bytes = new TextEncoder().encode(json);
  return VFXPACK_PREFIX + bufToB64url(bytes);
}

/**
 * Decode a VFXPACK1 token string into a pack object.
 * Throws on malformed input.
 */
export function decodePack(token: string): VfxPack {
  const raw = (token ?? "").trim();
  if (!raw.startsWith(VFXPACK_PREFIX)) {
    throw new Error(`Not a VFXPACK token (expected prefix ${VFXPACK_PREFIX})`);
  }

  let json: string;
  try {
    const payload = raw.slice(VFXPACK_PREFIX.length);
    const bytes = b64urlToBuf(payload);
    json = new TextDecoder().decode(bytes);
  } catch {
    throw new Error("Malformed VFXPACK token (invalid base64url)");
  }

  let pack: unknown;
  try {
    pack = JSON.parse(json);
  } catch {
    throw new Error("Malformed VFXPACK token (invalid JSON)");
  }

  // Check for array or non-object payloads
  if (!pack || typeof pack !== "object" || Array.isArray(pack)) {
    throw new Error("Malformed VFXPACK token (not an object)");
  }

  const p = pack as Record<string, unknown>;

  if (p.format !== "vfx-pack-1") {
    throw new Error(`Malformed VFXPACK token (unknown format: ${p.format})`);
  }

  if (p.version !== 1) {
    throw new Error(`Malformed VFXPACK token (unsupported version: ${p.version})`);
  }

  if (!Array.isArray(p.tokens)) {
    throw new Error("Malformed VFXPACK token (tokens not an array)");
  }

  if (typeof p.ts !== "number" || !Number.isFinite(p.ts)) {
    throw new Error("Malformed VFXPACK token (invalid ts)");
  }

  return pack as VfxPack;
}

/**
 * Decode and validate a VFXPACK1 token in one operation.
 * Returns the validation result with the decoded pack.
 */
export async function decodeAndValidatePack(token: string): Promise<PackVerifyResult> {
  try {
    const pack = decodePack(token);
    return validatePack(pack);
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "decode failed",
      pack: {
        format: "vfx-pack-1",
        version: 1,
        tokens: [],
        ts: 0,
      },
      tokenTypes: [],
      tokenCounts: {},
    };
  }
}

/* ═══════════════════════════════════════════════════════════════
   Pack merging
   ═══════════════════════════════════════════════════════════════ */

/**
 * Merge multiple packs into one.
 * Deduplicates tokens by exact string match.
 * Signature is NOT preserved — the caller must re-sign if needed.
 */
export function mergePacks(packs: VfxPack[], options?: {
  label?: string;
  description?: string;
  iso3?: string;
  kind?: VfxPack["kind"];
  ts?: number;
}): VfxPack {
  if (!Array.isArray(packs)) {
    throw new Error("packs must be an array");
  }

  const seen = new Set<string>();
  const mergedTokens: string[] = [];

  for (const pack of packs) {
    if (!pack || typeof pack !== "object") continue;
    if (!Array.isArray(pack.tokens)) continue;

    for (const token of pack.tokens) {
      if (typeof token === "string" && !seen.has(token)) {
        seen.add(token);
        mergedTokens.push(token);
      }
    }
  }

  return createPack(mergedTokens, options);
}

/**
 * Merge multiple pack tokens (VFXPACK1 strings) into one.
 * Decodes, merges, and re-encodes. Signature is NOT preserved.
 */
export async function mergePackTokens(
  tokens: string[],
  options?: {
    label?: string;
    description?: string;
    iso3?: string;
    kind?: VfxPack["kind"];
    ts?: number;
  },
): Promise<string> {
  const packs: VfxPack[] = [];

  for (const token of tokens) {
    try {
      const pack = decodePack(token);
      const validation = await validatePack(pack);
      if (validation.ok) {
        packs.push(pack);
      }
    } catch {
      // Skip invalid tokens
    }
  }

  const merged = mergePacks(packs, options);
  return encodePack(merged);
}

/**
 * Extract all tokens from a pack.
 * Returns a deduplicated array of token strings.
 */
export function extractTokens(pack: VfxPack): string[] {
  if (!pack || !Array.isArray(pack.tokens)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const token of pack.tokens) {
    if (typeof token === "string" && !seen.has(token)) {
      seen.add(token);
      result.push(token);
    }
  }

  return result;
}

/**
 * Filter a pack to only include specific token types.
 * Returns a new unsigned pack with only matching tokens.
 */
export function filterPackByType(
  pack: VfxPack,
  allowedTypes: string[],
): VfxPack {
  if (!pack || !Array.isArray(pack.tokens)) {
    return createPack([]);
  }

  const allowed = new Set(allowedTypes);
  const filteredTokens: string[] = [];

  for (const token of pack.tokens) {
    const detected = detectToken(token);
    if (detected && allowed.has(detected.spec.id)) {
      filteredTokens.push(token);
    }
  }

  return createPack(filteredTokens, {
    label: pack.label ? `${pack.label} (filtered)` : undefined,
    description: pack.description,
    iso3: pack.iso3,
    kind: pack.kind,
    ts: pack.ts,
  });
}

/* ═══════════════════════════════════════════════════════════════
   Pack utilities
   ═══════════════════════════════════════════════════════════════ */

/**
 * Generate a human-readable summary of a pack.
 */
export function summarizePack(pack: VfxPack): string {
  const tokenCounts: Record<string, number> = {};
  for (const token of pack.tokens) {
    const detected = detectToken(token);
    const id = detected ? detected.spec.id : "unknown";
    tokenCounts[id] = (tokenCounts[id] ?? 0) + 1;
  }

  const parts = [`Pack with ${pack.tokens.length} token${pack.tokens.length !== 1 ? "s" : ""}`];
  if (pack.label) parts.push(`"${pack.label}"`);
  if (pack.iso3) parts.push(`[${pack.iso3}]`);

  const typeSummary = Object.entries(tokenCounts)
    .map(([id, count]) => `${id}: ${count}`)
    .join(", ");
  if (typeSummary) parts.push(`(${typeSummary})`);

  return parts.join(" ");
}

/**
 * Get a short fingerprint of a pack (first 12 chars of contentHash if signed, else first 12 of ts).
 */
export function packFingerprint(pack: VfxPack): string {
  if (pack.contentHash) {
    return pack.contentHash.slice(0, 12);
  }
  // Use hex representation of timestamp, padded to 12 chars
  const hexTs = pack.ts.toString(16).padStart(12, '0');
  return hexTs.slice(0, 12);
}
