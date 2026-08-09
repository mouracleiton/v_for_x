"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/stores/useStore";
import { tc } from "@/lib/i18n-content";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import type { WorldBackbone } from "@/lib/types";
import {
  ledgerGetAll,
  ledgerAdd,
  ledgerUpdate,
  ledgerDelete,
  ledgerClear,
  signData,
  downloadJSON,
  type LedgerEntry,
} from "@/lib/idb";
import {
  createDagEntry,
  verifyChain,
  getLastHash,
  shortHash,
  type DagEntry,
  type ChainVerification,
} from "@/lib/dag";

const data = backbone as WorldBackbone;

export default function TrilhaPage() {
  const { lang } = useStore();
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [identity, setIdentity] = useState<string | null>(null);

  // New entry form
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [status, setStatus] = useState<LedgerEntry["status"]>("PENDING");

  const [needsMatch, setNeedsMatch] = useState<{ type: string; location: string }[]>([]);
  const [havesMatch, setHavesMatch] = useState<{ type: string; location: string }[]>([]);
  const [chainVerification, setChainVerification] = useState<ChainVerification | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [showHashes, setShowHashes] = useState(false);

  const loadLedger = useCallback(async () => {
    try {
      const entries = await ledgerGetAll();
      setLedger(entries);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLedger();
    // Load identity handle if exists
    try {
      const stored = localStorage.getItem("vfx-identity");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.handle) setIdentity(parsed.handle);
      }
    } catch { /* ignore */ }
  }, [loadLedger]);

  const addEntry = async () => {
    if (!source.trim() || !destination.trim() || !amount.trim()) return;
    // Build hash-chained DAG entry
    const existing = ledger.map((e) => {
      const raw = e as unknown as Record<string, unknown>;
      return {
        hash: (raw.hash as string) ?? "",
        prevHash: (raw.prevHash as string) ?? "",
        ts: e.ts, source: e.source, destination: e.destination,
        amount: e.amount, purpose: e.purpose, status: e.status,
        signerHandle: e.signerHandle,
      };
    }) as DagEntry[];
    // Sort by timestamp to get chronological order
    existing.sort((a, b) => a.ts - b.ts);
    const prevHash = getLastHash(existing);
    const dagEntry = await createDagEntry({
      ts: Date.now(),
      source: source.trim(),
      destination: destination.trim(),
      amount: amount.trim(),
      purpose: purpose.trim() || "—",
      status,
      signerHandle: identity || undefined,
    }, prevHash);
    await ledgerAdd(dagEntry as unknown as LedgerEntry);
    setChainVerification(null); // invalidate previous verification
    sound.success();
    setSource("");
    setDestination("");
    setAmount("");
    setPurpose("");
    setStatus("PENDING");
    loadLedger();
  };

  const cycleStatus = async (id: number, current: string) => {
    const next = current === "PENDING" ? "IN_TRANSIT" : current === "IN_TRANSIT" ? "VERIFIED" : "PENDING";
    await ledgerUpdate(id, { status: next as LedgerEntry["status"] });
    sound.select();
    loadLedger();
  };

  const removeEntry = async (id: number) => {
    await ledgerDelete(id);
    sound.error();
    loadLedger();
  };

  const clearAll = async () => {
    await ledgerClear();
    sound.error();
    loadLedger();
  };

  const verifyLedgerChain = async () => {
    setVerifying(true);
    try {
      const entries = ledger.map((e) => {
        const raw = e as unknown as Record<string, unknown>;
        return {
          hash: (raw.hash as string) ?? "",
          prevHash: (raw.prevHash as string) ?? "",
          ts: e.ts, source: e.source, destination: e.destination,
          amount: e.amount, purpose: e.purpose, status: e.status,
          signerHandle: e.signerHandle,
        };
      }) as DagEntry[];
      entries.sort((a, b) => a.ts - b.ts);
      const result = await verifyChain(entries);
      setChainVerification(result);
      if (result.valid) sound.success(); else sound.error();
    } catch {
      setChainVerification({ valid: false, brokenAt: null, totalEntries: 0, brokenHash: null, message: "Verification failed" });
      sound.error();
    }
    setVerifying(false);
  };

  const signAndExport = async () => {
    const exportData = {
      type: "vfx-ledger",
      version: 1,
      exportedAt: new Date().toISOString(),
      identity: identity || "anonymous",
      entries: ledger,
    };
    const sig = await signData(exportData);
    const finalData = { ...exportData, signature: sig?.signature ?? null, signedBy: sig?.handle ?? null };
    downloadJSON(finalData, `vfx-ledger-${Date.now()}.json`);
    sound.success();
  };

  const broadcastNeed = () => {
    if (!source.trim()) return;
    setNeedsMatch((prev) => [...prev, { type: source, location: destination || "—" }]);
    sound.success();
  };

  const offerResource = () => {
    if (!source.trim()) return;
    setHavesMatch((prev) => [...prev, { type: source, location: destination || "—" }]);
    sound.success();
  };

  const topHotspots = data.hotspots.all.slice(0, 8);

  // Aggregate stats
  const totalVerified = ledger.filter((e) => e.status === "VERIFIED").length;
  const totalValue = ledger.reduce((sum, e) => {
    const match = e.amount.match(/[\d,.]+/);
    if (match) {
      const n = parseFloat(match[0].replace(/,/g, ""));
      if (!isNaN(n)) return sum + n;
    }
    return sum;
  }, 0);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">{tc(lang, "trail.section_label")}</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          {tc(lang, "trail.title")}
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          {tc(lang, "subtitle.the_trail")}
        </p>
      </div>

      {/* Ledger stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="terminal-card p-3 text-center">
          <div className="text-xs text-content-dim">{tc(lang, "trail.entries")}</div>
          <div className="text-xl font-bold text-content-primary">{loading ? "—" : ledger.length}</div>
        </div>
        <div className="terminal-card p-3 text-center">
          <div className="text-xs text-content-dim">{tc(lang, "trail.verified")}</div>
          <div className="text-xl font-bold text-terminal-green">{totalVerified}</div>
        </div>
        <div className="terminal-card p-3 text-center">
          <div className="text-xs text-content-dim">{tc(lang, "trail.total_routed")}</div>
          <div className="text-xl font-bold text-blood-bright">${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
      </div>

      {/* Create entry */}
      <TerminalCard title={tc(lang, "card.create_ledger")} accent="green" className="mb-6">
        <p className="text-xs text-content-secondary mb-4">
          {tc(lang, "trail.create_desc")}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <input
            type="text"
            value={source}
            onChange={(e) => { setSource(e.target.value); sound.keystroke(); }}
            placeholder={tc(lang, "trail.source_ph")}
            className="bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
          />
          <input
            type="text"
            value={destination}
            onChange={(e) => { setDestination(e.target.value); sound.keystroke(); }}
            placeholder={tc(lang, "trail.destination_ph")}
            className="bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
          />
          <input
            type="text"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); sound.keystroke(); }}
            placeholder={tc(lang, "trail.amount_ph")}
            className="bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
          />
          <input
            type="text"
            value={purpose}
            onChange={(e) => { setPurpose(e.target.value); sound.keystroke(); }}
            placeholder={tc(lang, "trail.purpose_ph")}
            className="bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as LedgerEntry["status"])}
            className="bg-void border border-border-dim px-3 py-2 text-xs text-content-primary"
          >
            <option value="PENDING">{tc(lang, "trail.pending")}</option>
            <option value="IN_TRANSIT">{tc(lang, "trail.in_transit")}</option>
            <option value="VERIFIED">{tc(lang, "trail.verified")}</option>
          </select>
          <button
            onClick={addEntry}
            disabled={!source.trim() || !destination.trim() || !amount.trim()}
            className="px-4 py-2 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {tc(lang, "trail.add_to_ledger")}
          </button>
        </div>
      </TerminalCard>

      {/* Transparent ledger */}
      <TerminalCard title={tc(lang, "trail.transparent_ledger")} glow className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-content-secondary">
            {loading ? "Loading..." : `${ledger.length} entries stored locally`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={signAndExport}
              disabled={ledger.length === 0}
              className="text-xs px-3 py-1 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void disabled:opacity-30"
            >
              {tc(lang, "trail.sign_export")}
            </button>
            {ledger.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs px-3 py-1 border border-blood-dim text-content-secondary hover:border-blood hover:text-blood"
              >
                {tc(lang, "trail.clear_all")}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-blood-bright text-sm">
            <span className="cursor-blink">&gt; LOADING LEDGER...</span>
          </div>
        ) : ledger.length === 0 ? (
          <div className="py-8 text-center text-content-dim text-xs">
            {tc(lang, "trail.no_entries")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-dim text-content-dim">
                  <th className="text-left py-2 px-2">{tc(lang, "trail.th_timestamp")}</th>
                  <th className="text-left py-2 px-2 hidden sm:table-cell">{tc(lang, "trail.th_from")}</th>
                  <th className="text-left py-2 px-2">TO</th>
                  <th className="text-left py-2 px-2">{tc(lang, "trail.th_amount")}</th>
                  <th className="text-left py-2 px-2 hidden md:table-cell">{tc(lang, "trail.th_purpose")}</th>
                  <th className="text-left py-2 px-2">STATUS</th>
                  <th className="text-left py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((e) => (
                  <tr key={e.id} className="border-b border-border-dim hover:bg-panel">
                    <td className="py-1 px-2 text-content-dim font-mono whitespace-nowrap">
                      {new Date(e.ts).toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="py-1 px-2 text-content-secondary hidden sm:table-cell">
                      {e.source}
                      {e.signerHandle && <span className="text-content-dim text-[9px] ml-1">@{e.signerHandle}</span>}
                    </td>
                    <td className="py-1 px-2 text-blood-bright">{e.destination}</td>
                    <td className="py-1 px-2 text-content-primary font-bold">{e.amount}</td>
                    <td className="py-1 px-2 text-content-secondary hidden md:table-cell">{e.purpose}</td>
                    <td className="py-1 px-2">
                      <button
                        onClick={() => e.id && cycleStatus(e.id, e.status)}
                        className="text-xs cursor-pointer hover:underline"
                        style={{
                          color: e.status === "VERIFIED" ? "var(--color-terminal-green)" : e.status === "IN_TRANSIT" ? "var(--color-warning-amber)" : "var(--color-blood)",
                        }}
                      >
                        {e.status}
                      </button>
                    </td>
                    <td className="py-1 px-2">
                      <button
                        onClick={() => e.id && removeEntry(e.id)}
                        className="text-content-dim hover:text-blood text-xs"
                      >
                        [×]
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {ledger.length > 0 && (
          <div className="text-[10px] text-content-dim mt-3">
            {tc(lang, "trail.click_status_hint")}
          </div>
        )}
      </TerminalCard>

      {/* Chain verification panel */}
      {ledger.length > 0 && (
        <TerminalCard title={tc(lang, "card.chain_integrity")} accent="amber" className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={verifyLedgerChain}
              disabled={verifying}
              className="px-3 py-1.5 text-xs border border-blood text-blood-bright hover:bg-blood hover:text-void disabled:opacity-30"
            >
              {verifying ? "[ VERIFYING... ]" : "[ VERIFY CHAIN ]"}
            </button>
            <button
              onClick={() => setShowHashes(!showHashes)}
              className="text-xs px-3 py-1.5 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green"
            >
              {showHashes ? "[ HIDE HASHES ]" : "[ SHOW HASHES ]"}
            </button>
          </div>

          {chainVerification && (
            <div className={`p-2 border ${chainVerification.valid ? "border-terminal-green/40 bg-terminal-green/5" : "border-blood/40 bg-blood/5"}`}>
              <div className="flex items-center gap-2">
                <StatusPill color={chainVerification.valid ? "green" : "blood"}>
                  {chainVerification.valid ? "✓ CHAIN VALID" : "✗ CHAIN BROKEN"}
                </StatusPill>
                <span className="text-xs text-content-secondary">{chainVerification.message}</span>
              </div>
              {!chainVerification.valid && chainVerification.brokenAt !== null && (
                <div className="text-[10px] text-blood-bright mt-1">
                  Broken at entry index {chainVerification.brokenAt} — content was modified after hashing.
                </div>
              )}
            </div>
          )}

          {showHashes && ledger.length > 0 && (
            <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
              <div className="text-[9px] text-content-dim uppercase tracking-widest mb-1">
                HASH CHAIN ({ledger.length} entries, oldest → newest)
              </div>
              {ledger.slice().sort((a, b) => a.ts - b.ts).map((e, i) => {
                const raw = e as unknown as Record<string, unknown>;
                const hash = raw.hash as string | undefined;
                const prevHash = raw.prevHash as string | undefined;
                return (
                  <div key={e.id ?? i} className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="text-content-dim shrink-0">#{i}</span>
                    <span className="text-terminal-green shrink-0">{hash ? shortHash(hash) : "no-hash"}</span>
                    <span className="text-content-dim shrink-0">←</span>
                    <span className="text-content-dim shrink-0">{prevHash ? shortHash(prevHash) : "—"}</span>
                    <span className="text-content-dim ml-auto truncate">{e.source} → {e.destination}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-[10px] text-content-dim mt-3">
            ▸ Each entry's SHA-256 hash includes the previous entry's hash, forming a tamper-evident chain. Modify any past entry and the entire chain breaks. This is client-side only — for external verification, export the signed ledger JSON.
          </div>
        </TerminalCard>
      )}

      {/* Needs matching */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <TerminalCard title={tc(lang, "trail.i_need")} accent="blood">
          <div className="space-y-3">
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={tc(lang, "trail.need_ph")}
              className="w-full bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
            />
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder={tc(lang, "trail.location_ph")}
              className="w-full bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
            />
            <button
              onClick={broadcastNeed}
              disabled={!source.trim()}
              className="w-full px-3 py-2 text-xs border border-blood text-blood-bright hover:bg-blood hover:text-void disabled:opacity-30"
            >
              {tc(lang, "trail.broadcast_need")}
            </button>
            {needsMatch.length > 0 && (
              <div className="space-y-1 mt-2">
                {needsMatch.map((n, i) => (
                  <div key={i} className="text-[10px] p-1.5 border border-blood-dim bg-blood/5 flex justify-between">
                    <span className="text-blood-bright">▸ {n.type}</span>
                    <span className="text-content-dim">{n.location}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TerminalCard>

        <TerminalCard title={tc(lang, "trail.i_have")} accent="green">
          <div className="space-y-3">
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={tc(lang, "trail.offer_ph")}
              className="w-full bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
            />
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder={tc(lang, "trail.location_short_ph")}
              className="w-full bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
            />
            <button
              onClick={offerResource}
              disabled={!source.trim()}
              className="w-full px-3 py-2 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void disabled:opacity-30"
            >
              {tc(lang, "trail.offer_resource")}
            </button>
            {havesMatch.length > 0 && (
              <div className="space-y-1 mt-2">
                {havesMatch.map((n, i) => (
                  <div key={i} className="text-[10px] p-1.5 border border-terminal-green bg-terminal-green/5 flex justify-between">
                    <span className="text-terminal-green">▸ {n.type}</span>
                    <span className="text-content-dim">{n.location}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TerminalCard>
      </div>

      {/* Priority routing */}
      <TerminalCard title={tc(lang, "card.priority_routing")} accent="amber" className="mb-6">
        <p className="text-xs text-content-secondary mb-3">
          {tc(lang, "trail.priority_desc")}
        </p>
        <div className="space-y-2">
          {topHotspots.map((h) => {
            const country = data.countries.find((c) => c.iso3 === h.iso3);
            return (
              <Link
                key={h.iso3}
                href={`/sorrow-map/${h.iso3.toLowerCase()}/`}
                className="flex items-center justify-between p-2 terminal-card hover:border-blood block"
              >
                <div>
                  <span className="text-xs text-content-primary font-bold">
                    {country?.name_en || h.name_pt}
                  </span>
                  <span className="text-xs text-content-dim ml-2">
                    Score: {h.score} · Undernourishment:{" "}
                    {country?.hunger.undernourishment_pct
                      ? `${country.hunger.undernourishment_pct.toFixed(1)}%`
                      : "N/A"}
                  </span>
                </div>
                <span className="text-xs text-blood-bright">{tc(lang, "trail.route_here")}</span>
              </Link>
            );
          })}
        </div>
      </TerminalCard>

      {/* Financing integration */}
      <TerminalCard title={tc(lang, "trail.fund_solution")} className="mb-6">
        <Link href="/equation/" className="text-sm text-blood-bright hover:underline">
          {tc(lang, "trail.equation_link")}
        </Link>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
          {data.financing.allocation.slice(0, 6).map((a, i) => (
            <div key={i} className="text-xs p-2 terminal-card">
              <div className="text-content-dim">{a.name}</div>
              <div className="text-blood-bright font-bold">${a.billion_yr}B/yr</div>
            </div>
          ))}
        </div>
      </TerminalCard>
    </div>
  );
}
