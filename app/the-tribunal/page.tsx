"use client";

import { useState, useCallback, useEffect } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import {
  createCase,
  addCharge,
  addEvidence,
  linkEvidenceToCharge,
  computeCaseStrength,
  exportCase,
  CATEGORY_LABELS,
  EVIDENCE_TYPE_LABELS,
  STRENGTH_LABELS,
  LEGAL_FRAMEWORKS,
  type TribunalCase,
  type ChargeCategory,
  type EvidenceType,
  type EvidenceStrength,
  type CaseStrength,
} from "@/lib/tribunal";

const STORAGE_KEY = "vfx-tribunal";

export default function TheTribunalPage() {
  const [tribunalCase, setTribunalCase] = useState<TribunalCase | null>(null);
  const [strength, setStrength] = useState<CaseStrength | null>(null);
  const [tab, setTab] = useState<"overview" | "charges" | "evidence">("overview");

  // Charge form
  const [chargeCategory, setChargeCategory] = useState<ChargeCategory>("war_crime");
  const [chargeTitle, setChargeTitle] = useState("");
  const [legalFramework, setLegalFramework] = useState("Rome Statute Art. 7");
  const [chargeDesc, setChargeDesc] = useState("");

  // Evidence form
  const [evType, setEvType] = useState<EvidenceType>("document");
  const [evTitle, setEvTitle] = useState("");
  const [evSource, setEvSource] = useState("");
  const [evStrength, setEvStrength] = useState<EvidenceStrength>("single_source");
  const [evDate, setEvDate] = useState("");
  const [evDesc, setEvDesc] = useState("");
  const [linkChargeId, setLinkChargeId] = useState("");

  // Case creation
  const [caseTitle, setCaseTitle] = useState("");
  const [accusedEntity, setAccusedEntity] = useState("");
  const [accusedRole, setAccusedRole] = useState("");
  const [caseSummary, setCaseSummary] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as TribunalCase;
        setTribunalCase(parsed);
        setStrength(computeCaseStrength(parsed));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (tribunalCase) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tribunalCase));
      setStrength(computeCaseStrength(tribunalCase));
    }
  }, [tribunalCase]);

  const handleCreateCase = useCallback(() => {
    if (!caseTitle || !accusedEntity) return;
    const c = createCase(caseTitle, accusedEntity, accusedRole, caseSummary);
    setTribunalCase(c);
    setTab("charges");
    sound.success();
  }, [caseTitle, accusedEntity, accusedRole, caseSummary]);

  const handleAddCharge = useCallback(() => {
    if (!tribunalCase || !chargeTitle) return;
    setTribunalCase(addCharge(tribunalCase, {
      category: chargeCategory,
      title: chargeTitle,
      legalFramework,
      description: chargeDesc,
    }));
    setChargeTitle(""); setChargeDesc("");
    sound.success();
  }, [tribunalCase, chargeCategory, chargeTitle, legalFramework, chargeDesc]);

  const handleAddEvidence = useCallback(async () => {
    if (!tribunalCase || !evTitle) return;
    let c = await addEvidence(tribunalCase, {
      type: evType,
      title: evTitle,
      description: evDesc,
      source: evSource,
      date: evDate || new Date().toISOString().slice(0, 10),
      strength: evStrength,
    });
    if (linkChargeId) {
      const lastEvId = c.evidence[c.evidence.length - 1].id;
      c = linkEvidenceToCharge(c, linkChargeId, lastEvId);
    }
    setTribunalCase(c);
    setEvTitle(""); setEvDesc(""); setEvSource("");
    sound.success();
  }, [tribunalCase, evType, evTitle, evDesc, evSource, evDate, evStrength, linkChargeId]);

  if (!tribunalCase) {
    return (
      <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
        <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">⚖️ THE TRIBUNAL</h1>
        <p className="text-content-secondary text-sm mb-6">// citizen-run accountability case builder — evidence-backed, hash-chained</p>
        <TerminalCard title="NEW CASE" accent="blood">
          <div className="space-y-3">
            <input type="text" value={caseTitle} onChange={(e) => setCaseTitle(e.target.value)} placeholder="Case title (e.g., 'Indiscriminate bombardment of civilians')"
              className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary focus:border-blood" />
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={accusedEntity} onChange={(e) => setAccusedEntity(e.target.value)} placeholder="Accused entity (name)"
                className="bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary focus:border-blood" />
              <input type="text" value={accusedRole} onChange={(e) => setAccusedRole(e.target.value)} placeholder="Role (e.g., 'Defense Minister')"
                className="bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary focus:border-blood" />
            </div>
            <textarea value={caseSummary} onChange={(e) => setCaseSummary(e.target.value)} placeholder="Case summary..." rows={3}
              className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary focus:border-blood" />
            <button onClick={handleCreateCase} disabled={!caseTitle || !accusedEntity}
              className="px-4 py-2 text-xs font-bold bg-blood text-white hover:bg-blood-bright disabled:opacity-30">[ CREATE CASE ]</button>
          </div>
        </TerminalCard>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">⚖️ THE TRIBUNAL</h1>
      <p className="text-content-secondary text-sm mb-6">{tribunalCase.title}</p>

      {strength && (
        <TerminalCard title="CASE STRENGTH" accent={strength.score >= 55 ? "green" : strength.score >= 30 ? "amber" : "blood"}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-3xl font-bold" style={{ color: strength.score >= 55 ? "var(--color-terminal-green)" : strength.score >= 30 ? "var(--color-warning-amber)" : "var(--color-blood)" }}>
              {strength.score}/100
            </span>
            <span className="text-sm uppercase tracking-widest" style={{ color: strength.score >= 55 ? "var(--color-terminal-green)" : strength.score >= 30 ? "var(--color-warning-amber)" : "var(--color-blood)" }}>
              {strength.level}
            </span>
          </div>
          <div className="h-2 bg-abyss border border-border-dim mb-3">
            <div className="h-full transition-all" style={{ width: `${strength.score}%`, backgroundColor: strength.score >= 55 ? "var(--color-terminal-green)" : strength.score >= 30 ? "var(--color-warning-amber)" : "var(--color-blood)" }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
            <div><span className="text-content-dim">Evidence:</span> {strength.totalEvidence}</div>
            <div><span className="text-content-dim">Corroborated:</span> {strength.corroboratedEvidence}</div>
            <div><span className="text-content-dim">Charges w/ ev:</span> {strength.chargesWithEvidence}/{strength.chargesTotal}</div>
          </div>
          {strength.gaps.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-warning-amber mb-1">⚠ GAPS:</p>
              <ul className="text-xs text-content-secondary space-y-1">{strength.gaps.map((g, i) => <li key={i}>• {g}</li>)}</ul>
            </div>
          )}
          {strength.recommendations.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-terminal-green mb-1">→ RECOMMENDATIONS:</p>
              <ul className="text-xs text-content-secondary space-y-1">{strength.recommendations.map((r, i) => <li key={i}>• {r}</li>)}</ul>
            </div>
          )}
        </TerminalCard>
      )}

      <div className="flex gap-1 mb-4 border-b border-border-dim">
        {([["overview", "OVERVIEW"], ["charges", `CHARGES (${tribunalCase.charges.length})`], ["evidence", `EVIDENCE (${tribunalCase.evidence.length})`]] as [typeof tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => { setTab(t); sound.nav(); }}
            className={`px-3 py-2 text-xs font-bold ${tab === t ? "text-blood-bright border-b-2 border-blood" : "text-content-dim hover:text-content-primary"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <TerminalCard title="CASE DETAILS" accent="amber">
          <dl className="space-y-2 text-sm">
            <div><dt className="text-content-dim text-xs uppercase">Accused</dt><dd className="text-content-primary">{tribunalCase.accusedEntity} ({tribunalCase.accusedRole})</dd></div>
            <div><dt className="text-content-dim text-xs uppercase">Summary</dt><dd className="text-content-secondary">{tribunalCase.summary}</dd></div>
            <div><dt className="text-content-dim text-xs uppercase">Ledger Entries</dt><dd className="text-content-secondary">{tribunalCase.ledger.length} (hash-chained)</dd></div>
            <div><dt className="text-content-dim text-xs uppercase">Created</dt><dd className="text-content-secondary">{new Date(tribunalCase.createdAt).toLocaleDateString()}</dd></div>
          </dl>
          <button onClick={() => { const json = exportCase(tribunalCase); navigator.clipboard?.writeText(json); sound.copy(); }}
            className="mt-4 px-4 py-2 text-xs border border-border-dim text-content-secondary hover:border-blood">[ EXPORT CASE JSON ]</button>
        </TerminalCard>
      )}

      {tab === "charges" && (
        <div className="space-y-4">
          {tribunalCase.charges.length > 0 && (
            <TerminalCard title="FILED CHARGES" accent="blood">
              <div className="space-y-3">
                {tribunalCase.charges.map((c) => (
                  <div key={c.id} className="border border-border-dim p-3 bg-abyss">
                    <div className="flex justify-between">
                      <span className="text-warning-amber text-xs">{CATEGORY_LABELS[c.category]}</span>
                      <span className="text-xs text-content-dim">{c.evidenceIds.length} linked</span>
                    </div>
                    <p className="text-sm text-content-primary font-bold mt-1">{c.title}</p>
                    <p className="text-xs text-content-secondary mt-1">{c.description}</p>
                    <p className="text-xs text-content-dim mt-1">⚖ {c.legalFramework}</p>
                  </div>
                ))}
              </div>
            </TerminalCard>
          )}
          <TerminalCard title="ADD CHARGE" accent="green">
            <div className="space-y-3">
              <select value={chargeCategory} onChange={(e) => setChargeCategory(e.target.value as ChargeCategory)} className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary">
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input type="text" value={chargeTitle} onChange={(e) => setChargeTitle(e.target.value)} placeholder="Charge title" className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary focus:border-blood" />
              <select value={legalFramework} onChange={(e) => setLegalFramework(e.target.value)} className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary">
                {LEGAL_FRAMEWORKS.map((f) => <option key={f.code} value={f.code}>{f.code} — {f.title}</option>)}
              </select>
              <textarea value={chargeDesc} onChange={(e) => setChargeDesc(e.target.value)} placeholder="Charge description..." rows={2} className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary focus:border-blood" />
              <button onClick={handleAddCharge} disabled={!chargeTitle} className="px-4 py-2 text-xs font-bold bg-blood text-white hover:bg-blood-bright disabled:opacity-30">[ ADD CHARGE ]</button>
            </div>
          </TerminalCard>
        </div>
      )}

      {tab === "evidence" && (
        <div className="space-y-4">
          {tribunalCase.evidence.length > 0 && (
            <TerminalCard title="EVIDENCE LEDGER" accent="blood">
              <div className="space-y-2">
                {tribunalCase.evidence.map((e) => (
                  <div key={e.id} className="border border-border-dim p-3 bg-abyss">
                    <div className="flex justify-between">
                      <span className="text-terminal-green text-xs">{EVIDENCE_TYPE_LABELS[e.type]}</span>
                      <span className="text-xs text-content-dim">{STRENGTH_LABELS[e.strength]}</span>
                    </div>
                    <p className="text-sm text-content-primary font-bold mt-1">{e.title}</p>
                    <p className="text-xs text-content-secondary mt-1">{e.description}</p>
                    <p className="text-xs text-content-dim mt-1">Source: {e.source} · {e.date}</p>
                  </div>
                ))}
              </div>
            </TerminalCard>
          )}
          <TerminalCard title="ADD EVIDENCE" accent="green">
            <div className="space-y-3">
              <select value={evType} onChange={(e) => setEvType(e.target.value as EvidenceType)} className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary">
                {Object.entries(EVIDENCE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input type="text" value={evTitle} onChange={(e) => setEvTitle(e.target.value)} placeholder="Evidence title" className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary focus:border-blood" />
              <input type="text" value={evSource} onChange={(e) => setEvSource(e.target.value)} placeholder="Source" className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary focus:border-blood" />
              <input type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)} className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary" />
              <textarea value={evDesc} onChange={(e) => setEvDesc(e.target.value)} placeholder="Description..." rows={2} className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary focus:border-blood" />
              <select value={evStrength} onChange={(e) => setEvStrength(e.target.value as EvidenceStrength)} className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary">
                {Object.entries(STRENGTH_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {tribunalCase.charges.length > 0 && (
                <select value={linkChargeId} onChange={(e) => setLinkChargeId(e.target.value)} className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary">
                  <option value="">— Link to charge (optional) —</option>
                  {tribunalCase.charges.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              )}
              <button onClick={handleAddEvidence} disabled={!evTitle} className="px-4 py-2 text-xs font-bold bg-blood text-white hover:bg-blood-bright disabled:opacity-30">[ ADD EVIDENCE ]</button>
            </div>
          </TerminalCard>
        </div>
      )}
    </div>
  );
}
