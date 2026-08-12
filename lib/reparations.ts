/**
 * V FOR X — Reparations / Seized-Asset Tracker (Phase 25 D)
 *
 * A public claims ledger: signed claims about seized assets / reparations due,
 * verifiable locally against identity keys. No central server, no tokens of
 * monetary value — a record of claims + signatures that anyone can verify.
 *
 * Shaped like lib/witness.ts so the same verify/chain primitives apply.
 */

export const REPARATIONS_PREFIX = "VFXRPR1:";
export const REPARATIONS_STORAGE_KEY = "vfx-reparations-ledger";
export const MAX_CLAIM_TEXT = 800;

export type AssetClass =
	| "land"
	| "property"
	| "funds"
	| "livestock"
	| "crops"
	| "equipment"
	| "other";

export interface ReparationsClaim {
	/** Stable claim id (hash-derived). */
	id: string;
	/** Claimant handle (not key material). */
	claimant: string;
	/** ISO3 where the seizure/loss occurred. */
	iso3: string;
	/** What class of asset was seized or lost. */
	assetClass: AssetClass;
	/** Free-text description of the claim. */
	description: string;
	/** Estimated value in USD at time of loss (optional). */
	estimatedValueUsd?: number;
	/** When the seizure/loss occurred (epoch ms). */
	occurredAt: number;
	/** When the claim was filed. */
	filedAt: number;
}

export interface SignedReparationsClaim extends ReparationsClaim {
	/** SHA-256 hex over the canonical claim. */
	hash: string;
	/** Claimant public key (SPKI base64). */
	publicKey: string;
	/** ECDSA-P256 signature (base64, IEEE P1363) over canonicalReparationsClaim. */
	signature: string;
}

/** Canonical JSON for signing (excludes signature; stable key order). */
export function canonicalReparationsClaim(claim: ReparationsClaim): string {
	return JSON.stringify({
		id: claim.id,
		claimant: claim.claimant,
		iso3: claim.iso3,
		assetClass: claim.assetClass,
		description: claim.description,
		estimatedValueUsd: claim.estimatedValueUsd ?? null,
		occurredAt: claim.occurredAt,
		filedAt: claim.filedAt,
	});
}

/** SHA-256 hash of the canonical claim (hex). */
export async function hashReparationsClaim(
	claim: ReparationsClaim,
): Promise<string> {
	const data = new TextEncoder().encode(canonicalReparationsClaim(claim));
	const digest = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export type ReparationsSignFn = (content: string) => Promise<{
	publicKey: string;
	signature: string;
}>;

export interface ReparationsVerifyResult {
	valid: boolean;
	reason: string;
	claim?: SignedReparationsClaim;
}

/**
 * Build + sign a reparations claim. The signer injects the identity keypair
 * (see lib/identity.ts createEphemeralSigner pattern) so this lib stays
 * crypto-agnostic.
 */
export async function buildReparationsClaim(
	input: Omit<ReparationsClaim, "id">,
	sign: ReparationsSignFn,
): Promise<SignedReparationsClaim> {
	const base: ReparationsClaim = {
		...input,
		description: (input.description ?? "").slice(0, MAX_CLAIM_TEXT),
		iso3: (input.iso3 ?? "").trim().toUpperCase(),
		id: "", // filled after hash
	};
	const hash = await hashReparationsClaim({ ...base, id: "" });
	const claim: ReparationsClaim = { ...base, id: hash.slice(0, 16) };
	const finalHash = await hashReparationsClaim(claim);
	const { publicKey, signature } = await sign(canonicalReparationsClaim(claim));
	return { ...claim, hash: finalHash, publicKey, signature };
}

/** Verify a signed claim's internal consistency (hash + signature presence). */
export async function verifyReparationsClaim(
	signed: SignedReparationsClaim,
	verifySignature: (
		canonical: string,
		publicKey: string,
		signature: string,
	) => Promise<boolean>,
): Promise<ReparationsVerifyResult> {
	const { signature, publicKey, hash, ...claimFields } = signed;
	const claim: ReparationsClaim = claimFields;
	const recomputed = await hashReparationsClaim(claim);
	if (recomputed !== hash) {
		return { valid: false, reason: "hash mismatch — claim tampered" };
	}
	const sigOk = await verifySignature(
		canonicalReparationsClaim(claim),
		publicKey,
		signature,
	);
	if (!sigOk) {
		return { valid: false, reason: "signature verification failed" };
	}
	return { valid: true, reason: "verified", claim: signed };
}

/** Encode a signed claim as a VFXRPR1 token. */
export function encodeReparationsClaim(signed: SignedReparationsClaim): string {
	return `${REPARATIONS_PREFIX}${JSON.stringify(signed)}`;
}

/** Parse a VFXRPR1 token back to a signed claim, or null if malformed. */
export function parseReparationsClaim(
	token: string,
): SignedReparationsClaim | null {
	if (!token || !token.startsWith(REPARATIONS_PREFIX)) return null;
	try {
		const parsed = JSON.parse(token.slice(REPARATIONS_PREFIX.length));
		if (
			!parsed ||
			typeof parsed !== "object" ||
			!parsed.hash ||
			!parsed.signature
		)
			return null;
		return parsed as SignedReparationsClaim;
	} catch {
		return null;
	}
}

/** Load the local claims ledger. */
export function loadReparationsLedger(): SignedReparationsClaim[] {
	if (typeof window === "undefined" || typeof localStorage === "undefined")
		return [];
	try {
		const raw = localStorage.getItem(REPARATIONS_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

/** Save the claims ledger. */
export function saveReparationsLedger(claims: SignedReparationsClaim[]): void {
	if (typeof window === "undefined" || typeof localStorage === "undefined")
		return;
	try {
		localStorage.setItem(REPARATIONS_STORAGE_KEY, JSON.stringify(claims));
	} catch {
		/* ignore quota */
	}
}

/** Append a signed claim to the local ledger (de-dupes by hash). */
export function appendReparationsClaim(
	claim: SignedReparationsClaim,
): SignedReparationsClaim[] {
	const ledger = loadReparationsLedger();
	if (ledger.some((c) => c.hash === claim.hash)) return ledger;
	const next = [claim, ...ledger];
	saveReparationsLedger(next);
	return next;
}

/** Sum of estimated values across a ledger (for an aggregate, not individual claims). */
export function sumEstimatedValue(claims: SignedReparationsClaim[]): number {
	return claims.reduce((sum, c) => sum + (c.estimatedValueUsd ?? 0), 0);
}
