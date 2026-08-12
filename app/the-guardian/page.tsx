"use client";

/**
 * V FOR X — The Guardian (People's Dead Man's Switch)
 *
 * [59] THE GUARDIAN — Code: 59
 *
 * Canary is a dead man's switch for data. This is for people.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import {
  armGuardian,
  checkIn,
  evaluateStatus,
  formatDuration,
  generateGuardianToken,
  decryptLocation,
  captureLocation,
  triggerPanic,
  clearPanic,
  disarmGuardian,
  buildPanicBroadcast,
  buildEscalationNotice,
  getEscalationState,
  sortedContacts,
  type GuardianRecord,
  type GuardianStatusResult,
  type TrustedContact,
  type LocationData,
} from "@/lib/guardian";
import {
  createGuardianSigningKey,
  buildReleasePacket,
  verifyReleasePacket,
  encodeReleasePacket,
  decodeReleasePacket,
  decryptPacketLocation,
  buildPacketUrl,
  parseHashPacket,
  packetFingerprint,
  type GuardianSigningKey,
  type ReleasePacket,
} from "@/lib/guardian-packet";
import { tc } from "@/lib/i18n-content";
import { useStore } from "@/stores/useStore";
import {
  decideRelease,
  nextDeadline,
  msUntilRelease,
  markReleased,
  pruneReleases,
  formatReleaseNotice,
  loadReleases,
  saveReleases,
  type AutoReleaseRecord,
} from "@/lib/deadman";

const STORAGE_KEY = "vfx-guardian";
const SIGNING_KEY_STORAGE = "vfx-guardian-signing-key";
const DEADMAN_ARMED_KEY = "vfx-deadman-armed";
const DEADMAN_KEEP_MS = 90 * 24 * 3_600_000;

interface DraftContact {
  id: string;
  label: string;
  handle: string;
  escalateAfterMin: number;
}

export default function TheGuardianPage() {
  const { lang } = useStore();
  const [record, setRecord] = useState<GuardianRecord | null>(null);
  const [status, setStatus] = useState<GuardianStatusResult | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Setup form state
  const [label, setLabel] = useState("Field reporter");
  const [checkInHours, setCheckInHours] = useState(12);
  const [passphrase, setPassphrase] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [safeCode, setSafeCode] = useState("");
  const [duressCode, setDuressCode] = useState("");
  const [contacts, setContacts] = useState<DraftContact[]>([
    { id: "c1", label: "Editor", handle: "", escalateAfterMin: 0 },
  ]);
  const [escalationMessage, setEscalationMessage] = useState(
    "If you receive this alert, I may have been detained, arrested, or am in danger. Contact my lawyer and the press freedom hotline immediately. Do not contact local authorities first.",
  );
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);

  // Check-in form
  const [checkPass, setCheckPass] = useState("");
  const [checkWord, setCheckWord] = useState("");
  const [checkInNote, setCheckInNote] = useState("");

  // Location
  const [locPass, setLocPass] = useState("");
  const [decryptedLoc, setDecryptedLoc] = useState<LocationData | null>(null);
  const [locError, setLocError] = useState("");
  const [capturing, setCapturing] = useState(false);

  // Panic / broadcast
  const [panicBroadcast, setPanicBroadcast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const panicHeldRef = useRef(false);
  const panicTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Release relay
  const [signingKey, setSigningKey] = useState<GuardianSigningKey | null>(null);
  const [packetToken, setPacketToken] = useState<string | null>(null);
  const [packetUrl, setPacketUrl] = useState<string | null>(null);
  const [packetError, setPacketError] = useState("");
  const [inboxToken, setInboxToken] = useState("");
  const [inboxResult, setInboxResult] = useState<{
    kind: "ok" | "fail";
    packet?: ReleasePacket;
    message: string;
  } | null>(null);
  const [inboxDecrypt, setInboxDecrypt] = useState("");

  // Auto-release (dead man's switch)
  const [deadmanArmed, setDeadmanArmed] = useState(false);
  const [deadmanCountdown, setDeadmanCountdown] = useState<number | null>(null);
  const [deadmanReleases, setDeadmanReleases] = useState<AutoReleaseRecord[]>([]);
  const [deadmanLatest, setDeadmanLatest] = useState<AutoReleaseRecord | null>(null);
  const [deadmanNotice, setDeadmanNotice] = useState<string | null>(null);
  const [deadmanError, setDeadmanError] = useState("");
  const [deadmanCopied, setDeadmanCopied] = useState(false);
  const deadmanBusyRef = useRef(false);
  const deadmanCtxRef = useRef<{
    armed: boolean;
    releases: AutoReleaseRecord[];
    signingKey: GuardianSigningKey | null;
  }>({ armed: false, releases: [], signingKey: null });
  deadmanCtxRef.current = { armed: deadmanArmed, releases: deadmanReleases, signingKey };

  // Load
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as GuardianRecord;
        setRecord(parsed);
        setStatus(evaluateStatus(parsed));
        setToken(generateGuardianToken(parsed));
      }
      const keyStored = localStorage.getItem(SIGNING_KEY_STORAGE);
      if (keyStored) {
        setSigningKey(JSON.parse(keyStored) as GuardianSigningKey);
      }
    } catch { /* ignore */ }
    setLoaded(true);

    // Setup Capacitor notification listeners
    try {
      // Dynamic import to avoid SSR issues
      import("@/lib/capacitor-guardian").then(({ setupNotificationListeners }) => {
        setupNotificationListeners();
      });
    } catch (e) {
      console.debug("Failed to setup notification listeners:", e);
    }
  }, []);

  // AUTO-RELEASE: evaluate once per tick; when the switch fires, sign
  // the release packet, record it, and broadcast it locally.
  const runDeadmanTick = useCallback(async (rec: GuardianRecord) => {
    const ctx = deadmanCtxRef.current;
    if (!ctx.armed || deadmanBusyRef.current) return;
    const now = Date.now();
    setDeadmanCountdown(msUntilRelease(rec, now));
    const decision = decideRelease(rec, {
      now,
      releases: ctx.releases,
      panicOrDuress: rec.duressFlag || rec.panicTriggeredAt !== null,
    });
    if (decision !== "release") return;
    deadmanBusyRef.current = true;
    try {
      let key = ctx.signingKey;
      if (!key) {
        try {
          key = await createGuardianSigningKey();
          setSigningKey(key);
        } catch {
          key = null;
        }
      }
      if (!key) {
        setDeadmanError("// WEB CRYPTO UNAVAILABLE — CANNOT SIGN AUTO-RELEASE");
        sound.error();
        return;
      }
      // location stays null: release packets never decrypt or persist it here
      const packet = await buildReleasePacket(rec, key, null, now);
      const token = encodeReleasePacket(packet);
      const url = buildPacketUrl(token);
      const release: AutoReleaseRecord = {
        guardianId: rec.id,
        deadline: nextDeadline(rec),
        releasedAt: now,
        packetToken: token,
        packetUrl: url,
        fingerprint: packetFingerprint(packet),
        channel: "clipboard",
      };
      let channel: AutoReleaseRecord["channel"] = "clipboard";
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          channel = "manual";
        }
      } catch {
        channel = "manual";
      }
      try {
        if (channel === "manual" && navigator.share) {
          await navigator.share({
            title: "🛡 V FOR X — Guardian release",
            text: `Guardian release for ${rec.config.label} — verify or hand over:\n\n${url}`,
          });
          channel = "signal";
        }
      } catch { /* share cancelled or unavailable — stays fetchable in-card */ }
      const withChannel: AutoReleaseRecord = { ...release, channel };
      const pruned = pruneReleases(markReleased(ctx.releases, withChannel), DEADMAN_KEEP_MS, now);
      setDeadmanReleases(pruned);
      setDeadmanLatest(withChannel);
      setDeadmanNotice(formatReleaseNotice(withChannel));
      saveReleases(pruned);
      sound.success();
    } catch (e) {
      setDeadmanError(`// AUTO-RELEASE FAILED: ${e instanceof Error ? e.message : "unknown error"}`);
      sound.error();
    } finally {
      deadmanBusyRef.current = false;
    }
  }, []);

  // Tick status every second
  useEffect(() => {
    if (!record) return;
    const interval = setInterval(() => {
      setStatus(evaluateStatus(record));
      void runDeadmanTick(record);
    }, 1000);
    return () => clearInterval(interval);
  }, [record, runDeadmanTick]);

  // Auto-release: restore armed state + release ledger (pruned to 90 days)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setDeadmanArmed(localStorage.getItem(DEADMAN_ARMED_KEY) === "1");
      const releases = pruneReleases(loadReleases(), DEADMAN_KEEP_MS);
      saveReleases(releases);
      setDeadmanReleases(releases);
    } catch { /* ignore */ }
  }, []);

  // Persist
  useEffect(() => {
    if (record && loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    }
  }, [record, loaded]);

  // Persist signing key
  useEffect(() => {
    if (signingKey) {
      localStorage.setItem(SIGNING_KEY_STORAGE, JSON.stringify(signingKey));
    }
  }, [signingKey]);

  // RELAY: auto-consume a release packet carried in the URL hash (#packet=...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = parseHashPacket(window.location.hash);
    if (token) {
      setInboxToken(token);
      void handleVerifyPacket(token);
      try {
        history.replaceState(null, "", window.location.pathname);
      } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addContact = useCallback(() => {
    setContacts((cs) => [
      ...cs,
      {
        id: "c" + Math.random().toString(36).slice(2, 8),
        label: "",
        handle: "",
        escalateAfterMin: cs.length === 0 ? 0 : 60,
      },
    ]);
  }, []);

  const updateContact = useCallback((id: string, patch: Partial<DraftContact>) => {
    setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const removeContact = useCallback((id: string) => {
    setContacts((cs) => cs.filter((c) => c.id !== id));
  }, []);

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
    if (!safeCode || safeCode.length < 3) {
      setError("// SAFE WORD MUST BE AT LEAST 3 CHARACTERS");
      sound.error();
      return;
    }
    if (!duressCode || duressCode.length < 3) {
      setError("// DURESS WORD MUST BE AT LEAST 3 CHARACTERS");
      sound.error();
      return;
    }
    if (safeCode === duressCode) {
      setError("// SAFE WORD AND DURESS WORD MUST BE DIFFERENT");
      sound.error();
      return;
    }
    const cleanContacts = contacts.filter((c) => c.label.trim() && c.handle.trim());
    if (cleanContacts.length === 0) {
      setError("// AT LEAST ONE TRUSTED CONTACT IS REQUIRED");
      sound.error();
      return;
    }
    try {
      const r = await armGuardian(passphrase, {
        label,
        checkInHours,
        contacts: cleanContacts as TrustedContact[],
        escalationMessage,
        safeCode,
        duressCode,
      });
      setRecord(r);
      setStatus(evaluateStatus(r));
      setToken(generateGuardianToken(r));
      setPassphrase("");
      setConfirmPass("");
      sound.success();

      // Schedule background notifications for mobile
      if (r) {
        try {
          const { scheduleGuardianNotifications } = await import("@/lib/capacitor-guardian");
          await scheduleGuardianNotifications(r.id, r);
        } catch (e) {
          console.debug("Failed to schedule guardian notifications:", e);
        }
      }
    } catch (e) {
      setError(`// ${e instanceof Error ? e.message : "Unknown error"}`);
      sound.error();
    }
  }, [passphrase, confirmPass, safeCode, duressCode, contacts, label, checkInHours, escalationMessage]);

  const handleCheckIn = useCallback(async () => {
    if (!record) return;
    setError("");
    try {
      const { record: updated } = await checkIn(record, checkPass, checkWord);
      setRecord(updated);
      setStatus(evaluateStatus(updated));
      setCheckPass("");
      setCheckWord("");
      setCheckInNote(
        updated.duressFlag ? "CHECK-IN ACCEPTED." : "CHECK-IN ACCEPTED. Timer reset.",
      );
      sound.success();

      // Reschedule background notifications for mobile
      try {
        const { scheduleGuardianNotifications } = await import("@/lib/capacitor-guardian");
        await scheduleGuardianNotifications(updated.id, updated);
      } catch (e) {
        console.debug("Failed to reschedule guardian notifications:", e);
      }
    } catch (e) {
      setError(`// ${e instanceof Error ? e.message : "Check-in failed"}`);
      sound.error();
    }
  }, [record, checkPass, checkWord]);

  const captureGeo = useCallback(async () => {
    if (!record) return;
    setLocError("");
    if (!locPass) {
      setLocError("// ENTER PASSPHRASE TO ENCRYPT LOCATION");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocError("// GEOLOCATION UNAVAILABLE IN THIS BROWSER");
      return;
    }
    setCapturing(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const loc: LocationData = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          const updated = await captureLocation(record, locPass, loc);
          setRecord(updated);
          setStatus(evaluateStatus(updated));
          setLocPass("");
          sound.success();
        } catch (e) {
          setLocError(`// ${e instanceof Error ? e.message : "Capture failed"}`);
          sound.error();
        } finally {
          setCapturing(false);
        }
      },
      (err) => {
        setLocError(`// GEOLOCATION ERROR: ${err.message}`);
        sound.error();
        setCapturing(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [record, locPass]);

  const handleDecryptLoc = useCallback(async () => {
    if (!record) return;
    setLocError("");
    try {
      const loc = await decryptLocation(record, locPass);
      setDecryptedLoc(loc);
      sound.success();
    } catch (e) {
      setLocError(`// ${e instanceof Error ? e.message : "Decrypt failed"}`);
      sound.error();
    }
  }, [record, locPass]);

  // Panic: hold 3s to avoid accidental trigger
  const panicDown = useCallback(() => {
    if (!record) return;
    panicHeldRef.current = false;
    panicTimerRef.current = setTimeout(() => {
      panicHeldRef.current = true;
      const panicked = triggerPanic(record);
      setRecord(panicked);
      setStatus(evaluateStatus(panicked));
      sound.error();
      setPanicBroadcast(buildPanicBroadcast(panicked, decryptedLoc));
    }, 3000);
  }, [record, decryptedLoc]);

  const panicUp = useCallback(() => {
    if (panicTimerRef.current) clearTimeout(panicTimerRef.current);
  }, []);

  const handleClearPanic = useCallback(() => {
    if (!record) return;
    const cleared = clearPanic(record);
    setRecord(cleared);
    setStatus(evaluateStatus(cleared));
    setPanicBroadcast(null);
    sound.success();
  }, [record]);

  const handleCopy = useCallback((text: string) => {
    try {
      navigator.clipboard?.writeText(text);
      setCopied(true);
      sound.copy();
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }, []);

  const handleDisarm = useCallback(async () => {
    if (!record) return;
    const disarmed = disarmGuardian(record);
    setRecord(disarmed);
    setStatus(evaluateStatus(disarmed));
    sound.success();

    // Cancel background notifications for mobile
    try {
      const { cancelGuardianNotifications } = await import("@/lib/capacitor-guardian");
      await cancelGuardianNotifications(record.id);
    } catch (e) {
      console.debug("Failed to cancel guardian notifications:", e);
    }
  }, [record]);

  const handleDestroy = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SIGNING_KEY_STORAGE);
    setRecord(null);
    setStatus(null);
    setToken(null);
    setDecryptedLoc(null);
    setPanicBroadcast(null);
    setCheckInNote("");
    setSigningKey(null);
    setPacketToken(null);
    setPacketUrl(null);
    sound.error();
  }, []);

  // RELAY: ensure a signing key exists, then build a release packet
  const ensureSigningKey = useCallback(async (): Promise<GuardianSigningKey | null> => {
    if (signingKey) return signingKey;
    try {
      const key = await createGuardianSigningKey();
      setSigningKey(key);
      return key;
    } catch {
      return null;
    }
  }, [signingKey]);

  const handleBuildPacket = useCallback(async () => {
    if (!record) return;
    setPacketError("");
    const key = await ensureSigningKey();
    if (!key) {
      setPacketError("// WEB CRYPTO UNAVAILABLE — CANNOT SIGN PACKET");
      sound.error();
      return;
    }
    if (record.status === "safe") {
      setPacketError("// GUARDIAN IS DISARMED (SAFE) — NOTHING TO RELEASE");
      sound.error();
      return;
    }
    try {
      const packet = await buildReleasePacket(record, key, decryptedLoc);
      const token = encodeReleasePacket(packet);
      setPacketToken(token);
      setPacketUrl(buildPacketUrl(token));
      sound.success();
    } catch (e) {
      setPacketError(`// ${e instanceof Error ? e.message : "Packet build failed"}`);
      sound.error();
    }
  }, [record, signingKey, ensureSigningKey, decryptedLoc]);

  const handleVerifyPacket = useCallback(async (token: string) => {
    const raw = token.trim();
    if (!raw) return;
    try {
      const packet = decodeReleasePacket(raw);
      const valid = await verifyReleasePacket(packet);
      if (valid) {
        setInboxResult({
          kind: "ok",
          packet,
          message: `✓ VERIFIED — ${packet.label} · ${packet.status.toUpperCase()} · fp ${packetFingerprint(packet)} · ${new Date(packet.ts).toISOString().replace("T", " ").slice(0, 16)}`,
        });
        sound.success();
      } else {
        setInboxResult({ kind: "fail", message: "✗ PACKET REJECTED — signature invalid or content tampered" });
        sound.error();
      }
    } catch (e) {
      setInboxResult({
        kind: "fail",
        message: `✗ ${e instanceof Error ? e.message : "Malformed release token"}`,
      });
      sound.error();
    }
  }, []);

  const handleInboxDecrypt = useCallback(async () => {
    if (!inboxResult?.packet || !inboxResult.packet.location || !inboxDecrypt) return;
    try {
      const location = await decryptPacketLocation(inboxResult.packet, inboxDecrypt);
      setInboxResult((prev) =>
        prev ? { ...prev, message: `${prev.message}\n📍 DECRYPTED LOCATION: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}${location.accuracy != null ? ` (±${Math.round(location.accuracy)}m)` : ""}${location.note ? ` — ${location.note}` : ""}` } : prev,
      );
      setInboxDecrypt("");
      sound.success();
    } catch {
      setInboxResult((prev) =>
        prev ? { ...prev, message: `${prev.message}\n✗ Decryption failed — wrong passphrase or no location blob` } : prev,
      );
      sound.error();
    }
  }, [inboxResult, inboxDecrypt]);

  // AUTO-RELEASE toggle: persist the armed flag; evaluate immediately on arming
  const handleDeadmanToggle = useCallback(() => {
    const next = !deadmanArmed;
    setDeadmanArmed(next);
    setDeadmanError("");
    if (!next) {
      setDeadmanCountdown(null);
    } else if (record) {
      // an armed switch should evaluate immediately, not on next tick
      void runDeadmanTick(record);
    }
    try {
      localStorage.setItem(DEADMAN_ARMED_KEY, next ? "1" : "0");
    } catch { /* ignore */ }
    sound.select();
  }, [deadmanArmed, record, runDeadmanTick]);

  const handleDeadmanCopy = useCallback((text: string) => {
    handleCopy(text);
    setDeadmanCopied(true);
    setTimeout(() => setDeadmanCopied(false), 1500);
  }, [handleCopy]);

  if (!loaded) return null;

  const hasGuardian = !!record && record.status !== "safe";
  const escalation = record ? getEscalationState(record) : null;

  const statusColor =
    status?.status === "armed"
      ? "var(--color-terminal-green)"
      : status?.status === "warning"
        ? "var(--color-warning-amber)"
        : "var(--color-blood-bright)";

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">
        🛡 THE GUARDIAN
      </h1>
      <p className="text-content-secondary text-sm mb-6">
        // dead man&apos;s switch for people — check in, or your trusted contacts escalate. encrypted location, duress codes, panic broadcast.
      </p>

      {hasGuardian && record && status ? (
        <div className="space-y-4">
          {/* STATUS */}
          <TerminalCard
            title="STATUS"
            accent={
              status.status === "armed"
                ? "green"
                : status.status === "warning"
                  ? "amber"
                  : "blood"
            }
            glow={status.status === "overdue" || status.status === "panic" || status.status === "escalated"}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-2xl font-bold" style={{ color: statusColor }}>
                  {status.status.toUpperCase()}
                </div>
                <div className="text-xs text-content-dim mt-1">{record.config.label}</div>
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
            <div className="mt-4 h-3 bg-abyss border border-border-dim overflow-hidden">
              <div
                className="h-full transition-all duration-1000"
                style={{
                  width: `${status.fractionElapsed * 100}%`,
                  backgroundColor:
                    status.fractionElapsed >= 0.75
                      ? "var(--color-blood-bright)"
                      : status.fractionElapsed >= 0.5
                        ? "var(--color-warning-amber)"
                        : "var(--color-terminal-green)",
                }}
              />
            </div>
            {/* Location status indicator */}
            <div className="mt-3 flex items-center gap-3 text-xs text-content-dim">
              <span>
                📍 {record.location ? `Last fix ${formatDuration(Date.now() - record.location.capturedAt)} ago` : "No location captured"}
              </span>
              <span>·</span>
              <span>{record.config.contacts.length} trusted contact{record.config.contacts.length !== 1 ? "s" : ""}</span>
            </div>
          </TerminalCard>

          {/* ESCALATION LADDER */}
          {escalation && (
            <TerminalCard title="ESCALATION LADDER" accent="amber">
              <div className="space-y-2">
                {sortedContacts(record.config.contacts).map((c, i) => {
                  const tier = escalation.tiers.find((t) => t.contact.id === c.id);
                  const due = tier?.due;
                  return (
                    <div
                      key={c.id}
                      className={`flex items-center justify-between border px-3 py-2 ${
                        due ? "border-blood bg-blood/10" : "border-border-dim"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="text-xs font-mono w-6 text-center"
                          style={{ color: due ? "var(--color-blood-bright)" : "var(--color-content-dim)" }}
                        >
                          T{i}
                        </span>
                        <div>
                          <div className="text-sm text-content-primary font-bold">{c.label}</div>
                          <div className="text-[10px] text-content-dim">{c.handle}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs" style={{ color: due ? "var(--color-blood-bright)" : "var(--color-content-secondary)" }}>
                          {due ? "DUE NOW" : `+${formatDuration(c.escalateAfterMin * 60_000)}`}
                        </div>
                        {due && (
                          <button
                            onClick={() => handleCopy(buildEscalationNotice(record, c, decryptedLoc))}
                            className="text-[10px] text-blood-bright hover:underline mt-0.5"
                          >
                            [ COPY NOTICE ]
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {copied && <p className="text-xs text-terminal-green mt-2">// COPIED TO CLIPBOARD</p>}
            </TerminalCard>
          )}

          {/* CHECK-IN */}
          {status.status !== "panic" && (
            <TerminalCard title="CHECK-IN" accent="green">
              <p className="text-sm text-content-secondary mb-3">
                Enter your passphrase and a check-in word. Use your <span className="text-terminal-green font-bold">safe word</span> for a normal reset,
                or your <span className="text-blood-bright font-bold">duress word</span> if coerced — it looks identical but silently escalates.
              </p>
              <input
                type="password"
                value={checkPass}
                onChange={(e) => setCheckPass(e.target.value)}
                placeholder="Passphrase"
                className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary mb-3 focus:border-blood"
              />
              <input
                type="text"
                value={checkWord}
                onChange={(e) => setCheckWord(e.target.value)}
                placeholder="Check-in word (safe or duress)"
                className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary mb-3 focus:border-blood"
              />
              <button
                onClick={handleCheckIn}
                className="px-4 py-2 text-xs font-bold bg-blood text-white hover:bg-blood-bright transition-colors"
              >
                [ CHECK IN ]
              </button>
              {checkInNote && <p className="text-xs text-terminal-green mt-2 font-mono">// {checkInNote}</p>}
            </TerminalCard>
          )}

          {/* PANIC */}
          <TerminalCard title="PANIC BROADCAST" accent="blood" glow={status.status === "panic"}>
            {status.status === "panic" ? (
              <div className="space-y-3">
                <p className="text-sm text-blood-bright font-bold">PANIC ACTIVE. Your contacts should act now.</p>
                {panicBroadcast && (
                  <div>
                    <pre className="text-xs bg-abyss border border-border-dim p-3 whitespace-pre-wrap text-content-primary font-mono">
                      {panicBroadcast}
                    </pre>
                    <button
                      onClick={() => handleCopy(panicBroadcast)}
                      className="mt-2 px-4 py-2 text-xs font-bold border border-blood text-blood-bright hover:bg-blood hover:text-white transition-colors"
                    >
                      [ COPY BROADCAST ]
                    </button>
                  </div>
                )}
                <button
                  onClick={handleClearPanic}
                  className="px-4 py-2 text-xs border border-border-dim text-content-secondary hover:border-blood"
                >
                  [ CLEAR PANIC ]
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-content-secondary mb-2">
                  Hold for 3 seconds to trigger an immediate panic broadcast with your last-known-location.
                </p>
                <button
                  onMouseDown={panicDown}
                  onMouseUp={panicUp}
                  onMouseLeave={panicUp}
                  onTouchStart={panicDown}
                  onTouchEnd={panicUp}
                  className="w-full px-4 py-4 text-sm font-bold bg-blood text-white hover:bg-blood-bright transition-colors select-none"
                >
                  [ ⚠ HOLD 3s — PANIC ]
                </button>
              </div>
            )}
          </TerminalCard>

          {/* LAST-KNOWN-LOCATION */}
          <TerminalCard title="LAST-KNOWN-LOCATION (ENCRYPTED)" accent="amber">
            {record.location ? (
              <div className="space-y-3">
                <p className="text-xs text-content-secondary">
                  Encrypted location stored locally (AES-GCM). Captured {formatDuration(Date.now() - record.location.capturedAt)} ago.
                  Decrypt only when needed.
                </p>
                {decryptedLoc ? (
                  <div className="bg-abyss border border-border-dim p-3 text-sm">
                    <div className="font-mono text-content-primary">
                      {decryptedLoc.lat.toFixed(5)}, {decryptedLoc.lng.toFixed(5)}
                    </div>
                    {decryptedLoc.accuracy != null && (
                      <div className="text-xs text-content-dim mt-1">±{Math.round(decryptedLoc.accuracy)}m accuracy</div>
                    )}
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${decryptedLoc.lat}&mlon=${decryptedLoc.lng}#map=16/${decryptedLoc.lat}/${decryptedLoc.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blood-bright hover:underline mt-2 inline-block"
                    >
                      [ OPEN IN MAP ↗ ]
                    </a>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={locPass}
                      onChange={(e) => setLocPass(e.target.value)}
                      placeholder="Passphrase to decrypt"
                      className="flex-1 bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary focus:border-blood"
                    />
                    <button
                      onClick={handleDecryptLoc}
                      className="px-4 py-2 text-xs border border-border-dim text-content-secondary hover:border-blood"
                    >
                      [ DECRYPT ]
                    </button>
                  </div>
                )}
                <button
                  onClick={() => { setDecryptedLoc(null); setLocPass(""); }}
                  className="text-[10px] text-content-dim hover:text-blood"
                >
                  [ HIDE DECRYPTED LOCATION ]
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-content-secondary">No location captured yet. Capture your current position, encrypted with your passphrase.</p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={locPass}
                    onChange={(e) => setLocPass(e.target.value)}
                    placeholder="Passphrase to encrypt"
                    className="flex-1 bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary focus:border-blood"
                  />
                  <button
                    onClick={captureGeo}
                    disabled={capturing}
                    className="px-4 py-2 text-xs font-bold border border-blood text-blood-bright hover:bg-blood hover:text-white transition-colors disabled:opacity-50"
                  >
                    {capturing ? "[ LOCATING... ]" : "[ CAPTURE LOCATION ]"}
                  </button>
                </div>
              </div>
            )}
            {locError && <p className="text-blood-bright text-xs font-mono mt-2">{locError}</p>}
          </TerminalCard>

          {/* GUARDIAN TOKEN */}
          {token && (
            <TerminalCard title="GUARDIAN TOKEN" accent="amber">
              <p className="text-xs text-content-secondary mb-2">
                Share this token with your trusted contacts in advance. Separately, share the passphrase through a different channel.
                If you miss a check-in, they use both to decrypt your last-known-location.
              </p>
              <code className="block text-xs bg-abyss border border-border-dim p-3 break-all text-warning-amber">
                {token}
              </code>
            </TerminalCard>
          )}

          {/* RELEASE RELAY */}
          <TerminalCard title={tc(lang, "guardian.relay_title")} accent="blood" glow={status.status === "panic" || status.status === "overdue" || status.status === "escalated"}>
            <p className="text-xs text-content-secondary mb-3">
              {tc(lang, "guardian.relay_desc")}
            </p>

            {/* Outbox */}
            <div className="mb-4">
              <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">OUTBOX</div>
              {!packetToken ? (
                <button
                  onClick={handleBuildPacket}
                  className="px-4 py-2 text-xs font-bold border border-blood text-blood-bright hover:bg-blood hover:text-white transition-colors"
                >
                  {tc(lang, "guardian.build_packet")}
                </button>
              ) : (
                <div className="border border-blood/40 bg-blood/5 p-3 space-y-2">
                  <div className="text-[10px] text-blood-bright font-mono break-all">
                    VFXGP {packetToken.slice(0, 24)}…{packetToken.slice(-8)} ({packetToken.length} chars)
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleCopy(packetToken)}
                      className="px-3 py-1.5 text-[10px] border border-blood text-blood-bright hover:bg-blood hover:text-white"
                    >
                      {tc(lang, "guardian.copy_token")}
                    </button>
                    {packetUrl && (
                      <>
                        <button
                          onClick={() => handleCopy(packetUrl)}
                          className="px-3 py-1.5 text-[10px] border border-border-dim text-content-secondary hover:border-blood"
                        >
                          {tc(lang, "guardian.mirror_link")}
                        </button>
                        <span className="text-[10px] text-content-dim self-center font-mono break-all">
                          {packetUrl.slice(0, 80)}…
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
              {packetError && <p className="text-blood-bright text-xs font-mono mt-2">{packetError}</p>}
            </div>

            {/* Inbox */}
            <div>
              <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">INBOX</div>
              {inboxResult?.kind === "ok" && inboxResult.packet ? (
                <>
                  <div className="border border-terminal-green/40 bg-terminal-green/5 p-3 mb-2 whitespace-pre-wrap text-xs text-content-primary font-mono">
                    {inboxResult.message}
                  </div>
                  {inboxResult.packet.location && (
                    <div className="flex gap-2 mb-2">
                      <input
                        type="password"
                        value={inboxDecrypt}
                        onChange={(e) => setInboxDecrypt(e.target.value)}
                        placeholder="Passphrase to decrypt last-known-location"
                        className="flex-1 bg-abyss border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-terminal-green"
                      />
                      <button
                        onClick={handleInboxDecrypt}
                        className="px-3 py-1.5 text-[10px] border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void"
                      >
                        [ DECRYPT LOCATION ]
                      </button>
                    </div>
                  )}
                </>
              ) : inboxResult?.kind === "fail" ? (
                <div className="border border-blood bg-blood/5 p-3 mb-2 text-xs text-blood-bright font-mono whitespace-pre-wrap">
                  {inboxResult.message}
                </div>
              ) : null}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inboxToken}
                  onChange={(e) => setInboxToken(e.target.value)}
                  placeholder={tc(lang, "guardian.packet_ph")}
                  className="flex-1 bg-abyss border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood font-mono"
                />
                <button
                  onClick={() => handleVerifyPacket(inboxToken)}
                  disabled={!inboxToken.trim()}
                  className="px-4 py-2 text-xs border border-border-dim text-content-secondary hover:border-blood disabled:opacity-30"
                >
                  {tc(lang, "guardian.verify_packet")}
                </button>
              </div>
            </div>

            <p className="text-[10px] text-content-dim mt-3">
              {tc(lang, "guardian.packets_note")}
            </p>
          </TerminalCard>

          {/* AUTO-RELEASE — DEAD MAN'S SWITCH */}
          <TerminalCard title="AUTO-RELEASE — DEAD MAN'S SWITCH" accent="blood">
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={deadmanArmed}
                  onChange={handleDeadmanToggle}
                  style={{ accentColor: "var(--color-blood)" }}
                />
                <span className="text-xs font-bold tracking-widest text-content-primary">
                  {deadmanArmed ? "AUTO-RELEASE ENGAGED" : "AUTO-RELEASE DISARMED"}
                </span>
              </label>
              <span
                className="font-mono text-sm"
                style={{
                  color:
                    deadmanCountdown != null && deadmanCountdown <= 0
                      ? "var(--color-blood-bright)"
                      : "var(--color-content-secondary)",
                }}
              >
                {record && deadmanArmed
                  ? deadmanCountdown != null
                    ? `${deadmanCountdown <= 0 ? "OVERDUE " : "T-MINUS "}${formatDuration(deadmanCountdown)}`
                    : "…"
                  : "STANDBY"}
              </span>
            </div>
            {deadmanError && (
              <p className="text-blood-bright text-xs font-mono mb-2">{deadmanError}</p>
            )}
            {deadmanLatest && (
              <div className="border border-terminal-green/40 bg-terminal-green/5 p-3 mb-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusPill color="green">RELEASED</StatusPill>
                  <span className="text-[10px] text-content-dim font-mono">
                    fp {deadmanLatest.fingerprint} ·{" "}
                    {new Date(deadmanLatest.releasedAt).toISOString().replace("T", " ").slice(0, 16)}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleDeadmanCopy(deadmanLatest.packetToken)}
                    className="px-3 py-1.5 text-[10px] border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void"
                  >
                    [ COPY TOKEN ]
                  </button>
                  <button
                    onClick={() => handleDeadmanCopy(deadmanLatest.packetUrl)}
                    className="px-3 py-1.5 text-[10px] border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void"
                  >
                    [ COPY URL ]
                  </button>
                </div>
                <div className="text-[10px] text-content-dim font-mono break-all">
                  {deadmanLatest.packetUrl}
                </div>
                <p className="text-[10px] text-content-secondary">
                  Hand this to your trusted contacts; no server exists — this device was the courier.
                </p>
                {deadmanNotice && (
                  <pre className="text-[10px] bg-abyss border border-border-dim p-2 whitespace-pre-wrap text-content-primary font-mono">
                    {deadmanNotice}
                  </pre>
                )}
                {deadmanCopied && (
                  <p className="text-[10px] text-terminal-green">// COPIED TO CLIPBOARD</p>
                )}
              </div>
            )}
            {deadmanReleases.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">
                  RELEASE HISTORY
                </div>
                <div className="space-y-1">
                  {deadmanReleases
                    .slice()
                    .sort((a, b) => b.releasedAt - a.releasedAt)
                    .slice(0, 5)
                    .map((r) => (
                      <div
                        key={`${r.guardianId}-${r.deadline}`}
                        className="flex items-center justify-between gap-2 border border-border-dim bg-abyss px-2 py-1"
                      >
                        <span className="text-[10px] font-mono text-content-primary truncate">
                          {r.fingerprint}
                        </span>
                        <span className="text-[10px] text-content-dim whitespace-nowrap">
                          {new Date(r.deadline).toISOString().replace("T", " ").slice(0, 16)} ·{" "}
                          {new Date(r.releasedAt).toISOString().replace("T", " ").slice(0, 16)}
                        </span>
                        <span className="text-[10px] uppercase text-blood-bright">{r.channel}</span>
                        <button
                          onClick={() => handleDeadmanCopy(r.packetUrl)}
                          className="text-[10px] text-terminal-green hover:underline whitespace-nowrap"
                        >
                          [ COPY ]
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
            <p className="text-[10px] text-content-dim">
              No backend exists. This fires only while the device is on and this page is open —
              it PREPARES the signed packet and broadcasts it locally (clipboard / share / on-screen).
              The human courier still carries it the last mile. Duress or panic release immediately.
            </p>
          </TerminalCard>

          {/* ESCALATION MESSAGE */}
          <TerminalCard title="ESCALATION MESSAGE" accent="blood">
            <p className="text-sm text-content-primary whitespace-pre-wrap">
              {record.config.escalationMessage}
            </p>
          </TerminalCard>

          {/* DANGER ZONE */}
          <TerminalCard title="DANGER ZONE" accent="blood">
            <p className="text-xs text-content-secondary mb-3">
              Disarm stands the guardian down (recoverable). Destroy permanently deletes everything from this device — irreversible.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleDisarm}
                className="px-4 py-2 text-xs border border-border-dim text-content-secondary hover:border-blood"
              >
                [ DISARM ]
              </button>
              <button
                onClick={handleDestroy}
                className="px-4 py-2 text-xs font-bold border border-blood text-blood-bright hover:bg-blood hover:text-white transition-colors"
              >
                [ DESTROY GUARDIAN ]
              </button>
            </div>
          </TerminalCard>
        </div>
      ) : (
        <div className="space-y-4">
          {/* SETUP FORM */}
          <TerminalCard title="ARM GUARDIAN" accent="blood">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-content-dim uppercase tracking-widest">Label (who is being guarded)</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary mt-1 focus:border-blood"
                />
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
                  <span>1h</span><span>12h</span><span>24h</span><span>168h (7d)</span>
                </div>
              </div>

              {/* TRUSTED CONTACTS */}
              <div>
                <label className="text-xs text-content-dim uppercase tracking-widest">Trusted Contacts (escalation chain)</label>
                <div className="space-y-2 mt-1">
                  {contacts.map((c, i) => (
                    <div key={c.id} className="grid grid-cols-12 gap-2 items-center">
                      <span className="col-span-1 text-[10px] text-content-dim text-center">T{i}</span>
                      <input
                        type="text"
                        value={c.label}
                        onChange={(e) => updateContact(c.id, { label: e.target.value })}
                        placeholder="Role (Editor)"
                        className="col-span-3 bg-abyss border border-border-dim px-2 py-1.5 text-xs text-content-primary focus:border-blood"
                      />
                      <input
                        type="text"
                        value={c.handle}
                        onChange={(e) => updateContact(c.id, { handle: e.target.value })}
                        placeholder="Channel (Signal, email)"
                        className="col-span-4 bg-abyss border border-border-dim px-2 py-1.5 text-xs text-content-primary focus:border-blood"
                      />
                      <input
                        type="number"
                        min={0}
                        value={c.escalateAfterMin}
                        onChange={(e) => updateContact(c.id, { escalateAfterMin: Number(e.target.value) })}
                        title="Minutes after deadline to notify this contact"
                        className="col-span-3 bg-abyss border border-border-dim px-2 py-1.5 text-xs text-content-primary focus:border-blood"
                      />
                      <span className="col-span-1 text-[10px] text-content-dim">min</span>
                      {contacts.length > 1 && (
                        <button
                          onClick={() => removeContact(c.id)}
                          className="col-span-12 text-[10px] text-blood-bright hover:underline text-right"
                        >
                          [ REMOVE ]
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addContact}
                  className="mt-2 text-xs text-blood-bright hover:underline"
                >
                  [ + ADD CONTACT ]
                </button>
              </div>

              <div>
                <label className="text-xs text-content-dim uppercase tracking-widest">Escalation Message</label>
                <textarea
                  value={escalationMessage}
                  onChange={(e) => setEscalationMessage(e.target.value)}
                  rows={3}
                  className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary mt-1 focus:border-blood"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-content-dim uppercase tracking-widest">Safe Word (min 3 chars)</label>
                  <input
                    type="text"
                    value={safeCode}
                    onChange={(e) => setSafeCode(e.target.value)}
                    placeholder="e.g. sunrise"
                    className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary mt-1 focus:border-blood"
                  />
                </div>
                <div>
                  <label className="text-xs text-content-dim uppercase tracking-widest">Duress Word (min 3 chars)</label>
                  <input
                    type="text"
                    value={duressCode}
                    onChange={(e) => setDuressCode(e.target.value)}
                    placeholder="e.g. nightfall"
                    className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary mt-1 focus:border-blood"
                  />
                </div>
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

              {error && <p className="text-blood-bright text-sm font-mono">{error}</p>}

              <button
                onClick={handleArm}
                className="w-full px-4 py-3 text-sm font-bold bg-blood text-white hover:bg-blood-bright transition-colors"
              >
                [ ARM GUARDIAN ]
              </button>
            </div>
          </TerminalCard>

          {/* HOW IT WORKS */}
          <TerminalCard title="HOW IT WORKS" accent="amber">
            <ol className="space-y-2 text-sm text-content-secondary">
              <li><span className="text-blood-bright font-bold">1.</span> Set a check-in interval and name trusted contacts (escalation chain).</li>
              <li><span className="text-blood-bright font-bold">2.</span> Choose a <span className="text-terminal-green">safe word</span> and a <span className="text-blood-bright">duress word</span>. Share the passphrase with contacts out-of-band.</li>
              <li><span className="text-blood-bright font-bold">3.</span> Check in before each deadline using your passphrase + a word.</li>
              <li><span className="text-blood-bright font-bold">4.</span> Capture your location anytime — it is encrypted (AES-GCM) and stays on this device.</li>
              <li><span className="text-blood-bright font-bold">5.</span> Miss a check-in and the escalation ladder activates: contacts are notified in sequence.</li>
              <li><span className="text-blood-bright font-bold">6.</span> Under coercion? Use the duress word — it looks like a normal check-in but silently escalates.</li>
              <li><span className="text-blood-bright font-bold">7.</span> In immediate danger? Hold PANIC 3s to broadcast your location + message.</li>
            </ol>
            <p className="text-xs text-content-dim mt-4">
              ⚠ This is a heuristic client-side timer. V FOR X has no backend and cannot send messages itself — it prepares them. Your trusted contact must actually carry the alert. Share the passphrase and guardian token through separate, secure channels. For genuine life-safety, layer this with human check-ins, a legal contact, and press-freedom support lines.
            </p>
          </TerminalCard>
        </div>
      )}
    </div>
  );
}
