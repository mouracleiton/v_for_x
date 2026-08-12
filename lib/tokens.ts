/**
 * V FOR X — Unified Token Registry
 *
 * Central registry of all VFX* token formats used across the platform.
 * Each token type serves a specific purpose:
 *
 *   VFXID1:   Identity (ECDSA P-256 public key + handle + signature)
 *   VFXSIG1:  WebRTC signaling (SDP offer/answer)
 *   VFXGP1:   Guardian release packets (encrypted dead man's switch)
 *   VFXRV1:   Blinded peer review (commit/reveal)
 *   VFXWIT1:  Public witness ledger (hash-chained statements)
 *   VFXEV1:   Evidence room (hash-chained evidence bundles)
 *   VFXFILE1: WebRTC file transfer (chunked encrypted files)
 *   VFXCRDT1: Collaborative documents (CRDT operations)
 *   VFXDM1:   Dead man's switch (auto-release)
 *   VFXM1:    Mirror claims (signed mirror node attestations)
 *   VFXPACK1: Multi-token packs (bundle of any VFX* tokens)
 *
 * This module provides:
 *   - TOKEN_SPECS: complete registry of all token types
 *   - detectToken(): identify token type from a string
 *   - validateTokenFormat(): check if a token matches expected format
 *   - extractTokenData(): parse payload from token (without full validation)
 */

/* ═══════════════════════════════════════════════════════════════
   Token Registry
   ═══════════════════════════════════════════════════════════════ */

export interface TokenSpec {
	/** Token prefix (e.g., "VFXID1:") */
	prefix: string;
	/** Short identifier (e.g., "VFXID1") */
	id: string;
	/** Human-readable name */
	name: string;
	/** Brief description of what the token carries */
	description: string;
	/** Module that defines this token type */
	module: string;
	/** Whether this token contains a signature */
	signed: boolean;
	/** Whether this token is encrypted */
	encrypted: boolean;
}

export const TOKEN_SPECS: TokenSpec[] = [
	{
		prefix: "VFXID1:",
		id: "VFXID1",
		name: "Identity",
		description: "ECDSA P-256 identity (handle, public key, signature)",
		module: "identity",
		signed: true,
		encrypted: false,
	},
	{
		prefix: "VFXSIG1:",
		id: "VFXSIG1",
		name: "WebRTC Signal",
		description: "SDP offer/answer for WebRTC peer connection",
		module: "signal-relay",
		signed: false,
		encrypted: false,
	},
	{
		prefix: "VFXGP1:",
		id: "VFXGP1",
		name: "Guardian Packet",
		description: "Encrypted dead man's switch release packet",
		module: "guardian-packet",
		signed: true,
		encrypted: true,
	},
	{
		prefix: "VFXRV1:",
		id: "VFXRV1",
		name: "Blinded Review",
		description: "Commit/reveal peer review token",
		module: "review",
		signed: true,
		encrypted: false,
	},
	{
		prefix: "VFXWIT1:",
		id: "VFXWIT1",
		name: "Witness Ledger",
		description: "Hash-chained witness statements",
		module: "witness",
		signed: true,
		encrypted: false,
	},
	{
		prefix: "VFXEV1:",
		id: "VFXEV1",
		name: "Evidence Bundle",
		description: "Hash-chained evidence room records",
		module: "evidence-room",
		signed: true,
		encrypted: false,
	},
	{
		prefix: "VFXFILE1:",
		id: "VFXFILE1",
		name: "File Transfer",
		description: "Chunked AES-GCM encrypted file transfer",
		module: "file-transfer",
		signed: false,
		encrypted: true,
	},
	{
		prefix: "VFXCRDT1:",
		id: "VFXCRDT1",
		name: "CRDT Document",
		description: "Collaborative document operations",
		module: "crdt",
		signed: false,
		encrypted: false,
	},
	{
		prefix: "VFXDM1:",
		id: "VFXDM1",
		name: "Dead Man's Switch",
		description: "Auto-release configuration and state",
		module: "deadman",
		signed: false,
		encrypted: false,
	},
	{
		prefix: "VFXM1:",
		id: "VFXM1",
		name: "Mirror Claim",
		description: "Signed mirror node attestation",
		module: "mirror",
		signed: true,
		encrypted: false,
	},
	{
		prefix: "VFXPACK1:",
		id: "VFXPACK1",
		name: "Token Pack",
		description: "Bundle of multiple VFX* tokens",
		module: "vfxpack",
		signed: true,
		encrypted: false,
	},
	{
		prefix: "VFXMSN1:",
		id: "VFXMSN1",
		name: "Mission Progress",
		description: "Guided mission progress tracking and completion",
		module: "missions",
		signed: false,
		encrypted: false,
	},
	{
		prefix: "VFXCON1:",
		id: "VFXCON1",
		name: "Consensus Attestation",
		description: "Root hash fork detection across mirrors",
		module: "mirror-consensus",
		signed: true,
		encrypted: false,
	},
	{
		prefix: "VFXID1PUB:",
		id: "VFXID1PUB",
		name: "Public Identity Card",
		description:
			"Public identity information (handle, public key, fingerprint, no signature)",
		module: "identity",
		signed: false,
		encrypted: false,
	},
	{
		prefix: "VFXOTS1:",
		id: "VFXOTS1",
		name: "OpenTimestamps Token",
		description: "OpenTimestamps commitment for Witness and Evidence roots",
		module: "opentimestamps",
		signed: true,
		encrypted: false,
	},
	{
		prefix: "VFXFUL1:",
		id: "VFXFUL1",
		name: "Fulfillment Receipt",
		description: "Signed receipt that a Trail need was met by an offer",
		module: "fulfillment",
		signed: true,
		encrypted: false,
	},
	{
		prefix: "VFXTRL1:",
		id: "VFXTRL1",
		name: "Trail Relay",
		description: "Trail entry encoded for QR/paper handoff",
		module: "trail-relay",
		signed: false,
		encrypted: false,
	},
	{
		prefix: "VFXCNV1:",
		id: "VFXCNV1",
		name: "Convoy Share",
		description: "Shamir GF(256) N-of-M share of delivery coordinates",
		module: "convoy",
		signed: false,
		encrypted: true,
	},
	{
		prefix: "VFXRFC1:",
		id: "VFXRFC1",
		name: "Signed RFC",
		description: "Signed governance proposal grounded in Witness",
		module: "rfc",
		signed: true,
		encrypted: false,
	},
	{
		prefix: "VFXDSP1:",
		id: "VFXDSP1",
		name: "Dispute",
		description: "Counter-dossier dispute with threshold unpublish",
		module: "dispute",
		signed: true,
		encrypted: false,
	},
	{
		prefix: "VFXVOICE1:",
		id: "VFXVOICE1",
		name: "Voice Note",
		description: "Recorded voice note chunked as VFXFILE1 for dead-drop",
		module: "voice-notes",
		signed: false,
		encrypted: true,
	},
	{
		prefix: "VFXRC1:",
		id: "VFXRC1",
		name: "Message Receipt",
		description: "Delivery-state receipt for mesh messages",
		module: "message-receipts",
		signed: false,
		encrypted: false,
	},
	{
		prefix: "VFXCRDT1S:",
		id: "VFXCRDT1S",
		name: "Signed CRDT Document",
		description:
			"Signed collaborative document export/import (identity-bound CRDT)",
		module: "crdt",
		signed: true,
		encrypted: false,
	},
	{
		prefix: "VFXMESH1:",
		id: "VFXMESH1",
		name: "Mesh Presence",
		description:
			"Signed peer presence update (handle, status, hop count, last-seen)",
		module: "mesh-presence",
		signed: true,
		encrypted: false,
	},
	{
		prefix: "VFXERR1:",
		id: "VFXERR1",
		name: "Errata Chain",
		description:
			"Corrections / disputes / clarifications / retractions for a dossier",
		module: "registry-safety",
		signed: false,
		encrypted: false,
	},
	{
		prefix: "VFXCIT1:",
		id: "VFXCIT1",
		name: "Citability",
		description: "Stable paragraph IDs + citation block for a dossier",
		module: "citability",
		signed: true,
		encrypted: false,
	},
	{
		prefix: "VFXCNC1:",
		id: "VFXCNC1",
		name: "Concord",
		description: "Multi-org joint statement with witness cosign tree",
		module: "concord",
		signed: true,
		encrypted: false,
	},
	{
		prefix: "VFXCUR1:",
		id: "VFXCUR1",
		name: "Courier",
		description: "Multi-stop physical QR dead-drop manifest",
		module: "courier",
		signed: true,
		encrypted: true,
	},
	{
		prefix: "VFXGRN1:",
		id: "VFXGRN1",
		name: "Greenhouse",
		description: "Local intervention playbook with Equation micro cost model",
		module: "greenhouse",
		signed: false,
		encrypted: false,
	},
	{
		prefix: "VFXINH1:",
		id: "VFXINH1",
		name: "Inheritance",
		description: "Shamir social-recovery shard manifest for the Vault",
		module: "inheritance",
		signed: true,
		encrypted: true,
	},
	{
		prefix: "VFXPRT1:",
		id: "VFXPRT1",
		name: "Parity",
		description: "State-TV claim vs backbone metric comparison",
		module: "parity",
		signed: false,
		encrypted: false,
	},
	{
		prefix: "VFXPAR1:",
		id: "VFXPAR1",
		name: "Parliament",
		description: "Federated Quorum tally across mirrors",
		module: "parliament",
		signed: false,
		encrypted: false,
	},
	{
		prefix: "VFXQBT1:",
		id: "VFXQBT1",
		name: "Quorum Ballot",
		description: "Signed Quorum ballot cast inside a Web room",
		module: "quorum-ballot",
		signed: true,
		encrypted: false,
	},
	{
		prefix: "VFXAMP1:",
		id: "VFXAMP1",
		name: "Amplitude Allocation",
		description:
			"Seedable weighted helper pick (skill × sovereignty × exposure)",
		module: "roster-skills",
		signed: false,
		encrypted: false,
	},
	{
		prefix: "VFXRPR1:",
		id: "VFXRPR1",
		name: "Reparations Claim",
		description: "Signed public claim about seized assets / reparations due",
		module: "reparations",
		signed: true,
		encrypted: false,
	},
];

/* ═══════════════════════════════════════════════════════════════
   Token Detection
   ═══════════════════════════════════════════════════════════════ */

export interface DetectedToken {
	/** The token spec that matched */
	spec: TokenSpec;
	/** The raw token string */
	token: string;
	/** The payload (everything after the prefix) */
	payload: string;
	/** Whether the token format looks valid (syntax check only) */
	validFormat: boolean;
}

/**
 * Detect the type of a VFX* token.
 * Returns null if the token doesn't match any known prefix.
 */
export function detectToken(token: string): DetectedToken | null {
	if (!token || typeof token !== "string") {
		return null;
	}

	const trimmed = token.trim();
	const spec = TOKEN_SPECS.find((s) => trimmed.startsWith(s.prefix));

	if (!spec) {
		return null;
	}

	const payload = trimmed.slice(spec.prefix.length);
	const validFormat = payload.length > 0;

	return {
		spec,
		token: trimmed,
		payload,
		validFormat,
	};
}

/**
 * Get all token IDs supported by the platform.
 */
export function getAllTokenIds(): string[] {
	return TOKEN_SPECS.map((s) => s.id);
}

/**
 * Get all token prefixes supported by the platform.
 */
export function getAllPrefixes(): string[] {
	return TOKEN_SPECS.map((s) => s.prefix);
}

/**
 * Check if a string starts with any VFX* token prefix.
 */
export function isVFXToken(str: string): boolean {
	if (!str || typeof str !== "string") {
		return false;
	}
	return TOKEN_SPECS.some((spec) => str.trim().startsWith(spec.prefix));
}

/**
 * Validate the format of a token (syntax check only, no full validation).
 * Returns true if the token has a valid prefix and non-empty payload.
 */
export function validateTokenFormat(token: string): boolean {
	const detected = detectToken(token);
	return detected !== null && detected.validFormat;
}

/**
 * Extract the payload from a token without validating it.
 * Returns null if the token doesn't match any known format.
 */
export function extractTokenData(token: string): string | null {
	const detected = detectToken(token);
	return detected?.payload ?? null;
}

/**
 * Get the token spec for a given token ID.
 * Returns null if the ID is not recognized.
 */
export function getTokenSpec(id: string): TokenSpec | null {
	return TOKEN_SPECS.find((s) => s.id === id) ?? null;
}

/**
 * Get the token spec for a given token string.
 * Returns null if the token is not recognized.
 */
export function getTokenSpecForToken(token: string): TokenSpec | null {
	const detected = detectToken(token);
	return detected?.spec ?? null;
}

/**
 * Group tokens by type from an array of mixed tokens.
 * Returns a map of token ID to array of tokens of that type.
 */
export function groupTokensByType(tokens: string[]): Record<string, string[]> {
	const grouped: Record<string, string> = {};
	const result: Record<string, string[]> = {};

	for (const token of tokens) {
		const detected = detectToken(token);
		if (detected) {
			const id = detected.spec.id;
			if (!grouped[id]) {
				grouped[id] = id;
				result[id] = [];
			}
			result[id].push(token);
		}
	}

	return result;
}

/**
 * Count tokens by type from an array of mixed tokens.
 */
export function countTokensByType(tokens: string[]): Record<string, number> {
	const counts: Record<string, number> = {};

	for (const token of tokens) {
		const detected = detectToken(token);
		if (detected) {
			const id = detected.spec.id;
			counts[id] = (counts[id] ?? 0) + 1;
		}
	}

	return counts;
}

/**
 * Filter tokens by type from an array of mixed tokens.
 */
export function filterTokensByType(
	tokens: string[],
	tokenIds: string[],
): string[] {
	const validIds = new Set(tokenIds);
	return tokens.filter((token) => {
		const detected = detectToken(token);
		return detected !== null && validIds.has(detected.spec.id);
	});
}

/**
 * Sort tokens by type (grouping same tokens together).
 */
export function sortTokensByType(tokens: string[]): string[] {
	const detected = tokens.map((token) => ({
		token,
		detected: detectToken(token),
	}));

	return detected
		.sort((a, b) => {
			// Non-VFX tokens go last
			if (!a.detected && !b.detected) return 0;
			if (!a.detected) return 1;
			if (!b.detected) return -1;

			// Sort by token ID, then by original order
			const idCompare = a.detected.spec.id.localeCompare(b.detected.spec.id);
			return idCompare;
		})
		.map((item) => item.token);
}
