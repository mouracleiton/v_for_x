/**
 * Tests for identity binding in mission progress and ops journal events
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { completeMissionStep, getMissionProgress, getMissionsState } from "../lib/missions";
import { logEvent, getOpsJournal, logMissionStarted, logIdentityCreated } from "../lib/ops-journal";
import { generateIdentity, saveIdentity, loadIdentity, deleteIdentity } from "../lib/identity";

describe("Identity Binding", () => {
  beforeEach(async () => {
    // Clear storage before each test
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
    // Clear any existing identity
    const identity = await loadIdentity();
    if (identity) {
      deleteIdentity();
    }
  });

  describe("Mission Progress Identity Binding", () => {
    it("should attach identity handle and fingerprint to mission progress", async () => {
      // Create and save an identity
      const identity = await generateIdentity();
      await saveIdentity(identity);

      // Complete a mission step
      await completeMissionStep("establish_identity", "create_identity");

      // Check that the progress includes identity info
      const progress = getMissionProgress("establish_identity");
      expect(progress).not.toBeNull();
      expect(progress?.identityHandle).toBe(identity.handle);
      expect(progress?.identityFingerprint).toBe(identity.fingerprint);
      expect(progress?.completedSteps).toContain("create_identity");
    });

    it("should update identity info when identity changes", async () => {
      // Create first identity
      const identity1 = await generateIdentity();
      await saveIdentity(identity1);

      // Complete a step with first identity
      await completeMissionStep("verify_claims", "verify_witness_statement");

      const progress1 = getMissionProgress("verify_claims");
      expect(progress1?.identityHandle).toBe(identity1.handle);

      // Rotate to new identity
      const { rotateIdentity } = await import("../lib/identity");
      const identity2 = await rotateIdentity();

      // Complete another step
      await completeMissionStep("verify_claims", "verify_evidence_chain");

      const progress2 = getMissionProgress("verify_claims");
      expect(progress2?.identityHandle).toBe(identity2.handle);
      expect(progress2?.identityHandle).not.toBe(identity1.handle);
    });

    it("should work without identity (backward compatibility)", async () => {
      // Complete a step without any identity
      await completeMissionStep("secure_communications", "create_signal_offer");

      const progress = getMissionProgress("secure_communications");
      expect(progress).not.toBeNull();
      expect(progress?.completedSteps).toContain("create_signal_offer");
      // Identity fields should be undefined
      expect(progress?.identityHandle).toBeUndefined();
      expect(progress?.identityFingerprint).toBeUndefined();
    });
  });

  describe("Ops Journal Identity Binding", () => {
    it("should attach identity handle and fingerprint to events", async () => {
      // Create and save an identity
      const identity = await generateIdentity();
      await saveIdentity(identity);

      // Log an event
      await logMissionStarted("establish_identity", "Establish Your Identity");

      // Check that the event includes identity info
      const journal = getOpsJournal();
      const event = journal.events[journal.events.length - 1];
      
      expect(event.type).toBe("mission_started");
      expect(event.identityHandle).toBe(identity.handle);
      expect(event.identityFingerprint).toBe(identity.fingerprint);
    });

    it("should attach identity to identity creation events", async () => {
      const identity = await generateIdentity();
      await saveIdentity(identity);

      await logIdentityCreated(identity.handle);

      const journal = getOpsJournal();
      const event = journal.events[journal.events.length - 1];
      
      expect(event.type).toBe("identity_created");
      expect(event.identityHandle).toBe(identity.handle);
      expect(event.identityFingerprint).toBe(identity.fingerprint);
      expect(event.details?.handle).toBe(identity.handle);
    });

    it("should work without identity (backward compatibility)", async () => {
      // Log an event without any identity
      await logEvent({
        type: "custom",
        title: "Test event without identity",
      });

      const journal = getOpsJournal();
      const event = journal.events[journal.events.length - 1];
      
      expect(event.type).toBe("custom");
      expect(event.title).toBe("Test event without identity");
      // Identity fields should be undefined
      expect(event.identityHandle).toBeUndefined();
      expect(event.identityFingerprint).toBeUndefined();
    });

    it("should preserve identity info across different event types", async () => {
      const identity = await generateIdentity();
      await saveIdentity(identity);

      // Log multiple different events
      await logMissionStarted("establish_identity", "Establish Identity");
      await logIdentityCreated(identity.handle);
      await logEvent({
        type: "page_visited",
        title: "Visited /the-missions",
        route: "/the-missions",
      });

      const journal = getOpsJournal();
      const lastEvents = journal.events.slice(-3);

      // All should have identity info
      for (const event of lastEvents) {
        expect(event.identityHandle).toBe(identity.handle);
        expect(event.identityFingerprint).toBe(identity.fingerprint);
      }
    });
  });

  describe("Identity Rotation Tracking", () => {
    it("should log identity rotation events", async () => {
      const identity1 = await generateIdentity();
      await saveIdentity(identity1);

      const { rotateIdentity } = await import("../lib/identity");
      const identity2 = await rotateIdentity();

      // Log the rotation
      const { logIdentityRotated } = await import("../lib/ops-journal");
      await logIdentityRotated(identity1.handle, identity2.handle);

      const journal = getOpsJournal();
      const rotationEvent = journal.events.find(e => e.type === "identity_rotated");
      
      expect(rotationEvent).toBeDefined();
      expect(rotationEvent?.details?.oldHandle).toBe(identity1.handle);
      expect(rotationEvent?.details?.newHandle).toBe(identity2.handle);
      // Rotation event should be signed by new identity
      expect(rotationEvent?.identityHandle).toBe(identity2.handle);
    });
  });
});
