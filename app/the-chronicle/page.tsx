"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import {
  ALL_EVENT_TYPES,
  EVENT_TYPES,
  SEVERITY_INFO,
  SEVERITY_ORDER,
  GENESIS_HASH,
  verificationStatus,
  effectiveIntensity,
  heatColor,
  shortHash,
  createEvent,
  getLastHash,
  verifyChain,
  addCorroboration,
  generateKey,
  signEvent,
  exportChain,
  importChain,
  seedChain,
  summarize,
  timelineBuckets,
  type ChronicleEvent,
  type EventType,
  type Severity,
  type ProofType,
  type LatLng,
  type ChainVerification,
} from "@/lib/chronicle";

/* ═══ LEAFLET MAP — client-only (no SSR) ═══ */
const ChronicleMap = dynamic(() => import("@/components/map/ChronicleMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-content-dim text-xs">
      <span className="cursor-blink">&gt; LOADING CHRONICLE MAP...</span>
    </div>
  ),
});

const STORAGE_KEY = "vfx-chronicle";
const IDENTITY_KEY = "vfx-chronicle-identity";

function sevPill(s: Severity): "blood" | "green" | "amber" | "dim" {
  if (s === "critical" || s === "high") return "blood";
  if (s === "moderate") return "amber";
  if (s === "info") return "green";
  return "dim";
}

function statusPill(status: string): "blood" | "green" | "amber" | "dim" {
  if (status === "VERIFIED") return "green";
  if (status === "CORROBORATED") return "amber";
  if (status === "SIGNED") return "dim";
  return "blood";
}

export default function TheChroniclePage() {
  const [events, setEvents] = useState<ChronicleEvent[]>([]);
  const [draft, setDraft] = useState<LatLng | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [verification, setVerification] = useState<ChainVerification | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Form fields
  const [formType, setFormType] = useState<EventType>("civilian_harm");
  const [formSeverity, setFormSeverity] = useState<Severity>("high");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formIso3, setFormIso3] = useState("");
  const [formSign, setFormSign] = useState(true);

  // Anonymous identity
  const [identity, setIdentity] = useState<{ publicKey: string; privateKey: string } | null>(null);
  const [handle] = useState(() => `V-${rand(4)}-${rand(4)}`);

  // Corroboration input for the selected event
  const [corrProof, setCorrProof] = useState<ProofType>("witness");

  // Export / import
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── load persisted chain ── */
  useEffect(() => {
    (async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setEvents(JSON.parse(stored));
        } else {
          setEvents(await seedChain());
        }
      } catch {
        setEvents(await seedChain());
      }
      setLoaded(true);
    })();

    // Load or generate anonymous identity.
    try {
      const storedId = localStorage.getItem(IDENTITY_KEY);
      if (storedId) {
        setIdentity(JSON.parse(storedId));
      } else if (window.crypto?.subtle) {
        generateKey().then((kp) => {
          setIdentity(kp);
          localStorage.setItem(IDENTITY_KEY, JSON.stringify(kp));
        }).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }, []);

  /* ── persist chain ── */
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch {
      /* ignore quota */
    }
  }, [events, loaded]);

  /* ── verify the chain whenever it changes ── */
  useEffect(() => {
    let cancelled = false;
    verifyChain(events).then((result) => {
      if (!cancelled) setVerification(result);
    });
    return () => {
      cancelled = true;
    };
  }, [events]);

  /* ── derived data ── */
  const summary = useMemo(() => summarize(events), [events]);
  const buckets = useMemo(() => timelineBuckets(events), [events]);
  const selected = useMemo(
    () => events.find((e) => e.id === selectedId) ?? null,
    [events, selectedId],
  );

  const mapCenter: [number, number] = events[0]
    ? [events[0].lat, events[0].lng]
    : [20, 10];

  /* ── handlers ── */
  const handleMapClick = useCallback((lat: number, lng: number) => {
    setDraft({ lat, lng });
    sound.nav();
  }, []);

  const submitEvent = useCallback(async () => {
    if (!draft || !formTitle.trim()) return;
    const base = {
      ts: Date.now(),
      lat: draft.lat,
      lng: draft.lng,
      type: formType,
      severity: formSeverity,
      title: formTitle.trim(),
      description: formDesc.trim() || undefined,
      location: formLocation.trim() || undefined,
      iso3: formIso3.trim().toUpperCase() || undefined,
      source: "self" as const,
      signerHandle: handle,
      publicKey: formSign && identity ? identity.publicKey : undefined,
    };
    let event = await createEvent(base, getLastHash(events));

    if (formSign && identity && event.publicKey) {
      try {
        event.signature = await signEvent(event.hash, identity.privateKey);
      } catch {
        /* signing unavailable — chain still valid, just unsigned */
      }
    }

    setEvents((prev) => [...prev, event]);
    setDraft(null);
    setFormTitle("");
    setFormDesc("");
    setFormLocation("");
    setFormIso3("");
    sound.success();
  }, [draft, formType, formSeverity, formTitle, formDesc, formLocation, formIso3, formSign, identity, handle, events]);

  const corroborate = useCallback((id: string) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? addCorroboration(e, {
              handle,
              ts: Date.now(),
              proofType: corrProof,
            })
          : e,
      ),
    );
    sound.select();
  }, [handle, corrProof]);

  const removeEvent = useCallback(async (id: string) => {
    // Removing a middle event breaks the chain; rebuild the remaining
    // events sequentially so linkage stays valid. (The user is editing
    // their own local copy; downstream hashes are recomputed.)
    const rest = events.filter((e) => e.id !== id);
    const rebuilt: ChronicleEvent[] = [];
    let prev = GENESIS_HASH;
    for (const e of rest) {
      const next = await createEvent(
        {
          ts: e.ts,
          lat: e.lat,
          lng: e.lng,
          type: e.type,
          severity: e.severity,
          title: e.title,
          description: e.description,
          location: e.location,
          iso3: e.iso3,
          source: e.source,
          signerHandle: e.signerHandle,
          publicKey: e.publicKey,
          signature: e.signature,
          id: e.id,
        },
        prev,
      );
      next.corroborations = e.corroborations;
      rebuilt.push(next);
      prev = next.hash;
    }
    setEvents(rebuilt);
    setSelectedId(null);
    sound.error();
  }, [events]);

  const loadDemo = useCallback(async () => {
    setEvents(await seedChain());
    setSelectedId(null);
    sound.success();
  }, []);

  const purgeAll = useCallback(() => {
    setEvents([]);
    setSelectedId(null);
    setDraft(null);
    sound.error();
  }, []);

  const handleExport = useCallback(() => {
    const data = exportChain(events);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chronicle-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    sound.select();
  }, [events]);

  const handleImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = importChain(String(reader.result));
        setEvents(imported);
        setSelectedId(null);
        sound.success();
      } catch (err) {
        alert(`Import failed: ${(err as Error).message}`);
        sound.error();
      }
    };
    reader.readAsText(file);
  }, []);

  const draftMeta = draft ? EVENT_TYPES[formType] : null;
  const chainTip = events.length > 0 ? shortHash(getLastHash(events)) : shortHash(GENESIS_HASH);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-7xl mx-auto pb-20">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2 glow-blood">
          📜 THE CHRONICLE
        </h1>
        <p className="text-content-secondary text-sm">
          // distributed event mapping — a crowdsourced, verified incident record.
          every event is signed, hash-chained, and community-corroborated. no single
          authority can forge or back-date what the chain has already sealed.
          local-first — nothing leaves your device.
        </p>
      </div>

      {/* CHAIN INTEGRITY BANNER */}
      <TerminalCard
        title={`CHAIN INTEGRITY — ${verification?.valid ? "SEALED" : "BROKEN"}`}
        accent={verification?.valid ? "green" : "blood"}
        glow={!verification?.valid}
        className="mb-4"
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
          <Stat label="EVENTS" value={summary.total} color="var(--color-blood-bright)" />
          <Stat label="SIGNED" value={summary.signed} color="var(--color-terminal-green)" />
          <Stat label="CORROBORATED" value={summary.corroborated} color="var(--color-warning-amber)" />
          <Stat label="VERIFIED" value={summary.verified} color="var(--color-terminal-green)" />
          <Stat label="ACTIVE CELLS" value={summary.activeCells} color="#aa44ff" />
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border-dim text-[10px] text-content-dim">
          <span style={{ color: verification?.valid ? "var(--color-terminal-green)" : "var(--color-blood-bright)" }}>
            {verification?.valid ? "✓" : "⚠"} {verification?.message}
          </span>
          <span className="ml-auto font-mono">
            tip: <span className="text-content-secondary">{chainTip}</span>
          </span>
        </div>
      </TerminalCard>

      {/* MAP */}
      <TerminalCard title="INCIDENT MAP — CLICK TO FILE" accent="amber" className="mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            onClick={loadDemo}
            className="text-[10px] px-2 py-1 border border-border-dim text-content-dim hover:border-blood hover:text-blood-bright transition-colors"
          >
            ⟳ LOAD DEMO CHAIN
          </button>
          <button
            onClick={handleExport}
            disabled={events.length === 0}
            className="text-[10px] px-2 py-1 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green transition-colors disabled:opacity-40"
          >
            ⬇ EXPORT CHAIN
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-[10px] px-2 py-1 border border-border-dim text-content-secondary hover:border-command hover:text-command-bright transition-colors"
          >
            ⬆ IMPORT CHAIN
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
              e.target.value = "";
            }}
          />
          <span className="text-[10px] text-content-dim ml-auto">
            {selected ? "click marker again to deselect · " : ""}
            click map to pin a new event
          </span>
        </div>
        <div className="h-[420px] sm:h-[520px] border border-border-dim">
          <ChronicleMap
            events={events}
            center={mapCenter}
            onMapClick={handleMapClick}
            onSelectEvent={setSelectedId}
            selectedId={selectedId}
            draft={draft}
          />
        </div>
        {/* legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[10px] text-content-dim">
          <span>Status:</span>
          <span style={{ color: "#e23856" }}>○ unverified</span>
          <span style={{ color: "#5588ff" }}>○ signed</span>
          <span style={{ color: "#f0a93b" }}>○ corroborated</span>
          <span style={{ color: "#22d3a6" }}>○ verified</span>
          <span className="ml-auto">append-only · hash-chained · cryptographically signed</span>
        </div>
      </TerminalCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: report form */}
        <div className="space-y-4">
          <TerminalCard title={draft ? "NEW EVENT" : "REPORT FORM"} accent="blood" glow={!!draft}>
            {draft && draftMeta ? (
              <div className="space-y-3">
                <div className="text-xs text-terminal-green">
                  📍 pinned @ {draft.lat.toFixed(4)}, {draft.lng.toFixed(4)}
                </div>
                <div>
                  <label className="text-[10px] text-content-dim uppercase tracking-widest">Event type</label>
                  <select
                    value={formType}
                    onChange={(e) => {
                      setFormType(e.target.value as EventType);
                      setFormSeverity(EVENT_TYPES[e.target.value as EventType].defaultSeverity);
                    }}
                    className="w-full bg-abyss border border-border-dim px-2 py-1.5 text-xs text-content-primary mt-1"
                  >
                    {ALL_EVENT_TYPES.map((m) => (
                      <option key={m.type} value={m.type}>{m.glyph} {m.label} (gravity {m.gravity})</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-content-dim mt-1">{draftMeta.description}</p>
                </div>
                <div>
                  <label className="text-[10px] text-content-dim uppercase tracking-widest">Title</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="headline of the incident"
                    maxLength={120}
                    className="w-full bg-abyss border border-border-dim px-2 py-1.5 text-xs text-content-primary mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-content-dim uppercase tracking-widest">Description (optional)</label>
                  <textarea
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="what happened, sources, context"
                    rows={2}
                    className="w-full bg-abyss border border-border-dim px-2 py-1.5 text-xs text-content-primary mt-1 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-content-dim uppercase tracking-widest">Location</label>
                    <input
                      type="text"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      placeholder="city, country"
                      className="w-full bg-abyss border border-border-dim px-2 py-1.5 text-xs text-content-primary mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-content-dim uppercase tracking-widest">ISO3</label>
                    <input
                      type="text"
                      value={formIso3}
                      onChange={(e) => setFormIso3(e.target.value.toUpperCase().slice(0, 3))}
                      placeholder="e.g. SDN"
                      className="w-full bg-abyss border border-border-dim px-2 py-1.5 text-xs text-content-primary mt-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-content-dim uppercase tracking-widest">Severity</label>
                  <div className="flex gap-1 mt-1">
                    {SEVERITY_ORDER.map((s) => (
                      <button
                        key={s}
                        onClick={() => { setFormSeverity(s); sound.select(); }}
                        className="flex-1 text-[10px] px-1 py-1 border transition-colors"
                        style={formSeverity === s
                          ? { borderColor: SEVERITY_INFO[s].color, color: SEVERITY_INFO[s].color }
                          : { borderColor: "var(--color-border-dim)", color: "var(--color-content-secondary)" }}
                      >
                        {SEVERITY_INFO[s].label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-[10px] text-content-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formSign}
                    onChange={(e) => setFormSign(e.target.checked)}
                    className="accent-[var(--color-terminal-green)]"
                  />
                  sign with anonymous key ({identity ? "ready" : "unavailable"})
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={submitEvent}
                    disabled={!formTitle.trim()}
                    className="flex-1 px-3 py-2 text-xs font-bold bg-blood text-white hover:bg-blood-bright transition-colors disabled:opacity-40"
                  >
                    [ SEAL EVENT ]
                  </button>
                  <button
                    onClick={() => { setDraft(null); sound.error(); }}
                    className="px-3 py-2 text-xs border border-border-dim text-content-secondary hover:border-blood"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-[9px] text-content-dim">
                  filing as <span className="text-content-secondary font-mono">{handle}</span>. the event is
                  hash-chained to the current tip and stored locally.
                </p>
              </div>
            ) : (
              <p className="text-xs text-content-dim">
                Click the map to pin a new event, then fill the form. Each filed event is hash-chained to the
                previous one and optionally signed — forming a tamper-evident append-only record.
              </p>
            )}
          </TerminalCard>

          {/* SELECTED EVENT INSPECTOR */}
          {selected && (
            <TerminalCard title="EVENT INSPECTOR" accent="green" glow>
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg leading-none">{EVENT_TYPES[selected.type].glyph}</span>
                  <span className="text-xs font-bold" style={{ color: SEVERITY_INFO[selected.severity].color }}>
                    {selected.title}
                  </span>
                  <StatusPill color={sevPill(selected.severity)}>
                    {SEVERITY_INFO[selected.severity].label}
                  </StatusPill>
                  <StatusPill color={statusPill(verificationStatus(selected))}>
                    {verificationStatus(selected)}
                  </StatusPill>
                </div>
                {selected.location && (
                  <div className="text-[11px] text-content-secondary">📍 {selected.location}{selected.iso3 ? ` (${selected.iso3})` : ""}</div>
                )}
                {selected.description && (
                  <p className="text-[11px] text-content-primary">{selected.description}</p>
                )}
                <div className="text-[10px] text-content-dim space-y-0.5 font-mono">
                  <div>hash: <span className="text-content-secondary">{shortHash(selected.hash)}</span></div>
                  <div>prev:  <span className="text-content-secondary">{shortHash(selected.prevHash)}</span></div>
                  <div>by:    <span className="text-content-secondary">{selected.signerHandle}</span> {selected.signature ? "✍ signed" : "✗ unsigned"}</div>
                </div>

                {/* Corroboration controls */}
                <div className="pt-2 border-t border-border-dim">
                  <label className="text-[10px] text-content-dim uppercase tracking-widest">Corroborate</label>
                  <div className="flex gap-1 mt-1">
                    {(["witness", "documentary", "expert"] as ProofType[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => { setCorrProof(p); sound.select(); }}
                        className="flex-1 text-[9px] px-1 py-1 border transition-colors"
                        style={corrProof === p
                          ? { borderColor: "var(--color-terminal-green)", color: "var(--color-terminal-green)" }
                          : { borderColor: "var(--color-border-dim)", color: "var(--color-content-secondary)" }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => corroborate(selected.id)}
                    className="mt-2 w-full px-3 py-1.5 text-[10px] font-bold border border-terminal-green text-terminal-green hover:bg-terminal-green/10 transition-colors"
                  >
                    ✓ ATTEST ({selected.corroborations.length} so far)
                  </button>
                  {selected.corroborations.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {selected.corroborations.map((c, i) => (
                        <div key={i} className="text-[9px] text-content-dim">
                          ✓ {c.handle} · {c.proofType}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => removeEvent(selected.id)}
                  className="w-full px-3 py-1.5 text-[10px] border border-border-dim text-content-dim hover:border-blood hover:text-blood-bright transition-colors"
                >
                  ✕ REMOVE EVENT
                </button>
              </div>
            </TerminalCard>
          )}
        </div>

        {/* RIGHT (2 cols): timeline + feed */}
        <div className="lg:col-span-2 space-y-4">
          {/* TIMELINE */}
          {buckets.length > 0 && (
            <TerminalCard title="TIMELINE" accent="amber">
              <div className="flex items-end gap-0.5 h-24 overflow-x-auto pb-1">
                {buckets.map((b, i) => {
                  const max = Math.max(1, ...buckets.map((x) => x.events.length));
                  const h = (b.events.length / max) * 100;
                  const avgIntensity = b.events.length
                    ? b.events.reduce((s, e) => s + effectiveIntensity(e), 0) / b.events.length
                    : 0;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (b.events[0]) {
                          setSelectedId(b.events[0].id);
                          sound.nav();
                        }
                      }}
                      title={`${b.label} — ${b.events.length} event(s)`}
                      className="flex-1 min-w-[20px] flex flex-col items-center justify-end h-full group"
                    >
                      <span className="text-[9px] text-content-dim mb-0.5 group-hover:text-content-secondary">
                        {b.events.length || ""}
                      </span>
                      <div
                        className="w-full transition-all group-hover:opacity-80"
                        style={{
                          height: `${Math.max(2, h)}%`,
                          backgroundColor: b.events.length ? heatColor(avgIntensity) : "var(--color-border-dim)",
                        }}
                      />
                      <span className="text-[8px] text-content-dim mt-0.5 whitespace-nowrap rotate-0">
                        {b.label.slice(5)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </TerminalCard>
          )}

          {/* FEED */}
          <TerminalCard title="EVENT FEED" accent="blood">
            {events.length === 0 ? (
              <p className="text-xs text-content-dim py-4 text-center">
                Chain is empty. Load the demo dataset or pin an event on the map.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
                {[...events].reverse().map((event) => {
                  const meta = EVENT_TYPES[event.type];
                  const sev = SEVERITY_INFO[event.severity];
                  const intensity = effectiveIntensity(event);
                  const status = verificationStatus(event);
                  const isSelected = event.id === selectedId;
                  return (
                    <div
                      key={event.id}
                      className={`p-2 border transition-colors cursor-pointer ${isSelected ? "border-blood bg-blood/10" : "border-border-dim bg-abyss hover:border-border-bright"}`}
                      onClick={() => setSelectedId(isSelected ? null : event.id)}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg leading-none">{meta.glyph}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold truncate" style={{ color: sev.color }}>
                              {event.title}
                            </span>
                            <StatusPill color={statusPill(status)}>{status}</StatusPill>
                          </div>
                          <div className="text-[10px] text-content-dim mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{meta.label}</span>
                            {event.location && <span>📍 {event.location}</span>}
                            <span className="font-mono">{shortHash(event.hash)}</span>
                          </div>
                          <div className="text-[9px] text-content-dim mt-0.5 flex items-center gap-2">
                            <span>by {event.signerHandle}</span>
                            {event.signature && <span style={{ color: "var(--color-terminal-green)" }}>✍ signed</span>}
                            {event.corroborations.length > 0 && (
                              <span style={{ color: "var(--color-warning-amber)" }}>
                                ✓ {event.corroborations.length}
                              </span>
                            )}
                            <span>{new Date(event.ts).toLocaleDateString()}</span>
                          </div>
                        </div>
                        {/* intensity bar */}
                        <div className="flex flex-col items-end gap-1">
                          <div className="w-14 h-1.5 bg-void border border-border-dim">
                            <div className="h-full" style={{ width: `${intensity}%`, backgroundColor: heatColor(intensity) }} />
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); corroborate(event.id); }}
                            className="text-[9px] px-1 border border-border-dim text-terminal-green hover:border-terminal-green"
                            title="Corroborate"
                          >
                            ✓
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TerminalCard>
        </div>
      </div>

      {/* PRIVACY / PANIC */}
      <TerminalCard title="PRIVACY & DATA" accent="amber" className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] text-content-dim flex-1 min-w-[200px]">
            All {events.length} events and your anonymous keypair are stored only in this browser (localStorage).
            The chain is append-only and tamper-evident — export it to verify against another device. Use purge to
            start a fresh chain.
          </span>
          <button
            onClick={() => { if (confirm("Destroy the entire chain and start fresh?")) purgeAll(); }}
            className="text-[10px] px-3 py-2 border border-blood/50 text-blood-bright hover:bg-blood/10"
          >
            ⚠ PURGE CHAIN
          </button>
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

function rand(n: number): string {
  return Math.random()
    .toString(36)
    .replace(/[^a-z0-9]/g, "")
    .slice(0, n)
    .toUpperCase()
    .padEnd(n, "X");
}
