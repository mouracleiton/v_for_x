import { create } from "zustand";

export interface AnonymousIdentity {
  handle: string;
  publicKey: string;
  createdAt: number;
}

export interface SessionState {
  startTime: number;
  ttlMs: number;
  countryContext: string | null;
}

interface VFXState {
  // Identity
  identity: AnonymousIdentity | null;
  setIdentity: (id: AnonymousIdentity | null) => void;

  // Session
  session: SessionState | null;
  startSession: (ttlMinutes?: number) => void;
  endSession: () => void;

  // Sound
  soundEnabled: boolean;
  toggleSound: () => void;

  // Country context (for cross-branch linking)
  currentCountry: string | null;
  setCurrentCountry: (iso3: string | null) => void;

  // Duress mode
  isDuress: boolean;
  triggerDuress: () => void;

  // Navigation
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
}

export const useStore = create<VFXState>((set) => ({
  identity: null,
  setIdentity: (id) => set({ identity: id }),

  session: null,
  startSession: (ttlMinutes = 60) =>
    set({
      session: {
        startTime: Date.now(),
        ttlMs: ttlMinutes * 60 * 1000,
        countryContext: null,
      },
    }),
  endSession: () => set({ session: null }),

  soundEnabled: false,
  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

  currentCountry: null,
  setCurrentCountry: (iso3) => set({ currentCountry: iso3 }),

  isDuress: false,
  triggerDuress: () => {
    if (typeof window !== "undefined") {
      localStorage.clear();
      indexedDB.deleteDatabase("vfx-store");
    }
    set({ isDuress: true, identity: null, session: null });
  },

  navOpen: false,
  setNavOpen: (open) => set({ navOpen: open }),
}));
