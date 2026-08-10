/**
 * V FOR X — The Vault
 *
 * Encrypted client-side evidence & notes store for citizen journalists.
 * AES-GCM via Web Crypto API. All data stays in IndexedDB — nothing
 * leaves the device. Integrates with the duress/panic wipe system.
 *
 * Every entry is encrypted with a user-derived key (PBKDF2 → AES-GCM).
 * The passphrase never touches storage; only the salt + verification
 * hash are persisted.
 */

import { openDB, type IDBPDatabase } from "idb";

const VAULT_DB = "vfx-vault";
const VAULT_DB_VERSION = 1;
const ENTRY_STORE = "vault-entries";
const KEY_STORE = "vault-key";
const PBKDF2_ITERATIONS = 150_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface VaultEntry {
  id: string;
  title: string;
  body: string;
  iso3?: string;
  tags: string[];
  severity: "info" | "warning" | "critical";
  createdAt: number;
  updatedAt: number;
}

export interface VaultEntryStored {
  id: string;
  /** AES-GCM encrypted blob (base64) */
  ciphertext: string;
  iv: string;
  createdAt: number;
  updatedAt: number;
}

interface VaultKeyRecord {
  id: "key";
  salt: string;
  /** PBKDF2 hash of passphrase for verification (base64) */
  verifyHash: string;
  iterations: number;
}

/* ═══════════════════════════════════════════════════════════════
   DB
   ═══════════════════════════════════════════════════════════════ */

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB not available on server"));
  }
  if (!dbPromise) {
    dbPromise = openDB(VAULT_DB, VAULT_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(ENTRY_STORE)) {
          db.createObjectStore(ENTRY_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(KEY_STORE)) {
          db.createObjectStore(KEY_STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

/* ═══════════════════════════════════════════════════════════════
   Crypto helpers
   ═══════════════════════════════════════════════════════════════ */

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function generateSalt(): Uint8Array {
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);
  return salt;
}

function generateIV(): Uint8Array {
  const iv = new Uint8Array(IV_LENGTH);
  crypto.getRandomValues(iv);
  return iv;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Promise<{ cryptoKey: CryptoKey; verifyHash: ArrayBuffer }> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase) as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey", "deriveBits"]
  );

  const cryptoKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );

  const verifyHash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );

  return { cryptoKey, verifyHash };
}

/* ═══════════════════════════════════════════════════════════════
   Vault lifecycle
   ═══════════════════════════════════════════════════════════════ */

/** Check whether a vault has been initialized on this device. */
export async function vaultExists(): Promise<boolean> {
  try {
    const db = await getDB();
    const rec = await db.get(KEY_STORE, "key");
    return !!rec;
  } catch {
    return false;
  }
}

/** Initialize a new vault with a passphrase. Throws if one already exists. */
export async function createVault(passphrase: string): Promise<void> {
  if (passphrase.length < 8) {
    throw new Error("Passphrase must be at least 8 characters");
  }
  const db = await getDB();
  const existing = await db.get(KEY_STORE, "key");
  if (existing) {
    throw new Error("Vault already exists. Use unlock().");
  }

  const salt = generateSalt();
  const { verifyHash } = await deriveKey(passphrase, salt);

  const record: VaultKeyRecord = {
    id: "key",
    salt: bufToBase64(salt.buffer as ArrayBuffer),
    verifyHash: bufToBase64(verifyHash),
    iterations: PBKDF2_ITERATIONS,
  };
  await db.put(KEY_STORE, record);
}

/** Verify a passphrase against the stored verification hash. */
export async function verifyPassphrase(passphrase: string): Promise<boolean> {
  try {
    const db = await getDB();
    const rec = (await db.get(KEY_STORE, "key")) as VaultKeyRecord | undefined;
    if (!rec) return false;

    const salt = new Uint8Array(base64ToBuf(rec.salt));
    const { verifyHash } = await deriveKey(passphrase, salt, rec.iterations);

    const stored = new Uint8Array(base64ToBuf(rec.verifyHash));
    const computed = new Uint8Array(verifyHash);

    if (stored.length !== computed.length) return false;
    // Constant-time comparison
    let diff = 0;
    for (let i = 0; i < stored.length; i++) {
      diff |= stored[i] ^ computed[i];
    }
    return diff === 0;
  } catch {
    return false;
  }
}

/**
 * Unlock the vault — derives the AES-GCM key from the passphrase
 * and holds it in memory for the session. Returns false on wrong passphrase.
 */
let sessionKey: CryptoKey | null = null;

export async function unlockVault(passphrase: string): Promise<boolean> {
  const ok = await verifyPassphrase(passphrase);
  if (!ok) return false;

  const db = await getDB();
  const rec = (await db.get(KEY_STORE, "key")) as VaultKeyRecord;
  const salt = new Uint8Array(base64ToBuf(rec.salt));
  const { cryptoKey } = await deriveKey(passphrase, salt, rec.iterations);
  sessionKey = cryptoKey;
  return true;
}

/** Lock the vault — clears the in-memory session key. */
export function lockVault(): void {
  sessionKey = null;
}

export function isVaultUnlocked(): boolean {
  return sessionKey !== null;
}

/* ═══════════════════════════════════════════════════════════════
   Entry CRUD
   ═══════════════════════════════════════════════════════════════ */

async function encryptEntry(entry: VaultEntry): Promise<VaultEntryStored> {
  if (!sessionKey) throw new Error("Vault is locked");
  const enc = new TextEncoder();
  const iv = generateIV();
  const plaintext = JSON.stringify(entry);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    sessionKey,
    enc.encode(plaintext) as BufferSource
  );
  return {
    id: entry.id,
    ciphertext: bufToBase64(ciphertext),
    iv: bufToBase64(iv.buffer as ArrayBuffer),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

async function decryptEntry(stored: VaultEntryStored): Promise<VaultEntry> {
  if (!sessionKey) throw new Error("Vault is locked");
  const iv = new Uint8Array(base64ToBuf(stored.iv));
  const ciphertext = base64ToBuf(stored.ciphertext);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    sessionKey,
    ciphertext
  );
  const dec = new TextDecoder();
  return JSON.parse(dec.decode(plaintext)) as VaultEntry;
}

export async function saveVaultEntry(
  entry: Omit<VaultEntry, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
  }
): Promise<string> {
  if (!sessionKey) throw new Error("Vault is locked");
  const db = await getDB();

  const now = Date.now();
  const id = entry.id || `vault-${now}-${Math.random().toString(36).slice(2, 8)}`;
  const full: VaultEntry = {
    ...entry,
    id,
    createdAt: now,
    updatedAt: now,
  };

  // If updating, preserve createdAt
  if (entry.id) {
    const existing = (await db.get(ENTRY_STORE, id)) as VaultEntryStored | undefined;
    if (existing) {
      full.createdAt = existing.createdAt;
    }
  }

  const stored = await encryptEntry(full);
  await db.put(ENTRY_STORE, stored);
  return id;
}

export async function getAllVaultEntries(): Promise<VaultEntry[]> {
  if (!sessionKey) return [];
  try {
    const db = await getDB();
    const all = (await db.getAll(ENTRY_STORE)) as VaultEntryStored[];
    const decrypted = await Promise.all(
      all.map((s) => decryptEntry(s).catch(() => null))
    );
    return decrypted
      .filter((e): e is VaultEntry => e !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function deleteVaultEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(ENTRY_STORE, id);
}

export async function getVaultEntryCount(): Promise<number> {
  try {
    const db = await getDB();
    return await db.count(ENTRY_STORE);
  } catch {
    return 0;
  }
}

/* ═══════════════════════════════════════════════════════════════
   Export / Import / Wipe
   ═══════════════════════════════════════════════════════════════ */

/**
 * Export the entire vault as an encrypted JSON blob.
 * Even if unlocked, the export contains ciphertext — safe to share/back up.
 */
export async function exportVault(): Promise<string> {
  const db = await getDB();
  const entries = (await db.getAll(ENTRY_STORE)) as VaultEntryStored[];
  const keyRec = (await db.get(KEY_STORE, "key")) as VaultKeyRecord;
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), key: keyRec, entries },
    null,
    2
  );
}

/**
 * Permanently destroy the vault and ALL its data.
 * Used by the panic/duress wipe system. Irreversible.
 */
export async function destroyVault(): Promise<void> {
  sessionKey = null;
  if (typeof indexedDB !== "undefined") {
    indexedDB.deleteDatabase(VAULT_DB);
  }
  // Reset the db promise so a new vault can be created
  dbPromise = null;
}
