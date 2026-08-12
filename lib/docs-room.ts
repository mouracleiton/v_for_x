/**
 * V FOR X — Docs ⇄ Web room binding
 *
 * Phase 12: "Bind CRDT Docs to Web room id — `vfx-docs-room` localStorage
 * when room set (auto-sync when peers meet still open)".
 *
 * This is the storage-layer glue. When the visitor sets a Web room code,
 * it persists here. When Docs opens, it reads the binding so the two
 * surfaces share a stable room id even across reloads.
 *
 * Cross-tab auto-sync over BroadcastChannel is the existing path in
 * app/the-docs/page.tsx — this module does NOT replace it. It only makes
 * the room id itself sticky.
 *
 * Storage key: `vfx-docs-room` (registered in lib/storage-map.ts).
 */

const STORAGE_KEY = "vfx-docs-room";

/** Read the bound room id (or null if unset / unreadable). */
export function getDocsRoom(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { room?: string; ts?: number };
    if (typeof parsed.room !== "string" || parsed.room.length === 0) return null;
    return parsed.room.toUpperCase();
  } catch {
    return null;
  }
}

/** Persist the room id (normalized uppercase) with a timestamp. */
export function setDocsRoom(room: string): void {
  if (typeof localStorage === "undefined") return;
  const trimmed = room.trim().toUpperCase();
  if (!trimmed) {
    clearDocsRoom();
    return;
  }
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ room: trimmed, ts: Date.now() }),
    );
  } catch {
    /* quota / disabled storage — silently drop */
  }
}

/** Clear the binding (used on room reset or panic wipe). */
export function clearDocsRoom(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Cross-tab subscription. Calls cb whenever the room id changes in
 * another tab. Returns an unsubscribe function (no-op if BroadcastChannel
 * is unavailable, e.g. in non-window contexts).
 *
 * Uses the `storage` event rather than a custom BroadcastChannel — this
 * is the standard cross-tab signal and does not require Docs/Web to know
 * about each other's channel names.
 */
export function subscribeDocsRoom(cb: (room: string | null) => void): () => void {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return () => {};
  }
  const handler = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    cb(getDocsRoom());
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
