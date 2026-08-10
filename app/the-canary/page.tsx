"use client";

/**
 * V FOR X — The Canary (Dead Man's Switch)
 *
 * [47] THE CANARY — Code: 47
 */

import { useState, useEffect, useCallback } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import {
  armCanary,
  checkIn,
  evaluateStatus,
  formatDuration,
  generateReleaseToken,
  decodeReleaseToken,
  disarmCanary,
  type CanaryRecord,
  type CanaryStatusResult,
} from "@/lib/canary";

const STORAGE_KEY = "vfx-canary";

export default function TheCanaryPage() {
  const [record, setRecord] = useState<CanaryRecord | null>(null);
  const [status, setStatus] = useState<CanaryStatusResult | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Form state
  const [label, setLabel] = useState("Evidence Vault");
  const [payload, setPayload] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [checkInHours, setCheckInHours] = useState(24);
  const [contactHandle, setContactHandle] = useState("");
  const [releaseInstructions, setReleaseInstructions] = useState(
    "If this canary triggers, publish the encrypted payload. The passphrase has been shared with trusted contacts.",
  );
  const [error, setError] = useState("");
  const [decryptedPayload, setDecryptedPayload] = useState<string | null>(null);
  const [releaseToken, setReleaseToken] = useState<string | null>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CanaryRecord;
        setRecord(parsed);
        setStatus(evaluateStatus(parsed));
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  // Update status every second
  useEffect(() => {
    if (!record) return;
    const interval = setInterval(() => {
      setStatus(evaluateStatus(record));
    }, 1000);
    return () => clearInterval(interval);
  }, [record]);

  // Persist
  useEffect(() => {
    if (record && loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    }
  }, [record, loaded]);

  const handleArm = useCallback(async () => {
    setError("");
    if (passphrase.length < 8) {
      setError("// PASSPHRASE MUST BE AT LEAST 8 CHARACTERS");
      sound.error();
      return;
    }
    if (passphrase !== confirmPass) {
      setError("// PASSPHRASES DO NOT MATCH");
      sound.error();
      return;
    }
    if (payload.trim().length < 1) {
      setError("// PAYLOAD CANNOT BE EMPTY");
      sound.error();
      return;
    }
    try {
      const r = await armCanary(passphrase, payload, {
        label,
        checkInHours,
        contactHandle: contactHandle || undefined,
        releaseInstructions,
      });
      setRecord(r);
      setStatus(evaluateStatus(r));
      setReleaseToken(generateReleaseToken(r));
      setPayload("");
      setPassphrase("");
      setConfirmPass("");
      sound.success();
    } catch (e) {
      setError(`// ${e instanceof Error ? e.message : "Unknown error"}`);
      sound.error();
    }
  }, [passphrase, confirmPass, payload, label, checkInHours, contactHandle, releaseInstructions]);

  const handleCheckIn = useCallback(async () => {
    if (!record) return;
    try {
      const updated = await checkIn(record, passphrase);
      setRecord(updated);
      setStatus(evaluateStatus(updated));
      setPassphrase("");
      sound.success();
    } catch (e) {
      setError(`// ${e instanceof Error ? e.message : "Check-in failed"}`);
      sound.error();
    }
  }, [record, passphrase]);

  const handleDisarm = useCallback(() => {
    if (!record) return;
    const disarmed = disarmCanary(record);
    setRecord(disarmed);
    setStatus(evaluateStatus(disarmed));
    sound.success();
  }, [record]);

  const handleDestroy = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setRecord(null);
    setStatus(null);
    setReleaseToken(null);
    setDecryptedPayload(null);
    sound.error();
  }, []);

  if (!loaded) return null;

  const hasCanary = !!record && record.status !== "disarmed";

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">
        🐦 THE CANARY
      </h1>
      <p className="text-content-secondary text-sm mb-6">
        // dead man&apos;s switch — encrypt a payload, arm a timer. if you stop checking in, it releases.
      </p>

      {hasCanary && status ? (
        <div className="space-y-4">
          {/* Status Display */}
          <TerminalCard title="STATUS" accent={status.status === "armed" ? "green" : status.status === "overdue" ? "blood" : "amber"} glow={status.status === "overdue"}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-2xl font-bold" style={{
                  color: status.status === "armed" ? "var(--color-terminal-green)" :
                         status.status === "overdue" ? "var(--color-blood-bright)" :
                         "var(--color-warning-amber)",
                }}>
                  {status.status.toUpperCase()}
                </div>
                <div className="text-xs text-content-dim mt-1">{record!.config.label}</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold font-mono" style={{
                  color: status.fractionElapsed >= 0.75 ? "var(--color-blood-bright)" : "var(--color-content-primary)",
                }}>
                  {formatDuration(status.msRemaining)}
                </div>
                <div className="text-xs text-content-dim">REMAINING</div>
              </div>
            </div>
            <p className="text-sm text-content-secondary">{status.message}</p>
            {/* Progress bar */}
            <div className="mt-4 h-3 bg-abyss border border-border-dim overflow-hidden">
              <div
                className="h-full transition-all duration-1000"
                style={{
                  width: `${status.fractionElapsed * 100}%`,
                  backgroundColor: status.fractionElapsed >= 0.75 ? "var(--color-blood-bright)" :
                                    status.fractionElapsed >= 0.5 ? "var(--color-warning-amber)" :
                                    "var(--color-terminal-green)",
                }}
              />
            </div>
          </TerminalCard>

          {/* Check-in */}
          {status.status === "armed" && (
            <TerminalCard title="CHECK-IN" accent="green">
              <p className="text-sm text-content-secondary mb-3">
                Enter your passphrase to reset the timer and prove you are safe.
              </p>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Passphrase"
                className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary mb-3 focus:border-blood"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCheckIn}
                  className="px-4 py-2 text-xs font-bold bg-blood text-white hover:bg-blood-bright transition-colors"
                >
                  [ CHECK IN ]
                </button>
                <button
                  onClick={handleDisarm}
                  className="px-4 py-2 text-xs border border-border-dim text-content-secondary hover:border-blood"
                >
                  [ DISARM ]
                </button>
              </div>
            </TerminalCard>
          )}

          {/* Release Token */}
          {releaseToken && (
            <TerminalCard title="RELEASE TOKEN" accent="amber">
              <p className="text-xs text-content-secondary mb-2">
                Share this token with your trusted contact. They hold it as proof that they should release the passphrase if you disappear.
              </p>
              <code className="block text-xs bg-abyss border border-border-dim p-3 break-all text-warning-amber">
                {releaseToken}
              </code>
            </TerminalCard>
          )}

          {/* Release Instructions */}
          <TerminalCard title="RELEASE INSTRUCTIONS" accent="blood">
            <p className="text-sm text-content-primary whitespace-pre-wrap">
              {record!.config.releaseInstructions}
            </p>
            {record!.config.contactHandle && (
              <p className="text-xs text-content-dim mt-2">
                Trusted contact: {record!.config.contactHandle}
              </p>
            )}
          </TerminalCard>

          {/* Destroy */}
          <TerminalCard title="DANGER ZONE" accent="blood">
            <p className="text-xs text-content-secondary mb-3">
              Destroying the canary permanently deletes the encrypted payload from this device. This cannot be undone.
            </p>
            <button
              onClick={handleDestroy}
              className="px-4 py-2 text-xs font-bold border border-blood text-blood-bright hover:bg-blood hover:text-white transition-colors"
            >
              [ DESTROY CANARY ]
            </button>
          </TerminalCard>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Setup Form */}
          <TerminalCard title="ARM CANARY" accent="blood">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-content-dim uppercase tracking-widest">Label</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary mt-1 focus:border-blood"
                />
              </div>

              <div>
                <label className="text-xs text-content-dim uppercase tracking-widest">Payload (encrypted with AES-GCM)</label>
                <textarea
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  placeholder="Documents, contacts, evidence, passwords, instructions..."
                  rows={5}
                  className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary mt-1 focus:border-blood font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-content-dim uppercase tracking-widest">Passphrase (min 8 chars)</label>
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary mt-1 focus:border-blood"
                  />
                </div>
                <div>
                  <label className="text-xs text-content-dim uppercase tracking-widest">Confirm Passphrase</label>
                  <input
                    type="password"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary mt-1 focus:border-blood"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-content-dim uppercase tracking-widest">Check-in Interval: {checkInHours} hours</label>
                <input
                  type="range"
                  min={1}
                  max={168}
                  value={checkInHours}
                  onChange={(e) => setCheckInHours(Number(e.target.value))}
                  className="w-full mt-1"
                />
                <div className="flex justify-between text-xs text-content-dim">
                  <span>1h</span><span>24h</span><span>72h</span><span>168h (7d)</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-content-dim uppercase tracking-widest">Trusted Contact Handle (optional)</label>
                <input
                  type="text"
                  value={contactHandle}
                  onChange={(e) => setContactHandle(e.target.value)}
                  placeholder="V-ABCD-EFGH"
                  className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary mt-1 focus:border-blood"
                />
              </div>

              <div>
                <label className="text-xs text-content-dim uppercase tracking-widest">Release Instructions</label>
                <textarea
                  value={releaseInstructions}
                  onChange={(e) => setReleaseInstructions(e.target.value)}
                  rows={3}
                  className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary mt-1 focus:border-blood"
                />
              </div>

              {error && (
                <p className="text-blood-bright text-sm font-mono">{error}</p>
              )}

              <button
                onClick={handleArm}
                className="w-full px-4 py-3 text-sm font-bold bg-blood text-white hover:bg-blood-bright transition-colors"
              >
                [ ARM CANARY ]
              </button>
            </div>
          </TerminalCard>

          {/* How it works */}
          <TerminalCard title="HOW IT WORKS" accent="amber">
            <ol className="space-y-2 text-sm text-content-secondary">
              <li><span className="text-blood-bright font-bold">1.</span> Encrypt a payload with a passphrase (AES-GCM, PBKDF2 150K iterations).</li>
              <li><span className="text-blood-bright font-bold">2.</span> Set a check-in interval. Share the release token with a trusted contact.</li>
              <li><span className="text-blood-bright font-bold">3.</span> Check in regularly by entering your passphrase.</li>
              <li><span className="text-blood-bright font-bold">4.</span> If you miss a check-in, the canary goes OVERDUE.</li>
              <li><span className="text-blood-bright font-bold">5.</span> Your trusted contact publishes the passphrase — the payload is released.</li>
            </ol>
            <p className="text-xs text-content-dim mt-4">
              ⚠ This is a heuristic client-side timer. V FOR X has no backend — the release depends on your human contact acting. Store the release token and passphrase through separate channels.
            </p>
          </TerminalCard>
        </div>
      )}
    </div>
  );
}
