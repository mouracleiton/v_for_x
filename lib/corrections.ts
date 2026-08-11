/**
 * V FOR X — Crowdsource Data Corrections
 *
 * A community-verified data correction layer on top of the authoritative
 * backbone. Anyone can flag a suspect data point for a country+metric,
 * propose a corrected value, and attach a source URL. Corrections are:
 *   • Stored locally (localStorage) — never leaves the device unless exported
 *   • Signed with an ephemeral ECDSA P-256 keypair (authenticity w/o identity)
 *   • Exportable as a portable, shareable "pull-request style" package
 *   • Importable — so corrections propagate across devices / mirrors / mesh
 *
 * The backbone itself stays authoritative; corrections form a review layer
 * that editors and researchers can diff against.
 */

export interface DataCorrection {
  id: string;
  ts: number;
  iso3: string;
  countryName: string;
  /** Dotted metric path, e.g. "hunger.undernourishment_pct" */
  metricPath: string;
  metricLabel: string;
  /** The value currently shown by the platform */
  reportedValue: string;
  /** The correction being proposed */
  correctedValue: string;
  /** Optional supporting source URL */
  sourceUrl?: string;
  /** Optional free-text justification */
  note?: string;
  status: "open" | "verified" | "rejected";
  /** Ephemeral ECDSA signature over the canonical payload (hex) */
  signature?: string;
  /** First 16 hex chars of the public key — a stable anonymous handle */
  handle?: string;
}

/* ═══ persistence (localStorage — synchronous, testable) ═══ */

const STORAGE_KEY = "vfx-corrections";

function readStore(): DataCorrection[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(items: DataCorrection[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage full or disabled */
  }
}

/* ═══ identity ═══ */

function uid(): string {
  const rand =
    typeof crypto !== "undefined" && crypto.getRandomValues
      ? Array.from(crypto.getRandomValues(new Uint8Array(8)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `vfx-cor-${Date.now().toString(36)}-${rand}`;
}

/* ═══ canonicalization + signing ═══ */

/** The exact payload that gets signed — stable across import/export. */
function canonical(c: DataCorrection): string {
  return JSON.stringify(
    {
      iso3: c.iso3,
      countryName: c.countryName,
      metricPath: c.metricPath,
      metricLabel: c.metricLabel,
      reportedValue: c.reportedValue,
      correctedValue: c.correctedValue,
      sourceUrl: c.sourceUrl ?? null,
      note: c.note ?? null,
      ts: c.ts,
    },
    undefined,
    0,
  );
}

/**
 * Sign a correction with an ephemeral ECDSA P-256 keypair.
 * Returns a new correction object with `signature` and `handle` set.
 * Returns the input unchanged when Web Crypto is unavailable (SSR / insecure ctx).
 */
export async function signCorrection(
  c: DataCorrection,
): Promise<DataCorrection> {
  if (typeof window === "undefined" || !window.crypto?.subtle) return c;
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );
    const encoded = new TextEncoder().encode(canonical(c));
    const sig = await window.crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      keyPair.privateKey,
      encoded,
    );
    const sigHex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const pub = await window.crypto.subtle.exportKey("raw", keyPair.publicKey);
    const pubHex = Array.from(new Uint8Array(pub))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return { ...c, signature: sigHex, handle: pubHex.slice(0, 16) };
  } catch {
    return c;
  }
}

/* ═══ CRUD ═══ */

/** Add a new correction (optionally signing it first). */
export async function addCorrection(
  input: Omit<DataCorrection, "id" | "ts" | "status" | "signature" | "handle">,
): Promise<DataCorrection> {
  const base: DataCorrection = {
    ...input,
    id: uid(),
    ts: Date.now(),
    status: "open",
  };
  const signed = await signCorrection(base);
  writeStore([signed, ...readStore()]);
  return signed;
}

/** List all corrections, newest first. */
export function listCorrections(): DataCorrection[] {
  return readStore().sort((a, b) => b.ts - a.ts);
}

/** Corrections for a single country (no filter — caller can filter by status). */
export function correctionsForCountry(iso3: string): DataCorrection[] {
  const target = iso3.toUpperCase();
  return readStore().filter((c) => c.iso3.toUpperCase() === target);
}

export function getCorrection(id: string): DataCorrection | null {
  return readStore().find((c) => c.id === id) ?? null;
}

export function updateCorrectionStatus(
  id: string,
  status: DataCorrection["status"],
): void {
  const items = readStore();
  const idx = items.findIndex((c) => c.id === id);
  if (idx !== -1) {
    items[idx] = { ...items[idx], status };
    writeStore(items);
  }
}

export function deleteCorrection(id: string): void {
  writeStore(readStore().filter((c) => c.id !== id));
}

export function clearCorrections(): void {
  writeStore([]);
}

/* ═══ portable share package ═══ */

export interface CorrectionPackage {
  format: "vfx-corrections";
  version: 1;
  exportedAt: string;
  corrections: DataCorrection[];
}

/** Build a portable, signed-capable package from a list of corrections. */
export function buildCorrectionPackage(
  corrections: DataCorrection[],
): CorrectionPackage {
  return {
    format: "vfx-corrections",
    version: 1,
    exportedAt: new Date().toISOString(),
    corrections,
  };
}

/** Validate an unknown value as a CorrectionPackage. Returns null if malformed. */
export function parseCorrectionPackage(raw: unknown): CorrectionPackage | null {
  if (
    typeof raw !== "object" ||
    raw === null ||
    (raw as Record<string, unknown>).format !== "vfx-corrections"
  ) {
    return null;
  }
  const obj = raw as CorrectionPackage;
  if (!Array.isArray(obj.corrections)) return null;
  if (obj.corrections.some((c) => !c || typeof c !== "object" || !c.metricPath)) {
    return null;
  }
  return obj;
}

/**
 * Import corrections from a package, deduping by id.
 * Returns the number of new corrections imported.
 */
export function importCorrectionPackage(
  pkg: CorrectionPackage,
): number {
  const existing = readStore();
  const known = new Set(existing.map((c) => c.id));
  let imported = 0;
  for (const c of pkg.corrections) {
    if (known.has(c.id)) continue;
    existing.push(c);
    known.add(c.id);
    imported++;
  }
  if (imported > 0) writeStore(existing);
  return imported;
}

/* ═══ stats ═══ */

export interface CorrectionStats {
  total: number;
  byStatus: Record<DataCorrection["status"], number>;
  byCountry: number;
  signed: number;
}

export function correctionStats(): CorrectionStats {
  const all = readStore();
  const byStatus: Record<DataCorrection["status"], number> = {
    open: 0,
    verified: 0,
    rejected: 0,
  };
  for (const c of all) byStatus[c.status]++;
  return {
    total: all.length,
    byStatus,
    byCountry: new Set(all.map((c) => c.iso3)).size,
    signed: all.filter((c) => c.signature && c.handle).length,
  };
}
