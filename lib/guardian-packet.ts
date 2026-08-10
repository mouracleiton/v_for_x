/**
 * V FOR X — Guardian Release Packets (dead-man's-switch delivery)
 *
 * The Guardian tracks check-ins and escalations entirely on-device.
 * A RELEASE PACKET is the delivery primitive: a compact, ECDSA-signed
 * document that a trusted contact can verify and act on even though
 * there is no server and the operator's device may be offline forever.
 *
 * Pipeline (fully static):
 *
 *   1. At arm time the operator generates a one-time ECDSA P-256
 *      signing key. The PUBLIC key rides in the Guardian token that
 *      is shared with trusted contacts out-of-band, in advance.
 *   2. When the ladder activates (overdue / duress / panic), the
 *      operator's device signs a RELEASE PACKET containing the full
 *      escalation state, the panic broadcast, and the encrypted
 *      last-known-location blob (AES-GCM, still only readable with
 *      the passphrase).
 *   3. The packet is emitted as a compact token (VFXGP1:) that can be
 *      dropped anywhere: dead drop, The Web P2P channel, a mirror
 *      page link (#packet=<token>), a USB stick, a QR code.
 *   4. The contact pastes the token into the Guardian RELAY INBOX.
 *      Authenticity is verified against the key carried by the
 *      Guardian token they already hold. If they also hold the
 *      passphrase, the location decrypts locally.
 *
 * Mirror integration: a release packet can be placed on any copy of
 * the platform (or on an IPFS-pinned mirror) via its hash fragment,
 * so the static page itself becomes the delivery channel.
 */

import {
  type GuardianRecord,
  type LocationData,
  buildPanicBroadcast,
  buildEscalationNotice,
  evaluateStatus,
  getEscalationState,
  sortedContacts,
} from "@/lib/guardian";

export const GUARDIAN_PACKET_PREFIX = "VFXGP1:";

export interface GuardianSigningKey {
  publicKey: string;
  privateKey: string;
}

export interface ReleasePacket {
  format: "vfx-guardian-release-1";
  /** Echo of the Guardian token content (id, label) for identification. */
  id: string;
  label: string;
  status: GuardianRecord["status"];
  duressFlag: boolean;
  /** Epoch ms when the packet was signed. */
  ts: number;
  /** Epoch ms of the missed deadline, if armed/overdue. */
  deadline: number | null;
  /** Escalated contacts (labels) at signing time. */
  escalations: { label: string; handle: string; dueAt: number }[];
  /** Pre-written escalation message / panic broadcast text. */
  message: string;
  /** Encrypted last-known-location, untouched from the record. */
  location: GuardianRecord["location"];
  /** PBKDF2 salt (base64) — needed by a passphrase-holding contact to decrypt. */
  salt: string;
  /** PBKDF2 iterations used when the location was encrypted. */
  iterations: number;
  /** Signer public key (base64 SPKI) — must match the Guardian token. */
  signerPublicKey: string;
  /** ECDSA signature (base64) over the canonical content. */
  signature: string;
  /** SHA-256 hex of the canonical content that was signed. */
  contentHash: string;
}

/* ═══════════════════════════════════════════════════════════
   ENCODING HELPERS
   ═══════════════════════════════════════════════════════════ */

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufToB64url(buf: ArrayBuffer | Uint8Array): string {
  return bufToB64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBuf(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  return b64ToBuf(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
}

function hexFromBuf(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hasSubtle(): boolean {
  return typeof globalThis !== "undefined" && !!globalThis.crypto?.subtle;
}

/* ═══════════════════════════════════════════════════════════
   SIGNING KEY
   ═══════════════════════════════════════════════════════════ */

/** Generate the one-time ECDSA P-256 signing key for a guardian. */
export async function createGuardianSigningKey(): Promise<GuardianSigningKey> {
  if (!hasSubtle()) {
    throw new Error("Web Crypto API unavailable (requires a secure context)");
  }
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const pub = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const priv = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  return { publicKey: bufToB64(pub), privateKey: bufToB64(priv) };
}

/* ═══════════════════════════════════════════════════════════
   PACKET BUILDING
   ═══════════════════════════════════════════════════════════ */

/**
 * The deterministic JSON that is hashed and signed.
 * MUST stay in sync with verifyReleasePacket — the order is canonical.
 */
export function canonicalPacketContent(packet: {
  id: string;
  label: string;
  status: string;
  duressFlag: boolean;
  ts: number;
  deadline: number | null;
  escalations: ReleasePacket["escalations"];
  message: string;
}): string {
  return JSON.stringify({
    id: packet.id,
    label: packet.label,
    status: packet.status,
    duressFlag: packet.duressFlag,
    ts: packet.ts,
    deadline: packet.deadline,
    escalations: packet.escalations,
    message: packet.message,
  });
}

/**
 * Build a signed release packet from the live guardian record.
 * `location` is the DECRYPTED location (for the human-readable
 * message) — it is NOT embedded in plaintext; only the record's
 * encrypted blob rides along, so confidentiality is unchanged.
 */
export async function buildReleasePacket(
  record: GuardianRecord,
  signingKey: GuardianSigningKey,
  location: LocationData | null,
  now = Date.now(),
): Promise<ReleasePacket> {
  if (!hasSubtle()) {
    throw new Error("Web Crypto API unavailable (requires a secure context)");
  }
  const state = getEscalationState(record, now);
  const sorted = sortedContacts(record.config.contacts);
  const effective = evaluateStatus(record, now);

  const escalations = state.tiers
    .filter((t) => t.due)
    .map((t) => ({
      label: t.contact.label,
      handle: t.contact.handle,
      dueAt: t.dueAt,
    }));

  const message =
    effective.status === "panic"
      ? buildPanicBroadcast(record, location, now)
      : sorted
          .map((c) => buildEscalationNotice(record, c, location, now))
          .join("\n\n---\n\n");

  const partial = {
    id: record.id,
    label: record.config.label,
    status: effective.status,
    duressFlag: record.duressFlag,
    ts: now,
    deadline:
      record.status === "safe" || effective.status === "safe"
        ? null
        : record.config.lastCheckIn + record.config.checkInHours * 3_600_000,
    escalations,
    message,
  };

  const content = canonicalPacketContent(partial);
  const contentBytes = new TextEncoder().encode(content);
  const contentHash = hexFromBuf(await crypto.subtle.digest("SHA-256", contentBytes));

  const privKey = await crypto.subtle.importKey(
    "pkcs8",
    b64ToBuf(signingKey.privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privKey,
    contentBytes,
  );

  return {
    format: "vfx-guardian-release-1",
    ...partial,
    location: record.location,
    salt: record.salt,
    iterations: record.iterations || 150_000,
    signerPublicKey: signingKey.publicKey,
    signature: bufToB64(sigBuf),
    contentHash,
  };
}

/**
 * Decrypt a packet's last-known-location with the passphrase shared
 * out-of-band with trusted contacts. Throws on wrong passphrase,
 * missing location, or corrupted ciphertext.
 */
export async function decryptPacketLocation(
  packet: ReleasePacket,
  passphrase: string,
): Promise<LocationData> {
  if (!hasSubtle()) throw new Error("Web Crypto API unavailable");
  if (!packet.location) throw new Error("No last-known-location captured in this packet");
  if (passphrase.length < 8) throw new Error("Passphrase must be at least 8 characters");

  const salt = new Uint8Array(b64ToBuf(packet.salt));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: packet.iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const iv = new Uint8Array(b64ToBuf(packet.location.iv));
  const ptBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    b64ToBuf(packet.location.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(ptBuf)) as LocationData;
}

/**
 * Verify a release packet's signature AND that its signer matches a
 * specific Guardian token public key. Pass `expectedPublicKey` (the
 * key from a decodeGuardianToken peer's key) to bind the packet to
 * the guardian the contact knows. Returns false on any failure.
 */
export async function verifyReleasePacket(
  packet: ReleasePacket,
  expectedPublicKey?: string,
): Promise<boolean> {
  if (!hasSubtle()) return false;
  if (!packet || typeof packet !== "object") return false;
  if (packet.format !== "vfx-guardian-release-1") return false;
  if (!packet.signature || !packet.signerPublicKey || !packet.contentHash) return false;
  if (expectedPublicKey && packet.signerPublicKey !== expectedPublicKey) return false;

  try {
    const pubKey = await crypto.subtle.importKey(
      "spki",
      b64ToBuf(packet.signerPublicKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const content = canonicalPacketContent(packet);
    const contentBytes = new TextEncoder().encode(content);
    const recomputed = hexFromBuf(await crypto.subtle.digest("SHA-256", contentBytes));
    if (recomputed !== packet.contentHash) return false;
    return crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pubKey,
      b64ToBuf(packet.signature),
      contentBytes,
    );
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════
   TOKEN ENCODING
   ═══════════════════════════════════════════════════════════ */

/** Encode a release packet as a compact, shareable token. */
export function encodeReleasePacket(packet: ReleasePacket): string {
  return GUARDIAN_PACKET_PREFIX + bufToB64url(new TextEncoder().encode(JSON.stringify(packet)));
}

/** Decode a release token into a packet. Throws on malformed input. */
export function decodeReleasePacket(token: string): ReleasePacket {
  const raw = (token ?? "").trim();
  if (!raw.startsWith(GUARDIAN_PACKET_PREFIX)) {
    throw new Error("Not a guardian release token");
  }
  let json: string;
  try {
    json = new TextDecoder().decode(b64urlToBuf(raw.slice(GUARDIAN_PACKET_PREFIX.length)));
  } catch {
    throw new Error("Corrupt release token (bad base64)");
  }
  let packet: ReleasePacket;
  try {
    packet = JSON.parse(json) as ReleasePacket;
  } catch {
    throw new Error("Corrupt release token (bad JSON)");
  }
  if (!packet || typeof packet !== "object") throw new Error("Corrupt release token");
  if (packet.format !== "vfx-guardian-release-1") {
    throw new Error("Unknown release format");
  }
  if (!packet.id || !packet.label || !packet.signature || !packet.signerPublicKey) {
    throw new Error("Release token missing required fields");
  }
  return packet;
}

/** Build a static-host share link that delivers this packet (#packet=<token>). */
export function buildPacketUrl(
  token: string,
  base = typeof location !== "undefined" ? location.origin + location.pathname : "/the-guardian",
): string {
  return `${base}#packet=${encodeURIComponent(token)}`;
}

/** Extract a release token from a location hash, or null. */
export function parseHashPacket(hash: string): string | null {
  if (!hash) return null;
  const cleaned = hash.startsWith("#") ? hash.slice(1) : hash;
  for (const part of cleaned.split("&")) {
    if (part.startsWith("packet=")) {
      const value = decodeURIComponent(part.slice("packet=".length));
      if (value.startsWith(GUARDIAN_PACKET_PREFIX)) return value;
    }
  }
  return null;
}

/** Short human-readable fingerprint of a packet (first 12 hex of contentHash). */
export function packetFingerprint(packet: ReleasePacket): string {
  return (packet.contentHash ?? "").slice(0, 12);
}