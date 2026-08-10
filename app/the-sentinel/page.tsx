"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";

/** Map a severity to a StatusPill accent literal. */
function sevPill(s: Severity): "blood" | "green" | "amber" | "dim" {
  if (s === "critical" || s === "high") return "blood";
  if (s === "moderate") return "amber";
  if (s === "info") return "green";
  return "dim";
}
import {
  ALL_INCIDENT_TYPES,
  INCIDENT_TYPES,
  SEVERITY_INFO,
  SEVERITY_ORDER,
  DEFAULT_TTL_MS,
  createIncident,
  seedIncidents,
  summarize,
  liveFeed,
  purgeExpired,
  generateHeatGrid,
  boundsOf,
  suggestEscapeRoute,
  clusterIncidents,
  effectiveIntensity,
  heatColor,
  type Incident,
  type IncidentType,
  type Severity,
  type LatLng,
} from "@/lib/sentinel";

/* ═══ LEAFLET MAP — client-only (no SSR) ═══ */
const SentinelMap = dynamic(() => import("@/components/map/SentinelMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-content-dim text-xs">
      <span className="cursor-blink">&gt; LOADING LIVE MAP...</span>
    </div>
  ),
});

const STORAGE_KEY = "vfx-sentinel";
type MapMode = "report" | "locate";

export default function TheSentinelPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [draft, setDraft] = useState<LatLng | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<MapMode>("report");
  const [now, setNow] = useState<number>(Date.now());
  const [armed, setArmed] = useState(false); // panic-wipe armed?

  // Form fields
  const [formType, setFormType] = useState<IncidentType>("teargas");
  const [formSeverity, setFormSeverity] = useState<Severity>("moderate");
  const [formHeadcount, setFormHeadcount] = useState<number>(0);
  const [formNote, setFormNote] = useState<string>("");

  /* ── load persisted incidents ── */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setIncidents(JSON.parse(stored));
      } else {
        setIncidents(seedIncidents());
      }
    } catch {
      setIncidents(seedIncidents());
    }
  }, []);

  /* ── persist incidents ── */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(incidents));
    } catch {
      /* ignore quota errors */
    }
  }, [incidents]);

  /* ── ticking clock so decay updates live ── */
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  /* ── derived: heat grid, clusters, escape, summary, feed ── */
  const live = useMemo(() => purgeExpired(incidents, now), [incidents, now]);

  const heatCells = useMemo(() => {
    if (live.length === 0) return [];
    return generateHeatGrid(live, boundsOf(live), 0.03, 0.6, now);
  }, [live, now]);

  const clusters = useMemo(
    () => clusterIncidents(live, 0.75, now),
    [live, now],
  );

  const escapeRoute = useMemo(
    () =>
      userLocation
        ? suggestEscapeRoute(userLocation, live, now, 1.5)
        : null,
    [userLocation, live, now],
  );

  const summary = useMemo(() => summarize(incidents, now), [incidents, now]);
  const feed = useMemo(() => liveFeed(incidents, now).slice(0, 30), [incidents, now]);

  /* ── handlers ── */
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (mode === "locate") {
        setUserLocation({ lat, lng });
        sound.select();
        setMode("report");
      } else {
        setDraft({ lat, lng });
        sound.nav();
      }
    },
    [mode],
  );

  const useGeolocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        sound.success();
      },
      () => sound.error(),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const submitIncident = useCallback(() => {
    if (!draft) return;
    const inc = createIncident({
      type: formType,
      severity: formSeverity,
      lat: draft.lat,
      lng: draft.lng,
      headcount: formHeadcount || undefined,
      note: formNote || undefined,
      source: "self",
      ttlMs: DEFAULT_TTL_MS,
    });
    setIncidents((prev) => [...prev, inc]);
    setDraft(null);
    setFormNote("");
    setFormHeadcount(0);
    sound.success();
  }, [draft, formType, formSeverity, formHeadcount, formNote]);

  const corroborate = useCallback((id: string) => {
    setIncidents((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, corroboration: (i.corroboration ?? 0) + 1 } : i,
      ),
    );
    sound.select();
  }, []);

  const removeIncident = useCallback((id: string) => {
    setIncidents((prev) => prev.filter((i) => i.id !== id));
    setSelectedId(null);
    sound.error();
  }, []);

  const purgeAll = useCallback(() => {
    setIncidents([]);
    setUserLocation(null);
    setDraft(null);
    setArmed(false);
    sound.error();
  }, []);

  const loadDemo = useCallback(() => {
    setIncidents(seedIncidents());
    sound.success();
  }, []);

  /* ── map centre: follow hottest cluster, else world ── */
  const mapCenter: [number, number] = clusters[0]
    ? [clusters[0].center.lat, clusters[0].center.lng]
    : [20, 10];

  const draftMeta = draft ? INCIDENT_TYPES[formType] : null;

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-7xl mx-auto pb-20">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2 glow-blood">
          🛰️ THE SENTINEL
        </h1>
        <p className="text-content-secondary text-sm">
          // real-time repression &amp; protest mapping. drop anonymous incident
          markers, watch force deployments burn hot, and steer clear of kettles &amp;
          live fire. local-first — nothing leaves your device.
        </p>
      </div>

      {/* SITUATION BAR */}
      <TerminalCard
        title="SITUATION"
        accent={summary.hotZoneCount > 0 ? "blood" : "amber"}
        glow={summary.hotZoneCount > 0}
        className="mb-4"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 text-center">
          <Stat label="ACTIVE" value={summary.active} color="var(--color-blood-bright)" />
          <Stat label="HOT ZONES" value={summary.hotZoneCount} color="var(--color-blood)" />
          <Stat label="PEAK HEAT" value={`${Math.round(summary.hottestIntensity)}`} color={heatColor(summary.hottestIntensity)} />
          <Stat label="FORCES" value={summary.forcesDeployed} color="var(--color-warning-amber)" />
          <Stat label="ARRESTS" value={summary.arrestsReported} color="var(--color-blood-bright)" />
          <Stat label="INJURED" value={summary.injuredReported} color="var(--color-command-bright)" />
        </div>
      </TerminalCard>

      {/* MAP */}
      <TerminalCard
        title={`LIVE MAP — MODE: ${mode === "report" ? "DROP MARKER" : "SET MY LOCATION"}`}
        accent="amber"
        className="mb-4"
      >
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            onClick={() => { setMode("report"); sound.select(); }}
            className={`text-[10px] px-2 py-1 border transition-colors ${mode === "report" ? "border-blood text-blood-bright bg-blood/10" : "border-border-dim text-content-secondary hover:border-blood"}`}
          >
            📍 DROP MARKER
          </button>
          <button
            onClick={() => { setMode("locate"); sound.select(); }}
            className={`text-[10px] px-2 py-1 border transition-colors ${mode === "locate" ? "border-terminal-green text-terminal-green bg-terminal-green/10" : "border-border-dim text-content-secondary hover:border-terminal-green"}`}
          >
            🎯 SET MY LOCATION
          </button>
          <button
            onClick={useGeolocation}
            className="text-[10px] px-2 py-1 border border-border-dim text-content-secondary hover:border-command hover:text-command-bright transition-colors"
          >
            📡 USE GPS
          </button>
          <button
            onClick={loadDemo}
            className="text-[10px] px-2 py-1 border border-border-dim text-content-dim hover:border-blood hover:text-blood-bright transition-colors"
          >
            ⟳ LOAD DEMO
          </button>
          <span className="text-[10px] text-content-dim ml-auto">
            {mode === "locate"
              ? "click map to place yourself, then escape routing activates"
              : "click map to drop an incident report"}
          </span>
        </div>
        <div className="h-[420px] sm:h-[520px] border border-border-dim">
          <SentinelMap
            incidents={live}
            heatCells={heatCells}
            escapeRoute={escapeRoute}
            userLocation={userLocation}
            center={mapCenter}
            onMapClick={handleMapClick}
            onSelectIncident={setSelectedId}
            selectedId={selectedId}
          />
        </div>

        {/* legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[10px] text-content-dim">
          <span>Intensity:</span>
          <span style={{ color: "#5588ff" }}>█ low</span>
          <span style={{ color: "#ffaa00" }}>█ moderate</span>
          <span style={{ color: "#ff6600" }}>█ high</span>
          <span style={{ color: "#ff0033" }}>█ critical</span>
          <span className="ml-auto">reports decay by half every 30 min · auto-expire after 6h</span>
        </div>
      </TerminalCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: report form + safety routing */}
        <div className="space-y-4">
          {/* SAFETY ROUTING */}
          <TerminalCard title="SAFETY ROUTING" accent={escapeRoute ? "green" : "amber"}>
            {escapeRoute ? (
              <div className="space-y-2">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold" style={{ color: "var(--color-terminal-green)" }}>
                    {escapeRoute.label}
                  </span>
                  <span className="text-xs text-content-dim">
                    {Math.round(escapeRoute.bearing)}° · {escapeRoute.clearanceKm.toFixed(1)} km to threat edge
                  </span>
                </div>
                {escapeRoute.nearestSafe && (
                  <div className="text-xs text-content-secondary">
                    🕊️ Nearest safe corridor {escapeRoute.nearestSafe.distanceKm.toFixed(1)} km away
                  </div>
                )}
                {!userLocation && (
                  <p className="text-xs text-content-dim">Set your location to compute an escape vector.</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-content-dim">
                Set your location (🎯 button or GPS) to receive a live escape bearing away from the densest threat.
              </p>
            )}
          </TerminalCard>

          {/* REPORT FORM */}
          <TerminalCard title={draft ? "NEW REPORT" : "REPORT FORM"} accent="blood" glow={!!draft}>
            {draft && draftMeta ? (
              <div className="space-y-3">
                <div className="text-xs text-terminal-green">
                  📍 pinned @ {draft.lat.toFixed(4)}, {draft.lng.toFixed(4)}
                </div>
                <div>
                  <label className="text-[10px] text-content-dim uppercase tracking-widest">Incident type</label>
                  <select
                    value={formType}
                    onChange={(e) => { setFormType(e.target.value as IncidentType); setFormSeverity(INCIDENT_TYPES[e.target.value as IncidentType].defaultSeverity); }}
                    className="w-full bg-abyss border border-border-dim px-2 py-1.5 text-xs text-content-primary mt-1"
                  >
                    {ALL_INCIDENT_TYPES.map((m) => (
                      <option key={m.type} value={m.type}>{m.glyph} {m.label} (threat {m.threat})</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-content-dim mt-1">{draftMeta.description}</p>
                </div>
                <div>
                  <label className="text-[10px] text-content-dim uppercase tracking-widest">Severity</label>
                  <div className="flex gap-1 mt-1">
                    {SEVERITY_ORDER.map((s) => (
                      <button
                        key={s}
                        onClick={() => { setFormSeverity(s); sound.select(); }}
                        className={`flex-1 text-[10px] px-1 py-1 border transition-colors ${formSeverity === s ? "border-bright" : "border-border-dim"}`}
                        style={formSeverity === s ? { borderColor: SEVERITY_INFO[s].color, color: SEVERITY_INFO[s].color } : { color: "var(--color-content-secondary)" }}
                      >
                        {SEVERITY_INFO[s].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-content-dim uppercase tracking-widest">Headcount</label>
                    <input
                      type="number"
                      min={0}
                      value={formHeadcount}
                      onChange={(e) => setFormHeadcount(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-abyss border border-border-dim px-2 py-1.5 text-xs text-content-primary mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-content-dim uppercase tracking-widest">Note</label>
                    <input
                      type="text"
                      value={formNote}
                      onChange={(e) => setFormNote(e.target.value)}
                      placeholder="optional detail"
                      className="w-full bg-abyss border border-border-dim px-2 py-1.5 text-xs text-content-primary mt-1"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={submitIncident}
                    className="flex-1 px-3 py-2 text-xs font-bold bg-blood text-white hover:bg-blood-bright transition-colors"
                  >
                    [ DROP REPORT ]
                  </button>
                  <button
                    onClick={() => { setDraft(null); sound.error(); }}
                    className="px-3 py-2 text-xs border border-border-dim text-content-secondary hover:border-blood"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-content-dim">
                Switch to <span className="text-blood-bright">📍 DROP MARKER</span> mode and click the map to file an
                anonymous repression report. All reports are stored locally and time-decay automatically.
              </p>
            )}
          </TerminalCard>
        </div>

        {/* RIGHT (2 cols): live feed */}
        <div className="lg:col-span-2 space-y-4">
          <TerminalCard title="LIVE FEED" accent="blood">
            {feed.length === 0 ? (
              <p className="text-xs text-content-dim py-4 text-center">No active reports. Load the demo dataset or drop markers on the map.</p>
            ) : (
              <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
                {feed.map((inc) => {
                  const meta = INCIDENT_TYPES[inc.type];
                  const sev = SEVERITY_INFO[inc.severity];
                  const intensity = effectiveIntensity(inc, now);
                  const isSelected = inc.id === selectedId;
                  return (
                    <div
                      key={inc.id}
                      className={`p-2 border transition-colors cursor-pointer ${isSelected ? "border-blood bg-blood/10" : "border-border-dim bg-abyss hover:border-border-bright"}`}
                      onClick={() => setSelectedId(isSelected ? null : inc.id)}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg leading-none">{meta.glyph}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold" style={{ color: sev.color }}>{meta.label}</span>
                            <StatusPill color={sevPill(inc.severity)}>{sev.label}</StatusPill>
                            <span className="text-[10px] text-content-dim">{timeAgo(inc.ts, now)}</span>
                          </div>
                          {inc.note && <p className="text-xs text-content-secondary mt-0.5 truncate">{inc.note}</p>}
                          <div className="text-[10px] text-content-dim mt-0.5 flex items-center gap-2">
                            <span>📍 {inc.lat.toFixed(3)}, {inc.lng.toFixed(3)}</span>
                            {inc.headcount ? <span>👥 ~{inc.headcount}</span> : null}
                            {inc.corroboration ? <span>✓ {inc.corroboration}</span> : null}
                          </div>
                        </div>
                        {/* intensity bar */}
                        <div className="flex flex-col items-end gap-1">
                          <div className="w-16 h-1.5 bg-void border border-border-dim">
                            <div className="h-full" style={{ width: `${intensity}%`, backgroundColor: heatColor(intensity) }} />
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); corroborate(inc.id); }}
                              className="text-[9px] px-1 border border-border-dim text-terminal-green hover:border-terminal-green"
                              title="Corroborate this report"
                            >
                              ✓
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeIncident(inc.id); }}
                              className="text-[9px] px-1 border border-border-dim text-content-dim hover:border-blood hover:text-blood-bright"
                              title="Remove report"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TerminalCard>

          {/* ACTIVE CLUSTERS */}
          {clusters.length > 0 && (
            <TerminalCard title="ACTIVE ZONES" accent="amber">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {clusters.slice(0, 6).map((c) => {
                  const meta = INCIDENT_TYPES[c.dominant];
                  return (
                    <div key={c.id} className="p-2 border border-border-dim bg-abyss">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{meta.glyph} {meta.label}</span>
                        <span className="text-xs font-bold" style={{ color: heatColor(c.intensity) }}>
                          {Math.round(c.intensity)}
                        </span>
                      </div>
                      <div className="text-[10px] text-content-dim mt-1">
                        {c.count} {c.count === 1 ? "report" : "reports"} · {c.center.lat.toFixed(2)}, {c.center.lng.toFixed(2)}
                      </div>
                      <div className="h-1 bg-void border border-border-dim mt-1">
                        <div className="h-full" style={{ width: `${c.intensity}%`, backgroundColor: heatColor(c.intensity) }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </TerminalCard>
          )}
        </div>
      </div>

      {/* PRIVACY / PANIC */}
      <TerminalCard title="PRIVACY &amp; DATA" accent={armed ? "blood" : "amber"} className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] text-content-dim flex-1 min-w-[200px]">
            All {incidents.length} reports are stored only in this browser (localStorage). Nothing is uploaded.
            Reports auto-expire after 6 hours. Use panic wipe to instantly destroy everything.
          </span>
          {armed ? (
            <button
              onClick={purgeAll}
              className="text-[10px] px-3 py-2 font-bold bg-blood text-white hover:bg-blood-bright animate-pulse"
            >
              ⚠ CONFIRM WIPE — DESTROY ALL
            </button>
          ) : (
            <button
              onClick={() => { setArmed(true); sound.error(); }}
              className="text-[10px] px-3 py-2 border border-blood/50 text-blood-bright hover:bg-blood/10"
            >
              ⚠ PANIC WIPE
            </button>
          )}
          {armed && (
            <button
              onClick={() => setArmed(false)}
              className="text-[10px] px-3 py-2 border border-border-dim text-content-secondary"
            >
              cancel
            </button>
          )}
        </div>
      </TerminalCard>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div>
      <div className="text-2xl sm:text-3xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] text-content-dim uppercase tracking-widest">{label}</div>
    </div>
  );
}

function timeAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}
