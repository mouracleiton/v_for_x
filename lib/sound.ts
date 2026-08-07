/**
 * V FOR X — Procedural Sound Engine (Web Audio API)
 * No audio files. All sounds synthesized at runtime.
 * Respects prefers-reduced-motion.
 */

let ctx: AudioContext | null = null;
let enabled = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return ctx;
}

export function initSound(soundOn: boolean) {
  enabled = soundOn;
  if (soundOn) getCtx()?.resume();
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = "square",
  gainVal = 0.04
) {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;

  const reduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  if (reduced) return;

  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = type;
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(gainVal, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);

  osc.connect(gain);
  gain.connect(c.destination);

  osc.start();
  osc.stop(c.currentTime + duration);
}

function playNoise(duration: number, gainVal = 0.03) {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;

  const reduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  if (reduced) return;

  const bufferSize = c.sampleRate * duration;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = c.createBufferSource();
  noise.buffer = buffer;

  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1000;

  const gain = c.createGain();
  gain.gain.setValueAtTime(gainVal, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);

  noise.start();
  noise.stop(c.currentTime + duration);
}

// ── Public sound API ─────────────────────────────────────

export const sound = {
  keystroke: () => playTone(40, 0.01, "square", 0.015),
  nav: () => playTone(220, 0.03, "sine", 0.03),
  select: () => playNoise(0.05, 0.02),
  error: () => playTone(80, 0.1, "sawtooth", 0.04),
  success: () => {
    playTone(440, 0.08, "sine", 0.03);
    setTimeout(() => playTone(660, 0.12, "sine", 0.03), 80);
  },
  copy: () => {
    playTone(523, 0.05, "sine", 0.02);
    setTimeout(() => playTone(784, 0.05, "sine", 0.02), 50);
  },
};
