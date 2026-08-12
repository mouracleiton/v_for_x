"use client";

import { useCallback, useEffect, useState } from "react";
import StatusPill from "@/components/ui/StatusPill";
import { detectToken, type DetectedToken } from "@/lib/tokens";
import { decodeAndValidatePack, type PackVerifyResult } from "@/lib/vfxpack";

/**
 * Minimal paste-to-verify surface for VFX* tokens (home / shared use).
 * VFXPACK1 gets a light decode+validate pass; other types show format only.
 */
export default function TokenVerifyDropzone() {
	const [text, setText] = useState("");
	const [detected, setDetected] = useState<DetectedToken | null>(null);
	const [packResult, setPackResult] = useState<PackVerifyResult | null>(null);
	const [packError, setPackError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		const trimmed = text.trim();
		if (!trimmed) {
			setDetected(null);
			setPackResult(null);
			setPackError(null);
			return;
		}
		const d = detectToken(trimmed);
		setDetected(d);
		setPackResult(null);
		setPackError(null);

		if (d?.spec.id === "VFXPACK1" && d.validFormat) {
			let cancelled = false;
			setBusy(true);
			decodeAndValidatePack(trimmed)
				.then((r) => {
					if (!cancelled) setPackResult(r);
				})
				.catch((err: unknown) => {
					if (!cancelled) {
						setPackError(err instanceof Error ? err.message : "decode failed");
					}
				})
				.finally(() => {
					if (!cancelled) setBusy(false);
				});
			return () => {
				cancelled = true;
			};
		}
	}, [text]);

	const clear = useCallback(() => {
		setText("");
		setDetected(null);
		setPackResult(null);
		setPackError(null);
	}, []);

	return (
		<div className="space-y-3 font-mono">
			<label className="block text-[10px] text-content-dim uppercase tracking-widest">
				Paste a VFX* token
			</label>
			<textarea
				value={text}
				onChange={(e) => setText(e.target.value)}
				placeholder="VFXID1:… / VFXPACK1:… / any VFX* token"
				rows={3}
				className="w-full bg-abyss border border-border-dim p-2 text-xs text-terminal-green placeholder:text-content-dim focus:border-blood focus:outline-none resize-y"
			/>
			<div className="flex gap-2">
				<button
					type="button"
					onClick={clear}
					className="text-[10px] px-2 py-1 border border-border-dim text-content-dim hover:border-blood hover:text-blood-bright"
				>
					CLEAR
				</button>
			</div>

			{text.trim() && !detected && (
				<div className="text-[10px] text-blood">No VFX* prefix detected.</div>
			)}

			{detected && (
				<div className="border border-border-dim p-2 space-y-1.5 text-[10px]">
					<div className="flex items-center gap-2 flex-wrap">
						<span className="text-blood-bright font-bold">
							{detected.spec.name}
						</span>
						<StatusPill color={detected.validFormat ? "green" : "blood"}>
							{detected.validFormat ? "FORMAT OK" : "EMPTY PAYLOAD"}
						</StatusPill>
						{busy && <StatusPill color="amber">CHECKING PACK…</StatusPill>}
						{packResult && (
							<StatusPill color={packResult.ok ? "green" : "blood"}>
								{packResult.ok ? "PACK VALID" : "PACK INVALID"}
							</StatusPill>
						)}
					</div>
					<div className="text-content-secondary">
						{detected.spec.id} · {detected.spec.module}
						{detected.spec.signed ? " · signed" : " · unsigned"}
					</div>
					<div className="text-content-dim">{detected.spec.description}</div>
					{packResult?.ok && (
						<div className="text-terminal-green">
							{packResult.pack.tokens.length} token(s)
							{packResult.tokenTypes?.length
								? ` — ${packResult.tokenTypes.join(", ")}`
								: ""}
						</div>
					)}
					{packResult && !packResult.ok && (
						<div className="text-blood">{packResult.reason}</div>
					)}
					{packError && <div className="text-blood">{packError}</div>}
				</div>
			)}
		</div>
	);
}
