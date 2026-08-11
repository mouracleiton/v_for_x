"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import {
  MIRROR_KIT_VERSION,
  createMirrorClaimWithIdentity,
  verifyMirrorClaim,
  encodeClaim,
  decodeClaim,
  mergeNodeLists,
  summarizeNetwork,
  verifyNodeList,
  exportNodeList,
  parseNodeList,
  shortHash,
  isValidSha256,
  TRANSPORT_LABELS,
  ALL_TRANSPORTS,
  type MirrorNode,
  type MirrorTransport,
} from "@/lib/mirror";
import { ensureIdentity } from "@/lib/identity";

/* ═══════════════════════════════════════════════════════════
   V FOR X — The Mirror (one-command deployment kit)
   Fortress documents self-hosting; this automates it. A single
   command pulls the build, pins to IPFS, and stands up a node.
   The "I mirrored this" badge feeds a distributed, signed node
   list — no central registry, exactly like the rest of the
   platform.
   ═══════════════════════════════════════════════════════════ */

const NODES_STORAGE = "vfx:mirror:nodes";

const ONE_COMMAND =
  "curl -fsSL https://vforx.org/mirror/install.sh | bash";

const DEPLOY_PATHS: { id: string; label: string; code: string }[] = [
  {
    id: "docker",
    label: "Docker one-liner",
    code: `# Pull + run a prebuilt censorship-resistant mirror
docker build -t vfx-mirror https://github.com/mouracleiton/v_for_vigilance.git#main:v-for-x/mirror
docker run -d -p 8080:80 --name vfx vfx-mirror

# Build hash (paste into your badge):
docker exec vfx cat /usr/share/nginx/html/.vfx-build-hash`,
  },
  {
    id: "compose",
    label: "Full stack (web + IPFS + Tor)",
    code: `# web + kubo (IPFS) + Tor hidden service
cd mirror && docker compose up -d --build

# Your .onion address:
docker exec vfx-tor cat /var/lib/tor/vfx/hostname

# The pinned CID:
docker exec vfx-ipfs ipfs pin ls`,
  },
  {
    id: "cloudinit",
    label: "Cloud VM (cloud-init)",
    code: `# Paste mirror/cloud-init.yaml as the user-data when launching a
# fresh Debian/Ubuntu VM. On first boot it installs Docker, runs the
# installer with --pin-ipfs --tor, and writes the build hash + CID +
# .onion address to /var/log/vfx-mirror.log.

# Or one-shot on any existing box:
curl -fsSL https://vforx.org/mirror/install.sh | bash -s -- --tor --pin-ipfs`,
  },
  {
    id: "pi",
    label: "Raspberry Pi",
    code: `# On the Pi (ARM64 / ARMv7) — builds natively, serves the LAN
curl -fsSL https://vforx.org/mirror/pi-install.sh | sudo bash

# Then open http://<pi-ip>:8080 from any device on the network.
# A 3W node that keeps the data uncensorable forever.`,
  },
  {
    id: "ipfs",
    label: "IPFS pin (standalone)",
    code: `# Pin any existing build to IPFS so it stays available even if
# the origin disappears. Multiple pinners = multiple copies.
ipfs add -r --pin out/
# → bafybei...   (share the CID; access via https://ipfs.io/ipfs/<CID>/)`,
  },
];

export default function TheMirrorPage() {
  const [identityHandle, setIdentityHandle] = useState<string | null>(null);

  /* ── claim form ── */
  const [transport, setTransport] = useState<MirrorTransport>("onion");
  const [endpoint, setEndpoint] = useState("");
  const [region, setRegion] = useState("");
  const [buildHash, setBuildHash] = useState("");
  const [buildVersion, setBuildVersion] = useState("");

  /* ── minted claim ── */
  const [minted, setMinted] = useState<MirrorNode | null>(null);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintVerified, setMintVerified] = useState<boolean | null>(null);

  /* ── node list ── */
  const [nodes, setNodes] = useState<MirrorNode[]>([]);
  const [verifyStates, setVerifyStates] = useState<Record<string, boolean>>({});
  const [addToken, setAddToken] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── load persisted state ── */
  useEffect(() => {
    // Load unified identity
    void (async () => {
      try {
        const identity = await ensureIdentity();
        setIdentityHandle(identity.handle);
      } catch { /* ignore */ }
    })();
    try {
      const n = localStorage.getItem(NODES_STORAGE);
      if (n) setNodes(JSON.parse(n));
    } catch { /* ignore */ }
  }, []);

  /* ── helpers ── */
  const persistNodes = useCallback((next: MirrorNode[]) => {
    setNodes(next);
    try { localStorage.setItem(NODES_STORAGE, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const handleMint = useCallback(async () => {
    setMintError(null);
    setMintVerified(null);
    if (!identityHandle) { setMintError("Unified identity not available. Please ensure you have an identity created."); return; }
    try {
      const node = await createMirrorClaimWithIdentity({
        transport,
        endpoint,
        region: region || undefined,
        buildHash: buildHash || undefined,
        buildVersion: buildVersion || undefined,
      });
      setMinted(node);
      const ok = await verifyMirrorClaim(node);
      setMintVerified(ok);
      // auto-add to the local node list
      const merged = mergeNodeLists(nodes, [node]);
      persistNodes(merged);
      setVerifyStates((s) => ({ ...s, [node.id]: ok }));
      sound.success();
    } catch (e) {
      setMintError(e instanceof Error ? e.message : "Failed to mint claim.");
      sound.error();
    }
  }, [identityHandle, transport, endpoint, region, buildHash, buildVersion, nodes, persistNodes]);

  const handleAddToken = useCallback(async () => {
    setAddError(null);
    try {
      const node = decodeClaim(addToken);
      const ok = await verifyMirrorClaim(node);
      const merged = mergeNodeLists(nodes, [node]);
      persistNodes(merged);
      setVerifyStates((s) => ({ ...s, [node.id]: ok }));
      setAddToken("");
      sound.success();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Invalid token.");
      sound.error();
    }
  }, [addToken, nodes, persistNodes]);

  const handleVerifyAll = useCallback(async () => {
    const results = await verifyNodeList(nodes);
    const map: Record<string, boolean> = {};
    results.forEach((r) => { map[r.node.id] = r.valid; });
    setVerifyStates(map);
    sound.select();
  }, [nodes]);

  const handleImport = useCallback((file: File) => {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = parseNodeList(String(reader.result));
        const merged = mergeNodeLists(nodes, imported);
        persistNodes(merged);
        sound.success();
      } catch (e) {
        setImportError(e instanceof Error ? e.message : "Import failed.");
        sound.error();
      }
    };
    reader.readAsText(file);
  }, [nodes, persistNodes]);

  const handleExport = useCallback(() => {
    const json = exportNodeList(nodes);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vfx-mirror-nodes-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    sound.copy();
  }, [nodes]);

  const handleRemoveNode = useCallback((id: string) => {
    persistNodes(nodes.filter((n) => n.id !== id));
    sound.select();
  }, [nodes, persistNodes]);

  const summary = summarizeNetwork(nodes);

  /* ──────────────────────────────────────────────────────── */
  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <header className="space-y-2">
        <div className="text-xs uppercase tracking-widest" style={{ color: "var(--color-terminal-green)" }}>
          {"} one-command deployment kit"}
        </div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-content-primary)" }}>
          <span className="glitch" data-text="THE MIRROR">THE MIRROR</span>
        </h1>
        <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
          Fortress documents self-hosting — this automates it. One command pulls the latest static
          build, pins it to IPFS, and stands up a censorship-resistant node in under five minutes.
          Mint an <strong style={{ color: "var(--color-content-primary)" }}>&ldquo;I mirrored this&rdquo;</strong>{" "}
          badge and feed the distributed node list.
        </p>
      </header>

      {/* The one command */}
      <TerminalCard title="the one command" accent="green" glow>
        <p className="text-sm mb-3" style={{ color: "var(--color-content-secondary)" }}>
          Run this on any Linux box, VPS, or Pi. It downloads a prebuilt build, verifies the SHA-256,
          and serves it. Add <code style={{ color: "var(--color-command-bright)" }}>-s -- --tor --pin-ipfs</code>{" "}
          for the full censorship-resistant stack.
        </p>
        <CodeBlock id="onecmd" code={ONE_COMMAND} alwaysShow />
        <div className="flex flex-wrap gap-2 mt-3">
          {DEPLOY_PATHS.map((p) => (
            <button
              key={p.id}
              onClick={() => { navigator.clipboard?.writeText(p.code).catch(() => {}); sound.copy(); }}
              className="text-[10px] px-2 py-1 border uppercase tracking-wider transition-colors"
              style={{
                borderColor: "var(--color-border-bright)",
                color: "var(--color-content-secondary)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </TerminalCard>

      {/* Deployment paths */}
      {DEPLOY_PATHS.map((p) => (
        <TerminalCard key={p.id} title={p.label.toLowerCase()} accent="green">
          <CodeBlock id={p.id} code={p.code} alwaysShow />
        </TerminalCard>
      ))}

      {/* Build integrity */}
      <TerminalCard title="build integrity — how the badge is bound to a build" accent="amber">
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-content-secondary)" }}>
          The installer hashes every file in the build into a manifest, then hashes the manifest into a
          single <strong style={{ color: "var(--color-content-primary)" }}>root hash</strong>. The browser
          reproduces the <em>exact same</em> SHA-256 from <code>out/.vfx-manifest.json</code>, so a badge
          cryptographically binds a mirror claim to one immutable, verifiable build.
        </p>
        <div className="mt-3">
          <CodeBlock id="manifest" code={"# compute the root hash on any built out/ directory\n./mirror/manifest.sh ./out\n# → 3584b417f85996a5...   (paste this as your build hash)"} alwaysShow />
        </div>
        <div className="flex gap-2 mt-3">
          <StatusPill color="green">SHELL == BROWSER</StatusPill>
          <StatusPill color="dim">SHA-256 MANIFEST ROOT</StatusPill>
        </div>
      </TerminalCard>

      {/* ── Badge generator ── */}
      <TerminalCard title="i mirrored this — badge generator" accent="blood" glow>
        <p className="text-sm mb-4" style={{ color: "var(--color-content-secondary)" }}>
          Each operator holds an anonymous ECDSA P-256 keypair (client-side only). Sign a claim binding your
          mirror endpoint to a build hash. The badge is a self-contained token anyone can verify offline.
        </p>

        {/* Step 1: identity */}
        <div className="mb-4">
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--color-blood-bright)" }}>
            01 — operator identity
          </div>
          {identityHandle ? (
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill color="green">{identityHandle}</StatusPill>
              <span className="text-xs" style={{ color: "var(--color-content-dim)" }}>
                using unified identity (persistent across sessions)
              </span>
            </div>
          ) : (
            <div className="text-xs" style={{ color: "var(--color-content-dim)" }}>
              Loading unified identity...
            </div>
          )}
        </div>

        {/* Step 2: claim form */}
        <div className="mb-4">
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--color-blood-bright)" }}>
            02 — mirror details
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="transport">
              <select
                value={transport}
                onChange={(e) => setTransport(e.target.value as MirrorTransport)}
                className="w-full px-2 py-2 text-sm bg-[var(--color-void)] border rounded font-mono"
                style={{ borderColor: "var(--color-border-bright)", color: "var(--color-content-primary)" }}
              >
                {ALL_TRANSPORTS.map((t) => (
                  <option key={t} value={t}>{TRANSPORT_LABELS[t]}</option>
                ))}
              </select>
            </Field>
            <Field label="region / tag (optional)">
              <input
                type="text" value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="EU-WEST, meshtastic-7…"
                className="w-full px-2 py-2 text-sm bg-[var(--color-void)] border rounded font-mono"
                style={{ borderColor: "var(--color-border-bright)", color: "var(--color-content-primary)" }}
              />
            </Field>
            <Field label="endpoint (url / .onion / CID)" full>
              <input
                type="text" value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder={transport === "ipfs" ? "bafybei…" : transport === "onion" ? "vfx….onion" : "https://mirror.example.org"}
                className="w-full px-2 py-2 text-sm bg-[var(--color-void)] border rounded font-mono"
                style={{ borderColor: "var(--color-border-bright)", color: "var(--color-content-primary)" }}
              />
            </Field>
            <Field label="build hash (from install.sh)" full>
              <input
                type="text" value={buildHash}
                onChange={(e) => setBuildHash(e.target.value)}
                placeholder="64-char SHA-256, or leave blank for 'unknown'"
                spellCheck={false}
                className="w-full px-2 py-2 text-sm bg-[var(--color-void)] border rounded font-mono"
                style={{
                  borderColor: isValidSha256(buildHash) || !buildHash ? "var(--color-border-bright)" : "var(--color-blood)",
                  color: "var(--color-content-primary)",
                }}
              />
              {buildHash && !isValidSha256(buildHash) && (
                <span className="text-[10px]" style={{ color: "var(--color-blood-bright)" }}>
                  not a valid 64-char SHA-256 — badge will still mint but verification of the build itself will fail
                </span>
              )}
            </Field>
          </div>
        </div>

        {/* Step 3: mint */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={handleMint}
            disabled={!identityHandle || endpoint.trim().length < 3}
            className="text-xs px-4 py-2 border uppercase tracking-widest transition-colors disabled:opacity-40"
            style={{
              borderColor: "var(--color-blood)",
              color: "var(--color-blood-bright)",
              background: "var(--color-panel)",
            }}
          >
            mint badge
          </button>
          {mintError && <span className="text-xs" style={{ color: "var(--color-blood-bright)" }}>⚠ {mintError}</span>}
        </div>

        {minted && (
          <div className="space-y-4">
            <BadgeSVG node={minted} verified={mintVerified} />
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--color-content-dim)" }}>
                  shareable token {mintVerified === false && "(signature invalid)"}
                </div>
                <CodeBlock id="token" code={encodeClaim(minted)} alwaysShow small />
                <div className="text-[10px] mt-1" style={{ color: "var(--color-content-dim)" }}>
                  paste this into another node&apos;s &ldquo;add via token&rdquo; field, or share via The Web / dead drops.
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--color-content-dim)" }}>
                  raw claim (json)
                </div>
                <CodeBlock id="raw" code={JSON.stringify(minted, null, 2)} alwaysShow small />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {mintVerified ? (
                <StatusPill color="green">✓ SIGNATURE VERIFIED</StatusPill>
              ) : mintVerified === false ? (
                <StatusPill color="blood">✗ SIGNATURE INVALID</StatusPill>
              ) : null}
              <StatusPill color="dim">contentHash {shortHash(minted.contentHash)}</StatusPill>
              <StatusPill color="dim">kit v{minted.kitVersion}</StatusPill>
            </div>
          </div>
        )}
      </TerminalCard>

      {/* ── Distributed node list ── */}
      <TerminalCard title="distributed node list" accent="green" glow>
        <p className="text-sm mb-4" style={{ color: "var(--color-content-secondary)" }}>
          A local registry of signed mirror claims. There is no central server — merge lists peer-to-peer
          via The Web, dead drops, or QR. Every entry is independently verifiable.
        </p>

        {/* stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <Stat label="nodes" value={summary.total} />
          <Stat label="operators" value={summary.uniqueOperators} />
          <Stat label="builds" value={summary.distinctBuilds} />
          <Stat label="onion mirrors" value={summary.byTransport.onion} accent />
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {ALL_TRANSPORTS.map((t) => (
            <span key={t} className="text-[10px] px-2 py-0.5 border uppercase tracking-wider"
              style={{ borderColor: "var(--color-border-dim)", color: "var(--color-content-dim)" }}>
              {TRANSPORT_LABELS[t].split(" ")[0]}: {summary.byTransport[t]}
            </span>
          ))}
        </div>

        {/* add via token */}
        <div className="mb-4">
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--color-terminal-green)" }}>
            add via token
          </div>
          <div className="flex gap-2">
            <input
              type="text" value={addToken}
              onChange={(e) => setAddToken(e.target.value)}
              placeholder="VFXM1:…"
              className="flex-1 px-2 py-2 text-xs bg-[var(--color-void)] border rounded font-mono"
              style={{ borderColor: "var(--color-border-bright)", color: "var(--color-content-primary)" }}
            />
            <button
              onClick={handleAddToken}
              disabled={!addToken.trim()}
              className="text-xs px-3 py-2 border uppercase tracking-wider transition-colors disabled:opacity-40"
              style={{ borderColor: "var(--color-terminal-green)", color: "var(--color-terminal-green)" }}
            >
              verify + add
            </button>
          </div>
          {addError && <div className="text-[10px] mt-1" style={{ color: "var(--color-blood-bright)" }}>⚠ {addError}</div>}
        </div>

        {/* import / export / verify */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={handleVerifyAll}
            className="text-[10px] px-2 py-1 border uppercase tracking-wider transition-colors"
            style={{ borderColor: "var(--color-border-bright)", color: "var(--color-content-secondary)" }}>
            verify all signatures
          </button>
          <button onClick={handleExport}
            className="text-[10px] px-2 py-1 border uppercase tracking-wider transition-colors"
            style={{ borderColor: "var(--color-border-bright)", color: "var(--color-content-secondary)" }}>
            export json
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            className="text-[10px] px-2 py-1 border uppercase tracking-wider transition-colors"
            style={{ borderColor: "var(--color-border-bright)", color: "var(--color-content-secondary)" }}>
            import json (merge)
          </button>
          <input
            ref={fileInputRef} type="file" accept="application/json,.json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }}
          />
          {importError && <span className="text-[10px] self-center" style={{ color: "var(--color-blood-bright)" }}>⚠ {importError}</span>}
        </div>

        {/* node table */}
        {nodes.length === 0 ? (
          <div className="text-xs p-4 border text-center" style={{ borderColor: "var(--color-border-dim)", color: "var(--color-content-dim)" }}>
            no nodes yet — mint a badge above, or add one via token.
          </div>
        ) : (
          <div className="space-y-1">
            {nodes.map((n) => {
              const v = verifyStates[n.id];
              return (
                <div key={n.id}
                  className="flex flex-wrap items-center gap-2 p-2 border text-xs"
                  style={{ borderColor: "var(--color-border-dim)" }}>
                  <span className="font-mono" style={{ color: "var(--color-content-primary)" }}>{n.handle}</span>
                  <StatusPill color={transportColor(n.transport)}>
                    {TRANSPORT_LABELS[n.transport].split(" ")[0]}
                  </StatusPill>
                  <span className="font-mono truncate max-w-[220px]" style={{ color: "var(--color-content-secondary)" }} title={n.endpoint}>
                    {n.endpoint}
                  </span>
                  <span className="font-mono" style={{ color: "var(--color-content-dim)" }} title={n.buildHash}>
                    {isValidSha256(n.buildHash) ? shortHash(n.buildHash) : n.buildHash}
                  </span>
                  <span style={{ color: "var(--color-content-dim)" }}>{ageLabel(n.ts)}</span>
                  {v === true && <StatusPill color="green">✓</StatusPill>}
                  {v === false && <StatusPill color="blood">✗ bad sig</StatusPill>}
                  <button onClick={() => handleRemoveNode(n.id)}
                    className="ml-auto text-[10px] uppercase tracking-wider"
                    style={{ color: "var(--color-content-dim)" }}>
                    remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </TerminalCard>

      {/* Cross-links */}
      <footer className="text-xs pt-2 border-t space-y-1"
        style={{ color: "var(--color-content-dim)", borderColor: "var(--color-border-dim)" }}>
        <p>
          Part of the distributed-infrastructure loop:{" "}
          <a href="/fortress/" style={{ color: "var(--color-command-bright)" }}>Fortress</a> (philosophy) →{" "}
          <a href="/the-mirror/" style={{ color: "var(--color-command-bright)" }}>The Mirror</a> (automate it) →{" "}
          <a href="/the-onion/" style={{ color: "var(--color-command-bright)" }}>The Onion</a> (Tor guide).
        </p>
        <p>
          Sync node lists anonymously via <a href="/the-web/" style={{ color: "var(--color-command-bright)" }}>The Web</a>{" "}
          or offline via <a href="/the-relay/" style={{ color: "var(--color-command-bright)" }}>The Relay</a>.
        </p>
        <p style={{ color: "var(--color-content-dim)" }}>kit v{MIRROR_KIT_VERSION} · every copy of the build is a node.</p>
      </footer>
    </main>
  );
}

/* ── transport → pill color ── */
function transportColor(t: MirrorTransport): "green" | "blood" | "amber" | "dim" {
  switch (t) {
    case "onion": return "blood";
    case "ipfs": return "green";
    case "mesh": return "amber";
    default: return "dim";
  }
}

/* ── relative age label ── */
function ageLabel(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/* ── small stat tile ── */
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

/* ── form field wrapper ── */
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--color-content-dim)" }}>
        {label}
      </div>
      {children}
    </label>
  );
}

/* ── copyable code block ── */
function CodeBlock({ id, code, alwaysShow, small }: {
  id: string; code: string; alwaysShow?: boolean; small?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true); sound.copy(); setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  }, [code]);
  return (
    <div className="relative">
      <pre
        className={`${small ? "text-[10px] max-h-40" : "text-xs"} text-terminal-green bg-void border border-border-dim p-3 overflow-x-auto whitespace-pre-wrap break-all`}
      >
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-1 right-1 text-[9px] px-2 py-1 border uppercase tracking-wider transition-colors"
        style={{
          borderColor: copied ? "var(--color-terminal-green)" : "var(--color-border-bright)",
          color: copied ? "var(--color-terminal-green)" : "var(--color-content-secondary)",
          background: "var(--color-abyss)",
        }}
      >
        {copied ? "copied" : "copy"}
      </button>
      {alwaysShow && <span className="sr-only">{id}</span>}
    </div>
  );
}

/* ── the badge itself (inline SVG) ── */
function BadgeSVG({ node, verified }: { node: MirrorNode; verified: boolean | null }) {
  const transport = TRANSPORT_LABELS[node.transport].split(" ")[0];
  const fp = shortHash(node.contentHash);
  const buildTag = isValidSha256(node.buildHash) ? shortHash(node.buildHash) : node.buildHash;
  return (
    <div className="border" style={{ borderColor: "var(--color-blood-dim)", background: "var(--color-void)" }}>
      <svg viewBox="0 0 480 140" className="w-full h-auto block" role="img" aria-label="I mirrored this badge">
        <rect x="0" y="0" width="480" height="140" fill="#060b14" />
        <rect x="0" y="0" width="480" height="4" fill="#cc0000" />
        <rect x="0" y="136" width="480" height="4" fill="#cc0000" />
        <text x="20" y="34" fill="#cc0000" fontFamily="monospace" fontSize="13" fontWeight="bold" letterSpacing="2">
          ▣ I MIRRORED THIS
        </text>
        <text x="20" y="62" fill="#dfe7f5" fontFamily="monospace" fontSize="18" fontWeight="bold">
          {node.handle}
        </text>
        <text x="20" y="86" fill="#00ff41" fontFamily="monospace" fontSize="12" letterSpacing="1">
          {transport} · BUILD {buildTag}
        </text>
        <text x="20" y="108" fill="#7a8694" fontFamily="monospace" fontSize="11">
          seal {fp} · seal #{Math.floor(node.ts / 1000).toString(36).toUpperCase()}
        </text>
        {verified && (
          <text x="460" y="34" textAnchor="end" fill="#00ff41" fontFamily="monospace" fontSize="14">✓</text>
        )}
        <text x="460" y="128" textAnchor="end" fill="#3a4452" fontFamily="monospace" fontSize="9">V FOR X</text>
      </svg>
    </div>
  );
}
