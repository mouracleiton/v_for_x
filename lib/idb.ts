/**
 * V FOR X — IndexedDB local-first persistence layer
 * Shared by The Trail (ledger), Protocol X (checklist), The Signal (watchlist).
 * Uses the `idb` package (already a dependency).
 */

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "vfx-store";
const DB_VERSION = 1;

export interface LedgerEntry {
  id?: number;
  ts: number;
  source: string;
  destination: string;
  amount: string;
  purpose: string;
  status: "VERIFIED" | "PENDING" | "IN_TRANSIT";
  signature?: string;
  signerHandle?: string;
}

export interface ChecklistKit {
  id?: number;
  name: string;
  scenarios: string[];
  items: { text: string; checked: boolean }[];
  createdAt: number;
  updatedAt: number;
  signature?: string;
}

export interface WatchlistEntry {
  iso3: string;
  name: string;
  addedAt: number;
  note?: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB not available on server"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("ledger")) {
          const store = db.createObjectStore("ledger", { keyPath: "id", autoIncrement: true });
          store.createIndex("by-status", "status");
        }
        if (!db.objectStoreNames.contains("checklists")) {
          db.createObjectStore("checklists", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("watchlist")) {
          db.createObjectStore("watchlist", { keyPath: "iso3" });
        }
      },
    });
  }
  return dbPromise;
}

/* ═══ LEDGER ═══ */

export async function ledgerGetAll(): Promise<LedgerEntry[]> {
  try {
    const db = await getDB();
    const all = await db.getAll("ledger");
    return all.sort((a, b) => b.ts - a.ts);
  } catch {
    return [];
  }
}

export async function ledgerAdd(entry: LedgerEntry): Promise<number> {
  const db = await getDB();
  const id = await db.add("ledger", entry);
  return id as number;
}

export async function ledgerUpdate(id: number, patch: Partial<LedgerEntry>): Promise<void> {
  const db = await getDB();
  const existing = await db.get("ledger", id);
  if (existing) {
    await db.put("ledger", { ...existing, ...patch });
  }
}

export async function ledgerDelete(id: number): Promise<void> {
  const db = await getDB();
  await db.delete("ledger", id);
}

export async function ledgerClear(): Promise<void> {
  const db = await getDB();
  await db.clear("ledger");
}

/* ═══ CHECKLISTS ═══ */

export async function checklistGetAll(): Promise<ChecklistKit[]> {
  try {
    const db = await getDB();
    return await db.getAll("checklists");
  } catch {
    return [];
  }
}

export async function checklistSave(kit: ChecklistKit): Promise<number> {
  const db = await getDB();
  if (kit.id !== undefined) {
    await db.put("checklists", kit);
    return kit.id;
  }
  const id = await db.add("checklists", kit);
  return id as number;
}

export async function checklistDelete(id: number): Promise<void> {
  const db = await getDB();
  await db.delete("checklists", id);
}

/* ═══ WATCHLIST ═══ */

export async function watchlistGetAll(): Promise<WatchlistEntry[]> {
  try {
    const db = await getDB();
    const all = await db.getAll("watchlist");
    return all.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function watchlistAdd(entry: WatchlistEntry): Promise<void> {
  try {
    const db = await getDB();
    await db.put("watchlist", entry);
  } catch {
    /* ignore */
  }
}

export async function watchlistRemove(iso3: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete("watchlist", iso3);
  } catch {
    /* ignore */
  }
}

export async function watchlistHas(iso3: string): Promise<boolean> {
  try {
    const db = await getDB();
    const entry = await db.get("watchlist", iso3);
    return !!entry;
  } catch {
    return false;
  }
}

/* ═══ CRYPTO SIGNING ═══ */

export async function signData(data: unknown): Promise<{ signature: string; handle: string } | null> {
  if (typeof window === "undefined" || !window.crypto?.subtle) return null;
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign", "verify"]
    );
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const sig = await window.crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      keyPair.privateKey,
      encoded
    );
    const sigHex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const pubKey = await window.crypto.subtle.exportKey("raw", keyPair.publicKey);
    const pubHex = Array.from(new Uint8Array(pubKey))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return { signature: sigHex, handle: pubHex.slice(0, 16) };
  } catch {
    return null;
  }
}

/* ═══ EXPORT ═══ */

export function downloadJSON(data: unknown, filename: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
