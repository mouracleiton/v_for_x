"use client";

import { useState, useEffect, useCallback } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import {
  getErrataChain,
  addErrataEntry,
  encodeErrataToken,
  decodeErrataToken,
  type ErrataChain,
  type ErrataEntry,
  type ErrataType,
} from "@/lib/registry-safety";

const ERRATA_TYPES: ErrataType[] = [
  "correction",
  "clarification",
  "update",
  "dispute",
  "retraction",
];

const TYPE_ACCENT: Record<ErrataType, "blood" | "amber" | "green" | "dim"> = {
  correction: "blood",
  retraction: "blood",
  dispute: "amber",
  clarification: "amber",
  update: "green",
};

function fallbackCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

interface Props {
  dossierId: string;
}

/**
 * V FOR X — Errata & Corrections chain (VFXERR1) on a real dossier.
 *
 * Anyone reading a dossier can amend it: file a correction, clarification,
 * update, dispute, or retraction. The chain is hash-chained by sequence,
 * exportable as a VFXERR1: token, and importable from a peer. The
 * authoritative backbone stays read-only; this is the review layer.
 */
export default function ErrataChainCard({ dossierId }: Props) {
  const [chain, setChain] = useState<ErrataChain | null>(null);
  const [type, setType] = useState<ErrataType>("correction");
  const [original, setOriginal] = useState("");
  const [corrected, setCorrected] = useState("");
  const [reason, setReason] = useState("");
  const [issuer, setIssuer] = useState("anonymous");
  const [importToken, setImportToken] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setChain(getErrataChain(dossierId));
  }, [dossierId]);

  const refresh = useCallback(() => {
    setChain(getErrataChain(dossierId));
  }, [dossierId]);

  const handleAdd = useCallback(() => {
    if (!original.trim() || !corrected.trim() || !reason.trim()) {
      setStatusMsg("// FILL ORIGINAL + CORRECTED + REASON");
      sound.error();
      return;
    }
    const entry = addErrataEntry(
      dossierId,
      type,
      original.trim(),
      corrected.trim(),
      reason.trim(),
      issuer.trim() || "anonymous",
    );
    refresh();
    setOriginal("");
    setCorrected("");
    setReason("");
    setStatusMsg(`+ ERRATA ${entry.type.toUpperCase()} (${entry.id.slice(0, 8)}…) ADDED TO CHAIN`);
    sound.success();
  }, [dossierId, type, original, corrected, reason, issuer, refresh]);

  const handleExport = useCallback(() => {
    const c = getErrataChain(dossierId);
    if (!c || c.entries.length === 0) {
      setStatusMsg("// NO ENTRIES — FILE ONE FIRST");
      sound.error();
      return;
    }
    const token = encodeErrataToken(c);
    const finish = () => {
      const blob = new Blob([token], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vfx-errata-${dossierId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMsg(`EXPORTED VFXERR1: (${c.entries.length} ENTRIES) — TOKEN COPIED + FILE DOWNLOADED`);
      sound.copy();
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(token).then(finish).catch(() => {});
      return;
    }
    if (fallbackCopy(token)) finish();
  }, [dossierId]);

  const handleImport = useCallback(() => {
    const token = importToken.trim();
    if (!token) return;
    const incoming = decodeErrataToken(token);
    if (!incoming) {
      setStatusMsg("// MALFORMED VFXERR1: TOKEN");
      sound.error();
      return;
    }
    if (incoming.dossierId !== dossierId) {
      setStatusMsg(
        `// DOSSIER MISMATCH — TOKEN IS FOR ${incoming.dossierId}, NOT ${dossierId}`,
      );
      sound.error();
      return;
    }
    const existing = getErrataChain(dossierId);
    const seen = new Set((existing?.entries ?? []).map((e) => `${e.type}|${e.timestamp}|${e.originalContent}`));
    const fresh = incoming.entries.filter(
      (e) => !seen.has(`${e.type}|${e.timestamp}|${e.originalContent}`),
    );
    if (fresh.length === 0) {
      setStatusMsg("// NO NEW ENTRIES — ALREADY IN CHAIN");
      sound.select();
      return;
    }
    const merged: ErrataChain = {
      dossierId,
      entries: [...(existing?.entries ?? []), ...fresh],
      createdAt: existing?.createdAt ?? Date.now(),
      lastUpdated: Date.now(),
    };
    try {
      localStorage.setItem(`vfx_errata_chains_${dossierId}`, JSON.stringify(merged));
    } catch {
      /* ignore */
    }
    refresh();
    setImportToken("");
    setStatusMsg(`+${fresh.length} ENTRY/ENTRIES IMPORTED + MERGED`);
    sound.success();
  }, [dossierId, importToken, refresh]);

  const entries: ErrataEntry[] = chain?.entries ?? [];

  return (
    <TerminalCard title="ERRATA & CORRECTIONS" accent="amber" className="mb-6">
      <div className="flex flex-wrap items-center gap-3 mb-3 text-[10px] font-mono">
        <StatusPill color={entries.length > 0 ? "amber" : "dim"}>
          {entries.length} ENTRIES
        </StatusPill>
        <span className="text-content-dim">
          VFXERR1 · {dossierId}
        </span>
      </div>

      <p className="text-[10px] text-content-dim mb-3 italic">
        File a correction, clarification, dispute, update, or retraction. The
        authoritative dossier stays read-only; this is the signed review layer.
      </p>

      {entries.length > 0 && (
        <div className="space-y-2 mb-4">
          {entries.map((e) => (
            <div
              key={e.id}
              className="p-2 terminal-card text-[11px]"
            >
              <div className="flex items-center gap-2 mb-1">
                <StatusPill color={TYPE_ACCENT[e.type]}>{e.type.toUpperCase()}</StatusPill>
                <span className="text-content-dim">
                  {new Date(e.timestamp).toLocaleString()} · {e.issuer}
                </span>
              </div>
              <div className="text-content-primary">
                <span className="text-content-dim">original:</span>{" "}
                <span className="line-through">{e.originalContent}</span>
              </div>
              <div className="text-terminal-green">
                <span className="text-content-dim">corrected:</span> {e.correctedContent}
              </div>
              <div className="text-content-secondary mt-1">
                <span className="text-content-dim">reason:</span> {e.reason}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 p-3 terminal-card">
        <div className="text-[10px] text-content-dim uppercase">+ File new entry</div>
        <div className="flex flex-wrap gap-2">
          {ERRATA_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`text-[10px] px-2 py-1 terminal-card uppercase ${
                type === t ? "border-blood-bright text-blood-bright" : "text-content-dim"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="ORIGINAL CONTENT (verbatim quote from dossier)"
          value={original}
          onChange={(e) => setOriginal(e.target.value)}
          className="w-full bg-void border border-border-dim px-2 py-1 text-[11px] text-content-primary"
        />
        <input
          type="text"
          placeholder="CORRECTED CONTENT"
          value={corrected}
          onChange={(e) => setCorrected(e.target.value)}
          className="w-full bg-void border border-border-dim px-2 py-1 text-[11px] text-content-primary"
        />
        <input
          type="text"
          placeholder="REASON / SOURCE"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full bg-void border border-border-dim px-2 py-1 text-[11px] text-content-primary"
        />
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="ISSUER HANDLE"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            className="flex-1 bg-void border border-border-dim px-2 py-1 text-[11px] text-content-primary"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="text-[10px] px-3 py-1 bg-blood text-void font-bold uppercase hover:bg-blood-bright"
          >
            + FILE
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          onClick={handleExport}
          className="text-[10px] px-2 py-1 terminal-card text-blood-bright hover:border-blood-bright"
        >
          ↓ EXPORT VFXERR1:
        </button>
        <input
          type="text"
          placeholder="PASTE VFXERR1: TOKEN…"
          value={importToken}
          onChange={(e) => setImportToken(e.target.value)}
          className="flex-1 min-w-[200px] bg-void border border-border-dim px-2 py-1 text-[11px] text-content-primary"
        />
        <button
          type="button"
          onClick={handleImport}
          className="text-[10px] px-2 py-1 terminal-card text-terminal-green hover:border-terminal-green"
        >
          ↑ IMPORT
        </button>
      </div>

      {statusMsg && (
        <div className="mt-3 text-[10px] font-mono text-terminal-green">
          {statusMsg}
        </div>
      )}
    </TerminalCard>
  );
}
