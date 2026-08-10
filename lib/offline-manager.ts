/**
 * V FOR X — Client-side offline management utilities
 * Coordinates with the service worker (public/sw.js) for caching,
 * country packs, background-sync queueing, and cache statistics.
 *
 * The page and the service worker share one IndexedDB ("vfx-offline")
 * so queued actions and country-pack flags stay in sync across contexts.
 */

import { openDB, type IDBPDatabase } from "idb";

/* Must mirror the constants in public/sw.js */
export const CACHE_NAME = "vfx-v2";
const OFFLINE_DB = "vfx-offline";
const OFFLINE_DB_VERSION = 1;
const QUEUE_STORE = "action-queue";
const COUNTRY_STORE = "country-packs";
const META_STORE = "cache-meta";

const BASE_PATH = process.env.NODE_ENV === "production" ? "/v_for_x" : "";

export interface DownloadProgress {
  total: number;
  completed: number;
  status: string;
}

export interface CountryPackRecord {
  iso3: string;
  name?: string;
  downloadedAt: number;
}

export interface QueuedAction {
  id?: number;
  type: string;
  data: unknown;
  ts: number;
  status?: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB not available on server"));
  }
  if (!dbPromise) {
    dbPromise = openDB(OFFLINE_DB, OFFLINE_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          db.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(COUNTRY_STORE)) {
          db.createObjectStore(COUNTRY_STORE, { keyPath: "iso3" });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "url" });
        }
      },
    });
  }
  return dbPromise;
}

/* ═══════════════════════════════════════════════════════════════
   Connectivity
   ═══════════════════════════════════════════════════════════════ */

/** Returns true when the browser reports an active network connection. */
export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/**
 * Subscribe to online/offline transitions.
 * Returns an unsubscribe function.
 */
export function onConnectivityChange(
  callback: (online: boolean) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const onOnline = () => callback(true);
  const onOffline = () => callback(false);

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
}

/* ═══════════════════════════════════════════════════════════════
   Country packs — pre-cache everything needed for one country offline
   ═══════════════════════════════════════════════════════════════ */

/**
 * Download a "country pack": pre-fetch and cache all resources required
 * to browse a single country dossier while fully offline.
 *
 * Steps:
 *   1. Pre-fetch the country detail page HTML
 *   2. Pre-fetch the shared data files (GeoJSON, backbone)
 *   3. Cache the GeoJSON if relevant
 *   4. Store a flag in IndexedDB marking the country available offline
 */
export async function downloadCountryPack(
  iso3: string,
  onProgress?: (p: DownloadProgress) => void
): Promise<{ success: boolean; cachedItems: number }> {
  const lower = iso3.toLowerCase();
  const targets: string[] = [
    `${BASE_PATH}/sorrow-map/${lower}/`,
    `${BASE_PATH}/data/world_backbone_geo.json`,
    `${BASE_PATH}/`,
  ];

  const total = targets.length;
  let completed = 0;
  let cachedItems = 0;

  // Tell the service worker to cache proactively too (best effort).
  postToSW({ type: "CACHE_COUNTRY_PACK", iso3: iso3.toUpperCase() });

  let cache: Cache | null = null;
  try {
    cache = await caches.open(CACHE_NAME);
  } catch {
    cache = null;
  }

  for (const url of targets) {
    onProgress?.({ total, completed, status: `Fetching ${url}…` });
    try {
      const res = await fetch(url, { cache: "reload" });
      if (res.ok && cache) {
        await cache.put(url, res.clone());
        cachedItems++;
      }
    } catch {
      /* skip failed resource — partial packs are still useful */
    }
    completed++;
    onProgress?.({ total, completed, status: `Cached ${completed}/${total}` });
  }

  // Record the flag so the UI can list offline-ready countries.
  try {
    const db = await getDB();
    await db.put(COUNTRY_STORE, {
      iso3: iso3.toUpperCase(),
      downloadedAt: Date.now(),
    });
  } catch {
    /* IDB unavailable — cache still works, just untracked */
  }

  onProgress?.({ total, completed, status: "Pack ready" });
  return { success: cachedItems > 0, cachedItems };
}

/** List every country currently flagged as available offline. */
export async function getCachedCountries(): Promise<CountryPackRecord[]> {
  try {
    const db = await getDB();
    const all = (await db.getAll(COUNTRY_STORE)) as CountryPackRecord[];
    return all.sort((a, b) => b.downloadedAt - a.downloadedAt);
  } catch {
    return [];
  }
}

/** Remove a single country pack flag (does not evict shared cache assets). */
export async function removeCountryPack(iso3: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(COUNTRY_STORE, iso3.toUpperCase());
  } catch {
    /* ignore */
  }
}

/* ═══════════════════════════════════════════════════════════════
   Cache statistics & management
   ═══════════════════════════════════════════════════════════════ */

/** Aggregate cache size (bytes, estimated from stored metadata) + entry count. */
export async function getCacheStats(): Promise<{ size: number; entries: number }> {
  if (typeof caches === "undefined") return { size: 0, entries: 0 };

  let entries = 0;
  try {
    const keys = await caches.keys();
    for (const name of keys) {
      const cache = await caches.open(name);
      const reqs = await cache.keys();
      entries += reqs.length;
    }
  } catch {
    entries = 0;
  }

  let size = 0;
  try {
    const db = await getDB();
    const meta = (await db.getAll(META_STORE)) as Array<{
      url: string;
      size: number;
      ts: number;
    }>;
    size = meta.reduce((sum, m) => sum + (m.size || 0), 0);
  } catch {
    size = 0;
  }

  return { size, entries };
}

/** Wipe every Cache Storage entry and offline-tracking store. */
export async function clearAllCaches(): Promise<void> {
  if (typeof caches !== "undefined") {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
  try {
    const db = await getDB();
    await db.clear(COUNTRY_STORE);
    await db.clear(META_STORE);
  } catch {
    /* ignore */
  }
  postToSW({ type: "CLEAR_ALL" });
}

/* ═══════════════════════════════════════════════════════════════
   Background-sync queue
   ═══════════════════════════════════════════════════════════════ */

/** Queue an action (dead drops, submissions, etc.) for later replay. */
export function queueAction(action: {
  type: string;
  data: unknown;
}): void {
  const record: QueuedAction = {
    ...action,
    ts: Date.now(),
    status: "queued",
  };
  getDB()
    .then((db) => db.put(QUEUE_STORE, record))
    .catch(() => {});

  // Request a background sync if the API is available.
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => {
        const syncReg = reg as ServiceWorkerRegistration & {
          sync?: { register: (tag: string) => Promise<void> };
        };
        if (syncReg.sync) {
          syncReg.sync.register("vfx-sync").catch(() => {});
        }
      })
      .catch(() => {});
  }
}

/** Read the pending queue (for UI inspection). */
export async function getQueuedActions(): Promise<QueuedAction[]> {
  try {
    const db = await getDB();
    const all = (await db.getAll(QUEUE_STORE)) as QueuedAction[];
    return all.sort((a, b) => a.ts - b.ts);
  } catch {
    return [];
  }
}

/**
 * Process the local action queue.
 *
 * This is a static-export app with no backend server — there is no
 * `/api/sync` endpoint to POST to. Instead, queued actions are drained
 * locally: each is marked as `processed` and removed from the queue.
 * When a real P2P transport (WebRTC gossip, mesh sync, etc.) is wired,
 * this is the single integration point to dispatch queued actions to
 * peers. For now it simply clears the backlog so the queue does not
 * accumulate forever.
 */
export async function processQueue(): Promise<number> {
  let items: QueuedAction[];
  try {
    const db = await getDB();
    items = (await db.getAll(QUEUE_STORE)) as QueuedAction[];
  } catch {
    return 0;
  }

  let processed = 0;
  for (const item of items) {
    if (item.id === undefined) continue;
    try {
      const db = await getDB();
      await db.delete(QUEUE_STORE, item.id);
      processed++;
    } catch {
      // IndexedDB issue — leave the item for next attempt.
    }
  }
  return processed;
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function postToSW(message: unknown): void {
  if (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    navigator.serviceWorker.controller
  ) {
    navigator.serviceWorker.controller.postMessage(message);
  }
}
