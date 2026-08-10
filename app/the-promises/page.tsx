"use client";

import { useState, useCallback, useEffect } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import {
  createPolitician,
  createPromise,
  updatePromiseStatus,
  computeTruthScore,
  rankPoliticians,
  STATUS_LABELS,
  STATUS_COLORS,
  LEVEL_LABELS,
  LEVEL_COLORS,
  CATEGORY_LABELS_PROMISES,
  IMPORTANCE_LABELS,
  type Politician,
  type Promise as Pledge,
  type PromiseStatus,
  type PromiseCategory,
  type PromiseImportance,
} from "@/lib/promises";

const STORAGE_KEY = "vfx-promises";

export default function ThePromisesPage() {
  const [politicians, setPoliticians] = useState<Politician[]>([]);
  const [promises, setPromises] = useState<Pledge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddPol, setShowAddPol] = useState(false);

  // Politician form
  const [pName, setPName] = useState("");
  const [pPosition, setPPosition] = useState("");
  const [pCountry, setPCountry] = useState("");

  // Promise form
  const [prText, setPrText] = useState("");
  const [prCategory, setPrCategory] = useState<PromiseCategory>("hunger");
  const [prImportance, setPrImportance] = useState<PromiseImportance>("major");
  const [prTarget, setPrTarget] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPoliticians(parsed.politicians || []);
        setPromises(parsed.promises || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ politicians, promises }));
  }, [politicians, promises]);

  const handleAddPol = useCallback(() => {
    if (!pName || !pPosition) return;
    const p = createPolitician(pName, pPosition, pCountry || "Unknown");
    setPoliticians((prev) => [...prev, p]);
    setPName(""); setPPosition(""); setPCountry("");
    setShowAddPol(false);
    sound.success();
  }, [pName, pPosition, pCountry]);

  const handleAddPromise = useCallback(() => {
    if (!selectedId || !prText) return;
    const p = createPromise(selectedId, prText, prCategory, prImportance, new Date().toISOString().slice(0, 10), prTarget || undefined);
    setPromises((prev) => [...prev, p]);
    setPrText(""); setPrTarget("");
    sound.success();
  }, [selectedId, prText, prCategory, prImportance, prTarget]);

  const handleUpdateStatus = useCallback((promiseId: string, status: PromiseStatus) => {
    setPromises((prev) => prev.map((p) => p.id === promiseId ? updatePromiseStatus(p, status) : p));
    sound.select();
  }, []);

  const ranked = rankPoliticians(politicians, promises);
  const selectedScore = selectedId ? computeTruthScore(selectedId, promises) : null;
  const selectedPromises = selectedId ? promises.filter((p) => p.politicianId === selectedId) : [];

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">📜 THE PROMISES</h1>
      <p className="text-content-secondary text-sm mb-6">// track politician pledges vs deliveries — who kept their word and who lied?</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Politician list */}
        <div className="lg:col-span-1">
          <TerminalCard title="POLITICIANS" accent="blood">
            <div className="space-y-2 mb-3 max-h-96 overflow-y-auto">
              {ranked.map((p) => {
                const score = computeTruthScore(p.id, promises);
                return (
                  <button key={p.id} onClick={() => { setSelectedId(p.id); sound.nav(); }}
                    className={`w-full text-left p-2 border transition-colors ${selectedId === p.id ? "border-blood bg-blood/10" : "border-border-dim hover:border-blood"}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-content-primary font-bold truncate">{p.name}</span>
                      {score.level !== "untested" && (
                        <span className="text-xs font-bold" style={{ color: LEVEL_COLORS[score.level] }}>{score.score}</span>
                      )}
                    </div>
                    <div className="text-xs text-content-dim">{p.position}</div>
                    {score.level !== "untested" && (
                      <div className="text-xs" style={{ color: LEVEL_COLORS[score.level] }}>{LEVEL_LABELS[score.level]}</div>
                    )}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setShowAddPol(!showAddPol)} className="w-full px-3 py-2 text-xs font-bold border border-border-dim text-content-secondary hover:border-blood">
              [ + ADD POLITICIAN ]
            </button>
            {showAddPol && (
              <div className="mt-3 space-y-2">
                <input type="text" value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Name" className="w-full bg-abyss border border-border-dim px-2 py-1.5 text-sm text-content-primary" />
                <input type="text" value={pPosition} onChange={(e) => setPPosition(e.target.value)} placeholder="Position" className="w-full bg-abyss border border-border-dim px-2 py-1.5 text-sm text-content-primary" />
                <input type="text" value={pCountry} onChange={(e) => setPCountry(e.target.value)} placeholder="Country" className="w-full bg-abyss border border-border-dim px-2 py-1.5 text-sm text-content-primary" />
                <button onClick={handleAddPol} className="w-full px-3 py-2 text-xs font-bold bg-blood text-white">[ SAVE ]</button>
              </div>
            )}
          </TerminalCard>
        </div>

        {/* Selected politician detail */}
        <div className="lg:col-span-2">
          {selectedId && selectedScore ? (
            <div className="space-y-4">
              <TerminalCard title="TRUTH SCORE" accent={selectedScore.score >= 50 ? "green" : "blood"}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-4xl font-bold" style={{ color: LEVEL_COLORS[selectedScore.level] }}>{selectedScore.score}</div>
                  <div className="text-right">
                    <div className="text-sm uppercase tracking-widest" style={{ color: LEVEL_COLORS[selectedScore.level] }}>{LEVEL_LABELS[selectedScore.level]}</div>
                    <div className="text-xs text-content-dim">{selectedScore.totalPromises} promises tracked</div>
                  </div>
                </div>
                <div className="h-3 bg-abyss border border-border-dim">
                  <div className="h-full transition-all" style={{ width: `${selectedScore.score}%`, backgroundColor: LEVEL_COLORS[selectedScore.level] }} />
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-3 text-center text-xs">
                  <div><div className="text-terminal-green font-bold">{selectedScore.fulfilled}</div><div className="text-content-dim">Fulfilled</div></div>
                  <div><div className="text-blood-bright font-bold">{selectedScore.broken}</div><div className="text-content-dim">Broken</div></div>
                  <div><div className="text-warning-amber font-bold">{selectedScore.inProgress}</div><div className="text-content-dim">In Progress</div></div>
                  <div><div className="text-content-dim font-bold">{selectedScore.pending}</div><div className="text-content-dim">Pending</div></div>
                  <div><div className="text-blood font-bold">{selectedScore.overdue}</div><div className="text-content-dim">Overdue</div></div>
                </div>
              </TerminalCard>

              <TerminalCard title="ADD PROMISE" accent="green">
                <div className="space-y-2">
                  <input type="text" value={prText} onChange={(e) => setPrText(e.target.value)} placeholder="What did they promise?" className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary" />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={prCategory} onChange={(e) => setPrCategory(e.target.value as PromiseCategory)} className="bg-abyss border border-border-dim px-2 py-1.5 text-sm text-content-primary">
                      {Object.entries(CATEGORY_LABELS_PROMISES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <select value={prImportance} onChange={(e) => setPrImportance(e.target.value as PromiseImportance)} className="bg-abyss border border-border-dim px-2 py-1.5 text-sm text-content-primary">
                      {Object.entries(IMPORTANCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <input type="date" value={prTarget} onChange={(e) => setPrTarget(e.target.value)} className="w-full bg-abyss border border-border-dim px-3 py-1.5 text-sm text-content-primary" />
                  <button onClick={handleAddPromise} disabled={!prText} className="w-full px-3 py-2 text-xs font-bold bg-blood text-white disabled:opacity-30">[ ADD PROMISE ]</button>
                </div>
              </TerminalCard>

              {selectedPromises.length > 0 && (
                <TerminalCard title="TRACKED PROMISES" accent="amber">
                  <div className="space-y-2">
                    {selectedPromises.map((p) => (
                      <div key={p.id} className="border border-border-dim p-3 bg-abyss">
                        <p className="text-sm text-content-primary">{p.text}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs" style={{ color: STATUS_COLORS[p.status] }}>● {STATUS_LABELS[p.status]}</span>
                          <span className="text-xs text-content-dim">{IMPORTANCE_LABELS[p.importance]} · {CATEGORY_LABELS_PROMISES[p.category]}</span>
                        </div>
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {(["fulfilled", "broken", "in_progress", "stalled", "pending"] as PromiseStatus[]).map((s) => (
                            <button key={s} onClick={() => handleUpdateStatus(p.id, s)}
                              className={`px-2 py-0.5 text-xs border transition-colors ${p.status === s ? "border-blood bg-blood/10" : "border-border-dim text-content-dim hover:border-blood"}`}
                              style={p.status === s ? { color: STATUS_COLORS[s] } : {}}>
                              {STATUS_LABELS[s]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </TerminalCard>
              )}
            </div>
          ) : (
            <TerminalCard title="SELECT A POLITICIAN" accent="amber">
              <p className="text-sm text-content-secondary">Select a politician from the list to view their truth score and tracked promises, or add a new politician to begin tracking.</p>
            </TerminalCard>
          )}
        </div>
      </div>
    </div>
  );
}
