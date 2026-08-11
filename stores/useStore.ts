import { create } from "zustand";
import { getStoredLang, isRTL, setStoredLang, type Lang } from "@/lib/i18n";
import {
  getPersona,
  setPersona as setPersonaStorage,
  getFullNav,
  setFullNav as setFullNavStorage,
  type PersonaId,
} from "@/lib/personas";

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

  // Language
  lang: Lang;
  setLang: (lang: Lang) => void;

  // Persona filtering
  persona: PersonaId | null;
  setPersona: (persona: PersonaId | null) => void;
  clearPersona: () => void;

  // Full navigation toggle
  fullNav: boolean;
  toggleFullNav: () => void;
  setFullNav: (enabled: boolean) => void;
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
      // Clear all client-side storage
      localStorage.clear();
      try {
        sessionStorage.clear();
      } catch { /* ignore */ }
      indexedDB.deleteDatabase("vfx-store");
      // Destroy the encrypted vault (panic wipe)
      indexedDB.deleteDatabase("vfx-vault");
      // Purge service worker caches (critical for panic wipe)
      if ("caches" in window) {
        caches.keys().then((names) => {
          for (const name of names) caches.delete(name);
        });
      }
      // Unregister service worker so cached pages are not retrievable
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          for (const reg of regs) reg.unregister();
        });
      }
    }
    set({ isDuress: true, identity: null, session: null });
  },

  navOpen: false,
  setNavOpen: (open) => set({ navOpen: open }),

  lang: typeof window !== "undefined" ? getStoredLang() : "en",
  setLang: (lang) => {
    setStoredLang(lang);
    // Apply RTL/LTR direction and lang attribute
    if (typeof window !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = isRTL(lang) ? "rtl" : "ltr";
    }
    set({ lang });
  },

  // Persona filtering - initialize from localStorage
  persona: typeof window !== "undefined" ? getPersona() : null,
  setPersona: (persona) => {
    if (persona === null) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("vfx_persona");
      }
      set({ persona: null });
    } else {
      setPersonaStorage(persona);
      set({ persona });
    }
  },
  clearPersona: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("vfx_persona");
    }
    set({ persona: null });
  },

  // Full navigation toggle - initialize from localStorage
  fullNav: typeof window !== "undefined" ? getFullNav() : false,
  toggleFullNav: () => {
    const current = typeof window !== "undefined" ? getFullNav() : false;
    const newValue = !current;
    setFullNavStorage(newValue);
    set({ fullNav: newValue });
    return newValue;
  },
  setFullNav: (enabled) => {
    setFullNavStorage(enabled);
    set({ fullNav: enabled });
  },
}));
