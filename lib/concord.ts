/**
 * V FOR X — The Concord (Phase 20 — todo-059)
 *
 * A joint statement is powerful because many organizations stand behind it.
 * Concord builds a *cosign tree*: the author drafts a statement, each
 * endorser adds a signature over the statement hash, and the statement
 * only "publishes" once a threshold of distinct cosigners is reached.
 * No central server holds the list; the tree is a self-contained token
 * that ships through Witness / packs / dead-drops like any VFX object.
 *
 *   • draftStatement() — author creates the statement + threshold
 *   • cosign()         — an endorser adds their identity + signature
 *   • isReleased()     — true once distinct cosigners ≥ threshold
 *   • encode/decode    — VFXCNC1 token round-trip
 *
 * Threat model: sybil-soft (one identity = one cosign). Pair with
 * lib/sybil-resistance vouch circles where endorsement weight matters.
 * Fully offline; no accounts, no phone-home.
 */

/* ═══════════════════════════════════════════════════════════════
   Token constants
   ═══════════════════════════════════════════════════════════════ */

export const CONCORD_PREFIX = "VFXCNC1:";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface ConcordStatement {
	/** Stable statement id. */
	id: string;
	/** The statement text. */
	text: string;
	/** SHA-256-style hash of the canonical text (hex). */
	hash: string;
	/** Author identity fingerprint. */
	author: string;
	/** Distinct cosigners required to release. */
	threshold: number;
	/** Cosigners collected so far. */
	cosigners: ConcordCosign[];
	/** Epoch ms drafted. */
	createdAt: number;
	/** Epoch ms released (or null). */
	releasedAt: number | null;
}

export interface ConcordCosign {
	/** Cosigner identity fingerprint. */
	identity: string;
	/** Signature over `${statementId}:${hash}`. */
	signature: string;
	/** Epoch ms cosigned. */
	ts: number;
}

/* ═══════════════════════════════════════════════════════════════
   Lifecycle
   ═══════════════════════════════════════════════════════════════ */

/** Draft a new statement. Never throws. */
export function draftStatement(params: {
	id?: string;
	text: string;
	author: string;
	threshold: number;
	now?: number;
}): ConcordStatement {
	const now = params.now ?? Date.now();
	const text = String(params?.text ?? "");
	const threshold = Math.max(1, Math.floor(Number(params?.threshold) || 1));
	return {
		id: params?.id ?? randomId(),
		text,
		hash: hashHex(text),
		author: String(params?.author ?? "").slice(0, 128),
		threshold,
		cosigners: [],
		createdAt: now,
		releasedAt: null,
	};
}

/**
 * Add a cosigner. Dedupes by identity. A second cosign from the same
 * identity is ignored. Returns a NEW statement. Never throws.
 */
export function cosign(statement: ConcordStatement, cosignInput: ConcordCosign): ConcordStatement {
	if (!statement || !cosignInput?.identity || !cosignInput?.signature) return statement;
	if (statement.cosigners.some((c) => c.identity === cosignInput.identity)) return statement;
	const cleaned: ConcordCosign = {
		identity: String(cosignInput.identity).slice(0, 128),
		signature: String(cosignInput.signature).slice(0, 256),
		ts: Number.isFinite(cosignInput.ts) ? cosignInput.ts : Date.now(),
	};
	const next: ConcordStatement = {
		...statement,
		cosigners: [...statement.cosigners, cleaned],
	};
	if (next.releasedAt === null && next.cosigners.length >= next.threshold) {
		next.releasedAt = cleaned.ts;
	}
	return next;
}

/** True once the distinct-cosigner count reaches the threshold. */
export function isReleased(statement: ConcordStatement): boolean {
	return Boolean(statement && statement.releasedAt !== null && statement.cosigners.length >= statement.threshold);
}

/** Verify a cosign signature against a verifier callback. */
export function verifyCosign(
	statement: ConcordStatement,
	cosign: ConcordCosign,
	verify: (identity: string, msg: string, sig: string) => boolean,
): boolean {
	if (!statement || !cosign?.signature) return false;
	const msg = `${statement.id}:${statement.hash}`;
	try {
		return verify(cosign.identity, msg, cosign.signature) === true;
	} catch {
		return false;
	}
}

/* ═══════════════════════════════════════════════════════════════
   Token encode / decode
   ═══════════════════════════════════════════════════════════════ */

export function encodeConcordToken(statement: ConcordStatement): string {
	return CONCORD_PREFIX + toB64Url(JSON.stringify(statement));
}

export function decodeConcordToken(token: string): ConcordStatement | null {
	if (typeof token !== "string" || !token.startsWith(CONCORD_PREFIX)) return null;
	try {
		const parsed = JSON.parse(fromB64Url(token.slice(CONCORD_PREFIX.length)));
		if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.cosigners)) return null;
		return parsed as ConcordStatement;
	} catch {
		return null;
	}
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function hashHex(s: string): string {
	// Deterministic 64-char hex digest; stable across runtime (FNV-1a based,
	// 4 lanes). Not cryptographic — it only needs to bind text→id.
	const bytes = typeof TextEncoder !== "undefined" ? new TextEncoder().encode(s) : Uint8Array.from(s.split("").map((c) => c.charCodeAt(0)));
	let h = 0x811c9dc5;
	const lanes = [0x811c9dc5, 0x01000193, 0x85ebca6b, 0xc2b2ae35];
	for (let i = 0; i < bytes.length; i++) {
		const b = bytes[i];
		h = Math.imul(h ^ b, 0x01000193) >>> 0;
		lanes[i % 4] = Math.imul(lanes[i % 4] ^ ((b << (i % 7)) | (b >> (8 - (i % 7)))), 0x85ebca77 + i) >>> 0;
	}
	let hex = (h >>> 0).toString(16).padStart(8, "0");
	for (const l of lanes) hex += (l >>> 0).toString(16).padStart(8, "0");
	// pad to 64 chars deterministically
	return (hex + "00000000000000000000000000000000").slice(0, 64);
}

function randomId(): string {
	try {
		if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
	} catch {
		/* noop */
	}
	return "cnc-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function toB64Url(s: string): string {
	const b64 = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, "utf8").toString("base64");
	return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): string {
	const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
	const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
	return typeof atob === "function" ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, "base64").toString("utf8");
}
