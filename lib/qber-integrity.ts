/**
 * V FOR X — QKD-inspired tamper evidence
 * (Phase 26 D — Quantum P2P Squad adaptation)
 *
 * Not real QKD (no photon channel). The *detection* idea adapted to the
 * existing signed-message layer: a rolling error-rate (QBER-style) sample
 * over message-authentication failures. If the rate crosses a threshold,
 * surface a "comms possibly intercepted" banner (same level shape as
 * jurisdiction-risk so the existing banner component can render it). Resets
 * on rekey.
 *
 * QBER = Quantum Bit Error Rate. Here it is an EWMA over auth pass/fail so
 * one dropped packet does not trigger it; a *sustained* rise does.
 */

export type QberLevel = "low" | "moderate" | "high" | "severe";

/** EWMA weight for the rolling error rate (higher = faster response). */
const EWMA_ALPHA = 0.3;

/** Sample count before the rate is considered "primed" (avoids early noise). */
const MIN_SAMPLES = 8;

/** Thresholds on the 0..1 rolling error rate. */
const QBER_BANDS: { max: number; level: QberLevel }[] = [
  { max: 0.02, level: "low" },
  { max: 0.06, level: "moderate" },
  { max: 0.11, level: "high" },
  { max: 1.01, level: "severe" },
];

export interface QberSignal {
  /** Rolling error rate (0..1). */
  rate: number;
  /** Derived band. */
  level: QberLevel;
  /** True when rate has crossed the "possibly intercepted" threshold. */
  interceptLikely: boolean;
  /** Sample count seen since last rekey. */
  samples: number;
}

/** Map a raw rate to a QberLevel band. */
export function classifyQber(rate: number): QberLevel {
  const r = clamp01(rate);
  return QBER_BANDS.find((b) => r < b.max)?.level ?? "severe";
}

/** True when the rate is high enough to warrant an intercept banner. */
export function interceptLikely(rate: number): boolean {
  return classifyQber(rate) === "high" || classifyQber(rate) === "severe";
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return v > 1 ? 1 : 0; // +Infinity → 1, NaN/-Infinity → 0
  return Math.max(0, Math.min(1, v));
}

/**
 * Rolling QBER sampler over message-authentication results.
 *
 * recordAuthResult(true|false) feeds the EWMA; qber() reads the signal;
 * rekey() resets (on a fresh ratchet key the error baseline is unknown, so
 * we start over). Pure + testable: no timers, no globals.
 */
export class QberSampler {
  private rate = 0;
  private samples = 0;

  /** Feed one authentication result. true = verified, false = failure. */
  recordAuthResult(success: boolean): void {
    const sample = success ? 0 : 1;
    this.rate = this.samples === 0 ? sample : EWMA_ALPHA * sample + (1 - EWMA_ALPHA) * this.rate;
    this.samples += 1;
  }

  /** Convenience: record a batch of results at once. */
  recordAuthResults(results: boolean[]): void {
    for (const r of results) this.recordAuthResult(r);
  }

  /** Current QBER signal (rate, level, interceptLikely). */
  qber(): QberSignal {
    // Before MIN_SAMPLES the band is "low" regardless of raw rate (avoid noise).
    const primed = this.samples >= MIN_SAMPLES;
    const level = primed ? classifyQber(this.rate) : "low";
    return {
      rate: this.rate,
      level,
      interceptLikely: primed && interceptLikely(this.rate),
      samples: this.samples,
    };
  }

  /** Reset on rekey (fresh key → error baseline unknown). */
  rekey(): void {
    this.rate = 0;
    this.samples = 0;
  }
}

/**
 * Banner copy for a QBER signal, mirroring jurisdiction-risk's riskBannerText
 * so the existing banner component can render either.
 */
export function qberBannerText(signal: QberSignal, peerLabel?: string): string {
  const where = peerLabel ? ` with ${peerLabel}` : "";
  if (signal.level === "low") return `Comms verified${where}.`;
  if (signal.interceptLikely) {
    return `${signal.level.toUpperCase()} ERROR RATE${where} — comms possibly intercepted. Rekey recommended.`;
  }
  return `${signal.level.toUpperCase()} ERROR RATE${where} — elevated auth-failure rate.`;
}

/** True when the signal should surface a visible banner (not low). */
export function shouldShowQberBanner(signal: QberSignal): boolean {
  return signal.level !== "low";
}
