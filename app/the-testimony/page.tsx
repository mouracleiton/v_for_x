"use client";

import { useState, useEffect, useCallback } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import {
  generateTestimonyKey,
  createTestimony,
  verifyTestimony,
  buildChain,
  verifyChain,
  exportTestimonyPackage,
  CATEGORY_LABELS,
  type AnonymousKeyPair,
  type Testimony,
  type TestimonyChainEntry,
  type TestimonyCategory,
  type ChainVerificationResult,
} from "@/lib/testimony";

const STORAGE_KEY = "vfx-testimony";

export default function TheTestimonyPage() {
  const [keyPair, setKeyPair] = useState<AnonymousKeyPair | null>(null);
  const [testimonies, setTestimonies] = useState<Testimony[]>([]);
  const [chain, setChain] = useState<TestimonyChainEntry[]>([]);
  const [verification, setVerification] = useState<ChainVerificationResult | null>(null);
  const [generating, setGenerating] = useState(false);

  // Form
  const [statement, setStatement] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState<TestimonyCategory>("war_crime");
  const [consentPublic, setConsentPublic] = useState(true);
  const [error, setError] = useState("");
  const [verifiedStatus, setVerifiedStatus] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setKeyPair(parsed.keyPair);
        setTestimonies(parsed.testimonies || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (keyPair) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ keyPair, testimonies }));
    }
  }, [keyPair, testimonies]);

  useEffect(() => {
    if (testimonies.length > 0) {
      buildChain(testimonies).then(setChain);
    }
  }, [testimonies]);

  const handleGenerateKey = useCallback(async () => {
    setGenerating(true);
    try {
      const kp = await generateTestimonyKey();
      setKeyPair(kp);
      sound.success();
    } catch (e) {
      setError(`// ${e instanceof Error ? e.message : "Error"}`);
      sound.error();
    }
    setGenerating(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    setError("");
    if (!keyPair) return;
    if (statement.trim().length < 10) { setError("// STATEMENT MUST BE AT LEAST 10 CHARACTERS"); sound.error(); return; }
    try {
      const t = await createTestimony(keyPair, {
        statement, eventDate: eventDate || new Date().toISOString().slice(0, 10),
        location: location || "Undisclosed", category, consentPublic,
      });
      setTestimonies((prev) => [...prev, t]);
      setStatement(""); setLocation(""); setEventDate("");
      setVerifiedStatus(null);
      sound.success();
    } catch (e) {
      setError(`// ${e instanceof Error ? e.message : "Error"}`);
      sound.error();
    }
  }, [keyPair, statement, eventDate, location, category, consentPublic]);

  const handleVerifyLast = useCallback(async () => {
    if (testimonies.length === 0) return;
    const valid = await verifyTestimony(testimonies[testimonies.length - 1]);
    setVerifiedStatus(valid);
    sound.select();
  }, [testimonies]);

  const handleVerifyChain = useCallback(async () => {
    if (testimonies.length === 0 || chain.length === 0) return;
    const result = await verifyChain(testimonies, chain);
    setVerification(result);
    sound.select();
  }, [testimonies, chain]);

  if (!keyPair) {
    return (
      <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
        <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">📝 THE TESTIMONY</h1>
        <p className="text-content-secondary text-sm mb-6">// signed witness statements — ECDSA-signed, hash-chained, tamper-evident</p>
        <TerminalCard title="GENERATE ANONYMOUS IDENTITY" accent="blood">
          <p className="text-sm text-content-secondary mb-4">
            Generate an anonymous P-256 ECDSA keypair. This will be your signing identity for all testimony. It is anonymous — it proves you signed without revealing who you are.
          </p>
          <button onClick={handleGenerateKey} disabled={generating} className="px-4 py-3 text-sm font-bold bg-blood text-white hover:bg-blood-bright disabled:opacity-30">
            {generating ? "[ GENERATING... ]" : "[ GENERATE IDENTITY ]"}
          </button>
          {error && <p className="text-blood-bright text-sm mt-3">{error}</p>}
        </TerminalCard>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">📝 THE TESTIMONY</h1>
      <p className="text-content-secondary text-sm mb-2">Handle: <span className="text-terminal-green font-mono">{keyPair.handle}</span></p>
      <p className="text-content-secondary text-sm mb-6">// {testimonies.length} {testimonies.length === 1 ? "testimony" : "testimonies"} recorded · hash-chained ledger</p>

      <div className="space-y-4">
        <TerminalCard title="RECORD TESTIMONY" accent="blood">
          <div className="space-y-3">
            <textarea value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="I witnessed..." rows={4}
              className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary focus:border-blood font-mono" />
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary" />
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary" />
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value as TestimonyCategory)} className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-content-secondary">
              <input type="checkbox" checked={consentPublic} onChange={(e) => setConsentPublic(e.target.checked)} />
              I consent to public disclosure of this testimony
            </label>
            {error && <p className="text-blood-bright text-sm">{error}</p>}
            <button onClick={handleSubmit} disabled={statement.length < 10} className="px-4 py-2 text-xs font-bold bg-blood text-white hover:bg-blood-bright disabled:opacity-30">
              [ SIGN & RECORD ]
            </button>
          </div>
        </TerminalCard>

        {testimonies.length > 0 && (
          <>
            <TerminalCard title="TESTIMONY LEDGER" accent="amber">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {testimonies.slice().reverse().map((t, idx) => (
                  <div key={t.id} className="border border-border-dim p-3 bg-abyss">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-warning-amber">{CATEGORY_LABELS[t.category]}</span>
                      <span className="text-xs text-content-dim">#{testimonies.length - idx}</span>
                    </div>
                    <p className="text-sm text-content-primary font-mono">{t.statement}</p>
                    <div className="flex justify-between mt-2 text-xs text-content-dim">
                      <span>📍 {t.location} · 📅 {t.eventDate}</span>
                      <span>✍ {t.signerHandle}</span>
                    </div>
                    <div className="text-xs text-terminal-green mt-1">Hash: {t.contentHash.slice(0, 24)}...</div>
                  </div>
                ))}
              </div>
            </TerminalCard>

            <TerminalCard title="CHAIN VERIFICATION" accent="green">
              <div className="flex gap-2 flex-wrap mb-3">
                <button onClick={handleVerifyLast} className="px-3 py-1.5 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green/10">[ VERIFY LAST ]</button>
                <button onClick={handleVerifyChain} className="px-3 py-1.5 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green/10">[ VERIFY CHAIN ]</button>
                <button onClick={() => { const json = exportTestimonyPackage(testimonies, chain); navigator.clipboard?.writeText(json); sound.copy(); }} className="px-3 py-1.5 text-xs border border-border-dim text-content-secondary hover:border-blood">[ EXPORT ]</button>
              </div>
              {verifiedStatus !== null && (
                <p className={`text-sm ${verifiedStatus ? "text-terminal-green" : "text-blood-bright"}`}>
                  {verifiedStatus ? "✓ Signature verified — testimony is authentic" : "✗ Signature INVALID — testimony was tampered"}
                </p>
              )}
              {verification && (
                <p className={`text-sm ${verification.valid ? "text-terminal-green" : "text-blood-bright"}`}>
                  {verification.valid ? "✓" : "✗"} {verification.message}
                </p>
              )}
            </TerminalCard>
          </>
        )}
      </div>
    </div>
  );
}
