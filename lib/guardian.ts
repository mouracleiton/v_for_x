/**
 * V FOR X — The Guardian (People's Dead Man's Switch)
 *
 * Canary is a dead man's switch for data. The Guardian is for people.
 *
 * Scheduled check-ins, trusted-contact escalation, last-known-location
 * (encrypted, client-held), and panic-triggered broadcast. Built for
 * activists, journalists, and organizers whose detention, arrest, or
 * disappearance must automatically surface to a human support network.
 *
 * DESIGN
 *  ─ Encrypted last-known-location never leaves the device. AES-GCM via
 *    Web Crypto, PBKDF2 key derivation. The passphrase is shared with
 *    trusted contacts out-of-band, in advance.
 *  ─ Check-in word model: every check-in requires the passphrase PLUS a
 *    short word. The SAFE word = normal reset. The DURESS word looks
 *    identical to an observer but silently flags immediate escalation.
 *    This is the single most life-safety-critical primitive here.
 *  ─ Escalation ladder: when a check-in is missed, trusted contacts are
 *    notified in sequence at escalating delays (tier 0 = now, tier 1 =
 *    +1h, ...). The ladder is deterministic so a contact can tell exactly
 *    where they are in the response.
 *  ─ Panic broadcast: a one-tap formatted alert containing the decrypted
 *    last-known-location and a pre-written emergency message, ready to
 *    paste into any channel.
 *
 * IMPORTANT: V FOR X has no backend. This is a heuristic client-side
 * timer. It cannot send anything by itself. It PREPARES messages and
 * tracks deadlines so the human in the loop (your trusted contact) can
 * act. Pair this tool with a human who will actually carry the message.
 */

const PBKDF2_ITERATIONS = 150_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

export type GuardianStatus =
  | "armed"
  | "warning"
  | "overdue"
  | "escalated"
  | "panic"
  | "safe";

export interface TrustedContact {
  id: string;
  /** Human label, e.g. "Editor", "Lawyer", "Partner" */
  label: string;
  /** Reach channel, e.g. "Signal +1-...", "protonmail handle" */
  handle: string;
  /** Minutes AFTER the deadline passes before this contact is notified. 0 = first responder. */
  escalateAfterMin: number;
}

export interface GuardianConfig {
  /** Human label for this guardian (e.g., "Maria — Beirut bureau") */
  label: string;
  /** Check-in interval in hours */
  checkInHours: number;
  /** When the guardian was armed (epoch ms) */
  armedAt: number;
  /** Last successful check-in (epoch ms) */
  lastCheckIn: number;
  /** Trusted-contact escalation chain */
  contacts: TrustedContact[];
  /** Pre-written message sent on escalation / panic */
  escalationMessage: string;
  /** Safe word — confirms a normal check-in (resets timer) */
  safeCode: string;
  /** Duress word — looks like a normal check-in but silently escalates */
  duressCode: string;
}

export interface LocationData {
  lat: number;
  lng: number;
  /** Accuracy in meters, if known */
  accuracy?: number;
  /** Freeform note (e.g., "heading to safehouse 3") */
  note?: string;
}

export interface EncryptedLocation {
  /** AES-GCM ciphertext of the JSON-encoded LocationData (base64) */
  ciphertext: string;
  iv: string;
  /** When the fix was captured (epoch ms) */
  capturedAt: number;
}

export interface EscalationEvent {
  contactId: string;
  /** Epoch ms when this contact became due */
  dueAt: number;
}

export interface GuardianRecord {
  id: string;
  config: GuardianConfig;
  /** Encrypted last-known-location (null until captured) */
  location: EncryptedLocation | null;
  /** PBKDF2 salt (base64) */
  salt: string;
  /** PBKDF2 verification hash of the passphrase (base64) */
  verifyHash: string;
  iterations: number;
  status: GuardianStatus;
  /** Epoch ms when panic was triggered, else null */
  panicTriggeredAt: number | null;
  /** Hidden flag set by a duress check-in — appears normal but escalates */
  duressFlag: boolean;
  /** Append-only log of contacts who have become due */
  escalations: EscalationEvent[];
}

export interface GuardianStatusResult {
  status: GuardianStatus;
  /** Epoch ms when the guardian triggers if not checked in */
  deadline: number;
  /** Milliseconds remaining (negative if overdue) */
  msRemaining: number;
  /** Fraction of time elapsed 0..1 (1 = triggered) */
  fractionElapsed: number;
  /** Human-readable status string */
  message: string;
}

export interface EscalationTier {
  contact: TrustedContact;
  dueAt: number;
  /** Has the overdue duration exceeded this contact's tier delay? */
  due: boolean;
}

export interface EscalationState {
  /** Whether the ladder has activated (deadline passed or duress/panic) */
  active: boolean;
  /** ms overdue (0 if not overdue) */
  msOverdue: number;
  /** Sorted ladder of contacts with due flags */
  tiers: EscalationTier[];
  /** Contacts currently due (subset of tiers) */
  dueNow: TrustedContact[];
  /** Highest tier reached (1-based), 0 if none */
  highestTier: number;
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

function hasSubtle(): boolean {
  return typeof globalThis !== "undefined" && !!globalThis.crypto?.subtle;
}

/* ═══════════════════════════════════════════════════════════
   KEY DERIVATION
   ═══════════════════════════════════════════════════════════ */

async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function verifyPassphrase(
  record: GuardianRecord,
  passphrase: string,
): Promise<void> {
  const enc = new TextEncoder();
  const testHash = await crypto.subtle.digest(
    "SHA-256",
    enc.encode(passphrase + record.salt),
  );
  if (bufToB64(testHash) !== record.verifyHash) {
    throw new Error("Wrong passphrase — access denied");
  }
}

/* ═══════════════════════════════════════════════════════════
   CORE: ARM / CHECK-IN
   ═══════════════════════════════════════════════════════════ */

export async function armGuardian(
  passphrase: string,
  config: Omit<GuardianConfig, "armedAt" | "lastCheckIn">,
): Promise<GuardianRecord> {
  if (!hasSubtle()) {
    throw new Error("Web Crypto API unavailable (requires a secure context)");
  }
  if (passphrase.length < 8) {
    throw new Error("Passphrase must be at least 8 characters");
  }
  if (config.checkInHours < 1) {
    throw new Error("Check-in interval must be at least 1 hour");
  }
  if (!config.safeCode || config.safeCode.length < 3) {
    throw new Error("Safe word must be at least 3 characters");
  }
  if (!config.duressCode || config.duressCode.length < 3) {
    throw new Error("Duress word must be at least 3 characters");
  }
  if (config.safeCode === config.duressCode) {
    throw new Error("Safe word and duress word must be different");
  }
  if (config.contacts.length === 0) {
    throw new Error("At least one trusted contact is required");
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const enc = new TextEncoder();
  const verifyHash = await crypto.subtle.digest(
    "SHA-256",
    enc.encode(passphrase + bufToB64(salt)),
  );

  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    config: {
      ...config,
      armedAt: now,
      lastCheckIn: now,
    },
    location: null,
    salt: bufToB64(salt),
    verifyHash: bufToB64(verifyHash),
    iterations: PBKDF2_ITERATIONS,
    status: "armed",
    panicTriggeredAt: null,
    duressFlag: false,
    escalations: [],
  };
}

/** Check-in word identity — never exposed to the caller except via result. */
export type CheckInResult = "safe" | "duress";

/**
 * Check in. Requires the passphrase plus a check-in word.
 *  ─ safe word  → normal reset
 *  ─ duress word → APPEARS to reset (timer moves) but sets duressFlag
 *
 * The returned record looks identical to an observer for both outcomes;
 * only duressFlag differs, and it is not surfaced anywhere visible.
 */
export async function checkIn(
  record: GuardianRecord,
  passphrase: string,
  word: string,
): Promise<{ record: GuardianRecord; result: CheckInResult }> {
  await verifyPassphrase(record, passphrase);

  if (word === record.config.safeCode) {
    return {
      record: {
        ...record,
        status: "armed",
        duressFlag: false,
        config: { ...record.config, lastCheckIn: Date.now() },
      },
      result: "safe",
    };
  }

  if (word === record.config.duressCode) {
    return {
      record: {
        ...record,
        // Visibly "armed" — looks like a healthy reset to any observer.
        status: "armed",
        // Hidden: escalate silently.
        duressFlag: true,
        config: { ...record.config, lastCheckIn: Date.now() },
      },
      result: "duress",
    };
  }

  throw new Error("Check-in word not recognized — access denied");
}

/* ═══════════════════════════════════════════════════════════
   STATUS + ESCALATION
   ═══════════════════════════════════════════════════════════ */

export function evaluateStatus(
  record: GuardianRecord,
  now = Date.now(),
): GuardianStatusResult {
  const intervalMs = record.config.checkInHours * 3_600_000;
  const deadline = record.config.lastCheckIn + intervalMs;
  const msRemaining = deadline - now;
  const fractionElapsed = Math.max(0, Math.min(1, 1 - msRemaining / intervalMs));

  let status: GuardianStatus;
  let message: string;

  if (record.status === "safe") {
    status = "safe";
    message = "Disarmed — guardian stood down.";
  } else if (record.panicTriggeredAt !== null) {
    status = "panic";
    message = "PANIC broadcast triggered. Contacts should act now.";
  } else if (record.duressFlag) {
    status = "escalated";
    message = "Silent escalation active (duress check-in). Contacts should act.";
  } else if (msRemaining <= 0) {
    status = "overdue";
    message = `OVERDUE by ${formatDuration(-msRemaining)}. Escalation ladder active.`;
  } else if (fractionElapsed >= 0.75) {
    status = "warning";
    message = `WARNING: ${formatDuration(msRemaining)} until deadline. Check in now.`;
  } else {
    status = "armed";
    message = `Healthy. ${formatDuration(msRemaining)} until next check-in.`;
  }

  return { status, deadline, msRemaining, fractionElapsed, message };
}

/**
 * Resolve the escalation ladder at the current moment.
 * A contact is "due" once the overdue duration exceeds their tier delay,
 * OR immediately if a duress flag / panic is active.
 */
export function getEscalationState(
  record: GuardianRecord,
  now = Date.now(),
): EscalationState {
  const forced = record.duressFlag || record.panicTriggeredAt !== null;

  const intervalMs = record.config.checkInHours * 3_600_000;
  const deadline = record.config.lastCheckIn + intervalMs;
  const overdue = forced || now >= deadline;
  const active = overdue && record.status !== "safe";

  // Anchor for tier timing:
  //  ─ panic: from the panic instant
  //  ─ duress: from the duress check-in moment (the user signaled danger now)
  //  ─ overdue: from the missed deadline
  const anchor =
    record.panicTriggeredAt !== null
      ? record.panicTriggeredAt
      : record.duressFlag
        ? record.config.lastCheckIn
        : deadline;

  const sorted = [...record.config.contacts].sort(
    (a, b) => a.escalateAfterMin - b.escalateAfterMin,
  );

  const tiers: EscalationTier[] = sorted.map((contact) => {
    const dueAt = anchor + contact.escalateAfterMin * 60_000;
    const due = active && now >= dueAt;
    return { contact, dueAt, due };
  });

  const dueNow = tiers.filter((t) => t.due).map((t) => t.contact);
  const highestTier = dueNow.length;

  return { active, msOverdue: active ? now - anchor : 0, tiers, dueNow, highestTier };
}

/**
 * Return the append-only escalation log, adding any newly-due contacts.
 * Pure: compares against the existing log and returns a new array.
 */
export function updateEscalationLog(
  record: GuardianRecord,
  now = Date.now(),
): EscalationEvent[] {
  const state = getEscalationState(record, now);
  const seen = new Set(record.escalations.map((e) => e.contactId));
  const additions: EscalationEvent[] = state.dueNow
    .filter((c) => !seen.has(c.id))
    .map((c) => ({ contactId: c.id, dueAt: now }));
  return [...record.escalations, ...additions];
}

/* ═══════════════════════════════════════════════════════════
   ENCRYPTED LAST-KNOWN-LOCATION
   ═══════════════════════════════════════════════════════════ */

export async function captureLocation(
  record: GuardianRecord,
  passphrase: string,
  loc: LocationData,
): Promise<GuardianRecord> {
  await verifyPassphrase(record, passphrase);

  const salt = new Uint8Array(b64ToBuf(record.salt));
  const key = await deriveKey(passphrase, salt, record.iterations);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const enc = new TextEncoder();
  const ctBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(JSON.stringify(loc)),
  );

  return {
    ...record,
    location: {
      ciphertext: bufToB64(ctBuf),
      iv: bufToB64(iv),
      capturedAt: Date.now(),
    },
  };
}

export async function decryptLocation(
  record: GuardianRecord,
  passphrase: string,
): Promise<LocationData> {
  if (!record.location) {
    throw new Error("No last-known-location captured");
  }
  await verifyPassphrase(record, passphrase);

  const salt = new Uint8Array(b64ToBuf(record.salt));
  const iv = new Uint8Array(b64ToBuf(record.location.iv));
  const key = await deriveKey(passphrase, salt, record.iterations);

  const ptBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    b64ToBuf(record.location.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(ptBuf)) as LocationData;
}

/* ═══════════════════════════════════════════════════════════
   PANIC + ESCALATION MESSAGING
   ═══════════════════════════════════════════════════════════ */

export function triggerPanic(
  record: GuardianRecord,
  now = Date.now(),
): GuardianRecord {
  return {
    ...record,
    status: "panic",
    panicTriggeredAt: record.panicTriggeredAt ?? now,
  };
}

export function clearPanic(record: GuardianRecord): GuardianRecord {
  return {
    ...record,
    status: "armed",
    panicTriggeredAt: null,
  };
}

export function disarmGuardian(record: GuardianRecord): GuardianRecord {
  return { ...record, status: "safe", panicTriggeredAt: null, duressFlag: false };
}

function fmtTimestamp(ms: number): string {
  try {
    return new Date(ms).toISOString();
  } catch {
    return String(ms);
  }
}

function fmtLocationLine(loc: LocationData): string {
  const acc = loc.accuracy != null ? ` (±${Math.round(loc.accuracy)}m)` : "";
  const note = loc.note ? ` — ${loc.note}` : "";
  return `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}${acc}${note}`;
}

/** Build a ready-to-paste panic broadcast for a single contact channel. */
export function buildPanicBroadcast(
  record: GuardianRecord,
  location: LocationData | null,
  now = Date.now(),
): string {
  const triggered = record.panicTriggeredAt ?? now;
  const lines = [
    "🛡 GUARDIAN PANIC ALERT",
    `Who: ${record.config.label}`,
    `Triggered: ${fmtTimestamp(triggered)}`,
  ];
  if (location) {
    lines.push(`Last known location: ${fmtLocationLine(location)}`);
    lines.push(`Location captured: ${fmtTimestamp(record.location?.capturedAt ?? now)}`);
  } else {
    lines.push("Last known location: (none captured)");
  }
  lines.push("");
  lines.push(record.config.escalationMessage || "(no pre-written message)");
  return lines.join("\n");
}

/** Build an escalation notice for a specific contact on the ladder. */
export function buildEscalationNotice(
  record: GuardianRecord,
  contact: TrustedContact,
  location: LocationData | null,
  now = Date.now(),
): string {
  const intervalMs = record.config.checkInHours * 3_600_000;
  const deadline = record.config.lastCheckIn + intervalMs;
  const overdueMs = Math.max(0, now - deadline);
  const lines = [
    `🛡 GUARDIAN ALERT — ${contact.label}`,
    `${record.config.label} has missed a scheduled check-in.`,
    `Overdue by: ${formatDuration(overdueMs)}`,
    `Deadline was: ${fmtTimestamp(deadline)}`,
  ];
  if (location) {
    lines.push(`Last known location: ${fmtLocationLine(location)}`);
  }
  lines.push("");
  lines.push(record.config.escalationMessage || "(no pre-written message)");
  lines.push("");
  lines.push(
    `If you hold the passphrase, open The Guardian and decrypt their last-known-location. Tier ${contact.escalateAfterMin}min contact.`,
  );
  return lines.join("\n");
}

/* ═══════════════════════════════════════════════════════════
   GUARDIAN TOKEN (share with trusted contacts in advance)
   ═══════════════════════════════════════════════════════════ */

/**
 * A URL-safe token identifying this guardian. Contains the id, a salt
 * prefix, and the label — enough to identify which guardian to act on,
 * but NOT the passphrase (shared separately, out-of-band).
 */
export function generateGuardianToken(record: GuardianRecord): string {
  const payload = JSON.stringify({
    id: record.id,
    salt: record.salt.slice(0, 16),
    label: record.config.label,
  });
  // UTF-8-safe base64url (handles non-ASCII labels like em dashes).
  const bytes = new TextEncoder().encode(payload);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeGuardianToken(token: string): {
  id: string;
  salt: string;
  label: string;
} {
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

/* ═══════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════ */

export function formatDuration(ms: number): string {
  if (ms < 0) return "-" + formatDuration(-ms);
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remH = hours % 24;
    return `${days}d ${remH}h`;
  }
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/** Sort contacts into their escalation order. */
export function sortedContacts(contacts: TrustedContact[]): TrustedContact[] {
  return [...contacts].sort((a, b) => a.escalateAfterMin - b.escalateAfterMin);
}
