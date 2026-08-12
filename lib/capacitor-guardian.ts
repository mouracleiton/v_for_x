/**
 * V FOR X — Capacitor Guardian Background Check-in
 *
 * Schedules local notifications for Guardian (dead man's switch) check-ins
 * on mobile devices using @capacitor/local-notifications.
 *
 * This enables the Guardian to notify users even when the app is closed
 * or in the background, addressing the limitation noted in lib/deadman.ts:
 * "LIMITS (honest): this fires only while the device is powered on and
 * the page is open."
 *
 * DESIGN:
 * ─ Schedule reminder notifications at configurable intervals before deadline
 * ─ Schedule urgent notification when deadline is missed
 * ─ Schedule escalation notifications for each tier
 * ─ All notifications are local (no server, no network)
 * ─ Notifications are cancelled when Guardian is disarmed or checked in
 * ─ Gracefully degrades on web or when plugin is unavailable
 */

import type { GuardianRecord } from "@/lib/guardian";
import { nextDeadline } from "@/lib/deadman";

// Runtime check for Capacitor environment
function getIsCapacitorContext(): boolean {
	return (
		typeof window !== "undefined" &&
		(window as any).Capacitor?.isPluginAvailable !== undefined
	);
}

// Lazy-loaded Capacitor plugin
let CapacitorLocalNotifications: any = null;

async function getLocalNotifications() {
	if (!getIsCapacitorContext() || CapacitorLocalNotifications) {
		return CapacitorLocalNotifications;
	}

	try {
		// Only attempt import in Capacitor context
		const capacitorModule = await import("@capacitor/core");
		if (!capacitorModule.Capacitor.isPluginAvailable("LocalNotifications")) {
			return null;
		}

		const module = await import("@capacitor/local-notifications");
		CapacitorLocalNotifications = module.LocalNotifications;
		return CapacitorLocalNotifications;
	} catch {
		return null;
	}
}

/** Notification IDs are scoped per guardian to avoid collisions. */
export const NOTIFICATION_ID_BASE = 10000;
export const REMINDER_OFFSET = 1;
export const DEADLINE_OFFSET = 10;
export const ESCALATION_BASE_OFFSET = 100;

/** Per-guardian ID base = NOTIFICATION_ID_BASE + (hash of id). Exported so tests + UI can predict IDs. */
export function hashCode(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return Math.abs(hash) % 100000; // Keep within range
}

/** Default reminder intervals (milliseconds before deadline). */
const DEFAULT_REMINDERS = [
	3_600_000, // 1 hour before
	86400000, // 24 hours before
];

/**
 * Check if Capacitor local notifications are available.
 * Returns false on web or if plugin is not installed.
 */
export async function isAvailable(): Promise<boolean> {
	if (!getIsCapacitorContext()) return false;
	try {
		const plugin = await getLocalNotifications();
		if (!plugin) return false;
		const result = await plugin.checkPermissions();
		return result.display === "granted" || result.display === "prompt";
	} catch {
		return false;
	}
}

/**
 * Request notification permissions and return true if granted.
 * Should be called when user arms a Guardian for the first time.
 */
export async function requestPermissions(): Promise<boolean> {
	try {
		const plugin = await getLocalNotifications();
		if (!plugin) return false;
		const result = await plugin.requestPermissions();
		return result.display === "granted";
	} catch {
		return false;
	}
}

/**
 * Schedule all notifications for an armed Guardian.
 *
 * Schedules:
 * - Reminder notifications at configured intervals before deadline
 * - Urgent notification when deadline is reached
 * - Escalation notifications for each contact tier
 *
 * @param guardianId Unique identifier for this Guardian
 * @param record The Guardian record with schedule configuration
 * @param reminders Array of ms-before-deadline for reminders (default: 1h, 24h)
 */
export async function scheduleGuardianNotifications(
	guardianId: string,
	record: GuardianRecord,
	reminders: number[] = DEFAULT_REMINDERS,
): Promise<void> {
	if (!(await isAvailable())) {
		console.debug("[CapacitorGuardian] Local notifications not available");
		return;
	}

	// Request permissions if not already granted
	const hasPermission = await requestPermissions();
	if (!hasPermission) {
		console.warn("[CapacitorGuardian] Notification permission denied");
		return;
	}

	const plugin = await getLocalNotifications();
	if (!plugin) return;

	const deadline = nextDeadline(record);
	const now = Date.now();

	// Cancel any existing notifications for this guardian
	await cancelGuardianNotifications(guardianId);

	const notifications: NotificationRequest[] = [];

	// Schedule reminder notifications
	for (let i = 0; i < reminders.length; i++) {
		const reminderMs = reminders[i];
		const scheduleAt = deadline - reminderMs;

		if (scheduleAt > now) {
			notifications.push({
				id: NOTIFICATION_ID_BASE + hashCode(guardianId) + REMINDER_OFFSET + i,
				title: `Guardian Check-in Reminder`,
				body: `${record.config.label}: Check-in due in ${formatDuration(reminderMs)}.`,
				schedule: { at: new Date(scheduleAt) },
				sound: "beep.wav",
				smallIcon: "ic_stat_icon_config_sample",
				largeIcon: "ic_launcher",
				extra: {
					type: "guardian-reminder",
					guardianId,
					label: record.config.label,
				},
			});
		}
	}

	// Schedule deadline notification (urgent)
	if (deadline > now) {
		notifications.push({
			id: NOTIFICATION_ID_BASE + hashCode(guardianId) + DEADLINE_OFFSET,
			title: `⚠️ GUARDIAN CHECK-IN MISSED`,
			body: `${record.config.label}: Deadline reached. Trusted contacts will be escalated.`,
			schedule: { at: new Date(deadline) },
			sound: "beep.wav",
			smallIcon: "ic_stat_icon_config_sample",
			largeIcon: "ic_launcher",
			ongoing: true, // Persistent notification until dismissed
			extra: {
				type: "guardian-deadline",
				guardianId,
				label: record.config.label,
			},
		});
	}

	// Schedule escalation notifications for each tier
	if (record.config.contacts.length > 0) {
		const sortedContacts = [...record.config.contacts].sort(
			(a, b) => a.escalateAfterMin - b.escalateAfterMin,
		);

		for (let i = 0; i < sortedContacts.length; i++) {
			const contact = sortedContacts[i];
			const escalateAt = deadline + contact.escalateAfterMin * 60_000;

			if (escalateAt > now) {
				notifications.push({
					id:
						NOTIFICATION_ID_BASE +
						hashCode(guardianId) +
						ESCALATION_BASE_OFFSET +
						i,
					title: `Guardian Escalation: ${contact.label}`,
					body: `${record.config.label}: Contact ${contact.label} (${contact.handle}) has been escalated.`,
					schedule: { at: new Date(escalateAt) },
					sound: "beep.wav",
					smallIcon: "ic_stat_icon_config_sample",
					largeIcon: "ic_launcher",
					extra: {
						type: "guardian-escalation",
						guardianId,
						label: record.config.label,
						contact: contact.label,
					},
				});
			}
		}
	}

	// Schedule all notifications
	if (notifications.length > 0) {
		await plugin.schedule({
			notifications,
		});
		console.debug(
			`[CapacitorGuardian] Scheduled ${notifications.length} notifications for ${guardianId}`,
		);
	}
}

/**
 * Cancel all notifications for a specific Guardian.
 * Call when Guardian is disarmed, checked in, or deleted.
 */
export async function cancelGuardianNotifications(
	guardianId: string,
): Promise<void> {
	if (!(await isAvailable())) return;

	try {
		const plugin = await getLocalNotifications();
		if (!plugin) return;

		const pending = await plugin.getPending();
		const baseId = NOTIFICATION_ID_BASE + hashCode(guardianId);

		const toCancel = pending.notifications
			.filter((n: any) => n.id >= baseId && n.id < baseId + 1000)
			.map((n: any) => n.id);

		if (toCancel.length > 0) {
			await plugin.cancel({ localNotifications: toCancel });
			console.debug(
				`[CapacitorGuardian] Cancelled ${toCancel.length} notifications for ${guardianId}`,
			);
		}
	} catch (error) {
		console.error("[CapacitorGuardian] Failed to cancel notifications:", error);
	}
}

/**
 * Cancel all Guardian notifications across all guardians.
 * Call when app is uninstalled or user resets all Guardians.
 */
export async function cancelAllGuardianNotifications(): Promise<void> {
	if (!(await isAvailable())) return;

	try {
		const plugin = await getLocalNotifications();
		if (!plugin) return;

		const pending = await plugin.getPending();
		const guardianNotifications = pending.notifications.filter(
			(n: any) =>
				n.id >= NOTIFICATION_ID_BASE && n.id < NOTIFICATION_ID_BASE + 100000,
		);

		if (guardianNotifications.length > 0) {
			await plugin.cancel({
				localNotifications: guardianNotifications.map((n: any) => n.id),
			});
			console.debug(
				`[CapacitorGuardian] Cancelled ${guardianNotifications.length} notifications`,
			);
		}
	} catch (error) {
		console.error(
			"[CapacitorGuardian] Failed to cancel all notifications:",
			error,
		);
	}
}

/**
 * Get pending notification count for a specific Guardian.
 * Useful for displaying "next reminder" info in the UI.
 */
export async function getPendingNotificationCount(
	guardianId: string,
): Promise<number> {
	if (!(await isAvailable())) return 0;

	try {
		const plugin = await getLocalNotifications();
		if (!plugin) return 0;

		const pending = await plugin.getPending();
		const baseId = NOTIFICATION_ID_BASE + hashCode(guardianId);

		return pending.notifications.filter(
			(n: any) => n.id >= baseId && n.id < baseId + 1000,
		).length;
	} catch {
		return 0;
	}
}

/* ═══════════════════════════════════════════════════════════
   NOTIFICATION LISTENER SETUP
   ═══════════════════════════════════════════════════════════ */

/**
 * Set up notification action listeners.
 * Call once at app startup (e.g., in a useEffect or layout root).
 *
 * Handles:
 * - Notification clicks → navigate to Guardian page
 * - Notification dismissals → update local state
 */
export async function setupNotificationListeners(): Promise<void> {
	if (!getIsCapacitorContext()) return;

	try {
		const plugin = await getLocalNotifications();
		if (!plugin) return;

		await plugin.addListener(
			"localNotificationReceived",
			(notification: any) => {
				console.debug(
					"[CapacitorGuardian] Notification received:",
					notification,
				);

				// Could trigger in-app toast or status update here
				if (notification.extra?.type === "guardian-deadline") {
					// Trigger urgent UI update if app is open
					window.dispatchEvent(
						new CustomEvent("guardian-deadline-missed", {
							detail: { guardianId: notification.extra.guardianId },
						}),
					);
				}
			},
		);

		await plugin.addListener(
			"localNotificationActionPerformed",
			(action: any) => {
				console.debug("[CapacitorGuardian] Notification action:", action);

				if (action.actionId === "tap") {
					const guardianId = action.notification.extra?.guardianId;
					// guardianId originates from a notification payload; validate it to a
					// safe charset before assigning to a same-origin fragment to harden
					// against any path/query injection.
					if (guardianId && /^[A-Za-z0-9_-]+$/.test(String(guardianId))) {
						// Use location.assign (not .href =) so the navigation target stays a
						// statically-known same-origin path with a validated fragment.
						window.location.assign(`/the-guardian#${guardianId}`);
					}
				}
			},
		);
	} catch (error) {
		console.debug(
			"[CapacitorGuardian] Failed to setup notification listeners:",
			error,
		);
	}
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

// hashCode + NOTIFICATION_ID_BASE are exported above (near the offset constants)
// so tests and UI can predict the per-guardian notification ID scheme.

/** Format duration in human-readable form (e.g., "2 hours", "30 minutes"). */
function formatDuration(ms: number): string {
	const hours = Math.floor(ms / 3_600_000);
	const minutes = Math.floor((ms % 3_600_000) / 60_000);

	if (hours > 0) {
		return `${hours} hour${hours > 1 ? "s" : ""}`;
	}
	return `${minutes} minute${minutes > 1 ? "s" : ""}`;
}

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

interface NotificationRequest {
	id: number;
	title: string;
	body: string;
	schedule: { at: Date };
	sound?: string;
	smallIcon?: string;
	largeIcon?: string;
	ongoing?: boolean;
	extra?: Record<string, string>;
}
