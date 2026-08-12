/**
 * V FOR X — Storage Map & Panic Wipe Audit Registry
 *
 * Central registry of ALL storage keys used across the application.
 * Provides:
 * 1. Complete inventory of localStorage keys and IndexedDB databases/stores
 * 2. Panic wipe audit trail (what was wiped, when, and why)
 * 3. Backup/restore support for key rotation and duress mode
 * 4. Storage health checks and integrity verification
 *
 * SECURITY: This module enables auditability of panic wipes and supports
 * the duress/decoy mode by allowing selective backup and restoration of
 * sensitive data.
 */

/* ═══════════════════════════════════════════════════════════════
   Type Definitions
   ═══════════════════════════════════════════════════════════════ */

export interface StorageKeyInfo {
	/** The localStorage key or IndexedDB store name */
	key: string;
	/** Category of data (identity, duress, user-data, etc.) */
	category: StorageCategory;
	/** Human-readable description */
	description: string;
	/** Whether this contains sensitive/encrypted data */
	sensitive: boolean;
	/** Whether this should be wiped on panic */
	wipeOnPanic: boolean;
	/** Whether this should be preserved in duress decoy mode */
	preserveInDecoy: boolean;
	/** When this key was first registered */
	registeredAt: number;
}

export type StorageCategory =
	| "identity" // Crypto identity keys, handles, fingerprints
	| "duress" // Duress mode config and state
	| "user-data" // User preferences, progress, journal
	| "crypto" // Signatures, witnessing, timestamps
	| "mesh" // WebRTC/mesh networking state
	| "content" // Reviews, errata, submissions
	| "cache" // Temporary caches and indexes
	| "audit"; // Audit logs themselves

export interface IndexedDBStoreInfo {
	/** Database name */
	dbName: string;
	/** Store/object store name */
	storeName: string;
	/** Category of data */
	category: StorageCategory;
	/** Description */
	description: string;
	/** Sensitive data flag */
	sensitive: boolean;
}

export interface PanicWipeEvent {
	/** Unique wipe event ID */
	id: string;
	/** When the wipe occurred */
	timestamp: number;
	/** What triggered the wipe (panic, duress, rotation, manual) */
	trigger: "panic" | "duress" | "rotation" | "manual" | "test";
	/** Which keys were wiped */
	wipedKeys: string[];
	/** Which keys were preserved (backup) */
	preservedKeys: string[];
	/** Which IndexedDB stores were cleared */
	clearedStores: Array<{ dbName: string; storeName: string }>;
	/** Optional reason or context */
	reason?: string;
	/** Storage size before wipe (bytes, if available) */
	sizeBefore?: number;
}

export interface StorageBackup {
	/** Backup ID */
	id: string;
	/** When backup was created */
	createdAt: number;
	/** Backup label (e.g., "pre-rotation", "duress-real-identity") */
	label: string;
	/** Backed up localStorage entries */
	localStorage: Record<string, string>;
	/** Backup metadata */
	metadata: {
		version: 1;
		appVersion?: string;
		totalKeys: number;
		categories: StorageCategory[];
		/** Why the backup was taken (rotation, duress, manual) — audit trail. */
		reason?: string;
	};
}

/* ═══════════════════════════════════════════════════════════════
   Storage Key Registry
   ═══════════════════════════════════════════════════════════════ */

/**
 * Complete registry of all localStorage keys used in V FOR X.
 *
 * This is the source of truth for storage inventory. Any new localStorage
 * keys MUST be added here with proper categorization for panic wipe behavior.
 */
export const LOCAL_STORAGE_KEYS: ReadonlyArray<StorageKeyInfo> = [
	// ═════════════════════════════════════════════════════════════
	// IDENTITY (crypto spine)
	// ═════════════════════════════════════════════════════════════
	{
		key: "vfx_identity",
		category: "identity",
		description:
			"Current unified crypto identity (ECDSA P-256 keypair, handle, fingerprint)",
		sensitive: true,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx_identity_history",
		category: "identity",
		description:
			"Previous identities for grace period verification (30-day signature validation)",
		sensitive: true,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},

	// ═════════════════════════════════════════════════════════════
	// DURESS (hidden volume protection)
	// ═════════════════════════════════════════════════════════════
	{
		key: "vfx_duress_cfg",
		category: "duress",
		description:
			"Duress/decoy mode configuration (decoy code, enabled state, decoy identity handle)",
		sensitive: true,
		wipeOnPanic: false, // Keep duress config to allow recovery
		preserveInDecoy: true,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx_duress_mode",
		category: "duress",
		description: "Active duress mode (normal/decoy/wipe)",
		sensitive: true,
		wipeOnPanic: false, // Keep duress mode state
		preserveInDecoy: true,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx_duress_decoy_identity",
		category: "duress",
		description:
			"Decoy identity keypair (separate from real identity, used when in decoy mode)",
		sensitive: true,
		wipeOnPanic: true, // Wipe decoy identity on panic (not needed for recovery)
		preserveInDecoy: false, // Not used in decoy mode (it IS the decoy mode identity
		registeredAt: 1700000000000,
	},
	{
		key: "vfx_duress_stash_record",
		category: "duress",
		description:
			"Record of real data stash operation (backup ID, timestamps, restoration status)",
		sensitive: true,
		wipeOnPanic: true, // Contains reference to real identity stash
		preserveInDecoy: false, // Not needed in decoy mode
		registeredAt: 1700000000000,
	},

	// ═════════════════════════════════════════════════════════════
	// USER DATA (preferences, progress, personalization)
	// ═════════════════════════════════════════════════════════════
	{
		key: "vfx-lang",
		category: "user-data",
		description: "User language preference (i18n)",
		sensitive: false,
		wipeOnPanic: false, // Keep benign preferences
		preserveInDecoy: true,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-a11y",
		category: "user-data",
		description: "Accessibility settings (contrast, text size, etc.)",
		sensitive: false,
		wipeOnPanic: false,
		preserveInDecoy: true,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx_persona",
		category: "user-data",
		description: "Active persona (journalist, aid worker, etc.)",
		sensitive: true,
		wipeOnPanic: true, // Can reveal user's role
		preserveInDecoy: true,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-full-nav",
		category: "user-data",
		description: "Full navigation toggle (persona filter state)",
		sensitive: false,
		wipeOnPanic: false,
		preserveInDecoy: true,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx_missions_progress",
		category: "user-data",
		description: "Mission progress state (guided onboarding steps)",
		sensitive: true,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx_ops_journal",
		category: "user-data",
		description: "Operations journal (local self-stats, audit log)",
		sensitive: true,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx_playbooks_progress",
		category: "user-data",
		description: "Playbook checklist progress state",
		sensitive: true,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-academy-progress",
		category: "user-data",
		description: "Academy/learning progress",
		sensitive: false,
		wipeOnPanic: false,
		preserveInDecoy: true,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-pulse-prefs",
		category: "user-data",
		description: "Pulse/alert preference settings",
		sensitive: false,
		wipeOnPanic: false,
		preserveInDecoy: true,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-ai-config",
		category: "user-data",
		description: "AI generator configuration (API key, endpoint)",
		sensitive: true,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},

	// ═════════════════════════════════════════════════════════════
	// CRYPTO (signatures, timestamps, witnessing)
	// ═════════════════════════════════════════════════════════════
	{
		key: "vfx-witness-ledger",
		category: "crypto",
		description: "Public witness ledger (signed hash-chained statements)",
		sensitive: true,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-witness-session-key",
		category: "crypto",
		description: "Witness session key for draft statements",
		sensitive: true,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-ots-timestamps",
		category: "crypto",
		description: "OpenTimestamps pending stamps (awaiting calendar submission)",
		sensitive: true,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},

	// ═════════════════════════════════════════════════════════════
	// MESH (WebRTC, P2P networking)
	// ═════════════════════════════════════════════════════════════
	{
		key: "vfx-mesh-presence",
		category: "mesh",
		description: "Mesh presence data (peer graph, hop counts, last-seen)",
		sensitive: true,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-mesh-mailbox",
		category: "mesh",
		description: "Mesh mailbox fallback (offline message queue)",
		sensitive: true,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-mesh-seen",
		category: "mesh",
		description: "Mesh seen-ring deduplication tracker",
		sensitive: false,
		wipeOnPanic: false,
		preserveInDecoy: true,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-signal",
		category: "mesh",
		description: "Signal relay hash for WebRTC signaling",
		sensitive: false,
		wipeOnPanic: false,
		preserveInDecoy: true,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-web-room-code",
		category: "mesh",
		description: "Web room code for P2P connections",
		sensitive: false,
		wipeOnPanic: false,
		preserveInDecoy: true,
		registeredAt: 1700000000000,
	},

	// ═════════════════════════════════════════════════════════════
	// GUARDIAN (dead man's switch)
	// ═════════════════════════════════════════════════════════════
	{
		key: "vfx-deadman-releases",
		category: "crypto",
		description: "Dead man's switch release ledger (encrypted release packets)",
		sensitive: true,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},

	// ═════════════════════════════════════════════════════════════
	// CONTENT (reviews, errata, user-generated content)
	// ═════════════════════════════════════════════════════════════
	{
		key: "vfx-reviews",
		category: "content",
		description: "Blinded review storage (prefix for per-dossier keys)",
		sensitive: true,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-corrections",
		category: "content",
		description: "User corrections/errata for dossiers",
		sensitive: false,
		wipeOnPanic: false,
		preserveInDecoy: true,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-resume-session",
		category: "user-data",
		description:
			"Resume-session state (last route, iso3, mission step, persona) for reentry after reload",
		sensitive: false,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-docs-room",
		category: "user-data",
		description:
			"Last Web room id bound to CRDT Docs (auto-sync when peers meet on this room)",
		sensitive: false,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-impostor-watchlist",
		category: "identity",
		description:
			"Impostor-handle watchlist: public keys seen per handle over time (key-transparency lite)",
		sensitive: true,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-crash-reports",
		category: "user-data",
		description:
			"Compartmented local-only crash reason codes for after-action (PII-scrubbed)",
		sensitive: false,
		wipeOnPanic: true,
		preserveInDecoy: true,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-wellbeing",
		category: "user-data",
		description:
			"Operator wellbeing: shift/break timers + burnout + after-action notes (local-only nudges)",
		sensitive: false,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-reparations-ledger",
		category: "user-data",
		description:
			"Reparations / seized-asset public claims ledger (signed, locally verifiable)",
		sensitive: false,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-perf-marks",
		category: "user-data",
		description:
			"Local-only performance marks ring buffer (never leaves device; opt-in export only)",
		sensitive: false,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-onboard-done",
		category: "user-data",
		description: "One-story onboarding dismissed/completed flag",
		sensitive: false,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},

	// ═════════════════════════════════════════════════════════════
	// CACHE (temporary data, indexes, optimizations)
	// ═════════════════════════════════════════════════════════════
	{
		key: "vfx-gamification",
		category: "cache",
		description: "Gamification progress (badges, achievements)",
		sensitive: false,
		wipeOnPanic: false,
		preserveInDecoy: true,
		registeredAt: 1700000000000,
	},

	// ═══════════════════════════════════════════════════════════════
	// BRIDGE IMPORT STAGING (transient — last token pasted into the Bridge for verify/pack)
	// ═══════════════════════════════════════════════════════════════
	// These are temporary clipboard-style staging slots, not durable data.
	// They hold no secret beyond the token the user just pasted, but for safety
	// they wipe on panic and are NOT preserved in decoy.
	{
		key: "vfx-imported-identity",
		category: "user-data",
		description: "Bridge: last pasted VFXID1 token (verify/pack staging)",
		sensitive: false,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-imported-witness",
		category: "user-data",
		description: "Bridge: last pasted VFXWIT1 token (verify/pack staging)",
		sensitive: false,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-imported-evidence",
		category: "user-data",
		description: "Bridge: last pasted VFXEV1 token (verify/pack staging)",
		sensitive: false,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-imported-file",
		category: "user-data",
		description: "Bridge: last pasted VFXFILE1 token (verify/pack staging)",
		sensitive: false,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-imported-mirror",
		category: "user-data",
		description: "Bridge: last pasted VFXM1 token (verify/pack staging)",
		sensitive: false,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-imported-signal",
		category: "user-data",
		description: "Bridge: last pasted VFXSIG1 token (verify/pack staging)",
		sensitive: false,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-imported-crdt",
		category: "user-data",
		description: "Bridge: last pasted VFXCRDT1(S) token (verify/pack staging)",
		sensitive: false,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-imported-guardian-packet",
		category: "user-data",
		description: "Bridge: last pasted VFXGP1 token (verify/pack staging)",
		sensitive: false,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-imported-deadman",
		category: "user-data",
		description: "Bridge: last pasted VFXDM1 token (verify/pack staging)",
		sensitive: false,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-imported-review",
		category: "user-data",
		description: "Bridge: last pasted VFXRV1 token (verify/pack staging)",
		sensitive: false,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},

	// ═══════════════════════════════════════════════════════════════
	// SURFACE-LEVEL STATE (feature prefs + transient UI/duress state)
	// ═══════════════════════════════════════════════════════════════
	{
		key: "vfx-oracle-model",
		category: "user-data",
		description: "Selected polyglot oracle embedding model id",
		sensitive: false,
		wipeOnPanic: false,
		preserveInDecoy: true,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-dead-drops",
		category: "user-data",
		description:
			"The Web: user's dead-drop file envelopes (key-gated, may carry VFXFILE1 refs)",
		sensitive: true,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-identity",
		category: "identity",
		description:
			"Alternate identity-staging slot used by Trail (mirrors vfx_identity when needed)",
		sensitive: true,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx_duress_set",
		category: "duress",
		description:
			"Mask: whether a duress decoy identity set has been configured",
		sensitive: false,
		wipeOnPanic: true,
		preserveInDecoy: true,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx_safety_gates",
		category: "user-data",
		description:
			"Per-pair registry safety-gate ack state (safety-number soft-gates)",
		sensitive: false,
		wipeOnPanic: false,
		preserveInDecoy: true,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-session",
		category: "duress",
		description: "Duress-decoy session marker (active decoy mode flag)",
		sensitive: false,
		wipeOnPanic: true,
		preserveInDecoy: true,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-watch",
		category: "duress",
		description:
			"Duress-decoy watch-list backup (real-data snapshot restored on decoy exit)",
		sensitive: true,
		wipeOnPanic: false,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
	{
		key: "vfx-annotations",
		category: "user-data",
		description:
			"Reader annotations on dossiers/map/metrics (local-only, exportable into VFXPACK1)",
		sensitive: true,
		wipeOnPanic: true,
		preserveInDecoy: false,
		registeredAt: 1700000000000,
	},
] as const;

/**
 * Registry of all IndexedDB databases and their object stores.
 */
export const INDEXED_DB_STORES: ReadonlyArray<IndexedDBStoreInfo> = [
	// ═════════════════════════════════════════════════════════════
	// vfx-store (main database, v6)
	// ═════════════════════════════════════════════════════════════
	{
		dbName: "vfx-store",
		storeName: "ledger",
		category: "user-data",
		description: "Trail ledger entries (mutual aid log)",
		sensitive: true,
	},
	{
		dbName: "vfx-store",
		storeName: "checklists",
		category: "user-data",
		description: "Protocol X checklist kits",
		sensitive: true,
	},
	{
		dbName: "vfx-store",
		storeName: "watchlist",
		category: "user-data",
		description: "Country watchlist entries",
		sensitive: true,
	},
	{
		dbName: "vfx-store",
		storeName: "alert_rules",
		category: "user-data",
		description: "Custom metric alert rules",
		sensitive: true,
	},
	{
		dbName: "vfx-store",
		storeName: "submissions",
		category: "content",
		description: "Anonymous dossier submissions",
		sensitive: true,
	},
	{
		dbName: "vfx-store",
		storeName: "corroboration",
		category: "content",
		description: "Community corroboration network",
		sensitive: true,
	},
	{
		dbName: "vfx-store",
		storeName: "action_circles",
		category: "content",
		description: "Action Network circles",
		sensitive: true,
	},
	{
		dbName: "vfx-store",
		storeName: "pledges",
		category: "content",
		description: "Pledges (per-country)",
		sensitive: true,
	},
	{
		dbName: "vfx-store",
		storeName: "dead_drops",
		category: "mesh",
		description: "Mesh dead-drop file envelopes",
		sensitive: true,
	},
	{
		dbName: "vfx-store",
		storeName: "semantic_index",
		category: "cache",
		description: "Semantic search index cache",
		sensitive: false,
	},
	{
		dbName: "vfx-store",
		storeName: "file_transfer",
		category: "mesh",
		description: "WebRTC file transfer state",
		sensitive: true,
	},
	{
		dbName: "vfx-store",
		storeName: "crdt_docs",
		category: "content",
		description: "Collaborative CRDT documents",
		sensitive: true,
	},
	{
		dbName: "vfx-store",
		storeName: "evidence_room",
		category: "crypto",
		description: "Evidence room hash chains",
		sensitive: true,
	},
	{
		dbName: "vfx-store",
		storeName: "mirror_ring",
		category: "crypto",
		description: "Mirror ring state",
		sensitive: true,
	},
	{
		dbName: "vfx-store",
		storeName: "mesh_store",
		category: "mesh",
		description: "Mesh store-and-forward mailbox",
		sensitive: true,
	},

	// ═════════════════════════════════════════════════════════════
	// vfx-vault (encrypted evidence, media)
	// ═════════════════════════════════════════════════════════════
	{
		dbName: "vfx-vault",
		storeName: "items",
		category: "crypto",
		description: "Encrypted vault items (evidence, media)",
		sensitive: true,
	},

	// ═════════════════════════════════════════════════════════════
	// vfx-offline (service worker cache, offline bundles)
	// ═════════════════════════════════════════════════════════════
	{
		dbName: "vfx-offline",
		storeName: "bundles",
		category: "cache",
		description: "Offline content bundles",
		sensitive: false,
	},

	// ═════════════════════════════════════════════════════════════
	// vfx-pulse (alert feeds, notification state)
	// ═════════════════════════════════════════════════════════════
	{
		dbName: "vfx-pulse",
		storeName: "feeds",
		category: "user-data",
		description: "Alert feed subscriptions",
		sensitive: true,
	},
	{
		dbName: "vfx-pulse",
		storeName: "state",
		category: "user-data",
		description: "Pulse notification state",
		sensitive: false,
	},
] as const;

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

/** localStorage key for panic wipe audit log */
const AUDIT_LOG_KEY = "vfx_panic_wipe_audit";

/** localStorage key for storage backups (rotation, duress) */
const BACKUP_KEY = "vfx_storage_backup";

/** Maximum number of audit events to keep */
const MAX_AUDIT_EVENTS = 100;

/** Maximum number of backups to keep */
const MAX_BACKUPS = 5;

/* ═══════════════════════════════════════════════════════════════
   Audit Log Functions
   ═══════════════════════════════════════════════════════════════ */

/**
 * Load the panic wipe audit log.
 */
export function loadAuditLog(): PanicWipeEvent[] {
	if (typeof localStorage === "undefined") return [];

	try {
		const raw = localStorage.getItem(AUDIT_LOG_KEY);
		if (!raw) return [];
		const log = JSON.parse(raw) as PanicWipeEvent[];
		// Sort by timestamp descending (most recent first)
		return log.sort((a, b) => b.timestamp - a.timestamp);
	} catch {
		return [];
	}
}

/**
 * Save a panic wipe event to the audit log.
 */
export function recordWipeEvent(event: PanicWipeEvent): void {
	if (typeof localStorage === "undefined") return;

	const log = loadAuditLog();
	log.unshift(event); // Add to front

	// Keep only the most recent events
	if (log.length > MAX_AUDIT_EVENTS) {
		log.length = MAX_AUDIT_EVENTS;
	}

	try {
		localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(log));
	} catch {
		// Storage full or unavailable, ignore
	}
}

/**
 * Clear the audit log.
 *
 * Used when the audit log itself becomes too large or when
 * transitioning between identity states.
 */
export function clearAuditLog(): void {
	if (typeof localStorage === "undefined") return;
	localStorage.removeItem(AUDIT_LOG_KEY);
}

/* ═══════════════════════════════════════════════════════════════
   Storage Inventory Functions
   ═══════════════════════════════════════════════════════════════ */

/**
 * Get all localStorage keys that should be wiped based on wipe mode.
 */
export function getKeysForWipe(
	mode: "panic" | "duress" | "rotation",
): string[] {
	return LOCAL_STORAGE_KEYS.filter((info) => {
		if (mode === "duress") {
			// In duress mode, wipe everything except duress config and benign prefs
			return info.wipeOnPanic && !info.preserveInDecoy;
		}
		if (mode === "rotation") {
			// On rotation, wipe identity keys only
			return info.category === "identity";
		}
		// Full panic wipe
		return info.wipeOnPanic;
	}).map((info) => info.key);
}

/**
 * Get all localStorage keys that should be preserved (backed up).
 */
export function getKeysForPreserve(
	mode: "panic" | "duress" | "rotation",
): string[] {
	return LOCAL_STORAGE_KEYS.filter((info) => {
		if (mode === "duress") {
			// Preserve duress config and some benign data
			return info.preserveInDecoy || !info.wipeOnPanic;
		}
		if (mode === "rotation") {
			// Preserve everything except identity (will be backed up separately)
			return true;
		}
		// Full panic - preserve minimal config
		return info.preserveInDecoy;
	}).map((info) => info.key);
}

/**
 * Get all IndexedDB stores that should be cleared based on wipe mode.
 */
export function getStoresForClear(
	mode: "panic" | "duress" | "rotation",
): Array<{
	dbName: string;
	storeName: string;
}> {
	return INDEXED_DB_STORES.filter((info) => {
		if (mode === "duress") {
			// Clear sensitive stores, keep cache/benign data
			return info.sensitive;
		}
		if (mode === "rotation") {
			// Rotation doesn't clear IndexedDB (identity is in localStorage)
			return false;
		}
		// Full panic - clear all sensitive stores
		return info.sensitive;
	});
}

/**
 * Scan localStorage and return all actual keys present.
 *
 * Useful for detecting unknown/orphaned keys and for audit.
 */
export function scanActualKeys(): string[] {
	if (typeof localStorage === "undefined") return [];

	const keys: string[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key) keys.push(key);
	}
	return keys;
}

/**
 * Find keys in localStorage that are not in the registry.
 *
 * These may be orphaned, deprecated, or from third-party scripts.
 */
export function findUnknownKeys(): string[] {
	const actualKeys = scanActualKeys();
	const knownKeys = new Set(LOCAL_STORAGE_KEYS.map((info) => info.key));

	// Also account for prefixed keys (vfx-reviews:*, vfx-mesh-presence:*, etc.)
	const knownPrefixes = LOCAL_STORAGE_KEYS.map((info) => {
		if (info.key.endsWith(":")) return info.key;
		if (info.description.includes("prefix for")) return info.key;
		return null;
	}).filter(Boolean);

	const unknown: string[] = [];
	for (const key of actualKeys) {
		// Check exact match
		if (knownKeys.has(key)) continue;

		// Check prefix match
		let matchesPrefix = false;
		for (const prefix of knownPrefixes) {
			if (prefix && key.startsWith(prefix as string)) {
				matchesPrefix = true;
				break;
			}
		}

		if (!matchesPrefix) {
			unknown.push(key);
		}
	}

	return unknown;
}

/**
 * Estimate localStorage usage in bytes.
 *
 * Note: This is an approximation. Real quota management is
 * browser-dependent and not directly exposed.
 */
export function estimateStorageSize(): number {
	if (typeof localStorage === "undefined") return 0;

	let total = 0;
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key) {
			const value = localStorage.getItem(key) || "";
			total += key.length + value.length;
		}
	}
	return total; // Approximate character count ≈ bytes for UTF-8
}

/* ═══════════════════════════════════════════════════════════════
   Backup & Restore Functions (for rotation/duress)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Create a backup of specified localStorage keys.
 *
 * Used for key rotation (backup old identity) and duress mode
 * (backup real identity before entering decoy mode).
 */
export function createBackup(
	keysToBackup: string[],
	label: string,
	reason: string,
): StorageBackup {
	if (typeof localStorage === "undefined") {
		throw new Error("localStorage not available");
	}

	const backup: StorageBackup = {
		id: generateBackupId(),
		createdAt: Date.now(),
		label,
		localStorage: {},
		metadata: {
			version: 1,
			totalKeys: 0,
			categories: [],
			reason: reason,
		},
	};

	// Backup each specified key
	for (const key of keysToBackup) {
		const value = localStorage.getItem(key);
		if (value !== null) {
			backup.localStorage[key] = value;

			// Track categories
			const keyInfo = LOCAL_STORAGE_KEYS.find((info) => info.key === key);
			if (keyInfo && !backup.metadata.categories.includes(keyInfo.category)) {
				backup.metadata.categories.push(keyInfo.category);
			}
		}
	}

	backup.metadata.totalKeys = Object.keys(backup.localStorage).length;

	return backup;
}

/**
 * Save a backup to localStorage.
 *
 * Stores the backup in a special backup registry. Old backups
 * are pruned to stay within MAX_BACKUPS limit.
 */
export function saveBackup(backup: StorageBackup): void {
	if (typeof localStorage === "undefined") return;

	// Load existing backups
	const backups = loadBackupsInternal();
	backups.unshift(backup); // Add to front

	// Prune old backups
	if (backups.length > MAX_BACKUPS) {
		backups.length = MAX_BACKUPS;
	}

	try {
		localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
	} catch {
		// Storage full, try to save without the oldest backup
		if (backups.length > 1) {
			backups.length = MAX_BACKUPS - 1;
			try {
				localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
			} catch {
				// Still failing, give up
			}
		}
	}
}

/**
 * Load all backups from localStorage.
 */
export function loadBackups(): StorageBackup[] {
	return loadBackupsInternal();
}

/**
 * Restore a backup to localStorage.
 *
 * Writes all keys from the backup back to localStorage. Will
 * overwrite existing keys with backed-up values.
 */
export function restoreBackup(backup: StorageBackup): void {
	if (typeof localStorage === "undefined") return;

	for (const [key, value] of Object.entries(backup.localStorage)) {
		try {
			localStorage.setItem(key, value);
		} catch {
			// Individual key write failed, continue with others
		}
	}
}

/**
 * Delete a specific backup.
 */
export function deleteBackup(backupId: string): void {
	const backups = loadBackupsInternal();
	const filtered = backups.filter((b) => b.id !== backupId);

	try {
		localStorage.setItem(BACKUP_KEY, JSON.stringify(filtered));
	} catch {
		// Storage error, ignore
	}
}

/**
 * Clear all backups.
 */
export function clearAllBackups(): void {
	if (typeof localStorage === "undefined") return;
	localStorage.removeItem(BACKUP_KEY);
}

/**
 * Load backups from internal storage.
 */
function loadBackupsInternal(): StorageBackup[] {
	if (typeof localStorage === "undefined") return [];

	try {
		const raw = localStorage.getItem(BACKUP_KEY);
		if (!raw) return [];
		return JSON.parse(raw) as StorageBackup[];
	} catch {
		return [];
	}
}

/**
 * Generate a unique backup ID.
 */
function generateBackupId(): string {
	return `backup-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/* ═══════════════════════════════════════════════════════════════
   Panic Wipe Execution
   ═══════════════════════════════════════════════════════════════ */

/**
 * Execute a panic wipe with full audit trail.
 *
 * This is the core function that implements panic wipe, duress mode,
 * and rotation cleanup. It creates an audit event, optionally backs
 * up specified keys, and wipes the rest.
 *
 * @param trigger - What triggered the wipe
 * @param options - Optional configuration
 * @returns The wipe event that was recorded
 */
export async function executePanicWipe(
	trigger: PanicWipeEvent["trigger"],
	options: {
		reason?: string;
		backupKeys?: string[]; // Keys to backup before wiping
		backupLabel?: string; // Label for the backup
		testMode?: boolean; // If true, record but don't actually wipe
	} = {},
): Promise<PanicWipeEvent> {
	const { reason, backupKeys, backupLabel, testMode = false } = options;

	// Determine wipe mode from trigger
	const mode =
		trigger === "duress"
			? "duress"
			: trigger === "rotation"
				? "rotation"
				: "panic";

	// Get keys to wipe and preserve
	const keysToWipe = getKeysForWipe(mode);
	const keysToPreserve = backupKeys || getKeysForPreserve(mode);

	// Create backup if requested
	let backup: StorageBackup | undefined;
	if (backupKeys && backupLabel) {
		backup = createBackup(
			backupKeys,
			backupLabel,
			reason || "backup before wipe",
		);
		saveBackup(backup);
	}

	// Record storage size before wipe
	const sizeBefore = estimateStorageSize();

	// Execute wipe (unless test mode)
	const wipedKeys: string[] = [];
	if (!testMode && typeof localStorage !== "undefined") {
		for (const key of keysToWipe) {
			if (localStorage.getItem(key) !== null) {
				localStorage.removeItem(key);
				wipedKeys.push(key);
			}
		}
	} else {
		// In test mode, report what would be wiped
		for (const key of keysToWipe) {
			if (
				typeof localStorage !== "undefined" &&
				localStorage.getItem(key) !== null
			) {
				wipedKeys.push(key);
			}
		}
	}

	// Clear IndexedDB stores (unless test mode)
	const clearedStores: Array<{ dbName: string; storeName: string }> = [];
	const storesToClear = getStoresForClear(mode);

	if (!testMode) {
		for (const store of storesToClear) {
			try {
				// Clear each store
				await clearIndexedDBStore(store.dbName, store.storeName);
				clearedStores.push(store);
			} catch {
				// Store clear failed, log but continue
			}
		}
	} else {
		// In test mode, report what would be cleared
		clearedStores.push(...storesToClear);
	}

	// Create wipe event
	const event: PanicWipeEvent = {
		id: `wipe-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
		timestamp: Date.now(),
		trigger,
		wipedKeys,
		preservedKeys: keysToPreserve,
		clearedStores,
		reason,
		sizeBefore,
	};

	// Record in audit log
	recordWipeEvent(event);

	return event;
}

/**
 * Clear a specific IndexedDB object store.
 */
async function clearIndexedDBStore(
	dbName: string,
	storeName: string,
): Promise<void> {
	if (typeof indexedDB === "undefined") {
		throw new Error("IndexedDB not available");
	}

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(dbName);

		request.onerror = () =>
			reject(new Error(`Failed to open database: ${dbName}`));
		request.onsuccess = () => {
			const db = request.result;

			try {
				const transaction = db.transaction([storeName], "readwrite");
				const store = transaction.objectStore(storeName);

				const clearRequest = store.clear();

				clearRequest.onsuccess = () => {
					db.close();
					resolve();
				};

				clearRequest.onerror = () => {
					db.close();
					reject(new Error(`Failed to clear store: ${storeName}`));
				};
			} catch (error) {
				db.close();
				reject(error);
			}
		};
	});
}

/* ═══════════════════════════════════════════════════════════════
   Storage Health & Integrity
   ═══════════════════════════════════════════════════════════════ */

/**
 * Check storage health and return a diagnostic report.
 *
 * Useful for detecting corruption, orphaned keys, and storage
 * pressure issues.
 */
export function getStorageHealthReport(): {
	totalKeys: number;
	registeredKeys: number;
	unknownKeys: string[];
	estimatedSize: number;
	auditEvents: number;
	backups: number;
	warnings: string[];
} {
	const actualKeys = scanActualKeys();
	const unknownKeys = findUnknownKeys();
	const auditLog = loadAuditLog();
	const backups = loadBackups();
	const estimatedSize = estimateStorageSize();

	const warnings: string[] = [];

	// Check for unknown keys
	if (unknownKeys.length > 0) {
		warnings.push(`Found ${unknownKeys.length} unknown/unregistered keys`);
	}

	// Check storage size (approximate 5MB typical limit)
	if (estimatedSize > 4_000_000) {
		warnings.push(
			`LocalStorage approaching quota limit (~${Math.round(estimatedSize / 1024 / 1024)}MB)`,
		);
	}

	// Check for excessive audit events
	if (auditLog.length > 50) {
		warnings.push(
			`Audit log has ${auditLog.length} events (consider clearing)`,
		);
	}

	// Check for excessive backups
	if (backups.length > 3) {
		warnings.push(`Storage has ${backups.length} backups (consider pruning)`);
	}

	return {
		totalKeys: actualKeys.length,
		registeredKeys: LOCAL_STORAGE_KEYS.length,
		unknownKeys,
		estimatedSize,
		auditEvents: auditLog.length,
		backups: backups.length,
		warnings,
	};
}
