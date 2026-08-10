/**
 * V FOR X — Data Integrity Verifier (signed data verifiability)
 *
 * The platform is fully static, so any copy (clearnet, IPFS mirror,
 * USB drive) can be served as-is. To detect a tampered build, the
 * build pipeline emits a deterministic SHA-256 manifest over the
 * public data API files (scripts/generate_data_manifest.py). This
 * module verifies, entirely in the browser:
 *
 *   - each advertised file computes to its recorded SHA-256,
 *   - the ROOT hash re-derived from the sorted manifest matches
 *     the published root (the same root that Mirror badge claims
 *     carry, via lib/mirror.ts computeManifestRoot).
 *
 * Nothing is fetched except the files the page itself would serve;
 * the whole verification is read-only and offline-capable.
 */

export interface DataManifestEntry {
  path: string;
  size: number;
  sha256: string;
}

export interface DataManifest {
  format: string;
  generatedAt: string;
  count: number;
  root: string;
  entries: DataManifestEntry[];
}

export type EntryStatus =
  | { path: string; ok: true }
  | { path: string; ok: false; reason: "missing" | "size_mismatch" | "hash_mismatch" };

export interface VerificationResult {
  entries: EntryStatus[];
  /** Number of passing entries. */
  okCount: number;
  /** Number of failing entries. */
  failCount: number;
  /** Computed root hash over the entries. */
  computedRoot: string;
  /** Published root from the manifest. */
  expectedRoot: string;
  /** Whether computedRoot === expectedRoot. */
  rootValid: boolean;
}

/** Hex-encode bytes. */
export function hexFromBuf(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** True if a string looks like a 64-char lowercase hex SHA-256. */
export function isValidSha256(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash ?? "");
}

/** Fetch a path relative to the site root and return its bytes. */
export async function fetchEntry(path: string, base = ""): Promise<Uint8Array> {
  const root = base || (typeof location !== "undefined" ? location.origin + location.pathname : "/");
  const url = new URL(path.replace(/^\/+/, ""), root.endsWith("/") ? root : root + "/");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Compute the deterministic root hash over a manifest entry list.
 * Mirrors mirror.ts computeManifestRoot / mirror/manifest.sh:
 * entries sorted by path, serialized canonically, SHA-256 over all.
 */
export async function computeManifestRoot(entries: DataManifestEntry[]): Promise<string> {
  const sorted = [...entries]
    .map((e) => ({ path: e.path, size: e.size, sha256: e.sha256 }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return hexFromBuf(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(sorted))),
  );
}

/**
 * Verify one entry: fetch it, check size, then SHA-256.
 * fetcher defaults to fetchEntry (browser); tests inject a stub.
 */
export async function verifyEntry(
  entry: DataManifestEntry,
  fetcher: (path: string) => Promise<Uint8Array> = fetchEntry,
): Promise<EntryStatus> {
  try {
    const bytes = await fetcher(entry.path);
    if (bytes.length !== entry.size) {
      return { path: entry.path, ok: false, reason: "size_mismatch" };
    }
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const hash = hexFromBuf(
      await crypto.subtle.digest("SHA-256", copy),
    );
    if (hash !== entry.sha256) {
      return { path: entry.path, ok: false, reason: "hash_mismatch" };
    }
    return { path: entry.path, ok: true };
  } catch {
    return { path: entry.path, ok: false, reason: "missing" };
  }
}

/**
 * Verify an entire manifest document (parsed from the served
 * .json): every entry + the root hash.
 */
export async function verifyManifest(
  manifest: DataManifest,
  fetcher: (path: string) => Promise<Uint8Array> = fetchEntry,
): Promise<VerificationResult> {
  const entries: EntryStatus[] = [];
  let okCount = 0;
  for (const entry of manifest.entries ?? []) {
    const res = await verifyEntry(entry, fetcher);
    entries.push(res);
    if (res.ok) okCount++;
  }
  const computedRoot = await computeManifestRoot(manifest.entries ?? []);
  return {
    entries,
    okCount,
    failCount: entries.length - okCount,
    computedRoot,
    expectedRoot: manifest.root,
    rootValid: computedRoot === manifest.root,
  };
}

/** Fetch and parse the served data manifest document. */
export async function fetchManifest(
  path = "/api/v1/manifest.json",
  base = "",
  fetcher: (path: string) => Promise<Uint8Array> = fetchEntry,
): Promise<DataManifest> {
  const bytes = await fetcher(path);
  const json = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(json) as DataManifest;
  if (!parsed || !parsed.format || !Array.isArray(parsed.entries)) {
    throw new Error("Not a V FOR X data manifest");
  }
  return parsed;
}

/** Short human fingerprint of a root hash. */
export function shortFingerprint(hash: string): string {
  return (hash ?? "").slice(0, 12);
}