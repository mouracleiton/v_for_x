"use client";

/**
 * V FOR X — EmptyState
 *
 * One reusable "nothing here yet / do this next" surface for thin pages, so we
 * stop re-inventing per-page empty placeholders. Terminal-styled, offline-safe,
 * accessible (role=status, aria-live). The CTA is optional and renders a link
 * or button so pages can guide the operator toward the next action.
 */

import type { ReactNode } from "react";

export interface EmptyStateProps {
	/** Short headline, e.g. "No witness statements yet". */
	title: string;
	/** One-line explanation or next step. */
	hint?: string;
	/** Optional CTA node (a <a>/<button>). Rendered as-is. */
	action?: ReactNode;
	/** Optional glyph/emoji shown before the title. */
	glyph?: string;
	/** Minimal mode: smaller padding for dense dashboards. */
	minimal?: boolean;
	/** Accessible live region politeness (default "polite"). */
	ariaLive?: "off" | "polite" | "assertive";
}

/**
 * Default export. Renders a terminal-styled empty state with an accessible
 * status region. No external dependencies — pure presentational.
 */
export default function EmptyState({
	title,
	hint,
	action,
	glyph,
	minimal = false,
	ariaLive = "polite",
}: EmptyStateProps) {
	const padding = minimal ? "0.75rem 1rem" : "2rem 1.25rem";
	return (
		<div
			role="status"
			aria-live={ariaLive}
			style={{
				border: "1px dashed var(--color-blood-dim, #6b4a4a)",
				background: "var(--color-bg-alt, rgba(0,0,0,0.03))",
				color: "var(--color-text, #d4d4d4)",
				fontFamily: "var(--font-mono, ui-monospace, monospace)",
				padding,
				margin: minimal ? "0.5rem 0" : "1.5rem 0",
				borderRadius: "2px",
				display: "flex",
				flexDirection: "column",
				gap: "0.4rem",
				alignItems: "flex-start",
			}}
		>
			<span
				style={{ fontSize: minimal ? "0.85rem" : "0.95rem", opacity: 0.95 }}
			>
				{glyph ? `${glyph} ` : ""}
				<strong>{title}</strong>
			</span>
			{hint ? (
				<span
					style={{ fontSize: minimal ? "0.75rem" : "0.82rem", opacity: 0.7 }}
				>
					{hint}
				</span>
			) : null}
			{action ? <span style={{ marginTop: "0.25rem" }}>{action}</span> : null}
		</div>
	);
}
