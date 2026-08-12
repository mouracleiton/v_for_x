/**
 * V FOR X — Blueprint SMS / USSD cousin (todo-019)
 *
 * Shrinks a Protocol-X / playbook blueprint down to ≤160-char Relay segments
 * so a whole crisis playbook can ride SMS or a 160-char USSD menu. Each
 * segment is an independently-decodable `lib/relay` message; reassembling
 * them is the receiver's job (already handled by `reassembleSegments`).
 *
 * Static / offline. Reuses `encodeMessage` + `segmentForQR` — no codec
 * duplication, no new wire format.
 */

import {
	encodeMessage,
	segmentForQR,
	type QRSegment,
	type RelayMessage,
	MAX_QR_SEGMENT,
} from "./relay";

/** Classic SMS payload ceiling (GSM 7-bit default alphabet). */
export const SMS_MAX = 160;

export interface BlueprintItem {
	id: string;
	/** Short title, e.g. "Water access". */
	title: string;
	/** One-line action. */
	action: string;
}

export interface Blueprint {
	id: string;
	iso3: string;
	/** Crisis class, e.g. "conflict", "climate". */
	cls: string;
	title: string;
	steps: BlueprintItem[];
}

/** Compress a single blueprint item into ≤max chars of plain text. */
export function shrinkStep(step: BlueprintItem, max = SMS_MAX): string {
	const raw = `${step.id}:${step.title} — ${step.action}`
		.replace(/\s+/g, " ")
		.trim();
	if (raw.length <= max) return raw;
	// Keep the id + as much action as fits; ellipsis marks the truncation.
	const head = `${step.id}:`;
	const room = max - head.length - 1;
	return `${head}${step.action.slice(0, Math.max(0, room - 1))}…`;
}

/** Build a Relay message carrying one blueprint step. */
export function stepToMessage(
	bp: Blueprint,
	step: BlueprintItem,
): RelayMessage {
	return {
		type: "supply",
		iso3: bp.iso3 || "XXX",
		ts: Math.floor(Date.now() / 1000),
		priority: 5,
		body: shrinkStep(step),
	};
}

export interface SmsPack {
	/** The blueprint id (carried out-of-band, not per-segment). */
	blueprintId: string;
	/** SMS-sized Relay segments, each ≤smsMax chars including its header. */
	segments: QRSegment[];
	/** Total byte budget across all segments. */
	totalChars: number;
}

/**
 * Encode an entire blueprint into SMS-sized Relay segments.
 *
 * The blueprint header (id + title) is emitted once as the first segment so a
 * receiver scanning segment 0 alone still knows which playbook it is. Each
 * step follows as its own Relay message, then QR-segmented to the SMS budget.
 */
export function blueprintToSms(bp: Blueprint, smsMax = SMS_MAX): SmsPack {
	const segments: QRSegment[] = [];
	const headerMsg: RelayMessage = {
		type: "text",
		iso3: bp.iso3 || "XXX",
		ts: Math.floor(Date.now() / 1000),
		priority: 9,
		body: `BP ${bp.id} ${bp.cls} ${bp.title}`.slice(0, smsMax - 20),
	};
	segments.push(...segmentForQR(encodeMessage(headerMsg), smsMax));

	for (const step of bp.steps) {
		const msg = stepToMessage(bp, step);
		segments.push(...segmentForQR(encodeMessage(msg), smsMax));
	}

	const totalChars = segments.reduce((acc, s) => acc + s.content.length, 0);
	return { blueprintId: bp.id, segments, totalChars };
}

/** True if every produced segment fits the SMS budget. */
export function fitsSms(pack: SmsPack, smsMax = SMS_MAX): boolean {
	return pack.segments.every((s) => s.content.length <= smsMax);
}

/** Sanity ceiling: never produce more segments than this (guards a runaway loop). */
export const MAX_SEGMENTS = 255;

/** Re-export so callers importing from this module get the shared constant. */
export { MAX_QR_SEGMENT };
