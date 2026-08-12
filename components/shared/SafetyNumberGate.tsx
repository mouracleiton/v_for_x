"use client";

import { useEffect, useMemo, useState } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import {
	acknowledgeSafety,
	formatSafetyNumber,
	isSafetyAcknowledged,
	peerGateKey,
} from "@/lib/safety-gate";

type Props = {
	/** Local identity fingerprint or handle */
	localKey: string;
	/** Peer fingerprint / public key hex / handle */
	peerKey: string;
	/** Full safety number (hex) */
	safetyNumber: string;
	/** Peer display label */
	peerLabel?: string;
	/** Called after ack or skip so host can unlock the flow */
	onCleared?: () => void;
	className?: string;
};

/**
 * Blocking soft-gate: must Compare & continue or Skip once per peer pair.
 */
export default function SafetyNumberGate({
	localKey,
	peerKey,
	safetyNumber,
	peerLabel,
	onCleared,
	className = "",
}: Props) {
	const gateKey = useMemo(
		() => peerGateKey(localKey, peerKey),
		[localKey, peerKey],
	);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (!safetyNumber || !localKey || !peerKey) {
			setOpen(false);
			return;
		}
		const needs = !isSafetyAcknowledged(gateKey);
		setOpen(needs);
		if (!needs) onCleared?.();
	}, [gateKey, safetyNumber, localKey, peerKey, onCleared]);

	if (!open || !safetyNumber) return null;

	const chunks = formatSafetyNumber(safetyNumber, 4);

	const clear = (skipped: boolean) => {
		acknowledgeSafety({ peerKey: gateKey, safetyNumber, skipped });
		setOpen(false);
		onCleared?.();
	};

	return (
		<div
			className={`fixed inset-0 z-[80] flex items-center justify-center bg-void/80 p-4 ${className}`}
			role="dialog"
			aria-modal="true"
			aria-label="Safety number verification"
		>
			<div className="w-full max-w-md">
				<TerminalCard title="SAFETY NUMBER" accent="amber" glow>
					<p className="text-xs text-content-secondary mb-3">
						Compare this number out-of-band with{" "}
						<span className="text-blood-bright">
							{peerLabel || peerKey.slice(0, 16)}
						</span>{" "}
						before trusting the channel. Skip only if you accept MITM risk.
					</p>
					<div className="font-mono text-[11px] leading-relaxed text-terminal-green break-all mb-4 p-2 border border-border-dim bg-abyss">
						{chunks.map((c, i) => (
							<span key={i} className="inline-block mr-1 mb-0.5">
								{c}
							</span>
						))}
					</div>
					<div className="flex items-center gap-2 mb-3">
						<StatusPill color="amber">FIRST RUN</StatusPill>
						<span className="text-[10px] text-content-dim">
							skippable soft-gate
						</span>
					</div>
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							onClick={() => clear(false)}
							className="px-3 py-2 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void font-mono"
						>
							NUMBERS MATCH — CONTINUE
						</button>
						<button
							type="button"
							onClick={() => clear(true)}
							className="px-3 py-2 text-xs border border-border-dim text-content-dim hover:border-blood hover:text-blood font-mono"
						>
							SKIP FOR NOW
						</button>
					</div>
				</TerminalCard>
			</div>
		</div>
	);
}
