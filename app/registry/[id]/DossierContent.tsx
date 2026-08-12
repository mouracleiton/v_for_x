"use client";

import { use, useEffect, useState, useCallback, type ChangeEvent, type DragEvent } from "react";
import Link from "next/link";
import dossiersData from "@/data/dossier-seed.json";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import DataBar from "@/components/ui/DataBar";
import { sound } from "@/lib/sound";
import { useStore } from "@/stores/useStore";
import { tc } from "@/lib/i18n-content";
import type { Lang } from "@/lib/i18n";
import { td } from "@/lib/dossiers-i18n";
import { fmtBytes } from "@/lib/forensics";
import {
  makeEvidenceRecord,
  recordItems,
  exportEvidenceBundle,
  parseEvidenceBundle,
  verifyEvidenceChain,
  rechainRecords,
  hashChainId,
  sealWithZK,
  type EvidenceItem,
  type EvidenceRecord,
  type EvidenceChainReport,
} from "@/lib/evidence-room";
import { verifySetMembership, type ZKCommitment } from "@/lib/zk";
import { GENESIS_HASH } from "@/lib/dag";
import BlindedReview from "./BlindedReview";
import ErrataChainCard from "./ErrataChainCard";

interface Dossier {
  id: string;
  subject: string;
  country_iso3: string;
  category: string;
  severity: string;
  status: string;
  accusation: string;
  evidence: { type: string; description: string; quality_score: number; source_url?: string }[];
  evidence_quality_score: number;
  peer_validations: number;
  required_validations: number;
  right_of_response: string;
  created_at: string;
  updated_at: string;
  version: number;
  country_data_ref: string;
  source_provenance?: {
    authority: string;
    authority_type: string;
    source_dataset?: string;
    source_url?: string;
    case_number?: string;
    opensanctions_id?: string;
    auto_populated?: boolean;
    fetched_at?: string;
  };
}

const dossiers = dossiersData as Dossier[];

const authorityLabel = (type: string | undefined, lang: Lang): string => {
  const keyMap: Record<string, string> = {
    icc_arrest_warrant: "auth.icc_arrest_warrant",
    icj_proceedings: "auth.icj_proceedings",
    un_investigation: "auth.un_investigation",
    un_sanctions: "auth.un_sanctions",
    sanctions: "auth.sanctions",
    community_submitted: "auth.community_submitted",
  };
  return tc(lang, keyMap[type ?? ""] ?? "auth.community_submitted");
};

const statusColor = (status: string): "blood" | "amber" | "green" | "dim" => {
  switch (status) {
    case "CONFIRMED":
    case "PEER_VALIDATED":
      return "green";
    case "UNDER_REVIEW":
      return "amber";
    default:
      return "dim";
  }
};

const ZK_CLAIMS = [
  "I HOLD PRIMARY SOURCE MATERIAL",
  "I WAS PRESENT AT THE EVENT",
  "I CORROBORATE THE CHAIN",
] as const;

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

/**
 * THE EVIDENCE ROOM — evidence-chain workbench for a dossier.
 * Drop files → sha256 → seal records into a hash chain → ZK seal →
 * export/import VFXEV1: bundles. 100% client-side; chain persists to
 * localStorage under `vfx-evidence-room-<dossierId>`.
 */
function EvidenceRoom({ dossier, claimTitle }: { dossier: Dossier; claimTitle: string }) {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [statusMsg, setStatusMsg] = useState("");
  const [verifyReport, setVerifyReport] = useState<EvidenceChainReport | null>(null);
  const [zkClaim, setZkClaim] = useState<string>(ZK_CLAIMS[0]);
  const [zkProof, setZkProof] = useState<ZKCommitment | null>(null);
  const [importToken, setImportToken] = useState("");

  const storageKey = `vfx-evidence-room-${dossier.id}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setRecords(parseEvidenceBundle(raw));
    } catch { /* ignore */ }
  }, [storageKey]);

  const persist = (next: EvidenceRecord[]) => {
    setRecords(next);
    try {
      localStorage.setItem(storageKey, exportEvidenceBundle(next));
    } catch { /* ignore */ }
  };

  const handleFiles = useCallback(async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    try {
      const buffers = await Promise.all(list.map((f) => f.arrayBuffer()));
      const next = await recordItems(
        buffers.map((b) => new Uint8Array(b)),
        list.map((f) => f.name),
        list.map((f) => f.type || "application/octet-stream"),
      );
      setItems((prev) => [...prev, ...next]);
      setStatusMsg(`+${next.length} FILE(S) HASHED (SHA-256) — READY TO SEAL`);
      sound.keystroke();
    } catch {
      setStatusMsg("// HASHING FAILED — WEB CRYPTO UNAVAILABLE");
      sound.error();
    }
  }, []);

  const handleSeal = useCallback(() => {
    if (items.length === 0) {
      setStatusMsg("// NO FILES HASHED — DROP EVIDENCE FIRST");
      sound.error();
      return;
    }
    const prevHash = records.length > 0 ? records[records.length - 1].hash : GENESIS_HASH;
    const rec = makeEvidenceRecord(
      { iso3: dossier.country_iso3, claim: claimTitle, subject: dossier.subject, items },
      prevHash,
    );
    persist([...records, rec]);
    setItems([]);
    setVerifyReport(null);
    setZkProof(null);
    setStatusMsg(`SEALED ${rec.id} — ${rec.hash.slice(0, 16)}… @ ${new Date(rec.sealedAt).toLocaleTimeString()}`);
    sound.success();
  }, [items, records, dossier, claimTitle]);

  const handleVerify = useCallback(() => {
    if (records.length === 0) {
      setStatusMsg("// CHAIN EMPTY — NOTHING TO VERIFY");
      sound.error();
      return;
    }
    const report = verifyEvidenceChain(records);
    setVerifyReport(report);
    setStatusMsg(
      report.rootOk
        ? `CHAIN INTACT — ${records.length} RECORD(S), ROOT OK`
        : `CHAIN COMPROMISED — ${report.links.filter((l) => !l.ok).length} BROKEN LINK(S)`,
    );
    if (report.rootOk) sound.success();
    else sound.error();
  }, [records]);

  const handleExport = useCallback(() => {
    if (records.length === 0) {
      setStatusMsg("// CHAIN EMPTY — NOTHING TO EXPORT");
      sound.error();
      return;
    }
    const token = exportEvidenceBundle(records);
    const finish = () => {
      const blob = new Blob([token], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vfx-evidence-${dossier.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMsg("BUNDLE EXPORTED — VFXEV1: TOKEN COPIED + FILE DOWNLOADED");
      sound.copy();
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(token).then(finish).catch(() => {});
      return;
    }
    if (fallbackCopy(token)) finish();
  }, [records, dossier.id]);

  const handleImport = useCallback(() => {
    const token = importToken.trim();
    if (!token) return;
    try {
      const incoming = parseEvidenceBundle(token);
      const report = verifyEvidenceChain(incoming);
      if (!report.rootOk) {
        setStatusMsg("// IMPORT REJECTED — BUNDLE CHAIN FAILS VERIFICATION");
        sound.error();
        return;
      }
      const seen = new Set(records.map((r) => r.id));
      const fresh = incoming.filter((r) => !seen.has(r.id));
      if (fresh.length === 0) {
        setStatusMsg("// NO NEW RECORDS — ALREADY IN CHAIN");
        sound.select();
        return;
      }
      const base = records.length > 0 ? records[records.length - 1].hash : GENESIS_HASH;
      persist([...records, ...rechainRecords(fresh, base)]);
      setImportToken("");
      setVerifyReport(null);
      setStatusMsg(`+${fresh.length} RECORD(S) IMPORTED + VERIFIED — RE-CHAINED`);
      sound.success();
    } catch (e) {
      setStatusMsg(`// ${e instanceof Error ? e.message : "MALFORMED BUNDLE"}`);
      sound.error();
    }
  }, [importToken, records]);

  const handleSignZk = useCallback(async () => {
    if (records.length === 0) {
      setStatusMsg("// NO SEALED RECORDS — SEAL ONE FIRST");
      sound.error();
      return;
    }
    const rec = records[records.length - 1];
    const validSet = records.map((r) => r.hash);
    try {
      const sealed = await sealWithZK(rec, zkClaim, validSet);
      persist(records.map((r) => (r.id === sealed.id ? sealed : r)));
      const ok = sealed.zk ? await verifySetMembership(sealed.zk, validSet) : false;
      setZkProof(sealed.zk ?? null);
      setStatusMsg(`ZK COMMITMENT SEALED ${ok ? "+ VERIFIED" : "+ UNVERIFIED"} — ${zkClaim}`);
      sound.success();
    } catch (e) {
      setStatusMsg(`// ${e instanceof Error ? e.message : "ZK SEAL FAILED"}`);
      sound.error();
    }
  }, [records, zkClaim]);

  return (
    <TerminalCard title="EVIDENCE ROOM" accent="amber" className="mb-6">
      <div className="flex flex-wrap items-center gap-3 mb-3 text-[10px] font-mono">
        <StatusPill color="dim">{records.length} SEALED</StatusPill>
        <StatusPill color="amber">{items.length} STAGED</StatusPill>
        {verifyReport && (
          <StatusPill color={verifyReport.rootOk ? "green" : "blood"}>
            {verifyReport.rootOk ? "ROOT OK" : "ROOT BROKEN"}
          </StatusPill>
        )}
        <span className="text-content-dim">{dossier.id} · {dossier.country_iso3}</span>
      </div>

      {/* File drop / pick */}
      <label
        onDragOver={(e: DragEvent<HTMLLabelElement>) => e.preventDefault()}
        onDrop={(e: DragEvent<HTMLLabelElement>) => {
          e.preventDefault();
          void handleFiles(e.dataTransfer.files);
        }}
        className="block border border-dashed border-border-dim bg-void p-4 text-center cursor-pointer hover:border-warning-amber transition-colors mb-3"
      >
        <input
          type="file"
          multiple
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <span className="text-[10px] text-content-dim uppercase tracking-widest">
          DROP EVIDENCE FILES — OR CLICK TO BROWSE
        </span>
      </label>

      {/* Staged items */}
      {items.length > 0 && (
        <div className="space-y-1 mb-3">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 text-[10px] font-mono">
              <StatusPill color="amber">MINTED</StatusPill>
              <span className="text-content-primary truncate flex-1">{it.name}</span>
              <span className="text-content-dim">{fmtBytes(it.size)}</span>
              <span className="text-content-dim">{it.sha256.slice(0, 12)}…</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={handleSeal}
          className="px-3 py-1.5 text-xs border border-blood text-blood-bright hover:bg-blood hover:text-void transition-colors"
        >
          SEAL RECORD
        </button>
        <button
          onClick={handleVerify}
          disabled={records.length === 0}
          className="px-3 py-1.5 text-xs border border-border-dim text-content-secondary hover:border-terminal-green disabled:opacity-30 transition-colors"
        >
          VERIFY CHAIN
        </button>
        <button
          onClick={handleExport}
          disabled={records.length === 0}
          className="px-3 py-1.5 text-xs border border-border-dim text-content-secondary hover:border-terminal-green disabled:opacity-30 transition-colors"
        >
          EXPORT BUNDLE
        </button>
      </div>

      {/* Sealed records */}
      {records.length > 0 && (
        <div className="space-y-2 mb-3">
          {records.map((r, i) => (
            <div key={r.id} className="border border-border-dim bg-void p-2">
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <StatusPill color="green">SEALED</StatusPill>
                <span className="text-content-primary truncate flex-1" title={`${r.id}\n${r.hash}`}>
                  {i + 1} · {r.id} · {r.hash.slice(0, 16)}…
                </span>
                {r.zk && <StatusPill color="amber">ZK</StatusPill>}
              </div>
              <div className="text-[10px] text-content-secondary mt-1 truncate">
                {r.claim} — {new Date(r.sealedAt).toLocaleString()}
              </div>
              <div className="text-[9px] text-content-dim font-mono mt-1 truncate">
                {r.items.map((it) => `${it.name} (${it.sha256.slice(0, 12)}…)`).join(" · ")}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Verify report */}
      {verifyReport && (
        <div className="border border-border-dim bg-void p-2 mb-3">
          <div className="flex flex-wrap items-center gap-2 mb-1 text-[10px] font-mono">
            <StatusPill color={verifyReport.rootOk ? "green" : "blood"}>
              {verifyReport.rootOk ? "ROOT OK" : "ROOT BROKEN"}
            </StatusPill>
            <span className="text-content-dim">Chain Root: {hashChainId(records).slice(0, 32)}…</span>
          </div>
          {verifyReport.links.map((l) => (
            <div key={l.id} className="flex items-center gap-2 text-[10px] font-mono py-0.5">
              <StatusPill color={l.ok ? "green" : "blood"}>{l.ok ? "LINK OK" : "BROKEN"}</StatusPill>
              <span className="text-content-primary">{l.id}</span>
              {!l.ok && <span className="text-content-dim truncate">{l.reason}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Import */}
      <div className="flex gap-2 mb-3">
        <input
          value={importToken}
          onChange={(e) => setImportToken(e.target.value)}
          placeholder="PASTE VFXEV1: BUNDLE TO VERIFY + MERGE"
          className="flex-1 bg-void border border-border-dim px-3 py-2 text-[10px] text-content-primary font-mono focus:border-warning-amber"
        />
        <button
          onClick={handleImport}
          disabled={!importToken.trim()}
          className="px-3 py-1.5 text-xs border border-border-dim text-content-secondary hover:border-warning-amber disabled:opacity-30 transition-colors"
        >
          IMPORT BUNDLE
        </button>
      </div>

      {/* ZK claim seal */}
      <div className="border border-border-dim bg-void p-2 mb-3">
        <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">ZK CLAIM SEAL</div>
        <div className="flex flex-wrap gap-2">
          <select
            value={zkClaim}
            onChange={(e) => { setZkClaim(e.target.value); sound.keystroke(); }}
            className="bg-void border border-border-dim px-2 py-1 text-[10px] text-content-primary"
          >
            {ZK_CLAIMS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={handleSignZk}
            disabled={records.length === 0}
            className="px-3 py-1.5 text-xs border border-warning-amber text-warning-amber hover:bg-warning-amber hover:text-void disabled:opacity-30 transition-colors"
          >
            SIGN WITH ZK CLAIM
          </button>
        </div>
        {zkProof && (
          <pre className="text-[9px] text-content-dim font-mono overflow-x-auto mt-2">
            {JSON.stringify(zkProof, null, 2)}
          </pre>
        )}
        <p className="text-[9px] text-content-dim mt-1">
          Fiat-Shamir commitment over the latest sealed hash — proves knowledge of one sealed record WITHOUT revealing which dossier.
        </p>
      </div>

      {statusMsg && <p className="text-[10px] text-terminal-green mt-2 font-mono">{statusMsg}</p>}
      <p className="text-[10px] text-content-dim italic mt-3">
        Evidence is self-attested: anyone can verify the chain, nobody vouches for the truth. The chain proves the record was not altered after sealing.
      </p>
      <p className="text-[10px] text-content-dim mt-1">
        Recorded for eternity: sealed chains await notarization on the Receipts DAG; for now they persist in this browser (localStorage) only — export the bundle to keep them.
      </p>
    </TerminalCard>
  );
}

export default function DossierContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { lang } = useStore();
  const d = dossiers.find((x) => x.id === id);

  if (!d) {
    return (
      <div className="p-3 sm:p-3 sm:p-6 md:p-10 max-w-3xl mx-auto text-center">
        <h1 className="text-2xl text-blood mb-4">{tc(lang, "card.dossier_not_found")}</h1>
        <Link href="/registry/" className="text-blood-bright hover:underline">
          ← Back to Registry
        </Link>
      </div>
    );
  }

  const di = td(d.id, lang);
  const validationPct = (d.peer_validations / (d.required_validations * 3)) * 100;

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/registry/" className="text-xs text-content-dim hover:text-blood">
          {tc(lang, "dossier.back_to_registry")}
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-content-dim">{d.id}</span>
          <StatusPill color={statusColor(d.status)}>
            {tc(lang, `dstat.${d.status.toLowerCase()}`)}
          </StatusPill>
          <StatusPill color={d.severity === "critical" ? "blood" : d.severity === "high" ? "amber" : "dim"}>
            {tc(lang, `dsev.${d.severity}`)}
          </StatusPill>
        </div>
        <h1 className="text-xl md:text-2xl text-blood-bright font-bold glow-blood">
          {di.subject}
        </h1>
        {d.source_provenance && (
          <div className="text-xs text-content-dim mt-2">
            <span className="text-content-secondary">{tc(lang, "dossier.source_prefix")} </span>
            <span className="text-blood-bright">{authorityLabel(d.source_provenance.authority_type, lang)}</span>
            {d.source_provenance.case_number && (
              <span> · Case: {d.source_provenance.case_number}</span>
            )}
            {d.source_provenance.authority && (
              <span> · {d.source_provenance.authority}</span>
            )}
          </div>
        )}
      </div>

      {/* Accusation */}
      <TerminalCard title={tc(lang, "card.accusation")} className="mb-6">
        <p className="text-sm text-content-primary">{di.accusation}</p>
        <div className="text-xs text-content-dim mt-3">
          {tc(lang, "dossier.category_label")} {tc(lang, `dcat.${d.category}`)} · {tc(lang, "dossier.country_label")}{" "}
          <Link
            href={`/sorrow-map/${d.country_iso3.toLowerCase()}/`}
            className="text-blood-bright hover:underline"
          >
            {d.country_iso3}
          </Link>
        </div>
      </TerminalCard>

      {/* Evidence chain */}
      <TerminalCard title={tc(lang, "card.evidence_chain")} className="mb-6">
        <div className="mb-3">
          <DataBar
            value={d.evidence_quality_score}
            max={12}
            label={tc(lang, "dossier.evidence_score")}
            unit="/12"
          />
        </div>
        <div className="space-y-2">
          {d.evidence.map((e, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-2 terminal-card"
            >
              <StatusPill
                color={
                  e.type === "primary"
                    ? "green"
                    : e.type === "secondary"
                      ? "amber"
                      : "dim"
                }
              >
                {tc(lang, `evtype.${e.type}`)}
              </StatusPill>
              <div className="flex-1">
                <p className="text-xs text-content-primary">{di.evidence[i] ?? e.description}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-content-dim">+{e.quality_score}{tc(lang, "dossier.pts")}</span>
                  {e.source_url && (
                    <a
                      href={e.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blood-bright hover:underline"
                    >
                      {tc(lang, "dossier.source_link")}
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </TerminalCard>

      {/* Tribunal status */}
      <TerminalCard title={tc(lang, "card.tribunal_peers")} accent="green" className="mb-6">
        <DataBar
          value={d.peer_validations}
          max={d.required_validations * 3}
          label={`${tc(lang, "dossier.validations_label")} ${d.peer_validations} / ${tc(lang, "dossier.required")} ${d.required_validations}`}
          unit=""
        />
        <div className="text-xs text-content-dim mt-2">
          {tc(lang, "dossier.progress_confirmed")} ({validationPct.toFixed(0)}% {tc(lang, "dossier.of_threshold")})
        </div>
      </TerminalCard>

      {/* Blinded peer review — commit/reveal corroboration */}
      <BlindedReview dossierId={d.id} lang={lang} />

      {/* Errata & corrections chain (VFXERR1) — signed review layer */}
      <ErrataChainCard dossierId={d.id} />

      {/* THE EVIDENCE ROOM — evidence-chain workbench */}
      <EvidenceRoom dossier={d} claimTitle={di.subject} />

      {/* Right of response */}
      <TerminalCard title={tc(lang, "card.right_of_response")} accent="amber" className="mb-6">
        <p className="text-xs text-content-secondary">{di.rightOfResponse}</p>
      </TerminalCard>

      {/* Country data reference */}
      <TerminalCard title={tc(lang, "card.country_data")} className="mb-6">
        <p className="text-xs text-content-primary">{di.countryDataRef}</p>
        <Link
          href={`/sorrow-map/${d.country_iso3.toLowerCase()}/`}
          className="text-xs text-blood-bright hover:underline mt-2 block"
        >
          {tc(lang, "dossier.view_country_data")}
        </Link>
      </TerminalCard>

      {/* Source provenance */}
      {d.source_provenance && (
        <TerminalCard title={tc(lang, "card.source_provenance")} accent="amber" className="mb-6">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-content-dim">{tc(lang, "dossier.designating_auth")}</span>
              <span className="text-content-primary font-bold">{d.source_provenance.authority}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-content-dim">{tc(lang, "dossier.auth_type")}</span>
              <span className="text-blood-bright">{authorityLabel(d.source_provenance.authority_type, lang)}</span>
            </div>
            {d.source_provenance.case_number && (
              <div className="flex justify-between">
                <span className="text-content-dim">{tc(lang, "dossier.case_number")}</span>
                <span className="text-content-primary font-mono">{d.source_provenance.case_number}</span>
              </div>
            )}
            {d.source_provenance.source_url && (
              <div className="flex justify-between">
                <span className="text-content-dim">{tc(lang, "dossier.source_url")}</span>
                <a
                  href={d.source_provenance.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blood-bright hover:underline"
                >
                  {tc(lang, "dossier.official_source")}
                </a>
              </div>
            )}
            {d.source_provenance.auto_populated && (
              <div className="flex justify-between">
                <span className="text-content-dim">{tc(lang, "dossier.pipeline")}</span>
                <span className="text-terminal-green">{tc(lang, "dossier.auto_populated")}</span>
              </div>
            )}
          </div>
          <div className="border-t border-border-dim mt-3 pt-3">
            <p className="text-[10px] text-content-dim italic">
              {tc(lang, "dossier.disclaimer")}
            </p>
          </div>
        </TerminalCard>
      )}

      {/* Accountability actions */}
      <TerminalCard title={tc(lang, "card.accountability_actions")} accent="blood" glow className="mb-6">
        <p className="text-xs text-content-secondary mb-4">
          {tc(lang, "dossier.actions_intro")}
        </p>
        <div className="space-y-3">
          {/* ICC referral */}
          <div className="border border-border-dim bg-void p-3">
            <div className="flex items-center gap-2 mb-2">
              <StatusPill color="blood">ICC</StatusPill>
              <span className="text-xs font-bold text-content-primary">{tc(lang, "dossier.icc_comm")}</span>
            </div>
            <p className="text-[10px] text-content-dim mb-2">
              {tc(lang, "dossier.icc_desc")}
            </p>
            <div className="flex gap-2">
              <a
                href="https://www.icc-cpi.int/get-involved/communications"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] px-2 py-1 border border-blood-dim text-blood-bright hover:bg-blood hover:text-void transition-colors"
              >
                {tc(lang, "dossier.icc_portal_btn")}
              </a>
              <button
                onClick={() => {
                  const text = `ICC COMMUNICATION — Article 15, Rome Statute\n\nSubject: ${di.subject}\nCategory: ${tc(lang, `dcat.${d.category}`)}\nCountry: ${d.country_iso3}\nDossier: ${d.id}\n\nAllegation:\n${di.accusation}\n\nEvidence:\n${d.evidence.map((e, i) => `${i + 1}. [${e.type}] ${di.evidence[i] ?? e.description} (${e.quality_score}${tc(lang, "dossier.pts")})`).join("\n")}\n\nEvidence quality score: ${d.evidence_quality_score}/12\nPeer validations: ${d.peer_validations}/${d.required_validations}\n\nCountry data reference: ${di.countryDataRef}\n\nSubmitted via V FOR X — data platform (CC0)`;
                  navigator.clipboard.writeText(text);
                  sound.copy();
                }}
                className="text-[10px] px-2 py-1 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors"
              >
                {tc(lang, "dossier.copy_icc_btn")}
              </button>
            </div>
          </div>

          {/* UN Special Rapporteur */}
          <div className="border border-border-dim bg-void p-3">
            <div className="flex items-center gap-2 mb-2">
              <StatusPill color="amber">UN</StatusPill>
              <span className="text-xs font-bold text-content-primary">{tc(lang, "dossier.un_rapporteur")}</span>
            </div>
            <p className="text-[10px] text-content-dim mb-2">
              {tc(lang, "dossier.un_rapporteur_desc")}
            </p>
            <div className="flex gap-2">
              <a
                href="https://www.ohchr.org/en/special-procedures/other-mandates"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] px-2 py-1 border border-blood-dim text-blood-bright hover:bg-blood hover:text-void transition-colors"
              >
                {tc(lang, "dossier.un_procedures_btn")}
              </a>
              <button
                onClick={() => {
                  const text = `UN SPECIAL RAPPORTEUR — INDIVIDUAL COMMUNICATION\n\nMandate: Right to Food / Summary Execution / Torture (as applicable)\n\nSubject: ${di.subject}\nCountry: ${d.country_iso3}\nCategory: ${tc(lang, `dcat.${d.category}`)}\n\nDescription of violation:\n${di.accusation}\n\nSupporting evidence:\n${d.evidence.map((e, i) => `- ${di.evidence[i] ?? e.description}`).join("\n")}\n\nThis case is documented in the V FOR X accountability registry (Dossier ${d.id}).\nData sources: ${d.source_provenance?.authority ?? "community-submitted"}`;
                  navigator.clipboard.writeText(text);
                  sound.copy();
                }}
                className="text-[10px] px-2 py-1 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors"
              >
                {tc(lang, "dossier.copy_un_btn")}
              </button>
            </div>
          </div>

          {/* Share / campaign */}
          <div className="border border-terminal-green bg-terminal-green/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <StatusPill color="green">PUBLIC</StatusPill>
              <span className="text-xs font-bold text-content-primary">{tc(lang, "dossier.share_campaign")}</span>
            </div>
            <p className="text-[10px] text-content-dim mb-2">
              {tc(lang, "dossier.public_desc")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/the-act/`}
                className="text-[10px] px-2 py-1 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void transition-colors"
              >
                {tc(lang, "dossier.campaign_generator_btn")}
              </Link>
              <button
                onClick={() => {
                  const url = typeof window !== "undefined" ? window.location.href : "";
                  navigator.clipboard.writeText(url);
                  sound.copy();
                }}
                className="text-[10px] px-2 py-1 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors"
              >
                {tc(lang, "dossier.copy_link_btn")}
              </button>
            </div>
          </div>
        </div>
        <div className="text-[10px] text-content-dim italic mt-3">
          {tc(lang, "dossier.footer_disclaimer")}
        </div>
      </TerminalCard>

      {/* Version history */}
      <TerminalCard title={tc(lang, "card.version_history")}>
        <div className="text-xs text-content-secondary space-y-1">
          <div>{tc(lang, "dossier.created")} {d.created_at}</div>
          <div>{tc(lang, "dossier.last_updated")} {d.updated_at}</div>
          <div>{tc(lang, "dossier.current_version")}{d.version}</div>
        </div>
      </TerminalCard>
    </div>
  );
}
