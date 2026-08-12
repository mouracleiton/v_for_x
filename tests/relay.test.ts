import { describe, it, expect } from "vitest";
import {
  encodeMessage,
  decodeMessage,
  segmentForQR,
  reassembleSegments,
  createAlert,
  createCoords,
  createSupplyMessage,
  createMedicalEmergency,
  typeLabel,
  typeIcon,
  formatTimestamp,
} from "../lib/relay";

describe("relay.ts", () => {
  describe("encodeMessage / decodeMessage", () => {
    it("should encode and decode a message round-trip", () => {
      const msg = {
        type: "alert" as const,
        iso3: "SDN",
        ts: 1700000000,
        body: "Armed conflict reported near the capital.",
        priority: 9,
      };
      const encoded = encodeMessage(msg);
      expect(encoded).toMatch(/^VFX\|/);
      const decoded = decodeMessage(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded!.type).toBe("alert");
      expect(decoded!.iso3).toBe("SDN");
      expect(decoded!.priority).toBe(9);
      expect(decoded!.body).toBe("Armed conflict reported near the capital.");
      expect(decoded!.ts).toBe(1700000000);
    });

    it("should handle message with sender", () => {
      const msg = {
        type: "text" as const,
        iso3: "YEM",
        ts: 1700000500,
        body: "Test message",
        priority: 3,
        sender: "a1b2c3d4",
      };
      const encoded = encodeMessage(msg);
      const decoded = decodeMessage(encoded);
      expect(decoded!.sender).toBe("a1b2c3d4");
    });

    it("should return null for invalid format", () => {
      expect(decodeMessage("INVALID")).toBeNull();
      expect(decodeMessage("VFX|ABC")).toBeNull();
      expect(decodeMessage("XXX|T3SDNabc|body")).toBeNull();
    });

    it("should handle pipes in body (replaced with slashes on encode)", () => {
      const msg = {
        type: "text" as const,
        iso3: "AFG",
        ts: 12345,
        body: "field1|field2",
        priority: 1,
      };
      const encoded = encodeMessage(msg);
      const decoded = decodeMessage(encoded);
      expect(decoded!.body).toContain("field1");
    });
  });

  describe("QR Segmentation", () => {
    it("should return single segment for short messages", () => {
      const segments = segmentForQR("Short message");
      expect(segments).toHaveLength(1);
      expect(segments[0].total).toBe(1);
      expect(segments[0].messageId).toBe("");
    });

    it("should split long messages into segments", () => {
      const longMsg = "x".repeat(500);
      const segments = segmentForQR(longMsg);
      expect(segments.length).toBeGreaterThan(1);
      expect(segments[0].total).toBe(segments.length);
      // All segments share the same messageId
      const ids = new Set(segments.map((s) => s.messageId));
      expect(ids.size).toBe(1);
    });

    it("should reassemble segments back to original", () => {
      const original = "This is a test message that needs to be split and reassembled correctly.".repeat(10);
      const segments = segmentForQR(original);
      const reassembled = reassembleSegments(segments);
      // segmentForQR prepends a header per segment for QR rendering;
      // reassembleSegments strips them and returns the original text.
      expect(reassembled).not.toBeNull();
      expect(reassembled).toBe(original);
    });

    it("should reassemble segments out of order", () => {
      const original = "ABCDEFGH".repeat(100);
      const segments = segmentForQR(original);
      const shuffled = [...segments].reverse();
      const reassembled = reassembleSegments(shuffled);
      expect(reassembled).not.toBeNull();
    });

    it("should return null for empty segments", () => {
      expect(reassembleSegments([])).toBeNull();
    });

    it("should return null for incomplete segments", () => {
      const longMsg = "x".repeat(500);
      const segments = segmentForQR(longMsg);
      const partial = segments.slice(0, segments.length - 1);
      expect(reassembleSegments(partial)).toBeNull();
    });
  });

  describe("Message Templates", () => {
    it("should create an alert message", () => {
      const msg = createAlert("SDN", "Active bombing in Khartoum");
      expect(msg.type).toBe("alert");
      expect(msg.iso3).toBe("SDN");
      expect(msg.priority).toBe(9);
      expect(msg.body).toContain("bombing");
    });

    it("should create a coordinates message", () => {
      const msg = createCoords("SOM", 5.1521, 46.1996, "checkpoint");
      expect(msg.type).toBe("coords");
      expect(msg.body).toContain("5.1521");
      expect(msg.body).toContain("46.1996");
    });

    it("should create a supply message", () => {
      const msg = createSupplyMessage("YEM", "need", "rice", "50kg");
      expect(msg.type).toBe("supply");
      expect(msg.body).toContain("NEED");
      expect(msg.body).toContain("50kg");
      expect(msg.priority).toBe(7);
    });

    it("should create a medical emergency", () => {
      const msg = createMedicalEmergency("AFG", "severe bleeding");
      expect(msg.type).toBe("medical");
      expect(msg.priority).toBe(9);
    });
  });

  describe("Display helpers", () => {
    it("should return labels and icons", () => {
      expect(typeLabel("alert")).toBe("ALERT");
      expect(typeLabel("medical")).toBe("MEDICAL");
      expect(typeIcon("alert")).toBeDefined();
    });

    it("should format timestamps", () => {
      const formatted = formatTimestamp(1700000000);
      expect(formatted).toContain("Z");
      expect(formatted.length).toBeGreaterThan(10);
    });
  });
});
