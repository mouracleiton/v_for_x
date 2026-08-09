"use client";

/**
 * V FOR X — Offline Indicator & Country Pack Manager
 *
 * A Command Center widget that:
 *   • Shows online/offline status as a corner pill
 *   • Surfaces an offline banner when disconnected
 *   • Lets the operator download per-country offline packs
 *   • Reports cached-country count and cache statistics
 *   • Offers a "Clear Cache" (with confirm) and "Panic Wipe" action
 *
 * Uses lib/offline-manager utilities and the Zustand store.
 */

import { useCallback, useEffect, useState } from "react";
import countriesData from "@/data/countries_en.json";
import { useStore } from "@/stores/useStore";
import {
  isOnline,
  onConnectivityChange,
  downloadCountryPack,
  getCachedCountries,
  getCacheStats,
  clearAllCaches,
  type CountryPackRecord,
  type DownloadProgress,
} from "@/lib/offline-manager";

type Country = { name_en: string; iso3: string };

const COUNTRIES: Country[] = (
  (countriesData as { countries?: Country[] }).countries ?? []
)
  .slice()
  .sort((a, b) => a.name_en.localeCompare(b.name_en));

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function OfflineIndicator() {
  const { triggerDuress } = useStore();

  const [online, setOnline] = useState<boolean>(true);
  const [panelOpen, setPanelOpen] = useState<boolean>(false);
  const [cachedCountries, setCachedCountries] = useState<CountryPackRecord[]>([]);
  const [cacheStats, setCacheStats] = useState<{ size: number; entries: number }>({
    size: 0,
    entries: 0,
  });
  const [selectedIso, setSelectedIso] = useState<string>("");
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [confirmClear, setConfirmClear] = useState<boolean>(false);
  const [toast, setToast] = useState<string>("");

  /* ── connectivity + initial stats ── */
  const refreshStats = useCallback(async () => {
    const [packs, stats] = await Promise.all([
      getCachedCountries(),
      getCacheStats(),
    ]);
    setCachedCountries(packs);
    setCacheStats(stats);
  }, []);

  useEffect(() => {
    setOnline(isOnline());
    const unsub = onConnectivityChange((next) => setOnline(next));
    refreshStats();
    return unsub;
  }, [refreshStats]);

  /* auto-dismiss toast */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  /* ── handlers ── */
  const handleDownload = useCallback(async () => {
    if (!selectedIso || busy) return;
    setBusy(true);
    setProgress({ total: 3, completed: 0, status: "Initializing…" });
    try {
      const { success, cachedItems } = await downloadCountryPack(selectedIso, (p) =>
        setProgress(p)
      );
      await refreshStats();
      setToast(
        success
          ? `Pack cached: ${cachedItems} resource${cachedItems === 1 ? "" : "s"}`
          : "Pack incomplete — some resources unavailable"
      );
    } catch {
      setToast("Download failed");
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(null), 1200);
    }
  }, [selectedIso, busy, refreshStats]);

  const handleClear = useCallback(async () => {
    setBusy(true);
    try {
      await clearAllCaches();
      await refreshStats();
      setToast("All caches purged");
    } catch {
      setToast("Purge failed");
    } finally {
      setConfirmClear(false);
      setBusy(false);
    }
  }, [refreshStats]);

  const handlePanic = useCallback(() => {
    triggerDuress();
    setToast("PANIC WIPE — all local data destroyed");
  }, [triggerDuress]);

  const pillColor = online
    ? "var(--color-terminal-green)"
    : "var(--color-warning-amber)";
  const pillBg = online ? "rgba(34,211,166,0.08)" : "rgba(240,169,59,0.10)";

  return (
    <>
      {/* ── Offline banner ── */}
      {!online && (
        <div
          className="fixed top-0 left-0 right-0 z-[9990] text-center text-[11px] uppercase tracking-widest py-1.5"
          style={{
            background: "rgba(240,169,59,0.14)",
            color: "var(--color-warning-amber)",
            borderBottom: "1px solid var(--color-border-dim)",
          }}
        >
          ⚠ Operating in offline mode — cached data active
        </div>
      )}

      {/* ── Corner pill (always visible) ── */}
      <button
        type="button"
        onClick={() => setPanelOpen((v) => !v)}
        aria-label="Toggle offline manager"
        className="inline-pill fixed z-[9991] flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-widest border"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
          right: "12px",
          background: pillBg,
          borderColor: pillColor,
          color: pillColor,
          cursor: "pointer",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: pillColor,
            boxShadow: `0 0 6px ${pillColor}`,
            display: "inline-block",
          }}
        />
        {online ? "ONLINE" : "OFFLINE"}
        <span style={{ opacity: 0.6, fontSize: 9 }}>
          {panelOpen ? "▾" : "▸"}
        </span>
      </button>

      {/* ── Manager panel ── */}
      {panelOpen && (
        <div
          className="fixed z-[9991] w-[300px] max-w-[calc(100vw-24px)]"
          style={{
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 44px)",
            right: "12px",
            background: "var(--color-panel)",
            border: "1px solid var(--color-border-bright)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
          }}
        >
          {/* header */}
          <div
            className="flex items-center justify-between px-3 py-2 border-b"
            style={{ borderColor: "var(--color-border-dim)" }}
          >
            <span
              className="text-[10px] uppercase tracking-widest"
              style={{ color: "var(--color-command)" }}
            >
              &gt; offline_manager
            </span>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="inline-pill text-[11px]"
              style={{ color: "var(--color-content-dim)" }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="p-3 space-y-3 text-xs">
            {/* status line */}
            <div
              className="flex justify-between"
              style={{ color: "var(--color-content-secondary)" }}
            >
              <span>STATUS</span>
              <span style={{ color: pillColor }}>
                {online ? "● CONNECTED" : "⚠ OFFLINE"}
              </span>
            </div>
            <div
              className="flex justify-between"
              style={{ color: "var(--color-content-secondary)" }}
            >
              <span>CACHED COUNTRIES</span>
              <span style={{ color: "var(--color-content-primary)" }}>
                {cachedCountries.length}
              </span>
            </div>
            <div
              className="flex justify-between"
              style={{ color: "var(--color-content-secondary)" }}
            >
              <span>CACHE SIZE</span>
              <span style={{ color: "var(--color-content-primary)" }}>
                {formatBytes(cacheStats.size)} / {cacheStats.entries} entries
              </span>
            </div>

            {/* divider */}
            <div style={{ borderTop: "1px solid var(--color-border-dim)" }} />

            {/* country pack download */}
            <div>
              <label
                className="block mb-1.5 text-[10px] uppercase tracking-widest"
                style={{ color: "var(--color-content-dim)" }}
              >
                Download Country Pack
              </label>
              <div className="flex gap-1.5">
                <select
                  value={selectedIso}
                  onChange={(e) => setSelectedIso(e.target.value)}
                  disabled={busy}
                  className="flex-1 min-w-0 text-xs px-2 py-1.5"
                  style={{
                    background: "var(--color-abyss)",
                    border: "1px solid var(--color-border-dim)",
                    color: "var(--color-content-primary)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <option value="">— select —</option>
                  {COUNTRIES.map((c) => {
                    const cached = cachedCountries.some(
                      (p) => p.iso3 === c.iso3.toUpperCase()
                    );
                    return (
                      <option key={c.iso3} value={c.iso3}>
                        {c.iso3} — {c.name_en}
                        {cached ? " ✓" : ""}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!selectedIso || busy}
                  className="inline-pill text-[10px] uppercase tracking-wider px-2.5 py-1.5 whitespace-nowrap"
                  style={{
                    background:
                      !selectedIso || busy
                        ? "var(--color-panel-hi)"
                        : "rgba(91,156,246,0.12)",
                    border: "1px solid var(--color-command)",
                    color: "var(--color-command)",
                    opacity: !selectedIso || busy ? 0.5 : 1,
                  }}
                >
                  {busy ? "…" : "GET"}
                </button>
              </div>

              {/* progress bar */}
              {progress && (
                <div className="mt-2">
                  <div
                    className="text-[9px] mb-1"
                    style={{ color: "var(--color-content-secondary)" }}
                  >
                    {progress.status}
                  </div>
                  <div
                    className="w-full h-1 overflow-hidden"
                    style={{ background: "var(--color-border-dim)" }}
                  >
                    <div
                      style={{
                        width: `${
                          progress.total
                            ? (progress.completed / progress.total) * 100
                            : 0
                        }%`,
                        height: "100%",
                        background: "var(--color-terminal-green)",
                        transition: "width .2s ease",
                      }}
                    />
                  </div>
                </div>
              )}

              {cachedCountries.length > 0 && (
                <div
                  className="mt-2 text-[9px] leading-relaxed"
                  style={{ color: "var(--color-content-dim)" }}
                >
                  PACKS:{" "}
                  {cachedCountries
                    .map((p) => p.iso3)
                    .slice(0, 12)
                    .join(" · ")}
                  {cachedCountries.length > 12 ? " …" : ""}
                </div>
              )}
            </div>

            {/* divider */}
            <div style={{ borderTop: "1px solid var(--color-border-dim)" }} />

            {/* cache + panic actions */}
            <div className="flex gap-1.5">
              {confirmClear ? (
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={busy}
                  className="inline-pill flex-1 text-[10px] uppercase tracking-wider px-2 py-1.5"
                  style={{
                    background: "rgba(196,43,62,0.18)",
                    border: "1px solid var(--color-blood)",
                    color: "var(--color-blood-bright)",
                  }}
                >
                  CONFIRM PURGE
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  disabled={busy}
                  className="inline-pill flex-1 text-[10px] uppercase tracking-wider px-2 py-1.5"
                  style={{
                    background: "var(--color-abyss)",
                    border: "1px solid var(--color-border-dim)",
                    color: "var(--color-content-secondary)",
                  }}
                >
                  Clear Cache
                </button>
              )}
              <button
                type="button"
                onClick={handlePanic}
                className="inline-pill flex-1 text-[10px] uppercase tracking-wider px-2 py-1.5"
                style={{
                  background: "rgba(196,43,62,0.14)",
                  border: "1px solid var(--color-blood)",
                  color: "var(--color-blood-bright)",
                }}
              >
                ✕ Panic Wipe
              </button>
            </div>
            {confirmClear && (
              <div
                className="text-[9px] text-center"
                style={{ color: "var(--color-warning-amber)" }}
              >
                This removes all offline data. Tap again to confirm.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed z-[9992] left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-widest px-3 py-1.5 border"
          style={{
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
            background: "var(--color-panel)",
            borderColor: "var(--color-border-bright)",
            color: "var(--color-content-primary)",
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
