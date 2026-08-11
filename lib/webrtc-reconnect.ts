/**
 * V FOR X — WebRTC Reconnection & ICE Restart (The Web v2)
 *
 * Handles WebRTC connection recovery when the peer connection fails
 * or the network changes. Implements ICE restart without losing the
 * room code, automatic reconnection with exponential backoff, and
 * connection state tracking.
 *
 * Works with the existing signal-relay.ts signaling layer and extends
 * RTCPeerConnection management to handle network disruptions gracefully.
 */

export type ConnectionState =
  | "new"
  | "checking"
  | "connected"
  | "disconnected"
  | "failed"
  | "closed"
  | "reconnecting";

export interface ReconnectConfig {
  /** Maximum number of reconnection attempts */
  maxAttempts: number;
  /** Initial backoff delay in milliseconds */
  initialBackoffMs: number;
  /** Maximum backoff delay in milliseconds */
  maxBackoffMs: number;
  /** Backoff multiplier (exponential) */
  backoffMultiplier: number;
  /** How often to send keepalive pings (ms) */
  keepaliveIntervalMs: number;
  /** Connection timeout in milliseconds */
  connectionTimeoutMs: number;
}

export interface ReconnectState {
  /** Current connection state */
  state: ConnectionState;
  /** Number of reconnection attempts made */
  attempt: number;
  /** Timestamp of last connection attempt */
  lastAttemptAt: number;
  /** Timestamp of successful connection */
  connectedAt: number;
  /** Current backoff delay */
  currentBackoffMs: number;
  /** Whether ICE restart is in progress */
  iceRestartInProgress: boolean;
  /** Keepalive timer ID */
  keepaliveTimerId: number | null;
  /** Reconnect timer ID */
  reconnectTimerId: number | null;
}

const DEFAULT_CONFIG: ReconnectConfig = {
  maxAttempts: 10,
  initialBackoffMs: 1000, // 1 second
  maxBackoffMs: 60000, // 1 minute
  backoffMultiplier: 1.5,
  keepaliveIntervalMs: 15000, // 15 seconds
  connectionTimeoutMs: 30000, // 30 seconds
};

/* ═══════════════════════════════════════════════════════════
   Reconnection State Management
═══════════════════════════════════════════════════════════ */

/**
 * Initialize a new reconnection state.
 */
export function initReconnectState(): ReconnectState {
  return {
    state: "new",
    attempt: 0,
    lastAttemptAt: 0,
    connectedAt: 0,
    currentBackoffMs: DEFAULT_CONFIG.initialBackoffMs,
    iceRestartInProgress: false,
    keepaliveTimerId: null,
    reconnectTimerId: null,
  };
}

/**
 * Update the connection state and trigger appropriate actions.
 */
export function updateConnectionState(
  state: ReconnectState,
  newState: ConnectionState,
  pc: RTCPeerConnection | null
): ReconnectState {
  const oldState = state.state;
  state.state = newState;

  // Clear timers when state changes significantly
  if (newState === "connected" && oldState !== "connected") {
    state.attempt = 0;
    state.currentBackoffMs = DEFAULT_CONFIG.initialBackoffMs;
    state.connectedAt = Date.now();
    state.iceRestartInProgress = false;
  } else if (newState === "failed" || newState === "closed") {
    clearTimers(state);
  } else if (newState === "disconnected") {
    // Start reconnection process whenever we become disconnected
    state.lastAttemptAt = Date.now();
  }

  return state;
}

/**
 * Calculate the next backoff delay with exponential increase.
 */
export function calculateNextBackoff(state: ReconnectState, config: ReconnectConfig): number {
  const nextDelay = Math.min(
    state.currentBackoffMs * config.backoffMultiplier,
    config.maxBackoffMs
  );
  return Math.floor(nextDelay);
}

/**
 * Increment reconnection attempt and update backoff.
 */
export function incrementAttempt(state: ReconnectState, config: ReconnectConfig): ReconnectState {
  state.attempt += 1;
  state.lastAttemptAt = Date.now();
  state.currentBackoffMs = calculateNextBackoff(state, config);
  return state;
}

/**
 * Check if reconnection should be attempted.
 */
export function shouldAttemptReconnect(state: ReconnectState, config: ReconnectConfig): boolean {
  return state.attempt < config.maxAttempts &&
    (state.state === "disconnected" || state.state === "failed");
}

/**
 * Check if the connection has timed out.
 */
export function isConnectionTimedOut(state: ReconnectState, config: ReconnectConfig): boolean {
  if (state.state !== "connected" || state.connectedAt === 0) {
    return false;
  }
  const idleTime = Date.now() - state.connectedAt;
  return idleTime > config.connectionTimeoutMs;
}

/* ═══════════════════════════════════════════════════════════
   ICE Restart (Connection Refresh)
═══════════════════════════════════════════════════════════ */

/**
 * Perform an ICE restart on the peer connection.
 *
 * ICE restart creates new ICE candidates and attempts to re-establish
 * the connection through a different path. Useful when the network
 * changes or the original connection path fails.
 */
export async function restartICE(
  pc: RTCPeerConnection,
  state: ReconnectState,
  config: ReconnectConfig
): Promise<{ success: boolean; newState: ReconnectState }> {
  if (state.iceRestartInProgress) {
    return { success: false, newState: state };
  }

  state.iceRestartInProgress = true;
  state.state = "reconnecting";

  try {
    // Create a new offer with ICE restart
    const offer = await pc.createOffer({ iceRestart: true });
    await pc.setLocalDescription(offer);

    state.iceRestartInProgress = false;
    return { success: true, newState: state };
  } catch (error) {
    state.iceRestartInProgress = false;
    state.state = "failed";
    return { success: false, newState: state };
  }
}

/**
 * Check if ICE restart is needed based on connection state.
 */
export function needsIceRestart(state: ReconnectState, config: ReconnectConfig): boolean {
  return (state.state === "disconnected" || state.state === "failed") &&
    state.attempt < config.maxAttempts &&
    !state.iceRestartInProgress;
}

/* ═══════════════════════════════════════════════════════════
   Keepalive Monitoring
═══════════════════════════════════════════════════════════ */

/**
 * Start keepalive monitoring for a peer connection.
 *
 * Sends periodic pings via the data channel to detect connection
 * degradation early.
 */
export function startKeepalive(
  state: ReconnectState,
  config: ReconnectConfig,
  dc: RTCDataChannel | null,
  onKeepaliveFail: () => void
): ReconnectState {
  // Clear any existing timer
  stopKeepalive(state);

  if (!dc || dc.readyState !== "open") {
    return state;
  }

  const timerId = window.setInterval(() => {
    if (dc.readyState !== "open") {
      onKeepaliveFail();
      return;
    }

    try {
      dc.send(JSON.stringify({ type: "ping", ts: Date.now() }));
    } catch {
      onKeepaliveFail();
    }
  }, config.keepaliveIntervalMs);

  state.keepaliveTimerId = timerId;
  return state;
}

/**
 * Stop keepalive monitoring.
 */
export function stopKeepalive(state: ReconnectState): ReconnectState {
  if (state.keepaliveTimerId !== null) {
    clearInterval(state.keepaliveTimerId);
    state.keepaliveTimerId = null;
  }
  return state;
}

/**
 * Handle a keepalive ping response.
 */
export function handleKeepalivePong(
  state: ReconnectState,
  latencyMs: number
): ReconnectState {
  // Could track latency statistics here for quality metrics
  return state;
}

/* ═══════════════════════════════════════════════════════════
   Automatic Reconnection
═══════════════════════════════════════════════════════════ */

/**
 * Schedule the next reconnection attempt.
 */
export function scheduleReconnect(
  state: ReconnectState,
  config: ReconnectConfig,
  onReconnect: () => void
): ReconnectState {
  // Clear any existing reconnect timer
  if (state.reconnectTimerId !== null) {
    clearTimeout(state.reconnectTimerId);
  }

  if (!shouldAttemptReconnect(state, config)) {
    return state;
  }

  const delay = state.currentBackoffMs;
  const timerId = window.setTimeout(() => {
    onReconnect();
  }, delay);

  state.reconnectTimerId = timerId;
  return state;
}

/**
 * Clear all active timers (keepalive and reconnect).
 */
function clearTimers(state: ReconnectState): void {
  if (state.keepaliveTimerId !== null) {
    clearInterval(state.keepaliveTimerId);
    state.keepaliveTimerId = null;
  }
  if (state.reconnectTimerId !== null) {
    clearTimeout(state.reconnectTimerId);
    state.reconnectTimerId = null;
  }
}

/**
 * Cleanup reconnection state and clear all timers.
 */
export function cleanupReconnectState(state: ReconnectState): ReconnectState {
  clearTimers(state);
  state.state = "closed";
  state.iceRestartInProgress = false;
  return state;
}

/* ═══════════════════════════════════════════════════════════
   Peer Connection State Monitoring
═══════════════════════════════════════════════════════════ */

/**
 * Setup automatic reconnection handlers on a peer connection.
 *
 * Monitors connection state changes and triggers reconnection
 * when the connection fails.
 */
export function setupAutoReconnect(
  pc: RTCPeerConnection,
  state: ReconnectState,
  config: ReconnectConfig,
  onStateChange: (newState: ConnectionState) => void,
  onReconnectNeeded: () => void
): () => void {
  const handleConnectionStateChange = () => {
    const newState = pc.connectionState as ConnectionState;
    const updated = updateConnectionState(state, newState, pc);
    onStateChange(updated.state);

    if (updated.state === "disconnected" || updated.state === "failed") {
      if (shouldAttemptReconnect(updated, config)) {
        onReconnectNeeded();
      }
    }
  };

  const handleIceConnectionStateChange = () => {
    const iceState = pc.iceConnectionState;
    if (iceState === "disconnected" || iceState === "failed") {
      const updated = updateConnectionState(state, "disconnected", pc);
      onStateChange(updated.state);

      if (shouldAttemptReconnect(updated, config)) {
        onReconnectNeeded();
      }
    }
  };

  pc.addEventListener("connectionstatechange", handleConnectionStateChange);
  pc.addEventListener("iceconnectionstatechange", handleIceConnectionStateChange);

  // Return cleanup function
  return () => {
    pc.removeEventListener("connectionstatechange", handleConnectionStateChange);
    pc.removeEventListener("iceconnectionstatechange", handleIceConnectionStateChange);
  };
}

/**
 * Manual reconnect trigger (user-initiated).
 *
 * Resets attempt counter and immediately attempts reconnection.
 */
export function triggerManualReconnect(
  state: ReconnectState,
  config: ReconnectConfig,
  onReconnect: () => void
): ReconnectState {
  state.attempt = 0;
  state.currentBackoffMs = config.initialBackoffMs;
  state.lastAttemptAt = Date.now();
  state.state = "reconnecting";

  // Schedule immediate reconnect
  return scheduleReconnect(state, config, onReconnect);
}

/* ═══════════════════════════════════════════════════════════
   Room Code Preservation
═══════════════════════════════════════════════════════════ */

/**
 * Ensure room code is preserved across reconnections.
 *
 * The room code from signal-relay.ts should be stored in localStorage
 * and restored after reconnection to maintain the same logical room.
 */
export const ROOM_CODE_STORAGE_KEY = "vfx-web-room-code";

/**
 * Save the current room code for reconnection.
 */
export function saveRoomCode(roomCode: string): void {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(ROOM_CODE_STORAGE_KEY, roomCode);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Load the saved room code.
 */
export function loadRoomCode(): string | null {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      return localStorage.getItem(ROOM_CODE_STORAGE_KEY);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Clear the saved room code (e.g., when explicitly leaving a room).
 */
export function clearRoomCode(): void {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(ROOM_CODE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   Utilities
═══════════════════════════════════════════════════════════ */

/**
 * Get human-readable status description.
 */
export function getConnectionStateLabel(state: ConnectionState): string {
  const labels: Record<ConnectionState, string> = {
    new: "Initializing",
    checking: "Connecting...",
    connected: "Connected",
    disconnected: "Disconnected",
    failed: "Connection Failed",
    closed: "Closed",
    reconnecting: "Reconnecting...",
  };
  return labels[state] || state;
}

/**
 * Get reconnection progress percentage.
 */
export function getReconnectProgress(state: ReconnectState, config: ReconnectConfig): number {
  if (state.attempt >= config.maxAttempts) {
    return 100;
  }
  return Math.min(100, (state.attempt / config.maxAttempts) * 100);
}

/**
 * Estimate time until next reconnection attempt.
 */
export function getNextAttemptDelay(state: ReconnectState): number {
  if (state.reconnectTimerId === null) {
    return 0;
  }
  return state.currentBackoffMs;
}
