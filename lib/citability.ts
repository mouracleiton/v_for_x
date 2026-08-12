/**
 * V FOR X — Citability (Phase 20 — todo-069)
 *
 * Activists and academics need to *point* at a claim: "this specific
 * paragraph, in this dossier, as of this snapshot." Citability gives
 * every block of prose a **stable paragraph id** derived from its
 * content + the document id, plus a citation generator that emits
 * a one-line reference (author/snapshot/para-id/permalink) ready to
 * paste into a paper, a brief, or a court bundle.
 *
 *   • assignParagraphIds()  — split text, stamp stable ids
 *   • citationFor()         — render a citation from a paragraph
 *   • encodeCitationToken() — VFXCIT1 portable citation token
 *
 * Paragraph ids are content-addressed (SHA-first-12 hex of docId+text)
 * so the same paragraph in the same document always gets the same id,
 * even across rebuilds — a citation stays valid as long as the prose
 * is unchanged. Fully offline; no DOI service, no network.
 */

/* ═══════════════════════════════════════════════════════════════
   Token constants
   ═══════════════════════════════════════════════════════════════ */

export const CITATION_PREFIX = "VFXCIT1:";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface CitableParagraph {
	/** 1-based index in document order. */
	index: number;
	/** Stable content-addressed id (hex). */
	id: string;
	/** The paragraph text. */
	text: string;
}

export interface CitationInput {
	/** Document id (slug). */
	docId: string;
	/** Document title. */
	title?: string;
	/** Author / publisher handle. */
	author?: string;
	/** Snapshot date (ISO or epoch ms). */
	snapshot?: string | number;
	/** Permalink / mirror URL. */
	permalink?: string;
}

/* ═══════════════════════════════════════════════════════════════
   Paragraph id assignment
   ═══════════════════════════════════════════════════════════════ */

/**
 * Split text into paragraphs and assign stable ids. Paragraphs are
 * separated by one or more blank lines. Never throws.
 */
export function assignParagraphIds(docId: string, text: string): CitableParagraph[] {
	const id = String(docId ?? "");
	const blocks = String(text ?? "")
		.split(/\n\s*\n+/)
		.map((b) => b.trim())
		.filter((b) => b.length > 0);
	return blocks.map((block, i) => ({
		index: i + 1,
		id: paragraphId(id, block),
		text: block,
	}));
}

/** Stable 12-hex-char id for a paragraph: first 12 of digest(docId||text). */
export function paragraphId(docId: string, text: string): string {
	return hashHex(`${docId}::${text}`).slice(0, 12);
}

/* ═══════════════════════════════════════════════════════════════
   Citation rendering
   ═══════════════════════════════════════════════════════════════ */

/** Render a one-line citation. Style: "Author, Title, ¶paraId (snapshot) permalink". */
export function citationFor(meta: CitationInput, paragraph: CitableParagraph): string {
	const parts: string[] = [];
	if (meta.author) parts.push(meta.author);
	if (meta.title) parts.push(`“${meta.title}”`);
	parts.push(`¶${paragraph.id}`);
	if (meta.snapshot) {
		const snap = typeof meta.snapshot === "number" ? new Date(meta.snapshot).toISOString().slice(0, 10) : meta.snapshot;
		parts.push(`(${snap})`);
	}
	if (meta.permalink) parts.push(meta.permalink);
	return parts.join(" ");
}

/* ═══════════════════════════════════════════════════════════════
   Token encode / decode
   ═══════════════════════════════════════════════════════════════ */

export interface CitationTokenPayload extends CitationInput {
	paragraphId: string;
	paragraphIndex: number;
	textPreview: string;
}

export function encodeCitationToken(payload: CitationTokenPayload): string {
	return CITATION_PREFIX + toB64Url(JSON.stringify(payload));
}

export function decodeCitationToken(token: string): CitationTokenPayload | null {
	if (typeof token !== "string" || !token.startsWith(CITATION_PREFIX)) return null;
	try {
		const parsed = JSON.parse(fromB64Url(token.slice(CITATION_PREFIX.length)));
		if (!parsed || typeof parsed !== "object" || typeof parsed.paragraphId !== "string") return null;
		return parsed as CitationTokenPayload;
	} catch {
		return null;
	}
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function hashHex(s: string): string {
	const bytes = typeof TextEncoder !== "undefined" ? new TextEncoder().encode(s) : Uint8Array.from(s.split("").map((c) => c.charCodeAt(0)));
	let h1 = 0x811c9dc5;
	let h2 = 0x01000193;
	for (let i = 0; i < bytes.length; i++) {
		const b = bytes[i];
		h1 = Math.imul(h1 ^ b, 0x01000193) >>> 0;
		h2 = Math.imul(h2 ^ ((b << 3) | (b >> 5)), 0x85ebca6b) >>> 0;
	}
	return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0") + (h1 ^ h2).toString(16).padStart(8, "0");
}

function toB64Url(s: string): string {
	const b64 = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, "utf8").toString("base64");
	return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): string {
	const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
	const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
	return typeof atob === "function" ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, "base64").toString("utf8");
}
