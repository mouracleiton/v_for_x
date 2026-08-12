/**
 * V FOR X — Guided Missions
 *
 * Provides 6 guided missions that introduce users to core platform capabilities
 * through persona-relevant workflows. Missions are structured as step-by-step
 * tutorials with progress tracking via VFXMSN1 tokens.
 *
 * The 6 missions:
 *   1. ESTABLISH_IDENTITY: Create your VFXID1 identity and safety number
 *   2. VERIFY_CLAIMS: Learn to verify witness statements and evidence
 *   3. SECURE_COMMUNICATIONS: WebRTC mesh networking and signaling
 *   4. EVIDENCE_COLLECTION: Document and chain evidence custody
 *   5. MUTUAL_AID_COORDINATION: Use Trail for resource matching
 *   6. DEAD_MANS_SWITCH: Setup Guardian release packets
 *
 * Mission progress is tracked via VFXMSN1 tokens that can be exported/imported
 * to share progress between devices or backup mission completion.
 *
 * Storage: localStorage key "vfx_missions_progress"
 */

import { type PersonaId } from "./personas";

/* ═══════════════════════════════════════════════════════════════
   Mission Types & Definitions
   ═══════════════════════════════════════════════════════════════ */

export type MissionId =
  | "establish_identity"
  | "verify_claims"
  | "secure_communications"
  | "evidence_collection"
  | "mutual_aid_coordination"
  | "dead_mans_switch";

export interface MissionStep {
  /** Unique step identifier */
  id: string;
  /** Step title (English base, localized via i18n) */
  title: string;
  /** Step description */
  description: string;
  /** Route href to navigate to for this step (optional) */
  route?: string;
  /** Whether this step requires completing a specific action */
  requiresAction: boolean;
  /** Expected completion time in seconds */
  estimatedTime: number;
  /** Safety tips relevant to this step */
  safetyTips?: string[];
}

export interface Mission {
  /** Unique mission identifier */
  id: MissionId;
  /** Mission name (English base, localized via i18n) */
  name: string;
  /** Short description */
  description: string;
  /** Icon/emoji for the mission */
  icon: string;
  /** Which personas this mission is recommended for */
  recommendedFor: PersonaId[];
  /** Mission steps in order */
  steps: MissionStep[];
  /** Estimated total completion time in seconds */
  estimatedTime: number;
  /** Difficulty level */
  difficulty: "beginner" | "intermediate" | "advanced";
  /** Core capabilities this mission teaches */
  capabilities: string[];
}

/* ═══════════════════════════════════════════════════════════════
   Mission Definitions
   ═══════════════════════════════════════════════════════════════ */

export const MISSIONS: Record<MissionId, Mission> = {
  establish_identity: {
    id: "establish_identity",
    name: "Establish Your Identity",
    description: "Create your cryptographic identity and safety number for secure communications",
    icon: "🪪",
    recommendedFor: ["journalist", "activist", "aid_worker", "researcher", "civilian"],
    steps: [
      {
        id: "choose_persona",
        title: "Choose Your Persona",
        description: "Select the persona that best matches your use case and threat model",
        route: "/the-missions",
        requiresAction: true,
        estimatedTime: 60,
        safetyTips: ["Choose honestly - this affects default security settings", "You can change personas later"],
      },
      {
        id: "create_identity",
        title: "Create Your VFXID1 Identity",
        description: "Generate your ECDSA P-256 key pair and unique handle",
        route: "/the-bridge",
        requiresAction: true,
        estimatedTime: 120,
        safetyTips: ["Your private key never leaves your device", "Write down your safety number", "Keep a backup in a secure location"],
      },
      {
        id: "export_identity",
        title: "Export Your Identity Card",
        description: "Create a public identity card to share with contacts",
        route: "/the-bridge",
        requiresAction: true,
        estimatedTime: 60,
        safetyTips: ["Only public information is exported", "Never share your private key", "Share via QR or secure channel"],
      },
      {
        id: "verify_identity",
        title: "Verify Identity Signature",
        description: "Confirm your identity signature works correctly",
        route: "/the-bridge",
        requiresAction: true,
        estimatedTime: 30,
        safetyTips: ["This confirms your keys are working", "No data is sent to any server"],
      },
    ],
    estimatedTime: 270,
    difficulty: "beginner",
    capabilities: ["identity", "cryptography", "safety_numbers"],
  },
  verify_claims: {
    id: "verify_claims",
    name: "Verify Claims and Evidence",
    description: "Learn to verify witness statements, evidence chains, and public records",
    icon: "🔍",
    recommendedFor: ["journalist", "researcher", "aid_worker"],
    steps: [
      {
        id: "understand_verification",
        title: "Understanding Verification",
        description: "Learn how cryptographic verification works without trusted third parties",
        route: "/the-receipts",
        requiresAction: false,
        estimatedTime: 180,
        safetyTips: ["Verification is mathematical, not based on trust", "Anyone can verify signatures independently"],
      },
      {
        id: "verify_witness_statement",
        title: "Verify a Witness Statement",
        description: "Verify a VFXWIT1 witness statement signature and chain",
        route: "/the-receipts",
        requiresAction: true,
        estimatedTime: 120,
        safetyTips: ["Check the signature matches the author", "Verify the hash chain is intact", "Look for corroborating evidence"],
      },
      {
        id: "verify_evidence_chain",
        title: "Verify Evidence Chain",
        description: "Verify a VFXEV1 evidence room chain of custody",
        route: "/the-receipts",
        requiresAction: true,
        estimatedTime: 150,
        safetyTips: ["Each link must be properly signed", "Check timestamps are sequential", "Verify ZK custody seals"],
      },
      {
        id: "verify_data_integrity",
        title: "Verify Data Manifest",
        description: "Check the integrity of platform data against signed manifests",
        route: "/the-receipts",
        requiresAction: true,
        estimatedTime: 90,
        safetyTips: ["This confirms no tampering with static data", "Run periodically to ensure integrity"],
      },
    ],
    estimatedTime: 540,
    difficulty: "intermediate",
    capabilities: ["verification", "witness_ledger", "evidence_room", "data_integrity"],
  },
  secure_communications: {
    id: "secure_communications",
    name: "Secure Communications",
    description: "Setup WebRTC mesh networking for serverless peer-to-peer communication",
    icon: "📡",
    recommendedFor: ["journalist", "activist", "aid_worker"],
    steps: [
      {
        id: "understand_webrtc",
        title: "Understanding WebRTC Mesh",
        description: "Learn how WebRTC enables serverless peer-to-peer communication",
        route: "/the-web",
        requiresAction: false,
        estimatedTime: 120,
        safetyTips: ["WebRTC connects directly peer-to-peer", "No central server stores your messages", "Your ISP can see you're using WebRTC but not the content"],
      },
      {
        id: "create_signal_offer",
        title: "Create a Signal Offer",
        description: "Generate a VFXSIG1 signal offer to share with a contact",
        route: "/the-web",
        requiresAction: true,
        estimatedTime: 90,
        safetyTips: ["Share signal offers via secure channels", "Signal offers expire after a time", "Each offer is one-use"],
      },
      {
        id: "answer_signal",
        title: "Answer a Signal Offer",
        description: "Accept a signal offer from a contact and establish connection",
        route: "/the-web",
        requiresAction: true,
        estimatedTime: 60,
        safetyTips: ["Only answer offers from trusted contacts", "Verify safety numbers before sensitive communications"],
      },
      {
        id: "send_message",
        title: "Send Your First Message",
        description: "Send a test message through the WebRTC DataChannel",
        route: "/the-web",
        requiresAction: true,
        estimatedTime: 60,
        safetyTips: ["Messages are encrypted end-to-end", "No copy is stored on any server", "Both parties must be online"],
      },
      {
        id: "verify_safety_number",
        title: "Verify Safety Numbers",
        description: "Exchange and verify safety numbers with your contact",
        route: "/the-web",
        requiresAction: true,
        estimatedTime: 90,
        safetyTips: ["Safety numbers protect against impersonation", "Verify in-person if possible", "Compare numbers digit by digit"],
      },
    ],
    estimatedTime: 420,
    difficulty: "intermediate",
    capabilities: ["webrtc", "signaling", "mesh_networking", "safety_numbers"],
  },
  evidence_collection: {
    id: "evidence_collection",
    name: "Evidence Collection",
    description: "Document, timestamp, and chain evidence for verifiable custody",
    icon: "📸",
    recommendedFor: ["journalist", "aid_worker", "activist"],
    steps: [
      {
        id: "understand_evidence",
        title: "Understanding Evidence Chains",
        description: "Learn how hash-chained evidence provides verifiable custody",
        route: "/the-fortress",
        requiresAction: false,
        estimatedTime: 150,
        safetyTips: ["Evidence chains prevent tampering", "Each link is cryptographically signed", "Broken chains are detectable"],
      },
      {
        id: "create_evidence_item",
        title: "Create Your First Evidence Item",
        description: "Add an evidence item to the evidence room with SHA-256 hash",
        route: "/the-fortress",
        requiresAction: true,
        estimatedTime: 120,
        safetyTips: ["Include all metadata and context", "Hash is calculated automatically", "Store original files securely"],
      },
      {
        id: "mint_chain_record",
        title: "Mint a Chain Record",
        description: "Create a VFXEV1 chain record linking your evidence",
        route: "/the-fortress",
        requiresAction: true,
        estimatedTime: 90,
        safetyTips: ["Chain records reference previous evidence", "This creates an immutable timeline", "Signed with your identity"],
      },
      {
        id: "seal_with_zk",
        title: "Seal with ZK Custody",
        description: "Create a zero-knowledge custody seal for sensitive evidence",
        route: "/the-fortress",
        requiresAction: true,
        estimatedTime: 120,
        safetyTips: ["ZK seals prove custody without revealing content", "Use for sensitive or classified evidence", "Keep decryption key secure"],
      },
      {
        id: "export_evidence_pack",
        title: "Export Evidence Pack",
        description: "Create a VFXPACK1 bundle containing your evidence chain",
        route: "/the-fortress",
        requiresAction: true,
        estimatedTime: 90,
        safetyTips: ["Packs are portable and verifiable", "Include only public evidence in shared packs", "Keep sensitive packs encrypted"],
      },
    ],
    estimatedTime: 570,
    difficulty: "advanced",
    capabilities: ["evidence_room", "hash_chains", "zk_proofs", "vfxpack"],
  },
  mutual_aid_coordination: {
    id: "mutual_aid_coordination",
    name: "Mutual Aid Coordination",
    description: "Use the Trail system for resource matching and mutual aid coordination",
    icon: "🤝",
    recommendedFor: ["aid_worker", "activist", "civilian"],
    steps: [
      {
        id: "understand_trail",
        title: "Understanding the Trail",
        description: "Learn how Trail connects needs with offers without central coordination",
        route: "/the-trail",
        requiresAction: false,
        estimatedTime: 120,
        safetyTips: ["Trail works offline and peer-to-peer", "No central platform stores your data", "You control what you share"],
      },
      {
        id: "post_need_or_offer",
        title: "Post Your First Need or Offer",
        description: "Create a Trail entry for a need or offer",
        route: "/the-trail",
        requiresAction: true,
        estimatedTime: 90,
        safetyTips: ["Be specific but cautious about personal details", "Use general locations for safety", "Include contact instructions", "You can edit or delete entries"],
      },
      {
        id: "search_matching",
        title: "Search for Matches",
        description: "Search and filter Trail entries for matching needs/offers",
        route: "/the-trail",
        requiresAction: true,
        estimatedTime: 60,
        safetyTips: ["Verify contacts before meeting", "Meet in safe public locations", "Trust your instincts"],
      },
      {
        id: "create_fulfillment",
        title: "Record a Fulfillment",
        description: "Create a fulfillment record when a need is met",
        route: "/the-trail",
        requiresAction: true,
        estimatedTime: 60,
        safetyTips: ["Fulfillment records build trust", "You can record anonymously", "Include only relevant details"],
      },
      {
        id: "allocate_resources",
        title: "Use the Allocator",
        description: "Plan resource allocation using the Allocator tool",
        route: "/the-allocator",
        requiresAction: true,
        estimatedTime: 120,
        safetyTips: ["Allocator helps plan, not enforce distribution", "Save allocations for offline reference", "Prioritize urgent needs"],
      },
    ],
    estimatedTime: 450,
    difficulty: "beginner",
    capabilities: ["trail", "allocator", "mutual_aid", "resource_matching"],
  },
  dead_mans_switch: {
    id: "dead_mans_switch",
    name: "Dead Man's Switch",
    description: "Setup Guardian release packets for automatic disclosure if you're incapacitated",
    icon: "⚠️",
    recommendedFor: ["journalist", "activist", "aid_worker"],
    steps: [
      {
        id: "understand_deadman",
        title: "Understanding Dead Man's Switches",
        description: "Learn how automatic disclosure protects against disappearance",
        route: "/the-guardian",
        requiresAction: false,
        estimatedTime: 120,
        safetyTips: ["Dead man's switches activate if you can't check in", "Choose a realistic check-in interval", "Have a duress password for immediate release"],
      },
      {
        id: "create_release_packet",
        title: "Create Your First Release Packet",
        description: "Prepare a VFXGP1 encrypted release packet",
        route: "/the-guardian",
        requiresAction: true,
        estimatedTime: 180,
        safetyTips: ["Packets are encrypted and can only be opened with your key", "Include instructions for recipients", "Test with dummy content first"],
      },
      {
        id: "setup_checkin",
        title: "Setup Your Check-in Schedule",
        description: "Configure automatic check-in intervals and deadlines",
        route: "/the-guardian",
        requiresAction: true,
        estimatedTime: 90,
        safetyTips: ["Choose intervals you can realistically meet", "Set multiple deadlines for escalation", "Consider time zones if traveling"],
      },
      {
        id: "configure_duress",
        title: "Configure Duress Mode",
        description: "Setup a duress password for immediate release",
        route: "/the-guardian",
        requiresAction: true,
        estimatedTime: 60,
        safetyTips: ["Duress password triggers immediate release", "Choose something memorable but not obvious", "Don't write it down"],
      },
      {
        id: "test_release",
        title: "Test Release Process",
        description: "Test the release process with safe test content",
        route: "/the-guardian",
        requiresAction: true,
        estimatedTime: 120,
        safetyTips: ["Always test with non-sensitive content first", "Verify recipients can decrypt test packets", "Ensure release works offline"],
      },
    ],
    estimatedTime: 570,
    difficulty: "advanced",
    capabilities: ["dead_mans_switch", "encrypted_release", "duress_mode", "guardian_packets"],
  },
};

/* ═══════════════════════════════════════════════════════════════
   Mission Progress Tracking
   ═══════════════════════════════════════════════════════════════ */

const MISSIONS_STORAGE_KEY = "vfx_missions_progress";

export interface MissionProgress {
  /** Mission ID */
  missionId: MissionId;
  /** Which steps have been completed */
  completedSteps: string[];
  /** When the mission was started */
  startedAt: number;
  /** When the mission was completed (null if not completed) */
  completedAt: number | null;
  /** Last step completed */
  lastCompletedAt: number | null;
  /** Identity handle when progress was last updated (optional, for binding) */
  identityHandle?: string;
  /** Identity fingerprint when progress was last updated (optional, for verification) */
  identityFingerprint?: string;
}

export interface MissionsState {
  /** Progress for each mission */
  missions: Partial<Record<MissionId, MissionProgress>>;
  /** When the state was last updated */
  lastUpdated: number;
}

/**
 * Get the current missions state from localStorage.
 */
export function getMissionsState(): MissionsState {
  if (typeof window === "undefined") {
    return {
      missions: {},
      lastUpdated: Date.now(),
    };
  }

  try {
    const stored = localStorage.getItem(MISSIONS_STORAGE_KEY);
    if (!stored) {
      return initializeMissionsState();
    }

    const parsed = JSON.parse(stored);
    // Validate structure
    if (!parsed.missions || typeof parsed.missions !== "object") {
      return initializeMissionsState();
    }

    return parsed as MissionsState;
  } catch {
    return initializeMissionsState();
  }
}

/**
 * Initialize a fresh missions state with all missions in progress but incomplete.
 */
function initializeMissionsState(): MissionsState {
  const missions: Record<MissionId, MissionProgress> = {} as any;

  for (const missionId of Object.keys(MISSIONS) as MissionId[]) {
    missions[missionId] = {
      missionId,
      completedSteps: [],
      startedAt: Date.now(),
      completedAt: null,
      lastCompletedAt: null,
    };
  }

  return {
    missions,
    lastUpdated: Date.now(),
  };
}

/**
 * Save the missions state to localStorage.
 */
export function saveMissionsState(state: MissionsState): void {
  if (typeof window === "undefined") return;

  try {
    state.lastUpdated = Date.now();
    localStorage.setItem(MISSIONS_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to save missions state:", error);
  }
}

/**
 * Get progress for a specific mission.
 */
export function getMissionProgress(missionId: MissionId): MissionProgress | null {
  const state = getMissionsState();
  return state.missions[missionId] || null;
}

/**
 * Mark a mission step as completed.
 * Automatically attaches identity handle/fingerprint if available.
 */
export async function completeMissionStep(missionId: MissionId, stepId: string): Promise<void> {
  const state = getMissionsState();
  const progress = state.missions[missionId];

  if (!progress) {
    // Mission doesn't exist, initialize it
    state.missions[missionId] = {
      missionId,
      completedSteps: [],
      startedAt: Date.now(),
      completedAt: null,
      lastCompletedAt: null,
    };
  }

  const missionProgress = state.missions[missionId];

  // Add step to completed if not already there
  if (missionProgress && !missionProgress.completedSteps.includes(stepId)) {
    missionProgress.completedSteps.push(stepId);
    missionProgress.lastCompletedAt = Date.now();
  }

  // Attach identity information if available
  try {
    if (typeof window !== "undefined" && window.crypto) {
      const { loadIdentity } = await import("./identity");
      const identity = await loadIdentity();
      if (identity && missionProgress) {
        missionProgress.identityHandle = identity.handle;
        missionProgress.identityFingerprint = identity.fingerprint;
      }
    }
  } catch {
    // Silently fail if identity system is not available
    // This maintains backward compatibility
  }

  // Check if mission is complete
  const mission = MISSIONS[missionId];
  const allStepIds = mission.steps.map((s) => s.id);
  const isComplete = missionProgress && allStepIds.every((id) => missionProgress.completedSteps.includes(id));

  if (isComplete && !missionProgress.completedAt) {
    missionProgress.completedAt = Date.now();
  }

  saveMissionsState(state);
}

/**
 * Reset progress for a specific mission.
 */
export function resetMissionProgress(missionId: MissionId): void {
  const state = getMissionsState();
  const mission = MISSIONS[missionId];

  if (mission && state.missions[missionId]) {
    state.missions[missionId] = {
      missionId,
      completedSteps: [],
      startedAt: Date.now(),
      completedAt: null,
      lastCompletedAt: null,
    };
    saveMissionsState(state);
  }
}

/**
 * Reset all mission progress.
 */
export function resetAllMissionsProgress(): void {
  const state = initializeMissionsState();
  saveMissionsState(state);
}

/**
 * Check if a mission step is completed.
 */
export function isStepCompleted(missionId: MissionId, stepId: string): boolean {
  const progress = getMissionProgress(missionId);
  return progress ? progress.completedSteps.includes(stepId) : false;
}

/**
 * Check if a mission is completed.
 */
export function isMissionCompleted(missionId: MissionId): boolean {
  const progress = getMissionProgress(missionId);
  if (!progress) return false;

  const mission = MISSIONS[missionId];
  const allStepIds = mission.steps.map((s) => s.id);

  return allStepIds.every((id) => progress.completedSteps.includes(id));
}

/**
 * Get the next incomplete step for a mission.
 * Returns null if the mission is complete.
 */
export function getNextStep(missionId: MissionId): MissionStep | null {
  const progress = getMissionProgress(missionId);
  const mission = MISSIONS[missionId];

  if (!mission) return null;

  for (const step of mission.steps) {
    if (!progress || !progress.completedSteps.includes(step.id)) {
      return step;
    }
  }

  return null;
}

/**
 * Get completion percentage for a mission.
 */
export function getMissionCompletion(missionId: MissionId): number {
  const progress = getMissionProgress(missionId);
  const mission = MISSIONS[missionId];

  if (!progress || !mission) return 0;

  const completed = progress.completedSteps.length;
  const total = mission.steps.length;

  return total > 0 ? (completed / total) * 100 : 0;
}

/* ═══════════════════════════════════════════════════════════════
   VFXMSN1 Progress Token Format
   ═══════════════════════════════════════════════════════════════ */

export interface MissionProgressToken {
  /** Token version */
  v: 1;
  /** Mission ID */
  m: MissionId;
  /** Completed step IDs */
  s: string[];
  /** Started timestamp */
  sa: number;
  /** Completed timestamp (null if incomplete) */
  ca: number | null;
  /** Last completed timestamp */
  la: number | null;
}

/**
 * Encode mission progress as a VFXMSN1 token.
 * Format: VFXMSN1:base64url(json)
 *
 * This token can be:
 *   - Exported to backup mission progress
 *   - Imported to restore progress on another device
 *   - Shared to show mission completion (only public data)
 */
export function encodeMissionProgress(missionId: MissionId): string | null {
  const progress = getMissionProgress(missionId);
  if (!progress) return null;

  const token: MissionProgressToken = {
    v: 1,
    m: missionId,
    s: progress.completedSteps,
    sa: progress.startedAt,
    ca: progress.completedAt,
    la: progress.lastCompletedAt,
  };

  const json = JSON.stringify(token);
  const base64 = btoa(json);
  const base64url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  return `VFXMSN1:${base64url}`;
}

/**
 * Decode a VFXMSN1 mission progress token.
 * Returns null if the token is invalid.
 */
export function decodeMissionProgress(token: string): MissionProgressToken | null {
  if (!token || typeof token !== "string") {
    return null;
  }

  const trimmed = token.trim();
  if (!trimmed.startsWith("VFXMSN1:")) {
    return null;
  }

  try {
    const base64url = trimmed.slice(8); // Remove "VFXMSN1:"
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    const parsed = JSON.parse(json) as MissionProgressToken;

    // Validate structure
    if (
      typeof parsed.v !== "number" ||
      typeof parsed.m !== "string" ||
      !Array.isArray(parsed.s) ||
      typeof parsed.sa !== "number" ||
      (parsed.ca !== null && typeof parsed.ca !== "number") ||
      (parsed.la !== null && typeof parsed.la !== "number")
    ) {
      return null;
    }

    // Validate mission ID
    if (!MISSIONS[parsed.m as MissionId]) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Import mission progress from a VFXMSN1 token.
 * Returns true if import succeeded.
 */
export function importMissionProgress(token: string): boolean {
  const decoded = decodeMissionProgress(token);
  if (!decoded) return false;

  const state = getMissionsState();
  const missionId = decoded.m as MissionId;

  state.missions[missionId] = {
    missionId,
    completedSteps: decoded.s,
    startedAt: decoded.sa,
    completedAt: decoded.ca,
    lastCompletedAt: decoded.la,
  };

  saveMissionsState(state);
  return true;
}

/**
 * Export all mission progress as VFXMSN1 tokens.
 * Returns an array of tokens, one for each mission with actual progress (completed steps).
 */
export function exportAllMissionProgress(): string[] {
  const tokens: string[] = [];

  for (const missionId of Object.keys(MISSIONS) as MissionId[]) {
    const progress = getMissionProgress(missionId);
    if (progress && progress.completedSteps.length > 0) {
      const token = encodeMissionProgress(missionId);
      if (token) {
        tokens.push(token);
      }
    }
  }

  return tokens;
}

/**
 * Import multiple mission progress tokens.
 * Returns the number of successfully imported tokens.
 */
export function importMultipleMissionProgress(tokens: string[]): number {
  let imported = 0;

  for (const token of tokens) {
    if (importMissionProgress(token)) {
      imported++;
    }
  }

  return imported;
}

/* ═══════════════════════════════════════════════════════════════
   Mission Utilities
   ═══════════════════════════════════════════════════════════════ */

/**
 * Get all missions as an array.
 */
export function getAllMissions(): Mission[] {
  return Object.values(MISSIONS);
}

/**
 * Get a mission by ID.
 */
export function getMission(missionId: MissionId): Mission | null {
  return MISSIONS[missionId] || null;
}

/**
 * Get missions recommended for a specific persona.
 */
export function getMissionsForPersona(personaId: PersonaId): Mission[] {
  return getAllMissions().filter((mission) =>
    mission.recommendedFor.includes(personaId)
  );
}

/**
 * Get completed missions.
 */
export function getCompletedMissions(): Mission[] {
  return getAllMissions().filter((mission) => isMissionCompleted(mission.id));
}

/**
 * Get in-progress missions (started but not completed).
 */
export function getInProgressMissions(): Mission[] {
  return getAllMissions().filter((mission) => {
    const progress = getMissionProgress(mission.id);
    return progress && progress.completedSteps.length > 0 && !progress.completedAt;
  });
}

/**
 * Get not-started missions.
 */
export function getNotStartedMissions(): Mission[] {
  return getAllMissions().filter((mission) => {
    const progress = getMissionProgress(mission.id);
    return !progress || progress.completedSteps.length === 0;
  });
}

/**
 * Get total completion percentage across all missions.
 */
export function getTotalCompletion(): number {
  const missions = getAllMissions();
  let totalSteps = 0;
  let totalCompleted = 0;

  for (const mission of missions) {
    const progress = getMissionProgress(mission.id);
    totalSteps += mission.steps.length;
    totalCompleted += progress ? progress.completedSteps.length : 0;
  }

  return totalSteps > 0 ? (totalCompleted / totalSteps) * 100 : 0;
}

/**
 * Get mission statistics.
 */
export interface MissionStats {
  totalMissions: number;
  completedMissions: number;
  inProgressMissions: number;
  notStartedMissions: number;
  totalSteps: number;
  completedSteps: number;
  overallCompletion: number;
}

export function getMissionStats(): MissionStats {
  const missions = getAllMissions();
  const completed = getCompletedMissions();
  const inProgress = getInProgressMissions();
  const notStarted = getNotStartedMissions();

  let totalSteps = 0;
  let completedSteps = 0;

  for (const mission of missions) {
    const progress = getMissionProgress(mission.id);
    totalSteps += mission.steps.length;
    completedSteps += progress ? progress.completedSteps.length : 0;
  }

  return {
    totalMissions: missions.length,
    completedMissions: completed.length,
    inProgressMissions: inProgress.length,
    notStartedMissions: notStarted.length,
    totalSteps,
    completedSteps,
    overallCompletion: totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0,
  };
}