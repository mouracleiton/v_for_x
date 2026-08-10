"use client";

/**
 * V FOR X — The Roster
 *
 * A crisis-response "yellow pages": a directory of lawyers, doctors,
 * journalists, digital-security trainers and other vetted helpers.
 *
 * Trust is portable, not centralized:
 *   • every entry is self-attested (signed with the helper's own ECDSA key)
 *   • peers add signed vouches that verify against their own public keys
 *   • the whole directory is signed JSON — no backend, no registry authority
 *
 * Everything here is client-side. The committed seed roster ships with
 * real, browser-verifiable signatures; visitors can also add their own
 * signed entry, vouch for others, and import/export rosters as JSON.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import DataBar from "@/components/ui/DataBar";
import { sound } from "@/lib/sound";
import backbone from "@/data/world_backbone.json";
import rosterSeed from "@/data/roster.json";
import type { WorldBackbone } from "@/lib/types";
import {
  CATEGORIES,
  AVAILABILITY,
  TRUST_TIERS,
  categoryMeta,
  availabilityMeta,
  fingerprintOf,
  buildView,
  filterViews,
  rosterStats,
  mergeHelpers,
  parseRoster,
  serializeHelpers,
  generateKeyPair,
  signHelper,
  signVouch,
  verifyHelper,
  verifyVouch,
  hasCrypto,
  EMPTY_FILTER,
  type Helper,
  type HelperCategory,
  type Availability as Avail,
  type Vouch,
  type RosterFilter,
  type HelperView,
  type TrustTier,
} from "@/lib/roster";

const DATA = backbone as WorldBackbone;
const COUNTRY_NAME = new Map(DATA.countries.map((c) => [c.iso3, c.name_en]));
const COUNTRY_REGION = new Map(DATA.countries.map((c) => [c.iso3, c.region]));

const LANG_LABELS: Record<string, string> = {
  en: "English", pt: "Português", es: "Español", fr: "Français", zh: "中文",
  ja: "日本語", ko: "한국어", hi: "हिन्दी", ar: "العربية", ru: "Русский",
  de: "Deutsch", fa: "فارسی", ha: "Hausa", wo: "Wolof", am: "Amharic",
  ti: "Tigrinya", ne: "नेपाली",
};
function langLabel(code: string): string {
  return LANG_LABELS[code] ?? code.toUpperCase();
}
function countryName(iso3: string): string {
  return COUNTRY_NAME.get(iso3) ?? iso3;
}

const STORAGE_HELPERS = "vfx-roster-local";
const STORAGE_IDENTITY = "vfx-roster-identity";

interface Identity {
  handle: string;
  publicKey: string;
  privateKey: string;
}

interface VerifyState {
  self: boolean;
  vouches: number;
}

function tierColor(tier: TrustTier): string {
  return TRUST_TIERS.find((t) => t.id === tier)?.color ?? "var(--color-content-dim)";
}
function tierLabel(tier: TrustTier): string {
  return TRUST_TIERS.find((t) => t.id === tier)?.label ?? "UNVERIFIED";
}

const SEED = (rosterSeed as { helpers: Helper[] }).helpers;

/* ═══════════════════════════════════════════════════════════════
   Helper card
   ═══════════════════════════════════════════════════════════════ */

function HelperCard({
  view,
  verify,
  onSelect,
}: {
  view: HelperView;
  verify?: VerifyState;
  onSelect: () => void;
}) {
  const h = view.helper;
  const meta = categoryMeta(h.category);
  const avail = availabilityMeta(h.availability);
  return (
    <button
      onClick={onSelect}
      className="text-left terminal-card p-3 hover:pulse-blood transition-all flex flex-col gap-2 group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-lg leading-none"
              style={{ color: "var(--color-blood-bright)" }}
              aria-hidden
            >
              {meta.glyph}
            </span>
            <span className="text-sm font-bold text-content-primary truncate group-hover:text-blood-bright">
              {h.handle}
            </span>
          </div>
          <div className="text-[10px] text-content-dim mt-0.5">
            {meta.label} · {h.id}
          </div>
        </div>
        <span
          className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 border whitespace-nowrap"
          style={{ color: tierColor(view.trustTier), borderColor: tierColor(view.trustTier) }}
          title={`Trust score ${view.trustScore}`}
        >
          {tierLabel(view.trustTier)}
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        <StatusPill color="dim">
          {countryName(h.country)}
          {h.region ? ` · ${h.region}` : ""}
        </StatusPill>
        <span
          className="inline-pill inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider border"
          style={{ color: avail.color, borderColor: avail.color, background: "var(--color-panel)" }}
        >
          {avail.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {h.specialties.slice(0, 3).map((s) => (
          <span key={s} className="text-[10px] text-content-secondary bg-panel px-1.5 py-0.5 border border-border-dim">
            {s}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 text-[10px] text-content-dim mt-auto pt-1">
        <span title="Working languages">
          {h.languages.slice(0, 4).map((l) => langLabel(l)).join(" · ")}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border-dim">
        <div className="flex items-center gap-2 text-[10px]">
          <span
            className={verify?.self ? "text-terminal-green" : "text-content-dim"}
            title={verify?.self ? "Self-attested signature verified" : "Verifying…"}
          >
            {verify?.self ? "✓ SIG" : "… SIG"}
          </span>
          <span
            className={view.verifiedVouches > 0 ? "text-warning-amber" : "text-content-dim"}
            title="Verified peer vouches"
          >
            ✚ {view.verifiedVouches} VOUCH
          </span>
          <span className="text-content-dim" title="Credentials">
            ◆ {h.credentials.length} CRED
          </span>
        </div>
        <span className="text-[9px] text-blood-bright group-hover:underline">OPEN ▸</span>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Detail modal
   ═══════════════════════════════════════════════════════════════ */

function DetailModal({
  view,
  verify,
  canVouch,
  onVouch,
  onClose,
}: {
  view: HelperView;
  verify?: VerifyState;
  canVouch: boolean;
  onVouch: () => void;
  onClose: () => void;
}) {
  const h = view.helper;
  const meta = categoryMeta(h.category);
  const avail = availabilityMeta(h.availability);
  const [copied, setCopied] = useState(false);
  const signedJson = useMemo(() => JSON.stringify(h, null, 2), [h]);

  const copy = () => {
    navigator.clipboard?.writeText(signedJson).then(() => {
      setCopied(true);
      sound.success();
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-start md:items-center justify-center p-3 overflow-y-auto" onClick={onClose}>
      <div
        className="terminal-card p-4 max-w-2xl w-full my-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3 pb-3 border-b border-border-dim">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-2xl" style={{ color: "var(--color-blood-bright)" }} aria-hidden>{meta.glyph}</span>
              <h2 className="text-xl font-bold text-blood-bright truncate">{h.handle}</h2>
            </div>
            <div className="text-xs text-content-secondary mt-1">
              {meta.label} · {meta.blurb} · <span className="text-content-dim">{h.id}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-content-dim hover:text-blood-bright text-xl leading-none px-2" aria-label="Close">✕</button>
        </div>

        {/* trust + status row */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="inline-pill px-2 py-1 text-xs border" style={{ color: tierColor(view.trustTier), borderColor: tierColor(view.trustTier) }}>
            {tierLabel(view.trustTier)} · score {view.trustScore}
          </span>
          <span className="inline-pill px-2 py-1 text-xs border" style={{ color: avail.color, borderColor: avail.color }}>
            {avail.label}
          </span>
          <StatusPill color={verify?.self ? "green" : "dim"}>
            {verify?.self ? "✓ SELF-ATTESTED (SIG VERIFIED)" : "… VERIFYING SIGNATURE"}
          </StatusPill>
        </div>

        {/* trust breakdown */}
        <TerminalCard title="TRUST BREAKDOWN" accent="green" className="mb-4">
          <DataBar value={view.trustScore} max={15} label="Trust score (self +2 · vouches +2 each · evidence +1 each)" />
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div><div className="text-lg font-bold text-terminal-green">{verify?.self ? "✓" : "—"}</div><div className="text-[10px] text-content-dim">SELF-SIG</div></div>
            <div><div className="text-lg font-bold text-warning-amber">{view.verifiedVouches}</div><div className="text-[10px] text-content-dim">VOUCHES</div></div>
            <div><div className="text-lg font-bold text-content-primary">{h.credentials.length}</div><div className="text-[10px] text-content-dim">CREDS</div></div>
          </div>
        </TerminalCard>

        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <TerminalCard title="LOCATION" accent="blood">
            <div className="text-sm text-content-primary">{countryName(h.country)}</div>
            {h.region && <div className="text-xs text-content-secondary">{h.region}</div>}
            <div className="text-[10px] text-content-dim mt-1">{COUNTRY_REGION.get(h.country) ?? ""}</div>
          </TerminalCard>
          <TerminalCard title="LANGUAGES" accent="blood">
            <div className="flex flex-wrap gap-1">
              {h.languages.map((l) => (
                <span key={l} className="text-xs bg-panel px-1.5 py-0.5 border border-border-dim text-content-secondary">{langLabel(l)}</span>
              ))}
            </div>
          </TerminalCard>
        </div>

        <TerminalCard title="SPECIALTIES" accent="blood" className="mb-4">
          <div className="flex flex-wrap gap-1.5">
            {h.specialties.map((s) => (
              <span key={s} className="text-xs text-content-primary bg-panel px-2 py-1 border border-border-dim">{s}</span>
            ))}
          </div>
        </TerminalCard>

        {/* credentials */}
        {h.credentials.length > 0 && (
          <TerminalCard title="CREDENTIALS (SELF-ATTESTED)" accent="amber" className="mb-4">
            <ul className="space-y-2">
              {h.credentials.map((c, i) => (
                <li key={i} className="text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-warning-amber mt-0.5">◆</span>
                    <div className="min-w-0">
                      <div className="text-content-primary">{c.claim}</div>
                      {c.since && <div className="text-[10px] text-content-dim">since {c.since}</div>}
                      {c.evidence && (
                        <div className="text-[11px] text-terminal-green break-all mt-0.5">↳ {c.evidence}</div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </TerminalCard>
        )}

        {/* contact */}
        {Object.keys(h.contact).length > 0 && (
          <TerminalCard title="SECURE CONTACT" accent="green" className="mb-4">
            <div className="grid sm:grid-cols-2 gap-1.5 text-xs">
              {h.contact.signal && <div><span className="text-content-dim">Signal:</span> <span className="text-content-primary">{h.contact.signal}</span></div>}
              {h.contact.email && <div><span className="text-content-dim">Email:</span> <span className="text-content-primary">{h.contact.email}</span></div>}
              {h.contact.pgp && <div><span className="text-content-dim">PGP:</span> <span className="text-content-primary">{h.contact.pgp}</span></div>}
              {h.contact.website && <div><span className="text-content-dim">Web:</span> <span className="text-terminal-green break-all">{h.contact.website}</span></div>}
              {h.contact.other && <div><span className="text-content-dim">Other:</span> <span className="text-content-primary">{h.contact.other}</span></div>}
            </div>
            <div className="text-[10px] text-content-dim mt-2">// Always verify you are contacting the real handler through a second channel before sharing anything sensitive.</div>
          </TerminalCard>
        )}

        {/* vouches */}
        <TerminalCard title={`PEER VOUCHES (${h.vouches.length})`} accent="amber" className="mb-4">
          {h.vouches.length === 0 ? (
            <div className="text-xs text-content-dim">// No peer vouches yet.</div>
          ) : (
            <ul className="space-y-2">
              {h.vouches.map((v, i) => (
                <VouchRow key={i} v={v} />
              ))}
            </ul>
          )}
          {canVouch && (
            <button onClick={onVouch} className="mt-3 w-full px-3 py-2 text-xs font-bold border border-warning-amber text-warning-amber hover:bg-warning-amber hover:text-abyss transition-colors">
              ✚ ADD A SIGNED VOUCH
            </button>
          )}
        </TerminalCard>

        {/* signing key + json */}
        <TerminalCard title="SIGNING KEY & SIGNED JSON" accent="blood">
          <div className="text-[11px] text-content-secondary mb-1">
            Fingerprint: <span className="text-blood-bright font-mono">{fingerprintOf(h.publicKey)}</span>
          </div>
          <details className="mt-1">
            <summary className="text-[11px] text-terminal-green cursor-pointer hover:underline">View signed envelope (JSON)</summary>
            <pre className="text-[9px] leading-tight text-content-dim bg-void border border-border-dim p-2 mt-1 overflow-x-auto max-h-48">{signedJson}</pre>
          </details>
          <div className="flex gap-2 mt-3">
            <button onClick={copy} className="flex-1 px-3 py-2 text-xs border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors">
              {copied ? "✓ COPIED" : "COPY SIGNED JSON"}
            </button>
          </div>
        </TerminalCard>
      </div>
    </div>
  );
}

function VouchRow({ v }: { v: Vouch }) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    verifyVouch(v).then(setOk);
  }, [v]);
  return (
    <li className="text-sm border-l-2 pl-2" style={{ borderColor: ok ? "var(--color-terminal-green)" : "var(--color-border-dim)" }}>
      <div className="flex items-center gap-2">
        <span className="text-warning-amber font-bold">{v.byHandle}</span>
        <span className="text-[10px] text-content-dim font-mono">{fingerprintOf(v.byPublicKey)}</span>
        {ok !== null && (
          <span className={`text-[10px] ${ok ? "text-terminal-green" : "text-blood-bright"}`}>
            {ok ? "✓ VERIFIED" : "✗ INVALID"}
          </span>
        )}
      </div>
      <div className="text-xs text-content-secondary mt-0.5">{v.relationship}</div>
      <div className="text-xs text-content-dim italic">"{v.note}"</div>
    </li>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Add-helper form (self-attest)
   ═══════════════════════════════════════════════════════════════ */

function AddForm({
  onAdd,
  onCancel,
}: {
  onAdd: (h: Helper) => void;
  onCancel: () => void;
}) {
  const [handle, setHandle] = useState("");
  const [category, setCategory] = useState<HelperCategory>("lawyer");
  const [specialties, setSpecialties] = useState("");
  const [country, setCountry] = useState("DEU");
  const [region, setRegion] = useState("");
  const [languages, setLanguages] = useState("en");
  const [availability, setAvailability] = useState<Avail>("available");
  const [signal, setSignal] = useState("");
  const [email, setEmail] = useState("");
  const [pgp, setPgp] = useState("");
  const [website, setWebsite] = useState("");
  const [claim, setClaim] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (!handle.trim() || !/^[a-z0-9-]{3,24}$/i.test(handle.trim())) {
      setErr("// Handle must be 3-24 chars: letters, numbers, hyphens.");
      sound.error();
      return;
    }
    if (!hasCrypto()) {
      setErr("// Web Crypto unavailable — needs a secure (https/localhost) context.");
      sound.error();
      return;
    }
    setBusy(true);
    try {
      const kp = await generateKeyPair();
      const creds = claim.trim()
        ? [{ claim: claim.trim(), evidence: evidence.trim() || undefined }]
        : [];
      const base: Helper = {
        id: `LOCAL-${Date.now().toString(36).toUpperCase()}`,
        version: 1,
        handle: handle.trim().toLowerCase(),
        category,
        specialties: specialties.split(",").map((s) => s.trim()).filter(Boolean),
        country: country.toUpperCase(),
        region: region.trim() || undefined,
        languages: languages.split(",").map((l) => l.trim().toLowerCase()).filter(Boolean),
        availability,
        contact: {
          signal: signal.trim() || undefined,
          email: email.trim() || undefined,
          pgp: pgp.trim() || undefined,
          website: website.trim() || undefined,
        },
        credentials: creds,
        vouches: [],
        publicKey: kp.publicKey,
        ts: Date.now(),
        signature: "",
      };
      base.signature = await signHelper(base, kp.privateKey);
      onAdd(base);
      sound.success();
    } catch (e) {
      setErr(`// ${(e as Error).message}`);
      sound.error();
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "w-full bg-abyss border border-border-dim px-2 py-1.5 text-sm text-content-primary focus:border-blood focus:outline-none";

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-start justify-center p-3 overflow-y-auto" onClick={onCancel}>
      <div className="terminal-card p-4 max-w-2xl w-full my-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-border-dim">
          <h2 className="text-lg font-bold text-blood-bright">ADD YOURSELF — SELF-ATTEST</h2>
          <button onClick={onCancel} className="text-content-dim hover:text-blood-bright text-xl leading-none px-2" aria-label="Close">✕</button>
        </div>
        <p className="text-xs text-content-secondary mb-4">
          // You will get a freshly generated ECDSA-P256 keypair in your browser. Your private key is never stored by this site — keep it to update or vouch later. The signed entry stays on this device until you export it.
        </p>

        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] text-content-dim uppercase tracking-wider">Handle *</span>
              <input className={inputCls} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="lex-mira" />
            </label>
            <label className="block">
              <span className="text-[10px] text-content-dim uppercase tracking-wider">Category</span>
              <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as HelperCategory)}>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.glyph} {c.label}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-[10px] text-content-dim uppercase tracking-wider">Specialties (comma separated)</span>
            <input className={inputCls} value={specialties} onChange={(e) => setSpecialties(e.target.value)} placeholder="asylum law, detention appeals" />
          </label>

          <div className="grid sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-[10px] text-content-dim uppercase tracking-wider">Country (ISO3)</span>
              <input className={inputCls} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="DEU" />
            </label>
            <label className="block">
              <span className="text-[10px] text-content-dim uppercase tracking-wider">Region / city</span>
              <input className={inputCls} value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Berlin / remote" />
            </label>
            <label className="block">
              <span className="text-[10px] text-content-dim uppercase tracking-wider">Availability</span>
              <select className={inputCls} value={availability} onChange={(e) => setAvailability(e.target.value as Avail)}>
                {AVAILABILITY.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-[10px] text-content-dim uppercase tracking-wider">Languages (ISO codes, comma separated)</span>
            <input className={inputCls} value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="en, de, ar" />
          </label>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] text-content-dim uppercase tracking-wider">Signal</span>
              <input className={inputCls} value={signal} onChange={(e) => setSignal(e.target.value)} placeholder="@handle" />
            </label>
            <label className="block">
              <span className="text-[10px] text-content-dim uppercase tracking-wider">Email</span>
              <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@protonmail.com" />
            </label>
            <label className="block">
              <span className="text-[10px] text-content-dim uppercase tracking-wider">PGP fingerprint</span>
              <input className={inputCls} value={pgp} onChange={(e) => setPgp(e.target.value)} placeholder="0xABCD1234" />
            </label>
            <label className="block">
              <span className="text-[10px] text-content-dim uppercase tracking-wider">Website</span>
              <input className={inputCls} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="example.org" />
            </label>
          </div>

          <div className="border-t border-border-dim pt-3">
            <span className="text-[10px] text-content-dim uppercase tracking-wider">Credential (self-attested)</span>
            <input className={`${inputCls} mt-1`} value={claim} onChange={(e) => setClaim(e.target.value)} placeholder="Licensed attorney — Bar #12345" />
            <input className={`${inputCls} mt-1`} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Evidence URL or reference (optional)" />
          </div>

          {err && <div className="text-xs text-blood-bright">{err}</div>}

          <div className="flex gap-2 pt-2">
            <button onClick={submit} disabled={busy} className="flex-1 px-3 py-2 text-xs font-bold bg-blood text-white hover:bg-blood-bright disabled:opacity-50 transition-colors">
              {busy ? "SIGNING…" : "✍ SIGN & ADD ENTRY"}
            </button>
            <button onClick={onCancel} className="px-3 py-2 text-xs border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors">CANCEL</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Vouch modal (peer-sign)
   ═══════════════════════════════════════════════════════════════ */

function VouchModal({
  target,
  identity,
  onEstablish,
  onVouch,
  onCancel,
}: {
  target: Helper;
  identity: Identity | null;
  onEstablish: (handle: string) => void;
  onVouch: (v: Vouch) => void;
  onCancel: () => void;
}) {
  const [handle, setHandle] = useState(identity?.handle ?? "");
  const [relationship, setRelationship] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputCls = "w-full bg-abyss border border-border-dim px-2 py-1.5 text-sm text-content-primary focus:border-blood focus:outline-none";

  const submit = async () => {
    setErr("");
    if (!identity) {
      if (!handle.trim() || !/^[a-z0-9-]{3,24}$/i.test(handle.trim())) {
        setErr("// Create an identity handle first (3-24 chars).");
        sound.error();
        return;
      }
      onEstablish(handle.trim().toLowerCase());
      return; // identity will be set on next render; user clicks again
    }
    if (!relationship.trim()) {
      setErr("// Describe your relationship to this helper.");
      sound.error();
      return;
    }
    if (!hasCrypto()) {
      setErr("// Web Crypto unavailable — needs a secure context.");
      sound.error();
      return;
    }
    setBusy(true);
    try {
      const base: Vouch = {
        helperId: target.id,
        byHandle: identity.handle,
        byPublicKey: identity.publicKey,
        relationship: relationship.trim(),
        note: note.trim() || "I vouch for this helper.",
        ts: Date.now(),
        signature: "",
      };
      base.signature = await signVouch(base, identity.privateKey);
      onVouch(base);
      sound.success();
    } catch (e) {
      setErr(`// ${(e as Error).message}`);
      sound.error();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-start justify-center p-3 overflow-y-auto" onClick={onCancel}>
      <div className="terminal-card p-4 max-w-lg w-full my-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-border-dim">
          <h2 className="text-lg font-bold text-warning-amber">✚ VOUCH FOR {target.handle}</h2>
          <button onClick={onCancel} className="text-content-dim hover:text-blood-bright text-xl leading-none px-2" aria-label="Close">✕</button>
        </div>

        {!identity ? (
          <div className="space-y-3">
            <p className="text-xs text-content-secondary">
              // To vouch you need a signing identity — a pseudonymous handle tied to an ECDSA-P256 keypair generated in your browser. It is stored only on this device.
            </p>
            <label className="block">
              <span className="text-[10px] text-content-dim uppercase tracking-wider">Your handle</span>
              <input className={inputCls} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="your-handle" />
            </label>
            {err && <div className="text-xs text-blood-bright">{err}</div>}
            <button onClick={submit} className="w-full px-3 py-2 text-xs font-bold bg-warning-amber text-abyss hover:opacity-90 transition-colors">
              CREATE IDENTITY
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-content-secondary">
              Signing as <span className="text-warning-amber font-bold">{identity.handle}</span>{" "}
              <span className="text-content-dim font-mono">{fingerprintOf(identity.publicKey)}</span>
            </div>
            <label className="block">
              <span className="text-[10px] text-content-dim uppercase tracking-wider">Relationship *</span>
              <input className={inputCls} value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="Worked together on 3 asylum appeals" />
            </label>
            <label className="block">
              <span className="text-[10px] text-content-dim uppercase tracking-wider">Endorsement</span>
              <textarea className={`${inputCls} min-h-[80px]`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="I can vouch for their skill and integrity in this work." />
            </label>
            {err && <div className="text-xs text-blood-bright">{err}</div>}
            <div className="flex gap-2">
              <button onClick={submit} disabled={busy} className="flex-1 px-3 py-2 text-xs font-bold bg-warning-amber text-abyss hover:opacity-90 disabled:opacity-50 transition-colors">
                {busy ? "SIGNING…" : "✚ SIGN VOUCH"}
              </button>
              <button onClick={onCancel} className="px-3 py-2 text-xs border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors">CANCEL</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════ */

export default function TheRosterPage() {
  const [localHelpers, setLocalHelpers] = useState<Helper[]>([]);
  const [filter, setFilter] = useState<RosterFilter>(EMPTY_FILTER);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [vouchForId, setVouchForId] = useState<string | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [verifyMap, setVerifyMap] = useState<Record<string, VerifyState>>({});
  const [verifying, setVerifying] = useState(true);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const allHelpers = useMemo(() => mergeHelpers(SEED, localHelpers), [localHelpers]);

  // Load local helpers + identity from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_HELPERS);
      if (raw) setLocalHelpers(JSON.parse(raw));
      const idRaw = localStorage.getItem(STORAGE_IDENTITY);
      if (idRaw) setIdentity(JSON.parse(idRaw));
    } catch { /* ignore */ }
  }, []);

  // Persist local helpers + identity
  useEffect(() => {
    try { localStorage.setItem(STORAGE_HELPERS, JSON.stringify(localHelpers)); } catch { /* ignore */ }
  }, [localHelpers]);
  useEffect(() => {
    try {
      if (identity) localStorage.setItem(STORAGE_IDENTITY, JSON.stringify(identity));
      else localStorage.removeItem(STORAGE_IDENTITY);
    } catch { /* ignore */ }
  }, [identity]);

  // Verify every signature on the client
  useEffect(() => {
    let cancelled = false;
    setVerifying(true);
    (async () => {
      const map: Record<string, VerifyState> = {};
      for (const h of allHelpers) {
        const self = await verifyHelper(h);
        let v = 0;
        for (const vou of h.vouches) if (await verifyVouch(vou)) v++;
        map[h.id] = { self, vouches: v };
      }
      if (!cancelled) {
        setVerifyMap(map);
        setVerifying(false);
      }
    })();
    return () => { cancelled = true; };
  }, [allHelpers]);

  const views = useMemo(
    () => allHelpers.map((h) => buildView(h, verifyMap[h.id]?.self ?? false, verifyMap[h.id]?.vouches ?? 0)),
    [allHelpers, verifyMap],
  );
  const filtered = useMemo(() => filterViews(views, filter), [views, filter]);
  const stats = useMemo(() => rosterStats(views), [views]);

  // Filter option lists
  const countryOptions = useMemo(
    () => Array.from(new Set(allHelpers.map((h) => h.country))).sort((a, b) => countryName(a).localeCompare(countryName(b))),
    [allHelpers],
  );
  const langOptions = useMemo(
    () => Array.from(new Set(allHelpers.flatMap((h) => h.languages))).sort(),
    [allHelpers],
  );

  const flash = (m: string) => { setMsg(m); sound.nav(); setTimeout(() => setMsg(""), 2500); };

  const handleAdd = (h: Helper) => {
    setLocalHelpers((prev) => mergeHelpers([h], prev));
    setShowAdd(false);
    flash(`// ${h.handle} self-attested and added. Signature generated locally.`);
  };

  const handleEstablishIdentity = async (handle: string) => {
    try {
      const kp = await generateKeyPair();
      setIdentity({ handle, ...kp });
      sound.success();
    } catch (e) {
      sound.error();
      flash(`// ${(e as Error).message}`);
    }
  };

  const handleVouch = (v: Vouch) => {
    const targetId = v.helperId;
    setLocalHelpers((prev) => {
      // vouches live on the helper; if local, update; if seed, clone into local overlay
      const seedTarget = SEED.find((s) => s.id === targetId);
      const existingLocal = prev.find((s) => s.id === targetId);
      if (existingLocal) {
        return prev.map((s) => s.id === targetId ? { ...s, vouches: [...s.vouches, v] } : s);
      }
      if (seedTarget) {
        const cloneWithVouch: Helper = { ...seedTarget, vouches: [...seedTarget.vouches, v] };
        // re-signing not needed: vouches are not part of the helper's own signature
        return mergeHelpers([cloneWithVouch], prev);
      }
      return prev;
    });
    setVouchForId(null);
    flash(`// Signed vouch added for ${v.helperId}.`);
  };

  const handleExport = () => {
    const text = serializeHelpers(allHelpers);
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `vfx-roster-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    sound.success();
    flash("// Exported signed roster JSON.");
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseRoster(String(reader.result));
        setLocalHelpers((prev) => mergeHelpers(prev, parsed.helpers));
        sound.success();
        flash(`// Imported ${parsed.helpers.length} signed entries.`);
      } catch (e) {
        sound.error();
        flash(`// Import failed: ${(e as Error).message}`);
      }
    };
    reader.readAsText(file);
  };

  const toggleArr = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const selected = selectedId ? allHelpers.find((h) => h.id === selectedId) ?? null : null;
  const selectedView = selected ? views.find((v) => v.helper.id === selected.id) ?? null : null;
  const vouchTarget = vouchForId ? allHelpers.find((h) => h.id === vouchForId) ?? null : null;

  const inputCls = "w-full bg-abyss border border-border-dim px-2 py-1.5 text-sm text-content-primary focus:border-blood focus:outline-none";

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">THE ROSTER</h1>
      <p className="text-content-secondary text-sm mb-6">
        // crisis-response yellow pages — lawyers, doctors, journalists, digital-security trainers.
        self-attested + peer-vouched credentials, each entry cryptographically signed. signed JSON, client-side verification, no backend.
      </p>

      {/* trust model */}
      <details className="mb-4 terminal-card p-3">
        <summary className="text-xs uppercase tracking-widest text-blood-bright cursor-pointer hover:underline">&gt; HOW TRUST WORKS</summary>
        <div className="text-xs text-content-secondary mt-2 space-y-1.5">
          <p>• <span className="text-terminal-green">Self-attestation</span>: a helper signs their own profile with an ECDSA-P256 keypair. The public key travels inside the entry — anyone can verify it offline.</p>
          <p>• <span className="text-warning-amber">Peer vouches</span>: other helpers sign short attestations bound to a helper&apos;s id. Vouches are independent — adding one never breaks the helper&apos;s own signature.</p>
          <p>• The whole directory is just <span className="text-content-primary">signed JSON</span>. Any copy of this site (see <span className="text-blood-bright">/fortress</span>) verifies the entire roster locally. No registry authority, no backend.</p>
          <p>• The trust score is a disclosed heuristic (self-sig +2, each verified vouch +2 up to 5, each evidenced credential +1 up to 3) — not an oracle. Always corroborate through a second channel before relying on an entry.</p>
        </div>
      </details>

      {/* stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        <TerminalCard accent="blood"><div className="text-center"><div className="text-2xl font-bold text-blood-bright">{stats.total}</div><div className="text-[10px] text-content-dim">HELPERS</div></div></TerminalCard>
        <TerminalCard accent="green"><div className="text-center"><div className="text-2xl font-bold text-terminal-green">{stats.verified}</div><div className="text-[10px] text-content-dim">SIG-VERIFIED</div></div></TerminalCard>
        <TerminalCard accent="amber"><div className="text-center"><div className="text-2xl font-bold text-warning-amber">{stats.vouches}</div><div className="text-[10px] text-content-dim">PEER VOUCHES</div></div></TerminalCard>
        <TerminalCard accent="blood"><div className="text-center"><div className="text-2xl font-bold text-content-primary">{stats.countries}</div><div className="text-[10px] text-content-dim">COUNTRIES</div></div></TerminalCard>
        <TerminalCard accent="green"><div className="text-center"><div className="text-2xl font-bold text-terminal-green">{stats.trusted}</div><div className="text-[10px] text-content-dim">TRUSTED</div></div></TerminalCard>
      </div>

      {/* action bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => { setShowAdd(true); sound.nav(); }} className="px-3 py-2 text-xs font-bold border border-blood text-blood-bright hover:bg-blood hover:text-white transition-colors">
          ✍ ADD / SELF-ATTEST
        </button>
        <button onClick={() => fileRef.current?.click()} className="px-3 py-2 text-xs border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors">
          ⤓ IMPORT JSON
        </button>
        <button onClick={handleExport} className="px-3 py-2 text-xs border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors">
          ⤒ EXPORT JSON
        </button>
        {identity && (
          <span className="px-3 py-2 text-[10px] text-content-dim border border-border-dim">
            ID: <span className="text-warning-amber">{identity.handle}</span> · {fingerprintOf(identity.publicKey)}
            <button onClick={() => { setIdentity(null); sound.select(); }} className="ml-2 text-content-dim hover:text-blood-bright underline">clear</button>
          </span>
        )}
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }} />
      </div>

      {verifying && <div className="text-xs text-terminal-green animate-pulse mb-3">// verifying {allHelpers.length} signatures…</div>}
      {msg && <div className="text-xs text-warning-amber mb-3">{msg}</div>}

      {/* filters */}
      <TerminalCard title="FILTER" accent="blood" className="mb-4">
        <div className="space-y-3">
          <input
            className={inputCls}
            placeholder="Search handle, specialty, country, credential…"
            value={filter.query}
            onChange={(e) => setFilter({ ...filter, query: e.target.value })}
          />

          {/* category pills */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => {
              const on = filter.categories.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => { setFilter({ ...filter, categories: toggleArr(filter.categories, c.id) }); sound.select(); }}
                  className={`px-2 py-1 text-[11px] border transition-colors ${on ? "bg-blood text-white border-blood" : "border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"}`}
                >
                  <span aria-hidden>{c.glyph}</span> {c.label}
                </button>
              );
            })}
          </div>

          <div className="grid sm:grid-cols-3 gap-2">
            <select className={inputCls} value={filter.countries[0] ?? ""} onChange={(e) => setFilter({ ...filter, countries: e.target.value ? [e.target.value] : [] })}>
              <option value="">All countries</option>
              {countryOptions.map((iso) => <option key={iso} value={iso}>{countryName(iso)} ({iso})</option>)}
            </select>
            <select className={inputCls} value={filter.languages[0] ?? ""} onChange={(e) => setFilter({ ...filter, languages: e.target.value ? [e.target.value] : [] })}>
              <option value="">All languages</option>
              {langOptions.map((l) => <option key={l} value={l}>{langLabel(l)} ({l})</option>)}
            </select>
            <select className={inputCls} value={filter.availability[0] ?? ""} onChange={(e) => setFilter({ ...filter, availability: e.target.value ? [e.target.value as Avail] : [] })}>
              <option value="">Any availability</option>
              {AVAILABILITY.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setFilter({ ...filter, onlyVerified: !filter.onlyVerified })} className={`px-2 py-1 text-[11px] border transition-colors ${filter.onlyVerified ? "bg-terminal-green text-abyss border-terminal-green" : "border-border-dim text-content-secondary hover:border-terminal-green"}`}>
              ✓ SIG-VERIFIED ONLY
            </button>
            <button onClick={() => setFilter({ ...filter, onlyVouched: !filter.onlyVouched })} className={`px-2 py-1 text-[11px] border transition-colors ${filter.onlyVouched ? "bg-warning-amber text-abyss border-warning-amber" : "border-border-dim text-content-secondary hover:border-warning-amber"}`}>
              ✚ VOUCHED ONLY
            </button>
            <div className="ml-auto flex items-center gap-1">
              <span className="text-[10px] text-content-dim uppercase">sort</span>
              <select className="bg-abyss border border-border-dim px-2 py-1 text-[11px] text-content-primary" value={filter.sort} onChange={(e) => setFilter({ ...filter, sort: e.target.value as RosterFilter["sort"] })}>
                <option value="trust">Trust</option>
                <option value="recent">Recent</option>
                <option value="handle">Handle A-Z</option>
              </select>
            </div>
          </div>
        </div>
      </TerminalCard>

      <div className="text-[10px] text-content-dim mb-3">
        // showing {filtered.length} of {allHelpers.length} helpers
      </div>

      {/* results */}
      {filtered.length === 0 ? (
        <TerminalCard accent="blood"><div className="text-sm text-content-dim text-center py-6">// no helpers match these filters.</div></TerminalCard>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((v) => (
            <HelperCard
              key={v.helper.id}
              view={v}
              verify={verifyMap[v.helper.id]}
              onSelect={() => { setSelectedId(v.helper.id); sound.select(); }}
            />
          ))}
        </div>
      )}

      {/* detail modal */}
      {selectedView && selected && (
        <DetailModal
          view={selectedView}
          verify={verifyMap[selected.id]}
          canVouch={hasCrypto()}
          onVouch={() => { setSelectedId(null); setVouchForId(selected.id); }}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* add modal */}
      {showAdd && <AddForm onAdd={handleAdd} onCancel={() => setShowAdd(false)} />}

      {/* vouch modal */}
      {vouchTarget && (
        <VouchModal
          target={vouchTarget}
          identity={identity}
          onEstablish={handleEstablishIdentity}
          onVouch={handleVouch}
          onCancel={() => setVouchForId(null)}
        />
      )}

      <div className="text-[10px] text-content-dim mt-8 pt-4 border-t border-border-dim">
        // The Roster is a directory of <span className="text-content-secondary">self-attested, peer-vouched</span> helpers — not endorsements by V FOR X. Verify independently before engaging.
      </div>
    </div>
  );
}
