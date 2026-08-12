/**
 * V FOR X — The Inheritance (Phase 20 — todo-057)
 *
 * A crypto identity is a single point of failure: lose the device (or
 * the person) and every signed claim, every dossier, every dead-drop
 * key is gone. Inheritance wraps the Vault/identity secret in Shamir
 * Secret Sharing so a Guardian set — trusted people, not a company —
 * can reconstruct access if the holder is arrested, hospitalized, or
 * killed. Any K of N Guardians meeting in person can recover; fewer
 * than K learn nothing.
 *
 * This lib reuses the GF(256) Shamir primitive from lib/convoy.ts
 * (the same math, different threat model) and adds:
 *   • splitForGuardians() — shard a secret for a named Guardian set
 *   • recoverFromGuardians() — rebuild from K collected shards
 *   • Guardian manifest bookkeeping (who holds shard i, not the shard)
 *
 * Token: VFXINH1:base64url(JSON(manifest)). The MANIFEST carries
 * guardian names + the scheme metadata; the SHARDS themselves travel
 * out-of-band (paper, in person) and are never serialized together.
 *
 * Fully offline. No KDF, no server. The secret must already be random
 * (e.g. an identity seed); don't feed this a human password directly.
 */

import { splitSecret, combineShares, type ConvoyShare } from "./convoy";

/* ═══════════════════════════════════════════════════════════════
   Token constants
   ═══════════════════════════════════════════════════════════════ */

export const INHERITANCE_PREFIX = "VFXINH1:";

export const INHERITANCE_STORAGE_KEY = "vfx-inheritance-manifest";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface GuardianAssignment {
	/** 1-based shard index this guardian holds. */
	shardIndex: number;
	/** Guardian display name (for the holder's own records). */
	name: string;
	/** True once the guardian confirms they received their shard. */
	acknowledged: boolean;
}

export interface InheritanceManifest {
	/** Scheme id shared by all shards of one secret. */
	id: string;
	/** Purpose label (e.g. "primary-identity-seed"). */
	purpose: string;
	/** Total guardians (N). */
	n: number;
	/** Threshold required to recover (K). */
	k: number;
	/** Guardian assignments (bookkeeping only — no secret material). */
	guardians: GuardianAssignment[];
	/** Epoch ms the scheme was created. */
	createdAt: number;
}

export interface GuardianShard {
	/** The Shamir share (x, y) — handed to one guardian. */
	share: ConvoyShare;
	/** Manifest id this shard belongs to. */
	manifestId: string;
}

/* ═══════════════════════════════════════════════════════════════
   Split / recover
   ═══════════════════════════════════════════════════════════════ */

/**
 * Shard a secret among N named guardians, K required to recover.
 * Returns the manifest (bookkeeping) + one shard per guardian.
 * Never throws; bad input returns null.
 */
export function splitForGuardians(params: {
	secret: Uint8Array;
	guardians: string[];
	threshold: number;
	purpose?: string;
	now?: number;
}): { manifest: InheritanceManifest; shards: GuardianShard[] } | null {
	const secret = params?.secret;
	const names = Array.isArray(params?.guardians) ? params.guardians.filter((g) => typeof g === "string" && g.length > 0) : [];
	const k = Math.floor(Number(params?.threshold) || 0);
	if (!secret || !secret.length || names.length < 2 || k < 2 || k > names.length) return null;

	const n = names.length;
	const shares = splitSecret(secret, { n, k });
	if (!shares || shares.length !== n) return null;

	const id = randomId();
	const now = params.now ?? Date.now();
	const manifest: InheritanceManifest = {
		id,
		purpose: String(params?.purpose ?? "vault").slice(0, 120),
		n,
		k,
		guardians: names.map((name, i) => ({ shardIndex: i + 1, name, acknowledged: false })),
		createdAt: now,
	};
	const shards: GuardianShard[] = shares.map((share) => ({ share, manifestId: id }));
	return { manifest, shards };
}

/**
 * Reconstruct a secret from K+ collected shards. Returns null if the
 * shards are from different schemes or fewer than the threshold. Never throws.
 */
export function recoverFromGuardians(shards: GuardianShard[]): Uint8Array | null {
	const clean = (Array.isArray(shards) ? shards : []).filter((s) => s?.share && s?.manifestId);
	if (clean.length < 2) return null;
	const manifestId = clean[0].manifestId;
	if (!clean.every((s) => s.manifestId === manifestId)) return null;
	const shares = clean.map((s) => s.share);
	try {
		return combineShares(shares);
	} catch {
		return null;
	}
}

/** Mark a guardian as having acknowledged receipt of their shard. */
export function acknowledgeGuardian(manifest: InheritanceManifest, shardIndex: number): InheritanceManifest {
	if (!manifest) return manifest;
	return {
		...manifest,
		guardians: manifest.guardians.map((g) =>
			g.shardIndex === shardIndex ? { ...g, acknowledged: true } : g,
		),
	};
}

/** True once all guardians have acknowledged (scheme is fully distributed). */
export function isFullyDistributed(manifest: InheritanceManifest): boolean {
	return Boolean(manifest && manifest.guardians.length > 0 && manifest.guardians.every((g) => g.acknowledged));
}

/* ═══════════════════════════════════════════════════════════════
   Token encode / decode (manifest only — never the shards)
   ═══════════════════════════════════════════════════════════════ */

export function encodeManifestToken(manifest: InheritanceManifest): string {
	return INHERITANCE_PREFIX + toB64Url(JSON.stringify(manifest));
}

export function decodeManifestToken(token: string): InheritanceManifest | null {
	if (typeof token !== "string" || !token.startsWith(INHERITANCE_PREFIX)) return null;
	try {
		const parsed = JSON.parse(fromB64Url(token.slice(INHERITANCE_PREFIX.length)));
		if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.guardians)) return null;
		return parsed as InheritanceManifest;
	} catch {
		return null;
	}
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function randomId(): string {
	try {
		if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
	} catch {
		/* noop */
	}
	return "inh-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function toB64Url(s: string): string {
	const b64 = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, "utf8").toString("base64");
	return b64.replace(/\+/g, "-").replace(/"/g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): string {
	const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
	const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
	return typeof atob === "function" ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, "base64").toString("utf8");
}
