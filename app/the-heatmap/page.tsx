"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import { sha256Sync } from "@/lib/citizen-tools";
import { useStore } from "@/stores/useStore";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

type IncidentType =
  | "protest" | "crackdown" | "aid_blockade" | "corruption"
  | "violence" | "displacement" | "environmental" | "other";

interface IncidentReport {
  id: string;
  type: IncidentType;
  description: string;
  lat: number;
  lon: number;
  iso3?: string;
  locationName?: string;
  timestamp: number;
  reporterHandle: string;
  /** SHA-256 hash of canonical content */
  hash: string;
  /** Hash of previous report (chain) */
  prevHash: string;
}

const GENESIS = "0".repeat(64);

const INCIDENT_LABELS: Record<IncidentType, string> = {
  protest: "✊ Protest / Demonstration",
  crackdown: "🚨 Crackdown / Repression",
  aid_blockade: "🚫 Aid Blockade",
  corruption: "💰 Corruption",
  violence: "⚔ Violence / Conflict",
  displacement: "🏃 Forced Displacement",
  environmental: "🌱 Environmental Damage",
  other: "📍 Other Incident",
};

const INCIDENT_COLORS: Record<IncidentType, string> = {
  protest: "#22d3a6",
  crackdown: "#ff3344",
  aid_blockade: "#ff8800",
  corruption: "#ffcc00",
  violence: "#cc0000",
  displacement: "#aa44ff",
  environmental: "#00cc44",
  other: "#888888",
};

/* ═══════════════════════════════════════════════════════════════
   Storage
   ═══════════════════════════════════════════════════════════════ */

const STORAGE_KEY = "vfx-heatmap";

function loadReports(): IncidentReport[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveReports(reports: IncidentReport[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch {
    // ignore
  }
}

function computeHash(report: Omit<IncidentReport, "hash">): string {
  const canonical = JSON.stringify({
    id: report.id,
    type: report.type,
    description: report.description,
    lat: report.lat,
    lon: report.lon,
    iso3: report.iso3 ?? "",
    locationName: report.locationName ?? "",
    timestamp: report.timestamp,
    reporterHandle: report.reporterHandle,
    prevHash: report.prevHash,
  });
  return sha256Sync(canonical);
}

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */

export default function TheHeatmapPage() {
  const { identity } = useStore();
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [type, setType] = useState<IncidentType>("protest");
  const [description, setDescription] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [locationName, setLocationName] = useState("");
  const [iso3, setIso3] = useState("");
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReports(loadReports());
  }, []);

  const handleSubmit = useCallback(() => {
    if (!description.trim() || !lat || !lon) return;

    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (Number.isNaN(latNum) || Number.isNaN(lonNum)) return;

    const prevHash = reports.length > 0 ? reports[reports.length - 1].hash : GENESIS;

    const report: Omit<IncidentReport, "hash"> = {
      id: typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `rpt-${Date.now()}`,
      type,
      description: description.trim(),
      lat: latNum,
      lon: lonNum,
      iso3: iso3 || undefined,
      locationName: locationName || undefined,
      timestamp: Date.now(),
      reporterHandle: identity?.handle ?? "anonymous",
      prevHash,
    };

    const hash = computeHash(report);
    const fullReport: IncidentReport = { ...report, hash };
    const updated = [...reports, fullReport];
    setReports(updated);
    saveReports(updated);

    // Reset form
    setDescription("");
    setLat("");
    setLon("");
    setLocationName("");
    setIso3("");
    sound.success();
  }, [description, lat, lon, type, locationName, iso3, reports, identity]);

  const handleUseMyLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(4));
        setLon(pos.coords.longitude.toFixed(4));
        sound.nav();
      },
      () => sound.error(),
    );
  }, []);

  const handleExport = useCallback(() => {
    const data = JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        count: reports.length,
        reports,
      },
      null,
      2,
    );
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `heatmap-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    sound.success();
  }, [reports]);

  const handleImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (Array.isArray(data.reports)) {
          // Merge, dedup by id
          const existing = new Set(reports.map((r) => r.id));
          const imported = data.reports.filter((r: IncidentReport) => !existing.has(r.id)) as IncidentReport[];

          // Sort all reports by timestamp to maintain chronological order
          const allReports = [...reports, ...imported].sort((a, b) => a.timestamp - b.timestamp);

          // Rebuild the chain with correct prevHash linkage
          let prevHash = GENESIS;
          const rebuilt = allReports.map((report) => {
            const updatedReport = { ...report, prevHash };
            const hash = computeHash(updatedReport);
            const fullReport: IncidentReport = { ...updatedReport, hash };
            prevHash = hash;
            return fullReport;
          });

          setReports(rebuilt);
          saveReports(rebuilt);
          sound.success();
        }
      } catch {
        sound.error();
      }
    };
    reader.readAsText(file);
  }, [reports]);

  // Group by type for stats
  const byType = reports.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">
        🗺️ THE HEATMAP
      </h1>
      <p className="text-content-secondary text-sm mb-6">
        // crowdsourced incident reporter — signed, hash-chained, exportable
      </p>

      {/* Stats */}
      <TerminalCard title="HEATMAP STATUS" accent={reports.length > 0 ? "blood" : "green"}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold text-blood-bright">{reports.length}</div>
            <div className="text-xs text-content-dim">REPORTS</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-content-primary">
              {Object.keys(byType).length}
            </div>
            <div className="text-xs text-content-dim">CATEGORIES</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-terminal-green">✓</div>
            <div className="text-xs text-content-dim">SIGNED</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-content-primary">
              {reports.length > 0 ? "🔗" : "—"}
            </div>
            <div className="text-xs text-content-dim">CHAINED</div>
          </div>
        </div>
        {Object.keys(byType).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            {Object.entries(byType).map(([t, count]) => (
              <span
                key={t}
                className="text-[10px] px-2 py-0.5 border"
                style={{ borderColor: INCIDENT_COLORS[t as IncidentType], color: INCIDENT_COLORS[t as IncidentType] }}
              >
                {INCIDENT_LABELS[t as IncidentType]?.split(" ")[0]} {count}
              </span>
            ))}
          </div>
        )}
      </TerminalCard>

      {/* Report form */}
      <div className="mt-4">
        <TerminalCard title="FILE NEW REPORT" accent="blood">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-content-dim block mb-1">INCIDENT TYPE</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as IncidentType)}
                className="w-full bg-abyss border border-border-dim text-content-primary text-sm p-2"
              >
                {(Object.entries(INCIDENT_LABELS) as [IncidentType, string][]).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-content-dim block mb-1">DESCRIPTION</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what you witnessed…"
                rows={3}
                className="w-full bg-abyss border border-border-dim text-content-primary text-sm p-2 resize-vertical"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-content-dim block mb-1">LATITUDE</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="e.g. 15.5527"
                  className="w-full bg-abyss border border-border-dim text-content-primary text-sm p-2"
                />
              </div>
              <div>
                <label className="text-xs text-content-dim block mb-1">LONGITUDE</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  placeholder="e.g. 48.5164"
                  className="w-full bg-abyss border border-border-dim text-content-primary text-sm p-2"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleUseMyLocation}
                className="text-[10px] px-3 py-1 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green"
              >
                📍 USE MY LOCATION
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-content-dim block mb-1">LOCATION NAME (optional)</label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="City, district, etc."
                  className="w-full bg-abyss border border-border-dim text-content-primary text-sm p-2"
                />
              </div>
              <div>
                <label className="text-xs text-content-dim block mb-1">ISO3 (optional)</label>
                <input
                  type="text"
                  maxLength={3}
                  value={iso3}
                  onChange={(e) => setIso3(e.target.value.toUpperCase())}
                  placeholder="e.g. YEM"
                  className="w-full bg-abyss border border-border-dim text-content-primary text-sm p-2"
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!description.trim() || !lat || !lon}
              className="w-full py-2 border border-blood text-blood-bright hover:bg-blood/10 disabled:opacity-30 text-xs font-bold"
            >
              📌 FILE SIGNED REPORT
            </button>
          </div>
        </TerminalCard>
      </div>

      {/* Import / Export */}
      <div className="mt-4">
        <TerminalCard title="DATA SOVEREIGNTY" accent="amber">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleExport}
              disabled={reports.length === 0}
              className="px-3 py-1 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green text-xs disabled:opacity-30"
            >
              ⬇ EXPORT SIGNED JSON
            </button>
            <label className="px-3 py-1 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright text-xs cursor-pointer">
              ⬆ IMPORT REPORTS
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImport(f);
                }}
              />
            </label>
          </div>
        </TerminalCard>
      </div>

      {/* Report list */}
      {reports.length > 0 && (
        <div className="mt-4">
          <TerminalCard title={`REPORT LOG (${reports.length})`} accent="blood">
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {[...reports].reverse().map((r, i) => (
                <div
                  key={r.id}
                  className="p-2 border border-border-dim hover:border-blood/50"
                  style={{ borderLeft: `3px solid ${INCIDENT_COLORS[r.type]}` }}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold" style={{ color: INCIDENT_COLORS[r.type] }}>
                      {INCIDENT_LABELS[r.type]}
                    </span>
                    <span className="text-[10px] text-content-dim">
                      {new Date(r.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-content-primary mt-1">{r.description}</p>
                  <div className="text-[10px] text-content-dim mt-1">
                    📍 {r.lat.toFixed(4)}, {r.lon.toFixed(4)}
                    {r.locationName && ` · ${r.locationName}`}
                    {r.iso3 && ` · ${r.iso3}`}
                    {" · "}{r.reporterHandle}
                  </div>
                  <div className="text-[9px] text-content-dim font-mono mt-1">
                    hash: {r.hash.slice(0, 16)}…
                  </div>
                </div>
              ))}
            </div>
          </TerminalCard>
        </div>
      )}
    </div>
  );
}
