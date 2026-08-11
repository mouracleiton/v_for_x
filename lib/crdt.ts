/**
 * V FOR X — CRDT Docs (Replicated Growable Array)
 *
 * An offline-first, conflict-free collaborative text document implemented
 * from scratch. NO dependencies (the platform ships zero collaborative
 * libraries on purpose).
 *
 * ALGORITHM — RGA with tombstones
 *   Every character inserted into the document becomes an OPERATION (op)
 *   with a globally-unique id:  "<lamport>:<actorId>". Each op remembers
 *   the id of the op it was inserted AFTER ("origin"; null = the root).
 *
 *   When two replicas diverge (concurrent edits), the convergent total
 *   order is decided by walking the causal tree:
 *     - if a's origin is b       → b comes first
 *     - if b's origin is a       → a comes first
 *     - if they share an origin  → newer op first (lamport DESC), tie → actorId
 *     - otherwise                → recurse toward the roots
 *
 *   Deleted characters become TOMBSTONES: they stay in the op map (so a
 *   stale merge can never resurrect them) but are skipped by toText().
 *
 *   This order is commutative and associative: any two replicas that
 *   exchange unknown ops converge to the same text, regardless of merge
 *   direction or order.
 *
 * TRANSPORT — documents travel as compact tokens:
 *   VFXCRDT1:<base64url(JSON {docId, actorId, lamport, ops})>
 *   Peer sync is what the human does: copy → paste, or BroadcastChannel
 *   between tabs on the same device. There is no server.
 */

export interface CRDTOp {
  /** Globally-unique id "<lamport>:<actorId>". */
  id: string;
  /** Id of the op this was inserted after; null = document root. */
  origin: string | null;
  /** The character carried by this op. */
  char: string;
  /** Tombstone flag — deleted chars are never removed from the map. */
  deleted: boolean;
  /** Lamport clock value (also embedded in id, kept for clarity). */
  ts: number;
  /** Actor id that created this op. */
  actor: string;
}

export const CRDT_PREFIX = "VFXCRDT1:";
export const CRDT_SIGNED_PREFIX = "VFXCRDT1S:";

export interface SignedCRDTToken {
  version: 1;
  docData: {
    docId: string;
    actorId: string;
    lamport: number;
    ops: CRDTOp[];
  };
  signature: string;
  publicKeyHex: string;
  handle: string;
}

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
  return Uint8Array.from(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)), (c) =>
    c.charCodeAt(0),
  ).buffer;
}

/** Parse an op id into {lamport, actor} (strict). */
export function parseOpId(id: string): { lamport: number; actor: string } {
  const idx = id.lastIndexOf(":");
  if (idx <= 0) throw new Error(`Malformed op id: ${id}`);
  const lamport = Number(id.slice(0, idx));
  const actor = id.slice(idx + 1);
  if (!Number.isInteger(lamport) || lamport < 0 || actor.length === 0) {
    throw new Error(`Malformed op id: ${id}`);
  }
  return { lamport, actor };
}

/**
 * Deterministic tie-break for concurrent siblings.
 * Sibling ordering in RGA is by creation time DESCENDING: the most recent
 * insertion sits immediately after the shared parent (later lamport = closer
 * to the parent). Equal lamports (rare) break on actor id for determinism.
 */
function tiebreak(a: CRDTOp, b: CRDTOp): number {
  const pa = parseOpId(a.id);
  const pb = parseOpId(b.id);
  if (pa.lamport !== pb.lamport) return pb.lamport - pa.lamport;
  if (pa.actor !== pb.actor) return pa.actor < pb.actor ? -1 : 1;
  return 0;
}

/**
 * RGA order comparison. Total, deterministic, convergent.
 * Must satisfy: compare(a,b) < 0  → a before b.
 *
 * Works on origin PATHS (op → origin → origin → … → root). Two ops are
 * ordered by their first point of divergence: the two ops at that point
 * share a parent (siblings) and are ranked by creation time DESCENDING
 * (the most recent insertion sits right after the shared parent). If one
 * path is a prefix of the other, the ancestor (shorter path) comes first.
 */
export function compareOps(a: CRDTOp, b: CRDTOp, ops: Map<string, CRDTOp>): number {
  if (a.id === b.id) return 0;
  const pa = opPath(a.id, ops);
  const pb = opPath(b.id, ops);
  const n = Math.min(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    if (pa[i] !== pb[i]) {
      const x = ops.get(pa[i])!;
      const y = ops.get(pb[i])!;
      return tiebreak(x, y);
    }
  }
  if (pa.length !== pb.length) return pa.length - pb.length;
  return 0;
}

/** Ancestor chain for an op id: root-first list of op ids. */
function opPath(id: string, ops: Map<string, CRDTOp>): string[] {
  const path: string[] = [];
  let cur: string | null = id;
  let guard = 0;
  while (cur && guard++ < 100_000) {
    path.push(cur);
    cur = ops.get(cur)?.origin ?? null;
  }
  path.reverse();
  return path;
}

export class CRDTDoc {
  readonly actor: string;
  readonly docId: string;
  private ops = new Map<string, CRDTOp>();
  private lamport = 0;

  constructor(actor: string, docId = "default") {
    if (!actor || actor.length === 0) throw new Error("CRDT actor id required");
    this.actor = actor;
    this.docId = docId;
  }

  /** Next lamport tick — returns the value then increments. */
  private nextLamport(): number {
    this.lamport += 1;
    return this.lamport;
  }

  private newOp(origin: string | null, char: string): CRDTOp {
    const ts = this.nextLamport();
    return { id: `${ts}:${this.actor}`, origin, char, deleted: false, ts, actor: this.actor };
  }

  /** Insert text at a visible-character index. Returns the created ops. */
  insertAt(index: number, text: string): CRDTOp[] {
    if (index < 0) throw new Error("index must be >= 0");
    const ordered = this.orderedOps();
    if (index > ordered.length) index = ordered.length;
    const anchor = index === 0 ? null : ordered[index - 1].id;
    const created: CRDTOp[] = [];
    let origin = anchor;
    for (const char of text) {
      const op = this.newOp(origin, char);
      this.ops.set(op.id, op);
      created.push(op);
      origin = op.id;
    }
    return created;
  }

  /** Delete length visible characters starting at index (tombstones). */
  deleteRange(start: number, length: number): CRDTOp[] {
    const ordered = this.orderedOps();
    if (start < 0) start = 0;
    const end = Math.min(ordered.length, start + length);
    const toggled: CRDTOp[] = [];
    for (let i = start; i < end; i++) {
      const op = ordered[i];
      if (!op.deleted) {
        op.deleted = true;
        toggled.push(op);
      }
    }
    return toggled;
  }

  /** Apply ops from another replica. Returns how many were new. */
  applyOps(ops: CRDTOp[]): number {
    let added = 0;
    for (const op of ops) {
      if (!op || typeof op.id !== "string") continue;
      const existing = this.ops.get(op.id);
      if (existing) {
        // Tombstone dominance: a deleted op can never be resurrected by a
        // stale merge carrying the same op id as live. This is what keeps
        // delete-vs-insert convergence deterministic.
        if (op.deleted && !existing.deleted) existing.deleted = true;
        continue;
      }
      // Refresh lamport if a foreign op carries a higher clock.
      const { lamport } = parseOpId(op.id);
      if (lamport > this.lamport) this.lamport = lamport;
      this.ops.set(op.id, { ...op });
      added += 1;
    }
    return added;
  }

  /** Full total order (tombstones included) — the source of truth. */
  orderedOps(): CRDTOp[] {
    const list = [...this.ops.values()];
    list.sort((a, b) => compareOps(a, b, this.ops));
    return list;
  }

  /** Rendered text: ordered ops minus tombstones. */
  toText(): string {
    return this.orderedOps()
      .filter((op) => !op.deleted)
      .map((op) => op.char)
      .join("");
  }

  /** Snapshot of all ops (export shape). */
  getOps(): CRDTOp[] {
    return [...this.ops.values()].map((op) => ({ ...op }));
  }

  getVersion(): number {
    return this.ops.size;
  }

  /** Merge another doc — apply unknown ops. Returns count applied. */
  merge(other: CRDTDoc): number {
    return this.applyOps(other.getOps());
  }

  /** Export as a compact, shareable token. */
  encode(): string {
    const payload = JSON.stringify({
      docId: this.docId,
      actorId: this.actor,
      lamport: this.lamport,
      ops: this.getOps(),
    });
    return CRDT_PREFIX + bufToB64url(new TextEncoder().encode(payload));
  }

  /** Decode a token into a live doc. Throws on malformed input. */
  static decode(token: string): CRDTDoc {
    const raw = (token ?? "").trim();
    if (!raw.startsWith(CRDT_PREFIX)) throw new Error("Not a CRDT token");
    let json: string;
    try {
      json = new TextDecoder().decode(b64urlToBuf(raw.slice(CRDT_PREFIX.length)));
    } catch {
      throw new Error("Corrupt CRDT token (bad base64)");
    }
    let parsed: { docId: string; actorId: string; lamport: number; ops: CRDTOp[] };
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("Corrupt CRDT token (bad JSON)");
    }
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.ops)) {
      throw new Error("Corrupt CRDT token");
    }
    if (typeof parsed.actorId !== "string" || parsed.actorId.length === 0) {
      throw new Error("CRDT token missing actor");
    }
    const doc = new CRDTDoc(parsed.actorId, parsed.docId || "default");
    doc.applyOps(parsed.ops);
    if (typeof parsed.lamport === "number") doc.lamport = parsed.lamport;
    return doc;
  }

  /** Merge a decoded token's ops into THIS doc (same docId only). */
  mergeToken(token: string): number {
    const other = CRDTDoc.decode(token);
    if (other.docId !== this.docId) {
      throw new Error(`Doc mismatch: "${other.docId}" != "${this.docId}"`);
    }
    return this.merge(other);
  }

  /**
   * Export as a signed token using VFXID1 identity.
   *
   * The signature covers the document content (ops, lamport, docId, actorId).
   * This provides cryptographic proof of document origin and integrity.
   *
   * @param identity - The VFXID1 identity to sign with
   * @returns A signed VFXCRDT1S token
   */
  async encodeSigned(identity: {
    privateKey: CryptoKey;
    publicKeyHex: string;
    handle: string;
  }): Promise<string> {
    const docData = {
      docId: this.docId,
      actorId: this.actor,
      lamport: this.lamport,
      ops: this.getOps(),
    };

    // Create canonical representation for signing
    const canonical = JSON.stringify(docData);
    const messageBytes = new TextEncoder().encode(canonical);

    // Sign the hash
    const hashBuffer = await crypto.subtle.digest("SHA-256", messageBytes);
    const hashHex = bytesToHex(new Uint8Array(hashBuffer));

    const sigBuf = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      identity.privateKey,
      hashBuffer
    );
    const signature = bytesToHex(new Uint8Array(sigBuf));

    const token: SignedCRDTToken = {
      version: 1,
      docData,
      signature,
      publicKeyHex: identity.publicKeyHex,
      handle: identity.handle,
    };

    const json = JSON.stringify(token);
    const payload = new TextEncoder().encode(json);
    return CRDT_SIGNED_PREFIX + bufToB64url(payload);
  }

  /**
   * Verify a signed CRDT token's signature.
   *
   * Returns the public identity of the signer if the signature is valid,
   * otherwise returns null. This provides cryptographic verification of
   * document origin without requiring the private key.
   *
   * @param token - A VFXCRDT1S token to verify
   * @returns The public identity of the signer, or null if invalid
   */
  static async verifyTokenSignature(token: string): Promise<{
    publicKeyHex: string;
    handle: string;
    fingerprint: string;
  } | null> {
    const raw = (token ?? "").trim();
    if (!raw.startsWith(CRDT_SIGNED_PREFIX)) {
      return null;
    }

    let json: string;
    try {
      json = new TextDecoder().decode(
        b64urlToBuf(raw.slice(CRDT_SIGNED_PREFIX.length))
      );
    } catch {
      return null;
    }

    let parsed: SignedCRDTToken;
    try {
      parsed = JSON.parse(json);
    } catch {
      return null;
    }

    if (parsed.version !== 1 || !parsed.docData || !parsed.signature) {
      return null;
    }

    try {
      // Create canonical representation for verification
      const canonical = JSON.stringify(parsed.docData);
      const messageBytes = new TextEncoder().encode(canonical);
      const hashBuffer = await crypto.subtle.digest("SHA-256", messageBytes);

      // Import public key
      const pubKeyBytes = hexToBytes(parsed.publicKeyHex);
      const publicKey = await crypto.subtle.importKey(
        "raw",
        pubKeyBytes.buffer as ArrayBuffer,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"]
      );

      // Verify signature
      const sigBytes = hexToBytes(parsed.signature);
      const isValid = await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        publicKey,
        sigBytes.buffer as ArrayBuffer,
        hashBuffer
      );

      if (!isValid) {
        return null;
      }

      // Compute fingerprint
      const fingerprintHashBuf = await crypto.subtle.digest(
        "SHA-256",
        pubKeyBytes.buffer as ArrayBuffer
      );
      const fingerprint = bytesToHex(new Uint8Array(fingerprintHashBuf)).slice(0, 12);

      return {
        publicKeyHex: parsed.publicKeyHex,
        handle: parsed.handle,
        fingerprint,
      };
    } catch {
      return null;
    }
  }

  /**
   * Decode a signed CRDT token and return both the document and verified identity.
   *
   * This is the primary method for importing signed documents. It verifies the
   * signature and reconstructs the CRDT document in one operation.
   *
   * @param token - A VFXCRDT1S token to decode and verify
   * @returns An object with the doc and verified identity, or null if invalid
   */
  static async decodeSigned(token: string): Promise<{
    doc: CRDTDoc;
    identity: {
      publicKeyHex: string;
      handle: string;
      fingerprint: string;
    };
  } | null> {
    const raw = (token ?? "").trim();
    if (!raw.startsWith(CRDT_SIGNED_PREFIX)) {
      return null;
    }

    let json: string;
    try {
      json = new TextDecoder().decode(
        b64urlToBuf(raw.slice(CRDT_SIGNED_PREFIX.length))
      );
    } catch {
      return null;
    }

    let parsed: SignedCRDTToken;
    try {
      parsed = JSON.parse(json);
    } catch {
      return null;
    }

    if (
      parsed.version !== 1 ||
      !parsed.docData ||
      !parsed.signature ||
      !parsed.publicKeyHex
    ) {
      return null;
    }

    // Verify signature first
    const identity = await CRDTDoc.verifyTokenSignature(token);
    if (!identity) {
      return null;
    }

    // Reconstruct the document
    try {
      const doc = new CRDTDoc(
        parsed.docData.actorId,
        parsed.docData.docId || "default"
      );
      doc.applyOps(parsed.docData.ops);
      if (typeof parsed.docData.lamport === "number") {
        doc.lamport = parsed.docData.lamport;
      }

      return { doc, identity };
    } catch {
      return null;
    }
  }

  /**
   * Apply a local edit (old value → new value) to this doc.
   * Computes the minimal insert/delete delta and applies it.
   */
  applyEdit(previous: string, next: string): { inserted: string; deleted: number } {
    if (previous === next) return { inserted: "", deleted: 0 };
    let prefix = 0;
    const max = Math.min(previous.length, next.length);
    while (prefix < max && previous[prefix] === next[prefix]) prefix += 1;
    let suffix = 0;
    while (
      suffix < max - prefix &&
      previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
    ) {
      suffix += 1;
    }
    const delCount = previous.length - prefix - suffix;
    if (delCount > 0) this.deleteRange(prefix, delCount);
    const inserted = next.slice(prefix, next.length - suffix);
    if (inserted.length > 0) this.insertAt(prefix, inserted);
    return { inserted, deleted: delCount };
  }
}

/**
 * Merge two docs into a new doc (both left untouched).
 * The result converges regardless of merge direction.
 */
export function mergeDocs(a: CRDTDoc, b: CRDTDoc, actorId: string): CRDTDoc {
  if (a.docId !== b.docId) throw new Error("Cannot merge docs with different docIds");
  const merged = new CRDTDoc(actorId, a.docId);
  merged.applyOps(a.getOps());
  merged.applyOps(b.getOps());
  return merged;
}

/**
 * Convert a hex string to a Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const buf = new Uint8Array(clean.length / 2);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return buf;
}

/**
 * Convert a Uint8Array to a hex string.
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
