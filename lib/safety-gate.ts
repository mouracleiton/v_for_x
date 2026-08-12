/**
 * Soft safety-number gate for first-run Web pair / Docs co-author.
 * Skippable; acknowledgement is local-only.
 */

const ACK_KEY = "vfx_safety_gate_ack_v1";

export type SafetyGateAck = {
	peerKey: string;
	safetyNumber: string;
	ackedAt: number;
	skipped: boolean;
};

function readAll(): SafetyGateAck[] {
	if (typeof localStorage === "undefined") return [];
	try {
		const raw = localStorage.getItem(ACK_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as SafetyGateAck[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function writeAll(rows: SafetyGateAck[]): void {
	if (typeof localStorage === "undefined") return;
	localStorage.setItem(ACK_KEY, JSON.stringify(rows.slice(-200)));
}

/** Stable peer key: sorted fingerprints or safety number prefix. */
export function peerGateKey(a: string, b: string): string {
	return [a, b]
		.map((s) => s.toLowerCase())
		.sort()
		.join("|");
}

export function isSafetyAcknowledged(peerKey: string): boolean {
	return readAll().some((r) => r.peerKey === peerKey);
}

export function acknowledgeSafety(input: {
	peerKey: string;
	safetyNumber: string;
	skipped?: boolean;
}): SafetyGateAck {
	const row: SafetyGateAck = {
		peerKey: input.peerKey,
		safetyNumber: input.safetyNumber,
		ackedAt: Date.now(),
		skipped: !!input.skipped,
	};
	const rest = readAll().filter((r) => r.peerKey !== input.peerKey);
	writeAll([...rest, row]);
	return row;
}

export function clearSafetyAcks(): void {
	if (typeof localStorage === "undefined") return;
	localStorage.removeItem(ACK_KEY);
}

export function listSafetyAcks(): SafetyGateAck[] {
	return readAll();
}

/** Format 64-hex safety number as grouped display chunks. */
export function formatSafetyNumber(sn: string, group = 4): string[] {
	const clean = sn.replace(/[^0-9a-f]/gi, "").toLowerCase();
	const out: string[] = [];
	for (let i = 0; i < clean.length; i += group) {
		out.push(clean.slice(i, i + group));
	}
	return out;
}
