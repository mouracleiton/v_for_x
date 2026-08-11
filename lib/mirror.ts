/**
 * V FOR X — The Mirror (one-command deployment kit)
 *
 * Fortress documents self-hosting; The Mirror automates it. A mirror
 * operator runs a single install script that pulls the latest static
 * build, optionally pins it to IPFS, and stands up a censorship-
 * resistant node in under five minutes.
 *
 * This module powers the "I mirrored this" badge + distributed node
 * list on /the-mirror/. It is fully client-side:
 *
 *   1. Each operator generates an anonymous ECDSA P-256 keypair.
 *   2. Standing up a mirror produces a signed claim (a MirrorNode)
 *      binding { transport, endpoint, buildHash } to that identity.
 *   3. The claim is shared as a compact base64 token. Anyone can
 *      verify it offline without a server.
 *   4. The distributed node list is a local set of verified claims.
 *      Lists merge peer-to-peer (dedupe by id, newest wins) — there
 *      is no central registry, exactly like the rest of the platform.
 *
 * Signing follows the same Web Crypto pattern as lib/testimony.ts
 * and the hash-chaining conventions of lib/dag.ts.
 */

/** Version of this deployment-kit logic (bumped on claim-format changes). */
export const MIRROR_KIT_VERSION = "1.0.0";

/** Prefix used to recognise compact mirror-claim tokens. */
export const CLAIM_TOKEN_PREFIX = "VFXM1:";

export type MirrorTransport = "clearnet" | "onion" | "ipfs" | "mesh" | "usb";

export const TRANSPORT_LABELS: Record<MirrorTransport, string> = {
  clearnet: "CLEARNET (HTTPS)",
  onion: "TOR (.ONION)",
  ipfs: "IPFS (CID)",
  mesh: "MESH / LAN",
  usb: "USB SNEAKERNET",
};

export const ALL_TRANSPORTS = Object.keys(TRANSPORT_LABELS) as MirrorTransport[];

/** An anonymous P-256 operator keypair (base64 SPKI / PKCS8). */
export interface MirrorKeyPair {
  publicKey: string;
  privateKey: string;
  /** Random handle derived from the public key hash: V-XXXX-XXXX */
  handle: string;
}

/** A signed "I mirrored this" claim. */
export interface MirrorNode {
  /** Unique claim id (uuid). */
  id: string;
  /** Operator handle from the signing key. */
  handle: string;
  transport: MirrorTransport;
  /** URL, .onion address, IPFS CID, or mesh/USB note. */
  endpoint: string;
  /** Optional human region tag (e.g. "EU-WEST", "meshtastic-7"). Never required. */
  region?: string;
  /** SHA-256 of the pinned build manifest, or "unknown". */
  buildHash: string;
  /** Optional build label (e.g. git sha / release tag). */
  buildVersion?: string;
  /** MIRROR_KIT_VERSION at signing time. */
  kitVersion: string;
  /** Epoch ms when the claim was signed. */
  ts: number;
  /** Signer public key (base64 SPKI). */
  signerPublicKey: string;
  /** ECDSA signature over the canonical content (base64). */
  signature: string;
  /** SHA-256 hex of the canonical content that was signed. */
  contentHash: string;
}

/* ═══════════════════════════════════════════════════════════
   ENCODING HELPERS
   ═══════════════════════════════════════════════════════════ */

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function hasSubtle(): boolean {
  return typeof globalThis !== "undefined" && !!globalThis.crypto?.subtle;
}

function hexFromBuf(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** First 8 hex chars of a hash — for compact display. */
export function shortHash(hash: string): string {
  return (hash ?? "").slice(0, 8);
}

/** True if a string looks like a 64-char lowercase hex SHA-256. */
export function isValidSha256(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash ?? "");
}

/* ═══════════════════════════════════════════════════════════
   KEY MANAGEMENT
   ═══════════════════════════════════════════════════════════ */

/**
 * Generate an anonymous ECDSA P-256 keypair for signing mirror claims.
 * Returns base64 SPKI/PKCS8 + a random handle derived from the pubkey hash.
 */
export async function generateMirrorKey(): Promise<MirrorKeyPair> {
  if (!hasSubtle()) {
    throw new Error("Web Crypto API unavailable (requires a secure context)");
  }
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const pub = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const priv = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  const pubHash = await crypto.subtle.digest("SHA-256", pub);
  const hex = hexFromBuf(pubHash);
  const handle = `V-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;

  return {
    publicKey: bufToB64(pub),
    privateKey: bufToB64(priv),
    handle,
  };
}

/* ═══════════════════════════════════════════════════════════
   CLAIM CREATION & SIGNING
   ═══════════════════════════════════════════════════════════ */

/**
 * The deterministic JSON that gets hashed and signed.
 * MUST stay in sync with verifyMirrorClaim — field order is canonical.
 */
export function canonicalClaimContent(node: {
  id: string;
  handle: string;
  transport: MirrorTransport;
  endpoint: string;
  region?: string;
  buildHash: string;
  buildVersion?: string;
  kitVersion: string;
  ts: number;
}): string {
  return JSON.stringify({
    id: node.id,
    handle: node.handle,
    transport: node.transport,
    endpoint: node.endpoint,
    region: node.region ?? "",
    buildHash: node.buildHash,
    buildVersion: node.buildVersion ?? "",
    kitVersion: node.kitVersion,
    ts: node.ts,
  });
}

/** Inputs needed to mint a new mirror claim. */
export interface CreateClaimInput {
  transport: MirrorTransport;
  endpoint: string;
  region?: string;
  buildHash?: string;
  buildVersion?: string;
}

/**
 * Create and sign a mirror claim with an operator keypair.
 */
export async function createMirrorClaim(
  key: MirrorKeyPair,
  input: CreateClaimInput,
): Promise<MirrorNode> {
  if (!hasSubtle()) {
    throw new Error("Web Crypto API unavailable");
  }
  if (!ALL_TRANSPORTS.includes(input.transport)) {
    throw new Error(`Unknown transport: ${input.transport}`);
  }
  const endpoint = input.endpoint.trim();
  if (endpoint.length < 3) {
    throw new Error("Endpoint must be at least 3 characters");
  }
  if (endpoint.length > 4096) {
    throw new Error("Endpoint is too long (max 4096 chars)");
  }

  const ts = Date.now();
  const id =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `m-${ts}-${Math.random().toString(36).slice(2, 10)}`;

  const partial = {
    id,
    handle: key.handle,
    transport: input.transport,
    endpoint,
    region: input.region?.trim() || undefined,
    buildHash: input.buildHash?.trim() || "unknown",
    buildVersion: input.buildVersion?.trim() || undefined,
    kitVersion: MIRROR_KIT_VERSION,
    ts,
  };

  const content = canonicalClaimContent(partial);
  const contentBytes = new TextEncoder().encode(content);
  const contentHash = hexFromBuf(
    await crypto.subtle.digest("SHA-256", contentBytes),
  );

  const privKey = await crypto.subtle.importKey(
    "pkcs8",
    b64ToBytes(key.privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privKey,
    contentBytes,
  );

  return {
    ...partial,
    signerPublicKey: key.publicKey,
    signature: bufToB64(sigBuf),
    contentHash,
  };
}

/**
 * Verify a claim's ECDSA signature against its embedded public key.
 * Returns false on any malformed input (never throws).
 */
export async function verifyMirrorClaim(node: MirrorNode): Promise<boolean> {
  if (!hasSubtle()) return false;
  if (!node || typeof node !== "object") return false;
  if (!ALL_TRANSPORTS.includes(node.transport)) return false;
  if (!node.signature || !node.signerPublicKey || !node.contentHash) return false;

  try {
    const pubKey = await crypto.subtle.importKey(
      "spki",
      b64ToBytes(node.signerPublicKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );

    const content = canonicalClaimContent(node);
    const contentBytes = new TextEncoder().encode(content);

    // contentHash must match the canonical content
    const recomputed = hexFromBuf(
      await crypto.subtle.digest("SHA-256", contentBytes),
    );
    if (recomputed !== node.contentHash) return false;

    return crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pubKey,
      b64ToBytes(node.signature),
      contentBytes,
    );
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════
   COMPACT TOKEN ENCODING (for badges / dead drops / QR)
   ═══════════════════════════════════════════════════════════ */

/** Hex fingerprint (first 16 chars of contentHash) — the badge "seal". */
export function claimFingerprint(node: MirrorNode): string {
  return shortHash(node.contentHash) + shortHash(node.contentHash).slice(0, 0);
}

/**
 * Encode a signed claim as a compact, shareable base64 token.
 * The token carries the full signed JSON so it is verifiable offline.
 */
export function encodeClaim(node: MirrorNode): string {
  const json = JSON.stringify(node);
  return CLAIM_TOKEN_PREFIX + bufToB64(new TextEncoder().encode(json));
}

/**
 * Decode a compact token back into a MirrorNode.
 * Throws on malformed input; does NOT verify the signature (call
 * verifyMirrorClaim separately so callers can report tampered claims).
 */
export function decodeClaim(token: string): MirrorNode {
  const raw = (token ?? "").trim();
  if (!raw.startsWith(CLAIM_TOKEN_PREFIX)) {
    throw new Error("Not a mirror claim token");
  }
  const b64 = raw.slice(CLAIM_TOKEN_PREFIX.length);
  let json: string;
  try {
    json = new TextDecoder().decode(b64ToBytes(b64));
  } catch {
    throw new Error("Corrupt token (bad base64)");
  }
  let node: MirrorNode;
  try {
    node = JSON.parse(json);
  } catch {
    throw new Error("Corrupt token (bad JSON)");
  }
  if (!node || typeof node !== "object") throw new Error("Corrupt token");
  if (!node.id || !node.handle || !node.signature || !node.signerPublicKey) {
    throw new Error("Token is missing required fields");
  }
  if (!ALL_TRANSPORTS.includes(node.transport)) {
    throw new Error(`Unknown transport in token: ${node.transport}`);
  }
  return node;
}

/* ═══════════════════════════════════════════════════════════
   DISTRIBUTED NODE LIST
   ═══════════════════════════════════════════════════════════ */

/**
 * Merge two node lists into a deduplicated set.
 *  - Dedupe by claim id (identical claims collapse).
 *  - For the same operator handle + endpoint + transport, keep the
 *    newest claim (latest ts) so re-signed mirrors replace stale ones.
 *  - Other distinct claims are all retained (one operator can run
 *    several mirrors on different transports).
 */
export function mergeNodeLists(
  a: MirrorNode[] = [],
  b: MirrorNode[] = [],
): MirrorNode[] {
  const seen = new Map<string, MirrorNode>();
  const order: string[] = [];

  const consider = (n: MirrorNode) => {
    if (!n || !n.id) return;
    const existing = seen.get(n.id);
    if (existing) {
      if (n.ts > existing.ts) seen.set(n.id, n);
      return;
    }
    // newest-wins key for re-signed mirrors of the same operator+endpoint
    const revKey = `${n.handle}|${n.endpoint.toLowerCase()}|${n.transport}`;
    let replacedId: string | null = null;
    for (const [id, existing2] of seen) {
      const k = `${existing2.handle}|${existing2.endpoint.toLowerCase()}|${existing2.transport}`;
      if (k === revKey && n.ts > existing2.ts) {
        replacedId = id;
        break;
      }
    }
    if (replacedId) {
      const idx = order.indexOf(replacedId);
      if (idx >= 0) order.splice(idx, 1);
      seen.delete(replacedId);
    }
    seen.set(n.id, n);
    order.push(n.id);
  };

  [...a, ...b].forEach(consider);
  return order.map((id) => seen.get(id)!);
}

/** Check structural equality of two nodes (ignoring object identity). */
export function sameClaim(x: MirrorNode, y: MirrorNode): boolean {
  return x.id === y.id && x.contentHash === y.contentHash;
}

export interface NetworkSummary {
  total: number;
  byTransport: Record<MirrorTransport, number>;
  uniqueOperators: number;
  distinctBuilds: number;
  oldestTs: number | null;
  newestTs: number | null;
}

/** Summarise a node list into display stats (pure, synchronous). */
export function summarizeNetwork(nodes: MirrorNode[] = []): NetworkSummary {
  const byTransport = {
    clearnet: 0,
    onion: 0,
    ipfs: 0,
    mesh: 0,
    usb: 0,
  } as Record<MirrorTransport, number>;
  const operators = new Set<string>();
  const builds = new Set<string>();
  let oldest: number | null = null;
  let newest: number | null = null;

  for (const n of nodes) {
    if (!n || !n.transport) continue;
    if (byTransport[n.transport] !== undefined) byTransport[n.transport]++;
    operators.add(n.handle);
    builds.add(n.buildHash || "unknown");
    if (oldest === null || n.ts < oldest) oldest = n.ts;
    if (newest === null || n.ts > newest) newest = n.ts;
  }

  return {
    total: nodes.length,
    byTransport,
    uniqueOperators: operators.size,
    distinctBuilds: builds.size,
    oldestTs: oldest,
    newestTs: newest,
  };
}

/**
 * Verify every claim in a list, returning per-node results.
 * Use after merging/importing an untrusted list.
 */
export async function verifyNodeList(
  nodes: MirrorNode[] = [],
): Promise<{ node: MirrorNode; valid: boolean }[]> {
  const results = await Promise.all(
    nodes.map(async (n) => ({ node: n, valid: await verifyMirrorClaim(n) })),
  );
  return results;
}

/** Serialise a node list to a portable JSON document. */
export function exportNodeList(nodes: MirrorNode[]): string {
  return JSON.stringify(
    {
      format: "vfx-mirror-nodelist-1",
      exportedAt: Date.now(),
      count: nodes.length,
      nodes,
    },
    null,
    2,
  );
}

/** Parse an exported node-list document. Throws on malformed input. */
export function parseNodeList(json: string): MirrorNode[] {
  const data = JSON.parse(json);
  const nodes: MirrorNode[] = Array.isArray(data) ? data : data?.nodes;
  if (!Array.isArray(nodes)) {
    throw new Error("Not a node-list document");
  }
  for (const n of nodes) {
    if (!ALL_TRANSPORTS.includes(n.transport)) {
      throw new Error(`Unknown transport: ${n.transport}`);
    }
    if (!n.id || !n.handle || !n.signature) {
      throw new Error("Malformed node entry");
    }
  }
  return nodes;
}

/* ═══════════════════════════════════════════════════════════
   BUILD MANIFEST (integrity root for "I mirrored build X")
   ═══════════════════════════════════════════════════════════ */

export interface ManifestEntry {
  path: string;
  size: number;
  sha256: string;
}

/**
 * Compute a deterministic root hash over a build manifest.
 * The installer (mirror/install.sh) emits the same shape, so an
 * operator can paste the resulting root hash into a badge and
 * anyone can recompute it from the manifest file list.
 */
export async function computeManifestRoot(
  entries: ManifestEntry[],
): Promise<string> {
  const sorted = [...entries]
    .map((e) => ({ path: e.path, size: e.size, sha256: e.sha256 }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const blob = new TextEncoder().encode(JSON.stringify(sorted));
  return hexFromBuf(await crypto.subtle.digest("SHA-256", blob));
}

/**
 * Create and sign a mirror claim using the unified identity.
 *
 * This function uses the persistent unified identity from lib/identity.ts
 * instead of generating a new keypair per claim. This provides better
 * continuity and allows operators to prove authorship across sessions.
 */
export async function createMirrorClaimWithIdentity(
  input: CreateClaimInput,
): Promise<MirrorNode> {
  const { ensureIdentity, signMirrorClaimWithIdentity } = await import("./identity");
  const identity = await ensureIdentity();
  return await signMirrorClaimWithIdentity(identity, input);
}
