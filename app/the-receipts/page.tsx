"use client";

import { useState, useCallback, useRef } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
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

export default function TheReceiptsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState("");
  const [result, setResult] = useState<NotarizationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [custody, setCustody] = useState<CustodyEntry[]>([]);
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const [verifyResult, setVerifyResult] = useState<string>("");
  const custodyRef = useRef<CustodyEntry[]>([]);

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

  const pending = result?.pending;
  const confirmed = result && !result.pending;
  const queued = getQueuedStamps();

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

      <div className="mt-6 text-center text-[10px] text-content-dim">
        Free · No API key · Powered by OpenTimestamps · Evidence never leaves your device
      </div>
    </div>
  );
}
