"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/stores/useStore";
import { tc } from "@/lib/i18n-content";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
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
  const [missionProgress, setMissionProgress] = useState<Record<MissionId, number>>({} as Record<MissionId, number>);
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
    ensureIdentity().then((id) => {
      if (id) {
        setIdentity(id);
        logEvent({
          type: "identity_loaded",
          title: `Loaded identity: ${id.handle}`,
          details: { handle: id.handle },
        });
      }
    }).catch(() => {
      // No identity yet, that's okay
    });

    // Load missions for current persona
    if (currentPersona) {
      const missions = getMissionsForPersona(currentPersona.id);
      setAvailableMissions(missions);

      // Load progress for all missions
      const progress: Record<MissionId, number> = {} as Record<MissionId, number>;
      for (const mission of missions) {
        progress[mission.id as MissionId] = getMissionCompletion(mission.id as MissionId);
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

  const handleCompleteStep = useCallback(async (mission: Mission, step: MissionStep) => {
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
      details: { missionId: mission.id, stepId: step.id, stepTitle: step.title },
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
  }, []);

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
      setImportStatus("✗ No token provided");
      sound.error();
      return;
    }

    try {
      const { decodeMissionProgress, importMissionProgress } = require("@/lib/missions");

      const decoded = decodeMissionProgress(trimmed);
      if (!decoded) {
        setImportStatus("✗ Invalid mission progress token");
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
            progress[mission.id as MissionId] = getMissionCompletion(mission.id as MissionId);
          }
          setMissionProgress(progress);
          setMissionStats(getMissionStats());
        }
      } else {
        setImportStatus("✗ Failed to import mission progress");
        sound.error();
      }
    } catch (error) {
      setImportStatus("✗ Failed to import mission progress");
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
        <div className="text-xs text-content-dim mb-1">{tc(lang, "missions.section_label") || "TRAINING GROUND"}</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          {tc(lang, "missions.title") || "THE MISSIONS"}
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          {tc(lang, "missions.subtitle") || "Complete guided missions to master V FOR X capabilities. Track progress with VFXMSN1 tokens."}
        </p>
      </div>

      {/* Persona Picker Modal */}
      {showPersonaPicker && (
        <TerminalCard title="SELECT YOUR PERSONA" accent="blood" glow className="mb-6">
          <p className="text-xs text-content-secondary mb-4">
            Choose the persona that best matches your use case and threat model. This will customize your experience and recommend relevant missions.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.values(PERSONAS).map((persona) => (
              <button
                key={persona.id}
                onClick={() => handleSelectPersona(persona.id)}
                className="p-4 border border-border-dim hover:border-blood hover:bg-blood/5 text-left transition-colors"
              >
                <div className="text-2xl mb-2">{persona.icon}</div>
                <div className="text-sm font-bold text-content-primary">{persona.name}</div>
                <div className="text-xs text-content-dim mt-1">{persona.description}</div>
                <div className="mt-2">
                  <StatusPill color={persona.threatLevel === "extreme" ? "blood" : persona.threatLevel === "high" ? "amber" : "green"}>
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
        <TerminalCard title="CURRENT PERSONA" accent="green" className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-3xl">{selectedPersona.icon}</span>
              <div>
                <div className="text-lg font-bold text-content-primary">{selectedPersona.name}</div>
                <div className="text-xs text-content-dim">{selectedPersona.description}</div>
              </div>
            </div>
            <button
              onClick={() => setShowPersonaPicker(true)}
              className="text-xs px-3 py-1 border border-border-dim text-content-secondary hover:border-blood hover:text-blood"
            >
              CHANGE
            </button>
          </div>
        </TerminalCard>
      )}

      {/* Identity Display */}
      <TerminalCard title="YOUR IDENTITY" accent="amber" className="mb-6">
        {identity ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-content-dim">Handle</div>
                <div className="text-sm font-bold text-terminal-green">{identity.handle}</div>
              </div>
              <div>
                <div className="text-xs text-content-dim">Fingerprint</div>
                <div className="text-sm font-mono text-content-primary">{identity.fingerprint}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExportIdentity}
                className="text-xs px-3 py-1 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void"
              >
                EXPORT IDENTITY
              </button>
              <button
                onClick={() => setShowIdentity(!showIdentity)}
                className="text-xs px-3 py-1 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green"
              >
                {showIdentity ? "HIDE DETAILS" : "SHOW DETAILS"}
              </button>
            </div>
            {showIdentity && (
              <div className="mt-3 p-3 bg-panel border border-border-dim">
                <div className="text-xs text-content-dim mb-2">Public Key (hex)</div>
                <div className="text-[10px] font-mono text-content-primary break-all">
                  {identity.publicKeyHex}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-content-dim">
              No identity found. Create your cryptographic identity to sign missions and verify your work.
            </p>
            <button
              onClick={handleCreateIdentity}
              className="px-4 py-2 border border-blood text-blood-bright hover:bg-blood hover:text-void text-xs font-bold"
            >
              CREATE IDENTITY
            </button>
          </div>
        )}
      </TerminalCard>

      {/* Missions Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Mission Stats */}
        <div className="lg:col-span-1">
          <TerminalCard title="MISSION STATS" accent="green">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-content-dim">Total Missions</span>
                <span className="text-sm font-bold text-content-primary">{missionStats.totalMissions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-content-dim">Completed</span>
                <span className="text-sm font-bold text-terminal-green">{missionStats.completedMissions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-content-dim">In Progress</span>
                <span className="text-sm font-bold text-warning-amber">{missionStats.inProgressMissions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-content-dim">Not Started</span>
                <span className="text-sm font-bold text-content-dim">{missionStats.notStartedMissions}</span>
              </div>
              <div className="pt-2 border-t border-border-dim">
                <div className="flex justify-between">
                  <span className="text-xs text-content-dim">Overall Progress</span>
                  <span className="text-sm font-bold text-blood-bright">{missionStats.overallCompletion.toFixed(1)}%</span>
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
          <TerminalCard title="AVAILABLE MISSIONS" accent="amber">
            <div className="space-y-2">
              {availableMissions.length === 0 ? (
                <div className="text-xs text-content-dim">
                  No missions available for current persona. Select a different persona to see relevant missions.
                </div>
              ) : (
                availableMissions.map((mission) => {
                  const progress = missionProgress[mission.id as MissionId] || 0;
                  const isCompleted = isMissionCompleted(mission.id);
                  const inProgress = !isCompleted && progress > 0;

                  return (
                    <div
                      key={mission.id}
                      className="p-3 border border-border-dim hover:border-blood transition-colors cursor-pointer"
                      onClick={() => !isCompleted && handleStartMission(mission)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{mission.icon}</span>
                          <div>
                            <div className="text-sm font-bold text-content-primary">{mission.name}</div>
                            <div className="text-xs text-content-dim">{mission.description}</div>
                          </div>
                        </div>
                        {isCompleted && (
                          <StatusPill color="green">COMPLETED</StatusPill>
                        )}
                        {inProgress && (
                          <StatusPill color="amber">{progress.toFixed(0)}%</StatusPill>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-panel border border-border-dim">
                          <div
                            className="h-1.5 bg-terminal-green"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-content-dim">{mission.steps.length} steps</span>
                        <span className="text-xs text-content-dim">{formatTime(mission.estimatedTime)}</span>
                        {!isCompleted && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportProgress(mission.id);
                            }}
                            className="text-xs px-2 py-0.5 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green"
                          >
                            EXPORT
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
        <TerminalCard title={`MISSION: ${activeMission.name.toUpperCase()}`} accent="blood" glow className="mb-6">
          <div className="space-y-4">
            {/* Mission Progress */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-xs text-content-dim mb-1">Mission Progress</div>
                <div className="w-full bg-panel border border-border-dim">
                  <div
                    className="bg-blood-bright h-3"
                    style={{ width: `${missionProgress[activeMission.id] || 0}%` }}
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
                  <div className="text-sm font-bold text-blood-bright mb-1">{currentStep.title}</div>
                  <div className="text-xs text-content-secondary">{currentStep.description}</div>
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
                  <div className="text-xs text-warning-amber mb-1">⚠️ SAFETY TIPS</div>
                  <ul className="text-xs text-content-secondary space-y-1">
                    {currentStep.safetyTips.map((tip, i) => (
                      <li key={i}>• {tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Estimated Time */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-content-dim">⏱️ Estimated time:</span>
                <span className="text-xs text-content-primary">{formatTime(currentStep.estimatedTime)}</span>
              </div>

              {/* Action Button */}
              {currentStep.requiresAction && (
                <button
                  onClick={() => handleCompleteStep(activeMission, currentStep)}
                  className="mt-3 w-full py-2 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void text-xs font-bold"
                >
                  MARK STEP COMPLETE
                </button>
              )}
            </div>

            {/* All Steps Overview */}
            <div className="border-t border-border-dim pt-3">
              <div className="text-xs text-content-dim mb-2">ALL STEPS</div>
              <div className="space-y-1">
                {activeMission.steps.map((step, index) => {
                  const isCurrentStep = currentStep.id === step.id;
                  const isCompletedStep = isStepCompleted(activeMission.id, step.id);

                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-2 p-2 text-xs ${
                        isCurrentStep ? "border border-blood bg-blood/5" : "border border-transparent"
                      }`}
                    >
                      <span className={isCompletedStep ? "text-terminal-green" : "text-content-dim"}>
                        {isCompletedStep ? "✓" : index + 1}
                      </span>
                      <span className={isCurrentStep ? "text-blood-bright font-bold" : "text-content-primary"}>
                        {step.title}
                      </span>
                      {isCurrentStep && <span className="ml-auto text-blood-bright">← CURRENT</span>}
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
              CLOSE MISSION
            </button>
          </div>
        </TerminalCard>
      )}

      {/* Safety Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <TerminalCard title="SAFETY ENGINE" accent="amber">
          <p className="text-xs text-content-dim mb-3">
            Run safety checks before publishing sensitive content. The 6 gates prevent witch hunts and protect subjects.
          </p>
          <button
            onClick={handleRunSafetyCheck}
            className="w-full py-2 border border-warning-amber text-warning-amber hover:bg-warning-amber hover:text-void text-xs font-bold"
          >
            RUN SAFETY CHECKS
          </button>

          {safetyReport && (
            <div className="mt-3 space-y-2">
              <div className={`p-2 border ${safetyReport.safe ? "border-terminal-green/50 bg-terminal-green/5" : "border-blood/50 bg-blood/5"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <StatusPill color={safetyReport.safe ? "green" : "blood"}>
                    {safetyReport.safe ? "SAFE" : "UNSAFE"}
                  </StatusPill>
                  <span className="text-xs text-content-secondary">
                    Risk Score: {safetyReport.riskScore}/100
                  </span>
                </div>
                {safetyReport.shouldBlock && (
                  <div className="text-xs text-blood-bright mt-1">
                    ⚠️ Publication blocked due to safety concerns
                  </div>
                )}
              </div>

              {safetyReport.results.map((result) => (
                <div key={result.gate} className="p-2 border border-border-dim">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-content-primary">{result.gate}</span>
                    <StatusPill color={result.passed ? "green" : result.severity === "critical" ? "blood" : "amber"}>
                      {result.passed ? "PASS" : "FAIL"}
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
        <TerminalCard title="IMPORT / EXPORT PROGRESS" accent="green">
          <p className="text-xs text-content-dim mb-3">
            Export your mission progress as VFXMSN1 tokens for backup or share with trusted allies.
          </p>

          {exportToken && (
            <div className="mb-3">
              <label className="text-xs text-content-dim">Last Export</label>
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
              placeholder="Paste VFXMSN1 token to import..."
              className="w-full p-2 bg-abyss border border-border-dim text-xs focus:border-terminal-green focus:outline-none"
            />
            <button
              onClick={handleImportProgress}
              disabled={!importToken.trim()}
              className="w-full py-2 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed"
            >
              IMPORT PROGRESS
            </button>
            {importStatus && (
              <div className="text-xs font-mono">{importStatus}</div>
            )}
          </div>
        </TerminalCard>
      </div>

      {/* Operations Journal */}
      <TerminalCard title="OPERATIONS JOURNAL" className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-content-dim">
            Local activity log - self-monitoring with no phone-home. All data stays on your device.
          </p>
          <button
            onClick={handleRefreshOpsJournal}
            className="text-xs px-2 py-1 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green"
          >
            REFRESH
          </button>
        </div>

        {opsStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="p-2 border border-border-dim">
              <div className="text-[10px] text-content-dim">Total Events</div>
              <div className="text-sm font-bold text-content-primary">{opsStats.totalEvents}</div>
            </div>
            <div className="p-2 border border-border-dim">
              <div className="text-[10px] text-content-dim">Missions Completed</div>
              <div className="text-sm font-bold text-terminal-green">{opsStats.missionsCompleted}</div>
            </div>
            <div className="p-2 border border-border-dim">
              <div className="text-[10px] text-content-dim">Current Persona</div>
              <div className="text-sm font-bold text-blood-bright">
                {opsStats.currentPersona ? PERSONAS[opsStats.currentPersona]?.name || "None" : "None"}
              </div>
            </div>
            <div className="p-2 border border-border-dim">
              <div className="text-[10px] text-content-dim">Journal Age</div>
              <div className="text-sm font-bold text-content-primary">{opsStats.journalAgeDays} days</div>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {recentEvents.length === 0 ? (
            <div className="text-xs text-content-dim">No recent events logged</div>
          ) : (
            recentEvents.map((event) => (
              <div key={event.id} className="flex items-start gap-2 p-2 border border-border-dim text-xs">
                <span className="text-content-dim font-mono">{new Date(event.timestamp).toLocaleTimeString()}</span>
                <span className="text-content-primary flex-1">{event.title}</span>
                {event.personaId && (
                  <span className="text-content-dim">[{PERSONAS[event.personaId]?.name || event.personaId}]</span>
                )}
              </div>
            ))
          )}
        </div>
      </TerminalCard>
    </div>
  );
}