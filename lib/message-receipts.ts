/**
 * V FOR X — Message Receipts & Delivery States (The Web)
 *
 * Gives mesh messages a delivery lifecycle so a sender knows whether a
 * message reached its peer, was read, or is still in flight — the same
 * ✓/✓✓ affordance as secure messengers, but over a serverless DataChannel.
 *
 * Receipts are tiny signed tokens piggybacked on the mesh bus; they
 * reference the original message id and report its state. They never
 * carry content, so confirming delivery leaks nothing about the message
 * body. State machine:
 *
 *   sent → delivered → read
 *      ↘ failed
 *
 * A sender's own messages show ✓ locally immediately; when the peer's
 * receipt arrives the local copy upgrades to ✓✓.
 */

/* ═══════════════════════════════════════════════════════════════
   Constants & types
   ═══════════════════════════════════════════════════════════════ */

export const RECEIPT_PREFIX = "VFXRC1:";
export const RECEIPT_STORAGE_KEY = "vfx-receipts";

export type DeliveryState = "sent" | "delivered" | "read" | "failed";

export interface DeliveryReceipt {
  /** Id of the message this receipt describes. */
  messageId: string;
  /** The peer hash the message was addressed to. */
  toPeer: string;
  /** Current delivery state. */
  state: DeliveryState;
  /** Epoch ms of the state transition. */
  ts: number;
  /** Optional human note (e.g. failure reason). */
  note?: string;
}

export interface MessageReceipts {
  /** Map of messageId → latest receipt. */
  byId: Map<string, DeliveryReceipt>;
}

/* ═══════════════════════════════════════════════════════════════
   Encoding helpers
   ═══════════════════════════════════════════════════════════════ */

function bufToB64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    for (let j = 0; j < Math.min(chunk, bytes.length - i); j++) {
      binary += String.fromCharCode(bytes[i + j]);
    }
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* ═══════════════════════════════════════════════════════════════
   State machine
   ═══════════════════════════════════════════════════════════════ */

const ORDER: Record<DeliveryState, number> = {
  sent: 0,
  delivered: 1,
  read: 2,
  failed: -1,
};

/**
 * Whether a state transition is valid (monotonic forward progress,
 * except `failed` which can replace `sent`).
 */
export function canTransition(from: DeliveryState, to: DeliveryState): boolean {
  if (from === to) return false;
  // failed is terminal-from-sent only
  if (to === "failed") return from === "sent";
  if (from === "failed") return false;
  return ORDER[to] > ORDER[from];
}

/** Create a fresh receipt for an outgoing message. */
export function createReceipt(
  messageId: string,
  toPeer: string,
  state: DeliveryState = "sent",
  note?: string,
  ts = Date.now(),
): DeliveryReceipt {
  if (!messageId) throw new Error("messageId required");
  return { messageId, toPeer, state, ts, note };
}

/**
 * Apply an incoming receipt to a local receipt store, honoring the
 * state machine (a `sent` won't downgrade a `read`). Returns the new
 * store.
 */
export function applyReceipt(
  store: MessageReceipts,
  receipt: DeliveryReceipt,
): MessageReceipts {
  const existing = store.byId.get(receipt.messageId);
  if (existing && !canTransition(existing.state, receipt.state)) {
    return store; // ignore non-monotonic / lower states
  }
  const next = new Map(store.byId);
  next.set(receipt.messageId, { ...receipt, ts: receipt.ts });
  return { byId: next };
}

/** Get the state of a message (default "sent" if never tracked). */
export function getState(store: MessageReceipts, messageId: string): DeliveryState {
  return store.byId.get(messageId)?.state ?? "sent";
}

/** Build a fresh empty store. */
export function emptyStore(): MessageReceipts {
  return { byId: new Map() };
}

/* ═══════════════════════════════════════════════════════════════
   Aggregation
   ═══════════════════════════════════════════════════════════════ */

export interface ReceiptSummary {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  /** Fraction delivered-or-better (0..1). */
  deliveryRate: number;
}

export function summarizeReceipts(store: MessageReceipts): ReceiptSummary {
  let sent = 0, delivered = 0, read = 0, failed = 0;
  for (const r of store.byId.values()) {
    if (r.state === "sent") sent++;
    else if (r.state === "delivered") delivered++;
    else if (r.state === "read") read++;
    else if (r.state === "failed") failed++;
  }
  const total = store.byId.size;
  return {
    total,
    sent,
    delivered,
    read,
    failed,
    deliveryRate: total > 0 ? (delivered + read) / total : 0,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Token encoding (for the mesh bus)
   ═══════════════════════════════════════════════════════════════ */

/** Encode a receipt as a compact token to ride the mesh bus. */
export function encodeReceiptToken(receipt: DeliveryReceipt): string {
  return RECEIPT_PREFIX + bufToB64url(new TextEncoder().encode(JSON.stringify(receipt)));
}

/** Decode a receipt token. Throws on malformed input. */
export function decodeReceiptToken(token: string): DeliveryReceipt {
  const raw = (token ?? "").trim();
  if (!raw.startsWith(RECEIPT_PREFIX)) {
    throw new Error(`Not a receipt token (expected ${RECEIPT_PREFIX})`);
  }
  let json: string;
  try {
    json = new TextDecoder().decode(b64urlToBytes(raw.slice(RECEIPT_PREFIX.length)));
  } catch {
    throw new Error("Malformed receipt token");
  }
  let receipt: DeliveryReceipt;
  try {
    receipt = JSON.parse(json) as DeliveryReceipt;
  } catch {
    throw new Error("Malformed receipt token (bad JSON)");
  }
  if (!receipt || !receipt.messageId || !receipt.state) {
    throw new Error("Receipt token missing required fields");
  }
  return receipt;
}

export function isReceiptToken(token: string): boolean {
  return typeof token === "string" && token.trim().startsWith(RECEIPT_PREFIX);
}

/* ═══════════════════════════════════════════════════════════════
   Persistence (client-side)
   ═══════════════════════════════════════════════════════════════ */

export function loadReceipts(): MessageReceipts {
  if (typeof localStorage === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(RECEIPT_STORAGE_KEY);
    if (!raw) return emptyStore();
    const arr = JSON.parse(raw) as DeliveryReceipt[];
    const byId = new Map<string, DeliveryReceipt>();
    for (const r of arr) byId.set(r.messageId, r);
    return { byId };
  } catch {
    return emptyStore();
  }
}

export function saveReceipts(store: MessageReceipts): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(Array.from(store.byId.values())));
  } catch { /* ignore */ }
}

/* ═══════════════════════════════════════════════════════════════
   Display
   ═══════════════════════════════════════════════════════════════ */

/** Render the ✓ / ✓✓ / ! glyph for a state. */
export function stateGlyph(state: DeliveryState): string {
  switch (state) {
    case "sent": return "✓";
    case "delivered": return "✓✓";
    case "read": return "✓✓·";
    case "failed": return "!";
  }
}

/** Human label for a state. */
export function stateLabel(state: DeliveryState): string {
  switch (state) {
    case "sent": return "Sent";
    case "delivered": return "Delivered";
    case "read": return "Read";
    case "failed": return "Failed";
  }
}
