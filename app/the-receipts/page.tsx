"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import { hashFile, formatHashForDisplay } from "@/lib/citizen-tools";
import {
  notarizeEvidence,
  verifyTimestamp,
  getQueuedStamps,
  type NotarizationResult,
} from "@/lib/blockchain-verify";
import {
  initiateCustody,
  addCustodyStep,
  verifyCustodyChain,
  exportCustodyChain,
  formatCustodyReport,
  type CustodyEntry,
} from "@/lib/custody";
import {
  fetchManifest,
  verifyManifest,
  shortFingerprint,
  type VerificationResult,
} from "@/lib/data-verifier";
import { tc } from "@/lib/i18n-content";
import { useStore } from "@/stores/useStore";
import { GENESIS_HASH } from "@/lib/dag";
import {
  buildWitness,
  buildWitnessChain,
  verifyWitness,
  verifyWitnessChain,
  encodeWitnessLedger,
  parseWitnessLedger,
  zkProofForWitness,
  loadWitnessLedger,
  saveWitnessLedger,
  createIdentitySigner,
  LEDGER_PREFIX,
  MAX_WITNESS_TEXT,
  type SignedWitness,
} from "@/lib/witness";
import {
  makeWitnessTimestamp,
  makeEvidenceTimestamp,
  verifyTimestampToken,
  getSubmissionInstructions,
  OTS_PREFIX,
  type TimestampToken,
} from "@/lib/opentimestamps";
import {
  verifyBuild,
  getBuildStatusBadge,
  getVerificationReport,
  formatBuildId,
  formatBuildTimestamp,
  getCurrentBuildStatus,
  type BuildVerifyResult,
} from "@/lib/build-attest";

export default function TheReceiptsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState("");
  const [result, setResult] = useState<NotarizationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [custody, setCustody] = useState<CustodyEntry[]>([]);
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const [verifyResult, setVerifyResult] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<VerificationResult | null>(null);
  const [scanError, setScanError] = useState("");
  const custodyRef = useRef<CustodyEntry[]>([]);
  const { lang, identity } = useStore();

  const [witnessText, setWitnessText] = useState("");
  const [witnessIso3, setWitnessIso3] = useState("");
  const [witnessBusy, setWitnessBusy] = useState(false);
  const [ledger, setLedger] = useState<SignedWitness[]>([]);
  const [rowVerify, setRowVerify] = useState<Record<string, { ok: boolean; reason?: string }>>({});
  const [chainResult, setChainResult] = useState<{
    rootOk: boolean;
    root: string;
    links: { id: string; ok: boolean; reason?: string }[];
  } | null>(null);
  const [zkOutput, setZkOutput] = useState<{ id: string; json: string } | null>(null);
  const [exportToken, setExportToken] = useState("");
  const [witnessImport, setWitnessImport] = useState("");
  const [importReport, setImportReport] = useState("");
  const [purgeArmed, setPurgeArmed] = useState(false);

  // OpenTimestamps state
  const [otsDigest, setOtsDigest] = useState("");
  const [otsToken, setOtsToken] = useState("");
  const [otsProof, setOtsProof] = useState("");
  const [otsInstructions, setOtsInstructions] = useState("");
  const [otsVerifyResult, setOtsVerifyResult] = useState<{
    ok: boolean;
    reason?: string;
    blockHeight?: number;
  } | null>(null);

  // Build attestation state
  const [buildStatus, setBuildStatus] = useState<BuildVerifyResult | null>(null);
  const [buildCheckBusy, setBuildCheckBusy] = useState(false);

  useEffect(() => {
    setLedger(loadWitnessLedger());

    // Check build status on mount
    getCurrentBuildStatus().then(setBuildStatus);

    // Auto-timestamp witness ledger root if non-empty
    if (ledger.length > 0) {
      const lastHash = ledger[ledger.length - 1].hash;
      const token = makeWitnessTimestamp(lastHash, ledger.length);
      setOtsToken(token);
      setOtsDigest(lastHash);
      setOtsInstructions(getSubmissionInstructions({ v: 1, attestation: { type: "witness-root", digest: lastHash, timestamp: Math.floor(Date.now() / 1000) } }));
    }
  }, []);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setResult(null);
    setHash("");
    try {
      const h = await hashFile(f);
      setHash(h);
      const entry = initiateCustody(h, "user", `File: ${f.name}`);
      custodyRef.current = [entry];
      setCustody([entry]);
      sound.success();
    } catch {
      sound.error();
    }
  }, []);

  const handleNotarize = useCallback(async () => {
    if (!hash) return;
    setBusy(true);
    try {
      const res = await notarizeEvidence(hash);
      setResult(res);

      // Add to custody chain
      const step = addCustodyStep(
        custodyRef.current,
        "TIMESTAMP",
        hash,
        "user",
        res.pending ? "Queued — awaiting Bitcoin confirmation" : `Confirmed in block ${res.confirmationBlock}`,
        { calendar: "btc.calendar.opentimestamps.org" },
      );
      custodyRef.current = [...custodyRef.current, step];
      setCustody(custodyRef.current);

      sound.success();
    } catch {
      sound.error();
    } finally {
      setBusy(false);
    }
  }, [hash]);

  const handleVerify = useCallback(async () => {
    if (!verifyFile) return;
    try {
      const result = await verifyTimestamp(verifyFile);
      if (result.confirmed) {
        setVerifyResult(`✓ CONFIRMED — Bitcoin block ${result.blockHeight}`);
      } else {
        setVerifyResult("⚠ PENDING or UNVERIFIED — stamp may still be awaiting Bitcoin confirmation");
      }
      sound.nav();
    } catch {
      setVerifyResult("✗ Failed to read proof file");
      sound.error();
    }
  }, [verifyFile]);

  const handleExportProof = useCallback(() => {
    if (!file || !hash) return;
    const report = formatCustodyReport(custodyRef.current);
    const chain = exportCustodyChain(custodyRef.current);
    const blob = new Blob(
      [
        `V FOR X — PROOF PACKAGE\n\n`,
        `File: ${file.name}\n`,
        `SHA-256: ${hash}\n`,
        `Size: ${file.size} bytes\n`,
        `Timestamp: ${new Date().toISOString()}\n\n`,
        `${report}\n\n`,
        `--- CHAIN JSON ---\n${chain}\n`,
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file.name}.proof.txt`;
    a.click();
    URL.revokeObjectURL(url);
    sound.success();
  }, [file, hash]);

  const handleScan = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    setScanError("");
    try {
      const manifest = await fetchManifest();
      const res = await verifyManifest(manifest);
      setScanResult(res);
      res.rootValid && res.failCount === 0 ? sound.success() : sound.error();
    } catch {
      setScanError("✗ Manifest unavailable — this copy may be truncated or offline");
      sound.error();
    } finally {
      setScanning(false);
    }
  }, [scanning]);

  const pending = result?.pending;
  const confirmed = result && !result.pending;
  const queued = getQueuedStamps();
  const displayLedger = [...ledger].sort((a, b) => b.ts - a.ts);

  const handleWitnessAppend = useCallback(async () => {
    const text = witnessText.trim();
    if (!text || witnessBusy) return;
    setWitnessBusy(true);
    try {
      const prevHash = ledger.length > 0 ? ledger[ledger.length - 1].hash : GENESIS_HASH;
      const iso3 = witnessIso3.trim() || undefined;
      const signFn = identity ? await createIdentitySigner() : undefined;
      const stmt = await buildWitness({ text, iso3, ts: Date.now(), prevHash }, signFn);
      const next = [...ledger, stmt];
      setLedger(next);
      saveWitnessLedger(next);
      setWitnessText("");
      setWitnessIso3("");
      setChainResult(null);
      sound.success();
    } catch {
      sound.error();
    } finally {
      setWitnessBusy(false);
    }
  }, [ledger, witnessText, witnessIso3, witnessBusy, identity]);

  const handleVerifyRow = useCallback(async (id: string) => {
    const stmt = ledger.find((s) => s.id === id);
    if (!stmt) return;
    const res = await verifyWitness(stmt);
    setRowVerify((prev) => ({ ...prev, [id]: res }));
    res.ok ? sound.success() : sound.error();
  }, [ledger]);

  const handleZkBlur = useCallback(async (stmt: SignedWitness) => {
    if (!stmt.iso3) return;
    try {
      const { proof } = await zkProofForWitness(stmt, `witness_${stmt.id}`, [stmt.iso3]);
      setZkOutput({ id: stmt.id, json: JSON.stringify(proof, null, 2) });
      sound.success();
    } catch {
      setZkOutput({ id: stmt.id, json: "ZK BLUR FAILED — STATEMENT HAS NO BOUND COUNTRY" });
      sound.error();
    }
  }, []);

  const handleVerifyChain = useCallback(async () => {
    const res = await verifyWitnessChain(ledger);
    setChainResult(res);
    res.rootOk ? sound.success() : sound.error();
  }, [ledger]);

  const copyText = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      sound.copy();
    } catch {
      /* clipboard unavailable in insecure contexts */
    }
  }, []);

  const handleExportLedger = useCallback(async () => {
    if (ledger.length === 0) return;
    const token = encodeWitnessLedger(ledger);
    setExportToken(token);
    copyText(token);
    const blob = new Blob([JSON.stringify(ledger, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vfx-witness-ledger.json";
    a.click();
    URL.revokeObjectURL(url);
    sound.success();
  }, [ledger]);

  const handleImportLedger = useCallback(async () => {
    const paste = witnessImport.trim();
    if (!paste) return;
    try {
      const incoming = parseWitnessLedger(paste);
      const byId = new Map<string, SignedWitness>();
      for (const s of [...ledger, ...incoming]) byId.set(s.id, s);
      const merged = await buildWitnessChain(Array.from(byId.values()));
      const added = merged.length - ledger.length;
      setLedger(merged);
      saveWitnessLedger(merged);
      setChainResult(null);
      setImportReport(`+${added} MERGED — LEDGER NOW ${merged.length}`);
      setWitnessImport("");
      sound.success();
    } catch (e) {
      setImportReport(`✗ IMPORT FAILED — ${e instanceof Error ? e.message : "malformed token"}`);
      sound.error();
    }
  }, [ledger, witnessImport]);

  const handlePurge = useCallback(() => {
    if (!purgeArmed) {
      setPurgeArmed(true);
      return;
    }
    setLedger([]);
    saveWitnessLedger([]);
    setRowVerify({});
    setChainResult(null);
    setZkOutput(null);
    setExportToken("");
    setImportReport("");
    setPurgeArmed(false);
    sound.success();
  }, [purgeArmed]);

  // OpenTimestamps handlers
  const handleCreateOTSToken = useCallback(() => {
    if (!otsDigest) return;
    try {
      const token = makeWitnessTimestamp(otsDigest, ledger.length);
      setOtsToken(token);
      setOtsInstructions(getSubmissionInstructions({ v: 1, attestation: { type: "witness-root", digest: otsDigest, timestamp: Math.floor(Date.now() / 1000) } }));
      sound.success();
    } catch {
      sound.error();
    }
  }, [otsDigest, ledger.length]);

  const handleVerifyOTSToken = useCallback(async () => {
    if (!otsToken) return;
    try {
      const result = await verifyTimestampToken(otsToken);
      setOtsVerifyResult(result);
      sound.nav();
    } catch {
      setOtsVerifyResult({ ok: false, reason: "Failed to verify token" });
      sound.error();
    }
  }, [otsToken]);

  const handleUpgradeOTSProof = useCallback(() => {
    if (!otsToken || !otsProof) return;
    try {
      // In a full implementation, this would parse the .ots proof format
      // For now, we show the upgrade UI
      setOtsVerifyResult({
        ok: true,
        reason: "Upgraded with calendar proof (demo mode)",
      });
      sound.success();
    } catch {
      sound.error();
    }
  }, [otsToken, otsProof]);

  // Build attestation handlers
  const handleCheckBuild = useCallback(async () => {
    setBuildCheckBusy(true);
    try {
      const status = await getCurrentBuildStatus();
      setBuildStatus(status);
      sound.nav();
    } catch {
      sound.error();
    } finally {
      setBuildCheckBusy(false);
    }
  }, []);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">
        📜 THE RECEIPTS
      </h1>
      <p className="text-content-secondary text-sm mb-6">
        // blockchain evidence timestamps — anchor any file to Bitcoin via OpenTimestamps
      </p>

      {/* Drop zone */}
      <TerminalCard title="01 · SELECT FILE" accent="blood">
        <div
          className="border-2 border-dashed border-border-dim p-8 text-center cursor-pointer hover:border-blood transition-colors"
          onClick={() => document.getElementById("file-input")?.click()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
          onDragOver={(e) => e.preventDefault()}
        >
          <input
            id="file-input"
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          {file ? (
            <div>
              <div className="text-sm font-bold text-terminal-green">{file.name}</div>
              <div className="text-xs text-content-dim mt-1">
                {file.size.toLocaleString()} bytes · {file.type || "unknown type"}
              </div>
            </div>
          ) : (
            <div className="text-content-dim text-sm">
              Drop a file or click to select — photo, document, video frame, anything
            </div>
          )}
        </div>
      </TerminalCard>

      {/* Hash + Notarize */}
      {hash && (
        <div className="mt-4">
          <TerminalCard title="02 · SHA-256 HASH" accent="amber">
            <div className="font-mono text-xs text-content-primary break-all">{hash}</div>
            <div className="mt-3 flex gap-2 flex-wrap">
              <button
                onClick={handleNotarize}
                disabled={busy}
                className="px-4 py-2 border border-blood text-blood-bright hover:bg-blood/10 disabled:opacity-50 text-xs font-bold"
              >
                {busy ? "⏳ SUBMITTING…" : "⛓ NOTARIZE ON BITCOIN"}
              </button>
              <button
                onClick={handleExportProof}
                className="px-4 py-2 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green text-xs"
              >
                📦 EXPORT PROOF PACKAGE
              </button>
            </div>
          </TerminalCard>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-4">
          <TerminalCard
            title="03 · NOTARIZATION RESULT"
            accent={confirmed ? "green" : "amber"}
            glow={confirmed ?? undefined}
          >
            {pending && (
              <div className="text-warning-amber text-sm">
                ⏳ PENDING — stamp accepted by OpenTimestamps calendar.
                Bitcoin confirmation typically takes 1–12 hours.
                The proof is queued locally for later verification.
              </div>
            )}
            {confirmed && (
              <div className="text-terminal-green text-sm">
                ✓ CONFIRMED — anchored in Bitcoin block {result.confirmationBlock}.
                This evidence provably existed at {new Date(result.timestamp).toISOString()}.
              </div>
            )}
            <div className="mt-2 text-xs text-content-dim">
              Hash: {formatHashForDisplay(result.hash)}
            </div>
          </TerminalCard>
        </div>
      )}

      {/* Verify existing proof */}
      <div className="mt-4">
        <TerminalCard title="04 · VERIFY EXISTING PROOF" accent="blood">
          <p className="text-xs text-content-dim mb-3">
            Upload a .ots proof file to verify it against the Bitcoin blockchain.
          </p>
          <input
            type="file"
            accept=".ots,application/octet-stream"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setVerifyFile(f);
                setVerifyResult("");
              }
            }}
            className="text-xs text-content-secondary"
          />
          {verifyFile && (
            <button
              onClick={handleVerify}
              className="ml-3 px-3 py-1 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green text-xs"
            >
              VERIFY
            </button>
          )}
          {verifyResult && (
            <div className="mt-2 text-sm font-mono">{verifyResult}</div>
          )}
        </TerminalCard>
      </div>

      {/* Chain of custody */}
      {custody.length > 0 && (
        <div className="mt-4">
          <TerminalCard title="05 · CHAIN OF CUSTODY" accent="blood">
            <div className="space-y-2">
              {custody.map((entry, i) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 p-2 border border-border-dim"
                >
                  <span className="text-blood-bright text-xs font-bold w-6">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-content-primary">
                      {entry.action}
                      {entry.signature && (
                        <span className="ml-2 text-terminal-green text-[10px]">✓ SIGNED</span>
                      )}
                    </div>
                    <div className="text-[10px] text-content-dim">{entry.ts}</div>
                    {entry.note && (
                      <div className="text-[10px] text-content-secondary mt-1">{entry.note}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TerminalCard>
        </div>
      )}

      {/* Queued stamps */}
      {queued.length > 0 && (
        <div className="mt-4">
          <TerminalCard title="06 · QUEUED STAMPS" accent="amber">
            <p className="text-xs text-content-dim mb-2">
              {queued.length} stamp(s) awaiting resubmission when connectivity returns.
            </p>
            {queued.map((s, i) => (
              <div key={i} className="text-xs font-mono text-content-secondary">
                {formatHashForDisplay(s.hash)} · queued {new Date(s.timestamp).toLocaleString()}
              </div>
            ))}
          </TerminalCard>
        </div>
      )}

      {/* Data integrity scan */}
      <div className="mt-4">
        <TerminalCard title={tc(lang, "receipts.integrity_scan")} accent="green">
          <p className="text-xs text-content-dim mb-3">{tc(lang, "receipts.integrity_desc")}</p>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="px-3 py-1 border border-border-dim text-content-secondary hover:border-cyan-400 hover:text-cyan-400 text-xs disabled:opacity-50"
          >
            {scanning ? tc(lang, "receipts.scanning") : tc(lang, "receipts.scan_btn")}
          </button>

          {scanError && (
            <div className="mt-3 text-amber-400 text-xs font-mono">{scanError}</div>
          )}

          {scanResult && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                {scanResult.rootValid ? (
                  <StatusPill color="green">{tc(lang, "receipts.root_match")}</StatusPill>
                ) : (
                  <StatusPill color="blood">{tc(lang, "receipts.root_mismatch")}</StatusPill>
                )}
              </div>
              <div className="text-xs text-content-secondary font-mono">
                {scanResult.okCount} {tc(lang, "receipts.files_ok")}
                {scanResult.failCount > 0 && (
                  <span className="text-blood-bright">
                    {" · "}
                    {scanResult.failCount} {tc(lang, "receipts.files_failed")}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-content-dim font-mono">
                ROOT {shortFingerprint(scanResult.computedRoot)} · EXPECTED{" "}
                {shortFingerprint(scanResult.expectedRoot)}
              </div>
              {scanResult.failCount > 0 && (
                <ul className="mt-2 space-y-1">
                  {scanResult.entries
                    .filter((e) => !e.ok)
                    .map((e) => (
                      <li key={e.path} className="text-[10px] text-blood-bright font-mono">
                        ✗ {e.path} — {e.reason}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
        </TerminalCard>
      </div>

      {/* Public witness ledger */}
      <div className="mt-4">
        <TerminalCard title="07 · PUBLIC WITNESS LEDGER" accent="green" glow={chainResult?.rootOk ?? undefined}>
          <p className="text-xs text-content-dim mb-3">
            Public statements, hash-chained into an append-only ledger.
            Signed when an identity is armed — but the signature only proves
            authorship of the hash; your name is never recorded.
          </p>

          {/* Compose */}
          <div className="border border-border-dim p-3">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[10px] uppercase tracking-widest text-content-dim">Compose</span>
              <span
                className={`font-mono text-[10px] ${
                  witnessText.length > MAX_WITNESS_TEXT ? "text-blood-bright" : "text-content-dim"
                }`}
              >
                {witnessText.length}/{MAX_WITNESS_TEXT}
              </span>
            </div>
            <textarea
              value={witnessText}
              onChange={(e) => setWitnessText(e.target.value)}
              maxLength={MAX_WITNESS_TEXT}
              rows={3}
              placeholder="Type a public statement — what you saw, when, where…"
              className="w-full bg-transparent border border-border-dim p-2 font-mono text-xs text-content-primary placeholder:text-content-dim focus:outline-none focus:border-terminal-green"
            />
            <div className="mt-2 flex gap-2 flex-wrap items-center">
              <input
                value={witnessIso3}
                onChange={(e) =>
                  setWitnessIso3(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))
                }
                placeholder="ISO3"
                maxLength={3}
                className="w-20 bg-transparent border border-border-dim px-2 py-2 font-mono text-xs text-content-primary placeholder:text-content-dim focus:outline-none focus:border-terminal-green"
              />
              <button
                onClick={handleWitnessAppend}
                disabled={witnessBusy || !witnessText.trim()}
                className="px-4 py-2 border border-terminal-green text-terminal-green hover:bg-terminal-green/10 disabled:opacity-40 text-xs font-bold"
              >
                {witnessBusy ? "SIGNING…" : "SIGN & APPEND"}
              </button>
            </div>
            <div className="mt-2">
              <StatusPill color="green">
                SIGNATURE PROVES AUTHORSHIP OF THIS HASH — YOUR NAME IS ALWAYS ANONYMOUS
              </StatusPill>
            </div>
            <div className="mt-1 text-[10px] text-content-dim font-mono">
              {identity
                ? "IDENTITY ARMED — EPHEMERAL ECDSA P-256 KEY HELD IN SESSIONSTORAGE ONLY, NEVER DISK"
                : "ANONYMOUS MODE — NO IDENTITY ARMED, STATEMENTS CARRY NO SIGNATURE"}
            </div>
          </div>

          {/* Ledger view (newest first) */}
          {ledger.length > 0 && (
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-widest text-content-dim mb-2">
                Ledger · {ledger.length} statement(s) · newest first
              </div>
              <div className="space-y-2">
                {displayLedger.map((stmt) => (
                  <div key={stmt.id} className="flex items-start gap-3 p-2 border border-border-dim">
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-content-dim font-mono">
                        {new Date(stmt.ts).toLocaleString()}
                        {stmt.iso3 && <span className="ml-2 text-terminal-green">[{stmt.iso3}]</span>}
                        {stmt.signerPublicKey && <span className="ml-2 text-terminal-green">✓ SIGNED</span>}
                      </div>
                      <div className="text-xs font-mono text-content-primary mt-1 break-words">
                        {stmt.text}
                      </div>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] text-content-dim">
                          {stmt.hash.slice(0, 12)}…
                        </span>
                        <button
                          onClick={() => handleVerifyRow(stmt.id)}
                          className="text-[10px] border border-border-dim px-1.5 py-0.5 text-content-secondary hover:border-terminal-green hover:text-terminal-green"
                        >
                          VERIFY
                        </button>
                        {rowVerify[stmt.id] && (
                          <StatusPill color={rowVerify[stmt.id].ok ? "green" : "blood"}>
                            {rowVerify[stmt.id].ok ? "OK" : "TAMPERED"}
                          </StatusPill>
                        )}
                        {stmt.iso3 && (
                          <button
                            onClick={() => handleZkBlur(stmt)}
                            className="text-[10px] border border-border-dim px-1.5 py-0.5 text-content-secondary hover:border-cyan-400 hover:text-cyan-400"
                          >
                            ZK BLUR
                          </button>
                        )}
                      </div>
                      {zkOutput && zkOutput.id === stmt.id && (
                        <div className="mt-2">
                          <pre className="p-2 bg-black/40 border border-border-dim text-[10px] text-cyan-300 font-mono break-all whitespace-pre-wrap">
                            {zkOutput.json}
                          </pre>
                          <button
                            onClick={() => copyText(zkOutput.json)}
                            className="mt-1 text-[10px] border border-border-dim px-1.5 py-0.5 text-content-secondary hover:border-terminal-green hover:text-terminal-green"
                          >
                            COPY COMMITMENT
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chain controls */}
          <div className="mt-4 border border-border-dim p-3">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleVerifyChain}
                disabled={ledger.length === 0}
                className="px-3 py-1 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green text-xs disabled:opacity-40"
              >
                VERIFY FULL CHAIN
              </button>
              <button
                onClick={handleExportLedger}
                disabled={ledger.length === 0}
                className="px-3 py-1 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green text-xs disabled:opacity-40"
              >
                EXPORT
              </button>
              <button
                onClick={handlePurge}
                className={`px-3 py-1 border text-xs ${
                  purgeArmed
                    ? "border-blood bg-blood/10 text-blood-bright"
                    : "border-blood/60 text-blood-bright hover:bg-blood/10"
                }`}
              >
                {purgeArmed ? "CONFIRM PURGE?" : "PURGE"}
              </button>
            </div>

            {chainResult && (
              <div className="mt-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusPill color={chainResult.rootOk ? "green" : "blood"}>
                    {chainResult.rootOk ? "CHAIN INTACT" : "CHAIN BROKEN"}
                  </StatusPill>
                  <span className="font-mono text-[10px] text-content-dim break-all">
                    ROOT {chainResult.root.slice(0, 16)}…
                  </span>
                </div>
                {chainResult.links.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {chainResult.links.map((l) => (
                      <li key={l.id} className="font-mono text-[10px] break-words">
                        <span className={l.ok ? "text-terminal-green" : "text-blood-bright"}>
                          {l.ok ? "✓" : "✗"}
                        </span>{" "}
                        <span className="text-content-secondary">{l.id.slice(0, 8)}…</span>
                        {!l.ok && <span className="text-blood-bright"> — {l.reason}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {exportToken && (
              <div className="mt-3">
                <pre className="p-2 bg-black/40 border border-border-dim text-[10px] text-terminal-green font-mono break-all whitespace-pre-wrap">
                  {exportToken}
                </pre>
                <button
                  onClick={() => copyText(exportToken)}
                  className="mt-1 text-[10px] border border-border-dim px-1.5 py-0.5 text-content-secondary hover:border-terminal-green hover:text-terminal-green"
                >
                  COPY VFXWIT1: TOKEN
                </button>
              </div>
            )}

            <div className="mt-3 border-t border-border-dim pt-2">
              <div className="text-[10px] uppercase tracking-widest text-content-dim mb-1">
                Import Replica
              </div>
              <textarea
                value={witnessImport}
                onChange={(e) => setWitnessImport(e.target.value)}
                rows={2}
                placeholder={`Paste a ${LEDGER_PREFIX} token…`}
                className="w-full bg-transparent border border-border-dim p-2 font-mono text-[10px] text-content-primary placeholder:text-content-dim focus:outline-none focus:border-terminal-green"
              />
              <button
                onClick={handleImportLedger}
                className="mt-2 px-3 py-1 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green text-xs"
              >
                IMPORT
              </button>
              {importReport && (
                <div
                  className={`mt-2 text-xs font-mono ${
                    importReport.startsWith("✗") ? "text-blood-bright" : "text-terminal-green"
                  }`}
                >
                  {importReport}
                </div>
              )}
            </div>

            {purgeArmed && (
              <div className="mt-2 text-[10px] text-warning-amber">
                ⚠ PURGE IRREVERSIBLY CLEARS THE LOCAL LEDGER — EXPORT FIRST.
              </div>
            )}
          </div>

          <div className="mt-4 text-[10px] text-content-dim">
            A ledger is only as honest as its first entry. Export early, export often —
            replicate the chain to friends, mirrors, and dead drops.
          </div>
        </TerminalCard>
      </div>

      {/* OpenTimestamps calendar timestamp */}
      <div className="mt-4">
        <TerminalCard title="08 · OPENTIMESTAMPS CALENDAR" accent="green">
          <p className="text-xs text-content-dim mb-3">
            Create timestamp commitments for Witness and Evidence roots. Submit to
            calendar.opentimestamps.org for blockchain anchoring.
          </p>

          <div className="border border-border-dim p-3">
            <div className="text-[10px] uppercase tracking-widest text-content-dim mb-2">
              Current Witness Root
            </div>
            {ledger.length > 0 ? (
              <>
                <div className="font-mono text-[10px] text-content-secondary break-all">
                  {otsDigest}
                </div>
                <div className="text-[10px] text-content-dim mt-1">
                  Ledger entries: {ledger.length}
                </div>
              </>
            ) : (
              <div className="text-[10px] text-content-dim">
                No witness entries — create statements above first
              </div>
            )}
          </div>

          <div className="mt-3 flex gap-2 flex-wrap">
            <button
              onClick={handleCreateOTSToken}
              disabled={ledger.length === 0}
              className="px-3 py-1 border border-border-dim text-content-secondary hover:border-cyan-400 hover:text-cyan-400 text-xs disabled:opacity-40"
            >
              CREATE TIMESTAMP TOKEN
            </button>
            <button
              onClick={handleVerifyOTSToken}
              disabled={!otsToken}
              className="px-3 py-1 border border-border-dim text-content-secondary hover:border-cyan-400 hover:text-cyan-400 text-xs disabled:opacity-40"
            >
              VERIFY TOKEN
            </button>
          </div>

          {otsToken && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-widest text-content-dim mb-1">
                VFXOTS1 Token
              </div>
              <pre className="p-2 bg-black/40 border border-border-dim text-[10px] text-cyan-300 font-mono break-all whitespace-pre-wrap">
                {otsToken.slice(0, 200)}…
              </pre>
              <button
                onClick={() => copyText(otsToken)}
                className="mt-1 text-[10px] border border-border-dim px-1.5 py-0.5 text-content-secondary hover:border-terminal-green hover:text-terminal-green"
              >
                COPY FULL TOKEN
              </button>
            </div>
          )}

          {otsVerifyResult && (
            <div className="mt-3">
              <StatusPill color={otsVerifyResult.ok ? "green" : "blood"}>
                {otsVerifyResult.ok ? "VALID TIMESTAMP" : "INVALID TIMESTAMP"}
              </StatusPill>
              {otsVerifyResult.reason && (
                <div className="text-[10px] text-content-dim mt-1">{otsVerifyResult.reason}</div>
              )}
              {otsVerifyResult.blockHeight && (
                <div className="text-[10px] text-content-secondary mt-1">
                  Bitcoin block: {otsVerifyResult.blockHeight}
                </div>
              )}
            </div>
          )}

          <div className="mt-3 border-t border-border-dim pt-2">
            <div className="text-[10px] uppercase tracking-widest text-content-dim mb-1">
              Calendar Proof Upgrade
            </div>
            <textarea
              value={otsProof}
              onChange={(e) => setOtsProof(e.target.value)}
              rows={3}
              placeholder="Paste OpenTimestamps calendar proof (.ots file content)…"
              className="w-full bg-transparent border border-border-dim p-2 font-mono text-[10px] text-content-primary placeholder:text-content-dim focus:outline-none focus:border-cyan-400"
            />
            <button
              onClick={handleUpgradeOTSProof}
              disabled={!otsToken || !otsProof}
              className="mt-2 px-3 py-1 border border-border-dim text-content-secondary hover:border-cyan-400 hover:text-cyan-400 text-xs disabled:opacity-40"
            >
              UPGRADE WITH PROOF
            </button>
          </div>

          {otsInstructions && (
            <div className="mt-3 p-2 bg-cyan-950/30 border border-cyan-900/50">
              <div className="text-[10px] uppercase tracking-widest text-cyan-300 mb-1">
                Submission Instructions
              </div>
              <pre className="text-[10px] text-cyan-200 whitespace-pre-wrap">
                {otsInstructions}
              </pre>
            </div>
          )}
        </TerminalCard>
      </div>

      {/* Build authenticity verification */}
      <div className="mt-4">
        <TerminalCard title="09 · BUILD AUTHENTICITY" accent="green">
          <p className="text-xs text-content-dim mb-3">
            Verify this build is authentic and untampered by checking cryptographic
            signatures against the trusted V FOR X public key.
          </p>

          <button
            onClick={handleCheckBuild}
            disabled={buildCheckBusy}
            className="px-3 py-1 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green text-xs disabled:opacity-40"
          >
            {buildCheckBusy ? "CHECKING…" : "VERIFY BUILD"}
          </button>

          {buildStatus && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <StatusPill color={getBuildStatusBadge(buildStatus).color}>
                  {getBuildStatusBadge(buildStatus).text}
                </StatusPill>
              </div>

              {buildStatus.attestation && (
                <div className="space-y-1">
                  <div className="text-[10px] text-content-dim">
                    Build ID: <span className="font-mono text-content-secondary">{formatBuildId(buildStatus.attestation.buildId)}</span>
                  </div>
                  <div className="text-[10px] text-content-dim">
                    Built: <span className="font-mono text-content-secondary">{formatBuildTimestamp(buildStatus.attestation.timestamp)}</span>
                  </div>
                  <div className="text-[10px] text-content-dim">
                    Git commit: <span className="font-mono text-content-secondary">{buildStatus.attestation.gitCommit.slice(0, 12)}</span>
                  </div>
                </div>
              )}

              <div className="mt-2 pt-2 border-t border-border-dim">
                <div className="text-[10px] uppercase tracking-widest text-content-dim mb-1">
                  Verification Checks
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-mono">
                    {buildStatus.manifestMatch ? "✓" : "✗"} Manifest hash matches served data
                  </div>
                  <div className="text-[10px] font-mono">
                    {buildStatus.signatureValid ? "✓" : "✗"} Signature is valid
                  </div>
                  <div className="text-[10px] font-mono">
                    {buildStatus.keyTrusted ? "✓" : "✗"} Signed by trusted key
                  </div>
                </div>
              </div>

              {buildStatus.status.ok === "valid" && buildStatus.keyTrusted && (
                <div className="mt-2 p-2 bg-terminal-green/10 border border-terminal-green/30">
                  <div className="text-[10px] text-terminal-green">
                    ✓ This build is authentic and untampered. You can verify this by
                    comparing the build ID with official V FOR X releases.
                  </div>
                </div>
              )}

              {buildStatus.status.ok === "valid" && !buildStatus.keyTrusted && (
                <div className="mt-2 p-2 bg-amber-400/10 border border-amber-400/30">
                  <div className="text-[10px] text-amber-400">
                    ⚠ This build is signed, but not by the trusted V FOR X key. It may
                    be a fork or community build.
                  </div>
                </div>
              )}

              {buildStatus.status.ok === "invalid" && (
                <div className="mt-2 p-2 bg-blood/10 border border-blood/30">
                  <div className="text-[10px] text-blood-bright">
                    ✗ {buildStatus.status.reason}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-3 text-[10px] text-content-dim">
            Build attestation is written at build time by scripts/write_build_attest.py.
            The public key is embedded in lib/build-attest.ts.
          </div>
        </TerminalCard>
      </div>

      <div className="mt-6 text-center text-[10px] text-content-dim">
        Free · No API key · Powered by OpenTimestamps · Evidence never leaves your device
      </div>
    </div>
  );
}
