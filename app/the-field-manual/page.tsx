"use client";

import { useState, useCallback } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import {
  getManuals,
  getManual,
  generatePrintableHTML,
  SCENARIO_LABELS,
  DIFFICULTY_LABELS,
  type FieldManual,
} from "@/lib/field-manual";

export default function TheFieldManualPage() {
  const [selected, setSelected] = useState<FieldManual | null>(null);
  const manuals = getManuals();

  const handlePrint = useCallback((manual: FieldManual) => {
    const html = generatePrintableHTML(manual);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) {
      w.onload = () => { w.print(); };
    }
    sound.copy();
  }, []);

  if (selected) {
    return (
      <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
        <button onClick={() => { setSelected(null); sound.nav(); }} className="mb-4 text-xs text-content-secondary hover:text-blood-bright">← BACK TO ALL MANUALS</button>
        <h1 className="text-3xl text-blood-bright font-bold tracking-widest mb-2">{selected.icon} {selected.title}</h1>
        <p className="text-content-secondary text-sm mb-6">{selected.subtitle}</p>

        <div className="space-y-4">
          <TerminalCard title="SUMMARY" accent="amber">
            <p className="text-sm text-content-primary">{selected.summary}</p>
            <p className="text-xs text-content-dim mt-2">Difficulty: {DIFFICULTY_LABELS[selected.difficulty]}</p>
          </TerminalCard>

          {selected.phases.map((phase, i) => (
            <TerminalCard key={i} title={phase.name} accent={i === 0 ? "blood" : i === selected.phases.length - 1 ? "amber" : "green"} glow={i === 0}>
              <p className="text-xs text-content-dim mb-3">{phase.timeframe}</p>
              <ul className="space-y-2">
                {phase.actions.map((a, j) => (
                  <li key={j} className={`text-sm ${a.critical ? "font-bold text-blood-bright" : "text-content-primary"}`}>
                    {a.critical ? "⚠ " : "• "}{a.text}
                  </li>
                ))}
              </ul>
            </TerminalCard>
          ))}

          <TerminalCard title="KIT CHECKLIST" accent="green">
            <ul className="space-y-1">
              {selected.kitChecklist.map((item, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <input type="checkbox" className="mt-0.5" />
                  <span className={item.priority === "critical" ? "text-blood-bright font-bold" : "text-content-primary"}>
                    {item.item}
                    {item.quantity && <span className="text-content-dim"> ({item.quantity})</span>}
                  </span>
                  <span className={`text-xs ${item.priority === "critical" ? "text-blood" : item.priority === "recommended" ? "text-warning-amber" : "text-content-dim"}`}>[{item.priority}]</span>
                </li>
              ))}
            </ul>
          </TerminalCard>

          <TerminalCard title="EMERGENCY CONTACTS" accent="amber">
            <ul className="space-y-2">
              {selected.emergencyContacts.map((c, i) => (
                <li key={i} className="text-sm">
                  <span className="text-content-dim">{c.label}:</span> <span className="text-content-primary font-mono">{c.contact}</span>
                  {c.note && <p className="text-xs text-content-dim">{c.note}</p>}
                </li>
              ))}
            </ul>
          </TerminalCard>

          <TerminalCard title="⚠ WHAT NOT TO DO" accent="blood" glow>
            <ul className="space-y-1">
              {selected.warnings.map((w, i) => (
                <li key={i} className="text-sm text-blood-bright font-bold">✗ {w}</li>
              ))}
            </ul>
          </TerminalCard>

          <button onClick={() => handlePrint(selected)} className="px-4 py-3 text-sm font-bold border-2 border-blood text-blood-bright hover:bg-blood hover:text-white transition-colors w-full">
            [ 🖨 PRINT / EXPORT MANUAL ]
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">📖 THE FIELD MANUAL</h1>
      <p className="text-content-secondary text-sm mb-6">// scenario-specific survival guides — printable, offline-ready, stress-tested</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {manuals.map((m) => (
          <button key={m.id} onClick={() => { setSelected(m); sound.nav(); }}
            className="text-left p-4 border border-border-dim hover:border-blood transition-colors bg-abyss group">
            <div className="flex items-start gap-3">
              <span className="text-3xl">{m.icon}</span>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-blood-bright group-hover:text-blood-bright">{m.title}</h3>
                <p className="text-xs text-content-secondary mt-1">{m.subtitle}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-content-dim">{DIFFICULTY_LABELS[m.difficulty]}</span>
                  <span className="text-xs text-content-dim">·</span>
                  <span className="text-xs text-content-dim">{m.phases.length} phases</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
