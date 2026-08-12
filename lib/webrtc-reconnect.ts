/**
 * V FOR X — WebRTC Reconnect / ICE Restart (Phase 12 — todo-003)
 *
 * P2P rooms die for boring reasons: a NAT mapping lapses, a mobile peer
 * switches cell→wifi, an ICE path flaps. Losing the *room code* on every
 * hiccup forces users to re-share a join token — unusable under stress.
 *
 * This lib owns the reconnect *state machine* and the backoff scheduler
 * so the room layer can (a) keep the room code stable across drops and
 * (b) fire an ICE restart at the right moment without burning the peer.
 *
 *   • NEW → CONNECTED on first ICE success
 *   • CONNECTED → DISCONNECTED (transient) → scheduleReconnect() w/ backoff
 *   • DISCONNECTED → FAILED (iceConnectionState "failed") → restartICE()
 *   • too many attempts → stop trying; user must re-engage
 *   • a clean hangup (cleanupReconnectState) → CLOSED, timers cleared
 *
 * Transport-agnostic: the caller wires restartICE()/scheduleReconnect()
 * to its own RTCPeerConnection. The room code is persisted separately
 * so a reconnect reuses it — the join token never has to be re-shared.
 *
 * Type naming: `ReconnectState` is the mutable state OBJECT (returned by
 * initReconnectState); `ConnectionState` is the string union label that
 * lives on `ReconnectState.state`. This matches the existing test contract.
 *
 * Fully offline. No servers, no signaling — that stays in lib/signal-relay.
 */

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export type ConnectionState =
	| "new"
	| "connected"
	| "disconnected"
	| "reconnecting"
	| "failed"
	| "closed";

export interface ReconnectConfig {
	/** Max reconnect attempts before giving up. */
	maxAttempts: number;
	/** First backoff delay in ms. */
	initialBackoffMs: number;
	/** Hard cap on a single backoff delay. */
	maxBackoffMs: number;
	/** Exponential growth factor (e.g. 2.0). */
	backoffMultiplier: number;
	/** Keepalive ping interval in ms. */
	keepaliveIntervalMs: number;
	/** Consider the connection dead after this many ms without ICE. */
	connectionTimeoutMs: number;
}

export const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
	maxAttempts: 5,
	initialBackoffMs: 1_000,
	maxBackoffMs: 10_000,
	backoffMultiplier: 2.0,
	keepaliveIntervalMs: 5_000,
	connectionTimeoutMs: 30_000,
};

export interface ReconnectState {
	state: ConnectionState;
	attempt: number;
	currentBackoffMs: number;
	iceRestartInProgress: boolean;
	connectedAt: number | null;
	lastAttemptAt: number | null;
	keepaliveTimerId: TimerHandle | null;
	reconnectTimerId: TimerHandle | null;
}

/** Opaque timer handle — number in browsers, Timeout under Node; both accepted. */
export type TimerHandle = ReturnType<typeof setTimeout> | number;

export const ROOM_CODE_STORAGE_KEY = "vfx-webrtc-room-code";

/* ═══════════════════════════════════════════════════════════════
   State lifecycle
   ═══════════════════════════════════════════════════════════════ */

/** Create a fresh reconnect state at "new" with the default backoff. */
export function initReconnectState(config: ReconnectConfig | null = DEFAULT_RECONNECT_CONFIG): ReconnectState {
	const cfg = config ?? DEFAULT_RECONNECT_CONFIG;
	return {
		state: "new",
		attempt: 0,
		currentBackoffMs: cfg.initialBackoffMs,
		iceRestartInProgress: false,
		connectedAt: null,
		lastAttemptAt: null,
		keepaliveTimerId: null,
		reconnectTimerId: null,
	};
}

/**
 * Apply a transport event. Returns a NEW state object. On "connected"
 * the attempt counter + backoff reset; on "disconnected" the lastAttemptAt
 * is stamped so the scheduler knows when to fire. Never throws.
 */
export function updateConnectionState(
	state: ReconnectState,
	event: ConnectionState,
	config: ReconnectConfig | null = DEFAULT_RECONNECT_CONFIG,
): ReconnectState {
	const cfg = config ?? DEFAULT_RECONNECT_CONFIG;
	const now = Date.now();
	switch (event) {
		case "connected":
			return {
				...state,
				state: "connected",
				attempt: 0,
				currentBackoffMs: cfg.initialBackoffMs,
				iceRestartInProgress: false,
				connectedAt: now,
			};
		case "disconnected":
			return { ...state, state: "disconnected", lastAttemptAt: now };
		case "failed":
			return { ...state, state: "failed", iceRestartInProgress: false };
		case "reconnecting":
			return { ...state, state: "reconnecting" };
		case "closed":
			return { ...state, state: "closed" };
		default:
			return state;
	}
}

/* ═══════════════════════════════════════════════════════════════
   Backoff math
   ═══════════════════════════════════════════════════════════════ */

/** Exponential backoff for the next attempt, capped at maxBackoffMs. */
export function calculateNextBackoff(state: ReconnectState, config: ReconnectConfig): number {
	const raw = state.currentBackoffMs * config.backoffMultiplier;
	return Math.min(raw, config.maxBackoffMs);
}

/** Increment the attempt counter and advance the backoff window. */
export function incrementAttempt(state: ReconnectState, config: ReconnectConfig): ReconnectState {
	const now = Date.now();
	return {
		...state,
		attempt: state.attempt + 1,
		lastAttemptAt: now,
		currentBackoffMs: calculateNextBackoff(state, config),
	};
}

/** True if a reconnect should still be tried (disconnected + under cap). */
export function shouldAttemptReconnect(state: ReconnectState, config: ReconnectConfig): boolean {
	if (state.state === "connected" || state.state === "closed") return false;
	if (state.state !== "disconnected" && state.state !== "reconnecting") return false;
	return state.attempt < config.maxAttempts;
}

/** True if the connection has been down longer than the timeout window. */
export function isConnectionTimedOut(state: ReconnectState, config: ReconnectConfig): boolean {
	if (state.state !== "disconnected" && state.state !== "reconnecting") return false;
	if (!state.lastAttemptAt) return false;
	return Date.now() - state.lastAttemptAt > config.connectionTimeoutMs;
}

/* ═══════════════════════════════════════════════════════════════
   ICE restart + keepalive + scheduling seams
   ═══════════════════════════════════════════════════════════════ */

/** Mark that an ICE restart is in flight (caller invokes real restartIce). */
export function restartICE(state: ReconnectState): ReconnectState {
	return { ...state, iceRestartInProgress: true };
}

/** True when a failed/dropped link needs an ICE restart rather than a full reconnect. */
export function needsIceRestart(state: ReconnectState): boolean {
	return state.state === "failed" || (state.state === "disconnected" && state.attempt === 0);
}

/** Start a keepalive timer on the state; caller owns the ping callback. */
export function startKeepalive(
	state: ReconnectState,
	ping: () => void,
	config: ReconnectConfig | null = DEFAULT_RECONNECT_CONFIG,
): ReconnectState {
	const cfg = config ?? DEFAULT_RECONNECT_CONFIG;
	stopKeepalive(state);
	const id = setInterval(() => {
		try {
			ping();
		} catch {
			/* never throw from a keepalive ping */
		}
	}, cfg.keepaliveIntervalMs);
	return { ...state, keepaliveTimerId: id };
}

/** Clear the keepalive timer. */
export function stopKeepalive(state: ReconnectState): ReconnectState {
	if (state.keepaliveTimerId !== null) {
		clearInterval(state.keepaliveTimerId);
	}
	return { ...state, keepaliveTimerId: null };
}

/** Schedule a reconnect attempt after the current backoff; id stored on state. */
export function scheduleReconnect(
	state: ReconnectState,
	attempt: () => void,
	config: ReconnectConfig | null = DEFAULT_RECONNECT_CONFIG,
): ReconnectState {
	void config;
	if (state.reconnectTimerId !== null) clearTimeout(state.reconnectTimerId);
	const id = setTimeout(() => {
		try {
			attempt();
		} catch {
			/* never throw from a scheduled attempt */
		}
	}, state.currentBackoffMs);
	return { ...state, reconnectTimerId: id, state: "reconnecting" };
}

/** Tear down all timers and mark CLOSED. Safe to call repeatedly. */
export function cleanupReconnectState(state: ReconnectState): ReconnectState {
	if (state.keepaliveTimerId !== null) clearInterval(state.keepaliveTimerId);
	if (state.reconnectTimerId !== null) clearTimeout(state.reconnectTimerId);
	return { ...state, state: "closed", keepaliveTimerId: null, reconnectTimerId: null };
}

/* ═══════════════════════════════════════════════════════════════
   UI helpers
   ═══════════════════════════════════════════════════════════════ */

/** Human-readable label for a connection state. */
export function getConnectionStateLabel(state: ConnectionState): string {
	switch (state) {
		case "connected":
			return "Connected";
		case "reconnecting":
			return "Reconnecting...";
		case "failed":
			return "Connection Failed";
		case "disconnected":
			return "Disconnected";
		case "closed":
			return "Closed";
		default:
			return "New";
	}
}

/** Progress 0–100 toward the max-attempts ceiling (for UI badges). */
export function getReconnectProgress(state: ReconnectState, config: ReconnectConfig): number {
	if (config.maxAttempts <= 0) return 100;
	if (state.attempt <= 0) return 0;
	if (state.attempt >= config.maxAttempts) return 100;
	return Math.round((state.attempt / config.maxAttempts) * 100);
}

/* ═══════════════════════════════════════════════════════════════
   Room code persistence (the whole point: don't re-share on reconnect)
   ═══════════════════════════════════════════════════════════════ */

export function saveRoomCode(code: string): void {
	if (typeof code !== "string" || code.length === 0) return;
	try {
		localStorage.setItem(ROOM_CODE_STORAGE_KEY, code);
	} catch {
		/* storage unavailable / quota — never throw */
	}
}

export function loadRoomCode(): string | null {
	try {
		return localStorage.getItem(ROOM_CODE_STORAGE_KEY);
	} catch {
		return null;
	}
}

export function clearRoomCode(): void {
	try {
		localStorage.removeItem(ROOM_CODE_STORAGE_KEY);
	} catch {
		/* never throw */
	}
}
