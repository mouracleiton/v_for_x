"use client";

/**
 * V FOR X — The Mirror Ring (verified mirror directory)
 *
 * Static, privacy-preserving, zero-backend mirror directory. Operators
 * mint signed "I mirrored this" claims on /the-mirror/ (ECDSA P-256);
 * visitors paste the VFXM1: token here, the signature is verified locally
 * via lib/mirror.ts, and the mirror joins the ring — persisted only in
 * localStorage. No network call ever leaves this page during
 * verification; the ring is distributed by copy-paste.
 *
 * Honesty by construction: seed entries carry no signed claim and are
 * always tagged UNVERIFIED; a "SIGNED" pill means the ECDSA signature is
 * genuine, never that the operator is trustworthy.
 */

import { useEffect, useMemo, useState } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import {
  decodeClaim,
  verifyMirrorClaim,
  TRANSPORT_LABELS,
  type MirrorNode,
} from "@/lib/mirror";
import {
  claimToEntry,
  mergeIntoRing,
  ringShareText,
  seedRing,
  shortFingerprint,
  sortRing,
  ringStats,
  type RingEntry,
  type SeedEntry,
} from "@/lib/mirror-ring";
import seedData from "@/data/mirror-ring-seed.json";

const STORAGE_KEY = "vfx-mirror-ring";
const SEED = seedRing(seedData as SeedEntry[]);

const SWAP_CONFIRM =
  "This host may be run by anyone. Verify the fingerprint against your trusted copy of The Receipts.";

export default function TheMirrorRingPage() {
  /* ── ring state: user-verified entries only (seeds stay in the bundle) ── */
  const [ring, setRing] = useState<RingEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  /* ── verify & add form ── */
  const [token, setToken] = useState("");
  const [preview, setPreview] = useState<MirrorNode | null>(null);
  const [hostInput, setHostInput] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyOk, setVerifyOk] = useState<RingEntry | null>(null);

  /* ── share feedback ── */
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  /* ── load persisted ring ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setRing(JSON.parse(raw) as RingEntry[]);
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  /* ── persist user ring (never the seeds — they ship with the bundle) ── */
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ring)); } catch { /* ignore */ }
  }, [ring, loaded]);

  /* ── soft preview: decode the pasted token as you type (no crypto) ── */
  useEffect(() => {
    try {
      const node = decodeClaim(token);
      setPreview(node);
      setHostInput(node.endpoint);
    } catch {
      setPreview(null);
    }
  }, [token]);

  /* ── union view: seeds ∪ locally-verified ring, through the helpers ── */
  const visible = useMemo(() => {
    let out = SEED;
    for (const e of ring) out = mergeIntoRing(out, e);
    return sortRing(out);
  }, [ring]);

  const stats = ringStats(visible);

  /* ── VERIFY: signature + fields, then join the ring ── */
  const handleVerify = async () => {
    setVerifyError(null);
    setVerifyOk(null);
    const raw = token.trim();
    if (!raw) return;

    let node: MirrorNode;
    try {
      node = decodeClaim(raw);
    } catch (e) {
      setVerifyError(`not a valid VFXM1: token — ${e instanceof Error ? e.message : "malformed input"}.`);
      sound.error();
      return;
    }
    setPreview(node);

    const valid = await verifyMirrorClaim(node);
    if (!valid) {
      setVerifyError(
        "signature invalid — do not trust this claim. The token was tampered with, or the signature does not match the embedded public key.",
      );
      sound.error();
      return;
    }

    const claimedEndpoint = (node.endpoint ?? "").trim();
    const host = hostInput.trim() || claimedEndpoint;
    if (!host) {
      setVerifyError(
        "this claim carries no reachable host — enter the mirror host you want the ring to point at.",
      );
      return;
    }

    const entry = claimToEntry(node, host);
    setRing((prev) => mergeIntoRing(prev, entry));
    setVerifyOk(entry);
    setToken("");
    setHostInput("");
    setPreview(null);
    sound.success();
  };

  /* ── one-click host swap (same window — bookmarks/URLs persist) ── */
  const handleSwap = (host: string) => {
    if (!/^https?:\/\//i.test(host)) return;
    if (!window.confirm(`${SWAP_CONFIRM}\n\nOpen ${host} in this window?`)) return;
    window.location.href = host;
  };

  /* ── clipboard with textarea fallback ── */
  const copyText = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      throw new Error("no clipboard API");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch { /* ignore */ }
      return false;
    }
  };

  const handleCopyRing = async () => {
    const text = await ringShareText(visible);
    const ok = await copyText(text);
    setCopyState(ok ? "copied" : "failed");
    if (ok) sound.copy(); else sound.error();
    setTimeout(() => setCopyState("idle"), 2200);
  };

  const handleShareUrl = async () => {
    try {
      if (typeof navigator.share !== "function") {
        await copyText(window.location.href);
        setCopyState("copied");
        sound.copy();
        return;
      }
      await navigator.share({
        title: "V FOR X Mirror Ring",
        text: await ringShareText(visible),
        url: window.location.href,
      });
    } catch { /* user dismissed the share sheet */ }
  };

  /* ──────────────────────────────────────────────────────── */
  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <header className="space-y-2">
        <div className="text-xs uppercase tracking-widest" style={{ color: "var(--color-terminal-green)" }}>
          {"} verified mirror directory — one-click host swap"}
        </div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-content-primary)" }}>
          <span className="glitch" data-text="THE MIRROR RING">THE MIRROR RING</span>
        </h1>
        <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
          Every copy of the build is a node. Paste a signed{" "}
          <code style={{ color: "var(--color-command-bright)" }}>VFXM1:</code> claim token, verify it locally, and the
          mirror joins <em>your</em> ring — stored here, in this browser, nowhere else. Open any mirror, swap hosts in
          one click, and share the ring as plain text.
        </p>
      </header>

      {/* Stats line */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="mirrors" value={stats.total} />
        <Stat label="signed (verified)" value={stats.verified} accent />
        <Stat label="transports" value={Object.values(stats.byTransport).filter((n) => n > 0).length} />
        <Stat label="unverified" value={stats.total - stats.verified} />
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.keys(TRANSPORT_LABELS).map((t) => (
          <span key={t} className="text-[10px] px-2 py-0.5 border uppercase tracking-wider"
            style={{ borderColor: "var(--color-border-dim)", color: "var(--color-content-dim)" }}>
            {TRANSPORT_LABELS[t as keyof typeof TRANSPORT_LABELS].split(" ")[0]}: {stats.byTransport[t as keyof typeof stats.byTransport] ?? 0}
          </span>
        ))}
      </div>

      {/* ── RING LIST ── */}
      <TerminalCard title="the ring — seed + locally verified" accent="green" glow>
        <p className="text-sm mb-4" style={{ color: "var(--color-content-secondary)" }}>
          Green <strong style={{ color: "var(--color-terminal-green)" }}>SIGNED</strong> entries were verified against a
          real ECDSA claim in this browser. Amber{" "}
          <strong style={{ color: "var(--color-warning-amber)" }}>UNVERIFIED</strong> entries are public metadata only —
          including the seed below — and must not be trusted until a signed token is supplied.
        </p>

        {visible.length === 0 ? (
          <div className="text-xs p-4 border text-center" style={{ borderColor: "var(--color-border-dim)", color: "var(--color-content-dim)" }}>
            no mirrors in the ring — verify a claim token below to add your first one.
          </div>
        ) : (
          <div className="space-y-1">
            {visible.map((e) => (
              <div key={normalizeKey(e)}
                className="flex flex-wrap items-center gap-2 p-2 border text-xs"
                style={{ borderColor: "var(--color-border-dim)" }}>
                <span className="font-mono truncate max-w-[260px]"
                  style={{ color: e.verified ? "var(--color-blood-bright)" : "var(--color-content-primary)" }}
                  title={e.host}>
                  {e.host}
                </span>
                <StatusPill color={transportColor(e.transport)}>
                  {TRANSPORT_LABELS[e.transport].split(" ")[0]}
                </StatusPill>
                <span className="font-mono" style={{ color: "var(--color-content-dim)" }}>{e.region || "—"}</span>
                {e.verified ? (
                  <StatusPill color="green">SIGNED</StatusPill>
                ) : (
                  <StatusPill color="amber">UNVERIFIED</StatusPill>
                )}
                <span className="font-mono" style={{ color: "var(--color-content-dim)" }} title={e.fingerprint || "no claim on file"}>
                  {shortFingerprint(e.fingerprint)}
                </span>
                {e.handle && (
                  <span className="font-mono" style={{ color: "var(--color-terminal-green)" }}>{e.handle}</span>
                )}
                <span className="hidden md:inline truncate max-w-[180px]" style={{ color: "var(--color-content-dim)" }} title={e.note}>
                  {e.note}
                </span>
                <span className="flex gap-2 ml-auto">
                  {isOpenable(e.host) ? (
                    <a href={e.host} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] px-2 py-1 border uppercase tracking-wider transition-colors"
                      style={{ borderColor: "var(--color-border-bright)", color: "var(--color-content-secondary)" }}>
                      OPEN
                    </a>
                  ) : (
                    <span className="text-[10px] px-2 py-1 border uppercase tracking-wider opacity-40"
                      style={{ borderColor: "var(--color-border-dim)", color: "var(--color-content-dim)" }}>
                      OPEN
                    </span>
                  )}
                  <button onClick={() => handleSwap(e.host)} disabled={!isOpenable(e.host)}
                    className="text-[10px] px-2 py-1 border uppercase tracking-wider transition-colors disabled:opacity-40"
                    style={{ borderColor: isOpenable(e.host) ? "var(--color-terminal-green)" : "var(--color-border-dim)", color: isOpenable(e.host) ? "var(--color-terminal-green)" : "var(--color-content-dim)" }}>
                    SWAP TO THIS MIRROR
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] mt-3" style={{ color: "var(--color-content-dim)" }}>
          Your ring lives in localStorage under {STORAGE_KEY} — it never leaves this device, and it dies with
          this browser unless you share it (below) or re-verify tokens on a new device.
        </p>
      </TerminalCard>

      {/* ── VERIFY & ADD ── */}
      <TerminalCard title="verify & add — paste a VFXM1: claim token" accent="amber">
        <p className="text-sm mb-3" style={{ color: "var(--color-content-secondary)" }}>
          Tokens come from mirror operators — minted on{" "}
          <a href="/the-mirror/" style={{ color: "var(--color-command-bright)" }}>The Mirror</a>{" "}
          badge generator, or found in The Web / dead drops. Verification is 100% local: the ECDSA signature is
          checked against the key embedded in the token itself.
        </p>

        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="VFXM1:…"
          rows={3}
          spellCheck={false}
          className="w-full px-2 py-2 text-xs bg-[var(--color-void)] border rounded font-mono whitespace-pre-wrap break-all"
          style={{ borderColor: "var(--color-border-bright)", color: "var(--color-content-primary)" }}
        />

        {preview && (
          <div className="mt-3 p-2 border text-xs" style={{ borderColor: "var(--color-border-dim)" }}>
            <span style={{ color: "var(--color-content-dim)" }}>token decodes — signature not yet checked: </span>
            <StatusPill color={transportColor(preview.transport)}>
              {TRANSPORT_LABELS[preview.transport].split(" ")[0]}
            </StatusPill>{" "}
            <span className="font-mono" style={{ color: "var(--color-content-primary)" }}>{preview.handle}</span>{" "}
            <span className="font-mono" style={{ color: "var(--color-content-secondary)" }} title={preview.endpoint}>
              {preview.endpoint}
            </span>{" "}
            <span className="font-mono" style={{ color: "var(--color-content-dim)" }}>{preview.contentHash.slice(0, 12)}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-3 items-center">
          <input
            type="text"
            value={hostInput}
            onChange={(e) => setHostInput(e.target.value)}
            placeholder="host the ring should point at (defaults to the claim endpoint)"
            className="flex-1 min-w-[240px] px-2 py-2 text-xs bg-[var(--color-void)] border rounded font-mono"
            style={{ borderColor: "var(--color-border-bright)", color: "var(--color-content-primary)" }}
          />
          <button
            onClick={handleVerify}
            disabled={!token.trim()}
            className="text-xs px-4 py-2 border uppercase tracking-widest transition-colors disabled:opacity-40"
            style={{ borderColor: "var(--color-warning-amber)", color: "var(--color-warning-amber)", background: "var(--color-panel)" }}
          >
            verify + add to ring
          </button>
        </div>

        {verifyError && (
          <div className="text-[10px] mt-2" style={{ color: "var(--color-blood-bright)" }}>
            {verifyError}
          </div>
        )}
        {verifyOk && (
          <div className="mt-2">
            <StatusPill color="green">SIGNATURE VERIFIED — ADDED TO RING</StatusPill>
            <span className="text-[10px] ml-2 font-mono" style={{ color: "var(--color-content-dim)" }}>
              {verifyOk.host} · fp {shortFingerprint(verifyOk.fingerprint)} · {verifyOk.handle}
            </span>
          </div>
        )}
      </TerminalCard>

      {/* ── RING SHARE ── */}
      <TerminalCard title="ring share — carry the ring in plain text" accent="blood" glow>
        <p className="text-sm mb-3" style={{ color: "var(--color-content-secondary)" }}>
          Copy the whole ring — verified mirrors first, with a fingerprint root you can compare against another
          copy. Paste it in The Web, dead drops, QR stickers, forums — anywhere text survives.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleCopyRing}
            className="text-xs px-4 py-2 border uppercase tracking-widest transition-colors"
            style={{ borderColor: "var(--color-blood)", color: "var(--color-blood-bright)", background: "var(--color-panel)" }}>
            {copyState === "copied" ? "copied" : copyState === "failed" ? "copy failed" : "copy the ring"}
          </button>
          <button onClick={handleShareUrl}
            className="text-[10px] px-2 py-1 border uppercase tracking-wider transition-colors"
            style={{ borderColor: "var(--color-border-bright)", color: "var(--color-content-secondary)" }}>
            share url
          </button>
        </div>
        <pre className="mt-3 text-[10px] max-h-48 overflow-auto text-terminal-green bg-void border border-border-dim p-3 whitespace-pre-wrap break-all">
          {`V FOR X MIRROR RING — ${visible.length} mirrors\n${visible.slice(0, 6).map((e) => `${e.host}  (${TRANSPORT_LABELS[e.transport].split(" ")[0]}, ${e.region || "-"})  [${e.verified ? "VERIFIED" : "UNVERIFIED"}]`).join("\n")}${visible.length > 6 ? `\n… +${visible.length - 6} more` : ""}\nFingerprint root: ${"-".repeat(16)}… (full root in the copied block)`}
        </pre>
        <p className="text-[10px] mt-2" style={{ color: "var(--color-content-dim)" }}>
          PASTE IN THE WEB / DEAD DROPS — the ring is a text block, not a server. Anyone who pastes it back into
          the ring share card of another copy can merge it (or you can share tokens individually).
        </p>
      </TerminalCard>

      {/* ── HONEST INFORMATION ── */}
      <TerminalCard title="honest information — what a signature actually proves" accent="amber">
        <ol className="list-decimal pl-5 text-sm space-y-2" style={{ color: "var(--color-content-secondary)" }}>
          <li>
            <strong style={{ color: "var(--color-content-primary)" }}>Claims are minted by anyone.</strong>{" "}
            /the-mirror/ generates an anonymous ECDSA P-256 keypair in the operator&apos;s browser and signs a
            claim binding {"{ transport, endpoint, region, buildHash, kitVersion, ts }"} — the canonical content
            is hashed (SHA-256) and signed; the token carries the full signed JSON.
          </li>
          <li>
            <strong style={{ color: "var(--color-content-primary)" }}>Verification here is local crypto.</strong>{" "}
            {`"verify + add"`} re-derives the canonical content, recomputes its SHA-256, and checks the ECDSA
            signature against the public key embedded in the token. It proves the token was not tampered with and
            that whoever holds the private key signed it. It proves{" "}
            <em>nothing</em> about the operator&apos;s character or the mirror&apos;s contents.
          </li>
          <li>
            <strong style={{ color: "var(--color-content-primary)" }}>The ring is distributed, like the rest of the platform.</strong>{" "}
            There is no central registry. Your ring is a localStorage list; it merges peer-to-peer when people
            share claim tokens or the ring text block. This page adds no network calls during verification.
          </li>
          <li>
            <strong style={{ color: "var(--color-content-primary)" }}>ANYONE can add &ldquo;verified&rdquo; mirrors.</strong>{" "}
            Generating a key and minting a claim takes one click. A green SIGNED pill means the signature is
            genuine — not that the operator is trustworthy. Before you swap hosts, compare the claim&apos;s
            fingerprint against your trusted copy of{" "}
            <a href="/the-receipts/" style={{ color: "var(--color-command-bright)" }}>The Receipts</a> (the root
            manifest hash) and prefer mirrors whose fingerprints you can confirm on a second channel.
          </li>
          <li>
            <strong style={{ color: "var(--color-content-primary)" }}>Seed entries carry no claims.</strong>{" "}
            The seeded mirrors are public metadata only — deliberately unverified. They exist so the ring is not
            empty on first visit; they become trustworthy only when a signed token for the same host is verified.
          </li>
        </ol>
        <div className="text-xs mt-4 p-3 border" style={{ borderColor: "var(--color-border-dim)", color: "var(--color-content-dim)" }}>
          <span className="uppercase tracking-widest" style={{ color: "var(--color-warning-amber)" }}>how to get more claims:</span>{" "}
          mint your own on <a href="/the-mirror/" style={{ color: "var(--color-command-bright)" }}>The Mirror</a> (badge
          generator), find operator tokens in{" "}
          <a href="/the-web/" style={{ color: "var(--color-command-bright)" }}>The Web</a> channels and dead drops,
          carry them offline via{" "}
          <a href="/the-relay/" style={{ color: "var(--color-command-bright)" }}>The Relay</a>, and merge rings you
          receive by pasting tokens here. Every verified mirror you add strengthens the copy that stays readable.
        </div>
      </TerminalCard>

      {/* Cross-links */}
      <footer className="text-xs pt-2 border-t space-y-1"
        style={{ color: "var(--color-content-dim)", borderColor: "var(--color-border-dim)" }}>
        <p>
          Part of the distributed-infrastructure loop:{" "}
          <a href="/fortress/" style={{ color: "var(--color-command-bright)" }}>Fortress</a> (philosophy) →{" "}
          <a href="/the-mirror/" style={{ color: "var(--color-command-bright)" }}>The Mirror</a> (one-command kit) →{" "}
          <a href="/the-mirror-ring/" style={{ color: "var(--color-command-bright)" }}>The Mirror Ring</a> (find a copy).
        </p>
        <p>
          Verify build integrity against{" "}
          <a href="/the-receipts/" style={{ color: "var(--color-command-bright)" }}>The Receipts</a>; sync rings via{" "}
          <a href="/the-web/" style={{ color: "var(--color-command-bright)" }}>The Web</a> or offline via{" "}
          <a href="/the-relay/" style={{ color: "var(--color-command-bright)" }}>The Relay</a>.
        </p>
        <p style={{ color: "var(--color-content-dim)" }}>no central registry · no telemetry · the ring is what you paste.</p>
      </footer>
    </main>
  );
}

/* ── transport → pill color (same mapping as /the-mirror/) ── */
function transportColor(t: RingEntry["transport"]): "green" | "blood" | "amber" | "dim" {
  switch (t) {
    case "onion": return "blood";
    case "ipfs": return "green";
    case "mesh": return "amber";
    default: return "dim";
  }
}

/* ── can this browser reasonably OPEN/SWAP to the host? ── */
function isOpenable(host: string): boolean {
  return /^https?:\/\//i.test(host);
}

/* ── stable react key: host + claimedAt + verified ── */
function normalizeKey(e: RingEntry): string {
  return `${e.claimedAt}|${e.verified}|${e.host}`;
}

/* ── small stat tile (same as /the-mirror/) ── */
function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="p-2 border" style={{ borderColor: "var(--color-border-dim)" }}>
      <div className="text-lg font-bold font-mono"
        style={{ color: accent ? "var(--color-terminal-green)" : "var(--color-content-primary)" }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--color-content-dim)" }}>
        {label}
      </div>
    </div>
  );
}