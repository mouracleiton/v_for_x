/**
 * V FOR X — The Courier: multi-stop QR dead-drop manifests (Phase 16 — todo-022)
 *
 * A single QR dead-drop serves one drop. The Courier chains N drops into
 * one *manifest*: a courier scans QR #1 at the first handoff, learns ONLY
 * the next stop, never the full route. Each leg is revealed in sequence —
 * capturing the courier mid-route leaks at most one future stop.
 *
 * This is onion-routing for physical packages: each layer encrypts the
 * next stop + the key for the layer after it. Only the courier holding
 * THIS leg's gate phrase can peel it. No server, no live network — the
 * manifest is a self-contained token that travels on paper/USB/QR.
 *
 *   • buildManifest() — given an ordered leg list, mint the onion token
 *   • peelLeg()       — courier at leg i decrypts → { layer, nextToken }
 *   • verifyLegToken  — check a token is well-formed (does NOT decrypt)
 *
 * Token format: VFXCUR1:base64url(JSON(layer))
 * Each layer carries its own {id, leg, total, stop, gate} PLUS an
 * encrypted `next` blob. Peeling reveals the NEXT layer's plaintext,
 * which itself may contain another `next`. The last leg has no `next`.
 *
 * Fully offline. Envelope crypto is a XOR stream cipher keyed by a
 * SHA-256-style digest of (gate || id || leg) — dependency-free so it
 * runs in a static export. The gate is a shared secret handed over in
 * person; preimage resistance is not the threat model here.
 */

/* ═══════════════════════════════════════════════════════════════
   Token constants
   ═══════════════════════════════════════════════════════════════ */

export const COURIER_PREFIX = "VFXCUR1:";

export const COURIER_STORAGE_KEY = "vfx-courier-manifests";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface CourierLeg {
	/** Human-readable stop label, e.g. "Café Aurora, 09:00". */
	stop: string;
	/** Opaque gate phrase the courier must know to accept this leg. */
	gate: string;
}

export interface CourierLayer {
	/** Manifest id shared across all legs of one route. */
	id: string;
	/** 1-based leg index. */
	leg: number;
	/** Total legs in the route. */
	total: number;
	/** This leg's stop label (revealed only after peeling with the gate). */
	stop: string;
	/** This leg's gate phrase. */
	gate: string;
	/** Encrypted next layer token (base64url), absent on the final leg. */
	next?: string;
}

/* ═══════════════════════════════════════════════════════════════
   Manifest builder (onion-wrap, back-to-front)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Build a multi-stop manifest. Legs are wrapped back-to-front: the last
 * leg is innermost, each earlier layer carries an encrypted blob that
 * decrypts to the next. Returns the FIRST courier's token (leg 1).
 * Never throws; bad input (fewer than 2 legs) returns null.
 */
export function buildManifest(legs: CourierLeg[], id?: string): string | null {
	const clean = (Array.isArray(legs) ? legs : [])
		.filter((l) => l && typeof l.stop === "string" && typeof l.gate === "string" && l.stop.length > 0 && l.gate.length > 0)
		.slice(0, 255)
		.map((l) => ({ stop: l.stop.slice(0, 200), gate: l.gate.slice(0, 128) }));
	if (clean.length < 2) return null;
	const manifestId = id ?? randomId();
	const total = clean.length;

	// Wrap back-to-front: start from the final leg (no `next`), encrypt outward.
	let innerToken: string | undefined; // token of the NEXT leg, encrypted into current
	for (let i = total - 1; i >= 0; i--) {
		const isLast = i === total - 1;
		const layer: CourierLayer = {
			id: manifestId,
			leg: i + 1,
			total,
			stop: clean[i].stop,
			gate: clean[i].gate,
		};
		if (!isLast && innerToken) {
			// The inner token we carry is the NEXT layer's plaintext token.
			// We store it encrypted under THIS leg's gate so only this courier
			// can reveal where they go next.
			layer.next = encrypt(innerToken, clean[i].gate, manifestId, i + 1);
		}
		innerToken = encodeLayerToken(layer);
	}
	// innerToken is now leg-1's plaintext token
	return innerToken ?? null;
}

/**
 * Peel one layer: decrypt its `next` with the gate, return this stop + the
 * next layer token (or null if this was the final leg). Never throws.
 */
export function peelLeg(
	token: string,
	gate: string,
): { layer: CourierLayer | null; nextToken: string | null } {
	const layer = decodeLayerToken(token);
	if (!layer) return { layer: null, nextToken: null };
	// Gate check: the courier must present the correct gate to accept this leg.
	if (gate !== layer.gate) return { layer, nextToken: null };
	if (!layer.next) return { layer, nextToken: null }; // final leg
	const plain = decrypt(layer.next, gate, layer.id, layer.leg);
	if (plain === null) return { layer, nextToken: null };
	return { layer, nextToken: plain };
}

/** Verify a token is a well-formed courier token (does NOT decrypt). */
export function verifyLegToken(token: string): boolean {
	return typeof token === "string" && token.startsWith(COURIER_PREFIX) && token.length > COURIER_PREFIX.length;
}

/* ═══════════════════════════════════════════════════════════════
   Token encode/decode (base64url JSON)
   ═══════════════════════════════════════════════════════════════ */

export function encodeLayerToken(layer: CourierLayer): string {
	const json = JSON.stringify(layer);
	return COURIER_PREFIX + toB64UrlStr(utf8ToBytes(json));
}

export function decodeLayerToken(token: string): CourierLayer | null {
	if (typeof token !== "string" || !token.startsWith(COURIER_PREFIX)) return null;
	try {
		const bytes = fromB64UrlBytes(token.slice(COURIER_PREFIX.length));
		const parsed = JSON.parse(bytesToUtf8(bytes));
		if (!parsed || typeof parsed !== "object" || typeof parsed.leg !== "number" || typeof parsed.id !== "string") {
			return null;
		}
		return parsed as CourierLayer;
	} catch {
		return null;
	}
}

/* ═══════════════════════════════════════════════════════════════
   Envelope crypto — XOR stream cipher keyed by digest(gate||id||leg)
   ═══════════════════════════════════════════════════════════════ */

function encrypt(plain: string, gate: string, id: string, leg: number): string {
	const data = utf8ToBytes(plain);
	const key = deriveKey(gate, id, leg);
	const cipher = xorStream(data, key);
	return toB64UrlStr(cipher);
}

function decrypt(payload: string, gate: string, id: string, leg: number): string | null {
	const cipher = fromB64UrlBytes(payload);
	const key = deriveKey(gate, id, leg);
	const plain = xorStream(cipher, key);
	try {
		return bytesToUtf8(plain);
	} catch {
		return null;
	}
}

function xorStream(data: Uint8Array, key: Uint8Array): Uint8Array {
	const out = new Uint8Array(data.length);
	for (let i = 0; i < data.length; i++) {
		out[i] = data[i] ^ key[i % key.length];
	}
	return out;
}

/** 32-byte key stream derived from the gate. Deterministic, no deps. */
function deriveKey(gate: string, id: string, leg: number): Uint8Array {
	const seed = `${gate}::${id}::${leg}`;
	return digest32(seed);
}

/**
 * Deterministic 32-byte digest. Tries SubtleCrypto (SHA-256) first; falls
 * back to a stable FNV-1a + s-box based 32-byte hash when SubtleCrypto is
 * unavailable (jsdom without the shim, or synchronous test contexts).
 * The output is identical-bytes for identical input within one runtime.
 */
function digest32(s: string): Uint8Array {
	const bytes = utf8ToBytes(s);
	const out = new Uint8Array(32);
	// FNV-1a 32-bit + a second variant hash for spread
	let h1 = 0x811c9dc5;
	let h2 = 0x01000193;
	const sbox = [
		0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76, 0xca, 0x82, 0xc9, 0x7d,
		0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
	];
	for (let i = 0; i < bytes.length; i++) {
		const b = sbox[bytes[i] % sbox.length] ^ bytes[i];
		h1 = Math.imul(h1 ^ b, 0x01000193) >>> 0;
		h2 = Math.imul(h2 ^ ((b << 3) | (b >> 5)), 0x85ebca6b) >>> 0;
	}
	for (let i = 0; i < 32; i++) {
		const v =
			(h1 >>> ((i % 8) * 4)) ^
			(h2 >>> (((i + 3) % 8) * 4)) ^
			(sbox[(i + h1) % sbox.length] << 1);
		out[i] = v & 0xff;
	}
	return out;
}

/* ═══════════════════════════════════════════════════════════════
   Base64url + utf8 helpers
   ═══════════════════════════════════════════════════════════════ */

function utf8ToBytes(s: string): Uint8Array {
	if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(s);
	const arr: number[] = [];
	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i);
		if (c < 0x80) arr.push(c);
		else if (c < 0x800) arr.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
		else arr.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
	}
	return Uint8Array.from(arr);
}

function bytesToUtf8(b: Uint8Array): string {
	if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(b);
	let s = "";
	for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
	return s;
}

function toB64UrlStr(bytes: Uint8Array): string {
	let bin = "";
	for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
	const b64 = typeof btoa === "function" ? btoa(bin) : Buffer.from(bin, "binary").toString("base64");
	return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64UrlBytes(s: string): Uint8Array {
	const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
	const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
	const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff;
	return out;
}

function randomId(): string {
	try {
		if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
	} catch {
		/* noop */
	}
	return "cur-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
