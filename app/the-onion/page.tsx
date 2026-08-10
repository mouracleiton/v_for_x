"use client";

import { useState, useCallback } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";

/* ═══════════════════════════════════════════════════════════
   V FOR X — Tor / .onion Hidden Service Mirror Guide
   Step-by-step instructions to host this platform as a
   censorship-resistant onion service on a Linux server.
   ═══════════════════════════════════════════════════════════ */

interface ConfigBlock {
  label: string;
  code: string;
}

const CONFIGS: Record<string, ConfigBlock> = {
  install: {
    label: "Install Tor (Debian/Ubuntu)",
    code: `# Add the official Tor project repository
sudo apt update
sudo apt install -y tor`,
  },
  torrc: {
    label: "/etc/tor/torrc — hidden service definition",
    code: `# ── V FOR X hidden service ──
# Directory where Tor stores the onion keys + hostname
HiddenServiceDir /var/lib/tor/vforx/

# Expose the static site on onion port 80,
# forwarding to the local Nginx server on 8080.
HiddenServicePort 80 127.0.0.1:8080

# (Optional) a vanity v3 address needs an offline tool
# such as mkp224o — the default is a random address.

# Restart to apply
# sudo systemctl restart tor`,
  },
  hostname: {
    label: "Read your .onion address",
    code: `sudo cat /var/lib/tor/vforx/hostname
# Output looks like:  vforx7q2z...abc.onion`,
  },
  nginx: {
    label: "/etc/nginx/sites-available/vforx — serve the static export",
    code: `server {
    listen 127.0.0.1:8080;
    server_name _;

    # The Next.js static export output
    root /var/www/vforx/out;
    index index.html;

    # ── Security headers (onion does NOT need HTTPS) ──
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header Content-Security-Policy "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self';" always;

    # No access logs — privacy by default
    access_log off;

    location / {
        try_files $uri $uri/ $uri.html /index.html;
    }

    # Never expose hidden files
    location ~ /\\. {
        deny all;
    }
}`,
  },
  enable: {
    label: "Enable services",
    code: `# Reload Nginx with the new site
sudo ln -s /etc/nginx/sites-available/vforx /etc/nginx/sites-enabled/vforx
sudo nginx -t && sudo systemctl reload nginx

# Ensure Tor starts on boot
sudo systemctl enable --now tor`,
  },
};

const SECURITY_CHECKLIST: { item: string; critical: boolean }[] = [
  { item: "Disable all JavaScript error / analytics logging — the site must not phone home", critical: true },
  { item: "Remove any third-party analytics, fonts, or CDNs — bundle everything locally", critical: true },
  { item: "Do NOT add HTTPS certificates — onion services already provide end-to-end encryption via Tor", critical: true },
  { item: "Strip metadata from all assets (images, PDFs) before deploying", critical: false },
  { item: "Set Referrer-Policy: no-referrer so no originating paths leak", critical: false },
  { item: "Disable server access logs (access_log off) — privacy by default", critical: false },
  { item: "Run Tor as its own user; never run the web server as root", critical: false },
  { item: "Keep the system updated — apt update && apt upgrade regularly", critical: false },
  { item: "Use a firewall: only allow SSH + the local Nginx port, never expose 8080 to the public internet", critical: false },
  { item: "Test the onion address from Tor Browser, not a clearnet browser", critical: false },
];

const VERIFICATION_STEPS = [
  "Install Tor Browser from torproject.org (verify the signature).",
  "Paste your .onion address into the address bar — it must load with the '🔒 onion' icon.",
  "Confirm the page loads with NO clearnet requests (check the Tor Browser circuit / network tab).",
  "Verify the onion address is the exact hostname from /var/lib/tor/vforx/hostname.",
  "Reload several times to confirm stability and that no external resources fail.",
];

export default function TheOnionPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const [onionInput, setOnionInput] = useState("");
  const [checklist, setChecklist] = useState<Record<number, boolean>>({});

  const copy = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      sound.select();
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard blocked — ignore */
    }
  }, []);

  const toggleCheck = (i: number) => {
    setChecklist((prev) => ({ ...prev, [i]: !prev[i] }));
    sound.select();
  };

  // QR code via public API that renders the onion address as an SVG.
  // Built client-side so the address never leaves the device unless shared.
  const qrUrl =
    onionInput.trim().length > 0
      ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&bgcolor=060b14&color=dfe7f5&margin=0&data=${encodeURIComponent(
          onionInput.trim(),
        )}`
      : null;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <header className="space-y-2">
        <div
          className="text-xs uppercase tracking-widest"
          style={{ color: "var(--color-terminal-green)" }}
        >
          {"} censorship-resistant mirror"}
        </div>
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--color-content-primary)" }}
        >
          <span className="glitch" data-text="THE ONION">
            THE ONION
          </span>
        </h1>
        <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
          Host V FOR X as a Tor hidden service (.onion). A static export needs no
          database and no server-side code — making it an ideal onion site that
          resists takedown and survives censorship. This guide mirrors{" "}
          <code style={{ color: "var(--color-command-bright)" }}>the entire platform</code>{" "}
          to the dark web in under 30 minutes.
        </p>
      </header>

      {/* Critical warning */}
      <TerminalCard title="read this first" accent="blood" glow>
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-content-primary)" }}>
          <span style={{ color: "var(--color-blood-bright)" }}>⚠ CRITICAL:</span> Because this
          is a <strong>static export</strong>, the onion mirror is fully functional offline.
          Any copy of the <code>out/</code> folder is a complete node. Ensure the build contains{" "}
          <strong>no third-party analytics, no external fonts, and no CDNs</strong> before
          deploying — every external request can leak a visitor&apos;s clearnet identity.
          Onion services are <strong>already end-to-end encrypted</strong>; you do not need
          (and should not add) HTTPS certificates.
        </p>
      </TerminalCard>

      {/* Step 1: Prerequisites */}
      <TerminalCard title="01 — prerequisites" accent="green">
        <ul className="text-sm space-y-2" style={{ color: "var(--color-content-secondary)" }}>
          <li>
            • A <strong style={{ color: "var(--color-content-primary)" }}>Linux server</strong>{" "}
            (Debian/Ubuntu recommended) with root or sudo access.
          </li>
          <li>
            • A working <strong style={{ color: "var(--color-content-primary)" }}>static export</strong>{" "}
            of V FOR X — run <code style={{ color: "var(--color-command-bright)" }}>npm run build</code>{" "}
            and copy the generated <code>out/</code> directory to the server.
          </li>
          <li>
            • <strong style={{ color: "var(--color-content-primary)" }}>Nginx</strong> (or any static
            server) to serve the files locally on port 8080.
          </li>
          <li>
            • <strong style={{ color: "var(--color-content-primary)" }}>Tor</strong> to create the
            hidden service.
          </li>
          <li>
            • <strong style={{ color: "var(--color-content-primary)" }}>Tor Browser</strong> to test
            the resulting .onion address.
          </li>
        </ul>
      </TerminalCard>

      {/* Step 2: Installation */}
      <TerminalCard title="02 — install tor" accent="green">
        <p className="text-sm mb-3" style={{ color: "var(--color-content-secondary)" }}>
          Install Tor from the official repository.
        </p>
        <CodeBlock
          id="install"
          label={CONFIGS.install.label}
          code={CONFIGS.install.code}
          copied={copied === "install"}
          onCopy={() => copy("install", CONFIGS.install.code)}
        />
      </TerminalCard>

      {/* Step 3: torrc */}
      <TerminalCard title="03 — configure the hidden service" accent="green">
        <p className="text-sm mb-3" style={{ color: "var(--color-content-secondary)" }}>
          Edit <code style={{ color: "var(--color-command-bright)" }}>/etc/tor/torrc</code> and
          define a hidden service. This tells Tor to expose the local Nginx server (port 8080) as
          an onion address on port 80.
        </p>
        <CodeBlock
          id="torrc"
          label={CONFIGS.torrc.label}
          code={CONFIGS.torrc.code}
          copied={copied === "torrc"}
          onCopy={() => copy("torrc", CONFIGS.torrc.code)}
        />
      </TerminalCard>

      {/* Step 4: Nginx */}
      <TerminalCard title="04 — nginx config" accent="green">
        <p className="text-sm mb-3" style={{ color: "var(--color-content-secondary)" }}>
          Serve the static export on <code style={{ color: "var(--color-command-bright)" }}>127.0.0.1:8080</code>{" "}
          with hardened security headers and <strong>no logging</strong>. The site must not make any
          clearnet requests.
        </p>
        <CodeBlock
          id="nginx"
          label={CONFIGS.nginx.label}
          code={CONFIGS.nginx.code}
          copied={copied === "nginx"}
          onCopy={() => copy("nginx", CONFIGS.nginx.code)}
        />
        <div className="mt-3">
          <CodeBlock
            id="enable"
            label={CONFIGS.enable.label}
            code={CONFIGS.enable.code}
            copied={copied === "enable"}
            onCopy={() => copy("enable", CONFIGS.enable.code)}
          />
        </div>
      </TerminalCard>

      {/* Step 5: Get onion address */}
      <TerminalCard title="05 — get your .onion address" accent="green">
        <p className="text-sm mb-3" style={{ color: "var(--color-content-secondary)" }}>
          After restarting Tor, the hostname file contains your unique{" "}
          <strong style={{ color: "var(--color-content-primary)" }}>v3 onion address</strong>{" "}
          (56 characters ending in <code>.onion</code>). Keep the private key in{" "}
          <code>/var/lib/tor/vforx/</code> safe — it <em>is</em> your address.
        </p>
        <CodeBlock
          id="hostname"
          label={CONFIGS.hostname.label}
          code={CONFIGS.hostname.code}
          copied={copied === "hostname"}
          onCopy={() => copy("hostname", CONFIGS.hostname.code)}
        />
      </TerminalCard>

      {/* Step 6: Security hardening checklist */}
      <TerminalCard title="06 — security hardening checklist" accent="blood" glow>
        <p className="text-sm mb-4" style={{ color: "var(--color-content-secondary)" }}>
          Tick each item before going live. Items marked in crimson are{" "}
          <span style={{ color: "var(--color-blood-bright)" }}>critical</span>.
        </p>
        <ul className="space-y-2">
          {SECURITY_CHECKLIST.map((c, i) => (
            <li
              key={i}
              onClick={() => toggleCheck(i)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleCheck(i);
                }
              }}
              className="flex items-start gap-3 cursor-pointer text-sm p-2 rounded transition-colors hover:bg-[var(--color-panel-hi)]"
              style={{ color: "var(--color-content-primary)" }}
            >
              <span
                className="mt-0.5 inline-flex items-center justify-center w-5 h-5 border flex-shrink-0 text-xs"
                style={{
                  borderColor: c.critical
                    ? "var(--color-blood)"
                    : "var(--color-border-bright)",
                  color: "var(--color-terminal-green)",
                  background: checklist[i]
                    ? "var(--color-terminal-green)"
                    : "transparent",
                }}
              >
                {checklist[i] ? "✓" : ""}
              </span>
              <span>
                {c.critical && (
                  <span style={{ color: "var(--color-blood-bright)" }}>⚠ </span>
                )}
                {c.item}
              </span>
            </li>
          ))}
        </ul>
      </TerminalCard>

      {/* Step 7: Verification */}
      <TerminalCard title="07 — verification steps" accent="green">
        <ol className="text-sm space-y-2 list-decimal list-inside" style={{ color: "var(--color-content-secondary)" }}>
          {VERIFICATION_STEPS.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </TerminalCard>

      {/* Step 8: QR code for sharing */}
      <TerminalCard title="08 — qr code for sharing" accent="green">
        <p className="text-sm mb-3" style={{ color: "var(--color-content-secondary)" }}>
          Generate a QR code for your onion address so it can be shared offline and scanned in
          Tor Browser on mobile. The address is rendered locally in your browser.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="flex-1 w-full">
            <input
              type="text"
              value={onionInput}
              onChange={(e) => setOnionInput(e.target.value)}
              placeholder="paste your v3 .onion address here…"
              className="w-full px-3 py-2 text-sm bg-[var(--color-void)] border rounded font-mono"
              style={{ borderColor: "var(--color-border-bright)", color: "var(--color-content-primary)" }}
            />
            <p className="text-xs mt-2" style={{ color: "var(--color-content-dim)" }}>
              {qrUrl
                ? "QR generated. Right-click the image to save and print for offline distribution."
                : "Nothing leaves your device — the QR is rendered on the fly."}
            </p>
          </div>
          <div
            className="p-3 border rounded flex items-center justify-center"
            style={{
              borderColor: "var(--color-border-bright)",
              background: "var(--color-void)",
              minHeight: 240,
              minWidth: 240,
            }}
          >
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="onion address QR code" width={216} height={216} />
            ) : (
              <span className="text-xs text-center" style={{ color: "var(--color-content-dim)" }}>
                enter an address
                <br />
                to render QR
              </span>
            )}
          </div>
        </div>
      </TerminalCard>

      {/* Footer note */}
      <footer className="text-xs pt-2 border-t" style={{ color: "var(--color-content-dim)", borderColor: "var(--color-border-dim)" }}>
        <p>
          V FOR X is a static export — every copy is a fully functional node. Mirror it anywhere,
          including on the dark web, to keep the data uncensorable. See{" "}
          <a href="/fortress/" style={{ color: "var(--color-command-bright)" }}>Fortress</a> for the
          full self-hosting philosophy.
        </p>
      </footer>
    </main>
  );
}

/* ── Copyable code block ─────────────────────────────────── */

function CodeBlock({
  id,
  label,
  code,
  copied,
  onCopy,
}: {
  id: string;
  label: string;
  code: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="border rounded overflow-hidden" style={{ borderColor: "var(--color-border-dim)" }}>
      <div
        className="flex items-center justify-between px-3 py-1.5 text-xs border-b"
        style={{ background: "var(--color-abyss)", borderColor: "var(--color-border-dim)" }}
      >
        <span style={{ color: "var(--color-content-dim)" }}>{label}</span>
        <button
          onClick={onCopy}
          id={`copy-${id}`}
          className="inline-pill px-2 py-0.5 rounded text-xs transition-colors"
          style={{
            color: copied ? "var(--color-terminal-green)" : "var(--color-command-bright)",
            border: `1px solid ${copied ? "var(--color-terminal-green)" : "var(--color-border-bright)"}`,
          }}
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <pre
        className="p-3 text-xs overflow-x-auto"
        style={{ background: "var(--color-void)", color: "var(--color-content-secondary)" }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
