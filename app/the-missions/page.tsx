"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/stores/useStore";
import { tc } from "@/lib/i18n-content";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import OnboardingWizard from "@/components/shared/OnboardingWizard";
import { sound } from "@/lib/sound";
import {
	PERSONAS,
	setPersona,
	getPersona,
	getCurrentPersona,
	type PersonaId,
	type Persona,
} from "@/lib/personas";
import {
	MISSIONS,
	getMissionsForPersona,
	getMissionProgress,
	completeMissionStep,
	isStepCompleted,
	isMissionCompleted,
	getMissionCompletion,
	getNextStep,
	getMissionStats,
	encodeMissionProgress,
	type MissionId,
	type Mission,
	type MissionStep,
} from "@/lib/missions";
import {
	ensureIdentity,
	type Identity,
	encodeIdentityToken,
	encodePublicCardToken,
	rotateIdentity,
	loadPreviousIdentities,
} from "@/lib/identity";
import {
	runSafetyChecks,
	type SafetyContext,
	type SafetyReport,
} from "@/lib/registry-safety";
import {
	getOpsJournal,
	getRecentEvents,
	getOpsStats,
	logEvent,
	type OpsEvent,
	type OpsStats,
} from "@/lib/ops-journal";

/* ═══════════════════════════════════════════════════════════════
   Component State
   ═══════════════════════════════════════════════════════════════ */

export default function TheMissionsPage() {
	const { lang } = useStore();

	// Persona state
	const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
	const [showPersonaPicker, setShowPersonaPicker] = useState(false);

	// Identity state
	const [identity, setIdentity] = useState<Identity | null>(null);
	const [showIdentity, setShowIdentity] = useState(false);

	// Missions state
	const [availableMissions, setAvailableMissions] = useState<Mission[]>([]);
	const [activeMission, setActiveMission] = useState<Mission | null>(null);
	const [currentStep, setCurrentStep] = useState<MissionStep | null>(null);
	const [missionProgress, setMissionProgress] = useState<
		Record<MissionId, number>
	>({} as Record<MissionId, number>);
	const [missionStats, setMissionStats] = useState(getMissionStats());

	// Safety engine state
	const [safetyReport, setSafetyReport] = useState<SafetyReport | null>(null);
	const [showSafetyCheck, setShowSafetyCheck] = useState(false);

	// Ops journal state
	const [recentEvents, setRecentEvents] = useState<OpsEvent[]>([]);
	const [opsStats, setOpsStats] = useState<OpsStats | null>(null);
	const [showOpsJournal, setShowOpsJournal] = useState(false);

	// Export/import state
	const [exportToken, setExportToken] = useState<string>("");
	const [importToken, setImportToken] = useState<string>("");
	const [importStatus, setImportStatus] = useState<string>("");

	// Key rotation state
	const [showRotateKeyConfirm, setShowRotateKeyConfirm] = useState(false);
	const [rotateKeyStatus, setRotateKeyStatus] = useState<string>("");
	const [previousIdentities, setPreviousIdentities] = useState<any[]>([]);
	const [showIdentityHistory, setShowIdentityHistory] = useState(false);

	/* ═══════════════════════════════════════════════════════════════
     Initialization
     ═══════════════════════════════════════════════════════════════ */

	useEffect(() => {
		// Load current persona
		const currentPersona = getCurrentPersona();
		if (currentPersona) {
			setSelectedPersona(currentPersona);
		} else {
			setShowPersonaPicker(true);
		}

		// Load identity
		ensureIdentity()
			.then(async (id) => {
				if (id) {
					setIdentity(id);
					logEvent({
						type: "identity_loaded",
						title: `Loaded identity: ${id.handle}`,
						details: { handle: id.handle },
					});

					// Load identity history
					try {
						const history = await loadPreviousIdentities();
						setPreviousIdentities(history);
					} catch {
						// No history yet
					}
				}
			})
			.catch(() => {
				// No identity yet, that's okay
			});

		// Load missions for current persona
		if (currentPersona) {
			const missions = getMissionsForPersona(currentPersona.id);
			setAvailableMissions(missions);

			// Load progress for all missions
			const progress: Record<MissionId, number> = {} as Record<
				MissionId,
				number
			>;
			for (const mission of missions) {
				progress[mission.id as MissionId] = getMissionCompletion(
					mission.id as MissionId,
				);
			}
			setMissionProgress(progress);
		}

		// Load ops journal
		const events = getRecentEvents(10);
		setRecentEvents(events);

		const stats = getOpsStats();
		setOpsStats(stats);

		// Log page visit
		logEvent({
			type: "page_visited",
			title: "Visited Missions page",
			details: { route: "/the-missions" },
			route: "/the-missions",
		});
	}, []);

	/* ═══════════════════════════════════════════════════════════════
     Persona Handlers
     ═══════════════════════════════════════════════════════════════ */

	const handleSelectPersona = useCallback((personaId: PersonaId) => {
		setPersona(personaId);
		const persona = PERSONAS[personaId];
		setSelectedPersona(persona);
		setShowPersonaPicker(false);

		// Log the selection
		logEvent({
			type: "persona_selected",
			title: `Selected persona: ${persona.name}`,
			details: { personaId, personaName: persona.name },
			personaId,
		});

		// Update missions for this persona
		const missions = getMissionsForPersona(personaId);
		setAvailableMissions(missions);

		sound.success();
	}, []);

	/* ═══════════════════════════════════════════════════════════════
     Identity Handlers
     ═══════════════════════════════════════════════════════════════ */

	const handleCreateIdentity = useCallback(async () => {
		try {
			const newIdentity = await ensureIdentity();
			setIdentity(newIdentity);

			logEvent({
				type: "identity_created",
				title: `Created identity: ${newIdentity.handle}`,
				details: { handle: newIdentity.handle },
			});

			sound.success();
		} catch (error) {
			sound.error();
			console.error("Failed to create identity:", error);
		}
	}, []);

	const handleExportIdentity = useCallback(async () => {
		if (!identity) return;

		try {
			const token = await encodeIdentityToken(identity);
			setExportToken(token);
			sound.success();
		} catch (error) {
			sound.error();
			console.error("Failed to export identity:", error);
		}
	}, [identity]);

	const handleExportPublicCard = useCallback(() => {
		if (!identity) return;

		try {
			const token = encodePublicCardToken(identity);
			setExportToken(token);
			sound.success();
		} catch (error) {
			sound.error();
			console.error("Failed to export public card:", error);
		}
	}, [identity]);

	const handleRotateKey = useCallback(async () => {
		if (!identity) return;

		try {
			setRotateKeyStatus("Rotating keys...");
			const newIdentity = await rotateIdentity();
			setIdentity(newIdentity);
			setShowRotateKeyConfirm(false);

			// Load previous identities for display
			const history = await loadPreviousIdentities();
			setPreviousIdentities(history);

			logEvent({
				type: "identity_rotated",
				title: `Rotated identity key: ${identity.handle} → ${newIdentity.handle}`,
				details: {
					oldHandle: identity.handle,
					newHandle: newIdentity.handle,
					oldFingerprint: identity.fingerprint,
					newFingerprint: newIdentity.fingerprint,
				},
			});

			setRotateKeyStatus(tc(lang, "rotation.success"));
			sound.success();
		} catch (error) {
			setRotateKeyStatus(tc(lang, "rotation.failed"));
			sound.error();
			console.error("Failed to rotate key:", error);
		}
	}, [identity]);

	const handleLoadIdentityHistory = useCallback(async () => {
		try {
			const history = await loadPreviousIdentities();
			setPreviousIdentities(history);
			setShowIdentityHistory(!showIdentityHistory);
			sound.select();
		} catch (error) {
			sound.error();
			console.error("Failed to load identity history:", error);
		}
	}, [showIdentityHistory]);

	/* ═══════════════════════════════════════════════════════════════
     Mission Handlers
     ═══════════════════════════════════════════════════════════════ */

	const handleStartMission = useCallback((mission: Mission) => {
		setActiveMission(mission);
		const nextStep = getNextStep(mission.id);
		setCurrentStep(nextStep || mission.steps[0]);

		logEvent({
			type: "mission_started",
			title: `Started mission: ${mission.name}`,
			details: { missionId: mission.id, missionName: mission.name },
			missionId: mission.id,
		});

		sound.success();
	}, []);

	const handleCompleteStep = useCallback(
		async (mission: Mission, step: MissionStep) => {
			completeMissionStep(mission.id, step.id);

			// Update progress
			const newProgress = getMissionCompletion(mission.id);
			setMissionProgress((prev) => ({
				...prev,
				[mission.id]: newProgress,
			}));

			// Update stats
			setMissionStats(getMissionStats());

			// Log the step completion
			logEvent({
				type: "mission_step_completed",
				title: `Completed step: ${step.title}`,
				details: {
					missionId: mission.id,
					stepId: step.id,
					stepTitle: step.title,
				},
				missionId: mission.id,
			});

			// Check if mission is complete
			if (isMissionCompleted(mission.id)) {
				logEvent({
					type: "mission_completed",
					title: `Completed mission: ${mission.name}`,
					details: { missionId: mission.id, missionName: mission.name },
					missionId: mission.id,
				});

				sound.success();
				setActiveMission(null);
				setCurrentStep(null);
			} else {
				// Move to next step
				const nextStep = getNextStep(mission.id);
				setCurrentStep(nextStep || null);
				sound.select();
			}
		},
		[],
	);

	const handleExportProgress = useCallback((missionId: MissionId) => {
		const token = encodeMissionProgress(missionId);
		if (token) {
			setExportToken(token);
			sound.success();
		}
	}, []);

	const handleImportProgress = useCallback(() => {
		const trimmed = importToken.trim();
		if (!trimmed) {
			setImportStatus(tc(lang, "import.no_token"));
			sound.error();
			return;
		}

		try {
			const {
				decodeMissionProgress,
				importMissionProgress,
			} = require("@/lib/missions");

			const decoded = decodeMissionProgress(trimmed);
			if (!decoded) {
				setImportStatus(tc(lang, "import.invalid_token"));
				sound.error();
				return;
			}

			const success = importMissionProgress(trimmed);
			if (success) {
				setImportStatus(`✓ Imported progress for mission: ${decoded.m}`);
				sound.success();

				// Refresh mission progress
				if (selectedPersona) {
					const progress: Record<MissionId, number> = {} as any;
					for (const mission of availableMissions) {
						progress[mission.id as MissionId] = getMissionCompletion(
							mission.id as MissionId,
						);
					}
					setMissionProgress(progress);
					setMissionStats(getMissionStats());
				}
			} else {
				setImportStatus(tc(lang, "import.failed"));
				sound.error();
			}
		} catch (error) {
			setImportStatus(tc(lang, "import.failed"));
			sound.error();
			console.error("Import error:", error);
		}
	}, [importToken, selectedPersona, availableMissions]);

	/* ═══════════════════════════════════════════════════════════════
     Safety Engine Handlers
     ═══════════════════════════════════════════════════════════════ */

	const handleRunSafetyCheck = useCallback(async () => {
		if (!activeMission && !identity) {
			setSafetyReport(null);
			return;
		}

		const context: SafetyContext = {
			dossierId: activeMission?.id,
			content: activeMission?.description,
			authorIdentity: identity?.publicKeyHex,
			metadata: {
				mission_name: activeMission?.name,
				persona: selectedPersona?.id,
			},
		};

		try {
			const report = await runSafetyChecks(context);
			setSafetyReport(report);
			sound.success();
		} catch (error) {
			sound.error();
			console.error("Safety check error:", error);
		}
	}, [activeMission, identity, selectedPersona]);

	/* ═══════════════════════════════════════════════════════════════
     Ops Journal Handlers
     ═══════════════════════════════════════════════════════════════ */

	const handleRefreshOpsJournal = useCallback(() => {
		const events = getRecentEvents(10);
		setRecentEvents(events);

		const stats = getOpsStats();
		setOpsStats(stats);

		sound.select();
	}, []);

	/* ═══════════════════════════════════════════════════════════════
     Render Helpers
     ═══════════════════════════════════════════════════════════════ */

	const formatTimestamp = (ts: number): string => {
		return new Date(ts).toLocaleString();
	};

	const formatTime = (seconds: number): string => {
		if (seconds < 60) return `${seconds}s`;
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
		return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
	};

	/* ═══════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════ */

	return (
		<div className="p-3 sm:p-6 md:p-10 max-w-6xl mx-auto">
			{/* Header */}
			<div className="mb-8 pt-4">
				<div className="text-xs text-content-dim mb-1">
					{tc(lang, "missions.section_label") || "TRAINING GROUND"}
				</div>
				<h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
					{tc(lang, "missions.title") || "THE MISSIONS"}
				</h1>
				<p className="text-content-secondary text-sm mt-2">
					{tc(lang, "missions.subtitle") ||
						"Complete guided missions to master V FOR X capabilities. Track progress with VFXMSN1 tokens."}
				</p>
			</div>

			<OnboardingWizard collapsible={false} />

			{/* Persona Picker Modal */}
			{showPersonaPicker && (
				<TerminalCard
					title={tc(lang, "missions.select_persona")}
					accent="blood"
					glow
					className="mb-6"
				>
					<p className="text-xs text-content-secondary mb-4">
						{tc(lang, "missions.select_persona_desc")}
					</p>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
						{Object.values(PERSONAS).map((persona) => (
							<button
								key={persona.id}
								onClick={() => handleSelectPersona(persona.id)}
								className="p-4 border border-border-dim hover:border-blood hover:bg-blood/5 text-left transition-colors"
							>
								<div className="text-2xl mb-2">{persona.icon}</div>
								<div className="text-sm font-bold text-content-primary">
									{persona.name}
								</div>
								<div className="text-xs text-content-dim mt-1">
									{persona.description}
								</div>
								<div className="mt-2">
									<StatusPill
										color={
											persona.threatLevel === "extreme"
												? "blood"
												: persona.threatLevel === "high"
													? "amber"
													: "green"
										}
									>
										{persona.threatLevel.toUpperCase()}
									</StatusPill>
								</div>
							</button>
						))}
					</div>
				</TerminalCard>
			)}

			{/* Current Persona Display */}
			{selectedPersona && !showPersonaPicker && (
				<TerminalCard
					title={tc(lang, "missions.current_persona")}
					accent="green"
					className="mb-6"
				>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<span className="text-3xl">{selectedPersona.icon}</span>
							<div>
								<div className="text-lg font-bold text-content-primary">
									{selectedPersona.name}
								</div>
								<div className="text-xs text-content-dim">
									{selectedPersona.description}
								</div>
							</div>
						</div>
						<button
							onClick={() => setShowPersonaPicker(true)}
							className="text-xs px-3 py-1 border border-border-dim text-content-secondary hover:border-blood hover:text-blood"
						>
							{tc(lang, "missions.change")}
						</button>
					</div>
				</TerminalCard>
			)}

			{/* Identity Display */}
			<TerminalCard
				title={tc(lang, "missions.your_identity")}
				accent="amber"
				className="mb-6"
			>
				{identity ? (
					<div className="space-y-3">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
							<div>
								<div className="text-xs text-content-dim">
									{tc(lang, "missions.handle")}
								</div>
								<div className="text-sm font-bold text-terminal-green">
									{identity.handle}
								</div>
							</div>
							<div>
								<div className="text-xs text-content-dim">
									{tc(lang, "missions.fingerprint")}
								</div>
								<div className="text-sm font-mono text-content-primary">
									{identity.fingerprint}
								</div>
							</div>
						</div>

						{/* Key Rotation Status */}
						{rotateKeyStatus && (
							<div
								className={`p-2 border ${rotateKeyStatus.startsWith("✓") ? "border-terminal-green/50 bg-terminal-green/5" : "border-blood/50 bg-blood/5"}`}
							>
								<div className="text-xs">{rotateKeyStatus}</div>
							</div>
						)}

						{/* Previous Identities Indicator */}
						{previousIdentities.length > 0 && (
							<div className="p-2 border border-warning-amber/30 bg-warning-amber/5">
								<div className="text-xs text-warning-amber mb-1">
									⚠️{" "}
									{tc(lang, "identity.previous_count")
										.replace("{count}", String(previousIdentities.length))
										.replace(
											"{identities}",
											previousIdentities.length === 1
												? tc(lang, "identity.previous_identity")
												: tc(lang, "identity.previous_identities"),
										)}
								</div>
								<button
									onClick={handleLoadIdentityHistory}
									className="text-xs px-2 py-1 border border-warning-amber text-warning-amber hover:bg-warning-amber hover:text-void"
								>
									{showIdentityHistory
										? tc(lang, "identity.hide_history")
										: tc(lang, "identity.view_history")}
								</button>
							</div>
						)}

						<div className="flex gap-2 flex-wrap">
							<button
								onClick={handleExportIdentity}
								className="text-xs px-3 py-1 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void"
							>
								{tc(lang, "missions.export_identity")}
							</button>
							<button
								onClick={handleExportPublicCard}
								className="text-xs px-3 py-1 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green"
							>
								{tc(lang, "missions.export_public_card")}
							</button>
							<button
								onClick={() => setShowIdentity(!showIdentity)}
								className="text-xs px-3 py-1 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green"
							>
								{showIdentity
									? tc(lang, "missions.hide_details")
									: tc(lang, "missions.show_details")}
							</button>
							<button
								onClick={() => setShowRotateKeyConfirm(true)}
								className="text-xs px-3 py-1 border border-blood text-blood hover:bg-blood hover:text-void"
							>
								{tc(lang, "missions.rotate_key")}
							</button>
						</div>

						{/* Identity History Display */}
						{showIdentityHistory && previousIdentities.length > 0 && (
							<div className="mt-3 p-3 bg-panel border border-border-dim">
								<div className="text-xs text-content-dim mb-2">
									{tc(lang, "identity.previous_header")}
								</div>
								<div className="space-y-2">
									{previousIdentities.map((entry, index) => {
										const daysRemaining = Math.max(
											0,
											Math.ceil(
												(entry.gracePeriodUntil - Date.now()) /
													(24 * 60 * 60 * 1000),
											),
										);
										const isExpired = entry.gracePeriodUntil <= Date.now();

										return (
											<div
												key={index}
												className={`p-2 border ${isExpired ? "border-blood/30 bg-blood/5" : "border-warning-amber/30 bg-warning-amber/5"}`}
											>
												<div className="flex items-center justify-between mb-1">
													<div className="text-xs font-bold text-content-primary">
														{entry.identity.handle}
													</div>
													<StatusPill color={isExpired ? "blood" : "amber"}>
														{isExpired
															? tc(lang, "identity.expired")
															: tc(lang, "identity.days_left").replace(
																	"{days}",
																	String(daysRemaining),
																)}
													</StatusPill>
												</div>
												<div className="text-xs text-content-dim font-mono">
													{entry.identity.fingerprint}
												</div>
												<div className="text-xs text-content-dim mt-1">
													{tc(lang, "identity.rotated")}{" "}
													{new Date(entry.rotatedAt).toLocaleDateString()}
													{isExpired
														? tc(lang, "identity.grace_ended")
														: tc(lang, "identity.grace_active")}
												</div>
											</div>
										);
									})}
								</div>
							</div>
						)}

						{showIdentity && (
							<div className="mt-3 p-3 bg-panel border border-border-dim">
								<div className="text-xs text-content-dim mb-2">
									{tc(lang, "identity.public_key")}
								</div>
								<div className="text-[10px] font-mono text-content-primary break-all">
									{identity.publicKeyHex}
								</div>
							</div>
						)}
					</div>
				) : (
					<div className="space-y-3">
						<p className="text-xs text-content-dim">
							{tc(lang, "missions.no_identity")}
						</p>
						<button
							onClick={handleCreateIdentity}
							className="px-4 py-2 border border-blood text-blood-bright hover:bg-blood hover:text-void text-xs font-bold"
						>
							{tc(lang, "missions.create_identity")}
						</button>
					</div>
				)}
			</TerminalCard>

			{/* Missions Overview */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
				{/* Mission Stats */}
				<div className="lg:col-span-1">
					<TerminalCard
						title={tc(lang, "missions.mission_stats")}
						accent="green"
					>
						<div className="space-y-3">
							<div className="flex justify-between">
								<span className="text-xs text-content-dim">
									{tc(lang, "missions.total_missions")}
								</span>
								<span className="text-sm font-bold text-content-primary">
									{missionStats.totalMissions}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-xs text-content-dim">
									{tc(lang, "missions.completed")}
								</span>
								<span className="text-sm font-bold text-terminal-green">
									{missionStats.completedMissions}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-xs text-content-dim">
									{tc(lang, "missions.in_progress")}
								</span>
								<span className="text-sm font-bold text-warning-amber">
									{missionStats.inProgressMissions}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-xs text-content-dim">
									{tc(lang, "missions.not_started")}
								</span>
								<span className="text-sm font-bold text-content-dim">
									{missionStats.notStartedMissions}
								</span>
							</div>
							<div className="pt-2 border-t border-border-dim">
								<div className="flex justify-between">
									<span className="text-xs text-content-dim">
										{tc(lang, "missions.overall_progress")}
									</span>
									<span className="text-sm font-bold text-blood-bright">
										{missionStats.overallCompletion.toFixed(1)}%
									</span>
								</div>
								<div className="w-full bg-panel border border-border-dim mt-1">
									<div
										className="bg-blood-bright h-2"
										style={{ width: `${missionStats.overallCompletion}%` }}
									/>
								</div>
							</div>
						</div>
					</TerminalCard>
				</div>

				{/* Available Missions */}
				<div className="lg:col-span-2">
					<TerminalCard
						title={tc(lang, "missions.available_missions")}
						accent="amber"
					>
						<div className="space-y-2">
							{availableMissions.length === 0 ? (
								<div className="text-xs text-content-dim">
									{tc(lang, "missions.no_missions")}
								</div>
							) : (
								availableMissions.map((mission) => {
									const progress =
										missionProgress[mission.id as MissionId] || 0;
									const isCompleted = isMissionCompleted(mission.id);
									const inProgress = !isCompleted && progress > 0;

									return (
										<div
											key={mission.id}
											className="p-3 border border-border-dim hover:border-blood transition-colors cursor-pointer"
											onClick={() =>
												!isCompleted && handleStartMission(mission)
											}
										>
											<div className="flex items-start justify-between mb-2">
												<div className="flex items-center gap-2">
													<span className="text-xl">{mission.icon}</span>
													<div>
														<div className="text-sm font-bold text-content-primary">
															{mission.name}
														</div>
														<div className="text-xs text-content-dim">
															{mission.description}
														</div>
													</div>
												</div>
												{isCompleted && (
													<StatusPill color="green">COMPLETED</StatusPill>
												)}
												{inProgress && (
													<StatusPill color="amber">
														{progress.toFixed(0)}%
													</StatusPill>
												)}
											</div>
											<div className="flex items-center gap-2">
												<div className="flex-1 bg-panel border border-border-dim">
													<div
														className="h-1.5 bg-terminal-green"
														style={{ width: `${progress}%` }}
													/>
												</div>
												<span className="text-xs text-content-dim">
													{mission.steps.length} steps
												</span>
												<span className="text-xs text-content-dim">
													{formatTime(mission.estimatedTime)}
												</span>
												{!isCompleted && (
													<button
														onClick={(e) => {
															e.stopPropagation();
															handleExportProgress(mission.id);
														}}
														className="text-xs px-2 py-0.5 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green"
													>
														{tc(lang, "missions.export")}
													</button>
												)}
											</div>
										</div>
									);
								})
							)}
						</div>
					</TerminalCard>
				</div>
			</div>

			{/* Active Mission Runner */}
			{activeMission && currentStep && (
				<TerminalCard
					title={`MISSION: ${activeMission.name.toUpperCase()}`}
					accent="blood"
					glow
					className="mb-6"
				>
					<div className="space-y-4">
						{/* Mission Progress */}
						<div className="flex items-center gap-4">
							<div className="flex-1">
								<div className="text-xs text-content-dim mb-1">
									{tc(lang, "missions.mission_progress")}
								</div>
								<div className="w-full bg-panel border border-border-dim">
									<div
										className="bg-blood-bright h-3"
										style={{
											width: `${missionProgress[activeMission.id] || 0}%`,
										}}
									/>
								</div>
							</div>
							<span className="text-sm font-bold text-blood-bright">
								{missionProgress[activeMission.id] || 0}%
							</span>
						</div>

						{/* Current Step */}
						<div className="p-4 border border-blood/50 bg-blood/5">
							<div className="flex items-start gap-3 mb-3">
								<span className="text-2xl">📍</span>
								<div className="flex-1">
									<div className="text-sm font-bold text-blood-bright mb-1">
										{currentStep.title}
									</div>
									<div className="text-xs text-content-secondary">
										{currentStep.description}
									</div>
									{currentStep.route && (
										<div className="mt-2">
											<a
												href={currentStep.route}
												target="_blank"
												rel="noopener noreferrer"
												className="text-xs text-terminal-green hover:underline"
											>
												→ Open {currentStep.route}
											</a>
										</div>
									)}
								</div>
							</div>

							{/* Safety Tips */}
							{currentStep.safetyTips && currentStep.safetyTips.length > 0 && (
								<div className="mt-3 p-2 bg-warning-amber/10 border border-warning-amber/30">
									<div className="text-xs text-warning-amber mb-1">
										{tc(lang, "missions.safety_tips")}
									</div>
									<ul className="text-xs text-content-secondary space-y-1">
										{currentStep.safetyTips.map((tip, i) => (
											<li key={i}>• {tip}</li>
										))}
									</ul>
								</div>
							)}

							{/* Estimated Time */}
							<div className="mt-3 flex items-center gap-2">
								<span className="text-xs text-content-dim">
									{tc(lang, "missions.estimated_time")}
								</span>
								<span className="text-xs text-content-primary">
									{formatTime(currentStep.estimatedTime)}
								</span>
							</div>

							{/* Action Button */}
							{currentStep.requiresAction && (
								<button
									onClick={() => handleCompleteStep(activeMission, currentStep)}
									className="mt-3 w-full py-2 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void text-xs font-bold"
								>
									{tc(lang, "missions.mark_complete")}
								</button>
							)}
						</div>

						{/* All Steps Overview */}
						<div className="border-t border-border-dim pt-3">
							<div className="text-xs text-content-dim mb-2">
								{tc(lang, "missions.all_steps")}
							</div>
							<div className="space-y-1">
								{activeMission.steps.map((step, index) => {
									const isCurrentStep = currentStep.id === step.id;
									const isCompletedStep = isStepCompleted(
										activeMission.id,
										step.id,
									);

									return (
										<div
											key={step.id}
											className={`flex items-center gap-2 p-2 text-xs ${
												isCurrentStep
													? "border border-blood bg-blood/5"
													: "border border-transparent"
											}`}
										>
											<span
												className={
													isCompletedStep
														? "text-terminal-green"
														: "text-content-dim"
												}
											>
												{isCompletedStep ? tc(lang, "ui.checked") : index + 1}
											</span>
											<span
												className={
													isCurrentStep
														? "text-blood-bright font-bold"
														: "text-content-primary"
												}
											>
												{step.title}
											</span>
											{isCurrentStep && (
												<span className="ml-auto text-blood-bright">
													{tc(lang, "missions.current")}
												</span>
											)}
										</div>
									);
								})}
							</div>
						</div>

						{/* Close Mission */}
						<button
							onClick={() => {
								setActiveMission(null);
								setCurrentStep(null);
							}}
							className="w-full py-2 border border-border-dim text-content-secondary hover:border-blood hover:text-blood text-xs"
						>
							{tc(lang, "missions.close_mission")}
						</button>
					</div>
				</TerminalCard>
			)}

			{/* Safety Engine */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
				<TerminalCard title={tc(lang, "missions.safety_engine")} accent="amber">
					<p className="text-xs text-content-dim mb-3">
						{tc(lang, "missions.safety_engine_desc")}
					</p>
					<button
						onClick={handleRunSafetyCheck}
						className="w-full py-2 border border-warning-amber text-warning-amber hover:bg-warning-amber hover:text-void text-xs font-bold"
					>
						{tc(lang, "missions.run_safety_checks")}
					</button>

					{safetyReport && (
						<div className="mt-3 space-y-2">
							<div
								className={`p-2 border ${safetyReport.safe ? "border-terminal-green/50 bg-terminal-green/5" : "border-blood/50 bg-blood/5"}`}
							>
								<div className="flex items-center gap-2 mb-1">
									<StatusPill color={safetyReport.safe ? "green" : "blood"}>
										{safetyReport.safe
											? tc(lang, "missions.safe")
											: tc(lang, "missions.unsafe")}
									</StatusPill>
									<span className="text-xs text-content-secondary">
										{tc(lang, "missions.risk_score")}: {safetyReport.riskScore}
										/100
									</span>
								</div>
								{safetyReport.shouldBlock && (
									<div className="text-xs text-blood-bright mt-1">
										{tc(lang, "missions.publication_blocked")}
									</div>
								)}
							</div>

							{safetyReport.results.map((result) => (
								<div key={result.gate} className="p-2 border border-border-dim">
									<div className="flex items-center justify-between mb-1">
										<span className="text-xs font-bold text-content-primary">
											{result.gate}
										</span>
										<StatusPill
											color={
												result.passed
													? "green"
													: result.severity === "critical"
														? "blood"
														: "amber"
											}
										>
											{result.passed
												? tc(lang, "missions.pass")
												: tc(lang, "missions.fail")}
										</StatusPill>
									</div>
									{!result.passed && result.issues.length > 0 && (
										<div className="text-xs text-content-secondary mt-1">
											{result.issues.map((issue, i) => (
												<div key={i}>• {issue}</div>
											))}
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</TerminalCard>

				{/* Import/Export Progress */}
				<TerminalCard title={tc(lang, "missions.import_export")} accent="green">
					<p className="text-xs text-content-dim mb-3">
						{tc(lang, "missions.import_export_desc")}
					</p>

					{exportToken && (
						<div className="mb-3">
							<label className="text-xs text-content-dim">
								{tc(lang, "missions.last_export")}
							</label>
							<textarea
								readOnly
								value={exportToken}
								className="w-full p-2 bg-abyss border border-border-dim text-[10px] font-mono resize-y min-h-[60px] mt-1"
							/>
						</div>
					)}

					<div className="space-y-2">
						<input
							type="text"
							value={importToken}
							onChange={(e) => setImportToken(e.target.value)}
							placeholder={tc(lang, "missions.paste_token")}
							className="w-full p-2 bg-abyss border border-border-dim text-xs focus:border-terminal-green focus:outline-none"
						/>
						<button
							onClick={handleImportProgress}
							disabled={!importToken.trim()}
							className="w-full py-2 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed"
						>
							{tc(lang, "missions.import_progress")}
						</button>
						{importStatus && (
							<div className="text-xs font-mono">{importStatus}</div>
						)}
					</div>
				</TerminalCard>
			</div>

			{/* Operations Journal */}
			<TerminalCard title={tc(lang, "missions.ops_journal")} className="mb-6">
				<div className="flex items-center justify-between mb-3">
					<p className="text-xs text-content-dim">
						{tc(lang, "missions.ops_journal_desc")}
					</p>
					<button
						onClick={handleRefreshOpsJournal}
						className="text-xs px-2 py-1 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green"
					>
						{tc(lang, "missions.refresh")}
					</button>
				</div>

				{opsStats && (
					<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
						<div className="p-2 border border-border-dim">
							<div className="text-[10px] text-content-dim">
								{tc(lang, "missions.total_events")}
							</div>
							<div className="text-sm font-bold text-content-primary">
								{opsStats.totalEvents}
							</div>
						</div>
						<div className="p-2 border border-border-dim">
							<div className="text-[10px] text-content-dim">
								{tc(lang, "missions.missions_completed")}
							</div>
							<div className="text-sm font-bold text-terminal-green">
								{opsStats.missionsCompleted}
							</div>
						</div>
						<div className="p-2 border border-border-dim">
							<div className="text-[10px] text-content-dim">
								{tc(lang, "missions.current_persona")}
							</div>
							<div className="text-sm font-bold text-blood-bright">
								{opsStats.currentPersona
									? PERSONAS[opsStats.currentPersona]?.name || "None"
									: "None"}
							</div>
						</div>
						<div className="p-2 border border-border-dim">
							<div className="text-[10px] text-content-dim">
								{tc(lang, "missions.journal_age")}
							</div>
							<div className="text-sm font-bold text-content-primary">
								{opsStats.journalAgeDays}
								{tc(lang, "missions.days")}
							</div>
						</div>
					</div>
				)}

				<div className="space-y-1">
					{recentEvents.length === 0 ? (
						<div className="text-xs text-content-dim">
							{tc(lang, "missions.no_events")}
						</div>
					) : (
						recentEvents.map((event) => (
							<div
								key={event.id}
								className="flex items-start gap-2 p-2 border border-border-dim text-xs"
							>
								<span className="text-content-dim font-mono">
									{new Date(event.timestamp).toLocaleTimeString()}
								</span>
								<span className="text-content-primary flex-1">
									{event.title}
								</span>
								{event.personaId && (
									<span className="text-content-dim">
										[{PERSONAS[event.personaId]?.name || event.personaId}]
									</span>
								)}
							</div>
						))
					)}
				</div>
			</TerminalCard>

			{/* Key Rotation Confirmation Modal */}
			{showRotateKeyConfirm && (
				<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
					<TerminalCard
						title={tc(lang, "missions.rotate_key_title")}
						accent="blood"
						glow
						className="max-w-lg"
					>
						<div className="space-y-4">
							<div className="text-xs text-content-secondary">
								<p className="mb-2">{tc(lang, "missions.rotate_warning")}</p>
								<ul className="space-y-1 ml-4 list-disc">
									<li>{tc(lang, "missions.rotate_step1")}</li>
									<li>{tc(lang, "missions.rotate_step2")}</li>
									<li>{tc(lang, "missions.rotate_step3")}</li>
									<li>{tc(lang, "missions.rotate_step4")}</li>
								</ul>
								<p className="mt-2 text-blood-bright font-bold">
									{tc(lang, "missions.rotate_warning2")}
								</p>
							</div>

							<div className="p-2 border border-warning-amber/30 bg-warning-amber/5">
								<div className="text-xs text-warning-amber mb-1">
									{tc(lang, "missions.current_identity")}
								</div>
								<div className="text-xs text-content-primary font-bold">
									{identity?.handle}
								</div>
								<div className="text-xs text-content-dim font-mono">
									{identity?.fingerprint}
								</div>
							</div>

							<div className="flex gap-2">
								<button
									onClick={handleRotateKey}
									className="flex-1 py-2 border border-blood text-blood-bright hover:bg-blood hover:text-void text-xs font-bold"
								>
									{tc(lang, "missions.confirm_rotation")}
								</button>
								<button
									onClick={() => setShowRotateKeyConfirm(false)}
									className="flex-1 py-2 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green text-xs"
								>
									{tc(lang, "missions.cancel")}
								</button>
							</div>
						</div>
					</TerminalCard>
				</div>
			)}
		</div>
	);
}
