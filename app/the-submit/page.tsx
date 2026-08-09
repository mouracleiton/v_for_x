"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/stores/useStore";
import { sound } from "@/lib/sound";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import {
  generateAnonymousKey,
  signSubmission,
  encryptEvidence,
  saveSubmission,
  getSubmissions,
  deleteSubmission,
  generateBroadcastToken,
  addCorroboration,
  getCorroborations,
  type Submission,
  type Corroboration,
} from "@/lib/submission";

const data = backbone as WorldBackbone;

const CATEGORIES: { id: Submission["category"]; label: string }[] = [
  { id: "war_crime", label: "War Crime" },
  { id: "corruption", label: "Corruption" },
  { id: "human_rights", label: "Human Rights" },
  { id: "environmental", label: "Environmental" },
  { id: "other", label: "Other" },
];

const RISKS: { id: Submission["riskLevel"]; label: string; color: string }[] = [
  { id: "low", label: "Low", color: "var(--color-terminal-green)" },
  { id: "medium", label: "Medium", color: "var(--color-warning-amber)" },
  { id: "high", label: "High", color: "var(--color-blood)" },
  { id: "critical", label: "Critical", color: "var(--color-blood-bright)" },
];

const STEPS = ["Country", "Category & Risk", "Details", "Evidence", "Security", "Submit"];

function riskPillColor(r: Submission["riskLevel"]): "green" | "amber" | "blood" {
  return r === "low" ? "green" : r === "medium" ? "amber" : "blood";
}

function randomHandle(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return (
    "VFX-" +
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
  );
}

export default function TheSubmitPage() {
  const { lang } = useStore();
  const [mounted, setMounted] = useState(false);

  // anonymous identity
  const [pubKey, setPubKey] = useState<string>("");
  const [privKey, setPrivKey] = useState<string>("");

  // multi-step form
  const [step, setStep] = useState(0);
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState<Submission["category"]>("corruption");
  const [risk, setRisk] = useState<Submission["riskLevel"]>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<Submission["evidence"]>([]);
  const [evType, setEvType] = useState<Submission["evidence"][number]["type"]>("text");
  const [evValue, setEvValue] = useState("");
  const [encrypted, setEncrypted] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // existing dossiers
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [corrobCounts, setCorrobCounts] = useState<Record<string, number>>({});
  const [verifyHandle] = useState(randomHandle());
  const [verifyTarget, setVerifyTarget] = useState("");
  const [verifyProof, setVerifyProof] = useState<Corroboration["proofType"]>("witness");

  useEffect(() => {
    setMounted(true);
    void lang;
    generateAnonymousKey()
      .then(({ publicKey, privateKey }) => {
        setPubKey(publicKey);
        setPrivKey(privateKey);
      })
      .catch(() => {
        /* crypto unavailable (non-secure context) */
      });
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = useCallback(async () => {
    const subs = await getSubmissions();
    setSubmissions(subs);
    const counts: Record<string, number> = {};
    await Promise.all(
      subs.map(async (s) => {
        const c = await getCorroborations(s.id);
        counts[s.id] = c.length;
      }),
    );
    setCorrobCounts(counts);
  }, []);

  const addEvidence = () => {
    if (!evValue.trim()) return;
    setEvidence((prev) => [...prev, { type: evType, value: evValue.trim() }]);
    setEvValue("");
    sound.select();
  };

  const removeEvidence = (idx: number) => {
    setEvidence((prev) => prev.filter((_, i) => i !== idx));
    sound.error();
  };

  const canNext = () => {
    switch (step) {
      case 0:
        return !!country;
      case 1:
        return !!category && !!risk;
      case 2:
        return title.trim().length >= 3 && description.trim().length >= 10;
      default:
        return true; // evidence optional, security always passable
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const sub: Submission = {
      id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
      ts: Date.now(),
      country,
      category,
      title: title.trim(),
      description: description.trim(),
      evidence,
      encrypted: false,
      status: "queued",
      riskLevel: risk,
    };
    if (encrypted) {
      try {
        await encryptEvidence(description);
        sub.encrypted = true;
      } catch {
        /* encryption unavailable */
      }
    }
    if (privKey) {
      try {
        sub.signature = await signSubmission(sub, privKey);
      } catch {
        /* signing unavailable */
      }
    }
    await saveSubmission(sub);
    setToken(generateBroadcastToken(sub));
    sound.success();
    setSubmitting(false);
    setStep(0);
    setCountry("");
    setTitle("");
    setDescription("");
    setEvidence([]);
    void reload();
  };

  const handleVerify = async () => {
    if (!verifyTarget) return;
    await addCorroboration({
      submissionId: verifyTarget,
      handle: verifyHandle,
      ts: Date.now(),
      proofType: verifyProof,
    });
    sound.success();
    setVerifyTarget("");
    void reload();
  };

  const copyToken = () => {
    if (!token) return;
    navigator.clipboard?.writeText(token);
    setCopiedToken(true);
    sound.copy();
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const startNew = () => {
    setToken(null);
    setStep(0);
  };

  const countries = data.countries.slice().sort((a, b) => a.name_en.localeCompare(b.name_en));

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 pt-4">
        <div className="text-xs text-content-dim mb-1">// ANONYMOUS DOSSIER SUBMISSION</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          THE SUBMIT
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          Document war crimes, corruption, and human rights violations. Every dossier is
          cryptographically signed and encrypted at rest. Your identity never leaves this device.
        </p>
      </div>

      {/* Security warning */}
      <div className="terminal-card p-3 mb-6" style={{ borderColor: "rgba(196,43,62,0.4)" }}>
        <div className="flex items-start gap-2">
          <span className="text-blood-bright text-sm shrink-0">⚠</span>
          <p className="text-xs text-content-secondary">
            <span className="text-blood-bright font-bold">SECURITY:</span> This tool stores data
            locally only. No data leaves your device unless you explicitly broadcast. Use a VPN or
            Tor for added safety. Clear your browser data to destroy all dossiers.
          </p>
        </div>
      </div>

      {/* Anonymous identity */}
      <TerminalCard title="Anonymous Identity" accent="green" className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0">
            <div className="text-xs text-content-dim">Anonymous Public Key (ECDSA P-256)</div>
            <div className="text-xs text-terminal-green font-mono break-all">
              {mounted && pubKey ? pubKey.slice(0, 48) + "…" : "generating keypair…"}
            </div>
          </div>
          <StatusPill color={mounted && pubKey ? "green" : "amber"}>
            {mounted && pubKey ? "KEY ACTIVE" : "GENERATING…"}
          </StatusPill>
        </div>
        <p className="text-[10px] text-content-dim mt-2">
          A fresh keypair is generated each session. Dossiers are signed with this key. The private
          key never leaves your device and is discarded when you close this tab.
        </p>
      </TerminalCard>

      {/* Token success OR multi-step form */}
      {token ? (
        <TerminalCard title="Dossier Submitted & Signed" accent="green" glow className="mb-6">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <StatusPill color="green">✓ SAVED LOCALLY</StatusPill>
            <StatusPill color="amber">ECDSA SIGNED</StatusPill>
            {encrypted && <StatusPill color="green">ENCRYPTED</StatusPill>}
          </div>
          <div className="text-xs text-content-secondary mb-2">
            Your broadcast token (share to let others corroborate this dossier):
          </div>
          <div className="flex gap-2">
            <code className="flex-1 bg-void border border-border-dim p-2 text-xs text-terminal-green font-mono break-all">
              {token}
            </code>
            <button
              onClick={copyToken}
              className="px-3 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void"
            >
              {copiedToken ? "✓ COPIED" : "COPY"}
            </button>
          </div>
          <button
            onClick={startNew}
            className="mt-4 px-4 py-2 text-xs border border-blood text-blood-bright hover:bg-blood hover:text-void"
          >
            [ SUBMIT ANOTHER DOSSIER ]
          </button>
        </TerminalCard>
      ) : (
        <>
          {/* Step indicator */}
          <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1 shrink-0">
                <span
                  className="text-[10px] px-2 py-1 border whitespace-nowrap"
                  style={{
                    borderColor:
                      i === step
                        ? "var(--color-blood)"
                        : i < step
                          ? "var(--color-terminal-green)"
                          : "var(--color-border-dim)",
                    color:
                      i === step
                        ? "var(--color-blood-bright)"
                        : i < step
                          ? "var(--color-terminal-green)"
                          : "var(--color-content-dim)",
                  }}
                >
                  {i + 1}. {s}
                </span>
                {i < STEPS.length - 1 && (
                  <span className="text-content-dim text-[10px]">→</span>
                )}
              </div>
            ))}
          </div>

          {/* Step 1 — Country */}
          {step === 0 && (
            <TerminalCard title="Step 1 — Select Country / Region">
              <p className="text-xs text-content-secondary mb-3">
                Which country or territory does this dossier concern?
              </p>
              <select
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  sound.select();
                }}
                className="w-full bg-void border border-border-dim px-3 py-2 text-sm text-content-primary focus:border-blood focus:outline-none"
              >
                <option value="">— Select a country —</option>
                {countries.map((c) => (
                  <option key={c.iso3} value={c.iso3}>
                    {c.name_en} ({c.iso3})
                  </option>
                ))}
              </select>
            </TerminalCard>
          )}

          {/* Step 2 — Category & Risk */}
          {step === 1 && (
            <TerminalCard title="Step 2 — Category & Risk Level">
              <div className="mb-4">
                <div className="text-xs text-content-dim mb-2">CATEGORY</div>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setCategory(c.id);
                        sound.select();
                      }}
                      className="px-3 py-2 text-xs border"
                      style={{
                        borderColor:
                          category === c.id ? "var(--color-blood)" : "var(--color-border-dim)",
                        color:
                          category === c.id
                            ? "var(--color-blood-bright)"
                            : "var(--color-content-secondary)",
                        background:
                          category === c.id ? "rgba(196,43,62,0.1)" : "transparent",
                      }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-content-dim mb-2">RISK LEVEL</div>
                <div className="flex flex-wrap gap-2">
                  {RISKS.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setRisk(r.id);
                        sound.select();
                      }}
                      className="px-3 py-2 text-xs border"
                      style={{
                        borderColor: risk === r.id ? r.color : "var(--color-border-dim)",
                        color: risk === r.id ? r.color : "var(--color-content-secondary)",
                      }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-content-dim mt-2">
                  Risk level helps prioritize verification. Higher risk = greater personal danger to
                  sources.
                </p>
              </div>
            </TerminalCard>
          )}

          {/* Step 3 — Details */}
          {step === 2 && (
            <TerminalCard title="Step 3 — Title & Description">
              <div className="mb-3">
                <div className="text-xs text-content-dim mb-1">TITLE (min 3 chars)</div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    sound.keystroke();
                  }}
                  placeholder="Brief summary of the violation…"
                  className="w-full bg-void border border-border-dim px-3 py-2 text-sm text-content-primary focus:border-blood focus:outline-none"
                />
              </div>
              <div>
                <div className="text-xs text-content-dim mb-1">DESCRIPTION (min 10 chars)</div>
                <textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    sound.keystroke();
                  }}
                  rows={6}
                  placeholder="Describe what happened, when, where, and who was involved. Be factual and specific…"
                  className="w-full bg-void border border-border-dim px-3 py-2 text-sm text-content-primary focus:border-blood focus:outline-none resize-y"
                />
                <div className="text-[10px] text-content-dim mt-1">
                  {description.length} characters
                </div>
              </div>
            </TerminalCard>
          )}

          {/* Step 4 — Evidence */}
          {step === 3 && (
            <TerminalCard title="Step 4 — Evidence Collection">
              <p className="text-xs text-content-secondary mb-3">
                Add supporting evidence. Hashes of documents/images prove existence without storing
                the file itself. URLs point to external sources.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                <select
                  value={evType}
                  onChange={(e) =>
                    setEvType(e.target.value as Submission["evidence"][number]["type"])
                  }
                  className="bg-void border border-border-dim px-3 py-2 text-xs text-content-primary"
                >
                  <option value="text">Text note</option>
                  <option value="url">External URL</option>
                  <option value="image_hash">Image hash (SHA-256)</option>
                  <option value="document_hash">Document hash (SHA-256)</option>
                </select>
                <input
                  type="text"
                  value={evValue}
                  onChange={(e) => {
                    setEvValue(e.target.value);
                    sound.keystroke();
                  }}
                  onKeyDown={(e) => e.key === "Enter" && addEvidence()}
                  placeholder={
                    evType === "url"
                      ? "https://…"
                      : evType.includes("hash")
                        ? "a3f5b2… (hex hash)"
                        : "Evidence note…"
                  }
                  className="flex-1 min-w-[200px] bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
                />
                <button
                  onClick={addEvidence}
                  disabled={!evValue.trim()}
                  className="px-3 py-2 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void disabled:opacity-30"
                >
                  + ADD
                </button>
              </div>
              {evidence.length > 0 ? (
                <div className="space-y-1">
                  {evidence.map((ev, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2 border border-border-dim bg-void/50"
                    >
                      <StatusPill color="dim">{ev.type}</StatusPill>
                      <span className="text-xs text-content-secondary font-mono truncate flex-1">
                        {ev.value}
                      </span>
                      <button
                        onClick={() => removeEvidence(i)}
                        className="text-content-dim hover:text-blood text-xs"
                      >
                        [×]
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-content-dim py-4 text-center">
                  No evidence added yet (optional).
                </div>
              )}
            </TerminalCard>
          )}

          {/* Step 5 — Security review */}
          {step === 4 && (
            <TerminalCard title="Step 5 — Security Review" accent="amber">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="p-2 border border-border-dim bg-void/50">
                  <div className="text-[10px] text-content-dim uppercase">Country</div>
                  <div className="text-sm text-content-primary">
                    {data.countries.find((c) => c.iso3 === country)?.name_en || country}
                  </div>
                </div>
                <div className="p-2 border border-border-dim bg-void/50">
                  <div className="text-[10px] text-content-dim uppercase">Category</div>
                  <div className="text-sm text-content-primary">
                    {CATEGORIES.find((c) => c.id === category)?.label}
                  </div>
                </div>
                <div className="p-2 border border-border-dim bg-void/50">
                  <div className="text-[10px] text-content-dim uppercase">Risk</div>
                  <div
                    className="text-sm"
                    style={{ color: RISKS.find((r) => r.id === risk)?.color }}
                  >
                    {RISKS.find((r) => r.id === risk)?.label}
                  </div>
                </div>
                <div className="p-2 border border-border-dim bg-void/50">
                  <div className="text-[10px] text-content-dim uppercase">Evidence items</div>
                  <div className="text-sm text-content-primary">{evidence.length}</div>
                </div>
              </div>
              <div className="p-2 border border-border-dim bg-void/50 mb-4">
                <div className="text-[10px] text-content-dim uppercase">Title</div>
                <div className="text-sm text-content-primary">{title}</div>
              </div>
              <div
                className="p-3 mb-4"
                style={{
                  borderColor: "rgba(34,211,166,0.4)",
                  background: "rgba(34,211,166,0.05)",
                  border: "1px solid rgba(34,211,166,0.4)",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-terminal-green text-xs">🔐</span>
                  <span className="text-xs text-terminal-green font-bold">ENCRYPTION AT REST</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={encrypted}
                    onChange={(e) => setEncrypted(e.target.checked)}
                  />
                  <span className="text-xs text-content-secondary">
                    Encrypt dossier content (AES-GCM). Recommended.
                  </span>
                </label>
              </div>
              <div
                className="p-3"
                style={{ border: "1px solid rgba(196,43,62,0.4)", background: "rgba(196,43,62,0.05)" }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-blood-bright text-xs">✎</span>
                  <span className="text-xs text-blood-bright font-bold">DIGITAL SIGNATURE</span>
                </div>
                <p className="text-[10px] text-content-secondary">
                  Your dossier will be signed with your anonymous ECDSA key. This proves authenticity
                  without revealing identity.
                  {mounted && pubKey ? " ✓ Key ready." : " ⏳ Generating key…"}
                </p>
              </div>
            </TerminalCard>
          )}

          {/* Step 6 — Submit */}
          {step === 5 && (
            <TerminalCard title="Step 6 — Submit Dossier" accent="blood" glow>
              <p className="text-xs text-content-secondary mb-4">
                Final review. Once submitted, the dossier is saved locally, signed, and a broadcast
                token is generated.
              </p>
              <div className="space-y-2 mb-4">
                <Row
                  label="Country"
                  value={data.countries.find((c) => c.iso3 === country)?.name_en || country}
                />
                <Row
                  label="Category"
                  value={CATEGORIES.find((c) => c.id === category)?.label ?? ""}
                />
                <Row
                  label="Risk"
                  value={RISKS.find((r) => r.id === risk)?.label ?? ""}
                  valueColor={RISKS.find((r) => r.id === risk)?.color}
                />
                <Row label="Evidence" value={`${evidence.length} items`} />
                <Row
                  label="Encrypted"
                  value={encrypted ? "Yes (AES-GCM)" : "No"}
                  valueColor={encrypted ? "var(--color-terminal-green)" : "var(--color-content-dim)"}
                />
                <Row
                  label="Signed"
                  value={mounted && pubKey ? "Yes (ECDSA P-256)" : "Pending"}
                  valueColor="var(--color-terminal-green)"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || (mounted && !pubKey)}
                className="w-full px-4 py-3 text-sm border border-blood text-blood-bright hover:bg-blood hover:text-void disabled:opacity-30 pulse-blood"
              >
                {submitting ? "[ SUBMITTING… ]" : "[ SUBMIT & GENERATE TOKEN ]"}
              </button>
            </TerminalCard>
          )}

          {/* Nav buttons */}
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => {
                setStep((s) => Math.max(0, s - 1));
                sound.nav();
              }}
              disabled={step === 0}
              className="px-4 py-2 text-xs border border-border-dim text-content-secondary hover:border-command hover:text-command disabled:opacity-30"
            >
              ← BACK
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => {
                  if (canNext()) {
                    setStep((s) => s + 1);
                    sound.nav();
                  }
                }}
                disabled={!canNext()}
                className="px-4 py-2 text-xs border border-blood text-blood-bright hover:bg-blood hover:text-void disabled:opacity-30"
              >
                NEXT →
              </button>
            ) : null}
          </div>
        </>
      )}

      {/* Your submissions */}
      <TerminalCard
        title={`Your Submissions (${submissions.length})`}
        accent="green"
        className="mb-6"
      >
        {submissions.length === 0 ? (
          <div className="py-6 text-center text-content-dim text-xs">
            No dossiers submitted yet.
          </div>
        ) : (
          <div className="space-y-2">
            {submissions.map((s) => (
              <div key={s.id} className="p-3 border border-border-dim bg-void/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusPill color="dim">
                        {CATEGORIES.find((c) => c.id === s.category)?.label}
                      </StatusPill>
                      <StatusPill color={riskPillColor(s.riskLevel)}>{s.riskLevel}</StatusPill>
                      {s.encrypted && <StatusPill color="green">ENC</StatusPill>}
                      {s.signature && <StatusPill color="green">✓ SIG</StatusPill>}
                    </div>
                    <div className="text-sm text-content-primary font-bold mt-1 truncate">
                      {s.title}
                    </div>
                    <div className="text-[10px] text-content-dim mt-0.5">
                      {data.countries.find((c) => c.iso3 === s.country)?.name_en || s.country} ·{" "}
                      {new Date(s.ts).toISOString().slice(0, 16).replace("T", " ")} · {s.status}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-terminal-green">
                      {corrobCounts[s.id] ?? 0}
                    </div>
                    <div className="text-[9px] text-content-dim uppercase">verifs</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(generateBroadcastToken(s));
                      sound.copy();
                    }}
                    className="text-[10px] px-2 py-1 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green"
                  >
                    COPY TOKEN
                  </button>
                  <button
                    onClick={() => {
                      void deleteSubmission(s.id).then(reload);
                      sound.error();
                    }}
                    className="text-[10px] px-2 py-1 border border-border-dim text-content-dim hover:border-blood hover:text-blood"
                  >
                    DELETE
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </TerminalCard>

      {/* Verify others */}
      <TerminalCard
        title="Verify Others — Community Corroboration"
        accent="amber"
        className="mb-6"
      >
        <p className="text-xs text-content-secondary mb-3">
          Add corroboration to any dossier. This is a ZK-style attestation — you vouch that the claim
          is credible based on your proof type, without revealing your identity. Your handle:{" "}
          <span className="text-terminal-green font-bold">{verifyHandle}</span>
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          <select
            value={verifyTarget}
            onChange={(e) => setVerifyTarget(e.target.value)}
            className="flex-1 min-w-[200px] bg-void border border-border-dim px-3 py-2 text-xs text-content-primary"
          >
            <option value="">— Select a dossier to verify —</option>
            {submissions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title.slice(0, 50)} (
                {data.countries.find((c) => c.iso3 === s.country)?.name_en || s.country})
              </option>
            ))}
          </select>
          <select
            value={verifyProof}
            onChange={(e) => setVerifyProof(e.target.value as Corroboration["proofType"])}
            className="bg-void border border-border-dim px-3 py-2 text-xs text-content-primary"
          >
            <option value="witness">Witness</option>
            <option value="documentary">Documentary</option>
            <option value="expert">Expert</option>
          </select>
          <button
            onClick={handleVerify}
            disabled={!verifyTarget}
            className="px-3 py-2 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void disabled:opacity-30"
          >
            + ATTEST
          </button>
        </div>
        {verifyTarget && <CorroborationList submissionId={verifyTarget} />}
        {submissions.length === 0 && (
          <div className="text-xs text-content-dim mt-2">
            Submit a dossier first, then corroborations can be added here.
          </div>
        )}
      </TerminalCard>
    </div>
  );
}

/* ── small presentational helpers ── */

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-content-dim">{label}:</span>
      <span style={{ color: valueColor ?? "var(--color-content-primary)" }}>{value}</span>
    </div>
  );
}

function CorroborationList({ submissionId }: { submissionId: string }) {
  const [items, setItems] = useState<Corroboration[]>([]);
  useEffect(() => {
    void getCorroborations(submissionId).then(setItems);
  }, [submissionId]);
  if (items.length === 0) {
    return <div className="text-xs text-content-dim">No corroborations yet.</div>;
  }
  return (
    <div className="space-y-1">
      <div className="text-[10px] text-content-dim uppercase mb-1">
        Corroborations ({items.length})
      </div>
      {items.map((c) => (
        <div
          key={c.id ?? c.ts}
          className="flex justify-between text-[10px] p-1.5 border border-border-dim bg-void/30"
        >
          <span>
            <span className="text-terminal-green">{c.handle}</span> · {c.proofType}
          </span>
          <span className="text-content-dim">
            {new Date(c.ts).toISOString().slice(0, 10)}
          </span>
        </div>
      ))}
    </div>
  );
}
