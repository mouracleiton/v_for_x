"use client";

import { useCallback, useMemo, useState } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import {
	allHarmChecksPassed,
	emptyHarmState,
	HARM_CHECKS,
	type HarmCheckId,
} from "@/lib/share-pack";
import { createPack, createPackWithIdentity, encodePack } from "@/lib/vfxpack";
import { ensureIdentity } from "@/lib/identity";
import { sound } from "@/lib/sound";

type Props = {
	/** Pre-collected VFX* tokens to pack. */
	tokens?: string[];
	label?: string;
	description?: string;
	iso3?: string;
	/** Compact floating trigger (default) vs always-open panel. */
	mode?: "fab" | "inline";
	className?: string;
};

/**
 * Universal save-as-pack surface with harm checklist gate.
 */
export default function ShareSheet({
	tokens = [],
	label = "share",
	description,
	iso3,
	mode = "fab",
	className = "",
}: Props) {
	const [open, setOpen] = useState(mode === "inline");
	const [checks, setChecks] = useState(emptyHarmState);
	const [extra, setExtra] = useState("");
	const [busy, setBusy] = useState(false);
	const [tokenOut, setTokenOut] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const ready = allHarmChecksPassed(checks);

	const mergedTokens = useMemo(() => {
		const fromExtra = extra
			.split(/\n+/)
			.map((t) => t.trim())
			.filter((t) => /^VFX[A-Z0-9]+:/i.test(t));
		return [...new Set([...tokens, ...fromExtra])];
	}, [tokens, extra]);

	const toggle = (id: HarmCheckId) =>
		setChecks((s) => ({ ...s, [id]: !s[id] }));

	const build = useCallback(async () => {
		if (!ready) return;
		if (mergedTokens.length === 0) {
			setError("Add at least one VFX* token");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const identity = await ensureIdentity().catch(() => null);
			const pack = identity
				? await createPackWithIdentity(mergedTokens, identity, {
						label,
						description,
						iso3,
						kind: "collection",
					})
				: createPack(mergedTokens, {
						label,
						description,
						iso3,
						kind: "collection",
					});
			const t = encodePack(pack);
			setTokenOut(t);
			sound.success();
		} catch (e) {
			setError(e instanceof Error ? e.message : "pack failed");
			sound.error();
		} finally {
			setBusy(false);
		}
	}, [ready, mergedTokens, label, description, iso3]);

	const copy = async () => {
		if (!tokenOut) return;
		try {
			await navigator.clipboard.writeText(tokenOut);
			setCopied(true);
			sound.copy();
			setTimeout(() => setCopied(false), 1500);
		} catch {
			setError("clipboard blocked");
		}
	};

	const panel = (
		<TerminalCard
			title="SHARE / SAVE AS PACK"
			accent="green"
			className={className}
		>
			<p className="text-[10px] text-content-dim mb-2">
				Harm checklist required before export. Pack becomes a single VFXPACK1
				token.
			</p>
			<div className="space-y-1.5 mb-3">
				{HARM_CHECKS.map((c) => (
					<label
						key={c.id}
						className="flex items-start gap-2 text-[10px] text-content-secondary cursor-pointer"
					>
						<input
							type="checkbox"
							checked={!!checks[c.id]}
							onChange={() => toggle(c.id)}
							className="mt-0.5"
						/>
						<span>{c.label}</span>
					</label>
				))}
			</div>
			<textarea
				value={extra}
				onChange={(e) => setExtra(e.target.value)}
				placeholder="Optional: paste extra VFX* tokens (one per line)"
				rows={2}
				className="w-full bg-abyss border border-border-dim p-2 text-[10px] font-mono text-terminal-green mb-2 focus:border-blood focus:outline-none"
			/>
			<div className="flex items-center gap-2 flex-wrap mb-2">
				<StatusPill color={ready ? "green" : "amber"}>
					{ready ? "CHECKS OK" : "CHECKS REQUIRED"}
				</StatusPill>
				<span className="text-[10px] text-content-dim">
					{mergedTokens.length} token(s)
				</span>
			</div>
			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					disabled={!ready || busy}
					onClick={() => void build()}
					className="px-3 py-1.5 text-[10px] border border-terminal-green text-terminal-green disabled:opacity-40 hover:bg-terminal-green hover:text-void font-mono"
				>
					{busy ? "BUILDING…" : "BUILD VFXPACK1"}
				</button>
				{mode === "fab" && (
					<button
						type="button"
						onClick={() => setOpen(false)}
						className="px-3 py-1.5 text-[10px] border border-border-dim text-content-dim font-mono"
					>
						CLOSE
					</button>
				)}
			</div>
			{error && <div className="text-[10px] text-blood mt-2">{error}</div>}
			{tokenOut && (
				<div className="mt-3 space-y-1">
					<textarea
						readOnly
						value={tokenOut}
						rows={3}
						className="w-full bg-abyss border border-terminal-green/40 p-2 text-[9px] font-mono text-terminal-green"
					/>
					<button
						type="button"
						onClick={() => void copy()}
						className="px-2 py-1 text-[10px] border border-blood text-blood-bright font-mono"
					>
						{copied ? "COPIED" : "COPY PACK"}
					</button>
				</div>
			)}
		</TerminalCard>
	);

	if (mode === "inline") return panel;

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="fixed bottom-4 right-4 z-[60] px-3 py-2 text-[10px] font-mono border border-terminal-green bg-void text-terminal-green shadow-lg hover:bg-terminal-green hover:text-void"
				aria-label="Open share sheet"
			>
				↗ PACK
			</button>
			{open && (
				<div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-void/70 p-3">
					<div className="w-full max-w-lg">{panel}</div>
				</div>
			)}
		</>
	);
}
