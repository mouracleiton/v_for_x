import { describe, it, expect } from "vitest";
import {
  SIGNAL_TOKEN_PREFIX,
  encodeSignalToken,
  decodeSignalToken,
  looksLikeSignalToken,
  buildSignalUrl,
  parseHashSignal,
  generateRoomCode,
  normalizeRoom,
  sanitizeSdpForSharing,
} from "../lib/signal-relay";

const SDP_OFFER =
  '{"type":"offer","sdp":"v=0\\r\\no=- 123 2 IN IP4 0.0.0.0\\r\\ns=-\\r\\nt=0 0\\r\\na=group:BUNDLE 0\\r\\na=ice-ufrag:abcd\\r\\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\\r\\na=candidate:1 1 UDP 2130706431 192.168.1.10 54321 typ host\\r\\n"}';

describe("signal-relay.ts", () => {
  describe("token encoding", () => {
    it("encodes a compact token with the prefix", () => {
      const token = encodeSignalToken({ kind: "offer", sdp: SDP_OFFER, room: "TEST-ROOM" });
      expect(token.startsWith(SIGNAL_TOKEN_PREFIX)).toBe(true);
      expect(looksLikeSignalToken(token)).toBe(true);
      expect(looksLikeSignalToken("garbage")).toBe(false);
      expect(looksLikeSignalToken("  " + token + "  ")).toBe(true);
    });

    it("round-trips offer and answer tokens", () => {
      for (const kind of ["offer", "answer"] as const) {
        const token = encodeSignalToken({ kind, sdp: SDP_OFFER, from: "V-ABCD-EFGH" });
        const payload = decodeSignalToken(token);
        expect(payload.kind).toBe(kind);
        expect(payload.sdp).toBe(SDP_OFFER);
        expect(payload.from).toBe("V-ABCD-EFGH");
        expect(typeof payload.ts).toBe("number");
      }
    });

    it("rejects malformed tokens", () => {
      expect(() => decodeSignalToken("not-a-signal")).toThrow(/Not a signal token/);
      expect(() => decodeSignalToken(SIGNAL_TOKEN_PREFIX + "!!not-base64!!")).toThrow();
      expect(() => decodeSignalToken(SIGNAL_TOKEN_PREFIX + "e30=")).toThrow(); // "{}"
      expect(() =>
        decodeSignalToken(
          SIGNAL_TOKEN_PREFIX +
            btoa(JSON.stringify({ kind: "offer" })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
        ),
      ).toThrow(/missing SDP/);
      expect(() =>
        decodeSignalToken(
          SIGNAL_TOKEN_PREFIX +
            btoa(JSON.stringify({ kind: "weird", sdp: "x" })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
        ),
      ).toThrow(/Unknown signal kind/);
    });
  });

  describe("share links", () => {
    it("builds a URL carrying the token in the hash", () => {
      const token = encodeSignalToken({ kind: "offer", sdp: SDP_OFFER });
      const url = buildSignalUrl(token, "https://example.org/the-web");
      expect(url.startsWith("https://example.org/the-web#vfx-signal=")).toBe(true);
      const extracted = parseHashSignal(url.split("#")[1]);
      expect(extracted).toBe(token);
    });

    it("parses hash fragments with other keys alongside", () => {
      const token = encodeSignalToken({ kind: "answer", sdp: SDP_OFFER });
      const hash = `packet=xyz&vfx-signal=${encodeURIComponent(token)}&foo=1`;
      expect(parseHashSignal(hash)).toBe(token);
      expect(parseHashSignal("")).toBeNull();
      expect(parseHashSignal("#just-a-hash")).toBeNull();
      expect(parseHashSignal("#vfx-signal=not-a-token")).toBeNull();
    });
  });

  describe("room codes", () => {
    it("generates codes without ambiguous characters", () => {
      for (let i = 0; i < 50; i++) {
        const code = generateRoomCode();
        expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
      }
      const single = generateRoomCode(1, 6);
      expect(single).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    });

    it("normalizes to upper case and trims", () => {
      expect(normalizeRoom("  abcd-efgh ")).toBe("ABCD-EFGH");
      expect(normalizeRoom("")).toBe("");
    });
  });

  describe("SDP sanitization", () => {
    it("strips ICE candidates when sharing", () => {
      const cleaned = sanitizeSdpForSharing(SDP_OFFER);
      expect(cleaned).not.toContain("a=candidate:");
      expect(cleaned).toContain("a=ice-ufrag:abcd");
    });

    it("returns input unchanged on garbage", () => {
      expect(sanitizeSdpForSharing("")).toBe("");
      expect(sanitizeSdpForSharing("no-sdp-here")).toBe("no-sdp-here");
    });
  });
});