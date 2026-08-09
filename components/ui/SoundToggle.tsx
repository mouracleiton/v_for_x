"use client";

import { useStore } from "@/stores/useStore";
import { sound } from "@/lib/sound";
import { tc } from "@/lib/i18n-content";
import { useEffect } from "react";

export default function SoundToggle() {
  const { soundEnabled, toggleSound, lang } = useStore();

  useEffect(() => {
    import("@/lib/sound").then(({ initSound }) => initSound(soundEnabled));
  }, [soundEnabled]);

  return (
    <button
      onClick={() => {
        toggleSound();
        if (!soundEnabled) sound.copy();
      }}
      className="text-xs px-2 py-1 border border-border-dim hover:border-blood transition-colors"
      style={{ color: soundEnabled ? "var(--color-terminal-green)" : "#444" }}
      aria-label={soundEnabled ? tc(lang, "ui.sound_disable") : tc(lang, "ui.sound_enable")}
    >
      {soundEnabled ? `[ ${tc(lang, "ui.snd_on")} ]` : `[ ${tc(lang, "ui.snd_off")} ]`}
    </button>
  );
}
