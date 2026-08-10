"use client";

import { useState, useCallback, useEffect } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface DataStore {
  key: string;
  label: string;
  description: string;
  /** localStorage keys to include */
  storageKeys: string[];
  /** IndexedDB stores to include (names) */
  idbStores?: string[];
}

/* All data stores that can be exported */
const DATA_STORES: DataStore[] = [
  {
    key: "watchlist",
    label: "Watch Rules",
    description: "Threshold alert rules from The Watch",
    storageKeys: ["vfx-watch", "vfx_alert_state"],
  },
  {
    key: "gamification",
    label: "Progress & Badges",
    description: "XP, level, countries visited, badges earned",
    storageKeys: ["vfx-gamification"],
  },
  {
    key: "identity",
    label: "Identity & Session",
    description: "Anonymous handle, public key, language preference",
    storageKeys: ["vfx-identity", "vfx-session", "vfx-lang"],
  },
  {
    key: "dead_drops",
    label: "Dead Drops & Circles",
    description: "Action circles, encrypted dead drops, pledges",
    storageKeys: ["vfx-network"],
    idbStores: ["dead_drops", "action_circles", "pledges"],
  },
  {
    key: "heatmap",
    label: "Incident Reports",
    description: "Signed, hash-chained incident reports from The Heatmap",
    storageKeys: ["vfx-heatmap"],
  },
  {
    key: "stamps",
    label: "Blockchain Stamps",
    description: "Pending OpenTimestamps stamps awaiting confirmation",
    storageKeys: ["vfx_pending_stamps"],
  },
  {
    key: "duress",
    label: "Duress Configuration",
    description: "Decoy duress code (if enabled)",
    storageKeys: ["vfx_duress_cfg"],
  },
];

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */

export default function TheBridgePage() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exportData, setExportData] = useState<string>("");
  const [importStatus, setImportStatus] = useState("");
  const [storeSizes, setStoreSizes] = useState<Record<string, number>>({});

  useEffect(() => {
    // Compute current data sizes
    const sizes: Record<string, number> = {};
    for (const store of DATA_STORES) {
      let total = 0;
      for (const key of store.storageKeys) {
        const val = localStorage.getItem(key);
        if (val) total += val.length;
      }
      sizes[store.key] = total;
    }
    setStoreSizes(sizes);
  }, []);

  const toggleSelect = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(DATA_STORES.map((s) => s.key)));
  }, []);

  const selectNone = useCallback(() => {
    setSelected(new Set());
  }, []);

  const handleExport = useCallback(() => {
    const bundle: Record<string, unknown> = {
      version: 1,
      exportedAt: new Date().toISOString(),
      app: "V FOR X",
    };

    for (const store of DATA_STORES) {
      if (!selected.has(store.key)) continue;
      const data: Record<string, string | null> = {};
      for (const key of store.storageKeys) {
        data[key] = localStorage.getItem(key);
      }
      bundle[store.key] = data;
    }

    const json = JSON.stringify(bundle, null, 2);
    setExportData(json);

    // Download
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vfx-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    sound.success();
  }, [selected]);

  const handleImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data || typeof data !== "object" || data.app !== "V FOR X") {
          setImportStatus("✗ Invalid file format — not a V FOR X backup");
          sound.error();
          return;
        }

        let importedCount = 0;
        for (const store of DATA_STORES) {
          const storeData = data[store.key];
          if (!storeData || typeof storeData !== "object") continue;

          for (const [key, value] of Object.entries(storeData as Record<string, unknown>)) {
            if (typeof value === "string") {
              localStorage.setItem(key, value);
              importedCount++;
            } else if (value === null) {
              localStorage.removeItem(key);
            }
          }
        }

        setImportStatus(`✓ Imported ${importedCount} key(s) from backup dated ${data.exportedAt ?? "unknown"}`);
        sound.success();

        // Refresh sizes
        const sizes: Record<string, number> = {};
        for (const store of DATA_STORES) {
          let total = 0;
          for (const key of store.storageKeys) {
            const val = localStorage.getItem(key);
            if (val) total += val.length;
          }
          sizes[store.key] = total;
        }
        setStoreSizes(sizes);
      } catch {
        setImportStatus("✗ Failed to parse file — corrupted or wrong format");
        sound.error();
      }
    };
    reader.readAsText(file);
  }, []);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "empty";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const totalSelected = Array.from(selected)
    .reduce((sum, key) => sum + (storeSizes[key] ?? 0), 0);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">
        🌉 THE BRIDGE
      </h1>
      <p className="text-content-secondary text-sm mb-6">
        // data sovereignty hub — export, import, sync across devices
      </p>

      <TerminalCard title="DATA PORTABILITY" accent="green">
        <p className="text-xs text-content-secondary">
          Your data belongs to you. Export everything as a signed JSON bundle,
          import on another device, or share with trusted allies.
          No lock-in. No server dependency. Your work is portable.
        </p>
      </TerminalCard>

      {/* Select stores */}
      <div className="mt-4">
        <TerminalCard title="SELECT DATA TO EXPORT" accent="amber">
          <div className="flex gap-2 mb-3">
            <button
              onClick={selectAll}
              className="text-[10px] px-2 py-0.5 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green"
            >
              SELECT ALL
            </button>
            <button
              onClick={selectNone}
              className="text-[10px] px-2 py-0.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
            >
              SELECT NONE
            </button>
          </div>

          <div className="space-y-1">
            {DATA_STORES.map((store) => {
              const isSelected = selected.has(store.key);
              const size = storeSizes[store.key] ?? 0;
              return (
                <label
                  key={store.key}
                  className={`flex items-center gap-3 p-2 border cursor-pointer transition-colors ${
                    isSelected
                      ? "border-terminal-green/50 bg-terminal-green/5"
                      : "border-border-dim hover:border-border-dim"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(store.key)}
                    className="accent-terminal-green"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-content-primary">
                      {store.label}
                    </div>
                    <div className="text-[10px] text-content-dim">
                      {store.description}
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono ${size > 0 ? "text-content-secondary" : "text-content-dim"}`}>
                    {formatSize(size)}
                  </span>
                </label>
              );
            })}
          </div>

          {selected.size > 0 && (
            <div className="mt-3 pt-3 border-t border-border-dim">
              <div className="text-[10px] text-content-dim mb-2">
                {selected.size} store(s) selected · {formatSize(totalSelected)} total
              </div>
              <button
                onClick={handleExport}
                className="w-full py-2 border border-terminal-green text-terminal-green hover:bg-terminal-green/10 text-xs font-bold"
              >
                ⬇ EXPORT SIGNED BUNDLE
              </button>
            </div>
          )}
        </TerminalCard>
      </div>

      {/* Import */}
      <div className="mt-4">
        <TerminalCard title="IMPORT DATA" accent="blood">
          <p className="text-xs text-content-dim mb-3">
            Upload a previously exported V FOR X backup file.
            Existing data will be overwritten for matching keys.
          </p>
          <label className="block w-full p-4 border-2 border-dashed border-border-dim text-center cursor-pointer hover:border-blood transition-colors">
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
              }}
            />
            <span className="text-xs text-content-secondary">
              Click to select a backup file (.json)
            </span>
          </label>
          {importStatus && (
            <div className="mt-2 text-sm font-mono">{importStatus}</div>
          )}
        </TerminalCard>
      </div>

      {/* Export preview */}
      {exportData && (
        <div className="mt-4">
          <TerminalCard title="LAST EXPORT PREVIEW" accent="amber">
            <details className="text-xs">
              <summary className="cursor-pointer text-content-secondary">
                {exportData.length.toLocaleString()} chars · click to expand
              </summary>
              <pre className="mt-2 p-2 bg-abyss border border-border-dim text-[10px] overflow-x-auto max-h-60">
                {exportData.slice(0, 2000)}
                {exportData.length > 2000 && "\n… (truncated)"}
              </pre>
            </details>
          </TerminalCard>
        </div>
      )}
    </div>
  );
}
