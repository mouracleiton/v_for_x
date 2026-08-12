/**
 * V FOR X — Room QR poster generator (todo-091)
 *
 * Turns a Web room code into a printable café / safehouse poster: a big
 * readable room code, a scannable QR payload (the room-binding Relay token),
 * and one-line instructions a non-technical operator can hand-write if the
 * printer dies. Built entirely on `lib/relay` — no new wire format.
 *
 * Static / offline / no network. The QR payload is the same Relay message a
 * peer scans to join the room, so the poster is just a paper rendering of it.
 */

import {
	encodeMessage,
	segmentForQR,
	type QRSegment,
	type RelayMessage,
} from "./relay";

export interface RoomPoster {
	/** The room code, uppercased. */
	room: string;
	/** Single QR payload string (room-join token). */
	qrPayload: string;
	/** Poster title line. */
	title: string;
	/** Plain-text, hand-copyable join instructions. */
	instructions: string;
	/** If the payload is too long for one QR, the segmented payloads (else []). */
	segments: QRSegment[];
}

const DEFAULT_TITLE = "V FOR X — SAFEHOUSE RELAY";

/** Build the Relay message that, when scanned, binds a peer to this room. */
export function roomJoinMessage(room: string): RelayMessage {
	return {
		type: "text",
		iso3: "XXX",
		ts: Math.floor(Date.now() / 1000),
		priority: 5,
		body: `ROOM ${room.trim().toUpperCase()}`,
	};
}

/** Build a printable poster for a room code. */
export function roomPoster(
	room: string,
	opts: { title?: string } = {},
): RoomPoster {
	const normalized = room.trim().toUpperCase();
	const msg = roomJoinMessage(normalized);
	const payload = encodeMessage(msg);
	const segments = segmentForQR(payload);
	const qrPayload = segments.length === 1 ? segments[0].content : payload;
	return {
		room: normalized,
		qrPayload,
		title: opts.title ?? DEFAULT_TITLE,
		instructions: `Open V FOR X → The Web → JOIN ROOM → type ${normalized}`,
		segments: segments.length > 1 ? segments : [],
	};
}

/** Render the poster as plain text (for print, TTS, or a dead printer). */
export function posterPlainText(poster: RoomPoster): string {
	const lines = [
		poster.title,
		"",
		`ROOM CODE:  ${poster.room}`,
		"",
		"Scan the QR, or manually join:",
		poster.instructions,
		"",
		`Token: ${poster.qrPayload}`,
	];
	if (poster.segments.length > 1) {
		lines.push("", `(${poster.segments.length} QR segments — scan in order)`);
	}
	return lines.join("\n");
}
