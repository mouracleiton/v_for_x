"use client";

import { useState, useEffect, useMemo } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import {
  computeGlobalToll,
  computeRealTimeToll,
  formatNumber,
  formatTollSentence,
  createMemorialEntry,
  type TollBreakdown,
  type MemorialEntry,
} from "@/lib/lives";

const data = backbone as WorldBackbone;
const toll = computeGlobalToll(data);
const MEMORIAL_KEY = "vfx-memorial";

export default function TheLivesPage() {
  const [now, setNow] = useState(Date.now());
  const [startedAt] = useState(() => Date.now());
  const [memorials, setMemorials] = useState<MemorialEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [mName, setMName] = useState("");
  const [mCause, setMCause] = useState("hunger");
  const [mCountry, setMCountry] = useState("");
  const [mYear, setMYear] = useState(new Date().getFullYear());
  const [mMessage, setMMessage] = useState("");

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(MEMORIAL_KEY);
      if (stored) setMemorials(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(MEMORIAL_KEY, JSON.stringify(memorials));
  }, [memorials]);

  const realTime = useMemo(() => computeRealTimeToll(toll, startedAt, now), [now, startedAt]);
  const totalAnnual = toll.reduce((s, t) => s + t.annualDeaths, 0);

  const handleAddMemorial = () => {
    if (!mName) return;
    const entry = createMemorialEntry(mName, mCause, mCountry || "Unknown", mYear, mMessage);
    setMemorials((prev) => [entry, ...prev]);
    setMName(""); setMMessage(""); setShowForm(false);
    sound.success();
  };

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">🕯️ THE LIVES</h1>
      <p className="text-content-secondary text-sm mb-6">// they are not statistics. they are names, faces, stories.</p>

      {/* Real-time counter */}
      <TerminalCard title="THE CLOCK NEVER STOPS" accent="blood" glow>
        <div className="text-center py-6">
          <div className="text-6xl sm:text-7xl font-bold text-blood-bright font-mono tabular-nums">
            {realTime.sinceVisit.toLocaleString()}
          </div>
          <p className="text-sm text-content-secondary mt-2">lives lost to preventable causes since you opened this page</p>
          <div className="mt-4 text-xs text-content-dim">
            <span className="text-blood-bright font-bold">{realTime.perSecond}</span> per second ·
            <span className="text-blood-bright font-bold ml-2">{formatNumber(realTime.today)}</span> today ·
            <span className="text-blood-bright font-bold ml-2">{formatNumber(totalAnnual)}</span> per year
          </div>
        </div>
      </TerminalCard>

      {/* Breakdown by cause */}
      <div className="mt-4 space-y-3">
        {toll.map((t: TollBreakdown) => (
          <TerminalCard key={t.causeKey} title={t.cause.toUpperCase()} accent="blood">
            <div className="flex items-start gap-4">
              <span className="text-3xl">{t.icon}</span>
              <div className="flex-1">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-2xl font-bold text-blood-bright">{formatNumber(t.annualDeaths)}</span>
                  <span className="text-xs text-content-dim">per year</span>
                </div>
                <p className="text-sm text-content-secondary mb-2">{formatTollSentence(t)}</p>
                <div className="flex gap-4 text-xs text-content-dim">
                  <span>{formatNumber(t.perDay)}/day</span>
                  <span>{t.perHour}/hr</span>
                  <span>{t.perMinute}/min</span>
                </div>
                {t.preventionNote && (
                  <div className="mt-2 p-2 border border-terminal-green/20 bg-terminal-green/5">
                    <p className="text-xs text-terminal-green">
                      {t.preventionCostBillion ? `💰 Preventable for $${t.preventionCostBillion}B/year. ` : ""}
                      {t.preventionNote}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TerminalCard>
        ))}
      </div>

      {/* Memorial Wall */}
      <TerminalCard title="MEMORIAL WALL" accent="amber">
        <p className="text-sm text-content-secondary mb-4">
          Behind every number is a person. Add a name to the wall — a loved one, a stranger, or simply &quot;Unknown&quot; — so they are never just a statistic.
        </p>

        {memorials.length > 0 && (
          <div className="space-y-2 mb-4">
            {memorials.map((m) => (
              <div key={m.id} className="border-l-2 border-blood pl-3 py-1">
                <p className="text-sm text-content-primary font-bold">{m.name}</p>
                <p className="text-xs text-content-dim">{m.cause} · {m.country} · {m.year}</p>
                {m.message && <p className="text-xs text-content-secondary italic mt-1">&ldquo;{m.message}&rdquo;</p>}
              </div>
            ))}
          </div>
        )}

        {showForm ? (
          <div className="space-y-2">
            <input type="text" value={mName} onChange={(e) => setMName(e.target.value)} placeholder="Name (or 'Unknown')" className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary" />
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={mCause} onChange={(e) => setMCause(e.target.value)} placeholder="Cause (hunger, conflict...)" className="bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary" />
              <input type="text" value={mCountry} onChange={(e) => setMCountry(e.target.value)} placeholder="Country" className="bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary" />
            </div>
            <input type="number" value={mYear} onChange={(e) => setMYear(Number(e.target.value))} className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary" />
            <textarea value={mMessage} onChange={(e) => setMMessage(e.target.value)} placeholder="A message (optional)" rows={2} className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary" />
            <div className="flex gap-2">
              <button onClick={handleAddMemorial} disabled={!mName} className="px-4 py-2 text-xs font-bold bg-blood text-white disabled:opacity-30">[ ADD TO WALL ]</button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs border border-border-dim text-content-secondary">[ CANCEL ]</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowForm(true)} className="px-4 py-2 text-xs font-bold border border-blood text-blood-bright hover:bg-blood hover:text-white transition-colors">
            [ + ADD A NAME ]
          </button>
        )}
      </TerminalCard>
    </div>
  );
}
