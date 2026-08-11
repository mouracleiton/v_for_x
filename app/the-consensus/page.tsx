"use client";

/**
 * V FOR X — The Consensus (mirror fork detection)
 *
 * Collects root hash attestations from multiple mirrors to detect forks.
 * When mirrors disagree on the root hash, it indicates potential censorship,
 * data manipulation, or network partition. The UI shows:
 *
 *   - Attestation collection from multiple sources
 *   - Real-time consensus analysis
 *   - Fork detection with severity assessment
 *   - Detailed breakdown of which mirrors agree vs disagree
 *
 * Fully static, no backend, local ECDSA verification only.
 */

import { useEffect, useMemo, useState } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import {
  decodeConsensusAttestation,
  verifyConsensusAttestation,
  analyzeConsensus,
  buildForkDetails,
  assessForkSeverity,
  encodeConsensusAttestation,
  generateConsensusReport,
  importAttestations,
  deduplicateAttestations,
  filterRecentAttestations,
  shortRootFingerprint,
  type ConsensusAttestation,
  type ConsensusAnalysis,
  type ForkDetail,
  type ForkAlert,
} from "@/lib/mirror-consensus";
import { detectToken } from "@/lib/tokens";

const STORAGE_KEY = "vfx-consensus-attestations";
const STORAGE_REPORT_KEY = "vfx-consensus-report";

export default function TheConsensusPage() {
  /* ── attestations state ── */
  const [attestations, setAttestations] = useState<ConsensusAttestation[]>([]);
  const [loaded, setLoaded] = useState(false);

  /* ── import form ── */
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  /* ── analysis results ── */
  const [analysis, setAnalysis] = useState<ConsensusAnalysis | null>(null);
  const [forks, setForks] = useState<ForkDetail[]>([]);
  const [alert, setAlert] = useState<ForkAlert | null>(null);

  /* ── UI state ── */
  const [selectedFork, setSelectedFork] = useState<ForkDetail | null>(null);

  /* ── load persisted attestations ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ConsensusAttestation[];
        setAttestations(parsed);
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  /* ── persist attestations ── */
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(attestations));
    } catch { /* ignore */ }
  }, [attestations, loaded]);

  /* ── analyze consensus whenever attestations change ── */
  useEffect(() => {
    if (!loaded || attestations.length === 0) {
      setAnalysis(null);
      setForks([]);
      setAlert(null);
      return;
    }

    const runAnalysis = async () => {
      try {
        const result = await analyzeConsensus(attestations);
        const forkDetails = buildForkDetails(result);
        const severity = assessForkSeverity(result);

        setAnalysis(result);
        setForks(forkDetails);
        setAlert(severity);

        // Auto-select first fork if any
        if (forkDetails.length > 0 && !selectedFork) {
          setSelectedFork(forkDetails[0]);
        }
      } catch (err) {
        console.error("Analysis failed:", err);
      }
    };

    runAnalysis();
  }, [attestations, loaded]);

  /* ── handle import ── */
  const handleImport = async () => {
    setImportError(null);
    setImportSuccess(null);

    if (!importText.trim()) {
      setImportError("Please paste attestations or reports");
      sound.error();
      return;
    }

    try {
      const lines = importText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const imported = await importAttestations(lines);

      if (imported.length === 0) {
        setImportError("No valid attestations found. Make sure to paste VFXCON1: tokens or consensus reports.");
        sound.error();
        return;
      }

      // Merge with existing, dedupe, filter old
      const merged = deduplicateAttestations([...attestations, ...imported]);
      const recent = filterRecentAttestations(merged, 7 * 24 * 60 * 60 * 1000); // 7 days

      setAttestations(recent);
      setImportText("");
      setImportSuccess(`Imported ${imported.length} attestation(s). Total: ${recent.length}`);
      sound.success();

      // Clear success message after delay
      setTimeout(() => setImportSuccess(null), 3000);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
      sound.error();
    }
  };

  /* ── clear all attestations ── */
  const handleClear = () => {
    if (confirm("Clear all attestations? This cannot be undone.")) {
      setAttestations([]);
      setAnalysis(null);
      setForks([]);
      setAlert(null);
      setSelectedFork(null);
      sound.success();
    }
  };

  /* ── share report ── */
  const handleShareReport = async () => {
    if (!analysis) return;

    try {
      const reportJson = await generateConsensusReport(attestations);
      await navigator.clipboard.writeText(reportJson);
      setImportSuccess("Report copied to clipboard!");
      setTimeout(() => setImportSuccess(null), 2000);
      sound.success();
    } catch (err) {
      console.error("Failed to generate report:", err);
      setImportError("Failed to copy report");
      sound.error();
    }
  };

  /* ── share attestation ── */
  const handleShareAttestation = async (att: ConsensusAttestation) => {
    try {
      const token = encodeConsensusAttestation(att);
      await navigator.clipboard.writeText(token);
      setImportSuccess("Attestation copied to clipboard!");
      setTimeout(() => setImportSuccess(null), 2000);
      sound.success();
    } catch (err) {
      console.error("Failed to copy attestation:", err);
      setImportError("Failed to copy attestation");
      sound.error();
    }
  };

  /* ── get alert level color ── */
  const getAlertLevelColor = (level: ForkAlert["level"]) => {
    switch (level) {
      case "none":
        return "bg-green-500";
      case "low":
        return "bg-yellow-500";
      case "medium":
        return "bg-orange-500";
      case "high":
        return "bg-red-500";
      case "severe":
        return "bg-red-700";
      default:
        return "bg-gray-500";
    }
  };

  /* ── empty state ── */
  if (loaded && attestations.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">The Consensus</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Mirror Fork Detection — Detect when mirrors disagree on data integrity
          </p>
        </div>

        <TerminalCard title="No Attestations Collected" className="mb-6">
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Collect root hash attestations from multiple mirrors to detect forks.
              When mirrors disagree on the root hash, it indicates potential censorship,
              data manipulation, or network partition.
            </p>
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
              <p className="font-semibold mb-2 text-sm">How to use:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>Visit different mirrors of this site</li>
                <li>Each mirror shares its root hash attestation (VFXCON1: token)</li>
                <li>Paste the attestations here to analyze consensus</li>
                <li>Review the analysis to detect forks and assess severity</li>
              </ol>
            </div>
          </div>
        </TerminalCard>

        <TerminalCard title="Import Attestations">
          <div className="space-y-4">
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste VFXCON1: tokens or consensus reports (one per line)..."
              className="w-full h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm resize-none"
            />
            {importError && (
              <div className="text-red-600 dark:text-red-400 text-sm">{importError}</div>
            )}
            {importSuccess && (
              <div className="text-green-600 dark:text-green-400 text-sm">{importSuccess}</div>
            )}
            <button
              onClick={handleImport}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Import Attestations
            </button>
          </div>
        </TerminalCard>
      </div>
    );
  }

  /* ── main content ── */
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">The Consensus</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Mirror Fork Detection — Analyze {attestations.length} attestation(s)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Analysis and Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Alert Card */}
          {alert && (
            <TerminalCard
              title="Security Alert"
              className={`border-l-4 ${getAlertLevelColor(alert.level)} border-l`}
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                    alert.level === "none" ? "bg-green-100 text-green-800" :
                    alert.level === "low" ? "bg-yellow-100 text-yellow-800" :
                    alert.level === "medium" ? "bg-orange-100 text-orange-800" :
                    alert.level === "high" ? "bg-red-100 text-red-800" :
                    "bg-red-200 text-red-900"
                  }`}>
                    {alert.level}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {Math.round(alert.confidence * 100)}% confidence
                  </span>
                </div>
                <p className="text-sm">{alert.reason}</p>
              </div>
            </TerminalCard>
          )}

          {/* Analysis Summary */}
          {analysis && (
            <TerminalCard title="Consensus Analysis">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-2xl font-bold">{analysis.totalAttestations}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Total</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{analysis.uniqueRoots}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Root Hashes</div>
                </div>
                <div>
                  <div className={`text-2xl font-bold ${analysis.hasFork ? "text-red-600" : "text-green-600"}`}>
                    {analysis.hasFork ? "FORK" : "OK"}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Status</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{analysis.majorityPercentage.toFixed(1)}%</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Majority</div>
                </div>
              </div>
            </TerminalCard>
          )}

          {/* Forks */}
          {forks.length > 0 && (
            <TerminalCard title="Detected Forks">
              <div className="space-y-3">
                {forks.map((fork) => (
                  <div
                    key={fork.rootHash}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedFork?.rootHash === fork.rootHash
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                    }`}
                    onClick={() => setSelectedFork(fork)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {fork.isMajority && (
                          <StatusPill color="green">MAJORITY</StatusPill>
                        )}
                        <span className="font-mono text-sm">
                          {fork.shortFingerprint}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {fork.mirrorCount} mirrors ({fork.percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TerminalCard>
          )}

          {/* Import Controls */}
          <TerminalCard title="Import More Attestations">
            <div className="space-y-4">
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste VFXCON1: tokens or consensus reports (one per line)..."
                className="w-full h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm resize-none"
              />
              {importError && (
                <div className="text-red-600 dark:text-red-400 text-sm">{importError}</div>
              )}
              {importSuccess && (
                <div className="text-green-600 dark:text-green-400 text-sm">{importSuccess}</div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Import
                </button>
                <button
                  onClick={handleShareReport}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Share Report
                </button>
                <button
                  onClick={handleClear}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors ml-auto"
                >
                  Clear All
                </button>
              </div>
            </div>
          </TerminalCard>
        </div>

        {/* Right column: Fork Details */}
        <div className="space-y-6">
          {selectedFork ? (
            <TerminalCard title="Fork Details">
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Root Hash</div>
                  <div className="font-mono text-xs break-all">{selectedFork.rootHash}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Mirrors</div>
                    <div className="text-lg font-bold">{selectedFork.mirrorCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Percentage</div>
                    <div className="text-lg font-bold">{selectedFork.percentage.toFixed(1)}%</div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Mirror Endpoints</div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {selectedFork.mirrors.map((mirror, i) => (
                      <div key={i} className="text-xs font-mono break-all text-gray-700 dark:text-gray-300">
                        {mirror}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Sample Attestations</div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedFork.attestations.slice(0, 3).map((att, i) => (
                      <div key={i} className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-mono">{shortRootFingerprint(att.rootHash)}</span>
                          <button
                            onClick={() => handleShareAttestation(att)}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            Share
                          </button>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {att.transport} · {new Date(att.ts).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TerminalCard>
          ) : (
            <TerminalCard title="Select a Fork">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Click on a fork from the list to view details.
              </div>
            </TerminalCard>
          )}

          {/* All Attestations */}
          <TerminalCard title={`All Attestations (${attestations.length})`}>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {attestations.map((att, i) => (
                <div key={i} className="p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono">{shortRootFingerprint(att.rootHash)}</span>
                    <button
                      onClick={() => handleShareAttestation(att)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      Share
                    </button>
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">
                    {att.mirrorEndpoint} · {att.transport}
                  </div>
                </div>
              ))}
            </div>
          </TerminalCard>
        </div>
      </div>
    </div>
  );
}