/**
 * One-story onboarding spine: persona → identity → signed witness → VFXPACK1.
 * UI lives in components/shared/OnboardingWizard.tsx
 */

import type { PersonaId } from "./personas";

export type OnboardPhase = "persona" | "identity" | "witness" | "pack" | "done";

export interface OnboardSnapshot {
	persona: PersonaId | null;
	hasIdentity: boolean;
	hasWitness: boolean;
	hasPackExport: boolean;
}

/** Pure phase machine for the <8 min offline loop. */
export function nextOnboardPhase(s: OnboardSnapshot): OnboardPhase {
	if (!s.persona) return "persona";
	if (!s.hasIdentity) return "identity";
	if (!s.hasWitness) return "witness";
	if (!s.hasPackExport) return "pack";
	return "done";
}

export const ONBOARD_PHASE_META: Record<
	OnboardPhase,
	{ n: number; title: string; blurb: string }
> = {
	persona: {
		n: 1,
		title: "Choose persona",
		blurb: "Sets default routes and threat posture. Change anytime.",
	},
	identity: {
		n: 2,
		title: "Create identity",
		blurb: "ECDSA P-256 key stays on this device. No account.",
	},
	witness: {
		n: 3,
		title: "Sign a witness",
		blurb: "First signed receipt — proves your key works offline.",
	},
	pack: {
		n: 4,
		title: "Export pack",
		blurb: "VFXPACK1 with public card + witness. Share or stash on USB.",
	},
	done: {
		n: 5,
		title: "Loop complete",
		blurb: "You can verify, resume, and expand missions from here.",
	},
};

/** Default first-witness text (user can edit in UI). */
export const DEFAULT_ONBOARD_WITNESS =
	"V FOR X onboarding: I control this device key and signed offline.";

export const ONBOARD_MISSION_ID = "establish_identity" as const;

export const ONBOARD_STORAGE_KEY = "vfx-onboard-done";

export function isOnboardDismissed(): boolean {
	if (typeof window === "undefined") return false;
	try {
		return window.localStorage.getItem(ONBOARD_STORAGE_KEY) === "1";
	} catch {
		return false;
	}
}

export function dismissOnboard(): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(ONBOARD_STORAGE_KEY, "1");
	} catch {
		/* ignore quota */
	}
}

export function clearOnboardDismiss(): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.removeItem(ONBOARD_STORAGE_KEY);
	} catch {
		/* ignore */
	}
}
