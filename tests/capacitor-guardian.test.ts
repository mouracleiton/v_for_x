/**
 * V FOR X — Tests for Capacitor Guardian Background Check-in
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import type { GuardianRecord } from "@/lib/guardian";

// Mock Capacitor modules BEFORE importing the module under test
vi.mock("@capacitor/core", () => ({
	Capacitor: {
		isPluginAvailable: vi.fn(() => true),
	},
}));

const mockLocalNotifications = {
	checkPermissions: vi.fn(),
	requestPermissions: vi.fn(),
	schedule: vi.fn(),
	cancel: vi.fn(),
	getPending: vi.fn(),
	addListener: vi.fn(),
	removeListeners: vi.fn(),
};

vi.mock("@capacitor/local-notifications", () => ({
	LocalNotifications: mockLocalNotifications,
}));

// Mock window.Capacitor context
const mockCapacitor = {
	isPluginAvailable: vi.fn(() => true),
};

Object.defineProperty(window, "Capacitor", {
	value: mockCapacitor,
	writable: true,
	configurable: true,
});

import {
	isAvailable,
	requestPermissions,
	scheduleGuardianNotifications,
	cancelGuardianNotifications,
	cancelAllGuardianNotifications,
	getPendingNotificationCount,
	hashCode,
	NOTIFICATION_ID_BASE,
	setupNotificationListeners,
} from "@/lib/capacitor-guardian";

// Mock GuardianRecord for testing
// The lib derives per-guardian notification IDs as NOTIFICATION_ID_BASE + hashCode(id).
// "test-guardian-1" hashes to a baseId of 68352, so any in-range pending id must
// live in [baseId, baseId + 1000). Compute it once so these tests never go stale.
const baseId = NOTIFICATION_ID_BASE + hashCode("test-guardian-1");
const mockGuardianRecord: GuardianRecord = {
	id: "test-guardian-1",
	config: {
		label: "Test Guardian",
		checkInHours: 12,
		armedAt: Date.now() - 7200000,
		lastCheckIn: Date.now() - 3600000, // 1 hour ago
		contacts: [
			{
				id: "c1",
				label: "Editor",
				handle: "editor@news.com",
				escalateAfterMin: 30,
			},
			{
				id: "c2",
				label: "Lawyer",
				handle: "lawyer@rights.org",
				escalateAfterMin: 60,
			},
		],
		escalationMessage: "Test escalation message",
		safeCode: "1234",
		duressCode: "9999",
	},
	status: "armed",
	duressFlag: false,
	location: null,
	salt: "test-salt",
	verifyHash: "test-verify-hash",
	iterations: 150000,
	panicTriggeredAt: null,
	escalations: [],
};

describe("Capacitor Guardian", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("isAvailable", () => {
		it("returns true when permissions are granted", async () => {
			mockLocalNotifications.checkPermissions.mockResolvedValue({
				display: "granted",
			});

			const result = await isAvailable();

			expect(result).toBe(true);
		});

		it("returns true when permissions prompt is available", async () => {
			mockLocalNotifications.checkPermissions.mockResolvedValue({
				display: "prompt",
			});

			const result = await isAvailable();

			expect(result).toBe(true);
		});

		it("returns false when plugin throws", async () => {
			mockLocalNotifications.checkPermissions.mockRejectedValue(
				new Error("Plugin not installed"),
			);

			const result = await isAvailable();

			expect(result).toBe(false);
		});

		it("returns false when Capacitor context is not available", async () => {
			// @ts-expect-error - testing undefined window
			delete window.Capacitor;

			const result = await isAvailable();

			expect(result).toBe(false);

			// Restore for other tests
			(window as any).Capacitor = {
				isPluginAvailable: vi.fn(() => true),
			};
		});
	});

	describe("requestPermissions", () => {
		it("requests and returns granted status", async () => {
			mockLocalNotifications.requestPermissions.mockResolvedValue({
				display: "granted",
			});

			const result = await requestPermissions();

			expect(result).toBe(true);
			expect(mockLocalNotifications.requestPermissions).toHaveBeenCalledTimes(
				1,
			);
		});

		it("returns false when denied", async () => {
			mockLocalNotifications.requestPermissions.mockResolvedValue({
				display: "denied",
			});

			const result = await requestPermissions();

			expect(result).toBe(false);
		});

		it("returns false when plugin throws", async () => {
			mockLocalNotifications.requestPermissions.mockRejectedValue(
				new Error("Plugin error"),
			);

			const result = await requestPermissions();

			expect(result).toBe(false);
		});
	});

	describe("scheduleGuardianNotifications", () => {
		it("schedules reminder, deadline, and escalation notifications", async () => {
			mockLocalNotifications.checkPermissions.mockResolvedValue({
				display: "granted",
			});
			mockLocalNotifications.requestPermissions.mockResolvedValue({
				display: "granted",
			});
			mockLocalNotifications.getPending.mockResolvedValue({
				notifications: [],
			});

			await scheduleGuardianNotifications(
				"test-guardian-1",
				mockGuardianRecord,
				[3600000, 86400000], // 1 hour and 24 hour reminders
			);

			expect(mockLocalNotifications.schedule).toHaveBeenCalledWith(
				expect.objectContaining({
					notifications: expect.arrayContaining([
						expect.objectContaining({
							title: "Guardian Check-in Reminder",
							extra: expect.objectContaining({
								type: "guardian-reminder",
								guardianId: "test-guardian-1",
							}),
						}),
						expect.objectContaining({
							title: "⚠️ GUARDIAN CHECK-IN MISSED",
							extra: expect.objectContaining({
								type: "guardian-deadline",
								guardianId: "test-guardian-1",
							}),
						}),
						expect.objectContaining({
							title: "Guardian Escalation: Editor",
							extra: expect.objectContaining({
								type: "guardian-escalation",
								guardianId: "test-guardian-1",
							}),
						}),
					]),
				}),
			);
		});

		it("does not schedule reminders when deadline is in past", async () => {
			const pastDeadlineRecord: GuardianRecord = {
				...mockGuardianRecord,
				config: {
					...mockGuardianRecord.config,
					lastCheckIn: Date.now() - 86400000, // 24 hours ago
					checkInHours: 12,
				},
			};

			mockLocalNotifications.checkPermissions.mockResolvedValue({
				display: "granted",
			});
			mockLocalNotifications.requestPermissions.mockResolvedValue({
				display: "granted",
			});
			mockLocalNotifications.getPending.mockResolvedValue({
				notifications: [],
			});

			await scheduleGuardianNotifications(
				pastDeadlineRecord.id,
				pastDeadlineRecord,
			);

			// A past deadline still produces deadline + escalation notifications
			// (just no reminders). Guard the indexing in case nothing was scheduled.
			const scheduleCall = mockLocalNotifications.schedule.mock.calls[0];
			if (!scheduleCall) {
				// Nothing scheduled at all — trivially no reminders.
				return;
			}
			const notifications = scheduleCall[0].notifications;

			const reminders = notifications.filter(
				(n: any) => n.extra?.type === "guardian-reminder",
			);
			expect(reminders.length).toBe(0);
		});

		it("cancels existing notifications before scheduling new ones", async () => {
			mockLocalNotifications.checkPermissions.mockResolvedValue({
				display: "granted",
			});
			mockLocalNotifications.requestPermissions.mockResolvedValue({
				display: "granted",
			});
			mockLocalNotifications.getPending.mockResolvedValue({
				notifications: [{ id: baseId }],
			});
			mockLocalNotifications.cancel.mockResolvedValue(undefined as never);

			await scheduleGuardianNotifications(
				"test-guardian-1",
				mockGuardianRecord,
			);

			expect(mockLocalNotifications.cancel).toHaveBeenCalledWith({
				localNotifications: expect.arrayContaining([baseId]),
			});
			expect(mockLocalNotifications.schedule).toHaveBeenCalled();
		});

		it("gracefully exits when plugin is not available", async () => {
			mockLocalNotifications.checkPermissions.mockRejectedValue(
				new Error("Plugin not available"),
			);

			await expect(
				scheduleGuardianNotifications("test-guardian-1", mockGuardianRecord),
			).resolves.not.toThrow();

			expect(mockLocalNotifications.schedule).not.toHaveBeenCalled();
		});
	});

	describe("cancelGuardianNotifications", () => {
		it("cancels all notifications for a specific guardian", async () => {
			mockLocalNotifications.checkPermissions.mockResolvedValue({
				display: "granted",
			});
			mockLocalNotifications.getPending.mockResolvedValue({
				notifications: [
					{ id: baseId }, // In range
					{ id: baseId + 1 }, // In range
					{ id: 20000 }, // Out of range (different guardian)
				],
			});
			mockLocalNotifications.cancel.mockResolvedValue(undefined as never);

			await cancelGuardianNotifications("test-guardian-1");

			expect(mockLocalNotifications.cancel).toHaveBeenCalledWith({
				localNotifications: expect.arrayContaining([baseId, baseId + 1]),
			});
		});

		it("does not throw when plugin is not available", async () => {
			mockLocalNotifications.checkPermissions.mockRejectedValue(
				new Error("Plugin error"),
			);

			await expect(
				cancelGuardianNotifications("test-guardian-1"),
			).resolves.not.toThrow();
		});
	});

	describe("cancelAllGuardianNotifications", () => {
		it("cancels all guardian notifications across all guardians", async () => {
			mockLocalNotifications.checkPermissions.mockResolvedValue({
				display: "granted",
			});
			mockLocalNotifications.getPending.mockResolvedValue({
				notifications: [
					{ id: NOTIFICATION_ID_BASE + 1 },
					{ id: NOTIFICATION_ID_BASE + 500 },
					{ id: NOTIFICATION_ID_BASE + 10001 },
					{ id: NOTIFICATION_ID_BASE + 100000 }, // Out of range (>= ceiling)
				],
			});
			mockLocalNotifications.cancel.mockResolvedValue(undefined as never);

			await cancelAllGuardianNotifications();

			expect(mockLocalNotifications.cancel).toHaveBeenCalledWith({
				localNotifications: expect.arrayContaining([
					NOTIFICATION_ID_BASE + 1,
					NOTIFICATION_ID_BASE + 500,
					NOTIFICATION_ID_BASE + 10001,
				]),
			});
		});
	});

	describe("getPendingNotificationCount", () => {
		it("returns count of pending notifications for guardian", async () => {
			mockLocalNotifications.checkPermissions.mockResolvedValue({
				display: "granted",
			});
			mockLocalNotifications.getPending.mockResolvedValue({
				notifications: [
					{ id: baseId },
					{ id: baseId + 1 },
					{ id: 20000 }, // Different guardian
				],
			});

			const count = await getPendingNotificationCount("test-guardian-1");

			expect(count).toBe(2);
		});

		it("returns 0 when plugin is not available", async () => {
			mockLocalNotifications.checkPermissions.mockRejectedValue(
				new Error("Plugin error"),
			);

			const count = await getPendingNotificationCount("test-guardian-1");

			expect(count).toBe(0);
		});
	});

	describe("setupNotificationListeners", () => {
		it("sets up notification received listener", async () => {
			mockLocalNotifications.addListener.mockResolvedValue(undefined as never);

			await setupNotificationListeners();

			expect(mockLocalNotifications.addListener).toHaveBeenCalledWith(
				"localNotificationReceived",
				expect.any(Function),
			);
		});

		it("sets up notification action performed listener", async () => {
			mockLocalNotifications.addListener.mockResolvedValue(undefined as never);

			await setupNotificationListeners();

			expect(mockLocalNotifications.addListener).toHaveBeenCalledWith(
				"localNotificationActionPerformed",
				expect.any(Function),
			);
		});

		it("dispatches custom event on deadline notification", async () => {
			const dispatchEventSpy = vi.spyOn(window, "dispatchEvent");
			mockLocalNotifications.addListener.mockImplementation(
				(event: string, callback: any) => {
					if (event === "localNotificationReceived") {
						callback({
							id: 1,
							title: "⚠️ GUARDIAN CHECK-IN MISSED",
							extra: { type: "guardian-deadline", guardianId: "test-1" },
						});
					}
					return Promise.resolve();
				},
			);

			await setupNotificationListeners();

			expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
		});
	});
});
