"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import {
	getAllPersonas,
	getPersona,
	setPersona,
	type PersonaId,
} from "@/lib/personas";
import {
	ensureIdentity,
	encodePublicCardToken,
	encodeIdentityToken,
	signWitnessWithIdentity,
	type Identity,
} from "@/lib/identity";
import {
	buildWitness,
	encodeWitnessLedger,
	loadWitnessLedger,
	saveWitnessLedger,
	type SignedWitness,
} from "@/lib/witness";
import { createPackWithIdentity, encodePack } from "@/lib/vfxpack";
import { completeMissionStep } from "@/lib/missions";
import {
	DEFAULT_ONBOARD_WITNESS,
	ONBOARD_MISSION_ID,
	ONBOARD_PHASE_META,
	dismissOnboard,
	isOnboardDismissed,
	nextOnboardPhase,
	type OnboardPhase,
} from "@/lib/onboarding";

type Props = {
	/** When true, hide if already dismissed or done. Default true on home. */
	collapsible?: boolean;
	className?: string;
};

export default function OnboardingWizard({
	collapsible = true,
	className = "",
}: Props) {
	const [ready, setReady] = useState(false);
	const [hidden, setHidden] = useState(false);
	const [persona, setPersonaState] = useState<PersonaId | null>(null);
	const [identity, setIdentity] = useState<Identity | null>(null);
	const [witness, setWitness] = useState<SignedWitness | null>(null);
	const [witnessText, setWitnessText] = useState(DEFAULT_ONBOARD_WITNESS);
	const [packToken, setPackToken] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const refresh = useCallback(async () => {
		setPersonaState(getPersona());
		try {
			const { loadIdentity } = await import("@/lib/identity");
			const id = await loadIdentity();
			setIdentity(id);
		} catch {
			setIdentity(null);
		}
		const ledger = loadWitnessLedger();
		const mine = ledger.find(
			(w) =>
				w.text.includes("onboarding") || w.text === DEFAULT_ONBOARD_WITNESS,
		);
		setWitness(mine ?? ledger[ledger.length - 1] ?? null);
	}, []);

	useEffect(() => {
		if (collapsible && isOnboardDismissed()) {
			setHidden(true);
			setReady(true);
			return;
		}
		void refresh().finally(() => setReady(true));
	}, [collapsible, refresh]);

	const phase: OnboardPhase = useMemo(
		() =>
			nextOnboardPhase({
				persona,
				hasIdentity: !!identity,
				hasWitness: !!witness?.signature,
				hasPackExport: !!packToken,
			}),
		[persona, identity, witness, packToken],
	);

	const personas = useMemo(() => getAllPersonas(), []);
	const meta = ONBOARD_PHASE_META[phase];

	const pickPersona = async (id: PersonaId) => {
		setError(null);
		setPersona(id);
		setPersonaState(id);
		await completeMissionStep(ONBOARD_MISSION_ID, "choose_persona");
	};

	const createId = async () => {
		setBusy(true);
		setError(null);
		try {
			const id = await ensureIdentity();
			setIdentity(id);
			await completeMissionStep(ONBOARD_MISSION_ID, "create_identity");
		} catch (e) {
			setError(e instanceof Error ? e.message : "identity failed");
		} finally {
			setBusy(false);
		}
	};

	const signWitness = async () => {
		if (!identity) return;
		setBusy(true);
		setError(null);
		try {
			const signFn = await signWitnessWithIdentity(identity);
			const prev = loadWitnessLedger();
			const prevHash = prev.length ? prev[prev.length - 1]!.hash : undefined;
			const stmt = await buildWitness(
				{ text: witnessText.trim() || DEFAULT_ONBOARD_WITNESS, prevHash },
				signFn,
			);
			saveWitnessLedger([...prev, stmt]);
			setWitness(stmt);
			await completeMissionStep(ONBOARD_MISSION_ID, "verify_identity");
		} catch (e) {
			setError(e instanceof Error ? e.message : "witness failed");
		} finally {
			setBusy(false);
		}
	};

	const exportPack = async () => {
		if (!identity || !witness) return;
		setBusy(true);
		setError(null);
		try {
			const pub = encodePublicCardToken(identity);
			const idToken = await encodeIdentityToken(identity);
			const witTok = encodeWitnessLedger([witness]);
			const pack = await createPackWithIdentity(
				[pub, idToken, witTok],
				identity,
				{
					label: "onboarding",
					description: "First offline loop: identity + witness",
					kind: "collection",
				},
			);
			const token = encodePack(pack);
			setPackToken(token);
			await completeMissionStep(ONBOARD_MISSION_ID, "export_identity");
		} catch (e) {
			setError(e instanceof Error ? e.message : "pack failed");
		} finally {
			setBusy(false);
		}
	};

	const copyPack = async () => {
		if (!packToken) return;
		try {
			await navigator.clipboard.writeText(packToken);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			setError("clipboard blocked — select and copy manually");
		}
	};

	const finish = () => {
		dismissOnboard();
		setHidden(true);
	};

	if (!ready || hidden) return null;
	if (collapsible && phase === "done" && packToken) {
		/* still show done once so user can copy */
	}

	return (
		<TerminalCard
			title={`START HERE · STEP ${meta.n}/4 · ${meta.title.toUpperCase()}`}
			accent={phase === "done" ? "green" : "blood"}
			glow={phase !== "done"}
			className={`mb-6 ${className}`}
		>
			<p className="text-xs text-content-dim mb-3">{meta.blurb}</p>

			{/* progress dots */}
			<div className="flex gap-1 mb-4" aria-hidden>
				{(["persona", "identity", "witness", "pack"] as const).map((p) => {
					const done =
						(p === "persona" && !!persona) ||
						(p === "identity" && !!identity) ||
						(p === "witness" && !!witness?.signature) ||
						(p === "pack" && !!packToken);
					const active = phase === p;
					return (
						<div
							key={p}
							className={`h-1 flex-1 ${
								done
									? "bg-terminal-green"
									: active
										? "bg-blood"
										: "bg-border-dim"
							}`}
						/>
					);
				})}
			</div>

			{error && (
				<p className="text-xs text-blood mb-2" role="alert">
					{error}
				</p>
			)}

			{phase === "persona" && (
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
					{personas.map((p) => (
						<button
							key={p.id}
							type="button"
							onClick={() => void pickPersona(p.id)}
							className="text-left p-3 border border-border-dim hover:border-blood transition-colors"
						>
							<div className="text-sm font-bold text-blood-bright">
								{p.icon} {p.name}
							</div>
							<div className="text-[10px] text-content-dim mt-1 line-clamp-2">
								{p.description}
							</div>
						</button>
					))}
				</div>
			)}

			{phase === "identity" && (
				<div className="space-y-3">
					<p className="text-xs text-content-secondary">
						Generates a VFXID1 handle on-device. Private key never leaves the
						browser.
					</p>
					<button
						type="button"
						disabled={busy}
						onClick={() => void createId()}
						className="px-3 py-2 border border-blood text-blood-bright text-xs uppercase tracking-widest hover:bg-blood/10 disabled:opacity-50"
					>
						{busy ? "Generating…" : "Create identity"}
					</button>
				</div>
			)}

			{phase === "witness" && identity && (
				<div className="space-y-3">
					<div className="text-[10px] text-content-dim font-mono">
						handle {identity.handle} · fp {identity.fingerprint.slice(0, 12)}…
					</div>
					<textarea
						value={witnessText}
						onChange={(e) => setWitnessText(e.target.value)}
						rows={3}
						maxLength={500}
						className="w-full bg-abyss border border-border-dim p-2 text-xs text-terminal-green focus:border-blood focus:outline-none"
					/>
					<button
						type="button"
						disabled={busy || !witnessText.trim()}
						onClick={() => void signWitness()}
						className="px-3 py-2 border border-blood text-blood-bright text-xs uppercase tracking-widest hover:bg-blood/10 disabled:opacity-50"
					>
						{busy ? "Signing…" : "Sign witness"}
					</button>
				</div>
			)}

			{phase === "pack" && identity && witness && (
				<div className="space-y-3">
					<StatusPill color="green">Witness signed</StatusPill>
					<button
						type="button"
						disabled={busy}
						onClick={() => void exportPack()}
						className="px-3 py-2 border border-terminal-green text-terminal-green text-xs uppercase tracking-widest hover:bg-terminal-green/10 disabled:opacity-50"
					>
						{busy ? "Packing…" : "Export VFXPACK1"}
					</button>
				</div>
			)}

			{(phase === "done" || packToken) && packToken && (
				<div className="space-y-3">
					<StatusPill color="green">Offline loop complete</StatusPill>
					<textarea
						readOnly
						value={packToken}
						rows={4}
						className="w-full bg-abyss border border-border-dim p-2 text-[10px] text-terminal-green font-mono"
					/>
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							onClick={() => void copyPack()}
							className="px-3 py-2 border border-terminal-green text-terminal-green text-xs uppercase tracking-widest"
						>
							{copied ? "Copied" : "Copy pack"}
						</button>
						{collapsible && (
							<button
								type="button"
								onClick={finish}
								className="px-3 py-2 border border-border-dim text-content-dim text-xs uppercase tracking-widest"
							>
								Dismiss
							</button>
						)}
					</div>
				</div>
			)}

			{collapsible && phase !== "done" && !packToken && (
				<button
					type="button"
					onClick={finish}
					className="mt-4 text-[10px] text-content-dim underline"
				>
					Skip for now
				</button>
			)}
		</TerminalCard>
	);
}
