"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import {
  createRule,
  evaluateAllRules,
  presetRules,
  METRIC_INFO,
  type WatchRule,
  type WatchMetric,
  type WatchOperator,
  type WatchResult,
} from "@/lib/watch";
import {
  runAlertCheck,
  requestNotificationPermission,
  notificationsEnabled,
  fireAlertNotifications,
  formatAlertSummary,
  type AlertCheckResult,
} from "@/lib/alert-engine";

const data = backbone as WorldBackbone;
const STORAGE_KEY = "vfx-watch";

export default function TheWatchPage() {
  const [rules, setRules] = useState<WatchRule[]>([]);
  const [results, setResults] = useState<WatchResult[]>([]);
  const [alertCheck, setAlertCheck] = useState<AlertCheckResult | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);

  // Form
  const [ruleName, setRuleName] = useState("");
  const [metric, setMetric] = useState<WatchMetric>("risk_score");
  const [operator, setOperator] = useState<WatchOperator>(">=");
  const [threshold, setThreshold] = useState(70);
  const [scope, setScope] = useState<string>("all");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRules(JSON.parse(stored));
      } else {
        // Load presets
        const presets = presetRules().map((p) => createRule(p.name, p.metric, p.operator, p.threshold, p.scope, p.countryName));
        setRules(presets);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (rules.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
      const evalResults = evaluateAllRules(rules, data);
      setResults(evalResults);
      const check = runAlertCheck(evalResults);
      setAlertCheck(check);
    }
  }, [rules]);

  useEffect(() => {
    setNotifEnabled(notificationsEnabled());
  }, []);

  const handleEnableNotifications = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setNotifEnabled(granted);
    if (granted && alertCheck) {
      fireAlertNotifications(alertCheck);
    }
    sound.success();
  }, [alertCheck]);

  const handleAddRule = useCallback(() => {
    if (!ruleName) return;
    const countryName = scope !== "all" ? data.countries.find((c) => c.iso3 === scope)?.name_en : undefined;
    const rule = createRule(ruleName, metric, operator, threshold, scope, countryName);
    setRules((prev) => [...prev, rule]);
    setRuleName("");
    sound.success();
  }, [ruleName, metric, operator, threshold, scope]);

  const handleDelete = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    sound.error();
  }, []);

  const info = METRIC_INFO[metric];
  const triggeredCount = results.filter((r) => r.triggered).length;

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">👁️ THE WATCH</h1>
      <p className="text-content-secondary text-sm mb-6">// threshold alert rules — monitor crisis data across 200 countries × 15 metrics</p>

      <TerminalCard title="WATCH STATUS" accent={triggeredCount > 0 ? "blood" : "green"} glow={triggeredCount > 0}>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div><div className="text-3xl font-bold text-blood-bright">{triggeredCount}</div><div className="text-xs text-content-dim">TRIGGERED</div></div>
          <div><div className="text-3xl font-bold text-content-primary">{rules.length - triggeredCount}</div><div className="text-xs text-content-dim">CLEAR</div></div>
          <div><div className="text-3xl font-bold text-content-primary">{rules.length}</div><div className="text-xs text-content-dim">TOTAL RULES</div></div>
        </div>
        {alertCheck && alertCheck.newCount > 0 && (
          <div className="mt-3 p-2 border border-blood-bright/50 bg-blood-bright/10 text-center">
            <span className="text-blood-bright text-xs font-bold">
              ⚠ {alertCheck.newCount} NEW ALERT{alertCheck.newCount > 1 ? "S" : ""} SINCE LAST VISIT
            </span>
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 justify-center">
          {notifEnabled ? (
            <span className="text-[10px] text-terminal-green">🔔 Notifications enabled — new alerts will fire on visit</span>
          ) : (
            <button
              onClick={handleEnableNotifications}
              className="text-[10px] px-3 py-1 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
            >
              Enable browser notifications for new alerts
            </button>
          )}
        </div>
      </TerminalCard>

      <div className="mt-4 space-y-4">
        {results.length > 0 && (
          <TerminalCard title="ALERT RESULTS" accent="amber">
            <div className="space-y-2">
              {results.map((r) => (
                <div key={r.rule.id} className={`p-3 border ${r.triggered ? "border-blood/50 bg-blood/5" : "border-border-dim bg-abyss"}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-sm font-bold" style={{ color: r.triggered ? "var(--color-blood-bright)" : "var(--color-content-secondary)" }}>
                        {r.triggered ? "🚨 " : "✓ "}{r.rule.name}
                      </span>
                      <p className="text-xs text-content-dim mt-1">{r.message}</p>
                    </div>
                    <button onClick={() => handleDelete(r.rule.id)} className="text-xs text-content-dim hover:text-blood-bright">✕</button>
                  </div>
                  {r.matchedCountries.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.matchedCountries.slice(0, 15).map((c) => (
                        <a key={c.iso3} href={`/sorrow-map/${c.iso3.toLowerCase()}/`} className="text-xs px-2 py-0.5 border border-border-dim hover:border-blood text-content-secondary">
                          {c.name} ({c.value})
                        </a>
                      ))}
                      {r.matchedCountries.length > 15 && <span className="text-xs text-content-dim">+{r.matchedCountries.length - 15} more</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TerminalCard>
        )}

        <TerminalCard title="ADD RULE" accent="green">
          <div className="space-y-3">
            <input type="text" value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="Rule name (e.g., 'Severe hunger alert')"
              className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <select value={metric} onChange={(e) => { setMetric(e.target.value as WatchMetric); const inf = METRIC_INFO[e.target.value as WatchMetric]; setThreshold(Math.round((inf.min + inf.max) / 2)); }}
                className="bg-abyss border border-border-dim px-2 py-1.5 text-xs text-content-primary">
                {Object.values(METRIC_INFO).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
              <select value={operator} onChange={(e) => setOperator(e.target.value as WatchOperator)} className="bg-abyss border border-border-dim px-2 py-1.5 text-xs text-content-primary">
                <option value="<">{"< less than"}</option>
                <option value="<=">{"<= at most"}</option>
                <option value=">">{"> greater than"}</option>
                <option value=">=">{">= at least"}</option>
              </select>
              <input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} min={info.min} max={info.max} step={info.max > 10 ? 1 : 0.1}
                className="bg-abyss border border-border-dim px-2 py-1.5 text-xs text-content-primary" />
              <select value={scope} onChange={(e) => setScope(e.target.value)} className="bg-abyss border border-border-dim px-2 py-1.5 text-xs text-content-primary">
                <option value="all">All countries</option>
                {data.countries.slice(0, 50).map((c) => <option key={c.iso3} value={c.iso3}>{c.name_en}</option>)}
              </select>
            </div>
            <p className="text-xs text-content-dim">{info.label} ({info.unit}) — {info.description}</p>
            <button onClick={handleAddRule} disabled={!ruleName} className="px-4 py-2 text-xs font-bold bg-blood text-white hover:bg-blood-bright disabled:opacity-30">[ ADD RULE ]</button>
          </div>
        </TerminalCard>
      </div>
    </div>
  );
}
