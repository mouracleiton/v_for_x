"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/stores/useStore";
import { sound } from "@/lib/sound";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import {
  createActionCircle,
  joinCircle,
  getCircles,
  makePledge,
  getPledges,
  createDeadDrop,
  getDeadDrops,
  decryptDeadDrop,
  generateHandle,
  type ActionCircle,
  type Pledge,
  type DeadDrop,
} from "@/lib/action-network";

const data = backbone as WorldBackbone;

const ACTIONS = [
  "share_dossier",
  "organize_march",
  "contact_representative",
  "document_evidence",
  "spread_awareness",
  "mutual_aid",
];

const TTL_OPTIONS = [
  { hours: 1, label: "1 hour" },
  { hours: 6, label: "6 hours" },
  { hours: 24, label: "24 hours" },
  { hours: 48, label: "48 hours" },
  { hours: 72, label: "72 hours" },
];

export default function TheNetworkPage() {
  const { lang } = useStore();
  const [mounted, setMounted] = useState(false);
  const [handle, setHandle] = useState("VFX-····");

  // circles
  const [circles, setCircles] = useState<ActionCircle[]>([]);
  const [cTopic, setCTopic] = useState("");
  const [cCountry, setCCountry] = useState("");
  const [cDesc, setCDesc] = useState("");

  // pledges
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [pIso3, setPIso3] = useState("");
  const [pAction, setPAction] = useState(ACTIONS[0]);
  const [pAnonymous, setPAnonymous] = useState(true);

  // dead drops
  const [selectedCircle, setSelectedCircle] = useState("");
  const [drops, setDrops] = useState<DeadDrop[]>([]);
  const [dropContent, setDropContent] = useState("");
  const [dropTtl, setDropTtl] = useState(24);

  useEffect(() => {
    setMounted(true);
    setHandle(generateHandle());
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = useCallback(async () => {
    const [c, p] = await Promise.all([getCircles(), getPledges()]);
    setCircles(c);
    setPledges(p);
    if (c.length > 0 && !selectedCircle) {
      setSelectedCircle(c[0].id);
    }
  }, [selectedCircle]);

  // load dead drops when a circle is selected
  useEffect(() => {
    if (!selectedCircle) {
      setDrops([]);
      return;
    }
    void getDeadDrops(selectedCircle).then(setDrops);
  }, [selectedCircle]);

  /* ── circles ── */
  const handleCreateCircle = async () => {
    if (!cTopic.trim()) return;
    await createActionCircle(cTopic, cCountry, cDesc);
    setCTopic("");
    setCCountry("");
    setCDesc("");
    sound.success();
    void reload();
  };

  const handleJoin = async (id: string) => {
    await joinCircle(id);
    sound.select();
    void reload();
  };

  /* ── pledges ── */
  const handlePledge = async () => {
    if (!pIso3) return;
    await makePledge(pIso3, pAction, pAnonymous);
    sound.success();
    void reload();
  };

  /* ── dead drops ── */
  const handleCreateDrop = async () => {
    if (!selectedCircle || !dropContent.trim()) return;
    await createDeadDrop(selectedCircle, dropContent, dropTtl);
    setDropContent("");
    sound.success();
    const fresh = await getDeadDrops(selectedCircle);
    setDrops(fresh);
  };

  const countries = data.countries.slice().sort((a, b) => a.name_en.localeCompare(b.name_en));

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 pt-4">
        <div className="text-xs text-content-dim mb-1">// ANONYMOUS ACTION NETWORK</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          THE NETWORK
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          Coordinate anonymous action circles, public pledges, and self-destructing encrypted dead
          drops. Organise by country or crisis without exposing who you are.
        </p>
      </div>

      {/* Security warning */}
      <div className="terminal-card p-3 mb-6" style={{ borderColor: "rgba(196,43,62,0.4)" }}>
        <div className="flex items-start gap-2">
          <span className="text-blood-bright text-sm shrink-0">⚠</span>
          <p className="text-xs text-content-secondary">
            <span className="text-blood-bright font-bold">SECURITY:</span> This is a simulated,
            local-first network. All circles, pledges, and dead drops are stored only in your
            browser. Dead drops self-destruct on their TTL. Never include personally identifying
            information.
          </p>
        </div>
      </div>

      {/* Anonymous handle */}
      <TerminalCard title="Your Anonymous Handle" accent="green" className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-lg text-terminal-green glow-green font-bold">{handle}</span>
          <button
            onClick={() => {
              setHandle(generateHandle());
              sound.select();
            }}
            className="text-[10px] px-2 py-1 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green"
          >
            ↻ NEW
          </button>
          <span className="text-[10px] text-content-dim">
            Generated fresh each session. Used for pledges & dead drops. No registration, no email,
            no tracking.
          </span>
        </div>
      </TerminalCard>

      {/* ── Section 1: Action Circles ── */}
      <TerminalCard title="Action Circles" accent="blood" className="mb-6">
        <p className="text-xs text-content-secondary mb-4">
          Topic-based organising groups, keyed by country or crisis. Browse existing circles or
          found a new one.
        </p>

        {/* Create circle */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
          <input
            type="text"
            value={cTopic}
            onChange={(e) => {
              setCTopic(e.target.value);
              sound.keystroke();
            }}
            placeholder="Circle topic (e.g. Sudan famine response)"
            className="md:col-span-1 bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
          />
          <select
            value={cCountry}
            onChange={(e) => setCCountry(e.target.value)}
            className="bg-void border border-border-dim px-3 py-2 text-xs text-content-primary"
          >
            <option value="">— Country (optional) —</option>
            {countries.map((c) => (
              <option key={c.iso3} value={c.iso3}>
                {c.name_en} ({c.iso3})
              </option>
            ))}
          </select>
          <input
            type="text"
            value={cDesc}
            onChange={(e) => {
              setCDesc(e.target.value);
              sound.keystroke();
            }}
            placeholder="Short description…"
            className="bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
          />
        </div>
        <button
          onClick={handleCreateCircle}
          disabled={!cTopic.trim()}
          className="mb-4 px-4 py-2 text-xs border border-blood text-blood-bright hover:bg-blood hover:text-void disabled:opacity-30"
        >
          [ FOUND CIRCLE ]
        </button>

        {/* Circle list */}
        {circles.length === 0 ? (
          <div className="py-6 text-center text-content-dim text-xs">
            No circles yet. Found the first one above.
          </div>
        ) : (
          <div className="space-y-2">
            {circles.map((c) => {
              const country = data.countries.find((x) => x.iso3 === c.countryCode);
              const active = selectedCircle === c.id;
              return (
                <div
                  key={c.id}
                  className="p-3 border bg-void/50"
                  style={{
                    borderColor: active ? "var(--color-command)" : "var(--color-border-dim)",
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-content-primary font-bold">{c.topic}</span>
                        {country && <StatusPill color="dim">{country.name_en}</StatusPill>}
                        <StatusPill color="amber">{c.memberCount} member{c.memberCount === 1 ? "" : "s"}</StatusPill>
                      </div>
                      {c.description && (
                        <div className="text-xs text-content-secondary mt-1">{c.description}</div>
                      )}
                      <div className="text-[10px] text-content-dim mt-1">
                        Founded {new Date(c.createdAt).toISOString().slice(0, 10)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => handleJoin(c.id)}
                        className="text-[10px] px-2 py-1 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void"
                      >
                        + JOIN
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCircle(c.id);
                          sound.select();
                        }}
                        className="text-[10px] px-2 py-1 border border-border-dim text-content-secondary hover:border-command hover:text-command"
                      >
                        DROPS
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </TerminalCard>

      {/* ── Section 2: Pledge Wall ── */}
      <TerminalCard title="Pledge Wall — Public Commitment Ledger" accent="amber" className="mb-6">
        <p className="text-xs text-content-secondary mb-4">
          A public ledger of commitments. &ldquo;I pledge to [action] for [country].&rdquo; Anonymous
          by default — your handle rotates each session.
        </p>

        {/* Make pledge */}
        <div className="flex flex-wrap gap-2 mb-4">
          <select
            value={pIso3}
            onChange={(e) => setPIso3(e.target.value)}
            className="flex-1 min-w-[160px] bg-void border border-border-dim px-3 py-2 text-xs text-content-primary"
          >
            <option value="">— Country —</option>
            {countries.map((c) => (
              <option key={c.iso3} value={c.iso3}>
                {c.name_en} ({c.iso3})
              </option>
            ))}
          </select>
          <select
            value={pAction}
            onChange={(e) => setPAction(e.target.value)}
            className="bg-void border border-border-dim px-3 py-2 text-xs text-content-primary"
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs text-content-secondary px-2">
            <input
              type="checkbox"
              checked={pAnonymous}
              onChange={(e) => setPAnonymous(e.target.checked)}
            />
            anonymous
          </label>
          <button
            onClick={handlePledge}
            disabled={!pIso3}
            className="px-3 py-2 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void disabled:opacity-30"
          >
            + PLEDGE
          </button>
        </div>

        {/* Pledge list */}
        {pledges.length === 0 ? (
          <div className="py-6 text-center text-content-dim text-xs">No pledges yet.</div>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {pledges.map((p) => {
              const country = data.countries.find((x) => x.iso3 === p.iso3);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 p-2 border border-border-dim bg-void/40"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-xs font-bold shrink-0"
                      style={{
                        color: p.anonymous
                          ? "var(--color-content-dim)"
                          : "var(--color-terminal-green)",
                      }}
                    >
                      {p.handle}
                    </span>
                    <span className="text-xs text-content-secondary truncate">
                      pledges to <span className="text-blood-bright">{p.action.replace(/_/g, " ")}</span>{" "}
                      for {country?.name_en || p.iso3}
                    </span>
                  </div>
                  <span className="text-[10px] text-content-dim shrink-0">
                    {new Date(p.ts).toISOString().slice(0, 10)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </TerminalCard>

      {/* ── Section 3: Dead Drops ── */}
      <TerminalCard title="Dead Drops — Encrypted & Self-Destructing" accent="green" className="mb-6">
        <p className="text-xs text-content-secondary mb-4">
          Encrypted (AES-GCM) messages within a circle. Set a TTL — messages self-destruct when it
          expires and are purged from local storage.
        </p>

        {/* Circle selector */}
        <div className="flex items-center gap-2 mb-3">
          <select
            value={selectedCircle}
            onChange={(e) => setSelectedCircle(e.target.value)}
            className="flex-1 bg-void border border-border-dim px-3 py-2 text-xs text-content-primary"
          >
            <option value="">— Select a circle —</option>
            {circles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.topic}
              </option>
            ))}
          </select>
        </div>

        {selectedCircle ? (
          <>
            {/* Create drop */}
            <div className="flex flex-wrap gap-2 mb-4">
              <input
                type="text"
                value={dropContent}
                onChange={(e) => {
                  setDropContent(e.target.value);
                  sound.keystroke();
                }}
                onKeyDown={(e) => e.key === "Enter" && handleCreateDrop()}
                placeholder="Encrypted message…"
                maxLength={500}
                className="flex-1 min-w-[200px] bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-terminal-green focus:outline-none"
              />
              <select
                value={dropTtl}
                onChange={(e) => setDropTtl(Number(e.target.value))}
                className="bg-void border border-border-dim px-3 py-2 text-xs text-content-primary"
              >
                {TTL_OPTIONS.map((t) => (
                  <option key={t.hours} value={t.hours}>
                    TTL {t.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleCreateDrop}
                disabled={!dropContent.trim()}
                className="px-3 py-2 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void disabled:opacity-30"
              >
                + DROP
              </button>
            </div>

            {/* Drop list */}
            {drops.length === 0 ? (
              <div className="py-6 text-center text-content-dim text-xs">
                No active dead drops in this circle.
              </div>
            ) : (
              <div className="space-y-2">
                {drops.map((d) => (
                  <DeadDropItem key={d.id} drop={d} handle={handle} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="py-6 text-center text-content-dim text-xs">
            {circles.length === 0
              ? "Found or join a circle to exchange dead drops."
              : "Select a circle above to view its dead drops."}
          </div>
        )}
      </TerminalCard>

      {/* Footer note */}
      <div className="text-[10px] text-content-dim text-center mt-4">
        Network state: {mounted ? "LOCAL-FIRST · INDEXEDDB" : "…"} · {circles.length} circles ·{" "}
        {pledges.length} pledges · data never leaves this device
      </div>
    </div>
  );
}

/* Decrypts a dead drop for display and shows a live self-destruct countdown. */
function DeadDropItem({ drop, handle }: { drop: DeadDrop; handle: string }) {
  const [text, setText] = useState("[ decrypting… ]");
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    void decryptDeadDrop(drop).then(setText);
    const update = () => {
      const ms = drop.expiresAt - Date.now();
      if (ms <= 0) {
        setRemaining("EXPIRED");
        return;
      }
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setRemaining(`${h}h ${m}m left`);
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [drop]);

  return (
    <div className="p-3 border border-border-dim bg-void/50">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-terminal-green font-bold">▸ {handle}</span>
        <StatusPill color="green">{remaining || "…"}</StatusPill>
      </div>
      <div className="text-xs text-content-primary break-words">{text}</div>
      <div className="text-[9px] text-content-dim mt-1">
        {new Date(drop.ts).toISOString().slice(0, 16).replace("T", " ")} · encrypted (AES-GCM)
      </div>
    </div>
  );
}
