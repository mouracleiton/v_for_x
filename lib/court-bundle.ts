/**
 * V FOR X — Court Bundle Exporter (Phase 25 D)
 *
 * Renders an offline HTML/PDF-ready bundle of the evidence chain + signatures
 * for counsel. Pure function over witness statements + fulfillment receipts —
 * no rendering dependency, produces a self-contained HTML string that can be
 * printed to PDF from the browser or saved to a file.
 *
 * Reuses: SignedWitness (lib/witness.ts), SignedFulfillment (lib/fulfillment.ts).
 */

export interface CourtBundleInput {
	/** Case label / caption (e.g. "Re: events in SDN, 2025-Q3"). */
	caption: string;
	/** Witness statements (hash-chained). */
	witness?: Array<{
		hash: string;
		handle?: string;
		text: string;
		ts: number;
		prevHash?: string;
		signature?: string;
	}>;
	/** Fulfillment receipts (signed Trail handoffs). */
	fulfillments?: Array<{
		id: string;
		matchId?: string;
		status?: string;
		note?: string;
		ts: number;
		signature?: string;
	}>;
	/** Optional errata/corrections (VFXERR1 chain entries). */
	errata?: Array<{ kind: string; ref: string; summary: string; ts: number }>;
	/** Operator preparing the bundle (handle, not key material). */
	preparedBy?: string;
	/** Bundle generation timestamp. */
	generatedAt?: number;
}

function esc(s: string | undefined): string {
	return (s ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function fmtTs(ts: number): string {
	try {
		return new Date(ts).toISOString();
	} catch {
		return String(ts);
	}
}

/**
 * Render a self-contained court bundle as HTML. No external assets, no
 * scripts — ready for browser "Print → Save as PDF".
 */
export function renderCourtBundle(input: CourtBundleInput): string {
	const generated = input.generatedAt ?? Date.now();
	const witnessList = input.witness ?? [];
	const fulfillList = input.fulfillments ?? [];
	const errataList = input.errata ?? [];

	const witnessRows = witnessList
		.map(
			(w) => `<tr>
        <td>${esc(w.hash.slice(0, 12))}…</td>
        <td>${esc(w.handle ?? "anonymous")}</td>
        <td>${esc(fmtTs(w.ts))}</td>
        <td>${esc(w.prevHash ? w.prevHash.slice(0, 12) + "…" : "genesis")}</td>
        <td><code>${esc(w.signature ?? "—")}</code></td>
        <td>${esc(w.text)}</td>
      </tr>`,
		)
		.join("\n");

	const fulfillRows = fulfillList
		.map(
			(f) => `<tr>
        <td>${esc(f.id)}</td>
        <td>${esc(f.matchId ?? "—")}</td>
        <td>${esc(f.status ?? "—")}</td>
        <td>${esc(fmtTs(f.ts))}</td>
        <td><code>${esc(f.signature ?? "—")}</code></td>
        <td>${esc(f.note ?? "")}</td>
      </tr>`,
		)
		.join("\n");

	const errataRows = errataList
		.map(
			(e) => `<tr>
        <td>${esc(e.kind)}</td>
        <td>${esc(e.ref)}</td>
        <td>${esc(fmtTs(e.ts))}</td>
        <td>${esc(e.summary)}</td>
      </tr>`,
		)
		.join("\n");

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Court Bundle — ${esc(input.caption)}</title>
<style>
  body { font-family: Georgia, serif; max-width: 800px; margin: 2em auto; color: #111; }
  h1 { font-size: 1.4em; border-bottom: 2px solid #111; padding-bottom: .25em; }
  h2 { font-size: 1.1em; margin-top: 1.5em; }
  table { width: 100%; border-collapse: collapse; font-size: .85em; margin-top: .5em; }
  th, td { border: 1px solid #999; padding: .35em .4em; text-align: left; vertical-align: top; }
  th { background: #eee; }
  code { font-family: ui-monospace, monospace; font-size: .8em; word-break: break-all; }
  .meta { color: #555; font-size: .85em; margin-top: 2em; border-top: 1px solid #ccc; padding-top: .5em; }
  .disclaimer { font-style: italic; color: #555; }
</style>
</head>
<body>
<h1>Court Bundle</h1>
<p><strong>Caption:</strong> ${esc(input.caption)}</p>
<p class="disclaimer">Cryptographically verifiable evidence chain. Hashes anchor to the V FOR X witness ledger; signatures verify against the stated identity keys. This bundle is a rendered summary — the canonical artifacts are the VFXWIT1 / VFXFUL1 / VFXERR1 tokens.</p>

<h2>Witness Statements (${witnessList.length})</h2>
${
	witnessList.length === 0
		? "<p><em>None.</em></p>"
		: `<table>
<thead><tr><th>Hash</th><th>By</th><th>Time</th><th>Prev</th><th>Signature</th><th>Text</th></tr></thead>
<tbody>${witnessRows}</tbody>
</table>`
}

<h2>Fulfillment Receipts (${fulfillList.length})</h2>
${
	fulfillList.length === 0
		? "<p><em>None.</em></p>"
		: `<table>
<thead><tr><th>ID</th><th>Match</th><th>Status</th><th>Time</th><th>Signature</th><th>Note</th></tr></thead>
<tbody>${fulfillRows}</tbody>
</table>`
}

${
	errataList.length === 0
		? ""
		: `<h2>Errata / Corrections (${errataList.length})</h2>
<table>
<thead><tr><th>Kind</th><th>Ref</th><th>Time</th><th>Summary</th></tr></thead>
<tbody>${errataRows}</tbody>
</table>`
}

<div class="meta">
  <p>Prepared by: ${esc(input.preparedBy ?? "anonymous operator")} · Generated: ${esc(fmtTs(generated))}</p>
</div>
</body>
</html>`;
}

/** Count the total evidence items in a bundle input. */
export function countBundleEvidence(input: CourtBundleInput): number {
	return (
		(input.witness?.length ?? 0) +
		(input.fulfillments?.length ?? 0) +
		(input.errata?.length ?? 0)
	);
}
