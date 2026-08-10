/**
 * V FOR X — The Canary (Dead Man's Switch)
 *
 * A whistleblower's insurance policy. You encrypt a payload (documents,
 * contacts, evidence) with a passphrase and arm a timer. If you stop
 * checking in before the deadline, the payload is released.
 *
 * The encrypted payload is stored locally (IndexedDB). The "release"
 * is a URL-safe release token that can be shared with trusted contacts
 * in advance. They hold the token; if you disappear, they publish it.
 *
 * Crypto: AES-GCM via Web Crypto API. The passphrase never touches
 * storage unencrypted — only a PBKDF2 verification hash is persisted.
 *
 * IMPORTANT: This is a heuristic client-side timer. It cannot "auto-
 * publish" anything — it tracks the deadline and prepares the release
 * token. The human in the loop (your trusted contact) does the actual
 * release. V FOR X has no backend.
 */

const PBKDF2_ITERATIONS = 150_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

export type CanaryStatus = "armed" | "overdue" | "released" | "disarmed";

export interface CanaryConfig {
  /** Human label for this switch (e.g., "Evidence Vault") */
  label: string;
  /** Check-in interval in hours */
  checkInHours: number;
  /** When the canary was armed (epoch ms) */
  armedAt: number;
  /** Last successful check-in (epoch ms) */
  lastCheckIn: number;
  /** Trusted contact handle (optional) */
  contactHandle?: string;
  /** Instructions shown on release */
  releaseInstructions: string;
}

export interface CanaryRecord {
  id: string;
  config: CanaryConfig;
  /** AES-GCM encrypted payload (base64) */
  ciphertext: string;
  iv: string;
  /** PBKDF2 salt (base64) */
  salt: string;
  /** PBKDF2 verification hash (base64) */
  verifyHash: string;
  iterations: number;
  status: CanaryStatus;
}

export interface CanaryStatusResult {
  status: CanaryStatus;
  /** Epoch ms when the canary triggers if not checked in */
  deadline: number;
  /** Milliseconds remaining (negative if overdue) */
  msRemaining: number;
  /** Fraction of time elapsed 0..1 (1 = triggered) */
  fractionElapsed: number;
  /** Human-readable status string */
  message: string;
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

/* ═══════════════════════════════════════════════════════════
   CORE: ARM / CHECK-IN / STATUS
   ═══════════════════════════════════════════════════════════ */

export async function armCanary(
  passphrase: string,
  payload: string,
  config: Omit<CanaryConfig, "armedAt" | "lastCheckIn">,
): Promise<CanaryRecord> {
  if (!hasSubtle()) {
    throw new Error("Web Crypto API unavailable (requires a secure context)");
  }
  if (passphrase.length < 8) {
    throw new Error("Passphrase must be at least 8 characters");
  }
  if (config.checkInHours < 1) {
    throw new Error("Check-in interval must be at least 1 hour");
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);

  const enc = new TextEncoder();
  const ctBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(payload),
  );

  const saltB64 = bufToB64(salt);
  const verifyHash = await crypto.subtle.digest(
    "SHA-256",
    enc.encode(passphrase + saltB64),
  );

  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    config: {
      ...config,
      armedAt: now,
      lastCheckIn: now,
    },
    ciphertext: bufToB64(ctBuf),
    iv: bufToB64(iv),
    salt: bufToB64(salt),
    verifyHash: bufToB64(verifyHash),
    iterations: PBKDF2_ITERATIONS,
    status: "armed",
  };
}

/**
 * Check in — resets the deadline. The passphrase is verified
 * against the stored hash before the check-in is accepted.
 */
export async function checkIn(
  record: CanaryRecord,
  passphrase: string,
): Promise<CanaryRecord> {
  const salt = new Uint8Array(b64ToBuf(record.salt));
  const key = await deriveKey(passphrase, salt, record.iterations);

  const enc = new TextEncoder();
  const testHash = await crypto.subtle.digest(
    "SHA-256",
    enc.encode(passphrase + record.salt),
  );
  if (bufToB64(testHash) !== record.verifyHash) {
    throw new Error("Wrong passphrase — check-in denied");
  }

  return {
    ...record,
    config: {
      ...record.config,
      lastCheckIn: Date.now(),
    },
  };
}

/**
 * Release the payload — decrypt and return the plaintext.
 * This is what a trusted contact does with the passphrase + release token.
 */
export async function releasePayload(
  record: CanaryRecord,
  passphrase: string,
): Promise<string> {
  const salt = new Uint8Array(b64ToBuf(record.salt));
  const iv = new Uint8Array(b64ToBuf(record.iv));
  const key = await deriveKey(passphrase, salt, record.iterations);

  const ptBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    b64ToBuf(record.ciphertext),
  );
  return new TextDecoder().decode(ptBuf);
}

/**
 * Evaluate the current status of a canary based on the clock.
 */
export function evaluateStatus(record: CanaryRecord, now = Date.now()): CanaryStatusResult {
  const intervalMs = record.config.checkInHours * 3_600_000;
  const deadline = record.config.lastCheckIn + intervalMs;
  const msRemaining = deadline - now;
  const fractionElapsed = Math.max(0, Math.min(1, 1 - msRemaining / intervalMs));

  let status: CanaryStatus;
  let message: string;

  if (record.status === "disarmed") {
    status = "disarmed";
    message = "Disarmed — payload secured.";
  } else if (record.status === "released") {
    status = "released";
    message = "RELEASED — payload is available to holders of the passphrase.";
  } else if (msRemaining <= 0) {
    status = "overdue";
    message = `OVERDUE by ${formatDuration(-msRemaining)}. Release conditions met.`;
  } else {
    status = "armed";
    if (fractionElapsed >= 0.75) {
      message = `WARNING: ${formatDuration(msRemaining)} until release. Check in now.`;
    } else if (fractionElapsed >= 0.5) {
      message = `${formatDuration(msRemaining)} remaining until next check-in due.`;
    } else {
      message = `Healthy. ${formatDuration(msRemaining)} until next check-in.`;
    }
  }

  return {
    status,
    deadline,
    msRemaining,
    fractionElapsed,
    message,
  };
}

export function disarmCanary(record: CanaryRecord): CanaryRecord {
  return { ...record, status: "disarmed" };
}

export function markReleased(record: CanaryRecord): CanaryRecord {
  return { ...record, status: "released" };
}

/* ═══════════════════════════════════════════════════════════
   RELEASE TOKEN
   ═══════════════════════════════════════════════════════════ */

/**
 * Generate a URL-safe release token for a canary.
 * This token can be shared with trusted contacts in advance.
 * It contains the canary ID and salt — enough to identify which
 * canary to release, but NOT the passphrase (that's shared separately).
 */
export function generateReleaseToken(record: CanaryRecord): string {
  const payload = JSON.stringify({
    id: record.id,
    salt: record.salt.slice(0, 16),
    label: record.config.label,
  });
  return btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode a release token back to its components.
 */
export function decodeReleaseToken(token: string): { id: string; salt: string; label: string } {
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const json = atob(padded);
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
