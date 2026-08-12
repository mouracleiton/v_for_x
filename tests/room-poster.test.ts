import { describe, it, expect } from "vitest";
import {
	roomPoster,
	posterPlainText,
	roomJoinMessage,
} from "../lib/room-poster";
import { decodeMessage } from "../lib/relay";

describe("room QR poster generator", () => {
	it("normalizes the room code to uppercase", () => {
		const p = roomPoster("cafe42");
		expect(p.room).toBe("CAFE42");
	});

	it("builds a decodable QR payload carrying the room code", () => {
		const p = roomPoster("SAFE1");
		const msg = decodeMessage(p.qrPayload);
		expect(msg).not.toBeNull();
		expect(msg!.body).toContain("SAFE1");
	});

	it("roomJoinMessage body embeds the uppercased room", () => {
		const msg = roomJoinMessage("lab-7");
		expect(msg.body).toBe("ROOM LAB-7");
	});

	it("posterPlainText includes title, room code, instructions, and token", () => {
		const p = roomPoster("ACME", { title: "MY TITLE" });
		const text = posterPlainText(p);
		expect(text).toContain("MY TITLE");
		expect(text).toContain("ACME");
		expect(text).toContain("JOIN ROOM");
		expect(text).toContain(p.qrPayload);
	});

	it("uses default title when none provided", () => {
		const p = roomPoster("X");
		expect(p.title).toContain("V FOR X");
	});

	it("segments is empty array for short payloads (single QR)", () => {
		const p = roomPoster("AB");
		expect(p.segments).toEqual([]);
	});
});
