"use client";

import { useStore } from "@/stores/useStore";
import { sound } from "@/lib/sound";
import { useEffect } from "react";

export default function SoundToggle() {
  const { soundEnabled, toggleSound } = useStore();

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
      style={{ color: soundEnabled ? "#00ff41" : "#444" }}
      aria-label={soundEnabled ? "Disable sound" : "Enable sound"}
    >
      {soundEnabled ? "[ SND: ON ]" : "[ SND: OFF ]"}
    </button>
  );
}
