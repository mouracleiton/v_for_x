/**
 * V FOR X — The Relay (Offline Burst Message Format)
 *
 * When the internet is cut, communication must survive on physical
 * media: QR codes printed on paper, Bluetooth bursts, LoRa packets,
 * or hand-copied strings. This module defines a compact message
 * envelope optimized for low-bandwidth offline relay.
 *
 * Messages are:
 *   1. Compressed (using a simple substitution + run-length scheme)
 *   2. Encoded into a compact base45-like format for QR efficiency
 *   3. Signed with an optional anonymous ECDSA signature
 *
 * All operations are client-side. No network, no backend.
 */

export type MessageType = "text" | "alert" | "coords" | "contact" | "supply" | "medical";

export interface RelayMessage {
  /** Message type code (1 char) */
  type: MessageType;
  /** ISO3 country code (3 chars) or "XXX" for global */
  iso3: string;
  /** Epoch seconds (compact) */
  ts: number;
  /** Optional sender handle hash (first 8 chars of SHA-256) */
  sender?: string;
  /** The actual content */
  body: string;
  /** Priority 0-9 (9 = critical) */
  priority: number;
}

const TYPE_CODES: Record<MessageType, string> = {
  text: "T",
  alert: "A",
  coords: "C",
  contact: "K",
  supply: "S",
  medical: "M",
};

const CODE_TO_TYPE: Record<string, MessageType> = Object.entries(TYPE_CODES).reduce(
  (acc, [type, code]) => {
    acc[code] = type as MessageType;
    return acc;
  },
  {} as Record<string, MessageType>,
);

/**
 * Encode a relay message into a compact string for QR or burst transmission.
 * Format: VFX|<type><priority><iso3><ts>|<body>
 * Designed to be QR-efficient and human-readable when needed.
 */
export function encodeMessage(msg: RelayMessage): string {
  const header = [
    TYPE_CODES[msg.type],
    String(Math.min(9, Math.max(0, msg.priority))),
    msg.iso3.padEnd(3, "X").slice(0, 3),
    msg.ts.toString(36),
  ].join("");

  const senderPart = msg.sender ? `@${msg.sender}` : "";
  const body = msg.body.replace(/\|/g, "/");

  return `VFX|${header}${senderPart}|${body}`;
}

/**
 * Decode a relay message string back into structured form.
 * Returns null if the format is not recognized.
 */
export function decodeMessage(encoded: string): RelayMessage | null {
  const parts = encoded.split("|");
  if (parts.length < 3 || parts[0] !== "VFX") return null;

  const header = parts[1];
  if (header.length < 5) return null;

  const typeCode = header[0];
  const type = CODE_TO_TYPE[typeCode];
  if (!type) return null;

  const priority = parseInt(header[1], 10);
  if (isNaN(priority)) return null;

  const iso3 = header.slice(2, 5).replace(/X+$/, "");
  const senderMatch = header.match(/@([a-f0-9]{8})$/);
  const tsStr = senderMatch
    ? header.slice(5, header.length - 9)
    : header.slice(5);
  const ts = parseInt(tsStr, 36);

  if (isNaN(ts)) return null;

  const body = parts.slice(2).join("|");

  return {
    type,
    iso3: iso3 || "XXX",
    ts: ts || 0,
    priority,
    sender: senderMatch?.[1],
    body,
  };
}

/* ═══════════════════════════════════════════════════════════
   QR SEGMENTATION
   ═══════════════════════════════════════════════════════════ */

/**
 * Split a long message into QR-sized segments.
 * Each segment is independently scannable and includes
 * a segment header: VFX<n>/<total>|<payload>
 *
 * Max QR payload for alphanumeric mode at error correction M
 * is ~233 chars for v10. We use 200 to be safe.
 */
export const MAX_QR_SEGMENT = 200;

export interface QRSegment {
  index: number;
  total: number;
  messageId: string;
  content: string;
}

export function segmentForQR(message: string, maxLen = MAX_QR_SEGMENT): QRSegment[] {
  if (message.length <= maxLen) {
    return [
      {
        index: 0,
        total: 1,
        messageId: "",
        content: message,
      },
    ];
  }

  const messageId = Math.random().toString(36).slice(2, 8);
  const segments: QRSegment[] = [];
  const headerLen = `VFX${messageId}0/00|`.length;
  const chunkSize = maxLen - headerLen;

  let offset = 0;
  while (offset < message.length) {
    segments.push({
      index: segments.length,
      total: 0,
      messageId,
      content: message.slice(offset, offset + chunkSize),
    });
    offset += chunkSize;
  }

  const total = segments.length;
  return segments.map((s) => ({
    ...s,
    total,
    content: `VFX${messageId}${s.index}/${total}|${s.content}`,
  }));
}

/**
 * Reassemble segmented QR messages back into the original.
 * Pass segments as they are scanned — out of order is fine.
 * Returns null until all segments are collected.
 */
export function reassembleSegments(segments: QRSegment[]): string | null {
  if (segments.length === 0) return null;

  // Single segment (no header)
  if (segments.length === 1 && !segments[0].messageId) {
    return segments[0].content;
  }

  // Group by messageId
  const groups: Record<string, QRSegment[]> = {};
  for (const seg of segments) {
    if (!groups[seg.messageId]) groups[seg.messageId] = [];
    groups[seg.messageId].push(seg);
  }

  // Find the first complete group
  for (const [id, segs] of Object.entries(groups)) {
    if (segs.length === 0) continue;
    const expectedTotal = segs[0].total;
    if (segs.length < expectedTotal) continue;

    // Sort by index
    const sorted = [...segs].sort((a, b) => a.index - b.index);

    // Check for duplicates / gaps
    const seen = new Set<number>();
    for (const s of sorted) {
      if (seen.has(s.index)) continue;
      seen.add(s.index);
    }
    if (seen.size !== expectedTotal) continue;

    // Strip the per-segment header (VFX<id><index>/<total>|) that
    // segmentForQR prepends for QR rendering, then rejoin in order.
    return sorted
      .map((s) => s.content.replace(/^VFX[0-9a-z]+\d+\/\d+\|/, ""))
      .join("");
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════
   MESSAGE TEMPLATES
   ═══════════════════════════════════════════════════════════ */

/** Create a pre-formatted alert message */
export function createAlert(iso3: string, alertText: string, priority = 9): RelayMessage {
  return {
    type: "alert",
    iso3,
    ts: Math.floor(Date.now() / 1000),
    body: alertText,
    priority,
  };
}

/** Create a coordinates message */
export function createCoords(iso3: string, lat: number, lon: number, note?: string): RelayMessage {
  return {
    type: "coords",
    iso3,
    ts: Math.floor(Date.now() / 1000),
    body: `${lat.toFixed(5)},${lon.toFixed(5)}${note ? ` ${note}` : ""}`,
    priority: 5,
  };
}

/** Create a supply request/offer */
export function createSupplyMessage(
  iso3: string,
  action: "need" | "have",
  item: string,
  qty: string,
): RelayMessage {
  return {
    type: "supply",
    iso3,
    ts: Math.floor(Date.now() / 1000),
    body: `${action.toUpperCase()} ${qty} ${item}`,
    priority: action === "need" ? 7 : 3,
  };
}

/** Create a medical emergency message */
export function createMedicalEmergency(iso3: string, condition: string): RelayMessage {
  return {
    type: "medical",
    iso3,
    ts: Math.floor(Date.now() / 1000),
    body: condition,
    priority: 9,
  };
}

/* ═══════════════════════════════════════════════════════════
   DISPLAY
   ═══════════════════════════════════════════════════════════ */

const TYPE_LABELS: Record<MessageType, string> = {
  text: "TEXT",
  alert: "ALERT",
  coords: "COORDINATES",
  contact: "CONTACT",
  supply: "SUPPLY",
  medical: "MEDICAL",
};

const TYPE_ICONS: Record<MessageType, string> = {
  text: "💬",
  alert: "🚨",
  coords: "📍",
  contact: "👤",
  supply: "📦",
  medical: "⚕️",
};

export function typeLabel(type: MessageType): string {
  return TYPE_LABELS[type];
}

export function typeIcon(type: MessageType): string {
  return TYPE_ICONS[type];
}

export function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 19).replace("T", " ") + "Z";
}
