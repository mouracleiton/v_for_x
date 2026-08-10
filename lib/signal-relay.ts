/**
 * V FOR X — Signal Relay (automated WebRTC signaling)
 *
 * Replaces the copy-paste-only SDP flow in The Web with four
 * fully-static automation channels. No server, no backend:
 *
 *   1. COMPACT TOKENS — an SDP offer/answer is wrapped in a compact
 *      base64url token (VFXSIG1:) that is safe to paste anywhere
 *      (chat, email, USB stick, dead drop).
 *   2. BROADCAST CHANNEL — same-device automation. Two tabs of the
 *      same browser (same origin, same room) exchange SDP tokens
 *      directly with zero user steps.
 *   3. CLIPBOARD WATCH — a user-gesture-triggered poller reads the
 *      system clipboard and auto-consumes any VFXSIG1: token it
 *      finds, so a copied offer/answer is applied automatically.
 *   4. SHARE LINKS — a URL fragment (#vfx-signal=<token>) carries
 *      the token; the page auto-consumes it on load. Works on any
 *      static host, mirror, or USB copy of the platform.
 *
 * Rooms: tokens carry an optional room id. Peers only auto-pair
 * within the same room, which enables multi-peer sessions — any
 * participant can create an offer and the answer auto-applies.
 */

export const SIGNAL_TOKEN_PREFIX = "VFXSIG1:";

export type SignalKind = "offer" | "answer";

export interface SignalPayload {
  kind: SignalKind;
  /** Serialized RTCSessionDescription JSON */
  sdp: string;
  /** Optional room code. Auto-pairing only occurs within a room. */
  room?: string;
  /** Optional initiator handle (display only). */
  from?: string;
  /** Epoch ms when the signal was created. */
  ts: number;
}

/* ═══════════════════════════════════════════════════════════
   ENCODING
   ═══════════════════════════════════════════════════════════ */

function bufToB64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
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

/** Encode a signal payload into a compact shareable token. */
export function encodeSignalToken(payload: Omit<SignalPayload, "ts">): string {
  const full: SignalPayload = { ...payload, ts: Date.now() };
  return SIGNAL_TOKEN_PREFIX + bufToB64url(new TextEncoder().encode(JSON.stringify(full)));
}

/**
 * Decode a signal token. Throws on malformed input (bad prefix,
 * bad base64, bad JSON, or missing required fields).
 */
export function decodeSignalToken(token: string): SignalPayload {
  const raw = (token ?? "").trim();
  if (!raw.startsWith(SIGNAL_TOKEN_PREFIX)) {
    throw new Error("Not a signal token");
  }
  let json: string;
  try {
    json = new TextDecoder().decode(b64urlToBytes(raw.slice(SIGNAL_TOKEN_PREFIX.length)));
  } catch {
    throw new Error("Corrupt signal token (bad base64)");
  }
  let payload: SignalPayload;
  try {
    payload = JSON.parse(json) as SignalPayload;
  } catch {
    throw new Error("Corrupt signal token (bad JSON)");
  }
  if (!payload || typeof payload !== "object") throw new Error("Corrupt signal token");
  if (payload.kind !== "offer" && payload.kind !== "answer") {
    throw new Error(`Unknown signal kind: ${payload.kind}`);
  }
  if (!payload.sdp || typeof payload.sdp !== "string") {
    throw new Error("Signal token missing SDP");
  }
  return payload;
}

/** True if a string starts with the signal token prefix. */
export function looksLikeSignalToken(text: string): boolean {
  return (text ?? "").trim().startsWith(SIGNAL_TOKEN_PREFIX);
}

/* ═══════════════════════════════════════════════════════════
   SHARE LINKS (hash fragments)
   ═══════════════════════════════════════════════════════════ */

export const SIGNAL_HASH_KEY = "vfx-signal";

/**
 * Build a shareable URL that carries the token in its hash.
 * Any copy of the platform (clearnet, IPFS mirror, USB drive)
 * that opens this link auto-consumes the signal on load.
 */
export function buildSignalUrl(token: string, base = ""): string {
  const root = base || (typeof location !== "undefined" ? location.origin + location.pathname : "/the-web");
  return `${root}#${SIGNAL_HASH_KEY}=${encodeURIComponent(token)}`;
}

/** Extract a signal token from a location hash, or null. */
export function parseHashSignal(hash: string): string | null {
  if (!hash) return null;
  const cleaned = hash.startsWith("#") ? hash.slice(1) : hash;
  for (const part of cleaned.split("&")) {
    if (part.startsWith(SIGNAL_HASH_KEY + "=")) {
      const value = decodeURIComponent(part.slice(SIGNAL_HASH_KEY.length + 1));
      if (looksLikeSignalToken(value)) return value;
    }
  }
  return null;
}

/** Remove the signal key from a hash (so a consumed signal is not re-applied). */
export function stripHashSignal(hash: string): string {
  if (!hash) return "";
  const cleaned = hash.startsWith("#") ? hash.slice(1) : hash;
  const rest = cleaned
    .split("&")
    .filter((part) => !part.startsWith(SIGNAL_HASH_KEY + "="))
    .join("&");
  if (!rest) return "";
  try {
    history.replaceState(null, "", `#${rest}`);
  } catch { /* ignore */ }
  return rest;
}

/* ═══════════════════════════════════════════════════════════
   CLIPBOARD WATCH
   ═══════════════════════════════════════════════════════════ */

/**
 * Poll the system clipboard for a signal token.
 *
 * MUST be started from a user gesture (click) because
 * navigator.clipboard.readText() requires permission. Returns an
 * unsubscribe function. onToken fires at most once per token
 * (tokens are deduped by exact text).
 *
 * Falls back gracefully: if the Clipboard API is unavailable or
 * permission is denied, the watcher reports the failure via
 * onError and stops.
 */
export function startClipboardWatch(
  onToken: (token: string) => void,
  onError?: (msg: string) => void,
  signal?: AbortSignal,
  intervalMs = 1500,
): () => void {
  const seen = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    try {
      const nav = navigator as Navigator & { clipboard?: { readText?: () => Promise<string> } };
      if (!nav.clipboard?.readText) {
        onError?.("Clipboard API unavailable");
        stop();
        return;
      }
      const text = await nav.clipboard.readText();
      if (text && looksLikeSignalToken(text) && !seen.has(text)) {
        seen.add(text);
        onToken(text.trim());
      }
    } catch {
      onError?.("Clipboard read blocked");
      stop();
    }
  };

  const stop = () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
  };

  signal?.addEventListener("abort", stop, { once: true });
  void tick();
  timer = setInterval(tick, intervalMs);
  return stop;
}

/* ═══════════════════════════════════════════════════════════
   BROADCAST CHANNEL (same-device auto-pairing)
   ═══════════════════════════════════════════════════════════ */

export const SIGNAL_BC_CHANNEL = "vfx-signal-relay";

export type SignalBusMessage =
  | { type: "signal"; token: string; room?: string }
  | { type: "ping"; room?: string; from?: string };

/**
 * Same-device signal bus. Tabs of the same browser (same origin,
 * same room) exchange SDP tokens with zero user steps.
 * Returns an unsubscribe function.
 */
export function openSignalBus(
  room: string,
  onSignal: (token: string) => void,
): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(SIGNAL_BC_CHANNEL);
  } catch {
    return () => {};
  }
  const handler = (ev: MessageEvent) => {
    const msg = ev.data as SignalBusMessage;
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "signal") {
      if (msg.room && room && msg.room !== room) return;
      onSignal(msg.token);
    }
  };
  channel.addEventListener("message", handler);

  // Let other tabs know we are listening (they can offer on demand).
  try {
    channel.postMessage({ type: "ping", room, from: "" } as SignalBusMessage);
  } catch { /* if another tab is not listening yet, nothing to do */ }

  return () => {
    channel?.removeEventListener("message", handler);
    channel?.close();
    channel = null;
  };
}

/** Push a signal token to other same-device tabs. */
export function broadcastSignal(token: string, room: string): void {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const channel = new BroadcastChannel(SIGNAL_BC_CHANNEL);
    channel.postMessage({ type: "signal", token, room } as SignalBusMessage);
    channel.close();
  } catch { /* ignore */ }
}

/* ═══════════════════════════════════════════════════════════
   ROOM CODES
   ═══════════════════════════════════════════════════════════ */

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Generate a short, human-readable room code (no ambiguous chars). */
export function generateRoomCode(segments = 2, segLength = 4): string {
  let out = "";
  for (let i = 0; i < segments; i++) {
    if (i > 0) out += "-";
    for (let j = 0; j < segLength; j++) {
      out += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
    }
  }
  return out;
}

/** Normalize a room code to upper case, or "" if empty. */
export function normalizeRoom(room: string): string {
  return (room ?? "").trim().toUpperCase();
}

/* ═══════════════════════════════════════════════════════════
   SESSION DESCRIPTIONS (SDP)
   ═══════════════════════════════════════════════════════════ */

/**
 * Strip private/local ICE candidates from an SDP document before
 * sharing it, so connection details stay bounded to the peer.
 * Accepts either a raw SDP string or a serialized
 * RTCSessionDescription JSON envelope ({"type","sdp"}) and returns
 * the same shape. On any failure returns the input unchanged.
 */
export function sanitizeSdpForSharing(sdp: string): string {
  if (!sdp) return sdp;
  try {
    const isEnvelope = /^\s*[{[]/.test(sdp);
    const doc = isEnvelope ? (JSON.parse(sdp) as { sdp?: string }) : null;
    const inner = doc?.sdp ?? sdp;
    const cleaned = inner
      .split("\r\n")
      .filter((line) => !/^a=candidate:/.test(line))
      .join("\r\n");
    if (doc) {
      return JSON.stringify({ ...doc, sdp: cleaned });
    }
    return cleaned;
  } catch {
    return sdp;
  }
}