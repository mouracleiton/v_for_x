"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import {
  createFactCheck,
  addSource,
  removeSource,
  setManualVerdict,
  computeVerdictReport,
  exportFactCheck,
  verifySource,
  buildSeedFactChecks,
  VERDICT_LABELS,
  VERDICT_DESCRIPTIONS,
  STANCE_LABELS,
  CREDIBILITY_LABELS,
  MEDIUM_LABELS,
  VERDICT_OPTIONS,
  RECENCY_WINDOW_MONTHS,
  type FactCheck,
  type Verdict,
  type SourceStance,
  type CredibilityTier,
  type ClaimMedium,
  type VerifiedSource,
} from "@/lib/verdict";

const STORAGE_KEY = "vfx-verdict";

function verdictColor(v: Verdict): string {
  switch (v) {
    case "true": return "var(--color-terminal-green)";
    case "false": return "var(--color-blood-bright)";
    case "misleading": return "var(--color-warning-amber)";
    case "mixed": return "var(--color-warning-amber)";
    default: return "var(--color-content-dim)";
  }
}

function levelColor(level: "high" | "moderate" | "low" | "minimal"): string {
  if (level === "high") return "var(--color-terminal-green)";
  if (level === "moderate") return "var(--color-terminal-green)";
  if (level === "low") return "var(--color-warning-amber)";
  return "var(--color-blood)";
}

const inputCls =
  "w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary focus:border-blood";

export default function TheVerdictPage() {
  const [checks, setChecks] = useState<FactCheck[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<"gallery" | "new" | "detail">("gallery");
  const [verifyState, setVerifyState] = useState<Record<string, boolean | null>>({});

  // Claim form
  const [claimText, setClaimText] = useState("");
  const [claimant, setClaimant] = useState("");
  const [claimantRole, setClaimantRole] = useState("");
  const [madeOn, setMadeOn] = useState("");
  const [medium, setMedium] = useState<ClaimMedium>("official_statement");
  const [context, setContext] = useState("");

  // Source form
  const [srcTitle, setSrcTitle] = useState("");
  const [srcPublisher, setSrcPublisher] = useState("");
  const [srcUrl, setSrcUrl] = useState("");
  const [srcDate, setSrcDate] = useState("");
  const [srcStance, setSrcStance] = useState<SourceStance>("refutes_claim");
  const [srcCred, setSrcCred] = useState<CredibilityTier>("established");
  const [srcExcerpt, setSrcExcerpt] = useState("");

  // Hydrate: user checks from localStorage + seed examples
  useEffect(() => {
    let userChecks: FactCheck[] = [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) userChecks = JSON.parse(stored) as FactCheck[];
    } catch { /* ignore */ }
    buildSeedFactChecks().then((seeds) => {
      setChecks([...seeds, ...userChecks]);
    });
  }, []);

  // Persist only user-created checks
  const persist = useCallback((all: FactCheck[]) => {
    const userOnly = all.filter((c) => !c.seed);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(userOnly)); } catch { /* ignore */ }
  }, []);

  const userChecks = useMemo(() => checks.filter((c) => !c.seed), [checks]);

  const active = useMemo(
    () => checks.find((c) => c.id === activeId) ?? null,
    [checks, activeId],
  );

  const report = useMemo(
    () => (active ? computeVerdictReport(active) : null),
    [active],
  );

  const handleCreate = useCallback(() => {
    if (!claimText || !claimant) return;
    const fc = createFactCheck(
      { text: claimText, claimant, claimantRole: claimantRole || undefined, madeOn: madeOn || undefined, medium, context: context || undefined },
    );
    const next = [...checks, fc];
    setChecks(next);
    persist(next);
    setView("detail");
    setActiveId(fc.id);
    setClaimText(""); setClaimant(""); setClaimantRole(""); setMadeOn(""); setContext("");
    sound.success();
  }, [claimText, claimant, claimantRole, madeOn, medium, context, checks, persist]);

  const handleAddSource = useCallback(async () => {
    if (!active || !srcTitle || !srcExcerpt) return;
    const today = new Date().toISOString().slice(0, 10);
    const updated = await addSource(active, {
      title: srcTitle,
      publisher: srcPublisher || "Unattributed",
      url: srcUrl || undefined,
      publishedDate: srcDate || undefined,
      accessedDate: today,
      stance: srcStance,
      credibility: srcCred,
      excerpt: srcExcerpt,
    });
    const next = checks.map((c) => (c.id === active.id ? updated : c));
    setChecks(next);
    persist(next);
    setSrcTitle(""); setSrcPublisher(""); setSrcUrl(""); setSrcDate(""); setSrcExcerpt("");
    sound.success();
  }, [active, srcTitle, srcExcerpt, srcPublisher, srcUrl, srcDate, srcStance, srcCred, checks, persist]);

  const handleRemoveSource = useCallback((sid: string) => {
    if (!active) return;
    const updated = removeSource(active, sid);
    const next = checks.map((c) => (c.id === active.id ? updated : c));
    setChecks(next);
    persist(next);
    sound.select();
  }, [active, checks, persist]);

  const handleManualVerdict = useCallback((v: Verdict | null) => {
    if (!active) return;
    const updated = setManualVerdict(active, v);
    const next = checks.map((c) => (c.id === active.id ? updated : c));
    setChecks(next);
    persist(next);
  }, [active, checks, persist]);

  const handleClone = useCallback(() => {
    if (!active) return;
    const clone: FactCheck = {
      ...active,
      id: crypto.randomUUID(),
      seed: false,
      status: "open",
      manualVerdict: null,
      title: active.title + " (copy)",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const next = [...checks, clone];
    setChecks(next);
    persist(next);
    setActiveId(clone.id);
    sound.success();
  }, [active, checks, persist]);

  const handleVerify = useCallback(async (s: VerifiedSource) => {
    const ok = await verifySource(s);
    setVerifyState((prev) => ({ ...prev, [s.id]: ok }));
    if (ok) sound.nav(); else sound.error();
  }, []);

  const handleExport = useCallback(() => {
    if (!active) return;
    const json = exportFactCheck(active);
    navigator.clipboard?.writeText(json);
    sound.copy();
  }, [active]);

  /* ───────────── GALLERY ───────────── */
  if (view === "gallery") {
    return (
      <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
        <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">🔍 THE VERDICT</h1>
        <p className="text-content-secondary text-sm mb-1">
          // rapid-response misinformation counter — claim → hashed sources → verdict
        </p>
        <p className="text-content-dim text-xs mb-6">
          Distinct from <span className="text-content-secondary">The Tribunal</span> (legal cases) and{" "}
          <span className="text-content-secondary">The Registry</span> (dossiers). This renders a single verdict on a single assertion.
        </p>

        <button
          onClick={() => { setView("new"); sound.nav(); }}
          className="mb-6 px-4 py-2 text-xs font-bold bg-blood text-white hover:bg-blood-bright"
        >
          [ + NEW FACT CHECK ]
        </button>

        <div className="grid sm:grid-cols-2 gap-3">
          {checks.map((c) => {
            const r = computeVerdictReport(c);
            return (
              <button
                key={c.id}
                onClick={() => { setActiveId(c.id); setView("detail"); sound.nav(); }}
                className="text-left border border-border-dim p-4 bg-abyss hover:border-blood transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-xs font-bold uppercase tracking-widest px-2 py-0.5"
                    style={{ color: verdictColor(r.verdict), border: `1px solid ${verdictColor(r.verdict)}` }}
                  >
                    {VERDICT_LABELS[r.verdict]}
                  </span>
                  <span className="text-[10px] text-content-dim">
                    {c.seed ? "EXAMPLE" : "YOURS"} · {r.confidence}%
                  </span>
                </div>
                <p className="text-sm text-content-primary font-bold line-clamp-2">{c.title}</p>
                <p className="text-xs text-content-dim mt-1">
                  {c.claim.claimant}{c.claim.claimantRole ? ` · ${c.claim.claimantRole}` : ""}
                </p>
                <div className="flex gap-3 mt-2 text-[10px] text-content-dim">
                  <span>{c.sources.length} sources</span>
                  <span>{r.independentPublishers} independent</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ───────────── NEW FACT CHECK ───────────── */
  if (view === "new") {
    return (
      <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
        <button onClick={() => { setView("gallery"); sound.nav(); }} className="text-xs text-content-dim hover:text-content-primary mb-4">
          ← back to gallery
        </button>
        <h1 className="text-2xl text-blood-bright font-bold tracking-widest mb-2">NEW FACT CHECK</h1>
        <p className="text-content-secondary text-sm mb-6">// enter the claim being checked — ideally a direct quote</p>

        <TerminalCard title="THE CLAIM" accent="blood">
          <div className="space-y-3">
            <textarea value={claimText} onChange={(e) => setClaimText(e.target.value)} placeholder="Exact claim / direct quote (e.g., 'The strike caused zero civilian casualties.')" rows={3} className={inputCls} />
            <div className="grid sm:grid-cols-2 gap-3">
              <input type="text" value={claimant} onChange={(e) => setClaimant(e.target.value)} placeholder="Claimant (who said it)" className={inputCls} />
              <input type="text" value={claimantRole} onChange={(e) => setClaimantRole(e.target.value)} placeholder="Role / title (optional)" className={inputCls} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <select value={medium} onChange={(e) => setMedium(e.target.value as ClaimMedium)} className={inputCls}>
                {Object.entries(MEDIUM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input type="date" value={madeOn} onChange={(e) => setMadeOn(e.target.value)} className={inputCls} />
            </div>
            <input type="text" value={context} onChange={(e) => setContext(e.target.value)} placeholder="Where it appeared (channel / outlet / link)" className={inputCls} />
            <button onClick={handleCreate} disabled={!claimText || !claimant} className="px-4 py-2 text-xs font-bold bg-blood text-white hover:bg-blood-bright disabled:opacity-30">
              [ CREATE & ADD SOURCES ]
            </button>
          </div>
        </TerminalCard>
      </div>
    );
  }

  /* ───────────── DETAIL ───────────── */
  if (!active || !report) {
    return (
      <div className="p-10 max-w-4xl mx-auto">
        <button onClick={() => { setView("gallery"); sound.nav(); }} className="text-xs text-content-dim hover:text-content-primary mb-4">← back to gallery</button>
        <p className="text-content-dim text-sm">No fact check selected.</p>
      </div>
    );
  }

  const editable = !active.seed;

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <button onClick={() => { setView("gallery"); setActiveId(null); sound.nav(); }} className="text-xs text-content-dim hover:text-content-primary mb-4">
        ← back to gallery
      </button>
      <h1 className="text-2xl sm:text-3xl text-blood-bright font-bold tracking-widest mb-1">THE VERDICT</h1>
      <p className="text-content-secondary text-sm mb-6">{active.title}</p>

      {/* VERDICT REPORT */}
      <TerminalCard title="VERDICT" accent={report.verdict === "true" ? "green" : report.verdict === "unverified" ? "amber" : "blood"}>
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-4xl font-bold tracking-widest" style={{ color: verdictColor(report.verdict) }}>
              {VERDICT_LABELS[report.verdict]}
            </div>
            {active.manualVerdict && active.manualVerdict !== report.recommendedVerdict && (
              <div className="text-[10px] text-warning-amber mt-1">
                ⚠ override (engine recommended {VERDICT_LABELS[report.recommendedVerdict]})
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold" style={{ color: levelColor(report.level) }}>{report.confidence}<span className="text-sm text-content-dim">/100</span></div>
            <div className="text-[10px] uppercase tracking-widest" style={{ color: levelColor(report.level) }}>{report.level} confidence</div>
          </div>
        </div>

        <div className="h-2 bg-abyss border border-border-dim mb-3">
          <div className="h-full transition-all" style={{ width: `${report.confidence}%`, backgroundColor: levelColor(report.level) }} />
        </div>

        <p className="text-xs text-content-secondary mb-3">{VERDICT_DESCRIPTIONS[report.verdict]}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
          <div><span className="text-content-dim">Sources:</span> {report.sourcesTotal}</div>
          <div><span className="text-content-dim">Independent:</span> {report.independentPublishers}</div>
          <div><span className="text-content-dim">Corroborating:</span> {report.corroboratingSources}</div>
          <div><span className="text-content-dim">Strongest:</span> {report.strongestTier ?? "—"}</div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[10px] text-content-dim mb-3">
          <span>▲ {report.supportingSources} support</span>
          <span className="text-blood-bright">▼ {report.refutingSources} refute</span>
          <span>≡ {report.contextualSources} contextual</span>
        </div>

        {report.reasoning.length > 0 && (
          <div className="mt-2 text-xs text-content-secondary space-y-1">
            {report.reasoning.map((r, i) => <p key={i}>· {r}</p>)}
          </div>
        )}
        {report.gaps.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-warning-amber mb-1">⚠ GAPS</p>
            <ul className="text-xs text-content-secondary space-y-1">{report.gaps.map((g, i) => <li key={i}>• {g}</li>)}</ul>
          </div>
        )}
        {report.recommendations.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-terminal-green mb-1">→ RECOMMENDATIONS</p>
            <ul className="text-xs text-content-secondary space-y-1">{report.recommendations.map((r, i) => <li key={i}>• {r}</li>)}</ul>
          </div>
        )}

        {/* Manual override */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-content-dim uppercase">Analyst verdict:</span>
          <select
            value={active.manualVerdict ?? ""}
            onChange={(e) => handleManualVerdict((e.target.value || null) as Verdict | null)}
            disabled={!editable}
            className={`${inputCls} max-w-[180px] py-1`}
          >
            <option value="">auto ({VERDICT_LABELS[report.recommendedVerdict]})</option>
            {VERDICT_OPTIONS.map((v) => <option key={v} value={v}>{VERDICT_LABELS[v]}</option>)}
          </select>
          {!editable && <span className="text-[10px] text-content-dim">(clone to edit)</span>}
        </div>
      </TerminalCard>

      {/* CLAIM */}
      <TerminalCard title="THE CLAIM" accent="amber">
        <blockquote className="text-sm text-content-primary border-l-2 border-blood pl-3 italic">
          “{active.claim.text}”
        </blockquote>
        <dl className="mt-3 space-y-1 text-xs">
          <div><dt className="text-content-dim inline">Claimant: </dt><dd className="text-content-secondary inline">{active.claim.claimant}{active.claim.claimantRole ? ` (${active.claim.claimantRole})` : ""}</dd></div>
          <div><dt className="text-content-dim inline">Medium: </dt><dd className="text-content-secondary inline">{MEDIUM_LABELS[active.claim.medium]}</dd></div>
          {active.claim.madeOn && <div><dt className="text-content-dim inline">Made on: </dt><dd className="text-content-secondary inline">{active.claim.madeOn}</dd></div>}
          {active.claim.context && <div><dt className="text-content-dim inline">Context: </dt><dd className="text-content-secondary inline">{active.claim.context}</dd></div>}
        </dl>
      </TerminalCard>

      {/* SOURCES */}
      <TerminalCard title={`HASHED SOURCES (${active.sources.length})`} accent="blood">
        {active.sources.length === 0 ? (
          <p className="text-xs text-content-dim">No sources yet. Add at least 3 independent sources below.</p>
        ) : (
          <div className="space-y-3">
            {active.sources.map((s) => {
              const v = verifyState[s.id];
              return (
                <div key={s.id} className="border border-border-dim p-3 bg-abyss">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="text-sm text-content-primary font-bold">{s.title}</p>
                      <p className="text-xs text-content-dim">{s.publisher}{s.publishedDate ? ` · ${s.publishedDate}` : ""}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <span className="text-[9px] px-1.5 py-0.5 border" style={{
                        color: s.stance === "refutes_claim" ? "var(--color-blood-bright)" : s.stance === "supports_claim" ? "var(--color-terminal-green)" : "var(--color-warning-amber)",
                        borderColor: "var(--color-border-bright)",
                      }}>
                        {STANCE_LABELS[s.stance]}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-content-secondary mt-2 italic line-clamp-3">{s.excerpt}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] text-content-dim">
                    <span className="text-terminal-green" title={CREDIBILITY_LABELS[s.credibility]}>◈ {s.credibility}</span>
                    <span title="SHA-256 of the excerpt — re-verify to detect silent edits">#{s.contentHash.slice(0, 16)}…</span>
                    <button onClick={() => handleVerify(s)} className="underline hover:text-blood-bright">
                      {v === undefined ? "verify hash" : v ? "✓ intact" : "✗ tampered"}
                    </button>
                    {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-content-primary">source ↗</a>}
                    {editable && <button onClick={() => handleRemoveSource(s.id)} className="underline hover:text-blood-bright ml-auto">remove</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </TerminalCard>

      {/* ADD SOURCE or CLONE */}
      {editable ? (
        <TerminalCard title="ADD SOURCE" accent="green">
          <div className="space-y-3">
            <input type="text" value={srcTitle} onChange={(e) => setSrcTitle(e.target.value)} placeholder="Source title (e.g., 'Field hospital casualty log')" className={inputCls} />
            <div className="grid sm:grid-cols-2 gap-3">
              <input type="text" value={srcPublisher} onChange={(e) => setSrcPublisher(e.target.value)} placeholder="Publisher / outlet" className={inputCls} />
              <input type="text" value={srcUrl} onChange={(e) => setSrcUrl(e.target.value)} placeholder="URL (archive link preferred)" className={inputCls} />
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <input type="date" value={srcDate} onChange={(e) => setSrcDate(e.target.value)} title="Date published" className={inputCls} />
              <select value={srcStance} onChange={(e) => setSrcStance(e.target.value as SourceStance)} className={inputCls}>
                {Object.entries(STANCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={srcCred} onChange={(e) => setSrcCred(e.target.value as CredibilityTier)} className={inputCls}>
                {Object.entries(CREDIBILITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <textarea value={srcExcerpt} onChange={(e) => setSrcExcerpt(e.target.value)} placeholder="Paste the excerpt / quote being cited — this text is SHA-256 hashed as a tamper-evident snapshot." rows={4} className={inputCls} />
            <p className="text-[10px] text-content-dim">
              Sources published within {RECENCY_WINDOW_MONTHS} months count toward recency confidence. Past {RECENCY_WINDOW_MONTHS} months, link an archive.
            </p>
            <button onClick={handleAddSource} disabled={!srcTitle || !srcExcerpt} className="px-4 py-2 text-xs font-bold bg-blood text-white hover:bg-blood-bright disabled:opacity-30">
              [ HASH & ADD SOURCE ]
            </button>
          </div>
        </TerminalCard>
      ) : (
        <TerminalCard title="EXAMPLE — READ ONLY" accent="amber">
          <p className="text-xs text-content-secondary mb-3">This is a bundled example. Clone it to your own list to add sources or edit the verdict.</p>
          <button onClick={handleClone} className="px-4 py-2 text-xs font-bold border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright">
            [ CLONE TO MY CHECKS ]
          </button>
        </TerminalCard>
      )}

      {/* EXPORT */}
      <TerminalCard title="EXPORT" accent="amber">
        <p className="text-xs text-content-dim mb-3">
          Structured JSON package with claim, all sources (with content hashes), and the verdict snapshot. Copy to clipboard.
        </p>
        <button onClick={handleExport} className="px-4 py-2 text-xs border border-border-dim text-content-secondary hover:border-blood">
          [ COPY VERDICT JSON ]
        </button>
      </TerminalCard>
    </div>
  );
}
