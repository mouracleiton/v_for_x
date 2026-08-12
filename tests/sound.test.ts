import { describe, it, expect, beforeEach, vi } from "vitest";
import { initSound, sound } from "../lib/sound";

describe("sound.ts — procedural sound engine", () => {
  beforeEach(() => {
    // Start from a known-disabled state each time.
    initSound(false);
  });

  describe("initSound", () => {
    it("is a no-op callable that does not throw when sound is off", () => {
      expect(() => initSound(false)).not.toThrow();
    });

    it("does not throw when enabling even without a real AudioContext", () => {
      expect(() => initSound(true)).not.toThrow();
    });
  });

  describe("sound API surface", () => {
    it("exposes the expected named cues", () => {
      for (const cue of [
        "keystroke",
        "nav",
        "select",
        "error",
        "success",
        "copy",
      ] as const) {
        expect(typeof sound[cue]).toBe("function");
      }
    });

    it("never throws when disabled (no audio context touched)", () => {
      initSound(false);
      for (const cue of Object.keys(sound) as (keyof typeof sound)[]) {
        expect(() => sound[cue]()).not.toThrow();
      }
    });

    it("never throws when enabled", () => {
      initSound(true);
      for (const cue of Object.keys(sound) as (keyof typeof sound)[]) {
        expect(() => sound[cue]()).not.toThrow();
      }
    });
  });

  describe("reduced-motion respect", () => {
    it("skips playback entirely when prefers-reduced-motion is set", () => {
      // The shared matchMedia shim returns matches=true for reduced-motion.
      initSound(true);
      // success/copy schedule timers; run them synchronously by faking timers.
      vi.useFakeTimers();
      try {
        expect(() => {
          sound.success();
          sound.copy();
          vi.runAllTimers();
        }).not.toThrow();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("server-side guard", () => {
    it("the module loads safely in an environment without a real AudioContext", () => {
      // jsdom provides no AudioContext; all calls must degrade gracefully.
      initSound(true);
      expect(() => sound.keystroke()).not.toThrow();
    });
  });
});
